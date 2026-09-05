import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  listGeoxTargetCorrespondenceProfiles
} from '../src/target-correspondence-profile-registry.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '../../..');
const MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/consumer-artifact.manifest.json');
const API_SURFACE_PATH = join(REPO_ROOT, 'adapters/geox/consumer-api-surface.v1.json');
const ADAPTER_SOURCE_DIR = join(REPO_ROOT, 'adapters/geox/src');

export const GEOX_CONSUMER_ARTIFACT_BUILDER_VERSION = 'adr.geox-consumer-artifact-builder.v1';

function fail(message) {
  throw new Error(`GEOX_CONSUMER_ARTIFACT_BUILD_FAILED: ${message}`);
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

function sha256Json(value) {
  return sha256(Buffer.from(JSON.stringify(canonical(value)), 'utf8'));
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
  return value;
}

function normalizedApiSurface(modules) {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) fail('consumer API surface modules must be an object');
  return Object.fromEntries(Object.keys(modules).sort().map((modulePath) => {
    const exports = modules[modulePath];
    if (!Array.isArray(exports) || exports.length === 0) fail(`consumer API surface ${modulePath} must contain exports`);
    return [modulePath, [...exports].sort()];
  }));
}

function loadCompatibilityEnvelope(manifest) {
  const compatibility = manifest.compatibility;
  if (!compatibility || typeof compatibility !== 'object' || Array.isArray(compatibility)) {
    fail('compatibility envelope is required');
  }
  if (compatibility.contract_version !== 'adr.geox-consumer-compatibility-envelope.v2') {
    fail('unsupported consumer compatibility envelope contract');
  }
  if (compatibility.package_version !== manifest.package_version) fail('compatibility package version must match artifact package version');
  if (compatibility.change_policy !== 'EXACT_PACKAGE_API_PROFILE_AND_RUNTIME_COMPATIBILITY_REVIEW_REQUIRED') {
    fail('compatibility change policy drifted');
  }
  if (compatibility.authority_claim !== 'NONE_COMPATIBILITY_METADATA_ONLY_NO_RUNTIME_OR_PUBLICATION_AUTHORITY') {
    fail('compatibility envelope may not create runtime or publication authority');
  }

  const api = compatibility.consumer_api_surface;
  if (!api || typeof api !== 'object' || Array.isArray(api)) fail('consumer_api_surface compatibility is required');
  const apiBaseline = readJson(API_SURFACE_PATH, 'consumer API surface baseline');
  if (apiBaseline.contract_version !== 'adr.geox-consumer-api-surface.v1'
    || apiBaseline.package_name !== manifest.package_name
    || apiBaseline.package_version !== manifest.package_version
    || apiBaseline.private !== manifest.private
    || apiBaseline.node_engine !== manifest.node_engine) {
    fail('consumer API surface baseline package identity drifted');
  }
  const actualApiSurfaceHash = sha256Json(normalizedApiSurface(apiBaseline.modules));
  if (apiBaseline.surface_hash !== actualApiSurfaceHash
    || api.contract_version !== apiBaseline.contract_version
    || api.surface_hash !== actualApiSurfaceHash) {
    fail('consumer API surface compatibility hash drifted');
  }

  const registry = compatibility.target_correspondence_profile_registry;
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    fail('target correspondence profile registry compatibility is required');
  }
  const actualProfileSetHash = sha256Json(listGeoxTargetCorrespondenceProfiles());
  if (registry.registry_version !== GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION
    || registry.profile_set_hash !== actualProfileSetHash) {
    fail('target correspondence profile registry compatibility hash drifted');
  }

  const runtime = compatibility.runtime_environment;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    fail('runtime_environment compatibility is required');
  }
  if (runtime.node_engine !== manifest.node_engine) {
    fail('runtime_environment node engine must exactly match artifact node_engine');
  }

  return Object.freeze({
    contract_version: compatibility.contract_version,
    package_version: compatibility.package_version,
    consumer_api_surface: Object.freeze({
      contract_version: api.contract_version,
      surface_hash: api.surface_hash
    }),
    target_correspondence_profile_registry: Object.freeze({
      registry_version: registry.registry_version,
      profile_set_hash: registry.profile_set_hash
    }),
    runtime_environment: Object.freeze({
      node_engine: runtime.node_engine
    }),
    change_policy: compatibility.change_policy,
    authority_claim: compatibility.authority_claim
  });
}

function loadManifest() {
  const manifest = readJson(MANIFEST_PATH, 'consumer artifact manifest');
  if (manifest.contract_version !== 'adr.geox-consumer-artifact-build.v1') {
    fail('unsupported consumer artifact manifest contract');
  }
  requireText(manifest.package_name, 'package_name');
  requireText(manifest.package_version, 'package_version');
  requireText(manifest.node_engine, 'node_engine');
  if (manifest.private !== true) fail('consumer artifact must remain private until release authority explicitly changes it');
  if (!Array.isArray(manifest.source_files) || manifest.source_files.length === 0) fail('source_files must be non-empty');
  if (!manifest.exports || typeof manifest.exports !== 'object' || Array.isArray(manifest.exports)) fail('exports must be an object');
  const dependency = manifest.bundled_dependency;
  if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) fail('bundled_dependency is required');
  for (const key of ['source', 'artifact_path', 'rewrite_from', 'rewrite_to']) requireText(dependency[key], `bundled_dependency.${key}`);
  return manifest;
}

