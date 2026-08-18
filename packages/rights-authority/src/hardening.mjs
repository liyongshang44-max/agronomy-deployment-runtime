import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  RightsAuthorityError,
  normalizeRightsPrincipal,
  normalizeRightsTimestamp,
  rightsText,
  sameRightsPrincipal
} from './contract.mjs';
import {
  assertRightsAllowed as rawAssertRightsAllowed,
  publishRightsDecision as rawPublishRightsDecision,
  publishRightsGrant as rawPublishRightsGrant,
  publishRightsPolicy as rawPublishRightsPolicy,
  publishRightsRevocation as rawPublishRightsRevocation,
  validateRightsDecision as rawValidateRightsDecision,
  validateRightsGrant as rawValidateRightsGrant,
  validateRightsPolicy as rawValidateRightsPolicy,
  validateRightsRevocation as rawValidateRightsRevocation
} from './authority.mjs';

const POLICY_KEYS = new Set([
  'contractVersion', 'authorityClass', 'ownership', 'ownerPrincipal', 'basis',
  'defaultOutcome', 'supportedOperations', 'subjectKinds', 'publishedAt'
]);
const GRANT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'rightsPolicyRef', 'subjectRef', 'grantee',
  'rules', 'validFrom', 'validUntil', 'issuedAt', 'grantorPrincipal'
]);
const REVOCATION_KEYS = new Set([
  'contractVersion', 'authorityClass', 'rightsPolicyRef', 'rightsGrantRef', 'subjectRef',
  'effectiveAt', 'recordedAt', 'reasonCodes', 'revokerPrincipal'
]);
const DECISION_KEYS = new Set([
  'contractVersion', 'authorityClass', 'rightsPolicyRef', 'subjectRef', 'actor',
  'evaluatorPrincipal', 'operation', 'purpose', 'jurisdiction', 'evaluatedAt', 'outcome',
  'consideredGrantRefs', 'grantRefs', 'revocationRefs', 'obligations', 'reasonCodes',
  'decisionTimeSemantics', 'decisionAuthorityClaim'
]);
const OWNERSHIP_KEYS = new Set(['organizationId', 'tenantId']);
const PRINCIPAL_KEYS = new Set(['principalId', 'type', 'organizationId', 'tenantId']);
const BASIS_KEYS = new Set(['class', 'evidenceRefs']);
const GRANTEE_KEYS = new Set(['organizationId', 'tenantId', 'principalId', 'principalType']);
const RULE_KEYS = new Set(['operation', 'purposes', 'jurisdictions', 'obligations']);

function exactObject(value, allowedKeys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsAuthorityError('RIGHTS_SEMANTIC_SHAPE_INVALID', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RightsAuthorityError('RIGHTS_SEMANTIC_SHAPE_INVALID', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new RightsAuthorityError(
        'RIGHTS_SEMANTIC_FIELD_FORBIDDEN',
        `${name}.${key} is outside the frozen adr.rights.v1 authority contract`
      );
    }
  }
}

function typedRecord(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (!record?.ref || record.ref.kind !== kind) {
    throw new RightsAuthorityError(code, `expected ${kind}, received ${record?.ref?.kind ?? 'UNKNOWN'}`);
  }
  return record;
}

function assertStrictOwnership(value, name) {
  exactObject(value, OWNERSHIP_KEYS, name);
}

function assertStrictPrincipal(value, name) {
  exactObject(value, PRINCIPAL_KEYS, name);
}

function assertStrictPolicyPayload(payload) {
  exactObject(payload, POLICY_KEYS, 'RightsPolicy');
  assertStrictOwnership(payload.ownership, 'RightsPolicy.ownership');
  assertStrictPrincipal(payload.ownerPrincipal, 'RightsPolicy.ownerPrincipal');
  exactObject(payload.basis, BASIS_KEYS, 'RightsPolicy.basis');
}

function assertStrictGrantPayload(payload) {
  exactObject(payload, GRANT_KEYS, 'RightsGrant');
  exactObject(payload.grantee, GRANTEE_KEYS, 'RightsGrant.grantee');
  assertStrictPrincipal(payload.grantorPrincipal, 'RightsGrant.grantorPrincipal');
  if (!Array.isArray(payload.rules)) {
    throw new RightsAuthorityError('RIGHTS_SEMANTIC_SHAPE_INVALID', 'RightsGrant.rules must be an array');
  }
  payload.rules.forEach((rule, index) => exactObject(rule, RULE_KEYS, `RightsGrant.rules[${index}]`));
}

