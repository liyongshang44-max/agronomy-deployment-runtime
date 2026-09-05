import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerArtifact } from '../../adapters/geox/scripts/build-consumer-artifact.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

const root = mkdtempSync(join(tmpdir(), 'adr-geox-profile-discovery-'));
try {
  const build = buildGeoxConsumerArtifact({ outputDir: join(root, 'producer') });
  assert.equal(build.packageName, '@adr/geox-adapter');
  assert.equal(build.packageVersion, '0.1.0-development');
  assert.equal(build.authorityClaim, 'NONE_PACKAGING_ONLY_NO_NEW_ADR_OR_GEOX_AUTHORITY');

  const consumerDir = join(root, 'consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'adr-geox-profile-discovery-consumer',
    private: true,
    type: 'module'
  }, null, 2)}\n`, 'utf8');

  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--offline',
    build.tarballPath
  ], {
    cwd: consumerDir,
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
      NODE_PATH: '',
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false'
    }
  });

  const consumerSource = `
import assert from 'node:assert/strict';
import * as registry from '@adr/geox-adapter/target-correspondence-profile-registry';

const expectedApi = [
  'GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY',
  'GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED',
  'GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION',
  'GEOX_TARGET_CORRESPONDENCE_RELATION',
  'GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION',
  'GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION',
  'getGeoxTargetCorrespondenceProfile',
  'listGeoxTargetCorrespondenceProfiles'
];
assert.deepEqual(Object.keys(registry).sort(), expectedApi.sort());
assert.equal(registry.GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION, 'adr.geox-target-correspondence-profile-registry.v1');

const profiles = registry.listGeoxTargetCorrespondenceProfiles();
assert.equal(Object.isFrozen(profiles), true);
assert.equal(profiles.length, 3);
assert.equal(new Set(profiles.map((profile) => profile.relation)).size, 3);

const relations = profiles.map((profile) => profile.relation).sort();
assert.deepEqual(relations, [
  registry.GEOX_TARGET_CORRESPONDENCE_RELATION,
  registry.GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
  registry.GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION
].sort());

for (const profile of profiles) {
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.authorityPaths), true);
  assert.equal(Object.isFrozen(profile.provider), true);
  assert.equal(Object.isFrozen(profile.geox), true);
  assert.equal(registry.getGeoxTargetCorrespondenceProfile(profile.relation), profile);
  assert.equal('fieldActionable' in profile, false);
  assert.equal('dispatchAuthorized' in profile, false);
  assert.equal('humanApprovalAuthority' in profile, false);
  assert.equal('machineExecutionAuthority' in profile, false);
}

const t4 = registry.getGeoxTargetCorrespondenceProfile(registry.GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.equal(t4.replayableResolverSupported, true);
assert.equal(t4.pinnedAuthority, null);
assert.equal(t4.geox.field_id, 'field_kbs_mcse_t4r1');

const t3 = registry.getGeoxTargetCorrespondenceProfile(registry.GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION);
assert.equal(t3.replayableResolverSupported, false);
assert.ok(t3.pinnedAuthority);
assert.equal(t3.geox.field_id, 'field_kbs_mcse_t3r1');

const t1 = registry.getGeoxTargetCorrespondenceProfile(registry.GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION);
assert.equal(t1.replayableResolverSupported, false);
assert.ok(t1.pinnedAuthority);
assert.equal(t1.geox.field_id, 'field_kbs_mcse_t1r1');

assert.equal(registry.getGeoxTargetCorrespondenceProfile('UNKNOWN_PROFILE'), null);
assert.equal(Object.keys(registry).some((name) => /register|mutate|update|setProfile/i.test(name)), false);

console.log(JSON.stringify({
  ok: true,
  registryVersion: registry.GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  discoveredProfiles: profiles.length,
  relations,
  selectedRelation: t4.relation,
  selectedProfileReplayable: t4.replayableResolverSupported,
  dynamicRegistrationSurface: false,
  fieldActionabilityGranted: false,
  dispatchAuthorityGranted: false,
  humanApprovalAuthorityGranted: false,
  machineExecutionAuthorityGranted: false
}));
`;

  writeFileSync(join(consumerDir, 'consumer.mjs'), consumerSource, 'utf8');
  const consumed = run(process.execPath, ['consumer.mjs'], {
    cwd: consumerDir,
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
      NODE_PATH: '',
      npm_config_offline: 'true'
    }
  });
  const evidence = JSON.parse(consumed.stdout.trim());
  assert.equal(evidence.ok, true);
  assert.equal(evidence.discoveredProfiles, 3);
  assert.equal(evidence.selectedProfileReplayable, true);
  assert.equal(evidence.dynamicRegistrationSurface, false);
  assert.equal(evidence.fieldActionabilityGranted, false);
  assert.equal(evidence.dispatchAuthorityGranted, false);
  assert.equal(evidence.humanApprovalAuthorityGranted, false);
  assert.equal(evidence.machineExecutionAuthorityGranted, false);

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_CONSUMER_PROFILE_DISCOVERY_V1',
    packageName: build.packageName,
    packageVersion: build.packageVersion,
    packageTarballHash: build.tarballHash,
    installMode: 'EMPTY_PROJECT_LOCAL_TARBALL_NPM_OFFLINE',
    publicPackageSubpath: '@adr/geox-adapter/target-correspondence-profile-registry',
    registryVersion: evidence.registryVersion,
    discoveredProfiles: evidence.discoveredProfiles,
    selectedRelation: evidence.selectedRelation,
    selectedProfileReplayable: evidence.selectedProfileReplayable,
    repositoryInternalImportsAtConsumerRuntime: 0,
    networkReadsAtConsumerRuntime: 0,
    dynamicRegistrationSurface: false,
    fieldActionabilityGranted: false,
    dispatchAuthorityGranted: false,
    humanApprovalAuthorityGranted: false,
    machineExecutionAuthorityGranted: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
