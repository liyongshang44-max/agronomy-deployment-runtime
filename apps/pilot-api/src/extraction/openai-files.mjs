const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE = 50_000_000;

export const ADR_EXTRACTION_PROMPT_VERSION = 'adr-paper-extraction-prompt-v2';
export const ADR_EXTRACTION_SCHEMA_VERSION = 'adr-compilation-proposal-openai-v1';
export const ADR_EXTRACTION_PROVIDER = 'OPENAI_RESPONSES';
export const ADR_EXTRACTION_UPLOAD_CONTRACT = 'OPENAI_FILES_USER_DATA_V1';

const CLAIM_TYPES = [
  'SEMANTIC_DEFINITION',
  'PARAMETER',
  'RELATIONSHIP',
  'BIOLOGICAL_PATTERN',
  'CAUSAL_EFFECT',
  'STATISTICAL_ASSOCIATION',
  'MODEL_ASSUMPTION',
  'OPERATIONAL_RECOMMENDATION',
  'BOUNDARY_CONSTRAINT',
  'EVALUATION_CLAIM'
];

const CONTEXT_FAMILIES = [
  'BIOLOGICAL',
  'ENVIRONMENTAL',
  'MANAGEMENT',
  'OPERATIONAL',
  'MEASUREMENT',
  'JURISDICTION_ECONOMIC'
];

export class OpenAIExtractionError extends Error {
  constructor(code, message, { status = null, stage = null, providerCode = null, requestId = null } = {}) {
    super(message);
    this.name = 'OpenAIExtractionError';
    this.code = code;
    this.status = status;
    this.stage = stage;
    this.providerCode = providerCode;
    this.requestId = requestId;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', `${name} must be a positive safe integer`);
  }
  return value;
}

function authHeaders(apiKey, extra = {}) {
  return {
    authorization: `Bearer ${requiredText(apiKey, 'apiKey')}`,
    ...extra
  };
}

function safeCauseCode(error) {
  const code = error?.cause?.code ?? error?.code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : null;
}

async function apiJson(fetchImpl, url, options, failureCode, stage) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    const causeCode = safeCauseCode(error);
    throw new OpenAIExtractionError(
      'OPENAI_NETWORK_FAILURE',
      `OpenAI network request failed during ${stage}${causeCode ? ` (${causeCode})` : ''}`,
      { stage }
    );
  }

  const requestId = response.headers?.get?.('x-request-id') ?? null;
  let raw;
  try {
    raw = await response.text();
  } catch {
    throw new OpenAIExtractionError(
      'OPENAI_RESPONSE_READ_FAILED',
      `OpenAI response body could not be read during ${stage}`,
      { status: response.status, stage, requestId }
    );
  }

  let payload;
  try {
    payload = raw.length ? JSON.parse(raw) : {};
  } catch {
    throw new OpenAIExtractionError(
      failureCode,
      `OpenAI returned a non-JSON response during ${stage} (${response.status})`,
      { status: response.status, stage, requestId }
    );
  }

  if (!response.ok) {
    const providerCode = payload?.error?.code ?? payload?.error?.type ?? 'PROVIDER_REJECTED';
    const providerMessage = typeof payload?.error?.message === 'string'
      ? payload.error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_KEY]').slice(0, 500)
      : null;
    throw new OpenAIExtractionError(
      failureCode,
      `OpenAI request failed during ${stage} (${response.status}, ${providerCode})${providerMessage ? `: ${providerMessage}` : ''}`,
      { status: response.status, stage, providerCode, requestId }
    );
  }
  return payload;
}

async function collectExactPdfBytes(readable, declaredByteLength) {
  if (declaredByteLength >= OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE) {
    throw new OpenAIExtractionError(
      'OPENAI_DIRECT_FILE_INPUT_LIMIT_EXCEEDED',
      `direct Responses PDF input requires file size under 50 MB; SourceArtifact declares ${declaredByteLength} bytes`,
      { stage: 'PREPARE_FILE_INPUT' }
    );
  }
  const chunks = [];
  let total = 0;
  for await (const incoming of readable) {
    const chunk = Buffer.isBuffer(incoming) ? incoming : Buffer.from(incoming);
    total += chunk.byteLength;
    if (total >= OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE) {
      throw new OpenAIExtractionError(
        'OPENAI_DIRECT_FILE_INPUT_LIMIT_EXCEEDED',
        'direct Responses PDF input exceeded the under-50-MB provider limit while reading retained bytes',
        { stage: 'PREPARE_FILE_INPUT' }
      );
    }
    chunks.push(chunk);
  }
  if (total !== declaredByteLength) {
    throw new OpenAIExtractionError(
      'SOURCE_STREAM_LENGTH_MISMATCH',
      `source stream produced ${total} bytes but SourceArtifact declares ${declaredByteLength}`,
      { stage: 'PREPARE_FILE_INPUT' }
    );
  }
  return Buffer.concat(chunks, total);
}

function locatorSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['page', 'evidenceText'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      evidenceText: { type: 'string', minLength: 1 }
    }
  };
}

function dimensionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['semanticHint', 'valueCandidate', 'unitCandidate', 'confidence', 'sourceLocator'],
    properties: {
      semanticHint: { type: 'string', minLength: 1 },
      valueCandidate: { type: 'string', minLength: 1 },
      unitCandidate: { type: ['string', 'null'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      sourceLocator: locatorSchema()
    }
  };
}

function familySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'dimensions'],
    properties: {
      status: { type: 'string', enum: ['REPORTED', 'NOT_REPORTED'] },
      dimensions: { type: 'array', items: dimensionSchema() }
    }
  };
}

export function compilationProposalJsonSchema() {
  const sourceContextProperties = Object.fromEntries(CONTEXT_FAMILIES.map((family) => [family, familySchema()]));
  return {
    type: 'object',
    additionalProperties: false,
    required: ['claims'],
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'claimType', 'assertion', 'confidence', 'sourceLocator', 'sourceContext'],
          properties: {
            key: { type: 'string', minLength: 1 },
            claimType: { type: 'string', enum: CLAIM_TYPES },
            assertion: { type: 'string', minLength: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            sourceLocator: locatorSchema(),
            sourceContext: {
              type: 'object',
              additionalProperties: false,
              required: CONTEXT_FAMILIES,
              properties: sourceContextProperties
            }
          }
        }
      }
    }
  };
}

function extractionInstructions() {
  return [
    'You are an evidence-faithful agronomic scientific extraction worker.',
    'Extract only claims materially asserted by the supplied source. Do not generalize beyond the source.',
    'Every claim and every reported context dimension must point to the 1-based PDF page containing explicit supporting text.',
    'evidenceText must be a short source-faithful excerpt or identifying phrase; do not invent text.',
    'If a context family is not explicitly reported for a claim, set status=NOT_REPORTED and dimensions=[].',
    'Never infer crop, cultivar, growth stage, soil, climate, treatment, dose, timing, measurement method, geography, economics, or jurisdiction from background knowledge.',
    'Use CAUSAL_EFFECT only when the source design/language supports a causal effect; use STATISTICAL_ASSOCIATION for association/correlation.',
    'Discussion/speculation must not be upgraded into measured results or operational recommendations.',
    'Keep assertions atomic enough that a reviewer can accept or reject each one independently.',
    'Return only the requested structured output.'
  ].join('\n');
}

function outputText(response) {
  const texts = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') texts.push(content.text);
    }
  }
  if (texts.length === 0) {
    throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_MISSING', 'OpenAI response contained no output_text', { stage: 'RESPONSES_CREATE' });
  }
  return texts.join('');
}

function toDocumentLocator(locator) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: {
      page: positiveInteger(locator.page, 'locator.page'),
      evidenceText: requiredText(locator.evidenceText, 'locator.evidenceText')
    }
  };
}

function normalizeProviderProposal(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.claims)) {
    throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', 'structured output must contain claims[]', { stage: 'NORMALIZE_OUTPUT' });
  }
  return {
    claims: raw.claims.map((claim, index) => {
      const sourceContext = {};
      for (const family of CONTEXT_FAMILIES) {
        const input = claim.sourceContext?.[family];
        if (!input || !['REPORTED', 'NOT_REPORTED'].includes(input.status) || !Array.isArray(input.dimensions)) {
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `claim ${index} missing valid ${family}`, { stage: 'NORMALIZE_OUTPUT' });
        }
        sourceContext[family] = {
          status: input.status,
          dimensions: input.dimensions.map((dimension) => ({
            semanticHint: requiredText(dimension.semanticHint, `${family}.semanticHint`),
            valueCandidate: requiredText(dimension.valueCandidate, `${family}.valueCandidate`),
            ...(dimension.unitCandidate ? { unitCandidate: requiredText(dimension.unitCandidate, `${family}.unitCandidate`) } : {}),
            supportClass: 'EXPLICIT_SOURCE',
            confidence: dimension.confidence,
            sourceLocator: toDocumentLocator(dimension.sourceLocator)
          }))
        };
        if (input.status === 'NOT_REPORTED' && input.dimensions.length !== 0) {
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `${family} NOT_REPORTED cannot contain dimensions`, { stage: 'NORMALIZE_OUTPUT' });
        }
        if (input.status === 'REPORTED' && input.dimensions.length === 0) {
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `${family} REPORTED requires dimensions`, { stage: 'NORMALIZE_OUTPUT' });
        }
      }
      return {
        key: requiredText(claim.key, `claims[${index}].key`),
        claimType: requiredText(claim.claimType, `claims[${index}].claimType`),
        assertion: requiredText(claim.assertion, `claims[${index}].assertion`),
        confidence: claim.confidence,
        sourceLocator: toDocumentLocator(claim.sourceLocator),
        sourceContext
      };
    })
  };
}

