import assert from 'node:assert/strict';
import {
  buildRuntimeEligibility,
  validateRuntimeEligibility
} from '../../packages/runtime-eligibility/src/index.mjs';
import {
  directEligibilityWorld,
  multiEligibilityWorld,
  publishEligibility,
  transportEligibilityWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('direct structurally complete runtime path is RUNTIME_ELIGIBLE without decision authority', () => {
  const world = directEligibilityWorld('direct');
  const result = buildRuntimeEligibility({
    ledger: world.env.ledger,
    runtimePlan: world.runtimePlan
  });
  assert.equal(result.runtimeEligibility, 'RUNTIME_ELIGIBLE');
  assert.equal(result.legalRuntimeCandidateCount, 1);
  assert.equal(result.informationPendingCandidateCount, 0);
  assert.equal(result.hardBlockedCandidateCount, 0);
  assert.deepEqual(result.informationRequirements, []);
  assert.deepEqual(result.limitations, []);
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(result.alternativeEvaluations[0].disposition, 'LEGAL');
  assert.equal(result.decisionAuthorityClaim, 'NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION');
});

test('bounded extrapolation remains a legal world but produces RUNTIME_ELIGIBLE_WITH_LIMITATIONS', () => {
  const world = transportEligibilityWorld('bounded', [
    { type: 'BOUNDED_EXTRAPOLATION', code: 'OUTSIDE_CORE_TRIAL_ENVELOPE' }
  ]);
  assert.equal(world.assessments[0].semanticPayload.transportStatus, 'BOUNDED_EXTRAPOLATION');
  assert.equal(world.assessments[0].semanticPayload.runtimeUse, 'ALLOWED');
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS');
  assert.equal(result.legalRuntimeCandidateCount, 1);
  assert.deepEqual(result.reasonCodes, ['LEGAL_RUNTIME_ONLY_WITH_LIMITATIONS']);
  assert.ok(result.limitations.length >= 1);
  assert.equal(result.alternativeEvaluations[0].disposition, 'LEGAL_WITH_LIMITATIONS');
  assert.ok(result.limitations.some((item) =>
    JSON.stringify(item.detail).includes('OUTSIDE_CORE_TRIAL_ENVELOPE')));
});

test('missing decision-material context is INFORMATION_REQUIRED rather than NO_LEGAL_RUNTIME', () => {
  const world = directEligibilityWorld('information', { includeCrop: false });
  assert.ok(world.runtimePlan.openRequirements.some((item) => item.requirementType === 'MISSING_CONTEXT'));
  assert.ok(world.runtimePlan.openRequirements.some((item) =>
    item.requirementType === 'APPLICABILITY_RUNTIME_DISPOSITION' && item.code === 'BLOCKED'));
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'INFORMATION_REQUIRED');
  assert.equal(result.legalRuntimeCandidateCount, 0);
  assert.equal(result.informationPendingCandidateCount, 1);
  assert.equal(result.hardBlockedCandidateCount, 0);
  assert.equal(result.informationRequirements.length, 1);
  assert.equal(result.informationRequirements[0].requirementId.startsWith('ir:'), true);
  assert.deepEqual(result.reasonCodes, ['DECISION_MATERIAL_INFORMATION_OPEN']);
  assert.equal(result.alternativeEvaluations[0].disposition, 'INFORMATION_REQUIRED');
  assert.equal(result.alternativeEvaluations[0].reasonCodes.includes('APPLICABILITY_RUNTIME_USE_BLOCKED'), false);
});

test('hard source-target conflict with complete context produces NO_LEGAL_RUNTIME', () => {
  const world = directEligibilityWorld('conflict', { crop: 'soybean' });
  assert.equal(world.assessments[0].semanticPayload.transportStatus, 'CONFLICT');
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'NO_LEGAL_RUNTIME');
  assert.equal(result.legalRuntimeCandidateCount, 0);
  assert.equal(result.informationPendingCandidateCount, 0);
  assert.equal(result.hardBlockedCandidateCount, 1);
  assert.ok(result.reasonCodes.includes('UNRESOLVABLE_SEMANTICS'));
  assert.equal(result.alternativeEvaluations[0].disposition, 'NO_LEGAL_RUNTIME');
});

test('CALIBRATION_REQUIRED without qualified calibration authority is NO_LEGAL_RUNTIME in the minimal R03 path', () => {
  const world = transportEligibilityWorld('calibration', [
    { type: 'CALIBRATION_REQUIRED', code: 'FIELD_CALIBRATION_REQUIRED' }
  ]);
  assert.equal(world.assessments[0].semanticPayload.transportStatus, 'CALIBRATION_REQUIRED');
  assert.equal(world.assessments[0].semanticPayload.runtimeUse, 'CONDITIONAL');
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'NO_LEGAL_RUNTIME');
  assert.deepEqual(result.reasonCodes, ['CALIBRATION_AUTHORITY_REQUIRED']);
  assert.equal(result.alternativeEvaluations[0].reasonCodes.includes('RUNTIME_USE_CONDITIONAL_UNRESOLVED'), false);
});

test('multiple structurally complete legal alternatives remain eligible and are not collapsed to one path', () => {
  const world = multiEligibilityWorld('two-legal');
  assert.equal(world.runtimePlan.alternativePaths.length, 2);
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'RUNTIME_ELIGIBLE');
  assert.equal(result.legalRuntimeCandidateCount, 2);
  assert.equal(result.alternativeEvaluations.length, 2);
  assert.ok(result.alternativeEvaluations.every((path) => path.disposition === 'LEGAL'));
  assert.equal(new Set(result.alternativeEvaluations.map((path) => path.pathId)).size, 2);
});

test('RuntimeEligibility is published as immutable runtime-legality authority by the exact runtime principal and replays', () => {
  const world = directEligibilityWorld('published');
  const record = publishEligibility(world, 'published');
  assert.equal(record.ref.kind, 'RuntimeEligibility');
  assert.equal(record.semanticPayload.runtimeEligibility, 'RUNTIME_ELIGIBLE');
  const validated = validateRuntimeEligibility({
    ledger: world.env.ledger,
    runtimeEligibilityRef: record.ref
  });
  assert.equal(validated.semanticPayload.runtimeEligibility, 'RUNTIME_ELIGIBLE');
  assert.equal(validated.runtimeEligibilityPrincipal.principalId, world.env.runtimePrincipal.principalId);
  assert.equal(validated.runtimePlan.planHash, world.runtimePlan.planHash);
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
console.log(`R03 RuntimeEligibility positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
