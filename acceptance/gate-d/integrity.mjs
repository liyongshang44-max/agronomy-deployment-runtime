import assert from 'node:assert/strict';
import { executePolicyWithRuntimeResults } from '../../packages/runtime-results/src/index.mjs';
import { createBroker, suspendDeployment } from '../implementation-broker/fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';
import { createGateDWorld } from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function validRuntimeInput(world, runtimeResult = world.runtimeResult) {
  return {
    runtimeResult,
    executionEnvelope: world.modelEnvelope,
    inputDatumRefs: [world.soilRef]
  };
}

function policyBroker(world) {
  return createBroker(world, async () => makePolicyActionOutput({
    amount: '10',
    startTime: '2026-08-20T11:00:00Z'
  })).broker;
}

test('Gate D cannot bypass D03 evidence validation with a self-consistent-looking forged RuntimeResult reference', async () => {
  const world = await createGateDWorld('forged-runtime-result');
  const forged = {
    ...world.runtimeResult,
    executionEvidenceHash: `sha256:${'b'.repeat(64)}`
  };
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker: policyBroker(world),
      ledger: world.env.ledger,
      runtimeBindingRef: world.binding.ref,
      contextDatumRefs: [world.soilRef],
      runtimeResultInputs: [validRuntimeInput(world, forged)]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID'
  );
});

test('Gate D cannot skip RuntimeDatum and execute the final Policy through the legacy ContextDatum-only broker path', async () => {
  const world = await createGateDWorld('legacy-policy-bypass');
  const broker = policyBroker(world);
  await assert.rejects(
    () => broker.execute({
      ledger: world.env.ledger,
      runtimeBindingRef: world.binding.ref,
      inputDatumRefs: [world.soilRef]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED'
  );
});

test('historical Model RuntimeDatum evidence cannot bypass current Policy Deployment suspension', async () => {
  const world = await createGateDWorld('current-use-suspension');
  suspendDeployment(world);
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker: policyBroker(world),
      ledger: world.env.ledger,
      runtimeBindingRef: world.binding.ref,
      contextDatumRefs: [world.soilRef],
      runtimeResultInputs: [validRuntimeInput(world)]
    }),
    (error) => error?.code === 'DEPLOYMENT_NOT_RUNTIME_ACTIVE'
  );
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
console.log(`Gate D integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
