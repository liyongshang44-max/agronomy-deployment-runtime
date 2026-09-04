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

await import('./run-runtime-composition-v1.mjs');
