import assert from 'node:assert/strict';

import * as registryModule from '../../adapters/geox/src/target-correspondence-profile-registry.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_RELATION as ADAPTER_T4_RELATION,
  GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION as ADAPTER_T1_RELATION,
  GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION as ADAPTER_T3_RELATION
} from '../../adapters/geox/src/target-correspondence.mjs';

const {
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
  GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
  GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY,
  GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED,
  getGeoxTargetCorrespondenceProfile,
  listGeoxTargetCorrespondenceProfiles
} = registryModule;

assert.equal(
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  'adr.geox-target-correspondence-profile-registry.v1'
);
assert.equal(ADAPTER_T4_RELATION, GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.equal(ADAPTER_T3_RELATION, GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION);
assert.equal(ADAPTER_T1_RELATION, GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION);

const profiles = listGeoxTargetCorrespondenceProfiles();
assert.equal(Object.isFrozen(profiles), true);
assert.equal(profiles.length, 3);
assert.deepEqual(
  new Set(profiles.map((profile) => profile.relation)),
  new Set([
    GEOX_TARGET_CORRESPONDENCE_RELATION,
    GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
    GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION
  ])
);
assert.equal(getGeoxTargetCorrespondenceProfile('UNKNOWN_RELATION'), null);
assert.equal(typeof registryModule.registerGeoxTargetCorrespondenceProfile, 'undefined');
assert.equal(typeof registryModule.setGeoxTargetCorrespondenceProfile, 'undefined');

const t4 = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
const t3 = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION);
const t1 = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION);

for (const profile of [t4, t3, t1]) {
  assert.ok(profile);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.authorityPaths), true);
  assert.equal(Object.isFrozen(profile.provider), true);
  assert.equal(Object.isFrozen(profile.geox), true);
  assert.equal(profile.authorityPaths.length, 4);
  assert.equal(new Set(profile.authorityPaths).size, 4);
  assert.equal(profile.provider.replicate_code, 'R1');
  assert.equal(profile.provider.crop_code, 'corn');
  assert.equal(profile.geox.season_id, 'season_2026_corn');
}

assert.equal(t4.replayableResolverSupported, true);
assert.equal(t4.pinnedAuthority, null);
assert.equal(t4.geometryBoundaryClass, GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY);
assert.equal(t4.provider.treatment_code, 'T4');
assert.equal(t4.provider.hybrid_code, '43-96P');
assert.equal(t4.provider.planting_observation_id, '6974');
assert.equal(t4.geox.field_id, 'field_kbs_mcse_t4r1');
assert.equal(t4.geox.zone_id, 'zone_kbs_mcse_t4r1_crop_formal_v1');

assert.equal(t3.replayableResolverSupported, false);
assert.equal(Object.isFrozen(t3.pinnedAuthority), true);
assert.equal(Object.isFrozen(t3.pinnedAuthority.blobShas), true);
assert.equal(t3.pinnedAuthority.sourceMainSha, '5050f1c08d2528048c56d56add4cbb068b956925');
assert.equal(t3.geometryBoundaryClass, GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY);
assert.equal(t3.provider.treatment_code, 'T3');
assert.equal(t3.provider.hybrid_code, 'P0306Q');
assert.equal(t3.provider.planting_observation_id, '6966');
assert.equal(t3.geox.field_id, 'field_kbs_mcse_t3r1');
assert.equal(t3.geox.zone_id, 'zone_kbs_mcse_t3r1_crop_formal_v1');

assert.equal(t1.replayableResolverSupported, false);
assert.equal(Object.isFrozen(t1.pinnedAuthority), true);
assert.equal(Object.isFrozen(t1.pinnedAuthority.blobShas), true);
assert.equal(t1.pinnedAuthority.sourceMainSha, '0bd2300c9c8a58025df9212d7c14e640606add83');
assert.equal(
  t1.geometryBoundaryClass,
  GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED
);
assert.equal(t1.provider.treatment_code, 'T1');
assert.equal(t1.provider.hybrid_code, 'P0306Q');
assert.equal(t1.provider.planting_observation_id, '6931');
assert.equal(t1.geox.field_id, 'field_kbs_mcse_t1r1');
assert.equal(t1.geox.zone_id, 'zone_kbs_mcse_t1r1_formal_v1');

assert.throws(() => {
  profiles.push(t4);
}, TypeError);
assert.throws(() => {
  t1.provider.treatment_code = 'T9';
}, TypeError);
assert.throws(() => {
  t3.authorityPaths.push('forbidden');
}, TypeError);
assert.throws(() => {
  t1.pinnedAuthority.blobShas[t1.authorityPaths[0]] = '1111111111111111111111111111111111111111';
}, TypeError);

const secondRead = listGeoxTargetCorrespondenceProfiles();
assert.notEqual(secondRead, profiles);
assert.deepEqual(secondRead, profiles);
assert.equal(getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION), t1);

console.log(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_V1',
  registryVersion: GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  profileCount: profiles.length,
  relations: profiles.map((profile) => profile.relation),
  geometryAuthorityClasses: [...new Set(profiles.map((profile) => profile.geometryBoundaryClass))],
  replayableResolverProfiles: profiles.filter((profile) => profile.replayableResolverSupported).map((profile) => profile.relation),
  pinnedExactAuthorityProfiles: profiles.filter((profile) => !profile.replayableResolverSupported).map((profile) => profile.relation),
  runtimeProfileInjectionSupported: false,
  dynamicPluginRegistryCreated: false,
  genericSdkModified: false,
  adrCoreModified: false,
  newArchitectureDecisionRequired: false
}, null, 2));
