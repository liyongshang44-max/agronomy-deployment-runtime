import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createResultSinkEvent } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY,
  GEOX_DECISION_RESULT_TARGET_BINDING_MODE,
  consumeAdrDecisionResultForGeox
} from '../../adapters/geox/src/decision-result-sink.mjs';

const consumerScope = Object.freeze({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  groupId: 'group-a'
});

function decisionRef(kind = 'DecisionResult') {
  return {
    kind,
    logical_id: 'decision-result.integrity',
    version: '1',
    semantic_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  };
}

function action() {
  return {
    contractVersion: 'adr.material-action-signature.v1',
    policyRef: {
      kind: 'Policy',
      logicalId: 'policy.integrity',
      version: '1',
      semanticHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    },
    equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
    actionCode: 'SET_SOYBEAN_SEEDING_RATE',
    materialParameters: [{
      name: 'population',
      semanticId: 'planting.population_seeds_per_acre',
      valueType: 'DECIMAL',
      unit: 'seed/acre',
      value: { type: 'DECIMAL', decimal: '150000' }
    }],
    signatureHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
  };
}

function payload(overrides = {}) {
  return {
    decision_disposition: 'ACT',
    structured_action: action(),
    human_approval_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority,
    machine_execution_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority,
    target_binding: {
      mode: GEOX_DECISION_RESULT_TARGET_BINDING_MODE,
      reason_code: 'NO_GOVERNED_GEOX_FIELD_BINDING'
    },
    ...overrides
  };
}

function event(overrides = {}) {
  return createResultSinkEvent({
    eventId: overrides.eventId ?? 'geox-decision-integrity',
    eventType: overrides.eventType ?? 'DECISION_RESULT_PUBLISHED',
    ...(overrides.projectionOnly
      ? { projectionHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' }
      : { authorityRef: overrides.authorityRef ?? decisionRef() }),
    payload: overrides.payload ?? payload()
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('DecisionResult sink imports only the public SDK layer and no ADR authority package', async () => {
  const source = await readFile(new URL('../../adapters/geox/src/decision-result-sink.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes("../../../sdks/typescript/src/index.mjs"), true);
  assert.equal(/from\s*['"][^'"]*packages\//.test(source), false);
  assert.equal(source.includes('authorize'), false);
  assert.equal(source.includes('PERMISSIONS.'), false);
});

test('projection-only event fails closed because exact DecisionResult authority identity is required', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({ event: event({ projectionOnly: true }), consumerScope }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_REF_REQUIRED'
  );
});

test('wrong authority kind cannot masquerade as DecisionResult', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ authorityRef: decisionRef('RuntimeBinding') }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_REF_REQUIRED'
  );
});

test('wrong result event type cannot enter the DecisionResult sink', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ eventType: 'APPLICABILITY_PUBLISHED' }),
      consumerScope
    }),
    (error) => error?.code === 'INVALID_GEOX_DECISION_RESULT_EVENT'
  );
});

test('GEOX payload cannot add a hidden dispatch authorization field', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ payload: payload({ dispatch_authorized: true }) }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_PAYLOAD_FIELD_FORBIDDEN'
  );
});

test('DecisionResult cannot be promoted to human approval authority by the sink payload', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ payload: payload({ human_approval_authority: 'APPROVED' }) }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_ESCALATION_FORBIDDEN'
  );
});

test('DecisionResult cannot be promoted to machine execution authority by the sink payload', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ payload: payload({ machine_execution_authority: 'DISPATCH_AUTHORIZED' }) }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_ESCALATION_FORBIDDEN'
  );
});

test('v1 sink rejects claimed GEOX field binding until a governed target identity binding exists', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({
        payload: payload({
          target_binding: {
            mode: 'EXACT_GEOX_FIELD_BINDING',
            reason_code: 'CLAIMED_BY_CONSUMER'
          }
        })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_TARGET_BINDING_REQUIRED'
  );
});

test('ACT requires governed material-action signature and cannot accept opaque action text', () => {
  assert.throws(
    () => consumeAdrDecisionResultForGeox({
      event: event({ payload: payload({ structured_action: { actionCode: 'DO_SOMETHING' } }) }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_DECISION_RESULT_ACTION_CONTRACT_REQUIRED'
  );
});

test('safe projection remains display-only, unbound, and non-dispatchable', () => {
  const projection = consumeAdrDecisionResultForGeox({ event: event(), consumerScope });
  assert.equal(projection.target_binding.status, 'UNRESOLVED');
  assert.equal(projection.consumer_disposition, 'DISPLAY_ONLY_ADVISORY_CANDIDATE');
  assert.equal(projection.dispatch_authorized, false);
  assert.equal(projection.field_actionable, false);
  assert.equal('field_id' in projection.routing_scope, false);
  assert.equal('geometry_ref' in projection.routing_scope, false);
  assert.equal(projection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');
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
console.log(`GEOX DecisionResult sink integrity: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exitCode = 1;
