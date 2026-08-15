import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';

export const PRINCIPAL_TYPES = deepFreeze(['USER', 'SERVICE_ACCOUNT']);

export const PERMISSIONS = deepFreeze({
  SOURCE_READ: 'source.read',
  KNOWLEDGE_INSPECT: 'knowledge.inspect',
  KNOWLEDGE_CANDIDATE_WRITE: 'knowledge.candidate.write',
  KNOWLEDGE_QUALIFY: 'knowledge.qualify',
  KNOWLEDGE_RELEASE: 'knowledge.release',
  KNOWLEDGE_DEPLOY: 'knowledge.deploy',
  KNOWLEDGE_RUNTIME_USE: 'knowledge.runtime.use',
  DEPLOY_PRODUCTION: 'deployment.production',
  AUDIT_READ: 'audit.read',
  CONTEXT_WRITE: 'context.write',
  CANDIDATE_COMPILE: 'compiler.candidate.compile',
  DECISION_PROBLEM_CREATE: 'decision.problem.create'
});

const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS));

export const BUILTIN_ROLES = deepFreeze({
  KNOWLEDGE_AUTHOR: [PERMISSIONS.SOURCE_READ, PERMISSIONS.KNOWLEDGE_INSPECT, PERMISSIONS.KNOWLEDGE_CANDIDATE_WRITE],
  AGRONOMY_REVIEWER: [PERMISSIONS.SOURCE_READ, PERMISSIONS.KNOWLEDGE_INSPECT],
  SCIENTIFIC_APPROVER: [PERMISSIONS.SOURCE_READ, PERMISSIONS.KNOWLEDGE_INSPECT, PERMISSIONS.KNOWLEDGE_QUALIFY],
  DEPLOYMENT_MANAGER: [PERMISSIONS.KNOWLEDGE_DEPLOY, PERMISSIONS.DEPLOY_PRODUCTION],
  AGRONOMIST: [PERMISSIONS.KNOWLEDGE_INSPECT],
  AUDITOR: [PERMISSIONS.AUDIT_READ],
  INTEGRATION_SERVICE: [PERMISSIONS.CONTEXT_WRITE],
  RUNTIME_SERVICE: [PERMISSIONS.KNOWLEDGE_RUNTIME_USE],
  COMPILER_SERVICE: [PERMISSIONS.SOURCE_READ, PERMISSIONS.KNOWLEDGE_CANDIDATE_WRITE, PERMISSIONS.CANDIDATE_COMPILE]
});

const AUTH_SCOPE_KEYS = new Set([
  'platform',
  'organizationId',
  'tenantId',
  'workspaceId',
  'programId',
  'resourceType',
  'resourceId'
]);

export class AuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuthorizationError('INVALID_AUTHORIZATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function uniqueSortedStrings(values, name, { allowEmpty = true } = {}) {
  if (!Array.isArray(values)) throw new AuthorizationError('INVALID_AUTHORIZATION_INPUT', `${name} must be an array`);
  const normalized = [...new Set(values.map((value) => requiredText(value, name)))].sort();
  if (!allowEmpty && normalized.length === 0) {
    throw new AuthorizationError('INVALID_AUTHORIZATION_INPUT', `${name} cannot be empty`);
  }
  return normalized;
}

function normalizePermissions(permissions) {
  const normalized = uniqueSortedStrings(permissions, 'permissions', { allowEmpty: false });
  for (const permission of normalized) {
    if (!VALID_PERMISSIONS.has(permission)) {
      throw new AuthorizationError('UNKNOWN_PERMISSION', `unsupported permission ${permission}`);
    }
  }
  return deepFreeze(normalized);
}

function normalizeAuthScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new AuthorizationError('INVALID_AUTH_SCOPE', 'authorization scope must be an object');
  }
  const normalized = {};
  for (const [key, value] of Object.entries(scope)) {
    if (!AUTH_SCOPE_KEYS.has(key)) throw new AuthorizationError('INVALID_AUTH_SCOPE', `unsupported authorization scope key ${key}`);
    if (key === 'platform') {
      if (value !== true) throw new AuthorizationError('INVALID_AUTH_SCOPE', 'platform scope must be true when present');
      normalized.platform = true;
      continue;
    }
    normalized[key] = requiredText(value, `scope.${key}`);
  }
  if (Object.keys(normalized).length === 0) {
    throw new AuthorizationError('INVALID_AUTH_SCOPE', 'authorization scope cannot be empty');
  }
  if (normalized.platform === true && Object.keys(normalized).length !== 1) {
    throw new AuthorizationError('INVALID_AUTH_SCOPE', 'platform scope cannot be combined with narrower scope dimensions');
  }
  return deepFreeze(normalized);
}

