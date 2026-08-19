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
import { listRecoverableCompilations } from '../../apps/pilot-api/src/recovery/compilation-recovery.mjs';

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-19T04:30:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'automated-review-recovery' },
    details: { channel: 'automated-review-recovery-acceptance' }
  };
}

function emptyContext() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
}

function emptyAdjudication() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, []]));
}

function checks(overrides = {}) {
  return Object.fromEntries(AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, overrides[name] ?? 'PASS']));
}

const root = mkdtempSync(join(tmpdir(), 'adr-auto-review-recovery-'));
try {
  const ledger = new AuthorityLedger();
  const store = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: store });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.auto-review-recovery',
    version: '1',
    sourceType: 'PUBLICATION',
    title: 'Automated review recovery fixture',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { basis: 'INTERNAL_EVALUATION' },
    audit: audit('evt-source')
  });
  const bytes = Buffer.from('Ambiguous source support requires a human.', 'utf8');
  const receipt = store.putForScope(source.semanticPayload.ownership, bytes);
  const artifact = sourceRegistry.materializeRetainedArtifact({
    logicalId: 'artifact.auto-review-recovery',
    version: '1',
    sourceRef: source.ref,
    retentionReceipt: receipt,
    mediaType: 'application/pdf',
    materializationIdentity: 'auto-review-recovery',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-19T04:29:00Z', locator: 'fixture://auto-review-recovery' },
    audit: audit('evt-artifact')
  });
  const definition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.auto-review-recovery',
    version: '1',
    compilerId: 'auto-review-recovery',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-definition')
  });
  const compiled = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
    compilationLogicalId: 'compilation.auto-review-recovery',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: definition.ref,
    proposal: {
      claims: [{
        key: 'ambiguous-candidate',
        claimType: 'BOUNDARY_CONSTRAINT',
        assertion: 'Ambiguous source support requires a human.',
        confidence: 0.94,
        sourceLocator: { kind: 'BYTE_RANGE', start: 0, endExclusive: bytes.byteLength },
        sourceContext: emptyContext()
      }],
      runMetadata: { provider: 'EXTRACT_PROVIDER_A', model: 'extract-model-a' }
    },
    audit: audit('evt-compilation')
  });

  const adapter = new PilotAutomatedSourceFaithfulReviewAdapter({ ledger });
  const reviewed = adapter.review({
    compilationResultRef: compiled.result.ref,
    claimCandidateRef: compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: {
      provider: 'REVIEW_PROVIDER_B',
      model: 'review-model-b',
      promptVersion: 'adr-source-faithful-review-prompt-v1',
      schemaVersion: 'adr-source-faithful-review-output-v1',
      reviewMode: 'BLIND_FALSIFICATION'
    },
    output: {
      disposition: 'ESCALATE_TO_HUMAN',
      reasonCodes: ['SOURCE_AMBIGUOUS'],
      rationale: 'Exact support cannot be resolved confidently.',
      reviewConfidence: 0.72,
      checks: checks({ ASSERTION_SUPPORT: 'FAIL' }),
      contextAdjudication: emptyAdjudication()
    },
    version: 'auto-review-escalation-v1'
  });
  assert.equal(reviewed.review, null);
  assert.equal(reviewed.claim, null);
  assert.equal(reviewed.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');

  const restoredLedger = AuthorityLedger.fromSnapshot(ledger.exportSnapshot());
  const recovered = listRecoverableCompilations({ ledger: restoredLedger, sourceArtifactRef: artifact.ref });
  assert.equal(recovered.compilationCount, 1);
  assert.equal(recovered.compilations[0].reviewedCount, 0);
  assert.equal(recovered.compilations[0].escalatedPendingHumanCount, 1);
  assert.equal(recovered.compilations[0].promotionIncompleteCount, 0);
  assert.equal(recovered.compilations[0].candidates[0].review, null);
  assert.equal(recovered.compilations[0].candidates[0].automatedReview.status, 'ESCALATED_PENDING_HUMAN');
  assert.equal(recovered.compilations[0].candidates[0].automatedReview.effectiveDisposition, 'ESCALATE_TO_HUMAN');
  assert.deepEqual(recovered.compilations[0].candidates[0].automatedReview.reasonCodes, ['SOURCE_AMBIGUOUS']);

  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
