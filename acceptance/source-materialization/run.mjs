import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { makeAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  ExactArtifactStore,
  SourceRegistry,
  SourceRegistryError,
  sourceContentHash
} from '../../packages/source-registry/src/index.mjs';

function audit(eventId, actorId = 'source-admin') {
  return {
    eventId,
    occurredAt: '2026-08-15T13:30:00.000Z',
    actor: { type: 'USER', id: actorId },
    details: { channel: 'source-materialization-acceptance' }
  };
}

function makeRegistry() {
  const ledger = new AuthorityLedger();
  const artifactStore = new ExactArtifactStore();
  return { ledger, artifactStore, registry: new SourceRegistry({ ledger, artifactStore }) };
}

function source(registry, overrides = {}) {
  return registry.registerSource({
    logicalId: overrides.logicalId ?? 'source.corn-irrigation-protocol',
    version: overrides.version ?? '1',
    sourceType: overrides.sourceType ?? 'PROTOCOL',
    title: overrides.title ?? 'Corn Irrigation Protocol',
    ownership: overrides.ownership ?? { organizationId: 'org-a', tenantId: 'tenant-a' },
    bibliographic: overrides.bibliographic ?? { authoringOrganization: 'Example Agronomy Co' },
    edition: overrides.edition ?? '2026-A',
    sourceVersionLabel: overrides.sourceVersionLabel ?? 'rev-A',
    originLocator: overrides.originLocator ?? 'https://example.invalid/protocol/corn-water',
    rights: overrides.rights ?? { license: 'PRIVATE', allowedUse: 'internal-evaluation' },
    metadata: overrides.metadata ?? { language: 'en' },
    audit: audit(`evt-source-${overrides.logicalId ?? 'default'}-${overrides.version ?? '1'}`)
  });
}

function artifact(registry, sourceRef, bytes, overrides = {}) {
  return registry.materializeArtifact({
    logicalId: overrides.logicalId ?? 'artifact.corn-irrigation-protocol',
    version: overrides.version ?? '1',
    sourceRef,
    bytes,
    mediaType: overrides.mediaType ?? 'application/pdf',
    materializationIdentity: overrides.materializationIdentity ?? 'retained-pdf-2026-08-15',
    acquisition: overrides.acquisition ?? {
      method: 'HTTP_SNAPSHOT',
      acquiredAt: '2026-08-15T13:31:00.000Z',
      locator: 'https://example.invalid/protocol/corn-water.pdf',
      metadata: { responseEtag: 'fixture-etag-a' }
    },
    rightsSnapshot: overrides.rightsSnapshot ?? { license: 'PRIVATE', allowedUse: 'internal-evaluation' },
    metadata: overrides.metadata ?? { note: 'acceptance fixture' },
    audit: audit(`evt-artifact-${overrides.logicalId ?? 'default'}-${overrides.version ?? '1'}`)
  });
}

function expectError(fn, ErrorType, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('Source is logical provenance identity and does not contain exact compiled bytes', () => {
  const { registry } = makeRegistry();
  const record = source(registry);
  assert.equal(record.ref.kind, 'Source');
  assert.equal(record.semanticPayload.title, 'Corn Irrigation Protocol');
  assert.equal(record.semanticPayload.originLocator, 'https://example.invalid/protocol/corn-water');
  assert.equal(record.semanticPayload.ownership.tenantId, 'tenant-a');
  assert.ok(!('contentHash' in record.semanticPayload));
  assert.ok(!('bytes' in record.semanticPayload));
});

test('SourceArtifact requires exact bytes and binds raw-byte SHA-256 content identity', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const bytes = Buffer.from('%PDF-1.7\nfixture-a\n', 'utf8');
  const retained = artifact(registry, src.ref, bytes);

  assert.equal(retained.ref.kind, 'SourceArtifact');
  assert.equal(retained.semanticPayload.sourceRef.semanticHash, src.ref.semanticHash);
  assert.equal(retained.semanticPayload.contentHash, sourceContentHash(bytes));
  assert.equal(retained.semanticPayload.byteLength, bytes.byteLength);
  assert.equal(retained.semanticPayload.mediaType, 'application/pdf');
});

