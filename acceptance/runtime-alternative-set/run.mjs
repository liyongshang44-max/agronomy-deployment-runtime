import assert from 'node:assert/strict';
import {
  RUNTIME_ALTERNATIVE_COMPLETENESS_CLASSES,
  validateRuntimeAlternativeSet
} from '../../packages/runtime-alternative-set/src/index.mjs';
import {
  emptyLegalAlternativeWorld,
  legalAlternatives,
  mixedAlternativeWorld,
  multiAlternativeWorld,
  publishAllLegalBindings,
  publishAlternativeSet,
  publishBindingsForPaths
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('D04 freezes the complete RuntimePlan legal-path universe as EXHAUSTIVE_ENUMERATION', () => {
  const world = multiAlternativeWorld('exhaustive');
  const legal = legalAlternatives(world);
  assert.ok(legal.length >= 2);
  const bindings = publishAllLegalBindings(world, 'exhaustive');
  const set = publishAlternativeSet(world, bindings, 'exhaustive');
  const payload = set.semanticPayload;
  assert.equal(payload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
  assert.equal(payload.includedBindings.length, legal.length);
  assert.equal(payload.excludedCandidates.length, 0);
  assert.deepEqual(payload.coverage.candidatePathIds, payload.coverage.legalPathIds);
  assert.deepEqual(payload.coverage.includedPathIds, payload.coverage.legalPathIds);
  assert.deepEqual(payload.coverage.uncoveredLegalPathIds, []);
  const alternativeDimension = payload.materialUncertaintyDimensions.find((item) =>
    item.dimensionType === 'RUNTIME_PLAN_ALTERNATIVE');
  assert.ok(alternativeDimension);
  assert.deepEqual(alternativeDimension.pathIds, payload.coverage.candidatePathIds);
  assert.equal(payload.robustnessClaim, 'NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS');
});

test('omitting one historically legal path deterministically produces INCOMPLETE coverage', () => {
  const world = multiAlternativeWorld('incomplete');
  const legal = legalAlternatives(world);
  assert.ok(legal.length >= 2);
  const [binding] = publishBindingsForPaths(world, [legal[0]], 'incomplete');
  const set = publishAlternativeSet(world, [binding], 'incomplete');
  const payload = set.semanticPayload;
  assert.equal(payload.completenessClass, 'INCOMPLETE');
  assert.equal(payload.coverage.uncoveredLegalPathIds.length, legal.length - 1);
  const uncovered = payload.excludedCandidates.filter((item) =>
    item.pathDisposition === 'LEGAL' || item.pathDisposition === 'LEGAL_WITH_LIMITATIONS');
  assert.equal(uncovered.length, legal.length - 1);
  assert.ok(uncovered.every((item) => item.exclusionReasonCodes.includes('LEGAL_PATH_BINDING_NOT_INCLUDED')));
});

test('non-legal RuntimePlan candidates remain explicitly excluded with governed exclusion classes', () => {
  const world = mixedAlternativeWorld('governed-exclusions');
  const bindings = publishAllLegalBindings(world, 'governed-exclusions');
  const set = publishAlternativeSet(world, bindings, 'governed-exclusions');
  const payload = set.semanticPayload;
  assert.equal(payload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
  assert.ok(payload.excludedCandidates.length >= 1);
  for (const excluded of payload.excludedCandidates) {
    assert.ok(!['LEGAL', 'LEGAL_WITH_LIMITATIONS'].includes(excluded.pathDisposition));
    if (excluded.pathDisposition === 'INFORMATION_REQUIRED') {
      assert.ok(excluded.exclusionReasonCodes.includes('INFORMATION_REQUIRED'));
    } else {
      assert.ok(excluded.exclusionReasonCodes.includes('NO_LEGAL_RUNTIME'));
      assert.ok(excluded.sourceReasonCodes.length >= 1);
    }
  }
  assert.deepEqual(payload.coverage.uncoveredLegalPathIds, []);
});

test('an empty legal-world universe may be exhaustively accounted without fabricating a runnable world', () => {
  const world = emptyLegalAlternativeWorld('no-legal');
  const set = publishAlternativeSet(world, [], 'no-legal');
  const payload = set.semanticPayload;
  assert.equal(payload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
  assert.deepEqual(payload.coverage.legalPathIds, []);
  assert.deepEqual(payload.coverage.includedPathIds, []);
  assert.deepEqual(payload.coverage.uncoveredLegalPathIds, []);
  assert.equal(payload.includedBindings.length, 0);
  assert.ok(payload.excludedCandidates.length >= 1);
  assert.equal(payload.robustnessClaim, 'NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS');
});

test('published RuntimeAlternativeSet replays from exact historical eligibility and binding authorities', () => {
  const world = multiAlternativeWorld('replay');
  const bindings = publishAllLegalBindings(world, 'replay');
  const set = publishAlternativeSet(world, bindings, 'replay');
  const validated = validateRuntimeAlternativeSet({
    ledger: world.env.ledger,
    runtimeAlternativeSetRef: set.ref
  });
  assert.deepEqual(validated.record, set);
  assert.deepEqual(validated.semanticPayload, set.semanticPayload);
  assert.equal(validated.replayMode, 'EXACT_FROZEN_HISTORICAL_COVERAGE_NO_LATEST_LOOKUP');
});

test('frozen completeness vocabulary remains explicit while D04 v1 only materializes exact enumeration/incomplete', () => {
  assert.deepEqual(RUNTIME_ALTERNATIVE_COMPLETENESS_CLASSES, [
    'EXHAUSTIVE_ENUMERATION',
    'BOUNDED_ENVELOPE',
    'GOVERNED_COVERAGE',
    'INCOMPLETE'
  ]);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`D04 RuntimeAlternativeSet positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
