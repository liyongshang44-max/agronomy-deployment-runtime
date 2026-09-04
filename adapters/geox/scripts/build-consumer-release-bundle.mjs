import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildGeoxConsumerArtifact } from './build-consumer-artifact.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '../../..');
const RELEASE_MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/release-bundle.manifest.json');
const CONSUMER_MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/consumer-artifact.manifest.json');
const COMMIT_RE = /^[0-9a-f]{40}$/;

export const GEOX_CONSUMER_RELEASE_BUNDLE_BUILDER_VERSION = 'adr.geox-consumer-release-bundle-builder.v1';

function fail(message) {
  throw new Error(`GEOX_CONSUMER_RELEASE_BUNDLE_BUILD_FAILED: ${message}`);
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

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is unreadable: ${error?.message ?? error}`);
  }
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${name} must be non-empty text`);
  return value.trim();
}

function loadReleaseManifest() {
  const manifest = readJson(RELEASE_MANIFEST_PATH, 'release bundle manifest');
  if (manifest.contract_version !== 'adr.geox-consumer-release-bundle-build.v1') fail('unsupported release bundle manifest contract');
  for (const key of ['bundle_name', 'package_name', 'package_version', 'source_repository', 'consumer_artifact_manifest', 'release_status', 'authority_claim']) {
    requireText(manifest[key], key);
  }
  if (!manifest.authority_ceiling || typeof manifest.authority_ceiling !== 'object' || Array.isArray(manifest.authority_ceiling)) {
    fail('authority_ceiling must be an object');
  }
  if (!Array.isArray(manifest.prohibited_publication_actions) || manifest.prohibited_publication_actions.length !== 3) {
    fail('prohibited_publication_actions must contain the three frozen publication non-actions');
  }
  return manifest;
}

function exactSourceCommit(value) {
  const commit = requireText(value, 'sourceCommit');
  if (!COMMIT_RE.test(commit)) fail('sourceCommit must be an exact lowercase 40-hex Git commit SHA');
  return commit;
}

export function buildGeoxConsumerReleaseBundle({ outputDir, sourceCommit }) {
  const targetDir = resolve(requireText(outputDir, 'outputDir'));
  const commit = exactSourceCommit(sourceCommit);
  const releaseManifest = loadReleaseManifest();
  const consumerManifestBytes = readFileSync(CONSUMER_MANIFEST_PATH);
  const releaseManifestBytes = readFileSync(RELEASE_MANIFEST_PATH);
  const consumerManifest = JSON.parse(consumerManifestBytes.toString('utf8'));

  if (consumerManifest.package_name !== releaseManifest.package_name || consumerManifest.package_version !== releaseManifest.package_version) {
    fail('release bundle package identity must exactly match the consumer artifact manifest');
  }
  if (consumerManifest.private !== true) fail('release bundle may only contain the private qualified consumer artifact');

  rmSync(targetDir, { recursive: true, force: true });
  const workDir = join(targetDir, 'consumer-build');
  const bundleDir = join(targetDir, 'bundle');
  mkdirSync(bundleDir, { recursive: true });

  const artifact = buildGeoxConsumerArtifact({ outputDir: workDir });
  if (artifact.packageName !== releaseManifest.package_name || artifact.packageVersion !== releaseManifest.package_version) {
    fail('consumer artifact build identity drifted from release bundle manifest');
  }

  const packageFilename = basename(artifact.tarballPath);
  const packageTarballPath = join(bundleDir, packageFilename);
  copyFileSync(artifact.tarballPath, packageTarballPath);

  const provenance = {
    contract_version: releaseManifest.contract_version,
    bundle_builder_version: GEOX_CONSUMER_RELEASE_BUNDLE_BUILDER_VERSION,
    bundle_name: releaseManifest.bundle_name,
    release_status: releaseManifest.release_status,
    source: {
      repository: releaseManifest.source_repository,
      commit_sha: commit,
      consumer_artifact_manifest: {
        path: releaseManifest.consumer_artifact_manifest,
        sha256: sha256(consumerManifestBytes)
      },
      release_bundle_manifest: {
        path: 'adapters/geox/release-bundle.manifest.json',
        sha256: sha256(releaseManifestBytes)
      }
    },
    package: {
      name: artifact.packageName,
      version: artifact.packageVersion,
      private: true,
      tarball_filename: packageFilename,
      tarball_sha256: artifact.tarballHash,
      package_size: artifact.packageSize,
      unpacked_size: artifact.unpackedSize,
      file_count: artifact.fileCount
    },
    consumer_artifact: {
      builder_version: artifact.builderVersion,
      manifest_contract_version: artifact.manifestContractVersion,
      source_hashes: artifact.sourceHashes,
      bundled_dependency: artifact.bundledDependency,
      authority_claim: artifact.authorityClaim
    },
    authority_ceiling: releaseManifest.authority_ceiling,
    prohibited_publication_actions: releaseManifest.prohibited_publication_actions,
    authority_claim: releaseManifest.authority_claim
  };

  const provenancePath = join(bundleDir, 'RELEASE-PROVENANCE.json');
  const provenanceBytes = Buffer.from(canonicalJson(provenance), 'utf8');
  writeFileSync(provenancePath, provenanceBytes);
  const provenanceHash = sha256(provenanceBytes);

  const checksums = [
    [packageFilename, artifact.tarballHash],
    ['RELEASE-PROVENANCE.json', provenanceHash]
  ].sort(([left], [right]) => left.localeCompare(right));
  const checksumsText = `${checksums.map(([filename, hash]) => `${hash.slice('sha256:'.length)}  ${filename}`).join('\n')}\n`;
  const checksumsPath = join(bundleDir, 'SHA256SUMS');
  writeFileSync(checksumsPath, checksumsText, 'utf8');

  rmSync(workDir, { recursive: true, force: true });

  return Object.freeze({
    builderVersion: GEOX_CONSUMER_RELEASE_BUNDLE_BUILDER_VERSION,
    bundleContractVersion: releaseManifest.contract_version,
    bundleName: releaseManifest.bundle_name,
    releaseStatus: releaseManifest.release_status,
    sourceRepository: releaseManifest.source_repository,
    sourceCommit: commit,
    packageName: artifact.packageName,
    packageVersion: artifact.packageVersion,
    packageTarballPath,
    packageTarballHash: artifact.tarballHash,
    provenancePath,
    provenanceHash,
    checksumsPath,
    bundleDir,
    authorityCeiling: Object.freeze({ ...releaseManifest.authority_ceiling }),
    prohibitedPublicationActions: Object.freeze([...releaseManifest.prohibited_publication_actions]),
    authorityClaim: releaseManifest.authority_claim
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const result = buildGeoxConsumerReleaseBundle({ outputDir: process.argv[2], sourceCommit: process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
}
