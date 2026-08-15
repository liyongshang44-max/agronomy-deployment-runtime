import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from './source-faithful.mjs';
import {
  normalizeScientificUseTarget,
  qualificationResourceId
} from './qualification.mjs';

export class QualifiedAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QualifiedAuthorityError';
    this.code = code;
  }
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new QualifiedAuthorityError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function targetKey(target) {
  return semanticHash('ADR-ScientificUseTarget-v1', normalizeScientificUseTarget(target));
}

function canonicalEqual(left, right) {
  return semanticHash('ADR-K05-QUALIFIED-VALIDATION', left) === semanticHash('ADR-K05-QUALIFIED-VALIDATION', right);
}

function assertOwnershipEqual(left, right, code) {
  if (left?.organizationId !== right?.organizationId || (left?.tenantId ?? null) !== (right?.tenantId ?? null)) {
    throw new QualifiedAuthorityError(code, 'ownership authority differs across the qualified chain');
  }
}

function assertSourceFaithfulReview({ ledger, claim, sourceContext, source }) {
  if (claim.semanticPayload.authorityClass !== 'SOURCE_ASSERTION') {
    throw new QualifiedAuthorityError('CLAIM_AUTHORITY_INVALID', 'QualifiedKnowledge must resolve to SOURCE_ASSERTION Claim authority');
  }
  if (sourceContext.semanticPayload.authorityClass !== 'SOURCE_CONTEXT') {
    throw new QualifiedAuthorityError('SOURCE_CONTEXT_AUTHORITY_INVALID', 'QualifiedKnowledge must resolve to SOURCE_CONTEXT authority');
  }
  if (!sameAuthorityRef(sourceContext.semanticPayload.claimRef, claim.ref)) {
    throw new QualifiedAuthorityError('CLAIM_CONTEXT_MISMATCH', 'SourceContext does not bind exact Claim');
  }
  if (!sameAuthorityRef(claim.semanticPayload.sourceRef, source.ref)
    || !sameAuthorityRef(sourceContext.semanticPayload.sourceRef, source.ref)) {
    throw new QualifiedAuthorityError('SOURCE_CHAIN_MISMATCH', 'Claim/SourceContext do not bind exact Source');
  }

  const review = resolveKind(
    ledger,
    claim.semanticPayload.sourceFaithfulReviewRef,
    'SourceFaithfulReviewDecision',
    'SOURCE_FAITHFUL_REVIEW_REQUIRED'
  );
  if (review.semanticPayload.disposition !== 'ACCEPT_SOURCE_FAITHFUL') {
    throw new QualifiedAuthorityError('SOURCE_FAITHFUL_REVIEW_INVALID', 'source-faithful review is not accepted');
  }
  if (!sameAuthorityRef(sourceContext.semanticPayload.sourceFaithfulReviewRef, review.ref)
    || !sameAuthorityRef(review.semanticPayload.sourceRef, source.ref)) {
    throw new QualifiedAuthorityError('SOURCE_FAITHFUL_REVIEW_INVALID', 'source-faithful review does not close to exact Claim/SourceContext/Source');
  }

  const principal = review.semanticPayload.reviewPrincipal;
  const authAudit = resolveKind(
    ledger,
    review.semanticPayload.authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'SOURCE_REVIEW_AUTHORIZATION_REQUIRED'
  );
  const decision = authAudit.semanticPayload;
  if (decision.allowed !== true || decision.operation !== 'KNOWLEDGE_INSPECT' || !samePrincipalIdentity(decision.principal, principal)) {
    throw new QualifiedAuthorityError('SOURCE_REVIEW_AUTHORIZATION_INVALID', 'K03 review authorization is invalid');
  }
  const policy = resolveKind(ledger, decision.policyRef, 'KnowledgeGovernancePolicy', 'SOURCE_REVIEW_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new QualifiedAuthorityError('SOURCE_REVIEW_AUTHORIZATION_INVALID', 'K03 review policy is not bound to exact Source');
  }
  assertOwnershipEqual(policy.semanticPayload.ownership, source.semanticPayload.ownership, 'SOURCE_REVIEW_OWNERSHIP_MISMATCH');
  const assignments = (decision.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'SOURCE_REVIEW_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeInspection({
    principal,
    policy,
    roleAssignments: assignments,
    authorizationScope: decision.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== decision.decisionHash) {
    throw new QualifiedAuthorityError('SOURCE_REVIEW_AUTHORIZATION_INVALID', 'K03 review authorization cannot be reproduced');
  }
  const exactReviewerGrant = assignments.some((assignment) =>
    samePrincipalIdentity(assignment.semanticPayload.principal, principal)
      && assignment.semanticPayload.permissions.includes(PERMISSIONS.SOURCE_READ)
      && assignment.semanticPayload.permissions.includes(PERMISSIONS.KNOWLEDGE_INSPECT));
  if (!exactReviewerGrant) {
    throw new QualifiedAuthorityError('SOURCE_REVIEW_AUTHORIZATION_INVALID', 'K03 reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT');
  }
  return review;
}

