import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const SERVER = join(REPO_ROOT, 'apps/pilot-api/src/server.mjs');
const TOKEN = 'pilot-host-smoke-token';
const root = mkdtempSync(join(tmpdir(), 'adr-pilot-host-'));
const pdf = Buffer.from('%PDF-1.7\nHTTP restart smoke\n%%EOF\n');

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function startHost(port) {
  const output = [];
  const child = spawn(process.execPath, [SERVER], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ADR_HOST: '127.0.0.1',
      ADR_PORT: String(port),
      ADR_OPERATOR_TOKEN: TOKEN,
      ADR_OPERATOR_ID: 'pilot-host-smoke',
      ADR_DATA_DIR: root,
      OPENAI_API_KEY: '',
      ADR_EXTRACTION_MODEL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));
  return { child, output };
}

async function stopHost(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolveExit) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

async function waitReady(baseUrl, processState) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.child.exitCode !== null) {
      throw new Error(`pilot host exited before readiness: ${processState.output.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/readyz`, { cache: 'no-store' });
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`pilot host readiness timeout: ${lastError?.message ?? 'unknown'}\n${processState.output.join('')}`);
}

function headers(extra = {}) {
  return { authorization: `Bearer ${TOKEN}`, ...extra };
}

function notReportedContext() {
  return {
    BIOLOGICAL: { status: 'NOT_REPORTED', dimensions: [] },
    ENVIRONMENTAL: { status: 'NOT_REPORTED', dimensions: [] },
    MANAGEMENT: { status: 'NOT_REPORTED', dimensions: [] },
    OPERATIONAL: { status: 'NOT_REPORTED', dimensions: [] },
    MEASUREMENT: { status: 'NOT_REPORTED', dimensions: [] },
    JURISDICTION_ECONOMIC: { status: 'NOT_REPORTED', dimensions: [] }
  };
}

