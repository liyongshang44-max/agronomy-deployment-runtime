import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';

let seq = 0;
const principal = { principalId: 'integration-a', type: 'SERVICE_ACCOUNT', organizationId: 'org-a', tenantId: 'tenant-a', programIds: [] };
function audit(actor = principal, suffix = 'ctx') {
  seq += 1;
  return { eventId: `f03-context-${suffix}-${seq}`, occurredAt: '2026-08-16T02:00:00Z', actor: { type: actor.type, id: actor.principalId } };
}
function scope(resourceId = 'ctx-1') {
  return { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM', resourceId };
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('INTEGRATION_SERVICE frozen built-in role carries context.write', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'integration-role',
    version: '1',
    principal,
    role: 'INTEGRATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM' },
    audit: audit()
  });
  const result = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.assignmentRefs, [assignment.ref]);
});

test('decision.problem.create cannot substitute for context.write', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'wrong-role',
    version: '1',
    principal,
    role: 'WRONG_PERMISSION',
    roleDefinitionVersion: 'test',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM' },
    audit: audit()
  });
  const result = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('context.write RoleAssignment may be broad while decision freezes exact ContextDatum id', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'broad-context-role',
    version: '1',
    principal,
    role: 'CONTEXT_WRITER',
    roleDefinitionVersion: 'test',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM' },
    audit: audit()
  });
  const a = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('ctx-a') });
  const b = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('ctx-b') });
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
  assert.notEqual(a.decisionHash, b.decisionHash);
  assert.equal(a.request.authorizationScope.resourceId, 'ctx-a');
});

test('resource-scoped context.write assignment cannot cross exact ContextDatum id', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'exact-context-role',
    version: '1',
    principal,
    role: 'CONTEXT_WRITER',
    roleDefinitionVersion: 'test',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: { ...scope('ctx-a') },
    audit: audit()
  });
  assert.equal(authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('ctx-a') }).allowed, true);
  assert.equal(authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope('ctx-b') }).allowed, false);
});

test('same id/type RoleAssignment in another tenant contributes no context.write authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = { ...principal, tenantId: 'tenant-b' };
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'foreign-context-role',
    version: '1',
    principal: foreign,
    role: 'CONTEXT_WRITER',
    roleDefinitionVersion: 'test',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'CONTEXT_DATUM' },
    audit: audit(foreign)
  });
  const result = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('scoped context-write decision audit binds exact RoleAssignment and no fake policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'integration-role-audit',
    version: '1',
    principal,
    role: 'INTEGRATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM' },
    audit: audit()
  });
  const decision = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'decision') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_CONTEXT_WRITE_ALLOW');
  assert(event);
  assert(event.inputRefs.some((ref) => ref.semanticHash === assignment.ref.semanticHash));
});

console.log('Context write authorization acceptance: 6 passed');
