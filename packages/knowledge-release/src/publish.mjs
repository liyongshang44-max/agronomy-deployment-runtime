import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  KnowledgeReleaseError,
  assertAuditActor,
  auditEvent,
  exactRefKey,
  normalizeReleaseTarget,
  predictedRef,
  requiredText,
  resolveKind,
  samePublicationPayload
} from './core.mjs';
import { assertReleaseAuthorization, discoverRelevantConflicts, validateReleaseMember } from './member.mjs';
import { assertLifecycleAuthorization, findExactExistingRelease, originalController, resolvePublicationAuthority } from './publication.mjs';

export function publishKnowledgeRelease({
  ledger,
  logicalId,
  version,
  memberEntitlements,
  publisherPrincipal,
  releaseTarget,
  supersedesReleaseRef,
  supersessionAuthorizationDecisionAuditRef,
  supersessionPolicyRef,
  audit
}) {
  if (!Array.isArray(memberEntitlements) || memberEntitlements.length === 0) {
    throw new KnowledgeReleaseError('RELEASE_MEMBERS_REQUIRED', 'KnowledgeRelease requires at least one exact knowledge member');
  }
  assertAuditActor(audit, publisherPrincipal, 'RELEASE_PUBLICATION_AUDIT_INVALID', 'release publication audit actor must be the exact publisher');
  const target = normalizeReleaseTarget(releaseTarget);
  const unique = new Map();
  for (const entitlement of memberEntitlements) {
    const ref = entitlement?.knowledgeRef;
    if (!ref || typeof ref !== 'object') throw new KnowledgeReleaseError('RELEASE_MEMBER_REQUIRED', 'member entitlement requires knowledgeRef');
    const key = exactRefKey(ref);
    if (unique.has(key)) throw new KnowledgeReleaseError('DUPLICATE_RELEASE_MEMBER', 'KnowledgeRelease cannot duplicate an exact member');
    unique.set(key, entitlement);
  }

  // Resolve exact member records first, but defer authorization verification until after retry identity preflight.
  const memberRefs = deepFreeze([...unique.values()].map((entitlement) => {
    const record = ledger.resolve(entitlement.knowledgeRef);
    if (!['QualifiedKnowledge', 'DerivedKnowledge'].includes(record.ref.kind)) {
      throw new KnowledgeReleaseError('INVALID_RELEASE_MEMBER_KIND', `KnowledgeRelease members may only be QualifiedKnowledge or DerivedKnowledge, received ${record.ref.kind}`);
    }
    return record.ref;
  }).sort((a, b) => exactRefKey(a).localeCompare(exactRefKey(b))));
  const releasePayload = { memberRefs };
  const releaseRef = predictedRef('KnowledgeRelease', logicalId, version, releasePayload);
  const conflictState = discoverRelevantConflicts({ ledger: ledger, memberRefs });

  let supersededRelease;
  if (supersedesReleaseRef) {
    supersededRelease = resolveKind(ledger, supersedesReleaseRef, 'KnowledgeRelease', 'SUPERSEDED_RELEASE_REQUIRED');
    if (sameAuthorityRef(supersededRelease.ref, releaseRef)) {
      throw new KnowledgeReleaseError('RELEASE_CANNOT_SUPERSEDE_SELF', 'KnowledgeRelease cannot supersede itself');
    }
  }

  const rawEntitlements = deepFreeze([...unique.values()].map((entitlement) => ({
    knowledgeRef: ledger.resolve(entitlement.knowledgeRef).ref,
    authorizationDecisionAuditRef: entitlement.authorizationDecisionAuditRef,
    policyRef: entitlement.policyRef
  })).sort((a, b) => exactRefKey(a.knowledgeRef).localeCompare(exactRefKey(b.knowledgeRef))));

  const proposedPublicationPayload = {
    releaseRef,
    publisherPrincipal: cloneCanonicalValue(publisherPrincipal),
    releaseTarget: target,
    memberEntitlements: rawEntitlements,
    detectedConflictRefs: conflictState.conflictRefs,
    activeConflictResolutionRefs: conflictState.activeResolutionRefs,
    ...(supersededRelease ? {
      supersedesReleaseRef: supersededRelease.ref,
      ...(supersessionAuthorizationDecisionAuditRef ? { supersessionAuthorizationDecisionAuditRef } : {}),
      ...(supersessionPolicyRef ? { supersessionPolicyRef } : {})
    } : {}),
    authorityClass: 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
  };

  const existingRelease = findExactExistingRelease(ledger, releaseRef);
  if (existingRelease) {
    const existingPublication = resolvePublicationAuthority({ ledger: ledger, release: existingRelease });
    if (!samePublicationPayload(existingPublication.semanticPayload, proposedPublicationPayload)) {
      throw new KnowledgeReleaseError(
        'RELEASE_PUBLICATION_RETRY_MISMATCH',
        'same KnowledgeRelease identity is already bound to a different publication governance world'
      );
    }
    return deepFreeze({ release: existingRelease, publicationDecision: existingPublication, conflictState });
  }

  const validatedMembers = [...unique.values()].map((entitlement) => {
    const member = validateReleaseMember({ ledger: ledger, knowledgeRef: entitlement.knowledgeRef });
    const authorization = assertReleaseAuthorization({
      ledger: ledger,
      knowledgeRef: member.record.ref,
      ownership: member.ownership,
      publisherPrincipal,
      releaseTarget: target,
      authorizationDecisionAuditRef: entitlement.authorizationDecisionAuditRef,
      policyRef: entitlement.policyRef
    });
    return deepFreeze({ member, authorization });
  });

  let supersessionControl = null;
  if (supersededRelease) {
    if (!supersessionAuthorizationDecisionAuditRef || !supersessionPolicyRef) {
      throw new KnowledgeReleaseError(
        'RELEASE_SUPERSESSION_AUTHORIZATION_REQUIRED',
        'successor publication requires exact predecessor release-control authorization'
      );
    }
    const predecessorController = originalController({ ledger: ledger, release: supersededRelease });
    supersessionControl = assertLifecycleAuthorization({
      ledger: ledger,
      release: supersededRelease,
      managerPrincipal: publisherPrincipal,
      releaseTarget: predecessorController.releaseTarget,
      authorizationDecisionAuditRef: supersessionAuthorizationDecisionAuditRef,
      policyRef: supersessionPolicyRef
    });
  }

  const publicationPayload = {
    releaseRef,
    publisherPrincipal: cloneCanonicalValue(publisherPrincipal),
    releaseTarget: target,
    memberEntitlements: deepFreeze(validatedMembers.map(({ member, authorization }) => ({
      knowledgeRef: member.record.ref,
      authorizationDecisionAuditRef: authorization.authAudit.ref,
      policyRef: authorization.policy.ref
    })).sort((a, b) => exactRefKey(a.knowledgeRef).localeCompare(exactRefKey(b.knowledgeRef)))),
    detectedConflictRefs: conflictState.conflictRefs,
    activeConflictResolutionRefs: conflictState.activeResolutionRefs,
    ...(supersededRelease ? {
      supersedesReleaseRef: supersededRelease.ref,
      supersessionAuthorizationDecisionAuditRef: supersessionControl.authAudit.ref,
      supersessionPolicyRef: supersessionControl.policy.ref
    } : {}),
    authorityClass: 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
  };
  const publicationRef = predictedRef('KnowledgeReleasePublicationDecision', `${logicalId}.publication`, version, publicationPayload);

  const lineages = supersededRelease ? [{
    relation: 'supersedes',
    from: releaseRef,
    to: supersededRelease.ref,
    details: { authorityTransition: 'KNOWLEDGE_RELEASE_SUPERSESSION' },
    audit: auditEvent(audit, 'release-supersession', [
      publicationRef,
      supersessionControl.authAudit.ref,
      supersessionControl.policy.ref
    ])
  }] : [];

  const publication = ledger.publishBatchWithLineage({
    entries: [
      {
        kind: 'KnowledgeReleasePublicationDecision',
        logicalId: `${requiredText(logicalId, 'logicalId')}.publication`,
        version: requiredText(version, 'version'),
        semanticPayload: publicationPayload,
        audit: auditEvent(audit, 'release-publication-decision', [
          ...memberRefs,
          ...validatedMembers.flatMap(({ authorization }) => [authorization.authAudit.ref, authorization.policy.ref]),
          ...conflictState.conflictRefs,
          ...conflictState.activeResolutionRefs,
          ...(supersededRelease ? [
            supersededRelease.ref,
            supersessionControl.authAudit.ref,
            supersessionControl.policy.ref
          ] : [])
        ])
      },
      {
        kind: 'KnowledgeRelease',
        logicalId: requiredText(logicalId, 'logicalId'),
        version: requiredText(version, 'version'),
        semanticPayload: releasePayload,
        audit: auditEvent(audit, 'knowledge-release', [publicationRef, ...memberRefs])
      }
    ],
    lineages
  });
  const [publicationDecision, release] = publication.records;
  return deepFreeze({ release, publicationDecision, conflictState });
}
