import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const RIGHTS_CONTRACT_VERSION = 'adr.rights.v1';
export const RIGHTS_POLICY_AUTHORITY_CLASS = 'RIGHTS_POLICY_AUTHORITY';
export const RIGHTS_GRANT_AUTHORITY_CLASS = 'RIGHTS_GRANT_AUTHORITY';
export const RIGHTS_REVOCATION_AUTHORITY_CLASS = 'RIGHTS_REVOCATION_AUTHORITY';
export const RIGHTS_DECISION_AUTHORITY_CLASS = 'RIGHTS_USE_DECISION_AUTHORITY';
export const RIGHTS_DECISION_AUTHORITY_CLAIM = 'RIGHTS_USE_ONLY_NOT_SCIENTIFIC_OR_DECISION_AUTHORITY';
export const RIGHTS_DEFAULT_OUTCOME = 'DENY';
export const RIGHTS_DECISION_TIME_SEMANTICS = 'POINT_IN_TIME_ONLY';

export const RIGHTS_OPERATIONS = deepFreeze([
  'ACQUIRE',
  'RETAIN_FULLTEXT',
  'READ_FOR_EXTRACTION',
  'EXTRACT_CLAIM',
  'CREATE_EMBEDDING',
  'MODEL_EGRESS',
  'RETAIN_DERIVED',
  'DISPLAY_EXCERPT',
  'REDISTRIBUTE',
  'EXPORT',
  'TRAIN_MODEL',
  'USE_FOR_PRODUCTION_DECISION'
]);

export const RIGHTS_SUBJECT_KINDS = deepFreeze(['Source', 'SourceArtifact']);
export const RIGHTS_OUTCOMES = deepFreeze(['ALLOW', 'DENY']);
export const RIGHTS_BASIS_CLASSES = deepFreeze([
  'CUSTOMER_ASSERTION',
  'CONTRACT',
  'LICENSE',
  'PUBLIC_DOMAIN',
  'INTERNAL_POLICY'
]);

export const RIGHTS_DENY_REASON_CODES = deepFreeze([
  'NO_APPLICABLE_GRANT',
  'POLICY_NOT_YET_PUBLISHED',
  'GRANT_NOT_YET_ISSUED',
  'GRANTEE_SCOPE_MISMATCH',
  'GRANT_NOT_YET_VALID',
  'GRANT_EXPIRED',
  'GRANT_REVOKED',
  'OPERATION_NOT_GRANTED',
  'PURPOSE_NOT_GRANTED',
  'JURISDICTION_NOT_GRANTED'
]);

const OPERATION_SET = new Set(RIGHTS_OPERATIONS);
const SUBJECT_KIND_SET = new Set(RIGHTS_SUBJECT_KINDS);
const OUTCOME_SET = new Set(RIGHTS_OUTCOMES);
const BASIS_SET = new Set(RIGHTS_BASIS_CLASSES);
const DENY_REASON_SET = new Set(RIGHTS_DENY_REASON_CODES);
const PRINCIPAL_TYPES = new Set(['USER', 'SERVICE_ACCOUNT']);

export class RightsAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RightsAuthorityError';
    this.code = code;
  }
}

export function rightsText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RightsAuthorityError('INVALID_RIGHTS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function normalizeRightsTimestamp(value, name) {
  const raw = rightsText(value, name);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new RightsAuthorityError('INVALID_RIGHTS_TIME', `${name} must be an explicit offset-aware timestamp`);
  }
  return new Date(raw).toISOString();
}

function uniqueSortedStrings(values, name, { allowEmpty = false, wildcard = false } = {}) {
  if (!Array.isArray(values)) throw new RightsAuthorityError('INVALID_RIGHTS_INPUT', `${name} must be an array`);
  const normalized = [...new Set(values.map((value) => rightsText(value, name)))].sort();
  if (!allowEmpty && normalized.length === 0) throw new RightsAuthorityError('INVALID_RIGHTS_INPUT', `${name} cannot be empty`);
  if (!wildcard && normalized.includes('*')) throw new RightsAuthorityError('INVALID_RIGHTS_WILDCARD', `${name} does not allow wildcard`);
  if (wildcard && normalized.includes('*') && normalized.length !== 1) {
    throw new RightsAuthorityError('AMBIGUOUS_RIGHTS_WILDCARD', `${name} wildcard cannot be combined with specific values`);
  }
  return deepFreeze(normalized);
}

export function normalizeRightsOwnership(value, name = 'ownership') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_OWNERSHIP', `${name} must be an object`);
  }
  return deepFreeze({
    organizationId: rightsText(value.organizationId, `${name}.organizationId`),
    ...(value.tenantId ? { tenantId: rightsText(value.tenantId, `${name}.tenantId`) } : {})
  });
}

export function normalizeRightsPrincipal(value, name = 'principal') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_PRINCIPAL', `${name} must be an object`);
  }
  const type = rightsText(value.type, `${name}.type`);
  if (!PRINCIPAL_TYPES.has(type)) throw new RightsAuthorityError('INVALID_RIGHTS_PRINCIPAL', `unsupported ${name}.type ${type}`);
  return deepFreeze({
    principalId: rightsText(value.principalId, `${name}.principalId`),
    type,
    organizationId: rightsText(value.organizationId, `${name}.organizationId`),
    ...(value.tenantId ? { tenantId: rightsText(value.tenantId, `${name}.tenantId`) } : {})
  });
}

