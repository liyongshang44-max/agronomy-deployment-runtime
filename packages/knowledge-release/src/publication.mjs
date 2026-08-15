import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { samePrincipalIdentity } from '../../authorization/src/index.mjs';
import { authorizeKnowledgeRelease, authorizeKnowledgeReleaseEntitlementControl } from '../../knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeReleaseError,
  LIFECYCLE_STATUS_SET,
  exactRefKey,
  exactRefIn,
  normalizeReleaseTarget,
  resolveKind,
  sameOwnership,
  sameReleaseTarget
} from './core.mjs';
import { releaseControlResourceId } from './member.mjs';

export function publicationAuditInputs(publication) {
  const payload = publication.semanticPayload;
  return [
    ...(payload.memberEntitlements ?? []).flatMap((item) => [
      item.knowledgeRef,
      item.authorizationDecisionAuditRef,
      item.policyRef
    ]),
    ...(payload.detectedConflictRefs ?? []),
    ...(payload.activeConflictResolutionRefs ?? []),
    ...(payload.supersedesReleaseRef ? [payload.supersedesReleaseRef] : []),
    ...(payload.supersessionAuthorizationDecisionAuditRef ? [payload.supersessionAuthorizationDecisionAuditRef] : []),
    ...(payload.supersessionPolicyRef ? [payload.supersessionPolicyRef] : [])
  ];
}

export function resolvePublicationAuthority({ ledger, release }) {
  const directAudits = ledger.auditFor(release.ref).filter((event) => sameAuthorityRef(event.objectRef, release.ref));
  const publicationRefs = directAudits.flatMap((event) =>
    event.inputRefs.filter((ref) => ref.kind === 'KnowledgeReleasePublicationDecision'));
  const uniquePublicationRefs = [...new Map(publicationRefs.map((ref) => [exactRefKey(ref), ref])).values()];
  if (uniquePublicationRefs.length !== 1) {
    throw new KnowledgeReleaseError('RELEASE_PUBLICATION_AUTHORITY_REQUIRED', 'KnowledgeRelease must bind one exact publication authority');
  }
  const publication = resolveKind(
    ledger,
    uniquePublicationRefs[0],
    'KnowledgeReleasePublicationDecision',
    'RELEASE_PUBLICATION_AUTHORITY_REQUIRED'
  );
  const payload = publication.semanticPayload;
  if (payload.authorityClass !== 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
    || !sameAuthorityRef(payload.releaseRef, release.ref)) {
    throw new KnowledgeReleaseError('RELEASE_PUBLICATION_AUTHORITY_INVALID', 'publication authority does not bind exact KnowledgeRelease');
  }

  const publisher = payload.publisherPrincipal;
  const directPublicationAudits = ledger.auditFor(publication.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, publication.ref));
  const expectedInputs = publicationAuditInputs(publication);
  const validAudit = directPublicationAudits.some((event) =>
    event.actor?.id === publisher?.principalId
      && event.actor?.type === publisher?.type
      && expectedInputs.every((ref) => exactRefIn(event.inputRefs, ref)));
  if (!validAudit) {
    throw new KnowledgeReleaseError(
      'RELEASE_PUBLICATION_AUDIT_INVALID',
      'publication authority lacks direct exact publisher audit over its authority inputs'
    );
  }
  return publication;
}

export function originalController({ ledger, release }) {
  const publication = resolvePublicationAuthority({ ledger, release });
  return {
    publication,
    publisherPrincipal: publication.semanticPayload.publisherPrincipal,
    releaseTarget: publication.semanticPayload.releaseTarget
  };
}

export function assertLifecycleAuthorization({
  ledger,
  release,
  managerPrincipal,
  releaseTarget,
  authorizationDecisionAuditRef,
  policyRef
}) {
  const controller = originalController({ ledger, release });
  const target = normalizeReleaseTarget(releaseTarget);
  if (!sameOwnership(controller.publisherPrincipal, managerPrincipal)
    || !sameReleaseTarget(controller.releaseTarget, target)) {
    throw new KnowledgeReleaseError(
      'RELEASE_CONTROLLER_SCOPE_MISMATCH',
      'release lifecycle/supersession controller must remain in the original publisher organization/tenant and original target'
    );
  }

  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'RELEASE_LIFECYCLE_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_RELEASE' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, managerPrincipal)) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_AUTHORIZATION_DENIED', 'release lifecycle requires allowed KNOWLEDGE_RELEASE authorization');
  }
  const policy = resolveKind(ledger, policyRef ?? stored.policyRef, 'KnowledgeGovernancePolicy', 'RELEASE_LIFECYCLE_POLICY_REQUIRED');
  if (!sameAuthorityRef(policy.ref, stored.policyRef) || policy.semanticPayload.resourceId !== releaseControlResourceId(release.ref)) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_POLICY_MISMATCH', 'lifecycle policy does not bind exact KnowledgeRelease');
  }
  if (!sameOwnership(policy.semanticPayload.ownership, controller.publisherPrincipal)) {
    throw new KnowledgeReleaseError('RELEASE_CONTROLLER_SCOPE_MISMATCH', 'release-control policy ownership differs from original publisher controller');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'RELEASE_LIFECYCLE_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeRelease({
    principal: managerPrincipal,
    policy,
    roleAssignments: assignments,
    releaseTarget: target
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_AUTHORIZATION_MISMATCH', 'release lifecycle authorization cannot be reproduced');
  }
  return { authAudit, policy, controller };
}

