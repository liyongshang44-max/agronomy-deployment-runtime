import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';

function sourceCommit() {
  const explicit = process.env.ADR_RELEASE_SOURCE_COMMIT?.trim();
  if (explicit) return explicit;
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(git.status, 0);
  return git.stdout.trim();
}

const commit = sourceCommit();
assert.match(commit, /^[0-9a-f]{40}$/);
const root = mkdtempSync(join(tmpdir(), 'adr-geox-packed-artifact-closure-'));

try {
  const releaseA = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'release-a'), sourceCommit: commit });
  const releaseB = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'release-b'), sourceCommit: commit });
  const verifiedA = verifyGeoxConsumerReleaseBundle({ bundleDir: releaseA.bundleDir, expectedSourceCommit: commit });
  const verifiedB = verifyGeoxConsumerReleaseBundle({ bundleDir: releaseB.bundleDir, expectedSourceCommit: commit });

  assert.equal(verifiedA.packageTarballHash, verifiedB.packageTarballHash);
  assert.equal(verifiedA.packedArtifactClosure.contractVersion, 'adr.geox-consumer-packed-artifact-closure.v1');
  assert.equal(verifiedA.packedArtifactClosure.fileCount, 9);
  assert.equal(verifiedA.packedArtifactClosure.fileSetHash, verifiedB.packedArtifactClosure.fileSetHash);
  assert.equal(verifiedA.packedArtifactClosure.contentClosureHash, verifiedB.packedArtifactClosure.contentClosureHash);
  assert.deepEqual(verifiedA.packedArtifactClosure.contentHashes, verifiedB.packedArtifactClosure.contentHashes);

  const packedPaths = Object.keys(verifiedA.packedArtifactClosure.contentHashes).sort();
  assert.deepEqual(packedPaths, [
    'package/package.json',
    'package/src/decision-result-sink.mjs',
    'package/src/durable-target-authority-store.mjs',
    'package/src/index.mjs',
    'package/src/integration-contracts.mjs',
    'package/src/target-authority-resolver.mjs',
    'package/src/target-correspondence-profile-registry.mjs',
    'package/src/target-correspondence.mjs',
    'package/src/target-identity-token.mjs'
  ]);

  assert.equal(verifiedA.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(verifiedA.authorityClaim, 'NONE_RELEASE_BUNDLE_PROVENANCE_ONLY');

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_PACKED_ARTIFACT_SOURCE_CLOSURE_V1',
    sourceCommit: commit,
    packageName: verifiedA.packageName,
    packageVersion: verifiedA.packageVersion,
    packageTarballHash: verifiedA.packageTarballHash,
    closureContractVersion: verifiedA.packedArtifactClosure.contractVersion,
    packedFileCount: verifiedA.packedArtifactClosure.fileCount,
    packedFileSetHash: verifiedA.packedArtifactClosure.fileSetHash,
    packedContentClosureHash: verifiedA.packedArtifactClosure.contentClosureHash,
    exactPackageJsonBytesVerified: true,
    transformedAdapterSourceBytesVerified: 7,
    bundledSdkBytesVerified: true,
    builderSourceHashSelfAssertionTrustedAsArtifactProof: false,
    releaseStatusChanged: false,
    packagePublicationAuthorized: false,
    runtimeModified: false,
    fieldActionabilityCreated: false,
    approvalAuthorityCreated: false,
    dispatchAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
