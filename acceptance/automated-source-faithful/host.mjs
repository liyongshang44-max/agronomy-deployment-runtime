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
const TOKEN = 'automated-review-host-token';
const root = mkdtempSync(join(tmpdir(), 'adr-auto-review-host-'));
const pdf = Buffer.from('%PDF-1.7\nautomated review host fixture\n%%EOF\n');

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
      ADR_OPERATOR_ID: 'automated-review-host',
      ADR_DATA_DIR: root,
      OPENAI_API_KEY: 'dummy-key-must-not-be-used-for-skipped-candidate',
      ADR_EXTRACTION_MODEL: '',
      ADR_SOURCE_FAITHFUL_REVIEW_MODEL: 'review-model-b'
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

let processState = null;
try {
  const port = await freePort();
  processState = startHost(port);
  const base = `http://127.0.0.1:${port}`;
  const ready = await waitReady(base, processState);
  assert.equal(ready.automatedSourceFaithfulReview.configured, true);
  assert.equal(ready.automatedSourceFaithfulReview.model, 'review-model-b');
  assert.equal(ready.automatedSourceFaithfulReview.mode, 'BLIND_FALSIFICATION');
  assert.equal(ready.sourceFaithfulReview.humanReviewAvailable, true);
  assert.equal(ready.sourceFaithfulReview.automatedBlindReviewAvailable, true);

  const createResponse = await fetch(`${base}/operator/source-uploads`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      scope: { organizationId: 'org-auto', tenantId: 'tenant-auto' },
      filename: 'auto-review.pdf',
      source: {
        logicalId: 'source.paper.auto-review-host',
        version: '1',
        sourceType: 'PUBLICATION',
        title: 'Automated review host fixture',
        rights: { basis: 'INTERNAL_EVALUATION' }
      },
      artifact: {
        logicalId: 'artifact.paper.auto-review-host',
        version: '1',
        mediaType: 'application/pdf',
        materializationIdentity: 'auto-review-host',
        acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-19T04:40:00.000Z', locator: 'fixture://auto-review-host' },
        rightsSnapshot: { basis: 'INTERNAL_EVALUATION' }
      }
    })
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const uploadResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/content`, {
    method: 'PUT',
    headers: headers({ 'content-type': 'application/pdf' }),
    body: pdf
  });
  assert.equal(uploadResponse.status, 201);

  const finalizeResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/finalize`, {
    method: 'POST', headers: headers()
  });
  assert.equal(finalizeResponse.status, 201);

  const importResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/import-proposal`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      providerLabel: 'MODEL_A',
      modelLabel: 'extract-model-a',
      compilationVersion: 'manual-auto-review-host-1',
      proposal: {
        claims: [{
          key: 'host-candidate',
          claimType: 'BOUNDARY_CONSTRAINT',
          assertion: 'Automated review host candidate.',
          confidence: 0.95,
          sourceLocator: {
            kind: 'DOCUMENT_COORDINATE',
            scheme: 'PDF_PAGE_TEXT_V1',
            coordinates: { page: 1, evidenceText: 'automated review host fixture' }
          },
          sourceContext: notReportedContext()
        }]
      }
    })
  });
  assert.equal(importResponse.status, 200);
  const imported = await importResponse.json();
  assert.equal(imported.candidateCount, 1);

  const reviewResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/review`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      compilationResultRef: imported.compilationResultRef,
      claimCandidateRef: imported.candidates[0].claimCandidateRef,
      sourceContextCandidateRef: imported.candidates[0].sourceContextCandidateRef,
      disposition: 'REJECT_SOURCE_FAITHFUL',
      reasonCodes: ['HOST_PRE_REVIEWED'],
      rationale: 'Pre-reviewed so the automated host endpoint must skip without contacting the dummy provider.',
      reviewVersion: 'host-pre-reviewed-v1'
    })
  });
  assert.equal(reviewResponse.status, 201);

  const missingConsent = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/automated-review`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ compilationResultRef: imported.compilationResultRef })
  });
  assert.equal(missingConsent.status, 409);
  assert.equal((await missingConsent.json()).error, 'EXTERNAL_MODEL_PROCESSING_AUTHORIZATION_REQUIRED');

  const batchResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/automated-review`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      compilationResultRef: imported.compilationResultRef,
      externalProcessingAuthorized: true
    })
  });
  assert.equal(batchResponse.status, 200);
  const batch = await batchResponse.json();
  assert.equal(batch.candidateCount, 1);
  assert.equal(batch.skippedReviewedCount, 1);
  assert.equal(batch.autoAcceptedCount, 0);
  assert.equal(batch.autoRejectedCount, 0);
  assert.equal(batch.escalatedCount, 0);
  assert.equal(batch.results[0].status, 'SKIPPED_ALREADY_REVIEWED');

  const recoveryResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(created.uploadId)}/compilations`, {
    headers: headers()
  });
  assert.equal(recoveryResponse.status, 200);
  const recovery = await recoveryResponse.json();
  assert.equal(recovery.compilations[0].reviewedCount, 1);
  assert.equal(recovery.compilations[0].escalatedPendingHumanCount, 0);
  assert.equal(recovery.compilations[0].promotionIncompleteCount, 0);

  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
} finally {
  if (processState) await stopHost(processState.child);
  rmSync(root, { recursive: true, force: true });
}
