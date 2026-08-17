import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  CONTEXT_VALUE_TYPES,
  EPISTEMIC_CLASSES,
  PROVENANCE_CLASSES,
  UNCERTAINTY_TYPES
} from '../../context-contract/src/index.mjs';

export const RUNTIME_SEMANTIC_OUTPUT_CONTRACT_VERSION = 'adr.runtime-semantic-output.v1';
export const RUNTIME_DATUM_CONTRACT_VERSION = 'adr.runtime-datum.v1';
export const RUNTIME_RESULT_CONTRACT_VERSION = 'adr.runtime-result.v1';
export const RUNTIME_DATUM_AUTHORITY_CLASS = 'RUNTIME_OUTPUT_SEMANTIC_DATUM';
export const RUNTIME_RESULT_AUTHORITY_CLASS = 'RUNTIME_EXECUTION_SEMANTIC_RESULT';

const VALUE_TYPES = new Set(CONTEXT_VALUE_TYPES);
const EPISTEMIC = new Set(EPISTEMIC_CLASSES);
const PROVENANCE = new Set(PROVENANCE_CLASSES);
const UNCERTAINTY = new Set(UNCERTAINTY_TYPES);
const MODEL_OUTPUT_EPISTEMIC = new Set(['DERIVED', 'STATE_ESTIMATE', 'FORECAST', 'MODEL_PRIOR']);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const DECIMAL_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_RE = /^-?(?:0|[1-9]\d*)$/;
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export class RuntimeResultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeResultError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_HASH', `${name} must be canonical sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_FIELD', `${name}.${key} is outside the frozen D03 contract`);
    }
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function specificationRef(value, name) {
  const ref = assertAuthorityRef(value);
  if (!['QualifiedTransformation', 'Model'].includes(ref.kind)) {
    throw new RuntimeResultError('RUNTIME_RESULT_SPECIFICATION_UNSUPPORTED', `${name} must be exact Model or QualifiedTransformation`);
  }
  return ref;
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

export function normalizeRuntimeTimestamp(value, name = 'timestamp') {
  const normalized = text(value, name);
  const match = RFC3339_RE.exec(normalized);
  if (!match) {
    throw new RuntimeResultError(
      'INVALID_RUNTIME_RESULT_TIME',
      `${name} must be RFC3339 with seconds, explicit timezone and at most millisecond precision`
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_TIME', `${name} contains an impossible calendar date or clock time`);
  }
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new RuntimeResultError('INVALID_RUNTIME_RESULT_TIME', `${name} must be valid RFC3339`);
  return parsed.toISOString();
}

function normalizeDate(value, name) {
  const normalized = text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_DATE', `${name} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_DATE', `${name} is not a real calendar date`);
  }
  return normalized;
}

function normalizeDecimal(value, name) {
  const normalized = text(value, name);
  if (!DECIMAL_RE.test(normalized)) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_DECIMAL', `${name} must be a canonical base-10 decimal string`);
  }
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  let [integer, fraction = ''] = unsigned.split('.');
  fraction = fraction.replace(/0+$/, '');
  const canonical = fraction ? `${integer}.${fraction}` : integer;
  if (/^0(?:\.0*)?$/.test(canonical)) return '0';
  return negative ? `-${canonical}` : canonical;
}

function decimalParts(value) {
  const normalized = normalizeDecimal(value, 'decimal');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer, fraction = ''] = unsigned.split('.');
  return { negative, integer, fraction };
}

function compareDecimal(left, right) {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.fraction.length, b.fraction.length);
  const ai = BigInt(`${a.negative ? '-' : ''}${a.integer}${a.fraction.padEnd(scale, '0')}`);
  const bi = BigInt(`${b.negative ? '-' : ''}${b.integer}${b.fraction.padEnd(scale, '0')}`);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

