import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { ManualExternalProposalImportService } from '../../apps/pilot-api/src/extraction/manual-import.mjs';
import { PilotAutomatedSourceFaithfulReviewAdapter } from '../../apps/pilot-api/src/review/automated-review.mjs';
import { AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS } from '../../packages/knowledge-registry/src/automated-source-faithful.mjs';

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-19T04:50:00.000Z',
    actor: { type: 'USER', id: 'manual-identity-acceptance' },
    details: { channel: 'automated-review-manual-identity-acceptance' }
  };
}

function context() {
  return {
    BIOLOGICAL: { status: 'NOT_REPORTED', dimensions: [] },
    ENVIRONMENTAL: { status: 'NOT_REPORTED', dimensions: [] },
    MANAGEMENT: { status: 'NOT_REPORTED', dimensions: [] },
    OPERATIONAL: { status: 'NOT_REPORTED', dimensions: [] },
    MEASUREMENT: { status: 'NOT_REPORTED', dimensions: [] },
    JURISDICTION_ECONOMIC: { status: 'NOT_REPORTED', dimensions: [] }
  };
}

function adjudication() {
  return {
    BIOLOGICAL: [], ENVIRONMENTAL: [], MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: []
  };
}

function checks() {
  return Object.fromEntries(AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, 'PASS']));
}

function reviewer(provider = 'OPENAI_RESPONSES', model = 'review-model-b') {
  return {
    provider,
    model,
    promptVersion: 'adr-source-faithful-review-prompt-v1',
    schemaVersion: 'adr-source-faithful-review-output-v1',
    reviewMode: 'BLIND_FALSIFICATION'
  };
}

function output() {
  return {
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    reasonCodes: [],
    rationale: 'The unchanged candidate is directly supported by the exact source.',
    reviewConfidence: 0.98,
    checks: checks(),
    contextAdjudication: adjudication()
  };
}

function fixture({ providerLabel, modelLabel, suffix }) {
  const ledger = new AuthorityLedger();
  const artifactStore = new ExactArtifactStore();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const source = sourceRegistry.registerSource({
    logicalId: `source.manual-identity.${suffix}`,
    version: '1',
    sourceType: 'PUBLICATION',
    title: `Manual identity ${suffix}`,
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { basis: 'INTERNAL_EVALUATION' },
    audit: audit(`evt-source-${suffix}`)
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: `artifact.manual-identity.${suffix}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from('%PDF-1.7\nmanual identity source evidence\n%%EOF'),
    mediaType: 'application/pdf',
    materializationIdentity: `manual-identity-${suffix}`,
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-19T04:49:00Z', locator: `fixture://${suffix}` },
    audit: audit(`evt-artifact-${suffix}`)
  });
  const importer = new ManualExternalProposalImportService({ ledger, sourceRegistry, artifactStore });
  const imported = importer.import({
    sourceArtifactRef: artifact.ref,
    providerLabel,
    modelLabel,
    compilationLogicalId: `compilation.manual-identity.${suffix}`,
    version: '1',
    proposal: {
      promptVersion: 'adr-paper-extraction-prompt-v3',
      claims: [{
        key: 'boundary',
        claimType: 'BOUNDARY_CONSTRAINT',
        assertion: 'Manual identity source evidence.',
        confidence: 0.97,
        sourceLocator: {
          kind: 'DOCUMENT_COORDINATE',
          scheme: 'PDF_PAGE_TEXT_V1',
          coordinates: { page: 1, evidenceText: 'manual identity source evidence' }
        },
        sourceContext: context()
      }]
    },
    audit: audit(`evt-import-${suffix}`)
  });
  assert.equal(imported.materialized, true);
  return { ledger, imported, adapter: new PilotAutomatedSourceFaithfulReviewAdapter({ ledger }) };
}

function runReview(env, metadata, version) {
  return env.adapter.review({
    compilationResultRef: env.imported.compilation.ref,
    claimCandidateRef: env.imported.candidates[0].claimCandidateRef,
    sourceContextCandidateRef: env.imported.candidates[0].sourceContextCandidateRef,
    reviewerMetadata: metadata,
    output: output(),
    version
  });
}

const declared = fixture({ providerLabel: 'DEEPSEEK_WEB', modelLabel: 'deepseek-v4-pro', suffix: 'declared' });
const accepted = runReview(declared, reviewer(), 'declared-independent-v1');
assert.equal(accepted.adjudication.effectiveDisposition, 'ACCEPT_SOURCE_FAITHFUL');
assert.equal(accepted.adjudication.extractor.provider, 'DEEPSEEK_WEB');
assert.equal(accepted.adjudication.extractor.model, 'deepseek-v4-pro');
assert.equal(accepted.adjudication.extractor.identityAuthority, 'OPERATOR_DECLARED_NOT_VERIFIED');
assert.equal(accepted.adjudication.extractor.identityVerified, false);
assert.equal(accepted.adjudication.extractor.usableForIndependence, true);
assert.equal(accepted.adjudication.independenceEvidenceClass, 'OPERATOR_DECLARED_NOT_VERIFIED');
assert.ok(accepted.claim);
assert.equal(
  declared.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ScientificQualificationDecision').length,
  0,
  'automated source-faithful acceptance must not silently perform Scientific Qualification'
);

const unknown = fixture({ providerLabel: 'EXTERNAL_WEB', modelLabel: 'UNKNOWN_MODEL', suffix: 'unknown' });
const escalatedUnknown = runReview(unknown, reviewer(), 'unknown-model-v1');
assert.equal(escalatedUnknown.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
assert.ok(escalatedUnknown.adjudication.promotionReasons.includes('EXTRACTOR_IDENTITY_NOT_VERIFIABLE'));
assert.equal(escalatedUnknown.adjudication.extractor.identityAuthority, 'OPERATOR_DECLARED_NOT_VERIFIED');
assert.equal(escalatedUnknown.adjudication.extractor.usableForIndependence, false);
assert.equal(escalatedUnknown.claim, null);

const same = fixture({ providerLabel: 'OPENAI_RESPONSES', modelLabel: 'review-model-b', suffix: 'same-model' });
const escalatedSame = runReview(same, reviewer('OPENAI_RESPONSES', 'review-model-b'), 'same-declared-model-v1');
assert.equal(escalatedSame.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
assert.ok(escalatedSame.adjudication.promotionReasons.includes('REVIEWER_NOT_INDEPENDENT'));
assert.equal(escalatedSame.adjudication.extractor.identityAuthority, 'OPERATOR_DECLARED_NOT_VERIFIED');
assert.equal(escalatedSame.claim, null);

console.log(JSON.stringify({ total: 4, passed: 4, failed: 0 }, null, 2));
