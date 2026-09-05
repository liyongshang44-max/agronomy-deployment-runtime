import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerArtifact } from '../../adapters/geox/scripts/build-consumer-artifact.mjs';
import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  listGeoxTargetCorrespondenceProfiles
} from '../../adapters/geox/src/target-correspondence-profile-registry.mjs';

const QUALIFIED_NODE_ENGINE = '>=20 <21 || >=24 <25';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex')}`;
}

function normalizedApiSurface(modules) {
  return Object.fromEntries(Object.keys(modules).sort().map((modulePath) => [modulePath, [...modules[modulePath]].sort()]));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function exactSourceCommit() {
  const explicit = process.env.ADR_RELEASE_SOURCE_COMMIT?.trim();
  const value = explicit || run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(value, /^[0-9a-f]{40}$/);
  return value;
}

function packedPackageJson(tarballPath) {
  const extracted = run('tar', ['-xOf', tarballPath, 'package/package.json']);
  return JSON.parse(extracted.stdout);
}

const manifest = JSON.parse(readFileSync('adapters/geox/consumer-artifact.manifest.json', 'utf8'));
const apiBaseline = JSON.parse(readFileSync('adapters/geox/consumer-api-surface.v1.json', 'utf8'));
const sourceCommit = exactSourceCommit();
const apiSurfaceHash = sha256Json(normalizedApiSurface(apiBaseline.modules));
const profileSetHash = sha256Json(listGeoxTargetCorrespondenceProfiles());

const expectedCompatibility = {
  contract_version: 'adr.geox-consumer-compatibility-envelope.v2',
  package_version: '0.1.0-development',
  consumer_api_surface: {
    contract_version: 'adr.geox-consumer-api-surface.v1',
    surface_hash: apiSurfaceHash
  },
  target_correspondence_profile_registry: {
    registry_version: GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
    profile_set_hash: profileSetHash
  },
  runtime_environment: {
    node_engine: QUALIFIED_NODE_ENGINE
  },
  change_policy: 'EXACT_PACKAGE_API_PROFILE_AND_RUNTIME_COMPATIBILITY_REVIEW_REQUIRED',
  authority_claim: 'NONE_COMPATIBILITY_METADATA_ONLY_NO_RUNTIME_OR_PUBLICATION_AUTHORITY'
};

assert.equal(apiBaseline.surface_hash, 'sha256:5e456b5604ed474b667663e39aec558d59df76da1b9fb8d6796f54779e01003c');
assert.equal(apiSurfaceHash, apiBaseline.surface_hash);
assert.equal(apiBaseline.node_engine, QUALIFIED_NODE_ENGINE);
assert.equal(manifest.node_engine, QUALIFIED_NODE_ENGINE);
assert.equal(GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION, 'adr.geox-target-correspondence-profile-registry.v1');
assert.equal(profileSetHash, 'sha256:5f400e4cfd3bcfb72286a3a42bed7940cbb2b5d7450837ae4cebeff394cd55c4');
assert.deepEqual(manifest.compatibility, expectedCompatibility);
assert.equal(listGeoxTargetCorrespondenceProfiles().length, 3);

const root = mkdtempSync(join(tmpdir(), 'adr-geox-compatibility-envelope-'));
try {
  const artifact = buildGeoxConsumerArtifact({ outputDir: join(root, 'artifact') });
  assert.deepEqual(artifact.compatibility, expectedCompatibility);
  const packed = packedPackageJson(artifact.tarballPath);
  assert.deepEqual(packed.adr_consumer_artifact.compatibility, expectedCompatibility);
  assert.equal(packed.engines.node, QUALIFIED_NODE_ENGINE);
  assert.equal(packed.private, true);
  assert.equal(packed.version, '0.1.0-development');

  const release = buildGeoxConsumerReleaseBundle({ outputDir: join(root, 'release'), sourceCommit });
  assert.deepEqual(release.compatibility, expectedCompatibility);
  const provenance = JSON.parse(readFileSync(release.provenancePath, 'utf8'));
  assert.deepEqual(provenance.consumer_artifact.compatibility, expectedCompatibility);

  const verified = verifyGeoxConsumerReleaseBundle({
    bundleDir: release.bundleDir,
    expectedSourceCommit: sourceCommit
  });
  assert.deepEqual(verified.compatibility, expectedCompatibility);
  assert.equal(verified.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_CONSUMER_COMPATIBILITY_ENVELOPE_V2',
    sourceCommit,
    packageName: artifact.packageName,
    packageVersion: artifact.packageVersion,
    packagePrivate: true,
    compatibilityContractVersion: expectedCompatibility.contract_version,
    consumerApiSurfaceContractVersion: expectedCompatibility.consumer_api_surface.contract_version,
    consumerApiSurfaceHash: apiSurfaceHash,
    targetCorrespondenceProfileRegistryVersion: expectedCompatibility.target_correspondence_profile_registry.registry_version,
    targetCorrespondenceProfileSetHash: profileSetHash,
    runtimeNodeEngine: expectedCompatibility.runtime_environment.node_engine,
    qualifiedRuntimeMajors: [20, 24],
    unqualifiedRuntimeMajors: [21, 22, 23],
    qualifiedProfileCount: 3,
    packageMetadataCarriesCompatibility: true,
    releaseProvenanceCarriesCompatibility: true,
    verifierIndependentlyRecomputedCompatibility: true,
    runtimeEnvironmentBoundIntoCompatibility: true,
    semverCompatibilityClaimed: false,
    releaseStatusChanged: false,
    packagePublicationAuthorized: false,
    runtimeActivationAuthorized: false,
    fieldActionabilityCreated: false,
    approvalAuthorityCreated: false,
    dispatchAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