function normalizeAtomicValue(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_VALUE', `${name} must be a typed value object`);
  }
  const type = text(value.type, `${name}.type`);
  if (!VALUE_TYPES.has(type)) throw new RuntimeResultError('INVALID_RUNTIME_RESULT_VALUE_TYPE', `unsupported value type ${type}`);
  switch (type) {
    case 'DECIMAL':
      exactObject(value, name, new Set(['type', 'decimal']));
      return deepFreeze({ type, decimal: normalizeDecimal(value.decimal, `${name}.decimal`) });
    case 'INTEGER': {
      exactObject(value, name, new Set(['type', 'integer']));
      const integer = text(value.integer, `${name}.integer`);
      if (!INTEGER_RE.test(integer)) throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INTEGER', `${name}.integer must be canonical`);
      return deepFreeze({ type, integer: integer === '-0' ? '0' : integer });
    }
    case 'BOOLEAN':
      exactObject(value, name, new Set(['type', 'boolean']));
      if (typeof value.boolean !== 'boolean') throw new RuntimeResultError('INVALID_RUNTIME_RESULT_BOOLEAN', `${name}.boolean must be boolean`);
      return deepFreeze({ type, boolean: value.boolean });
    case 'STRING':
      exactObject(value, name, new Set(['type', 'string']));
      return deepFreeze({ type, string: text(value.string, `${name}.string`) });
    case 'CATEGORY':
      exactObject(value, name, new Set(['type', 'category']));
      return deepFreeze({ type, category: text(value.category, `${name}.category`) });
    case 'DATE':
      exactObject(value, name, new Set(['type', 'date']));
      return deepFreeze({ type, date: normalizeDate(value.date, `${name}.date`) });
    case 'TIMESTAMP':
      exactObject(value, name, new Set(['type', 'timestamp']));
      return deepFreeze({ type, timestamp: normalizeRuntimeTimestamp(value.timestamp, `${name}.timestamp`) });
    case 'UNKNOWN':
      exactObject(value, name, new Set(['type', 'reasonCode']));
      return deepFreeze({ type, reasonCode: text(value.reasonCode, `${name}.reasonCode`) });
    default:
      return null;
  }
}

function compareIntervalEndpoints(lower, upper) {
  if (lower.type === 'DECIMAL' || lower.type === 'INTEGER') {
    const left = lower.type === 'DECIMAL' ? lower.decimal : lower.integer;
    const right = upper.type === 'DECIMAL' ? upper.decimal : upper.integer;
    return compareDecimal(left, right);
  }
  if (lower.type === 'DATE') return lower.date.localeCompare(upper.date);
  if (lower.type === 'TIMESTAMP') return lower.timestamp.localeCompare(upper.timestamp);
  throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INTERVAL', 'interval endpoints require DECIMAL, INTEGER, DATE or TIMESTAMP');
}

export function normalizeRuntimeValue(value, name = 'value') {
  const atomic = normalizeAtomicValue(value, name);
  if (atomic) return atomic;
  if (value?.type === 'INTERVAL') {
    exactObject(value, name, new Set(['type', 'lower', 'upper']));
    const lower = normalizeAtomicValue(value.lower, `${name}.lower`);
    const upper = normalizeAtomicValue(value.upper, `${name}.upper`);
    if (!lower || !upper || lower.type !== upper.type) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INTERVAL', 'interval endpoints must be atomic values of one type');
    }
    if (compareIntervalEndpoints(lower, upper) > 0) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_INTERVAL', 'interval lower endpoint cannot exceed upper endpoint');
    }
    return deepFreeze({ type: 'INTERVAL', lower, upper });
  }
  if (value?.type === 'SET') {
    exactObject(value, name, new Set(['type', 'items']));
    if (!Array.isArray(value.items) || value.items.length === 0) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_SET', 'set value must contain at least one item');
    }
    const items = value.items.map((item, index) => normalizeAtomicValue(item, `${name}.items[${index}]`));
    if (items.some((item) => !item || item.type === 'UNKNOWN')) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_SET', 'set items must be known atomic values');
    }
    const itemType = items[0].type;
    if (!items.every((item) => item.type === itemType)) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_SET', 'set items must share one atomic type');
    }
    const keyed = items.map((item) => [semanticHash('RuntimeDatumSetItem', item), item]);
    if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
      throw new RuntimeResultError('DUPLICATE_RUNTIME_RESULT_SET_ITEM', 'set cannot contain duplicate canonical values');
    }
    keyed.sort(([a], [b]) => a.localeCompare(b));
    return deepFreeze({ type: 'SET', items: keyed.map(([, item]) => item) });
  }
  throw new RuntimeResultError('INVALID_RUNTIME_RESULT_VALUE_TYPE', `unsupported value type ${value?.type}`);
}

