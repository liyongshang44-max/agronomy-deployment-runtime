import assert from 'node:assert/strict';
import { normalizeContextDatum } from '../../packages/context-contract/src/index.mjs';
import * as runtimeResultsPublic from '../../packages/runtime-results/src/index.mjs';
import {
  normalizeRuntimeResult,
  validateRuntimeResult
} from '../../packages/runtime-results/src/index.mjs';
import {
  createRuntimeDatum,
  createRuntimeResult
} from '../../packages/runtime-results/src/contract.mjs';
import { runtimeExecutionId } from '../../packages/implementation-broker/src/index.mjs';
import {
  collect,
  createBroker,
  executeAndCollect,
  executeModel,
  modelWorld,
  semanticOutput,
  suspendDeployment,
  transformationOutputFromInput,
  transformationWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function h(char) { return `sha256:${char.repeat(64)}`; }

test('public runtime-results surface exposes collector/evidence validator but no unchecked semantic result creators', () => {
  assert.equal(typeof runtimeResultsPublic.collectRuntimeResult, 'function');
  assert.equal(typeof runtimeResultsPublic.validateRuntimeResult, 'function');
  assert.equal(typeof runtimeResultsPublic.normalizeRuntimeDatum, 'function');
  assert.equal(typeof runtimeResultsPublic.normalizeRuntimeResult, 'function');
  assert.equal('createRuntimeDatum' in runtimeResultsPublic, false);
  assert.equal('createRuntimeResult' in runtimeResultsPublic, false);
});

test('evidence-backed RuntimeResult validator reproduces exact D02 execution and exact input lineage', async () => {
  const world = modelWorld('evidence-replay-valid');
  const execution = await executeModel(world, semanticOutput());
  const result = collect(world, execution.envelope);
  const validated = validateRuntimeResult({
    ledger: world.env.ledger,
    runtimeResult: result,
    executionEnvelope: execution.envelope,
    inputDatumRefs: [world.soilRef]
  });
  assert.deepEqual(validated, result);
});

test('self-consistent RuntimeResult cannot replace exact D02 execution evidence during validation', async () => {
  const world = modelWorld('evidence-replay-forged');
  const execution = await executeModel(world, semanticOutput());
  const result = collect(world, execution.envelope);
  const forged = createRuntimeResult({ ...result, executionEvidenceHash: h('b') });
  assert.doesNotThrow(() => normalizeRuntimeResult(forged));
  assert.throws(
    () => validateRuntimeResult({
      ledger: world.env.ledger,
      runtimeResult: forged,
      executionEnvelope: execution.envelope,
      inputDatumRefs: [world.soilRef]
    }),
    (error) => error?.code === 'RUNTIME_RESULT_EVIDENCE_REPLAY_MISMATCH'
  );
});

test('failed D02 execution cannot be laundered into RuntimeResult', async () => {
  const world = modelWorld('failed-execution');
  const { broker } = createBroker(world, async () => { throw new Error('offline'); });
  const envelope = await broker.execute({
    ledger: world.env.ledger,
    runtimeBindingRef: world.binding.ref,
    inputDatumRefs: [world.soilRef]
  });
  assert.equal(envelope.status, 'FAILED');
  assert.throws(
    () => collect(world, envelope),
    (error) => error?.code === 'RUNTIME_RESULT_SUCCESSFUL_EXECUTION_REQUIRED'
  );
});

test('caller cannot self-author unit/epistemic/provenance through opaque executor output', async () => {
  const world = modelWorld('semantic-override');
  const raw = semanticOutput({ extra: { unit: 'cm', epistemicClass: 'OBSERVATION', provenanceClass: 'SENSOR' } });
  const execution = await executeModel(world, raw);
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'INVALID_RUNTIME_RESULT_FIELD'
  );
});

test('bare number output is rejected instead of dropping typed value semantics', async () => {
  const world = modelWorld('bare-number');
  const raw = semanticOutput();
  raw.outputs[0].value = 42.5;
  const execution = await executeModel(world, raw);
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'INVALID_RUNTIME_RESULT_VALUE'
  );
});

test('executor value type must equal exact Specification output valueType', async () => {
  const world = modelWorld('value-type');
  const raw = semanticOutput({ value: { type: 'INTEGER', integer: '42' } });
  const execution = await executeModel(world, raw);
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_RESULT_OUTPUT_VALUE_TYPE_MISMATCH'
  );
});

test('executor cannot substitute a different semantic output ID', async () => {
  const world = modelWorld('semantic-id');
  const execution = await executeModel(world, semanticOutput({ semanticId: 'soil.fake_output' }));
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_RESULT_OUTPUT_SEMANTIC_MISMATCH'
  );
});

test('FORECAST output without reference-time/horizon metadata fails closed', async () => {
  const world = modelWorld('forecast-missing', {
    modelOverrides: {
      outputs: [{ semanticId: 'weather.forecast_value', valueType: 'DECIMAL', unit: 'mm', epistemicClasses: ['FORECAST'] }]
    }
  });
  const execution = await executeModel(world, semanticOutput({ semanticId: 'weather.forecast_value', forecast: null }));
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_DATUM_FORECAST_METADATA_REQUIRED'
  );
});

test('non-FORECAST output cannot carry forecast metadata', async () => {
  const world = modelWorld('forecast-forbidden');
  const effectiveInterval = { start: '2026-08-21T00:00:00Z', end: '2026-08-22T00:00:00Z' };
  const execution = await executeModel(world, semanticOutput({
    effectiveInterval,
    forecast: { referenceTime: '2026-08-20T10:15:00Z', horizon: effectiveInterval }
  }));
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_DATUM_FORECAST_METADATA_FORBIDDEN'
  );
});

