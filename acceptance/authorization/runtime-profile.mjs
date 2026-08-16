import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeRuntimeProfileManage } from '../../packages/authorization/src/runtime-profile-control.mjs';

let seq = 0;
function audit(actorId = 'iam-admin', actorType = 'USER') {
  seq += 1;
  return {
    eventId: `a05-auth-${seq}`,
    occurredAt: '2026-08-16T10:00:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'runtime-profile-authorization' }
  };
}
const principal = createPrincipal({
  principalId: 'profile-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
function scope(resourceId = 'rp-1') {
  return {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'RUNTIME_PROFILE',
    resourceId
  };
}
function role(ledger, {
  logicalId = 'role.runtime-profile',
  permissions = [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  roleScope = { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'RUNTIME_PROFILE' },
  actor = principal
} = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'RUNTIME_PROFILE_MANAGER',
    roleDefinitionVersion: 'a05-v1',
    permissions,
    scope: roleScope,
    audit: audit()
  });
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('runtime.profile.manage is a known F03 permission', () => {
  assert.equal(PERMISSIONS.RUNTIME_PROFILE_MANAGE, 'runtime.profile.manage');
});

test('no frozen built-in role silently receives runtime.profile.manage', () => {
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.RUNTIME_PROFILE_MANAGE), false);
  }
});

test('explicit runtime.profile.manage RoleAssignment authorizes exact profile resource', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope('rp-a')
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.assignmentRefs, [assignment.ref]);
});

test('knowledge.deploy cannot substitute for runtime.profile.manage', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger, {
    permissions: [PERMISSIONS.KNOWLEDGE_DEPLOY]
  });
  const decision = authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope()
  });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('RUNTIME_PROFILE_MANAGE_PERMISSION_DENIED'));
});

test('runtime.profile.manage decision freezes exact RuntimeProfile logical id', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const a = authorizeRuntimeProfileManage({ principal, roleAssignments: [assignment], authorizationScope: scope('rp-a') });
  const b = authorizeRuntimeProfileManage({ principal, roleAssignments: [assignment], authorizationScope: scope('rp-b') });
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
  assert.notEqual(a.decisionHash, b.decisionHash);
  assert.equal(a.request.authorizationScope.resourceId, 'rp-a');
});

test('resource-scoped RoleAssignment cannot manage another RuntimeProfile id', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger, { roleScope: scope('rp-a') });
  assert.equal(authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope('rp-a')
  }).allowed, true);
  assert.equal(authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope('rp-b')
  }).allowed, false);
});

test('foreign-tenant RoleAssignment contributes no RuntimeProfile authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = createPrincipal({
    principalId: principal.principalId,
    type: principal.type,
    organizationId: 'org-a',
    tenantId: 'tenant-b'
  });
  const assignment = role(ledger, {
    logicalId: 'role.foreign-runtime-profile',
    actor: foreign,
    roleScope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'RUNTIME_PROFILE' }
  });
  const decision = authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope()
  });
  assert.equal(decision.allowed, false);
});

test('recorded RuntimeProfile management decision carries exact RoleAssignment and no fake policyRef', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeRuntimeProfileManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: scope()
  });
  const recorded = recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_RUNTIME_PROFILE_MANAGE_ALLOW');
  assert(event);
});

console.log('RuntimeProfile authorization acceptance: 8 passed');
