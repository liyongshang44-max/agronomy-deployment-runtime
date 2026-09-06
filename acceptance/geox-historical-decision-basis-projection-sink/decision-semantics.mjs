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
const EXPECTED_RUNTIME_PROVENANCE_CLASS = 'NONE_NON_AUTHORITY_EXACT_RUNTIME_ALTERNATIVE_PROVENANCE_PROJECTION';

const consumerScope = Object.freeze({
  tenantId: 'tenant-adr2-d06-semantics',
  projectId: 'project-adr2-d06-semantics',
  groupId: 'group-adr2-d06-semantics'
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameRef(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function graphHasRef(basis, ref) {
  return basis.authorityGraph.allAuthorityRefs.some((candidate) => sameRef(candidate, ref));
}

function proveDigestCompatibility(basis) {
  const {
    basisDigest,
    basisDigestAuthority: _basisDigestAuthority,
    decisionSemantics: _decisionSemantics,
    runtimeAlternativeProvenance: _runtimeAlternativeProvenance,
    authorityGraph: _authorityGraph,
    ...digestBasis
  } = basis;
  assert.equal(
    basisDigest,
    semanticHash('HistoricalDecisionBasisReadModel', digestBasis),
    'derived inspection projections must remain outside the frozen HistoricalDecisionBasisReadModel digest'
  );
}

function proveRuntimeAlternativeProvenance(basis, exactD06, label) {
  const provenance = basis.runtimeAlternativeProvenance;
  assert.equal(provenance.projectionClass, EXPECTED_RUNTIME_PROVENANCE_CLASS);
  assert.deepEqual(provenance.runtimeAlternativeSetRef, exactD06.runtimeAlternativeSetRef);
  assert.equal(
    semanticHash('RuntimeAlternativeSet', provenance.runtimeAlternativeSetSemanticPayload),
    provenance.runtimeAlternativeSetRef.semanticHash,
    `${label} must retain exact D04 semantic identity`
  );
  assert.equal(
    semanticHash('RuntimeEligibility', provenance.runtimeEligibilitySemanticPayload),
    provenance.runtimeEligibilityRef.semanticHash,
    `${label} must retain exact R03 semantic identity`
  );
  assert.deepEqual(
    provenance.runtimeAlternativeSetSemanticPayload.runtimeEligibilityRef,
    provenance.runtimeEligibilityRef
  );
  assert.equal(
    canonicalizeSemanticJson(provenance.runtimeAlternativeSetSemanticPayload.runtimePlanRef),
    canonicalizeSemanticJson(provenance.runtimeEligibilitySemanticPayload.planRef),
    `${label} D04/R03 RuntimePlan identity must match`
  );
  assert.equal(
    provenance.runtimePlanCompilerVersion,
    provenance.runtimeEligibilitySemanticPayload.planRef.compilerVersion,
    `${label} must retain exact RuntimePlan compiler identity`
  );
  assert.equal(
    provenance.runtimeAlternativeSetReplayMode,
    'EXACT_FROZEN_HISTORICAL_COVERAGE_NO_LATEST_LOOKUP'
  );
  assert.deepEqual(
    provenance.runtimeAlternativeSetSemanticPayload.includedBindings.map((item) => item.runtimeBindingRef),
    exactD06.runtimeBindingRefs,
    `${label} D04 included bindings must equal exact D06 runtimeBindingRefs`
  );
  assert.equal(
    provenance.pathWorlds.length,
    provenance.runtimeAlternativeSetSemanticPayload.includedBindings.length
      + provenance.runtimeAlternativeSetSemanticPayload.excludedCandidates.length,
    `${label} every D04 path must be represented exactly once`
  );
  assert.ok(graphHasRef(basis, provenance.runtimeAlternativeSetRef));
  assert.ok(graphHasRef(basis, provenance.runtimeEligibilityRef));
  assert.ok(graphHasRef(basis, provenance.runtimeAlternativeSetSemanticPayload.contextManifestRef));
  assert.ok(graphHasRef(basis, provenance.runtimeAlternativeSetSemanticPayload.deploymentRef));
  assert.ok(graphHasRef(basis, provenance.runtimeAlternativeSetSemanticPayload.runtimeProfileRef));
  assert.ok(graphHasRef(basis, provenance.runtimeEligibilitySemanticPayload.knowledgeRetrievalResultRef));
  for (const path of provenance.pathWorlds) {
    assert.ok(graphHasRef(basis, path.knowledgeRef));
    assert.ok(graphHasRef(basis, path.applicabilityAssessmentRef));
    if (path.runtimeBindingRef) assert.ok(graphHasRef(basis, path.runtimeBindingRef));
  }
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
  proveRuntimeAlternativeProvenance(basis, exactD06, label);
  inspect(exactD06, basis);

  const event = createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: `adr2-d06-semantics-${label}`,
    historicalBasis: basis
  });
  const consumed = consumeAdrHistoricalDecisionBasisProjectionForGeox({ event, consumerScope });
  assert.equal(consumed.decision_result_semantic_hash_verified, true);
  assert.equal(consumed.runtime_alternative_provenance_verified, true);
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
  inspect: (payload, basis) => {
    assert.equal(payload.structuredAction.actionCode, 'IRRIGATE_NOW');
    assert.equal(payload.policyResultRefs.length, 1);
    assert.equal(payload.humanGate.mode, 'REQUIRED');
    assert.equal(payload.waitSemantics, null);
    assert.equal(payload.abstentionReasonAuthority, null);
    assert.equal(payload.informationRequirementRefs.length, 0);
    assert.ok(basis.runtimeAlternativeProvenance.pathWorlds.some((path) => path.pathClass === 'INCLUDED_RUNTIME_BINDING'));
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
  inspect: (payload, basis) => {
    assert.equal(payload.structuredAction, null);
    assert.equal(payload.humanGate, null);
    assert.equal(payload.policyResultRefs.length, 0);
    assert.equal(payload.runtimeBindingRefs.length, 0);
    assert.ok(payload.informationRequirementRefs.length > 0);

    // This is the ADR-2 sixth-slice regression: the frozen v1 digest basis remains binding-driven
    // and therefore empty here, while D04/R03 derived provenance still closes the historical world.
    assert.equal(basis.runtimeBindingRefs.length, 0);
    assert.equal(basis.runtimeWorlds.length, 0);
    assert.equal(basis.knowledgeRefs.length, 0);
    assert.equal(basis.applicabilityAssessmentRefs.length, 0);
    assert.equal(basis.contextManifestRefs.length, 0);
    assert.equal(basis.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload.includedBindings.length, 0);
    assert.ok(basis.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload.excludedCandidates.length > 0);
    assert.ok(basis.runtimeAlternativeProvenance.pathWorlds.length > 0);
    assert.ok(basis.runtimeAlternativeProvenance.pathWorlds.every((path) => path.pathClass === 'EXCLUDED_RUNTIME_PATH'));
    assert.ok(basis.runtimeAlternativeProvenance.pathWorlds.some((path) => path.pathDisposition === 'INFORMATION_REQUIRED'));
    assert.ok(basis.authorityGraph.runtimeRefs.length > 0);
    assert.ok(basis.authorityGraph.contextRefs.length > 0);
    assert.ok(basis.authorityGraph.knowledgeRefs.length > 0);
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

const tamperedD06 = clone(act.basis);
tamperedD06.decisionSemantics.semanticPayload.humanGate.mode = 'NONE';
assert.throws(
  () => createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: 'adr2-d06-semantics-tampered',
    historicalBasis: tamperedD06
  }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_DECISION_SEMANTIC_HASH_MISMATCH'
    || error?.code === 'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_MISMATCH'
);

const tamperedD04 = clone(ask.basis);
tamperedD04.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload.completenessClass = 'INCOMPLETE';
assert.throws(
  () => createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: 'adr2-d04-provenance-tampered',
    historicalBasis: tamperedD04
  }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_RUNTIME_ALTERNATIVE_SET_HASH_MISMATCH'
);

const crossWorldR03 = clone(ask.basis);
crossWorldR03.runtimeAlternativeProvenance.runtimeEligibilityRef = act.basis.runtimeAlternativeProvenance.runtimeEligibilityRef;
assert.throws(
  () => createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: 'adr2-cross-world-r03-provenance',
    historicalBasis: crossWorldR03
  }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_REF_MISMATCH'
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_EXACT_D06_AND_NON_ACT_D04_R03_PROVENANCE_V1',
  dispositionsProved: [
    act.basis.decisionDisposition,
    wait.basis.decisionDisposition,
    ask.basis.decisionDisposition,
    abstain.basis.decisionDisposition
  ],
  exactD06SemanticPayloadPreserved: true,
  exactD04SemanticPayloadPreserved: true,
  exactR03SemanticPayloadPreserved: true,
  runtimePlanCompilerIdentityPreserved: true,
  askHasZeroRuntimeBindings: ask.basis.runtimeBindingRefs.length === 0,
  askDerivedRuntimeProvenancePathCount: ask.basis.runtimeAlternativeProvenance.pathWorlds.length,
  askAuthorityGraphRuntimeRefCount: ask.basis.authorityGraph.runtimeRefs.length,
  askAuthorityGraphContextRefCount: ask.basis.authorityGraph.contextRefs.length,
  askAuthorityGraphKnowledgeRefCount: ask.basis.authorityGraph.knowledgeRefs.length,
  decisionResultSemanticHashVerifiedByConsumer: true,
  runtimeAlternativeProvenanceVerifiedByConsumer: true,
  crossWorldR03ForgeryRejected: true,
  d04PayloadTamperRejected: true,
  basisDigestSemanticsChanged: false,
  historicalReconstructionAuthorityWrites: 0,
  fieldActionable: false,
  dispatchAuthorized: false,
  syntheticRuntimeBindingCreated: false,
  newAuthorityKindCreated: false,
  newArchitectureDecisionRequired: false
}, null, 2));
