import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import * as publicApi from '../../packages/decision-result/src/index.mjs';
import {
  DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
  DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY,
  normalizeDecisionResult,
  validateDecisionResult
} from '../../packages/decision-result/src/index.mjs';
import { deriveMaterialActionSignature } from '../../packages/decision-robustness/src/contract.mjs';
import {
  audit,
  informationDecisionWorld,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from './fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fakeHash(char = 'f') { return `sha256:${char.repeat(64)}`; }

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('public D06 API does not expose unchecked DecisionResult builder or exact-ref constructor', () => {
  assert.equal('buildHistoricalDecisionResult' in publicApi, false);
  assert.equal('decisionResultExactRefs' in publicApi, false);
  assert.equal(typeof publicApi.publishDecisionResult, 'function');
  assert.equal(typeof publicApi.validateDecisionResult, 'function');
});

test('publisher rejects caller-authored disposition/action/confidence fields', () => {
  const world = policyDecisionWorld('forbidden-publish-fields');
  const robustness = publishRobustness(world, { label: 'forbidden-publish-fields' });
  for (const extra of [
    { decisionDisposition: 'ACT' },
    { structuredAction: { actionCode: 'IRRIGATE_NOW' } },
    { confidence: 0.99 },
    { informationRequirementRefs: [] }
  ]) {
    assert.throws(
      () => publicApi.publishDecisionResult({
        ledger: world.env.ledger,
        logicalId: `decision-result.d06.forbidden.${Object.keys(extra)[0]}`,
        version: '1',
        decisionRobustnessRef: robustness.ref,
        decidedAt: '2026-08-20T10:45:00Z',
        audit: audit(world.env.runtimePrincipal, 'forbidden'),
        ...extra
      }),
      (error) => error?.code === 'INVALID_DECISION_RESULT_PUBLICATION_FIELD'
    );
  }
});

test('decidedAt cannot precede logicalTime or exceed exact DecisionProblem deadline', () => {
  const world = policyDecisionWorld('decision-time');
  const robustness = publishRobustness(world, { label: 'decision-time' });
  assert.throws(
    () => publishResult(world, robustness, 'before-logical', '2026-08-20T09:59:59Z'),
    (error) => error?.code === 'DECISION_RESULT_BEFORE_LOGICAL_TIME'
  );
  assert.throws(
    () => publishResult(world, robustness, 'after-deadline', '2026-08-20T14:00:01Z'),
    (error) => error?.code === 'DECISION_RESULT_AFTER_DEADLINE'
  );
});

test('DecisionResult publication actor must equal exact DecisionRobustness runtime principal', () => {
  const world = policyDecisionWorld('actor-mismatch');
  const robustness = publishRobustness(world, { label: 'actor-mismatch' });
  assert.throws(
    () => publicApi.publishDecisionResult({
      ledger: world.env.ledger,
      logicalId: 'decision-result.d06.actor-mismatch',
      version: '1',
      decisionRobustnessRef: robustness.ref,
      decidedAt: '2026-08-20T10:45:00Z',
      audit: audit({ principalId: 'other-runtime', type: 'SERVICE_ACCOUNT' }, 'actor-mismatch')
    }),
    (error) => error?.code === 'DECISION_RESULT_AUDIT_ACTOR_MISMATCH'
  );
});

test('Policy-result composite hash cannot be altered independently of exact D05 evaluation identity', () => {
  const world = policyDecisionWorld('policy-result-hash');
  const robustness = publishRobustness(world, { label: 'policy-result-hash' });
  const record = publishResult(world, robustness, 'policy-result-hash');
  const forged = clone(record.semanticPayload);
  forged.policyResultRefs[0].policyResultHash = fakeHash('e');
  assert.throws(
    () => normalizeDecisionResult(forged),
    (error) => error?.code === 'POLICY_RESULT_REF_HASH_MISMATCH'
  );
});

test('ACT cannot drop exact material timing/amount semantics without invalidating MaterialActionSignature', () => {
  const world = policyDecisionWorld('drop-material');
  const robustness = publishRobustness(world, { label: 'drop-material' });
  const record = publishResult(world, robustness, 'drop-material');
  const forged = clone(record.semanticPayload);
  forged.structuredAction.materialParameters = forged.structuredAction.materialParameters.filter((item) => item.name !== 'start_time');
  assert.throws(
    () => normalizeDecisionResult(forged),
    (error) => error?.code === 'MATERIAL_ACTION_SIGNATURE_HASH_MISMATCH'
  );
});

test('DecisionResult cannot be relabeled as human approval or machine execution authority', () => {
  const world = policyDecisionWorld('authority-laundering');
  const robustness = publishRobustness(world, { label: 'authority-laundering' });
  const record = publishResult(world, robustness, 'authority-laundering');
  for (const [field, value] of [
    ['humanApprovalAuthority', 'APPROVED'],
    ['machineExecutionAuthority', 'EXECUTE_NOW']
  ]) {
    const forged = clone(record.semanticPayload);
    forged[field] = value;
    assert.throws(
      () => normalizeDecisionResult(forged),
      (error) => error?.code === 'DECISION_RESULT_DOWNSTREAM_AUTHORITY_LAUNDERING'
    );
  }
  assert.equal(record.semanticPayload.humanApprovalAuthority, DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY);
  assert.equal(record.semanticPayload.machineExecutionAuthority, DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY);
});

test('self-consistent forged ACT over an actually UNRESOLVED/WAIT D05 authority fails exact replay', () => {
  const world = policyDecisionWorld('forged-act', {
    policyOverrides: { fallback: { disposition: 'WAIT' } }
  });
  const robustness = publishRobustness(world, { includeExecution: false, label: 'forged-act' });
  assert.equal(robustness.semanticPayload.robustnessClass, 'UNRESOLVED');
  const waitRecord = publishResult(world, robustness, 'forged-act-source');
  assert.equal(waitRecord.semanticPayload.decisionDisposition, 'WAIT');

  const signature = deriveMaterialActionSignature({
    policyRef: world.policy.ref,
    policyPayload: world.policy.semanticPayload,
    rawOutput: makePolicyActionOutput({ amount: '10' })
  });
  const resultCore = {
    decisionRobustnessRef: robustness.ref,
    pathId: robustness.semanticPayload.actionEvaluations[0].pathId,
    runtimeBindingRef: world.binding.ref,
    policyRef: world.policy.ref,
    executionEvidenceHash: fakeHash('d'),
    materialActionSignatureHash: signature.signatureHash
  };
  const policyResultRef = {
    ...resultCore,
    policyResultHash: semanticHash('PolicyResultReference', resultCore)
  };
  const forgedPayload = normalizeDecisionResult({
    ...clone(waitRecord.semanticPayload),
    decisionDisposition: 'ACT',
    structuredAction: signature,
    waitSemantics: null,
    policyResultRefs: [policyResultRef]
  });
  const forgedRecord = world.env.ledger.publish({
    kind: 'DecisionResult',
    logicalId: 'decision-result.d06.forged-act',
    version: '1',
    semanticPayload: forgedPayload,
    audit: audit(world.env.runtimePrincipal, 'forged-act-record')
  });
  assert.throws(
    () => validateDecisionResult({ ledger: world.env.ledger, decisionResultRef: forgedRecord.ref }),
    (error) => error?.code === 'DECISION_RESULT_REPLAY_MISMATCH'
  );
});

test('self-consistent forged ASK InformationRequirement ref fails exact RuntimeEligibility replay', () => {
  const world = informationDecisionWorld('forged-ask');
  const record = publishResult(world, world.robustness, 'forged-ask-source');
  const forgedPayload = normalizeDecisionResult({
    ...clone(record.semanticPayload),
    informationRequirementRefs: record.semanticPayload.informationRequirementRefs.map((item, index) => ({
      ...item,
      semanticHash: index === 0 ? fakeHash('c') : item.semanticHash
    }))
  });
  const forgedRecord = world.env.ledger.publish({
    kind: 'DecisionResult',
    logicalId: 'decision-result.d06.forged-ask',
    version: '1',
    semanticPayload: forgedPayload,
    audit: audit(world.env.runtimePrincipal, 'forged-ask-record')
  });
  assert.throws(
    () => validateDecisionResult({ ledger: world.env.ledger, decisionResultRef: forgedRecord.ref }),
    (error) => error?.code === 'DECISION_RESULT_REPLAY_MISMATCH'
  );
});

test('DecisionRobustness-authorized ASK cannot smuggle Policy humanGate or Policy-result refs', () => {
  const world = informationDecisionWorld('ask-policy-smuggle');
  const record = publishResult(world, world.robustness, 'ask-policy-smuggle');
  const forged = clone(record.semanticPayload);
  forged.humanGate = { mode: 'NONE', policyRef: {
    kind: 'Policy', logicalId: 'fake-policy', version: '1', semanticHash: fakeHash('b')
  } };
  assert.throws(
    () => normalizeDecisionResult(forged),
    (error) => error?.code === 'DECISION_RESULT_POLICY_EVIDENCE_WITHOUT_POLICY_AUTHORITY'
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
console.log(`D06 DecisionResult integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