function assertStrictRevocationPayload(payload) {
  exactObject(payload, REVOCATION_KEYS, 'RightsRevocation');
  assertStrictPrincipal(payload.revokerPrincipal, 'RightsRevocation.revokerPrincipal');
}

function assertStrictDecisionPayload(payload) {
  exactObject(payload, DECISION_KEYS, 'RightsDecision');
  assertStrictPrincipal(payload.actor, 'RightsDecision.actor');
  assertStrictPrincipal(payload.evaluatorPrincipal, 'RightsDecision.evaluatorPrincipal');
}

function ownershipMatchesPrincipal(ownership, principal) {
  const normalized = normalizeRightsPrincipal(principal);
  return normalized.organizationId === ownership.organizationId
    && (normalized.tenantId ?? null) === (ownership.tenantId ?? null);
}

function directPublicationAudit(ledger, record, action) {
  return ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref) && event.action === action);
}

function assertAuditTimeEquals(ledger, record, action, semanticTime, code) {
  const expected = normalizeRightsTimestamp(semanticTime, `${record.ref.kind}.semanticTime`);
  const audits = directPublicationAudit(ledger, record, action);
  if (audits.length === 0 || !audits.some((event) =>
    normalizeRightsTimestamp(event.occurredAt, `${record.ref.kind}.audit.occurredAt`) === expected)) {
    throw new RightsAuthorityError(code, `${record.ref.kind} semantic publication time must equal a direct publication audit occurredAt`);
  }
}

function exactPolicyOwner(policy, principal, code) {
  if (!sameRightsPrincipal(policy.ownerPrincipal, principal)) {
    throw new RightsAuthorityError(
      code,
      'adr.rights.v1 has no implicit rights-administration delegation; grant/revocation principal must equal exact RightsPolicy.ownerPrincipal'
    );
  }
}

function relatedRightsRecords(ledger, policyRef, subjectRef) {
  const records = ledger.exportSnapshot().records;
  const grants = records.filter((record) =>
    record.ref.kind === 'RightsGrant'
      && sameAuthorityRef(record.semanticPayload?.rightsPolicyRef, policyRef)
      && sameAuthorityRef(record.semanticPayload?.subjectRef, subjectRef));
  const grantRefs = grants.map((record) => record.ref);
  const revocations = records.filter((record) =>
    record.ref.kind === 'RightsRevocation'
      && grantRefs.some((ref) => sameAuthorityRef(record.semanticPayload?.rightsGrantRef, ref)));
  return { grants, revocations };
}

function strictPreflightRightsWorld({ ledger, rightsPolicyRef, subjectRef }) {
  const policy = validateRightsPolicy({ ledger, rightsPolicyRef });
  const related = relatedRightsRecords(ledger, policy.record.ref, subjectRef);
  for (const grant of related.grants) validateRightsGrant({ ledger, rightsGrantRef: grant.ref });
  for (const revocation of related.revocations) validateRightsRevocation({ ledger, rightsRevocationRef: revocation.ref });
  return policy;
}

export function publishRightsPolicy(args) {
  const record = rawPublishRightsPolicy(args);
  validateRightsPolicy({ ledger: args.ledger, rightsPolicyRef: record.ref });
  return record;
}

export function validateRightsPolicy(args) {
  const record = typedRecord(args.ledger, args.rightsPolicyRef, 'RightsPolicy', 'RIGHTS_POLICY_REQUIRED');
  assertStrictPolicyPayload(record.semanticPayload);
  assertAuditTimeEquals(
    args.ledger,
    record,
    'PUBLISH_RIGHTS_POLICY',
    record.semanticPayload.publishedAt,
    'RIGHTS_POLICY_AUDIT_TIME_MISMATCH'
  );
  return rawValidateRightsPolicy(args);
}

export function publishRightsGrant(args) {
  const policy = validateRightsPolicy({ ledger: args.ledger, rightsPolicyRef: args.rightsPolicyRef });
  exactPolicyOwner(policy, args.grantorPrincipal, 'RIGHTS_GRANTOR_NOT_POLICY_OWNER');
  const record = rawPublishRightsGrant(args);
  validateRightsGrant({ ledger: args.ledger, rightsGrantRef: record.ref });
  return record;
}

export function validateRightsGrant(args) {
  const record = typedRecord(args.ledger, args.rightsGrantRef, 'RightsGrant', 'RIGHTS_GRANT_REQUIRED');
  assertStrictGrantPayload(record.semanticPayload);
  assertAuditTimeEquals(
    args.ledger,
    record,
    'PUBLISH_RIGHTS_GRANT',
    record.semanticPayload.issuedAt,
    'RIGHTS_GRANT_AUDIT_TIME_MISMATCH'
  );
  const result = rawValidateRightsGrant(args);
  exactPolicyOwner(result.policy, result.grantorPrincipal, 'RIGHTS_GRANTOR_NOT_POLICY_OWNER');
  return result;
}

