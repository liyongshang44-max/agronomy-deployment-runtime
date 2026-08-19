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
const TOKEN = 'ra02-host-egress-token';
const root = mkdtempSync(join(tmpdir(), 'adr-ra02-host-egress-'));
const pdf = Buffer.from('%PDF-1.7\nRA02 host egress must fail before provider.\n%%EOF\n');

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

function headers(extra = {}) { return { authorization: `Bearer ${TOKEN}`, ...extra }; }
function allow(operation) { return { operation, purposes: ['*'], jurisdictions: ['*'], obligations: [] }; }
function notReportedContext() {
  return Object.fromEntries(['BIOLOGICAL','ENVIRONMENTAL','MANAGEMENT','OPERATIONAL','MEASUREMENT','JURISDICTION_ECONOMIC']
    .map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
}

async function provision(base, uploadId, subject, rules, version) {
  const response = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(uploadId)}/rights`, {
    method: 'POST', headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      subject, basisClass: 'LICENSE', rules,
      validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z', version
    })
  });
  assert.equal(response.status, 201, await response.text());
}

let child = null;
try {
  const port = await freePort();
  const output = [];
  child = spawn(process.execPath, [SERVER], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ADR_HOST: '127.0.0.1', ADR_PORT: String(port), ADR_OPERATOR_TOKEN: TOKEN,
      ADR_OPERATOR_ID: 'ra02-host-egress', ADR_DATA_DIR: root, ADR_RIGHTS_JURISDICTION: 'GB',
      OPENAI_API_KEY: 'dummy-key-that-must-never-be-used',
      ADR_EXTRACTION_MODEL: '', ADR_SOURCE_FAITHFUL_REVIEW_MODEL: 'review-model-b'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`host exited: ${output.join('')}`);
    try {
      const response = await fetch(`${base}/readyz`);
      if (response.ok) break;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    if (attempt === 79) throw new Error(`host readiness timeout: ${output.join('')}`);
  }

  const create = await fetch(`${base}/operator/source-uploads`, {
    method: 'POST', headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      scope: { organizationId: 'org-ra02-host', tenantId: 'tenant-ra02-host' }, filename: 'fixture.pdf',
      source: { logicalId: 'source.ra02.host-egress', version: '1', sourceType: 'PUBLICATION', title: 'RA02 Host Egress', rights: {} },
      artifact: {
        logicalId: 'artifact.ra02.host-egress', version: '1', mediaType: 'application/pdf', materializationIdentity: 'ra02-host-egress',
        acquisition: { method: 'FIXTURE', acquiredAt: new Date().toISOString(), locator: 'fixture://ra02-host-egress' }
      }
    })
  });
  assert.equal(create.status, 201);
  const session = await create.json();

  await provision(base, session.uploadId, 'SOURCE', [allow('RETAIN_FULLTEXT')], 'source-v1');
  const uploaded = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(session.uploadId)}/content`, {
    method: 'PUT', headers: headers({ 'content-type': 'application/pdf' }), body: pdf
  });
  assert.equal(uploaded.status, 201);
  const finalized = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(session.uploadId)}/finalize`, {
    method: 'POST', headers: headers()
  });
  assert.equal(finalized.status, 201);

  // Allow local read/derived persistence only. MODEL_EGRESS is intentionally absent.
  await provision(base, session.uploadId, 'SOURCE_ARTIFACT', [allow('READ_FOR_EXTRACTION'), allow('RETAIN_DERIVED')], 'artifact-local-v1');
  const importedResponse = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(session.uploadId)}/import-proposal`, {
    method: 'POST', headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      providerLabel: 'EXTRACTOR_A', modelLabel: 'extract-model-a', compilationVersion: 'host-egress-import-v1',
      proposal: { claims: [{
        key: 'c1', claimType: 'BOUNDARY_CONSTRAINT', assertion: 'RA02 host egress candidate.', confidence: 0.99,
        sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'RA02 host egress' } },
        sourceContext: notReportedContext()
      }] }
    })
  });
  assert.equal(importedResponse.status, 200);
  const imported = await importedResponse.json();
  assert.equal(imported.candidateCount, 1);

  const startedAt = Date.now();
  const blocked = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(session.uploadId)}/automated-review`, {
    method: 'POST', headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ compilationResultRef: imported.compilationResultRef, externalProcessingAuthorized: true })
  });
  const elapsedMs = Date.now() - startedAt;
  const blockedBody = await blocked.json();
  assert.equal(blocked.status, 409, JSON.stringify(blockedBody));
  assert.equal(blockedBody.error, 'RIGHTS_POLICY_NOT_PROVISIONED');
  assert.ok(elapsedMs < 5000, `rights denial should occur locally before provider transport, elapsed ${elapsedMs} ms`);

  console.log(JSON.stringify({
    total: 1, passed: 1, failed: 0,
    modelEgressDeniedBeforeProvider: true,
    providerCredentialWasDummyAndUnused: true,
    elapsedMs
  }, null, 2));
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolveExit) => {
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolveExit(); });
    });
  }
  rmSync(root, { recursive: true, force: true });
}