function normalizeAudience(audience) {
  if (!audience || typeof audience !== 'object' || Array.isArray(audience)) {
    throw new AuthorizationError('INVALID_VISIBILITY_POLICY', 'visibility audience must be an object');
  }
  const allowed = new Set(['public', 'principalId', 'organizationId', 'tenantId', 'programId']);
  const normalized = {};
  for (const [key, value] of Object.entries(audience)) {
    if (!allowed.has(key)) throw new AuthorizationError('INVALID_VISIBILITY_POLICY', `unsupported audience key ${key}`);
    if (key === 'public') {
      if (value !== true) throw new AuthorizationError('INVALID_VISIBILITY_POLICY', 'public visibility must be true when present');
      normalized.public = true;
    } else {
      normalized[key] = requiredText(value, `visibility.${key}`);
    }
  }
  if (Object.keys(normalized).length === 0) throw new AuthorizationError('INVALID_VISIBILITY_POLICY', 'visibility audience cannot be empty');
  if (normalized.public === true && Object.keys(normalized).length !== 1) {
    throw new AuthorizationError('INVALID_VISIBILITY_POLICY', 'public visibility cannot be combined with narrower audience dimensions');
  }
  return deepFreeze(normalized);
}

function normalizeConstraintScope(scope, name) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new AuthorizationError('INVALID_POLICY_SCOPE', `${name} must be an object`);
  }
  const normalized = {};
  for (const [key, value] of Object.entries(scope)) {
    if (value === '*') {
      normalized[key] = '*';
    } else if (Array.isArray(value)) {
      normalized[key] = uniqueSortedStrings(value, `${name}.${key}`, { allowEmpty: false });
    } else {
      normalized[key] = requiredText(value, `${name}.${key}`);
    }
  }
  if (Object.keys(normalized).length === 0) throw new AuthorizationError('INVALID_POLICY_SCOPE', `${name} cannot be empty`);
  return deepFreeze(normalized);
}

function normalizeOwnership(ownership) {
  if (!ownership || typeof ownership !== 'object' || Array.isArray(ownership)) {
    throw new AuthorizationError('INVALID_OWNERSHIP', 'ownership must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(ownership.organizationId, 'ownership.organizationId'),
    ...(ownership.tenantId ? { tenantId: requiredText(ownership.tenantId, 'ownership.tenantId') } : {})
  });
}

export function createPrincipal({ principalId, type, organizationId, tenantId, programIds = [] }) {
  const normalizedType = requiredText(type, 'type');
  if (!PRINCIPAL_TYPES.includes(normalizedType)) {
    throw new AuthorizationError('INVALID_PRINCIPAL_TYPE', `unsupported principal type ${normalizedType}`);
  }
  return deepFreeze({
    principalId: requiredText(principalId, 'principalId'),
    type: normalizedType,
    organizationId: requiredText(organizationId, 'organizationId'),
    ...(tenantId ? { tenantId: requiredText(tenantId, 'tenantId') } : {}),
    programIds: uniqueSortedStrings(programIds, 'programIds')
  });
}

