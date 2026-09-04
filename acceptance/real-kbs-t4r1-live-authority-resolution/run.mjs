import assert from 'node:assert/strict';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_AUTHORITY_EXPORT_VERSION,
  GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
  GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION,
  GeoxTargetAuthoritySnapshotStore,
  replayGeoxTargetAuthorityResolution,
  resolveGeoxTargetAuthority
} from '../../adapters/geox/src/target-authority-resolver.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  GEOX_TARGET_CORRESPONDENCE_STATUS,
  consumeAdrTargetCorrespondenceForGeox
} from '../../adapters/geox/src/target-correspondence.mjs';
import { buildKbsT4R1TargetWorld } from '../real-kbs-t4r1-target-correspondence/target-world.mjs';

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

const snapshotStore = new GeoxTargetAuthoritySnapshotStore();
const live = await resolveGeoxTargetAuthority({
  ref: 'main',
  resolvedAt: '2026-09-04T17:20:00.000Z',
  snapshotStore
});

assert.equal(live.authorityExport.contract_version, GEOX_TARGET_AUTHORITY_EXPORT_VERSION);
assert.match(live.authorityExport.source_main_sha, /^[0-9a-f]{40}$/);
assert.equal(live.authorityExport.source_repository, 'liyongshang44-max/GEOX');
assert.equal(live.authorityExport.provider_target.provider_site, 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT');
assert.equal(live.authorityExport.provider_target.treatment_code, 'T4');
assert.equal(live.authorityExport.provider_target.replicate_code, 'R1');
assert.equal(live.authorityExport.provider_target.crop_code, 'corn');
assert.equal(live.authorityExport.provider_target.hybrid_code, '43-96P');
assert.equal(live.authorityExport.provider_target.planting_observation_id, '6974');
assert.equal(live.authorityExport.geox_target.field_id, 'field_kbs_mcse_t4r1');
assert.equal(live.authorityExport.geox_target.season_id, 'season_2026_corn');
assert.equal(live.authorityExport.geox_target.zone_id, 'zone_kbs_mcse_t4r1_crop_formal_v1');
assert.equal(live.authorityExport.geox_target.field_validity_proven, false);
assert.equal(live.authorityExport.geox_target.production_site_claimed, false);
assert.equal(live.authorityExport.geometry_boundary.whole_plot_assumed_crop_only, false);
assert.equal(live.authorityExport.geometry_boundary.prairie_strip_excluded, true);
assert.equal(live.authorityExport.geometry_boundary.raw_provider_geometry_republished, false);
assert.equal(live.authorityExport.geometry_boundary.geox_zone_geometry_equal_to_provider_plot_claimed, false);

assert.equal(live.receipt.contract_version, GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION);
assert.equal(live.receipt.resolution_class, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(live.receipt.requested_ref, 'main');
assert.equal(live.receipt.resolved_commit_sha, live.authorityExport.source_main_sha);
assert.equal(live.receipt.replay_class, 'EXACT');
assert.equal(live.receipt.authority_sources.length, 4);
assert.equal(snapshotStore.count(), 4);
assert.equal(live.receipt.field_actionability_authorized, false);
assert.equal(live.receipt.dispatch_authorized, false);
assert.equal(live.receipt.human_approval_authority, 'NONE');
assert.equal(live.receipt.machine_execution_authority, 'NONE');

const replay = replayGeoxTargetAuthorityResolution({ receipt: live.receipt, snapshotStore });
assert.equal(replay.replayClass, 'EXACT');
assert.deepEqual(replay.authorityExport, live.authorityExport);

const world = buildKbsT4R1TargetWorld();
const message = createIntegrationMessage({
  role: 'RESULT_SINK',
  messageType: GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  messageId: 'geox-kbs-t4r1-live-authority-resolution-1',
  authorityRefs: [
    toWireRef(world.decision.ref),
    toWireRef(world.manifest.ref),
    ...world.validatedDatums.map((datum) => toWireRef(datum.record.ref))
  ],
  payload: {
    provider_target: {
      experiment_locator: world.adapterResponse.source_evidence[0].locator,
      treatment_code: world.providerTarget.treatment,
      replicate_code: world.providerTarget.replicate,
      crop_code: world.providerTarget.crop,
      hybrid_code: world.providerTarget.hybrid,
      planting_observation_id: world.providerTarget.plantingObservationId
    },
    relation_candidate: GEOX_TARGET_CORRESPONDENCE_RELATION,
    authority_nonclaims: world.adapterResponse.nonclaims
  }
});

const projection = consumeAdrTargetCorrespondenceForGeox({
  message,
  consumerScope: {
    tenantId: 'tenant_mcft_external',
    projectId: 'project_mcft_cap09',
    groupId: 'group_public_research'
  },
  geoxTargetAuthority: live.authorityExport,
  geoxTargetAuthorityResolutionReceipt: live.receipt
});

assert.equal(projection.status, GEOX_TARGET_CORRESPONDENCE_STATUS);
assert.equal(projection.relation, GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.equal(projection.consumer_authority_pin.classification, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(projection.consumer_authority_pin.source_main_sha, live.receipt.resolved_commit_sha);
assert.equal(projection.consumer_authority_pin.resolution_receipt.replay_class, 'EXACT');
assert.equal(projection.consumer_authority_pin.resolution_receipt.authority_export_hash, live.receipt.authority_export_hash);
assert.equal(projection.geox_target.field_id, 'field_kbs_mcse_t4r1');
assert.equal(projection.identity_equality_claimed, false);
assert.equal(projection.geometry_equality_claimed, false);
assert.equal(projection.zone_correspondence_claimed, false);
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.human_approval_authority, 'NONE');
assert.equal(projection.machine_execution_authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_GEOX_LIVE_REPLAYABLE_TARGET_AUTHORITY_RESOLUTION_V1',
  onlineResolution: {
    sourceRepository: live.authorityExport.source_repository,
    requestedRef: live.receipt.requested_ref,
    resolvedCommitSha: live.receipt.resolved_commit_sha,
    sourceCount: live.receipt.authority_sources.length,
    snapshotCount: snapshotStore.count(),
    replayClass: live.receipt.replay_class,
    resolutionClass: live.receipt.resolution_class
  },
  providerTarget: live.authorityExport.provider_target,
  geoxTarget: live.authorityExport.geox_target,
  correspondence: {
    status: projection.status,
    relation: projection.relation,
    consumerAuthorityClassification: projection.consumer_authority_pin.classification,
    identityEqualityClaimed: false,
    geometryEqualityClaimed: false,
    zoneCorrespondenceClaimed: false,
    fieldActionable: false,
    dispatchAuthorized: false,
    humanApprovalAuthority: 'NONE',
    machineExecutionAuthority: 'NONE'
  },
  replay: {
    exact: true,
    onlineAndReplayAuthorityExportEqual: true
  },
  adrCoreModified: false,
  genericSdkModified: false,
  newArchitectureDecisionRequired: false
}, null, 2));
