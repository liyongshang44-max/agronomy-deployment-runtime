import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal, samePrincipalIdentity } from '../../authorization/src/index.mjs';

export class KnowledgeReleaseAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KnowledgeReleaseAuthorizationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeReleaseAuthorizationError('INVALID_RELEASE_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new KnowledgeReleaseAuthorizationError('INVALID_RELEASE_TARGET', 'releaseTarget must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(target.organizationId, 'releaseTarget.organizationId'),
    ...(target.tenantId ? { tenantId: requiredText(target.tenantId, 'releaseTarget.tenantId') } : {}),
    ...(target.programId ? { programId: requiredText(target.programId, 'releaseTarget.programId') } : {})
  });
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sortedRefs(records) {
  const unique = new Map();
  for (const record of records) unique.set(exactRefKey(record.ref), record.ref);
  return [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function scopeContains(grant, target) {
  if (grant?.platform === true) return true;
  for (const [key, expected] of Object.entries(grant ?? {})) {
    if (target[key] !== expected) return false;
  }
  return true;
}

function constraintMatches(grant, target) {
  for (const [key, expected] of Object.entries(grant ?? {})) {
    if (expected === '*') continue;
    const actual = target[key];
    if (actual === undefined || actual === null) return false;
    if (Array.isArray(expected)) {
      if (!expected.includes(String(actual))) return false;
    } else if (String(actual) !== String(expected)) return false;
  }
  return true;
}

function assertPolicy(policy) {
  if (!policy?.ref || policy.ref.kind !== 'KnowledgeGovernancePolicy' || policy.semanticPayload?.resourceType !== 'KNOWLEDGE') {
    throw new KnowledgeReleaseAuthorizationError('INVALID_RELEASE_POLICY', 'expected published KnowledgeGovernancePolicy');
  }
  return policy;
}

function assertRoleAssignment(record) {
  if (!record?.ref || record.ref.kind !== 'RoleAssignment' || !record.semanticPayload?.principal) {
    throw new KnowledgeReleaseAuthorizationError('INVALID_RELEASE_ROLE_ASSIGNMENT', 'expected published RoleAssignment');
  }
  return record;
}

export function authorizeKnowledgeRelease({ principal, policy, roleAssignments, releaseTarget }) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = assertPolicy(policy);
  const target = normalizeTarget(releaseTarget);
  if (!Array.isArray(roleAssignments)) {
    throw new KnowledgeReleaseAuthorizationError('INVALID_RELEASE_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }

  const assignments = roleAssignments
    .map(assertRoleAssignment)
    .filter((record) => samePrincipalIdentity(record.semanticPayload.principal, normalizedPrincipal))
    .filter((record) => record.semanticPayload.permissions.includes(PERMISSIONS.KNOWLEDGE_RELEASE))
    .filter((record) => scopeContains(record.semanticPayload.scope, target));

  const entitlementAllowed = normalizedPolicy.semanticPayload.deploymentScope.some((scope) => constraintMatches(scope, target));
  const reasons = [];
  if (assignments.length === 0) reasons.push('KNOWLEDGE_RELEASE_PERMISSION_DENIED');
  if (!entitlementAllowed) reasons.push('KNOWLEDGE_RELEASE_SCOPE_DENIED');

  const payload = {
    operation: 'KNOWLEDGE_RELEASE',
    principal: normalizedPrincipal,
    policyRef: normalizedPolicy.ref,
    assignmentRefs: sortedRefs(assignments),
    request: { releaseTarget: cloneCanonicalValue(target) },
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)].sort()
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}