async function uploadUserDataPdf({ fetchImpl, apiKey, filename, bytes }) {
  let form;
  try {
    form = new FormData();
    form.append('purpose', 'user_data');
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
  } catch {
    throw new OpenAIExtractionError('OPENAI_FILE_MULTIPART_BUILD_FAILED', 'could not construct multipart PDF upload', { stage: 'FILES_UPLOAD' });
  }
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: form
  }, 'OPENAI_FILE_UPLOAD_FAILED', 'FILES_UPLOAD');
}

async function deleteFile({ fetchImpl, apiKey, fileId }) {
  try {
    await apiJson(fetchImpl, `${OPENAI_API_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey)
    }, 'OPENAI_FILE_DELETE_FAILED', 'FILES_DELETE');
    return true;
  } catch {
    return false;
  }
}

async function createExtractionResponse({ fetchImpl, apiKey, model, fileId }) {
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: authHeaders(apiKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_id: fileId, detail: 'low' },
          { type: 'input_text', text: extractionInstructions() }
        ]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'adr_compilation_proposal',
          strict: true,
          schema: compilationProposalJsonSchema()
        }
      }
    })
  }, 'OPENAI_EXTRACTION_FAILED', 'RESPONSES_CREATE');
}

export async function extractCompilationProposalWithOpenAI({
  readable,
  byteLength,
  filename,
  model,
  apiKey,
  fetchImpl = globalThis.fetch
}) {
  if (!readable || typeof readable[Symbol.asyncIterator] !== 'function') {
    throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', 'readable async stream is required');
  }
  positiveInteger(byteLength, 'byteLength');
  const safeFilename = requiredText(filename, 'filename');
  const safeModel = requiredText(model, 'model');
  requiredText(apiKey, 'apiKey');
  if (typeof fetchImpl !== 'function') throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', 'fetch implementation is required');

  let fileId = null;
  let cleanupDeleted = false;
  try {
    const bytes = await collectExactPdfBytes(readable, byteLength);
    const file = await uploadUserDataPdf({ fetchImpl, apiKey, filename: safeFilename, bytes });
    fileId = requiredText(file.id, 'provider file id');
    const response = await createExtractionResponse({ fetchImpl, apiKey, model: safeModel, fileId });
    let parsed;
    try {
      parsed = JSON.parse(outputText(response));
    } catch (error) {
      if (error instanceof OpenAIExtractionError) throw error;
      throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID_JSON', 'OpenAI structured output was not valid JSON', { stage: 'NORMALIZE_OUTPUT' });
    }
    const normalized = normalizeProviderProposal(parsed);
    cleanupDeleted = await deleteFile({ fetchImpl, apiKey, fileId });
    return {
      proposal: {
        ...normalized,
        runMetadata: {
          provider: ADR_EXTRACTION_PROVIDER,
          model: safeModel,
          promptVersion: ADR_EXTRACTION_PROMPT_VERSION,
          schemaVersion: ADR_EXTRACTION_SCHEMA_VERSION,
          uploadContract: ADR_EXTRACTION_UPLOAD_CONTRACT
        }
      },
      providerTrace: {
        provider: ADR_EXTRACTION_PROVIDER,
        model: safeModel,
        responseId: typeof response.id === 'string' ? response.id : null,
        providerFileId: fileId,
        uploadedBytes: byteLength,
        fileDeletedAfterExtraction: cleanupDeleted,
        uploadContract: ADR_EXTRACTION_UPLOAD_CONTRACT
      }
    };
  } catch (error) {
    if (fileId && !cleanupDeleted) await deleteFile({ fetchImpl, apiKey, fileId });
    if (error instanceof OpenAIExtractionError) throw error;
    const causeCode = safeCauseCode(error);
    throw new OpenAIExtractionError(
      'OPENAI_EXTRACTION_RUNTIME_FAILURE',
      `OpenAI extraction runtime failed${causeCode ? ` (${causeCode})` : ''}`,
      { stage: 'UNCLASSIFIED_RUNTIME' }
    );
  }
}
