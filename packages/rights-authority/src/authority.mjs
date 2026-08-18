import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  RIGHTS_CONTRACT_VERSION,
  RIGHTS_DECISION_AUTHORITY_CLAIM,
  RIGHTS_DECISION_AUTHORITY_CLASS,
  RIGHTS_DECISION_TIME_SEMANTICS,
  RIGHTS_DEFAULT_OUTCOME,
  RIGHTS_GRANT_AUTHORITY_CLASS,
  RIGHTS_OPERATIONS,
  RIGHTS_POLICY_AUTHORITY_CLASS,
  RIGHTS_REVOCATION_AUTHORITY_CLASS,
  RIGHTS_SUBJECT_KINDS,
  RightsAuthorityError,
  canonicalRightsRefs,
  normalizeRightsBasis,
  normalizeRightsGrantee,
  normalizeRightsOperation,
  normalizeRightsOutcome,
  normalizeRightsOwnership,
  normalizeRightsPrincipal,
  normalizeRightsReasonCodes,
  normalizeRightsRules,
  normalizeRightsSubjectRef,
  normalizeRightsTimestamp,
  rightsGranteeMatches,
  rightsRuleMatches,
  rightsText,
  sameRightsPrincipal
} from './contract.mjs';

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.exportSnapshot !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.addLineage !== 'function') {
    throw new RightsAuthorityError('INVALID_RIGHTS_LEDGER', 'rights authority requires replayable AuthorityLedger');
  }
  return ledger;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function sameRefSet(left, right) {
  const a = canonicalRightsRefs(left).map(refKey);
  const b = canonicalRightsRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new RightsAuthorityError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function auditTime(audit, name = 'audit') {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    throw new RightsAuthorityError('RIGHTS_AUDIT_REQUIRED', `${name} metadata is required`);
  }
  return normalizeRightsTimestamp(audit.occurredAt, `${name}.occurredAt`);
}

function assertAuditPrincipal(audit, principal, code) {
  const normalized = normalizeRightsPrincipal(principal);
  if (audit?.actor?.id !== normalized.principalId || audit?.actor?.type !== normalized.type) {
    throw new RightsAuthorityError(code, 'rights authority publication audit actor must equal the declared principal');
  }
}

