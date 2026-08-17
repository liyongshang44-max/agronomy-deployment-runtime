import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  CONTEXT_VALUE_TYPES,
  EPISTEMIC_CLASSES,
  PROVENANCE_CLASSES,
  UNCERTAINTY_TYPES
} from '../../context-contract/src/index.mjs';

export const OUTCOME_CONTRACT_VERSION = 'adr.outcome.v1';
export const OUTCOME_AUTHORITY_CLASS = 'POST_DECISION_EVIDENCE_AUTHORITY';
export const OUTCOME_CAUSAL_EFFECT_AUTHORITY = 'NONE_OUTCOME_IS_NOT_CAUSAL_EFFECT_AUTHORITY';
export const OUTCOME_UPSTREAM_AUTHORITY_MUTATION = 'NONE_OUTCOME_CANNOT_MUTATE_UPSTREAM_AUTHORITY';
export const OUTCOME_ASSOCIATION_MODES = deepFreeze(['ADR_BOUND', 'EXTERNAL_BOUND']);
export const OUTCOME_EPISTEMIC_CLASSES = deepFreeze(['OBSERVATION', 'ASSERTION', 'DERIVED', 'STATE_ESTIMATE']);

const VALUE_TYPES = new Set(CONTEXT_VALUE_TYPES);
const PROVENANCE = new Set(PROVENANCE_CLASSES);
const CONTEXT_EPISTEMIC = new Set(EPISTEMIC_CLASSES);
const OUTCOME_EPISTEMIC = new Set(OUTCOME_EPISTEMIC_CLASSES);
const UNCERTAINTY = new Set(UNCERTAINTY_TYPES);
const ASSOCIATION_MODES = new Set(OUTCOME_ASSOCIATION_MODES);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const DECIMAL_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_RE = /^-?(?:0|[1-9]\d*)$/;
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const TARGET_KEYS = new Set(['organizationId', 'tenantId', 'farmId', 'fieldId', 'seasonId', 'zoneId']);
const DRAFT_KEYS = new Set([
  'semanticId', 'value', 'unit', 'epistemicClass', 'provenanceClass',
  'effectiveInterval', 'availableAt', 'spatialSupport', 'verticalSupport',
  'temporalSupport', 'uncertainty', 'source'
]);
const OUTCOME_KEYS = new Set([
  'contractVersion', 'authorityClass', 'outcomeId', 'targetRef',
  'semanticId', 'value', 'unit', 'epistemicClass', 'provenanceClass',
  'effectiveInterval', 'availableAt', 'spatialSupport', 'verticalSupport',
  'temporalSupport', 'uncertainty', 'source', 'association',
  'causalEffectAuthority', 'upstreamAuthorityMutation'
]);
const ASSOCIATION_KEYS = new Set([
  'mode', 'decisionProblemRef', 'decisionResultRef', 'runtimeBindingRef',
  'externalDecisionRef', 'externalExecutionRef'
]);
const EXTERNAL_REF_KEYS = new Set(['providerId', 'sourceRef', 'contentHash', 'occurredAt']);

export class OutcomeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OutcomeError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutcomeError('INVALID_OUTCOME_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OutcomeError('INVALID_OUTCOME_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OutcomeError('INVALID_OUTCOME_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new OutcomeError('INVALID_OUTCOME_FIELD', `${name}.${key} is outside the frozen E01 contract`);
    }
  }
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new OutcomeError('INVALID_OUTCOME_HASH', `${name} must be sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function exactRef(value, kind, name) {
  if (value === null) return null;
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new OutcomeError('INVALID_OUTCOME_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

export function normalizeOutcomeTimestamp(value, name = 'timestamp') {
  const normalized = text(value, name);
  const match = RFC3339_RE.exec(normalized);
  if (!match) {
    throw new OutcomeError(
      'INVALID_OUTCOME_TIME',
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
    throw new OutcomeError('INVALID_OUTCOME_TIME', `${name} contains an impossible calendar date or clock time`);
  }
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new OutcomeError('INVALID_OUTCOME_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new OutcomeError('INVALID_OUTCOME_TIME', `${name} must be valid RFC3339`);
  return parsed.toISOString();
}

function normalizeDate(value, name) {
  const normalized = text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new OutcomeError('INVALID_OUTCOME_DATE', `${name} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new OutcomeError('INVALID_OUTCOME_DATE', `${name} is not a real calendar date`);
  }
  return normalized;
}

