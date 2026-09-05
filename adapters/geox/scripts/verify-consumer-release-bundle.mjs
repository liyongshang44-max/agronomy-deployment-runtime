import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  listGeoxTargetCorrespondenceProfiles
} from '../src/target-correspondence-profile-registry.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '../../..');
const RELEASE_MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/release-bundle.manifest.json');
const CONSUMER_MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/consumer-artifact.manifest.json');
const API_SURFACE_PATH = join(REPO_ROOT, 'adapters/geox/consumer-api-surface.v1.json');
const ADAPTER_SOURCE_DIR = join(REPO_ROOT, 'adapters/geox/src');
const COMMIT_RE = /^[0-9a-f]{40}$/;
const EXPECTED_BUNDLE_BUILDER_VERSION = 'adr.geox-consumer-release-bundle-builder.v1';
const EXPECTED_CONSUMER_BUILDER_VERSION = 'adr.geox-consumer-artifact-builder.v1';
const PACKED_ARTIFACT_CLOSURE_VERSION = 'adr.geox-consumer-packed-artifact-closure.v1';

export const GEOX_CONSUMER_RELEASE_BUNDLE_VERIFIER_VERSION = 'adr.geox-consumer-release-bundle-verifier.v1';

export class GeoxConsumerReleaseBundleVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxConsumerReleaseBundleVerificationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxConsumerReleaseBundleVerificationError(code, message);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function sha256Json(value) {
  return sha256(Buffer.from(JSON.stringify(canonical(value)), 'utf8'));
}

function exactObject(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function exactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!exactObject(actual, wanted)) fail(code, `${label} fields drifted: ${actual.join(', ')}`);
}

function parseJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(code, `${path} is unreadable: ${error?.message ?? error}`);
  }
}

