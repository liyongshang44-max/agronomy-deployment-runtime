import assert from 'node:assert/strict';
import {
  RUNTIME_EXECUTION_RETRY_DISPOSITION,
  normalizeRuntimeExecutionEnvelope,
  runtimeExecutionInputHash
} from '../../packages/implementation-broker/src/index.mjs';
import {
  createBroker,
  createExecutableWorld,
  suspendDeployment
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('Model with required parameter slot fails closed until exact parameter/calibration binding authority exists', async () => {
  const world = createExecutableWorld('required-parameter', {
    modelOverrides: {
      parameterSlots: [{
        name: 'root_depth_mm',
        semanticId: 'crop.root_depth',
        valueType: 'DECIMAL',
        unit: 'mm',
        required: true
      }],
      calibrationRequirements: []
    }
  });
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'RUNTIME_EXECUTION_PARAMETER_BINDING_REQUIRED'
  );
});

test('broker execute input is closed and caller cannot override bound Implementation/Conformance/dispatch semantics', async () => {
  const world = createExecutableWorld('closed-input');
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  for (const [key, value] of [
    ['implementationRef', world.implementation.ref],
    ['implementationConformanceRef', world.conformance.ref],
    ['dispatchClass', 'EXTERNAL'],
    ['runtimeEnvironment', 'PRODUCTION'],
    ['rawInputs', [{ value: 'fake' }]]
  ]) {
    await assert.rejects(
      () => broker.execute({
        ledger: world.env.ledger,
        runtimeBindingRef: world.binding.ref,
        inputDatumRefs: [world.soilRef],
        [key]: value
      }),
      (error) => error?.code === 'INVALID_RUNTIME_EXECUTION_FIELD',
      key
    );
  }
});

test('duplicate exact input authority is rejected before dispatch', async () => {
  const world = createExecutableWorld('duplicate-input');
  let calls = 0;
  const { broker } = createBroker(world, async () => { calls += 1; return { estimate_mm: '1' }; });
  await assert.rejects(
    () => broker.execute({
      ledger: world.env.ledger,
      runtimeBindingRef: world.binding.ref,
      inputDatumRefs: [world.soilRef, world.soilRef]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_DUPLICATE_INPUT'
  );
  assert.equal(calls, 0);
});

test('executor request is deeply frozen so adapter cannot rewrite bound request semantics in place', async () => {
  const world = createExecutableWorld('frozen-request');
  let frozen = false;
  const { broker } = createBroker(world, async (request) => {
    frozen = Object.isFrozen(request)
      && Object.isFrozen(request.inputEntries)
      && Object.isFrozen(request.inputEntries[0])
      && Object.isFrozen(request.inputEntries[0].payload);
    assert.throws(() => { request.dispatchClass = 'EXTERNAL'; }, TypeError);
    return { estimate_mm: '1' };
  });
  const envelope = await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  assert.equal(envelope.status, 'SUCCEEDED');
  assert.equal(frozen, true);
});

test('normalized execution envelope rejects executionId tampering against exact RuntimeBinding/node/input identity', async () => {
  const world = createExecutableWorld('execution-id-integrity');
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  const envelope = await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  assert.throws(
    () => normalizeRuntimeExecutionEnvelope({ ...envelope, executionId: 'sha256:tampered' }),
    (error) => error?.code === 'RUNTIME_EXECUTION_IDENTITY_MISMATCH'
  );
});

test('normalized execution envelope rejects raw-output hash tampering', async () => {
  const world = createExecutableWorld('output-hash-integrity');
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  const envelope = await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  assert.throws(
    () => normalizeRuntimeExecutionEnvelope({ ...envelope, rawOutputHash: 'sha256:tampered' }),
    (error) => error?.code === 'RUNTIME_EXECUTION_OUTPUT_HASH_MISMATCH'
  );
});

test('current-use Deployment revalidation precedes cached retry after authority is suspended', async () => {
  const world = createExecutableWorld('cached-retry-current-use');
  let calls = 0;
  const { broker } = createBroker(world, async () => { calls += 1; return { estimate_mm: '1' }; });
  const first = await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  assert.equal(first.status, 'SUCCEEDED');
  suspendDeployment(world);
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'DEPLOYMENT_NOT_RUNTIME_ACTIVE'
  );
  assert.equal(calls, 1);
});

test('clock regression after executor side effect fails closed and exact retry does not re-dispatch', async () => {
  const world = createExecutableWorld('clock-regression');
  let calls = 0;
  const { broker } = createBroker(
    world,
    async () => { calls += 1; return { estimate_mm: '1' }; },
    { clockValues: ['2026-08-20T10:15:00.000Z', '2026-08-20T10:14:59.000Z'] }
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
      (error) => error?.code === 'RUNTIME_EXECUTION_CLOCK_REGRESSION'
    );
  }
  assert.equal(calls, 1);
});

test('failed execution retry contract explicitly preserves current-use revalidation before cache replay', async () => {
  const world = createExecutableWorld('retry-disposition');
  const { broker } = createBroker(world, async () => { throw new Error('offline'); });
  const envelope = await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  assert.equal(envelope.status, 'FAILED');
  assert.equal(envelope.error.retryDisposition, RUNTIME_EXECUTION_RETRY_DISPOSITION);
});

test('input envelope identity remains hash-bound to its exact runtime node tuple', async () => {
  const world = createExecutableWorld('input-node-identity');
  let captured;
  const { broker } = createBroker(world, async (request) => { captured = request; return { estimate_mm: '1' }; });
  await broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] });
  const inputEnvelope = {
    contractVersion: 'adr.runtime-execution-input.v1',
    runtimeBindingRef: captured.runtimeBindingRef,
    runtimeNodeId: `${captured.runtimeNodeId}:tampered`,
    specificationRef: captured.specificationRef,
    implementationRef: captured.implementationRef,
    implementationConformanceRef: captured.implementationConformanceRef,
    inputEntries: captured.inputEntries
  };
  assert.throws(
    () => runtimeExecutionInputHash(inputEnvelope),
    (error) => error?.code === 'RUNTIME_EXECUTION_IDENTITY_MISMATCH'
  );
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`D02 Runtime Execution Broker hardening acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
