import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  authorizeOutcomeWrite,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

let seq = 0;
const principal = {
  principalId: 'outcome-ingress-auth',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
function audit(actor = principal, suffix = 'outcome-auth') {
  seq += 1;
  return {
    eventId: `e01-auth-${suffix}-${seq}`,
    occurredAt: '2026-08-20T13:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}
function scope(resourceId = 'outcome:test') {
  return {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'OUTCOME',
    resourceId
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('OUTCOME_INGRESS_SERVICE frozen built-in role carries only dedicated outcome.write authority', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.outcome-ingress',
    version: '1',
    principal,
    role: 'OUTCOME_INGRESS_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME' },
    audit: audit()
  });
  assert.deepEqual(assignment.semanticPayload.permissions, [PERMISSIONS.OUTCOME_WRITE]);
  const decision = authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, true);
});

test('legacy INTEGRATION_SERVICE context.write authority cannot substitute for outcome.write', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.context-integration',
    version: '1',
    principal,
    role: 'INTEGRATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME' },
    audit: audit()
  });
  assert.deepEqual(assignment.semanticPayload.permissions, [PERMISSIONS.CONTEXT_WRITE]);
  const decision = authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('OUTCOME_WRITE_PERMISSION_DENIED'));
});

test('resource-scoped outcome.write assignment cannot cross deterministic Outcome id', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.outcome-exact',
    version: '1',
    principal,
    role: 'OUTCOME_WRITER',
    roleDefinitionVersion: 'e01-v1',
    permissions: [PERMISSIONS.OUTCOME_WRITE],
    scope: scope('outcome:a'),
    audit: audit()
  });
  assert.equal(authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('outcome:a') }).allowed, true);
  assert.equal(authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('outcome:b') }).allowed, false);
});

test('foreign-tenant outcome.write assignment contributes no authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = { ...principal, tenantId: 'tenant-b' };
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.outcome-foreign',
    version: '1',
    principal: foreign,
    role: 'OUTCOME_WRITER',
    roleDefinitionVersion: 'e01-v1',
    permissions: [PERMISSIONS.OUTCOME_WRITE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'OUTCOME' },
    audit: audit(foreign)
  });
  const decision = authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('OUTCOME_WRITE_PERMISSION_DENIED'));
});

test('recorded outcome.write decision binds exact RoleAssignment and no fake knowledge policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.outcome-audit',
    version: '1',
    principal,
    role: 'OUTCOME_INGRESS_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME' },
    audit: audit()
  });
  const decision = authorizeOutcomeWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'decision') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_OUTCOME_WRITE_ALLOW');
  assert.ok(event);
  assert.ok(event.inputRefs.some((ref) => ref.semanticHash === assignment.ref.semanticHash));
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`Outcome write authorization acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
