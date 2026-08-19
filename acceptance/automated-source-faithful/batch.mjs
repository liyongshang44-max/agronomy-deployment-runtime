import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore } from '../../packages/source-ingestion/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import { AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS } from '../../packages/knowledge-registry/src/automated-source-faithful.mjs';
import { PilotAutomatedSourceFaithfulReviewAdapter } from '../../apps/pilot-api/src/review/automated-review.mjs';
import { PilotAutomatedSourceFaithfulBatchService } from '../../apps/pilot-api/src/review/automated-batch.mjs';

const TEXT = [
  'Candidate zero is supported.',
  'Candidate one is supported.',
  'Candidate two is partially supported.',
  'Candidate three is ambiguous.'
].join('\n');

function audit(eventId, actorId = 'compiler-service', actorType = 'SERVICE_ACCOUNT') {
  return {
    eventId,
    occurredAt: '2026-08-19T04:00:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'automated-review-batch-acceptance' }
  };
}

function byteRange(excerpt) {
  const index = TEXT.indexOf(excerpt);
  const start = Buffer.byteLength(TEXT.slice(0, index), 'utf8');
  return { kind: 'BYTE_RANGE', start, endExclusive: start + Buffer.byteLength(excerpt, 'utf8') };
}

function emptyContext() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
}

function contextAdjudication() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, []]));
}

function checks(overrides = {}) {
  return Object.fromEntries(AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, overrides[name] ?? 'PASS']));
}

const reviewerMetadata = {
  provider: 'REVIEW_PROVIDER_B',
  model: 'review-model-b',
  promptVersion: 'adr-source-faithful-review-prompt-v1',
  schemaVersion: 'adr-source-faithful-review-output-v1',
  reviewMode: 'BLIND_FALSIFICATION'
};

function acceptOutput() {
  return {
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    reasonCodes: [],
    rationale: 'Exact source support is complete.',
    reviewConfidence: 0.99,
    checks: checks(),
    contextAdjudication: contextAdjudication()
  };
}

const root = mkdtempSync(join(tmpdir(), 'adr-auto-review-batch-'));
try {
  const ledger = new AuthorityLedger();
  const store = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: store });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.auto-review-batch', version: '1', sourceType: 'PUBLICATION', title: 'Automated review batch fixture',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' }, rights: { license: 'INTERNAL_EVALUATION' },
    audit: audit('evt-source', 'source-admin', 'USER')
  });
  const bytes = Buffer.from(TEXT, 'utf8');
  const receipt = store.putForScope(source.semanticPayload.ownership, bytes);
  const artifact = sourceRegistry.materializeRetainedArtifact({
    logicalId: 'artifact.auto-review-batch', version: '1', sourceRef: source.ref, retentionReceipt: receipt,
    mediaType: 'application/pdf', materializationIdentity: 'auto-review-batch',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-19T03:59:00Z', locator: 'fixture://auto-review-batch' },
    audit: audit('evt-artifact', 'source-admin', 'USER')
  });
  const definition = createDeterministicCompilerDefinition({
    ledger, logicalId: 'compiler.auto-review-batch', version: '1', compilerId: 'batch-fixture', implementationVersion: '1',
    configuration: { fixture: true }, audit: audit('evt-definition')
  });
  const claims = [
    ['c0', 'Candidate zero is supported.'],
    ['c1', 'Candidate one is supported.'],
    ['c2', 'Candidate two is partially supported.'],
    ['c3', 'Candidate three is ambiguous.']
  ].map(([key, assertion]) => ({
    key,
    claimType: 'BOUNDARY_CONSTRAINT',
    assertion,
    confidence: 0.97,
    sourceLocator: byteRange(assertion),
    sourceContext: emptyContext()
  }));
  const compiled = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
    compilationLogicalId: 'compilation.auto-review-batch', version: '1', sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: definition.ref,
    proposal: { claims, runMetadata: { provider: 'EXTRACT_PROVIDER_A', model: 'extract-model-a' } },
    audit: audit('evt-compilation')
  });
  const adapter = new PilotAutomatedSourceFaithfulReviewAdapter({ ledger });

  const preReviewed = adapter.review({
    compilationResultRef: compiled.result.ref,
    claimCandidateRef: compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: compiled.sourceContextCandidates[0].ref,
    reviewerMetadata,
    output: acceptOutput(),
    version: 'pre-reviewed-v1'
  });
  assert.equal(preReviewed.adjudication.effectiveDisposition, 'ACCEPT_SOURCE_FAITHFUL');

  let providerCalls = 0;
  const batch = new PilotAutomatedSourceFaithfulBatchService({ ledger, sourceRegistry, adapter });
  const first = await batch.run({
    sourceArtifactRef: artifact.ref,
    compilationResultRef: compiled.result.ref,
    filename: 'fixture.pdf',
    versionPrefix: 'batch-run-1',
    reviewer: async ({ readable, candidateIndex }) => {
      providerCalls += 1;
      let observed = 0;
      for await (const chunk of readable) observed += chunk.byteLength;
      assert.equal(observed, bytes.byteLength);
      if (candidateIndex === 1) {
        return { reviewerMetadata, output: acceptOutput(), providerTrace: { fixture: 'ACCEPT' } };
      }
      if (candidateIndex === 2) {
        return {
          reviewerMetadata,
          output: {
            disposition: 'REJECT_SOURCE_FAITHFUL',
            reasonCodes: ['EVIDENCE_LOCATOR_INCOMPLETE'],
            rationale: 'The evidence locator does not cover the complete assertion.',
            reviewConfidence: 0.98,
            checks: checks({ EVIDENCE_COVERAGE: 'FAIL' }),
            contextAdjudication: contextAdjudication()
          },
          providerTrace: { fixture: 'REJECT' }
        };
      }
      if (candidateIndex === 3) {
        return {
          reviewerMetadata,
          output: {
            disposition: 'ESCALATE_TO_HUMAN',
            reasonCodes: ['SOURCE_AMBIGUOUS'],
            rationale: 'The exact support cannot be resolved confidently.',
            reviewConfidence: 0.70,
            checks: checks({ ASSERTION_SUPPORT: 'FAIL' }),
            contextAdjudication: contextAdjudication()
          },
          providerTrace: { fixture: 'ESCALATE' }
        };
      }
      throw new Error(`unexpected candidateIndex ${candidateIndex}`);
    }
  });

  assert.equal(providerCalls, 3);
  assert.equal(first.candidateCount, 4);
  assert.equal(first.skippedReviewedCount, 1);
  assert.equal(first.autoAcceptedCount, 1);
  assert.equal(first.autoRejectedCount, 1);
  assert.equal(first.escalatedCount, 1);
  assert.deepEqual(first.results.map((item) => item.status), [
    'SKIPPED_ALREADY_REVIEWED',
    'AUTO_ACCEPTED',
    'AUTO_REJECTED',
    'ESCALATED_TO_HUMAN'
  ]);

  const callsBeforeSecond = providerCalls;
  const second = await batch.run({
    sourceArtifactRef: artifact.ref,
    compilationResultRef: compiled.result.ref,
    filename: 'fixture.pdf',
    versionPrefix: 'batch-run-2',
    reviewer: async () => {
      providerCalls += 1;
      throw new Error('second run must not invoke reviewer');
    }
  });
  assert.equal(providerCalls, callsBeforeSecond);
  assert.equal(second.skippedReviewedCount, 3);
  assert.equal(second.escalatedCount, 1);
  assert.equal(second.results[3].status, 'ESCALATED_PENDING_HUMAN');

  console.log(JSON.stringify({ total: 2, passed: 2, failed: 0 }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
