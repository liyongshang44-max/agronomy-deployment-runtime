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

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '../../..');
const MANIFEST_PATH = join(REPO_ROOT, 'adapters/geox/consumer-artifact.manifest.json');
const ADAPTER_SOURCE_DIR = join(REPO_ROOT, 'adapters/geox/src');

export const GEOX_CONSUMER_ARTIFACT_BUILDER_VERSION = 'adr.geox-consumer-artifact-builder.v1';

function fail(message) {
  throw new Error(`GEOX_CONSUMER_ARTIFACT_BUILD_FAILED: ${message}`);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
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

function packageJsonFromManifest(manifest) {
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
  const stagingRoot = join(targetDir, 'package-root');
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(join(stagingRoot, 'src'), { recursive: true });

  const copied = copyAdapterSources({ manifest, stagingRoot });
  const bundledDependency = copyBundledDependency({ manifest, stagingRoot });
  const packageJson = packageJsonFromManifest(manifest);
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
    authorityClaim: manifest.authority_claim
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  const outputDir = process.argv[2];
  const result = buildGeoxConsumerArtifact({ outputDir });
  console.log(JSON.stringify(result, null, 2));
}