function sameOwnership(left, right) {
  const a = normalizeRightsOwnership(left, 'leftOwnership');
  const b = normalizeRightsOwnership(right, 'rightOwnership');
  return a.organizationId === b.organizationId && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function assertPrincipalOwnership(principal, ownership, code) {
  const p = normalizeRightsPrincipal(principal);
  const o = normalizeRightsOwnership(ownership);
  if (p.organizationId !== o.organizationId || (p.tenantId ?? null) !== (o.tenantId ?? null)) {
    throw new RightsAuthorityError(code, 'rights principal organization/tenant must equal rights authority ownership');
  }
}

function validateBasisEvidence(ledger, basis) {
  for (const ref of basis.evidenceRefs) ledger.resolve(ref);
}

function subjectRecordAndOwnership(ledger, subjectRef) {
  const normalizedRef = normalizeRightsSubjectRef(subjectRef);
  const subject = ledger.resolve(normalizedRef);
  if (subject.ref.kind === 'Source') {
    if (!subject.semanticPayload?.ownership) {
      throw new RightsAuthorityError('RIGHTS_SUBJECT_OWNERSHIP_REQUIRED', 'Source rights subject must carry ownership');
    }
    return { subject, ownership: normalizeRightsOwnership(subject.semanticPayload.ownership) };
  }
  const source = resolveKind(
    ledger,
    subject.semanticPayload?.sourceRef,
    'Source',
    'RIGHTS_SOURCE_ARTIFACT_SOURCE_REQUIRED'
  );
  if (!source.semanticPayload?.ownership) {
    throw new RightsAuthorityError('RIGHTS_SUBJECT_OWNERSHIP_REQUIRED', 'SourceArtifact parent Source must carry ownership');
  }
  return { subject, source, ownership: normalizeRightsOwnership(source.semanticPayload.ownership) };
}

function directAuditFor(ledger, record) {
  return ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
}

export function publishRightsPolicy({
  ledger,
  logicalId,
  version,
  ownership,
  ownerPrincipal,
  basis,
  audit
}) {
  requireLedger(ledger);
  const normalizedOwnership = normalizeRightsOwnership(ownership);
  const normalizedOwner = normalizeRightsPrincipal(ownerPrincipal, 'ownerPrincipal');
  assertPrincipalOwnership(normalizedOwner, normalizedOwnership, 'RIGHTS_POLICY_OWNER_SCOPE_MISMATCH');
  assertAuditPrincipal(audit, normalizedOwner, 'RIGHTS_POLICY_AUDIT_ACTOR_MISMATCH');
  const publishedAt = auditTime(audit);
  const normalizedBasis = normalizeRightsBasis(basis);
  validateBasisEvidence(ledger, normalizedBasis);
  return ledger.publish({
    kind: 'RightsPolicy',
    logicalId: rightsText(logicalId, 'logicalId'),
    version: rightsText(version, 'version'),
    semanticPayload: {
      contractVersion: RIGHTS_CONTRACT_VERSION,
      authorityClass: RIGHTS_POLICY_AUTHORITY_CLASS,
      ownership: normalizedOwnership,
      ownerPrincipal: normalizedOwner,
      basis: normalizedBasis,
      defaultOutcome: RIGHTS_DEFAULT_OUTCOME,
      supportedOperations: RIGHTS_OPERATIONS,
      subjectKinds: RIGHTS_SUBJECT_KINDS,
      publishedAt
    },
    audit: {
      ...audit,
      action: 'PUBLISH_RIGHTS_POLICY',
      inputRefs: [...normalizedBasis.evidenceRefs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        rightsAuthorityClass: RIGHTS_POLICY_AUTHORITY_CLASS,
        defaultOutcome: RIGHTS_DEFAULT_OUTCOME
      }
    }
  });
}

export function validateRightsPolicy({ ledger, rightsPolicyRef }) {
  requireLedger(ledger);
  const record = resolveKind(ledger, rightsPolicyRef, 'RightsPolicy', 'RIGHTS_POLICY_REQUIRED');
  const payload = record.semanticPayload;
  if (payload?.contractVersion !== RIGHTS_CONTRACT_VERSION
    || payload?.authorityClass !== RIGHTS_POLICY_AUTHORITY_CLASS
    || payload?.defaultOutcome !== 'DENY') {
    throw new RightsAuthorityError('RIGHTS_POLICY_INVALID', 'RightsPolicy contract/authority/default semantics are invalid');
  }
  const ownership = normalizeRightsOwnership(payload.ownership);
  const ownerPrincipal = normalizeRightsPrincipal(payload.ownerPrincipal);
  assertPrincipalOwnership(ownerPrincipal, ownership, 'RIGHTS_POLICY_OWNER_SCOPE_MISMATCH');
  const basis = normalizeRightsBasis(payload.basis);
  validateBasisEvidence(ledger, basis);
  const publishedAt = normalizeRightsTimestamp(payload.publishedAt, 'RightsPolicy.publishedAt');
  if (JSON.stringify(payload.supportedOperations) !== JSON.stringify(RIGHTS_OPERATIONS)
    || JSON.stringify(payload.subjectKinds) !== JSON.stringify(RIGHTS_SUBJECT_KINDS)) {
    throw new RightsAuthorityError('RIGHTS_POLICY_VOCABULARY_INVALID', 'RightsPolicy must freeze the complete v1 operation and subject vocabularies');
  }
  const validAudit = directAuditFor(ledger, record).some((event) =>
    event.action === 'PUBLISH_RIGHTS_POLICY'
      && event.actor?.id === ownerPrincipal.principalId
      && event.actor?.type === ownerPrincipal.type
      && basis.evidenceRefs.every((ref) => event.inputRefs.some((candidate) => sameAuthorityRef(candidate, ref))));
  if (!validAudit) throw new RightsAuthorityError('RIGHTS_POLICY_AUDIT_INVALID', 'RightsPolicy lacks exact owner publication audit');
  return deepFreeze({ record, payload, ownership, ownerPrincipal, basis, publishedAt });
}

export function publishRightsGrant({
  ledger,
  logicalId,
  version,
  rightsPolicyRef,
  subjectRef,
  grantee,
  rules,
  validFrom,
  validUntil = null,
  grantorPrincipal,
  audit
}) {
  requireLedger(ledger);
  const policy = validateRightsPolicy({ ledger, rightsPolicyRef });
  const subjectWorld = subjectRecordAndOwnership(ledger, subjectRef);
  if (!sameOwnership(policy.ownership, subjectWorld.ownership)) {
    throw new RightsAuthorityError('RIGHTS_POLICY_SUBJECT_SCOPE_MISMATCH', 'RightsPolicy ownership differs from exact Source rights subject ownership');
  }
  const grantor = normalizeRightsPrincipal(grantorPrincipal, 'grantorPrincipal');
  assertPrincipalOwnership(grantor, policy.ownership, 'RIGHTS_GRANTOR_SCOPE_MISMATCH');
  assertAuditPrincipal(audit, grantor, 'RIGHTS_GRANT_AUDIT_ACTOR_MISMATCH');
  const issuedAt = auditTime(audit);
  const from = normalizeRightsTimestamp(validFrom, 'validFrom');
  const until = validUntil ? normalizeRightsTimestamp(validUntil, 'validUntil') : null;
  if (until && Date.parse(until) <= Date.parse(from)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_INTERVAL', 'validUntil must be later than validFrom');
  }
  const normalizedRules = normalizeRightsRules(rules);
  const normalizedGrantee = normalizeRightsGrantee(grantee);
  if (normalizedGrantee.organizationId !== policy.ownership.organizationId
    || (normalizedGrantee.tenantId ?? null) !== (policy.ownership.tenantId ?? null)) {
    throw new RightsAuthorityError('RIGHTS_GRANTEE_SCOPE_MISMATCH', 'RightsGrant grantee must stay within RightsPolicy organization/tenant in v1');
  }
  return ledger.publish({
    kind: 'RightsGrant',
    logicalId: rightsText(logicalId, 'logicalId'),
    version: rightsText(version, 'version'),
    semanticPayload: {
      contractVersion: RIGHTS_CONTRACT_VERSION,
      authorityClass: RIGHTS_GRANT_AUTHORITY_CLASS,
      rightsPolicyRef: policy.record.ref,
      subjectRef: subjectWorld.subject.ref,
      grantee: normalizedGrantee,
      rules: normalizedRules,
      validFrom: from,
      ...(until ? { validUntil: until } : {}),
      issuedAt,
      grantorPrincipal: grantor
    },
    audit: {
      ...audit,
      action: 'PUBLISH_RIGHTS_GRANT',
      inputRefs: [policy.record.ref, subjectWorld.subject.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        rightsAuthorityClass: RIGHTS_GRANT_AUTHORITY_CLASS,
        operations: normalizedRules.map((rule) => rule.operation)
      }
    }
  });
}

export function validateRightsGrant({ ledger, rightsGrantRef }) {
  requireLedger(ledger);
  const record = resolveKind(ledger, rightsGrantRef, 'RightsGrant', 'RIGHTS_GRANT_REQUIRED');
  const payload = record.semanticPayload;
  if (payload?.contractVersion !== RIGHTS_CONTRACT_VERSION || payload?.authorityClass !== RIGHTS_GRANT_AUTHORITY_CLASS) {
    throw new RightsAuthorityError('RIGHTS_GRANT_INVALID', 'RightsGrant contract/authority semantics are invalid');
  }
  const policy = validateRightsPolicy({ ledger, rightsPolicyRef: payload.rightsPolicyRef });
  const subjectWorld = subjectRecordAndOwnership(ledger, payload.subjectRef);
  if (!sameOwnership(policy.ownership, subjectWorld.ownership)) {
    throw new RightsAuthorityError('RIGHTS_POLICY_SUBJECT_SCOPE_MISMATCH', 'RightsGrant subject ownership differs from RightsPolicy ownership');
  }
  const grantee = normalizeRightsGrantee(payload.grantee);
  const rules = normalizeRightsRules(payload.rules);
  const validFrom = normalizeRightsTimestamp(payload.validFrom, 'RightsGrant.validFrom');
  const validUntil = payload.validUntil ? normalizeRightsTimestamp(payload.validUntil, 'RightsGrant.validUntil') : null;
  if (validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new RightsAuthorityError('INVALID_RIGHTS_INTERVAL', 'RightsGrant validUntil must be later than validFrom');
  }
  const issuedAt = normalizeRightsTimestamp(payload.issuedAt, 'RightsGrant.issuedAt');
  const grantorPrincipal = normalizeRightsPrincipal(payload.grantorPrincipal, 'RightsGrant.grantorPrincipal');
  assertPrincipalOwnership(grantorPrincipal, policy.ownership, 'RIGHTS_GRANTOR_SCOPE_MISMATCH');
  const validAudit = directAuditFor(ledger, record).some((event) =>
    event.action === 'PUBLISH_RIGHTS_GRANT'
      && event.actor?.id === grantorPrincipal.principalId
      && event.actor?.type === grantorPrincipal.type
      && event.inputRefs.some((ref) => sameAuthorityRef(ref, policy.record.ref))
      && event.inputRefs.some((ref) => sameAuthorityRef(ref, subjectWorld.subject.ref)));
  if (!validAudit) throw new RightsAuthorityError('RIGHTS_GRANT_AUDIT_INVALID', 'RightsGrant lacks exact grantor audit over policy and subject');
  return deepFreeze({ record, payload, policy, subjectWorld, grantee, rules, validFrom, validUntil, issuedAt, grantorPrincipal });
}

function revocationsForGrantAsOf(ledger, grantRef, at) {
  const t = Date.parse(at);
  return ledger.exportSnapshot().records
    .filter((record) => record.ref.kind === 'RightsRevocation'
      && sameAuthorityRef(record.semanticPayload?.rightsGrantRef, grantRef))
    .map((record) => validateRightsRevocation({ ledger, rightsRevocationRef: record.ref }))
    .filter((item) => Date.parse(item.recordedAt) <= t && Date.parse(item.effectiveAt) <= t)
    .sort((a, b) => refKey(a.record.ref).localeCompare(refKey(b.record.ref)));
}

export function publishRightsRevocation({
  ledger,
  logicalId,
  version,
  rightsGrantRef,
  effectiveAt,
  reasonCodes,
  revokerPrincipal,
  audit
}) {
  requireLedger(ledger);
  const grant = validateRightsGrant({ ledger, rightsGrantRef });
  const revoker = normalizeRightsPrincipal(revokerPrincipal, 'revokerPrincipal');
  assertPrincipalOwnership(revoker, grant.policy.ownership, 'RIGHTS_REVOKER_SCOPE_MISMATCH');
  assertAuditPrincipal(audit, revoker, 'RIGHTS_REVOCATION_AUDIT_ACTOR_MISMATCH');
  const recordedAt = auditTime(audit);
  const effective = normalizeRightsTimestamp(effectiveAt, 'effectiveAt');
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
    throw new RightsAuthorityError('RIGHTS_REVOCATION_REASON_REQUIRED', 'RightsRevocation requires at least one reason code');
  }
  const reasons = deepFreeze([...new Set(reasonCodes.map((value) => rightsText(value, 'reasonCode')))].sort());
  const revocation = ledger.publish({
    kind: 'RightsRevocation',
    logicalId: rightsText(logicalId, 'logicalId'),
    version: rightsText(version, 'version'),
    semanticPayload: {
      contractVersion: RIGHTS_CONTRACT_VERSION,
      authorityClass: RIGHTS_REVOCATION_AUTHORITY_CLASS,
      rightsPolicyRef: grant.policy.record.ref,
      rightsGrantRef: grant.record.ref,
      subjectRef: grant.subjectWorld.subject.ref,
      effectiveAt: effective,
      recordedAt,
      reasonCodes: reasons,
      revokerPrincipal: revoker
    },
    audit: {
      ...audit,
      action: 'PUBLISH_RIGHTS_REVOCATION',
      inputRefs: [grant.policy.record.ref, grant.record.ref, grant.subjectWorld.subject.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        rightsAuthorityClass: RIGHTS_REVOCATION_AUTHORITY_CLASS,
        effectiveAt: effective
      }
    }
  });
  ledger.addLineage({
    relation: 'revokes',
    from: revocation.ref,
    to: grant.record.ref,
    details: { authorityTransition: 'RIGHTS_GRANT_REVOCATION', effectiveAt: effective },
    audit: {
      ...audit,
      eventId: `${rightsText(audit.eventId, 'audit.eventId')}:grant-revocation-lineage`,
      action: 'LINEAGE_REVOKES',
      inputRefs: [grant.policy.record.ref, ...(audit.inputRefs ?? [])]
    }
  });
  return revocation;
}