export function sameRightsPrincipal(left, right) {
  const a = normalizeRightsPrincipal(left, 'leftPrincipal');
  const b = normalizeRightsPrincipal(right, 'rightPrincipal');
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

export function normalizeRightsGrantee(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_GRANTEE', 'grantee must be an object');
  }
  const allowed = new Set(['organizationId', 'tenantId', 'principalId', 'principalType']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new RightsAuthorityError('INVALID_RIGHTS_GRANTEE', `unsupported grantee field ${key}`);
  }
  const normalized = {
    organizationId: rightsText(value.organizationId, 'grantee.organizationId'),
    ...(value.tenantId ? { tenantId: rightsText(value.tenantId, 'grantee.tenantId') } : {}),
    ...(value.principalId ? { principalId: rightsText(value.principalId, 'grantee.principalId') } : {}),
    ...(value.principalType ? { principalType: rightsText(value.principalType, 'grantee.principalType') } : {})
  };
  if (normalized.principalType && !PRINCIPAL_TYPES.has(normalized.principalType)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_GRANTEE', `unsupported grantee.principalType ${normalized.principalType}`);
  }
  return deepFreeze(normalized);
}

export function rightsGranteeMatches(grantee, actor) {
  const scope = normalizeRightsGrantee(grantee);
  const principal = normalizeRightsPrincipal(actor, 'actor');
  if (scope.organizationId !== principal.organizationId) return false;
  if (scope.tenantId && scope.tenantId !== principal.tenantId) return false;
  if (scope.principalId && scope.principalId !== principal.principalId) return false;
  if (scope.principalType && scope.principalType !== principal.type) return false;
  return true;
}

export function normalizeRightsSubjectRef(value, name = 'subjectRef') {
  const ref = assertAuthorityRef(value);
  if (!SUBJECT_KIND_SET.has(ref.kind)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_SUBJECT', `${name} must be an exact Source or SourceArtifact ref`);
  }
  return ref;
}

export function normalizeRightsOperation(value) {
  const operation = rightsText(value, 'operation');
  if (!OPERATION_SET.has(operation)) throw new RightsAuthorityError('UNKNOWN_RIGHTS_OPERATION', `unsupported rights operation ${operation}`);
  return operation;
}

export function normalizeRightsRule(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_RULE', `rules[${index}] must be an object`);
  }
  const allowed = new Set(['operation', 'purposes', 'jurisdictions', 'obligations']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new RightsAuthorityError('INVALID_RIGHTS_RULE', `rules[${index}].${key} is unsupported`);
  }
  return deepFreeze({
    operation: normalizeRightsOperation(value.operation),
    purposes: uniqueSortedStrings(value.purposes, `rules[${index}].purposes`, { wildcard: true }),
    jurisdictions: uniqueSortedStrings(value.jurisdictions, `rules[${index}].jurisdictions`, { wildcard: true }),
    obligations: uniqueSortedStrings(value.obligations ?? [], `rules[${index}].obligations`, { allowEmpty: true })
  });
}

export function normalizeRightsRules(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RightsAuthorityError('INVALID_RIGHTS_RULES', 'rules must be a non-empty array');
  }
  const rules = values.map(normalizeRightsRule);
  const operations = rules.map((rule) => rule.operation);
  if (new Set(operations).size !== operations.length) {
    throw new RightsAuthorityError('DUPLICATE_RIGHTS_OPERATION_RULE', 'a RightsGrant may contain at most one rule per operation');
  }
  return deepFreeze([...rules].sort((a, b) => a.operation.localeCompare(b.operation)));
}

export function normalizeRightsBasis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_BASIS', 'basis must be an object');
  }
  const basisClass = rightsText(value.class, 'basis.class');
  if (!BASIS_SET.has(basisClass)) throw new RightsAuthorityError('INVALID_RIGHTS_BASIS', `unsupported rights basis ${basisClass}`);
  const evidenceRefs = Array.isArray(value.evidenceRefs) ? value.evidenceRefs.map(assertAuthorityRef) : [];
  const keyed = new Map(evidenceRefs.map((ref) => [canonicalizeSemanticJson(ref), ref]));
  return deepFreeze({
    class: basisClass,
    evidenceRefs: [...keyed.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref)
  });
}

export function normalizeRightsOutcome(value) {
  const outcome = rightsText(value, 'outcome');
  if (!OUTCOME_SET.has(outcome)) throw new RightsAuthorityError('INVALID_RIGHTS_OUTCOME', `unsupported rights outcome ${outcome}`);
  return outcome;
}

export function normalizeRightsReasonCodes(values) {
  const reasons = uniqueSortedStrings(values ?? [], 'reasonCodes', { allowEmpty: true });
  for (const reason of reasons) {
    if (!DENY_REASON_SET.has(reason)) throw new RightsAuthorityError('INVALID_RIGHTS_REASON', `unsupported rights reason ${reason}`);
  }
  return reasons;
}

export function rightsRuleMatches(rule, { purpose, jurisdiction }) {
  const normalized = normalizeRightsRule(rule);
  const p = rightsText(purpose, 'purpose');
  const j = rightsText(jurisdiction, 'jurisdiction');
  return {
    purpose: normalized.purposes.includes('*') || normalized.purposes.includes(p),
    jurisdiction: normalized.jurisdictions.includes('*') || normalized.jurisdictions.includes(j)
  };
}

export function canonicalRightsRefs(values) {
  if (!Array.isArray(values)) throw new RightsAuthorityError('INVALID_RIGHTS_REFS', 'rights refs must be an array');
  const keyed = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    keyed.set(canonicalizeSemanticJson(ref), ref);
  }
  return deepFreeze([...keyed.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

export function rightsPayloadHash(kind, payload) {
  return semanticHash(kind, cloneCanonicalValue(payload));
}