export function normalizeRuntimeEffectiveInterval(value, name = 'effectiveInterval') {
  exactObject(value, name, new Set(['start', 'end']));
  const start = normalizeRuntimeTimestamp(value.start, `${name}.start`);
  const end = normalizeRuntimeTimestamp(value.end, `${name}.end`);
  if (end < start) throw new RuntimeResultError('INVALID_RUNTIME_RESULT_EFFECTIVE_INTERVAL', `${name}.end cannot precede start`);
  return deepFreeze({ start, end });
}

export function normalizeRuntimeSpatialSupport(value, name = 'spatialSupport') {
  exactObject(value, name, new Set(['type', 'geometryRef']));
  return deepFreeze({
    type: text(value.type, `${name}.type`),
    ...(value.geometryRef ? { geometryRef: text(value.geometryRef, `${name}.geometryRef`) } : {})
  });
}

export function normalizeRuntimeVerticalSupport(value, name = 'verticalSupport') {
  if (value === null) return null;
  exactObject(value, name, new Set(['fromMm', 'toMm']));
  const fromMm = normalizeDecimal(value.fromMm, `${name}.fromMm`);
  const toMm = normalizeDecimal(value.toMm, `${name}.toMm`);
  if (compareDecimal(fromMm, toMm) > 0) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_VERTICAL_SUPPORT', `${name}.fromMm cannot exceed toMm`);
  }
  return deepFreeze({ fromMm, toMm });
}

export function normalizeRuntimeTemporalSupport(value, name = 'temporalSupport') {
  exactObject(value, name, new Set(['type']));
  return deepFreeze({ type: text(value.type, `${name}.type`) });
}

export function normalizeRuntimeUncertainty(value, name = 'uncertainty') {
  exactObject(value, name, new Set([
    'type', 'lowerDecimal', 'upperDecimal', 'values', 'providerId', 'sourceRef', 'contentHash', 'reasonCode'
  ]));
  const type = text(value.type, `${name}.type`);
  if (!UNCERTAINTY.has(type)) throw new RuntimeResultError('INVALID_RUNTIME_RESULT_UNCERTAINTY', `unsupported uncertainty type ${type}`);
  if (type === 'NONE') return deepFreeze({ type });
  if (type === 'INTERVAL') {
    const lowerDecimal = normalizeDecimal(value.lowerDecimal, `${name}.lowerDecimal`);
    const upperDecimal = normalizeDecimal(value.upperDecimal, `${name}.upperDecimal`);
    if (compareDecimal(lowerDecimal, upperDecimal) > 0) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_UNCERTAINTY', 'uncertainty lower bound cannot exceed upper bound');
    }
    return deepFreeze({ type, lowerDecimal, upperDecimal });
  }
  if (type === 'CATEGORICAL_SET') {
    if (!Array.isArray(value.values) || value.values.length === 0) {
      throw new RuntimeResultError('INVALID_RUNTIME_RESULT_UNCERTAINTY', 'categorical uncertainty requires values');
    }
    const values = value.values.map((item, index) => text(item, `${name}.values[${index}]`));
    if (new Set(values).size !== values.length) {
      throw new RuntimeResultError('DUPLICATE_RUNTIME_RESULT_UNCERTAINTY', 'categorical uncertainty cannot contain duplicates');
    }
    return deepFreeze({ type, values: [...values].sort() });
  }
  if (type === 'DISTRIBUTION_REFERENCE') {
    return deepFreeze({
      type,
      providerId: text(value.providerId, `${name}.providerId`),
      sourceRef: text(value.sourceRef, `${name}.sourceRef`),
      ...(value.contentHash ? { contentHash: text(value.contentHash, `${name}.contentHash`) } : {})
    });
  }
  return deepFreeze({ type, reasonCode: text(value.reasonCode, `${name}.reasonCode`) });
}