export function publishRoleAssignment({
  ledger,
  logicalId,
  version,
  principal,
  role,
  roleDefinitionVersion,
  permissions,
  scope,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function') throw new AuthorizationError('INVALID_LEDGER', 'ledger.publish is required');
  return ledger.publish({
    kind: 'RoleAssignment',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload: {
      principal: createPrincipal(principal),
      role: requiredText(role, 'role'),
      roleDefinitionVersion: requiredText(roleDefinitionVersion, 'roleDefinitionVersion'),
      permissions: normalizePermissions(permissions),
      scope: normalizeAuthScope(scope)
    },
    audit
  });
}

export function publishBuiltinRoleAssignment({ ledger, logicalId, version, principal, role, scope, audit }) {
  const roleName = requiredText(role, 'role');
  const permissions = BUILTIN_ROLES[roleName];
  if (!permissions) throw new AuthorizationError('UNKNOWN_BUILTIN_ROLE', `unknown built-in role ${roleName}`);
  return publishRoleAssignment({
    ledger,
    logicalId,
    version,
    principal,
    role: roleName,
    roleDefinitionVersion: 'adr-builtin-roles-v1',
    permissions,
    scope,
    audit
  });
}

export function publishKnowledgeGovernancePolicy({
  ledger,
  logicalId,
  version,
  resourceId,
  ownership,
  visibilityPolicy,
  qualificationScope,
  deploymentScope,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function') throw new AuthorizationError('INVALID_LEDGER', 'ledger.publish is required');
  if (!Array.isArray(visibilityPolicy) || !Array.isArray(qualificationScope) || !Array.isArray(deploymentScope)) {
    throw new AuthorizationError(
      'FOUR_DIMENSION_POLICY_REQUIRED',
      'visibilityPolicy, qualificationScope and deploymentScope must be explicit arrays; ownership is separately required'
    );
  }
  return ledger.publish({
    kind: 'KnowledgeGovernancePolicy',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload: {
      resourceType: 'KNOWLEDGE',
      resourceId: requiredText(resourceId, 'resourceId'),
      ownership: normalizeOwnership(ownership),
      visibilityPolicy: visibilityPolicy.map(normalizeAudience),
      qualificationScope: qualificationScope.map((scope) => normalizeConstraintScope(scope, 'qualificationScope')),
      deploymentScope: deploymentScope.map((scope) => normalizeConstraintScope(scope, 'deploymentScope'))
    },
    audit
  });
}

function roleRecord(record) {
  if (!record?.ref || record.ref.kind !== 'RoleAssignment' || !record.semanticPayload?.principal) {
    throw new AuthorizationError('INVALID_ROLE_ASSIGNMENT', 'expected published RoleAssignment record');
  }
  return record;
}

function policyRecord(record) {
  if (!record?.ref || record.ref.kind !== 'KnowledgeGovernancePolicy' || record.semanticPayload?.resourceType !== 'KNOWLEDGE') {
    throw new AuthorizationError('INVALID_KNOWLEDGE_POLICY', 'expected published KnowledgeGovernancePolicy record');
  }
  return record;
}

function scopeContains(grantScope, targetScope) {
  if (grantScope.platform === true) return true;
  for (const [key, expected] of Object.entries(grantScope)) {
    if (targetScope[key] !== expected) return false;
  }
  return true;
}

function constraintMatches(grant, target) {
  for (const [key, expected] of Object.entries(grant)) {
    if (expected === '*') continue;
    const actual = target?.[key];
    if (actual === undefined || actual === null) return false;
    if (Array.isArray(expected)) {
      if (!expected.includes(String(actual))) return false;
    } else if (String(actual) !== expected) {
      return false;
    }
  }
  return true;
}

function audienceMatches(audience, principal) {
  if (audience.public === true) return true;
  if (audience.principalId && audience.principalId !== principal.principalId) return false;
  if (audience.organizationId && audience.organizationId !== principal.organizationId) return false;
  if (audience.tenantId && audience.tenantId !== principal.tenantId) return false;
  if (audience.programId && !principal.programIds.includes(audience.programId)) return false;
  return true;
}

function principalDefaultScope(principal) {
  return {
    organizationId: principal.organizationId,
    ...(principal.tenantId ? { tenantId: principal.tenantId } : {})
  };
}

function matchingPermissionAssignments({ principal, permission, targetScope, roleAssignments }) {
  if (!Array.isArray(roleAssignments)) throw new AuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  const normalizedPrincipal = createPrincipal(principal);
  const target = normalizeAuthScope(targetScope);
  const matches = [];
  for (const candidate of roleAssignments) {
    const record = roleRecord(candidate);
    const payload = record.semanticPayload;
    if (payload.principal.principalId !== normalizedPrincipal.principalId) continue;
    if (payload.principal.type !== normalizedPrincipal.type) continue;
    if (!payload.permissions.includes(permission)) continue;
    if (!scopeContains(payload.scope, target)) continue;
    matches.push(record);
  }
  return matches;
}

function sortedRefs(records) {
  const unique = new Map();
  for (const record of records) {
    const ref = record.ref;
    unique.set(JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]), ref);
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref);
}

