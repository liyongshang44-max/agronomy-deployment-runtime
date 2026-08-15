import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { samePrincipalIdentity } from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import {
  validateConflictResolutionAuthority,
  validateKnowledgeConflictAuthority
} from '../../conflict-engine/src/authority.mjs';
import { authorizeKnowledgeRelease } from '../../knowledge-registry/src/release-authorization.mjs';

export const KNOWLEDGE_RELEASE_LIFECYCLE_STATUSES = deepFreeze(['DEPRECATED', 'REVOKED']);
const LIFECYCLE_STATUS_SET = new Set(KNOWLEDGE_RELEASE_LIFECYCLE_STATUSES);

export class KnowledgeReleaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KnowledgeReleaseError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeReleaseError('INVALID_RELEASE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new KnowledgeReleaseError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') throw new KnowledgeReleaseError('AUDIT_REQUIRED', 'explicit audit metadata is required');
  return {
    ...base,
    eventId: `${requiredText(base.eventId, 'audit.eventId')}:${suffix}`,
    inputRefs: [...inputRefs, ...(base.inputRefs ?? [])]
  };
}

function predictedRef(kind, logicalId, version, semanticPayload) {
  return makeAuthorityRef({
    kind,
    logicalId: requiredText(logicalId, `${kind}.logicalId`),
    version: requiredText(version, `${kind}.version`),
    semanticHash: semanticHash(kind, semanticPayload)
  });
}

function normalizeReleaseTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new KnowledgeReleaseError('INVALID_RELEASE_TARGET', 'releaseTarget must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(target.organizationId, 'releaseTarget.organizationId'),
    ...(target.tenantId ? { tenantId: requiredText(target.tenantId, 'releaseTarget.tenantId') } : {}),
    ...(target.programId ? { programId: requiredText(target.programId, 'releaseTarget.programId') } : {})
  });
}

function activeQualifiedUseTargets(ledger, knowledge) {
  const active = [];
  for (const target of knowledge.semanticPayload.allowedUses ?? []) {
    try {
      validateQualifiedKnowledgeAuthority({ ledger, qualifiedKnowledgeRef: knowledge.ref, requiredUseTarget: target });
      active.push(target);
    } catch (error) {
      if (error?.code === 'QUALIFIED_USE_NOT_ACTIVE') continue;
      throw error;
    }
  }
  return active;
}

