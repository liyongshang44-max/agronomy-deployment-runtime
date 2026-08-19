import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore } from '../../packages/source-ingestion/src/index.mjs';
import { SOURCE_CONTEXT_FAMILIES, ScientificCompiler, createDeterministicCompilerDefinition } from '../../packages/scientific-compiler/src/index.mjs';
import { AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS } from '../../packages/knowledge-registry/src/automated-source-faithful.mjs';
import { RightsAuthorityError } from '../../packages/rights-authority/src/index.mjs';
import { PilotRightsEnforcementService } from '../../apps/pilot-api/src/rights/enforcement.mjs';
import { PilotAutomatedSourceFaithfulReviewAdapter } from '../../apps/pilot-api/src/review/automated-review.mjs';
import { PilotAutomatedSourceFaithfulBatchService } from '../../apps/pilot-api/src/review/automated-batch.mjs';

const root = mkdtempSync(join(tmpdir(), 'adr-ra02-auto-review-'));
const text = '%PDF-1.7\nMaize water management requires exact evidence.\n%%EOF\n';
const bytes = Buffer.from(text, 'utf8');
const ownership = { organizationId: 'org-ra02-auto', tenantId: 'tenant-ra02-auto' };
const operatorId = 'ra02-auto-operator';
const runtimeId = 'ra02-auto-runtime';

function audit(eventId, actorId = operatorId, type = 'USER', inputRefs = []) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type, id: actorId },
    inputRefs,
    details: { channel: 'ra02-automated-review-acceptance' }
  };
}

function context() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
}

function adjudication() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, []]));
}

function checks() {
  return Object.fromEntries(AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, 'PASS']));
}

function byteRange(excerpt) {
  const index = text.indexOf(excerpt);
  const start = Buffer.byteLength(text.slice(0, index), 'utf8');
  return { kind: 'BYTE_RANGE', start, endExclusive: start + Buffer.byteLength(excerpt, 'utf8') };
}

function rule(operation) {
  return { operation, purposes: ['SOURCE_FAITHFUL_REVIEW'], jurisdictions: ['GB'], obligations: [] };
}

