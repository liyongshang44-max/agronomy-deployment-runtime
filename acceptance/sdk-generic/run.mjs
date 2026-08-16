import assert from 'node:assert/strict';
import { PUBLIC_API_OPERATIONS } from '../../packages/public-api/src/index.mjs';
import {
  SDK_PILOT_READ_OPERATIONS,
  SDK_PILOT_WRITE_OPERATIONS,
  INTEGRATION_ROLES,
  assertPilotRoleEnabled,
  createAdrPilotClient,
  createIntegrationBatch,
  createIntegrationMessage,
  createResultSinkEvent
} from '../../sdks/typescript/src/index.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const principal = {
  principal_id: 'svc-customer-a',
  type: 'SERVICE_ACCOUNT',
  organization_id: 'customer-org-a',
  tenant_id: 'tenant-a',
  program_ids: ['pilot-a']
};
const authRef = {
  kind: 'AuthorizationDecisionAudit',
  logical_id: 'auth-1',
  version: '1',
  semantic_hash: 'sha256:auth-ref-1'
};

function authorityResponse(kind, logicalId, version, contract, resource) {
  return {
    ref: { kind, logical_id: logicalId, version, semantic_hash: `sha256:${kind}-${logicalId}-${version}` },
    resource: { ...resource, contract_version: contract }
  };
}

test('P02 SDK operation registry exactly tracks the P01 pilot API surface', () => {
  const writes = PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'AUTHORITY_WRITE');
  const reads = PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'NON_AUTHORITY_READ_MODEL');
  assert.deepEqual(Object.keys(SDK_PILOT_WRITE_OPERATIONS).sort(), writes.map((item) => item.operationId).sort());
  assert.deepEqual(Object.keys(SDK_PILOT_READ_OPERATIONS).sort(), reads.map((item) => item.operationId).sort());
  for (const operation of writes) {
    assert.deepEqual(SDK_PILOT_WRITE_OPERATIONS[operation.operationId], {
      method: operation.method,
      path: `/v1${operation.path}`,
      contract: operation.resourceContract
    });
  }
  for (const operation of reads) {
    assert.deepEqual(SDK_PILOT_READ_OPERATIONS[operation.operationId], {
      method: operation.method,
      path: `/v1${operation.path}`
    });
  }
});

test('ContextDatum round-trip preserves semantic provenance time support uncertainty and source fields', async () => {
  const requests = [];
  const contextDatum = {
    contract_version: 'adr.context-datum.v1',
    datum_id: 'customer-soil-1',
    semantic_id: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.314' },
    unit: 'm3_per_m3',
    epistemic_class: 'OBSERVATION',
    provenance_class: 'SENSOR',
    effective_interval: { start: '2026-08-16T08:00:00.000Z', end: '2026-08-16T09:00:00.000Z' },
    available_at: '2026-08-16T09:01:00.000Z',
    spatial_support: { type: 'FIELD', geometry_ref: 'customer-field-42' },
    vertical_support: { from_mm: '80', to_mm: '120' },
    temporal_support: { type: 'INTERVAL' },
    uncertainty: { type: 'INTERVAL', lower: { type: 'DECIMAL', decimal: '0.30' }, upper: { type: 'DECIMAL', decimal: '0.33' } },
    source: { provider_id: 'customer-sensor-platform', source_ref: 'sensor/17/reading/99', content_hash: 'sha256:reading-99' },
    semantic_hash: 'sha256:datum-semantic-1'
  };
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'token-a',
    transport: async (request) => {
      requests.push(request);
      return authorityResponse('ContextDatum', request.body.logical_id, request.body.version, 'adr.context-datum.v1', request.body.resource);
    }
  });
  const result = await client.createContextDatum({
    logicalId: 'context-datum/customer/soil-1',
    version: '1',
    authorizationDecisionRef: authRef,
    resource: contextDatum,
    idempotencyKey: 'idem-soil-1'
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].body.resource, contextDatum);
  assert.deepEqual(result.resource, contextDatum);
  assert.equal(requests[0].headers.Authorization, 'Bearer token-a');
  assert.equal(requests[0].headers['Idempotency-Key'], 'idem-soil-1');
  assert.deepEqual(requests[0].body.principal, principal);
  assert.deepEqual(requests[0].body.authorization_decision_ref, authRef);
});

