import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import { PilotReviewAdapter } from '../../apps/pilot-api/src/review/pilot-review.mjs';

const TEXT = 'For maize under silt loam soil, irrigation may be considered when depletion exceeds 45 percent.';
function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-18T02:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'pilot-review-fixture' },
    details: { channel: 'pilot-source-review-acceptance' }
  };
}
function proposal() {
  const notReported = { status: 'NOT_REPORTED', dimensions: [] };
  const context = Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, notReported]));
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'maize' } }
    }]
  };
  context.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'soil.texture',
      valueCandidate: 'silt loam',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'silt loam' } }
    }]
  };
  return {
    claims: [{
      key: 'irrigation-threshold',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: TEXT,
      sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 1, evidenceText: 'irrigation may be considered' } },
      sourceContext: context
    }]
  };
}
function setup() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.pilot.review', version: '1', sourceType: 'PUBLICATION', title: 'Pilot review fixture',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' }, rights: { basis: 'INTERNAL_EVALUATION' }, audit: audit('evt-source')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.pilot.review', version: '1', sourceRef: source.ref, bytes: Buffer.from('%PDF-1.7\nfixture'),
    mediaType: 'application/pdf', materializationIdentity: 'fixture-pdf', acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T02:00:00Z', locator: 'fixture://pdf' }, audit: audit('evt-artifact')
  });
  const definition = createDeterministicCompilerDefinition({
    ledger, logicalId: 'compiler.pilot.review', version: '1', compilerId: 'fixture', implementationVersion: '1', audit: audit('evt-definition')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const compiled = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.pilot.review', version: '1', sourceArtifactRef: artifact.ref, compilerDefinitionRef: definition.ref,
    proposal: proposal(), audit: audit('evt-compile')
  });
  return { ledger, compiled, adapter: new PilotReviewAdapter({ ledger, operatorId: 'pilot-operator' }) };
}

const accepted = setup();
const acceptedResult = accepted.adapter.review({
  compilationResultRef: accepted.compiled.result.ref,
  claimCandidateRef: accepted.compiled.claimCandidates[0].ref,
  sourceContextCandidateRef: accepted.compiled.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication: {
    BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
    ENVIRONMENTAL: [{ semanticId: 'soil.texture', valueType: 'CATEGORY' }],
    MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: []
  },
  version: 'accept-1'
});
assert.equal(acceptedResult.review.semanticPayload.disposition, 'ACCEPT_SOURCE_FAITHFUL');
assert.equal(acceptedResult.claim.ref.kind, 'Claim');
assert.equal(acceptedResult.claim.semanticPayload.authorityClass, 'SOURCE_ASSERTION');
assert.equal(acceptedResult.sourceContext.ref.kind, 'SourceContext');

const rejected = setup();
const rejectedResult = rejected.adapter.review({
  compilationResultRef: rejected.compiled.result.ref,
  claimCandidateRef: rejected.compiled.claimCandidates[0].ref,
  sourceContextCandidateRef: rejected.compiled.sourceContextCandidates[0].ref,
  disposition: 'REJECT_SOURCE_FAITHFUL',
  reasonCodes: ['SOURCE_LOCATOR_DOES_NOT_SUPPORT_ASSERTION'],
  rationale: 'Fixture rejection',
  version: 'reject-1'
});
assert.equal(rejectedResult.review.semanticPayload.disposition, 'REJECT_SOURCE_FAITHFUL');
assert.equal(rejectedResult.claim, null);
assert.equal(rejectedResult.sourceContext, null);

console.log(JSON.stringify({ total: 2, passed: 2, failed: 0 }, null, 2));
