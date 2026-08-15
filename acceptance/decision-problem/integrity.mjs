import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  assertDecisionResultAuthority,
  publishDecisionProblem,
  validateDecisionProblemAuthority
} from '../../packages/decision-problem/src/index.mjs';

let seq = 0;
const principal = {
  principalId: 'agronomist-a',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};

function audit(actorPrincipal = principal, suffix = 'integrity') {
  seq += 1;
  return {
    eventId: `a01-integrity-${suffix}-${seq}`,
    occurredAt: '2026-08-16T01:00:00Z',
    actor: { type: actorPrincipal.type, id: actorPrincipal.principalId }
  };
}

function problem(overrides = {}) {
  return {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: 'IRRIGATION_TIMING',
    targetRef: { organizationId: 'org-a', tenantId: 'tenant-a', fieldId: 'field-1' },
    logicalTime: '2026-08-16T01:00:00Z',
    decisionHorizon: { duration: 'PT72H' },
    objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
    actionSpace: ['WAIT', 'IRRIGATE_NOW'],
    constraints: [],
    usePurpose: 'DECISION_SUPPORT',
    useClass: 'ADVISORY',
    decisionAuthorityMode: 'ADR_POLICY',
    decisionDeadline: '2026-08-16T14:00:00Z',
    ...overrides
  };
}

function roleAssignment(ledger, actor = principal, { permissions = [PERMISSIONS.DECISION_PROBLEM_CREATE], scope } = {}) {
  return publishRoleAssignment({
    ledger,
    logicalId: `role-${actor.organizationId}-${actor.tenantId ?? 'none'}-${permissions.join('-')}`,
    version: '1',
    principal: actor,
    role: 'A01_TEST_ROLE',
    roleDefinitionVersion: 'adr-a01-v1',
    permissions,
    scope: scope ?? {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM'
    },
    audit: audit(actor, 'role')
  });
}

function authorizationDecision(ledger, logicalId, { actor = principal, assignment } = {}) {
  const effectiveAssignment = assignment ?? roleAssignment(ledger, actor);
  return authorizeDecisionProblemCreation({
    principal: actor,
    roleAssignments: [effectiveAssignment],
    authorizationScope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM',
      resourceId: logicalId
    }
  });
}

function authorizationAudit(ledger, logicalId, options = {}) {
  const decision = authorizationDecision(ledger, logicalId, options);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(options.actor ?? principal, `auth-${logicalId}`) });
}

function publishAuthorized(ledger, logicalId, version, decisionProblem, actor = principal, suffix = 'publish') {
  const authRecord = authorizationAudit(ledger, logicalId, { actor });
  return publishDecisionProblem({
    ledger,
    logicalId,
    version,
    problem: decisionProblem,
    principal: actor,
    authorizationDecisionAuditRef: authRecord.ref,
    audit: audit(actor, suffix)
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

test('cross-organization and cross-tenant creation are fail-closed', () => {
  for (const targetRef of [
    { organizationId: 'org-b', tenantId: 'tenant-a', fieldId: 'field-1' },
    { organizationId: 'org-a', tenantId: 'tenant-b', fieldId: 'field-1' }
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishDecisionProblem({
        ledger,
        logicalId: 'dp-scope-denied',
        version: '1',
        problem: problem({ targetRef }),
        principal,
        audit: audit(principal, 'scope')
      }),
      (error) => error?.code === 'DECISION_PROBLEM_TARGET_SCOPE_DENIED'
    );
  }
});

test('DecisionProblem publication requires an exact replayable creation authorization', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-no-auth',
      version: '1',
      problem: problem(),
      principal,
      audit: audit(principal, 'no-auth')
    }),
    (error) => error?.code === 'INVALID_AUTHORITY_REF'
      || error?.code === 'DECISION_PROBLEM_AUTHORIZATION_REQUIRED'
  );
});

test('context.write does not authorize DecisionProblem creation', () => {
  const ledger = new AuthorityLedger();
  const assignment = roleAssignment(ledger, principal, { permissions: [PERMISSIONS.CONTEXT_WRITE] });
  const decision = authorizationDecision(ledger, 'dp-context-write', { assignment });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('DECISION_PROBLEM_CREATE_PERMISSION_DENIED'));
  const denied = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'context-write-denied') });
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-context-write',
      version: '1',
      problem: problem(),
      principal,
      authorizationDecisionAuditRef: denied.ref,
      audit: audit(principal, 'context-write-publish')
    }),
    (error) => error?.code === 'DECISION_PROBLEM_AUTHORIZATION_MISMATCH'
  );
});