test('SDK fixes caller principal at client construction and exposes no per-call impersonation field', async () => {
  let request;
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'token-a',
    transport: async (value) => {
      request = value;
      return authorityResponse('DecisionProblem', value.body.logical_id, value.body.version, 'adr.decision-problem.v1', value.body.resource);
    }
  });
  await client.createDecisionProblem({
    logicalId: 'dp-1',
    version: '1',
    authorizationDecisionRef: authRef,
    resource: { contract_version: 'adr.decision-problem.v1', decision_type: 'IRRIGATION_TIMING' },
    idempotencyKey: 'idem-dp-1'
  });
  assert.deepEqual(request.body.principal, principal);
  assert.equal('principal' in request.body.resource, false);
});

test('reference resolution encodes exact path parameter and keeps authority payload separate', async () => {
  let request;
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'token-a',
    transport: async (value) => {
      request = value;
      return authorityResponse('ResolvedContextDatumReceipt', value.body.logical_id, value.body.version, 'adr.context-receipt.v1', value.body.resource);
    }
  });
  await client.resolveContextReference({
    logicalId: 'receipt-1',
    version: '1',
    authorizationDecisionRef: authRef,
    resource: { contract_version: 'adr.context-receipt.v1', reference_ref: { logical_id: 'ref/a b' } },
    idempotencyKey: 'idem-r1',
    pathParameters: { reference_id: 'ref/a b' }
  });
  assert.equal(request.path, '/v1/context-references/ref%2Fa%20b/resolutions');
});

test('SDK rejects response contract drift instead of silently accepting another resource shape', async () => {
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'token-a',
    transport: async () => authorityResponse('ContextDatum', 'cd-1', '1', 'adr.decision-problem.v1', { contract_version: 'adr.decision-problem.v1' })
  });
  await assert.rejects(() => client.createContextDatum({
    logicalId: 'cd-1', version: '1', authorizationDecisionRef: authRef,
    resource: { contract_version: 'adr.context-datum.v1', semantic_id: 'crop.code' },
    idempotencyKey: 'idem-cd-1'
  }), (error) => error?.code === 'SDK_RESPONSE_CONTRACT_MISMATCH');
});

test('generic integration batch preserves exact authority refs message identity and payload', () => {
  const message = createIntegrationMessage({
    role: 'CONTEXT_PROVIDER',
    messageType: 'CONTEXT_DATUM_AVAILABLE',
    messageId: 'msg-1',
    authorityRefs: [{ kind: 'ContextDatum', logical_id: 'cd-1', version: '1', semantic_hash: 'sha256:cd-1' }],
    payload: { customer_record_id: 'r-42', semantic_id: 'soil.volumetric_water_content', value: '0.31' }
  });
  const batch = createIntegrationBatch({ batchId: 'batch-1', messages: [message] });
  assert.deepEqual(batch.messages[0], message);
  assert.equal(batch.contract_version, 'adr.integration-batch.v1');
});

test('ResultSink event distinguishes authority result from non-authority projection identity', () => {
  const authority = createResultSinkEvent({
    eventId: 'evt-1', eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: { kind: 'ApplicabilityAssessment', logical_id: 'aa-1', version: '1', semantic_hash: 'sha256:aa-1' },
    payload: { status: 'UNRESOLVED' }
  });
  const projection = createResultSinkEvent({
    eventId: 'evt-2', eventType: 'WORKBENCH_CASE_PROJECTED',
    projectionHash: 'sha256:case-1', payload: { classification: 'CONTEXT_GAP' }
  });
  assert.ok(authority.authority_ref);
  assert.equal('projection_hash' in authority, false);
  assert.ok(projection.projection_hash);
  assert.equal('authority_ref' in projection, false);
  assert.throws(() => createResultSinkEvent({
    eventId: 'evt-bad', eventType: 'BAD',
    authorityRef: authority.authority_ref, projectionHash: projection.projection_hash
  }), (error) => error?.code === 'RESULT_IDENTITY_REQUIRED');
});

test('v0.3 enables ContextProvider and ResultSink while refusing unexercised executor/outcome roles', () => {
  assert.equal(INTEGRATION_ROLES.CONTEXT_PROVIDER.status, 'ACTIVE_PILOT');
  assert.equal(INTEGRATION_ROLES.RESULT_SINK.status, 'ACTIVE_PILOT');
  assert.equal(assertPilotRoleEnabled('CONTEXT_PROVIDER').status, 'ACTIVE_PILOT');
  assert.equal(assertPilotRoleEnabled('RESULT_SINK').status, 'ACTIVE_PILOT');
  assert.throws(() => assertPilotRoleEnabled('MODEL_EXECUTOR'), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
  assert.throws(() => assertPilotRoleEnabled('OUTCOME_PROVIDER'), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
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
console.log(`P02 SDK/generic integration acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