export function validateRightsRevocation({ ledger, rightsRevocationRef }) {
  requireLedger(ledger);
  const record = resolveKind(ledger, rightsRevocationRef, 'RightsRevocation', 'RIGHTS_REVOCATION_REQUIRED');
  const payload = record.semanticPayload;
  if (payload?.contractVersion !== RIGHTS_CONTRACT_VERSION || payload?.authorityClass !== RIGHTS_REVOCATION_AUTHORITY_CLASS) {
    throw new RightsAuthorityError('RIGHTS_REVOCATION_INVALID', 'RightsRevocation contract/authority semantics are invalid');
  }
  const grant = validateRightsGrant({ ledger, rightsGrantRef: payload.rightsGrantRef });
  if (!sameAuthorityRef(payload.rightsPolicyRef, grant.policy.record.ref)
    || !sameAuthorityRef(payload.subjectRef, grant.subjectWorld.subject.ref)) {
    throw new RightsAuthorityError('RIGHTS_REVOCATION_SCOPE_MISMATCH', 'RightsRevocation must bind the exact grant policy and subject');
  }
  const effectiveAt = normalizeRightsTimestamp(payload.effectiveAt, 'RightsRevocation.effectiveAt');
  const recordedAt = normalizeRightsTimestamp(payload.recordedAt, 'RightsRevocation.recordedAt');
  if (!Array.isArray(payload.reasonCodes) || payload.reasonCodes.length === 0) {
    throw new RightsAuthorityError('RIGHTS_REVOCATION_REASON_REQUIRED', 'RightsRevocation requires reason codes');
  }
  const revokerPrincipal = normalizeRightsPrincipal(payload.revokerPrincipal, 'RightsRevocation.revokerPrincipal');
  assertPrincipalOwnership(revokerPrincipal, grant.policy.ownership, 'RIGHTS_REVOKER_SCOPE_MISMATCH');
  const validAudit = directAuditFor(ledger, record).some((event) =>
    event.action === 'PUBLISH_RIGHTS_REVOCATION'
      && event.actor?.id === revokerPrincipal.principalId
      && event.actor?.type === revokerPrincipal.type
      && event.inputRefs.some((ref) => sameAuthorityRef(ref, grant.record.ref)));
  if (!validAudit) throw new RightsAuthorityError('RIGHTS_REVOCATION_AUDIT_INVALID', 'RightsRevocation lacks exact revoker audit');
  const lineage = ledger.lineageFor(record.ref).filter((item) => item.relation === 'revokes' && sameAuthorityRef(item.to, grant.record.ref));
  if (lineage.length !== 1) throw new RightsAuthorityError('RIGHTS_REVOCATION_LINEAGE_REQUIRED', 'RightsRevocation must carry one exact revokes lineage edge to its RightsGrant');
  return deepFreeze({ record, payload, grant, effectiveAt, recordedAt, revokerPrincipal });
}

