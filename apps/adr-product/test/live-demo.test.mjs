import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDemoHarness } from '../src/demo-harness.mjs';
import { createProductServer } from '../src/server.mjs';

test('real ADR v0.3 HTTP assessment -> Workbench -> persistent non-authority review -> report', async () => {
  const harness = await createDemoHarness();
  let product = null;
  try {
    product = createProductServer({ mode: 'DEMO', demoBinding: harness });
    await new Promise((resolve, reject) => {
      product.once('error', reject);
      product.listen(0, '127.0.0.1', resolve);
    });
    const base = 'http://127.0.0.1:' + product.address().port;

    const meta = await (await fetch(base + '/api/meta')).json();
    assert.equal(meta.mode, 'DEMO');
    assert.equal(meta.liveDemoAvailable, true);
    assert.equal(meta.authorityWritesAvailable, false); // no arbitrary authority writes

    const sessionResponse = await fetch(base + '/api/demo/session');
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    const cookie = sessionResponse.headers.get('set-cookie').split(';')[0];
    assert.match(cookie, /^adr_demo_sid=/);
    assert.equal(session.mode, 'DEMO');
    const headers = { cookie };

    const unauthorized = await fetch(base + '/api/workbench/escalations');
    assert.equal(unauthorized.status, 401);
    const scenarioResult = await fetch(base + '/api/demo/scenario', { headers });
    assert.equal(scenarioResult.status, 200);
    const scenario = await scenarioResult.json();
    assert.equal(scenario.status, 'HOST_HTTP_VALIDATED_SYNTHETIC_WORLD');
    assert.equal(scenario.sampleCase.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
    assert.match(scenario.sampleCase.projectionHash, /^sha256:/);
    assert.ok(scenario.sampleCase.scientificEvidence);
    assert.ok(scenario.sampleCase.applicability?.applicabilityAssessmentRef);

    const escalation = await fetch(base + '/api/workbench/escalations', { headers });
    assert.equal(escalation.status, 200);
    const queue = await escalation.json();
    assert.ok(Array.isArray(queue));
    const caseId = scenario.sampleCase.applicability.applicabilityAssessmentRef.logicalId;
    const caseResult = await fetch(base + '/api/workbench/cases/' + encodeURIComponent(caseId), { headers });
    assert.equal(caseResult.status, 200);
    assert.equal((await caseResult.json()).projectionHash, scenario.sampleCase.projectionHash);

    const operationId = randomUUID();
    const request = JSON.stringify({ operationId });
    const postHeaders = {
      ...headers,
      origin: base,
      'content-type': 'application/json',
      'x-csrf-token': session.csrf
    };

    const csrfDenied = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: { ...postHeaders, 'x-csrf-token': 'wrong' }, body: request
    });
    assert.equal(csrfDenied.status, 403);
    assert.equal((await csrfDenied.json()).code, 'CSRF_DENIED');

    const forgedPrincipal = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: postHeaders,
      body: JSON.stringify({ operationId, principal: { principal_id: 'admin' } })
    });
    assert.equal(forgedPrincipal.status, 400);
    assert.equal((await forgedPrincipal.json()).code, 'INVALID_DEMO_OPERATION');

    const first = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: postHeaders, body: request
    });
    const created = await first.json();
    assert.equal(first.status, 201, JSON.stringify(created));
    assert.equal(created.state, 'CONFIRMED', JSON.stringify(created));
    assert.equal(created.scenarioId, 'QUALIFIED_SYNTHETIC_V03');
    assert.equal(created.inputBinding.contextManifestRef.semantic_hash,
      scenario.sampleCase.targetContext.contextManifestRef.semanticHash);
    assert.equal(created.inputBinding.knowledgeRef.semantic_hash,
      scenario.sampleCase.scientificEvidence.knowledgeRef.semanticHash);
    assert.equal(created.assessmentRef.kind, 'ApplicabilityAssessment');
    assert.equal(created.assessmentRef.logical_id, 'applicability.adr-prod-demo.' + operationId);
    assert.match(created.assessmentRef.semantic_hash, /^sha256:/);
    assert.equal(created.workbenchCase.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
    assert.match(created.workbenchCase.projectionHash, /^sha256:/);

    // A refresh/repeated click never changes the original identity or idempotency key.
    const repeated = await fetch(base + '/api/demo/assessments', {
      method: 'POST', headers: postHeaders, body: request
    });
    assert.equal(repeated.status, 201);
    assert.deepEqual(await repeated.json(), created);
    const fetched = await (await fetch(
      base + '/api/demo/assessments/' + operationId, { headers }
    )).json();
    assert.deepEqual(fetched, created);

    const reviewResponse = await fetch(base + '/api/demo/reviews/' + operationId, {
      method: 'POST', headers: postHeaders,
      body: JSON.stringify({ outcome: 'CONTEXT_REQUESTED', notes: '合成演示复核记录；请求进一步检查来源。' })
    });
    assert.equal(reviewResponse.status, 201);
    const review = await reviewResponse.json();
    assert.equal(review.kind, 'NON_AUTHORITY_PRODUCT_REVIEW_FEEDBACK');
    assert.equal(review.caseProjectionHash, created.workbenchCase.projectionHash);
    assert.deepEqual(review.assessmentRef, created.assessmentRef);
    assert.equal(review.outcome, 'CONTEXT_REQUESTED');
    assert.equal((await (await fetch(
      base + '/api/demo/reviews/' + operationId, { headers }
    )).json()).outcome, 'CONTEXT_REQUESTED');

    const duplicateReview = await fetch(base + '/api/demo/reviews/' + operationId, {
      method: 'POST', headers: postHeaders,
      body: JSON.stringify({ outcome: 'DEFERRED', notes: '' })
    });
    assert.equal(duplicateReview.status, 409);

    const reportResponse = await fetch(base + '/api/demo/reports/' + operationId, { headers });
    assert.equal(reportResponse.status, 200);
    const html = await reportResponse.text();
    assert.match(html, /ADR · 合成演示评估报告/);
    assert.ok(html.includes(created.assessmentRef.semantic_hash));
    assert.ok(html.includes(created.workbenchCase.projectionHash));
    assert.ok(html.includes('CONTEXT_REQUESTED'));

    // No session may inspect another demo operator's product feedback or report.
    const otherSessionResponse = await fetch(base + '/api/demo/session');
    const otherCookie = otherSessionResponse.headers.get('set-cookie').split(';')[0];
    assert.notEqual(otherCookie, cookie);
    const other = await fetch(base + '/api/demo/assessments/' + operationId, {
      headers: { cookie: otherCookie }
    });
    assert.equal(other.status, 404);

    const asset = await fetch(base + '/live-demo.js');
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /renderLiveAssessment/);
    const vocabularyModule = await fetch(base + '/ux-language.js');
    assert.equal(vocabularyModule.status, 200, 'the browser module graph must not contain an unmapped vocabulary import');
    assert.match(vocabularyModule.headers.get('content-type'), /javascript/);
    assert.match(await vocabularyModule.text(), /classificationExplanation/);
  } finally {
    if (product?.listening) await new Promise((resolve) => product.close(resolve));
    await harness.close();
  }
});

test('a formal PILOT app refuses to mount demo authority bindings', async () => {
  await assert.rejects(async () => createProductServer({
    mode: 'PILOT',
    demoBinding: { fake: true }
  }), /PILOT_DEMO_BINDING_FORBIDDEN/);
});
