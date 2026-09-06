import assert from 'node:assert/strict';

import { canonicalizeSemanticJson } from '../../packages/canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { assessKnowledgeApplicability } from '../../packages/applicability/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import { publishRuntimeEligibility } from '../../packages/runtime-eligibility/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { publishRuntimeAlternativeSet } from '../../packages/runtime-alternative-set/src/index.mjs';
import { ExactContextSnapshotStore } from '../../packages/reference-resolution/src/index.mjs';
import { reconstructHistoricalDecisionBasis } from '../../packages/historical-decision-basis/src/index.mjs';
import {
  audit as decisionAudit,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from '../decision-result/fixture.mjs';
import { audit as applicabilityAudit } from '../applicability/fixture.mjs';
import { planCompilerInput } from '../runtime-plan/fixture.mjs';
import {
  publishManifest,
  publishResolvedPair
} from '../context-manifest/fixtures.mjs';

const base = policyDecisionWorld('blueprint-adr2-a03-reference-graph');
const { ledger } = base.env;

// Replace the inline soil datum in an otherwise-valid D06 world with a retained-snapshot
// A03 resolution chain. The exact same DecisionProblem / Deployment / RuntimeProfile /
// KnowledgeRetrievalResult remain in force; only the governed ContextManifest changes.
const preservedDatumRefs = base.manifest.semanticPayload.datumRefs.filter((ref) =>
  ledger.resolve(ref).semanticPayload.semanticId !== 'soil.volumetric_water_content');
assert.ok(preservedDatumRefs.length > 0, 'receipt-backed world must preserve the crop context datum');

const resolvedPair = publishResolvedPair(ledger, {
  suffix: 'blueprint-adr2-a03-reference-graph',
  retainSnapshot: true
});
assert.equal(resolvedPair.receipt.semanticPayload.replayClass, 'EXACT');
assert.equal(resolvedPair.receipt.semanticPayload.retention.mode, 'SNAPSHOT_RETAINED');

const manifest = publishManifest(ledger, {
  logicalId: 'manifest.d06.blueprint-adr2-a03-reference-graph.receipt-backed',
  decisionProblem: base.decision,
  datumRefs: [...preservedDatumRefs, resolvedPair.datum.ref],
  receiptRefs: [resolvedPair.receipt.ref],
  snapshotStore: resolvedPair.snapshotStore,
  evidenceCutoff: '2026-08-20T10:00:00Z',
  auditOccurredAt: '2026-08-20T10:01:00Z'
});
assert.equal(manifest.semanticPayload.replayClass, 'EXACT');

const assessment = assessKnowledgeApplicability({
  ledger,
  logicalId: 'applicability.d06.blueprint-adr2-a03-reference-graph.receipt-backed',
  version: '1',
  knowledgeRetrievalResultRef: base.retrieval.ref,
  knowledgeRef: base.retrieval.semanticPayload.candidateRefs[0],
  contextManifestRef: manifest.ref,
  snapshotStore: resolvedPair.snapshotStore,
  audit: applicabilityAudit(base.env.runtimePrincipal, 'blueprint-adr2-a03-reference-graph')
});
assert.equal(assessment.semanticPayload.runtimeUse, 'ALLOWED');

const receiptPlanWorld = {
  ...base,
  manifest,
  assessments: [assessment],
  snapshotStore: resolvedPair.snapshotStore
};
const runtimePlan = compileRuntimePlan({
  ...planCompilerInput(receiptPlanWorld),
  snapshotStore: resolvedPair.snapshotStore
});
const eligibility = publishRuntimeEligibility({
  ledger,
  logicalId: 'runtime-eligibility.d06.blueprint-adr2-a03-reference-graph',
  version: '1',
  runtimePlan,
  snapshotStore: resolvedPair.snapshotStore,
  audit: decisionAudit(base.env.runtimePrincipal, 'eligibility-a03-reference-graph')
});
assert.ok(
  ['RUNTIME_ELIGIBLE', 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS'].includes(eligibility.semanticPayload.runtimeEligibility),
  `receipt-backed exact replay world must remain eligible, got ${eligibility.semanticPayload.runtimeEligibility}`
);
const legalPath = eligibility.semanticPayload.alternativeEvaluations.find((item) =>
  item.disposition === 'LEGAL' || item.disposition === 'LEGAL_WITH_LIMITATIONS');
assert.ok(legalPath, 'receipt-backed world requires one exact legal RuntimeEligibility path');

const binding = publishRuntimeBinding({
  ledger,
  logicalId: 'runtime-binding.d06.blueprint-adr2-a03-reference-graph',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  selectedAlternativePathId: legalPath.pathId,
  snapshotStore: resolvedPair.snapshotStore,
  specificationExecutionBinding: {
    specificationRef: base.policy.ref,
    implementationRef: base.implementation.ref,
    implementationConformanceRef: base.conformance.ref,
    availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
  },
  audit: decisionAudit(base.env.runtimePrincipal, 'binding-a03-reference-graph')
});
const alternativeSet = publishRuntimeAlternativeSet({
  ledger,
  logicalId: 'runtime-alternative-set.d06.blueprint-adr2-a03-reference-graph',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  includedRuntimeBindingRefs: [binding.ref],
  audit: decisionAudit(base.env.runtimePrincipal, 'alternative-set-a03-reference-graph')
});

const receiptDecisionWorld = {
  ...base,
  manifest,
  assessments: [assessment],
  runtimePlan,
  eligibility,
  binding,
  includedBindings: [binding],
  alternativeSet,
  snapshotStore: resolvedPair.snapshotStore
};
const robustness = publishRobustness(receiptDecisionWorld, {
  label: 'blueprint-adr2-a03-reference-graph'
});
const decisionResult = publishResult(
  receiptDecisionWorld,
  robustness,
  'blueprint-adr2-a03-reference-graph'
);

const recordCountBeforeRead = ledger.exportSnapshot().records.length;
const historical = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore: resolvedPair.snapshotStore,
  decisionResultRef: decisionResult.ref
});
assert.equal(
  ledger.exportSnapshot().records.length,
  recordCountBeforeRead,
  'A03 historical graph reconstruction must remain read-only'
);

