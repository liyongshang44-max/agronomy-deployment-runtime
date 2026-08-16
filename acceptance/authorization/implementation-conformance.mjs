import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  authorizeImplementationConformanceQualification,
  authorizeImplementationConformanceControl,
  IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE
} from '../../packages/authorization/src/implementation-conformance-control.mjs';

let seq = 0;
function audit(actorId = 'iam-admin', actorType = 'USER') {
  seq += 1;
  return {
    eventId: `s03-auth-${seq}`,
    occurredAt: '2026-08-16T14:30:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'implementation-conformance-authorization' }
  };
}
const principal = createPrincipal({
  principalId: 'conformance-qualifier', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
function scope(resourceId = 'conformance-a', tenantId = 'tenant-a') {
  return { organizationId: 'org-a', tenantId, resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId };
}
function role(ledger, {
  logicalId = 'role.conformance-qualifier',
  permissions = [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
  roleScope = { organizationId: 'org-a', tenantId: 'tenant-a' },
  actor = principal
} = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions,
    scope: roleScope,
    audit: audit()
  });
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('implementation.conformance.qualify is a known permission with closed resource type', () => {
  assert.equal(PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY, 'implementation.conformance.qualify');
  assert.equal(IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE, 'IMPLEMENTATION_CONFORMANCE');
});

test('no frozen built-in role silently receives conformance qualification authority', () => {
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY), false);
  }
});

test('explicit conformance qualification RoleAssignment authorizes exact conformance resource', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.assignmentRefs, [assignment.ref]);
});

test('implementation.manage specification.manage and knowledge.qualify cannot substitute for conformance qualification', () => {
  for (const permission of [PERMISSIONS.IMPLEMENTATION_MANAGE, PERMISSIONS.SPECIFICATION_MANAGE, PERMISSIONS.KNOWLEDGE_QUALIFY]) {
    const ledger = new AuthorityLedger();
    const assignment = role(ledger, { permissions: [permission] });
    const decision = authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope() });
    assert.equal(decision.allowed, false, permission);
    assert(decision.reasons.includes('CONFORMANCE_QUALIFICATION_PERMISSION_DENIED'));
  }
});

test('resource-scoped qualifier cannot cross conformance logical id', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger, { roleScope: scope('conformance-a') });
  assert.equal(authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope('conformance-a') }).allowed, true);
  assert.equal(authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope('conformance-b') }).allowed, false);
});

test('foreign-tenant RoleAssignment contributes no conformance authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = createPrincipal({ principalId: principal.principalId, type: principal.type, organizationId: 'org-a', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.conformance.foreign',
    actor: foreign,
    roleScope: { organizationId: 'org-a', tenantId: 'tenant-b' }
  });
  const decision = authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
});

test('same explicit qualification permission separately authorizes REVOKE and SUPERSEDE controls', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  for (const action of ['REVOKE', 'SUPERSEDE']) {
    const decision = authorizeImplementationConformanceControl({ action, principal, roleAssignments: [assignment], authorizationScope: scope() });
    assert.equal(decision.allowed, true, action);
    assert.equal(decision.operation, `IMPLEMENTATION_CONFORMANCE_${action}`);
  }
});

test('recorded conformance authorization binds exact RoleAssignment and no fake policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeImplementationConformanceQualification({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit('iam-engine', 'SERVICE_ACCOUNT') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_IMPLEMENTATION_CONFORMANCE_QUALIFY_ALLOW');
  assert(event);
  assert.deepEqual(event.inputRefs, [assignment.ref]);
});

console.log('ImplementationConformance authorization acceptance: 8 passed');
