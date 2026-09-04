import assert from 'node:assert/strict';

import { GeoxDurableTargetAuthorityStore } from '../../adapters/geox/src/durable-target-authority-store.mjs';
import { replayGeoxTargetAuthorityResolution } from '../../adapters/geox/src/target-authority-resolver.mjs';

const rootDir = process.argv[2];
const receiptHash = process.argv[3];
const processAId = Number(process.argv[4]);
assert.ok(rootDir, 'durable store root is required');
assert.ok(receiptHash, 'receipt hash is required');
assert.ok(Number.isInteger(processAId) && processAId > 0, 'process A id is required');
assert.notEqual(process.pid, processAId, 'offline replay must execute in a distinct process');
assert.equal(process.env.GITHUB_TOKEN, undefined, 'offline process must not receive GITHUB_TOKEN');

let networkAttempted = false;
globalThis.fetch = async () => {
  networkAttempted = true;
  throw new Error('NETWORK_FORBIDDEN_DURING_DURABLE_REPLAY');
};

const store = new GeoxDurableTargetAuthorityStore({ rootDir });
const receipt = store.loadReceipt(receiptHash);
const replay = replayGeoxTargetAuthorityResolution({ receipt, snapshotStore: store });

assert.equal(networkAttempted, false, 'exact replay must not attempt network access');
assert.equal(store.count(), 4);
assert.equal(replay.replayClass, 'EXACT');
assert.equal(replay.authorityExport.source_main_sha, receipt.resolved_commit_sha);
assert.equal(replay.authorityExport.source_repository, 'liyongshang44-max/GEOX');
assert.equal(replay.authorityExport.provider_target.provider_site, 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT');
assert.equal(replay.authorityExport.provider_target.treatment_code, 'T4');
assert.equal(replay.authorityExport.provider_target.replicate_code, 'R1');
assert.equal(replay.authorityExport.provider_target.crop_code, 'corn');
assert.equal(replay.authorityExport.provider_target.hybrid_code, '43-96P');
assert.equal(replay.authorityExport.provider_target.planting_observation_id, '6974');
assert.equal(replay.authorityExport.geox_target.field_id, 'field_kbs_mcse_t4r1');
assert.equal(replay.authorityExport.geox_target.season_id, 'season_2026_corn');
assert.equal(replay.authorityExport.geox_target.zone_id, 'zone_kbs_mcse_t4r1_crop_formal_v1');
assert.equal(replay.authorityExport.geox_target.field_validity_proven, false);
assert.equal(replay.authorityExport.geox_target.production_site_claimed, false);
assert.equal(replay.authorityExport.authority_boundary.field_actionability_authorized, false);
assert.equal(replay.authorityExport.authority_boundary.dispatch_authorized, false);
assert.equal(receipt.human_approval_authority, 'NONE');
assert.equal(receipt.machine_execution_authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  process: 'B_OFFLINE_EXACT_REPLAY',
  processId: process.pid,
  processAId,
  receiptHash,
  resolvedCommitSha: receipt.resolved_commit_sha,
  snapshotCount: store.count(),
  replayClass: replay.replayClass,
  networkAttempted,
  geoxTarget: replay.authorityExport.geox_target,
  authorityBoundary: {
    fieldActionable: false,
    dispatchAuthorized: false,
    humanApprovalAuthority: 'NONE',
    machineExecutionAuthority: 'NONE'
  }
}));
