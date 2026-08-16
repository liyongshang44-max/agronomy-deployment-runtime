import assert from 'node:assert/strict';
import {
  normalizeImplementation,
  validateImplementationAuthority
} from '../../packages/implementation-registry/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { publishModel } from '../../packages/specification-registry/src/index.mjs';
import {
  audit,
  implementationSpec,
  makeEnv,
  publish
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function hash(char) { return `sha256:${char.repeat(64)}`; }
function modelSpec() {
  return {
    contractVersion: 'adr.model.v1',
    controlScope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    purpose: 'ESTIMATE_ROOT_ZONE_WATER_STORAGE',
    inputs: [{ semanticId: 'soil.vwc', valueType: 'DECIMAL', unit: 'm3_per_m3', epistemicClasses: ['OBSERVATION'] }],
    outputs: [{ semanticId: 'soil.root_zone_water_storage', valueType: 'DECIMAL', unit: 'mm', epistemicClasses: ['STATE_ESTIMATE'] }],
    evidenceStateRequirements: ['soil.vwc'],
    parameterSlots: [],
    acceptedKnowledgeAuthorityKinds: [],
    measurementConventions: [],
    applicabilityDomain: { requiredSemanticIds: ['soil.vwc'] },
    calibrationRequirements: [],
    limitations: [],
    computation: { methodId: 'root-zone-water-v1', definitionHash: hash('9') }
  };
}
function publishExistingModel(env) {
  const principal = createPrincipal({ principalId: 'spec-manager-s02', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const assignment = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.spec-manager-s02',
    version: '1',
    principal,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'model-iam')
  });
  const decision = authorizeSpecificationManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'MODEL', resourceId: 'model-existing' }
  });
  const auth = recordAuthorizationDecision({ ledger: env.ledger, decision, audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'model-auth') });
  return publishModel({
    ledger: env.ledger,
    logicalId: 'model-existing',
    version: '1',
    specification: modelSpec(),
    principal,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit({ type: principal.type, id: principal.principalId }, 'model-publish')
  });
}

test('all frozen provider types register executable identity only with matching locator kinds', () => {
  for (const [index, providerType] of ['INTERNAL', 'HTTP', 'CUSTOMER', 'FIRST_PARTY', 'WASM', 'BATCH'].entries()) {
    const env = makeEnv();
    const record = publish(env, `impl-provider-${providerType.toLowerCase()}`, '1', implementationSpec({
      providerType,
      digestChar: String((index + 1) % 10),
      artifactChar: String((index + 2) % 10)
    }));
    const validated = validateImplementationAuthority({ ledger: env.ledger, implementationRef: record.ref });
    assert.equal(validated.semanticPayload.providerType, providerType);
    assert.equal(validated.semanticPayload.conformanceClaim, 'NONE_REGISTRATION_ONLY');
    assert.equal(validated.conformanceStatus, 'NOT_ESTABLISHED_BY_IMPLEMENTATION_REGISTRATION');
  }
});

test('Implementation independently versions when executable digest changes', () => {
  const env = makeEnv();
  const first = publish(env, 'impl-versioned', '1', implementationSpec({ digestChar: '1' }));
  const second = publish(env, 'impl-versioned', '2', implementationSpec({ digestChar: '2' }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
  assert.deepEqual(first.semanticPayload.controlScope, second.semanticPayload.controlScope);
});

test('HTTP endpoint change changes Implementation identity without changing any Model specification', () => {
  const env = makeEnv();
  const first = publish(env, 'impl-http', '1', implementationSpec({ providerType: 'HTTP', digestChar: '3', artifactChar: '4' }));
  const second = publish(env, 'impl-http', '2', implementationSpec({
    providerType: 'HTTP',
    digestChar: '3',
    artifactChar: '4',
    executionLocator: { kind: 'HTTPS_ENDPOINT', value: 'https://model.example.test/v2/execute' }
  }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('artifact content identity is material to Implementation semantic identity', () => {
  const env = makeEnv();
  const first = publish(env, 'impl-artifact', '1', implementationSpec({ digestChar: '5', artifactChar: '6' }));
  const second = publish(env, 'impl-artifact', '2', implementationSpec({ digestChar: '5', artifactChar: '7' }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('operational-constraint ordering is canonical and deterministic', () => {
  const a = normalizeImplementation(implementationSpec({ operationalConstraints: ['NETWORK_REQUIRED', 'READ_ONLY_FS'] }));
  const b = normalizeImplementation(implementationSpec({ operationalConstraints: ['READ_ONLY_FS', 'NETWORK_REQUIRED'] }));
  assert.deepEqual(a, b);
});

test('historical exact Implementation remains replayable after a later version exists', () => {
  const env = makeEnv();
  const first = publish(env, 'impl-history', '1', implementationSpec({ digestChar: '1' }));
  publish(env, 'impl-history', '2', implementationSpec({ digestChar: '2' }));
  const validated = validateImplementationAuthority({ ledger: env.ledger, implementationRef: first.ref });
  assert.deepEqual(validated.record.ref, first.ref);
});

test('Implementation registration creates no ImplementationConformance authority', () => {
  const env = makeEnv();
  publish(env, 'impl-no-conformance');
  assert.equal(env.ledger.list('ImplementationConformance').length, 0);
});

test('two executors can coexist while an existing Model semantic identity remains unchanged', () => {
  const env = makeEnv();
  const model = publishExistingModel(env);
  const modelBefore = structuredClone(env.ledger.resolve(model.ref));
  const internal = publish(env, 'impl-candidate-internal', '1', implementationSpec({ providerType: 'INTERNAL', digestChar: '7', artifactChar: '8' }));
  const http = publish(env, 'impl-candidate-http', '1', implementationSpec({ providerType: 'HTTP', digestChar: '8', artifactChar: '9' }));
  assert.equal(internal.semanticPayload.providerType, 'INTERNAL');
  assert.equal(http.semanticPayload.providerType, 'HTTP');
  assert.deepEqual(env.ledger.resolve(model.ref), modelBefore);
  assert.equal(JSON.stringify(internal.semanticPayload).includes(model.ref.logicalId), false);
  assert.equal(JSON.stringify(http.semanticPayload).includes(model.ref.logicalId), false);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S02 Implementation Registry positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
