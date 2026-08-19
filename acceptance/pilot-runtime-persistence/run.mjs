import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService,
  SourceIngestionError
} from '../../packages/source-ingestion/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import { PilotReviewAdapter } from '../../apps/pilot-api/src/review/pilot-review.mjs';
import {
  PilotCheckpointError,
  loadPilotCheckpoint,
  savePilotCheckpoint
} from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };
const PDF = Buffer.from('%PDF-1.7\nrestart durable fixture\n%%EOF\n');

function audit(eventId, actorId = 'pilot-persistence-fixture', type = 'SERVICE_ACCOUNT') {
  return {
    eventId,
    occurredAt: '2026-08-18T03:00:00.000Z',
    actor: { type, id: actorId },
    details: { channel: 'pilot-runtime-persistence-acceptance' }
  };
}

function uploadDraft(service) {
  return service.createUpload({
    scope: SCOPE,
    filename: 'restart.pdf',
    source: {
      logicalId: 'source.paper.restart',
      version: '1',
      sourceType: 'PUBLICATION',
      title: 'Restart Durable Paper',
      rights: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
    },
    artifact: {
      logicalId: 'artifact.paper.restart',
      version: '1',
      mediaType: 'application/pdf',
      materializationIdentity: 'restart-fixture',
      acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T03:00:00.000Z', locator: 'fixture://restart.pdf' },
      rightsSnapshot: { basis: 'INTERNAL_EVALUATION', trainingUse: 'PROHIBITED' }
    }
  });
}

function proposal() {
  const contexts = Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
  contexts.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'restart durable fixture' } }
    }]
  };
  return {
    claims: [{
      key: 'restart-claim',
      claimType: 'BOUNDARY_CONSTRAINT',
      assertion: 'Restart durable fixture claim.',
      sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'restart durable fixture' } },
      sourceContext: contexts
    }],
    runMetadata: { fixture: 'restart-durable' }
  };
}

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'none'}`);
  assert.equal(caught.code, code);
}

const root = mkdtempSync(join(tmpdir(), 'adr-pilot-persistence-'));
try {
  const artifactDir = join(root, 'artifacts');
  const checkpointPath = join(root, 'runtime-checkpoint.json');
  const ledger1 = new AuthorityLedger();
  const store1 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry1 = new SourceRegistry({ ledger: ledger1, artifactStore: store1 });
  const ingestion1 = new PilotSourceIngestionService({ sourceRegistry: registry1, artifactStore: store1 });

  const upload = uploadDraft(ingestion1);
  await ingestion1.uploadPdf({ uploadId: upload.uploadId, readable: Readable.from([PDF]) });
  const finalized = ingestion1.finalizeUpload({
    uploadId: upload.uploadId,
    sourceAudit: audit('evt-restart-source', 'pilot-operator', 'USER'),
    artifactAudit: audit('evt-restart-artifact', 'pilot-operator', 'USER')
  });

  const definition = createDeterministicCompilerDefinition({
    ledger: ledger1,
    logicalId: 'compiler.restart',
    version: '1',
    compilerId: 'restart-fixture',
    implementationVersion: '1',
    audit: audit('evt-restart-compiler')
  });
  const compiler = new ScientificCompiler({ ledger: ledger1, sourceRegistry: registry1 });
  const compiled = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.restart',
    version: '1',
    sourceArtifactRef: finalized.sourceArtifact.ref,
    compilerDefinitionRef: definition.ref,
    proposal: proposal(),
    audit: audit('evt-restart-compilation')
  });
  const review = new PilotReviewAdapter({ ledger: ledger1, operatorId: 'pilot-operator' }).review({
    compilationResultRef: compiled.result.ref,
    claimCandidateRef: compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: compiled.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: {
      BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
      ENVIRONMENTAL: [], MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: []
    },
    version: 'review-1'
  });

  const checkpointHash = savePilotCheckpoint({ path: checkpointPath, ledger: ledger1, ingestion: ingestion1 });
  assert.match(checkpointHash, /^sha256:[0-9a-f]{64}$/);

  const restoredPayload = loadPilotCheckpoint({ path: checkpointPath });
  const ledger2 = AuthorityLedger.fromSnapshot(restoredPayload.ledger);
  const store2 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry2 = new SourceRegistry({ ledger: ledger2, artifactStore: store2 });
  const ingestion2 = new PilotSourceIngestionService({
    sourceRegistry: registry2,
    artifactStore: store2,
    snapshot: restoredPayload.ingestion
  });

  const restoredUpload = ingestion2.getUpload(upload.uploadId);
  assert.equal(restoredUpload.state, 'SOURCE_MATERIALIZED');
  assert.deepEqual(restoredUpload.sourceRef, finalized.source.ref);
  assert.deepEqual(restoredUpload.sourceArtifactRef, finalized.sourceArtifact.ref);
  assert.deepEqual(ledger2.resolve(review.review.ref).ref, review.review.ref);
  assert.deepEqual(ledger2.resolve(review.claim.ref).ref, review.claim.ref);
  assert.deepEqual(ledger2.resolve(review.sourceContext.ref).ref, review.sourceContext.ref);

  const chunks = [];
  for await (const chunk of registry2.readArtifactStream(finalized.sourceArtifact.ref)) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), PDF);

  const envelope = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  envelope.payload.ingestion.sessions[0].filename = 'tampered.pdf';
  writeFileSync(checkpointPath, JSON.stringify(envelope));
  expectError(() => loadPilotCheckpoint({ path: checkpointPath }), PilotCheckpointError, 'PILOT_CHECKPOINT_HASH_MISMATCH');

  envelope.checkpointHash = semanticHash('AdrPilotLocalCheckpoint', envelope.payload);
  const firstAuthority = envelope.payload.ledger.records[0];
  firstAuthority.semanticPayload.title = 'tampered authority';
  envelope.checkpointHash = semanticHash('AdrPilotLocalCheckpoint', envelope.payload);
  writeFileSync(checkpointPath, JSON.stringify(envelope));
  const outerValidButAuthorityTampered = loadPilotCheckpoint({ path: checkpointPath });
  expectError(() => AuthorityLedger.fromSnapshot(outerValidButAuthorityTampered.ledger), AuthorityLedgerError, 'SNAPSHOT_AUTHORITY_HASH_MISMATCH');

  const cleanEnvelope = JSON.parse(JSON.stringify({
    format: 'ADR_PILOT_LOCAL_CHECKPOINT_V1',
    payload: { ledger: ledger1.exportSnapshot(), ingestion: ingestion1.exportSnapshot() }
  }));
  cleanEnvelope.checkpointHash = semanticHash('AdrPilotLocalCheckpoint', cleanEnvelope.payload);
  cleanEnvelope.payload.ingestion.sessions[0].retentionReceipt.byteLength += 1;
  cleanEnvelope.checkpointHash = semanticHash('AdrPilotLocalCheckpoint', cleanEnvelope.payload);
  writeFileSync(checkpointPath, JSON.stringify(cleanEnvelope));
  const badReceiptPayload = loadPilotCheckpoint({ path: checkpointPath });
  const ledger3 = AuthorityLedger.fromSnapshot(badReceiptPayload.ledger);
  const store3 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry3 = new SourceRegistry({ ledger: ledger3, artifactStore: store3 });
  expectError(
    () => new PilotSourceIngestionService({ sourceRegistry: registry3, artifactStore: store3, snapshot: badReceiptPayload.ingestion }),
    SourceIngestionError,
    'SOURCE_UPLOAD_SNAPSHOT_RETENTION_MISMATCH'
  );

  console.log(JSON.stringify({ total: 4, passed: 4, failed: 0 }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
