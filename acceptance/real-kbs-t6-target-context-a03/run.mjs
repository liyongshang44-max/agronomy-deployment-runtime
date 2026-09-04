import { buildKbsT6TargetWorld } from './target-world.mjs';

const world = buildKbsT6TargetWorld();
const { adapterResponse, providerHash, snapshotStore, validatedDatums, validatedManifest, manifest } = world;

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_NITROGEN_TARGET_INGESTION_A03',
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
    treatmentName: adapterResponse.normalized_context['treatment.name'].string,
    cropCode: adapterResponse.normalized_context['crop.code'].category,
    siteName: adapterResponse.normalized_context['site.name'].string,
    spatialSupportType: 'EXPERIMENTAL_TREATMENT',
    evaluationSlice: adapterResponse.evaluation_slice,
    targetRefIntentionallyNotPromotedToFarmOrField: true
  },
  manifest: {
    contextManifestRef: manifest.ref,
    datumCount: validatedManifest.semanticPayload.datumRefs.length,
    receiptCount: validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length,
    replayClass: validatedManifest.semanticPayload.replayClass
  },
  genericCoreContractsModified: false,
  dec0034RequiredForTargetIngestion: false,
  runtimeApplicabilityExecuted: false,
  runtimeBindingCreated: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));

await import('./run-positive-applicability-v2.mjs');
await import('./run-runtime-composition-v1.mjs');