export function validateLifecycleDecision({ ledger, release, decision }) {
  const payload = decision.semanticPayload;
  if (payload?.authorityClass !== 'KNOWLEDGE_RELEASE_LIFECYCLE_AUTHORITY'
    || !sameAuthorityRef(payload.knowledgeReleaseRef, release.ref)
    || !LIFECYCLE_STATUS_SET.has(payload.status)) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_INVALID', 'release lifecycle decision semantics are invalid');
  }
  const auth = assertLifecycleAuthorization({
    ledger,
    release,
    managerPrincipal: payload.managerPrincipal,
    releaseTarget: payload.releaseTarget,
    authorizationDecisionAuditRef: payload.authorizationDecisionAuditRef,
    policyRef: payload.policyRef
  });
  const directAudits = ledger.auditFor(decision.ref).filter((event) => sameAuthorityRef(event.objectRef, decision.ref));
  const validAudit = directAudits.some((event) =>
    event.actor?.id === payload.managerPrincipal?.principalId
      && event.actor?.type === payload.managerPrincipal?.type
      && exactRefIn(event.inputRefs, release.ref)
      && exactRefIn(event.inputRefs, auth.authAudit.ref)
      && exactRefIn(event.inputRefs, auth.policy.ref));
  if (!validAudit) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_AUDIT_INVALID', 'release lifecycle decision lacks direct manager audit');
  }
  return decision;
}

export function assertEntitlementControlAuthorization({
  ledger,
  policy,
  ownerPrincipal,
  controlAuthorizationDecisionAuditRef
}) {
  const authAudit = resolveKind(
    ledger,
    controlAuthorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'RELEASE_ENTITLEMENT_CONTROL_AUTHORIZATION_REQUIRED'
  );
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_RELEASE_ENTITLEMENT_CONTROL'
    || stored.allowed !== true
    || !samePrincipalIdentity(stored.principal, ownerPrincipal)) {
    throw new KnowledgeReleaseError(
      'RELEASE_ENTITLEMENT_CONTROL_AUTHORIZATION_DENIED',
      'member entitlement control requires allowed owner-side authorization'
    );
  }
  if (!sameAuthorityRef(stored.policyRef, policy.ref)) {
    throw new KnowledgeReleaseError('RELEASE_ENTITLEMENT_CONTROL_POLICY_MISMATCH', 'entitlement control authorization does not bind original member policy');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'RELEASE_ENTITLEMENT_CONTROL_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeReleaseEntitlementControl({
    principal: ownerPrincipal,
    policy,
    roleAssignments: assignments
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new KnowledgeReleaseError(
      'RELEASE_ENTITLEMENT_CONTROL_AUTHORIZATION_MISMATCH',
      'owner-side entitlement control authorization cannot be reproduced'
    );
  }
  return authAudit;
}

export function validateMemberEntitlementRevocation({ ledger, release, publication, revocation }) {
  const payload = revocation.semanticPayload;
  if (payload?.authorityClass !== 'KNOWLEDGE_RELEASE_MEMBER_ENTITLEMENT_REVOCATION'
    || !sameAuthorityRef(payload.knowledgeReleaseRef, release.ref)) {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_ENTITLEMENT_REVOCATION_INVALID', 'member entitlement revocation does not bind exact release');
  }
  const entitlement = (publication.semanticPayload.memberEntitlements ?? [])
    .find((item) => sameAuthorityRef(item.knowledgeRef, payload.knowledgeRef));
  if (!entitlement
    || !sameAuthorityRef(entitlement.policyRef, payload.originalPolicyRef)
    || !sameAuthorityRef(entitlement.authorizationDecisionAuditRef, payload.originalAuthorizationDecisionAuditRef)) {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_ENTITLEMENT_REVOCATION_INVALID', 'revocation does not bind exact original member entitlement');
  }
  const policy = resolveKind(ledger, entitlement.policyRef, 'KnowledgeGovernancePolicy', 'RELEASE_POLICY_REQUIRED');
  const controlAudit = assertEntitlementControlAuthorization({
    ledger,
    policy,
    ownerPrincipal: payload.ownerPrincipal,
    controlAuthorizationDecisionAuditRef: payload.controlAuthorizationDecisionAuditRef
  });
  const directAudits = ledger.auditFor(revocation.ref).filter((event) => sameAuthorityRef(event.objectRef, revocation.ref));
  const validAudit = directAudits.some((event) =>
    event.actor?.id === payload.ownerPrincipal?.principalId
      && event.actor?.type === payload.ownerPrincipal?.type
      && exactRefIn(event.inputRefs, release.ref)
      && exactRefIn(event.inputRefs, payload.knowledgeRef)
      && exactRefIn(event.inputRefs, entitlement.policyRef)
      && exactRefIn(event.inputRefs, entitlement.authorizationDecisionAuditRef)
      && exactRefIn(event.inputRefs, controlAudit.ref));
  if (!validAudit) {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_ENTITLEMENT_REVOCATION_AUDIT_INVALID', 'entitlement revocation lacks direct owner audit');
  }
  return revocation;
}

export function findExactExistingRelease(ledger, releaseRef) {
  try {
    return ledger.resolve(releaseRef);
  } catch (error) {
    if (error?.code === 'AUTHORITY_NOT_FOUND' || error?.code === 'AUTHORITY_HASH_MISMATCH') return null;
    throw error;
  }
}

