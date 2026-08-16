import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { checkRepository } from '../../scripts/constitution/check.mjs';

async function put(root, relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function withFixture(name, files, assertion) {
  const root = await mkdtemp(path.join(os.tmpdir(), `adr-constitution-${name}-`));
  try {
    await put(root, 'package.json', JSON.stringify({ name: `fixture-${name}`, private: true, type: 'module', scripts: {} }, null, 2));
    for (const [relative, content] of Object.entries(files)) await put(root, relative, content);
    const result = await checkRepository(root);
    await assertion(result, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasCode(result, code) {
  return result.violations.some((item) => item.code === code);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('actual repository passes constitutional scanner', async () => {
  const result = await checkRepository(process.cwd());
  assert(result.ok, `actual repository violations: ${JSON.stringify(result.violations)}`);
});

test('rejects @geox dependency in core source', async () => {
  await withFixture('geox-import', {
    'packages/core/src/index.ts': `import { x } from '@geox/contracts';\nexport { x };\n`
  }, async (result) => {
    assert(hasCode(result, 'CORE_GEOX_DEPENDENCY'), JSON.stringify(result));
  });
});

test('rejects core import into adapters', async () => {
  await withFixture('adapter-import', {
    'packages/core/src/index.ts': `import '../../../adapters/geox/src/index.js';\n`
  }, async (result) => {
    assert(hasCode(result, 'CORE_ADAPTER_IMPORT'), JSON.stringify(result));
  });
});

test('rejects MCFT/CAP/KBS/T3R1 semantic tokens in core', async () => {
  await withFixture('semantic-coupling', {
    'packages/core/src/index.ts': `export const marker = 'MCFT CAP-09 KBS T3R1';\n`
  }, async (result) => {
    assert(hasCode(result, 'CORE_MCFT_SEMANTIC_DEPENDENCY'), JSON.stringify(result));
    assert(hasCode(result, 'CORE_CAP_SEMANTIC_DEPENDENCY'), JSON.stringify(result));
    assert(hasCode(result, 'CORE_KBS_SEMANTIC_DEPENDENCY'), JSON.stringify(result));
    assert(hasCode(result, 'CORE_T3R1_SEMANTIC_DEPENDENCY'), JSON.stringify(result));
  });
});

test('rejects GEOX schema/table-style references in core', async () => {
  await withFixture('geox-schema', {
    'packages/core/src/index.ts': `export const table = 'geox.twin_state';\n`
  }, async (result) => {
    assert(hasCode(result, 'CORE_GEOX_SCHEMA_DEPENDENCY') || hasCode(result, 'CORE_GEOX_SEMANTIC_DEPENDENCY'), JSON.stringify(result));
  });
});

test('rejects direct external provider network calls from packages core', async () => {
  await withFixture('core-network', {
    'packages/scientific/src/index.ts': `export async function readProvider() { return fetch('https://farm.example/data'); }\n`
  }, async (result) => {
    assert(hasCode(result, 'CORE_DIRECT_EXTERNAL_NETWORK'), JSON.stringify(result));
  });
});

test('rejects adapter import of internal authority package', async () => {
  await withFixture('adapter-authority-import', {
    'adapters/customer/src/index.ts': `import { qualify } from '@adr/qualification-engine';\nexport { qualify };\n`
  }, async (result) => {
    assert(hasCode(result, 'ADAPTER_INTERNAL_AUTHORITY_IMPORT'), JSON.stringify(result));
  });
});

test('allows adapter import of ADR contracts only', async () => {
  await withFixture('adapter-contracts', {
    'adapters/customer/src/index.ts': `import type { ContextDatum } from '@adr/contracts';\nexport const adapter = true;\n`
  }, async (result) => {
    assert(result.ok, JSON.stringify(result));
  });
});

test('rejects SDK import of internal authority package', async () => {
  await withFixture('sdk-authority-import', {
    'sdks/typescript/src/index.ts': `import { assess } from '@adr/applicability';\nexport { assess };\n`
  }, async (result) => {
    assert(hasCode(result, 'SDK_INTERNAL_AUTHORITY_IMPORT'), JSON.stringify(result));
  });
});

test('allows SDK import of ADR public contracts only', async () => {
  await withFixture('sdk-contracts', {
    'sdks/typescript/src/index.ts': `import type { ContextDatum } from '@adr/contracts';\nexport const sdk = true;\n`
  }, async (result) => {
    assert(result.ok, JSON.stringify(result));
  });
});

test('rejects root build/test scripts coupled to adapters/geox', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adr-constitution-root-script-'));
  try {
    await put(root, 'package.json', JSON.stringify({
      name: 'fixture-root-script',
      private: true,
      scripts: { test: 'node adapters/geox/test.mjs' }
    }, null, 2));
    const result = await checkRepository(root);
    assert(hasCode(result, 'ROOT_SCRIPT_GEOX_COUPLING'), JSON.stringify(result));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deleting adapters/geox does not change standalone core acceptance', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adr-constitution-delete-geox-'));
  try {
    await put(root, 'package.json', JSON.stringify({ name: 'fixture-delete-geox', private: true, scripts: {} }, null, 2));
    await put(root, 'packages/contracts/src/index.ts', `export type ContextDatum = { semanticId: string };\n`);
    await put(root, 'packages/core/src/index.ts', `export const standalone = true;\n`);
    await put(root, 'adapters/geox/src/index.ts', `import type { ContextDatum } from '@adr/contracts';\nexport const map = (x) => x;\n`);

    const before = await checkRepository(root);
    assert(before.ok, `before deletion: ${JSON.stringify(before)}`);

    await rm(path.join(root, 'adapters/geox'), { recursive: true, force: true });
    const after = await checkRepository(root);
    assert(after.ok, `after deletion: ${JSON.stringify(after)}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