function grantsForWorld({ ledger, policyRef, subjectRef, at }) {
  const t = Date.parse(at);
  return ledger.exportSnapshot().records
    .filter((record) => record.ref.kind === 'RightsGrant'
      && sameAuthorityRef(record.semanticPayload?.rightsPolicyRef, policyRef)
      && sameAuthorityRef(record.semanticPayload?.subjectRef, subjectRef))
    .map((record) => validateRightsGrant({ ledger, rightsGrantRef: record.ref }))
    .filter((grant) => Date.parse(grant.issuedAt) <= t)
    .sort((a, b) => refKey(a.record.ref).localeCompare(refKey(b.record.ref)));
}

function buildRightsDecisionPayload({
  ledger,
  rightsPolicyRef,
  subjectRef,
  actor,
  evaluatorPrincipal,
  operation,
  purpose,
  jurisdiction,
  evaluatedAt
}) {
  const policy = validateRightsPolicy({ ledger, rightsPolicyRef });
  const subjectWorld = subjectRecordAndOwnership(ledger, subjectRef);
  if (!sameOwnership(policy.ownership, subjectWorld.ownership)) {
    throw new RightsAuthorityError('RIGHTS_POLICY_SUBJECT_SCOPE_MISMATCH', 'RightsDecision policy ownership differs from subject ownership');
  }
  const at = normalizeRightsTimestamp(evaluatedAt, 'evaluatedAt');
  if (Date.parse(at) < Date.parse(policy.publishedAt)) {
    throw new RightsAuthorityError('RIGHTS_POLICY_NOT_YET_PUBLISHED', 'RightsDecision cannot evaluate a policy before its publication time');
  }
  const normalizedActor = normalizeRightsPrincipal(actor, 'actor');
  const evaluator = normalizeRightsPrincipal(evaluatorPrincipal, 'evaluatorPrincipal');
  const op = normalizeRightsOperation(operation);
  const p = rightsText(purpose, 'purpose');
  const j = rightsText(jurisdiction, 'jurisdiction');
  const grants = grantsForWorld({ ledger, policyRef: policy.record.ref, subjectRef: subjectWorld.subject.ref, at });
  const reasons = new Set();
  const matched = [];
  const effectiveRevocations = [];

  for (const grant of grants) {
    if (!rightsGranteeMatches(grant.grantee, normalizedActor)) {
      reasons.add('GRANTEE_SCOPE_MISMATCH');
      continue;
    }
    if (Date.parse(at) < Date.parse(grant.validFrom)) {
      reasons.add('GRANT_NOT_YET_VALID');
      continue;
    }
    if (grant.validUntil && Date.parse(at) >= Date.parse(grant.validUntil)) {
      reasons.add('GRANT_EXPIRED');
      continue;
    }
    const revocations = revocationsForGrantAsOf(ledger, grant.record.ref, at);
    if (revocations.length > 0) {
      reasons.add('GRANT_REVOKED');
      effectiveRevocations.push(...revocations.map((item) => item.record.ref));
      continue;
    }
    const rule = grant.rules.find((candidate) => candidate.operation === op);
    if (!rule) {
      reasons.add('OPERATION_NOT_GRANTED');
      continue;
    }
    const match = rightsRuleMatches(rule, { purpose: p, jurisdiction: j });
    if (!match.purpose) {
      reasons.add('PURPOSE_NOT_GRANTED');
      continue;
    }
    if (!match.jurisdiction) {
      reasons.add('JURISDICTION_NOT_GRANTED');
      continue;
    }
    matched.push({ grant, rule });
  }

  const outcome = matched.length > 0 ? 'ALLOW' : 'DENY';
  if (outcome === 'DENY' && reasons.size === 0) reasons.add('NO_APPLICABLE_GRANT');
  const obligations = [...new Set(matched.flatMap(({ rule }) => rule.obligations))].sort();
  return deepFreeze({
    contractVersion: RIGHTS_CONTRACT_VERSION,
    authorityClass: RIGHTS_DECISION_AUTHORITY_CLASS,
    rightsPolicyRef: policy.record.ref,
    subjectRef: subjectWorld.subject.ref,
    actor: normalizedActor,
    evaluatorPrincipal: evaluator,
    operation: op,
    purpose: p,
    jurisdiction: j,
    evaluatedAt: at,
    outcome: normalizeRightsOutcome(outcome),
    consideredGrantRefs: canonicalRightsRefs(grants.map((grant) => grant.record.ref)),
    grantRefs: canonicalRightsRefs(matched.map(({ grant }) => grant.record.ref)),
    revocationRefs: canonicalRightsRefs(effectiveRevocations),
    obligations: deepFreeze(obligations),
    reasonCodes: outcome === 'DENY' ? normalizeRightsReasonCodes([...reasons]) : deepFreeze([]),
    decisionTimeSemantics: RIGHTS_DECISION_TIME_SEMANTICS,
    decisionAuthorityClaim: RIGHTS_DECISION_AUTHORITY_CLAIM
  });
}

