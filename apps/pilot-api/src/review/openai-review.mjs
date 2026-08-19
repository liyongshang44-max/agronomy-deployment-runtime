import { AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS } from '../../../../packages/knowledge-registry/src/automated-source-faithful.mjs';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE = 50_000_000;

export const ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER = 'OPENAI_RESPONSES';
export const ADR_SOURCE_FAITHFUL_REVIEW_PROMPT_VERSION = 'adr-source-faithful-review-prompt-v1';
export const ADR_SOURCE_FAITHFUL_REVIEW_SCHEMA_VERSION = 'adr-source-faithful-review-output-v1';
export const ADR_SOURCE_FAITHFUL_REVIEW_UPLOAD_FILENAME = 'source-review.pdf';

const CONTEXT_VALUE_TYPES = [
  'DECIMAL', 'INTEGER', 'BOOLEAN', 'STRING', 'CATEGORY', 'DATE', 'TIMESTAMP', 'UNKNOWN'
];

export class OpenAIAutomatedReviewError extends Error {
  constructor(code, message, { status = null, stage = null, providerCode = null, requestId = null } = {}) {
    super(message);
    this.name = 'OpenAIAutomatedReviewError';
    this.code = code;
    this.status = status;
    this.stage = stage;
    this.providerCode = providerCode;
    this.requestId = requestId;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OpenAIAutomatedReviewError('INVALID_AUTOMATED_REVIEW_PROVIDER_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OpenAIAutomatedReviewError('INVALID_AUTOMATED_REVIEW_PROVIDER_INPUT', `${name} must be a positive safe integer`);
  }
  return value;
}

function authHeaders(apiKey, extra = {}) {
  return { authorization: `Bearer ${requiredText(apiKey, 'apiKey')}`, ...extra };
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
    throw new OpenAIAutomatedReviewError(
      'OPENAI_AUTOMATED_REVIEW_NETWORK_FAILURE',
      `OpenAI network request failed during ${stage}${causeCode ? ` (${causeCode})` : ''}`,
      { stage }
    );
  }
  const requestId = response.headers?.get?.('x-request-id') ?? null;
  const raw = await response.text();
  let payload;
  try { payload = raw.length ? JSON.parse(raw) : {}; }
  catch {
    throw new OpenAIAutomatedReviewError(failureCode, `OpenAI returned non-JSON during ${stage} (${response.status})`, {
      status: response.status, stage, requestId
    });
  }
  if (!response.ok) {
    const providerCode = payload?.error?.code ?? payload?.error?.type ?? 'PROVIDER_REJECTED';
    throw new OpenAIAutomatedReviewError(
      failureCode,
      `OpenAI automated review failed during ${stage} (${response.status}, ${providerCode})`,
      { status: response.status, stage, providerCode, requestId }
    );
  }
  return payload;
}

async function collectExactPdfBytes(readable, declaredByteLength) {
  if (declaredByteLength >= OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE) {
    throw new OpenAIAutomatedReviewError(
      'OPENAI_AUTOMATED_REVIEW_FILE_LIMIT_EXCEEDED',
      `direct review PDF input requires under 50 MB; SourceArtifact declares ${declaredByteLength} bytes`,
      { stage: 'PREPARE_FILE_INPUT' }
    );
  }
  const chunks = [];
  let total = 0;
  for await (const incoming of readable) {
    const chunk = Buffer.isBuffer(incoming) ? incoming : Buffer.from(incoming);
    total += chunk.byteLength;
    if (total >= OPENAI_DIRECT_FILE_INPUT_MAX_BYTES_EXCLUSIVE) {
      throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_FILE_LIMIT_EXCEEDED', 'review PDF exceeded provider limit', { stage: 'PREPARE_FILE_INPUT' });
    }
    chunks.push(chunk);
  }
  if (total !== declaredByteLength) {
    throw new OpenAIAutomatedReviewError(
      'SOURCE_STREAM_LENGTH_MISMATCH',
      `source stream produced ${total} bytes but SourceArtifact declares ${declaredByteLength}`,
      { stage: 'PREPARE_FILE_INPUT' }
    );
  }
  return Buffer.concat(chunks, total);
}

function contextAdjudicationSchema(blindPacket) {
  const properties = {};
  const required = [];
  for (const [family, candidateFamily] of Object.entries(blindPacket.sourceContext)) {
    const count = candidateFamily.status === 'REPORTED' ? candidateFamily.dimensions.length : 0;
    required.push(family);
    properties[family] = {
      type: 'array',
      minItems: count,
      maxItems: count,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['semanticId', 'valueType', 'unit'],
        properties: {
          semanticId: { type: 'string', pattern: '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$' },
          valueType: { type: 'string', enum: CONTEXT_VALUE_TYPES },
          unit: { type: ['string', 'null'] }
        }
      }
    };
  }
  return {
    type: 'object',
    additionalProperties: false,
    required,
    properties
  };
}

