import assert from 'node:assert/strict';

import {
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import { ExactContextSnapshotStore } from '../../packages/reference-resolution/src/index.mjs';
import {
  HISTORICAL_DECISION_BASIS_DECISION_SEMANTICS_CLASS,
  reconstructHistoricalDecisionBasis
} from '../../packages/historical-decision-basis/src/index.mjs';
import {
  createAdrHistoricalDecisionBasisProjectionEventForGeox,
  consumeAdrHistoricalDecisionBasisProjectionForGeox
} from '../../adapters/geox/src/historical-decision-basis-projection-sink.mjs';
import {
  informationDecisionWorld,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from '../decision-result/fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';

const EXPECTED_D06_KEYS = [
  'abstentionReasonAuthority',
  'authorityClass',
  'contractVersion',
  'decidedAt',
  'decisionAuthority',
  'decisionDisposition',
  'decisionProblemRef',
  'decisionRobustnessRef',
  'humanApprovalAuthority',
  'humanGate',
  'informationRequirementRefs',
  'machineExecutionAuthority',
  'policyResultRefs',
  'runtimeAlternativeSetRef',
  'runtimeBindingRefs',
  'structuredAction',
  'waitSemantics'
];

const consumerScope = Object.freeze({
  tenantId: 'tenant-adr2-d06-semantics',
  projectId: 'project-adr2-d06-semantics',
  groupId: 'group-adr2-d06-semantics'
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function proveDigestCompatibility(basis) {
  const {
    basisDigest,
    basisDigestAuthority: _basisDigestAuthority,
    decisionSemantics: _decisionSemantics,
    authorityGraph: _authorityGraph,
    ...digestBasis
  } = basis;
  assert.equal(
    basisDigest,
    semanticHash('HistoricalDecisionBasisReadModel', digestBasis),
    'decisionSemantics must remain outside the frozen HistoricalDecisionBasisReadModel digest'
  );
}

function proveWorld({ label, world, result, expectedDisposition, inspect }) {
  // These generic D06 fixtures use inline ContextDatum membership and no A03 external
  // reference receipts. Historical reconstruction still requires an explicit governed
  // snapshot-store dependency; an empty accepted store is therefore the truthful input.
  const snapshotStore = new ExactContextSnapshotStore();
  assert.equal(snapshotStore.count(), 0);
  const ledger = world.env.ledger;
  const before = ledger.exportSnapshot().records.length;
  const basis = reconstructHistoricalDecisionBasis({
    ledger,
    snapshotStore,
    decisionResultRef: result.ref
  });
  assert.equal(ledger.exportSnapshot().records.length, before, `${label} historical reconstruction must remain read-only`);
  assert.equal(snapshotStore.count(), 0, `${label} inline-context replay must not fabricate retained provider snapshots`);

  const exactD06 = ledger.resolve(result.ref).semanticPayload;
  assert.equal(basis.decisionSemantics.projectionClass, HISTORICAL_DECISION_BASIS_DECISION_SEMANTICS_CLASS);
  assert.deepEqual(basis.decisionSemantics.decisionResultRef, result.ref);
  assert.equal(
    canonicalizeSemanticJson(basis.decisionSemantics.semanticPayload),
    canonicalizeSemanticJson(exactD06),
    `${label} must expose the complete exact D06 semantic payload without reinterpretation`
  );
  assert.deepEqual(Object.keys(basis.decisionSemantics.semanticPayload).sort(), EXPECTED_D06_KEYS);
  assert.equal(semanticHash('DecisionResult', basis.decisionSemantics.semanticPayload), result.ref.semanticHash);
  assert.equal(basis.decisionSemantics.semanticPayload.decisionDisposition, expectedDisposition);
  assert.equal(basis.decisionDisposition, expectedDisposition);
  proveDigestCompatibility(basis);
  inspect(basis.decisionSemantics.semanticPayload);

  const event = createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: `adr2-d06-semantics-${label}`,
    historicalBasis: basis
  });
  const consumed = consumeAdrHistoricalDecisionBasisProjectionForGeox({ event, consumerScope });
  assert.equal(consumed.decision_result_semantic_hash_verified, true);
  assert.equal(consumed.field_actionable, false);
  assert.equal(consumed.dispatch_authorized, false);
  assert.deepEqual(consumed.entry_decision_result_ref, result.ref);

  return { basis, event, consumed };
}

const actWorld = policyDecisionWorld('adr2-basis-semantics-act');
const actRobustness = publishRobustness(actWorld, {
  actionOutput: makePolicyActionOutput({ amount: '10', startTime: '2026-08-20T11:00:00Z' }),
  label: 'adr2-basis-semantics-act'
});
const actResult = publishResult(actWorld, actRobustness, 'adr2-basis-semantics-act');
const act = proveWorld({
  label: 'act',
  world: actWorld,
  result: actResult,
  expectedDisposition: 'ACT',
  inspect: (payload) => {
    assert.equal(payload.structuredAction.actionCode, 'IRRIGATE_NOW');
    assert.equal(payload.policyResultRefs.length, 1);
    assert.equal(payload.humanGate.mode, 'REQUIRED');
    assert.equal(payload.waitSemantics, null);
    assert.equal(payload.abstentionReasonAuthority, null);
    assert.equal(payload.informationRequirementRefs.length, 0);
  }
});

const waitWorld = policyDecisionWorld('adr2-basis-semantics-wait', {
  policyOverrides: { fallback: { disposition: 'WAIT' } }
});
const waitRobustness = publishRobustness(waitWorld, {
  includeExecution: false,
  label: 'adr2-basis-semantics-wait'
});
const waitResult = publishResult(waitWorld, waitRobustness, 'adr2-basis-semantics-wait');
const wait = proveWorld({
  label: 'wait',
  world: waitWorld,
  result: waitResult,
  expectedDisposition: 'WAIT',
  inspect: (payload) => {
    assert.equal(payload.structuredAction, null);
    assert.equal(payload.waitSemantics.basis, 'POLICY_FALLBACK_WAIT');
    assert.equal(payload.waitSemantics.mode, 'REEVALUATE_ON_NEW_DECISION_MATERIAL_EVIDENCE_OR_DEADLINE');
    assert.equal(payload.humanGate.mode, 'REQUIRED');
  }
});

const askWorld = informationDecisionWorld('adr2-basis-semantics-ask');
const askResult = publishResult(askWorld, askWorld.robustness, 'adr2-basis-semantics-ask');
const ask = proveWorld({
  label: 'ask',
  world: askWorld,
  result: askResult,
  expectedDisposition: 'ASK',
  inspect: (payload) => {
    assert.equal(payload.structuredAction, null);
    assert.equal(payload.humanGate, null);
    assert.equal(payload.policyResultRefs.length, 0);
    assert.equal(payload.runtimeBindingRefs.length, 0);
    assert.ok(payload.informationRequirementRefs.length > 0);
  }
});

const abstainWorld = policyDecisionWorld('adr2-basis-semantics-abstain');
const abstainRobustness = publishRobustness(abstainWorld, {
  executionStatus: 'FAILED',
  label: 'adr2-basis-semantics-abstain'
});
const abstainResult = publishResult(abstainWorld, abstainRobustness, 'adr2-basis-semantics-abstain');
const abstain = proveWorld({
  label: 'abstain',
  world: abstainWorld,
  result: abstainResult,
  expectedDisposition: 'ABSTAIN',
  inspect: (payload) => {
    assert.equal(payload.structuredAction, null);
    assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('DECISION_ROBUSTNESS_UNRESOLVED'));
    assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('POLICY_FALLBACK_ABSTAIN'));
    assert.ok(payload.abstentionReasonAuthority.reasonCodes.includes('POLICY_EXECUTION_FAILED'));
  }
});

const tampered = clone(act.basis);
tampered.decisionSemantics.semanticPayload.humanGate.mode = 'NONE';
assert.throws(
  () => createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: 'adr2-d06-semantics-tampered',
    historicalBasis: tampered
  }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_DECISION_SEMANTIC_HASH_MISMATCH'
    || error?.code === 'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_MISMATCH'
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_EXACT_D06_DECISION_SEMANTICS_PROJECTION_V1',
  dispositionsProved: [
    act.basis.decisionDisposition,
    wait.basis.decisionDisposition,
    ask.basis.decisionDisposition,
    abstain.basis.decisionDisposition
  ],
  exactD06SemanticPayloadPreserved: true,
  decisionResultSemanticHashVerifiedByConsumer: true,
  basisDigestSemanticsChanged: false,
  historicalReconstructionAuthorityWrites: 0,
  fieldActionable: false,
  dispatchAuthorized: false,
  newAuthorityKindCreated: false,
  newArchitectureDecisionRequired: false
}, null, 2));
