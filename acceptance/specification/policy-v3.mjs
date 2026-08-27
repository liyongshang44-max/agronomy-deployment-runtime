import assert from 'node:assert/strict';

import {
  POLICY_CONTRACT_VERSION,
  POLICY_CONTRACT_VERSION_V3,
  SpecificationError,
  normalizePolicy,
  validateSpecificationAuthority
} from '../../packages/specification-registry/src/index.mjs';
import {
  makeEnv,
  policyActionSemantics,
  policySpec,
  publish
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function expectSpecError(fn, code, messagePattern = null) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SpecificationError, `expected SpecificationError, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
  if (messagePattern) assert.match(caught.message, messagePattern);
}

test('accepted Policy v2 still rejects empty requiredRuntimeOutputs', () => {
  const candidate = policySpec({
    contractVersion: POLICY_CONTRACT_VERSION,
    requiredRuntimeOutputs: []
  });
  expectSpecError(
    () => normalizePolicy(candidate),
    'INVALID_SPECIFICATION_INPUT',
    /requiredRuntimeOutputs cannot be empty/
  );
});

test('candidate Policy v3 allows context-only decision logic with explicit empty requiredRuntimeOutputs', () => {
  const normalized = normalizePolicy(policySpec({
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    requiredInputs: [{
      semanticId: 'context.treatment_identity',
      valueType: 'CATEGORY',
      unit: '1',
      epistemicClasses: ['CONFIGURATION']
    }],
    requiredRuntimeOutputs: []
  }));
  assert.equal(normalized.contractVersion, POLICY_CONTRACT_VERSION_V3);
  assert.equal(normalized.requiredInputs.length, 1);
  assert.deepEqual(normalized.requiredRuntimeOutputs, []);
  assert.equal(normalized.actionSemantics.equivalenceMode, 'EXACT_MATERIAL_PARAMETERS');
});

test('Policy v3 keeps requiredRuntimeOutputs field explicit rather than treating omission as empty', () => {
  const candidate = policySpec({
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    requiredRuntimeOutputs: []
  });
  delete candidate.requiredRuntimeOutputs;
  expectSpecError(
    () => normalizePolicy(candidate),
    'INVALID_SPECIFICATION_INPUT',
    /requiredRuntimeOutputs must be an array/
  );
});

test('Policy v3 requires the same exact governed action semantics as Policy v2', () => {
  const missing = policySpec({
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    requiredRuntimeOutputs: []
  });
  delete missing.actionSemantics;
  expectSpecError(
    () => normalizePolicy(missing),
    'POLICY_ACTION_SEMANTICS_REQUIRED'
  );

  const mismatched = policySpec({
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    requiredRuntimeOutputs: [],
    actionSpace: ['WAIT', 'IRRIGATE_NOW'],
    actionSemantics: policyActionSemantics(['WAIT'])
  });
  expectSpecError(
    () => normalizePolicy(mismatched),
    'POLICY_ACTION_SEMANTICS_COVERAGE_MISMATCH'
  );
});

test('Policy v3 publishes and replays exact specification authority without mutating v2 identity', () => {
  const env = makeEnv();
  const v2 = publish(env, 'Policy', 'policy-context-only-history', '1', policySpec());
  const v3 = publish(env, 'Policy', 'policy-context-only-history', '2', policySpec({
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    requiredInputs: [{
      semanticId: 'context.treatment_identity',
      valueType: 'CATEGORY',
      unit: '1',
      epistemicClasses: ['CONFIGURATION']
    }],
    requiredRuntimeOutputs: []
  }));

  assert.equal(v2.semanticPayload.contractVersion, POLICY_CONTRACT_VERSION);
  assert.equal(v3.semanticPayload.contractVersion, POLICY_CONTRACT_VERSION_V3);
  assert.notEqual(v2.ref.semanticHash, v3.ref.semanticHash);

  const replayV2 = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: v2.ref });
  const replayV3 = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: v3.ref });
  assert.deepEqual(replayV2.record.ref, v2.ref);
  assert.deepEqual(replayV3.record.ref, v3.ref);
  assert.equal(replayV2.semanticPayload.requiredRuntimeOutputs.length > 0, true);
  assert.deepEqual(replayV3.semanticPayload.requiredRuntimeOutputs, []);
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
console.log(`S01 Policy v3 context-only acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
