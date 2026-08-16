import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

let seq = 0;
const manager = createPrincipal({
  principalId: 'deployment-manager-a06',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const runtime = createPrincipal({
  principalId: 'runtime-service-a06',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
function audit(actorId = 'iam-admin', actorType = 'USER') {
  seq += 1;
  return {
    eventId: `a06-auth-${seq}`,
    occurredAt: '2026-08-16T10:30:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'deployment-authorization' }
  };
}
function scope(resourceId = 'deployment-1', programId = 'pilot-a') {
  return {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programId,
    resourceType: 'DEPLOYMENT',
    resourceId
  };
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('DEPLOYMENT_MANAGER frozen role retains knowledge.deploy and deployment.production', () => {
  assert(BUILTIN_ROLES.DEPLOYMENT_MANAGER.includes(PERMISSIONS.KNOWLEDGE_DEPLOY));
  assert(BUILTIN_ROLES.DEPLOYMENT_MANAGER.includes(PERMISSIONS.DEPLOY_PRODUCTION));
});

test('DEPLOYMENT_MANAGER authorizes non-production Deployment publication', () => {
  const ledger = new AuthorityLedger();
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.deployment-manager',
    version: '1',
    principal: manager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  const decision = authorizeDeploymentControl({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope(),
    action: 'PUBLISH',
    production: false
  });
  assert.equal(decision.allowed, true);
});

test('knowledge.deploy alone cannot authorize a production Deployment', () => {
  const ledger = new AuthorityLedger();
  const role = publishRoleAssignment({
    ledger,
    logicalId: 'role.deploy-only',
    version: '1',
    principal: manager,
    role: 'DEPLOY_ONLY',
    roleDefinitionVersion: 'a06-test-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_DEPLOY],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  const decision = authorizeDeploymentControl({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope(),
    action: 'PUBLISH',
    production: true
  });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('PRODUCTION_PERMISSION_DENIED'));
});

test('program-scoped deployment authority cannot cross program', () => {
  const ledger = new AuthorityLedger();
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.program-a',
    version: '1',
    principal: manager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  assert.equal(authorizeDeploymentControl({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope('deployment-1', 'pilot-b'),
    action: 'PUBLISH',
    production: false
  }).allowed, false);
});

test('same principal id/type in another tenant contributes no deployment authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = createPrincipal({
    principalId: manager.principalId,
    type: manager.type,
    organizationId: 'org-a',
    tenantId: 'tenant-b',
    programIds: ['pilot-a']
  });
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.foreign-deployment-manager',
    version: '1',
    principal: foreign,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-b', programId: 'pilot-a' },
    audit: audit()
  });
  assert.equal(authorizeDeploymentControl({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope(),
    action: 'PUBLISH',
    production: false
  }).allowed, false);
});

test('deployment control permission cannot substitute for runtime retrieval permission', () => {
  const ledger = new AuthorityLedger();
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.deploy-manager-runtime-check',
    version: '1',
    principal: manager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  const decision = authorizeDeploymentRuntimeRead({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope()
  });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('DEPLOYMENT_RUNTIME_USE_PERMISSION_DENIED'));
});

test('RUNTIME_SERVICE authorizes exact runtime Deployment retrieval scope', () => {
  const ledger = new AuthorityLedger();
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.runtime-service',
    version: '1',
    principal: runtime,
    role: 'RUNTIME_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  const decision = authorizeDeploymentRuntimeRead({
    principal: runtime,
    roleAssignments: [role],
    authorizationScope: scope()
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.assignmentRefs, [role.ref]);
});

test('recorded Deployment decisions retain exact RoleAssignments without fake KnowledgeGovernancePolicy', () => {
  const ledger = new AuthorityLedger();
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.deployment-audit',
    version: '1',
    principal: manager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit()
  });
  const decision = authorizeDeploymentControl({
    principal: manager,
    roleAssignments: [role],
    authorizationScope: scope(),
    action: 'PUBLISH',
    production: false
  });
  const recorded = recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [role.ref]);
  assert(ledger.auditFor(recorded.ref).some((event) =>
    event.action === 'AUTHORIZATION_DEPLOYMENT_PUBLISH_ALLOW'
      && event.inputRefs.some((ref) => ref.semanticHash === role.ref.semanticHash)));
});

console.log('Deployment authorization acceptance: 8 passed');
