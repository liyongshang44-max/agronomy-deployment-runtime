import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  DeploymentError,
  normalizeDeployment,
  publishDeployment,
  resolveDeploymentForRuntime,
  validateDeploymentAuthority
} from '../../packages/deployment/src/index.mjs';
import {
  audit,
  baseDeployment,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  createRuntimeReadAuthorization,
  publishAuthorizedDeployment
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DeploymentError && error.code === code);
}

test('Deployment publication authorization is bound to exact logical id', () => {
  const env = createDeploymentEnvironment('wrong-id');
  const auth = createDeploymentAuthorization(env, 'deployment.other');
  expectCode(() => publishDeployment({
    ledger: env.ledger,
    logicalId: 'deployment.target',
    version: '1',
    deployment: baseDeployment(env),
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(env.deploymentManager.principalId)
  }), 'DEPLOYMENT_AUTHORIZATION_MISMATCH');
});

test('forged allow AuthorizationDecision without RoleAssignment cannot publish Deployment', () => {
  const env = createDeploymentEnvironment('forged-auth');
  const logicalId = 'deployment.forged';
  const scope = {
    organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a',
    resourceType: 'DEPLOYMENT', resourceId: logicalId
  };
  const basis = {
    operation: 'DEPLOYMENT_PUBLISH',
    principal: env.deploymentManager,
    assignmentRefs: [],
    request: { authorizationScope: scope, action: 'PUBLISH', production: false },
    allowed: true,
    reasons: []
  };
  const forged = env.ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: semanticHash('AuthorizationDecision', basis),
    version: '1',
    semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) },
    audit: { ...audit('iam-engine', 'SERVICE_ACCOUNT'), action: 'AUTHORIZATION_DEPLOYMENT_PUBLISH_ALLOW', inputRefs: [] }
  });
  expectCode(() => publishDeployment({
    ledger: env.ledger,
    logicalId,
    version: '1',
    deployment: baseDeployment(env),
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: forged.ref,
    audit: audit(env.deploymentManager.principalId)
  }), 'DEPLOYMENT_ROLE_ASSIGNMENT_REQUIRED');
});

test('generic Deployment with hidden publication authority input fails validation', () => {
  const env = createDeploymentEnvironment('hidden-input');
  const logicalId = 'deployment.hidden-input';
  const payload = normalizeDeployment(baseDeployment(env));
  const auth = createDeploymentAuthorization(env, logicalId, { deployment: payload });
  const forged = env.ledger.publish({
    kind: 'Deployment',
    logicalId,
    version: '1',
    semanticPayload: payload,
    audit: {
      ...audit(env.deploymentManager.principalId),
      action: 'PUBLISH_DEPLOYMENT',
      inputRefs: [payload.runtimeProfileRef, auth.recorded.ref, env.deploymentManagerRole.ref],
      details: {
        controlPrincipal: env.deploymentManager,
        deploymentScope: payload.deploymentScope,
        authorizationDecisionAuditRef: auth.recorded.ref
      }
    }
  });
  expectCode(() => validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: forged.ref }), 'DEPLOYMENT_PUBLICATION_AUTHORITY_INVALID');
});

test('initial SUSPENDED or DEPRECATED rollout stage is forbidden', () => {
  const env = createDeploymentEnvironment('terminal-stage');
  for (const rolloutStage of ['SUSPENDED', 'DEPRECATED']) {
    expectCode(() => normalizeDeployment(baseDeployment(env, { rolloutStage })), 'DEPLOYMENT_TERMINAL_STAGE_REQUIRES_CONTROL_DECISION');
  }
});

test('invalid or zero-length Deployment effective interval is rejected', () => {
  const env = createDeploymentEnvironment('bad-time');
  expectCode(() => normalizeDeployment(baseDeployment(env, {
    effectiveInterval: { start: '2026-08-16T00:00:00Z', end: '2026-08-16T00:00:00Z' }
  })), 'INVALID_DEPLOYMENT_INTERVAL');
  expectCode(() => normalizeDeployment(baseDeployment(env, {
    effectiveInterval: { start: '2026-08-16', end: '2026-08-17T00:00:00Z' }
  })), 'INVALID_DEPLOYMENT_TIME');
});

test('duplicate target scope values are rejected rather than silently deduplicated', () => {
  const env = createDeploymentEnvironment('duplicate-scope');
  expectCode(() => normalizeDeployment(baseDeployment(env, {
    deploymentScope: { ...baseDeployment(env).deploymentScope, crops: ['maize', 'maize'] }
  })), 'DUPLICATE_DEPLOYMENT_SCOPE_VALUE');
});

