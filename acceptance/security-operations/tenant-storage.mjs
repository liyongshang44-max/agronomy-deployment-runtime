import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  PilotSecureArtifactStore,
  SecurityOperationsError
} from '../../packages/security-operations/src/index.mjs';

const ledger = new AuthorityLedger();
const store = new PilotSecureArtifactStore();
const registry = new SourceRegistry({ ledger, artifactStore: store });

function audit(id) {
  return {
    eventId: `p07-tenant-store-${id}`,
    occurredAt: '2026-08-17T18:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'p07-tenant-store-test' }
  };
}

function registerSource(logicalId, tenantId) {
  return registry.registerSource({
    logicalId,
    version: '1',
    sourceType: 'PROTOCOL',
    title: logicalId,
    ownership: { organizationId: 'org-a', tenantId },
    rights: { exportClass: 'CONTROLLED' },
    audit: audit(`source-${tenantId}`)
  });
}

function materialize(logicalId, source, tenantId, bytes) {
  return registry.materializeArtifact({
    logicalId,
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'application/octet-stream',
    materializationIdentity: `tenant-store-${tenantId}`,
    acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-17T17:59:00.000Z' },
    rightsSnapshot: { exportClass: 'CONTROLLED' },
    audit: audit(`artifact-${tenantId}`)
  });
}

const scopeA = { organizationId: 'org-a', tenantId: 'tenant-a' };
const scopeB = { organizationId: 'org-a', tenantId: 'tenant-b' };
const bytes = Buffer.from('same-content-across-two-tenants');

const sourceA = registerSource('source.tenant-store.a', 'tenant-a');
const artifactA = materialize('artifact.tenant-store.a', sourceA, 'tenant-a', bytes);

assert.equal(typeof store.put, 'undefined');
assert.equal(typeof store.get, 'undefined');
assert.equal(typeof store.has, 'undefined');
assert.equal(typeof store.putForScope, 'function');
assert.equal(typeof store.getForScope, 'function');
assert.equal(typeof store.hasForScope, 'function');

assert.equal(store.hasForScope(scopeA, artifactA.semanticPayload.contentHash), true);
assert.equal(store.hasForScope(scopeB, artifactA.semanticPayload.contentHash), false);
assert.throws(
  () => store.getForScope(scopeB, artifactA.semanticPayload.contentHash),
  (error) => error instanceof SecurityOperationsError && error.code === 'ARTIFACT_CONTENT_NOT_RETAINED'
);
assert.deepEqual(registry.readArtifactBytes(artifactA.ref), bytes);

const sourceB = registerSource('source.tenant-store.b', 'tenant-b');
const artifactB = materialize('artifact.tenant-store.b', sourceB, 'tenant-b', bytes);

assert.equal(artifactA.semanticPayload.contentHash, artifactB.semanticPayload.contentHash);
assert.equal(store.count(), 2);
assert.equal(store.hasForScope(scopeA, artifactA.semanticPayload.contentHash), true);
assert.equal(store.hasForScope(scopeB, artifactB.semanticPayload.contentHash), true);
assert.deepEqual(store.getForScope(scopeA, artifactA.semanticPayload.contentHash), bytes);
assert.deepEqual(store.getForScope(scopeB, artifactB.semanticPayload.contentHash), bytes);
assert.deepEqual(registry.readArtifactBytes(artifactA.ref), bytes);
assert.deepEqual(registry.readArtifactBytes(artifactB.ref), bytes);

console.log('P07 tenant-scoped artifact storage acceptance: PASS');
