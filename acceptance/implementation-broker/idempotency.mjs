import assert from 'node:assert/strict';
import {
  createBroker,
  createExecutableWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('sequential retry of exact execution identity dispatches executor once and returns exact same envelope', async () => {
  const world = createExecutableWorld('idempotent-sequential');
  let calls = 0;
  const { broker, idempotencyStore } = createBroker(world, async () => {
    calls += 1;
    return { estimate_mm: '120' };
  });
  const input = { ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] };
  const first = await broker.execute(input);
  const second = await broker.execute(input);
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.equal(idempotencyStore.size(), 1);
});

test('concurrent exact retries coalesce to one executor invocation', async () => {
  const world = createExecutableWorld('idempotent-concurrent');
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { broker, idempotencyStore } = createBroker(world, async () => {
    calls += 1;
    await gate;
    return { estimate_mm: '121' };
  }, { timeoutMs: 1000 });
  const input = { ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] };
  const firstPromise = broker.execute(input);
  const secondPromise = broker.execute(input);
  await Promise.resolve();
  release();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.equal(idempotencyStore.size(), 1);
});

test('exact failed execution is also cached and retry does not duplicate side effects', async () => {
  const world = createExecutableWorld('idempotent-failure');
  let calls = 0;
  const { broker } = createBroker(world, async () => {
    calls += 1;
    throw new Error('downstream unavailable');
  });
  const input = { ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] };
  const first = await broker.execute(input);
  const second = await broker.execute(input);
  assert.equal(first.status, 'FAILED');
  assert.equal(first.error.code, 'RUNTIME_EXECUTION_TRANSPORT_ERROR');
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test('different exact RuntimeBinding/input authority world produces distinct execution identity', async () => {
  const firstWorld = createExecutableWorld('identity-a');
  const secondWorld = createExecutableWorld('identity-b');
  const first = createBroker(firstWorld, async () => ({ estimate_mm: '122' }));
  const second = createBroker(secondWorld, async () => ({ estimate_mm: '122' }));
  const a = await first.broker.execute({ ledger: firstWorld.env.ledger, runtimeBindingRef: firstWorld.binding.ref, inputDatumRefs: [firstWorld.soilRef] });
  const b = await second.broker.execute({ ledger: secondWorld.env.ledger, runtimeBindingRef: secondWorld.binding.ref, inputDatumRefs: [secondWorld.soilRef] });
  assert.notEqual(a.executionId, b.executionId);
  assert.notEqual(a.inputEnvelopeHash, b.inputEnvelopeHash);
  assert.equal(a.rawOutputHash, b.rawOutputHash);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`D02 Runtime Execution Broker idempotency acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
