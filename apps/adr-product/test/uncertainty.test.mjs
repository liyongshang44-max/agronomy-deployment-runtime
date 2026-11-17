import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createProductServer } from '../src/server.mjs';

// Test-only fake HTTP transport intentionally simulates a lost response after
// remote commit. It is NOT a substitute for the separate real-Host science test.
test('uncertain write is retried only with exact original identity and same key', async () => {
  const root = mkdtempSync(join(tmpdir(), 'adr-prod-transport-test-'));
  const writes = [];
  let host = null;
  let product = null;
  let recoveredProduct = null;
  const principal = {
    principal_id: 'test-only-runtime', type: 'USER', organization_id: 'org-a',
    tenant_id: 'tenant-a', program_ids: ['pilot-a']
  };
  const ref = (kind, id) => ({
    kind, logical_id: id, version: '1', semantic_hash: 'sha256:' + 'a'.repeat(64)
  });
  try {
    host = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (req.method === 'POST' && req.url === '/v1/applicability-assessments') {
        writes.push({
          key: req.headers['idempotency-key'],
          auth: req.headers.authorization,
          request: Buffer.concat(chunks).toString('utf8')
        });
        if (writes.length === 1) {
          // Simulate remote success whose response is lost in transport.
          req.socket.destroy();
          return;
        }
        const payload = JSON.parse(writes.at(-1).request);
        const body = {
          ref: ref('ApplicabilityAssessment', payload.logical_id),
          resource: { contract_version: 'adr.applicability-assessment.v1' }
        };
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
        return;
      }
      if (req.method === 'GET' && req.url?.startsWith('/v1/workbench/cases/')) {
        const id = req.url.split('/').at(-1);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          projectionKind: 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE',
          projectionHash: 'sha256:' + 'b'.repeat(64),
          classification: 'CONTEXT_GAP',
          reviewRequired: true,
          why: {},
          scientificEvidence: {},
          targetContext: {},
          applicability: { applicabilityAssessmentRef: {
            kind: 'ApplicabilityAssessment', logicalId: id,
            version: '1', semanticHash: 'sha256:' + 'a'.repeat(64)
          } }
        }));
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'NOT_FOUND' }));
    });
    await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
    const demo = {
      hostBaseUrl: 'http://127.0.0.1:' + host.address().port,
      readToken: 'test-read-only', writeToken: 'test-write-only',
      storePath: join(root, 'records.json'),
      principal,
      authorizationRef: ref('AuthorizationDecisionAudit', 'test-auth'),
      retrievalRef: ref('KnowledgeRetrievalResult', 'test-retrieval'),
      knowledgeRef: ref('QualifiedKnowledge', 'test-knowledge'),
      manifestRef: ref('ContextManifest', 'test-manifest'),
      demoAssessmentId: 'test-base'
    };

    product = createProductServer({ mode: 'DEMO', demoBinding: demo });
    await new Promise((resolve) => product.listen(0, '127.0.0.1', resolve));
    let base = 'http://127.0.0.1:' + product.address().port;
    const sessionResponse = await fetch(base + '/api/demo/session');
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie').split(';')[0];
    const operationId = randomUUID();
    const payload = JSON.stringify({ operationId });
    const headers = {
      origin: base, cookie,
      'content-type': 'application/json', 'x-csrf-token': session.csrf
    };
    const first = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers, body: payload
    });
    assert.equal(first.status, 202);
    const unconfirmed = await first.json();
    assert.equal(unconfirmed.state, 'UNKNOWN_OUTCOME');
    assert.equal(unconfirmed.assessmentRef, null);
    assert.equal(writes.length, 1);

    // Re-open the product BFF but keep the same product record file + cookie.
    await new Promise((resolve) => product.close(resolve));
    product = null;
    recoveredProduct = createProductServer({ mode: 'DEMO', demoBinding: demo });
    await new Promise((resolve) => recoveredProduct.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + recoveredProduct.address().port;
    const recoveredSession = await (await fetch(base + '/api/demo/session', {
      headers: { cookie }
    })).json();
    assert.equal(recoveredSession.csrf, session.csrf);

    const second = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: { ...headers, origin: base }, body: payload
    });
    assert.equal(second.status, 201);
    const confirmed = await second.json();
    assert.equal(confirmed.state, 'CONFIRMED');
    assert.equal(confirmed.assessmentRef.logical_id, 'applicability.adr-prod-demo.' + operationId);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].key, writes[1].key);
    assert.equal(writes[0].request, writes[1].request);
    assert.equal(writes[0].auth, writes[1].auth);
    assert.equal(JSON.parse(writes[0].request).principal.principal_id, 'test-only-runtime');
    assert.equal(JSON.parse(writes[0].request).authorization_decision_ref.logical_id, 'test-auth');

    const repeat = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: { ...headers, origin: base }, body: payload
    });
    assert.equal(repeat.status, 201);
    assert.deepEqual(await repeat.json(), confirmed);
    assert.equal(writes.length, 2, 'confirmed replay must never repeat upstream POST');
  } finally {
    if (recoveredProduct?.listening) await new Promise((resolve) => recoveredProduct.close(resolve));
    if (product?.listening) await new Promise((resolve) => product.close(resolve));
    if (host?.listening) await new Promise((resolve) => host.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});
