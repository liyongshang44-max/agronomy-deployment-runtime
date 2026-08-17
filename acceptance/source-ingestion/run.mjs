import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry, SourceRegistryError } from '../../packages/source-registry/src/index.mjs';
import {
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService,
  SourceIngestionError
} from '../../packages/source-ingestion/src/index.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };

function audit(eventId, actorId = 'pilot-operator') {
  return {
    eventId,
    occurredAt: '2026-08-18T02:00:00.000Z',
    actor: { type: 'USER', id: actorId },
    details: { channel: 'source-ingestion-acceptance' }
  };
}

function setup({ maxUploadBytes = 64 * 1024 * 1024 } = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'adr-source-ingestion-'));
  const ledger = new AuthorityLedger();
  const artifactStore = new FileSystemScopedArtifactStore({ rootDir });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const service = new PilotSourceIngestionService({ sourceRegistry, artifactStore, maxUploadBytes });
  return {
    rootDir,
    ledger,
    artifactStore,
    sourceRegistry,
    service,
    cleanup: () => rmSync(rootDir, { recursive: true, force: true })
  };
}

function createUpload(service, suffix = 'large') {
  return service.createUpload({
    scope: SCOPE,
    filename: `${suffix}.pdf`,
    source: {
      logicalId: `source.paper.${suffix}`,
      version: '1',
      sourceType: 'PUBLICATION',
      title: `Streaming PDF ${suffix}`,
      bibliographic: { doi: `10.0000/${suffix}` },
      rights: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
    },
    artifact: {
      logicalId: `artifact.paper.${suffix}`,
      version: '1',
      mediaType: 'application/pdf',
      materializationIdentity: `customer-upload:${suffix}`,
      acquisition: {
        method: 'UPLOAD',
        acquiredAt: '2026-08-18T02:00:00.000Z',
        locator: `upload://${suffix}`
      },
      rightsSnapshot: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
    }
  });
}

function deterministicPdfStream({ bodyBytes, chunkBytes = 64 * 1024 }) {
  const expected = createHash('sha256');
  let expectedLength = 0;
  const header = Buffer.from('%PDF-1.7\n', 'ascii');
  const trailer = Buffer.from('\n%%EOF\n', 'ascii');
  const bodyChunk = Buffer.alloc(chunkBytes, 0x41);

  async function* chunks() {
    expected.update(header);
    expectedLength += header.byteLength;
    yield header;
    let remaining = bodyBytes;
    while (remaining > 0) {
      const size = Math.min(remaining, bodyChunk.byteLength);
      const chunk = bodyChunk.subarray(0, size);
      expected.update(chunk);
      expectedLength += chunk.byteLength;
      yield chunk;
      remaining -= size;
    }
    expected.update(trailer);
    expectedLength += trailer.byteLength;
    yield trailer;
  }

  return {
    readable: Readable.from(chunks()),
    result: () => ({
      contentHash: `sha256:${expected.digest('hex')}`,
      byteLength: expectedLength
    })
  };
}

async function collectHash(readable) {
  const hash = createHash('sha256');
  let byteLength = 0;
  for await (const chunk of readable) {
    hash.update(chunk);
    byteLength += chunk.byteLength;
  }
  return { contentHash: `sha256:${hash.digest('hex')}`, byteLength };
}

function scopedObjectPath(rootDir, scope, contentHash) {
  const key = createHash('sha256')
    .update(JSON.stringify([scope.organizationId, scope.tenantId ?? null]), 'utf8')
    .digest('hex');
  return join(rootDir, key, 'objects', contentHash.slice('sha256:'.length));
}