function rightsDecisionAuditInputs(payload) {
  return canonicalRightsRefs([
    payload.rightsPolicyRef,
    payload.subjectRef,
    ...payload.consideredGrantRefs,
    ...payload.revocationRefs
  ]);
}

export function publishRightsDecision({
  ledger,
  logicalId,
  version,
  rightsPolicyRef,
  subjectRef,
  actor,
  evaluatorPrincipal,
  operation,
  purpose,
  jurisdiction,
  evaluatedAt,
  audit
}) {
  requireLedger(ledger);
  const evaluator = normalizeRightsPrincipal(evaluatorPrincipal, 'evaluatorPrincipal');
  assertAuditPrincipal(audit, evaluator, 'RIGHTS_DECISION_AUDIT_ACTOR_MISMATCH');
  const auditAt = auditTime(audit);
  const at = normalizeRightsTimestamp(evaluatedAt, 'evaluatedAt');
  if (auditAt !== at) {
    throw new RightsAuthorityError('RIGHTS_DECISION_TIME_MISMATCH', 'RightsDecision audit.occurredAt must equal evaluatedAt');
  }
  const payload = buildRightsDecisionPayload({
    ledger,
    rightsPolicyRef,
    subjectRef,
    actor,
    evaluatorPrincipal: evaluator,
    operation,
    purpose,
    jurisdiction,
    evaluatedAt: at
  });
  const inputs = rightsDecisionAuditInputs(payload);
  return ledger.publish({
    kind: 'RightsDecision',
    logicalId: rightsText(logicalId, 'logicalId'),
    version: rightsText(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: `RIGHTS_${payload.operation}_${payload.outcome}`,
      inputRefs: [...inputs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        rightsOutcome: payload.outcome,
        rightsOperation: payload.operation,
        rightsDecisionAuthorityClaim: RIGHTS_DECISION_AUTHORITY_CLAIM
      }
    }
  });
}

