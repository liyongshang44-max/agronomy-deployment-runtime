import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { ManualExternalProposalImportService } from '../../apps/pilot-api/src/extraction/manual-import.mjs';

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-18T04:00:00.000Z',
    actor: { type: 'USER', id: 'manual-import-acceptance' },
    details: { channel: 'manual-import-acceptance' }
  };
}

function notReported() { return { status: 'NOT_REPORTED', dimensions: [] }; }
function allContext() {
  return {
    BIOLOGICAL: notReported(),
    ENVIRONMENTAL: notReported(),
    MANAGEMENT: notReported(),
    OPERATIONAL: notReported(),
    MEASUREMENT: notReported(),
    JURISDICTION_ECONOMIC: notReported()
  };
}

function fixture() {
  const ledger = new AuthorityLedger();
  const artifactStore = new ExactArtifactStore();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.manual-import.fixture',
    version: '1',
    sourceType: 'PUBLICATION',
    title: 'Manual import fixture',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { basis: 'INTERNAL_EVALUATION' },
    audit: audit('evt-source')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.manual-import.fixture',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from('%PDF-1.7\nmanual import fixture'),
    mediaType: 'application/pdf',
    materializationIdentity: 'manual-import-fixture',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T04:00:00Z', locator: 'fixture://manual-import' },
    audit: audit('evt-artifact')
  });
  const service = new ManualExternalProposalImportService({ ledger, sourceRegistry, artifactStore });
  return { ledger, artifact, service };
}

const proposal = {
  promptVersion: 'adr-paper-extraction-prompt-v3',
  claims: [
    {
      key: 'valid-boundary',
      claimType: 'BOUNDARY_CONSTRAINT',
      assertion: 'Results are not expected to generalize to farms with different management routines.',
      confidence: 0.95,
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: { page: 7, evidenceText: 'external validity of estimates is low' }
      },
      sourceContext: allContext()
    },
    {
      key: 'invalid-measurement-type',
      claimType: 'MEASUREMENT',
      assertion: 'NDVI was used as a proxy for crop growth.',
      confidence: 1,
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: { page: 4, evidenceText: 'NDVI in order to obtain a reliable proxy' }
      },
      sourceContext: allContext()
    }
  ]
};

const first = fixture();
const imported = first.service.import({
  sourceArtifactRef: first.artifact.ref,
  proposal,
  providerLabel: 'DEEPSEEK_WEB',
  modelLabel: 'deepseek-v4-pro',
  compilationLogicalId: 'compilation.manual-import.deepseek-run-1',
  version: '1',
  audit: audit('evt-import')
});

assert.equal(imported.preflight.total, 2);
assert.equal(imported.preflight.reviewable, 1);
assert.equal(imported.preflight.invalid, 1);
assert.equal(imported.preflight.promptVersion, 'adr-paper-extraction-prompt-v3');
assert.equal(imported.preflight.invalidCandidates[0].key, 'invalid-measurement-type');
assert.equal(imported.preflight.invalidCandidates[0].error.code, 'INVALID_CLAIM_CANDIDATE_TYPE');
assert.equal(imported.materialized, true);
assert.equal(imported.candidates.length, 1);
assert.equal(imported.candidates[0].claimType, 'BOUNDARY_CONSTRAINT');
assert.equal(imported.compilation.semanticPayload.candidateCount, 1);
assert.equal(imported.compilation.semanticPayload.runMetadata.provider, 'MANUAL_EXTERNAL_PROPOSAL_IMPORT');
assert.equal(imported.compilation.semanticPayload.runMetadata.providerLabel, 'DEEPSEEK_WEB');
assert.equal(imported.compilation.semanticPayload.runMetadata.modelIdentityAuthority, 'OPERATOR_DECLARED_NOT_VERIFIED');
assert.equal(imported.compilation.semanticPayload.runMetadata.promptVersion, 'adr-paper-extraction-prompt-v3');
assert.equal(imported.compilation.semanticPayload.runMetadata.promptVersionAuthority, 'PROPOSAL_DECLARED_NOT_VERIFIED');
assert.equal(imported.compilation.semanticPayload.runMetadata.originalCandidateCount, 2);
assert.equal(imported.compilation.semanticPayload.runMetadata.invalidCandidateCount, 1);

const compilerDefinitions = first.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ScientificCompilerDefinition');
assert.equal(compilerDefinitions.length, 1);
assert.equal(compilerDefinitions[0].semanticPayload.configuration.promptVersion, 'adr-paper-extraction-prompt-v3');
assert.equal(compilerDefinitions[0].semanticPayload.configuration.promptVersionAuthority, 'PROPOSAL_DECLARED_NOT_VERIFIED');

const claimRecords = first.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ClaimCandidate');
assert.equal(claimRecords.length, 1);
assert.ok(claimRecords.every((record) => record.semanticPayload.claimType !== 'MEASUREMENT'));

const duplicate = fixture();
const duplicateProposal = {
  promptVersion: 'adr-paper-extraction-prompt-v3',
  claims: [
    { ...proposal.claims[0], key: 'same-key' },
    { ...proposal.claims[0], key: 'same-key', assertion: 'Second assertion with duplicate key.' }
  ]
};
const duplicateResult = duplicate.service.import({
  sourceArtifactRef: duplicate.artifact.ref,
  proposal: duplicateProposal,
  providerLabel: 'DEEPSEEK_WEB',
  modelLabel: 'deepseek-v4-pro',
  compilationLogicalId: 'compilation.manual-import.duplicates',
  version: '1',
  audit: audit('evt-import-duplicates')
});
assert.equal(duplicateResult.preflight.reviewable, 0);
assert.equal(duplicateResult.preflight.invalid, 2);
assert.equal(duplicateResult.preflight.promptVersion, 'adr-paper-extraction-prompt-v3');
assert.ok(duplicateResult.preflight.invalidCandidates.every((candidate) => candidate.error.code === 'DUPLICATE_CLAIM_KEY'));
assert.equal(duplicateResult.materialized, false);
assert.equal(duplicate.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ClaimCandidate').length, 0);

const legacy = fixture();
const legacyProposal = { claims: [{ ...proposal.claims[0], key: 'legacy-valid' }] };
const legacyResult = legacy.service.import({
  sourceArtifactRef: legacy.artifact.ref,
  proposal: legacyProposal,
  providerLabel: 'LEGACY_WEB',
  modelLabel: 'unknown',
  compilationLogicalId: 'compilation.manual-import.legacy-no-prompt-version',
  version: '1',
  audit: audit('evt-import-legacy')
});
assert.equal(legacyResult.preflight.promptVersion, 'NOT_REPORTED');
assert.equal(legacyResult.compilation.semanticPayload.runMetadata.promptVersion, 'NOT_REPORTED');
assert.equal(legacyResult.compilation.semanticPayload.runMetadata.promptVersionAuthority, 'PROPOSAL_DECLARED_NOT_VERIFIED');

console.log(JSON.stringify({ total: 3, passed: 3, failed: 0 }, null, 2));
