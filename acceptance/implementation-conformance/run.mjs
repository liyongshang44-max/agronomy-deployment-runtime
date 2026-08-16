import assert from 'node:assert/strict';
import {
  validateImplementationConformance
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  makeEnv,
  publishSpec,
  publishImpl,
  publishConformance,
  currentExecutionContext,
  compatibilityTests,
  qualificationMethod
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('exact Model + exact Implementation + exact conformance evidence yields current qualified relation', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-main');
  const impl = publishImpl(env, 's03-impl-main');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-main',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  const current = validateImplementationConformance({
    ledger: env.ledger,
    conformanceRef: conformance.ref,
    atTime: '2026-08-17T00:00:00.000Z',
    executionContext: currentExecutionContext(impl)
  });
  assert.equal(current.currentStatus, 'QUALIFIED_CURRENT');
  assert.deepEqual(current.semanticPayload.specificationRef, spec.ref);
  assert.deepEqual(current.semanticPayload.implementationRef, impl.ref);
  assert.equal(current.semanticPayload.compatibilityTests.length, 3);
  assert.equal(current.executionContextValidated, true);
});

test('all three S01 specification kinds can have separate qualified conformance relations', () => {
  for (const kind of ['QualifiedTransformation', 'Model', 'Policy']) {
    const env = makeEnv();
    const spec = publishSpec(env, kind, `s03-${kind.toLowerCase()}-spec`);
    const impl = publishImpl(env, `s03-${kind.toLowerCase()}-impl`);
    const conformance = publishConformance(env, {
      logicalId: `s03-${kind.toLowerCase()}-conformance`,
      specificationRef: spec.ref,
      implementationRef: impl.ref
    });
    const historical = validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      allowHistorical: true
    });
    assert.equal(historical.record.ref.kind, 'ImplementationConformance');
    assert.equal(historical.specification.record.ref.kind, kind);
  }
});

test('qualified input/output semantic hashes are derived from exact specification semantics', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-semantic-hash');
  const impl = publishImpl(env, 's03-impl-semantic-hash');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-semantic-hash',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  assert.match(conformance.semanticPayload.qualifiedInputSemanticsHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(conformance.semanticPayload.qualifiedOutputSemanticsHash, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(conformance.semanticPayload.qualifiedInputSemanticsHash, conformance.semanticPayload.qualifiedOutputSemanticsHash);
});

test('conformance freezes exact implementation digest and artifact content identity', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-impl-identity');
  const impl = publishImpl(env, 's03-impl-identity');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-impl-identity',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  assert.equal(conformance.semanticPayload.implementationDigest, impl.semanticPayload.implementationDigest);
  assert.equal(conformance.semanticPayload.artifactContentHash, impl.semanticPayload.artifact.contentHash);
});

test('qualification method and complete test evidence are material conformance identity', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-method');
  const impl = publishImpl(env, 's03-impl-method');
  const first = publishConformance(env, {
    logicalId: 's03-conformance-method',
    version: '1',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    method: qualificationMethod('c')
  });
  const second = publishConformance(env, {
    logicalId: 's03-conformance-method',
    version: '2',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    method: qualificationMethod('d')
  });
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('execution-environment qualification is explicit and current validation checks it', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-env');
  const impl = publishImpl(env, 's03-impl-env');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-env',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    runtimeEnvironments: ['STAGING'],
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1', 'READ_ONLY_FS']
  });
  const current = validateImplementationConformance({
    ledger: env.ledger,
    conformanceRef: conformance.ref,
    atTime: '2026-08-17T00:00:00.000Z',
    executionContext: currentExecutionContext(impl, 'STAGING', ['READ_ONLY_FS', 'DETERMINISTIC_DECIMAL_V1'])
  });
  assert.equal(current.currentStatus, 'QUALIFIED_CURRENT');
});

test('known limitations and validity interval are immutable conformance authority fields', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-limits');
  const impl = publishImpl(env, 's03-impl-limits');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-limits',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    knownLimitations: ['NO_PRODUCTION_QUALIFICATION', 'REQUIRES_DETERMINISTIC_DECIMAL'],
    validityInterval: { start: '2026-08-10T00:00:00Z', end: '2026-08-20T00:00:00Z' }
  });
  assert.deepEqual(conformance.semanticPayload.knownLimitations, ['NO_PRODUCTION_QUALIFICATION', 'REQUIRES_DETERMINISTIC_DECIMAL']);
  assert.deepEqual(conformance.semanticPayload.validityInterval, {
    start: '2026-08-10T00:00:00.000Z',
    end: '2026-08-20T00:00:00.000Z'
  });
});

test('historical conformance replay remains exact after unrelated newer Implementation and Specification versions exist', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-history', '1');
  const impl = publishImpl(env, 's03-impl-history', '1');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-history',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  publishSpec(env, 'Model', 's03-model-history', '2');
  publishImpl(env, 's03-impl-history', '2');
  const replay = validateImplementationConformance({
    ledger: env.ledger,
    conformanceRef: conformance.ref,
    allowHistorical: true
  });
  assert.deepEqual(replay.semanticPayload.specificationRef, spec.ref);
  assert.deepEqual(replay.semanticPayload.implementationRef, impl.ref);
  assert.equal(replay.replayMode, 'EXACT_HISTORICAL_CONFORMANCE');
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S03 ImplementationConformance positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
