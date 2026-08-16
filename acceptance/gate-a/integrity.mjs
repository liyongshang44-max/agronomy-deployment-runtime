import assert from 'node:assert/strict';
import { createWorkbenchWorld } from '../workbench/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function walk(value, visit, path = '$') {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walk(item, visit, `${path}.${key}`);
  }
}

function assertNoDecisionAuthorityVocabulary(value) {
  const forbiddenKeys = new Set([
    'runtimeEligibility', 'runtime_eligibility', 'decisionResult', 'decision_result',
    'decisionRobustness', 'decision_robustness', 'recommendedAction', 'recommended_action',
    'recommendation', 'isSafe', 'is_safe'
  ]);
  const forbiddenValues = new Set([
    'RUNTIME_ELIGIBLE', 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS', 'INFORMATION_REQUIRED', 'NO_LEGAL_RUNTIME',
    'ACT', 'WAIT', 'ASK', 'ABSTAIN', 'SAFE'
  ]);
  walk(value, (item, path) => {
    if (path !== '$') {
      const key = path.split('.').at(-1)?.replace(/\[\d+\]$/, '');
      if (forbiddenKeys.has(key)) assert.fail(`forbidden downstream authority key at ${path}`);
    }
    if (typeof item === 'string' && forbiddenValues.has(item)) {
      assert.fail(`forbidden downstream authority value ${item} at ${path}`);
    }
  });
}

test('Gate A product projection contains no RuntimeEligibility or decision-action authority vocabulary', () => {
  const world = createWorkbenchWorld('gate-a-vocab');
  assertNoDecisionAuthorityVocabulary(world.workbenchCase);
});

test('Gate A no-review classification remains explicitly non-authority and is not called safe', () => {
  const world = createWorkbenchWorld('gate-a-no-review');
  const c = world.workbenchCase;
  assert.equal(c.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
  assert.equal(c.classification, 'NO_REVIEW_CANDIDATE');
  assertNoDecisionAuthorityVocabulary(c);
});

test('Gate A unknown cannot collapse into a normal no-review case', () => {
  const world = createWorkbenchWorld('gate-a-unknown', { includeCrop: false });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.equal(world.workbenchCase.reviewRequired, true);
  assert.notEqual(world.workbenchCase.classification, 'NO_REVIEW_CANDIDATE');
});

test('Gate A conflict cannot collapse into a normal no-review case', () => {
  const world = createWorkbenchWorld('gate-a-hard-conflict', { crop: 'soybean' });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert.equal(world.workbenchCase.reviewRequired, true);
  assert.equal(world.workbenchCase.classification, 'KNOWLEDGE_CONFLICT');
});

test('Gate A closure is an integration proof and publishes no new GateA authority kind', () => {
  const world = createWorkbenchWorld('gate-a-no-new-authority');
  const kinds = world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind);
  assert.equal(kinds.some((kind) => /^GateA/i.test(kind)), false);
  assert.equal(kinds.some((kind) => /CommercialProof|PilotSuccess|SafetyProof/i.test(kind)), false);
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
console.log(`Gate A nonclaim/integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
