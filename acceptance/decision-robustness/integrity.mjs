import assert from 'node:assert/strict';
import * as publicApi from '../../packages/decision-robustness/src/index.mjs';
import {
  publishDecisionRobustness
} from '../../packages/decision-robustness/src/index.mjs';
import {
  audit,
  decisionRobustnessWorld,
  executionEnvelope,
  makePolicyActionOutput
} from './fixture.mjs';

let seq = 0;
function publish(world, policyExecutions, label, extras = {}) {
  seq += 1;
  return publishDecisionRobustness({
    ledger: world.env.ledger,
    logicalId: `decision-robustness.d05.integrity.${label}.${seq}`,
    version: '1',
    runtimeAlternativeSetRef: world.alternativeSet.ref,
    policyExecutions,
    audit: audit(world.env.runtimePrincipal, `integrity-${label}`),
    ...extras
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('public D05 API does not expose unchecked MaterialActionSignature creator', () => {
  assert.equal('deriveMaterialActionSignature' in publicApi, false);
  assert.equal('buildHistoricalRobustnessWorld' in publicApi, false);
  assert.equal(typeof publicApi.publishDecisionRobustness, 'function');
  assert.equal(typeof publicApi.validateDecisionRobustness, 'function');
});

test('caller cannot self-author confidence or robustness classification', () => {
  const world = decisionRobustnessWorld('forbidden-publication-field');
  assert.throws(
    () => publish(world, [], 'forbidden-publication-field', { confidence: 0.99 }),
    (error) => error?.code === 'INVALID_DECISION_ROBUSTNESS_PUBLICATION_FIELD'
  );
  assert.throws(
    () => publish(world, [], 'forbidden-publication-class', { robustnessClass: 'ROBUST' }),
    (error) => error?.code === 'INVALID_DECISION_ROBUSTNESS_PUBLICATION_FIELD'
  );
});

test('execution evidence outside exact RuntimeAlternativeSet cannot enter comparison', () => {
  const world = decisionRobustnessWorld('excluded-execution', { includeBindingCount: 1 });
  const excludedBinding = world.bindings[1];
  const excludedEvidence = executionEnvelope(
    world,
    excludedBinding,
    makePolicyActionOutput({ amount: '30' }),
    { seed: 'a' }
  );
  assert.throws(
    () => publish(world, [{ runtimeBindingRef: excludedBinding.ref, executionEnvelope: excludedEvidence }], 'excluded-execution'),
    (error) => error?.code === 'DECISION_ROBUSTNESS_EXECUTION_NOT_IN_ALTERNATIVE_SET'
  );
});

test('D02 evidence cannot be relabeled onto another included RuntimeBinding', () => {
  const world = decisionRobustnessWorld('cross-binding');
  const evidence = executionEnvelope(
    world,
    world.includedBindings[0],
    makePolicyActionOutput({ amount: '10' }),
    { seed: 'b' }
  );
  assert.throws(
    () => publish(world, [{
      runtimeBindingRef: world.includedBindings[1].ref,
      executionEnvelope: evidence
    }], 'cross-binding'),
    (error) => error?.code === 'DECISION_ROBUSTNESS_EXECUTION_BINDING_MISMATCH'
  );
});

test('executor cannot self-author semanticId/unit/material fields in Policy action output', () => {
  const world = decisionRobustnessWorld('executor-semantic-laundering');
  const output = makePolicyActionOutput({ amount: '10' });
  output.parameters[0] = {
    ...output.parameters[0],
    semanticId: 'action.fake.amount',
    unit: 'cm',
    material: false
  };
  const evidence = executionEnvelope(world, world.includedBindings[0], output, { seed: 'c' });
  assert.throws(
    () => publish(world, [{ runtimeBindingRef: world.includedBindings[0].ref, executionEnvelope: evidence }], 'executor-semantic-laundering'),
    (error) => error?.code === 'INVALID_DECISION_ROBUSTNESS_FIELD'
  );
});

test('missing required material action parameter fails closed instead of comparing an incomplete action', () => {
  const world = decisionRobustnessWorld('missing-material');
  const output = {
    contractVersion: 'adr.policy-action-output.v1',
    actionCode: 'IRRIGATE_NOW',
    parameters: [
      { name: 'start_time', value: { type: 'TIMESTAMP', timestamp: '2026-08-20T11:00:00Z' } }
    ]
  };
  const evidence = executionEnvelope(world, world.includedBindings[0], output, { seed: 'd' });
  assert.throws(
    () => publish(world, [{ runtimeBindingRef: world.includedBindings[0].ref, executionEnvelope: evidence }], 'missing-material'),
    (error) => error?.code === 'POLICY_ACTION_OUTPUT_REQUIRED_PARAMETER_MISSING'
  );
});

test('material action parameter value type must equal exact Policy semantics', () => {
  const world = decisionRobustnessWorld('wrong-material-type');
  const output = makePolicyActionOutput({ amount: '10' });
  output.parameters[0] = { name: 'amount', value: { type: 'STRING', string: '10' } };
  const evidence = executionEnvelope(world, world.includedBindings[0], output, { seed: 'e' });
  assert.throws(
    () => publish(world, [{ runtimeBindingRef: world.includedBindings[0].ref, executionEnvelope: evidence }], 'wrong-material-type'),
    (error) => error?.code === 'POLICY_ACTION_OUTPUT_VALUE_TYPE_MISMATCH'
  );
});

test('Policy whose actionSpace is outside exact DecisionProblem fails before robustness comparison', () => {
  const world = decisionRobustnessWorld('outside-decision-action', {
    policyOverrides: { actionSpace: ['SPRAY'] }
  });
  const evidence = executionEnvelope(world, world.includedBindings[0], {
    contractVersion: 'adr.policy-action-output.v1',
    actionCode: 'SPRAY',
    parameters: []
  }, { seed: 'f' });
  assert.throws(
    () => publish(world, [{ runtimeBindingRef: world.includedBindings[0].ref, executionEnvelope: evidence }], 'outside-decision-action'),
    (error) => error?.code === 'DECISION_ROBUSTNESS_POLICY_ACTION_OUTSIDE_DECISION_PROBLEM'
  );
});

test('legacy Policy v1 cannot manufacture exact material-action equivalence', () => {
  const world = decisionRobustnessWorld('legacy-policy', {
    policyOverrides: { contractVersion: 'adr.policy.v1' }
  });
  const policyExecutions = world.includedBindings.map((binding, index) => ({
    runtimeBindingRef: binding.ref,
    executionEnvelope: executionEnvelope(
      world,
      binding,
      makePolicyActionOutput({ amount: '10' }),
      { seed: index === 0 ? '1' : '2' }
    )
  }));
  const record = publish(world, policyExecutions, 'legacy-policy');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED'));
  assert.equal(record.semanticPayload.signatureGroups.length, 0);
});

test('profile may require a governed completeness class D04 does not currently provide; exact exhaustive set then remains UNRESOLVED', () => {
  const world = decisionRobustnessWorld('profile-requires-governed', {
    sufficientCompletenessClasses: ['GOVERNED_COVERAGE']
  });
  const policyExecutions = world.includedBindings.map((binding, index) => ({
    runtimeBindingRef: binding.ref,
    executionEnvelope: executionEnvelope(
      world,
      binding,
      makePolicyActionOutput({ amount: '10' }),
      { seed: index === 0 ? '3' : '4' }
    )
  }));
  const record = publish(world, policyExecutions, 'profile-requires-governed');
  assert.equal(world.alternativeSet.semanticPayload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.equal(record.semanticPayload.coverageAssessment.sufficient, false);
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('RUNTIME_ALTERNATIVE_COVERAGE_INSUFFICIENT'));
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
console.log(`D05 DecisionRobustness integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
