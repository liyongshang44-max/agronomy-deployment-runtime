import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const SECURITY_RESOURCE_TYPES = deepFreeze({
  SECRET: 'SECRET',
  RETENTION: 'RETENTION_POLICY',
  AUDIT_EXPORT: 'AUDIT_EXPORT'
});

export class SecurityOperationsAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecurityOperationsAuthorizationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SecurityOperationsAuthorizationError('INVALID_SECURITY_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactRefKey(ref) {
  const normalized = assertAuthorityRef(ref);
  return JSON.stringify([normalized.kind, normalized.logicalId, normalized.version, normalized.semanticHash]);
}

function canonicalRefs(refs, name) {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new SecurityOperationsAuthorizationError('INVALID_SECURITY_AUTHORIZATION_INPUT', `${name} must be a non-empty array`);
  }
  const keyed = new Map();
  for (const ref of refs) {
    const normalized = assertAuthorityRef(ref);
    keyed.set(exactRefKey(normalized), normalized);
  }
  return deepFreeze([...keyed.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
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

function sortedAssignmentRefs(records) {
  const unique = new Map();
  for (const record of records) unique.set(exactRefKey(record.ref), record.ref);
  return deepFreeze([...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

function matchingAssignments({ principal, roleAssignments, permission, targetScope }) {
  if (!Array.isArray(roleAssignments)) {
    throw new SecurityOperationsAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const normalizedPrincipal = createPrincipal(principal);
  const matches = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new SecurityOperationsAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected exact published RoleAssignment record');
    }
    if (!sameIdentity(candidate.semanticPayload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(candidate.semanticPayload.permissions)
      || !candidate.semanticPayload.permissions.includes(permission)) continue;
    if (!scopeContains(candidate.semanticPayload.scope, targetScope)) continue;
    matches.push(candidate);
  }
  return matches;
}

function buildDecision({ operation, principal, assignments, request, allowed, reasons }) {
  const payload = {
    operation,
    principal: createPrincipal(principal),
    assignmentRefs: sortedAssignmentRefs(assignments),
    request: cloneCanonicalValue(request),
    allowed: Boolean(allowed),
    reasons: deepFreeze([...new Set(reasons)].sort())
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}

function targetScope({ organizationId, tenantId, resourceType, resourceId }) {
  return deepFreeze({
    organizationId: requiredText(organizationId, 'authorizationScope.organizationId'),
    ...(tenantId ? { tenantId: requiredText(tenantId, 'authorizationScope.tenantId') } : {}),
    resourceType: requiredText(resourceType, 'authorizationScope.resourceType'),
    resourceId: requiredText(resourceId, 'authorizationScope.resourceId')
  });
}

function authorizeScoped({ operation, permission, principal, roleAssignments, authorizationScope, request = {} }) {
  const normalizedPrincipal = createPrincipal(principal);
  const scope = targetScope(authorizationScope);
  const assignments = matchingAssignments({ principal: normalizedPrincipal, roleAssignments, permission, targetScope: scope });
  const identityMatchesTarget = normalizedPrincipal.organizationId === scope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (scope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('SECURITY_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push(`${operation}_PERMISSION_DENIED`);
  return buildDecision({
    operation,
    principal: normalizedPrincipal,
    assignments,
    request: { authorizationScope: scope, ...cloneCanonicalValue(request) },
    allowed: reasons.length === 0,
    reasons
  });
}

export function authorizeSecretManage(args) {
  return authorizeScoped({
    ...args,
    operation: 'SECRET_MANAGE',
    permission: PERMISSIONS.SECRET_MANAGE,
    authorizationScope: {
      ...args.authorizationScope,
      resourceType: SECURITY_RESOURCE_TYPES.SECRET
    }
  });
}

export function authorizeSecretUse(args) {
  return authorizeScoped({
    ...args,
    operation: 'SECRET_USE',
    permission: PERMISSIONS.SECRET_USE,
    authorizationScope: {
      ...args.authorizationScope,
      resourceType: SECURITY_RESOURCE_TYPES.SECRET
    }
  });
}

export function authorizeRetentionManage({ artifactRef, ...args }) {
  const normalizedArtifactRef = assertAuthorityRef(artifactRef);
  if (normalizedArtifactRef.kind !== 'SourceArtifact') {
    throw new SecurityOperationsAuthorizationError('SOURCE_ARTIFACT_REQUIRED', 'retention control currently accepts exact SourceArtifact refs only');
  }
  return authorizeScoped({
    ...args,
    operation: 'RETENTION_MANAGE',
    permission: PERMISSIONS.RETENTION_MANAGE,
    authorizationScope: {
      ...args.authorizationScope,
      resourceType: SECURITY_RESOURCE_TYPES.RETENTION
    },
    request: { artifactRef: normalizedArtifactRef }
  });
}

export function authorizeAuditExport({ rootRefs, ...args }) {
  const normalizedRootRefs = canonicalRefs(rootRefs, 'rootRefs');
  return authorizeScoped({
    ...args,
    operation: 'AUDIT_EXPORT',
    permission: PERMISSIONS.AUDIT_READ,
    authorizationScope: {
      ...args.authorizationScope,
      resourceType: SECURITY_RESOURCE_TYPES.AUDIT_EXPORT
    },
    request: { rootRefs: normalizedRootRefs }
  });
}
