import assert from 'node:assert/strict';
import {
  createPrincipal,
  publishBuiltinRoleAssignment
} from '../../packages/authorization/src/index.mjs';
import {
  publishDeployment,
  validateDeploymentAuthority
} from '../../packages/deployment/src/index.mjs';
import {
  audit,
  baseDeployment,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  publishAuthorizedDeployment
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('exact semantic retry by another authorized manager cannot rebind original Deployment publication governance', () => {
  const env = createDeploymentEnvironment('retry-governance');
  const logicalId = 'deployment.retry-governance';
  const payload = baseDeployment(env);
  const first = publishAuthorizedDeployment(env, { logicalId, deployment: payload });

  const secondManager = createPrincipal({
    principalId: 'deployment-manager-retry-second',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const secondRole = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.deployment-manager.retry-second',
    version: '1',
    principal: secondManager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  const secondAuth = createDeploymentAuthorization(env, logicalId, {
    principal: secondManager,
    roleAssignments: [secondRole],
    deployment: payload
  });
  assert.equal(secondAuth.decision.allowed, true);

  const retried = publishDeployment({
    ledger: env.ledger,
    logicalId,
    version: '1',
    deployment: payload,
    principal: secondManager,
    authorizationDecisionAuditRef: secondAuth.recorded.ref,
    audit: audit(secondManager.principalId)
  });
  assert.equal(retried.ref.semanticHash, first.ref.semanticHash);

  const publicationEvents = env.ledger.auditFor(first.ref)
    .filter((event) => event.action === 'PUBLISH_DEPLOYMENT');
  assert.equal(publicationEvents.length, 1);
  const validated = validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: first.ref });
  assert.equal(validated.controller.principalId, env.deploymentManager.principalId);
  assert.notEqual(validated.controller.principalId, secondManager.principalId);
});

console.log('Deployment retry-governance acceptance: 1 passed');
