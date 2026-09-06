import assert from 'node:assert/strict';

import { canonicalizeSemanticJson } from '../../packages/canonicalization/src/index.mjs';
import { reconstructHistoricalDecisionBasis } from '../../packages/historical-decision-basis/src/index.mjs';
import {
  policyDecisionWorld,
  publishRobustness
} from '../decision-result/fixture.mjs';
import { plantingRuntimeWorld } from './run-runtime-composition-v1.mjs';

// Build the already-qualified World P D02-D04-D05-D06 authority graph unchanged.
await import('./run-decision-result-v1.mjs');

const { ledger, snapshotStore } = plantingRuntimeWorld;
const decisionResultRecords = ledger.exportSnapshot().records
  .filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResultRecords.length, 1, 'World P must expose exactly one DecisionResult authority');
const historicalDecisionResult = decisionResultRecords[0];

const baseline = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResult.ref
});

// Build a second, independently valid authority world. Its D05 ref is legitimate in that
// world but must never be composable into World P merely because the ref is well formed.
const foreignWorld = policyDecisionWorld('blueprint-adr2-cross-world');
const foreignRobustness = publishRobustness(foreignWorld, {
  label: 'blueprint-adr2-cross-world'
});
assert.equal(foreignWorld.env.ledger.has(foreignRobustness.ref), true);
assert.equal(ledger.has(foreignRobustness.ref), false);

// Generic ledger publication is deliberately lower authority than D06 validation. Splice the
// valid foreign D05 exact ref into the otherwise-valid World P DecisionResult payload and prove
// reconstruction rejects the composite instead of accepting or partially projecting it.
const crossWorldPayload = structuredClone(historicalDecisionResult.semanticPayload);
crossWorldPayload.decisionRobustnessRef = foreignRobustness.ref;
const forgedCrossWorldDecisionResult = ledger.publish({
  kind: 'DecisionResult',
  logicalId: 'decision-result.blueprint-adr2-cross-world-forgery',
  version: '1',
  semanticPayload: crossWorldPayload,
  audit: {
    eventId: 'evt-blueprint-adr2-cross-world-forgery',
    occurredAt: '2026-09-04T12:45:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'blueprint-adr2-cross-world-forger' },
    details: {
      suite: 'blueprint-adr2-historical-decision-basis-cross-world-fail-closed-v1',
      classification: 'GENERIC_LEDGER_CROSS_WORLD_COMPOSITION_NOT_D06_AUTHORITY'
    }
  }
});

assert.throws(() => reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: forgedCrossWorldDecisionResult.ref
}));

// The invalid composite must not poison or rewrite the original historical basis/graph.
const afterForgery = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResult.ref
});
assert.equal(afterForgery.basisDigest, baseline.basisDigest);
assert.equal(
  canonicalizeSemanticJson(afterForgery.authorityGraph),
  canonicalizeSemanticJson(baseline.authorityGraph)
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_CROSS_WORLD_COMPOSITION_FAIL_CLOSED_V1',
  originalDecisionResultRef: historicalDecisionResult.ref,
  foreignDecisionRobustnessRef: foreignRobustness.ref,
  forgedCrossWorldDecisionResultRef: forgedCrossWorldDecisionResult.ref,
  crossWorldCompositionAccepted: false,
  originalBasisDigestStable: true,
  originalAuthorityGraphStable: true
}, null, 2));
