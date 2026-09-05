import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerArtifact } from '../../adapters/geox/scripts/build-consumer-artifact.mjs';

const BASELINE_PATH = 'adapters/geox/consumer-api-surface.v1.json';
const MANIFEST_PATH = 'adapters/geox/consumer-artifact.manifest.json';
const QUALIFIED_NODE_ENGINE = '>=20 <21 || >=24 <25';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

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

function normalizeSurface(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const output = {};
  for (const modulePath of Object.keys(value).sort()) {
    const exports = value[modulePath];
    assert.ok(Array.isArray(exports) && exports.length > 0, `${label}.${modulePath} must contain exports`);
    assert.equal(new Set(exports).size, exports.length, `${label}.${modulePath} exports must be unique`);
    for (const symbol of exports) {
      assert.equal(typeof symbol, 'string', `${label}.${modulePath} export names must be strings`);
      assert.ok(symbol.length > 0, `${label}.${modulePath} export names must be non-empty`);
    }
    output[modulePath] = [...exports].sort();
  }
  return output;
}

function surfaceDiff(expectedInput, actualInput) {
  const expected = normalizeSurface(expectedInput, 'expectedSurface');
  const actual = normalizeSurface(actualInput, 'actualSurface');
  const expectedModules = Object.keys(expected);
  const actualModules = Object.keys(actual);
  const missingModules = expectedModules.filter((modulePath) => !Object.hasOwn(actual, modulePath));
  const unexpectedModules = actualModules.filter((modulePath) => !Object.hasOwn(expected, modulePath));
  const moduleDiffs = {};
  for (const modulePath of expectedModules.filter((key) => Object.hasOwn(actual, key))) {
    const missingExports = expected[modulePath].filter((symbol) => !actual[modulePath].includes(symbol));
    const unexpectedExports = actual[modulePath].filter((symbol) => !expected[modulePath].includes(symbol));
    if (missingExports.length || unexpectedExports.length) {
      moduleDiffs[modulePath] = { missingExports, unexpectedExports };
    }
  }
  return Object.freeze({
    compatible: missingModules.length === 0
      && unexpectedModules.length === 0
      && Object.keys(moduleDiffs).length === 0,
    missingModules: Object.freeze(missingModules),
    unexpectedModules: Object.freeze(unexpectedModules),
    moduleDiffs: Object.freeze(moduleDiffs)
  });
}

function exactSourceCommit() {
  const explicit = process.env.ADR_GEOX_API_COMPAT_SOURCE_COMMIT?.trim();
  const value = explicit || run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(value, /^[0-9a-f]{40}$/, 'source commit must be an exact Git SHA');
  return value;
}

const sourceCommit = exactSourceCommit();
const baseline = readJson(BASELINE_PATH);
const manifest = readJson(MANIFEST_PATH);

assert.equal(baseline.contract_version, 'adr.geox-consumer-api-surface.v1');
assert.equal(baseline.package_name, '@adr/geox-adapter');
assert.equal(baseline.package_version, '0.1.0-development');
assert.equal(baseline.private, true);
assert.equal(baseline.node_engine, QUALIFIED_NODE_ENGINE);
assert.equal(
  baseline.change_policy,
  'EXACT_PUBLIC_MODULE_AND_EXPORT_SET_CHANGE_REQUIRES_EXPLICIT_BASELINE_UPDATE'
);
assert.equal(
  baseline.authority_claim,
  'NONE_PUBLIC_API_COMPATIBILITY_BASELINE_ONLY_NO_PUBLICATION_OR_DOMAIN_AUTHORITY'
);

const expectedSurface = normalizeSurface(baseline.modules, 'baseline.modules');
assert.equal(Object.keys(expectedSurface).length, 7, 'v1 public API baseline must contain exactly seven public module paths');
assert.equal(
  Object.values(expectedSurface).reduce((count, exports) => count + exports.length, 0),
  52,
  'v1 public API baseline must contain exactly 52 exported symbols'
);
assert.equal(sha256Json(expectedSurface), baseline.surface_hash, 'baseline surface hash must be reproducible');

assert.equal(manifest.package_name, baseline.package_name);
assert.equal(manifest.package_version, baseline.package_version);
assert.equal(manifest.private, baseline.private);
assert.equal(manifest.node_engine, baseline.node_engine);
assert.equal(manifest.compatibility?.contract_version, 'adr.geox-consumer-compatibility-envelope.v2');
assert.equal(manifest.compatibility?.runtime_environment?.node_engine, baseline.node_engine);
assert.deepEqual(
  Object.keys(manifest.exports).sort(),
  Object.keys(expectedSurface).sort(),
  'artifact manifest public subpaths must exactly match compatibility baseline'
);

