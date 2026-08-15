import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { samePrincipalIdentity } from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { validateConflictResolutionAuthority, validateKnowledgeConflictAuthority } from '../../conflict-engine/src/authority.mjs';
import { authorizeKnowledgeRelease } from '../../knowledge-registry/src/release-authorization.mjs';
import { KnowledgeReleaseError, exactRefKey, resolveKind, sameOwnership } from './core.mjs';

export function activeQualifiedUseTargets(ledger, knowledge, allowHistorical = false) {
  const active = [];
  for (const target of knowledge.semanticPayload.allowedUses ?? []) {
    try {
      validateQualifiedKnowledgeAuthority({
        ledger,
        qualifiedKnowledgeRef: knowledge.ref,
        requiredUseTarget: target,
        allowHistorical
      });
      active.push(target);
    } catch (error) {
      if (!allowHistorical && error?.code === 'QUALIFIED_USE_NOT_ACTIVE') continue;
      throw error;
    }
  }
  return active;
}

export function validateReleaseMember({ ledger, knowledgeRef, allowHistorical = false }) {
  if (!knowledgeRef || typeof knowledgeRef !== 'object') {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_REQUIRED', 'knowledgeRef is required');
  }
  if (knowledgeRef.kind === 'QualifiedKnowledge') {
    const validated = validateQualifiedKnowledgeAuthority({
      ledger,
      qualifiedKnowledgeRef: knowledgeRef,
      allowHistorical
    });
    const activeUses = activeQualifiedUseTargets(ledger, validated.knowledge, allowHistorical);
    if (activeUses.length === 0) {
      throw new KnowledgeReleaseError('RELEASE_MEMBER_HAS_NO_ACTIVE_USE', 'QualifiedKnowledge has no active scientific-use authority');
    }
    return deepFreeze({
      kind: 'QualifiedKnowledge',
      record: validated.knowledge,
      ownership: validated.knowledge.semanticPayload.ownership,
      activeUseTargets: activeUses
    });
  }
  if (knowledgeRef.kind === 'DerivedKnowledge') {
    const validated = validateDerivedKnowledgeAuthority({
      ledger,
      derivedKnowledgeRef: knowledgeRef,
      allowHistorical
    });
    return deepFreeze({
      kind: 'DerivedKnowledge',
      record: validated.knowledge,
      ownership: validated.knowledge.semanticPayload.ownership,
      activeUseTargets: [validated.useTarget]
    });
  }
  throw new KnowledgeReleaseError(
    'INVALID_RELEASE_MEMBER_KIND',
    `KnowledgeRelease members may only be QualifiedKnowledge or DerivedKnowledge, received ${knowledgeRef.kind}`
  );
}

export function releaseMemberResourceId(knowledgeRef) {
  return `knowledge-release-member:${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version}#${knowledgeRef.semanticHash}`;
}

export function releaseControlResourceId(releaseRef) {
  return `knowledge-release-control:${releaseRef.kind}/${releaseRef.logicalId}@${releaseRef.version}#${releaseRef.semanticHash}`;
}

export function assertReleaseAuthorization({
  ledger,
  knowledgeRef,
  ownership,
  publisherPrincipal,
  releaseTarget,
  authorizationDecisionAuditRef,
  policyRef
}) {
  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'RELEASE_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_RELEASE' || stored.allowed !== true) {
    throw new KnowledgeReleaseError('RELEASE_AUTHORIZATION_DENIED', 'KnowledgeRelease member requires allowed KNOWLEDGE_RELEASE authorization');
  }
  if (!samePrincipalIdentity(stored.principal, publisherPrincipal)) {
    throw new KnowledgeReleaseError('RELEASE_AUTHORIZATION_PRINCIPAL_MISMATCH', 'release authorization principal differs from publisher');
  }
  const policy = resolveKind(ledger, policyRef ?? stored.policyRef, 'KnowledgeGovernancePolicy', 'RELEASE_POLICY_REQUIRED');
  if (!sameAuthorityRef(policy.ref, stored.policyRef)) {
    throw new KnowledgeReleaseError('RELEASE_POLICY_MISMATCH', 'member policy ref differs from exact authorization decision');
  }
  if (policy.semanticPayload.resourceId !== releaseMemberResourceId(knowledgeRef)) {
    throw new KnowledgeReleaseError('RELEASE_POLICY_RESOURCE_MISMATCH', 'release policy does not bind exact knowledge member');
  }
  if (!sameOwnership(policy.semanticPayload.ownership, ownership)) {
    throw new KnowledgeReleaseError('RELEASE_POLICY_OWNERSHIP_MISMATCH', 'release policy ownership differs from exact knowledge member owner');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'RELEASE_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeKnowledgeRelease({
    principal: publisherPrincipal,
    policy,
    roleAssignments: assignments,
    releaseTarget
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new KnowledgeReleaseError('RELEASE_AUTHORIZATION_MISMATCH', 'stored release authorization cannot be reproduced from exact policy/role/target');
  }
  return deepFreeze({ authAudit, policy });
}

export function discoverRelevantConflicts({ ledger, memberRefs, allowHistorical = false }) {
  const memberKeys = new Set(memberRefs.map(exactRefKey));
  const conflicts = [];
  const resolutionRefs = [];
  const snapshot = ledger.exportSnapshot();
  for (const record of snapshot.records) {
    if (record.ref.kind !== 'KnowledgeConflict') continue;
    const conflictMembers = record.semanticPayload?.memberBindings?.map((binding) => binding.knowledgeRef) ?? [];
    if (conflictMembers.length < 2 || !conflictMembers.some((ref) => memberKeys.has(exactRefKey(ref)))) continue;
    const validated = validateKnowledgeConflictAuthority({
      ledger,
      knowledgeConflictRef: record.ref,
      allowHistorical
    });
    conflicts.push(validated.conflict.ref);

    const resolutions = snapshot.records.filter((candidate) =>
      candidate.ref.kind === 'KnowledgeConflictResolutionDecision'
        && sameAuthorityRef(candidate.semanticPayload?.knowledgeConflictRef, record.ref));
    for (const resolution of resolutions) {
      validateConflictResolutionAuthority({
        ledger,
        conflictResolutionRef: resolution.ref,
        allowHistorical
      });
    }
    const superseded = new Set(
      resolutions
        .map((resolution) => resolution.semanticPayload.supersedesResolutionRef)
        .filter(Boolean)
        .map(exactRefKey)
    );
    for (const resolution of resolutions) {
      if (!superseded.has(exactRefKey(resolution.ref))) resolutionRefs.push(resolution.ref);
    }
  }
  conflicts.sort((a, b) => exactRefKey(a).localeCompare(exactRefKey(b)));
  resolutionRefs.sort((a, b) => exactRefKey(a).localeCompare(exactRefKey(b)));
  return deepFreeze({ conflictRefs: conflicts, activeResolutionRefs: resolutionRefs });
}

