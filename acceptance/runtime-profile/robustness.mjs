import assert from 'node:assert/strict';
import {
  RUNTIME_PROFILE_CONTRACT_VERSION,
  RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
  normalizeRuntimeProfile,
  validateRuntimeProfileAuthority
} from '../../packages/runtime-profile/src/index.mjs';
import {
  baseProfile,
  createRuntimeProfileEnvironment,
  publishAuthorizedProfile
} from './fixture.mjs';

function requirement(overrides = {}) {
  return {
    comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
    sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION'],
    ...overrides
  };
}

function v2Profile(env, overrides = {}) {
  return baseProfile(env, {
    contractVersion: RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
    robustnessRequirement: requirement(),
    ...overrides
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('RuntimeProfile v2 freezes exact MaterialActionSignature comparison and sufficient coverage classes', () => {
  const env = createRuntimeProfileEnvironment('robust-v2');
  const profile = normalizeRuntimeProfile(v2Profile(env));
  assert.equal(profile.contractVersion, 'adr.runtime-profile.v2');
  assert.deepEqual(profile.robustnessRequirement, {
    comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
    sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION']
  });
});

test('RuntimeProfile v2 requires explicit robustnessRequirement authority', () => {
  const env = createRuntimeProfileEnvironment('robust-missing');
  const candidate = baseProfile(env, { contractVersion: RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION });
  assert.throws(
    () => normalizeRuntimeProfile(candidate),
    (error) => error?.code === 'RUNTIME_PROFILE_ROBUSTNESS_REQUIREMENT_REQUIRED'
  );
});

test('historical RuntimeProfile v1 cannot retroactively smuggle a D05 robustness requirement', () => {
  const env = createRuntimeProfileEnvironment('robust-v1-smuggle');
  assert.equal(RUNTIME_PROFILE_CONTRACT_VERSION, 'adr.runtime-profile.v1');
  assert.throws(
    () => normalizeRuntimeProfile(baseProfile(env, { robustnessRequirement: requirement() })),
    (error) => error?.code === 'RUNTIME_PROFILE_V1_ROBUSTNESS_REQUIREMENT_FORBIDDEN'
  );
});

test('INCOMPLETE can never be declared sufficient for a ROBUST claim', () => {
  const env = createRuntimeProfileEnvironment('robust-incomplete');
  assert.throws(
    () => normalizeRuntimeProfile(v2Profile(env, {
      robustnessRequirement: requirement({ sufficientCompletenessClasses: ['INCOMPLETE'] })
    })),
    (error) => error?.code === 'INVALID_RUNTIME_PROFILE_ENUM'
  );
});

test('undeclared robustness comparison modes fail closed', () => {
  const env = createRuntimeProfileEnvironment('robust-mode');
  assert.throws(
    () => normalizeRuntimeProfile(v2Profile(env, {
      robustnessRequirement: requirement({ comparisonMode: 'CONFIDENCE_WEIGHTED_ACTION_LABEL' })
    })),
    (error) => error?.code === 'INVALID_RUNTIME_PROFILE_ROBUSTNESS_COMPARISON_MODE'
  );
});

test('RuntimeProfile v2 may authorize future governed coverage classes without making them available', () => {
  const env = createRuntimeProfileEnvironment('robust-future-coverage');
  const profile = normalizeRuntimeProfile(v2Profile(env, {
    robustnessRequirement: requirement({
      sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION', 'BOUNDED_ENVELOPE', 'GOVERNED_COVERAGE']
    })
  }));
  assert.deepEqual(profile.robustnessRequirement.sufficientCompletenessClasses, [
    'BOUNDED_ENVELOPE', 'EXHAUSTIVE_ENUMERATION', 'GOVERNED_COVERAGE'
  ]);
});

test('v1 remains exactly replayable after a v2 profile is published', () => {
  const env = createRuntimeProfileEnvironment('robust-replay');
  const logicalId = 'runtime-profile.a05.robust-replay';
  const legacy = publishAuthorizedProfile(env, {
    logicalId,
    version: '1',
    profile: baseProfile(env)
  });
  const current = publishAuthorizedProfile(env, {
    logicalId,
    version: '2',
    profile: v2Profile(env)
  });
  const replay = validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: legacy.ref,
    allowHistorical: true
  });
  const v2 = validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: current.ref,
    allowHistorical: true
  });
  assert.equal(replay.semanticPayload.contractVersion, 'adr.runtime-profile.v1');
  assert.equal(replay.semanticPayload.robustnessRequirement, undefined);
  assert.equal(v2.semanticPayload.contractVersion, 'adr.runtime-profile.v2');
  assert.equal(v2.semanticPayload.robustnessRequirement.comparisonMode, 'EXACT_MATERIAL_ACTION_SIGNATURE');
});

test('robustness requirement changes RuntimeProfile semantic identity', () => {
  const env = createRuntimeProfileEnvironment('robust-identity');
  const first = publishAuthorizedProfile(env, {
    logicalId: 'runtime-profile.a05.robust-identity',
    version: '1',
    profile: v2Profile(env)
  });
  const second = publishAuthorizedProfile(env, {
    logicalId: 'runtime-profile.a05.robust-identity',
    version: '2',
    profile: v2Profile(env, {
      robustnessRequirement: requirement({
        sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION', 'GOVERNED_COVERAGE']
      })
    })
  });
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
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
console.log(`A05 RuntimeProfile robustness requirement acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
