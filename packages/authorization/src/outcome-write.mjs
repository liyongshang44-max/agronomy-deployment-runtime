import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const OUTCOME_RESOURCE_TYPE = 'OUTCOME';

export class OutcomeWriteAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OutcomeWriteAuthorizationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutcomeWriteAuthorizationError('INVALID_OUTCOME_WRITE_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
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

export function outcomeWriteScope({ organizationId, tenantId, outcomeId }) {
  return deepFreeze({
    organizationId: text(organizationId, 'authorizationScope.organizationId'),
    ...(tenantId ? { tenantId: text(tenantId, 'authorizationScope.tenantId') } : {}),
    resourceType: OUTCOME_RESOURCE_TYPE,
    resourceId: text(outcomeId, 'authorizationScope.resourceId')
  });
}

export function authorizeOutcomeWrite({ principal, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new OutcomeWriteAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const targetScope = outcomeWriteScope({
    organizationId: authorizationScope?.organizationId,
    tenantId: authorizationScope?.tenantId,
    outcomeId: authorizationScope?.resourceId
  });
  if (authorizationScope?.resourceType !== OUTCOME_RESOURCE_TYPE) {
    throw new OutcomeWriteAuthorizationError(
      'INVALID_OUTCOME_WRITE_RESOURCE_TYPE',
      `outcome.write requires resourceType ${OUTCOME_RESOURCE_TYPE}`
    );
  }

  const assignments = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new OutcomeWriteAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(PERMISSIONS.OUTCOME_WRITE)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    assignments.push(candidate);
  }

  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('OUTCOME_WRITE_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('OUTCOME_WRITE_PERMISSION_DENIED');

  const payload = {
    operation: 'OUTCOME_WRITE',
    principal: normalizedPrincipal,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue({ authorizationScope: targetScope }),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}
