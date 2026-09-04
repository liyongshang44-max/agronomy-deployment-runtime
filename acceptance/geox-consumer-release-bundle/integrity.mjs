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

const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
assert.equal(git.status, 0);
const sourceCommit = git.stdout.trim();
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
  cpSync(valid.bundleDir, sourceDrift, { recursive: true });
  const sourceProvenancePath = join(sourceDrift, 'RELEASE-PROVENANCE.json');
  const sourceProvenance = JSON.parse(readFileSync(sourceProvenancePath, 'utf8'));
  sourceProvenance.source.commit_sha = 'a'.repeat(40);
  writeCanonical(sourceProvenancePath, sourceProvenance);
  rewriteChecksums(sourceDrift);
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: sourceDrift, expectedSourceCommit: sourceCommit }), 'SOURCE_COMMIT_MISMATCH');

  const authorityPromotion = join(root, 'authority-promotion');
  cpSync(valid.bundleDir, authorityPromotion, { recursive: true });
  const authorityPath = join(authorityPromotion, 'RELEASE-PROVENANCE.json');
  const authorityProvenance = JSON.parse(readFileSync(authorityPath, 'utf8'));
  authorityProvenance.authority_ceiling.publication_authority = 'AUTHORIZED';
  writeCanonical(authorityPath, authorityProvenance);
  rewriteChecksums(authorityPromotion);
  expectCode(() => verifyGeoxConsumerReleaseBundle({ bundleDir: authorityPromotion, expectedSourceCommit: sourceCommit }), 'AUTHORITY_CEILING_MISMATCH');

  const packageDrift = join(root, 'package-drift');
  cpSync(valid.bundleDir, packageDrift, { recursive: true });
  const packagePath = join(packageDrift, 'RELEASE-PROVENANCE.json');
  const packageProvenance = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageProvenance.package.version = '9.9.9';
  writeCanonical(packagePath, packageProvenance);
  rewriteChecksums(packageDrift);
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

  console.log(JSON.stringify({
    ok: true,
    integrityCases: 6,
    checksumTamperRejected: true,
    sourceCommitDriftRejected: true,
    authorityPromotionRejected: true,
    packageMetadataDriftRejected: true,
    unexpectedFileRejected: true,
    publicationSideEffectsAbsent: true
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