function packageJsonFromManifest(manifest, compatibility) {
  return {
    name: manifest.package_name,
    version: manifest.package_version,
    private: true,
    type: 'module',
    description: 'First-party ADR consumer adapter for GEOX-compatible inputs; packaging grants no dispatch authority.',
    exports: manifest.exports,
    files: ['src'],
    engines: { node: manifest.node_engine },
    adr_consumer_artifact: {
      contract_version: manifest.contract_version,
      builder_version: GEOX_CONSUMER_ARTIFACT_BUILDER_VERSION,
      compatibility,
      authority_claim: manifest.authority_claim
    }
  };
}

function copyAdapterSources({ manifest, stagingRoot }) {
  const rewriteFrom = manifest.bundled_dependency.rewrite_from;
  const rewriteTo = manifest.bundled_dependency.rewrite_to;
  let rewriteCount = 0;
  const sourceHashes = {};

  for (const filename of manifest.source_files) {
    if (typeof filename !== 'string' || filename.includes('/') || !filename.endsWith('.mjs')) {
      fail(`unsafe source filename ${String(filename)}`);
    }
    const sourcePath = join(ADAPTER_SOURCE_DIR, filename);
    const sourceBytes = readFileSync(sourcePath);
    sourceHashes[`adapters/geox/src/${filename}`] = sha256(sourceBytes);
    const sourceText = sourceBytes.toString('utf8');
    const occurrences = sourceText.split(rewriteFrom).length - 1;
    rewriteCount += occurrences;
    const artifactText = sourceText.split(rewriteFrom).join(rewriteTo);
    if (artifactText.includes('../../../sdks/')) {
      fail(`${filename} still contains a repository-internal SDK import after rewrite`);
    }
    writeFileSync(join(stagingRoot, 'src', filename), artifactText, 'utf8');
  }

  if (rewriteCount < 1) fail('expected repository-internal SDK imports were not found');
  return { rewriteCount, sourceHashes };
}

function copyBundledDependency({ manifest, stagingRoot }) {
  const sourcePath = join(REPO_ROOT, manifest.bundled_dependency.source);
  const bytes = readFileSync(sourcePath);
  const artifactPath = join(stagingRoot, manifest.bundled_dependency.artifact_path);
  if (!resolve(artifactPath).startsWith(`${resolve(stagingRoot)}/`)) fail('bundled dependency artifact path escapes staging root');
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, bytes);
  return {
    sourcePath: manifest.bundled_dependency.source,
    artifactPath: manifest.bundled_dependency.artifact_path,
    contentHash: sha256(bytes)
  };
}

export function buildGeoxConsumerArtifact({ outputDir }) {
  const targetDir = resolve(requireText(outputDir, 'outputDir'));
  const manifest = loadManifest();
  const compatibility = loadCompatibilityEnvelope(manifest);
  const stagingRoot = join(targetDir, 'package-root');
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(join(stagingRoot, 'src'), { recursive: true });

  const copied = copyAdapterSources({ manifest, stagingRoot });
  const bundledDependency = copyBundledDependency({ manifest, stagingRoot });
  const packageJson = packageJsonFromManifest(manifest, compatibility);
  writeFileSync(join(stagingRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  const packDestination = join(targetDir, 'packed');
  mkdirSync(packDestination, { recursive: true });
  const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', packDestination], {
    cwd: stagingRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false'
    }
  });
  if (packed.status !== 0) {
    fail(`npm pack failed: ${(packed.stderr || packed.stdout || '').trim()}`);
  }

  let packResult;
  try {
    [packResult] = JSON.parse(packed.stdout);
  } catch (error) {
    fail(`npm pack did not return JSON: ${error?.message ?? error}`);
  }
  const tarballPath = join(packDestination, packResult.filename);
  const tarballBytes = readFileSync(tarballPath);

  return Object.freeze({
    builderVersion: GEOX_CONSUMER_ARTIFACT_BUILDER_VERSION,
    manifestContractVersion: manifest.contract_version,
    packageName: manifest.package_name,
    packageVersion: manifest.package_version,
    tarballPath,
    tarballHash: sha256(tarballBytes),
    packageSize: packResult.size,
    unpackedSize: packResult.unpackedSize,
    fileCount: Array.isArray(packResult.files) ? packResult.files.length : null,
    rewriteCount: copied.rewriteCount,
    sourceHashes: Object.freeze(copied.sourceHashes),
    bundledDependency: Object.freeze(bundledDependency),
    compatibility,
    authorityClaim: manifest.authority_claim
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const outputDir = process.argv[2];
  const result = buildGeoxConsumerArtifact({ outputDir });
  console.log(JSON.stringify(result, null, 2));
}
