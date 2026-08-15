import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-15T13:10:00.000Z',
    actor: { type: 'USER', id: 'iam-admin' },
    details: { channel: 'authorization-integrity-acceptance' }
  };
}

function publicPolicy(ledger, logicalId = 'policy.integrity') {
  return publishKnowledgeGovernancePolicy({
    ledger,
    logicalId,
    version: '1',
    resourceId: 'knowledge.integrity',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ public: true }],
    qualificationScope: [{ crop: '*' }],
    deploymentScope: [{ organizationId: '*', tenantId: '*', programId: '*', crop: '*' }],
    audit: audit(`evt-${logicalId}`)
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('same principalId cannot reuse a role assignment after changing organization/tenant identity', () => {
  const ledger = new AuthorityLedger();
  const assignedPrincipal = createPrincipal({
    principalId: 'user-shared-id',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.identity-bound',
    version: '1',
    principal: assignedPrincipal,
    role: 'AGRONOMY_REVIEWER',
    scope: { platform: true },
    audit: audit('evt-role-identity-bound')
  });
  const policy = publicPolicy(ledger);

  const impersonatedIdentity = createPrincipal({
    principalId: 'user-shared-id',
    type: 'USER',
    organizationId: 'org-b',
    tenantId: 'tenant-b'
  });
  const decision = authorizeKnowledgeInspection({
    principal: impersonatedIdentity,
    policy,
    roleAssignments: [role],
    authorizationScope: { platform: true }
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('ROLE_PERMISSION_DENIED'));
});

test('authorization decision can be recorded with exact policy/role refs in the shared audit substrate', () => {
  const ledger = new AuthorityLedger();
  const principal = createPrincipal({
    principalId: 'reviewer-audit',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.reviewer-audit',
    version: '1',
    principal,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-role-reviewer-audit')
  });
  const policy = publicPolicy(ledger, 'policy.authorization-audit');
  const decision = authorizeKnowledgeInspection({ principal, policy, roleAssignments: [role] });
  assert.equal(decision.allowed, true);

  const auditRecord = recordAuthorizationDecision({
    ledger,
    decision,
    audit: {
      eventId: 'evt-authz-decision',
      occurredAt: '2026-08-15T13:11:00.000Z',
      actor: { type: 'SERVICE_ACCOUNT', id: 'authorization-service' }
    }
  });

  assert.equal(auditRecord.ref.kind, 'AuthorizationDecisionAudit');
  assert.equal(auditRecord.semanticPayload.decisionHash, decision.decisionHash);
  const events = ledger.auditFor(auditRecord.ref);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'AUTHORIZATION_KNOWLEDGE_INSPECT_ALLOW');
  assert.ok(events[0].inputRefs.some((ref) => ref.semanticHash === policy.ref.semanticHash));
  assert.ok(events[0].inputRefs.some((ref) => ref.semanticHash === role.ref.semanticHash));
});

test('program membership is contextual and does not change stable principal identity for an existing role assignment', () => {
  const ledger = new AuthorityLedger();
  const assignedPrincipal = createPrincipal({
    principalId: 'reviewer-program-membership',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: []
  });
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.program-membership',
    version: '1',
    principal: assignedPrincipal,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-role-program-membership')
  });
  const policy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.program-visibility',
    version: '1',
    resourceId: 'knowledge.program-visible',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ programId: 'program-x' }],
    qualificationScope: [{ crop: '*' }],
    deploymentScope: [{ organizationId: '*' }],
    audit: audit('evt-policy-program-visibility')
  });

  const sameIdentityWithMembership = createPrincipal({
    principalId: 'reviewer-program-membership',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['program-x']
  });
  const decision = authorizeKnowledgeInspection({
    principal: sameIdentityWithMembership,
    policy,
    roleAssignments: [role]
  });

  assert.equal(decision.allowed, true);
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