function normalizeForecast(value, effectiveInterval, name = 'forecast') {
  if (value === null) return null;
  exactObject(value, name, new Set(['referenceTime', 'horizon']));
  const referenceTime = normalizeRuntimeTimestamp(value.referenceTime, `${name}.referenceTime`);
  const horizon = normalizeRuntimeEffectiveInterval(value.horizon, `${name}.horizon`);
  if (semanticHash('RuntimeForecastHorizon', horizon) !== semanticHash('RuntimeForecastHorizon', effectiveInterval)) {
    throw new RuntimeResultError('RUNTIME_RESULT_FORECAST_HORIZON_MISMATCH', 'forecast horizon must equal the RuntimeDatum effective interval');
  }
  if (referenceTime > horizon.start) {
    throw new RuntimeResultError('RUNTIME_RESULT_FORECAST_REFERENCE_TIME_INVALID', 'forecast reference time cannot follow forecast horizon start');
  }
  return deepFreeze({ referenceTime, horizon });
}

function normalizeSemanticOutputEntry(value, index) {
  const name = `outputs[${index}]`;
  exactObject(value, name, new Set([
    'semanticId', 'value', 'effectiveInterval', 'forecast', 'spatialSupport',
    'verticalSupport', 'temporalSupport', 'uncertainty'
  ]));
  const effectiveInterval = normalizeRuntimeEffectiveInterval(value.effectiveInterval, `${name}.effectiveInterval`);
  return deepFreeze({
    semanticId: text(value.semanticId, `${name}.semanticId`),
    value: normalizeRuntimeValue(value.value, `${name}.value`),
    effectiveInterval,
    forecast: normalizeForecast(value.forecast, effectiveInterval, `${name}.forecast`),
    spatialSupport: normalizeRuntimeSpatialSupport(value.spatialSupport, `${name}.spatialSupport`),
    verticalSupport: normalizeRuntimeVerticalSupport(value.verticalSupport, `${name}.verticalSupport`),
    temporalSupport: normalizeRuntimeTemporalSupport(value.temporalSupport, `${name}.temporalSupport`),
    uncertainty: normalizeRuntimeUncertainty(value.uncertainty, `${name}.uncertainty`)
  });
}

export function normalizeRuntimeSemanticOutput(value) {
  exactObject(value, 'RuntimeSemanticOutput', new Set(['contractVersion', 'outputs']));
  if (value.contractVersion !== RUNTIME_SEMANTIC_OUTPUT_CONTRACT_VERSION) {
    throw new RuntimeResultError('UNSUPPORTED_RUNTIME_SEMANTIC_OUTPUT_CONTRACT', 'executor raw output is not adr.runtime-semantic-output.v1');
  }
  if (!Array.isArray(value.outputs) || value.outputs.length === 0) {
    throw new RuntimeResultError('RUNTIME_RESULT_OUTPUT_REQUIRED', 'semantic runtime output must contain at least one output');
  }
  const outputs = value.outputs.map(normalizeSemanticOutputEntry);
  const ids = outputs.map((item) => item.semanticId);
  if (new Set(ids).size !== ids.length) {
    throw new RuntimeResultError('RUNTIME_RESULT_DUPLICATE_OUTPUT', 'semantic runtime output cannot repeat semanticId');
  }
  return deepFreeze({
    contractVersion: RUNTIME_SEMANTIC_OUTPUT_CONTRACT_VERSION,
    outputs: deepFreeze([...outputs].sort((a, b) => a.semanticId.localeCompare(b.semanticId)))
  });
}

function runtimeDatumIdentity({ executionId, semanticId }) {
  return `runtime-datum:${semanticHash('RuntimeDatumIdentity', {
    executionId: text(executionId, 'executionId'),
    semanticId: text(semanticId, 'semanticId')
  }).slice('sha256:'.length)}`;
}

function runtimeDatumSemanticCore(value) {
  return {
    contractVersion: RUNTIME_DATUM_CONTRACT_VERSION,
    authorityClass: RUNTIME_DATUM_AUTHORITY_CLASS,
    runtimeDatumId: value.runtimeDatumId,
    executionId: value.executionId,
    runtimeBindingRef: value.runtimeBindingRef,
    runtimeNodeId: value.runtimeNodeId,
    specificationRef: value.specificationRef,
    implementationRef: value.implementationRef,
    implementationConformanceRef: value.implementationConformanceRef,
    semanticId: value.semanticId,
    value: value.value,
    unit: value.unit,
    ...(value.measurementConvention ? { measurementConvention: value.measurementConvention } : {}),
    epistemicClass: value.epistemicClass,
    provenanceClass: value.provenanceClass,
    effectiveInterval: value.effectiveInterval,
    forecast: value.forecast,
    spatialSupport: value.spatialSupport,
    verticalSupport: value.verticalSupport,
    temporalSupport: value.temporalSupport,
    uncertainty: value.uncertainty
  };
}

