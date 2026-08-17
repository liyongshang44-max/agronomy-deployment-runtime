import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal } from './engine.mjs';

export const OUTCOME_EVALUATION_RESOURCE_TYPE = 'OUTCOME_EVALUATION';

export class OutcomeEvaluationAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OutcomeEvaluationAuthorizationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutcomeEvaluationAuthorizationError(
      'INVALID_OUTCOME_EVALUATION_AUTHORIZATION_INPUT',
      `${name} must be a non-empty string`
    );
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

export function outcomeEvaluationScope({ organizationId, tenantId, evaluationId }) {
  return deepFreeze({
    organizationId: text(organizationId, 'authorizationScope.organizationId'),
    ...(tenantId ? { tenantId: text(tenantId, 'authorizationScope.tenantId') } : {}),
    resourceType: OUTCOME_EVALUATION_RESOURCE_TYPE,
    resourceId: text(evaluationId, 'authorizationScope.resourceId')
  });
}

export function authorizeOutcomeEvaluation({ principal, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new OutcomeEvaluationAuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  if (authorizationScope?.resourceType !== OUTCOME_EVALUATION_RESOURCE_TYPE) {
    throw new OutcomeEvaluationAuthorizationError(
      'INVALID_OUTCOME_EVALUATION_RESOURCE_TYPE',
      `outcome.evaluate requires resourceType ${OUTCOME_EVALUATION_RESOURCE_TYPE}`
    );
  }
  const targetScope = outcomeEvaluationScope({
    organizationId: authorizationScope?.organizationId,
    tenantId: authorizationScope?.tenantId,
    evaluationId: authorizationScope?.resourceId
  });

  const assignments = [];
  for (const candidate of roleAssignments) {
    if (!candidate?.ref || candidate.ref.kind !== 'RoleAssignment' || !candidate.semanticPayload?.principal) {
      throw new OutcomeEvaluationAuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
    }
    const payload = candidate.semanticPayload;
    if (!sameIdentity(payload.principal, normalizedPrincipal)) continue;
    if (!Array.isArray(payload.permissions) || !payload.permissions.includes(PERMISSIONS.OUTCOME_EVALUATE)) continue;
    if (!scopeContains(payload.scope, targetScope)) continue;
    assignments.push(candidate);
  }

  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('OUTCOME_EVALUATION_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('OUTCOME_EVALUATE_PERMISSION_DENIED');

  const payload = {
    operation: 'OUTCOME_EVALUATE',
    principal: normalizedPrincipal,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue({ authorizationScope: targetScope }),
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}