export function publishRightsRevocation(args) {
  const grant = validateRightsGrant({ ledger: args.ledger, rightsGrantRef: args.rightsGrantRef });
  exactPolicyOwner(grant.policy, args.revokerPrincipal, 'RIGHTS_REVOKER_NOT_POLICY_OWNER');
  const record = rawPublishRightsRevocation(args);
  validateRightsRevocation({ ledger: args.ledger, rightsRevocationRef: record.ref });
  return record;
}

export function validateRightsRevocation(args) {
  const record = typedRecord(args.ledger, args.rightsRevocationRef, 'RightsRevocation', 'RIGHTS_REVOCATION_REQUIRED');
  assertStrictRevocationPayload(record.semanticPayload);
  assertAuditTimeEquals(
    args.ledger,
    record,
    'PUBLISH_RIGHTS_REVOCATION',
    record.semanticPayload.recordedAt,
    'RIGHTS_REVOCATION_AUDIT_TIME_MISMATCH'
  );
  const result = rawValidateRightsRevocation(args);
  exactPolicyOwner(result.grant.policy, result.revokerPrincipal, 'RIGHTS_REVOKER_NOT_POLICY_OWNER');
  return result;
}

export function publishRightsDecision(args) {
  const policy = strictPreflightRightsWorld({
    ledger: args.ledger,
    rightsPolicyRef: args.rightsPolicyRef,
    subjectRef: args.subjectRef
  });
  if (!ownershipMatchesPrincipal(policy.ownership, args.evaluatorPrincipal)) {
    throw new RightsAuthorityError(
      'RIGHTS_EVALUATOR_SCOPE_MISMATCH',
      'RightsDecision evaluator must belong to exact RightsPolicy organization/tenant'
    );
  }
  const record = rawPublishRightsDecision(args);
  validateRightsDecision({ ledger: args.ledger, rightsDecisionRef: record.ref });
  return record;
}

export function validateRightsDecision(args) {
  const record = typedRecord(args.ledger, args.rightsDecisionRef, 'RightsDecision', 'RIGHTS_DECISION_REQUIRED');
  assertStrictDecisionPayload(record.semanticPayload);
  assertAuditTimeEquals(
    args.ledger,
    record,
    `RIGHTS_${record.semanticPayload.operation}_${record.semanticPayload.outcome}`,
    record.semanticPayload.evaluatedAt,
    'RIGHTS_DECISION_AUDIT_TIME_MISMATCH'
  );
  const policy = strictPreflightRightsWorld({
    ledger: args.ledger,
    rightsPolicyRef: record.semanticPayload.rightsPolicyRef,
    subjectRef: record.semanticPayload.subjectRef
  });
  if (!ownershipMatchesPrincipal(policy.ownership, record.semanticPayload.evaluatorPrincipal)) {
    throw new RightsAuthorityError(
      'RIGHTS_EVALUATOR_SCOPE_MISMATCH',
      'stored RightsDecision evaluator differs from exact RightsPolicy organization/tenant'
    );
  }
  return rawValidateRightsDecision(args);
}

function normalizedCapabilities(values) {
  if (!Array.isArray(values)) {
    throw new RightsAuthorityError(
      'RIGHTS_OBLIGATION_CAPABILITY_REQUIRED',
      'enforceableObligations must be an explicit array; ALLOW obligations cannot be silently ignored'
    );
  }
  return new Set(values.map((value) => rightsText(value, 'enforceableObligations[]')));
}

export function assertRightsAllowed({ enforceableObligations = undefined, ...args }) {
  const validated = validateRightsDecision({ ledger: args.ledger, rightsDecisionRef: args.rightsDecisionRef });
  if (validated.semanticPayload.outcome === 'ALLOW') {
    const capabilities = normalizedCapabilities(enforceableObligations);
    const unsupported = validated.semanticPayload.obligations.filter((obligation) => !capabilities.has(obligation));
    if (unsupported.length > 0) {
      throw new RightsAuthorityError(
        'RIGHTS_OBLIGATION_UNSUPPORTED',
        `consumer cannot enforce mandatory RightsDecision obligations: ${unsupported.join(',')}`
      );
    }
  }
  return rawAssertRightsAllowed(args);
}