export function createRuntimeDatum(value) {
  const runtimeDatumId = runtimeDatumIdentity(value);
  return normalizeRuntimeDatum({
    ...value,
    contractVersion: RUNTIME_DATUM_CONTRACT_VERSION,
    authorityClass: RUNTIME_DATUM_AUTHORITY_CLASS,
    runtimeDatumId,
    outputSemanticHash: semanticHash('RuntimeDatum', runtimeDatumSemanticCore({ ...value, runtimeDatumId }))
  });
}

export function normalizeRuntimeDatum(value) {
  exactObject(value, 'RuntimeDatum', new Set([
    'contractVersion', 'authorityClass', 'runtimeDatumId', 'executionId', 'runtimeBindingRef',
    'runtimeNodeId', 'specificationRef', 'implementationRef', 'implementationConformanceRef',
    'semanticId', 'value', 'unit', 'measurementConvention', 'epistemicClass', 'provenanceClass',
    'effectiveInterval', 'forecast', 'spatialSupport', 'verticalSupport', 'temporalSupport',
    'uncertainty', 'outputSemanticHash'
  ]));
  if (value.contractVersion !== RUNTIME_DATUM_CONTRACT_VERSION || value.authorityClass !== RUNTIME_DATUM_AUTHORITY_CLASS) {
    throw new RuntimeResultError('INVALID_RUNTIME_DATUM_CONTRACT', 'RuntimeDatum contract/authority class mismatch');
  }
  const epistemicClass = text(value.epistemicClass, 'epistemicClass');
  const provenanceClass = text(value.provenanceClass, 'provenanceClass');
  if (!EPISTEMIC.has(epistemicClass)) throw new RuntimeResultError('INVALID_RUNTIME_DATUM_EPISTEMIC_CLASS', `unsupported epistemic class ${epistemicClass}`);
  if (!PROVENANCE.has(provenanceClass)) throw new RuntimeResultError('INVALID_RUNTIME_DATUM_PROVENANCE_CLASS', `unsupported provenance class ${provenanceClass}`);
  if (provenanceClass === 'MODEL' && !MODEL_OUTPUT_EPISTEMIC.has(epistemicClass)) {
    throw new RuntimeResultError('RUNTIME_DATUM_MODEL_EPISTEMIC_LAUNDERING', `MODEL provenance cannot produce ${epistemicClass}`);
  }
  const effectiveInterval = normalizeRuntimeEffectiveInterval(value.effectiveInterval);
  const normalized = {
    contractVersion: RUNTIME_DATUM_CONTRACT_VERSION,
    authorityClass: RUNTIME_DATUM_AUTHORITY_CLASS,
    runtimeDatumId: text(value.runtimeDatumId, 'runtimeDatumId'),
    executionId: text(value.executionId, 'executionId'),
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(value.runtimeNodeId, 'runtimeNodeId'),
    specificationRef: specificationRef(value.specificationRef, 'specificationRef'),
    implementationRef: exactRef(value.implementationRef, 'Implementation', 'implementationRef'),
    implementationConformanceRef: exactRef(value.implementationConformanceRef, 'ImplementationConformance', 'implementationConformanceRef'),
    semanticId: text(value.semanticId, 'semanticId'),
    value: normalizeRuntimeValue(value.value),
    unit: text(value.unit, 'unit'),
    ...(value.measurementConvention ? { measurementConvention: text(value.measurementConvention, 'measurementConvention') } : {}),
    epistemicClass,
    provenanceClass,
    effectiveInterval,
    forecast: normalizeForecast(value.forecast, effectiveInterval),
    spatialSupport: normalizeRuntimeSpatialSupport(value.spatialSupport),
    verticalSupport: normalizeRuntimeVerticalSupport(value.verticalSupport),
    temporalSupport: normalizeRuntimeTemporalSupport(value.temporalSupport),
    uncertainty: normalizeRuntimeUncertainty(value.uncertainty)
  };
  if (normalized.epistemicClass === 'FORECAST' && normalized.forecast === null) {
    throw new RuntimeResultError('RUNTIME_DATUM_FORECAST_METADATA_REQUIRED', 'FORECAST RuntimeDatum requires forecast reference time and horizon');
  }
  if (normalized.epistemicClass !== 'FORECAST' && normalized.forecast !== null) {
    throw new RuntimeResultError('RUNTIME_DATUM_FORECAST_METADATA_FORBIDDEN', 'non-FORECAST RuntimeDatum cannot carry forecast metadata');
  }
  const expectedId = runtimeDatumIdentity(normalized);
  if (normalized.runtimeDatumId !== expectedId) {
    throw new RuntimeResultError('RUNTIME_DATUM_IDENTITY_MISMATCH', 'runtimeDatumId must be derived from exact executionId + semanticId');
  }
  const outputSemanticHash = hash(value.outputSemanticHash, 'outputSemanticHash');
  const expectedHash = semanticHash('RuntimeDatum', runtimeDatumSemanticCore(normalized));
  if (outputSemanticHash !== expectedHash) {
    throw new RuntimeResultError('RUNTIME_DATUM_SEMANTIC_HASH_MISMATCH', 'RuntimeDatum semantic envelope does not reproduce outputSemanticHash');
  }
  return deepFreeze({ ...normalized, outputSemanticHash });
}

