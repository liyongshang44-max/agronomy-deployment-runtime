import assert from 'node:assert/strict';
import {
  DecisionProblemError,
  normalizeDecisionProblem
} from '../../packages/decision-problem/src/index.mjs';

function baseProblem(overrides = {}) {
  return {
    contractVersion: 'adr.decision-problem.v1',
    decisionType: 'IRRIGATION_TIMING',
    targetRef: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      fieldId: 'field-1',
      seasonId: 'season-2026'
    },
    logicalTime: '2026-08-20T10:00:00Z',
    decisionHorizon: { duration: 'PT72H' },
    objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
    actionSpace: ['WAIT', 'IRRIGATE_NOW'],
    constraints: [],
    usePurpose: 'CORN_IRRIGATION_APPLICABILITY',
    useClass: 'ADVISORY',
    decisionAuthorityMode: 'RUNTIME_ONLY',
    decisionDeadline: '2026-08-20T14:00:00Z',
    ...overrides
  };
}
function expectInvalid(problem) {
  assert.throws(
    () => normalizeDecisionProblem(problem),
    (error) => error instanceof DecisionProblemError
      && error.code === 'INVALID_DECISION_PROBLEM_TIME'
  );
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('impossible DecisionProblem calendar dates cannot be silently normalized', () => {
  expectInvalid(baseProblem({ logicalTime: '2026-02-30T10:00:00Z' }));
  expectInvalid(baseProblem({ decisionDeadline: '2025-02-29T14:00:00Z' }));
});

test('DecisionProblem timestamps require explicit RFC3339 timezone and <= millisecond precision', () => {
  expectInvalid(baseProblem({ logicalTime: '2026-08-20T10:00:00' }));
  expectInvalid(baseProblem({ logicalTime: '2026-08-20T10:00:00.1234Z' }));
});

test('DecisionProblem timestamps reject impossible clocks and timezone offsets', () => {
  expectInvalid(baseProblem({ logicalTime: '2026-08-20T24:00:00Z' }));
  expectInvalid(baseProblem({ logicalTime: '2026-08-20T10:00:00+14:01' }));
  expectInvalid(baseProblem({ logicalTime: '2026-08-20T10:00:00+15:00' }));
});

test('real leap day and maximum legal +14:00 offset canonicalize to UTC', () => {
  const normalized = normalizeDecisionProblem(baseProblem({
    logicalTime: '2028-02-29T14:00:00+14:00',
    decisionDeadline: '2028-02-29T16:00:00+14:00'
  }));
  assert.equal(normalized.logicalTime, '2028-02-29T00:00:00.000Z');
  assert.equal(normalized.decisionDeadline, '2028-02-29T02:00:00.000Z');
});

console.log('DecisionProblem time hardening acceptance: 4 passed');
