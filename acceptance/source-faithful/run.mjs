import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
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

const SOURCE_TEXT = [
  'Corn irrigation protocol.',
  'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
  'This protocol was evaluated under center-pivot irrigation.',
  'Groundwater depth was not reported.'
].join('\n');

function audit(eventId, actorId = 'scientific-reviewer') {
  return {
    eventId,
    occurredAt: '2026-08-15T14:30:00.000Z',
    actor: { type: 'USER', id: actorId },
    details: { channel: 'source-faithful-acceptance' }
  };
}

function byteRange(text, excerpt) {
  const charIndex = text.indexOf(excerpt);
  if (charIndex < 0) throw new Error(`excerpt not found: ${excerpt}`);
  const start = Buffer.byteLength(text.slice(0, charIndex), 'utf8');
  return { kind: 'BYTE_RANGE', start, endExclusive: start + Buffer.byteLength(excerpt, 'utf8') };
}

function sourceContextProposal() {
  const context = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [
      {
        semanticHint: 'crop.identity',
        valueCandidate: 'maize',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: byteRange(SOURCE_TEXT, 'maize')
      },
      {
        semanticHint: 'crop.stage',
        valueCandidate: 'V10',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: byteRange(SOURCE_TEXT, 'V10')
      }
    ]
  };
  context.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'soil.texture',
      valueCandidate: 'silt loam',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(SOURCE_TEXT, 'silt loam')
    }]
  };
  context.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'irrigation.system',
      valueCandidate: 'center-pivot',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(SOURCE_TEXT, 'center-pivot irrigation')
    }]
  };
  return context;
}

function compilationProposal({ key = 'depletion-threshold', assertion } = {}) {
  const exactAssertion = assertion
    ?? 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.';
  return {
    claims: [{
      key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: exactAssertion,
      structured: {
        threshold: { semanticHint: 'soil.root_zone.depletion_fraction', valueCandidate: '0.45' }
      },
      sourceLocator: byteRange(SOURCE_TEXT, exactAssertion),
      sourceContext: sourceContextProposal()
    }],
    runMetadata: { fixture: 'k03-source-faithful' }
  };
}

function setup() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.protocol.k03',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'Corn Irrigation Protocol',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    bibliographic: { authoringOrganization: 'Example Agronomy Co' },
    rights: { license: 'PRIVATE' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.protocol.k03',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(SOURCE_TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'k03-fixture-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T14:20:00Z', locator: 'fixture://k03' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.k03',
    version: '1',
    compilerId: 'adr.k03.fixture-compiler',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler-definition', 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const reviewService = new SourceFaithfulReviewService({ ledger });
  return { ledger, sourceRegistry, source, artifact, compilerDefinition, compiler, reviewService };
}

function compile(env, { logicalId = 'compilation.k03', key = 'depletion-threshold' } = {}) {
  return env.compiler.materializeCompilationProposal({
    compilationLogicalId: logicalId,
    version: '1',
    sourceArtifactRef: env.artifact.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    proposal: compilationProposal({ key }),
    audit: audit(`evt-${logicalId}`, 'compiler-service')
  });
}

