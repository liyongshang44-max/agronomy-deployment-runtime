import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const RIGHTS_ROOT_PREFIX = 'packages/rights-authority/';
const ALLOWED_RAW_IMPORTER = 'packages/rights-authority/src/hardening.mjs';
const SOURCE_ROOTS = ['packages', 'apps', 'adapters', 'sdk', 'scripts', 'acceptance'];
const EXTENSIONS = new Set(['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx']);
const rawPackagePath = ['rights-authority', 'src', 'authority.mjs'].join('/');
const rawRelativeSingle = `from '${['.', 'authority.mjs'].join('/')}'`;
const rawRelativeDouble = `from "${['.', 'authority.mjs'].join('/')}"`;

function extension(path) {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot) : '';
}

function walk(dir, files = []) {
  if (!statSync(dir).isDirectory()) return files;
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (EXTENSIONS.has(extension(path))) files.push(path);
  }
  return files;
}

const violations = [];
for (const rootName of SOURCE_ROOTS) {
  const dir = resolve(ROOT, rootName);
  let files = [];
  try { files = walk(dir); } catch { continue; }
  for (const path of files) {
    const repoPath = relative(ROOT, path).replaceAll('\\', '/');
    if (repoPath === ALLOWED_RAW_IMPORTER) continue;
    const text = readFileSync(path, 'utf8');
    const explicitRightsRawPath = text.includes(rawPackagePath);
    const rightsLocalRawImport = repoPath.startsWith(RIGHTS_ROOT_PREFIX)
      && (text.includes(rawRelativeSingle) || text.includes(rawRelativeDouble));
    if (explicitRightsRawPath || rightsLocalRawImport) violations.push(repoPath);
  }
}

assert.deepEqual(
  violations,
  [],
  `raw Rights authority implementation is bypassable; import only packages/rights-authority/src/index.mjs. Violations: ${violations.join(', ')}`
);

console.log(JSON.stringify({
  hardenedPublicSurface: 'packages/rights-authority/src/index.mjs',
  allowedRawImporter: ALLOWED_RAW_IMPORTER,
  violations: 0,
  status: 'PASS'
}, null, 2));
