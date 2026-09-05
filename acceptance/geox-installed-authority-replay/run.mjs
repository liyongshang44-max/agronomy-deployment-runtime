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

function parseSingleJsonLine(stdout, label) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1, `${label} must emit exactly one JSON line`);
  return JSON.parse(lines[0]);
}

const root = mkdtempSync(join(tmpdir(), 'adr-geox-installed-authority-replay-'));
try {
  const build = buildGeoxConsumerArtifact({ outputDir: join(root, 'producer') });
  assert.equal(build.packageName, '@adr/geox-adapter');
  assert.equal(build.packageVersion, '0.1.0-development');
  assert.equal(build.authorityClaim, 'NONE_PACKAGING_ONLY_NO_NEW_ADR_OR_GEOX_AUTHORITY');

  const consumerDir = join(root, 'consumer');
  const durableRoot = join(root, 'durable-authority-store');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'adr-geox-installed-authority-replay-consumer',
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
      NODE_PATH: '',
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false'
    }
  });

  const processASource = `
import assert from 'node:assert/strict';
import {
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '@adr/geox-adapter/target-correspondence-profile-registry';
import { GeoxDurableTargetAuthorityStore } from '@adr/geox-adapter/durable-target-authority-store';
import {
  GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
  createGitHubPublicAuthorityTransport,
  resolveGeoxTargetAuthority
} from '@adr/geox-adapter/target-authority-resolver';

const rootDir = process.argv[2];
assert.ok(rootDir);
const profile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(profile);
assert.equal(profile.replayableResolverSupported, true);
assert.equal(profile.pinnedAuthority, null);

const token = process.env.GITHUB_TOKEN;
const authenticatedFetch = async (url, init = {}) => globalThis.fetch(url, {
  ...init,
  headers: {
    ...(init.headers ?? {}),
    ...(token ? { Authorization: \`Bearer \${token}\` } : {})
  }
});

const store = new GeoxDurableTargetAuthorityStore({ rootDir });
const live = await resolveGeoxTargetAuthority({
  ref: 'main',
  resolvedAt: '2026-09-05T09:30:00.000Z',
  transport: createGitHubPublicAuthorityTransport({ fetchImpl: authenticatedFetch }),
  snapshotStore: store
});
const receiptHash = store.persistReceipt(live.receipt);

assert.equal(live.receipt.resolution_class, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(live.receipt.replay_class, 'EXACT');
assert.equal(live.receipt.authority_sources.length, 4);
assert.equal(store.count(), 4);
assert.match(live.receipt.resolved_commit_sha, /^[0-9a-f]{40}$/);
assert.equal(live.authorityExport.source_repository, 'liyongshang44-max/GEOX');
assert.equal(live.authorityExport.provider_target.treatment_code, profile.provider.treatment);
assert.equal(live.authorityExport.provider_target.replicate_code, profile.provider.replicate);
assert.equal(live.authorityExport.geox_target.field_id, profile.geox.field_id);
assert.equal(live.authorityExport.geox_target.season_id, profile.geox.season_id);
assert.equal(live.authorityExport.geox_target.zone_id, profile.geox.zone_id);
assert.deepEqual(
  live.receipt.authority_sources.map((source) => source.path).sort(),
  [...profile.authorityPaths].sort()
);
assert.equal(live.receipt.field_actionability_authorized, false);
assert.equal(live.receipt.dispatch_authorized, false);
assert.equal(live.receipt.human_approval_authority, 'NONE');
assert.equal(live.receipt.machine_execution_authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  process: 'INSTALLED_CONSUMER_A_LIVE_RESOLVE_AND_PERSIST',
  processId: process.pid,
  relation: profile.relation,
  receiptHash,
  resolvedCommitSha: live.receipt.resolved_commit_sha,
  authorityExportHash: live.receipt.authority_export_hash,
  snapshotCount: store.count(),
  geoxTarget: live.authorityExport.geox_target
}));
`;

  const processBSource = `
import assert from 'node:assert/strict';
import {
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '@adr/geox-adapter/target-correspondence-profile-registry';
import { GeoxDurableTargetAuthorityStore } from '@adr/geox-adapter/durable-target-authority-store';
import { replayGeoxTargetAuthorityResolution } from '@adr/geox-adapter/target-authority-resolver';

const rootDir = process.argv[2];
const receiptHash = process.argv[3];
const expectedCommit = process.argv[4];
const expectedAuthorityExportHash = process.argv[5];
const processAId = Number(process.argv[6]);
assert.ok(rootDir && receiptHash && expectedCommit && expectedAuthorityExportHash);
assert.ok(Number.isInteger(processAId) && processAId > 0);
assert.notEqual(process.pid, processAId, 'replay must execute in a distinct process');
assert.equal(process.env.GITHUB_TOKEN, undefined, 'offline process must not receive GITHUB_TOKEN');

let networkAttempted = false;
globalThis.fetch = async () => {
  networkAttempted = true;
  throw new Error('NETWORK_FORBIDDEN_DURING_INSTALLED_CONSUMER_REPLAY');
};

const profile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(profile);
assert.equal(profile.replayableResolverSupported, true);

const store = new GeoxDurableTargetAuthorityStore({ rootDir });
const receipt = store.loadReceipt(receiptHash);
assert.equal(receipt.resolved_commit_sha, expectedCommit);
assert.equal(receipt.authority_export_hash, expectedAuthorityExportHash);
const replay = replayGeoxTargetAuthorityResolution({ receipt, snapshotStore: store });

assert.equal(networkAttempted, false, 'exact replay must not attempt network access');
assert.equal(replay.replayClass, 'EXACT');
assert.equal(store.count(), 4);
assert.equal(replay.authorityExport.source_main_sha, expectedCommit);
assert.equal(replay.authorityExport.provider_target.treatment_code, profile.provider.treatment);
assert.equal(replay.authorityExport.provider_target.replicate_code, profile.provider.replicate);
assert.equal(replay.authorityExport.geox_target.field_id, profile.geox.field_id);
assert.equal(replay.authorityExport.geox_target.season_id, profile.geox.season_id);
assert.equal(replay.authorityExport.geox_target.zone_id, profile.geox.zone_id);
assert.equal(replay.authorityExport.authority_boundary.field_actionability_authorized, false);
assert.equal(replay.authorityExport.authority_boundary.dispatch_authorized, false);
assert.equal(receipt.human_approval_authority, 'NONE');
assert.equal(receipt.machine_execution_authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  process: 'INSTALLED_CONSUMER_B_OFFLINE_EXACT_REPLAY',
  processId: process.pid,
  processAId,
  relation: profile.relation,
  receiptHash,
  resolvedCommitSha: receipt.resolved_commit_sha,
  authorityExportHash: receipt.authority_export_hash,
  snapshotCount: store.count(),
  replayClass: replay.replayClass,
  networkAttempted,
  geoxTarget: replay.authorityExport.geox_target
}));
`;

  assert.equal(processASource.includes('../../adapters/'), false);
  assert.equal(processASource.includes('../../sdks/'), false);
  assert.equal(processBSource.includes('../../adapters/'), false);
  assert.equal(processBSource.includes('../../sdks/'), false);
  writeFileSync(join(consumerDir, 'process-a.mjs'), processASource, 'utf8');
  writeFileSync(join(consumerDir, 'process-b.mjs'), processBSource, 'utf8');

  const processA = run(process.execPath, ['process-a.mjs', durableRoot], {
    cwd: consumerDir,
    env: {
      ...process.env,
      NODE_PATH: ''
    }
  });
  const live = parseSingleJsonLine(processA.stdout, 'process A');
  assert.equal(live.ok, true);
  assert.equal(live.snapshotCount, 4);

  const offlineEnv = { ...process.env, NODE_PATH: '' };
  delete offlineEnv.GITHUB_TOKEN;
  delete offlineEnv.GH_TOKEN;
  const processB = run(process.execPath, [
    'process-b.mjs',
    durableRoot,
    live.receiptHash,
    live.resolvedCommitSha,
    live.authorityExportHash,
    String(live.processId)
  ], {
    cwd: consumerDir,
    env: offlineEnv
  });
  const replay = parseSingleJsonLine(processB.stdout, 'process B');
  assert.equal(replay.ok, true);
  assert.notEqual(replay.processId, live.processId);
  assert.equal(replay.receiptHash, live.receiptHash);
  assert.equal(replay.resolvedCommitSha, live.resolvedCommitSha);
  assert.equal(replay.authorityExportHash, live.authorityExportHash);
  assert.equal(replay.replayClass, 'EXACT');
  assert.equal(replay.networkAttempted, false);
  assert.deepEqual(replay.geoxTarget, live.geoxTarget);

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_INSTALLED_CONSUMER_AUTHORITY_REPLAY_V1',
    packageName: build.packageName,
    packageVersion: build.packageVersion,
    packageTarballHash: build.tarballHash,
    installMode: 'EMPTY_PROJECT_LOCAL_TARBALL_NPM_OFFLINE',
    profileDiscoverySurface: '@adr/geox-adapter/target-correspondence-profile-registry',
    resolverSurface: '@adr/geox-adapter/target-authority-resolver',
    durableStoreSurface: '@adr/geox-adapter/durable-target-authority-store',
    selectedRelation: live.relation,
    onlineResolvedCommitSha: live.resolvedCommitSha,
    onlineAuthorityExportHash: live.authorityExportHash,
    persistedSnapshots: live.snapshotCount,
    replayProcessDistinct: replay.processId !== live.processId,
    replayClass: replay.replayClass,
    replayNetworkAttempted: replay.networkAttempted,
    repositoryInternalImportsAtConsumerRuntime: 0,
    fieldActionabilityGranted: false,
    dispatchAuthorityGranted: false,
    humanApprovalAuthorityGranted: false,
    machineExecutionAuthorityGranted: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