let first = null;
let second = null;
try {
  const port1 = await freePort();
  first = startHost(port1);
  const base1 = `http://127.0.0.1:${port1}`;
  const ready1 = await waitReady(base1, first);
  assert.equal(ready1.ready, true);
  assert.equal(ready1.authorityPersistence, 'LOCAL_CHECKPOINT_RESTART_DURABLE_V1');
  assert.equal(ready1.extraction.configured, false);

  const createResponse = await fetch(`${base1}/operator/source-uploads`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      scope: { organizationId: 'org-smoke', tenantId: 'tenant-smoke' },
      filename: 'smoke.pdf',
      source: {
        logicalId: 'source.paper.http-smoke', version: '1', sourceType: 'PUBLICATION', title: 'HTTP Smoke Paper',
        rights: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
      },
      artifact: {
        logicalId: 'artifact.paper.http-smoke', version: '1', mediaType: 'application/pdf', materializationIdentity: 'http-smoke',
        acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-18T03:30:00.000Z', locator: 'smoke://http' },
        rightsSnapshot: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const uploadResponse = await fetch(`${base1}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/content`, {
    method: 'PUT', headers: headers({ 'content-type': 'application/pdf' }), body: pdf
  });
  assert.equal(uploadResponse.status, 201);
  const stored = await uploadResponse.json();
  assert.equal(stored.state, 'STORED');

  const finalizeResponse = await fetch(`${base1}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/finalize`, {
    method: 'POST', headers: headers()
  });
  assert.equal(finalizeResponse.status, 201);
  const finalized = await finalizeResponse.json();
  assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');
  assert.match(finalized.contentHash, /^sha256:[0-9a-f]{64}$/);
  const exactArtifactRef = finalized.sourceArtifactRef;

  const importResponse = await fetch(`${base1}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/import-proposal`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      providerLabel: 'MODEL_C_WEB',
      modelLabel: 'UNKNOWN_MODEL',
      compilationVersion: 'manual-http-smoke-1',
      proposal: {
        claims: [{
          key: 'http-smoke-boundary',
          claimType: 'BOUNDARY_CONSTRAINT',
          assertion: 'HTTP smoke candidate remains proposal-only until review.',
          confidence: 0.9,
          sourceLocator: {
            kind: 'DOCUMENT_COORDINATE',
            scheme: 'PDF_PAGE_TEXT_V1',
            coordinates: { page: 1, evidenceText: 'HTTP restart smoke' }
          },
          sourceContext: notReportedContext()
        }]
      }
    })
  });
  assert.equal(importResponse.status, 200);
  const imported = await importResponse.json();
  assert.equal(imported.candidateCount, 1);
  assert.equal(imported.preflight.total, 1);
  assert.equal(imported.preflight.reviewable, 1);
  const exactCompilationRef = imported.compilationResultRef;
  const exactClaimCandidateRef = imported.candidates[0].claimCandidateRef;
  const exactContextCandidateRef = imported.candidates[0].sourceContextCandidateRef;

  const reviewResponse = await fetch(`${base1}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/review`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      compilationResultRef: exactCompilationRef,
      claimCandidateRef: exactClaimCandidateRef,
      sourceContextCandidateRef: exactContextCandidateRef,
      disposition: 'REJECT_SOURCE_FAITHFUL',
      reasonCodes: ['REVIEWER_SOURCE_FAITHFUL_REJECTION'],
      rationale: 'HTTP restart smoke rejection',
      reviewVersion: 'review-http-smoke-1'
    })
  });
  assert.equal(reviewResponse.status, 201);
  const reviewed = await reviewResponse.json();
  assert.equal(reviewed.disposition, 'REJECT_SOURCE_FAITHFUL');
  assert.equal(reviewed.claimRef, null);

  const recoveryBeforeResponse = await fetch(`${base1}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/compilations`, {
    headers: headers()
  });
  assert.equal(recoveryBeforeResponse.status, 200);
  const recoveryBefore = await recoveryBeforeResponse.json();
  assert.equal(recoveryBefore.compilationCount, 1);
  assert.deepEqual(recoveryBefore.compilations[0].compilationResultRef, exactCompilationRef);
  assert.equal(recoveryBefore.compilations[0].reviewedCount, 1);
  assert.equal(recoveryBefore.compilations[0].candidates[0].review.disposition, 'REJECT_SOURCE_FAITHFUL');

  await stopHost(first.child);
  first = null;

  const port2 = await freePort();
  second = startHost(port2);
  const base2 = `http://127.0.0.1:${port2}`;
  const ready2 = await waitReady(base2, second);
  assert.equal(ready2.authorityPersistence, 'LOCAL_CHECKPOINT_RESTART_DURABLE_V1');
  assert.equal(ready2.checkpoint.state, 'RESTORED_AND_VERIFIED');

  const restoredResponse = await fetch(`${base2}/operator/source-uploads/${encodeURIComponent(created.uploadId)}`, {
    headers: headers()
  });
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.state, 'SOURCE_MATERIALIZED');
  assert.deepEqual(restored.sourceArtifactRef, exactArtifactRef);

  const recoveryAfterResponse = await fetch(`${base2}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/compilations`, {
    headers: headers()
  });
  assert.equal(recoveryAfterResponse.status, 200);
  const recoveryAfter = await recoveryAfterResponse.json();
  assert.equal(recoveryAfter.compilationCount, 1, 'restart recovery must not create a second compilation');
  const recoveredCompilation = recoveryAfter.compilations[0];
  assert.deepEqual(recoveredCompilation.compilationResultRef, exactCompilationRef);
  assert.equal(recoveredCompilation.runMetadata.providerLabel, 'MODEL_C_WEB');
  assert.equal(recoveredCompilation.runMetadata.modelLabel, 'UNKNOWN_MODEL');
  assert.equal(recoveredCompilation.reviewedCount, 1);
  assert.deepEqual(recoveredCompilation.candidates[0].claimCandidateRef, exactClaimCandidateRef);
  assert.deepEqual(recoveredCompilation.candidates[0].sourceContextCandidateRef, exactContextCandidateRef);
  assert.equal(recoveredCompilation.candidates[0].review.disposition, 'REJECT_SOURCE_FAITHFUL');
  assert.equal(recoveredCompilation.candidates[0].review.rationale, 'HTTP restart smoke rejection');

  const recoveryRepeatResponse = await fetch(`${base2}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/compilations`, {
    headers: headers()
  });
  assert.equal(recoveryRepeatResponse.status, 200);
  const recoveryRepeat = await recoveryRepeatResponse.json();
  assert.equal(recoveryRepeat.compilationCount, 1, 'read-only recovery must be idempotent');
  assert.deepEqual(recoveryRepeat.compilations[0].compilationResultRef, exactCompilationRef);

  const health = await fetch(`${base2}/healthz`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0, uploadId: created.uploadId }, null, 2));
} finally {
  if (first) await stopHost(first.child);
  if (second) await stopHost(second.child);
  rmSync(root, { recursive: true, force: true });
}