async function expectAsyncError(fn, ErrorType, code) {
  let caught;
  try {
    await fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
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
function test(name, fn) { tests.push({ name, fn }); }

test('large PDF is streamed into scoped content-addressable retention before authority finalization', async () => {
  const env = setup();
  try {
    const upload = createUpload(env.service, 'large-16m');
    const generated = deterministicPdfStream({ bodyBytes: 16 * 1024 * 1024 });
    const stored = await env.service.uploadPdf({ uploadId: upload.uploadId, readable: generated.readable });
    const expected = generated.result();

    assert.equal(stored.state, 'STORED');
    assert.equal(stored.retentionReceipt.contentHash, expected.contentHash);
    assert.equal(stored.retentionReceipt.byteLength, expected.byteLength);
    assert.ok(!('bytes' in stored));

    const finalized = env.service.finalizeUpload({
      uploadId: upload.uploadId,
      sourceAudit: audit('evt-source-large'),
      artifactAudit: audit('evt-artifact-large')
    });
    assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');
    assert.equal(finalized.sourceArtifact.semanticPayload.contentHash, expected.contentHash);
    assert.equal(finalized.sourceArtifact.semanticPayload.byteLength, expected.byteLength);
    assert.equal(finalized.sourceArtifact.semanticPayload.retention.retentionId, stored.retentionReceipt.retentionId);

    const streamed = await collectHash(env.sourceRegistry.readArtifactStream(finalized.sourceArtifact.ref));
    assert.deepEqual(streamed, expected);
  } finally {
    env.cleanup();
  }
});

test('same evidence hash remains tenant-scoped in retained storage', async () => {
  const env = setup();
  try {
    const upload = createUpload(env.service, 'tenant-scope');
    const generated = deterministicPdfStream({ bodyBytes: 1024 * 1024 });
    const stored = await env.service.uploadPdf({ uploadId: upload.uploadId, readable: generated.readable });
    generated.result();

    assert.equal(env.artifactStore.hasForScope(SCOPE, stored.retentionReceipt.contentHash), true);
    assert.equal(env.artifactStore.hasForScope(
      { organizationId: 'org-a', tenantId: 'tenant-b' },
      stored.retentionReceipt.contentHash
    ), false);
    expectError(() => env.artifactStore.inspectForScope(
      { organizationId: 'org-a', tenantId: 'tenant-b' },
      stored.retentionReceipt.contentHash
    ), SourceIngestionError, 'ARTIFACT_CONTENT_NOT_RETAINED');
  } finally {
    env.cleanup();
  }
});

test('SourceRegistry rejects a forged retained receipt rather than trusting caller metadata', async () => {
  const env = setup();
  try {
    const upload = createUpload(env.service, 'forged-receipt');
    const generated = deterministicPdfStream({ bodyBytes: 256 * 1024 });
    const stored = await env.service.uploadPdf({ uploadId: upload.uploadId, readable: generated.readable });
    generated.result();
    const source = env.sourceRegistry.registerSource({
      logicalId: 'source.paper.forged-direct', version: '1', sourceType: 'PUBLICATION', title: 'Forged direct',
      ownership: SCOPE, rights: {}, audit: audit('evt-forged-source')
    });

    expectError(() => env.sourceRegistry.materializeRetainedArtifact({
      logicalId: 'artifact.paper.forged-direct',
      version: '1',
      sourceRef: source.ref,
      retentionReceipt: { ...stored.retentionReceipt, byteLength: stored.retentionReceipt.byteLength + 1 },
      mediaType: 'application/pdf',
      materializationIdentity: 'forged',
      acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-18T02:00:00Z' },
      audit: audit('evt-forged-artifact')
    }), SourceRegistryError, 'RETENTION_RECEIPT_MISMATCH');
  } finally {
    env.cleanup();
  }
});

test('same-length retained-byte tampering is detected before SourceArtifact authority is minted', async () => {
  const env = setup();
  try {
    const upload = createUpload(env.service, 'tamper-before-finalize');
    const generated = deterministicPdfStream({ bodyBytes: 512 * 1024 });
    const stored = await env.service.uploadPdf({ uploadId: upload.uploadId, readable: generated.readable });
    generated.result();

    const objectPath = scopedObjectPath(env.rootDir, SCOPE, stored.retentionReceipt.contentHash);
    const fd = openSync(objectPath, 'r+');
    try {
      writeSync(fd, Buffer.from('X'), 0, 1, 0);
    } finally {
      closeSync(fd);
    }

    expectError(() => env.service.finalizeUpload({
      uploadId: upload.uploadId,
      sourceAudit: audit('evt-tampered-source'),
      artifactAudit: audit('evt-tampered-artifact')
    }), SourceIngestionError, 'RETAINED_OBJECT_HASH_MISMATCH');
    assert.equal(env.ledger.listVersions('SourceArtifact', 'artifact.paper.tamper-before-finalize').length, 0);
  } finally {
    env.cleanup();
  }
});

test('streaming upload enforces measured server-side size limit and fails closed', async () => {
  const env = setup({ maxUploadBytes: 1024 * 1024 });
  try {
    const upload = createUpload(env.service, 'too-large');
    const generated = deterministicPdfStream({ bodyBytes: 2 * 1024 * 1024 });
    await expectAsyncError(
      () => env.service.uploadPdf({ uploadId: upload.uploadId, readable: generated.readable }),
      SourceIngestionError,
      'SOURCE_UPLOAD_TOO_LARGE'
    );
    assert.equal(env.service.getUpload(upload.uploadId).state, 'FAILED');
  } finally {
    env.cleanup();
  }
});

test('non-PDF bytes are rejected after streaming validation and cannot be finalized', async () => {
  const env = setup();
  try {
    const upload = createUpload(env.service, 'not-pdf');
    await expectAsyncError(
      () => env.service.uploadPdf({ uploadId: upload.uploadId, readable: Readable.from([Buffer.from('not a pdf')]) }),
      SourceIngestionError,
      'PDF_SIGNATURE_INVALID'
    );
    assert.equal(env.service.getUpload(upload.uploadId).state, 'FAILED');
    expectError(
      () => env.service.finalizeUpload({
        uploadId: upload.uploadId,
        sourceAudit: audit('evt-invalid-source'),
        artifactAudit: audit('evt-invalid-artifact')
      }),
      SourceIngestionError,
      'SOURCE_UPLOAD_STATE_INVALID'
    );
  } finally {
    env.cleanup();
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`source ingestion acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
