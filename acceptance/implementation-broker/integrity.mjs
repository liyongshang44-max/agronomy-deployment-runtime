import assert from 'node:assert/strict';
import {
  ImplementationExecutorRegistry,
  RuntimeExecutionBroker,
  RuntimeExecutionIdempotencyStore
} from '../../packages/implementation-broker/src/index.mjs';
import {
  authorizeImplementationConformanceControl
} from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { publishImplementationConformanceControlDecision } from '../../packages/implementation-conformance/src/index.mjs';
import { publishAuthorized, baseDatum } from '../context-datum/fixtures.mjs';
import { directBindingWorld, publishBinding } from '../runtime-binding/fixture.mjs';
import {
  audit,
  createBroker,
  createExecutableWorld,
  executeWorld,
  suspendDeployment
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function fixedClock() { return '2026-08-20T10:15:00.000Z'; }

function emptyBroker() {
  return new RuntimeExecutionBroker({
    executorRegistry: new ImplementationExecutorRegistry(),
    idempotencyStore: new RuntimeExecutionIdempotencyStore(),
    clock: fixedClock,
    timeoutMs: 50
  });
}

function revokeConformance(world) {
  const decision = authorizeImplementationConformanceControl({
    action: 'REVOKE',
    principal: world.qualifier,
    roleAssignments: [world.qualifierAssignment],
    authorizationScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'IMPLEMENTATION_CONFORMANCE',
      resourceId: world.conformance.ref.logicalId
    }
  });
  const auth = recordAuthorizationDecision({
    ledger: world.env.ledger,
    decision,
    audit: audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, 'revoke-auth')
  });
  return publishImplementationConformanceControlDecision({
    ledger: world.env.ledger,
    conformanceRef: world.conformance.ref,
    version: '1',
    action: 'REVOKE',
    controlledAt: '2026-08-20T10:12:00Z',
    reasonCodes: ['D02_TEST_REVOKE'],
    principal: world.qualifier,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(world.qualifier, 'revoke')
  });
}

test('RuntimeBinding without exact S03 executable relation cannot dispatch', async () => {
  const world = directBindingWorld('d02-no-executable');
  const binding = publishBinding(world, 'd02-no-executable');
  await assert.rejects(
    () => emptyBroker().execute({ ledger: world.env.ledger, runtimeBindingRef: binding.ref, inputDatumRefs: [world.manifest.semanticPayload.datumRefs[0]] }),
    (error) => error?.code === 'RUNTIME_EXECUTION_BINDING_REQUIRED'
  );
});

test('valid ContextDatum outside exact frozen ContextManifest cannot become execution input', async () => {
  const world = createExecutableWorld('outside-manifest');
  const outside = publishAuthorized(
    world.env.ledger,
    'context-datum.d02.outside-manifest',
    '1',
    baseDatum({
      effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
      availableAt: '2026-08-20T10:00:00Z'
    })
  );
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [outside.ref] }),
    (error) => error?.code === 'RUNTIME_EXECUTION_INPUT_NOT_IN_MANIFEST'
  );
});

test('wrong semantic ContextDatum from the same manifest cannot satisfy bound Model input', async () => {
  const world = createExecutableWorld('wrong-semantic');
  const cropRef = world.manifest.semanticPayload.datumRefs.find((ref) =>
    world.env.ledger.resolve(ref).semanticPayload.semanticId === 'crop.code');
  assert(cropRef);
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [cropRef] }),
    (error) => error?.code === 'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH'
  );
});

test('no executor registered for exact Implementation fails closed without fallback', async () => {
  const world = createExecutableWorld('unregistered');
  await assert.rejects(
    () => emptyBroker().execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'RUNTIME_EXECUTOR_NOT_REGISTERED'
  );
});

test('executor registered under wrong dispatch class cannot be used', async () => {
  const world = createExecutableWorld('dispatch-mismatch');
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }), { dispatchClass: 'EXTERNAL' });
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'RUNTIME_EXECUTOR_DISPATCH_CLASS_MISMATCH'
  );
});

test('conformance revoked after RuntimeBinding publication blocks new dispatch', async () => {
  const world = createExecutableWorld('revoked-after-binding');
  revokeConformance(world);
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'CONFORMANCE_REVOKED'
  );
});

test('conformance that expires after binding but before dispatch blocks new execution', async () => {
  const world = createExecutableWorld('expires-before-dispatch', {
    validityInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:12:00Z' }
  });
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'CONFORMANCE_EXPIRED_OR_NOT_YET_VALID'
  );
});

test('Deployment suspended after RuntimeBinding publication blocks new dispatch', async () => {
  const world = createExecutableWorld('suspended-deployment');
  suspendDeployment(world);
  const { broker } = createBroker(world, async () => ({ estimate_mm: '1' }));
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'DEPLOYMENT_NOT_RUNTIME_ACTIVE'
  );
});

test('executor throw is normalized as transport failure rather than semantic result', async () => {
  const world = createExecutableWorld('transport-error');
  const { envelope } = await executeWorld(world, async () => { throw new Error('network unavailable'); });
  assert.equal(envelope.status, 'FAILED');
  assert.equal(envelope.error.code, 'RUNTIME_EXECUTION_TRANSPORT_ERROR');
  assert.equal(envelope.error.phase, 'DISPATCH');
  assert.equal(envelope.rawOutput, null);
  assert.equal(envelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');
});

test('executor timeout is normalized with exact timeout taxonomy', async () => {
  const world = createExecutableWorld('timeout');
  const { envelope } = await executeWorld(world, () => new Promise(() => {}), { timeoutMs: 5 });
  assert.equal(envelope.status, 'FAILED');
  assert.equal(envelope.error.code, 'RUNTIME_EXECUTION_TIMEOUT');
  assert.equal(envelope.error.phase, 'DISPATCH');
});

test('non-canonical executor output fails capture instead of becoming RuntimeResult', async () => {
  const world = createExecutableWorld('invalid-output');
  const { envelope } = await executeWorld(world, async () => ({ value: undefined }));
  assert.equal(envelope.status, 'FAILED');
  assert.equal(envelope.error.code, 'RUNTIME_EXECUTION_OUTPUT_INVALID');
  assert.equal(envelope.error.phase, 'OUTPUT_CAPTURE');
});

test('executor registered for another exact Implementation cannot substitute the bound implementation', async () => {
  const world = createExecutableWorld('no-substitution');
  const other = createExecutableWorld('other-implementation', { providerType: 'INTERNAL', implementationOverrides: { digestChar: '9', artifactChar: '8' } });
  const registry = new ImplementationExecutorRegistry();
  registry.register({ implementationRef: other.implementation.ref, dispatchClass: 'INTERNAL', execute: async () => ({ estimate_mm: '1' }) });
  const broker = new RuntimeExecutionBroker({
    executorRegistry: registry,
    idempotencyStore: new RuntimeExecutionIdempotencyStore(),
    clock: fixedClock,
    timeoutMs: 50
  });
  await assert.rejects(
    () => broker.execute({ ledger: world.env.ledger, runtimeBindingRef: world.binding.ref, inputDatumRefs: [world.soilRef] }),
    (error) => error?.code === 'RUNTIME_EXECUTOR_NOT_REGISTERED'
  );
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`D02 Runtime Execution Broker integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