function makeAuthorizationDecision({ operation, principal, policy, assignments, request, allowed, reasons }) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = policyRecord(policy);
  const payload = {
    operation: requiredText(operation, 'operation'),
    principal: normalizedPrincipal,
    policyRef: normalizedPolicy.ref,
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue(request),
    allowed: Boolean(allowed),
    reasons: uniqueSortedStrings(reasons, 'reasons')
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}

function makeScopedAuthorizationDecision({ operation, principal, assignments, request, allowed, reasons }) {
  const payload = {
    operation: requiredText(operation, 'operation'),
    principal: createPrincipal(principal),
    assignmentRefs: sortedRefs(assignments),
    request: cloneCanonicalValue(request),
    allowed: Boolean(allowed),
    reasons: uniqueSortedStrings(reasons, 'reasons')
  };
  return deepFreeze({ ...payload, decisionHash: semanticHash('AuthorizationDecision', payload) });
}

export function authorizeDecisionProblemCreation({ principal, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  const targetScope = normalizeAuthScope({
    organizationId: requiredText(authorizationScope?.organizationId, 'authorizationScope.organizationId'),
    ...(authorizationScope?.tenantId ? { tenantId: requiredText(authorizationScope.tenantId, 'authorizationScope.tenantId') } : {}),
    resourceType: 'DECISION_PROBLEM'
  });
  const assignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.DECISION_PROBLEM_CREATE,
    targetScope,
    roleAssignments
  });
  const identityMatchesTarget = normalizedPrincipal.organizationId === targetScope.organizationId
    && (normalizedPrincipal.tenantId ?? null) === (targetScope.tenantId ?? null);
  const reasons = [];
  if (!identityMatchesTarget) reasons.push('DECISION_PROBLEM_TARGET_IDENTITY_DENIED');
  if (assignments.length === 0) reasons.push('DECISION_PROBLEM_CREATE_PERMISSION_DENIED');
  return makeScopedAuthorizationDecision({
    operation: 'DECISION_PROBLEM_CREATE',
    principal: normalizedPrincipal,
    assignments,
    request: { authorizationScope: targetScope },
    allowed: reasons.length === 0,
    reasons
  });
}

export function authorizeKnowledgeInspection({ principal, policy, roleAssignments, authorizationScope }) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = policyRecord(policy);
  const targetScope = authorizationScope ?? principalDefaultScope(normalizedPrincipal);
  const assignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.KNOWLEDGE_INSPECT,
    targetScope,
    roleAssignments
  });
  const visible = normalizedPolicy.semanticPayload.visibilityPolicy.some((audience) => audienceMatches(audience, normalizedPrincipal));
  const reasons = [];
  if (assignments.length === 0) reasons.push('ROLE_PERMISSION_DENIED');
  if (!visible) reasons.push('VISIBILITY_DENIED');
  return makeAuthorizationDecision({
    operation: 'KNOWLEDGE_INSPECT',
    principal: normalizedPrincipal,
    policy: normalizedPolicy,
    assignments,
    request: { authorizationScope: targetScope },
    allowed: reasons.length === 0,
    reasons
  });
}

export function authorizeKnowledgeQualification({
  principal,
  policy,
  roleAssignments,
  qualificationTarget,
  authorizationScope
}) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = policyRecord(policy);
  const targetScope = authorizationScope ?? principalDefaultScope(normalizedPrincipal);
  const qualificationAssignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.KNOWLEDGE_QUALIFY,
    targetScope,
    roleAssignments
  });
  const inspectAssignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.KNOWLEDGE_INSPECT,
    targetScope,
    roleAssignments
  });
  const visible = normalizedPolicy.semanticPayload.visibilityPolicy.some((audience) => audienceMatches(audience, normalizedPrincipal));
  const scopeAllowed = normalizedPolicy.semanticPayload.qualificationScope.some((scope) => constraintMatches(scope, qualificationTarget));
  const reasons = [];
  if (qualificationAssignments.length === 0) reasons.push('QUALIFICATION_PERMISSION_DENIED');
  if (inspectAssignments.length === 0) reasons.push('INSPECTION_PERMISSION_DENIED');
  if (!visible) reasons.push('VISIBILITY_DENIED');
  if (!scopeAllowed) reasons.push('QUALIFICATION_SCOPE_DENIED');
  return makeAuthorizationDecision({
    operation: 'KNOWLEDGE_QUALIFY',
    principal: normalizedPrincipal,
    policy: normalizedPolicy,
    assignments: [...qualificationAssignments, ...inspectAssignments],
    request: { authorizationScope: targetScope, qualificationTarget },
    allowed: reasons.length === 0,
    reasons
  });
}

