import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import {
  normalizeImplementation,
  publishImplementation,
  validateImplementationAuthority
} from '../../packages/implementation-registry/src/index.mjs';
import {
  audit,
  authorize,
  controlScope,
  implementationSpec,
  makeEnv,
  manager,
  publish
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('unknown provider type fails closed', () => {
  assert.throws(
    () => normalizeImplementation(implementationSpec({ providerType: 'MAGIC_EXECUTOR', executionLocator: { kind: 'INTERNAL_FUNCTION', value: 'x' } })),
    (error) => error?.code === 'INVALID_IMPLEMENTATION_PROVIDER_TYPE'
  );
});

test('provider and execution locator kind must match exactly', () => {
  assert.throws(
    () => normalizeImplementation(implementationSpec({ providerType: 'HTTP', executionLocator: { kind: 'INTERNAL_FUNCTION', value: 'adr.fn' } })),
    (error) => error?.code === 'IMPLEMENTATION_LOCATOR_PROVIDER_MISMATCH'
  );
});

test('HTTP endpoint must be credential-free HTTPS without query or fragment', () => {
  for (const value of [
    'http://model.example.test/execute',
    'https://user:secret@model.example.test/execute',
    'https://model.example.test/execute?token=secret',
    'https://model.example.test/execute#mutable'
  ]) {
    assert.throws(
      () => normalizeImplementation(implementationSpec({ providerType: 'HTTP', executionLocator: { kind: 'HTTPS_ENDPOINT', value } })),
      (error) => error?.code === 'INVALID_IMPLEMENTATION_ENDPOINT',
      value
    );
  }
});

test('implementation digest and artifact hash require canonical SHA-256 identity', () => {
  assert.throws(() => normalizeImplementation(implementationSpec({ implementationDigest: 'latest' })), (error) => error?.code === 'INVALID_IMPLEMENTATION_HASH');
  assert.throws(() => normalizeImplementation(implementationSpec({ artifact: { artifactId: 'artifact:x', contentHash: 'sha256:ABC' } })), (error) => error?.code === 'INVALID_IMPLEMENTATION_HASH');
});

test('Implementation cannot embed Specification refs or semantic contracts', () => {
  for (const [key, value] of [
    ['specificationRef', { kind: 'Model', logicalId: 'm', version: '1', semanticHash: `sha256:${'a'.repeat(64)}` }],
    ['modelRef', { kind: 'Model' }],
    ['inputs', []],
    ['outputs', []],
    ['decisionLogic', { methodId: 'x' }]
  ]) {
    assert.throws(
      () => normalizeImplementation({ ...implementationSpec(), [key]: value }),
      (error) => error?.code === 'INVALID_IMPLEMENTATION_FIELD',
      key
    );
  }
});

test('endpoint health and qualification vocabulary cannot be laundered into registration authority', () => {
  for (const [key, value] of [
    ['endpointHealth', 'HEALTHY'],
    ['healthStatus', 'UP'],
    ['conformanceStatus', 'QUALIFIED'],
    ['qualified', true],
    ['qualificationAuthority', { fake: true }]
  ]) {
    assert.throws(
      () => normalizeImplementation({ ...implementationSpec(), [key]: value }),
      (error) => error?.code === 'INVALID_IMPLEMENTATION_FIELD',
      key
    );
  }
});

test('Implementation registration cannot self-assert conformance', () => {
  assert.throws(
    () => normalizeImplementation(implementationSpec({ conformanceClaim: 'CONFORMS_TO_MODEL' })),
    (error) => error?.code === 'IMPLEMENTATION_CONFORMANCE_LAUNDERING'
  );
});

test('duplicate operational constraints are rejected rather than silently deduplicated', () => {
  assert.throws(
    () => normalizeImplementation(implementationSpec({ operationalConstraints: ['NO_NETWORK', 'NO_NETWORK'] })),
    (error) => error?.code === 'DUPLICATE_IMPLEMENTATION_CONSTRAINT'
  );
});

test('wrong permission cannot publish Implementation even with recorded authorization vocabulary', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.wrong-implementation',
    version: '1',
    principal: manager,
    role: 'NOT_IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  const decision = authorizeImplementationManage({
    principal: manager,
    roleAssignments: [assignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: 'impl-wrong-permission' }
  });
  assert.equal(decision.allowed, false);
  const auth = recordAuthorizationDecision({ ledger, decision, audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth') });
  assert.throws(
    () => publishImplementation({
      ledger,
      logicalId: 'impl-wrong-permission',
      version: '1',
      implementation: implementationSpec(),
      principal: manager,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: manager.type, id: manager.principalId }, 'publish')
    }),
    (error) => error?.code === 'IMPLEMENTATION_AUTHORIZATION_MISMATCH'
  );
});

