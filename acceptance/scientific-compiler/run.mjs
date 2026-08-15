import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry, sourceContentHash } from '../../packages/source-registry/src/index.mjs';
import {
  CLAIM_CANDIDATE_TYPES,
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  ScientificCompilerError,
  compilationSemanticDigest,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';

const ARTIFACT_TEXT = [
  'Corn irrigation protocol.',
  'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
  'This protocol was evaluated under center-pivot irrigation.',
  'Groundwater depth was not reported.'
].join('\n');

function audit(eventId, actorId = 'compiler-service') {
  return {
    eventId,
    occurredAt: '2026-08-15T14:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: actorId },
    details: { channel: 'compiler-acceptance' }
  };
}

function byteRange(text, excerpt) {
  const start = Buffer.byteLength(text.slice(0, text.indexOf(excerpt)), 'utf8');
  const length = Buffer.byteLength(excerpt, 'utf8');
  if (text.indexOf(excerpt) < 0) throw new Error(`excerpt not found: ${excerpt}`);
  return { kind: 'BYTE_RANGE', start, endExclusive: start + length };
}

function notReportedContext() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
}

function proposalFor(text = ARTIFACT_TEXT) {
  const context = notReportedContext();
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'maize')
    }, {
      semanticHint: 'crop.stage',
      valueCandidate: 'V10',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'V10')
    }]
  };
  context.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'soil.texture',
      valueCandidate: 'silt loam',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'silt loam')
    }]
  };
  context.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'irrigation.system',
      valueCandidate: 'center-pivot',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'center-pivot irrigation')
    }]
  };

  return {
    claims: [{
      key: 'depletion-threshold',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
      structured: {
        threshold: { semanticHint: 'soil.root_zone.depletion_fraction', valueCandidate: '0.45' }
      },
      sourceLocator: byteRange(text, 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.'),
      confidence: 0.91,
      sourceContext: context
    }],
    runMetadata: { fixture: 'corn-irrigation-compiler-01' }
  };
}

function setup({ compilerVersion = '1', compilerConfiguration = { mode: 'deterministic-fixture' } } = {}) {
  const ledger = new AuthorityLedger();
  const artifactStore = new ExactArtifactStore();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.protocol.corn-irrigation',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'Corn Irrigation Protocol',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    bibliographic: { authoringOrganization: 'Example Agronomy Co' },
    edition: '2026-A',
    rights: { license: 'PRIVATE' },
    audit: audit('evt-source', 'source-admin')
  });
  const bytes = Buffer.from(ARTIFACT_TEXT, 'utf8');
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.protocol.corn-irrigation',
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'text/plain',
    materializationIdentity: 'fixture-text-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T13:59:00Z', locator: 'fixture://corn-irrigation' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.reference',
    version: compilerVersion,
    compilerId: 'adr.reference-deterministic-extractor',
    implementationVersion: compilerVersion,
    configuration: compilerConfiguration,
    audit: audit(`evt-compiler-def-${compilerVersion}`, 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  return { ledger, sourceRegistry, source, artifact, compilerDefinition, compiler, bytes };
}

function compile(env, proposal = proposalFor()) {
  return env.compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.corn-irrigation',
    version: '1',
    sourceArtifactRef: env.artifact.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    proposal,
    audit: audit('evt-compilation')
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

test('frozen claim candidate type vocabulary matches Architecture v1.0 representative claim classes', () => {
  assert.deepEqual(CLAIM_CANDIDATE_TYPES, [
    'SEMANTIC_DEFINITION', 'PARAMETER', 'RELATIONSHIP', 'BIOLOGICAL_PATTERN', 'CAUSAL_EFFECT',
    'STATISTICAL_ASSOCIATION', 'MODEL_ASSUMPTION', 'OPERATIONAL_RECOMMENDATION',
    'BOUNDARY_CONSTRAINT', 'EVALUATION_CLAIM'
  ]);
});

test('compiler definition is immutable candidate-only authority and binds exact configuration', () => {
  const env = setup();
  assert.equal(env.compilerDefinition.ref.kind, 'ScientificCompilerDefinition');
  assert.equal(env.compilerDefinition.semanticPayload.outputAuthority, 'CANDIDATE_ONLY');
  assert.equal(env.compilerDefinition.semanticPayload.configuration.mode, 'deterministic-fixture');
});

test('ScientificCompilation consumes exact SourceArtifact, not Source or mutable locator', () => {
  const env = setup();
  expectError(() => env.compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.invalid-source-input',
    version: '1',
    sourceArtifactRef: env.source.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    proposal: proposalFor(),
    audit: audit('evt-invalid-source-input')
  }), ScientificCompilerError, 'SOURCE_ARTIFACT_REQUIRED');
});