function normalizeDecimal(value, name) {
  const normalized = text(value, name);
  if (!DECIMAL_RE.test(normalized)) {
    throw new OutcomeError('INVALID_OUTCOME_DECIMAL', `${name} must be a canonical base-10 decimal string`);
  }
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer, rawFraction = ''] = unsigned.split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  const canonical = fraction ? `${integer}.${fraction}` : integer;
  if (canonical === '0') return '0';
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
    throw new OutcomeError('INVALID_OUTCOME_VALUE', `${name} must be a typed value object`);
  }
  const type = text(value.type, `${name}.type`);
  if (!VALUE_TYPES.has(type)) throw new OutcomeError('INVALID_OUTCOME_VALUE_TYPE', `unsupported value type ${type}`);
  switch (type) {
    case 'DECIMAL':
      exactObject(value, name, new Set(['type', 'decimal']));
      return deepFreeze({ type, decimal: normalizeDecimal(value.decimal, `${name}.decimal`) });
    case 'INTEGER': {
      exactObject(value, name, new Set(['type', 'integer']));
      const integer = text(value.integer, `${name}.integer`);
      if (!INTEGER_RE.test(integer)) throw new OutcomeError('INVALID_OUTCOME_INTEGER', `${name}.integer must be canonical`);
      return deepFreeze({ type, integer: integer === '-0' ? '0' : integer });
    }
    case 'BOOLEAN':
      exactObject(value, name, new Set(['type', 'boolean']));
      if (typeof value.boolean !== 'boolean') throw new OutcomeError('INVALID_OUTCOME_BOOLEAN', `${name}.boolean must be boolean`);
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
      return deepFreeze({ type, timestamp: normalizeOutcomeTimestamp(value.timestamp, `${name}.timestamp`) });
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
  throw new OutcomeError('INVALID_OUTCOME_INTERVAL', 'interval endpoints require DECIMAL, INTEGER, DATE or TIMESTAMP');
}

export function normalizeOutcomeValue(value, name = 'value') {
  const atomic = normalizeAtomicValue(value, name);
  if (atomic) return atomic;
  if (value?.type === 'INTERVAL') {
    exactObject(value, name, new Set(['type', 'lower', 'upper']));
    const lower = normalizeAtomicValue(value.lower, `${name}.lower`);
    const upper = normalizeAtomicValue(value.upper, `${name}.upper`);
    if (!lower || !upper || lower.type !== upper.type || lower.type === 'UNKNOWN') {
      throw new OutcomeError('INVALID_OUTCOME_INTERVAL', 'interval endpoints must be known atomic values of one type');
    }
    if (compareIntervalEndpoints(lower, upper) > 0) {
      throw new OutcomeError('INVALID_OUTCOME_INTERVAL', 'interval lower endpoint cannot exceed upper endpoint');
    }
    return deepFreeze({ type: 'INTERVAL', lower, upper });
  }
  if (value?.type === 'SET') {
    exactObject(value, name, new Set(['type', 'items']));
    if (!Array.isArray(value.items) || value.items.length === 0) {
      throw new OutcomeError('INVALID_OUTCOME_SET', 'set value must contain at least one item');
    }
    const items = value.items.map((item, index) => normalizeAtomicValue(item, `${name}.items[${index}]`));
    if (items.some((item) => !item || item.type === 'UNKNOWN')) {
      throw new OutcomeError('INVALID_OUTCOME_SET', 'set items must be known atomic values');
    }
    const itemType = items[0].type;
    if (!items.every((item) => item.type === itemType)) {
      throw new OutcomeError('INVALID_OUTCOME_SET', 'set items must share one atomic type');
    }
    const keyed = items.map((item) => [semanticHash('OutcomeSetItem', item), item]);
    if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
      throw new OutcomeError('DUPLICATE_OUTCOME_SET_ITEM', 'set cannot contain duplicate canonical values');
    }
    keyed.sort(([a], [b]) => a.localeCompare(b));
    return deepFreeze({ type: 'SET', items: keyed.map(([, item]) => item) });
  }
  throw new OutcomeError('INVALID_OUTCOME_VALUE_TYPE', `unsupported value type ${value?.type}`);
}

