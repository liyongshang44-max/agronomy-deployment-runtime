import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyExplicitAdapterMapping,
  assertPilotRoleEnabled,
  createAdrPilotClient,
  createIntegrationBatch,
  createIntegrationMessage,
  normalizeAdapterMappingRule
} from '../../sdks/typescript/src/index.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const principal = {
  principal_id: 'svc-customer-a',
  type: 'SERVICE_ACCOUNT',
  organization_id: 'customer-org-a',
  tenant_id: 'tenant-a'
};
const authRef = { kind: 'AuthorizationDecisionAudit', logical_id: 'auth-1', version: '1', semantic_hash: 'sha256:auth-1' };

test('adapter mapping permits exact copy and explicit constants only', () => {
  const mapped = applyExplicitAdapterMapping(
    { moisture_raw: '0.31', observed_at: '2026-08-16T09:00:00Z' },
    [
      { source_field: 'moisture_raw', target_field: 'value.decimal', mode: 'EXACT_COPY' },
      { source_field: 'observed_at', target_field: 'effective_interval.end', mode: 'EXACT_COPY' },
      { target_field: 'semantic_id', mode: 'EXPLICIT_CONSTANT', constant: 'soil.volumetric_water_content' },
      { target_field: 'value.type', mode: 'EXPLICIT_CONSTANT', constant: 'DECIMAL' },
      { target_field: 'unit', mode: 'EXPLICIT_CONSTANT', constant: 'm3_per_m3' }
    ]
  );
  assert.deepEqual(mapped, {
    value: { decimal: '0.31', type: 'DECIMAL' },
    effective_interval: { end: '2026-08-16T09:00:00Z' },
    semantic_id: 'soil.volumetric_water_content',
    unit: 'm3_per_m3'
  });
});

test('adapter cannot hide unit conversion formula default inference or agronomic transform', () => {
  for (const rule of [
    { source_field: 'x', target_field: 'y', mode: 'MULTIPLY', factor: 100 },
    { source_field: 'x', target_field: 'y', mode: 'EXACT_COPY', transform: 'percent_to_fraction' },
    { source_field: 'x', target_field: 'y', mode: 'EXACT_COPY', default: 'maize' },
    { source_field: 'x', target_field: 'y', mode: 'FORMULA', formula: 'x/100' }
  ]) {
    assert.throws(() => normalizeAdapterMappingRule(rule), (error) => error?.code === 'HIDDEN_ADAPTER_TRANSFORM_FORBIDDEN');
  }
});

test('adapter target paths cannot mutate object prototypes or shared built-ins', () => {
  assert.equal(Object.prototype.polluted, undefined);
  for (const targetField of ['__proto__.polluted', 'constructor.prototype.polluted', 'safe.prototype.polluted']) {
    assert.throws(() => applyExplicitAdapterMapping(
      { x: 'owned' },
      [{ source_field: 'x', target_field: targetField, mode: 'EXACT_COPY' }]
    ), (error) => error?.code === 'UNSAFE_MAPPING_TARGET_PATH');
  }
  assert.equal(Object.prototype.polluted, undefined);

  const mapped = applyExplicitAdapterMapping(
    { x: 'owned' },
    [{ source_field: 'x', target_field: 'toString.value', mode: 'EXACT_COPY' }]
  );
  assert.deepEqual(mapped, { toString: { value: 'owned' } });
  assert.equal(typeof Object.prototype.toString, 'function');
});

test('missing customer source field fails rather than inventing a default', () => {
  assert.throws(() => applyExplicitAdapterMapping(
    { crop_name: 'corn' },
    [{ source_field: 'soil_vwc', target_field: 'value.decimal', mode: 'EXACT_COPY' }]
  ), (error) => error?.code === 'SOURCE_FIELD_MISSING');
});

