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
    claims: [{
      key: 'recovery-claim',
      claimType: 'BOUNDARY_CONSTRAINT',
      assertion: 'Recovery fixture boundary claim.',
      confidence: 0.9,
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: { page: 1, evidenceText: 'recovery fixture' }
      },
      sourceContext: context()
    }]
  },
  audit: audit('evt-recovery-import')
});
assert.equal(imported.candidates.length, 1);

const reviewed = new PilotReviewAdapter({ ledger: ledger1, operatorId: 'pilot-recovery-reviewer' }).review({
  compilationResultRef: imported.compilation.ref,
  claimCandidateRef: imported.candidates[0].claimCandidateRef,
  sourceContextCandidateRef: imported.candidates[0].sourceContextCandidateRef,
  disposition: 'REJECT_SOURCE_FAITHFUL',
  reasonCodes: ['REVIEWER_SOURCE_FAITHFUL_REJECTION'],
  rationale: 'Recovery fixture rejection',
  version: 'review-1'
});
assert.equal(reviewed.claim, null);

const snapshot = ledger1.exportSnapshot();
const beforeRecordCount = snapshot.records.length;
const ledger2 = AuthorityLedger.fromSnapshot(snapshot);
const recovered = listRecoverableCompilations({ ledger: ledger2, sourceArtifactRef: artifact.ref });
const afterRecordCount = ledger2.exportSnapshot().records.length;

assert.equal(afterRecordCount, beforeRecordCount, 'recovery must be read-only');
assert.equal(recovered.compilationCount, 1);
assert.deepEqual(recovered.compilations[0].compilationResultRef, imported.compilation.ref);
assert.equal(recovered.compilations[0].runMetadata.providerLabel, 'MODEL_C_WEB');
assert.equal(recovered.compilations[0].runMetadata.modelLabel, 'UNKNOWN_MODEL');
assert.equal(recovered.compilations[0].candidateCount, 1);
assert.equal(recovered.compilations[0].reviewedCount, 1);
assert.deepEqual(recovered.compilations[0].candidates[0].claimCandidateRef, imported.candidates[0].claimCandidateRef);
assert.deepEqual(recovered.compilations[0].candidates[0].sourceContextCandidateRef, imported.candidates[0].sourceContextCandidateRef);
assert.equal(recovered.compilations[0].candidates[0].review.disposition, 'REJECT_SOURCE_FAITHFUL');
assert.equal(recovered.compilations[0].candidates[0].review.rationale, 'Recovery fixture rejection');

console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
