import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  KnowledgeReleaseError,
  LIFECYCLE_STATUS_SET,
  assertAuditActor,
  auditEvent,
  normalizeReleaseTarget,
  requiredText,
  resolveKind
} from './core.mjs';
import {
  assertEntitlementControlAuthorization,
  assertLifecycleAuthorization,
  originalController,
  resolvePublicationAuthority,
  validateLifecycleDecision
} from './publication.mjs';

export function recordKnowledgeReleaseLifecycleDecision({
  ledger,
  logicalId,
  version,
  knowledgeReleaseRef,
  status,
  reasonCodes,
  managerPrincipal,
  releaseTarget,
  authorizationDecisionAuditRef,
  policyRef,
  audit
}) {
  const release = resolveKind(ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
  assertAuditActor(audit, managerPrincipal, 'RELEASE_LIFECYCLE_AUDIT_INVALID', 'release lifecycle audit actor must be the exact manager');
  const normalizedStatus = requiredText(status, 'status');
  if (!LIFECYCLE_STATUS_SET.has(normalizedStatus)) {
    throw new KnowledgeReleaseError('INVALID_RELEASE_LIFECYCLE_STATUS', `unsupported lifecycle status ${normalizedStatus}`);
  }
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_REASON_REQUIRED', 'lifecycle decision requires at least one reason code');
  }
  const target = normalizeReleaseTarget(releaseTarget);
  const auth = assertLifecycleAuthorization({
    ledger: ledger,
    release,
    managerPrincipal,
    releaseTarget: target,
    authorizationDecisionAuditRef,
    policyRef
  });
  return ledger.publishBatchWithLineage({
    entries: [{
      kind: 'KnowledgeReleaseLifecycleDecision',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        knowledgeReleaseRef: release.ref,
        status: normalizedStatus,
        reasonCodes: deepFreeze([...new Set(reasonCodes.map((value) => requiredText(value, 'reasonCode')))].sort()),
        managerPrincipal: cloneCanonicalValue(managerPrincipal),
        releaseTarget: target,
        authorizationDecisionAuditRef: auth.authAudit.ref,
        policyRef: auth.policy.ref,
        authorityClass: 'KNOWLEDGE_RELEASE_LIFECYCLE_AUTHORITY'
      },
      audit: auditEvent(audit, 'release-lifecycle', [release.ref, auth.authAudit.ref, auth.policy.ref])
    }],
    lineages: []
  }).records[0];
}

export function revokeKnowledgeReleaseMemberEntitlement({
  ledger,
  logicalId,
  version,
  knowledgeReleaseRef,
  knowledgeRef,
  ownerPrincipal,
  controlAuthorizationDecisionAuditRef,
  reasonCodes,
  audit
}) {
  const release = resolveKind(ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
  const publication = resolvePublicationAuthority({ ledger: ledger, release });
  assertAuditActor(
    audit,
    ownerPrincipal,
    'RELEASE_MEMBER_ENTITLEMENT_REVOCATION_AUDIT_INVALID',
    'member entitlement revocation audit actor must be the exact owner controller'
  );
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_ENTITLEMENT_REVOCATION_REASON_REQUIRED', 'member entitlement revocation requires reason codes');
  }
  const entitlement = (publication.semanticPayload.memberEntitlements ?? [])
    .find((item) => sameAuthorityRef(item.knowledgeRef, knowledgeRef));
  if (!entitlement) {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_NOT_FOUND', 'knowledgeRef is not an exact member of the release publication');
  }
  const policy = resolveKind(ledger, entitlement.policyRef, 'KnowledgeGovernancePolicy', 'RELEASE_POLICY_REQUIRED');
  const controlAudit = assertEntitlementControlAuthorization({
    ledger: ledger,
    policy,
    ownerPrincipal,
    controlAuthorizationDecisionAuditRef
  });
  return ledger.publishBatchWithLineage({
    entries: [{
      kind: 'KnowledgeReleaseMemberEntitlementRevocation',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        knowledgeReleaseRef: release.ref,
        knowledgeRef: entitlement.knowledgeRef,
        originalAuthorizationDecisionAuditRef: entitlement.authorizationDecisionAuditRef,
        originalPolicyRef: entitlement.policyRef,
        ownerPrincipal: cloneCanonicalValue(ownerPrincipal),
        controlAuthorizationDecisionAuditRef: controlAudit.ref,
        reasonCodes: deepFreeze([...new Set(reasonCodes.map((value) => requiredText(value, 'reasonCode')))].sort()),
        authorityClass: 'KNOWLEDGE_RELEASE_MEMBER_ENTITLEMENT_REVOCATION'
      },
      audit: auditEvent(audit, 'release-member-entitlement-revocation', [
        release.ref,
        entitlement.knowledgeRef,
        entitlement.authorizationDecisionAuditRef,
        entitlement.policyRef,
        controlAudit.ref
      ])
    }],
    lineages: []
  }).records[0];
}

export function knowledgeReleaseStatus({ ledger, knowledgeReleaseRef }) {
  const release = resolveKind(ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');

  const superseding = ledger.lineageFor(release.ref)
    .filter((edge) => edge.relation === 'supersedes' && sameAuthorityRef(edge.to, release.ref));
  const validSupersedingRefs = [];
  for (const edge of superseding) {
    const successor = resolveKind(ledger, edge.from, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
    const successorPublication = resolvePublicationAuthority({ ledger: ledger, release: successor });
    const payload = successorPublication.semanticPayload;
    if (!sameAuthorityRef(payload.supersedesReleaseRef, release.ref)
      || !payload.supersessionAuthorizationDecisionAuditRef
      || !payload.supersessionPolicyRef) {
      throw new KnowledgeReleaseError('RELEASE_SUPERSESSION_AUTHORITY_INVALID', 'superseding lineage lacks exact predecessor-control publication authority');
    }
    const predecessorController = originalController({ ledger: ledger, release });
    assertLifecycleAuthorization({
      ledger: ledger,
      release,
      managerPrincipal: payload.publisherPrincipal,
      releaseTarget: predecessorController.releaseTarget,
      authorizationDecisionAuditRef: payload.supersessionAuthorizationDecisionAuditRef,
      policyRef: payload.supersessionPolicyRef
    });
    validSupersedingRefs.push(successor.ref);
  }
  if (validSupersedingRefs.length > 0) {
    return deepFreeze({ status: 'SUPERSEDED', supersedingReleaseRefs: validSupersedingRefs });
  }

  const decisions = ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'KnowledgeReleaseLifecycleDecision'
      && sameAuthorityRef(record.semanticPayload?.knowledgeReleaseRef, release.ref));
  for (const decision of decisions) validateLifecycleDecision({ ledger: ledger, release, decision });
  if (decisions.some((record) => record.semanticPayload.status === 'REVOKED')) return deepFreeze({ status: 'REVOKED' });
  if (decisions.some((record) => record.semanticPayload.status === 'DEPRECATED')) return deepFreeze({ status: 'DEPRECATED' });
  return deepFreeze({ status: 'PUBLISHED' });
}
