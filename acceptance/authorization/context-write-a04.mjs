import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { PERMISSIONS, publishRoleAssignment, recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';

let seq = 0;
const principal = {
  principalId: 'context-resolver-a04',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
function audit(suffix = 'a04') {
  seq += 1;
  return { eventId: `f03-context-a04-${suffix}-${seq}`, occurredAt: '2026-08-16T02:40:00Z', actor: { type: principal.type, id: principal.principalId } };
}
function assignment(ledger, { resourceType = 'CONTEXT_MANIFEST', resourceId, permissions = [PERMISSIONS.CONTEXT_WRITE], actor = principal, logicalId = 'role-a04-manifest' } = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'A04_CONTEXT_WRITER',
    roleDefinitionVersion: 'adr-a04-v1',
    permissions,
    scope: {
      organizationId: actor.organizationId,
      tenantId: actor.tenantId,
      resourceType,
      ...(resourceId ? { resourceId } : {})
    },
    audit: audit('role')
  });
}
function request(resourceId = 'cm-1', overrides = {}) {
  return { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_MANIFEST', resourceId, ...overrides };
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('context.write authorizes exact ContextManifest logical id', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger);
  const decision = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') });
  assert.equal(decision.allowed, true);
  assert.equal(decision.request.authorizationScope.resourceType, 'CONTEXT_MANIFEST');
  assert.equal(decision.request.authorizationScope.resourceId, 'cm-1');
});

test('resource-scoped ContextManifest grant cannot authorize another manifest id', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, { resourceId: 'cm-1' });
  assert.equal(authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') }).allowed, true);
  const denied = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-2') });
  assert.equal(denied.allowed, false);
  assert(denied.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('ContextDatum grant cannot authorize ContextManifest publication', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, { resourceType: 'CONTEXT_DATUM', logicalId: 'role-a04-datum-only' });
  const denied = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') });
  assert.equal(denied.allowed, false);
  assert(denied.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('decision.problem.create cannot substitute for ContextManifest context.write', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, { permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE], logicalId: 'role-a04-dp-only' });
  const denied = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') });
  assert.equal(denied.allowed, false);
  assert(denied.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('same principal id/type from another tenant contributes no ContextManifest authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = { ...principal, tenantId: 'tenant-b' };
  const grant = assignment(ledger, { actor: foreign, logicalId: 'role-a04-foreign' });
  const denied = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') });
  assert.equal(denied.allowed, false);
  assert(denied.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('ContextManifest AuthorizationDecisionAudit binds exact RoleAssignment with no fake knowledge policy', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger);
  const decision = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('cm-1') });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit('decision') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [grant.ref]);
  const direct = ledger.auditFor(recorded.ref).find((event) => event.action === 'AUTHORIZATION_CONTEXT_WRITE_ALLOW');
  assert(direct);
  assert(direct.inputRefs.some((ref) => ref.semanticHash === grant.ref.semanticHash));
});

console.log('Context write A04 resource acceptance: 6 passed');
