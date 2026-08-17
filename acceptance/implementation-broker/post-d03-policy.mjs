import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { publishPolicy } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementationConformance } from '../../packages/implementation-conformance/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import * as brokerPublic from '../../packages/implementation-broker/src/index.mjs';
import { prepareMixedRuntimeExecutionInput } from '../../packages/implementation-broker/src/broker.mjs';
import { executePreparedRuntimeInput } from '../../packages/implementation-broker/src/prepared-input.mjs';
import { executePolicyWithRuntimeResults } from '../../packages/runtime-results/src/index.mjs';
import { createBroker, suspendDeployment } from './fixture.mjs';
import { collect, executeModel, modelWorld, semanticOutput } from '../runtime-results/fixture.mjs';
import { policySpec } from '../specification/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';
import { audit as bindingAudit } from '../runtime-binding/fixture.mjs';

let seq = 0;
function audit(principal, suffix = 'd02-post-d03') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:15:00.000Z',
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'implementation-broker-post-d03-policy' }
  };
}
function serviceAudit(suffix) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function soilPort() {
  return {
    semanticId: 'soil.volumetric_water_content',
    valueType: 'DECIMAL',
    unit: 'm3_per_m3',
    epistemicClasses: ['OBSERVATION'],
    measurementConvention: 'VWC_FRACTION'
  };
}

