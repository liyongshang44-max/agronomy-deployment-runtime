const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_PART_BYTES = 8 * 1024 * 1024;

export const ADR_EXTRACTION_PROMPT_VERSION = 'adr-paper-extraction-prompt-v1';
export const ADR_EXTRACTION_SCHEMA_VERSION = 'adr-compilation-proposal-openai-v1';
export const ADR_EXTRACTION_PROVIDER = 'OPENAI_RESPONSES';

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
  constructor(code, message, { status = null } = {}) {
    super(message);
    this.name = 'OpenAIExtractionError';
    this.code = code;
    this.status = status;
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

async function apiJson(fetchImpl, url, options, failureCode) {
  const response = await fetchImpl(url, options);
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw.length ? JSON.parse(raw) : {};
  } catch {
    throw new OpenAIExtractionError(failureCode, `provider returned non-JSON response (${response.status})`, { status: response.status });
  }
  if (!response.ok) {
    const providerCode = payload?.error?.code ?? payload?.error?.type ?? 'PROVIDER_REJECTED';
    throw new OpenAIExtractionError(failureCode, `OpenAI request failed (${response.status}, ${providerCode})`, { status: response.status });
  }
  return payload;
}

async function* boundedParts(readable, partBytes) {
  let chunks = [];
  let buffered = 0;
  for await (const incoming of readable) {
    let chunk = Buffer.isBuffer(incoming) ? incoming : Buffer.from(incoming);
    while (chunk.byteLength > 0) {
      const remaining = partBytes - buffered;
      const take = Math.min(remaining, chunk.byteLength);
      chunks.push(chunk.subarray(0, take));
      buffered += take;
      chunk = chunk.subarray(take);
      if (buffered === partBytes) {
        yield Buffer.concat(chunks, buffered);
        chunks = [];
        buffered = 0;
      }
    }
  }
  if (buffered > 0) yield Buffer.concat(chunks, buffered);
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
    throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_MISSING', 'OpenAI response contained no output_text');
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
    throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', 'structured output must contain claims[]');
  }
  return {
    claims: raw.claims.map((claim, index) => {
      const sourceContext = {};
      for (const family of CONTEXT_FAMILIES) {
        const input = claim.sourceContext?.[family];
        if (!input || !['REPORTED', 'NOT_REPORTED'].includes(input.status) || !Array.isArray(input.dimensions)) {
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `claim ${index} missing valid ${family}`);
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
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `${family} NOT_REPORTED cannot contain dimensions`);
        }
        if (input.status === 'REPORTED' && input.dimensions.length === 0) {
          throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID', `${family} REPORTED requires dimensions`);
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

async function createUpload({ fetchImpl, apiKey, filename, byteLength }) {
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/uploads`, {
    method: 'POST',
    headers: authHeaders(apiKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      purpose: 'user_data',
      filename,
      bytes: byteLength,
      mime_type: 'application/pdf',
      expires_after: { anchor: 'created_at', seconds: 3600 }
    })
  }, 'OPENAI_UPLOAD_CREATE_FAILED');
}

async function addUploadPart({ fetchImpl, apiKey, uploadId, bytes }) {
  const form = new FormData();
  form.append('data', new Blob([bytes], { type: 'application/octet-stream' }), 'part.bin');
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/uploads/${encodeURIComponent(uploadId)}/parts`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: form
  }, 'OPENAI_UPLOAD_PART_FAILED');
}

async function completeUpload({ fetchImpl, apiKey, uploadId, partIds }) {
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/uploads/${encodeURIComponent(uploadId)}/complete`, {
    method: 'POST',
    headers: authHeaders(apiKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ part_ids: partIds })
  }, 'OPENAI_UPLOAD_COMPLETE_FAILED');
}

async function cancelUpload({ fetchImpl, apiKey, uploadId }) {
  try {
    await apiJson(fetchImpl, `${OPENAI_API_BASE}/uploads/${encodeURIComponent(uploadId)}/cancel`, {
      method: 'POST', headers: authHeaders(apiKey)
    }, 'OPENAI_UPLOAD_CANCEL_FAILED');
  } catch {
    // Cleanup is best-effort after a primary failure; the upload also expires after one hour.
  }
}

async function deleteFile({ fetchImpl, apiKey, fileId }) {
  try {
    await apiJson(fetchImpl, `${OPENAI_API_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE', headers: authHeaders(apiKey)
    }, 'OPENAI_FILE_DELETE_FAILED');
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
          { type: 'input_file', file_id: fileId },
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
  }, 'OPENAI_EXTRACTION_FAILED');
}

