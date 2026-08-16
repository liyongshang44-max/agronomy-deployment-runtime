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
  authorizeSpecificationManage,
  SPECIFICATION_RESOURCE_TYPES
} from '../../packages/authorization/src/specification-control.mjs';

let seq = 0;
function audit(actorId = 'iam-admin', actorType = 'USER') {
  seq += 1;
  return {
    eventId: `s01-auth-${seq}`,
    occurredAt: '2026-08-16T13:45:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'specification-authorization' }
  };
}
const principal = createPrincipal({ principalId: 'spec-manager', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
function scope(resourceType = 'MODEL', resourceId = 'model-a', tenantId = 'tenant-a') {
  return { organizationId: 'org-a', tenantId, resourceType, resourceId };
}
function role(ledger, {
  logicalId = 'role.spec-manager',
  permissions = [PERMISSIONS.SPECIFICATION_MANAGE],
  roleScope = { organizationId: 'org-a', tenantId: 'tenant-a' },
  actor = principal
} = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions,
    scope: roleScope,
    audit: audit()
  });
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('specification.manage is a known F03 permission and resource vocabulary is closed', () => {
  assert.equal(PERMISSIONS.SPECIFICATION_MANAGE, 'specification.manage');
  assert.deepEqual(SPECIFICATION_RESOURCE_TYPES, ['QUALIFIED_TRANSFORMATION', 'MODEL', 'POLICY']);
});

test('no frozen built-in role silently receives specification.manage', () => {
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.SPECIFICATION_MANAGE), false);
  }
});

test('explicit specification.manage RoleAssignment authorizes each exact specification type', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  for (const resourceType of SPECIFICATION_RESOURCE_TYPES) {
    const decision = authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope(resourceType, `${resourceType}-1`) });
    assert.equal(decision.allowed, true, resourceType);
    assert.deepEqual(decision.assignmentRefs, [assignment.ref]);
  }
});

test('knowledge.qualify runtime.profile.manage and context.write cannot substitute for specification.manage', () => {
  for (const permission of [PERMISSIONS.KNOWLEDGE_QUALIFY, PERMISSIONS.RUNTIME_PROFILE_MANAGE, PERMISSIONS.CONTEXT_WRITE]) {
    const ledger = new AuthorityLedger();
    const assignment = role(ledger, { permissions: [permission] });
    const decision = authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
    assert.equal(decision.allowed, false, permission);
    assert(decision.reasons.includes('SPECIFICATION_MANAGE_PERMISSION_DENIED'));
  }
});

test('resource-scoped assignment cannot cross specification id or type', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger, { roleScope: scope('MODEL', 'model-a') });
  assert.equal(authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('MODEL', 'model-a') }).allowed, true);
  assert.equal(authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('MODEL', 'model-b') }).allowed, false);
  assert.equal(authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('POLICY', 'model-a') }).allowed, false);
});

test('unsupported specification resource type fails closed', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  assert.throws(
    () => authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope('IMPLEMENTATION', 'impl-a') }),
    (error) => error?.code === 'INVALID_SPECIFICATION_RESOURCE_TYPE'
  );
});

test('foreign-tenant RoleAssignment contributes no specification authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = createPrincipal({ principalId: principal.principalId, type: principal.type, organizationId: 'org-a', tenantId: 'tenant-b' });
  const assignment = role(ledger, {
    logicalId: 'role.spec.foreign',
    actor: foreign,
    roleScope: { organizationId: 'org-a', tenantId: 'tenant-b' }
  });
  const decision = authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  assert.equal(decision.allowed, false);
});

test('recorded specification management decision binds exact RoleAssignment and no fake knowledge policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = role(ledger);
  const decision = authorizeSpecificationManage({ principal, roleAssignments: [assignment], authorizationScope: scope() });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit('iam-engine', 'SERVICE_ACCOUNT') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_SPECIFICATION_MANAGE_ALLOW');
  assert(event);
  assert.deepEqual(event.inputRefs, [assignment.ref]);
});

console.log('Specification authorization acceptance: 8 passed');
