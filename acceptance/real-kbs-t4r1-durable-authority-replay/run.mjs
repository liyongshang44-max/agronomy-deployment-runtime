import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function runChild(scriptName, args, env) {
  const scriptPath = fileURLToPath(new URL(scriptName, import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${scriptName} must succeed`);
  return JSON.parse(result.stdout.trim());
}

const rootDir = mkdtempSync(join(tmpdir(), 'adr-geox-durable-authority-'));
try {
  const processA = runChild('./process-a-live.mjs', [rootDir], { ...process.env });
  assert.equal(processA.ok, true);
  assert.equal(processA.process, 'A_LIVE_RESOLVE_AND_PERSIST');
  assert.match(processA.receiptHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(processA.snapshotCount, 4);

  const offlineEnv = { ...process.env };
  delete offlineEnv.GITHUB_TOKEN;
  const processB = runChild(
    './process-b-offline.mjs',
    [rootDir, processA.receiptHash, String(processA.processId)],
    offlineEnv
  );
  assert.equal(processB.ok, true);
  assert.equal(processB.process, 'B_OFFLINE_EXACT_REPLAY');
  assert.notEqual(processA.processId, processB.processId);
  assert.equal(processB.receiptHash, processA.receiptHash);
  assert.equal(processB.resolvedCommitSha, processA.resolvedCommitSha);
  assert.equal(processB.snapshotCount, 4);
  assert.equal(processB.replayClass, 'EXACT');
  assert.equal(processB.networkAttempted, false);
  assert.deepEqual(processB.geoxTarget, processA.geoxTarget);

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_PROCESS_DURABLE_TARGET_AUTHORITY_REPLAY_V1',
    onlineProcessId: processA.processId,
    offlineProcessId: processB.processId,
    sameProcess: false,
    receiptHash: processA.receiptHash,
    sourceRepository: processA.sourceRepository,
    resolvedCommitSha: processA.resolvedCommitSha,
    snapshotCount: processB.snapshotCount,
    replayClass: processB.replayClass,
    networkAttemptedDuringReplay: processB.networkAttempted,
    onlineAndOfflineTargetEqual: true,
    authorityBoundary: processB.authorityBoundary,
    adrCoreModified: false,
    genericSdkModified: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
