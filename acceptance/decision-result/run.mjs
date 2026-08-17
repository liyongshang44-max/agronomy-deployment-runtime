import assert from 'node:assert/strict';
import {
  DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
  DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY,
  validateDecisionResult
} from '../../packages/decision-result/src/index.mjs';
import {
  informationDecisionWorld,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from './fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function actionError(name, error) {
  const message = String(error?.stack ?? error?.message ?? error)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
  const title = String(name).replace(/%/g, '%25').replace(/,/g, '%2C');
  console.error(`::error title=D06 ${title}::${message}`);
}

test('ADR_POLICY + ROBUST exact material action publishes immutable ACT DecisionResult', () => {
  const world = policyDecisionWorld('adr-act');
  const robustness = publishRobustness(world, {
    actionOutput: makePolicyActionOutput({ amount: '10', startTime: '2026-08-20T11:00:00Z' }),
    label: 'adr-act'
  });
  assert.equal(robustness.semanticPayload.robustnessClass, 'ROBUST');
  const record = publishResult(world, robustness, 'adr-act');
  const validated = validateDecisionResult({ ledger: world.env.ledger, decisionResultRef: record.ref });
  const payload = validated.semanticPayload;
  assert.equal(payload.decisionDisposition, 'ACT');
  assert.equal(payload.decisionAuthority.mode, 'ADR_POLICY');
  assert.equal(payload.decisionAuthority.authorityRef.kind, 'Policy');
  assert.equal(payload.structuredAction.actionCode, 'IRRIGATE_NOW');
  assert.deepEqual(payload.structuredAction.materialParameters.map((item) => item.name), ['amount', 'start_time']);
  assert.equal(payload.structuredAction.materialParameters.find((item) => item.name === 'amount').value.decimal, '10');
  assert.equal(payload.policyResultRefs.length, 1);
  assert.equal(payload.runtimeBindingRefs.length, 1);
  assert.equal(payload.humanGate.mode, 'REQUIRED');
  assert.equal(payload.humanApprovalAuthority, DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY);
  assert.equal(payload.machineExecutionAuthority, DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY);
  assert.equal(validated.replayMode, 'EXACT_FROZEN_DECISION_ROBUSTNESS_POLICY_AND_DISPOSITION_EVIDENCE');
});

test('EXTERNAL_POLICY may publish DecisionResult only when an exact Policy authority exists', () => {
  const world = policyDecisionWorld('external-act', { decisionAuthorityMode: 'EXTERNAL_POLICY' });
  const robustness = publishRobustness(world, { label: 'external-act' });
  const record = publishResult(world, robustness, 'external-act');
  assert.equal(record.semanticPayload.decisionDisposition, 'ACT');
  assert.equal(record.semanticPayload.decisionAuthority.mode, 'EXTERNAL_POLICY');
  assert.equal(record.semanticPayload.decisionAuthority.authorityRef.kind, 'Policy');
});

test('material action code named WAIT remains ACT and is not confused with DecisionDisposition WAIT', () => {
  const world = policyDecisionWorld('action-code-wait');
  const robustness = publishRobustness(world, {
    actionOutput: makePolicyActionOutput({ actionCode: 'WAIT' }),
    label: 'action-code-wait'
  });
  assert.equal(robustness.semanticPayload.robustnessClass, 'ROBUST');
  const record = publishResult(world, robustness, 'action-code-wait');
  assert.equal(record.semanticPayload.decisionDisposition, 'ACT');
  assert.equal(record.semanticPayload.structuredAction.actionCode, 'WAIT');
  assert.equal(record.semanticPayload.waitSemantics, null);
});