test('customer field name does not become ADR semantic id unless explicitly mapped as a constant', () => {
  const mapped = applyExplicitAdapterMapping(
    { customer_soil_code: 'VWC', moisture: '0.31' },
    [{ source_field: 'moisture', target_field: 'value.decimal', mode: 'EXACT_COPY' }]
  );
  assert.equal('semantic_id' in mapped, false);
  assert.equal(JSON.stringify(mapped).includes('customer_soil_code'), false);
});

test('SDK source has no direct ADR authority-package imports GEOX coupling or hidden recommendation paths', async () => {
  const client = await readFile(new URL('../../sdks/typescript/src/client.mjs', import.meta.url), 'utf8');
  const contracts = await readFile(new URL('../../sdks/typescript/src/integration-contracts.mjs', import.meta.url), 'utf8');
  const text = `${client}\n${contracts}`.toLowerCase();
  for (const forbidden of [
    '../../packages/', '@adr/authorization', '@adr/applicability', 'geox', 'mcft', 'kbs', '/recommend',
    '/runtime-eligibility', '/runtime-bindings', '/decision-results'
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});

test('bearer token is transport-only and never enters semantic request body or integration payload', async () => {
  let request;
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'secret-bearer-token',
    transport: async (value) => {
      request = value;
      return {
        ref: { kind: 'ContextDatum', logical_id: 'cd-1', version: '1', semantic_hash: 'sha256:cd-1' },
        resource: { contract_version: 'adr.context-datum.v1', semantic_id: 'crop.code' }
      };
    }
  });
  await client.createContextDatum({
    logicalId: 'cd-1', version: '1', authorizationDecisionRef: authRef,
    resource: { contract_version: 'adr.context-datum.v1', semantic_id: 'crop.code' },
    idempotencyKey: 'idem-1'
  });
  assert.equal(request.headers.Authorization, 'Bearer secret-bearer-token');
  assert.equal(JSON.stringify(request.body).includes('secret-bearer-token'), false);
  const message = createIntegrationMessage({
    role: 'CONTEXT_PROVIDER', messageType: 'X', messageId: 'm-1',
    payload: { field: 'f-1' }
  });
  assert.equal(JSON.stringify(message).includes('secret-bearer-token'), false);
});

test('transport receives a defensive request copy and cannot mutate caller-owned resource input', async () => {
  const resource = { contract_version: 'adr.context-datum.v1', semantic_id: 'crop.code', nested: { value: 'maize' } };
  const before = JSON.parse(JSON.stringify(resource));
  const client = createAdrPilotClient({
    principal,
    getAccessToken: () => 'token-a',
    transport: async (request) => {
      request.body.resource.nested.value = 'tampered-by-transport';
      return {
        ref: { kind: 'ContextDatum', logical_id: 'cd-1', version: '1', semantic_hash: 'sha256:cd-1' },
        resource: { contract_version: 'adr.context-datum.v1', semantic_id: 'crop.code', nested: { value: 'maize' } }
      };
    }
  });
  await client.createContextDatum({
    logicalId: 'cd-1', version: '1', authorizationDecisionRef: authRef, resource, idempotencyKey: 'idem-1'
  });
  assert.deepEqual(resource, before);
});

test('reserved ModelExecutor and OutcomeProvider cannot be presented as active pilot integrations', () => {
  assert.throws(() => assertPilotRoleEnabled('MODEL_EXECUTOR'), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
  assert.throws(() => assertPilotRoleEnabled('OUTCOME_PROVIDER'), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
  assert.throws(() => createIntegrationMessage({
    role: 'MODEL_EXECUTOR', messageType: 'MODEL_RUN', messageId: 'reserved-message', payload: {}
  }), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
  assert.throws(() => createIntegrationBatch({
    batchId: 'reserved-batch',
    messages: [{
      contract_version: 'adr.integration-message.v1',
      role: 'OUTCOME_PROVIDER',
      message_type: 'OUTCOME',
      message_id: 'reserved-outcome',
      authority_refs: [],
      payload: {}
    }]
  }), (error) => error?.code === 'INTEGRATION_ROLE_NOT_EXERCISED');
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
console.log(`P02 SDK/generic integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