function policyWorldFromModelWorld(world, label, policyOverrides = {}) {
  const { ledger } = world.env;
  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d02.post-d03.policy.spec.${label}`,
    version: '1',
    principal: world.specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const policyId = `policy.d02.post-d03.${label}`;
  const specDecision = authorizeSpecificationManage({
    principal: world.specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'POLICY', resourceId: policyId }
  });
  const specAuth = recordAuthorizationDecision({ ledger, decision: specDecision, audit: serviceAudit('policy-auth') });
  const policy = publishPolicy({
    ledger,
    logicalId: policyId,
    version: '1',
    specification: policySpec({ requiredInputs: [soilPort()], ...policyOverrides }),
    principal: world.specManager,
    authorizationDecisionAuditRef: specAuth.ref,
    audit: audit(world.specManager, 'policy-publish')
  });

  const conformanceId = `conformance.d02.post-d03.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: world.qualifier,
    roleAssignments: [world.qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId }
  });
  const conformanceAuth = recordAuthorizationDecision({
    ledger,
    decision: conformanceDecision,
    audit: serviceAudit('policy-conformance-auth')
  });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: '1',
    specificationRef: policy.ref,
    implementationRef: world.implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod('d'),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments: ['STAGING'],
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'],
    knownLimitations: [],
    validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
    principal: world.qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(world.qualifier, 'policy-conformance-publish')
  });
  const binding = publishRuntimeBinding({
    ledger,
    logicalId: `runtime-binding.d02.post-d03.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    selectedAlternativePathId: world.selected.pathId,
    specificationExecutionBinding: {
      specificationRef: policy.ref,
      implementationRef: world.implementation.ref,
      implementationConformanceRef: conformance.ref,
      availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
    },
    audit: bindingAudit(world.env.runtimePrincipal, `d02-post-d03-${label}`)
  });
  return { ...world, policy, conformance, binding };
}

async function upstreamEvidence(label = 'upstream') {
  const world = modelWorld(`d02-post-d03-${label}`);
  const execution = await executeModel(world, semanticOutput());
  const result = collect(world, execution.envelope);
  return { world, execution, result };
}

function resultInput(upstream, runtimeResult = upstream.result) {
  return {
    runtimeResult,
    executionEnvelope: upstream.execution.envelope,
    inputDatumRefs: [upstream.world.soilRef]
  };
}

function runtimeEntryFrom(upstream, payload = upstream.result.runtimeDatums[0]) {
  return {
    runtimeResultId: upstream.result.runtimeResultId,
    runtimeResultSemanticHash: upstream.result.resultSemanticHash,
    executionEvidenceHash: upstream.result.executionEvidenceHash,
    runtimeDatumId: payload.runtimeDatumId,
    semanticId: payload.semanticId,
    semanticHash: payload.outputSemanticHash,
    payload
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('evidence-backed Model RuntimeDatum can satisfy exact Policy requiredRuntimeOutputs', async () => {
  const upstream = await upstreamEvidence('success');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'success');
  let captured = null;
  const { broker } = createBroker(policyWorld, async (request) => {
    captured = request;
    return { actionCode: 'WAIT', parameters: [] };
  });
  const envelope = await executePolicyWithRuntimeResults({
    broker,
    ledger: policyWorld.env.ledger,
    runtimeBindingRef: policyWorld.binding.ref,
    contextDatumRefs: [policyWorld.soilRef],
    runtimeResultInputs: [resultInput(upstream)]
  });
  assert.equal(envelope.status, 'SUCCEEDED');
  assert.equal(captured.contractVersion, 'adr.executor-request.v2');
  assert.equal(captured.contextEntries.length, 1);
  assert.equal(captured.contextEntries[0].semanticId, 'soil.volumetric_water_content');
  assert.equal(captured.runtimeEntries.length, 1);
  assert.equal(captured.runtimeEntries[0].semanticId, 'soil.root_zone_water_storage');
  assert.equal(captured.runtimeEntries[0].semanticHash, upstream.result.runtimeDatums[0].outputSemanticHash);
  assert.equal(captured.runtimeEntries[0].runtimeResultSemanticHash, upstream.result.resultSemanticHash);
  assert.equal(captured.runtimeEntries[0].executionEvidenceHash, upstream.result.executionEvidenceHash);
});

test('exact mixed Policy retry revalidates current use but dispatches one idempotent execution identity', async () => {
  const upstream = await upstreamEvidence('retry');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'retry');
  let calls = 0;
  const { broker } = createBroker(policyWorld, async () => {
    calls += 1;
    return { actionCode: 'WAIT', parameters: [] };
  });
  const request = {
    broker,
    ledger: policyWorld.env.ledger,
    runtimeBindingRef: policyWorld.binding.ref,
    contextDatumRefs: [policyWorld.soilRef],
    runtimeResultInputs: [resultInput(upstream)]
  };
  const first = await executePolicyWithRuntimeResults(request);
  const second = await executePolicyWithRuntimeResults(request);
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('legacy public broker.execute remains ContextDatum-only and refuses Policy runtime-output requirements', async () => {
  const upstream = await upstreamEvidence('legacy-refusal');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'legacy-refusal');
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  await assert.rejects(
    () => broker.execute({
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      inputDatumRefs: [policyWorld.soilRef]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED'
  );
});

test('self-consistent forged RuntimeResult cannot become a Policy input without exact D03 evidence replay', async () => {
  const upstream = await upstreamEvidence('forged-result');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'forged-result');
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  const forged = { ...upstream.result, executionEvidenceHash: `sha256:${'b'.repeat(64)}` };
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker,
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeResultInputs: [resultInput(upstream, forged)]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID'
  );
});

test('Policy runtime port unit mismatch fails closed after RuntimeResult evidence validates', async () => {
  const upstream = await upstreamEvidence('unit-mismatch');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'unit-mismatch', {
    requiredRuntimeOutputs: [{
      semanticId: 'soil.root_zone_water_storage',
      valueType: 'DECIMAL',
      unit: 'cm',
      epistemicClasses: ['STATE_ESTIMATE']
    }]
  });
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker,
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeResultInputs: [resultInput(upstream)]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_INPUT_UNIT_MISMATCH'
  );
});

test('validated RuntimeResult that contributes no required Policy semantic is rejected as unused evidence', async () => {
  const upstream = await upstreamEvidence('unused-result');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'unused-result-policy', {
    requiredRuntimeOutputs: [{
      semanticId: 'weather.reference_et',
      valueType: 'DECIMAL',
      unit: 'mm',
      epistemicClasses: ['STATE_ESTIMATE']
    }]
  });
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker,
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeResultInputs: [resultInput(upstream)]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_UNUSED_RUNTIME_RESULT'
  );
});

test('missing required RuntimeDatum fails closed when no RuntimeResult evidence is supplied', async () => {
  const upstream = await upstreamEvidence('missing-result');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'missing-result-policy');
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker,
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeResultInputs: []
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_REQUIRED'
  );
});

test('current-binding RuntimeDatum cannot self-authorize the Policy binding being prepared', async () => {
  const upstream = await upstreamEvidence('self-authorization');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'self-authorization');
  const source = upstream.result.runtimeDatums[0];
  const forgedPayload = { ...source, runtimeBindingRef: policyWorld.binding.ref };
  assert.throws(
    () => prepareMixedRuntimeExecutionInput({
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeEntries: [runtimeEntryFrom(upstream, forgedPayload)]
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_SELF_AUTHORIZATION'
  );
});

test('prepared mixed input cannot be replayed against a different current RuntimeBinding world', async () => {
  const upstream = await upstreamEvidence('prepared-world');
  const policyA = policyWorldFromModelWorld(upstream.world, 'prepared-world-a');
  const policyB = policyWorldFromModelWorld(upstream.world, 'prepared-world-b');
  const inputEnvelope = prepareMixedRuntimeExecutionInput({
    ledger: policyA.env.ledger,
    runtimeBindingRef: policyA.binding.ref,
    contextDatumRefs: [policyA.soilRef],
    runtimeEntries: [runtimeEntryFrom(upstream)]
  });
  const { broker } = createBroker(policyB, async () => ({ actionCode: 'WAIT', parameters: [] }));
  await assert.rejects(
    () => executePreparedRuntimeInput(broker, {
      ledger: policyB.env.ledger,
      runtimeBindingRef: policyB.binding.ref,
      inputEnvelope
    }),
    (error) => error?.code === 'RUNTIME_EXECUTION_PREPARED_INPUT_WORLD_MISMATCH'
  );
});

test('historical RuntimeResult evidence does not bypass current Policy Deployment suspension', async () => {
  const upstream = await upstreamEvidence('suspended-policy');
  const policyWorld = policyWorldFromModelWorld(upstream.world, 'suspended-policy');
  const { broker } = createBroker(policyWorld, async () => ({ actionCode: 'WAIT', parameters: [] }));
  suspendDeployment(policyWorld);
  await assert.rejects(
    () => executePolicyWithRuntimeResults({
      broker,
      ledger: policyWorld.env.ledger,
      runtimeBindingRef: policyWorld.binding.ref,
      contextDatumRefs: [policyWorld.soilRef],
      runtimeResultInputs: [resultInput(upstream)]
    }),
    (error) => error?.code === 'DEPLOYMENT_NOT_RUNTIME_ACTIVE'
  );
});

test('prepared mixed-input capability is not exported from implementation-broker public index', () => {
  assert.equal('prepareMixedRuntimeExecutionInput' in brokerPublic, false);
  assert.equal('executePreparedRuntimeInput' in brokerPublic, false);
  assert.equal('PREPARED_RUNTIME_INPUT_EXECUTE' in brokerPublic, false);
  assert.equal(typeof prepareMixedRuntimeExecutionInput, 'function');
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
console.log(`D02 post-D03 Policy RuntimeDatum input acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
