import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GEOX_DURABLE_TARGET_AUTHORITY_STORE_CLASS,
  GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION,
  GeoxDurableTargetAuthorityStore,
  GeoxDurableTargetAuthorityStoreError
} from '../../adapters/geox/src/durable-target-authority-store.mjs';
import { GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION } from '../../adapters/geox/src/target-authority-resolver.mjs';

function expectCode(label, code, fn) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof GeoxDurableTargetAuthorityStoreError, `${label}: expected durable store error`);
    assert.equal(error.code, code, `${label}: wrong error code`);
    return true;
  });
  console.log(`PASS ${label}`);
}

function physicalPath(rootDir, kind, hash, suffix) {
  return join(rootDir, 'v1', kind, `${hash.slice('sha256:'.length)}${suffix}`);
}

const rootDir = mkdtempSync(join(tmpdir(), 'adr-geox-durable-integrity-'));
try {
  const storeA = new GeoxDurableTargetAuthorityStore({ rootDir });
  assert.equal(storeA.storeVersion, GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION);
  assert.equal(storeA.storeClass, GEOX_DURABLE_TARGET_AUTHORITY_STORE_CLASS);

  const snapshotHash = storeA.retain(Buffer.from('durable-snapshot-v1', 'utf8'));
  assert.match(snapshotHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(storeA.count(), 1);

  const storeB = new GeoxDurableTargetAuthorityStore({ rootDir });
  assert.equal(storeB.get(snapshotHash).toString('utf8'), 'durable-snapshot-v1');
  assert.equal(storeB.count(), 1);
  console.log('PASS process restart preserves exact snapshot bytes');

  expectCode(
    'path-like snapshot hash rejected',
    'GEOX_DURABLE_TARGET_AUTHORITY_HASH_INVALID',
    () => storeB.get('sha256:../../etc/passwd')
  );
  expectCode(
    'missing snapshot fails closed',
    'GEOX_DURABLE_TARGET_AUTHORITY_SNAPSHOT_MISSING',
    () => storeB.get(`sha256:${'a'.repeat(64)}`)
  );

  const receipt = {
    contract_version: GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION,
    resolution_class: 'REPLAYABLE_CONSUMER_AUTHORITY_RESOLUTION',
    replay_class: 'EXACT',
    authority_export_hash: `sha256:${'b'.repeat(64)}`
  };
  const receiptHash = storeA.persistReceipt(receipt);
  assert.deepEqual(storeB.loadReceipt(receiptHash), receipt);
  console.log('PASS process restart preserves exact receipt bytes');

  expectCode(
    'missing receipt fails closed',
    'GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_MISSING',
    () => storeB.loadReceipt(`sha256:${'c'.repeat(64)}`)
  );
  expectCode(
    'unsupported receipt contract fails closed',
    'GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_INVALID',
    () => storeB.persistReceipt({ contract_version: 'unsupported.v0' })
  );

  writeFileSync(
    physicalPath(rootDir, 'snapshots', snapshotHash, '.blob'),
    Buffer.from('mutated-snapshot', 'utf8')
  );
  expectCode(
    'mutated durable snapshot fails hash verification',
    'GEOX_DURABLE_TARGET_AUTHORITY_SNAPSHOT_HASH_MISMATCH',
    () => storeB.get(snapshotHash)
  );

  writeFileSync(
    physicalPath(rootDir, 'receipts', receiptHash, '.json'),
    Buffer.from(JSON.stringify({ ...receipt, replay_class: 'MUTATED' }), 'utf8')
  );
  expectCode(
    'mutated durable receipt fails hash verification',
    'GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_HASH_MISMATCH',
    () => storeB.loadReceipt(receiptHash)
  );

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_DURABLE_TARGET_AUTHORITY_STORE_INTEGRITY_V1',
    checks: 7,
    processDurable: true,
    contentAddressed: true,
    immutableWriteIntent: true,
    authoritySemanticsChanged: false
  }, null, 2));
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