export async function extractCompilationProposalWithOpenAI({
  readable,
  byteLength,
  filename,
  model,
  apiKey,
  fetchImpl = globalThis.fetch,
  partBytes = DEFAULT_PART_BYTES
}) {
  if (!readable || typeof readable[Symbol.asyncIterator] !== 'function') {
    throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', 'readable async stream is required');
  }
  positiveInteger(byteLength, 'byteLength');
  const safeFilename = requiredText(filename, 'filename');
  const safeModel = requiredText(model, 'model');
  requiredText(apiKey, 'apiKey');
  if (typeof fetchImpl !== 'function') throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', 'fetch implementation is required');
  positiveInteger(partBytes, 'partBytes');
  if (partBytes > 64 * 1024 * 1024) {
    throw new OpenAIExtractionError('INVALID_EXTRACTION_INPUT', 'partBytes cannot exceed OpenAI 64 MiB upload-part limit');
  }

  let uploadId = null;
  let fileId = null;
  let uploadedBytes = 0;
  let cleanupDeleted = false;
  try {
    const upload = await createUpload({ fetchImpl, apiKey, filename: safeFilename, byteLength });
    uploadId = requiredText(upload.id, 'provider upload id');
    const partIds = [];
    for await (const part of boundedParts(readable, partBytes)) {
      uploadedBytes += part.byteLength;
      const created = await addUploadPart({ fetchImpl, apiKey, uploadId, bytes: part });
      partIds.push(requiredText(created.id, 'provider upload part id'));
    }
    if (uploadedBytes !== byteLength) {
      throw new OpenAIExtractionError(
        'SOURCE_STREAM_LENGTH_MISMATCH',
        `source stream produced ${uploadedBytes} bytes but SourceArtifact declares ${byteLength}`
      );
    }
    const completed = await completeUpload({ fetchImpl, apiKey, uploadId, partIds });
    fileId = requiredText(completed?.file?.id, 'provider file id');
    const response = await createExtractionResponse({ fetchImpl, apiKey, model: safeModel, fileId });
    const parsed = JSON.parse(outputText(response));
    const normalized = normalizeProviderProposal(parsed);
    cleanupDeleted = await deleteFile({ fetchImpl, apiKey, fileId });
    return {
      proposal: {
        ...normalized,
        runMetadata: {
          provider: ADR_EXTRACTION_PROVIDER,
          model: safeModel,
          promptVersion: ADR_EXTRACTION_PROMPT_VERSION,
          schemaVersion: ADR_EXTRACTION_SCHEMA_VERSION
        }
      },
      providerTrace: {
        provider: ADR_EXTRACTION_PROVIDER,
        model: safeModel,
        responseId: typeof response.id === 'string' ? response.id : null,
        providerFileId: fileId,
        uploadedBytes,
        fileDeletedAfterExtraction: cleanupDeleted
      }
    };
  } catch (error) {
    if (uploadId && !fileId) await cancelUpload({ fetchImpl, apiKey, uploadId });
    if (fileId && !cleanupDeleted) await deleteFile({ fetchImpl, apiKey, fileId });
    if (error instanceof OpenAIExtractionError) throw error;
    if (error instanceof SyntaxError) {
      throw new OpenAIExtractionError('OPENAI_STRUCTURED_OUTPUT_INVALID_JSON', 'OpenAI structured output was not valid JSON');
    }
    throw new OpenAIExtractionError('OPENAI_EXTRACTION_UNCLASSIFIED_FAILURE', 'OpenAI extraction failed');
  }
}
