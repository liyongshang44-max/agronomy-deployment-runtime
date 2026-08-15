import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  SourceFaithfulReviewError,
  SourceFaithfulReviewService
} from '../../packages/knowledge-registry/src/source-faithful.mjs';

const TEXT = 'For maize at V10, irrigation may be considered.';

function audit(eventId, actorId = 'reviewer-integrity') {
  return {
    eventId,
    occurredAt: '2026-08-15T14:45:00.000Z',
    actor: { type: 'USER', id: actorId },
    details: { channel: 'k03-integrity' }
  };
}

function wholeContextWithConfidence() {
  const context = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' },
      confidence: 0.41
    }]
  };
  return context;
}

function setup() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.k03.integrity',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'K03 Integrity Source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.k03.integrity',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'k03-integrity-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T14:40:00Z' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.k03.integrity',
    version: '1',
    compilerId: 'adr.k03.integrity',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler-definition', 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const bundle = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.k03.integrity',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: 'claim-1',
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion: TEXT,
        sourceLocator: { kind: 'WHOLE_ARTIFACT' },
        sourceContext: wholeContextWithConfidence()
      }]
    },
    audit: audit('evt-compilation', 'compiler-service')
  });
  return { ledger, sourceRegistry, source, artifact, compilerDefinition, bundle, service: new SourceFaithfulReviewService({ ledger }) };
}

function accept(env, overrides = {}) {
  return env.service.reviewCandidate({
    reviewLogicalId: overrides.reviewLogicalId ?? 'review.k03.integrity',
    reviewVersion: '1',
    compilationResultRef: overrides.compilationResultRef ?? env.bundle.result.ref,
    claimCandidateRef: env.bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: env.bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    claimLogicalId: overrides.claimLogicalId ?? 'claim.k03.integrity',
    claimVersion: '1',
    sourceContextLogicalId: overrides.sourceContextLogicalId ?? 'source-context.k03.integrity',
    sourceContextVersion: '1',
    audit: audit(overrides.auditEventId ?? 'evt-review-integrity')
  });
}

function expectError(fn, ErrorType, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('compiler extraction confidence is not promoted into final SourceContext authority', () => {
  const env = setup();
  const candidateDimension = env.bundle.sourceContextCandidates[0].semanticPayload.contextFamilies.BIOLOGICAL.dimensions[0];
  assert.equal(candidateDimension.confidence, 0.41);
  const result = accept(env);
  const finalDimension = result.sourceContext.semanticPayload.contextFamilies.BIOLOGICAL.dimensions[0];
  assert.ok(!('confidence' in finalDimension));
  assert.equal(finalDimension.semanticHint, candidateDimension.semanticHint);
  assert.equal(finalDimension.valueCandidate, candidateDimension.valueCandidate);
  assert.equal(finalDimension.supportClass, 'EXPLICIT_SOURCE');
  assert.deepEqual(finalDimension.sourceLocator, candidateDimension.sourceLocator);
});

test('completed compilation result provenance must match the selected candidate source as well as artifact/compiler refs', () => {
  const env = setup();
  const otherSource = env.sourceRegistry.registerSource({
    logicalId: 'source.k03.other',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'Different logical source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-other-source', 'source-admin')
  });
  const forgedResult = env.ledger.publish({
    kind: 'ScientificCompilationResult',
    logicalId: 'compilation.k03.forged-result',
    version: '1',
    semanticPayload: {
      ...env.bundle.result.semanticPayload,
      sourceRef: otherSource.ref
    },
    audit: audit('evt-forged-result', 'test-fixture')
  });

  expectError(() => accept(env, {
    reviewLogicalId: 'review.k03.forged-result',
    compilationResultRef: forgedResult.ref,
    claimLogicalId: 'claim.k03.forged-result',
    sourceContextLogicalId: 'source-context.k03.forged-result',
    auditEventId: 'evt-review-forged-result'
  }), SourceFaithfulReviewError, 'COMPILATION_PROVENANCE_MISMATCH');
});

test('completed compilation result raw artifact content hash must match selected candidate provenance', () => {
  const env = setup();
  const forgedResult = env.ledger.publish({
    kind: 'ScientificCompilationResult',
    logicalId: 'compilation.k03.forged-content-hash',
    version: '1',
    semanticPayload: {
      ...env.bundle.result.semanticPayload,
      sourceArtifactContentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    },
    audit: audit('evt-forged-content-result', 'test-fixture')
  });

  expectError(() => accept(env, {
    reviewLogicalId: 'review.k03.forged-content-hash',
    compilationResultRef: forgedResult.ref,
    claimLogicalId: 'claim.k03.forged-content-hash',
    sourceContextLogicalId: 'source-context.k03.forged-content-hash',
    auditEventId: 'evt-review-forged-content-hash'
  }), SourceFaithfulReviewError, 'COMPILATION_PROVENANCE_MISMATCH');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