const graph = historical.authorityGraph;
const contextWorld = graph.contextWorlds.find((world) => sameAuthorityRef(world.contextManifestRef, manifest.ref));
assert.ok(contextWorld, 'historical graph must expose the exact receipt-backed ContextManifest');
assert.equal(contextWorld.referenceResolutionWorlds.length, 1);
const resolutionWorld = contextWorld.referenceResolutionWorlds[0];
assert.equal(sameAuthorityRef(resolutionWorld.resolvedReferenceReceiptRef, resolvedPair.receipt.ref), true);
assert.equal(sameAuthorityRef(resolutionWorld.authorizedContextReferenceRef, resolvedPair.reference.ref), true);
assert.equal(sameAuthorityRef(resolutionWorld.resolvedContextDatumRef, resolvedPair.datum.ref), true);
assert.equal(resolutionWorld.replayClass, 'EXACT');
assert.equal(resolutionWorld.retentionMode, 'SNAPSHOT_RETAINED');
assert.equal(resolutionWorld.providerResponseHash, resolvedPair.contentHash);
assert.equal(graph.resolvedReferenceReceiptRefs.some((ref) => sameAuthorityRef(ref, resolvedPair.receipt.ref)), true);
assert.equal(graph.authorizedContextReferenceRefs.some((ref) => sameAuthorityRef(ref, resolvedPair.reference.ref)), true);
assert.equal(graph.contextRefs.some((ref) => sameAuthorityRef(ref, resolvedPair.reference.ref)), true);
assert.equal(graph.allAuthorityRefs.every((ref) => ledger.has(ref)), true);