test('D03 exact input refs must reproduce D02 inputEnvelopeHash', async () => {
  const world = modelWorld('input-envelope');
  const execution = await executeModel(world, semanticOutput());
  const wrongInputEnvelopeHash = h('e');
  const executionId = runtimeExecutionId({
    runtimeBindingRef: execution.envelope.runtimeBindingRef,
    runtimeNodeId: execution.envelope.runtimeNodeId,
    inputEnvelopeHash: wrongInputEnvelopeHash
  });
  const tampered = {
    ...execution.envelope,
    inputEnvelopeHash: wrongInputEnvelopeHash,
    executionId
  };
  assert.throws(
    () => collect(world, tampered),
    (error) => error?.code === 'RUNTIME_RESULT_INPUT_ENVELOPE_MISMATCH'
  );
});

test('RuntimeResult semantic hash detects output/result tampering during replay', async () => {
  const world = modelWorld('result-tamper');
  const { result } = await executeAndCollect(world, semanticOutput());
  assert.throws(
    () => normalizeRuntimeResult({ ...result, resultSemanticHash: h('f') }),
    (error) => error?.code === 'RUNTIME_RESULT_SEMANTIC_HASH_MISMATCH'
  );
  const tamperedDatum = { ...result.runtimeDatums[0], outputSemanticHash: h('a') };
  assert.throws(
    () => normalizeRuntimeResult({ ...result, runtimeDatums: [tamperedDatum] }),
    (error) => error?.code === 'RUNTIME_DATUM_SEMANTIC_HASH_MISMATCH'
  );
});

test('RuntimeResult cannot splice a valid RuntimeDatum from another execution lineage', async () => {
  const worldA = modelWorld('lineage-a');
  const worldB = modelWorld('lineage-b');
  const { result: a } = await executeAndCollect(worldA, semanticOutput());
  const { result: b } = await executeAndCollect(worldB, semanticOutput());
  assert.throws(
    () => normalizeRuntimeResult({ ...a, runtimeDatums: b.runtimeDatums }),
    (error) => error?.code === 'RUNTIME_RESULT_DATUM_LINEAGE_MISMATCH'
  );
});

test('MODEL provenance can never relabel runtime output as OBSERVATION', () => {
  const world = modelWorld('model-observation-guard');
  assert.throws(
    () => createRuntimeDatum({
      executionId: h('1'),
      runtimeBindingRef: world.binding.ref,
      runtimeNodeId: 'runtime-node:test',
      specificationRef: world.model.ref,
      implementationRef: world.implementation.ref,
      implementationConformanceRef: world.conformance.ref,
      semanticId: 'soil.fake_observation',
      value: { type: 'DECIMAL', decimal: '1' },
      unit: 'mm',
      epistemicClass: 'OBSERVATION',
      provenanceClass: 'MODEL',
      effectiveInterval: { start: '2026-08-20T10:00:00Z', end: '2026-08-20T10:15:00Z' },
      forecast: null,
      spatialSupport: { type: 'FIELD' },
      verticalSupport: null,
      temporalSupport: { type: 'INTERVAL' },
      uncertainty: { type: 'NONE' }
    }),
    (error) => error?.code === 'RUNTIME_DATUM_MODEL_EPISTEMIC_LAUNDERING'
  );
});

test('RuntimeDatum is structurally distinct from ContextDatum and cannot be normalized as one', async () => {
  const world = modelWorld('not-context');
  const { result } = await executeAndCollect(world, semanticOutput());
  assert.throws(
    () => normalizeContextDatum(result.runtimeDatums[0], { datumId: 'fake-context-datum' }),
    (error) => error?.code === 'INVALID_CONTEXT_DATUM_FIELD'
  );
});

test('historical RuntimeResult replay survives later Deployment suspension without authorizing a new dispatch', async () => {
  const world = modelWorld('historical-after-suspend');
  const execution = await executeModel(world, semanticOutput());
  const before = collect(world, execution.envelope);
  suspendDeployment(world);
  const after = collect(world, execution.envelope);
  assert.deepEqual(after, before);
  const { broker } = createBroker(world, async () => semanticOutput());
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'DEPLOYMENT_NOT_RUNTIME_ACTIVE'
  );
});

test('QualifiedTransformation cannot silently change support outside the S01 v1 semantic contract', async () => {
  const world = transformationWorld('support-mutation');
  const raw = transformationOutputFromInput(world, { spatialSupport: { type: 'POINT', geometryRef: 'invented-point' } });
  const execution = await executeModel(world, raw);
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_RESULT_TRANSFORMATION_SUPPORT_MUTATION'
  );
});

test('PRESERVE QualifiedTransformation cannot silently change uncertainty', async () => {
  const world = transformationWorld('uncertainty-mutation');
  const input = world.env.ledger.resolve(world.soilRef).semanticPayload;
  const changedUncertainty = input.uncertainty.type === 'NONE'
    ? { type: 'INTERVAL', lowerDecimal: '0', upperDecimal: '1' }
    : { type: 'NONE' };
  const raw = transformationOutputFromInput(world, { uncertainty: changedUncertainty });
  const execution = await executeModel(world, raw);
  assert.throws(
    () => collect(world, execution.envelope),
    (error) => error?.code === 'RUNTIME_RESULT_TRANSFORMATION_UNCERTAINTY_MUTATION'
  );
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
console.log(`D03 RuntimeResult / RuntimeDatum integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
