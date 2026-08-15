import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
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

test('audit actor cannot impersonate the creator principal', () => {
  const ledger = new AuthorityLedger();
  const foreignActor = { ...principal, principalId: 'other-user' };
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-audit-denied',
      version: '1',
      problem: problem(),
      principal,
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
  const runtimeOnly = publishDecisionProblem({
    ledger,
    logicalId: 'dp-runtime-only',
    version: '1',
    problem: problem({ decisionAuthorityMode: 'RUNTIME_ONLY' }),
    principal,
    audit: audit(principal, 'runtime-only')
  });
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
    const record = publishDecisionProblem({
      ledger,
      logicalId: `dp-${decisionAuthorityMode.toLowerCase()}`,
      version: '1',
      problem: problem({ decisionAuthorityMode }),
      principal,
      audit: audit(principal, decisionAuthorityMode.toLowerCase())
    });
    assert.equal(assertDecisionResultAuthority({ ledger, decisionProblemRef: record.ref, authorityMode: decisionAuthorityMode }).allowed, true);
    const wrong = decisionAuthorityMode === 'ADR_POLICY' ? 'EXTERNAL_POLICY' : 'ADR_POLICY';
    assert.throws(
      () => assertDecisionResultAuthority({ ledger, decisionProblemRef: record.ref, authorityMode: wrong }),
      (error) => error?.code === 'DECISION_RESULT_AUTHORITY_MISMATCH'
    );
  }
});

test('generic-ledger DecisionProblem laundering is rejected by A01 authority validation', () => {
  const ledger = new AuthorityLedger();
  const malformed = ledger.publish({
    kind: 'DecisionProblem',
    logicalId: 'dp-laundered',
    version: '1',
    semanticPayload: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      authorityClass: 'DECISION_SCOPE',
      decisionType: 'IRRIGATION_TIMING',
      targetRef: { organizationId: 'org-a', tenantId: 'tenant-a', fieldId: 'field-1' },
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
    audit: audit(principal, 'laundered')
  });
  assert.throws(
    () => validateDecisionProblemAuthority({ ledger, decisionProblemRef: malformed.ref }),
    (error) => error?.code === 'DECISION_PROBLEM_AUDIT_INVALID'
  );
});

console.log('DecisionProblem integrity acceptance: 7 passed');