// Retained bytes are part of the exact A03 replay basis. Replaying the same D06 authority with
// an empty snapshot store must fail closed rather than downgrade EXACT to another replay class.
assert.throws(
  () => reconstructHistoricalDecisionBasis({
    ledger,
    snapshotStore: new ExactContextSnapshotStore(),
    decisionResultRef: decisionResult.ref
  }),
  (error) => error?.code === 'EXACT_REPLAY_NOT_PROVABLE'
);

// Add a later same-logical-id reference tripwire, then hide the exact historical predecessor.
// Reconstruction must not consult listVersions/latest and substitute the later record.
ledger.publish({
  kind: 'AuthorizedContextReference',
  logicalId: resolvedPair.reference.ref.logicalId,
  version: '999-adr2-a03-reference-tripwire',
  semanticPayload: {
    antiLatestTripwire: true,
    originalRef: resolvedPair.reference.ref,
    message: 'ADR2_A03_REFERENCE_GRAPH_MUST_NOT_SELECT_LATER_REFERENCE_VERSION'
  },
  audit: {
    eventId: 'evt-blueprint-adr2-a03-reference-tripwire',
    occurredAt: '2026-09-04T13:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'blueprint-adr2-a03-reference-tripwire' },
    details: {
      suite: 'blueprint-adr2-a03-reference-graph-v1',
      classification: 'ANTI_LATEST_LOOKUP_TRIPWIRE_NOT_DOMAIN_AUTHORITY'
    }
  }
});
assert.ok(
  ledger.listVersions('AuthorizedContextReference', resolvedPair.reference.ref.logicalId).length >= 2,
  'later AuthorizedContextReference tripwire must be visible to any illicit latest-version lookup'
);

const maskedReferenceLedger = new Proxy(ledger, {
  get(target, property) {
    if (property === 'resolve') {
      return (ref) => {
        if (sameAuthorityRef(ref, resolvedPair.reference.ref)) {
          const error = new Error('simulated missing exact A03 AuthorizedContextReference predecessor');
          error.code = 'AUTHORITY_NOT_FOUND';
          throw error;
        }
        return target.resolve(ref);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }
});
assert.throws(
  () => reconstructHistoricalDecisionBasis({
    ledger: maskedReferenceLedger,
    snapshotStore: resolvedPair.snapshotStore,
    decisionResultRef: decisionResult.ref
  }),
  (error) => error?.code === 'AUTHORITY_NOT_FOUND'
);

const afterTripwire = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore: resolvedPair.snapshotStore,
  decisionResultRef: decisionResult.ref
});
assert.equal(afterTripwire.basisDigest, historical.basisDigest);
assert.equal(
  canonicalizeSemanticJson(afterTripwire.authorityGraph),
  canonicalizeSemanticJson(historical.authorityGraph),
  'later reference versions must not rewrite the exact historical A03 graph'
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_A03_REFERENCE_GRAPH_EXACT_REPLAY_V1',
  decisionResultRef: decisionResult.ref,
  contextManifestRef: manifest.ref,
  resolvedReferenceReceiptRef: resolvedPair.receipt.ref,
  authorizedContextReferenceRef: resolvedPair.reference.ref,
  resolvedContextDatumRef: resolvedPair.datum.ref,
  replayClass: resolutionWorld.replayClass,
  retentionMode: resolutionWorld.retentionMode,
  basisDigest: afterTripwire.basisDigest,
  authorityGraphRefCount: afterTripwire.authorityGraph.allAuthorityRefs.length,
  missingRetainedBytesFailsClosed: true,
  missingExactReferenceFailsClosed: true,
  laterReferenceFallbackUsed: false,
  authorityRecordsWrittenByReconstruction: 0,
  newAuthorityKindCreated: false,
  newArchitectureDecisionRequired: false
}, null, 2));
