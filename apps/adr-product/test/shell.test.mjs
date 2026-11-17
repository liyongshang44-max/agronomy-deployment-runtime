import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createProductServer } from '../src/server.mjs';

let demo, demoBase;
before(async () => {
  demo = createProductServer({ mode: 'DEMO' });
  await new Promise((resolve) => demo.listen(0, '127.0.0.1', resolve));
  demoBase = 'http://127.0.0.1:' + demo.address().port;
});
after(async () => {
  if (demo) await new Promise((resolve) => demo.close(resolve));
});

test('demo metadata cannot masquerade as science or customer authority', async () => {
  const res = await fetch(demoBase + '/api/meta');
  const meta = await res.json();
  assert.equal(res.status, 200);
  assert.equal(meta.mode, 'DEMO');
  assert.equal(meta.authorityWritesAvailable, false);
  assert.equal(meta.customerAuthReady, false);
  assert.equal(meta.dataOrigin, 'SYNTHETIC_DEMO_ONLY');
});

test('all original ADR six classifications display as synthetic cases', async () => {
  const res = await fetch(demoBase + '/api/cases');
  const cases = await res.json();
  assert.equal(res.status, 200);
  assert.equal(cases.length, 6);
  assert.equal(new Set(cases.map((c) => c.classification)).size, 6);
  assert.equal(cases.every((c) => c.synthetic === true && c.authoritative === false), true);
  assert.equal(cases.every((c) => c.assessmentAuthorityRef === null && c.projectionHash === null), true);
  assert.equal(cases.find((c) => c.classification === 'NO_REVIEW_CANDIDATE').reviewRequired, false);
});

test('shell serves direct routes and applies browser security headers', async () => {
  const res = await fetch(demoBase + '/reviews/DEMO-001');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /zh-CN/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(res.headers.get('cache-control'), /no-store/);
});

test('no authority write or customer path is available in demo mode', async () => {
  const attempted = await fetch(demoBase + '/api/cases', { method: 'POST' });
  assert.equal(attempted.status, 405);
  const missing = await fetch(demoBase + '/api/cases/DEMO-999');
  assert.equal(missing.status, 404);
  const nonexistent = await fetch(demoBase + '/v1/decision-problems');
  assert.equal(nonexistent.status, 404);
});

test('PILOT mode never falls back to synthetic cases', async () => {
  const server = createProductServer({ mode: 'PILOT' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const meta = await (await fetch(base + '/api/meta')).json();
    assert.equal(meta.mode, 'PILOT');
    assert.equal(meta.dataOrigin, 'NOT_CONFIGURED');
    const response = await fetch(base + '/api/cases');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'CUSTOMER_AUTH_BINDING_NOT_CONFIGURED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid runtime mode fails before listening', () => {
  assert.throws(() => createProductServer({ mode: 'PRODUCTION' }), /ADR_PRODUCT_MODE/);
});