function validateReleaseMember({ ledger, knowledgeRef }) {
  if (!knowledgeRef || typeof knowledgeRef !== 'object') {
    throw new KnowledgeReleaseError('RELEASE_MEMBER_REQUIRED', 'knowledgeRef is required');
  }
  if (knowledgeRef.kind === 'QualifiedKnowledge') {
    const validated = validateQualifiedKnowledgeAuthority({ ledger, qualifiedKnowledgeRef: knowledgeRef });
    const activeUses = activeQualifiedUseTargets(ledger, validated.knowledge);
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
    const validated = validateDerivedKnowledgeAuthority({ ledger, derivedKnowledgeRef: knowledgeRef });
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

function assertReleaseAuthorization({
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

function discoverRelevantConflicts({ ledger, memberRefs }) {
  const memberKeys = new Set(memberRefs.map(exactRefKey));
  const conflicts = [];
  const resolutionRefs = [];
  const snapshot = ledger.exportSnapshot();
  for (const record of snapshot.records) {
    if (record.ref.kind !== 'KnowledgeConflict') continue;
    const conflictMembers = record.semanticPayload?.memberBindings?.map((binding) => binding.knowledgeRef) ?? [];
    if (conflictMembers.length < 2 || !conflictMembers.every((ref) => memberKeys.has(exactRefKey(ref)))) continue;
    const validated = validateKnowledgeConflictAuthority({ ledger, knowledgeConflictRef: record.ref });
    conflicts.push(validated.conflict.ref);

    const resolutions = snapshot.records.filter((candidate) =>
      candidate.ref.kind === 'KnowledgeConflictResolutionDecision'
        && sameAuthorityRef(candidate.semanticPayload?.knowledgeConflictRef, record.ref));
    for (const resolution of resolutions) {
      validateConflictResolutionAuthority({ ledger, conflictResolutionRef: resolution.ref });
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

function assertLifecycleAuthorization({ ledger, release, managerPrincipal, releaseTarget, authorizationDecisionAuditRef, policyRef }) {
  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'RELEASE_LIFECYCLE_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_RELEASE' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, managerPrincipal)) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_AUTHORIZATION_DENIED', 'release lifecycle requires allowed KNOWLEDGE_RELEASE authorization');
  }
  const policy = resolveKind(ledger, policyRef ?? stored.policyRef, 'KnowledgeGovernancePolicy', 'RELEASE_LIFECYCLE_POLICY_REQUIRED');
  if (!sameAuthorityRef(policy.ref, stored.policyRef) || policy.semanticPayload.resourceId !== releaseControlResourceId(release.ref)) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_POLICY_MISMATCH', 'lifecycle policy does not bind exact KnowledgeRelease');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'RELEASE_LIFECYCLE_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeRelease({
    principal: managerPrincipal,
    policy,
    roleAssignments: assignments,
    releaseTarget
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_AUTHORIZATION_MISMATCH', 'release lifecycle authorization cannot be reproduced');
  }
  return { authAudit, policy };
}

export class KnowledgeReleaseService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publishBatchWithLineage !== 'function' || typeof ledger.resolve !== 'function'
      || typeof ledger.exportSnapshot !== 'function' || typeof ledger.auditFor !== 'function' || typeof ledger.lineageFor !== 'function') {
      throw new KnowledgeReleaseError('INVALID_LEDGER', 'KnowledgeReleaseService requires shared replayable AuthorityLedger');
    }
    this.#ledger = ledger;
  }

  publishRelease({
    logicalId,
    version,
    memberEntitlements,
    publisherPrincipal,
    releaseTarget,
    supersedesReleaseRef,
    audit
  }) {
    if (!Array.isArray(memberEntitlements) || memberEntitlements.length === 0) {
      throw new KnowledgeReleaseError('RELEASE_MEMBERS_REQUIRED', 'KnowledgeRelease requires at least one exact knowledge member');
    }
    const target = normalizeReleaseTarget(releaseTarget);
    const unique = new Map();
    for (const entitlement of memberEntitlements) {
      const ref = entitlement?.knowledgeRef;
      if (!ref || typeof ref !== 'object') throw new KnowledgeReleaseError('RELEASE_MEMBER_REQUIRED', 'member entitlement requires knowledgeRef');
      const key = exactRefKey(ref);
      if (unique.has(key)) throw new KnowledgeReleaseError('DUPLICATE_RELEASE_MEMBER', 'KnowledgeRelease cannot duplicate an exact member');
      unique.set(key, entitlement);
    }

    const validatedMembers = [...unique.values()].map((entitlement) => {
      const member = validateReleaseMember({ ledger: this.#ledger, knowledgeRef: entitlement.knowledgeRef });
      const authorization = assertReleaseAuthorization({
        ledger: this.#ledger,
        knowledgeRef: member.record.ref,
        ownership: member.ownership,
        publisherPrincipal,
        releaseTarget: target,
        authorizationDecisionAuditRef: entitlement.authorizationDecisionAuditRef,
        policyRef: entitlement.policyRef
      });
      return deepFreeze({ member, authorization });
    });

    const memberRefs = deepFreeze(validatedMembers.map(({ member }) => member.record.ref)
      .sort((a, b) => exactRefKey(a).localeCompare(exactRefKey(b))));
    const releasePayload = { memberRefs };
    const releaseRef = predictedRef('KnowledgeRelease', logicalId, version, releasePayload);

    const conflictState = discoverRelevantConflicts({ ledger: this.#ledger, memberRefs });
    let supersededRelease;
    if (supersedesReleaseRef) {
      supersededRelease = resolveKind(this.#ledger, supersedesReleaseRef, 'KnowledgeRelease', 'SUPERSEDED_RELEASE_REQUIRED');
      if (sameAuthorityRef(supersededRelease.ref, releaseRef)) {
        throw new KnowledgeReleaseError('RELEASE_CANNOT_SUPERSEDE_SELF', 'KnowledgeRelease cannot supersede itself');
      }
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
      ...(supersededRelease ? { supersedesReleaseRef: supersededRelease.ref } : {}),
      authorityClass: 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
    };
    const publicationRef = predictedRef('KnowledgeReleasePublicationDecision', `${logicalId}.publication`, version, publicationPayload);

    const lineages = supersededRelease ? [{
      relation: 'supersedes',
      from: releaseRef,
      to: supersededRelease.ref,
      details: { authorityTransition: 'KNOWLEDGE_RELEASE_SUPERSESSION' },
      audit: auditEvent(audit, 'release-supersession', [publicationRef])
    }] : [];

    const publication = this.#ledger.publishBatchWithLineage({
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
            ...(supersededRelease ? [supersededRelease.ref] : [])
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

  recordLifecycleDecision({
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
    const release = resolveKind(this.#ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
    const normalizedStatus = requiredText(status, 'status');
    if (!LIFECYCLE_STATUS_SET.has(normalizedStatus)) {
      throw new KnowledgeReleaseError('INVALID_RELEASE_LIFECYCLE_STATUS', `unsupported lifecycle status ${normalizedStatus}`);
    }
    if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
      throw new KnowledgeReleaseError('RELEASE_LIFECYCLE_REASON_REQUIRED', 'lifecycle decision requires at least one reason code');
    }
    const target = normalizeReleaseTarget(releaseTarget);
    const auth = assertLifecycleAuthorization({
      ledger: this.#ledger,
      release,
      managerPrincipal,
      releaseTarget: target,
      authorizationDecisionAuditRef,
      policyRef
    });
    return this.#ledger.publishBatchWithLineage({
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

  status({ knowledgeReleaseRef }) {
    const release = resolveKind(this.#ledger, knowledgeReleaseRef, 'KnowledgeRelease', 'KNOWLEDGE_RELEASE_REQUIRED');
    const superseding = this.#ledger.lineageFor(release.ref).filter((edge) => edge.relation === 'supersedes' && sameAuthorityRef(edge.to, release.ref));
    if (superseding.length > 0) return deepFreeze({ status: 'SUPERSEDED', supersedingReleaseRefs: superseding.map((edge) => edge.from) });
    const decisions = this.#ledger.exportSnapshot().records.filter((record) =>
      record.ref.kind === 'KnowledgeReleaseLifecycleDecision'
        && sameAuthorityRef(record.semanticPayload?.knowledgeReleaseRef, release.ref));
    if (decisions.some((record) => record.semanticPayload.status === 'REVOKED')) return deepFreeze({ status: 'REVOKED' });
    if (decisions.some((record) => record.semanticPayload.status === 'DEPRECATED')) return deepFreeze({ status: 'DEPRECATED' });
    return deepFreeze({ status: 'PUBLISHED' });
  }
}

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
  const members = payload.memberRefs.map((ref) => validateReleaseMember({ ledger, knowledgeRef: ref }));

  const directAudits = ledger.auditFor(release.ref).filter((event) => sameAuthorityRef(event.objectRef, release.ref));
  const publicationRefs = directAudits.flatMap((event) => event.inputRefs.filter((ref) => ref.kind === 'KnowledgeReleasePublicationDecision'));
  if (publicationRefs.length !== 1) {
    throw new KnowledgeReleaseError('RELEASE_PUBLICATION_AUTHORITY_REQUIRED', 'KnowledgeRelease must bind one exact publication authority');
  }
  const publication = resolveKind(ledger, publicationRefs[0], 'KnowledgeReleasePublicationDecision', 'RELEASE_PUBLICATION_AUTHORITY_REQUIRED');
  if (publication.semanticPayload.authorityClass !== 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
    || !sameAuthorityRef(publication.semanticPayload.releaseRef, release.ref)) {
    throw new KnowledgeReleaseError('RELEASE_PUBLICATION_AUTHORITY_INVALID', 'publication authority does not bind exact KnowledgeRelease');
  }
  if (publication.semanticPayload.memberEntitlements.length !== members.length
    || !members.every((member) => publication.semanticPayload.memberEntitlements.some((item) => sameAuthorityRef(item.knowledgeRef, member.record.ref)))) {
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
    validateKnowledgeConflictAuthority({ ledger, knowledgeConflictRef: conflictRef });
  }
  for (const resolutionRef of publication.semanticPayload.activeConflictResolutionRefs ?? []) {
    validateConflictResolutionAuthority({ ledger, conflictResolutionRef: resolutionRef });
  }

  if (!allowHistorical) {
    const currentConflictState = discoverRelevantConflicts({ ledger, memberRefs: release.semanticPayload.memberRefs });
    for (const conflictRef of currentConflictState.conflictRefs) {
      if (!exactRefIn(publication.semanticPayload.detectedConflictRefs, conflictRef)) {
        throw new KnowledgeReleaseError('RELEASE_CONFLICT_GOVERNANCE_STALE', 'new relevant KnowledgeConflict exists after release publication; create a new KnowledgeRelease before new use');
      }
    }
    const lifecycle = service.status({ knowledgeReleaseRef: release.ref });
    if (lifecycle.status === 'SUPERSEDED') throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_SUPERSEDED', 'KnowledgeRelease is superseded for new use');
    if (lifecycle.status === 'REVOKED') throw new KnowledgeReleaseError('KNOWLEDGE_RELEASE_REVOKED', 'KnowledgeRelease is revoked for new use');
  }

  return deepFreeze({ release, publicationDecision: publication, members, lifecycle: service.status({ knowledgeReleaseRef: release.ref }) });
}