export function normalizeOutcomeTargetRef(value) {
  exactObject(value, 'targetRef', TARGET_KEYS);
  return deepFreeze({
    organizationId: text(value.organizationId, 'targetRef.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'targetRef.tenantId') } : {}),
    ...(value.farmId ? { farmId: text(value.farmId, 'targetRef.farmId') } : {}),
    ...(value.fieldId ? { fieldId: text(value.fieldId, 'targetRef.fieldId') } : {}),
    ...(value.seasonId ? { seasonId: text(value.seasonId, 'targetRef.seasonId') } : {}),
    ...(value.zoneId ? { zoneId: text(value.zoneId, 'targetRef.zoneId') } : {})
  });
}

export function normalizeOutcomeEffectiveInterval(value, name = 'effectiveInterval') {
  exactObject(value, name, new Set(['start', 'end']));
  const start = normalizeOutcomeTimestamp(value.start, `${name}.start`);
  const end = normalizeOutcomeTimestamp(value.end, `${name}.end`);
  if (end < start) throw new OutcomeError('INVALID_OUTCOME_EFFECTIVE_INTERVAL', `${name}.end cannot precede start`);
  return deepFreeze({ start, end });
}

export function normalizeOutcomeSpatialSupport(value, name = 'spatialSupport') {
  exactObject(value, name, new Set(['type', 'geometryRef']));
  return deepFreeze({
    type: text(value.type, `${name}.type`),
    ...(value.geometryRef ? { geometryRef: text(value.geometryRef, `${name}.geometryRef`) } : {})
  });
}

export function normalizeOutcomeVerticalSupport(value, name = 'verticalSupport') {
  if (value === null) return null;
  exactObject(value, name, new Set(['fromMm', 'toMm']));
  const fromMm = normalizeDecimal(value.fromMm, `${name}.fromMm`);
  const toMm = normalizeDecimal(value.toMm, `${name}.toMm`);
  if (compareDecimal(fromMm, toMm) > 0) {
    throw new OutcomeError('INVALID_OUTCOME_VERTICAL_SUPPORT', `${name}.fromMm cannot exceed toMm`);
  }
  return deepFreeze({ fromMm, toMm });
}

export function normalizeOutcomeTemporalSupport(value, name = 'temporalSupport') {
  exactObject(value, name, new Set(['type']));
  return deepFreeze({ type: text(value.type, `${name}.type`) });
}

export function normalizeOutcomeUncertainty(value, name = 'uncertainty') {
  exactObject(value, name, new Set([
    'type', 'lowerDecimal', 'upperDecimal', 'values', 'providerId', 'sourceRef', 'contentHash', 'reasonCode'
  ]));
  const type = text(value.type, `${name}.type`);
  if (!UNCERTAINTY.has(type)) throw new OutcomeError('INVALID_OUTCOME_UNCERTAINTY', `unsupported uncertainty type ${type}`);
  if (type === 'NONE') return deepFreeze({ type });
  if (type === 'INTERVAL') {
    const lowerDecimal = normalizeDecimal(value.lowerDecimal, `${name}.lowerDecimal`);
    const upperDecimal = normalizeDecimal(value.upperDecimal, `${name}.upperDecimal`);
    if (compareDecimal(lowerDecimal, upperDecimal) > 0) {
      throw new OutcomeError('INVALID_OUTCOME_UNCERTAINTY', 'uncertainty lower bound cannot exceed upper bound');
    }
    return deepFreeze({ type, lowerDecimal, upperDecimal });
  }
  if (type === 'CATEGORICAL_SET') {
    if (!Array.isArray(value.values) || value.values.length === 0) {
      throw new OutcomeError('INVALID_OUTCOME_UNCERTAINTY', 'categorical uncertainty requires values');
    }
    const values = value.values.map((item, index) => text(item, `${name}.values[${index}]`));
    if (new Set(values).size !== values.length) {
      throw new OutcomeError('DUPLICATE_OUTCOME_UNCERTAINTY', 'categorical uncertainty cannot contain duplicates');
    }
    return deepFreeze({ type, values: [...values].sort() });
  }
  if (type === 'DISTRIBUTION_REFERENCE') {
    return deepFreeze({
      type,
      providerId: text(value.providerId, `${name}.providerId`),
      sourceRef: text(value.sourceRef, `${name}.sourceRef`),
      contentHash: hash(value.contentHash, `${name}.contentHash`)
    });
  }
  return deepFreeze({ type, reasonCode: text(value.reasonCode, `${name}.reasonCode`) });
}

export function normalizeOutcomeSource(value, name = 'source') {
  exactObject(value, name, new Set(['providerId', 'sourceRef', 'contentHash']));
  return deepFreeze({
    providerId: text(value.providerId, `${name}.providerId`),
    sourceRef: text(value.sourceRef, `${name}.sourceRef`),
    contentHash: hash(value.contentHash, `${name}.contentHash`)
  });
}

export function normalizeExternalOutcomeRef(value, name) {
  if (value === null) return null;
  exactObject(value, name, EXTERNAL_REF_KEYS);
  return deepFreeze({
    providerId: text(value.providerId, `${name}.providerId`),
    sourceRef: text(value.sourceRef, `${name}.sourceRef`),
    contentHash: hash(value.contentHash, `${name}.contentHash`),
    occurredAt: normalizeOutcomeTimestamp(value.occurredAt, `${name}.occurredAt`)
  });
}

export function normalizeOutcomeAssociation(value) {
  exactObject(value, 'association', ASSOCIATION_KEYS);
  const mode = text(value.mode, 'association.mode');
  if (!ASSOCIATION_MODES.has(mode)) {
    throw new OutcomeError('INVALID_OUTCOME_ASSOCIATION_MODE', `unsupported association mode ${mode}`);
  }
  const normalized = deepFreeze({
    mode,
    decisionProblemRef: exactRef(value.decisionProblemRef ?? null, 'DecisionProblem', 'association.decisionProblemRef'),
    decisionResultRef: exactRef(value.decisionResultRef ?? null, 'DecisionResult', 'association.decisionResultRef'),
    runtimeBindingRef: exactRef(value.runtimeBindingRef ?? null, 'RuntimeBinding', 'association.runtimeBindingRef'),
    externalDecisionRef: normalizeExternalOutcomeRef(value.externalDecisionRef ?? null, 'association.externalDecisionRef'),
    externalExecutionRef: normalizeExternalOutcomeRef(value.externalExecutionRef ?? null, 'association.externalExecutionRef')
  });
  if (mode === 'ADR_BOUND') {
    if (!normalized.decisionProblemRef) {
      throw new OutcomeError('OUTCOME_DECISION_PROBLEM_REQUIRED', 'ADR_BOUND Outcome requires exact DecisionProblem');
    }
    if (normalized.externalDecisionRef !== null) {
      throw new OutcomeError('OUTCOME_ASSOCIATION_LAUNDERING', 'ADR_BOUND Outcome cannot replace exact DecisionProblem with external decision identity');
    }
    if (!normalized.decisionResultRef && !normalized.runtimeBindingRef && !normalized.externalExecutionRef) {
      throw new OutcomeError(
        'OUTCOME_ADR_ASSOCIATION_EVIDENCE_REQUIRED',
        'ADR_BOUND Outcome requires DecisionResult, RuntimeBinding or distinct external execution evidence association'
      );
    }
  } else {
    if (normalized.decisionProblemRef || normalized.decisionResultRef || normalized.runtimeBindingRef) {
      throw new OutcomeError('OUTCOME_ASSOCIATION_LAUNDERING', 'EXTERNAL_BOUND Outcome cannot carry ADR Decision/Runtime authority refs');
    }
    if (!normalized.externalDecisionRef) {
      throw new OutcomeError('OUTCOME_EXTERNAL_DECISION_REQUIRED', 'EXTERNAL_BOUND Outcome requires exact retained external decision evidence identity');
    }
  }
  if (normalized.externalDecisionRef && normalized.externalExecutionRef
    && normalized.externalExecutionRef.occurredAt < normalized.externalDecisionRef.occurredAt) {
    throw new OutcomeError('OUTCOME_EXTERNAL_EXECUTION_TIME_INVALID', 'external execution cannot precede external decision');
  }
  return normalized;
}

function normalizeDraft({ targetRef, outcome, association }) {
  exactObject(outcome, 'outcome', DRAFT_KEYS);
  const epistemicClass = text(outcome.epistemicClass, 'outcome.epistemicClass');
  const provenanceClass = text(outcome.provenanceClass, 'outcome.provenanceClass');
  if (!CONTEXT_EPISTEMIC.has(epistemicClass) || !OUTCOME_EPISTEMIC.has(epistemicClass)) {
    throw new OutcomeError(
      'INVALID_OUTCOME_EPISTEMIC_CLASS',
      `${epistemicClass} is not a post-decision Outcome epistemic class`
    );
  }
  if (!PROVENANCE.has(provenanceClass)) {
    throw new OutcomeError('INVALID_OUTCOME_PROVENANCE_CLASS', `unsupported provenanceClass ${provenanceClass}`);
  }
  if (provenanceClass === 'MODEL' && !['DERIVED', 'STATE_ESTIMATE'].includes(epistemicClass)) {
    throw new OutcomeError('OUTCOME_MODEL_EPISTEMIC_LAUNDERING', 'MODEL provenance Outcome cannot be relabeled as observation/assertion');
  }
  const effectiveInterval = normalizeOutcomeEffectiveInterval(outcome.effectiveInterval);
  const availableAt = normalizeOutcomeTimestamp(outcome.availableAt, 'outcome.availableAt');
  if (availableAt < effectiveInterval.end) {
    throw new OutcomeError(
      'OUTCOME_AVAILABLE_BEFORE_EVIDENCE_END',
      'Outcome availableAt cannot precede the end of the evidence effective interval'
    );
  }
  return deepFreeze({
    targetRef: normalizeOutcomeTargetRef(targetRef),
    semanticId: text(outcome.semanticId, 'outcome.semanticId'),
    value: normalizeOutcomeValue(outcome.value, 'outcome.value'),
    unit: text(outcome.unit, 'outcome.unit'),
    epistemicClass,
    provenanceClass,
    effectiveInterval,
    availableAt,
    spatialSupport: normalizeOutcomeSpatialSupport(outcome.spatialSupport, 'outcome.spatialSupport'),
    verticalSupport: normalizeOutcomeVerticalSupport(outcome.verticalSupport, 'outcome.verticalSupport'),
    temporalSupport: normalizeOutcomeTemporalSupport(outcome.temporalSupport, 'outcome.temporalSupport'),
    uncertainty: normalizeOutcomeUncertainty(outcome.uncertainty, 'outcome.uncertainty'),
    source: normalizeOutcomeSource(outcome.source, 'outcome.source'),
    association: normalizeOutcomeAssociation(association)
  });
}

function identityCore(value) {
  return {
    targetRef: value.targetRef,
    semanticId: value.semanticId,
    effectiveInterval: value.effectiveInterval,
    source: value.source,
    association: value.association
  };
}

export function outcomeIdentity({ targetRef, outcome, association }) {
  const draft = normalizeDraft({ targetRef, outcome, association });
  const identityHash = semanticHash('OutcomeIngressIdentity', identityCore(draft));
  return deepFreeze({
    outcomeId: `outcome:${identityHash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
    identityHash,
    draft
  });
}

export function createOutcomePayload({ targetRef, outcome, association }) {
  const identity = outcomeIdentity({ targetRef, outcome, association });
  return normalizeOutcome({
    contractVersion: OUTCOME_CONTRACT_VERSION,
    authorityClass: OUTCOME_AUTHORITY_CLASS,
    outcomeId: identity.outcomeId,
    ...identity.draft,
    causalEffectAuthority: OUTCOME_CAUSAL_EFFECT_AUTHORITY,
    upstreamAuthorityMutation: OUTCOME_UPSTREAM_AUTHORITY_MUTATION
  });
}

export function normalizeOutcome(value) {
  exactObject(value, 'Outcome', OUTCOME_KEYS);
  if (value.contractVersion !== OUTCOME_CONTRACT_VERSION || value.authorityClass !== OUTCOME_AUTHORITY_CLASS) {
    throw new OutcomeError('INVALID_OUTCOME_CONTRACT', 'Outcome contractVersion/authorityClass mismatch');
  }
  if (value.causalEffectAuthority !== OUTCOME_CAUSAL_EFFECT_AUTHORITY) {
    throw new OutcomeError('OUTCOME_CAUSAL_EFFECT_LAUNDERING', 'Outcome cannot claim causal-effect authority');
  }
  if (value.upstreamAuthorityMutation !== OUTCOME_UPSTREAM_AUTHORITY_MUTATION) {
    throw new OutcomeError('OUTCOME_UPSTREAM_AUTHORITY_LAUNDERING', 'Outcome cannot claim direct mutation of Knowledge/Policy authority');
  }
  const draft = normalizeDraft({
    targetRef: value.targetRef,
    outcome: {
      semanticId: value.semanticId,
      value: value.value,
      unit: value.unit,
      epistemicClass: value.epistemicClass,
      provenanceClass: value.provenanceClass,
      effectiveInterval: value.effectiveInterval,
      availableAt: value.availableAt,
      spatialSupport: value.spatialSupport,
      verticalSupport: value.verticalSupport,
      temporalSupport: value.temporalSupport,
      uncertainty: value.uncertainty,
      source: value.source
    },
    association: value.association
  });
  const expectedId = `outcome:${semanticHash('OutcomeIngressIdentity', identityCore(draft)).slice('sha256:'.length, 'sha256:'.length + 32)}`;
  if (text(value.outcomeId, 'outcomeId') !== expectedId) {
    throw new OutcomeError('OUTCOME_IDENTITY_MISMATCH', 'outcomeId must be deterministically derived from source/target/association/effective evidence identity');
  }
  return deepFreeze({
    contractVersion: OUTCOME_CONTRACT_VERSION,
    authorityClass: OUTCOME_AUTHORITY_CLASS,
    outcomeId: expectedId,
    ...draft,
    causalEffectAuthority: OUTCOME_CAUSAL_EFFECT_AUTHORITY,
    upstreamAuthorityMutation: OUTCOME_UPSTREAM_AUTHORITY_MUTATION
  });
}

export function outcomeExactRefs(payload) {
  const normalized = normalizeOutcome(payload);
  const refs = [];
  for (const ref of [
    normalized.association.decisionProblemRef,
    normalized.association.decisionResultRef,
    normalized.association.runtimeBindingRef
  ]) {
    if (ref) refs.push(ref);
  }
  const unique = new Map(refs.map((ref) => [canonicalizeSemanticJson(ref), ref]));
  return deepFreeze([...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}
