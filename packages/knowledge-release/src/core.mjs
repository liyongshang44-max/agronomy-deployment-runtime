import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';

export const KNOWLEDGE_RELEASE_LIFECYCLE_STATUSES = deepFreeze(['DEPRECATED', 'REVOKED']);
export const LIFECYCLE_STATUS_SET = new Set(KNOWLEDGE_RELEASE_LIFECYCLE_STATUSES);

export class KnowledgeReleaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KnowledgeReleaseError';
    this.code = code;
  }
}

export function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeReleaseError('INVALID_RELEASE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new KnowledgeReleaseError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

export function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

export function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

export function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

export function sameReleaseTarget(left, right) {
  return semanticHash('ADR-K06-RELEASE-TARGET', left) === semanticHash('ADR-K06-RELEASE-TARGET', right);
}

export function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = left.map(exactRefKey).sort();
  const b = right.map(exactRefKey).sort();
  return a.every((value, index) => value === b[index]);
}

export function samePublicationPayload(left, right) {
  return semanticHash('KnowledgeReleasePublicationDecision', left)
    === semanticHash('KnowledgeReleasePublicationDecision', right);
}

export function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') throw new KnowledgeReleaseError('AUDIT_REQUIRED', 'explicit audit metadata is required');
  return {
    ...base,
    eventId: `${requiredText(base.eventId, 'audit.eventId')}:${suffix}`,
    inputRefs: [...inputRefs, ...(base.inputRefs ?? [])]
  };
}

export function assertAuditActor(audit, principal, code, message) {
  if (!audit?.actor || audit.actor.id !== principal?.principalId || audit.actor.type !== principal?.type) {
    throw new KnowledgeReleaseError(code, message);
  }
}

export function predictedRef(kind, logicalId, version, semanticPayload) {
  return makeAuthorityRef({
    kind,
    logicalId: requiredText(logicalId, `${kind}.logicalId`),
    version: requiredText(version, `${kind}.version`),
    semanticHash: semanticHash(kind, semanticPayload)
  });
}

export function normalizeReleaseTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new KnowledgeReleaseError('INVALID_RELEASE_TARGET', 'releaseTarget must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(target.organizationId, 'releaseTarget.organizationId'),
    ...(target.tenantId ? { tenantId: requiredText(target.tenantId, 'releaseTarget.tenantId') } : {}),
    ...(target.programId ? { programId: requiredText(target.programId, 'releaseTarget.programId') } : {})
  });
}

