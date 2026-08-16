import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE = 'IMPLEMENTATION_CONFORMANCE';
export const IMPLEMENTATION_CONFORMANCE_CONTROL_ACTIONS = deepFreeze(['REVOKE', 'SUPERSEDE']);
const CONTROL_ACTIONS = new Set(IMPLEMENTATION_CONFORMANCE_CONTROL_ACTIONS);

export class ImplementationConformanceAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImplementationConformanceAuthorizationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ImplementationConformanceAuthorizationError('INVALID_CONFORMANCE_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
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

function authorize({ principal, roleAssignments, authorizationScope, operation }) {
  const normalizedPrincipal = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new ImplementationConformanceAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  if (authorizationScope?.resourceType !== IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE) {
    throw new ImplementationConformanceAuthorizationError(
      'INVALID_CONFORMANCE_RESOURCE_TYPE',
      `conformance authority requires resourceType ${IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE}`
    );
  }
  const targetScope = deepFreeze({
    organizationId: text(authorizationScope?.organizationId, 'authorizationScope.organizationId'),
    ...(authorizationScope?.tenantId
      ? { tenantId: text(authorizationScope.tenantId, 'authorizationScope.tenantId') }
      : {}),
    resourceType: IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE,
    resourceId: text(authorizationScope?.resourceId, 'authorizationScope.resourceId')
  });

  const assignments = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new ImplementationConformanceAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(payload.permissions)
      || !payload.permissions.includes(PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    assignments.push(candidate);
  }

  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('CONFORMANCE_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('CONFORMANCE_QUALIFICATION_PERMISSION_DENIED');
  const payload = {
    operation,
    principal: normalizedPrincipal,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue({ authorizationScope: targetScope }),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}

export function authorizeImplementationConformanceQualification(args) {
  return authorize({ ...args, operation: 'IMPLEMENTATION_CONFORMANCE_QUALIFY' });
}

export function authorizeImplementationConformanceControl({ action, ...args }) {
  const normalizedAction = text(action, 'action');
  if (!CONTROL_ACTIONS.has(normalizedAction)) {
    throw new ImplementationConformanceAuthorizationError(
      'INVALID_CONFORMANCE_CONTROL_ACTION',
      `unsupported conformance control action ${normalizedAction}`
    );
  }
  return authorize({ ...args, operation: `IMPLEMENTATION_CONFORMANCE_${normalizedAction}` });
}
