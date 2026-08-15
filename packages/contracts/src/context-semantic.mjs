import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';

export const CONTEXT_VALUE_TYPES = deepFreeze([
  'DECIMAL',
  'INTEGER',
  'BOOLEAN',
  'STRING',
  'CATEGORY',
  'DATE',
  'TIMESTAMP',
  'INTERVAL',
  'SET',
  'UNKNOWN'
]);

const VALUE_TYPE_SET = new Set(CONTEXT_VALUE_TYPES);
const SEMANTIC_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const DECIMAL_PATTERN = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_PATTERN = /^[+-]?(?:0|[1-9]\d*)$/;

export class ContextSemanticError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextSemanticError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContextSemanticError('INVALID_CONTEXT_SEMANTIC_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function normalizeSemanticId(value) {
  const semanticId = requiredText(value, 'semanticId');
  if (!SEMANTIC_ID_PATTERN.test(semanticId)) {
    throw new ContextSemanticError('INVALID_SEMANTIC_ID', `semanticId must match ${SEMANTIC_ID_PATTERN}`);
  }
  return semanticId;
}

function canonicalDecimal(value) {
  if (typeof value !== 'string') {
    throw new ContextSemanticError(
      'SOURCE_VALUE_TYPE_MISMATCH',
      'DECIMAL source values must arrive as canonical decimal text; binary floating-point candidate values are not accepted as authority'
    );
  }
  const text = value.trim();
  if (!DECIMAL_PATTERN.test(text)) {
    throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', `invalid decimal source value ${value}`);
  }
  let sign = '';
  let body = text;
  if (body.startsWith('+')) body = body.slice(1);
  if (body.startsWith('-')) {
    sign = '-';
    body = body.slice(1);
  }
  let [whole, fraction] = body.split('.');
  whole = whole.replace(/^0+(?=\d)/, '');
  if (fraction !== undefined) {
    fraction = fraction.replace(/0+$/, '');
    if (fraction.length === 0) fraction = undefined;
  }
  const normalized = fraction === undefined ? whole : `${whole}.${fraction}`;
  if (/^0(?:\.0*)?$/.test(normalized)) sign = '';
  return `${sign}${normalized}`;
}

function canonicalInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', 'INTEGER number must be a safe integer');
    }
    return String(value);
  }
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value.trim())) {
    throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', `invalid integer source value ${value}`);
  }
  return String(BigInt(value.trim()));
}

function normalizeScalar(value, valueType) {
  switch (valueType) {
    case 'DECIMAL':
      return deepFreeze({ type: valueType, decimal: canonicalDecimal(value) });
    case 'INTEGER':
      return deepFreeze({ type: valueType, integer: canonicalInteger(value) });
    case 'BOOLEAN':
      if (typeof value !== 'boolean') throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', 'BOOLEAN source value must be boolean');
      return deepFreeze({ type: valueType, boolean: value });
    case 'STRING':
      return deepFreeze({ type: valueType, string: requiredText(value, 'sourceValue') });
    case 'CATEGORY':
      return deepFreeze({ type: valueType, category: requiredText(value, 'sourceValue') });
    case 'DATE': {
      const text = requiredText(value, 'sourceValue');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
        throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', `invalid DATE source value ${text}`);
      }
      return deepFreeze({ type: valueType, date: text });
    }
    case 'TIMESTAMP': {
      const text = requiredText(value, 'sourceValue');
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', `invalid TIMESTAMP source value ${text}`);
      return deepFreeze({ type: valueType, timestamp: parsed.toISOString() });
    }
    case 'UNKNOWN':
      if (!(value === null || value === undefined || value === 'UNKNOWN')) {
        throw new ContextSemanticError('SOURCE_VALUE_TYPE_MISMATCH', 'UNKNOWN requires null/undefined/UNKNOWN candidate value');
      }
      return deepFreeze({ type: valueType });
    default:
      throw new ContextSemanticError('UNSUPPORTED_SOURCE_VALUE_TYPE', `source-faithful K03 normalization does not yet support ${valueType}`);
  }
}

export function normalizeSourceFaithfulDimension({ candidate, adjudication }) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ContextSemanticError('INVALID_CONTEXT_DIMENSION_CANDIDATE', 'candidate dimension is required');
  }
  if (!adjudication || typeof adjudication !== 'object' || Array.isArray(adjudication)) {
    throw new ContextSemanticError('SEMANTIC_ADJUDICATION_REQUIRED', 'source-faithful semantic adjudication is required for each reported dimension');
  }

  const semanticId = normalizeSemanticId(adjudication.semanticId);
  const valueType = requiredText(adjudication.valueType, 'valueType');
  if (!VALUE_TYPE_SET.has(valueType)) {
    throw new ContextSemanticError('INVALID_CONTEXT_VALUE_TYPE', `unsupported context value type ${valueType}`);
  }
  if (valueType === 'INTERVAL' || valueType === 'SET') {
    throw new ContextSemanticError(
      'UNSUPPORTED_SOURCE_VALUE_TYPE',
      `${valueType} requires the later complete shared context contract; K03 cannot invent a provisional authority encoding`
    );
  }

  const value = normalizeScalar(candidate.valueCandidate, valueType);
  const candidateUnit = candidate.unitCandidate === undefined ? undefined : requiredText(candidate.unitCandidate, 'candidate.unitCandidate');
  const adjudicatedUnit = adjudication.unit === undefined ? undefined : requiredText(adjudication.unit, 'adjudication.unit');

  if (candidateUnit !== adjudicatedUnit) {
    throw new ContextSemanticError(
      'UNGOVERNED_UNIT_NORMALIZATION',
      'K03 may not change or invent units; a differing unit requires a later governed transformation/semantic contract'
    );
  }

  return deepFreeze({
    semanticId,
    value,
    ...(adjudicatedUnit ? { unit: adjudicatedUnit } : {}),
    sourceLocator: cloneCanonicalValue(candidate.sourceLocator)
  });
}