function parseChecksums(path) {
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const entries = new Map();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(line);
    if (!match) fail('CHECKSUM_MANIFEST_INVALID', `invalid SHA256SUMS line ${line}`);
    if (entries.has(match[2])) fail('CHECKSUM_MANIFEST_INVALID', `duplicate checksum entry ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  return entries;
}

function tarText(tarballPath, args, code) {
  const result = spawnSync('tar', [...args, tarballPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) fail(code, (result.stderr || result.stdout || 'tar command failed').trim());
  return result.stdout;
}

function packedFileList(tarballPath) {
  const result = spawnSync('tar', ['-tzf', tarballPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) fail('PACKAGE_TARBALL_INVALID', (result.stderr || result.stdout || 'tar listing failed').trim());
  const files = result.stdout.split('\n').map((entry) => entry.trim()).filter((entry) => entry && !entry.endsWith('/')).sort();
  if (new Set(files).size !== files.length) fail('PACKAGE_FILE_SET_MISMATCH', 'packed artifact contains duplicate file paths');
  return files;
}

function packedFileBytes(tarballPath, path) {
  const result = spawnSync('tar', ['-xOf', tarballPath, path], { encoding: null, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) {
    fail('PACKAGE_TARBALL_INVALID', Buffer.concat([result.stderr ?? Buffer.alloc(0), result.stdout ?? Buffer.alloc(0)]).toString('utf8').trim() || `cannot extract ${path}`);
  }
  return result.stdout;
}

function expectedSourceHashes(consumerManifest) {
  const hashes = {};
  for (const filename of consumerManifest.source_files ?? []) {
    hashes[`adapters/geox/src/${filename}`] = sha256(readFileSync(join(ADAPTER_SOURCE_DIR, filename)));
  }
  return hashes;
}

function expectedBundledDependency(consumerManifest) {
  const dependency = consumerManifest.bundled_dependency;
  return {
    sourcePath: dependency.source,
    artifactPath: dependency.artifact_path,
    contentHash: sha256(readFileSync(join(REPO_ROOT, dependency.source)))
  };
}

function normalizedApiSurface(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) {
    fail('PACKAGE_COMPATIBILITY_MISMATCH', 'consumer API surface modules must be an object');
  }
  return Object.fromEntries(Object.keys(modules).sort().map((modulePath) => {
    const exports = modules[modulePath];
    if (!Array.isArray(exports) || exports.length === 0) {
      fail('PACKAGE_COMPATIBILITY_MISMATCH', `consumer API surface ${modulePath} must contain exports`);
    }
    return [modulePath, [...exports].sort()];
  }));
}

function expectedCompatibility(consumerManifest) {
  const declared = consumerManifest.compatibility;
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    fail('PACKAGE_COMPATIBILITY_MISMATCH', 'consumer artifact compatibility envelope is required');
  }
  const apiBaseline = parseJson(API_SURFACE_PATH, 'PACKAGE_COMPATIBILITY_MISMATCH');
  const actualApiHash = sha256Json(normalizedApiSurface(apiBaseline.modules));
  if (apiBaseline.contract_version !== 'adr.geox-consumer-api-surface.v1'
    || apiBaseline.package_name !== consumerManifest.package_name
    || apiBaseline.package_version !== consumerManifest.package_version
    || apiBaseline.private !== consumerManifest.private
    || apiBaseline.node_engine !== consumerManifest.node_engine
    || apiBaseline.surface_hash !== actualApiHash) {
    fail('PACKAGE_COMPATIBILITY_MISMATCH', 'consumer API baseline identity or hash drifted');
  }
  const actualProfileSetHash = sha256Json(listGeoxTargetCorrespondenceProfiles());
  const expected = {
    contract_version: 'adr.geox-consumer-compatibility-envelope.v1',
    package_version: consumerManifest.package_version,
    consumer_api_surface: {
      contract_version: apiBaseline.contract_version,
      surface_hash: actualApiHash
    },
    target_correspondence_profile_registry: {
      registry_version: GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
      profile_set_hash: actualProfileSetHash
    },
    change_policy: 'EXACT_PACKAGE_API_AND_PROFILE_REGISTRY_COMPATIBILITY_REVIEW_REQUIRED',
    authority_claim: 'NONE_COMPATIBILITY_METADATA_ONLY_NO_RUNTIME_OR_PUBLICATION_AUTHORITY'
  };
  if (!exactObject(declared, expected)) {
    fail('PACKAGE_COMPATIBILITY_MISMATCH', 'consumer artifact compatibility envelope does not match exact API/registry source state');
  }
  return expected;
}

function expectedPackedPackageJson(consumerManifest, compatibility) {
  return {
    name: consumerManifest.package_name,
    version: consumerManifest.package_version,
    private: true,
    type: 'module',
    description: 'First-party ADR consumer adapter for GEOX-compatible inputs; packaging grants no dispatch authority.',
    exports: consumerManifest.exports,
    files: ['src'],
    engines: { node: consumerManifest.node_engine },
    adr_consumer_artifact: {
      contract_version: consumerManifest.contract_version,
      builder_version: EXPECTED_CONSUMER_BUILDER_VERSION,
      compatibility,
      authority_claim: consumerManifest.authority_claim
    }
  };
}

function expectedPackedContents(consumerManifest, compatibility) {
  const contents = new Map();
  const packageJson = expectedPackedPackageJson(consumerManifest, compatibility);
  contents.set('package/package.json', Buffer.from(`${JSON.stringify(packageJson, null, 2)}\n`, 'utf8'));

  const dependency = consumerManifest.bundled_dependency;
  if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
    fail('CONSUMER_MANIFEST_INVALID', 'bundled_dependency is required for packed artifact closure');
  }
  const rewriteFrom = dependency.rewrite_from;
  const rewriteTo = dependency.rewrite_to;
  if (typeof rewriteFrom !== 'string' || !rewriteFrom || typeof rewriteTo !== 'string' || !rewriteTo) {
    fail('CONSUMER_MANIFEST_INVALID', 'bundled dependency rewrite mapping is invalid');
  }

  for (const filename of consumerManifest.source_files ?? []) {
    if (typeof filename !== 'string' || filename.includes('/') || !filename.endsWith('.mjs')) {
      fail('CONSUMER_MANIFEST_INVALID', `unsafe source filename ${String(filename)}`);
    }
    const raw = readFileSync(join(ADAPTER_SOURCE_DIR, filename), 'utf8');
    const artifactText = raw.split(rewriteFrom).join(rewriteTo);
    if (artifactText.includes('../../../sdks/')) {
      fail('PACKAGE_CONTENT_MISMATCH', `${filename} expected artifact content still contains a repository-internal SDK import`);
    }
    contents.set(`package/src/${filename}`, Buffer.from(artifactText, 'utf8'));
  }

  const dependencyPath = `package/${dependency.artifact_path}`;
  if (contents.has(dependencyPath)) fail('CONSUMER_MANIFEST_INVALID', `bundled dependency collides with ${dependencyPath}`);
  contents.set(dependencyPath, readFileSync(join(REPO_ROOT, dependency.source)));
  return { contents, packageJson };
}

function verifyPackedArtifactClosure(tarballPath, consumerManifest, compatibility) {
  const { contents: expectedContents, packageJson: expectedPackageJson } = expectedPackedContents(consumerManifest, compatibility);
  const expectedFiles = [...expectedContents.keys()].sort();
  const actualFiles = packedFileList(tarballPath);
  if (!exactObject(actualFiles, expectedFiles)) {
    fail('PACKAGE_FILE_SET_MISMATCH', `packed artifact file set drifted: expected ${expectedFiles.join(', ')}; got ${actualFiles.join(', ')}`);
  }

  const actualPackageJsonBytes = packedFileBytes(tarballPath, 'package/package.json');
  let actualPackageJson;
  try {
    actualPackageJson = JSON.parse(actualPackageJsonBytes.toString('utf8'));
  } catch (error) {
    fail('PACKAGE_TARBALL_INVALID', `packed package.json is invalid JSON: ${error?.message ?? error}`);
  }
  if (!exactObject(actualPackageJson, expectedPackageJson)) {
    fail('PACKAGE_METADATA_MISMATCH', 'packed package.json field set or values drifted from the governed artifact manifest');
  }

  const contentHashes = {};
  for (const path of expectedFiles) {
    const actualBytes = path === 'package/package.json' ? actualPackageJsonBytes : packedFileBytes(tarballPath, path);
    const expectedBytes = expectedContents.get(path);
    if (!actualBytes.equals(expectedBytes)) {
      fail('PACKAGE_CONTENT_MISMATCH', `${path} bytes do not match the governed packed artifact closure`);
    }
    contentHashes[path] = sha256(actualBytes);
  }

  return Object.freeze({
    contractVersion: PACKED_ARTIFACT_CLOSURE_VERSION,
    fileCount: actualFiles.length,
    fileSetHash: sha256Json(actualFiles),
    contentClosureHash: sha256Json(contentHashes),
    contentHashes: Object.freeze(contentHashes),
    packageJson: Object.freeze(actualPackageJson)
  });
}

export function verifyGeoxConsumerReleaseBundle({ bundleDir, expectedSourceCommit }) {
  const root = resolve(bundleDir);
  if (!COMMIT_RE.test(expectedSourceCommit ?? '')) fail('SOURCE_COMMIT_INVALID', 'expectedSourceCommit must be exact lowercase 40-hex');

  const releaseManifest = parseJson(RELEASE_MANIFEST_PATH, 'RELEASE_MANIFEST_INVALID');
  const consumerManifest = parseJson(CONSUMER_MANIFEST_PATH, 'CONSUMER_MANIFEST_INVALID');
  const compatibility = expectedCompatibility(consumerManifest);
  const consumerManifestBytes = readFileSync(CONSUMER_MANIFEST_PATH);
  const releaseManifestBytes = readFileSync(RELEASE_MANIFEST_PATH);
  const files = readdirSync(root).sort();
  const tarballs = files.filter((name) => name.endsWith('.tgz'));
  if (tarballs.length !== 1 || files.length !== 3 || !files.includes('RELEASE-PROVENANCE.json') || !files.includes('SHA256SUMS')) {
    fail('BUNDLE_FILE_SET_INVALID', `release bundle must contain exactly one tgz, RELEASE-PROVENANCE.json and SHA256SUMS; got ${files.join(', ')}`);
  }

  const packageFilename = tarballs[0];
  const packagePath = join(root, packageFilename);
  const provenancePath = join(root, 'RELEASE-PROVENANCE.json');
  const checksumsPath = join(root, 'SHA256SUMS');
  const checksums = parseChecksums(checksumsPath);
  if (checksums.size !== 2 || !checksums.has(packageFilename) || !checksums.has('RELEASE-PROVENANCE.json')) {
    fail('CHECKSUM_MANIFEST_INVALID', 'SHA256SUMS must cover exactly the package tarball and provenance');
  }

  for (const filename of [packageFilename, 'RELEASE-PROVENANCE.json']) {
    const actual = sha256(readFileSync(join(root, filename))).slice('sha256:'.length);
    if (checksums.get(filename) !== actual) fail('CHECKSUM_MISMATCH', `${filename} does not match SHA256SUMS`);
  }

  const provenanceBytes = readFileSync(provenancePath);
  const provenance = parseJson(provenancePath, 'PROVENANCE_INVALID');
  if (provenanceBytes.toString('utf8') !== canonicalJson(provenance)) {
    fail('PROVENANCE_NOT_CANONICAL', 'RELEASE-PROVENANCE.json must use canonical deterministic JSON');
  }
  exactKeys(provenance, [
    'contract_version', 'bundle_builder_version', 'bundle_name', 'release_status', 'source', 'package',
    'consumer_artifact', 'authority_ceiling', 'prohibited_publication_actions', 'authority_claim'
  ], 'PROVENANCE_FIELD_SET_INVALID', 'provenance');

  if (provenance.contract_version !== releaseManifest.contract_version) fail('PROVENANCE_CONTRACT_MISMATCH', 'release bundle contract drift');
  if (provenance.bundle_builder_version !== EXPECTED_BUNDLE_BUILDER_VERSION) fail('BUILDER_VERSION_MISMATCH', 'release bundle builder version drift');
  if (provenance.bundle_name !== releaseManifest.bundle_name || provenance.release_status !== releaseManifest.release_status) {
    fail('RELEASE_STATUS_MISMATCH', 'bundle identity or release status drift');
  }

  const expectedSource = {
    repository: releaseManifest.source_repository,
    commit_sha: expectedSourceCommit,
    consumer_artifact_manifest: {
      path: releaseManifest.consumer_artifact_manifest,
      sha256: sha256(consumerManifestBytes)
    },
    release_bundle_manifest: {
      path: 'adapters/geox/release-bundle.manifest.json',
      sha256: sha256(releaseManifestBytes)
    }
  };
  if (!exactObject(provenance.source, expectedSource)) {
    if (provenance.source?.commit_sha !== expectedSourceCommit) fail('SOURCE_COMMIT_MISMATCH', 'bundle source commit does not match expected exact head');
    fail('SOURCE_MANIFEST_HASH_MISMATCH', 'source repository/path/manifest identity drift');
  }

  const packageHash = sha256(readFileSync(packagePath));
  const expectedPackage = {
    name: releaseManifest.package_name,
    version: releaseManifest.package_version,
    private: true,
    tarball_filename: packageFilename,
    tarball_sha256: packageHash,
    package_size: statSync(packagePath).size
  };
  if (!exactObject(provenance.package, expectedPackage)) fail('PACKAGE_METADATA_MISMATCH', 'provenance package metadata does not match bundle bytes');

  const packedArtifactClosure = verifyPackedArtifactClosure(packagePath, consumerManifest, compatibility);
  const packed = packedArtifactClosure.packageJson;
  if (!exactObject(packed.adr_consumer_artifact?.compatibility, compatibility)) {
    fail('PACKAGE_COMPATIBILITY_MISMATCH', 'packed package compatibility metadata does not match exact API/registry envelope');
  }
  if (packed.adr_consumer_artifact?.authority_claim !== consumerManifest.authority_claim) {
    fail('PACKAGE_AUTHORITY_BOUNDARY_MISMATCH', 'packed consumer artifact authority claim drift');
  }

  const expectedConsumerArtifact = {
    builder_version: EXPECTED_CONSUMER_BUILDER_VERSION,
    manifest_contract_version: consumerManifest.contract_version,
    source_hashes: expectedSourceHashes(consumerManifest),
    bundled_dependency: expectedBundledDependency(consumerManifest),
    compatibility,
    authority_claim: consumerManifest.authority_claim
  };
  if (!exactObject(provenance.consumer_artifact, expectedConsumerArtifact)) {
    if (provenance.consumer_artifact?.builder_version !== EXPECTED_CONSUMER_BUILDER_VERSION) fail('BUILDER_VERSION_MISMATCH', 'consumer artifact builder version drift');
    if (!exactObject(provenance.consumer_artifact?.compatibility, compatibility)) {
      fail('PACKAGE_COMPATIBILITY_MISMATCH', 'release provenance compatibility metadata drifted from exact API/registry envelope');
    }
    fail('SOURCE_CONTENT_HASH_MISMATCH', 'adapter source or bundled dependency provenance does not match exact repository bytes');
  }

  if (!exactObject(provenance.authority_ceiling, releaseManifest.authority_ceiling)) {
    fail('AUTHORITY_CEILING_MISMATCH', 'release bundle authority ceiling was changed or promoted');
  }
  if (!exactObject(provenance.prohibited_publication_actions, releaseManifest.prohibited_publication_actions)) {
    fail('PUBLICATION_BOUNDARY_MISMATCH', 'release bundle publication non-actions drift');
  }
  if (provenance.authority_claim !== releaseManifest.authority_claim) fail('AUTHORITY_CEILING_MISMATCH', 'release bundle authority claim drift');

  const evidenceHash = sha256(Buffer.from(`${packageHash}\n${sha256(provenanceBytes)}\n${sha256(readFileSync(checksumsPath))}\n`, 'utf8'));
  return Object.freeze({
    verifierVersion: GEOX_CONSUMER_RELEASE_BUNDLE_VERIFIER_VERSION,
    bundleContractVersion: provenance.contract_version,
    sourceCommit: provenance.source.commit_sha,
    packageName: packed.name,
    packageVersion: packed.version,
    packageTarballHash: packageHash,
    releaseStatus: provenance.release_status,
    compatibility: Object.freeze(canonical(compatibility)),
    packedArtifactClosure: Object.freeze({
      contractVersion: packedArtifactClosure.contractVersion,
      fileCount: packedArtifactClosure.fileCount,
      fileSetHash: packedArtifactClosure.fileSetHash,
      contentClosureHash: packedArtifactClosure.contentClosureHash,
      contentHashes: packedArtifactClosure.contentHashes
    }),
    evidenceHash,
    authorityClaim: provenance.authority_claim
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const result = verifyGeoxConsumerReleaseBundle({ bundleDir: process.argv[2], expectedSourceCommit: process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
}
