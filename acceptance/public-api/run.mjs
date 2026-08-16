import assert from 'node:assert/strict';
import {
  ADR_PILOT_OPENAPI,
  ADR_PUBLIC_API_BASE_PATH,
  PUBLIC_API_OPERATIONS,
  materializePilotOpenApi
} from '../../packages/public-api/src/index.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const WRITE_BACKENDS = new Set([
  'publishDecisionProblem',
  'publishContextDatum',
  'publishAuthorizedContextReference',
  'publishResolvedContextDatumReceipt',
  'publishContextManifest',
  'executeKnowledgeRetrieval',
  'assessApplicability'
]);

function openApiOperation(operation) {
  return ADR_PILOT_OPENAPI.paths[`${ADR_PUBLIC_API_BASE_PATH}${operation.path}`]?.[operation.method.toLowerCase()];
}

test('P01 publishes an OpenAPI 3.1 Gate-A pilot document over the frozen operation registry', () => {
  assert.equal(ADR_PILOT_OPENAPI.openapi, '3.1.0');
  assert.match(ADR_PILOT_OPENAPI.info.version, /pilot-v0\.3/);
  for (const operation of PUBLIC_API_OPERATIONS) {
    const spec = openApiOperation(operation);
    assert.ok(spec, `${operation.method} ${operation.path} missing from OpenAPI`);
    assert.equal(spec.operationId, operation.operationId);
    assert.equal(spec['x-adr-mode'], operation.mode);
    assert.equal(spec['x-adr-backend-authority'], operation.backendAuthority);
  }
});

test('every authority write uses an existing governed backend seam and requires transport idempotency', () => {
  const writes = PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'AUTHORITY_WRITE');
  assert.ok(writes.length > 0);
  for (const operation of writes) {
    assert.equal(WRITE_BACKENDS.has(operation.backendAuthority), true, operation.operationId);
    assert.equal(operation.idempotencyRequired, true, operation.operationId);
    const spec = openApiOperation(operation);
    const header = spec.parameters.find((item) => item.name === 'Idempotency-Key');
    assert.equal(header?.required, true, operation.operationId);
    assert.deepEqual(spec.security, [{ bearerAuth: [] }]);
  }
});

test('exact authority reads require kind logical id version and semantic hash rather than latest lookup', () => {
  const read = PUBLIC_API_OPERATIONS.find((item) => item.operationId === 'getAuthorityResource');
  const spec = openApiOperation(read);
  const names = spec.parameters.map((item) => item.name).sort();
  assert.deepEqual(names, ['kind', 'logical_id', 'semantic_hash', 'version']);
  assert.equal(spec.parameters.find((item) => item.name === 'semantic_hash').required, true);
  assert.equal(JSON.stringify(spec).toLowerCase().includes('latest'), false);
});

test('AuthorityRef public schema preserves exact immutable identity', () => {
  const schema = ADR_PILOT_OPENAPI.components.schemas.AuthorityRef;
  assert.deepEqual([...schema.required].sort(), ['kind', 'logical_id', 'semantic_hash', 'version']);
  assert.equal(schema.additionalProperties, false);
});

test('Workbench public surface remains explicitly non-authority', () => {
  const operations = PUBLIC_API_OPERATIONS.filter((item) => item.mode === 'NON_AUTHORITY_READ_MODEL');
  assert.deepEqual(operations.map((item) => item.operationId).sort(), [
    'getAgronomistWorkbenchCase',
    'listAgronomistEscalations'
  ]);
  const schema = ADR_PILOT_OPENAPI.components.schemas.WorkbenchCase;
  assert.equal(schema.properties.projectionKind.const, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
  assert.equal(schema.properties.reviewRequired.type, 'boolean');
});

test('OpenAPI materialization is deterministic and returns a defensive copy', () => {
  const first = materializePilotOpenApi();
  const second = materializePilotOpenApi();
  assert.deepEqual(first, second);
  first.info.title = 'tampered';
  assert.notEqual(materializePilotOpenApi().info.title, 'tampered');
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
console.log(`P01 public API acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
