import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_AUTHORITY_CLAIM,
  GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  GEOX_TARGET_CORRESPONDENCE_STATUS,
  GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
  GEOX_TARGET_CORRESPONDENCE_VERSION,
  consumeAdrTargetCorrespondenceForGeox
} from '../../adapters/geox/src/target-correspondence.mjs';
import { buildKbsT1R1TargetWorld } from './target-world.mjs';

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

const world = buildKbsT1R1TargetWorld();
assert.equal(world.providerHash, 'sha256:b79542a4a5f19f91d7d98c6404bf841cd5660b28672e9fb66bd4b9e6905c1fcd');
assert.deepEqual(world.providerTarget, {
  experiment: 'Main Cropping System Experiment (MCSE)',
  treatment: 'T1',
  replicate: 'R1',
  crop: 'corn',
  plantingObservationId: '6931',
  hybrid: 'P0306Q'
});
assert.equal('farmId' in world.decision.semanticPayload.targetRef, false);
assert.equal('fieldId' in world.decision.semanticPayload.targetRef, false);
assert.equal('zoneId' in world.decision.semanticPayload.targetRef, false);

const geoxTargetAuthority = JSON.parse(readFileSync(
  new URL('./geox-kbs-t1r1-authority-export.json', import.meta.url),
  'utf8'
));
assert.equal(geoxTargetAuthority.source_main_sha, '0bd2300c9c8a58025df9212d7c14e640606add83');
assert.equal(geoxTargetAuthority.provider_target.hybrid_code, 'P0306Q');
assert.equal(geoxTargetAuthority.authority_sources.length, 4);
assert.deepEqual(geoxTargetAuthority.authority_sources[3], {
  path: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-CURRENT-CROP-AUTHORITY-REQUALIFICATION-RESULT-V1.json',
  blob_sha: 'a9196e16ab6402fcfe2d59b738a395ef52d7c236'
});
assert.equal(geoxTargetAuthority.geox_target.field_id, 'field_kbs_mcse_t1r1');
assert.equal(geoxTargetAuthority.geox_target.zone_id, 'zone_kbs_mcse_t1r1_formal_v1');
assert.equal(geoxTargetAuthority.geox_target.field_validity_proven, false);
assert.equal(geoxTargetAuthority.geox_target.production_site_claimed, false);
assert.equal(
  geoxTargetAuthority.geometry_boundary.geometry_authority_class,
  'PROVIDER_GEOMETRY_REFERENCED_RESTRICTED_NOT_REPUBLISHED'
);

const authorityRefs = [
  toWireRef(world.decision.ref),
  toWireRef(world.manifest.ref),
  ...world.validatedDatums.map((datum) => toWireRef(datum.record.ref))
];
assert.equal(authorityRefs.length, 9);

const message = createIntegrationMessage({
  role: 'RESULT_SINK',
  messageType: GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  messageId: 'geox-kbs-t1r1-target-correspondence-1',
  authorityRefs,
  payload: {
    provider_target: {
      experiment_locator: world.adapterResponse.source_evidence[0].locator,
      treatment_code: world.providerTarget.treatment,
      replicate_code: world.providerTarget.replicate,
      crop_code: world.providerTarget.crop,
      hybrid_code: world.providerTarget.hybrid,
      planting_observation_id: world.providerTarget.plantingObservationId
    },
    relation_candidate: GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
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
  geoxTargetAuthority
});

assert.equal(projection.contract_version, GEOX_TARGET_CORRESPONDENCE_VERSION);
assert.equal(projection.status, GEOX_TARGET_CORRESPONDENCE_STATUS);
assert.equal(projection.relation, GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION);
assert.equal(
  projection.provider_target.experiment_locator,
  'https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/'
);
assert.equal(projection.provider_target.treatment_code, 'T1');
assert.equal(projection.provider_target.replicate_code, 'R1');
assert.equal(projection.provider_target.crop_code, 'corn');
assert.equal(projection.provider_target.hybrid_code, 'P0306Q');
assert.equal(projection.provider_target.planting_observation_id, '6931');
assert.equal(projection.geox_target.field_id, 'field_kbs_mcse_t1r1');
assert.equal(projection.geox_target.zone_id, 'zone_kbs_mcse_t1r1_formal_v1');
assert.equal(projection.geox_target.field_validity_proven, false);
assert.equal(projection.geox_target.production_site_claimed, false);
assert.equal(
  projection.consumer_authority_pin.classification,
  'PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY'
);
assert.equal(projection.identity_equality_claimed, false);
assert.equal(projection.geometry_equality_claimed, false);
assert.equal(projection.zone_correspondence_claimed, false);
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.human_approval_authority, 'NONE');
assert.equal(projection.machine_execution_authority, 'NONE');
assert.equal(projection.authority_claim, GEOX_TARGET_CORRESPONDENCE_AUTHORITY_CLAIM);

console.log(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_KBS_T1R1_CROSS_NAMESPACE_TARGET_CORRESPONDENCE_V1',
  adrTarget: {
    providerHash: world.providerHash,
    decisionProblemRef: world.decision.ref,
    contextManifestRef: world.manifest.ref,
    contextDatumCount: world.validatedDatums.length,
    providerTarget: world.providerTarget,
    adrFarmIdCreated: false,
    adrFieldIdCreated: false,
    adrZoneIdCreated: false,
    geometryRepublished: false
  },
  geoxTarget: {
    sourceMainSha: geoxTargetAuthority.source_main_sha,
    fieldId: projection.geox_target.field_id,
    seasonId: projection.geox_target.season_id,
    zoneId: projection.geox_target.zone_id,
    geometryAuthorityClass: geoxTargetAuthority.geometry_boundary.geometry_authority_class,
    consumerHybridAuthority: 'P0306Q',
    ea5e2OperationalActivationQualified: false,
    fieldValidityProven: false,
    productionSiteClaimed: false
  },
  correspondence: {
    status: projection.status,
    relation: projection.relation,
    sharedProviderTarget: projection.provider_target,
    hybridCorrespondenceClaimed: true,
    consumerAuthorityClassification: projection.consumer_authority_pin.classification,
    identityEqualityClaimed: false,
    geometryEqualityClaimed: false,
    zoneCorrespondenceClaimed: false,
    fieldActionable: false,
    dispatchAuthorized: false,
    humanApprovalAuthority: 'NONE',
    machineExecutionAuthority: 'NONE'
  },
  adrCoreModified: false,
  genericSdkModified: false,
  newArchitectureDecisionRequired: false
}, null, 2));
