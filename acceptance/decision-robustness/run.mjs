import assert from 'node:assert/strict';
import {
  publishDecisionRobustness,
  validateDecisionRobustness
} from '../../packages/decision-robustness/src/index.mjs';
import {
  audit,
  decisionRobustnessWorld,
  executionEnvelope,
  makePolicyActionOutput
} from './fixture.mjs';

let seq = 0;
function publish(world, outputs, label) {
  seq += 1;
  const policyExecutions = world.includedBindings.map((binding, index) => ({
    runtimeBindingRef: binding.ref,
    executionEnvelope: outputs[index] ?? null
  })).filter((item) => item.executionEnvelope !== null);
  return publishDecisionRobustness({
    ledger: world.env.ledger,
    logicalId: `decision-robustness.d05.${label}.${seq}`,
    version: '1',
    runtimeAlternativeSetRef: world.alternativeSet.ref,
    policyExecutions,
    audit: audit(world.env.runtimePrincipal, `robustness-${label}`)
  });
}

function envelope(world, binding, output, seed) {
  return executionEnvelope(world, binding, output, { seed });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('Policy v3 preserves governed material-action comparison with context-only runtime requirements', () => {
  const world = decisionRobustnessWorld('policy-v3-context-only', {
    policyOverrides: {
      contractVersion: 'adr.policy.v3',
      requiredRuntimeOutputs: []
    }
  });
  assert.equal(world.policy.semanticPayload.contractVersion, 'adr.policy.v3');
  assert.deepEqual(world.policy.semanticPayload.requiredRuntimeOutputs, []);
  const outputs = world.includedBindings.map((binding, index) => envelope(
    world,
    binding,
    makePolicyActionOutput({ amount: '10', note: `v3-trace-${index + 1}` }),
    index === 0 ? 'v3a' : 'v3b'
  ));
  const record = publish(world, outputs, 'policy-v3-context-only');
  const validated = validateDecisionRobustness({
    ledger: world.env.ledger,
    decisionRobustnessRef: record.ref
  });
  assert.equal(validated.semanticPayload.robustnessClass, 'ROBUST');
  assert.equal(validated.semanticPayload.actionEvaluations.every((item) => item.status === 'ACTION_AVAILABLE'), true);
  assert.equal(validated.semanticPayload.unresolvedReasonCodes.includes('POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED'), false);
});

test('same exact material action across exhaustive runtime worlds is ROBUST', () => {
  const world = decisionRobustnessWorld('robust-same');
  const outputs = world.includedBindings.map((binding, index) => envelope(
    world,
    binding,
    makePolicyActionOutput({ amount: '10', note: `trace-${index + 1}` }),
    index === 0 ? 'a' : 'b'
  ));
  const record = publish(world, outputs, 'robust-same');
  const validated = validateDecisionRobustness({ ledger: world.env.ledger, decisionRobustnessRef: record.ref });
  assert.equal(validated.semanticPayload.robustnessClass, 'ROBUST');
  assert.equal(validated.semanticPayload.coverageAssessment.sufficient, true);
  assert.equal(validated.semanticPayload.signatureGroups.length, 1);
  assert.equal(validated.semanticPayload.unresolvedReasonCodes.length, 0);
  assert.equal(validated.semanticPayload.actionEvaluations.every((item) => item.status === 'ACTION_AVAILABLE'), true);
  assert.equal(validated.replayMode, 'EXACT_FROZEN_RUNTIME_ALTERNATIVE_SET_AND_POLICY_EXECUTION_EVIDENCE');
});

test('IRRIGATE 10mm versus 30mm is materially SENSITIVE', () => {
  const world = decisionRobustnessWorld('sensitive-amount');
  const outputs = [
    envelope(world, world.includedBindings[0], makePolicyActionOutput({ amount: '10' }), 'c'),
    envelope(world, world.includedBindings[1], makePolicyActionOutput({ amount: '30' }), 'd')
  ];
  const record = publish(world, outputs, 'sensitive-amount');
  const payload = record.semanticPayload;
  assert.equal(payload.robustnessClass, 'SENSITIVE');
  assert.equal(payload.signatureGroups.length, 2);
  const alternativeDiagnostic = payload.actionChangingDiagnostics.find((item) =>
    item.dimensionType === 'RUNTIME_PLAN_ALTERNATIVE');
  assert.ok(alternativeDiagnostic);
  assert.equal(alternativeDiagnostic.diagnosticClass, 'ACTION_CHANGING');
  assert.equal(alternativeDiagnostic.signatureHashes.length, 2);
});

test('changing only non-material note does not change MaterialActionSignature', () => {
  const world = decisionRobustnessWorld('robust-note');
  const outputs = [
    envelope(world, world.includedBindings[0], makePolicyActionOutput({ amount: '10', note: 'source-a' }), 'e'),
    envelope(world, world.includedBindings[1], makePolicyActionOutput({ amount: '10', note: 'source-b' }), 'f')
  ];
  const record = publish(world, outputs, 'robust-note');
  const payload = record.semanticPayload;
  assert.equal(payload.robustnessClass, 'ROBUST');
  const signatures = payload.actionEvaluations.map((item) => item.materialActionSignature);
  assert.equal(signatures[0].signatureHash, signatures[1].signatureHash);
  assert.equal(signatures[0].materialParameters.some((item) => item.name === 'note'), false);
});

test('different action codes are materially SENSITIVE even without numeric parameters', () => {
  const world = decisionRobustnessWorld('sensitive-code');
  const outputs = [
    envelope(world, world.includedBindings[0], makePolicyActionOutput({ actionCode: 'WAIT' }), '1'),
    envelope(world, world.includedBindings[1], makePolicyActionOutput({ amount: '10' }), '2')
  ];
  const record = publish(world, outputs, 'sensitive-code');
  assert.equal(record.semanticPayload.robustnessClass, 'SENSITIVE');
  assert.equal(record.semanticPayload.signatureGroups.length, 2);
});

test('INCOMPLETE RuntimeAlternativeSet cannot produce ROBUST', () => {
  const world = decisionRobustnessWorld('incomplete', { includeBindingCount: 1 });
  const output = envelope(world, world.includedBindings[0], makePolicyActionOutput({ amount: '10' }), '3');
  const record = publish(world, [output], 'incomplete');
  assert.equal(world.alternativeSet.semanticPayload.completenessClass, 'INCOMPLETE');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.equal(record.semanticPayload.coverageAssessment.sufficient, false);
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('RUNTIME_ALTERNATIVE_COVERAGE_INSUFFICIENT'));
});

