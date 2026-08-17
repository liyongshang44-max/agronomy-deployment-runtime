import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  authorizeOutcomeEvaluation,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

let seq = 0;
const evaluator = {
  principalId: 'outcome-evaluator-auth',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
function audit(actor = evaluator, suffix = 'outcome-evaluate') {
  seq += 1;
  return {
    eventId: `e02-auth-${suffix}-${seq}`,
    occurredAt: '2026-09-21T09:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}
function scope(resourceId = 'outcome-evaluation:test') {
  return {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'OUTCOME_EVALUATION',
    resourceId
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('OUTCOME_EVALUATION_SERVICE carries only dedicated outcome.evaluate authority', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.outcome-evaluator',
    version: '1',
    principal: evaluator,
    role: 'OUTCOME_EVALUATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME_EVALUATION' },
    audit: audit()
  });
  assert.deepEqual(assignment.semanticPayload.permissions, [PERMISSIONS.OUTCOME_EVALUATE]);
  assert.equal(authorizeOutcomeEvaluation({ evaluator, principal: evaluator, roleAssignments: [assignment], authorizationScope: scope() }).allowed, true);
});

test('OUTCOME_INGRESS_SERVICE outcome.write authority cannot substitute for outcome.evaluate', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.outcome-ingress-only',
    version: '1',
    principal: evaluator,
    role: 'OUTCOME_INGRESS_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME_EVALUATION' },
    audit: audit()
  });
  assert.deepEqual(assignment.semanticPayload.permissions, [PERMISSIONS.OUTCOME_WRITE]);
  const decision = authorizeOutcomeEvaluation({ principal: evaluator, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('OUTCOME_EVALUATE_PERMISSION_DENIED'));
});

test('resource-scoped outcome.evaluate assignment cannot cross deterministic evaluation id', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.outcome-evaluate-exact',
    version: '1',
    principal: evaluator,
    role: 'OUTCOME_EVALUATOR',
    roleDefinitionVersion: 'e02-v1',
    permissions: [PERMISSIONS.OUTCOME_EVALUATE],
    scope: scope('outcome-evaluation:a'),
    audit: audit()
  });
  assert.equal(authorizeOutcomeEvaluation({ principal: evaluator, roleAssignments: [assignment], authorizationScope: scope('outcome-evaluation:a') }).allowed, true);
  assert.equal(authorizeOutcomeEvaluation({ principal: evaluator, roleAssignments: [assignment], authorizationScope: scope('outcome-evaluation:b') }).allowed, false);
});

test('foreign-tenant outcome.evaluate assignment contributes no authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = { ...evaluator, tenantId: 'tenant-b' };
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.outcome-evaluate-foreign',
    version: '1',
    principal: foreign,
    role: 'OUTCOME_EVALUATOR',
    roleDefinitionVersion: 'e02-v1',
    permissions: [PERMISSIONS.OUTCOME_EVALUATE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'OUTCOME_EVALUATION' },
    audit: audit(foreign)
  });
  const decision = authorizeOutcomeEvaluation({ principal: evaluator, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('OUTCOME_EVALUATE_PERMISSION_DENIED'));
});

test('recorded outcome.evaluate decision binds exact RoleAssignment and no fake knowledge policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.outcome-evaluate-audit',
    version: '1',
    principal: evaluator,
    role: 'OUTCOME_EVALUATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME_EVALUATION' },
    audit: audit()
  });
  const decision = authorizeOutcomeEvaluation({ principal: evaluator, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(evaluator, 'decision') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_OUTCOME_EVALUATE_ALLOW');
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
console.log(`OutcomeEvaluation authorization acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
