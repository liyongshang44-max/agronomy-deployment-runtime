import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { ManualExternalProposalImportService } from '../../apps/pilot-api/src/extraction/manual-import.mjs';
import { PilotReviewAdapter } from '../../apps/pilot-api/src/review/pilot-review.mjs';
import { listRecoverableCompilations } from '../../apps/pilot-api/src/recovery/compilation-recovery.mjs';

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-18T06:00:00.000Z',
    actor: { type: 'USER', id: 'pilot-recovery-acceptance' },
    details: { channel: 'pilot-compilation-recovery-acceptance' }
  };
}

function context() {
  const notReported = { status: 'NOT_REPORTED', dimensions: [] };
  return {
    BIOLOGICAL: notReported,
    ENVIRONMENTAL: notReported,
    MANAGEMENT: notReported,
    OPERATIONAL: notReported,
    MEASUREMENT: notReported,
    JURISDICTION_ECONOMIC: notReported
  };
}

function claim(key, assertion) {
  return {
    key,
    claimType: 'BOUNDARY_CONSTRAINT',
    assertion,
    confidence: 0.9,
    sourceLocator: {
      kind: 'DOCUMENT_COORDINATE',
      scheme: 'PDF_PAGE_TEXT_V1',
      coordinates: { page: 1, evidenceText: 'recovery fixture' }
    },
    sourceContext: context()
  };
}

const ledger1 = new AuthorityLedger();
const artifactStore = new ExactArtifactStore();
const registry1 = new SourceRegistry({ ledger: ledger1, artifactStore });
const source = registry1.registerSource({
  logicalId: 'source.recovery.paper',
  version: '1',
  sourceType: 'PUBLICATION',
  title: 'Recovery paper',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  rights: { basis: 'INTERNAL_EVALUATION' },
  audit: audit('evt-recovery-source')
});
const artifact = registry1.materializeArtifact({
  logicalId: 'artifact.recovery.paper',
  version: '1',
  sourceRef: source.ref,
  bytes: Buffer.from('%PDF-1.7\nrecovery fixture\n%%EOF\n'),
  mediaType: 'application/pdf',
  materializationIdentity: 'recovery-fixture',
  acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T06:00:00Z', locator: 'fixture://recovery' },
  audit: audit('evt-recovery-artifact')
});

const importer = new ManualExternalProposalImportService({ ledger: ledger1, sourceRegistry: registry1, artifactStore });
const imported = importer.import({
  sourceArtifactRef: artifact.ref,
  providerLabel: 'MODEL_C_WEB',
  modelLabel: 'UNKNOWN_MODEL',
  compilationLogicalId: 'compilation.recovery.paper',
  version: 'manual-2026-08-18T06:00:00.000Z',
  proposal: {
    claims: [
      claim('recovery-reject', 'Recovery fixture rejected boundary claim.'),
      claim('recovery-accept', 'Recovery fixture accepted boundary claim.')
    ]
  },
  audit: audit('evt-recovery-import')
});
assert.equal(imported.candidates.length, 2);

const adapter = new PilotReviewAdapter({ ledger: ledger1, operatorId: 'pilot-recovery-reviewer' });
const rejected = adapter.review({
  compilationResultRef: imported.compilation.ref,
  claimCandidateRef: imported.candidates[0].claimCandidateRef,
  sourceContextCandidateRef: imported.candidates[0].sourceContextCandidateRef,
  disposition: 'REJECT_SOURCE_FAITHFUL',
  reasonCodes: ['REVIEWER_SOURCE_FAITHFUL_REJECTION'],
  rationale: 'Recovery fixture rejection',
  version: 'review-1'
});
assert.equal(rejected.claim, null);

const accepted = adapter.review({
  compilationResultRef: imported.compilation.ref,
  claimCandidateRef: imported.candidates[1].claimCandidateRef,
  sourceContextCandidateRef: imported.candidates[1].sourceContextCandidateRef,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication: {
    BIOLOGICAL: [], ENVIRONMENTAL: [], MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: []
  },
  rationale: 'Recovery fixture acceptance',
  version: 'review-1'
});
assert.ok(accepted.claim);
assert.ok(accepted.sourceContext);

const snapshot = ledger1.exportSnapshot();
const beforeRecordCount = snapshot.records.length;
const ledger2 = AuthorityLedger.fromSnapshot(snapshot);
const recovered = listRecoverableCompilations({ ledger: ledger2, sourceArtifactRef: artifact.ref });
const afterRecordCount = ledger2.exportSnapshot().records.length;

assert.equal(afterRecordCount, beforeRecordCount, 'recovery must be read-only');
assert.equal(recovered.compilationCount, 1);
const compilation = recovered.compilations[0];
assert.deepEqual(compilation.compilationResultRef, imported.compilation.ref);
assert.equal(compilation.runMetadata.providerLabel, 'MODEL_C_WEB');
assert.equal(compilation.runMetadata.modelLabel, 'UNKNOWN_MODEL');
assert.equal(compilation.candidateCount, 2);
assert.equal(compilation.reviewedCount, 2);
assert.equal(compilation.acceptedCount, 1);
assert.equal(compilation.rejectedCount, 1);

assert.deepEqual(compilation.candidates[0].claimCandidateRef, imported.candidates[0].claimCandidateRef);
assert.deepEqual(compilation.candidates[0].sourceContextCandidateRef, imported.candidates[0].sourceContextCandidateRef);
assert.equal(compilation.candidates[0].review.disposition, 'REJECT_SOURCE_FAITHFUL');
assert.equal(compilation.candidates[0].review.rationale, 'Recovery fixture rejection');
assert.equal(compilation.candidates[0].review.claimRef, null);
assert.equal(compilation.candidates[0].review.sourceContextRef, null);

assert.deepEqual(compilation.candidates[1].claimCandidateRef, imported.candidates[1].claimCandidateRef);
assert.equal(compilation.candidates[1].review.disposition, 'ACCEPT_SOURCE_FAITHFUL');
assert.deepEqual(compilation.candidates[1].review.claimRef, accepted.claim.ref);
assert.deepEqual(compilation.candidates[1].review.sourceContextRef, accepted.sourceContext.ref);

console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