test('historical RuntimeProfile v1 has no positive robustness authority', () => {
  const world = decisionRobustnessWorld('legacy-profile', { legacyProfile: true });
  const outputs = world.includedBindings.map((binding, index) => envelope(
    world,
    binding,
    makePolicyActionOutput({ amount: '10' }),
    index === 0 ? '4' : '5'
  ));
  const record = publish(world, outputs, 'legacy-profile');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('RUNTIME_PROFILE_ROBUSTNESS_REQUIREMENT_REQUIRED'));
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('RUNTIME_ALTERNATIVE_COVERAGE_INSUFFICIENT'));
});

test('missing one included Policy execution is UNRESOLVED rather than silently dropping that world', () => {
  const world = decisionRobustnessWorld('missing-execution');
  const output = envelope(world, world.includedBindings[0], makePolicyActionOutput({ amount: '10' }), '6');
  const record = publish(world, [output], 'missing-execution');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('POLICY_EXECUTION_EVIDENCE_MISSING'));
  assert.equal(record.semanticPayload.actionEvaluations.length, 2);
  assert.equal(record.semanticPayload.actionEvaluations.filter((item) => item.status === 'UNRESOLVED').length, 1);
});

test('failed Policy execution is retained as evidence and propagates UNRESOLVED', () => {
  const world = decisionRobustnessWorld('failed-execution');
  const success = envelope(world, world.includedBindings[0], makePolicyActionOutput({ amount: '10' }), '7');
  const failed = executionEnvelope(world, world.includedBindings[1], null, { seed: '8', status: 'FAILED' });
  const record = publish(world, [success, failed], 'failed-execution');
  assert.equal(record.semanticPayload.robustnessClass, 'UNRESOLVED');
  assert.ok(record.semanticPayload.unresolvedReasonCodes.includes('POLICY_EXECUTION_FAILED'));
  const failedEval = record.semanticPayload.actionEvaluations.find((item) => item.status === 'UNRESOLVED');
  assert.equal(failedEval.executionEnvelope.status, 'FAILED');
  assert.equal(typeof failedEval.executionEvidenceHash, 'string');
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
console.log(`D05 DecisionRobustness acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
