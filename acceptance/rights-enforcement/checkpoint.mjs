import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore, PilotSourceIngestionService } from '../../packages/source-ingestion/src/index.mjs';
import { publishRightsGrant, publishRightsPolicy } from '../../packages/rights-authority/src/index.mjs';
import {
  RightsEffectGate,
  RightsEnforcementError,
  RightsGovernedPilotSourceIngestion
} from '../../packages/rights-enforcement/src/index.mjs';
import {
  loadPilotCheckpoint,
  savePilotCheckpoint
} from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };
const OWNER = { principalId: 'rights-owner', type: 'USER', ...SCOPE };
const ACTOR = { principalId: 'pilot-operator', type: 'USER', ...SCOPE };
const EVALUATOR = { principalId: 'rights-engine', type: 'SERVICE_ACCOUNT', ...SCOPE };

function audit(eventId, principal, occurredAt, inputRefs = []) {
  return {
    eventId,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    inputRefs,
    details: { channel: 'rights-checkpoint-acceptance' }
  };
}

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const root = mkdtempSync(join(tmpdir(), 'adr-rights-checkpoint-'));
try {
  const artifactDir = join(root, 'artifacts');
  const checkpointPath = join(root, 'runtime-checkpoint.json');
  const ledger1 = new AuthorityLedger();
  const store1 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry1 = new SourceRegistry({ ledger: ledger1, artifactStore: store1 });
  const ingestion1 = new PilotSourceIngestionService({ sourceRegistry: registry1, artifactStore: store1 });
  const gate1 = new RightsEffectGate({ ledger: ledger1 });
  const policy = publishRightsPolicy({
    ledger: ledger1,
    logicalId: 'rights.policy.checkpoint',
    version: '1',
    ownership: SCOPE,
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit('evt-policy', OWNER, '2026-08-18T15:00:00Z')
  });
  const governed1 = new RightsGovernedPilotSourceIngestion({
    ledger: ledger1,
    sourceRegistry: registry1,
    ingestion: ingestion1,
    gate: gate1
  });
  const created = governed1.createUpload({
    scope: SCOPE,
    filename: 'checkpoint.pdf',
    source: {
      logicalId: 'source.checkpoint',
      version: '1',
      sourceType: 'PUBLICATION',
      title: 'Checkpoint governed source',
      rights: { basis: 'metadata-only' }
    },
    artifact: {
      logicalId: 'artifact.checkpoint',
      version: '1',
      mediaType: 'application/pdf',
      materializationIdentity: 'checkpoint-fixture',
      acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-18T15:00:00Z', locator: 'upload://checkpoint' },
      rightsSnapshot: { basis: 'metadata-only' }
    },
    rightsPolicyRef: policy.ref,
    sourceAudit: audit('evt-source', ACTOR, '2026-08-18T15:05:00Z')
  });
  publishRightsGrant({
    ledger: ledger1,
    logicalId: 'rights.grant.checkpoint-retain',
    version: '1',
    rightsPolicyRef: policy.ref,
    subjectRef: created.source.ref,
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type },
    rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }],
    validFrom: '2026-08-18T15:10:00Z',
    validUntil: '2026-08-19T15:10:00Z',
    grantorPrincipal: OWNER,
    audit: audit('evt-grant', OWNER, '2026-08-18T15:10:00Z')
  });
  const retained = await governed1.uploadPdf({
    uploadId: created.upload.uploadId,
    readable: Readable.from([Buffer.from('%PDF-1.7\ncheckpoint-governed\n%%EOF')]),
    rightsUse: {
      logicalId: 'rights.decision.checkpoint-retain',
      version: '1',
      rightsPolicyRef: policy.ref,
      subjectRef: created.source.ref,
      actor: ACTOR,
      evaluatorPrincipal: EVALUATOR,
      operation: 'RETAIN_FULLTEXT',
      purpose: 'SOURCE_RETENTION',
      jurisdiction: 'US',
      evaluatedAt: '2026-08-18T15:20:00Z',
      enforceableObligations: [],
      audit: audit('evt-decision', EVALUATOR, '2026-08-18T15:20:00Z')
    }
  });
  assert.ok(retained.governance.retentionRightsDecisionRef);

  savePilotCheckpoint({
    path: checkpointPath,
    ledger: ledger1,
    ingestion: ingestion1,
    rightsGovernance: governed1
  });
  const payload = loadPilotCheckpoint({ path: checkpointPath });
  assert.ok(payload.rightsGovernance);
  assert.equal(payload.rightsGovernance.records.length, 1);

  const ledger2 = AuthorityLedger.fromSnapshot(payload.ledger);
  const store2 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry2 = new SourceRegistry({ ledger: ledger2, artifactStore: store2 });
  const ingestion2 = new PilotSourceIngestionService({
    sourceRegistry: registry2,
    artifactStore: store2,
    snapshot: payload.ingestion
  });
  const governed2 = new RightsGovernedPilotSourceIngestion({
    ledger: ledger2,
    sourceRegistry: registry2,
    ingestion: ingestion2,
    gate: new RightsEffectGate({ ledger: ledger2 }),
    snapshot: payload.rightsGovernance
  });
  const recovered = governed2.getUpload(created.upload.uploadId);
  assert.equal(
    recovered.governance.retentionRightsDecisionRef.semanticHash,
    retained.governance.retentionRightsDecisionRef.semanticHash
  );
  const finalized = governed2.finalizeUpload({
    uploadId: created.upload.uploadId,
    artifactAudit: audit('evt-artifact-after-restart', ACTOR, '2026-08-18T15:30:00Z')
  });
  assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');
  const artifactAudit = ledger2.auditFor(finalized.sourceArtifact.ref)
    .find((event) => event.objectRef.semanticHash === finalized.sourceArtifact.ref.semanticHash);
  assert.ok(artifactAudit.inputRefs.some((ref) =>
    ref.semanticHash === retained.governance.retentionRightsDecisionRef.semanticHash));

  const envelope = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  envelope.payload.rightsGovernance.records[0].retentionRightsDecisionRef.semanticHash = `sha256:${'0'.repeat(64)}`;
  envelope.checkpointHash = semanticHash('AdrPilotLocalCheckpoint', envelope.payload);
  writeFileSync(checkpointPath, JSON.stringify(envelope));
  const outerValidTampered = loadPilotCheckpoint({ path: checkpointPath });
  const ledger3 = AuthorityLedger.fromSnapshot(outerValidTampered.ledger);
  const store3 = new FileSystemScopedArtifactStore({ rootDir: artifactDir });
  const registry3 = new SourceRegistry({ ledger: ledger3, artifactStore: store3 });
  const ingestion3 = new PilotSourceIngestionService({
    sourceRegistry: registry3,
    artifactStore: store3,
    snapshot: outerValidTampered.ingestion
  });
  expectError(() => new RightsGovernedPilotSourceIngestion({
    ledger: ledger3,
    sourceRegistry: registry3,
    ingestion: ingestion3,
    gate: new RightsEffectGate({ ledger: ledger3 }),
    snapshot: outerValidTampered.rightsGovernance
  }), Error, 'AUTHORITY_NOT_FOUND');

  const legacyPath = join(root, 'legacy-checkpoint.json');
  savePilotCheckpoint({ path: legacyPath, ledger: ledger1, ingestion: ingestion1 });
  const legacyPayload = loadPilotCheckpoint({ path: legacyPath });
  assert.equal('rightsGovernance' in legacyPayload, false);

  console.log(JSON.stringify({ total: 4, passed: 4, failed: 0 }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