test('non-ROBUST Policy world with WAIT fallback produces governed WAIT reevaluation semantics, never ACT', () => {
  const world = policyDecisionWorld('fallback-wait', {
    policyOverrides: { fallback: { disposition: 'WAIT' } }
  });
  const robustness = publishRobustness(world, {
    includeExecution: false,
    label: 'fallback-wait'
  });
  assert.equal(robustness.semanticPayload.robustnessClass, 'UNRESOLVED');
  const record = publishResult(world, robustness, 'fallback-wait');
  const payload = record.semanticPayload;
  assert.equal(payload.decisionDisposition, 'WAIT');
  assert.equal(payload.structuredAction, null);
  assert.equal(payload.waitSemantics.mode, 'REEVALUATE_ON_NEW_DECISION_MATERIAL_EVIDENCE_OR_DEADLINE');
  assert.equal(payload.waitSemantics.basis, 'POLICY_FALLBACK_WAIT');
  assert.equal(payload.waitSemantics.decisionDeadline, world.decision.semanticPayload.decisionDeadline);
});

test('INFORMATION_REQUIRED with no legal runtime publishes ASK directly from exact DecisionRobustness + InformationRequirement authority', () => {
  const world = informationDecisionWorld('ask');
  assert.equal(world.robustness.semanticPayload.robustnessClass, 'UNRESOLVED');
  const record = publishResult(world, world.robustness, 'ask');
  const payload = record.semanticPayload;
  assert.equal(payload.decisionDisposition, 'ASK');
  assert.equal(payload.decisionAuthority.mode, 'ADR_POLICY');
  assert.equal(payload.decisionAuthority.authorityRef.kind, 'DecisionRobustness');
  assert.equal(payload.humanGate, null);
  assert.equal(payload.policyResultRefs.length, 0);
  assert.equal(payload.runtimeBindingRefs.length, 0);
  assert.ok(payload.informationRequirementRefs.length > 0);
  assert.deepEqual(payload.informationRequirementRefs, world.eligibility.semanticPayload.informationRequirements);
});

test('UNRESOLVED Policy world with ABSTAIN fallback carries exact governed abstention reason authority', () => {
  const world = policyDecisionWorld('fallback-abstain');
  const robustness = publishRobustness(world, {
    executionStatus: 'FAILED',
    label: 'fallback-abstain'
  });
  assert.equal(robustness.semanticPayload.robustnessClass, 'UNRESOLVED');
  const record = publishResult(world, robustness, 'fallback-abstain');
  const payload = record.semanticPayload;
  assert.equal(payload.decisionDisposition, 'ABSTAIN');
  assert.equal(payload.structuredAction, null);
  assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('DECISION_ROBUSTNESS_UNRESOLVED'));
  assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('POLICY_FALLBACK_ABSTAIN'));
  assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('POLICY_EXECUTION_FAILED'));
  assert.equal(payload.abstentionReasonAuthority.policyRef.kind, 'Policy');
});

test('EXTERNAL_AUTHORITY Policy fallback becomes ADR-side ABSTAIN/defer rather than fabricated external action', () => {
  const world = policyDecisionWorld('external-fallback', {
    decisionAuthorityMode: 'EXTERNAL_POLICY',
    policyOverrides: { fallback: { disposition: 'EXTERNAL_AUTHORITY' } }
  });
  const robustness = publishRobustness(world, { includeExecution: false, label: 'external-fallback' });
  const record = publishResult(world, robustness, 'external-fallback');
  assert.equal(record.semanticPayload.decisionDisposition, 'ABSTAIN');
  assert.ok(record.semanticPayload.abstentionReasonAuthority.reasonCodes.includes('POLICY_FALLBACK_EXTERNAL_AUTHORITY'));
});

test('RUNTIME_ONLY permanently forbids ADR DecisionResult publication', () => {
  const world = policyDecisionWorld('runtime-only', { decisionAuthorityMode: 'RUNTIME_ONLY' });
  const robustness = publishRobustness(world, { label: 'runtime-only' });
  assert.equal(robustness.semanticPayload.robustnessClass, 'ROBUST');
  assert.throws(
    () => publishResult(world, robustness, 'runtime-only'),
    (error) => error?.code === 'DECISION_RESULT_RUNTIME_ONLY_FORBIDDEN'
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
    actionError(name, error);
  }
}
console.log(`D06 DecisionResult acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
