import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  validateConflictResolutionAuthority,
  validateKnowledgeConflictAuthority
} from '../../conflict-engine/src/authority.mjs';
import { KnowledgeReleaseError, exactRefKey, resolveKind, sameRefSet } from './core.mjs';
import { assertReleaseAuthorization, discoverRelevantConflicts, validateReleaseMember } from './member.mjs';
import { resolvePublicationAuthority, validateMemberEntitlementRevocation } from './publication.mjs';
import { KnowledgeReleaseService } from './service.mjs';

export function validateKnowledgeReleaseAuthority({ ledger, knowledgeReleaseRef, allowHistorical = false }) {
  const service = new KnowledgeReleaseService({ ledger });
  const release = resolveKind(ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
  const payload = release.semanticPayload;
  if (!payload || Object.keys(payload).length !== 1 || !Array.isArray(payload.memberRefs) || payload.memberRefs.length === 0) {
    throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_SEMANTICS_INVALID', 'KnowledgeRelease semantic payload must be exactly the frozen memberRefs set');
  }
  const keys = payload.memberRefs.map(exactRefKey);
  if (new Set(keys).size !== keys.length) throw new KnowledgeReleaseError('DUPLICATE_RELEASE_MEMBER', 'KnowledgeRelease contains duplicate exact member refs');
  const sorted = [...keys].sort();
  if (JSON.stringify(keys) !== JSON.stringify(sorted)) {
    throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_ORDER_INVALID', 'KnowledgeRelease memberRefs must be canonical exact-ref order');
  }
  const members = payload.memberRefs.map((ref) => validateReleaseMember({
    ledger,
    knowledgeRef: ref,
    allowHistorical
  }));

  const publication = resolvePublicationAuthority({ ledger, release });
  if (publication.semanticPayload.memberEntitlements.length !== members.length
    || !members.every((member) => publication.semanticPayload.memberEntitlements
      .some((item) => sameAuthorityRef(item.knowledgeRef, member.record.ref)))) {
    throw new KnowledgeReleaseError('RELEASE_PUBLICATION_MEMBER_SET_INVALID', 'publication entitlement set differs from exact KnowledgeRelease member set');
  }
  for (const item of publication.semanticPayload.memberEntitlements) {
    const member = members.find((candidate) => sameAuthorityRef(candidate.record.ref, item.knowledgeRef));
    assertReleaseAuthorization({
      ledger,
      knowledgeRef: member.record.ref,
      ownership: member.ownership,
      publisherPrincipal: publication.semanticPayload.publisherPrincipal,
      releaseTarget: publication.semanticPayload.releaseTarget,
      authorizationDecisionAuditRef: item.authorizationDecisionAuditRef,
      policyRef: item.policyRef
    });
  }

  for (const conflictRef of publication.semanticPayload.detectedConflictRefs ?? []) {
    validateKnowledgeConflictAuthority({
      ledger,
      knowledgeConflictRef: conflictRef,
      allowHistorical
    });
  }
  for (const resolutionRef of publication.semanticPayload.activeConflictResolutionRefs ?? []) {
    validateConflictResolutionAuthority({
      ledger,
      conflictResolutionRef: resolutionRef,
      allowHistorical
    });
  }

  const entitlementRevocations = ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'KnowledgeReleaseMemberEntitlementRevocation'
      && sameAuthorityRef(record.semanticPayload?.knowledgeReleaseRef, release.ref));
  for (const revocation of entitlementRevocations) {
    validateMemberEntitlementRevocation({ ledger, release, publication, revocation });
  }

  if (!allowHistorical) {
    if (entitlementRevocations.length > 0) {
      throw new KnowledgeReleaseError(
        'RELEASE_MEMBER_ENTITLEMENT_REVOKED',
        'one or more release member owner entitlements were revoked for future use'
      );
    }
    const currentConflictState = discoverRelevantConflicts({
      ledger,
      memberRefs: release.semanticPayload.memberRefs
    });
    if (!sameRefSet(currentConflictState.conflictRefs, publication.semanticPayload.detectedConflictRefs ?? [])
      || !sameRefSet(currentConflictState.activeResolutionRefs, publication.semanticPayload.activeConflictResolutionRefs ?? [])) {
      throw new KnowledgeReleaseError(
        'RELEASE_CONFLICT_GOVERNANCE_STALE',
        'current relevant conflict/resolution governance differs from the frozen publication world; create a new KnowledgeRelease before new use'
      );
    }
    const lifecycle = service.status({ knowledgeReleaseRef: release.ref });
    if (lifecycle.status === 'SUPERSEDED') throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_SUPERSEDED', 'KnowledgeRelease is superseded for new use');
    if (lifecycle.status === 'REVOKED') throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_REVOKED', 'KnowledgeRelease is revoked for new use');
  }

  return deepFreeze({
    release,
    publicationDecision: publication,
    members,
    lifecycle: service.status({ knowledgeReleaseRef: release.ref })
  });
}
