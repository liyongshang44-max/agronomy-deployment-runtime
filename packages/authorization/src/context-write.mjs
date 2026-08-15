import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const CONTEXT_WRITE_RESOURCE_TYPES = deepFreeze([
  'CONTEXT_DATUM',
  'AUTHORIZED_CONTEXT_REFERENCE',
  'RESOLVED_CONTEXT_DATUM_RECEIPT',
  'CONTEXT_MANIFEST'
]);

const CONTEXT_WRITE_RESOURCE_TYPE_SET = new Set(CONTEXT_WRITE_RESOURCE_TYPES);

export class ContextWriteAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextWriteAuthorizationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContextWriteAuthorizationError('INVALID_CONTEXT_WRITE_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeResourceType(value) {
  const resourceType = requiredText(value, 'authorizationScope.resourceType');
  if (!CONTEXT_WRITE_RESOURCE_TYPE_SET.has(resourceType)) {
    throw new ContextWriteAuthorizationError(
      'INVALID_CONTEXT_WRITE_RESOURCE_TYPE',
      `unsupported context.write resourceType ${resourceType}`
    );
  }
  return resourceType;
}

function sameIdentity(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function scopeContains(grantScope, targetScope) {
  if (grantScope?.platform === true) return true;
  for (const [key, expected] of Object.entries(grantScope ?? {})) {
    if (targetScope[key] !== expected) return false;
  }
  return true;
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sortedRefs(records) {
  const unique = new Map();
  for (const record of records) unique.set(exactRefKey(record.ref), record.ref);
  return [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

export function authorizeContextWrite({ principal, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new ContextWriteAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const targetScope = deepFreeze({
    organizationId: requiredText(authorizationScope?.organizationId, 'authorizationScope.organizationId'),
    ...(authorizationScope?.tenantId ? { tenantId: requiredText(authorizationScope.tenantId, 'authorizationScope.tenantId') } : {}),
    resourceType: normalizeResourceType(authorizationScope?.resourceType),
    resourceId: requiredText(authorizationScope?.resourceId, 'authorizationScope.resourceId')
  });

  const assignments = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new ContextWriteAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(PERMISSIONS.CONTEXT_WRITE)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    assignments.push(candidate);
  }

  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('CONTEXT_WRITE_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('CONTEXT_WRITE_PERMISSION_DENIED');

  const payload = {
    operation: 'CONTEXT_WRITE',
    principal: normalizedPrincipal,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue({ authorizationScope: targetScope }),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}
