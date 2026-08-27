import assert from 'node:assert/strict';

import {
  ImplementationExecutorRegistry,
  RuntimeExecutionBroker,
  RuntimeExecutionIdempotencyStore
} from '../../packages/implementation-broker/src/index.mjs';
import { decisionRobustnessWorld, makePolicyActionOutput } from '../decision-robustness/fixture.mjs';

function contextDatumBySemanticId(world, semanticId) {
  const refs = world.manifest.semanticPayload.datumRefs;
  for (const ref of refs) {
    const record = world.env.ledger.resolve(ref);
    if (record.semanticPayload.semanticId === semanticId) return record;
  }
  throw new Error(`missing ContextDatum ${semanticId}`);
}

const world = decisionRobustnessWorld('policy-v3-d02-context-only', {
  includeBindingCount: 1,
  policyOverrides: {
    contractVersion: 'adr.policy.v3',
    requiredInputs: [{
      semanticId: 'crop.code',
      valueType: 'CATEGORY',
      unit: '1',
      epistemicClasses: ['ASSERTION']
    }],
    requiredRuntimeOutputs: []
  }
});

assert.equal(world.policy.semanticPayload.contractVersion, 'adr.policy.v3');
assert.deepEqual(world.policy.semanticPayload.requiredRuntimeOutputs, []);

const crop = contextDatumBySemanticId(world, 'crop.code');
const binding = world.includedBindings[0];

let capturedRequest = null;
const registry = new ImplementationExecutorRegistry();
registry.register({
  implementationRef: world.implementation.ref,
  dispatchClass: 'INTERNAL',
  execute: async (request) => {
    capturedRequest = request;
    return makePolicyActionOutput({ actionCode: 'WAIT' });
  }
});

const broker = new RuntimeExecutionBroker({
  executorRegistry: registry,
  idempotencyStore: new RuntimeExecutionIdempotencyStore(),
  clock: () => '2026-08-20T10:30:00.000Z',
  timeoutMs: 1000
});

const envelope = await broker.execute({
  ledger: world.env.ledger,
  runtimeBindingRef: binding.ref,
  inputDatumRefs: [crop.ref]
});

assert.equal(envelope.status, 'SUCCEEDED');
assert.ok(capturedRequest);
assert.equal(capturedRequest.contractVersion, 'adr.executor-request.v1');
assert.equal(Array.isArray(capturedRequest.inputEntries), true);
assert.equal(capturedRequest.inputEntries.length, 1);
assert.equal(capturedRequest.inputEntries[0].semanticId, 'crop.code');
assert.deepEqual(capturedRequest.inputEntries[0].authorityRef, crop.ref);
assert.equal(Object.hasOwn(capturedRequest, 'runtimeEntries'), false);
assert.equal(Object.hasOwn(capturedRequest, 'contextEntries'), false);
assert.equal(envelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');

console.log(JSON.stringify({
  ok: true,
  policyContractVersion: world.policy.semanticPayload.contractVersion,
  requiredContextInputCount: world.policy.semanticPayload.requiredInputs.length,
  requiredRuntimeOutputCount: world.policy.semanticPayload.requiredRuntimeOutputs.length,
  executorRequestContractVersion: capturedRequest.contractVersion,
  runtimeEntriesPresent: Object.hasOwn(capturedRequest, 'runtimeEntries'),
  conclusion: 'POLICY_V3_CONTEXT_ONLY_REUSES_EXISTING_D02_CONTEXTDATUM_EXECUTION_PATH'
}, null, 2));
