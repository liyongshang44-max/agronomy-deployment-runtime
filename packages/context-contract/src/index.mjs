import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal, samePrincipalIdentity } from '../../authorization/src/index.mjs';
import { authorizeContextWrite } from '../../authorization/src/context-write.mjs';

export const CONTEXT_DATUM_CONTRACT_VERSION = 'adr.context-datum.v1';
export const CONTEXT_VALUE_MODES = deepFreeze(['INLINE', 'AUTHORIZED_REFERENCE']);
export const EPISTEMIC_CLASSES = deepFreeze([
  'OBSERVATION',
  'ASSERTION',
  'DERIVED',
  'STATE_ESTIMATE',
  'FORECAST',
  'CONFIGURATION',
  'MODEL_PRIOR'
]);
export const PROVENANCE_CLASSES = deepFreeze([
  'USER',
  'AGRONOMIST',
  'SENSOR',
  'MACHINERY',
  'REMOTE_SENSING',
  'EXTERNAL_PROVIDER',
  'CUSTOMER_SYSTEM',
  'LABORATORY',
  'MODEL',
  'PLATFORM'
]);
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
export const UNCERTAINTY_TYPES = deepFreeze(['NONE', 'INTERVAL', 'CATEGORICAL_SET', 'DISTRIBUTION_REFERENCE', 'UNKNOWN']);

const EPISTEMIC_SET = new Set(EPISTEMIC_CLASSES);
const PROVENANCE_SET = new Set(PROVENANCE_CLASSES);
const VALUE_TYPE_SET = new Set(CONTEXT_VALUE_TYPES);
const UNCERTAINTY_SET = new Set(UNCERTAINTY_TYPES);
const DATUM_KEYS = new Set([
  'contractVersion', 'semanticId', 'value', 'unit', 'epistemicClass', 'provenanceClass',
  'effectiveInterval', 'availableAt', 'spatialSupport', 'verticalSupport', 'temporalSupport',
  'uncertainty', 'source'
]);
const DECIMAL_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_RE = /^-?(?:0|[1-9]\d*)$/;
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export class ContextDatumError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextDatumError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContextDatumError('INVALID_CONTEXT_DATUM_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContextDatumError('INVALID_CONTEXT_DATUM_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new ContextDatumError('INVALID_CONTEXT_DATUM_FIELD', `${name}.${key} is not part of ${CONTEXT_DATUM_CONTRACT_VERSION}`);
  }
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const match = RFC3339_RE.exec(text);
  if (!match) {
    throw new ContextDatumError(
      'INVALID_CONTEXT_TIME',
      `${name} must be an RFC3339 timestamp with seconds, explicit timezone and at most millisecond precision`
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new ContextDatumError('INVALID_CONTEXT_TIME', `${name} contains an impossible calendar date or clock time`);
  }
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new ContextDatumError('INVALID_CONTEXT_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new ContextDatumError('INVALID_CONTEXT_TIME', `${name} must be a valid RFC3339 timestamp`);
  }
  return parsed.toISOString();
}

