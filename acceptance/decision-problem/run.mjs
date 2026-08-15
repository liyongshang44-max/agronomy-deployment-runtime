import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  publishDecisionProblem,
  validateDecisionProblemAuthority
} from '../../packages/decision-problem/src/index.mjs';

let seq = 0;
function audit(principal, suffix) {
  seq += 1;
  return {
    eventId: `a01-${suffix}-${seq}`,
    occurredAt: '2026-08-16T01:00:00Z',
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'decision-problem' }
  };
}

const principal = {
  principalId: 'agronomist-a',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['program-a']
};

function baseProblem(overrides = {}) {
  return {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: 'IRRIGATION_TIMING',
    targetRef: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      farmId: 'farm-1',
      fieldId: 'field-1',
      seasonId: 'season-2026'
    },
    logicalTime: '2026-08-16T01:00:00+00:00',
    decisionHorizon: { duration: 'PT72H' },
    objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
    actionSpace: ['IRRIGATE_WITHIN_48H', 'WAIT', 'IRRIGATE_NOW'],
    constraints: [
      { code: 'MAX_IRRIGATION_MM', value: '30', unit: 'mm' },
      { code: 'NO_IRRIGATION_AFTER', timestamp: '2026-08-17T12:00:00Z' }
    ],
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

test('publishes exact immutable DecisionProblem authority', () => {
  const ledger = new AuthorityLedger();
  const record = publishDecisionProblem({
    ledger,
    logicalId: 'dp-irrigation-field-1',
    version: '1',
    problem: baseProblem(),
    principal,
    audit: audit(principal, 'publish')
  });
  assert.equal(record.ref.kind, 'DecisionProblem');
  assert.equal(record.semanticPayload.authorityClass, 'DECISION_SCOPE');
  assert.equal(record.semanticPayload.logicalTime, '2026-08-16T01:00:00.000Z');
  assert.deepEqual(record.semanticPayload.actionSpace, ['IRRIGATE_NOW', 'IRRIGATE_WITHIN_48H', 'WAIT']);
  const validated = validateDecisionProblemAuthority({ ledger, decisionProblemRef: record.ref });
  assert.deepEqual(validated.record.ref, record.ref);
});

test('canonical set ordering does not perturb DecisionProblem identity', () => {
  const ledger = new AuthorityLedger();
  const first = publishDecisionProblem({
    ledger,
    logicalId: 'dp-canonical',
    version: '1',
    problem: baseProblem(),
    principal,
    audit: audit(principal, 'canonical-1')
  });
  const reordered = baseProblem({
    actionSpace: ['WAIT', 'IRRIGATE_NOW', 'IRRIGATE_WITHIN_48H'],
    constraints: [...baseProblem().constraints].reverse(),
    logicalTime: '2026-08-16T03:00:00+02:00'
  });
  const second = publishDecisionProblem({
    ledger,
    logicalId: 'dp-canonical',
    version: '1',
    problem: reordered,
    principal,
    audit: audit(principal, 'canonical-2')
  });
  assert.deepEqual(first.ref, second.ref);
  assert.equal(ledger.listVersions('DecisionProblem', 'dp-canonical').length, 1);
});

for (const [label, override] of [
  ['horizon', { decisionHorizon: { duration: 'PT48H' } }],
  ['objective', { objective: { code: 'MINIMIZE_IRRIGATION_COST' } }],
  ['action-space', { actionSpace: ['WAIT', 'IRRIGATE_NOW'] }],
  ['use-purpose', { usePurpose: 'MODEL_PARAMETER_PRIOR' }],
  ['authority-mode', { decisionAuthorityMode: 'RUNTIME_ONLY' }],
  ['target-scope', { targetRef: { organizationId: 'org-a', tenantId: 'tenant-a', farmId: 'farm-1', fieldId: 'field-2', seasonId: 'season-2026' } }]
]) {
  test(`material ${label} change produces a distinct semantic identity`, () => {
    const ledger = new AuthorityLedger();
    const a = publishDecisionProblem({
      ledger,
      logicalId: `dp-material-${label}`,
      version: '1',
      problem: baseProblem(),
      principal,
      audit: audit(principal, `${label}-1`)
    });
    const b = publishDecisionProblem({
      ledger,
      logicalId: `dp-material-${label}`,
      version: '2',
      problem: baseProblem(override),
      principal,
      audit: audit(principal, `${label}-2`)
    });
    assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
  });
}

test('same logical/version cannot be semantically rewritten', () => {
  const ledger = new AuthorityLedger();
  publishDecisionProblem({
    ledger,
    logicalId: 'dp-immutable',
    version: '1',
    problem: baseProblem(),
    principal,
    audit: audit(principal, 'immutable-1')
  });
  assert.throws(
    () => publishDecisionProblem({
      ledger,
      logicalId: 'dp-immutable',
      version: '1',
      problem: baseProblem({ objective: { code: 'DIFFERENT_OBJECTIVE' } }),
      principal,
      audit: audit(principal, 'immutable-2')
    }),
    (error) => error?.code === 'SEMANTIC_MUTATION_FORBIDDEN'
  );
});

test('historical exact DecisionProblem ref remains replayable after a later version', () => {
  const ledger = new AuthorityLedger();
  const oldRecord = publishDecisionProblem({
    ledger,
    logicalId: 'dp-replay',
    version: '1',
    problem: baseProblem(),
    principal,
    audit: audit(principal, 'replay-1')
  });
  publishDecisionProblem({
    ledger,
    logicalId: 'dp-replay',
    version: '2',
    problem: baseProblem({ decisionHorizon: { duration: 'PT24H' } }),
    principal,
    audit: audit(principal, 'replay-2')
  });
  const replay = validateDecisionProblemAuthority({ ledger, decisionProblemRef: oldRecord.ref });
  assert.equal(replay.semanticPayload.decisionHorizon.duration, 'PT72H');
});

console.log('DecisionProblem acceptance: 10 passed');
