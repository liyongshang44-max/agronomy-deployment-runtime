import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function writeCanonical(path, value) {
  writeFileSync(path, `${JSON.stringify(canonical(value), null, 2)}\n`, 'utf8');
}

function rewriteChecksums(bundleDir) {
  const files = readdirSync(bundleDir);
  const tarball = files.find((name) => name.endsWith('.tgz'));
  const entries = [tarball, 'RELEASE-PROVENANCE.json'].sort().map((filename) => `${sha256(readFileSync(join(bundleDir, filename)))}  ${filename}`);
  writeFileSync(join(bundleDir, 'SHA256SUMS'), `${entries.join('\n')}\n`, 'utf8');
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`);
}

function qualifiedSourceCommit() {
  const explicit = process.env.ADR_RELEASE_SOURCE_COMMIT?.trim();
  if (explicit) return explicit;
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(git.status, 0);
  return git.stdout.trim();
}

function mutateProvenance(validBundleDir, targetDir, mutate) {
  cpSync(validBundleDir, targetDir, { recursive: true });
  const path = join(targetDir, 'RELEASE-PROVENANCE.json');
  const provenance = JSON.parse(readFileSync(path, 'utf8'));
  mutate(provenance);
  writeCanonical(path, provenance);
  rewriteChecksums(targetDir);
}

const sourceCommit = qualifiedSourceCommit();
assert.match(sourceCommit, /^[0-9a-f]{40}$/);
const root = mkdtempSync(join(tmpdir(), 'adr-geox-release-bundle-integrity-'));

try {
  const valid = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'valid-build'), sourceCommit });
  assert.ok(verifyGeoxConsumerReleaseBundle({ bundleDir: valid.bundleDir, expectedSourceCommit: sourceCommit }).evidenceHash);

  const tamperedTarball = join(root, 'tampered-tarball');
  cpSync(valid.bundleDir, tamperedTarball, { recursive: true });
  const tgz = readdirSync(tamperedTarball).find((name) => name.endsWith('.tgz'));
  appendFileSync(join(tamperedTarball, tgz), Buffer.from('tamper', 'utf8'));
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: tamperedTarball, expectedSourceCommit: sourceCommit }), 'CHECKSUM_MISMATCH');

  const sourceDrift = join(root, 'source-drift');
  mutateProvenance(valid.bundleDir, sourceDrift, (provenance) => {
    provenance.source.commit_sha = sourceCommit === 'a'.repeat(40) ? 'b'.repeat(40) : 'a'.repeat(40);
  });
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: sourceDrift, expectedSourceCommit: sourceCommit }), 'SOURCE_COMMIT_MISMATCH');

  const sourceHashDrift = join(root, 'source-hash-drift');
  mutateProvenance(valid.bundleDir, sourceHashDrift, (provenance) => {
    const first = Object.keys(provenance.consumer_artifact.source_hashes)[0];
    provenance.consumer_artifact.source_hashes[first] = `sha256:${'0'.repeat(64)}`;
  });
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: sourceHashDrift, expectedSourceCommit: sourceCommit }), 'SOURCE_CONTENT_HASH_MISMATCH');

  const builderDrift = join(root, 'builder-drift');
  mutateProvenance(valid.bundleDir, builderDrift, (provenance) => {
    provenance.bundle_builder_version = 'adr.geox-consumer-release-bundle-builder.v999';
  });
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: builderDrift, expectedSourceCommit: sourceCommit }), 'BUILDER_VERSION_MISMATCH');

  const authorityPromotion = join(root, 'authority-promotion');
  mutateProvenance(valid.bundleDir, authorityPromotion, (provenance) => {
    provenance.authority_ceiling.publication_authority = 'AUTHORIZED';
  });
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: authorityPromotion, expectedSourceCommit: sourceCommit }), 'AUTHORITY_CEILING_MISMATCH');

  const packageDrift = join(root, 'package-drift');
  mutateProvenance(valid.bundleDir, packageDrift, (provenance) => {
    provenance.package.version = '9.9.9';
  });
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: packageDrift, expectedSourceCommit: sourceCommit }), 'PACKAGE_METADATA_MISMATCH');

  const extraFile = join(root, 'extra-file');
  cpSync(valid.bundleDir, extraFile, { recursive: true });
  writeFileSync(join(extraFile, 'UNQUALIFIED.txt'), 'not part of bundle\n');
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: extraFile, expectedSourceCommit: sourceCommit }), 'BUNDLE_FILE_SET_INVALID');

  const workflow = readFileSync('.github/workflows/productization-geox-consumer-release-bundle.yml', 'utf8');
  for (const forbidden of ['npm publish', 'git tag', 'gh release', 'actions/create-release', 'softprops/action-gh-release']) {
    assert.equal(workflow.includes(forbidden), false, `qualification workflow must not contain publication side effect: ${forbidden}`);
  }
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /ADR_RELEASE_SOURCE_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- 'main'/, 'authoritative main must trigger exact-SHA release-bundle qualification');

  console.log(JSON.stringify({
    ok: true,
    integrityCases: 10,
    checksumTamperRejected: true,
    sourceCommitDriftRejected: true,
    sourceContentHashDriftRejected: true,
    builderVersionDriftRejected: true,
    authorityPromotionRejected: true,
    packageMetadataDriftRejected: true,
    unexpectedFileRejected: true,
    publicationSideEffectsAbsent: true,
    pullRequestSyntheticMergeRefExcludedFromSourceProvenance: true,
    authoritativeMainPushQualificationEnabled: true
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
