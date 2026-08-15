import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  authorizeKnowledgeDeployment,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  authorizeKnowledgeRuntimeUse,
  createPrincipal,
  filterInspectableKnowledge,
  filterRuntimeDeployableKnowledge,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy
} from '../../packages/authorization/src/index.mjs';

function audit(eventId, actorId = 'iam-admin') {
  return {
    eventId,
    occurredAt: '2026-08-15T13:00:00.000Z',
    actor: { type: 'USER', id: actorId },
    details: { channel: 'authorization-acceptance' }
  };
}

function role(ledger, { logicalId, principal, role: roleName, scope, version = '1' }) {
  return publishBuiltinRoleAssignment({
    ledger,
    logicalId,
    version,
    principal,
    role: roleName,
    scope,
    audit: audit(`evt-${logicalId}-${version}`)
  });
}

function policy(ledger, overrides = {}) {
  return publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: overrides.logicalId ?? 'policy.knowledge.corn-water',
    version: overrides.version ?? '1',
    resourceId: overrides.resourceId ?? 'knowledge.corn-water',
    ownership: overrides.ownership ?? { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: overrides.visibilityPolicy ?? [
      { organizationId: 'org-a' }
    ],
    qualificationScope: overrides.qualificationScope ?? [
      { crop: 'maize', useClass: 'ADVISORY' }
    ],
    deploymentScope: overrides.deploymentScope ?? [
      { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY' }
    ],
    audit: audit(`evt-${overrides.logicalId ?? 'policy.knowledge.corn-water'}-${overrides.version ?? '1'}`)
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function expectError(fn, ErrorType, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

test('built-in compiler role has no qualification or production-deployment permission', () => {
  assert.ok(BUILTIN_ROLES.COMPILER_SERVICE.includes(PERMISSIONS.CANDIDATE_COMPILE));
  assert.ok(!BUILTIN_ROLES.COMPILER_SERVICE.includes(PERMISSIONS.KNOWLEDGE_QUALIFY));
  assert.ok(!BUILTIN_ROLES.COMPILER_SERVICE.includes(PERMISSIONS.KNOWLEDGE_DEPLOY));
  assert.ok(!BUILTIN_ROLES.COMPILER_SERVICE.includes(PERMISSIONS.DEPLOY_PRODUCTION));
});

test('private tenant knowledge is not inspectable cross-tenant without explicit visibility', () => {
  const ledger = new AuthorityLedger();
  const reviewer = createPrincipal({ principalId: 'reviewer-b', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.reviewer-b',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const knowledgePolicy = policy(ledger, { visibilityPolicy: [{ organizationId: 'org-a', tenantId: 'tenant-a' }] });

  const decision = authorizeKnowledgeInspection({ principal: reviewer, policy: knowledgePolicy, roleAssignments: [assignment] });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('VISIBILITY_DENIED'));
});

test('explicit cross-organization visibility permits inspection without transferring ownership', () => {
  const ledger = new AuthorityLedger();
  const reviewer = createPrincipal({ principalId: 'reviewer-b', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.reviewer-b-visible',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const knowledgePolicy = policy(ledger, {
    logicalId: 'policy.visible-to-b',
    visibilityPolicy: [{ organizationId: 'org-a' }, { organizationId: 'org-b', tenantId: 'tenant-b' }]
  });

  const decision = authorizeKnowledgeInspection({ principal: reviewer, policy: knowledgePolicy, roleAssignments: [assignment] });
  assert.equal(decision.allowed, true);
  assert.deepEqual(knowledgePolicy.semanticPayload.ownership, { organizationId: 'org-a', tenantId: 'tenant-a' });
});

test('runtime tenant identity does not imply knowledge ownership', () => {
  const ledger = new AuthorityLedger();
  const knowledgePolicy = policy(ledger);
  const deploymentTarget = {
    organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY'
  };
  assert.equal(knowledgePolicy.semanticPayload.ownership.tenantId, 'tenant-a');
  assert.equal(deploymentTarget.tenantId, 'tenant-b');
  assert.notEqual(knowledgePolicy.semanticPayload.ownership.tenantId, deploymentTarget.tenantId);
});

test('qualification scope is enforced independently from reviewer permission and visibility', () => {
  const ledger = new AuthorityLedger();
  const approver = createPrincipal({ principalId: 'approver-a', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const assignment = role(ledger, {
    logicalId: 'role.approver-a',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' }
  });
  const knowledgePolicy = policy(ledger);

  const maize = authorizeKnowledgeQualification({
    principal: approver,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    qualificationTarget: { crop: 'maize', useClass: 'ADVISORY' }
  });
  const wheat = authorizeKnowledgeQualification({
    principal: approver,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    qualificationTarget: { crop: 'wheat', useClass: 'ADVISORY' }
  });

  assert.equal(maize.allowed, true);
  assert.equal(wheat.allowed, false);
  assert.ok(wheat.reasons.includes('QUALIFICATION_SCOPE_DENIED'));
});

test('deployment entitlement is independent from visibility and can authorize a different organization program', () => {
  const ledger = new AuthorityLedger();
  const deployer = createPrincipal({ principalId: 'deployer-b', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.deployer-b',
    principal: deployer,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1' }
  });
  const knowledgePolicy = policy(ledger, {
    logicalId: 'policy.deploy-without-visibility',
    visibilityPolicy: [{ organizationId: 'org-a', tenantId: 'tenant-a' }]
  });
  const target = { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY' };

  const inspect = authorizeKnowledgeInspection({ principal: deployer, policy: knowledgePolicy, roleAssignments: [assignment] });
  const deploy = authorizeKnowledgeDeployment({ principal: deployer, policy: knowledgePolicy, roleAssignments: [assignment], deploymentTarget: target, production: true });

  assert.equal(inspect.allowed, false);
  assert.equal(deploy.allowed, true);
  assert.equal(knowledgePolicy.semanticPayload.ownership.organizationId, 'org-a');
});

test('deployment scope refuses a program that was not explicitly entitled', () => {
  const ledger = new AuthorityLedger();
  const deployer = createPrincipal({ principalId: 'deployer-b2', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.deployer-b2',
    principal: deployer,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const knowledgePolicy = policy(ledger, { logicalId: 'policy.program-1-only' });
  const decision = authorizeKnowledgeDeployment({
    principal: deployer,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    deploymentTarget: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-2', crop: 'maize', useClass: 'ADVISORY' },
    production: false
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('DEPLOYMENT_SCOPE_DENIED'));
});

test('compiler service cannot qualify or deploy even when knowledge policy would otherwise allow it', () => {
  const ledger = new AuthorityLedger();
  const compiler = createPrincipal({ principalId: 'compiler-1', type: 'SERVICE_ACCOUNT', organizationId: 'platform-org' });
  const assignment = role(ledger, {
    logicalId: 'role.compiler-1',
    principal: compiler,
    role: 'COMPILER_SERVICE',
    scope: { platform: true }
  });
  const knowledgePolicy = policy(ledger, {
    logicalId: 'policy.compiler-negative',
    visibilityPolicy: [{ public: true }],
    qualificationScope: [{ crop: '*', useClass: '*' }],
    deploymentScope: [{ organizationId: '*', tenantId: '*', programId: '*', crop: '*', useClass: '*' }]
  });

  const qualify = authorizeKnowledgeQualification({
    principal: compiler,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    qualificationTarget: { crop: 'maize', useClass: 'ADVISORY' },
    authorizationScope: { platform: true }
  });
  const deploy = authorizeKnowledgeDeployment({
    principal: compiler,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    deploymentTarget: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY' },
    production: true
  });

  assert.equal(qualify.allowed, false);
  assert.ok(qualify.reasons.includes('QUALIFICATION_PERMISSION_DENIED'));
  assert.equal(deploy.allowed, false);
  assert.ok(deploy.reasons.includes('DEPLOYMENT_PERMISSION_DENIED'));
  assert.ok(deploy.reasons.includes('PRODUCTION_PERMISSION_DENIED'));
});

test('public visibility does not grant inspection permission by itself', () => {
  const ledger = new AuthorityLedger();
  const user = createPrincipal({ principalId: 'user-no-role', type: 'USER', organizationId: 'org-c', tenantId: 'tenant-c' });
  const knowledgePolicy = policy(ledger, { logicalId: 'policy.public', visibilityPolicy: [{ public: true }] });
  const decision = authorizeKnowledgeInspection({ principal: user, policy: knowledgePolicy, roleAssignments: [] });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('ROLE_PERMISSION_DENIED'));
  assert.ok(!decision.reasons.includes('VISIBILITY_DENIED'));
});

test('role resource scope is enforced independently from asset visibility', () => {
  const ledger = new AuthorityLedger();
  const reviewer = createPrincipal({ principalId: 'reviewer-scoped', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b1' });
  const assignment = role(ledger, {
    logicalId: 'role.reviewer-scoped',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b1' }
  });
  const knowledgePolicy = policy(ledger, { logicalId: 'policy.public-scope-test', visibilityPolicy: [{ public: true }] });
  const decision = authorizeKnowledgeInspection({
    principal: reviewer,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    authorizationScope: { organizationId: 'org-b', tenantId: 'tenant-b2' }
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('ROLE_PERMISSION_DENIED'));
});

test('runtime service can use deploy-entitled private knowledge without receiving inspection visibility', () => {
  const ledger = new AuthorityLedger();
  const runtime = createPrincipal({ principalId: 'runtime-1', type: 'SERVICE_ACCOUNT', organizationId: 'platform-org' });
  const assignment = role(ledger, {
    logicalId: 'role.runtime-1',
    principal: runtime,
    role: 'RUNTIME_SERVICE',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1' }
  });
  const knowledgePolicy = policy(ledger, {
    logicalId: 'policy.runtime-private',
    visibilityPolicy: [{ organizationId: 'org-a', tenantId: 'tenant-a' }]
  });
  const target = { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY' };

  const inspect = authorizeKnowledgeInspection({
    principal: runtime,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    authorizationScope: { platform: true }
  });
  const use = authorizeKnowledgeRuntimeUse({ principal: runtime, policy: knowledgePolicy, roleAssignments: [assignment], deploymentTarget: target });

  assert.equal(inspect.allowed, false);
  assert.equal(use.allowed, true);
});

test('inspection and runtime filters enforce different visibility/deployment dimensions', () => {
  const ledger = new AuthorityLedger();
  const reviewer = createPrincipal({ principalId: 'reviewer-filter', type: 'USER', organizationId: 'org-b', tenantId: 'tenant-b' });
  const reviewerRole = role(ledger, {
    logicalId: 'role.reviewer-filter', principal: reviewer, role: 'AGRONOMY_REVIEWER', scope: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const runtime = createPrincipal({ principalId: 'runtime-filter', type: 'SERVICE_ACCOUNT', organizationId: 'platform-org' });
  const runtimeRole = role(ledger, {
    logicalId: 'role.runtime-filter', principal: runtime, role: 'RUNTIME_SERVICE', scope: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1' }
  });
  const visibleOnly = policy(ledger, {
    logicalId: 'policy.visible-only', resourceId: 'visible-only',
    visibilityPolicy: [{ organizationId: 'org-b', tenantId: 'tenant-b' }],
    deploymentScope: [{ organizationId: 'org-z', tenantId: 'tenant-z', programId: 'other', crop: 'maize' }]
  });
  const deployOnly = policy(ledger, {
    logicalId: 'policy.deploy-only', resourceId: 'deploy-only',
    visibilityPolicy: [{ organizationId: 'org-a' }]
  });
  const target = { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'program-1', crop: 'maize', useClass: 'ADVISORY' };

  const inspectable = filterInspectableKnowledge({ principal: reviewer, policies: [visibleOnly, deployOnly], roleAssignments: [reviewerRole] });
  const runtimeUsable = filterRuntimeDeployableKnowledge({ principal: runtime, policies: [visibleOnly, deployOnly], roleAssignments: [runtimeRole], deploymentTarget: target });

  assert.deepEqual(inspectable.map((item) => item.semanticPayload.resourceId), ['visible-only']);
  assert.deepEqual(runtimeUsable.map((item) => item.semanticPayload.resourceId), ['deploy-only']);
});

test('authorization decision is immutable, content-addressed and binds exact policy/assignment refs', () => {
  const ledger = new AuthorityLedger();
  const approver = createPrincipal({ principalId: 'approver-audit', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const assignment = role(ledger, {
    logicalId: 'role.approver-audit', principal: approver, role: 'SCIENTIFIC_APPROVER', scope: { organizationId: 'org-a', tenantId: 'tenant-a' }
  });
  const knowledgePolicy = policy(ledger, { logicalId: 'policy.audit-decision' });
  const decision = authorizeKnowledgeQualification({
    principal: approver,
    policy: knowledgePolicy,
    roleAssignments: [assignment],
    qualificationTarget: { crop: 'maize', useClass: 'ADVISORY' }
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.policyRef.semanticHash, knowledgePolicy.ref.semanticHash);
  assert.ok(decision.assignmentRefs.some((ref) => ref.semanticHash === assignment.ref.semanticHash));
  assert.match(decision.decisionHash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(decision));
  assert.ok(Object.isFrozen(decision.assignmentRefs));
});

test('knowledge governance policy semantics cannot mutate under a published version', () => {
  const ledger = new AuthorityLedger();
  policy(ledger, { logicalId: 'policy.immutable', version: '1', visibilityPolicy: [{ organizationId: 'org-a' }] });
  expectError(() => policy(ledger, {
    logicalId: 'policy.immutable', version: '1', visibilityPolicy: [{ organizationId: 'org-b' }]
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