test('same logical Source can have multiple immutable SourceArtifact materializations', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const first = artifact(registry, src.ref, Buffer.from('edition-A'), {
    logicalId: 'artifact.protocol.pdf',
    version: '1',
    materializationIdentity: 'pdf-A'
  });
  const second = artifact(registry, src.ref, Buffer.from('edition-A-html-snapshot'), {
    logicalId: 'artifact.protocol.html',
    version: '1',
    mediaType: 'text/html',
    materializationIdentity: 'html-A',
    acquisition: {
      method: 'HTTP_SNAPSHOT',
      acquiredAt: '2026-08-15T13:32:00.000Z',
      locator: 'https://example.invalid/protocol/corn-water'
    }
  });

  assert.equal(first.semanticPayload.sourceRef.semanticHash, src.ref.semanticHash);
  assert.equal(second.semanticPayload.sourceRef.semanticHash, src.ref.semanticHash);
  assert.notEqual(first.semanticPayload.contentHash, second.semanticPayload.contentHash);
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('mutable locator returning changed bytes yields a new exact content identity', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const locator = 'https://example.invalid/protocol/current.pdf';
  const first = artifact(registry, src.ref, Buffer.from('content-v1'), {
    logicalId: 'artifact.mutable-url',
    version: '1',
    materializationIdentity: 'snapshot-1',
    acquisition: { method: 'HTTP_SNAPSHOT', acquiredAt: '2026-08-15T13:33:00Z', locator }
  });
  const second = artifact(registry, src.ref, Buffer.from('content-v2'), {
    logicalId: 'artifact.mutable-url',
    version: '2',
    materializationIdentity: 'snapshot-2',
    acquisition: { method: 'HTTP_SNAPSHOT', acquiredAt: '2026-08-16T13:33:00Z', locator }
  });

  assert.equal(first.semanticPayload.acquisition.locator, second.semanticPayload.acquisition.locator);
  assert.notEqual(first.semanticPayload.contentHash, second.semanticPayload.contentHash);
});

test('SourceArtifact cannot be materialized from a URL or text value without exact bytes', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  expectError(() => registry.materializeArtifact({
    logicalId: 'artifact.no-bytes',
    version: '1',
    sourceRef: src.ref,
    bytes: 'https://example.invalid/file.pdf',
    mediaType: 'application/pdf',
    materializationIdentity: 'invalid',
    acquisition: { method: 'HTTP_SNAPSHOT', acquiredAt: '2026-08-15T13:34:00Z' },
    audit: audit('evt-no-bytes')
  }), SourceRegistryError, 'EXACT_BYTES_REQUIRED');
});

test('retained artifact reads are byte-exact copies and caller mutation cannot alter retention', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const original = Buffer.from('immutable-retained-bytes');
  const retained = artifact(registry, src.ref, original);

  const firstRead = registry.readArtifactBytes(retained.ref);
  assert.deepEqual(firstRead, original);
  firstRead[0] = 0x00;
  const secondRead = registry.readArtifactBytes(retained.ref);
  assert.deepEqual(secondRead, original);
});

test('content-addressed retention deduplicates identical bytes without collapsing SourceArtifact authority', () => {
  const { registry, artifactStore } = makeRegistry();
  const srcA = source(registry, { logicalId: 'source.a', title: 'Source A' });
  const srcB = source(registry, { logicalId: 'source.b', title: 'Source B' });
  const bytes = Buffer.from('shared-exact-content');
  const a = artifact(registry, srcA.ref, bytes, { logicalId: 'artifact.a' });
  const b = artifact(registry, srcB.ref, bytes, { logicalId: 'artifact.b' });

  assert.equal(a.semanticPayload.contentHash, b.semanticPayload.contentHash);
  assert.equal(artifactStore.count(), 1);
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
  assert.notEqual(a.semanticPayload.sourceRef.semanticHash, b.semanticPayload.sourceRef.semanticHash);
});

