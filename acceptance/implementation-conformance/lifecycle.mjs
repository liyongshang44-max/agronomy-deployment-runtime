import assert from 'node:assert/strict';
import {
  validateImplementationConformance,
  currentConformanceControl
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  control,
  currentExecutionContext,
  makeEnv,
  publishConformance,
  publishImpl,
  publishSpec
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('current use fails before validity start but historical replay remains valid', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-not-yet-valid');
  const impl = publishImpl(env, 's03-impl-not-yet-valid');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-not-yet-valid',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    validityInterval: { start: '2026-08-20T00:00:00Z', end: '2026-09-01T00:00:00Z' }
  });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl)
    }),
    (error) => error?.code === 'CONFORMANCE_EXPIRED_OR_NOT_YET_VALID'
  );
  assert.deepEqual(
    validateImplementationConformance({ ledger: env.ledger, conformanceRef: conformance.ref, allowHistorical: true }).record.ref,
    conformance.ref
  );
});

test('current use fails at and after validity end while historical replay remains valid', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-expired');
  const impl = publishImpl(env, 's03-impl-expired');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-expired',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-08-16T00:00:00Z' }
  });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-16T00:00:00Z',
      executionContext: currentExecutionContext(impl)
    }),
    (error) => error?.code === 'CONFORMANCE_EXPIRED_OR_NOT_YET_VALID'
  );
  assert.deepEqual(
    validateImplementationConformance({ ledger: env.ledger, conformanceRef: conformance.ref, allowHistorical: true }).record.ref,
    conformance.ref
  );
});

test('REVOKE blocks new runtime use without rewriting historical conformance', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-revoke');
  const impl = publishImpl(env, 's03-impl-revoke');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-revoke',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  const before = validateImplementationConformance({
    ledger: env.ledger,
    conformanceRef: conformance.ref,
    atTime: '2026-08-17T00:00:00Z',
    executionContext: currentExecutionContext(impl)
  });
  assert.equal(before.currentStatus, 'QUALIFIED_CURRENT');
  const revocation = control(env, conformance, 'REVOKE', { reasonCodes: ['QUALIFICATION_DEFECT_FOUND'] });
  assert.equal(revocation.semanticPayload.action, 'REVOKE');
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: conformance.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl)
    }),
    (error) => error?.code === 'CONFORMANCE_REVOKED'
  );
  assert.deepEqual(
    validateImplementationConformance({ ledger: env.ledger, conformanceRef: conformance.ref, allowHistorical: true }).record.ref,
    conformance.ref
  );
});

test('SUPERSEDE requires exact successor version of same spec↔implementation relation', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-supersede');
  const impl = publishImpl(env, 's03-impl-supersede');
  const old = publishConformance(env, {
    logicalId: 's03-conformance-supersede',
    version: '1',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    knownLimitations: ['OLD_LIMIT']
  });
  const successor = publishConformance(env, {
    logicalId: 's03-conformance-supersede',
    version: '2',
    specificationRef: spec.ref,
    implementationRef: impl.ref,
    knownLimitations: ['NEW_LIMIT']
  });
  control(env, old, 'SUPERSEDE', { successorRef: successor.ref, reasonCodes: ['REQUALIFIED_WITH_UPDATED_LIMITS'] });
  assert.throws(
    () => validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: old.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl)
    }),
    (error) => error?.code === 'CONFORMANCE_SUPERSEDED'
  );
  assert.equal(
    validateImplementationConformance({
      ledger: env.ledger,
      conformanceRef: successor.ref,
      atTime: '2026-08-17T00:00:00Z',
      executionContext: currentExecutionContext(impl)
    }).currentStatus,
    'QUALIFIED_CURRENT'
  );
  assert.deepEqual(
    validateImplementationConformance({ ledger: env.ledger, conformanceRef: old.ref, allowHistorical: true }).record.ref,
    old.ref
  );
});

test('SUPERSEDE rejects successor for another exact implementation', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-bad-successor');
  const implA = publishImpl(env, 's03-impl-bad-successor-a');
  const implB = publishImpl(env, 's03-impl-bad-successor-b');
  const old = publishConformance(env, {
    logicalId: 's03-conformance-bad-successor',
    version: '1',
    specificationRef: spec.ref,
    implementationRef: implA.ref
  });
  const wrong = publishConformance(env, {
    logicalId: 's03-conformance-bad-successor',
    version: '2',
    specificationRef: spec.ref,
    implementationRef: implB.ref
  });
  assert.throws(
    () => control(env, old, 'SUPERSEDE', { successorRef: wrong.ref }),
    (error) => error?.code === 'INVALID_CONFORMANCE_SUCCESSOR'
  );
});

test('one exact conformance version cannot accumulate competing terminal controls', () => {
  const env = makeEnv();
  const spec = publishSpec(env, 'Model', 's03-model-one-control');
  const impl = publishImpl(env, 's03-impl-one-control');
  const conformance = publishConformance(env, {
    logicalId: 's03-conformance-one-control',
    specificationRef: spec.ref,
    implementationRef: impl.ref
  });
  control(env, conformance, 'REVOKE', { version: '1' });
  assert.throws(
    () => control(env, conformance, 'REVOKE', { version: '2', reasonCodes: ['SECOND_CONTROL'] }),
    (error) => error?.code === 'CONFORMANCE_ALREADY_CONTROLLED'
  );
  const state = currentConformanceControl({ ledger: env.ledger, conformanceRef: conformance.ref });
  assert.equal(state.control.semanticPayload.action, 'REVOKE');
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S03 ImplementationConformance lifecycle acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
