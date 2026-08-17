import assert from 'node:assert/strict';
import {
  collect,
  decimalValue,
  executeAndCollect,
  executeModel,
  modelWorld,
  multiSemanticOutput,
  semanticOutput,
  transformationOutputFromInput,
  transformationWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('Model STATE_ESTIMATE becomes RuntimeDatum with exact Specification semantics and MODEL provenance', async () => {
  const world = modelWorld('state-estimate');
  const { result } = await executeAndCollect(world, semanticOutput());
  assert.equal(result.contractVersion, 'adr.runtime-result.v1');
  assert.equal(result.authorityClass, 'RUNTIME_EXECUTION_SEMANTIC_RESULT');
  assert.equal(result.runtimeDatums.length, 1);
  const datum = result.runtimeDatums[0];
  assert.equal(datum.contractVersion, 'adr.runtime-datum.v1');
  assert.equal(datum.semanticId, 'soil.root_zone_water_storage');
  assert.equal(datum.unit, 'mm');
  assert.equal(datum.value.type, 'DECIMAL');
  assert.equal(datum.value.decimal, '42.5');
  assert.equal(datum.epistemicClass, 'STATE_ESTIMATE');
  assert.equal(datum.provenanceClass, 'MODEL');
  assert.equal(datum.forecast, null);
  assert.deepEqual(datum.spatialSupport, { type: 'FIELD', geometryRef: 'field-a' });
  assert.deepEqual(datum.verticalSupport, { fromMm: '0', toMm: '600' });
  assert.deepEqual(datum.temporalSupport, { type: 'INTERVAL' });
  assert.deepEqual(datum.uncertainty, { type: 'INTERVAL', lowerDecimal: '40', upperDecimal: '45' });
  assert.match(datum.outputSemanticHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.resultSemanticHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.inputSemanticHashes.length, 1);
  assert.equal(result.inputSemanticHashes[0], world.soilRef.semanticHash);
});

test('Model FORECAST requires and retains forecast reference time and exact horizon', async () => {
  const world = modelWorld('forecast', {
    modelOverrides: {
      outputs: [{
        semanticId: 'soil.root_zone_water_storage_forecast',
        valueType: 'DECIMAL',
        unit: 'mm',
        epistemicClasses: ['FORECAST']
      }]
    }
  });
  const effectiveInterval = { start: '2026-08-21T00:00:00Z', end: '2026-08-22T00:00:00Z' };
  const raw = semanticOutput({
    semanticId: 'soil.root_zone_water_storage_forecast',
    effectiveInterval,
    forecast: { referenceTime: '2026-08-20T10:15:00Z', horizon: effectiveInterval }
  });
  const { result } = await executeAndCollect(world, raw);
  const datum = result.runtimeDatums[0];
  assert.equal(datum.epistemicClass, 'FORECAST');
  assert.equal(datum.provenanceClass, 'MODEL');
  assert.equal(datum.forecast.referenceTime, '2026-08-20T10:15:00.000Z');
  assert.deepEqual(datum.forecast.horizon, {
    start: '2026-08-21T00:00:00.000Z',
    end: '2026-08-22T00:00:00.000Z'
  });
});

test('Model DERIVED output retains epistemic identity and measurement convention from exact Specification', async () => {
  const world = modelWorld('derived', {
    modelOverrides: {
      outputs: [{
        semanticId: 'weather.reference_et',
        valueType: 'DECIMAL',
        unit: 'mm',
        epistemicClasses: ['DERIVED'],
        measurementConvention: 'FAO56_SHORT_GRASS'
      }]
    }
  });
  const { result } = await executeAndCollect(world, semanticOutput({ semanticId: 'weather.reference_et' }));
  const datum = result.runtimeDatums[0];
  assert.equal(datum.epistemicClass, 'DERIVED');
  assert.equal(datum.measurementConvention, 'FAO56_SHORT_GRASS');
});

test('one execution may materialize multiple exact Model output ports without bare-number collapse', async () => {
  const outputs = [
    {
      semanticId: 'soil.root_zone_water_storage',
      valueType: 'DECIMAL',
      unit: 'mm',
      epistemicClasses: ['STATE_ESTIMATE']
    },
    {
      semanticId: 'soil.root_zone_depletion_fraction',
      valueType: 'DECIMAL',
      unit: '1',
      epistemicClasses: ['DERIVED']
    }
  ];
  const world = modelWorld('multiple', { modelOverrides: { outputs } });
  const base = semanticOutput().outputs[0];
  const raw = multiSemanticOutput([
    base,
    {
      ...base,
      semanticId: 'soil.root_zone_depletion_fraction',
      value: decimalValue('0.25'),
      verticalSupport: null,
      uncertainty: { type: 'NONE' }
    }
  ]);
  const { result } = await executeAndCollect(world, raw);
  assert.deepEqual(result.runtimeDatums.map((item) => item.semanticId), [
    'soil.root_zone_depletion_fraction',
    'soil.root_zone_water_storage'
  ]);
  assert.deepEqual(result.runtimeDatums.map((item) => item.epistemicClass), ['DERIVED', 'STATE_ESTIMATE']);
});

test('exact D02 execution + exact input refs replays to the same RuntimeResult identity and hashes', async () => {
  const world = modelWorld('replay');
  const execution = await executeModel(world, semanticOutput());
  const first = collect(world, execution.envelope);
  const second = collect(world, execution.envelope);
  assert.deepEqual(second, first);
  assert.equal(second.runtimeResultId, first.runtimeResultId);
  assert.equal(second.resultSemanticHash, first.resultSemanticHash);
  assert.equal(second.runtimeDatums[0].outputSemanticHash, first.runtimeDatums[0].outputSemanticHash);
});

test('QualifiedTransformation preserves epistemic identity while recording truthful PLATFORM execution provenance', async () => {
  const world = transformationWorld('preserve');
  const raw = transformationOutputFromInput(world);
  const execution = await executeModel(world, raw);
  const result = collect(world, execution.envelope);
  const input = world.env.ledger.resolve(world.soilRef).semanticPayload;
  const datum = result.runtimeDatums[0];
  assert.equal(datum.semanticId, 'soil.volumetric_water_content_percent');
  assert.equal(datum.unit, 'percent');
  assert.equal(datum.measurementConvention, 'VWC_PERCENT');
  assert.equal(datum.epistemicClass, input.epistemicClass);
  assert.equal(datum.provenanceClass, 'PLATFORM');
  assert.notEqual(datum.provenanceClass, input.provenanceClass);
  assert.deepEqual(datum.effectiveInterval, input.effectiveInterval);
  assert.deepEqual(datum.spatialSupport, input.spatialSupport);
  assert.deepEqual(datum.verticalSupport, input.verticalSupport);
  assert.deepEqual(datum.temporalSupport, input.temporalSupport);
  assert.deepEqual(datum.uncertainty, input.uncertainty);
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
console.log(`D03 RuntimeResult / RuntimeDatum positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