test('ClaimCandidate binds exact SourceArtifact ref/content hash, Source ref and compiler definition', () => {
  const env = setup();
  const bundle = compile(env);
  const claim = bundle.claimCandidates[0];
  assert.equal(claim.ref.kind, 'ClaimCandidate');
  assert.equal(claim.semanticPayload.sourceArtifactRef.semanticHash, env.artifact.ref.semanticHash);
  assert.equal(claim.semanticPayload.sourceArtifactContentHash, env.artifact.semanticPayload.contentHash);
  assert.equal(claim.semanticPayload.sourceRef.semanticHash, env.source.ref.semanticHash);
  assert.equal(claim.semanticPayload.compilerDefinitionRef.semanticHash, env.compilerDefinition.ref.semanticHash);
  assert.equal(claim.semanticPayload.authorityClass, 'CANDIDATE_PROPOSAL');
  assert.ok(!('qualification' in claim.semanticPayload));
  assert.ok(!('allowedUses' in claim.semanticPayload));
});

test('BYTE_RANGE locator is content-addressed against exact artifact bytes', () => {
  const env = setup();
  const bundle = compile(env);
  const locator = bundle.claimCandidates[0].semanticPayload.sourceLocator;
  const selected = env.bytes.subarray(locator.start, locator.endExclusive);
  assert.equal(locator.evidenceHash, sourceContentHash(selected));
  assert.equal(selected.toString('utf8'), proposalFor().claims[0].assertion);
});

test('SourceContextCandidate contains all six families and uses NOT_REPORTED rather than guessed values', () => {
  const env = setup();
  const bundle = compile(env);
  const context = bundle.sourceContextCandidates[0];
  assert.equal(context.ref.kind, 'SourceContextCandidate');
  assert.deepEqual(Object.keys(context.semanticPayload.contextFamilies).sort(), [...SOURCE_CONTEXT_FAMILIES].sort());
  assert.equal(context.semanticPayload.contextFamilies.MANAGEMENT.status, 'NOT_REPORTED');
  assert.deepEqual(context.semanticPayload.contextFamilies.MANAGEMENT.dimensions, []);
  assert.equal(context.semanticPayload.contextFamilies.MEASUREMENT.status, 'NOT_REPORTED');
  assert.equal(context.semanticPayload.contextFamilies.BIOLOGICAL.status, 'REPORTED');
});

test('compiler rejects inferred/defaulted SourceContextCandidate dimensions', () => {
  const env = setup();
  const proposal = proposalFor();
  proposal.claims[0].sourceContext.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'planting.date',
      valueCandidate: '2026-05-20',
      supportClass: 'INFERRED',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  expectError(() => compile(env, proposal), ScientificCompilerError, 'NON_SOURCE_FAITHFUL_CONTEXT_CANDIDATE');
});