test('runtime retrieval fails outside Deployment effective interval', () => {
  const env = createDeploymentEnvironment('runtime-time');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.runtime-time' });
  const runtimeAuth = createRuntimeReadAuthorization(env, 'deployment.runtime-time');
  assert.equal(runtimeAuth.decision.allowed, true);
  expectCode(() => resolveDeploymentForRuntime({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    principal: env.runtimePrincipal,
    authorizationDecisionAuditRef: runtimeAuth.recorded.ref,
    atTime: '2026-10-01T00:00:00Z'
  }), 'DEPLOYMENT_OUTSIDE_EFFECTIVE_INTERVAL');
});

test('DEPLOYMENT_MANAGER cannot use its deployment permissions as runtime-read authority', () => {
  const env = createDeploymentEnvironment('manager-runtime');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.manager-runtime' });
  const runtimeAuth = createRuntimeReadAuthorization(env, 'deployment.manager-runtime', {
    principal: env.deploymentManager,
    roleAssignments: [env.deploymentManagerRole]
  });
  assert.equal(runtimeAuth.decision.allowed, false);
  expectCode(() => resolveDeploymentForRuntime({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: runtimeAuth.recorded.ref,
    atTime: '2026-08-20T00:00:00Z'
  }), 'DEPLOYMENT_RUNTIME_AUTHORIZATION_MISMATCH');
});

test('runtime role scoped to another program cannot retrieve Deployment', () => {
  const env = createDeploymentEnvironment('runtime-program');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.runtime-program' });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.runtime-pilot-b',
    version: '1',
    principal: env.runtimePrincipal,
    role: 'RUNTIME_OTHER_PROGRAM',
    roleDefinitionVersion: 'a06-test-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RUNTIME_USE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-b' },
    audit: audit('iam-admin')
  });
  const runtimeAuth = createRuntimeReadAuthorization(env, 'deployment.runtime-program', {
    roleAssignments: [role]
  });
  assert.equal(runtimeAuth.decision.allowed, false);
  expectCode(() => resolveDeploymentForRuntime({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    principal: env.runtimePrincipal,
    authorizationDecisionAuditRef: runtimeAuth.recorded.ref,
    atTime: '2026-08-20T00:00:00Z'
  }), 'DEPLOYMENT_RUNTIME_AUTHORIZATION_MISMATCH');
});

test('production Deployment cannot be authorized by a deploy-only role', () => {
  const env = createDeploymentEnvironment('prod-no-permission', {
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['PRODUCTION'],
      rolloutStages: ['PRODUCTION']
    }
  });
  const deployOnly = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.deploy-only-production',
    version: '1',
    principal: env.deploymentManager,
    role: 'DEPLOY_ONLY',
    roleDefinitionVersion: 'a06-test-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_DEPLOY],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  const deploymentValue = baseDeployment(env, { runtimeEnvironment: 'PRODUCTION', rolloutStage: 'PRODUCTION' });
  const auth = createDeploymentAuthorization(env, 'deployment.prod-no-permission', {
    roleAssignments: [deployOnly], deployment: deploymentValue
  });
  assert.equal(auth.decision.allowed, false);
  expectCode(() => publishDeployment({
    ledger: env.ledger,
    logicalId: 'deployment.prod-no-permission',
    version: '1',
    deployment: deploymentValue,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(env.deploymentManager.principalId)
  }), 'DEPLOYMENT_AUTHORIZATION_MISMATCH');
});

test('copied deployment audit vocabulary cannot launder wrong-operation authorization', () => {
  const env = createDeploymentEnvironment('copied-vocabulary');
  const logicalId = 'deployment.copied-vocabulary';
  const scope = {
    organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a',
    resourceType: 'DEPLOYMENT', resourceId: logicalId
  };
  const basis = {
    operation: 'DEPLOYMENT_RUNTIME_READ',
    principal: env.deploymentManager,
    assignmentRefs: [env.deploymentManagerRole.ref],
    request: { authorizationScope: scope },
    allowed: true,
    reasons: []
  };
  const forged = env.ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: semanticHash('AuthorizationDecision', basis),
    version: '1',
    semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) },
    audit: {
      ...audit('iam-engine', 'SERVICE_ACCOUNT'),
      action: 'AUTHORIZATION_DEPLOYMENT_PUBLISH_ALLOW',
      inputRefs: [env.deploymentManagerRole.ref]
    }
  });
  expectCode(() => publishDeployment({
    ledger: env.ledger,
    logicalId,
    version: '1',
    deployment: baseDeployment(env),
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: forged.ref,
    audit: audit(env.deploymentManager.principalId)
  }), 'DEPLOYMENT_AUTHORIZATION_MISMATCH');
});

test('KnowledgeRelease ref cannot substitute for exact RuntimeProfile ref', () => {
  const env = createDeploymentEnvironment('profile-required');
  expectCode(() => normalizeDeployment(baseDeployment(env, {
    runtimeProfileRef: env.release.ref
  })), 'RUNTIME_PROFILE_REQUIRED');
});

console.log('Deployment integrity acceptance: 12 passed');
