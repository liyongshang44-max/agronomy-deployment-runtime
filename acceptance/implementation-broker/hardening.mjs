import assert from 'node:assert/strict';
import {
  createBroker,
  createExecutableWorld
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

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`D02 Runtime Execution Broker hardening acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