function normalizeDate(value, name) {
  const text = requiredText(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ContextDatumError('INVALID_CONTEXT_DATE', `${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new ContextDatumError('INVALID_CONTEXT_DATE', `${name} is not a real calendar date`);
  }
  return text;
}

function normalizeDecimal(value, name) {
  const text = requiredText(value, name);
  if (!DECIMAL_RE.test(text)) throw new ContextDatumError('INVALID_CONTEXT_DECIMAL', `${name} must be a base-10 decimal string without exponent notation or ambiguous leading zeros`);
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  let [integer, fraction = ''] = unsigned.split('.');
  fraction = fraction.replace(/0+$/, '');
  const canonical = fraction ? `${integer}.${fraction}` : integer;
  if (/^0(?:\.0*)?$/.test(canonical)) return '0';
  return negative ? `-${canonical}` : canonical;
}

function decimalParts(value) {
  const text = normalizeDecimal(value, 'decimal');
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContextDatumError('INVALID_CONTEXT_VALUE', `${name} must be a typed value object`);
  const type = requiredText(value.type, `${name}.type`);
  if (!VALUE_TYPE_SET.has(type)) throw new ContextDatumError('INVALID_CONTEXT_VALUE_TYPE', `unsupported context value type ${type}`);
  switch (type) {
    case 'DECIMAL':
      exactObject(value, name, new Set(['type', 'decimal']));
      return deepFreeze({ type, decimal: normalizeDecimal(value.decimal, `${name}.decimal`) });
    case 'INTEGER': {
      exactObject(value, name, new Set(['type', 'integer']));
      const integer = requiredText(value.integer, `${name}.integer`);
      if (!INTEGER_RE.test(integer)) throw new ContextDatumError('INVALID_CONTEXT_INTEGER', `${name}.integer must be a canonical integer string`);
      return deepFreeze({ type, integer: integer === '-0' ? '0' : integer });
    }
    case 'BOOLEAN':
      exactObject(value, name, new Set(['type', 'boolean']));
      if (typeof value.boolean !== 'boolean') throw new ContextDatumError('INVALID_CONTEXT_BOOLEAN', `${name}.boolean must be boolean`);
      return deepFreeze({ type, boolean: value.boolean });
    case 'STRING':
      exactObject(value, name, new Set(['type', 'string']));
      return deepFreeze({ type, string: requiredText(value.string, `${name}.string`) });
    case 'CATEGORY':
      exactObject(value, name, new Set(['type', 'category']));
      return deepFreeze({ type, category: requiredText(value.category, `${name}.category`) });
    case 'DATE':
      exactObject(value, name, new Set(['type', 'date']));
      return deepFreeze({ type, date: normalizeDate(value.date, `${name}.date`) });
    case 'TIMESTAMP':
      exactObject(value, name, new Set(['type', 'timestamp']));
      return deepFreeze({ type, timestamp: normalizeTimestamp(value.timestamp, `${name}.timestamp`) });
    case 'UNKNOWN':
      exactObject(value, name, new Set(['type', 'reasonCode']));
      return deepFreeze({ type, reasonCode: requiredText(value.reasonCode, `${name}.reasonCode`) });
    default:
      return null;
  }
}

function compareIntervalEndpoints(lower, upper) {
  if (lower.type === 'DECIMAL' || lower.type === 'INTEGER') {
    const lk = lower.type === 'DECIMAL' ? lower.decimal : lower.integer;
    const uk = upper.type === 'DECIMAL' ? upper.decimal : upper.integer;
    return compareDecimal(lk, uk);
  }
  if (lower.type === 'DATE') return lower.date.localeCompare(upper.date);
  if (lower.type === 'TIMESTAMP') return lower.timestamp.localeCompare(upper.timestamp);
  throw new ContextDatumError(
    'INVALID_CONTEXT_INTERVAL',
    'interval endpoints require an explicitly ordered type: DECIMAL, INTEGER, DATE or TIMESTAMP'
  );
}

function normalizeValue(value, name = 'value') {
  const atomic = normalizeAtomicValue(value, name);
  if (atomic) return atomic;
  if (value?.type === 'INTERVAL') {
    exactObject(value, name, new Set(['type', 'lower', 'upper']));
    const lower = normalizeAtomicValue(value.lower, `${name}.lower`);
    const upper = normalizeAtomicValue(value.upper, `${name}.upper`);
    if (!lower || !upper || lower.type !== upper.type) {
      throw new ContextDatumError('INVALID_CONTEXT_INTERVAL', 'interval endpoints must be atomic values of the same type');
    }
    if (compareIntervalEndpoints(lower, upper) > 0) {
      throw new ContextDatumError('INVALID_CONTEXT_INTERVAL', 'interval lower endpoint cannot exceed upper endpoint');
    }
    return deepFreeze({ type: 'INTERVAL', lower, upper });
  }
  if (value?.type === 'SET') {
    exactObject(value, name, new Set(['type', 'items']));
    if (!Array.isArray(value.items) || value.items.length === 0) throw new ContextDatumError('INVALID_CONTEXT_SET', 'set value must contain at least one item');
    const items = value.items.map((item, index) => normalizeAtomicValue(item, `${name}.items[${index}]`));
    if (items.some((item) => !item || item.type === 'UNKNOWN')) throw new ContextDatumError('INVALID_CONTEXT_SET', 'set items must be known atomic values');
    const itemType = items[0].type;
    if (!items.every((item) => item.type === itemType)) throw new ContextDatumError('INVALID_CONTEXT_SET', 'set items must share one atomic value type');
    const keyed = items.map((item) => [semanticHash('ContextDatumSetItem', item), item]);
    if (new Set(keyed.map(([hash]) => hash)).size !== keyed.length) throw new ContextDatumError('DUPLICATE_CONTEXT_SET_ITEM', 'set cannot contain duplicate canonical values');
    keyed.sort(([a], [b]) => a.localeCompare(b));
    return deepFreeze({ type: 'SET', items: keyed.map(([, item]) => item) });
  }
  throw new ContextDatumError('INVALID_CONTEXT_VALUE_TYPE', `unsupported context value type ${value?.type}`);
}

function normalizeEffectiveInterval(value) {
  exactObject(value, 'effectiveInterval', new Set(['start', 'end']));
  const start = normalizeTimestamp(value.start, 'effectiveInterval.start');
  const end = normalizeTimestamp(value.end, 'effectiveInterval.end');
  if (end < start) throw new ContextDatumError('INVALID_EFFECTIVE_INTERVAL', 'effectiveInterval.end cannot precede start');
  return deepFreeze({ start, end });
}

function normalizeSpatialSupport(value) {
  exactObject(value, 'spatialSupport', new Set(['type', 'geometryRef']));
  return deepFreeze({
    type: requiredText(value.type, 'spatialSupport.type'),
    ...(value.geometryRef ? { geometryRef: requiredText(value.geometryRef, 'spatialSupport.geometryRef') } : {})
  });
}

function normalizeVerticalSupport(value) {
  if (value === null) return null;
  exactObject(value, 'verticalSupport', new Set(['fromMm', 'toMm']));
  const fromMm = normalizeDecimal(value.fromMm, 'verticalSupport.fromMm');
  const toMm = normalizeDecimal(value.toMm, 'verticalSupport.toMm');
  if (compareDecimal(fromMm, toMm) > 0) throw new ContextDatumError('INVALID_VERTICAL_SUPPORT', 'verticalSupport.fromMm cannot exceed toMm');
  return deepFreeze({ fromMm, toMm });
}

function normalizeTemporalSupport(value) {
  exactObject(value, 'temporalSupport', new Set(['type']));
  return deepFreeze({ type: requiredText(value.type, 'temporalSupport.type') });
}

function normalizeUncertainty(value) {
  exactObject(value, 'uncertainty', new Set(['type', 'lowerDecimal', 'upperDecimal', 'values', 'providerId', 'sourceRef', 'contentHash', 'reasonCode']));
  const type = requiredText(value.type, 'uncertainty.type');
  if (!UNCERTAINTY_SET.has(type)) throw new ContextDatumError('INVALID_UNCERTAINTY_TYPE', `unsupported uncertainty type ${type}`);
  if (type === 'NONE') return deepFreeze({ type });
  if (type === 'INTERVAL') {
    const lowerDecimal = normalizeDecimal(value.lowerDecimal, 'uncertainty.lowerDecimal');
    const upperDecimal = normalizeDecimal(value.upperDecimal, 'uncertainty.upperDecimal');
    if (compareDecimal(lowerDecimal, upperDecimal) > 0) throw new ContextDatumError('INVALID_UNCERTAINTY_INTERVAL', 'uncertainty lower bound cannot exceed upper bound');
    return deepFreeze({ type, lowerDecimal, upperDecimal });
  }
  if (type === 'CATEGORICAL_SET') {
    if (!Array.isArray(value.values) || value.values.length === 0) throw new ContextDatumError('INVALID_UNCERTAINTY_SET', 'categorical uncertainty requires values');
    const values = [...new Set(value.values.map((item) => requiredText(item, 'uncertainty.values')))].sort();
    if (values.length !== value.values.length) throw new ContextDatumError('DUPLICATE_UNCERTAINTY_VALUE', 'categorical uncertainty cannot contain duplicate values');
    return deepFreeze({ type, values });
  }
  if (type === 'DISTRIBUTION_REFERENCE') {
    return deepFreeze({
      type,
      providerId: requiredText(value.providerId, 'uncertainty.providerId'),
      sourceRef: requiredText(value.sourceRef, 'uncertainty.sourceRef'),
      ...(value.contentHash ? { contentHash: requiredText(value.contentHash, 'uncertainty.contentHash') } : {})
    });
  }
  return deepFreeze({ type, reasonCode: requiredText(value.reasonCode, 'uncertainty.reasonCode') });
}

function normalizeSource(value) {
  exactObject(value, 'source', new Set(['providerId', 'sourceRef', 'contentHash']));
  return deepFreeze({
    providerId: requiredText(value.providerId, 'source.providerId'),
    sourceRef: requiredText(value.sourceRef, 'source.sourceRef'),
    contentHash: requiredText(value.contentHash, 'source.contentHash')
  });
}

export function normalizeContextDatum(datum, { datumId } = {}) {
  exactObject(datum, 'datum', DATUM_KEYS);
  const contractVersion = requiredText(datum.contractVersion, 'contractVersion');
  if (contractVersion !== CONTEXT_DATUM_CONTRACT_VERSION) throw new ContextDatumError('UNSUPPORTED_CONTEXT_DATUM_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  const epistemicClass = requiredText(datum.epistemicClass, 'epistemicClass');
  const provenanceClass = requiredText(datum.provenanceClass, 'provenanceClass');
  if (!EPISTEMIC_SET.has(epistemicClass)) throw new ContextDatumError('INVALID_EPISTEMIC_CLASS', `unsupported epistemicClass ${epistemicClass}`);
  if (!PROVENANCE_SET.has(provenanceClass)) throw new ContextDatumError('INVALID_PROVENANCE_CLASS', `unsupported provenanceClass ${provenanceClass}`);
  return deepFreeze({
    contractVersion,
    authorityClass: 'CONTEXT_FACT',
    valueMode: 'INLINE',
    datumId: requiredText(datumId, 'datumId'),
    semanticId: requiredText(datum.semanticId, 'semanticId'),
    value: normalizeValue(datum.value),
    unit: requiredText(datum.unit, 'unit'),
    epistemicClass,
    provenanceClass,
    effectiveInterval: normalizeEffectiveInterval(datum.effectiveInterval),
    availableAt: normalizeTimestamp(datum.availableAt, 'availableAt'),
    spatialSupport: normalizeSpatialSupport(datum.spatialSupport),
    verticalSupport: normalizeVerticalSupport(datum.verticalSupport),
    temporalSupport: normalizeTemporalSupport(datum.temporalSupport),
    uncertainty: normalizeUncertainty(datum.uncertainty),
    source: normalizeSource(datum.source)
  });
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function resolveKind(ledger, ref, kind, code) {
  const normalizedRef = assertAuthorityRef(ref);
  const record = ledger.resolve(normalizedRef);
  if (record.ref.kind !== kind) throw new ContextDatumError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function authorizationScope(target, logicalId) {
  return deepFreeze({
    organizationId: target.organizationId,
    ...(target.tenantId ? { tenantId: target.tenantId } : {}),
    resourceType: 'CONTEXT_DATUM',
    resourceId: requiredText(logicalId, 'logicalId')
  });
}

function validateWriteAuthorization({ ledger, authorizationDecisionAuditRef, principal, target, logicalId }) {
  const record = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'CONTEXT_WRITE_AUTHORIZATION_REQUIRED');
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') throw new ContextDatumError('CONTEXT_WRITE_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) throw new ContextDatumError('CONTEXT_WRITE_AUTHORIZATION_HASH_MISMATCH', 'stored context-write decisionHash is not reproducible');
  const normalizedPrincipal = createPrincipal(principal);
  const expectedScope = authorizationScope(target, logicalId);
  if (stored.operation !== 'CONTEXT_WRITE' || stored.allowed !== true || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, normalizedPrincipal)
    || semanticHash('ADR-A02-WRITE-SCOPE', stored.request?.authorizationScope) !== semanticHash('ADR-A02-WRITE-SCOPE', expectedScope)) {
    throw new ContextDatumError('CONTEXT_WRITE_AUTHORIZATION_MISMATCH', 'stored authorization does not bind exact creator/target/ContextDatum logical identity');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) throw new ContextDatumError('CONTEXT_WRITE_ROLE_ASSIGNMENT_REQUIRED', 'ContextDatum write requires exact RoleAssignment refs');
  const assignments = stored.assignmentRefs.map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'CONTEXT_WRITE_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeContextWrite({ principal: normalizedPrincipal, roleAssignments: assignments, authorizationScope: expectedScope });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) throw new ContextDatumError('CONTEXT_WRITE_AUTHORIZATION_REPLAY_MISMATCH', 'stored context-write authorization cannot be reproduced from exact RoleAssignment authority');
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_CONTEXT_WRITE_ALLOW' && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)))) {
    throw new ContextDatumError('CONTEXT_WRITE_AUTHORIZATION_AUDIT_INVALID', 'context-write authorization lacks direct exact RoleAssignment audit inputs');
  }
  return record;
}

function assertAuditActor(audit, principal) {
  if (!audit || typeof audit !== 'object' || !audit.actor) throw new ContextDatumError('CONTEXT_DATUM_AUDIT_REQUIRED', 'ContextDatum publication requires audit metadata');
  if (audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) throw new ContextDatumError('CONTEXT_DATUM_AUDIT_ACTOR_MISMATCH', 'audit actor must be exact ContextDatum creator');
}

export function publishContextDatum({ ledger, logicalId, version, target, datum, principal, authorizationDecisionAuditRef, audit }) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') throw new ContextDatumError('INVALID_LEDGER', 'publishContextDatum requires replayable AuthorityLedger');
  const normalizedLogicalId = requiredText(logicalId, 'logicalId');
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedTarget = deepFreeze({
    organizationId: requiredText(target?.organizationId, 'target.organizationId'),
    ...(target?.tenantId ? { tenantId: requiredText(target.tenantId, 'target.tenantId') } : {})
  });
  if (normalizedPrincipal.organizationId !== normalizedTarget.organizationId || (normalizedPrincipal.tenantId ?? null) !== (normalizedTarget.tenantId ?? null)) {
    throw new ContextDatumError('CONTEXT_DATUM_TARGET_SCOPE_DENIED', 'creator organization/tenant must exactly match ContextDatum target scope');
  }
  const semanticPayload = normalizeContextDatum(datum, { datumId: normalizedLogicalId });
  const authorization = validateWriteAuthorization({ ledger, authorizationDecisionAuditRef, principal: normalizedPrincipal, target: normalizedTarget, logicalId: normalizedLogicalId });
  assertAuditActor(audit, normalizedPrincipal);
  return ledger.publish({
    kind: 'ContextDatum',
    logicalId: normalizedLogicalId,
    version: requiredText(version, 'version'),
    semanticPayload,
    audit: {
      ...audit,
      action: 'PUBLISH_CONTEXT_DATUM',
      inputRefs: [authorization.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        creationPrincipal: normalizedPrincipal,
        targetScope: normalizedTarget,
        authorizationDecisionAuditRef: authorization.ref,
        authorityClass: 'CONTEXT_FACT'
      }
    }
  });
}

export function validateContextDatumAuthority({ ledger, contextDatumRef }) {
  const ref = assertAuthorityRef(contextDatumRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'ContextDatum') throw new ContextDatumError('CONTEXT_DATUM_REQUIRED', `expected ContextDatum, received ${record.ref.kind}`);
  const payload = record.semanticPayload;
  const normalized = normalizeContextDatum({
    contractVersion: payload.contractVersion,
    semanticId: payload.semanticId,
    value: payload.value,
    unit: payload.unit,
    epistemicClass: payload.epistemicClass,
    provenanceClass: payload.provenanceClass,
    effectiveInterval: payload.effectiveInterval,
    availableAt: payload.availableAt,
    spatialSupport: payload.spatialSupport,
    verticalSupport: payload.verticalSupport,
    temporalSupport: payload.temporalSupport,
    uncertainty: payload.uncertainty,
    source: payload.source
  }, { datumId: record.ref.logicalId });
  if (payload.authorityClass !== 'CONTEXT_FACT' || payload.valueMode !== 'INLINE' || semanticHash('ContextDatum', normalized) !== record.ref.semanticHash) {
    throw new ContextDatumError('CONTEXT_DATUM_SEMANTICS_INVALID', 'stored ContextDatum does not match frozen A02 semantic contract');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let authorization = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_CONTEXT_DATUM' || !event.details?.creationPrincipal || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const creator = createPrincipal(event.details.creationPrincipal);
      const target = event.details.targetScope;
      if (event.actor?.id !== creator.principalId || event.actor?.type !== creator.type || !exactRefIn(event.inputRefs, event.details.authorizationDecisionAuditRef)) continue;
      authorization = validateWriteAuthorization({ ledger, authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef, principal: creator, target, logicalId: record.ref.logicalId });
      break;
    } catch {
      authorization = null;
    }
  }
  if (!authorization) throw new ContextDatumError('CONTEXT_DATUM_AUDIT_INVALID', 'ContextDatum lacks replayable creator/target/context-write authorization authority');
  return deepFreeze({ record, semanticPayload: normalized, writeAuthorization: authorization });
}

function publicValue(value) {
  if (value.type === 'INTERVAL') return { type: value.type, lower: publicValue(value.lower), upper: publicValue(value.upper) };
  if (value.type === 'SET') return { type: value.type, items: value.items.map(publicValue) };
  const out = { type: value.type };
  for (const [key, item] of Object.entries(value)) {
    if (key !== 'type') out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = item;
  }
  return out;
}

function publicUncertainty(uncertainty) {
  const out = { type: uncertainty.type };
  for (const [key, item] of Object.entries(uncertainty)) {
    if (key === 'type') continue;
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = cloneCanonicalValue(item);
  }
  return out;
}

export function materializePublicContextDatum(record) {
  if (!record?.ref || record.ref.kind !== 'ContextDatum') throw new ContextDatumError('CONTEXT_DATUM_REQUIRED', 'ContextDatum authority record required');
  const p = record.semanticPayload;
  return deepFreeze({
    contract_version: p.contractVersion,
    datum_id: p.datumId,
    semantic_id: p.semanticId,
    value: publicValue(p.value),
    unit: p.unit,
    epistemic_class: p.epistemicClass,
    provenance_class: p.provenanceClass,
    effective_interval: { start: p.effectiveInterval.start, end: p.effectiveInterval.end },
    available_at: p.availableAt,
    spatial_support: { type: p.spatialSupport.type, ...(p.spatialSupport.geometryRef ? { geometry_ref: p.spatialSupport.geometryRef } : {}) },
    vertical_support: p.verticalSupport ? { from_mm: p.verticalSupport.fromMm, to_mm: p.verticalSupport.toMm } : null,
    temporal_support: { type: p.temporalSupport.type },
    uncertainty: publicUncertainty(p.uncertainty),
    source: { provider_id: p.source.providerId, source_ref: p.source.sourceRef, content_hash: p.source.contentHash },
    semantic_hash: record.ref.semanticHash
  });
}

export function inlineContextDatumEnvelope(record) {
  return deepFreeze({ value_mode: 'INLINE', datum: materializePublicContextDatum(record) });
}