function runtimeResultIdentity({ executionId, runtimeBindingRef, runtimeNodeId }) {
  return `runtime-result:${semanticHash('RuntimeResultIdentity', {
    executionId: text(executionId, 'executionId'),
    runtimeBindingRef: exactRef(runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(runtimeNodeId, 'runtimeNodeId')
  }).slice('sha256:'.length)}`;
}

function resultCore(value) {
  return {
    contractVersion: RUNTIME_RESULT_CONTRACT_VERSION,
    authorityClass: RUNTIME_RESULT_AUTHORITY_CLASS,
    runtimeResultId: value.runtimeResultId,
    executionId: value.executionId,
    executionEvidenceHash: value.executionEvidenceHash,
    runtimeBindingRef: value.runtimeBindingRef,
    runtimeNodeId: value.runtimeNodeId,
    specificationRef: value.specificationRef,
    implementationRef: value.implementationRef,
    implementationConformanceRef: value.implementationConformanceRef,
    inputEnvelopeHash: value.inputEnvelopeHash,
    inputSemanticHashes: value.inputSemanticHashes,
    startedAt: value.startedAt,
    executedAt: value.executedAt,
    runtimeDatums: value.runtimeDatums
  };
}

export function createRuntimeResult(value) {
  const runtimeResultId = runtimeResultIdentity(value);
  const normalizedDatums = deepFreeze(value.runtimeDatums.map(normalizeRuntimeDatum).sort((a, b) => a.semanticId.localeCompare(b.semanticId)));
  const candidate = { ...value, runtimeResultId, runtimeDatums: normalizedDatums };
  return normalizeRuntimeResult({
    ...candidate,
    contractVersion: RUNTIME_RESULT_CONTRACT_VERSION,
    authorityClass: RUNTIME_RESULT_AUTHORITY_CLASS,
    resultSemanticHash: semanticHash('RuntimeResult', resultCore(candidate))
  });
}