export function automatedSourceFaithfulReviewJsonSchema(blindPacket) {
  const checkProperties = Object.fromEntries(
    AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, { type: 'string', enum: ['PASS', 'FAIL'] }])
  );
  return {
    type: 'object',
    additionalProperties: false,
    required: ['disposition', 'reasonCodes', 'rationale', 'reviewConfidence', 'checks', 'contextAdjudication'],
    properties: {
      disposition: {
        type: 'string',
        enum: ['ACCEPT_SOURCE_FAITHFUL', 'REJECT_SOURCE_FAITHFUL', 'ESCALATE_TO_HUMAN']
      },
      reasonCodes: { type: 'array', items: { type: 'string', minLength: 1 } },
      rationale: { type: 'string', minLength: 1 },
      reviewConfidence: { type: 'number', minimum: 0, maximum: 1 },
      checks: {
        type: 'object',
        additionalProperties: false,
        required: AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS,
        properties: checkProperties
      },
      contextAdjudication: contextAdjudicationSchema(blindPacket)
    }
  };
}

function reviewInstructions(blindPacket) {
  return [
    'You are the independent second-pass source-faithful reviewer for an agronomic knowledge compiler.',
    'Your task is falsification, not extraction and not rewriting.',
    'Evaluate only the supplied candidate pair against the supplied exact PDF.',
    'Do not repair, expand, rewrite, split, merge, normalize, or improve the candidate. If the unchanged candidate is not source-faithful, reject or escalate.',
    'Treat the claim assertion and every attached SourceContext dimension as one review unit.',
    'A source-supported fact still fails if the claim-level evidence locator does not cover every material proposition in the assertion.',
    'Reject causal strengthening, omitted temporal windows, omitted population/geography/management/measurement qualifiers, unsupported inference, or context contamination.',
    'If evidence is ambiguous, inaccessible, internally conflicting, or you cannot verify exact support, choose ESCALATE_TO_HUMAN rather than guessing.',
    'ACCEPT_SOURCE_FAITHFUL requires all eleven checks PASS and no defect reasonCodes.',
    'REJECT_SOURCE_FAITHFUL requires at least one failed check and one or more concise defect reasonCodes.',
    'For ACCEPT only, contextAdjudication maps each existing reported source-context dimension to semanticId/valueType without changing its value or unit. For non-ACCEPT dispositions, still return arrays of the required lengths; use the candidate semanticHint as semanticId where it is already syntactically valid, CATEGORY for textual categorical values, and null unit when the candidate reports no unit. These fields have no authority unless deterministic promotion accepts the review.',
    'Do not infer missing context. NOT_REPORTED families must remain empty.',
    'Return only the requested structured output.',
    '',
    'BLIND REVIEW PACKET:',
    JSON.stringify(blindPacket)
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
    throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_OUTPUT_MISSING', 'OpenAI response contained no output_text', { stage: 'RESPONSES_CREATE' });
  }
  return texts.join('');
}

async function uploadUserDataPdf({ fetchImpl, apiKey, bytes }) {
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), ADR_SOURCE_FAITHFUL_REVIEW_UPLOAD_FILENAME);
  return apiJson(fetchImpl, `${OPENAI_API_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: form
  }, 'OPENAI_AUTOMATED_REVIEW_FILE_UPLOAD_FAILED', 'FILES_UPLOAD');
}

async function deleteFile({ fetchImpl, apiKey, fileId }) {
  try {
    await apiJson(fetchImpl, `${OPENAI_API_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE', headers: authHeaders(apiKey)
    }, 'OPENAI_AUTOMATED_REVIEW_FILE_DELETE_FAILED', 'FILES_DELETE');
    return true;
  } catch { return false; }
}

async function createReviewResponse({ fetchImpl, apiKey, model, fileId, blindPacket }) {
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
          { type: 'input_text', text: reviewInstructions(blindPacket) }
        ]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'adr_source_faithful_review',
          strict: true,
          schema: automatedSourceFaithfulReviewJsonSchema(blindPacket)
        }
      }
    })
  }, 'OPENAI_AUTOMATED_REVIEW_FAILED', 'RESPONSES_CREATE');
}

