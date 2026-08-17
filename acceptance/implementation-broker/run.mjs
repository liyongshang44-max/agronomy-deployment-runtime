import assert from 'node:assert/strict';
import {
  runtimeExecutionInputHash,
  runtimeExecutionNodeId
} from '../../packages/implementation-broker/src/index.mjs';
import {
  createExecutableWorld,
  executeWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('internal executor receives exact bound request and produces normalized non-semantic execution envelope', async () => {
  const world = createExecutableWorld('internal');
  let request = null;
  const { envelope } = await executeWorld(world, async (value) => {
    request = value;
    return { estimate_mm: '128.4' };
  });
  assert.equal(envelope.status, 'SUCCEEDED');
  assert.equal(envelope.dispatchClass, 'INTERNAL');
  assert.equal(envelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');
  assert.deepEqual(envelope.runtimeBindingRef, world.binding.ref);
  assert.deepEqual(envelope.specificationRef, world.model.ref);
  assert.deepEqual(envelope.implementationRef, world.implementation.ref);
  assert.deepEqual(envelope.implementationConformanceRef, world.conformance.ref);
  assert.deepEqual(envelope.rawOutput, { estimate_mm: '128.4' });
  assert.match(envelope.rawOutputHash, /^sha256:[a-f0-9]{64}$/);
  assert(request);
  assert.equal(request.executionId, envelope.executionId);
  assert.equal(request.idempotencyKey, envelope.executionId);
  assert.deepEqual(request.runtimeBindingRef, world.binding.ref);
});

test('external HTTP implementation uses same normalized execution envelope contract', async () => {
  const world = createExecutableWorld('external', { providerType: 'HTTP' });
  const { envelope } = await executeWorld(world, async (request) => ({
    transport_status: 200,
    locator: request.executionLocator.value,
    estimate_mm: '128.4'
  }));
  assert.equal(envelope.status, 'SUCCEEDED');
  assert.equal(envelope.dispatchClass, 'EXTERNAL');
  assert.equal(envelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');
  assert.equal(envelope.rawOutput.transport_status, 200);
  assert.equal(envelope.rawOutput.estimate_mm, '128.4');
  assert.equal(Object.hasOwn(envelope, 'semanticValidity'), false);
});

test('runtime node identity is deterministic from exact bound spec/implementation/conformance tuple', async () => {
  const world = createExecutableWorld('node-id');
  const { envelope } = await executeWorld(world, async () => ({ estimate_mm: '100' }));
  const exact = world.binding.semanticPayload.implementationBindings[0];
  const expected = runtimeExecutionNodeId({
    runtimeBindingRef: world.binding.ref,
    specificationRef: exact.specificationRef,
    implementationRef: exact.implementationRef,
    implementationConformanceRef: exact.implementationConformanceRef
  });
  assert.equal(envelope.runtimeNodeId, expected);
});

test('input envelope hash is exact and deterministic for same frozen ContextDatum authority', async () => {
  const world = createExecutableWorld('input-hash');
  let firstRequest;
  const { envelope } = await executeWorld(world, async (request) => {
    firstRequest = request;
    return { estimate_mm: '100' };
  });
  assert.match(envelope.inputEnvelopeHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(firstRequest.inputEnvelopeHash, envelope.inputEnvelopeHash);
  assert.equal(firstRequest.inputEntries.length, 1);
  assert.deepEqual(firstRequest.inputEntries[0].authorityRef, world.soilRef);
  assert.equal(firstRequest.inputEntries[0].semanticId, 'soil.volumetric_water_content');
});

test('opaque output hash depends on exact raw output, not dispatch class', async () => {
  const internal = createExecutableWorld('same-output-internal');
  const external = createExecutableWorld('same-output-external', { providerType: 'HTTP' });
  const a = await executeWorld(internal, async () => ({ estimate_mm: '111.25' }));
  const b = await executeWorld(external, async () => ({ estimate_mm: '111.25' }));
  assert.equal(a.envelope.rawOutputHash, b.envelope.rawOutputHash);
  assert.notEqual(a.envelope.executionId, b.envelope.executionId);
});

test('D02 execution creates no RuntimeResult or RuntimeDatum authority side effect', async () => {
  const world = createExecutableWorld('no-result-authority');
  const before = world.env.ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'RuntimeResult' || record.ref.kind === 'RuntimeDatum').length;
  await executeWorld(world, async () => ({ estimate_mm: '99' }));
  const after = world.env.ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'RuntimeResult' || record.ref.kind === 'RuntimeDatum').length;
  assert.equal(before, 0);
  assert.equal(after, 0);
});

test('broker passes exact ContextDatum semantic payload to executor without relabeling epistemic class', async () => {
  const world = createExecutableWorld('input-payload');
  let captured;
  await executeWorld(world, async (request) => {
    captured = request.inputEntries[0];
    return { estimate_mm: '101' };
  });
  assert.equal(captured.payload.semanticId, 'soil.volumetric_water_content');
  assert.equal(captured.payload.epistemicClass, 'OBSERVATION');
  assert.equal(captured.payload.unit, 'm3_per_m3');
  assert.equal(captured.payload.value.type, 'DECIMAL');
});

test('HTTP 200 is only opaque transport output and never a semantic-conformance assertion', async () => {
  const world = createExecutableWorld('http-200-nonclaim', { providerType: 'HTTP' });
  const { envelope } = await executeWorld(world, async () => ({ http_status: 200, body: { arbitrary: 'shape' } }));
  assert.equal(envelope.status, 'SUCCEEDED');
  assert.equal(envelope.rawOutput.http_status, 200);
  assert.equal(envelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');
  assert.equal(JSON.stringify(envelope).includes('SEMANTICALLY_VALID'), false);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`D02 Runtime Execution Broker positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
