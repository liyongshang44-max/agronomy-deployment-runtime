import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const IMPLEMENTATION_RESOURCE_TYPE = 'IMPLEMENTATION';

export class ImplementationAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImplementationAuthorizationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ImplementationAuthorizationError('INVALID_IMPLEMENTATION_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
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

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sortedRefs(records) {
  const map = new Map();
  for (const record of records) map.set(refKey(record.ref), record.ref);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

export function authorizeImplementationManage({ principal, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new ImplementationAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const targetScope = deepFreeze({
    organizationId: text(authorizationScope?.organizationId, 'authorizationScope.organizationId'),
    ...(authorizationScope?.tenantId
      ? { tenantId: text(authorizationScope.tenantId, 'authorizationScope.tenantId') }
      : {}),
    resourceType: IMPLEMENTATION_RESOURCE_TYPE,
    resourceId: text(authorizationScope?.resourceId, 'authorizationScope.resourceId')
  });
  if (authorizationScope?.resourceType !== IMPLEMENTATION_RESOURCE_TYPE) {
    throw new ImplementationAuthorizationError(
      'INVALID_IMPLEMENTATION_RESOURCE_TYPE',
      `implementation management requires resourceType ${IMPLEMENTATION_RESOURCE_TYPE}`
    );
  }

  const assignments = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new ImplementationAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(PERMISSIONS.IMPLEMENTATION_MANAGE)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    assignments.push(candidate);
  }

  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('IMPLEMENTATION_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('IMPLEMENTATION_MANAGE_PERMISSION_DENIED');
  const payload = {
    operation: 'IMPLEMENTATION_MANAGE',
    principal: normalizedPrincipal,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue({ authorizationScope: targetScope }),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}
