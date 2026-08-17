import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  authorizeAuditExport,
  authorizeRetentionManage,
  authorizeSecretManage,
  authorizeSecretUse,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

let seq = 0;
const principal = {
  principalId: 'security-operator-a',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
const auditor = { ...principal, principalId: 'auditor-a', type: 'USER' };
const artifactRef = {
  kind: 'SourceArtifact',
  logicalId: 'artifact-a',
  version: '1',
  semanticHash: `sha256:${'a'.repeat(64)}`
};
function audit(actor = principal, suffix = 'security-auth') {
  seq += 1;
  return {
    eventId: `p07-auth-${suffix}-${seq}`,
    occurredAt: '2026-08-17T14:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}
function tenantScope(resourceType, resourceId, tenantId = 'tenant-a') {
  return { organizationId: 'org-a', tenantId, resourceType, resourceId };
}
function publishSecurityAssignment(ledger, actor = principal, tenantId = 'tenant-a') {
  return publishRoleAssignment({
    ledger,
    logicalId: `role.security.${tenantId}.${actor.principalId}`,
    version: '1',
    principal: actor,
    role: 'SECURITY_OPERATOR',
    roleDefinitionVersion: 'p07-pilot-v1',
    permissions: [PERMISSIONS.SECRET_MANAGE, PERMISSIONS.SECRET_USE, PERMISSIONS.RETENTION_MANAGE],
    scope: { organizationId: 'org-a', tenantId },
    audit: audit(actor, 'security-role')
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('new security permissions exist but no frozen built-in role receives them implicitly', () => {
  assert.equal(PERMISSIONS.SECRET_MANAGE, 'security.secret.manage');
  assert.equal(PERMISSIONS.SECRET_USE, 'security.secret.use');
  assert.equal(PERMISSIONS.RETENTION_MANAGE, 'security.retention.manage');
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.SECRET_MANAGE), false);
    assert.equal(permissions.includes(PERMISSIONS.SECRET_USE), false);
    assert.equal(permissions.includes(PERMISSIONS.RETENTION_MANAGE), false);
  }
});

test('custom SECURITY_OPERATOR assignment grants exact same-tenant secret manage/use and retention control', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishSecurityAssignment(ledger);
  assert.equal(authorizeSecretManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('SECRET', 'provider-key')
  }).allowed, true);
  assert.equal(authorizeSecretUse({
    principal,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('SECRET', 'provider-key')
  }).allowed, true);
  assert.equal(authorizeRetentionManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('RETENTION_POLICY', artifactRef.logicalId),
    artifactRef
  }).allowed, true);
});

test('security permissions are independently scoped and cannot substitute for one another', () => {
  const ledger = new AuthorityLedger();
  const manageOnly = publishRoleAssignment({
    ledger,
    logicalId: 'role.secret-manage-only',
    version: '1',
    principal,
    role: 'SECRET_MANAGER',
    roleDefinitionVersion: 'p07-pilot-v1',
    permissions: [PERMISSIONS.SECRET_MANAGE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit()
  });
  assert.equal(authorizeSecretManage({ principal, roleAssignments: [manageOnly], authorizationScope: tenantScope('SECRET', 'x') }).allowed, true);
  assert.equal(authorizeSecretUse({ principal, roleAssignments: [manageOnly], authorizationScope: tenantScope('SECRET', 'x') }).allowed, false);
  assert.equal(authorizeRetentionManage({
    principal,
    roleAssignments: [manageOnly],
    authorizationScope: tenantScope('RETENTION_POLICY', artifactRef.logicalId),
    artifactRef
  }).allowed, false);
});

test('foreign tenant assignment contributes no security authority even with the right permission', () => {
  const ledger = new AuthorityLedger();
  const foreignPrincipal = { ...principal, principalId: 'security-operator-b', tenantId: 'tenant-b' };
  const foreignAssignment = publishSecurityAssignment(ledger, foreignPrincipal, 'tenant-b');
  const decision = authorizeSecretUse({
    principal,
    roleAssignments: [foreignAssignment],
    authorizationScope: tenantScope('SECRET', 'provider-key')
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('SECRET_USE_PERMISSION_DENIED'));
});

test('AUDITOR audit.read grants tenant-scoped audit export but no secret/retention authority', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.auditor-a',
    version: '1',
    principal: auditor,
    role: 'AUDITOR',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(auditor, 'auditor-role')
  });
  assert.deepEqual(assignment.semanticPayload.permissions, [PERMISSIONS.AUDIT_READ]);
  const roots = [artifactRef];
  const decision = authorizeAuditExport({
    principal: auditor,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('AUDIT_EXPORT', 'export-a'),
    rootRefs: roots
  });
  assert.equal(decision.allowed, true);
  assert.equal(authorizeSecretUse({
    principal: auditor,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('SECRET', 'provider-key')
  }).allowed, false);
});

test('recorded security authorization decisions bind exact RoleAssignment without fake knowledge policy', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishSecurityAssignment(ledger);
  const decision = authorizeSecretManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: tenantScope('SECRET', 'provider-key')
  });
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'recorded-decision') });
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [assignment.ref]);
  const event = ledger.auditFor(recorded.ref).find((item) => item.action === 'AUTHORIZATION_SECRET_MANAGE_ALLOW');
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
console.log(`P07 security authorization acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