function assertQualificationDecision({ ledger, decision, knowledge, claim, sourceContext, source }) {
  if (decision.semanticPayload.authorityClass !== 'SCIENTIFIC_QUALIFICATION_DECISION') {
    throw new QualifiedAuthorityError('QUALIFICATION_DECISION_INVALID', 'qualification decision authorityClass is invalid');
  }
  if (!sameAuthorityRef(decision.semanticPayload.claimRef, claim.ref)
    || !sameAuthorityRef(decision.semanticPayload.sourceContextRef, sourceContext.ref)
    || !sameAuthorityRef(decision.semanticPayload.sourceRef, source.ref)) {
    throw new QualifiedAuthorityError('QUALIFICATION_DECISION_INVALID', 'qualification decision does not bind exact Claim/SourceContext/Source');
  }
  const target = normalizeScientificUseTarget(decision.semanticPayload.qualificationTarget);
  if (!['QUALIFY_USE', 'PROHIBIT_USE'].includes(decision.semanticPayload.disposition)) {
    throw new QualifiedAuthorityError('QUALIFICATION_DECISION_INVALID', 'unsupported qualification disposition');
  }
  const principal = decision.semanticPayload.approverPrincipal;
  const authAudit = resolveKind(
    ledger,
    decision.semanticPayload.authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'QUALIFICATION_AUTHORIZATION_REQUIRED'
  );
  const stored = authAudit.semanticPayload;
  if (stored.allowed !== true || stored.operation !== 'KNOWLEDGE_QUALIFY' || !samePrincipalIdentity(stored.principal, principal)) {
    throw new QualifiedAuthorityError('QUALIFICATION_AUTHORIZATION_INVALID', 'qualification authorization is invalid');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'QUALIFICATION_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== qualificationResourceId(claim.ref, sourceContext.ref)) {
    throw new QualifiedAuthorityError('QUALIFICATION_AUTHORIZATION_INVALID', 'qualification policy resource does not bind exact Claim + SourceContext');
  }
  assertOwnershipEqual(policy.semanticPayload.ownership, source.semanticPayload.ownership, 'QUALIFICATION_OWNERSHIP_MISMATCH');
  if (!sameAuthorityRef(decision.semanticPayload.qualificationPolicyRef, policy.ref)) {
    throw new QualifiedAuthorityError('QUALIFICATION_AUTHORIZATION_INVALID', 'qualification decision policy ref differs from exact policy authority');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'QUALIFICATION_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeQualification({
    principal,
    policy,
    roleAssignments: assignments,
    qualificationTarget: target,
    authorizationScope: stored.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new QualifiedAuthorityError('QUALIFICATION_AUTHORIZATION_INVALID', 'qualification authorization cannot be reproduced');
  }

  const auditEvents = ledger.auditFor(decision.ref).filter((event) => sameAuthorityRef(event.objectRef, decision.ref));
  const directAuditValid = auditEvents.some((event) =>
    event.actor?.id === principal.principalId
      && event.actor?.type === principal.type
      && exactRefIn(event.inputRefs, claim.ref)
      && exactRefIn(event.inputRefs, sourceContext.ref)
      && exactRefIn(event.inputRefs, authAudit.ref)
      && exactRefIn(event.inputRefs, policy.ref));
  if (!directAuditValid) {
    throw new QualifiedAuthorityError('QUALIFICATION_DECISION_AUDIT_INVALID', 'qualification decision lacks direct exact approver audit');
  }

  if (!exactRefIn(knowledge.semanticPayload.qualificationDecisionRefs, decision.ref)) {
    throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_DECISION_SET_INVALID', 'qualification decision is not in exact QualifiedKnowledge decision set');
  }
  return { decision, target };
}

