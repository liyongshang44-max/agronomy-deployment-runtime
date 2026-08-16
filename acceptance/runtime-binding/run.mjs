import assert from 'node:assert/strict';
import {
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import {
  directBindingWorld,
  legalPath,
  limitedBindingWorld,
  mixedBindingWorld,
  multiBindingWorld,
  publishBinding
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('direct legal world publishes one immutable exact RuntimeBinding', () => {
  const world = directBindingWorld('direct');
  const selected = legalPath(world);
  const binding = publishBinding(world, 'direct', selected.pathId);
  assert.equal(binding.ref.kind, 'RuntimeBinding');
  assert.equal(binding.semanticPayload.contractVersion, 'adr.runtime-binding.v1');
  assert.equal(binding.semanticPayload.authorityClass, 'RUNTIME_COMPOSITION_REPLAY_AUTHORITY');
  assert.equal(binding.semanticPayload.selectedAlternativePathId, selected.pathId);
  assert.equal(binding.semanticPayload.knowledgeBindings.length, 1);
  assert.deepEqual(binding.semanticPayload.transformationBindings, []);
  assert.deepEqual(binding.semanticPayload.modelBindings, []);
  assert.deepEqual(binding.semanticPayload.policyBindings, []);
  assert.deepEqual(binding.semanticPayload.implementationBindings, []);
  assert.deepEqual(binding.semanticPayload.calibrationBindings, []);
  assert.deepEqual(binding.semanticPayload.assumptions, []);
  assert.equal(binding.semanticPayload.unresolvedAlternativeCount, 0);
  assert.equal(binding.semanticPayload.correctnessClaim, 'NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS');
});

test('RuntimeBinding freezes exact control/context/release/time authority from selected runtime world', () => {
  const world = directBindingWorld('exact-world');
  const binding = publishBinding(world, 'exact-world');
  const payload = binding.semanticPayload;
  assert.deepEqual(payload.runtimeEligibilityRef, world.eligibility.ref);
  assert.deepEqual(payload.runtimePlanRef, world.eligibility.semanticPayload.planRef);
  assert.deepEqual(payload.decisionProblemRef, world.decision.ref);
  assert.deepEqual(payload.deploymentRef, world.deployment.ref);
  assert.deepEqual(payload.runtimeProfileRef, world.env.profile.ref);
  assert.deepEqual(payload.contextManifestRef, world.manifest.ref);
  assert.deepEqual(payload.knowledgeReleaseRef, world.retrieval.semanticPayload.knowledgeReleaseRef);
  assert.equal(payload.logicalTime, world.manifest.semanticPayload.logicalTime);
  assert.equal(payload.evidenceCutoff, world.manifest.semanticPayload.evidenceCutoff);
});

test('limited legal world freezes exact selected-path limitations', () => {
  const world = limitedBindingWorld('limited');
  const selected = legalPath(world);
  assert.equal(selected.disposition, 'LEGAL_WITH_LIMITATIONS');
  const binding = publishBinding(world, 'limited', selected.pathId);
  assert.deepEqual(binding.semanticPayload.limitations, selected.limitations);
  assert.ok(binding.semanticPayload.limitations.some((item) =>
    JSON.stringify(item.detail).includes('D01_BOUNDED_LIMITATION')));
});

test('multiple legal alternatives require explicit path selection and one binding contains only that selected world', () => {
  const world = multiBindingWorld('multi');
  const alternatives = world.eligibility.semanticPayload.alternativeEvaluations;
  assert.equal(alternatives.length, 2);
  assert.ok(alternatives.every((item) => item.disposition === 'LEGAL'));
  const selected = alternatives[1];
  const binding = publishBinding(world, 'multi', selected.pathId);
  assert.equal(binding.semanticPayload.selectedAlternativePathId, selected.pathId);
  assert.equal(binding.semanticPayload.knowledgeBindings.length, 1);
  assert.deepEqual(binding.semanticPayload.knowledgeBindings[0].knowledgeRef, selected.knowledgeRef);
  assert.deepEqual(binding.semanticPayload.knowledgeBindings[0].applicabilityAssessmentRef, selected.applicabilityAssessmentRef);
  const other = alternatives[0];
  assert.notDeepEqual(binding.semanticPayload.knowledgeBindings[0].knowledgeRef, other.knowledgeRef);
  assert.equal(JSON.stringify(binding.semanticPayload).includes(other.pathId), false);
});

test('mixed eligible world may bind legal alternative but never carries blocked sibling into the same RuntimeBinding', () => {
  const world = mixedBindingWorld('mixed');
  assert.equal(world.eligibility.semanticPayload.runtimeEligibility, 'RUNTIME_ELIGIBLE');
  const selected = legalPath(world);
  const blocked = world.eligibility.semanticPayload.alternativeEvaluations.find((item) => item.disposition === 'NO_LEGAL_RUNTIME');
  assert.ok(blocked);
  const binding = publishBinding(world, 'mixed', selected.pathId);
  assert.equal(binding.semanticPayload.selectedAlternativePathId, selected.pathId);
  assert.deepEqual(binding.semanticPayload.knowledgeBindings[0].knowledgeRef, selected.knowledgeRef);
  assert.equal(JSON.stringify(binding.semanticPayload).includes(blocked.pathId), false);
  assert.equal(JSON.stringify(binding.semanticPayload).includes('CALIBRATION_AUTHORITY_REQUIRED'), false);
});

test('published RuntimeBinding replays exact frozen authorities and their historical relations without latest lookup', () => {
  const world = directBindingWorld('replay');
  const binding = publishBinding(world, 'replay');
  const validated = validateRuntimeBinding({
    ledger: world.env.ledger,
    runtimeBindingRef: binding.ref
  });
  assert.deepEqual(validated.record.ref, binding.ref);
  assert.equal(validated.replayMode, 'EXACT_FROZEN_HISTORICAL_AUTHORITIES_AND_RELATIONS_NO_LATEST_LOOKUP');
  assert.equal(validated.selectedHistoricalAlternative.pathId, binding.semanticPayload.selectedAlternativePathId);
  assert.equal(validated.runtimeBindingPrincipal.principalId, world.env.runtimePrincipal.principalId);
  assert.deepEqual(validated.frozenWorldRelations.deployment.ref, binding.semanticPayload.deploymentRef);
  assert.deepEqual(validated.frozenWorldRelations.profile.ref, binding.semanticPayload.runtimeProfileRef);
  assert.deepEqual(validated.frozenWorldRelations.release.ref, binding.semanticPayload.knowledgeReleaseRef);
  assert.deepEqual(validated.frozenWorldRelations.manifest.ref, binding.semanticPayload.contextManifestRef);
  assert.deepEqual(validated.frozenWorldRelations.knowledge.ref, binding.semanticPayload.knowledgeBindings[0].knowledgeRef);
  assert.deepEqual(validated.frozenWorldRelations.applicability.ref, binding.semanticPayload.knowledgeBindings[0].applicabilityAssessmentRef);
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
console.log(`D01 RuntimeBinding positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