function normalizeAdjudication(raw, blindPacket) {
  const output = {};
  for (const [family, candidateFamily] of Object.entries(blindPacket.sourceContext)) {
    const rawItems = raw?.[family];
    if (!Array.isArray(rawItems)) {
      throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_OUTPUT_INVALID', `contextAdjudication.${family} must be an array`, { stage: 'NORMALIZE_OUTPUT' });
    }
    const expected = candidateFamily.status === 'REPORTED' ? candidateFamily.dimensions.length : 0;
    if (rawItems.length !== expected) {
      throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_OUTPUT_INVALID', `contextAdjudication.${family} length mismatch`, { stage: 'NORMALIZE_OUTPUT' });
    }
    output[family] = rawItems.map((item) => ({
      semanticId: requiredText(item.semanticId, `${family}.semanticId`),
      valueType: requiredText(item.valueType, `${family}.valueType`),
      ...(item.unit === null ? {} : { unit: requiredText(item.unit, `${family}.unit`) })
    }));
  }
  return output;
}

function normalizeReviewOutput(raw, blindPacket) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_OUTPUT_INVALID', 'review output must be an object', { stage: 'NORMALIZE_OUTPUT' });
  }
  return {
    disposition: requiredText(raw.disposition, 'disposition'),
    reasonCodes: Array.isArray(raw.reasonCodes) ? raw.reasonCodes.map((value) => requiredText(value, 'reasonCode')) : [],
    rationale: requiredText(raw.rationale, 'rationale'),
    reviewConfidence: raw.reviewConfidence,
    checks: raw.checks,
    contextAdjudication: normalizeAdjudication(raw.contextAdjudication, blindPacket)
  };
}

export async function reviewSourceFaithfulnessWithOpenAI({
  readable,
  byteLength,
  filename,
  blindPacket,
  model,
  apiKey,
  fetchImpl = globalThis.fetch
}) {
  if (!readable || typeof readable[Symbol.asyncIterator] !== 'function') {
    throw new OpenAIAutomatedReviewError('INVALID_AUTOMATED_REVIEW_PROVIDER_INPUT', 'readable async stream is required');
  }
  positiveInteger(byteLength, 'byteLength');
  requiredText(filename, 'filename');
  const safeModel = requiredText(model, 'model');
  requiredText(apiKey, 'apiKey');
  if (!blindPacket || typeof blindPacket !== 'object' || Array.isArray(blindPacket)) {
    throw new OpenAIAutomatedReviewError('INVALID_AUTOMATED_REVIEW_PROVIDER_INPUT', 'blindPacket is required');
  }
  if (typeof fetchImpl !== 'function') throw new OpenAIAutomatedReviewError('INVALID_AUTOMATED_REVIEW_PROVIDER_INPUT', 'fetch implementation is required');

  let fileId = null;
  let cleanupDeleted = false;
  try {
    const bytes = await collectExactPdfBytes(readable, byteLength);
    const file = await uploadUserDataPdf({ fetchImpl, apiKey, bytes });
    fileId = requiredText(file.id, 'provider file id');
    const response = await createReviewResponse({ fetchImpl, apiKey, model: safeModel, fileId, blindPacket });
    let parsed;
    try { parsed = JSON.parse(outputText(response)); }
    catch (error) {
      if (error instanceof OpenAIAutomatedReviewError) throw error;
      throw new OpenAIAutomatedReviewError('OPENAI_AUTOMATED_REVIEW_OUTPUT_INVALID_JSON', 'structured review output was not valid JSON', { stage: 'NORMALIZE_OUTPUT' });
    }
    const output = normalizeReviewOutput(parsed, blindPacket);
    cleanupDeleted = await deleteFile({ fetchImpl, apiKey, fileId });
    return {
      output,
      reviewerMetadata: {
        provider: ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER,
        model: safeModel,
        promptVersion: ADR_SOURCE_FAITHFUL_REVIEW_PROMPT_VERSION,
        schemaVersion: ADR_SOURCE_FAITHFUL_REVIEW_SCHEMA_VERSION,
        reviewMode: 'BLIND_FALSIFICATION'
      },
      providerTrace: {
        provider: ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER,
        model: safeModel,
        responseId: response.id ?? null,
        uploadedBytes: bytes.byteLength,
        providerFilename: ADR_SOURCE_FAITHFUL_REVIEW_UPLOAD_FILENAME,
        fileDeletedAfterReview: cleanupDeleted
      }
    };
  } finally {
    if (fileId && !cleanupDeleted) await deleteFile({ fetchImpl, apiKey, fileId });
  }
}