function accept(env, bundle, overrides = {}) {
  return env.reviewService.reviewCandidate({
    reviewLogicalId: overrides.reviewLogicalId ?? 'review.k03.accept',
    reviewVersion: overrides.reviewVersion ?? '1',
    compilationResultRef: overrides.compilationResultRef ?? bundle.result.ref,
    claimCandidateRef: overrides.claimCandidateRef ?? bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: overrides.sourceContextCandidateRef ?? bundle.sourceContextCandidates[0].ref,
    disposition: overrides.disposition ?? 'ACCEPT_SOURCE_FAITHFUL',
    reasonCodes: overrides.reasonCodes ?? [],
    rationale: overrides.rationale,
    claimLogicalId: overrides.claimLogicalId ?? 'claim.corn-water.depletion-threshold',
    claimVersion: overrides.claimVersion ?? '1',
    sourceContextLogicalId: overrides.sourceContextLogicalId ?? 'source-context.corn-water.depletion-threshold',
    sourceContextVersion: overrides.sourceContextVersion ?? '1',
    audit: audit(overrides.auditEventId ?? 'evt-k03-review')
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

test('accepted candidate from exact completed compilation materializes Claim and SourceContext', () => {
  const env = setup();
  const bundle = compile(env);
  const result = accept(env, bundle);
  assert.equal(result.review.ref.kind, 'SourceFaithfulReviewDecision');
  assert.equal(result.review.semanticPayload.disposition, 'ACCEPT_SOURCE_FAITHFUL');
  assert.equal(result.claim.ref.kind, 'Claim');
  assert.equal(result.sourceContext.ref.kind, 'SourceContext');
  assert.equal(result.sourceContext.semanticPayload.claimRef.semanticHash, result.claim.ref.semanticHash);
});

test('final Claim remains source-faithful and does not inherit extraction confidence or qualification fields', () => {
  const env = setup();
  const bundle = compile(env);
  const candidate = bundle.claimCandidates[0];
  const { claim } = accept(env, bundle);
  assert.equal(claim.semanticPayload.assertion, candidate.semanticPayload.assertion);
  assert.deepEqual(claim.semanticPayload.structured, candidate.semanticPayload.structured);
  assert.equal(claim.semanticPayload.sourceLocator.kind, candidate.semanticPayload.sourceLocator.kind);
  assert.equal(claim.semanticPayload.authorityClass, 'SOURCE_ASSERTION');
  assert.ok(!('extractionConfidence' in claim.semanticPayload));
  assert.ok(!('qualification' in claim.semanticPayload));
  assert.ok(!('allowedUses' in claim.semanticPayload));
  assert.ok(!('forbiddenUses' in claim.semanticPayload));
});

test('final SourceContext preserves all six source-context families and NOT_REPORTED exactly', () => {
  const env = setup();
  const bundle = compile(env);
  const candidateContext = bundle.sourceContextCandidates[0].semanticPayload.contextFamilies;
  const { sourceContext } = accept(env, bundle);
  assert.deepEqual(sourceContext.semanticPayload.contextFamilies, candidateContext);
  assert.deepEqual(Object.keys(sourceContext.semanticPayload.contextFamilies).sort(), [...SOURCE_CONTEXT_FAMILIES].sort());
  assert.equal(sourceContext.semanticPayload.contextFamilies.MANAGEMENT.status, 'NOT_REPORTED');
  assert.deepEqual(sourceContext.semanticPayload.contextFamilies.MANAGEMENT.dimensions, []);
  assert.equal(sourceContext.semanticPayload.authorityClass, 'SOURCE_CONTEXT');
});

test('rejected source-faithful review requires reason codes and creates no Claim or SourceContext', () => {
  const env = setup();
  const bundle = compile(env);
  const rejected = accept(env, bundle, {
    reviewLogicalId: 'review.k03.reject',
    disposition: 'REJECT_SOURCE_FAITHFUL',
    reasonCodes: ['SOURCE_LOCATOR_DOES_NOT_SUPPORT_ASSERTION'],
    auditEventId: 'evt-k03-reject'
  });
  assert.equal(rejected.review.semanticPayload.disposition, 'REJECT_SOURCE_FAITHFUL');
  assert.deepEqual(rejected.review.semanticPayload.reasonCodes, ['SOURCE_LOCATOR_DOES_NOT_SUPPORT_ASSERTION']);
  assert.equal(rejected.claim, null);
  assert.equal(rejected.sourceContext, null);
  assert.equal(env.ledger.listVersions('Claim', 'claim.corn-water.depletion-threshold').length, 0);
});

test('rejection without a reason code is invalid', () => {
  const env = setup();
  const bundle = compile(env);
  expectError(() => accept(env, bundle, {
    reviewLogicalId: 'review.k03.reject-no-reason',
    disposition: 'REJECT_SOURCE_FAITHFUL',
    reasonCodes: []
  }), SourceFaithfulReviewError, 'REJECTION_REASON_REQUIRED');
});

test('orphan candidate not referenced by exact completed ScientificCompilationResult cannot be reviewed', () => {
  const env = setup();
  const acceptedBundle = compile(env, { logicalId: 'compilation.k03.a', key: 'depletion-threshold' });
  const otherBundle = compile(env, { logicalId: 'compilation.k03.b', key: 'other-threshold' });
  expectError(() => accept(env, acceptedBundle, {
    reviewLogicalId: 'review.k03.orphan',
    claimCandidateRef: otherBundle.claimCandidates[0].ref
  }), SourceFaithfulReviewError, 'CLAIM_CANDIDATE_NOT_IN_COMPILATION');
});

test('ClaimCandidate and SourceContextCandidate from different completed compilations cannot be paired', () => {
  const env = setup();
  const bundleA = compile(env, { logicalId: 'compilation.k03.pair-a', key: 'depletion-threshold' });
  const bundleB = compile(env, { logicalId: 'compilation.k03.pair-b', key: 'other-threshold' });
  expectError(() => accept(env, bundleA, {
    reviewLogicalId: 'review.k03.bad-pair',
    sourceContextCandidateRef: bundleB.sourceContextCandidates[0].ref
  }), SourceFaithfulReviewError, 'SOURCE_CONTEXT_CANDIDATE_NOT_IN_COMPILATION');
});

test('forged exact candidate reference is rejected by shared authority ledger', () => {
  const env = setup();
  const bundle = compile(env);
  const forged = {
    ...bundle.claimCandidates[0].ref,
    semanticHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  };
  expectError(() => accept(env, bundle, {
    reviewLogicalId: 'review.k03.forged',
    claimCandidateRef: forged
  }), AuthorityLedgerError, 'AUTHORITY_HASH_MISMATCH');
});

test('final Claim and SourceContext versions cannot be silently rewritten by a later review', () => {
  const env = setup();
  const first = compile(env, { logicalId: 'compilation.k03.first', key: 'depletion-threshold' });
  accept(env, first, {
    reviewLogicalId: 'review.k03.first',
    claimLogicalId: 'claim.k03.immutable',
    sourceContextLogicalId: 'source-context.k03.immutable',
    auditEventId: 'evt-review-first'
  });

  const second = compile(env, { logicalId: 'compilation.k03.second', key: 'other-threshold' });
  expectError(() => accept(env, second, {
    reviewLogicalId: 'review.k03.second',
    claimLogicalId: 'claim.k03.immutable',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.k03.immutable',
    sourceContextVersion: '1',
    auditEventId: 'evt-review-second'
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('Claim audit binds review, completed compilation and exact ClaimCandidate', () => {
  const env = setup();
  const bundle = compile(env);
  const result = accept(env, bundle);
  const events = env.ledger.auditFor(result.claim.ref);
  const direct = events.find((event) => event.objectRef.semanticHash === result.claim.ref.semanticHash);
  assert.ok(direct, 'direct Claim publication audit event required');
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === result.review.ref.semanticHash));
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === bundle.result.ref.semanticHash));
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === bundle.claimCandidates[0].ref.semanticHash));
});

test('SourceContext audit binds review, completed compilation, exact candidate and final Claim', () => {
  const env = setup();
  const bundle = compile(env);
  const result = accept(env, bundle);
  const events = env.ledger.auditFor(result.sourceContext.ref);
  const direct = events.find((event) => event.objectRef.semanticHash === result.sourceContext.ref.semanticHash);
  assert.ok(direct, 'direct SourceContext publication audit event required');
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === result.review.ref.semanticHash));
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === bundle.sourceContextCandidates[0].ref.semanticHash));
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === result.claim.ref.semanticHash));
});

