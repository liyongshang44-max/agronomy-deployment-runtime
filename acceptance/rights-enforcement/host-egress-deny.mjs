import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore, PilotSourceIngestionService } from '../../packages/source-ingestion/src/index.mjs';
import { publishRightsPolicy } from '../../packages/rights-authority/src/index.mjs';
import { savePilotCheckpoint } from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SERVER = join(ROOT, 'apps/pilot-api/src/server.mjs');
const dataDir = mkdtempSync(join(tmpdir(), 'adr-host-egress-deny-'));
const port = 21000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const token = 'host-egress-deny-token';
const operatorId = 'host-egress-deny-operator';
const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
const owner = { principalId: operatorId, type: 'USER', ...scope };
let child = null;

function audit(eventId, occurredAt) {
  return { eventId, occurredAt, actor: { type: 'USER', id: operatorId }, details: { channel: 'host-egress-deny' } };
}

function seedPolicy() {
  const ledger = new AuthorityLedger();
  const store = new FileSystemScopedArtifactStore({ rootDir: join(dataDir, 'artifacts') });
  const registry = new SourceRegistry({ ledger, artifactStore: store });
  const ingestion = new PilotSourceIngestionService({ sourceRegistry: registry, artifactStore: store });
  const at = new Date().toISOString();
  const policy = publishRightsPolicy({
    ledger,
    logicalId: 'rights.policy.host-egress-deny',
    version: '1',
    ownership: scope,
    ownerPrincipal: owner,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit('evt-policy-host-egress-deny', at)
  });
  savePilotCheckpoint({ path: join(dataDir, 'runtime-checkpoint.json'), ledger, ingestion });
  return policy.ref;
}

function startHost() {
  child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: {
      ...process.env,
      ADR_OPERATOR_TOKEN: token,
      ADR_OPERATOR_ID: operatorId,
      ADR_HOST: '127.0.0.1',
      ADR_PORT: String(port),
      ADR_DATA_DIR: dataDir,
      OPENAI_API_KEY: 'dummy-key-must-never-reach-network',
      ADR_EXTRACTION_MODEL: 'dummy-model-must-never-reach-network'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  return { get stdout() { return stdout; }, get stderr() { return stderr; } };
}

async function stopHost() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(3000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

async function waitReady(logs) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`host exited ${child.exitCode}\n${logs.stderr}\n${logs.stdout}`);
    try {
      const response = await fetch(`${base}/readyz`, { cache: 'no-store' });
      if (response.ok) return response.json();
    } catch {}
    await delay(50);
  }
  throw new Error(`host not ready\n${logs.stderr}\n${logs.stdout}`);
}

function headers(extra = {}) { return { authorization: `Bearer ${token}`, ...extra }; }

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, payload: await response.json() };
}

try {
  const rightsPolicyRef = seedPolicy();
  const logs = startHost();
  const readiness = await waitReady(logs);
  assert.equal(readiness.extraction.configured, true);

  const created = await jsonRequest('/operator/source-uploads', {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      scope,
      filename: 'egress-deny.pdf',
      rightsPolicyRef,
      source: {
        logicalId: 'source.host-egress-deny', version: '1', sourceType: 'PUBLICATION', title: 'Host egress deny',
        rights: { basis: 'metadata-only' }
      },
      artifact: {
        logicalId: 'artifact.host-egress-deny', version: '1', mediaType: 'application/pdf',
        materializationIdentity: 'host-egress-deny',
        acquisition: { method: 'UPLOAD', acquiredAt: new Date().toISOString(), locator: 'upload://host-egress-deny' },
        rightsSnapshot: { basis: 'metadata-only' }
      }
    })
  });
  assert.equal(created.response.status, 201);
  const uploadId = created.payload.uploadId;

  const sourceGrant = await jsonRequest(`/operator/source-uploads/${encodeURIComponent(uploadId)}/rights-grants`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      subject: 'SOURCE',
      rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }]
    })
  });
  assert.equal(sourceGrant.response.status, 201);

  const pdf = Buffer.from('%PDF-1.7\nrights deny before network\n%%EOF');
  const retained = await fetch(`${base}/operator/source-uploads/${encodeURIComponent(uploadId)}/content?rightsJurisdiction=US`, {
    method: 'PUT',
    headers: headers({ 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) }),
    body: pdf
  });
  assert.equal(retained.status, 201);

  const finalized = await jsonRequest(`/operator/source-uploads/${encodeURIComponent(uploadId)}/finalize`, {
    method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: '{}'
  });
  assert.equal(finalized.response.status, 201);

  const readOnlyGrant = await jsonRequest(`/operator/source-uploads/${encodeURIComponent(uploadId)}/rights-grants`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      subject: 'SOURCE_ARTIFACT',
      rules: [{
        operation: 'READ_FOR_EXTRACTION',
        purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'],
        jurisdictions: ['US'],
        obligations: []
      }]
    })
  });
  assert.equal(readOnlyGrant.response.status, 201);

  const extract = await jsonRequest(`/operator/source-uploads/${encodeURIComponent(uploadId)}/extract`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ externalProcessingAuthorized: true, rightsJurisdiction: 'US' })
  });
  assert.equal(extract.response.status, 409, `expected rights-layer 409, got ${extract.response.status}: ${JSON.stringify(extract.payload)}`);
  assert.equal(extract.payload.error, 'RIGHTS_DENIED');
  assert.ok(!String(extract.payload.message ?? '').includes('OpenAI'));

  console.log('PASS pilot host blocks MODEL_EGRESS before configured provider network is invoked');
  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
} finally {
  await stopHost();
  rmSync(dataDir, { recursive: true, force: true });
}
