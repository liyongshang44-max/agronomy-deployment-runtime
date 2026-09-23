import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createPilotHttpServer,
  initializePilotRuntime
} from './server.mjs';

const tempRoot = mkdtempSync(join(tmpdir(), 'adr-pilot-host-'));
const statePath = join(tempRoot, 'state', 'adr-pilot-state.json');
const snapshotDir = join(tempRoot, 'snapshots');

const WRITE_TOKEN = 'acceptance-write-token';
const READ_TOKEN = 'acceptance-read-token';

process.env.ADR_PILOT_TOKEN_BINDINGS_JSON = JSON.stringify({
  [WRITE_TOKEN]: {
    principal_id: 'design-partner-context-provider-host',
    type: 'SERVICE_ACCOUNT',
    organization_id: 'org-a',
    tenant_id: 'tenant-a',
    program_ids: ['pilot-a']
  },
  [READ_TOKEN]: {
    principal_id: 'agronomist-v03-host',
    type: 'USER',
    organization_id: 'org-a',
    tenant_id: 'tenant-a',
    program_ids: ['pilot-a']
  }
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function listen(runtime) {
  const server = createPilotHttpServer(runtime);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

let runtime = await initializePilotRuntime({
  statePath,
  snapshotDir,
  allowSyntheticBootstrap: true
});
assert.equal(runtime.ready, true);
assert.equal(runtime.metadata.mode, 'SYNTHETIC_SMOKE');
assert.equal(runtime.tokenBindings.size, 2);

let host = await listen(runtime);

try {
  const health = await request(host.baseUrl, '/healthz');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.release, 'ADR v0.3 — Paid Design-Partner Pilot');

  const ready = await request(host.baseUrl, '/ready');
  assert.equal(ready.response.status, 200);
  assert.equal(ready.body.status, 'ready');
  assert.equal(ready.body.release.softwareQualification, 'PAID_DESIGN_PARTNER_PILOT_CANDIDATE');
  assert.equal(ready.body.release.commercialValidation, 'NOT_ESTABLISHED');
  assert.equal(ready.body.release.coreEngineering, 'FROZEN');

  const openapi = await request(host.baseUrl, '/openapi.json');
  assert.equal(openapi.response.status, 200);
  assert.equal(openapi.body.openapi, '3.1.0');
  assert.ok(openapi.body.paths['/v1/context-data']?.post);
  assert.ok(openapi.body.paths['/v1/workbench/cases/{assessment_id}']?.get);
  for (const forbidden of ['/recommend', '/runtime-eligibility', '/runtime-bindings', '/decision-results']) {
    assert.equal(Object.keys(openapi.body.paths).some((path) => path.includes(forbidden)), false);
  }

  const unauthCase = await request(host.baseUrl, '/v1/workbench/cases/applicability.v03.host');
  assert.equal(unauthCase.response.status, 401);
  assert.equal(unauthCase.body.code, 'HTTP_UNAUTHENTICATED');

  const workbench = await request(
    host.baseUrl,
    '/v1/workbench/cases/applicability.v03.host',
    { headers: auth(READ_TOKEN) }
  );
  assert.equal(workbench.response.status, 200);
  assert.equal(workbench.body.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
  assert.match(workbench.body.projectionHash, /^sha256:/);
  assert.equal(typeof workbench.body.reviewRequired, 'boolean');
  assert.ok(workbench.body.applicability);
  assert.ok(workbench.body.scientificEvidence);
  assert.ok(workbench.body.targetContext);

  const escalations = await request(
    host.baseUrl,
    '/v1/workbench/escalations',
    { headers: auth(READ_TOKEN) }
  );
  assert.equal(escalations.response.status, 200);
  assert.ok(Array.isArray(escalations.body));

  const smoke = runtime.metadata.smokeRequest;
  assert.equal(smoke.method, 'POST');
  assert.equal(smoke.path, '/v1/context-data');
  assert.equal(smoke.body.principal.principal_id, 'design-partner-context-provider-host');

  const writeHeaders = {
    ...auth(WRITE_TOKEN),
    'Content-Type': 'application/json',
    'Idempotency-Key': 'host-acceptance-context-1'
  };
  const firstWrite = await request(host.baseUrl, smoke.path, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify(smoke.body)
  });
  assert.equal(firstWrite.response.status, 201);
  assert.equal(firstWrite.body.ref.kind, 'ContextDatum');
  assert.equal(firstWrite.body.ref.logical_id, smoke.body.logical_id);
  assert.equal(firstWrite.body.resource.contract_version, 'adr.context-datum.v1');

  const replayWrite = await request(host.baseUrl, smoke.path, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify(smoke.body)
  });
  assert.equal(replayWrite.response.status, 201);
  assert.deepEqual(replayWrite.body, firstWrite.body);

  const mutated = structuredClone(smoke.body);
  mutated.resource.source.source_ref = 'mutated/source/ref';
  const idempotencyConflict = await request(host.baseUrl, smoke.path, {
    method: 'POST',
    headers: writeHeaders,
    body: JSON.stringify(mutated)
  });
  assert.equal(idempotencyConflict.response.status, 409);
  assert.equal(idempotencyConflict.body.code, 'HTTP_IDEMPOTENCY_CONFLICT');

  const principalMismatch = await request(host.baseUrl, smoke.path, {
    method: 'POST',
    headers: {
      ...auth(READ_TOKEN),
      'Content-Type': 'application/json',
      'Idempotency-Key': 'host-acceptance-principal-mismatch'
    },
    body: JSON.stringify(smoke.body)
  });
  assert.equal(principalMismatch.response.status, 403);
  assert.equal(principalMismatch.body.code, 'HTTP_PRINCIPAL_MISMATCH');

  const persisted = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(persisted.schema_version, 'adr.pilot-host-state.v1');
  assert.match(persisted.checkpoint.checkpointHash, /^sha256:/);
  assert.equal(persisted.release.name, 'ADR v0.3 — Paid Design-Partner Pilot');
} finally {
  await new Promise((resolve) => host.server.close(resolve));
}

runtime = await initializePilotRuntime({
  statePath,
  snapshotDir,
  allowSyntheticBootstrap: false
});
assert.equal(runtime.ready, true);
assert.equal(runtime.metadata.mode, 'SYNTHETIC_SMOKE');

host = await listen(runtime);
try {
  const readyAfterRestart = await request(host.baseUrl, '/ready');
  assert.equal(readyAfterRestart.response.status, 200);
  assert.equal(readyAfterRestart.body.status, 'ready');

  const workbenchAfterRestart = await request(
    host.baseUrl,
    '/v1/workbench/cases/applicability.v03.host',
    { headers: auth(READ_TOKEN) }
  );
  assert.equal(workbenchAfterRestart.response.status, 200);
  assert.equal(workbenchAfterRestart.body.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
  assert.match(workbenchAfterRestart.body.projectionHash, /^sha256:/);

  const replayAfterRestart = await request(host.baseUrl, runtime.metadata.smokeRequest.path, {
    method: 'POST',
    headers: {
      ...auth(WRITE_TOKEN),
      'Content-Type': 'application/json',
      'Idempotency-Key': 'host-acceptance-context-1'
    },
    body: JSON.stringify(runtime.metadata.smokeRequest.body)
  });
  assert.equal(replayAfterRestart.response.status, 201);
  assert.equal(replayAfterRestart.body.ref.kind, 'ContextDatum');
} finally {
  await new Promise((resolve) => host.server.close(resolve));
}

console.log('ADR v0.3 thin pilot host acceptance: PASS');
