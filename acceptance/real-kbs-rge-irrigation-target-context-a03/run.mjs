import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildKbsRgeIrrigationTargetWorld } from './target-world.mjs';

const world = buildKbsRgeIrrigationTargetWorld();
const {
  adapterResponse,
  providerHash,
  snapshotStore,
  validatedDatums,
  validatedManifest,
  manifest,
  validatedDecision
} = world;

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_IRRIGATION_TARGET_INGESTION_A03',
  classification: 'REAL_SOURCE_TARGET_CONTEXT_INGESTION_TEST_ONLY',
  provider: {
    adapterContract: adapterResponse.adapter_contract,
    providerId: 'kbs-public-context-adapter-v1',
    providerResponseHash: providerHash,
    retainedSnapshotCount: snapshotStore.count(),
    sourceEvidenceLocators: adapterResponse.source_evidence.map((item) => item.locator)
  },
  targetContext: {
    semanticIds: validatedDatums.map((item) => item.semanticPayload.semanticId).sort(),
    cropCode: adapterResponse.normalized_context['crop.code'].category,
    experimentName: adapterResponse.normalized_context['experiment.name'].string,
    spatialSupportTypes: [...new Set(validatedDatums.map((item) => item.semanticPayload.spatialSupport.type))].sort(),
    geometryRefsCreated: validatedDatums.some((item) => Object.hasOwn(item.semanticPayload.spatialSupport, 'geometryRef')),
    evaluationSlice: adapterResponse.evaluation_slice,
    targetRef: validatedDecision.semanticPayload.targetRef,
    targetRefPromotedToFarmFieldOrZone: ['farmId', 'fieldId', 'zoneId'].some((key) => key in validatedDecision.semanticPayload.targetRef),
    soilWaterBalanceStateCreated: validatedDatums.some((item) => item.semanticPayload.semanticId.includes('water')),
    twoDayTriggerStateCreated: validatedDatums.some((item) => item.semanticPayload.semanticId.includes('trigger'))
  },
  manifest: {
    contextManifestRef: manifest.ref,
    datumCount: validatedManifest.semanticPayload.datumRefs.length,
    receiptCount: validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length,
    replayClass: validatedManifest.semanticPayload.replayClass
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  runtimeApplicabilityExecuted: false,
  runtimeBindingCreated: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));

await import('./run-applicability-mutations-v1.mjs');

// Run the authority-complete runtime challenge in a child process so this top-level
// qualification driver can fail closed on the exact published machine verdict.
const runtimeScript = fileURLToPath(new URL('./run-runtime-composition-v1.mjs', import.meta.url));
const runtimeOutput = execFileSync(process.execPath, [runtimeScript], { encoding: 'utf8' });
process.stdout.write(runtimeOutput);
const runtimeProof = JSON.parse(runtimeOutput);

assert.equal(runtimeProof.ok, true);
assert.equal(runtimeProof.milestone, 'REAL_WORLD_HETEROGENEITY_IRRIGATION_A08_R01_R03_D01_CHALLENGE');
assert.equal(runtimeProof.targetWorld.waterOrTriggerContextFabricated, false);
assert.equal(runtimeProof.applicability.scientificUseStatus, 'QUALIFIED');
assert.equal(runtimeProof.applicability.transportStatus, 'DIRECTLY_APPLICABLE');
assert.equal(runtimeProof.applicability.runtimeUse, 'ALLOWED');
assert.deepEqual(runtimeProof.applicability.missingContextSemanticIds, []);

assert.deepEqual(runtimeProof.runtimePlan.openRequirements, []);
assert.equal(runtimeProof.runtimePlan.alternativePathCount, 1);
assert.deepEqual(runtimeProof.runtimePlan.compilerStates, ['STRUCTURALLY_COMPLETE']);

assert.equal(runtimeProof.runtimeEligibility.disposition, 'RUNTIME_ELIGIBLE');
assert.deepEqual(runtimeProof.runtimeEligibility.reasonCodes, []);
assert.deepEqual(runtimeProof.runtimeEligibility.informationRequirements, []);
assert.equal(runtimeProof.runtimeEligibility.legalAlternativeCount, 1);

assert.ok(runtimeProof.runtimeBinding.runtimeBindingRef);
assert.equal(runtimeProof.runtimeBinding.runtimeBindingRef.kind, 'RuntimeBinding');
assert.equal(runtimeProof.runtimeBinding.knowledgeBindings.length, 1);
assert.equal(
  runtimeProof.runtimeBinding.correctnessClaim,
  'NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS'
);
assert.equal(runtimeProof.genericCoreContractsModified, false);
assert.equal(runtimeProof.newCoreAbstractionsAdded, 0);
assert.equal(runtimeProof.runtimeExecutionPerformed, false);
assert.equal(runtimeProof.decisionResultCreated, false);
assert.equal(runtimeProof.outcomeCreated, false);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_IRRIGATION_STRICT_POSITIVE_QUALIFICATION',
  requiredPath: 'A01/A02/A03/A04->K03/K04->A05->A08->R01->R03->D01',
  applicability: 'ALLOWED',
  runtimePlan: 'STRUCTURALLY_COMPLETE',
  runtimeEligibility: 'RUNTIME_ELIGIBLE',
  runtimeBindingCreated: true,
  mutationControlsFailClosed: true,
  waterOrTriggerContextFabricated: false,
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0
}, null, 2));