export function validateQualifiedKnowledgeAuthority({ ledger, qualifiedKnowledgeRef, requiredUseTarget = null, allowHistorical = false }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.exportSnapshot !== 'function'
    || typeof ledger.auditFor !== 'function' || typeof ledger.lineageFor !== 'function') {
    throw new QualifiedAuthorityError('INVALID_LEDGER', 'replayable AuthorityLedger is required');
  }
  const knowledge = resolveKind(ledger, qualifiedKnowledgeRef, 'QualifiedKnowledge', 'QUALIFIED_KNOWLEDGE_REQUIRED');
  if (knowledge.semanticPayload.authorityClass !== 'SCIENTIFIC_USE_AUTHORITY') {
    throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_INVALID', 'QualifiedKnowledge authorityClass is invalid');
  }
  const claim = resolveKind(ledger, knowledge.semanticPayload.claimRef, 'Claim', 'QUALIFIED_CLAIM_REQUIRED');
  const sourceContext = resolveKind(ledger, knowledge.semanticPayload.sourceContextRef, 'SourceContext', 'QUALIFIED_SOURCE_CONTEXT_REQUIRED');
  const source = resolveKind(ledger, knowledge.semanticPayload.sourceRef, 'Source', 'QUALIFIED_SOURCE_REQUIRED');
  const review = assertSourceFaithfulReview({ ledger, claim, sourceContext, source });
  assertOwnershipEqual(knowledge.semanticPayload.ownership, source.semanticPayload.ownership, 'QUALIFIED_OWNERSHIP_MISMATCH');

  const decisionRefs = knowledge.semanticPayload.qualificationDecisionRefs;
  if (!Array.isArray(decisionRefs) || decisionRefs.length === 0) {
    throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_DECISION_SET_INVALID', 'QualifiedKnowledge must bind qualification decisions');
  }
  const seen = new Map();
  const allowed = [];
  const forbidden = [];
  const decisions = decisionRefs.map((ref) => resolveKind(ledger, ref, 'ScientificQualificationDecision', 'QUALIFICATION_DECISION_REQUIRED'));
  for (const decision of decisions) {
    const validated = assertQualificationDecision({ ledger, decision, knowledge, claim, sourceContext, source });
    const key = targetKey(validated.target);
    if (seen.has(key)) throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_DECISION_SET_INVALID', 'duplicate scientific-use target in QualifiedKnowledge');
    seen.set(key, decision.ref);
    if (decision.semanticPayload.disposition === 'QUALIFY_USE') allowed.push(validated.target);
    else forbidden.push(validated.target);
  }
  allowed.sort((a, b) => targetKey(a).localeCompare(targetKey(b)));
  forbidden.sort((a, b) => targetKey(a).localeCompare(targetKey(b)));
  if (!canonicalEqual(knowledge.semanticPayload.allowedUses ?? [], allowed)
    || !canonicalEqual(knowledge.semanticPayload.forbiddenUses ?? [], forbidden)) {
    throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_SCOPE_INVALID', 'QualifiedKnowledge allowed/forbidden use summary differs from exact qualification decisions');
  }
  if (allowed.length === 0) throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_SCOPE_INVALID', 'QualifiedKnowledge has no qualified scientific use');

  if (!allowHistorical) {
    const superseding = ledger.lineageFor(knowledge.ref).filter((edge) => edge.relation === 'requalifies' && sameAuthorityRef(edge.to, knowledge.ref));
    if (superseding.length > 0) {
      throw new QualifiedAuthorityError('QUALIFIED_KNOWLEDGE_SUPERSEDED', 'historical QualifiedKnowledge is superseded by a newer scientific-use authority');
    }
  }

  let useStatus = null;
  if (requiredUseTarget) {
    const target = normalizeScientificUseTarget(requiredUseTarget);
    const key = targetKey(target);
    if (forbidden.some((item) => targetKey(item) === key)) useStatus = 'PROHIBITED';
    else if (!allowed.some((item) => targetKey(item) === key)) useStatus = 'UNQUALIFIED';
    else {
      const revoked = ledger.lineageFor(knowledge.ref).some((edge) => {
        if (edge.relation !== 'revokes' || !sameAuthorityRef(edge.to, knowledge.ref)) return false;
        const revocation = resolveKind(ledger, edge.from, 'ScientificQualificationRevocation', 'QUALIFICATION_REVOCATION_REQUIRED');
        return targetKey(revocation.semanticPayload.qualificationTarget) === key;
      });
      useStatus = revoked ? 'REVOKED' : 'QUALIFIED';
    }
    if (useStatus !== 'QUALIFIED') {
      throw new QualifiedAuthorityError('QUALIFIED_USE_NOT_ACTIVE', `required scientific use is ${useStatus}`);
    }
  }

  return deepFreeze({ knowledge, claim, sourceContext, source, review, decisions, useStatus });
}
