import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

const sourceCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
assert.match(sourceCommit, /^[0-9a-f]{40}$/);

const root = mkdtempSync(join(tmpdir(), 'adr-geox-consumer-release-bundle-'));
try {
  const buildA = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'bundle-a'), sourceCommit });
  const buildB = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'bundle-b'), sourceCommit });

  assert.equal(buildA.bundleContractVersion, 'adr.geox-consumer-release-bundle-build.v1');
  assert.equal(buildA.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(buildA.packageName, '@adr/geox-adapter');
  assert.equal(buildA.packageVersion, '0.1.0-development');
  assert.equal(buildA.sourceCommit, sourceCommit);
  assert.equal(buildA.packageTarballHash, buildB.packageTarballHash, 'same exact source must produce identical package tarball');
  assert.equal(buildA.provenanceHash, buildB.provenanceHash, 'same exact source must produce identical provenance');
  assert.equal(readFileSync(buildA.checksumsPath, 'utf8'), readFileSync(buildB.checksumsPath, 'utf8'), 'same exact source must produce identical checksum manifest');
  assert.deepEqual(buildA.authorityCeiling, buildB.authorityCeiling);
  assert.deepEqual(buildA.prohibitedPublicationActions, ['GITHUB_RELEASE', 'GIT_TAG', 'NPM_PUBLISH']);
  assert.equal(buildA.authorityClaim, 'NONE_RELEASE_BUNDLE_PROVENANCE_ONLY');

  const verifiedA = verifyGeoxConsumerReleaseBundle({ bundleDir: buildA.bundleDir, expectedSourceCommit: sourceCommit });
  const verifiedB = verifyGeoxConsumerReleaseBundle({ bundleDir: buildB.bundleDir, expectedSourceCommit: sourceCommit });
  assert.equal(verifiedA.evidenceHash, verifiedB.evidenceHash, 'same exact source must verify to identical bundle evidence hash');
  assert.equal(verifiedA.packageTarballHash, buildA.packageTarballHash);
  assert.equal(verifiedA.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');

  const consumerDir = join(root, 'isolated-consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({ name: 'release-bundle-consumer', private: true, type: 'module' }, null, 2)}\n`);
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', buildA.packageTarballPath], {
    cwd: consumerDir,
    env: { ...process.env, npm_config_update_notifier: 'false' }
  });
  const consumePath = join(consumerDir, 'consume.mjs');
  writeFileSync(consumePath, `
import assert from 'node:assert/strict';
import { GEOX_FIRST_PARTY_ADAPTER_VERSION } from '@adr/geox-adapter';
import { GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION } from '@adr/geox-adapter/target-authority-resolver';
assert.equal(GEOX_FIRST_PARTY_ADAPTER_VERSION, 'adr.geox-adapter.v1');
assert.equal(GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION, 'adr.geox-target-authority-resolution-receipt.v1');
console.log(JSON.stringify({ ok: true }));
`, 'utf8');
  const consumed = run(process.execPath, [consumePath], {
    cwd: consumerDir,
    env: { ...process.env, GITHUB_TOKEN: '', npm_config_offline: 'true' }
  });
  assert.deepEqual(JSON.parse(consumed.stdout.trim()), { ok: true });

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_CONSUMER_RELEASE_BUNDLE_QUALIFICATION_V1',
    sourceCommit,
    packageName: buildA.packageName,
    packageVersion: buildA.packageVersion,
    deterministicTarballHash: buildA.packageTarballHash,
    deterministicProvenanceHash: buildA.provenanceHash,
    deterministicBundleEvidenceHash: verifiedA.evidenceHash,
    checksumManifest: 'SHA256SUMS',
    provenanceManifest: 'RELEASE-PROVENANCE.json',
    releaseStatus: buildA.releaseStatus,
    publicationAuthority: buildA.authorityCeiling.publication_authority,
    commercialValidation: buildA.authorityCeiling.commercial_validation,
    githubReleaseCreated: false,
    gitTagCreated: false,
    npmPublished: false,
    humanApprovalAuthorityCreated: false,
    dispatchAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    adrCoreModified: false,
    genericSdkModified: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