try {
  const ledger = new AuthorityLedger();
  const store = new FileSystemScopedArtifactStore({ rootDir: root });
  const registry = new SourceRegistry({ ledger, artifactStore: store });
  const source = registry.registerSource({
    logicalId: 'source.ra02.auto-review', version: '1', sourceType: 'PUBLICATION', title: 'RA02 automated review fixture',
    ownership, rights: { basis: 'metadata-only-not-authority' }, audit: audit('evt-source')
  });
  const receipt = store.putForScope(ownership, bytes);
  const artifact = registry.materializeRetainedArtifact({
    logicalId: 'artifact.ra02.auto-review', version: '1', sourceRef: source.ref, retentionReceipt: receipt,
    mediaType: 'application/pdf', materializationIdentity: 'ra02-auto-review',
    acquisition: { method: 'FIXTURE', acquiredAt: new Date().toISOString(), locator: 'fixture://ra02-auto-review' },
    audit: audit('evt-artifact')
  });
  const definition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.ra02.auto-review', version: '1', compilerId: 'ra02-auto-review', implementationVersion: '1',
    configuration: { provider: 'EXTRACTOR_A', model: 'extract-model-a' },
    audit: audit('evt-definition', 'compiler-service', 'SERVICE_ACCOUNT')
  });
  const assertion = 'Maize water management requires exact evidence.';
  const compiled = new ScientificCompiler({ ledger, sourceRegistry: registry }).materializeCompilationProposal({
    compilationLogicalId: 'compilation.ra02.auto-review', version: '1', sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: definition.ref,
    proposal: {
      claims: [{ key: 'c1', claimType: 'BOUNDARY_CONSTRAINT', assertion, confidence: 0.99, sourceLocator: byteRange(assertion), sourceContext: context() }],
      runMetadata: { provider: 'EXTRACTOR_A', model: 'extract-model-a' }
    },
    audit: audit('evt-compilation', 'compiler-service', 'SERVICE_ACCOUNT')
  });

  let streamOpenCount = 0;
  const countedRegistry = {
    resolveArtifact: (ref) => registry.resolveArtifact(ref),
    readArtifactStream: (ref) => {
      streamOpenCount += 1;
      return registry.readArtifactStream(ref);
    }
  };
  const adapter = new PilotAutomatedSourceFaithfulReviewAdapter({ ledger });
  const batch = new PilotAutomatedSourceFaithfulBatchService({ ledger, sourceRegistry: countedRegistry, adapter });
  const rights = new PilotRightsEnforcementService({ ledger, operatorId, evaluatorId: 'ra02-auto-rights-engine' });

  rights.provision({
    subjectRef: artifact.ref, basisClass: 'LICENSE', rules: [rule('READ_FOR_EXTRACTION')],
    validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z', version: 'read'
  });

  let reviewerCalls = 0;
  const prepare = async () => {
    const read = rights.authorize({
      subjectRef: artifact.ref, actorId: runtimeId, operation: 'READ_FOR_EXTRACTION',
      purpose: 'SOURCE_FAITHFUL_REVIEW', jurisdiction: 'GB'
    });
    const egress = rights.authorize({
      subjectRef: artifact.ref, actorId: runtimeId, operation: 'MODEL_EGRESS',
      purpose: 'SOURCE_FAITHFUL_REVIEW', jurisdiction: 'GB'
    });
    const derived = rights.authorize({
      subjectRef: artifact.ref, actorId: runtimeId, operation: 'RETAIN_DERIVED',
      purpose: 'SOURCE_FAITHFUL_REVIEW', jurisdiction: 'GB'
    });
    return {
      rightsDecisionRefs: [read.rightsDecisionRef, egress.rightsDecisionRef, derived.rightsDecisionRef],
      readable: countedRegistry.readArtifactStream(artifact.ref)
    };
  };

  let denied;
  try {
    await batch.run({
      sourceArtifactRef: artifact.ref,
      compilationResultRef: compiled.result.ref,
      filename: 'fixture.pdf',
      prepareCandidate: prepare,
      reviewer: async () => { reviewerCalls += 1; throw new Error('reviewer must not run'); }
    });
  } catch (error) { denied = error; }
  assert.ok(denied instanceof RightsAuthorityError);
  assert.equal(denied.code, 'RIGHTS_POLICY_NOT_PROVISIONED');
  assert.equal(streamOpenCount, 0, 'PDF stream must not open when egress/derived rights are not complete');
  assert.equal(reviewerCalls, 0, 'reviewer must not run before all rights checks pass');
  assert.equal(ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'RightsDecision' && record.semanticPayload.operation === 'READ_FOR_EXTRACTION').length, 1);

  rights.provision({
    subjectRef: artifact.ref, basisClass: 'LICENSE', rules: [rule('MODEL_EGRESS')],
    validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z', version: 'egress'
  });
  rights.provision({
    subjectRef: artifact.ref, basisClass: 'LICENSE', rules: [rule('RETAIN_DERIVED')],
    validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z', version: 'derived'
  });

  const result = await batch.run({
    sourceArtifactRef: artifact.ref,
    compilationResultRef: compiled.result.ref,
    filename: 'fixture.pdf',
    versionPrefix: 'ra02-auto',
    prepareCandidate: prepare,
    reviewer: async ({ readable, rightsDecisionRefs }) => {
      reviewerCalls += 1;
      let observed = 0;
      for await (const chunk of readable) observed += chunk.byteLength;
      assert.equal(observed, bytes.byteLength);
      assert.equal(rightsDecisionRefs.length, 3);
      return {
        reviewerMetadata: {
          provider: 'REVIEWER_B', model: 'review-model-b', promptVersion: 'adr-source-faithful-review-prompt-v1',
          schemaVersion: 'adr-source-faithful-review-output-v1', reviewMode: 'BLIND_FALSIFICATION'
        },
        output: {
          disposition: 'ACCEPT_SOURCE_FAITHFUL', reasonCodes: [], rationale: 'Exact support verified.',
          reviewConfidence: 0.99, checks: checks(), contextAdjudication: adjudication()
        }
      };
    }
  });
  assert.equal(streamOpenCount, 1);
  assert.equal(reviewerCalls, 1);
  assert.equal(result.autoAcceptedCount, 1);
  assert.equal(result.results[0].rightsDecisionRefs.length, 3);
  const review = ledger.resolve(result.results[0].reviewRef);
  const reviewAudit = ledger.auditFor(review.ref).find((event) => event.objectRef.semanticHash === review.ref.semanticHash);
  for (const ref of result.results[0].rightsDecisionRefs) {
    assert.ok(reviewAudit.inputRefs.some((input) => input.semanticHash === ref.semanticHash), 'review audit must retain every exact RightsDecision ref');
  }
  assert.equal(ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'ScientificQualificationDecision').length, 0);

  console.log(JSON.stringify({
    total: 2, passed: 2, failed: 0,
    deniedBeforePdfOpen: true,
    deniedBeforeReviewer: true,
    allRightsRefsInReviewProvenance: true,
    scientificQualificationCount: 0
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
