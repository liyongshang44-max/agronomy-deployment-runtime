import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  BUILTIN_ROLES,
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';

let seq = 0;
const principal = {
  principalId: 'planner-a',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};

function audit(actor = principal, suffix = 'scoped') {
  seq += 1;
  return {
    eventId: `f03-scoped-${suffix}-${seq}`,
    occurredAt: '2026-08-16T01:00:00Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}

function assignment(ledger, {
  actor = principal,
  permissions = [PERMISSIONS.DECISION_PROBLEM_CREATE],
  scope = { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'DECISION_PROBLEM' },
  logicalId = 'role-decision-problem-create'
} = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal: actor,
    role: 'DECISION_PROBLEM_CREATOR',
    roleDefinitionVersion: 'adr-a01-v1',
    permissions,
    scope,
    audit: audit(actor, 'role')
  });
}

function decision(roleAssignments, overrides = {}) {
  return authorizeDecisionProblemCreation({
    principal: overrides.principal ?? principal,
    roleAssignments,
    authorizationScope: overrides.authorizationScope ?? {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'DECISION_PROBLEM',
      resourceId: 'dp-1'
    }
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('DecisionProblem create permission is not silently added to any built-in role', () => {
  for (const permissions of Object.values(BUILTIN_ROLES)) {
    assert.equal(permissions.includes(PERMISSIONS.DECISION_PROBLEM_CREATE), false);
  }
});

test('explicit decision.problem.create RoleAssignment authorizes exact scoped resource', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger);
  const result = decision([grant]);
  assert.equal(result.allowed, true);
  assert.equal(result.operation, 'DECISION_PROBLEM_CREATE');
  assert.equal(result.policyRef, undefined);
  assert.equal(result.request.authorizationScope.resourceId, 'dp-1');
  assert.deepEqual(result.assignmentRefs, [grant.ref]);
});

test('context.write is not interchangeable with decision.problem.create', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, {
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    logicalId: 'role-context-write-only'
  });
  const result = decision([grant]);
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('DECISION_PROBLEM_CREATE_PERMISSION_DENIED'));
});

test('resource-scoped RoleAssignment cannot authorize a different DecisionProblem logical id', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, {
    scope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'DECISION_PROBLEM',
      resourceId: 'dp-1'
    },
    logicalId: 'role-dp-1-only'
  });
  assert.equal(decision([grant]).allowed, true);
  const other = decision([grant], {
    authorizationScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'DECISION_PROBLEM',
      resourceId: 'dp-2'
    }
  });
  assert.equal(other.allowed, false);
  assert(other.reasons.includes('DECISION_PROBLEM_CREATE_PERMISSION_DENIED'));
});

test('same principal id/type in another tenant cannot contribute RoleAssignment authority', () => {
  const ledger = new AuthorityLedger();
  const foreign = { ...principal, tenantId: 'tenant-b' };
  const grant = assignment(ledger, {
    actor: foreign,
    scope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'DECISION_PROBLEM' },
    logicalId: 'role-foreign-tenant'
  });
  const result = decision([grant]);
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('DECISION_PROBLEM_CREATE_PERMISSION_DENIED'));
});

test('scoped AuthorizationDecisionAudit retains exact RoleAssignment inputs without fake policyRef', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger);
  const result = decision([grant]);
  const recorded = recordAuthorizationDecision({ ledger, decision: result, audit: audit(principal, 'decision') });
  assert.equal(recorded.ref.kind, 'AuthorizationDecisionAudit');
  assert.equal(recorded.semanticPayload.policyRef, undefined);
  assert.deepEqual(recorded.semanticPayload.assignmentRefs, [grant.ref]);
  const directAudit = ledger.auditFor(recorded.ref).find((event) => event.action === 'AUTHORIZATION_DECISION_PROBLEM_CREATE_ALLOW');
  assert(directAudit);
  assert(directAudit.inputRefs.some((ref) => ref.semanticHash === grant.ref.semanticHash));
});

console.log('Scoped authorization acceptance: 6 passed');