const root = mkdtempSync(join(tmpdir(), 'adr-geox-api-compatibility-'));
try {
  const build = buildGeoxConsumerArtifact({ outputDir: join(root, 'producer') });
  assert.equal(build.packageName, baseline.package_name);
  assert.equal(build.packageVersion, baseline.package_version);
  assert.equal(build.authorityClaim, 'NONE_PACKAGING_ONLY_NO_NEW_ADR_OR_GEOX_AUTHORITY');

  const consumerDir = join(root, 'consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'adr-geox-api-compatibility-consumer',
    private: true,
    type: 'module'
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(consumerDir, 'api-baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');

  const install = run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', build.tarballPath
  ], {
    cwd: consumerDir,
    env: {
      ...process.env,
      NODE_PATH: '',
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false'
    }
  });
  assert.match(install.stdout, /added 1 package/);

  const installedPackage = readJson(join(consumerDir, 'node_modules', '@adr', 'geox-adapter', 'package.json'));
  assert.equal(installedPackage.name, baseline.package_name);
  assert.equal(installedPackage.version, baseline.package_version);
  assert.equal(installedPackage.private, true);
  assert.deepEqual(installedPackage.engines, { node: baseline.node_engine });
  assert.equal(installedPackage.adr_consumer_artifact?.compatibility?.contract_version, 'adr.geox-consumer-compatibility-envelope.v2');
  assert.equal(installedPackage.adr_consumer_artifact?.compatibility?.runtime_environment?.node_engine, baseline.node_engine);
  assert.deepEqual(installedPackage.exports, manifest.exports, 'installed package exports map must match source manifest exactly');

  const inspectorSource = `
import { readFileSync } from 'node:fs';
const baseline = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let networkAttempted = false;
globalThis.fetch = async () => {
  networkAttempted = true;
  throw new Error('NETWORK_FORBIDDEN_DURING_PUBLIC_API_INSPECTION');
};
const surfaces = {};
for (const modulePath of Object.keys(baseline.modules).sort()) {
  const specifier = modulePath === '.'
    ? baseline.package_name
    : baseline.package_name + modulePath.slice(1);
  const namespace = await import(specifier);
  surfaces[modulePath] = Object.keys(namespace).sort();
}
console.log(JSON.stringify({ ok: true, networkAttempted, surfaces }));
`;
  writeFileSync(join(consumerDir, 'inspect.mjs'), inspectorSource, 'utf8');

  const inspectionEnv = { ...process.env, NODE_PATH: '', npm_config_offline: 'true' };
  delete inspectionEnv.GITHUB_TOKEN;
  delete inspectionEnv.GH_TOKEN;
  const inspected = run(process.execPath, ['inspect.mjs', 'api-baseline.json'], {
    cwd: consumerDir,
    env: inspectionEnv
  });
  const inspection = JSON.parse(inspected.stdout.trim());
  assert.equal(inspection.ok, true);
  assert.equal(inspection.networkAttempted, false, 'module surface inspection must not attempt network access');

  const observedSurface = normalizeSurface(inspection.surfaces, 'installedSurface');
  const positive = surfaceDiff(expectedSurface, observedSurface);
  assert.equal(positive.compatible, true, `installed public API drifted: ${JSON.stringify(positive)}`);
  assert.equal(sha256Json(observedSurface), baseline.surface_hash, 'installed public API surface hash must equal frozen v1 baseline');

  const removedExport = structuredClone(observedSurface);
  const removedSymbol = removedExport['.'].pop();
  const removedExportProbe = surfaceDiff(expectedSurface, removedExport);
  assert.equal(removedExportProbe.compatible, false);
  assert.deepEqual(removedExportProbe.moduleDiffs['.'].missingExports, [removedSymbol]);

  const unexpectedExport = structuredClone(observedSurface);
  unexpectedExport['./decision-result-sink'].push('__unexpected_test_export__');
  const unexpectedExportProbe = surfaceDiff(expectedSurface, unexpectedExport);
  assert.equal(unexpectedExportProbe.compatible, false);
  assert.deepEqual(
    unexpectedExportProbe.moduleDiffs['./decision-result-sink'].unexpectedExports,
    ['__unexpected_test_export__']
  );

  const removedModule = structuredClone(observedSurface);
  delete removedModule['./target-identity-token'];
  const removedModuleProbe = surfaceDiff(expectedSurface, removedModule);
  assert.equal(removedModuleProbe.compatible, false);
  assert.deepEqual(removedModuleProbe.missingModules, ['./target-identity-token']);

  const unexpectedModule = structuredClone(observedSurface);
  unexpectedModule['./unexpected-test-subpath'] = ['unexpectedTestExport'];
  const unexpectedModuleProbe = surfaceDiff(expectedSurface, unexpectedModule);
  assert.equal(unexpectedModuleProbe.compatible, false);
  assert.deepEqual(unexpectedModuleProbe.unexpectedModules, ['./unexpected-test-subpath']);

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_CONSUMER_PUBLIC_API_COMPATIBILITY_V1',
    sourceCommit,
    packageName: build.packageName,
    packageVersion: build.packageVersion,
    packageTarballHash: build.tarballHash,
    privatePackage: installedPackage.private,
    nodeEngine: installedPackage.engines.node,
    compatibilityEnvelopeContractVersion: installedPackage.adr_consumer_artifact.compatibility.contract_version,
    runtimeEnvironmentBoundIntoCompatibility: true,
    publicModuleCount: Object.keys(observedSurface).length,
    publicExportSymbolCount: Object.values(observedSurface).reduce((count, exports) => count + exports.length, 0),
    publicApiSurfaceHash: sha256Json(observedSurface),
    compatibilityPolicy: baseline.change_policy,
    installedSurfaceMatchesBaseline: true,
    moduleInspectionNetworkAttempted: false,
    negativeCompatibilityProbes: {
      removedExportRejected: true,
      unexpectedExportRejected: true,
      removedSubpathRejected: true,
      unexpectedSubpathRejected: true
    },
    releaseStatusChanged: false,
    packagePublicationAuthorized: false,
    adapterRuntimeModified: false,
    adrCoreModified: false,
    genericSdkModified: false,
    domainAuthorityCreated: false,
    fieldActionabilityCreated: false,
    dispatchAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