export function validateRightsDecision({ ledger, rightsDecisionRef }) {
  requireLedger(ledger);
  const record = resolveKind(ledger, rightsDecisionRef, 'RightsDecision', 'RIGHTS_DECISION_REQUIRED');
  const stored = record.semanticPayload;
  if (stored?.contractVersion !== RIGHTS_CONTRACT_VERSION
    || stored?.authorityClass !== RIGHTS_DECISION_AUTHORITY_CLASS
    || stored?.decisionTimeSemantics !== RIGHTS_DECISION_TIME_SEMANTICS
    || stored?.decisionAuthorityClaim !== RIGHTS_DECISION_AUTHORITY_CLAIM) {
    throw new RightsAuthorityError('RIGHTS_DECISION_INVALID', 'RightsDecision contract/authority semantics are invalid');
  }
  normalizeRightsOutcome(stored.outcome);
  normalizeRightsReasonCodes(stored.reasonCodes ?? []);
  const expected = buildRightsDecisionPayload({
    ledger,
    rightsPolicyRef: stored.rightsPolicyRef,
    subjectRef: stored.subjectRef,
    actor: stored.actor,
    evaluatorPrincipal: stored.evaluatorPrincipal,
    operation: stored.operation,
    purpose: stored.purpose,
    jurisdiction: stored.jurisdiction,
    evaluatedAt: stored.evaluatedAt
  });
  if (semanticHash('RightsDecision', expected) !== record.ref.semanticHash) {
    throw new RightsAuthorityError('RIGHTS_DECISION_REPLAY_MISMATCH', 'exact rights authority world does not reproduce stored RightsDecision');
  }
  const inputs = rightsDecisionAuditInputs(stored);
  const evaluator = normalizeRightsPrincipal(stored.evaluatorPrincipal, 'RightsDecision.evaluatorPrincipal');
  const validAudit = directAuditFor(ledger, record).some((event) =>
    event.action === `RIGHTS_${stored.operation}_${stored.outcome}`
      && event.actor?.id === evaluator.principalId
      && event.actor?.type === evaluator.type
      && sameRefSet(event.inputRefs, inputs));
  if (!validAudit) throw new RightsAuthorityError('RIGHTS_DECISION_AUDIT_INVALID', 'RightsDecision lacks exact evaluator audit closure over rights authority inputs');
  return deepFreeze({ record, semanticPayload: stored, expected });
}