export function normalizeRuntimeResult(value) {
  exactObject(value, 'RuntimeResult', new Set([
    'contractVersion', 'authorityClass', 'runtimeResultId', 'executionId', 'executionEvidenceHash',
    'runtimeBindingRef', 'runtimeNodeId', 'specificationRef', 'implementationRef',
    'implementationConformanceRef', 'inputEnvelopeHash', 'inputSemanticHashes', 'startedAt',
    'executedAt', 'runtimeDatums', 'resultSemanticHash'
  ]));
  if (value.contractVersion !== RUNTIME_RESULT_CONTRACT_VERSION || value.authorityClass !== RUNTIME_RESULT_AUTHORITY_CLASS) {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_CONTRACT', 'RuntimeResult contract/authority class mismatch');
  }
  if (!Array.isArray(value.inputSemanticHashes) || value.inputSemanticHashes.length === 0) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_HASHES_REQUIRED', 'RuntimeResult requires exact input semantic hashes');
  }
  const inputSemanticHashes = value.inputSemanticHashes.map((item, index) => hash(item, `inputSemanticHashes[${index}]`));
  if (new Set(inputSemanticHashes).size !== inputSemanticHashes.length) {
    throw new RuntimeResultError('RUNTIME_RESULT_DUPLICATE_INPUT_HASH', 'inputSemanticHashes cannot contain duplicates');
  }
  if (!Array.isArray(value.runtimeDatums) || value.runtimeDatums.length === 0) {
    throw new RuntimeResultError('RUNTIME_RESULT_DATUM_REQUIRED', 'RuntimeResult requires one or more RuntimeDatum');
  }
  const runtimeDatums = value.runtimeDatums.map(normalizeRuntimeDatum).sort((a, b) => a.semanticId.localeCompare(b.semanticId));
  const semanticIds = runtimeDatums.map((item) => item.semanticId);
  if (new Set(semanticIds).size !== semanticIds.length) {
    throw new RuntimeResultError('RUNTIME_RESULT_DUPLICATE_DATUM', 'RuntimeResult cannot contain duplicate semantic output IDs');
  }
  const startedAt = normalizeRuntimeTimestamp(value.startedAt, 'startedAt');
  const executedAt = normalizeRuntimeTimestamp(value.executedAt, 'executedAt');
  if (executedAt < startedAt) throw new RuntimeResultError('RUNTIME_RESULT_CLOCK_REGRESSION', 'executedAt cannot precede startedAt');
  const normalized = {
    contractVersion: RUNTIME_RESULT_CONTRACT_VERSION,
    authorityClass: RUNTIME_RESULT_AUTHORITY_CLASS,
    runtimeResultId: text(value.runtimeResultId, 'runtimeResultId'),
    executionId: text(value.executionId, 'executionId'),
    executionEvidenceHash: hash(value.executionEvidenceHash, 'executionEvidenceHash'),
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(value.runtimeNodeId, 'runtimeNodeId'),
    specificationRef: specificationRef(value.specificationRef, 'specificationRef'),
    implementationRef: exactRef(value.implementationRef, 'Implementation', 'implementationRef'),
    implementationConformanceRef: exactRef(value.implementationConformanceRef, 'ImplementationConformance', 'implementationConformanceRef'),
    inputEnvelopeHash: hash(value.inputEnvelopeHash, 'inputEnvelopeHash'),
    inputSemanticHashes: deepFreeze([...inputSemanticHashes].sort()),
    startedAt,
    executedAt,
    runtimeDatums: deepFreeze(runtimeDatums)
  };
  const expectedId = runtimeResultIdentity(normalized);
  if (normalized.runtimeResultId !== expectedId) {
    throw new RuntimeResultError('RUNTIME_RESULT_IDENTITY_MISMATCH', 'runtimeResultId must be derived from exact execution identity');
  }
  for (const datum of runtimeDatums) {
    if (datum.executionId !== normalized.executionId
      || datum.runtimeNodeId !== normalized.runtimeNodeId
      || !sameAuthorityRef(datum.runtimeBindingRef, normalized.runtimeBindingRef)
      || !sameAuthorityRef(datum.specificationRef, normalized.specificationRef)
      || !sameAuthorityRef(datum.implementationRef, normalized.implementationRef)
      || !sameAuthorityRef(datum.implementationConformanceRef, normalized.implementationConformanceRef)) {
      throw new RuntimeResultError('RUNTIME_RESULT_DATUM_LINEAGE_MISMATCH', 'each RuntimeDatum must retain exact RuntimeResult execution lineage');
    }
  }
  const resultSemanticHash = hash(value.resultSemanticHash, 'resultSemanticHash');
  const expectedHash = semanticHash('RuntimeResult', resultCore(normalized));
  if (resultSemanticHash !== expectedHash) {
    throw new RuntimeResultError('RUNTIME_RESULT_SEMANTIC_HASH_MISMATCH', 'RuntimeResult does not reproduce resultSemanticHash');
  }
  return deepFreeze({ ...normalized, resultSemanticHash });
}

export function semanticEqual(left, right, domain = 'RuntimeSemanticEquality') {
  return semanticHash(domain, cloneCanonicalValue(left)) === semanticHash(domain, cloneCanonicalValue(right));
}
