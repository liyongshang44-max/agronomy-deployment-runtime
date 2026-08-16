import assert from 'node:assert/strict';
import {
  DeploymentError,
  normalizeDeploymentTimestamp
} from '../../packages/deployment/src/index.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectInvalid(value) {
  assert.throws(
    () => normalizeDeploymentTimestamp(value),
    (error) => error instanceof DeploymentError && error.code === 'INVALID_DEPLOYMENT_TIME'
  );
}

test('impossible calendar dates cannot be normalized into another Deployment instant', () => {
  expectInvalid('2026-02-30T00:00:00Z');
  expectInvalid('2025-02-29T00:00:00Z');
});

test('Deployment timestamps reject timezone offsets outside deterministic RFC3339 authority bound', () => {
  expectInvalid('2026-08-16T00:00:00+14:01');
  expectInvalid('2026-08-16T00:00:00+15:00');
});

test('real leap-day and maximum +14:00 offset remain legal and canonicalize to UTC', () => {
  assert.equal(normalizeDeploymentTimestamp('2028-02-29T14:00:00+14:00'), '2028-02-29T00:00:00.000Z');
});

console.log('Deployment time hardening acceptance: 3 passed');