test('authorization for another implementation id cannot be replayed', () => {
  const env = makeEnv();
  const { authorizationRecord } = authorize(env, 'impl-a');
  assert.throws(
    () => publishImplementation({
      ledger: env.ledger,
      logicalId: 'impl-b',
      version: '1',
      implementation: implementationSpec(),
      principal: env.manager,
      authorizationDecisionAuditRef: authorizationRecord.ref,
      audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish')
    }),
    (error) => error?.code === 'IMPLEMENTATION_AUTHORIZATION_MISMATCH'
  );
});

test('foreign-tenant manager cannot publish local Implementation authority', () => {
  const foreign = createPrincipal({ principalId: 'implementation-manager-foreign', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-b' });
  const env = makeEnv({ principal: foreign, roleScope: { organizationId: 'org-a', tenantId: 'tenant-b' } });
  const decision = authorizeImplementationManage({
    principal: foreign,
    roleAssignments: [env.assignment],
    authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'IMPLEMENTATION', resourceId: 'impl-foreign' }
  });
  const auth = recordAuthorizationDecision({ ledger: env.ledger, decision, audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth') });
  assert.throws(
    () => publishImplementation({
      ledger: env.ledger,
      logicalId: 'impl-foreign',
      version: '1',
      implementation: implementationSpec(),
      principal: foreign,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: foreign.type, id: foreign.principalId }, 'publish')
    }),
    (error) => error?.code === 'IMPLEMENTATION_CONTROL_SCOPE_DENIED'
  );
});

test('generic-ledger forged Implementation cannot become registry authority', () => {
  const env = makeEnv();
  const forged = env.ledger.publish({
    kind: 'Implementation',
    logicalId: 'impl-forged',
    version: '1',
    semanticPayload: normalizeImplementation(implementationSpec()),
    audit: audit({ type: 'USER', id: 'attacker' }, 'forged')
  });
  assert.throws(
    () => validateImplementationAuthority({ ledger: env.ledger, implementationRef: forged.ref }),
    (error) => error?.code === 'IMPLEMENTATION_PUBLICATION_AUDIT_INVALID'
  );
});

test('hidden extra authorization input invalidates Implementation publication authority', () => {
  const env = makeEnv();
  const decision = authorizeImplementationManage({
    principal: env.manager,
    roleAssignments: [env.assignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: 'impl-hidden-auth' }
  });
  const unrelated = env.ledger.publish({
    kind: 'UnrelatedAuthority',
    logicalId: 'unrelated-implementation',
    version: '1',
    semanticPayload: { code: 'x' },
    audit: audit()
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: { ...audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth'), inputRefs: [unrelated.ref] }
  });
  assert.throws(
    () => publishImplementation({
      ledger: env.ledger,
      logicalId: 'impl-hidden-auth',
      version: '1',
      implementation: implementationSpec(),
      principal: env.manager,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish')
    }),
    (error) => error?.code === 'IMPLEMENTATION_AUTHORIZATION_AUDIT_INVALID'
  );
});

test('publication actor cannot impersonate exact Implementation manager', () => {
  const env = makeEnv();
  const { authorizationRecord } = authorize(env, 'impl-actor');
  assert.throws(
    () => publishImplementation({
      ledger: env.ledger,
      logicalId: 'impl-actor',
      version: '1',
      implementation: implementationSpec(),
      principal: env.manager,
      authorizationDecisionAuditRef: authorizationRecord.ref,
      audit: audit({ type: 'USER', id: 'not-manager' }, 'publish')
    }),
    (error) => error?.code === 'IMPLEMENTATION_AUDIT_ACTOR_MISMATCH'
  );
});

test('same logical/version Implementation cannot be semantically rewritten', () => {
  const env = makeEnv();
  publish(env, 'impl-immutable', '1', implementationSpec({ digestChar: '1' }));
  assert.throws(
    () => publish(env, 'impl-immutable', '1', implementationSpec({ digestChar: '2' })),
    /already exists|semantic|immutable/i
  );
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S02 Implementation Registry integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