test('NOT_REPORTED family cannot secretly carry candidate values', () => {
  const env = setup();
  const proposal = proposalFor();
  proposal.claims[0].sourceContext.MEASUREMENT = {
    status: 'NOT_REPORTED',
    dimensions: [{
      semanticHint: 'measurement.depth',
      valueCandidate: '600',
      unitCandidate: 'mm',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  expectError(() => compile(env, proposal), ScientificCompilerError, 'NOT_REPORTED_WITH_VALUES');
});

test('REPORTED family must contain at least one explicit source-supported dimension', () => {
  const env = setup();
  const proposal = proposalFor();
  proposal.claims[0].sourceContext.ENVIRONMENTAL = { status: 'REPORTED', dimensions: [] };
  expectError(() => compile(env, proposal), ScientificCompilerError, 'REPORTED_WITHOUT_VALUES');
});

test('invalid source byte range is rejected before any candidate authority is published', () => {
  const env = setup();
  const proposal = proposalFor();
  proposal.claims[0].sourceLocator = { kind: 'BYTE_RANGE', start: 0, endExclusive: env.bytes.byteLength + 100 };
  expectError(() => compile(env, proposal), ScientificCompilerError, 'INVALID_BYTE_RANGE');
  assert.equal(env.ledger.listVersions('ClaimCandidate', 'compilation.corn-irrigation/claim/depletion-threshold').length, 0);
});

test('duplicate local claim keys are rejected before candidate publication', () => {
  const env = setup();
  const proposal = proposalFor();
  proposal.claims.push({ ...proposal.claims[0] });
  expectError(() => compile(env, proposal), ScientificCompilerError, 'DUPLICATE_CLAIM_KEY');
  assert.equal(env.ledger.listVersions('ClaimCandidate', 'compilation.corn-irrigation/claim/depletion-threshold').length, 0);
});

test('same artifact + compiler definition + proposal reproduces candidate semantic identities across clean ledgers', () => {
  const envA = setup();
  const envB = setup();
  const a = compile(envA);
  const b = compile(envB);
  assert.equal(a.claimCandidates[0].ref.semanticHash, b.claimCandidates[0].ref.semanticHash);
  assert.equal(a.sourceContextCandidates[0].ref.semanticHash, b.sourceContextCandidates[0].ref.semanticHash);
  assert.equal(a.result.ref.semanticHash, b.result.ref.semanticHash);
  assert.equal(compilationSemanticDigest(a), compilationSemanticDigest(b));
});

test('changing compiler configuration/version changes candidate provenance identity', () => {
  const envA = setup({ compilerVersion: '1', compilerConfiguration: { mode: 'deterministic-fixture', promptHash: 'sha256:a' } });
  const envB = setup({ compilerVersion: '2', compilerConfiguration: { mode: 'deterministic-fixture', promptHash: 'sha256:b' } });
  const a = compile(envA);
  const b = compile(envB);
  assert.notEqual(envA.compilerDefinition.ref.semanticHash, envB.compilerDefinition.ref.semanticHash);
  assert.notEqual(a.claimCandidates[0].ref.semanticHash, b.claimCandidates[0].ref.semanticHash);
});

test('same published compilation candidate version cannot be rewritten with changed assertion', () => {
  const env = setup();
  compile(env);
  const changed = proposalFor();
  changed.claims[0].assertion = 'Changed later judgment must not rewrite the original candidate.';
  expectError(() => compile(env, changed), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('ScientificCompilationResult remains proposal-only and binds candidate/context refs one-to-one', () => {
  const env = setup();
  const bundle = compile(env);
  assert.equal(bundle.result.ref.kind, 'ScientificCompilationResult');
  assert.equal(bundle.result.semanticPayload.outputAuthority, 'PROPOSAL_ONLY');
  assert.equal(bundle.result.semanticPayload.candidateCount, 1);
  assert.equal(bundle.result.semanticPayload.claimCandidateRefs.length, 1);
  assert.equal(bundle.result.semanticPayload.sourceContextCandidateRefs.length, 1);
  assert.equal(bundle.sourceContextCandidates[0].semanticPayload.claimCandidateRef.semanticHash, bundle.claimCandidates[0].ref.semanticHash);
});

test('candidate audit can trace exact SourceArtifact and compiler definition inputs', () => {
  const env = setup();
  const bundle = compile(env);
  const events = env.ledger.auditFor(bundle.claimCandidates[0].ref);
  assert.equal(events.length, 1);
  assert.ok(events[0].inputRefs.some((ref) => ref.semanticHash === env.artifact.ref.semanticHash));
  assert.ok(events[0].inputRefs.some((ref) => ref.semanticHash === env.compilerDefinition.ref.semanticHash));
});

test('core compiler rejects async extractor so packages core cannot become an external provider client', () => {
  const env = setup();
  expectError(() => env.compiler.compileWithExtractor({
    compilationLogicalId: 'compilation.async',
    version: '1',
    sourceArtifactRef: env.artifact.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    extractor: async () => proposalFor(),
    audit: audit('evt-async')
  }), ScientificCompilerError, 'ASYNC_EXTRACTOR_NOT_SUPPORTED_IN_CORE');
});

test('local deterministic extractor receives a defensive artifact-byte copy and produces proposal-only objects', () => {
  const env = setup();
  const originalHash = env.artifact.semanticPayload.contentHash;
  const bundle = env.compiler.compileWithExtractor({
    compilationLogicalId: 'compilation.local-extractor',
    version: '1',
    sourceArtifactRef: env.artifact.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    extractor: ({ bytes }) => {
      assert.equal(sourceContentHash(bytes), originalHash);
      bytes[0] = 0x00;
      return proposalFor();
    },
    audit: audit('evt-local-extractor')
  });
  assert.equal(bundle.result.semanticPayload.outputAuthority, 'PROPOSAL_ONLY');
  assert.equal(sourceContentHash(env.sourceRegistry.readArtifactBytes(env.artifact.ref)), originalHash);
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
