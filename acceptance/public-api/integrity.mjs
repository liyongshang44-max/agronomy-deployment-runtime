import assert from 'node:assert/strict';
import { ADR_PILOT_OPENAPI, PUBLIC_API_OPERATIONS } from '../../packages/public-api/src/index.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function serialized() { return JSON.stringify(ADR_PILOT_OPENAPI); }

test('P01 exposes no recommendation RuntimeEligibility Binding DecisionResult or generic authority-mutation shortcut', () => {
  const forbiddenPathFragments = [
    '/recommend', '/runtime-eligibility', '/runtime-bindings', '/decision-results', '/qualified-knowledge', '/authority/publish'
  ];
  for (const path of Object.keys(ADR_PILOT_OPENAPI.paths)) {
    for (const fragment of forbiddenPathFragments) assert.equal(path.includes(fragment), false, path);
  }
  const forbiddenBackends = new Set(['publish', 'ledger.publish', 'mutateAuthority', 'overrideApplicability']);
  for (const operation of PUBLIC_API_OPERATIONS) {
    assert.equal(forbiddenBackends.has(operation.backendAuthority), false, operation.operationId);
  }
});

test('public contract is platform-neutral and contains no GEOX or provider-specific schema authority', () => {
  const text = serialized().toLowerCase();
  for (const token of ['geox', 'mcft', 'kbs', 't3r1', 'field_index_v1', 'postgres']) {
    assert.equal(text.includes(token), false, token);
  }
});

test('write request cannot omit exact principal authorization or logical version identity', () => {
  const schema = ADR_PILOT_OPENAPI.components.schemas.AuthorityWriteRequest;
  assert.deepEqual([...schema.required].sort(), [
    'authorization_decision_ref', 'logical_id', 'principal', 'resource', 'version'
  ]);
  assert.equal(schema.additionalProperties, false);
});

test('transport idempotency does not replace immutable authority identity', () => {
  const writes = PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'AUTHORITY_WRITE');
  for (const operation of writes) {
    const spec = ADR_PILOT_OPENAPI.paths[`/v1${operation.path}`][operation.method.toLowerCase()];
    assert.ok(spec.parameters.some((item) => item.name === 'Idempotency-Key'));
    const required = ADR_PILOT_OPENAPI.components.schemas.AuthorityWriteRequest.required;
    assert.ok(required.includes('logical_id'));
    assert.ok(required.includes('version'));
  }
});

test('Workbench reads require human evidence permissions and cannot inherit runtime-use alone', () => {
  for (const operation of PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'NON_AUTHORITY_READ_MODEL')) {
    assert.equal(operation.requiredPermission, 'knowledge.inspect+source.read');
    assert.notEqual(operation.requiredPermission, 'knowledge.runtime.use');
  }
});

test('pilot surface does not claim unimplemented Gate-R/D/E authority', () => {
  const operationIds = new Set(PUBLIC_API_OPERATIONS.map((item) => item.operationId));
  for (const forbidden of [
    'createRuntimePlan', 'createRuntimeEligibility', 'createRuntimeBinding', 'createDecisionResult',
    'createOutcome', 'createOutcomeEvaluation'
  ]) assert.equal(operationIds.has(forbidden), false);
});

test('OpenAPI write operations cannot advertise success as semantic or agronomic validity', () => {
  for (const operation of PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'AUTHORITY_WRITE')) {
    const spec = ADR_PILOT_OPENAPI.paths[`/v1${operation.path}`][operation.method.toLowerCase()];
    const responseText = JSON.stringify(spec.responses[201] ?? {}).toLowerCase();
    for (const forbidden of ['agronomically valid', 'safe', 'recommended', 'runtime eligible']) {
      assert.equal(responseText.includes(forbidden), false, `${operation.operationId}:${forbidden}`);
    }
  }
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
console.log(`P01 public API integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