test('same-id foreign-tenant RoleAssignment cannot authorize creation', () => {
  const ledger = new AuthorityLedger();
  const foreignPrincipal = { ...principal, tenantId: 'tenant-b' };
  const foreignAssignment = roleAssignment(ledger, foreignPrincipal);
  const decision = authorizationDecision(ledger, 'dp-foreign-tenant', { assignment: foreignAssignment });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('DECISION_PROBLEM_CREATE_PERMISSION_DENIED'));
});

test('creation authorization is bound to exact DecisionProblem logicalId', () => {
  const ledger = new AuthorityLedger();
  const authorization = authorizationAudit(ledger, 'dp-authorized-a');
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-unauthorized-b',
      version: '1',
      problem: problem(),
      principal,
      authorizationDecisionAuditRef: authorization.ref,
      audit: audit(principal, 'resource-id-reuse')
    }),
    (error) => error?.code === 'DECISION_PROBLEM_AUTHORIZATION_MISMATCH'
  );
});

test('audit actor cannot impersonate the creator principal', () => {
  const ledger = new AuthorityLedger();
  const authorization = authorizationAudit(ledger, 'dp-audit-denied');
  const foreignActor = { ...principal, principalId: 'other-user' };
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-audit-denied',
      version: '1',
      problem: problem(),
      principal,
      authorizationDecisionAuditRef: authorization.ref,
      audit: audit(foreignActor, 'actor')
    }),
    (error) => error?.code === 'DECISION_PROBLEM_AUDIT_ACTOR_MISMATCH'
  );
});

test('DecisionProblem rejects agronomic conclusion/runtime-result fields', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-conclusion-denied',
      version: '1',
      problem: problem({ recommendedAction: 'IRRIGATE_NOW' }),
      principal,
      audit: audit(principal, 'conclusion')
    }),
    (error) => error?.code === 'INVALID_DECISION_PROBLEM_FIELD'
  );
});

test('constraints cannot launder downstream conclusion or result authority', () => {
  for (const constraint of [
    { code: 'CUSTOM', recommendedAction: 'IRRIGATE_NOW' },
    { code: 'CUSTOM', parameters: { decision_result: { action: 'WAIT' } } },
    { code: 'CUSTOM', nested: [{ applicabilityAssessment: 'APPLICABLE' }] }
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishDecisionProblem({
        ledger,
        logicalId: 'dp-constraint-laundering',
        version: '1',
        problem: problem({ constraints: [constraint] }),
        principal,
        audit: audit(principal, 'constraint-laundering')
      }),
      (error) => error?.code === 'DECISION_PROBLEM_CONCLUSION_LAUNDERING_FORBIDDEN'
    );
  }
});

test('malformed ISO-8601 horizons are rejected while valid date/time forms remain legal', () => {
  for (const duration of ['P1H', 'PT', 'P1W2D', 'P1WT2H', 'P1D2H']) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishDecisionProblem({
        ledger,
        logicalId: `dp-bad-horizon-${duration}`,
        version: '1',
        problem: problem({ decisionHorizon: { duration } }),
        principal,
        audit: audit(principal, 'bad-horizon')
      }),
      (error) => error?.code === 'INVALID_DECISION_HORIZON'
    );
  }
  for (const duration of ['P3D', 'PT72H', 'P1DT12H', 'P2W']) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(
      ledger,
      `dp-good-horizon-${duration}`,
      '1',
      problem({ decisionHorizon: { duration } }),
      principal,
      'good-horizon'
    );
    assert.equal(record.semanticPayload.decisionHorizon.duration, duration);
  }
});

test('invalid deadline and duplicate action semantics are rejected', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-time-denied',
      version: '1',
      problem: problem({ decisionDeadline: '2026-08-15T23:00:00Z' }),
      principal,
      audit: audit(principal, 'time')
    }),
    (error) => error?.code === 'DECISION_DEADLINE_BEFORE_LOGICAL_TIME'
  );
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-action-denied',
      version: '1',
      problem: problem({ actionSpace: ['WAIT', 'WAIT'] }),
      principal,
      audit: audit(principal, 'action')
    }),
    (error) => error?.code === 'DUPLICATE_DECISION_ACTION'
  );
});

test('RUNTIME_ONLY can never fabricate final DecisionResult authority', () => {
  const ledger = new AuthorityLedger();
  const runtimeOnly = publishAuthorized(ledger, 'dp-runtime-only', '1', problem({ decisionAuthorityMode: 'RUNTIME_ONLY' }), principal, 'runtime-only');
  for (const authorityMode of ['ADR_POLICY', 'EXTERNAL_POLICY']) {
    assert.throws(
      () => assertDecisionResultAuthority({ ledger, decisionProblemRef: runtimeOnly.ref, authorityMode }),
      (error) => error?.code === 'DECISION_RESULT_FORBIDDEN_RUNTIME_ONLY'
    );
  }
});

