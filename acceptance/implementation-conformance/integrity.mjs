import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import {
  publishImplementationConformance,
  validateImplementationConformance
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  audit,
  compatibilityTests,
  controlScope,
  currentExecutionContext,
  makeEnv,
  publishConformance,
  publishImpl,
  publishSpec,
  qualifier
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('endpoint registration alone cannot satisfy conformance', () => {
  const env = makeEnv();
  publishImpl(env, 's03-only-impl');
  assert.equal(env.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ImplementationConformance').length, 0);
});

test('complete compatibility suite is mandatory', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-missing-test');
  const impl = publishImpl(env, 's03-impl-missing-test');
  assert.throws(
    () => publishConformance(env, {
      logicalId: 's03-conformance-missing-test',
      specificationRef: spec.ref,
      implementationRef: impl.ref,
      tests: compatibilityTests({ omit: 'EXECUTION_FIXTURE' })
    }),
    (error) => error?.code === 'INCOMPLETE_CONFORMANCE_TEST_SET'
  );
});

test('one failed compatibility test cannot mint QUALIFIED conformance', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-failed-test');
  const impl = publishImpl(env, 's03-impl-failed-test');
  assert.throws(
    () => publishConformance(env, {
      logicalId: 's03-conformance-failed-test',
      specificationRef: spec.ref,
      implementationRef: impl.ref,
      tests: compatibilityTests({ outcome: 'FAIL' })
    }),
    (error) => error?.code === 'CONFORMANCE_TEST_NOT_PASSING'
  );
});

test('implementation owner cannot self-qualify without independent conformance permission', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-self-qualify');
  const impl = publishImpl(env, 's03-impl-self-qualify');
  const decision = authorizeImplementationConformanceQualification({
    principal: env.implementationManager,
    roleAssignments: [env.implementationAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: 's03-conformance-self-qualify' }
  });
  assert.equal(decision.allowed, false);
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'self-auth')
  });
  assert.throws(
    () => publishImplementationConformance({
      ledger: env.ledger,
      logicalId: 's03-conformance-self-qualify',
      version: '1',
      specificationRef: spec.ref,
      implementationRef: impl.ref,
      controlScope: controlScope(),
      qualificationMethod: { methodId: 'x', definitionHash: `sha256:${'a'.repeat(64)}` },
      compatibilityTests: compatibilityTests(),
      runtimeEnvironments: ['STAGING'],
      requiredCapabilities: [],
      knownLimitations: [],
      validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
      principal: env.implementationManager,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: env.implementationManager.type, id: env.implementationManager.principalId }, 'self-publish')
    }),
    (error) => error?.code === 'CONFORMANCE_AUTHORIZATION_MISMATCH'
  );
});

test('wrong conformance logical-id authorization cannot be replayed', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-wrong-auth');
  const impl = publishImpl(env, 's03-impl-wrong-auth');
  const decision = authorizeImplementationConformanceQualification({
    principal: qualifier,
    roleAssignments: [env.qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: 'other-id' }
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'wrong-auth')
  });
  assert.throws(
    () => publishImplementationConformance({
      ledger: env.ledger,
      logicalId: 's03-conformance-wrong-auth',
      version: '1',
      specificationRef: spec.ref,
      implementationRef: impl.ref,
      controlScope: controlScope(),
      qualificationMethod: { methodId: 'x', definitionHash: `sha256:${'a'.repeat(64)}` },
      compatibilityTests: compatibilityTests(),
      runtimeEnvironments: ['STAGING'],
      requiredCapabilities: [],
      knownLimitations: [],
      validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
      principal: qualifier,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: qualifier.type, id: qualifier.principalId }, 'wrong-publish')
    }),
    (error) => error?.code === 'CONFORMANCE_AUTHORIZATION_MISMATCH'
  );
});

test('current validation fails when runtime environment is outside qualified scope', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-runtime-scope');
  const impl = publishImpl(env, 's03-impl-runtime-scope');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-runtime-scope',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    runtimeEnvironments: ['STAGING']
  });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl, 'PRODUCTION')
    }),
    (error) => error?.code === 'CONFORMANCE_RUNTIME_ENVIRONMENT_OUT_OF_SCOPE'
  );
});

test('current validation fails when required execution capability is missing', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-capability');
  const impl = publishImpl(env, 's03-impl-capability');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-capability',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1']
  });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl, 'STAGING', [])
    }),
    (error) => error?.code === 'CONFORMANCE_CAPABILITY_MISSING'
  );
});

test('generic ledger forgery with conformant-looking payload cannot gain conformance authority', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-forged');
  const impl = publishImpl(env, 's03-impl-forged');
  const valid = publishConformance(env, {
    logicalId: 's03-conformance-valid-template',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  const forged = env.ledger.publish({
    kind: 'ImplementationConformance',
    logicalId: 's03-conformance-forged',
    version: '1',
    semanticPayload: valid.semanticPayload,
    audit: audit({ type: 'USER', id: 'attacker' }, 'forged')
  });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: forged.ref,
      allowHistorical: true
    }),
    (error) => error?.code === 'CONFORMANCE_PUBLICATION_AUTHORITY_INVALID'
  );
});

test('current validation requires exact runtime version and architecture, not merely similar endpoint behavior', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-runtime-identity');
  const impl = publishImpl(env, 's03-impl-runtime-identity');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-runtime-identity',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  const wrong = currentExecutionContext(impl);
  wrong.runtimeVersion = 'different-runtime';
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: wrong
    }),
    (error) => error?.code === 'CONFORMANCE_EXECUTION_ENVIRONMENT_MISMATCH'
  );
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S03 ImplementationConformance integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