export function assertRightsAllowed({
  ledger,
  rightsDecisionRef,
  subjectRef,
  actor,
  operation,
  purpose,
  jurisdiction,
  requiredAt
}) {
  const validated = validateRightsDecision({ ledger, rightsDecisionRef });
  const payload = validated.semanticPayload;
  const subject = normalizeRightsSubjectRef(subjectRef);
  if (!sameAuthorityRef(payload.subjectRef, subject)) {
    throw new RightsAuthorityError('RIGHTS_DECISION_SUBJECT_MISMATCH', 'RightsDecision does not authorize the exact requested subject');
  }
  if (!sameRightsPrincipal(payload.actor, actor)) {
    throw new RightsAuthorityError('RIGHTS_DECISION_ACTOR_MISMATCH', 'RightsDecision does not authorize the exact requested actor');
  }
  if (payload.operation !== normalizeRightsOperation(operation)
    || payload.purpose !== rightsText(purpose, 'purpose')
    || payload.jurisdiction !== rightsText(jurisdiction, 'jurisdiction')) {
    throw new RightsAuthorityError('RIGHTS_DECISION_REQUEST_MISMATCH', 'RightsDecision operation/purpose/jurisdiction differs from requested use');
  }
  const at = normalizeRightsTimestamp(requiredAt, 'requiredAt');
  if (payload.evaluatedAt !== at) {
    throw new RightsAuthorityError('STALE_RIGHTS_DECISION_FOR_ACTION', 'point-in-time RightsDecision cannot authorize a different action time; evaluate current rights again');
  }
  if (payload.outcome !== 'ALLOW') {
    throw new RightsAuthorityError('RIGHTS_DENIED', `rights denied for ${payload.operation}: ${payload.reasonCodes.join(',') || 'DENY'}`);
  }
  return validated;
}