test('ADR_POLICY and EXTERNAL_POLICY final-decision authority cannot be swapped', () => {
  for (const decisionAuthorityMode of ['ADR_POLICY', 'EXTERNAL_POLICY']) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(
      ledger,
      `dp-${decisionAuthorityMode.toLowerCase()}`,
      '1',
      problem({ decisionAuthorityMode }),
      principal,
      decisionAuthorityMode.toLowerCase()
    );
    assert.equal(assertDecisionResultAuthority({ ledger, decisionProblemRef: record.ref, authorityMode: decisionAuthorityMode }).allowed, true);
    const wrong = decisionAuthorityMode === 'ADR_POLICY' ? 'EXTERNAL_POLICY' : 'ADR_POLICY';
    assert.throws(
      () => assertDecisionResultAuthority({ ledger, decisionProblemRef: record.ref, authorityMode: wrong }),
      (error) => error?.code === 'DECISION_RESULT_AUTHORITY_MISMATCH'
    );
  }
});

test('generic forged AuthorizationDecisionAudit cannot create authority without RoleAssignment input', () => {
  const ledger = new AuthorityLedger();
  const basis = {
    operation: 'DECISION_PROBLEM_CREATE',
    principal,
    assignmentRefs: [],
    request: {
      authorizationScope: {
        organizationId: 'org-a',
        tenantId: 'tenant-a',
        resourceType: 'DECISION_PROBLEM',
        resourceId: 'dp-forged-auth'
      }
    },
    allowed: true,
    reasons: []
  };
  const forged = ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: 'forged-a01-auth',
    version: '1',
    semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) },
    audit: { ...audit(principal, 'forged-auth'), action: 'AUTHORIZATION_DECISION_PROBLEM_CREATE_ALLOW', inputRefs: [] }
  });
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-forged-auth',
      version: '1',
      problem: problem(),
      principal,
      authorizationDecisionAuditRef: forged.ref,
      audit: audit(principal, 'forged-auth-publish')
    }),
    (error) => error?.code === 'DECISION_PROBLEM_AUTHORIZATION_ASSIGNMENT_REQUIRED'
  );
});

test('copying A01 audit vocabulary cannot launder a generic-ledger DecisionProblem', () => {
  const ledger = new AuthorityLedger();
  const basis = {
    operation: 'DECISION_PROBLEM_CREATE',
    principal,
    assignmentRefs: [],
    request: { authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'DECISION_PROBLEM', resourceId: 'dp-laundered' } },
    allowed: true,
    reasons: []
  };
  const forgedAuth = ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: 'forged-a01-auth-launder',
    version: '1',
    semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) },
    audit: { ...audit(principal, 'forged-auth-launder'), action: 'AUTHORIZATION_DECISION_PROBLEM_CREATE_ALLOW', inputRefs: [] }
  });
  const targetRef = { organizationId: 'org-a', tenantId: 'tenant-a', fieldId: 'field-1' };
  const malformed = ledger.publish({
    kind: 'DecisionProblem',
    logicalId: 'dp-laundered',
    version: '1',
    semanticPayload: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      authorityClass: 'DECISION_SCOPE',
      decisionType: 'IRRIGATION_TIMING',
      targetRef,
      logicalTime: '2026-08-16T01:00:00.000Z',
      decisionHorizon: { duration: 'PT72H' },
      objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
      actionSpace: ['IRRIGATE_NOW', 'WAIT'],
      constraints: [],
      usePurpose: 'DECISION_SUPPORT',
      useClass: 'ADVISORY',
      decisionAuthorityMode: 'ADR_POLICY',
      decisionDeadline: '2026-08-16T14:00:00.000Z'
    },
    audit: {
      ...audit(principal, 'laundered'),
      action: 'PUBLISH_DECISION_PROBLEM',
      inputRefs: [forgedAuth.ref],
      details: {
        creationPrincipal: principal,
        targetScope: targetRef,
        authorizationDecisionAuditRef: forgedAuth.ref,
        authorityClass: 'DECISION_SCOPE'
      }
    }
  });
  assert.throws(
    () => validateDecisionProblemAuthority({ ledger, decisionProblemRef: malformed.ref }),
    (error) => error?.code === 'DECISION_PROBLEM_AUDIT_INVALID'
  );
});

console.log('DecisionProblem integrity acceptance: 14 passed');