test('same SourceArtifact logical version cannot be repointed to different bytes', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  artifact(registry, src.ref, Buffer.from('artifact-one'), {
    logicalId: 'artifact.immutable-version', version: '1', materializationIdentity: 'm1'
  });

  expectError(() => artifact(registry, src.ref, Buffer.from('artifact-two'), {
    logicalId: 'artifact.immutable-version', version: '1', materializationIdentity: 'm1'
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('artifact materialization requires a real exact Source ref and rejects forged source hash', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const forged = makeAuthorityRef({
    ...src.ref,
    semanticHash: semanticHash('Source', { forged: true })
  });

  expectError(() => artifact(registry, forged, Buffer.from('content'), { logicalId: 'artifact.forged-source' }), AuthorityLedgerError, 'AUTHORITY_HASH_MISMATCH');
});

test('Source rights and ownership metadata remain source provenance and are retained exactly', () => {
  const { registry } = makeRegistry();
  const src = source(registry, {
    logicalId: 'source.private-seedco',
    ownership: { organizationId: 'seedco', tenantId: 'seedco-private' },
    rights: {
      license: 'PROPRIETARY',
      permittedOrganizations: ['seedco'],
      trainingUse: 'PROHIBITED'
    }
  });
  assert.deepEqual(src.semanticPayload.ownership, { organizationId: 'seedco', tenantId: 'seedco-private' });
  assert.equal(src.semanticPayload.rights.trainingUse, 'PROHIBITED');
});

test('SourceArtifact acquisition and retention identity are immutable semantic bindings', () => {
  const { registry } = makeRegistry();
  const src = source(registry);
  const retained = artifact(registry, src.ref, Buffer.from('artifact-acquisition'), {
    acquisition: {
      method: 'UPLOAD',
      acquiredAt: '2026-08-15T13:35:12+00:00',
      locator: 'customer-upload://protocol-77',
      metadata: { uploaderRef: 'principal-77' }
    }
  });

  assert.equal(retained.semanticPayload.acquisition.acquiredAt, '2026-08-15T13:35:12.000Z');
  assert.equal(retained.semanticPayload.retention.retentionId, retained.semanticPayload.contentHash);
  assert.equal(retained.semanticPayload.acquisition.metadata.uploaderRef, 'principal-77');
});

test('Source version/edition supersession is explicit lineage rather than inferred from version labels', () => {
  const { registry, ledger } = makeRegistry();
  const oldSource = source(registry, {
    logicalId: 'source.protocol-versioned', version: '1', edition: '2025', sourceVersionLabel: '2025'
  });
  const newSource = source(registry, {
    logicalId: 'source.protocol-versioned', version: '2', edition: '2026', sourceVersionLabel: '2026'
  });

  assert.equal(ledger.lineageFor(oldSource.ref).length, 0);
  registry.linkSourceSupersedes({
    newerSourceRef: newSource.ref,
    olderSourceRef: oldSource.ref,
    audit: audit('evt-source-supersedes')
  });
  const lineage = ledger.lineageFor(oldSource.ref);
  assert.equal(lineage.length, 1);
  assert.equal(lineage[0].relation, 'supersedes');
});

test('artifact audit binds the exact Source authority input used for materialization', () => {
  const { registry, ledger } = makeRegistry();
  const src = source(registry);
  const retained = artifact(registry, src.ref, Buffer.from('audit-artifact'));
  const events = ledger.auditFor(retained.ref);
  assert.equal(events.length, 1);
  assert.ok(events[0].inputRefs.some((ref) => ref.semanticHash === src.ref.semanticHash));
});

test('Source and SourceArtifact semantic identities remain distinct even when titles/metadata overlap', () => {
  const { registry } = makeRegistry();
  const src = source(registry, { logicalId: 'source.distinct' });
  const retained = artifact(registry, src.ref, Buffer.from('Corn Irrigation Protocol'), { logicalId: 'artifact.distinct' });
  assert.equal(src.ref.kind, 'Source');
  assert.equal(retained.ref.kind, 'SourceArtifact');
  assert.notEqual(src.ref.semanticHash, retained.ref.semanticHash);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
