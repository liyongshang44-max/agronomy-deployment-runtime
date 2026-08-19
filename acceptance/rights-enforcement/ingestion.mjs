import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore, PilotSourceIngestionService } from '../../packages/source-ingestion/src/index.mjs';
import { PilotRightsEnforcementService } from '../../apps/pilot-api/src/rights/enforcement.mjs';

const root = mkdtempSync(join(tmpdir(), 'adr-ra02-ingestion-'));
const operatorId = 'ra02-ingestion-operator';
const scope = { organizationId: 'org-ra02', tenantId: 'tenant-ra02' };
const bytes = Buffer.from('%PDF-1.7\nRA02 restart durable retention\n%%EOF\n');

function audit(eventId, inputRefs = []) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: 'USER', id: operatorId },
    inputRefs,
    details: { channel: 'rights-enforcement-ingestion-acceptance' }
  };
}

try {
  const ledger1 = new AuthorityLedger();
  const store1 = new FileSystemScopedArtifactStore({ rootDir: root });
  const registry1 = new SourceRegistry({ ledger: ledger1, artifactStore: store1 });
  const ingestion1 = new PilotSourceIngestionService({ sourceRegistry: registry1, artifactStore: store1 });
  const created = ingestion1.createUpload({
    scope,
    filename: 'ra02.pdf',
    source: {
      logicalId: 'source.ra02.restart', version: '1', sourceType: 'PUBLICATION', title: 'RA02 restart fixture',
      rights: { basis: 'metadata-only-not-authority' }
    },
    artifact: {
      logicalId: 'artifact.ra02.restart', version: '1', mediaType: 'application/pdf',
      materializationIdentity: 'ra02-restart-fixture',
      acquisition: { method: 'UPLOAD', acquiredAt: new Date().toISOString(), locator: 'fixture://ra02-restart' },
      rightsSnapshot: { basis: 'metadata-only-not-authority' }
    }
  });
  const preRegistered = ingestion1.preRegisterSource({ uploadId: created.uploadId, sourceAudit: audit('evt-ra02-preregister') });
  assert.equal(preRegistered.upload.state, 'CREATED');
  assert.equal(preRegistered.source.ref.kind, 'Source');
  assert.deepEqual(preRegistered.upload.sourceRef, preRegistered.source.ref);
  assert.equal(preRegistered.upload.sourceArtifactRef, undefined);

  const snapshot = { ledger: ledger1.exportSnapshot(), ingestion: ingestion1.exportSnapshot() };
  const ledger2 = AuthorityLedger.fromSnapshot(snapshot.ledger);
  const store2 = new FileSystemScopedArtifactStore({ rootDir: root });
  const registry2 = new SourceRegistry({ ledger: ledger2, artifactStore: store2 });
  const ingestion2 = new PilotSourceIngestionService({ sourceRegistry: registry2, artifactStore: store2, snapshot: snapshot.ingestion });
  const restored = ingestion2.getUpload(created.uploadId);
  assert.equal(restored.state, 'CREATED');
  assert.deepEqual(restored.sourceRef, preRegistered.source.ref);
  assert.equal(restored.sourceArtifactRef, undefined);

  const rights = new PilotRightsEnforcementService({ ledger: ledger2, operatorId, evaluatorId: 'ra02-rights-engine' });
  const provisioned = rights.provision({
    subjectRef: restored.sourceRef,
    basisClass: 'LICENSE',
    rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SCIENTIFIC_KNOWLEDGE_INGESTION'], jurisdictions: ['GB'], obligations: [] }],
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    version: 'restart-retention'
  });
  const retained = await rights.execute({
    rightsPolicyRef: provisioned.rightsPolicyRef,
    subjectRef: restored.sourceRef,
    actorId: operatorId,
    actorType: 'USER',
    operation: 'RETAIN_FULLTEXT',
    purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION',
    jurisdiction: 'GB',
    sideEffect: async () => ingestion2.uploadPdf({ uploadId: created.uploadId, readable: Readable.from([bytes]) })
  });
  assert.equal(retained.result.state, 'STORED');
  const finalized = ingestion2.finalizeUpload({
    uploadId: created.uploadId,
    sourceAudit: audit('evt-ra02-finalize-source-unused'),
    artifactAudit: audit('evt-ra02-finalize-artifact', [retained.rightsDecisionRef])
  });
  assert.deepEqual(finalized.source.ref, restored.sourceRef, 'finalize must reuse exact pre-registered Source');
  assert.equal(finalized.sourceArtifact.ref.kind, 'SourceArtifact');
  const sourceRecords = ledger2.exportSnapshot().records.filter((record) => record.ref.kind === 'Source');
  assert.equal(sourceRecords.length, 1, 'pre-registration/finalize must not duplicate Source authority');
  const artifactAudit = ledger2.auditFor(finalized.sourceArtifact.ref).find((event) => event.action === 'PUBLISH_AUTHORITY');
  assert.ok(artifactAudit.inputRefs.some((ref) => ref.semanticHash === retained.rightsDecisionRef.semanticHash));

  console.log(JSON.stringify({
    total: 1,
    passed: 1,
    failed: 0,
    preRetentionSourceRestartDurable: true,
    exactSourceReusedAtFinalize: true,
    retentionDecisionInArtifactProvenance: true
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
