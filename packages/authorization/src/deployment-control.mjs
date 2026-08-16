import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const DEPLOYMENT_RESOURCE_TYPE = 'DEPLOYMENT';
export const DEPLOYMENT_CONTROL_ACTIONS = deepFreeze(['PUBLISH', 'SUSPEND', 'RESUME', 'DEPRECATE']);
const CONTROL_ACTION_SET = new Set(DEPLOYMENT_CONTROL_ACTIONS);

export class DeploymentAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeploymentAuthorizationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeploymentAuthorizationError('INVALID_DEPLOYMENT_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
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

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sortedRefs(records) {
  const unique = new Map();
  for (const record of records) unique.set(exactRefKey(record.ref), record.ref);
  return [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function normalizeScope(authorizationScope) {
  return deepFreeze({
    organizationId: text(authorizationScope?.organizationId, 'authorizationScope.organizationId'),
    ...(authorizationScope?.tenantId
      ? { tenantId: text(authorizationScope.tenantId, 'authorizationScope.tenantId') }
      : {}),
    programId: text(authorizationScope?.programId, 'authorizationScope.programId'),
    resourceType: DEPLOYMENT_RESOURCE_TYPE,
    resourceId: text(authorizationScope?.resourceId, 'authorizationScope.resourceId')
  });
}

function matchingAssignments({ principal, roleAssignments, targetScope, permission }) {
  if (!Array.isArray(roleAssignments)) {
    throw new DeploymentAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const matches = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new DeploymentAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, principal)) continue;
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(permission)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    matches.push(candidate);
  }
  return matches;
}

function decision({ operation, principal, assignments, request, reasons }) {
  const payload = {
    operation,
    principal: createPrincipal(principal),
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue(request),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}

export function authorizeDeploymentControl({
  principal,
  roleAssignments,
  authorizationScope,
  action = 'PUBLISH',
  production = false
}) {
  const actor = createPrincipal(principal);
  const normalizedAction = text(action, 'action');
  if (!CONTROL_ACTION_SET.has(normalizedAction)) {
    throw new DeploymentAuthorizationError('INVALID_DEPLOYMENT_CONTROL_ACTION', `unsupported deployment control action ${normalizedAction}`);
  }
  const targetScope = normalizeScope(authorizationScope);
  const deployAssignments = matchingAssignments({
    principal: actor,
    roleAssignments,
    targetScope,
    permission: PERMISSIONS.KNOWLEDGE_DEPLOY
  });
  const productionAssignments = production
    ? matchingAssignments({
        principal: actor,
        roleAssignments,
        targetScope,
        permission: PERMISSIONS.DEPLOY_PRODUCTION
      })
    : [];
  const identityMatchesTarget = actor.organizationId === targetScope.organizationId
    && (actor.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('DEPLOYMENT_TARGET_IDENTITY_DENIED');
  if (deployAssignments.length === 0) reasons.push('DEPLOYMENT_PERMISSION_DENIED');
  if (production && productionAssignments.length === 0) reasons.push('PRODUCTION_PERMISSION_DENIED');
  return decision({
    operation: `DEPLOYMENT_${normalizedAction}${production ? '_PRODUCTION' : ''}`,
    principal: actor,
    assignments: [...deployAssignments, ...productionAssignments],
    request: { authorizationScope: targetScope, action: normalizedAction, production: Boolean(production) },
    reasons
  });
}

export function authorizeDeploymentRuntimeRead({ principal, roleAssignments, authorizationScope }) {
  const actor = createPrincipal(principal);
  const targetScope = normalizeScope(authorizationScope);
  const assignments = matchingAssignments({
    principal: actor,
    roleAssignments,
    targetScope,
    permission: PERMISSIONS.KNOWLEDGE_RUNTIME_USE
  });
  const identityMatchesTarget = actor.organizationId === targetScope.organizationId
    && (actor.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('DEPLOYMENT_RUNTIME_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('DEPLOYMENT_RUNTIME_USE_PERMISSION_DENIED');
  return decision({
    operation: 'DEPLOYMENT_RUNTIME_READ',
    principal: actor,
    assignments,
    request: { authorizationScope: targetScope },
    reasons
  });
}
