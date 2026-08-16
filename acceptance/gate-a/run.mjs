import assert from 'node:assert/strict';
import { createWorkbenchWorld } from '../workbench/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function hasExactRef(values, expected) {
  return Array.isArray(values) && values.some((ref) => exactRefKey(ref) === exactRefKey(expected));
}

test('Gate A closes exact company agronomy through applicability into the Agronomist Workbench', () => {
  const world = createWorkbenchWorld('gate-a-direct');
  const c = world.workbenchCase;
  assert.equal(c.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(c.reviewRequired, false);
  assert.equal(c.applicability.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(c.applicability.scientificUseStatus, 'QUALIFIED');
  assert.equal(c.applicability.decisionRelevance, 'MATERIAL');

  assert.equal(exactRefKey(c.applicability.applicabilityAssessmentRef), exactRefKey(world.assessment.ref));
  assert.equal(exactRefKey(c.targetContext.decisionProblemRef), exactRefKey(world.decision.ref));
  assert.equal(exactRefKey(c.targetContext.contextManifestRef), exactRefKey(world.manifest.ref));
  assert.equal(exactRefKey(c.scientificEvidence.knowledgeRef), exactRefKey(world.assessment.semanticPayload.knowledgeRef));
  assert.equal(exactRefKey(c.why.knowledgeRetrievalResultRef), exactRefKey(world.retrieval.ref));
  assert.equal(exactRefKey(c.why.deploymentRef), exactRefKey(world.env.deployment.ref));
  assert.equal(exactRefKey(c.why.runtimeProfileRef), exactRefKey(world.env.profile.ref));
  assert.equal(exactRefKey(c.why.knowledgeReleaseRef), exactRefKey(world.env.release.ref));
  assert.ok(c.scientificEvidence.sourceSpan.sourceArtifactRef);
  assert.ok(c.scientificEvidence.claim.claimRef);
  assert.ok(c.scientificEvidence.originContext.originContextRef);
  assert.ok(c.scientificEvidence.qualification.decisionRefs.length > 0);
});

test('Gate A keeps missing decision-material context in the expert workflow', () => {
  const world = createWorkbenchWorld('gate-a-gap', { includeCrop: false });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.ok(world.assessment.semanticPayload.missingContextSemanticIds.includes('crop.code'));
  assert.equal(world.workbenchCase.classification, 'CONTEXT_GAP');
  assert.equal(world.workbenchCase.reviewRequired, true);
});

test('Gate A keeps known transport conflict in the expert workflow', () => {
  const world = createWorkbenchWorld('gate-a-conflict', { crop: 'soybean' });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert.equal(world.workbenchCase.classification, 'KNOWLEDGE_CONFLICT');
  assert.equal(world.workbenchCase.reviewRequired, true);
  assert.ok(world.workbenchCase.applicability.conflicts.length > 0);
});

test('Gate A core does not fabricate the conditional A09 governed-transform path', () => {
  const world = createWorkbenchWorld('gate-a-no-transform');
  assert.notEqual(world.assessment.semanticPayload.transportStatus, 'APPLICABLE_WITH_GOVERNED_TRANSFORM');
  assert.deepEqual(world.assessment.semanticPayload.requiredTransformationRefs, []);
  assert.deepEqual(world.workbenchCase.applicability.requiredTransformationRefs, []);
});

test('Gate A proof creates no RuntimeEligibility or DecisionResult authority as a side effect', () => {
  const world = createWorkbenchWorld('gate-a-nonclaim');
  const snapshot = world.env.ledger.exportSnapshot();
  const kinds = new Set(snapshot.records.map((record) => record.ref.kind));
  assert.equal(kinds.has('RuntimeEligibility'), false);
  assert.equal(kinds.has('RuntimeBinding'), false);
  assert.equal(kinds.has('DecisionRobustness'), false);
  assert.equal(kinds.has('DecisionResult'), false);
  assert.equal(hasExactRef(snapshot.records.map((record) => record.ref), world.assessment.ref), true);
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
console.log(`Gate A end-to-end acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
