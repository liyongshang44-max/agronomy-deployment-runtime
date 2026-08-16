import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const IMPLEMENTATION_ROOTS = ['packages', 'apps', 'adapters', 'sdks'];
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const INTERNAL_PACKAGE_PREFIXES = ['@adr/', '@agronomy-runtime/', '@agronomy-deployment-runtime/'];
const ALLOWED_EXTERNAL_LAYER_INTERNAL_IMPORTS = new Set([
  '@adr/contracts',
  '@agronomy-runtime/contracts',
  '@agronomy-deployment-runtime/contracts'
]);

function violation(code, file, detail) {
  return { code, file: file.replaceAll('\\', '/'), detail };
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  if (!(await exists(root))) return [];
  const out = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walkFiles(target)));
    else if (entry.isFile()) out.push(target);
  }
  return out;
}

function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s*['"]([^'"]+)['"]/gm
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

function relativeTarget(root, file, specifier) {
  if (!specifier.startsWith('.')) return null;
  const absolute = path.resolve(path.dirname(file), specifier);
  return path.relative(root, absolute).replaceAll('\\', '/');
}

function isCoreFile(relative) {
  return relative.startsWith('packages/') || relative.startsWith('apps/');
}

function isPackageCoreFile(relative) {
  return relative.startsWith('packages/');
}

function isAdapterFile(relative) {
  return relative.startsWith('adapters/');
}

function isSdkFile(relative) {
  return relative.startsWith('sdks/');
}