export function authorizeKnowledgeDeployment({
  principal,
  policy,
  roleAssignments,
  deploymentTarget,
  production = false
}) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = policyRecord(policy);
  const targetScope = normalizeAuthScope({
    organizationId: requiredText(deploymentTarget.organizationId, 'deploymentTarget.organizationId'),
    ...(deploymentTarget.tenantId ? { tenantId: requiredText(deploymentTarget.tenantId, 'deploymentTarget.tenantId') } : {}),
    ...(deploymentTarget.programId ? { programId: requiredText(deploymentTarget.programId, 'deploymentTarget.programId') } : {})
  });
  const deployAssignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.KNOWLEDGE_DEPLOY,
    targetScope,
    roleAssignments
  });
  const productionAssignments = production
    ? matchingPermissionAssignments({
        principal: normalizedPrincipal,
        permission: PERMISSIONS.DEPLOY_PRODUCTION,
        targetScope,
        roleAssignments
      })
    : [];
  const deploymentAllowed = normalizedPolicy.semanticPayload.deploymentScope.some((scope) => constraintMatches(scope, deploymentTarget));
  const reasons = [];
  if (deployAssignments.length === 0) reasons.push('DEPLOYMENT_PERMISSION_DENIED');
  if (production && productionAssignments.length === 0) reasons.push('PRODUCTION_PERMISSION_DENIED');
  if (!deploymentAllowed) reasons.push('DEPLOYMENT_SCOPE_DENIED');
  return makeAuthorizationDecision({
    operation: production ? 'KNOWLEDGE_DEPLOY_PRODUCTION' : 'KNOWLEDGE_DEPLOY',
    principal: normalizedPrincipal,
    policy: normalizedPolicy,
    assignments: [...deployAssignments, ...productionAssignments],
    request: { deploymentTarget, production: Boolean(production) },
    allowed: reasons.length === 0,
    reasons
  });
}

export function authorizeKnowledgeRuntimeUse({ principal, policy, roleAssignments, deploymentTarget }) {
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedPolicy = policyRecord(policy);
  const targetScope = normalizeAuthScope({
    organizationId: requiredText(deploymentTarget.organizationId, 'deploymentTarget.organizationId'),
    ...(deploymentTarget.tenantId ? { tenantId: requiredText(deploymentTarget.tenantId, 'deploymentTarget.tenantId') } : {}),
    ...(deploymentTarget.programId ? { programId: requiredText(deploymentTarget.programId, 'deploymentTarget.programId') } : {})
  });
  const assignments = matchingPermissionAssignments({
    principal: normalizedPrincipal,
    permission: PERMISSIONS.KNOWLEDGE_RUNTIME_USE,
    targetScope,
    roleAssignments
  });
  const deploymentAllowed = normalizedPolicy.semanticPayload.deploymentScope.some((scope) => constraintMatches(scope, deploymentTarget));
  const reasons = [];
  if (assignments.length === 0) reasons.push('RUNTIME_USE_PERMISSION_DENIED');
  if (!deploymentAllowed) reasons.push('DEPLOYMENT_SCOPE_DENIED');
  return makeAuthorizationDecision({
    operation: 'KNOWLEDGE_RUNTIME_USE',
    principal: normalizedPrincipal,
    policy: normalizedPolicy,
    assignments,
    request: { deploymentTarget },
    allowed: reasons.length === 0,
    reasons
  });
}

export function filterInspectableKnowledge({ principal, policies, roleAssignments, authorizationScope }) {
  if (!Array.isArray(policies)) throw new AuthorizationError('INVALID_KNOWLEDGE_POLICIES', 'policies must be an array');
  return policies.filter((policy) => authorizeKnowledgeInspection({
    principal,
    policy,
    roleAssignments,
    authorizationScope
  }).allowed);
}

export function filterRuntimeDeployableKnowledge({ principal, policies, roleAssignments, deploymentTarget }) {
  if (!Array.isArray(policies)) throw new AuthorizationError('INVALID_KNOWLEDGE_POLICIES', 'policies must be an array');
  return policies.filter((policy) => authorizeKnowledgeRuntimeUse({
    principal,
    policy,
    roleAssignments,
    deploymentTarget
  }).allowed);
}
