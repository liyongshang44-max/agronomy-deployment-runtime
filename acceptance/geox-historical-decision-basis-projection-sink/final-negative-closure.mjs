import assert from 'node:assert/strict';

import {
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import {
  reconstructHistoricalDecisionBasisExitGate
} from '../../packages/historical-decision-basis/src/exit-gate.mjs';
import {
  normalizeDecisionResult,
  validateDecisionResult
} from '../../packages/decision-result/src/index.mjs';
import {
  audit,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from '../decision-result/fixture.mjs';

const FROZEN_WORLD_P_BASIS_DIGEST =
  'sha256:103e0136fa7d0d3ad3ef8ff0e2746369a3b294a428d68e54b741dbeec8c50d45';

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function uniqueRefs(refs) {
  const map = new Map();
  for (const ref of refs) map.set(refKey(ref), ref);
  return [...map.values()];
}

function expectReplayMismatch(fn, label) {
  assert.throws(
    fn,
    (error) => error?.code === 'DECISION_RESULT_REPLAY_MISMATCH',
    `${label} must fail exact D06 replay with DECISION_RESULT_REPLAY_MISMATCH`
  );
}

function withRecomputedPolicyResultHash(entry, decisionRobustnessRef) {
  const normalizedCore = {
    decisionRobustnessRef,
    pathId: entry.pathId,
    runtimeBindingRef: entry.runtimeBindingRef,
    policyRef: entry.policyRef,
    executionEvidenceHash: entry.executionEvidenceHash,
    materialActionSignatureHash: entry.materialActionSignatureHash
  };
  return {
    ...normalizedCore,
    policyResultHash: semanticHash('PolicyResultReference', normalizedCore)
  };
}

const { plantingRuntimeWorld } = await import(
  '../real-kbs-soybean-planting-population-target/run-runtime-composition-v1.mjs'
);
await import('../real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs');

const { ledger, snapshotStore } = plantingRuntimeWorld;
const decisionResults = ledger.exportSnapshot().records
  .filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResults.length, 1, 'World P must contain exactly one historical DecisionResult');
const historicalDecisionResultRef = decisionResults[0].ref;

const baseline = reconstructHistoricalDecisionBasisExitGate({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResultRef
});
assert.equal(baseline.basisDigest, FROZEN_WORLD_P_BASIS_DIGEST);
const baselineCanonical = canonicalizeSemanticJson(baseline);

// ADR-2 planning explicitly forbids current/latest substitution across the historical
// decision-material authority world. RuntimePlan itself is a compiler artifact identity rather
// than an AuthorityRef, so its exact plan/compiler identity remains covered by the existing
// D04/R03 provenance proof rather than by same-logical-id AuthorityRef version tripwires.
//
// For every material AuthorityRef kind below, publish valid ledger records with the same logical
// ids but later versions and deliberately invalid domain payloads. Any illicit latest/listVersions
// lookup would select one of these tripwires and either rewrite the reconstruction or fail
// validation. Exact-ref replay must ignore every tripwire and reproduce the byte-identical
// projection.
const noLookaheadKinds = [
  'DecisionProblem',
  'ContextDatum',
  'KnowledgeRelease',
  'QualifiedKnowledge',
  'ScientificQualificationDecision',
  'KnowledgeRetrievalResult',
  'ApplicabilityAssessment',
  'Deployment',
  'RuntimeProfile',
  'Policy',
  'RuntimeEligibility',
  'RuntimeBinding',
  'RuntimeAlternativeSet',
  'DecisionRobustness',
  'Implementation',
  'ImplementationConformance'
];

let noLookaheadTripwireCount = 0;
const noLookaheadTripwireKinds = [];
for (const kind of noLookaheadKinds) {
  const exactRefs = uniqueRefs(
    baseline.authorityGraph.allAuthorityRefs.filter((ref) => ref.kind === kind)
  );
  assert.ok(exactRefs.length > 0, `World P exit-gate graph must contain ${kind}`);
  noLookaheadTripwireKinds.push(kind);
  for (const exactRef of exactRefs) {
    noLookaheadTripwireCount += 1;
    ledger.publish({
      kind,
      logicalId: exactRef.logicalId,
      version: `999-adr2-final-negative-${noLookaheadTripwireCount}`,
      semanticPayload: {
        antiLatestTripwire: true,
        originalRef: exactRef,
        message: 'ADR2_EXIT_GATE_MUST_REPLAY_THE_EXACT_HISTORICAL_REF'
      },
      audit: {
        eventId: `evt-adr2-final-negative-tripwire-${noLookaheadTripwireCount}`,
        occurredAt: '2026-09-04T13:30:00.000Z',
        actor: { type: 'SERVICE_ACCOUNT', id: 'adr2-final-negative-tripwire' },
        details: {
          suite: 'adr2-final-negative-closure-v1',
          classification: 'ANTI_LATEST_LOOKUP_TRIPWIRE_NOT_DOMAIN_AUTHORITY'
        }
      }
    });
  }
}

const afterLaterVersions = reconstructHistoricalDecisionBasisExitGate({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResultRef
});
assert.equal(afterLaterVersions.basisDigest, FROZEN_WORLD_P_BASIS_DIGEST);
assert.equal(
  canonicalizeSemanticJson(afterLaterVersions),
  baselineCanonical,
  'later same-logical-id versions must not rewrite any ADR-2 exit-gate historical projection'
);

// D06 already proves caller-authored dispositions are forbidden and exact replay rejects forged
// ACT/ASK. Complete the disposition matrix here for WAIT and ABSTAIN. The forged payloads are made
// top-level-contract coherent by replacing every nested relation to the substituted D05 ref and
// recomputing each PolicyResultReference hash from that substituted identity. That deliberately
// moves the test past normalizeDecisionResult: only exact upstream replay may reject the otherwise
// self-consistent-looking DecisionResult.
function proveForgedNonActRejected({ label, worldOverrides, unresolvedOverrides, expectedDisposition }) {
  const world = policyDecisionWorld(label, worldOverrides);
  const robust = publishRobustness(world, { label: `${label}-robust` });
  assert.equal(robust.semanticPayload.robustnessClass, 'ROBUST');

  const unresolved = publishRobustness(world, {
    ...unresolvedOverrides,
    label: `${label}-unresolved`
  });
  assert.equal(unresolved.semanticPayload.robustnessClass, 'UNRESOLVED');
  const legitimate = publishResult(world, unresolved, `${label}-legitimate`);
  assert.equal(legitimate.semanticPayload.decisionDisposition, expectedDisposition);
  validateDecisionResult({ ledger: world.env.ledger, decisionResultRef: legitimate.ref });

  const candidate = structuredClone(legitimate.semanticPayload);
  candidate.decisionRobustnessRef = robust.ref;
  if (candidate.decisionAuthority.authorityRef.kind === 'DecisionRobustness') {
    candidate.decisionAuthority.authorityRef = robust.ref;
  }
  if (candidate.waitSemantics) {
    candidate.waitSemantics.decisionRobustnessRef = robust.ref;
  }
  if (candidate.abstentionReasonAuthority) {
    candidate.abstentionReasonAuthority.decisionRobustnessRef = robust.ref;
  }
  candidate.policyResultRefs = candidate.policyResultRefs.map((entry) =>
    withRecomputedPolicyResultHash(entry, robust.ref));

  const forgedPayload = normalizeDecisionResult(candidate);
  const forged = world.env.ledger.publish({
    kind: 'DecisionResult',
    logicalId: `decision-result.d06.${label}.forged`,
    version: '1',
    semanticPayload: forgedPayload,
    audit: audit(world.env.runtimePrincipal, `${label}-forged`)
  });

  expectReplayMismatch(
    () => validateDecisionResult({ ledger: world.env.ledger, decisionResultRef: forged.ref }),
    `forged ${expectedDisposition}`
  );
}

proveForgedNonActRejected({
  label: 'adr2-final-forged-wait',
  worldOverrides: { policyOverrides: { fallback: { disposition: 'WAIT' } } },
  unresolvedOverrides: { includeExecution: false },
  expectedDisposition: 'WAIT'
});

proveForgedNonActRejected({
  label: 'adr2-final-forged-abstain',
  worldOverrides: {},
  unresolvedOverrides: { executionStatus: 'FAILED' },
  expectedDisposition: 'ABSTAIN'
});

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_FINAL_NEGATIVE_CLOSURE_V1',
  decisionResultRef: historicalDecisionResultRef,
  basisDigest: afterLaterVersions.basisDigest,
  noLookaheadTripwireKinds,
  noLookaheadTripwireCount,
  runtimePlanCompilerIdentityCoveredByExistingD04R03Proof: true,
  laterSameLogicalIdVersionsChangedHistoricalExitGate: false,
  forgedActRejectedByExistingD06Integrity: true,
  forgedAskRejectedByExistingD06Integrity: true,
  forgedWaitRejectedByExactReplay: true,
  forgedAbstainRejectedByExactReplay: true,
  newAuthorityKindCreated: false,
  productCodeChanged: false,
  architectureDecisionRequired: false
}, null, 2));