test('explicit lineage connects final Claim/SourceContext to proposal candidates without rewriting proposals', () => {
  const env = setup();
  const bundle = compile(env);
  const result = accept(env, bundle);
  const claimLineage = env.ledger.lineageFor(result.claim.ref);
  const contextLineage = env.ledger.lineageFor(result.sourceContext.ref);
  assert.ok(claimLineage.some((line) => line.relation === 'derived_from'
    && line.to.semanticHash === bundle.claimCandidates[0].ref.semanticHash));
  assert.ok(contextLineage.some((line) => line.relation === 'derived_from'
    && line.to.semanticHash === bundle.sourceContextCandidates[0].ref.semanticHash));
  assert.equal(bundle.claimCandidates[0].semanticPayload.authorityClass, 'CANDIDATE_PROPOSAL');
  assert.equal(bundle.sourceContextCandidates[0].semanticPayload.authorityClass, 'CANDIDATE_PROPOSAL');
});

test('accepted review is source-faithful authority only and creates no QualifiedKnowledge', () => {
  const env = setup();
  const bundle = compile(env);
  const result = accept(env, bundle);
  assert.equal(result.review.semanticPayload.authorityClass, 'SOURCE_FAITHFUL_REVIEW');
  assert.equal(env.ledger.listVersions('QualifiedKnowledge', 'claim.corn-water.depletion-threshold').length, 0);
  assert.ok(!('qualificationScope' in result.claim.semanticPayload));
  assert.ok(!('transportConstraints' in result.claim.semanticPayload));
});

test('correction requires a new candidate/review path; service exposes no assertion/context override fields', () => {
  const env = setup();
  const bundle = compile(env);
  const result = env.reviewService.reviewCandidate({
    reviewLogicalId: 'review.k03.no-override',
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    claimLogicalId: 'claim.k03.no-override',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.k03.no-override',
    sourceContextVersion: '1',
    // Deliberately unknown fields: implementation must not use these as rewrite authority.
    assertionOverride: 'A reviewer must not rewrite the source assertion here.',
    sourceContextOverride: { MANAGEMENT: { status: 'REPORTED' } },
    audit: audit('evt-no-override')
  });
  assert.equal(result.claim.semanticPayload.assertion, bundle.claimCandidates[0].semanticPayload.assertion);
  assert.deepEqual(result.sourceContext.semanticPayload.contextFamilies, bundle.sourceContextCandidates[0].semanticPayload.contextFamilies);
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