function isInternalPackage(specifier) {
  return INTERNAL_PACKAGE_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

function isAllowedExternalLayerInternalImport(specifier) {
  return ALLOWED_EXTERNAL_LAYER_INTERNAL_IMPORTS.has(specifier);
}

function scanCoreSource(root, file, relative, text) {
  const violations = [];
  const lower = text.toLowerCase();
  const specs = importSpecifiers(text);

  for (const specifier of specs) {
    const normalized = specifier.toLowerCase();
    if (normalized.includes('geox')) {
      violations.push(violation('CORE_GEOX_DEPENDENCY', relative, `forbidden GEOX import: ${specifier}`));
    }
    if (normalized.includes('/adapters/') || normalized.startsWith('adapters/')) {
      violations.push(violation('CORE_ADAPTER_IMPORT', relative, `core import reaches adapters: ${specifier}`));
    }
    const target = relativeTarget(root, file, specifier);
    if (target && (target === 'adapters' || target.startsWith('adapters/'))) {
      violations.push(violation('CORE_ADAPTER_IMPORT', relative, `relative core import reaches adapters: ${specifier}`));
    }
  }

  const forbiddenSemanticPatterns = [
    ['CORE_GEOX_SEMANTIC_DEPENDENCY', /\bgeox\b/i, 'GEOX semantic token'],
    ['CORE_MCFT_SEMANTIC_DEPENDENCY', /\bmcft\b/i, 'MCFT semantic token'],
    ['CORE_KBS_SEMANTIC_DEPENDENCY', /\bkbs\b/i, 'KBS semantic token'],
    ['CORE_T3R1_SEMANTIC_DEPENDENCY', /\bt3r1\b/i, 'T3R1 semantic token'],
    ['CORE_CAP_SEMANTIC_DEPENDENCY', /\bcap[-_ ]?\d{1,3}\b/i, 'CAP-number semantic token']
  ];
  for (const [code, pattern, detail] of forbiddenSemanticPatterns) {
    if (pattern.test(text)) violations.push(violation(code, relative, detail));
  }

  if (/\bgeox[._][a-z0-9_]+\b/i.test(text)) {
    violations.push(violation('CORE_GEOX_SCHEMA_DEPENDENCY', relative, 'GEOX schema/table-style semantic reference'));
  }

  if (isPackageCoreFile(relative)) {
    const networkPatterns = [
      /\bfetch\s*\(/,
      /\baxios\s*\./,
      /\bhttps?\s*\.\s*request\s*\(/,
      /\bhttps?\s*\.\s*get\s*\(/,
      /\bfrom\s*['"]node:https?['"]/,
      /\bfrom\s*['"]undici['"]/,
      /\brequire\s*\(\s*['"]node:https?['"]\s*\)/
    ];
    if (networkPatterns.some((pattern) => pattern.test(text))) {
      violations.push(violation('CORE_DIRECT_EXTERNAL_NETWORK', relative, 'packages/* core may not call external providers directly'));
    }
  }

  void lower;
  return violations;
}

function scanExternalLayerSource(root, file, relative, text, layer) {
  const violations = [];
  const code = layer === 'SDK' ? 'SDK_INTERNAL_AUTHORITY_IMPORT' : 'ADAPTER_INTERNAL_AUTHORITY_IMPORT';
  for (const specifier of importSpecifiers(text)) {
    if (isInternalPackage(specifier) && !isAllowedExternalLayerInternalImport(specifier)) {
      violations.push(violation(code, relative, `${layer.toLowerCase()} may only import ADR public contracts internally: ${specifier}`));
    }
    const target = relativeTarget(root, file, specifier);
    if (target && target.startsWith('packages/') && !target.startsWith('packages/contracts')) {
      violations.push(violation(code, relative, `relative ${layer.toLowerCase()} import reaches non-contract package: ${specifier}`));
    }
  }
  return violations;
}

function scanPackageManifest(root, file, relative, json) {
  const violations = [];
  const allDeps = {
    ...(json.dependencies ?? {}),
    ...(json.devDependencies ?? {}),
    ...(json.peerDependencies ?? {}),
    ...(json.optionalDependencies ?? {})
  };
  const coreManifest = relative.startsWith('packages/') || relative.startsWith('apps/') || relative === 'package.json';
  const adapterManifest = relative.startsWith('adapters/');
  const sdkManifest = relative.startsWith('sdks/');

  for (const [name, value] of Object.entries(allDeps)) {
    const dep = `${name} ${value}`.toLowerCase();
    if (dep.includes('geox')) {
      violations.push(violation('GEOX_MANIFEST_DEPENDENCY', relative, `forbidden GEOX dependency: ${name}`));
    }
    if (coreManifest && (dep.includes('adapters/geox') || dep.includes('/adapters/'))) {
      violations.push(violation('CORE_ADAPTER_MANIFEST_DEPENDENCY', relative, `core manifest depends on adapter: ${name} ${value}`));
    }
    if (adapterManifest && isInternalPackage(name) && !isAllowedExternalLayerInternalImport(name)) {
      violations.push(violation('ADAPTER_INTERNAL_AUTHORITY_DEPENDENCY', relative, `adapter manifest depends on non-contract ADR package: ${name}`));
    }
    if (sdkManifest && isInternalPackage(name) && !isAllowedExternalLayerInternalImport(name)) {
      violations.push(violation('SDK_INTERNAL_AUTHORITY_DEPENDENCY', relative, `SDK manifest depends on non-contract ADR package: ${name}`));
    }
  }

  if (relative === 'package.json') {
    for (const [scriptName, scriptValue] of Object.entries(json.scripts ?? {})) {
      const value = String(scriptValue).toLowerCase();
      if (value.includes('adapters/geox') || value.includes('@geox/')) {
        violations.push(violation('ROOT_SCRIPT_GEOX_COUPLING', relative, `root script ${scriptName} couples standalone build/test to GEOX`));
      }
    }
  }

  void root;
  void file;
  return violations;
}

export async function checkRepository(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const violations = [];

  const manifestCandidates = [path.join(root, 'package.json')];
  for (const implementationRoot of IMPLEMENTATION_ROOTS) {
    manifestCandidates.push(...(await walkFiles(path.join(root, implementationRoot))).filter((file) => path.basename(file) === 'package.json'));
  }

  for (const manifest of [...new Set(manifestCandidates)]) {
    if (!(await exists(manifest))) continue;
    const relative = path.relative(root, manifest).replaceAll('\\', '/');
    try {
      const parsed = JSON.parse(await readFile(manifest, 'utf8'));
      violations.push(...scanPackageManifest(root, manifest, relative, parsed));
    } catch (error) {
      violations.push(violation('INVALID_PACKAGE_JSON', relative, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const implementationRoot of IMPLEMENTATION_ROOTS) {
    for (const file of await walkFiles(path.join(root, implementationRoot))) {
      if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
      const relative = path.relative(root, file).replaceAll('\\', '/');
      const text = await readFile(file, 'utf8');
      if (isCoreFile(relative)) violations.push(...scanCoreSource(root, file, relative, text));
      if (isAdapterFile(relative)) violations.push(...scanExternalLayerSource(root, file, relative, text, 'ADAPTER'));
      if (isSdkFile(relative)) violations.push(...scanExternalLayerSource(root, file, relative, text, 'SDK'));
    }
  }

  return { ok: violations.length === 0, violations };
}

async function cli() {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const result = await checkRepository(root);
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, root, violations: [] }, null, 2));
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) await cli();
