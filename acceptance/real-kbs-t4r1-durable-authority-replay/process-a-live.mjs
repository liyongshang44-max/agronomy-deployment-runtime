import assert from 'node:assert/strict';

import { GeoxDurableTargetAuthorityStore } from '../../adapters/geox/src/durable-target-authority-store.mjs';
import {
  GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
  createGitHubPublicAuthorityTransport,
  resolveGeoxTargetAuthority
} from '../../adapters/geox/src/target-authority-resolver.mjs';

const rootDir = process.argv[2];
assert.ok(rootDir, 'durable store root is required');

const token = process.env.GITHUB_TOKEN;
const authenticatedFetch = async (url, init = {}) => globalThis.fetch(url, {
  ...init,
  headers: {
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
});

const store = new GeoxDurableTargetAuthorityStore({ rootDir });
const live = await resolveGeoxTargetAuthority({
  ref: 'main',
  resolvedAt: '2026-09-05T08:00:00.000Z',
  transport: createGitHubPublicAuthorityTransport({ fetchImpl: authenticatedFetch }),
  snapshotStore: store
});
const receiptHash = store.persistReceipt(live.receipt);

assert.equal(store.count(), 4);
assert.equal(live.receipt.resolution_class, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(live.receipt.replay_class, 'EXACT');
assert.equal(live.receipt.field_actionability_authorized, false);
assert.equal(live.receipt.dispatch_authorized, false);
assert.equal(live.receipt.human_approval_authority, 'NONE');
assert.equal(live.receipt.machine_execution_authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  process: 'A_LIVE_RESOLVE_AND_PERSIST',
  processId: process.pid,
  receiptHash,
  sourceRepository: live.authorityExport.source_repository,
  resolvedCommitSha: live.receipt.resolved_commit_sha,
  snapshotCount: store.count(),
  authorityExportHash: live.receipt.authority_export_hash,
  geoxTarget: live.authorityExport.geox_target
}));
