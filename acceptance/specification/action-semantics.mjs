import assert from 'node:assert/strict';
import {
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

function irrigationAction(specification) {
  return specification.actionSemantics.actions.find((action) => action.actionCode === 'IRRIGATE_NOW');
}

test('Policy v2 freezes typed material amount/timing semantics and non-material metadata', () => {
  const normalized = normalizePolicy(policySpec());
  assert.equal(normalized.contractVersion, 'adr.policy.v2');
  assert.equal(normalized.actionSemantics.equivalenceMode, 'EXACT_MATERIAL_PARAMETERS');
  const irrigate = irrigationAction(normalized);
  assert.ok(irrigate);
  const amount = irrigate.parameters.find((parameter) => parameter.name === 'amount');
  const startTime = irrigate.parameters.find((parameter) => parameter.name === 'start_time');
  const note = irrigate.parameters.find((parameter) => parameter.name === 'note');
  assert.deepEqual(amount, {
    name: 'amount',
    semanticId: 'action.irrigation.amount',
    valueType: 'DECIMAL',
    unit: 'mm',
    required: true,
    material: true
  });
  assert.equal(startTime.valueType, 'TIMESTAMP');
  assert.equal(startTime.material, true);
  assert.equal(note.material, false);
});

test('Policy v2 action semantics must cover exactly the declared action space', () => {
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSpace: ['WAIT', 'IRRIGATE_NOW'],
      actionSemantics: policyActionSemantics(['WAIT'])
    })),
    (error) => error?.code === 'POLICY_ACTION_SEMANTICS_COVERAGE_MISMATCH'
  );
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSpace: ['WAIT'],
      actionSemantics: policyActionSemantics(['WAIT', 'IRRIGATE_NOW'])
    })),
    (error) => error?.code === 'POLICY_ACTION_SEMANTICS_COVERAGE_MISMATCH'
  );
});

test('Policy v2 rejects duplicate action parameter names and semantic IDs', () => {
  const base = policyActionSemantics();
  const irrigate = base.actions.find((action) => action.actionCode === 'IRRIGATE_NOW');
  const amount = irrigate.parameters.find((parameter) => parameter.name === 'amount');
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: {
        ...base,
        actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
          ? { ...action, parameters: [...action.parameters, { ...amount, semanticId: 'action.irrigation.amount_copy' }] }
          : action)
      }
    })),
    (error) => error?.code === 'DUPLICATE_POLICY_ACTION_PARAMETER'
  );
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: {
        ...base,
        actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
          ? { ...action, parameters: [...action.parameters, { ...amount, name: 'amount_copy' }] }
          : action)
      }
    })),
    (error) => error?.code === 'DUPLICATE_POLICY_ACTION_PARAMETER_SEMANTIC'
  );
});

test('Policy action semantics reject unknown value types and undeclared equivalence modes', () => {
  const base = policyActionSemantics();
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: {
        ...base,
        actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
          ? {
            ...action,
            parameters: action.parameters.map((parameter) => parameter.name === 'amount'
              ? { ...parameter, valueType: 'FLOAT' }
              : parameter)
          }
          : action)
      }
    })),
    (error) => error?.code === 'INVALID_SPECIFICATION_VALUE_TYPE'
  );
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: { ...base, equivalenceMode: 'IGNORE_AMOUNT_IF_LABEL_MATCHES' }
    })),
    (error) => error?.code === 'INVALID_POLICY_ACTION_EQUIVALENCE'
  );
});

test('material action-schema change creates a distinct Policy semantic identity', () => {
  const env = makeEnv();
  const first = publish(env, 'Policy', 'policy-material-semantics', '1', policySpec());
  const base = policyActionSemantics();
  const changed = {
    ...base,
    actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
      ? {
        ...action,
        parameters: action.parameters.map((parameter) => parameter.name === 'amount'
          ? { ...parameter, unit: 'cm' }
          : parameter)
      }
      : action)
  };
  const second = publish(env, 'Policy', 'policy-material-semantics', '2', policySpec({ actionSemantics: changed }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('materiality itself is governed Policy semantics and changes semantic identity', () => {
  const env = makeEnv();
  const first = publish(env, 'Policy', 'policy-materiality', '1', policySpec());
  const base = policyActionSemantics();
  const changed = {
    ...base,
    actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
      ? {
        ...action,
        parameters: action.parameters.map((parameter) => parameter.name === 'amount'
          ? { ...parameter, material: false }
          : parameter)
      }
      : action)
  };
  const second = publish(env, 'Policy', 'policy-materiality', '2', policySpec({ actionSemantics: changed }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('Policy v2 cannot carry runtime selected action or implementation metadata inside action semantics', () => {
  const base = policyActionSemantics();
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: { ...base, selectedAction: 'IRRIGATE_NOW' }
    })),
    (error) => error?.code === 'INVALID_SPECIFICATION_FIELD'
  );
  assert.throws(
    () => normalizePolicy(policySpec({
      actionSemantics: {
        ...base,
        actions: base.actions.map((action) => action.actionCode === 'IRRIGATE_NOW'
          ? { ...action, endpoint: 'https://executor.invalid' }
          : action)
      }
    })),
    (error) => error?.code === 'INVALID_SPECIFICATION_FIELD'
  );
});

test('Policy v1 remains replayable but cannot smuggle v2 action semantics under the legacy contract', () => {
  const env = makeEnv();
  const legacy = publish(env, 'Policy', 'policy-history', '1', policySpec({ contractVersion: 'adr.policy.v1' }));
  assert.equal(legacy.semanticPayload.contractVersion, 'adr.policy.v1');
  assert.equal(legacy.semanticPayload.actionSemantics, undefined);
  const current = publish(env, 'Policy', 'policy-history', '2', policySpec());
  assert.equal(current.semanticPayload.contractVersion, 'adr.policy.v2');
  const replay = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: legacy.ref });
  assert.deepEqual(replay.record.ref, legacy.ref);
  assert.equal(replay.semanticPayload.actionSemantics, undefined);
  assert.throws(
    () => normalizePolicy({
      ...policySpec({ contractVersion: 'adr.policy.v1' }),
      actionSemantics: policyActionSemantics()
    }),
    (error) => error?.code === 'POLICY_V1_ACTION_SEMANTICS_FORBIDDEN'
  );
});

test('Policy v2 fails closed when governed action semantics are absent', () => {
  const candidate = policySpec();
  delete candidate.actionSemantics;
  assert.throws(
    () => normalizePolicy(candidate),
    (error) => error?.code === 'POLICY_ACTION_SEMANTICS_REQUIRED'
  );
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
console.log(`S01 Policy action semantics acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
