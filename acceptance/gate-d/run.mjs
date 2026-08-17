import assert from 'node:assert/strict';
import { validateRuntimeResult } from '../../packages/runtime-results/src/index.mjs';
import { validateRuntimeAlternativeSet } from '../../packages/runtime-alternative-set/src/index.mjs';
import { validateDecisionRobustness } from '../../packages/decision-robustness/src/index.mjs';
import {
  DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
  DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY,
  validateDecisionResult
} from '../../packages/decision-result/src/index.mjs';
import { createGateDWorld } from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sameRef(left, right) {
  return exactRefKey(left) === exactRefKey(right);
}

function millis(value) {
  return new Date(value).getTime();
}

test('Gate D closes one continuous legal runtime -> RuntimeDatum -> Policy -> robustness -> DecisionResult chain', async () => {
  const world = await createGateDWorld('continuous');

  assert.equal(world.modelEnvelope.status, 'SUCCEEDED');
  assert.equal(world.runtimeResult.runtimeDatums.length, 1);
  const datum = world.runtimeResult.runtimeDatums[0];
  const soil = world.env.ledger.resolve(world.soilRef).semanticPayload;
  assert.equal(datum.semanticId, 'soil.root_zone_water_storage');
  assert.equal(datum.epistemicClass, 'STATE_ESTIMATE');
  assert.equal(datum.provenanceClass, 'MODEL');
  assert.deepEqual(datum.spatialSupport, soil.spatialSupport);
  assert.ok(sameRef(datum.runtimeBindingRef, world.modelAuthority.binding.ref));

  assert.equal(world.policyEnvelope.status, 'SUCCEEDED');
  assert.ok(millis(world.modelEnvelope.completedAt) <= millis(world.policyEnvelope.startedAt));
  assert.ok(millis(world.policyEnvelope.completedAt) <= millis(world.decisionResult.semanticPayload.decidedAt));
  assert.equal(world.alternativeSet.semanticPayload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
  assert.equal(world.robustness.semanticPayload.robustnessClass, 'ROBUST');
  assert.equal(world.decisionResult.semanticPayload.decisionDisposition, 'ACT');
  assert.equal(world.decisionResult.semanticPayload.structuredAction.actionCode, 'IRRIGATE_NOW');
  assert.equal(
    world.decisionResult.semanticPayload.structuredAction.materialParameters.find((item) => item.name === 'amount').value.decimal,
    '10'
  );
});

test('Gate D Policy executor actually consumes exact evidence-backed D03 RuntimeDatum identity', async () => {
  const world = await createGateDWorld('mixed-input');
  const request = world.capturedPolicyRequest;
  assert.ok(request);
  assert.equal(request.contractVersion, 'adr.executor-request.v2');
  assert.equal(request.contextEntries.length, 1);
  assert.equal(request.contextEntries[0].semanticId, 'soil.volumetric_water_content');
  assert.equal(request.runtimeEntries.length, 1);

  const runtimeEntry = request.runtimeEntries[0];
  const datum = world.runtimeResult.runtimeDatums[0];
  assert.equal(runtimeEntry.semanticId, datum.semanticId);
  assert.equal(runtimeEntry.semanticHash, datum.outputSemanticHash);
  assert.equal(runtimeEntry.runtimeResultSemanticHash, world.runtimeResult.resultSemanticHash);
  assert.equal(runtimeEntry.executionEvidenceHash, world.runtimeResult.executionEvidenceHash);
});

test('Gate D exact replay validates D03, D04, D05 and D06 authorities from stored evidence', async () => {
  const world = await createGateDWorld('replay');
  const runtimeResult = validateRuntimeResult({
    ledger: world.env.ledger,
    runtimeResult: world.runtimeResult,
    executionEnvelope: world.modelEnvelope,
    inputDatumRefs: [world.soilRef]
  });
  assert.equal(runtimeResult.resultSemanticHash, world.runtimeResult.resultSemanticHash);

  const alternativeSet = validateRuntimeAlternativeSet({
    ledger: world.env.ledger,
    runtimeAlternativeSetRef: world.alternativeSet.ref
  });
  assert.equal(alternativeSet.semanticPayload.completenessClass, 'EXHAUSTIVE_ENUMERATION');

  const robustness = validateDecisionRobustness({
    ledger: world.env.ledger,
    decisionRobustnessRef: world.robustness.ref
  });
  assert.equal(robustness.semanticPayload.robustnessClass, 'ROBUST');

  const decisionResult = validateDecisionResult({
    ledger: world.env.ledger,
    decisionResultRef: world.decisionResult.ref
  });
  assert.equal(decisionResult.semanticPayload.decisionDisposition, 'ACT');
  assert.equal(decisionResult.replayMode, 'EXACT_FROZEN_DECISION_ROBUSTNESS_POLICY_AND_DISPOSITION_EVIDENCE');
});

test('Gate D preserves exact binding separation between upstream Model and final Policy world', async () => {
  const world = await createGateDWorld('binding-separation');
  assert.equal(sameRef(world.modelAuthority.binding.ref, world.binding.ref), false);
  assert.ok(sameRef(world.runtimeResult.runtimeDatums[0].runtimeBindingRef, world.modelAuthority.binding.ref));
  assert.ok(sameRef(world.robustness.semanticPayload.actionEvaluations[0].runtimeBindingRef, world.binding.ref));
  assert.ok(sameRef(world.decisionResult.semanticPayload.runtimeBindingRefs[0], world.binding.ref));
});

test('Gate D proof does not claim downstream human approval, machine execution, outcome or causal effect', async () => {
  const world = await createGateDWorld('nonclaim');
  const result = world.decisionResult.semanticPayload;
  assert.equal(result.humanApprovalAuthority, DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY);
  assert.equal(result.machineExecutionAuthority, DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY);

  const kinds = new Set(world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind));
  assert.equal(kinds.has('Outcome'), false);
  assert.equal(kinds.has('OutcomeEvaluation'), false);
  assert.equal(kinds.has('EffectAttributionAssessment'), false);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`::error title=${name.replaceAll(',', ' ')}::${String(error?.stack ?? error).replaceAll('\n', '%0A')}`);
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`Gate D decision runtime proof: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
