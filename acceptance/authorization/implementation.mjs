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
  authorizeImplementationManage,
  IMPLEMENTATION_RESOURCE_TYPE
} from '../../packages/authorization/src/implementation-control.mjs';

let seq = 0;
function audit(actorId = 'iam-admin', actorType = 'USER') {
  seq += 1;
  return {
    eventId: `s02-auth-${seq}`,
    occurredAt: '2026-08-16T14:00:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'implementation-authorization' }
  };
}
const principal = createPrincipal({
  principalId: 'implementation-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
function scope(resourceId = 'impl-a', tenantId = 'tenant-a') {
  return { organizationId: 'org-a', tenantId, resourceType: 'IMPLEMENTATION', resourceId };
}
function role(ledger, {
  logicalId = 'role.implementation-manager',
  permissions = [PERMISSIONS.IMPLEMENTATION_MANAGE],
  roleScope = { organizationId: 'org-a', tenantId: 'tenant-a' },
  actor = principal
} = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions,
    scope: roleScope,
    audit: audit()
  });
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('implementation.manage is a known F03 permission with one closed resource type', () => {
  assert.equal(PERMISSIONS.IMPLEMENTATION_MANAGE, 'implementation.manage');
  assert.equal(IMPLEMENTATION_RESOURCE_TYPE, 'IMPLEMENTATION');
});

test('no frozen built-in role silently receives implementation.manage', () => {
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.IMPLEMENTATION_MANAGE), false);
  }
});

test('explicit implementation.manage RoleAssignment authorizes exact implementation resource', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.assignmentRefs, [assignment.ref]);
});

test('specification.manage runtime.profile.manage and deployment permissions cannot substitute for implementation.manage', () => {
  for (const permission of [PERMISSIONS.SPECIFICATION_MANAGE, PERMISSIONS.RUNTIME_PROFILE_MANAGE, PERMISSIONS.KNOWLEDGE_DEPLOY]) {
    const ledger = new AuthorityLedger();
    const assignment = role(ledger, { permissions: [permission] });
    const decision = authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
    assert.equal(decision.allowed, false, permission);
    assert(decision.reasons.includes('IMPLEMENTATION_MANAGE_PERMISSION_DENIED'));
  }
});

test('resource-scoped implementation assignment cannot cross logical id', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger, { roleScope: scope('impl-a') });
  assert.equal(authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('impl-a') }).allowed, true);
  assert.equal(authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('impl-b') }).allowed, false);
});

test('implementation authorization rejects non-Implementation resource types', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  assert.throws(
    () => authorizeImplementationManage({
      principal,
      roleAssignments: [assignment],
      authorizationScope: { ...scope(), resourceType: 'MODEL' }
    }),
    (error) => error?.code === 'INVALID_IMPLEMENTATION_RESOURCE_TYPE'
  );
});

test('foreign-tenant RoleAssignment contributes no implementation authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = createPrincipal({ principalId: principal.principalId, type: principal.type, organizationId: 'org-a', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.implementation.foreign',
    actor: foreign,
    roleScope: { organizationId: 'org-a', tenantId: 'tenant-b' }
  });
  const decision = authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
});

test('recorded implementation management decision binds exact RoleAssignment and no fake policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeImplementationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit('iam-engine', 'SERVICE_ACCOUNT') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_IMPLEMENTATION_MANAGE_ALLOW');
  assert(event);
  assert.deepEqual(event.inputRefs, [assignment.ref]);
});

console.log('Implementation authorization acceptance: 8 passed');
