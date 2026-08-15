import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import {
  ExactArtifactStore,
  SourceRegistry,
  SourceRegistryError,
  sourceContentHash
} from '../../packages/source-registry/src/index.mjs';
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
  const charIndex = text.indexOf(excerpt);
  if (charIndex < 0) throw new Error(`excerpt not found: ${excerpt}`);
  const start = Buffer.byteLength(text.slice(0, charIndex), 'utf8');
  const length = Buffer.byteLength(excerpt, 'utf8');
  return { kind: 'BYTE_RANGE', start, endExclusive: start + length };
}

function blankContext() {
  return Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
}

function proposalFor(text = ARTIFACT_TEXT) {
  const sourceContext = blankContext();
  sourceContext.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [
      {
        semanticHint: 'crop.identity',
        valueCandidate: 'maize',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: byteRange(text, 'maize')
      },
      {
        semanticHint: 'crop.stage',
        valueCandidate: 'V10',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: byteRange(text, 'V10')
      }
    ]
  };
  sourceContext.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'soil.texture',
      valueCandidate: 'silt loam',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'silt loam')
    }]
  };
  sourceContext.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'irrigation.system',
      valueCandidate: 'center-pivot',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: byteRange(text, 'center-pivot irrigation')
    }]
  };

  const assertion = 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.';
  return {
    claims: [{
      key: 'depletion-threshold',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion,
      structured: {
        threshold: { semanticHint: 'soil.root_zone.depletion_fraction', valueCandidate: '0.45' }
      },
      sourceLocator: byteRange(text, assertion),
      confidence: 0.91,
      sourceContext
    }],
    runMetadata: { fixture: 'corn-irrigation-compiler-01' }
  };
}

function setup({ compilerVersion = '1', compilerConfiguration = { mode: 'deterministic-fixture' } } = {}) {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
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
    acquisition: {
      method: 'FIXTURE',
      acquiredAt: '2026-08-15T13:59:00Z',
      locator: 'fixture://corn-irrigation'
    },
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
  return {
    ledger,
    sourceRegistry,
    source,
    artifact,
    compilerDefinition,
    compiler: new ScientificCompiler({ ledger, sourceRegistry }),
    bytes
  };
}

function compile(env, proposal = proposalFor(), logicalId = 'compilation.corn-irrigation') {
  return env.compiler.materializeCompilationProposal({
    compilationLogicalId: logicalId,
    version: '1',
    sourceArtifactRef: env.artifact.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    proposal,
    audit: audit(`evt-${logicalId}`)
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

test('claim candidate vocabulary matches frozen representative claim classes', () => {
  assert.deepEqual(CLAIM_CANDIDATE_TYPES, [
    'SEMANTIC_DEFINITION', 'PARAMETER', 'RELATIONSHIP', 'BIOLOGICAL_PATTERN', 'CAUSAL_EFFECT',
    'STATISTICAL_ASSOCIATION', 'MODEL_ASSUMPTION', 'OPERATIONAL_RECOMMENDATION',
    'BOUNDARY_CONSTRAINT', 'EVALUATION_CLAIM'
  ]);
});

test('compiler definition is exact, immutable and candidate-only', () => {
  const env = setup();
  assert.equal(env.compilerDefinition.ref.kind, 'ScientificCompilerDefinition');
  assert.equal(env.compilerDefinition.semanticPayload.outputAuthority, 'CANDIDATE_ONLY');
  assert.equal(env.compilerDefinition.semanticPayload.configuration.mode, 'deterministic-fixture');
});

test('Scientific Compilation requires SourceArtifact rather than Source', () => {
  const env = setup();
  expectError(() => env.compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.invalid-source-input',
    version: '1',
    sourceArtifactRef: env.source.ref,
    compilerDefinitionRef: env.compilerDefinition.ref,
    proposal: proposalFor(),
    audit: audit('evt-invalid-source-input')
  }), SourceRegistryError, 'SOURCE_ARTIFACT_REQUIRED');
});

test('ClaimCandidate binds exact source, artifact content and compiler provenance without qualification authority', () => {
  const env = setup();
  const claim = compile(env).claimCandidates[0];
  assert.equal(claim.ref.kind, 'ClaimCandidate');
  assert.equal(claim.semanticPayload.sourceRef.semanticHash, env.source.ref.semanticHash);
  assert.equal(claim.semanticPayload.sourceArtifactRef.semanticHash, env.artifact.ref.semanticHash);
  assert.equal(claim.semanticPayload.sourceArtifactContentHash, env.artifact.semanticPayload.contentHash);
  assert.equal(claim.semanticPayload.compilerDefinitionRef.semanticHash, env.compilerDefinition.ref.semanticHash);
  assert.equal(claim.semanticPayload.authorityClass, 'CANDIDATE_PROPOSAL');
  assert.ok(!('qualification' in claim.semanticPayload));
  assert.ok(!('allowedUses' in claim.semanticPayload));
});

test('BYTE_RANGE locator is content-addressed against exact retained bytes', () => {
  const env = setup();
  const claim = compile(env).claimCandidates[0];
  const locator = claim.semanticPayload.sourceLocator;
  const selected = env.bytes.subarray(locator.start, locator.endExclusive);
  assert.equal(locator.evidenceHash, sourceContentHash(selected));
  assert.equal(selected.toString('utf8'), proposalFor().claims[0].assertion);
});

test('SourceContextCandidate explicitly carries all six families and NOT_REPORTED states', () => {
  const env = setup();
  const context = compile(env).sourceContextCandidates[0].semanticPayload.contextFamilies;
  assert.deepEqual(Object.keys(context).sort(), [...SOURCE_CONTEXT_FAMILIES].sort());
  assert.equal(context.BIOLOGICAL.status, 'REPORTED');
  assert.equal(context.MANAGEMENT.status, 'NOT_REPORTED');
  assert.deepEqual(context.MANAGEMENT.dimensions, []);
  assert.equal(context.MEASUREMENT.status, 'NOT_REPORTED');
});

test('inferred/defaulted context is rejected rather than laundered into SourceContextCandidate', () => {
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

test('NOT_REPORTED cannot hide values and REPORTED cannot be empty', () => {
  const envA = setup();
  const hidden = proposalFor();
  hidden.claims[0].sourceContext.MEASUREMENT = {
    status: 'NOT_REPORTED',
    dimensions: [{
      semanticHint: 'measurement.depth',
      valueCandidate: '600',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  expectError(() => compile(envA, hidden), ScientificCompilerError, 'NOT_REPORTED_WITH_VALUES');

  const envB = setup();
  const empty = proposalFor();
  empty.claims[0].sourceContext.ENVIRONMENTAL = { status: 'REPORTED', dimensions: [] };
  expectError(() => compile(envB, empty), ScientificCompilerError, 'REPORTED_WITHOUT_VALUES');
});

test('invalid locator and duplicate claim key fail before candidate publication', () => {
  const envA = setup();
  const invalidLocator = proposalFor();
  invalidLocator.claims[0].sourceLocator = {
    kind: 'BYTE_RANGE',
    start: 0,
    endExclusive: envA.bytes.byteLength + 100
  };
  expectError(() => compile(envA, invalidLocator), ScientificCompilerError, 'INVALID_BYTE_RANGE');
  assert.equal(envA.ledger.listVersions('ClaimCandidate', 'compilation.corn-irrigation/claim/depletion-threshold').length, 0);

  const envB = setup();
  const duplicate = proposalFor();
  duplicate.claims.push({ ...duplicate.claims[0] });
  expectError(() => compile(envB, duplicate), ScientificCompilerError, 'DUPLICATE_CLAIM_KEY');
  assert.equal(envB.ledger.listVersions('ClaimCandidate', 'compilation.corn-irrigation/claim/depletion-threshold').length, 0);
});

test('same exact artifact/compiler/proposal reproduces candidate identities across clean ledgers', () => {
  const a = compile(setup());
  const b = compile(setup());
  assert.equal(a.claimCandidates[0].ref.semanticHash, b.claimCandidates[0].ref.semanticHash);
  assert.equal(a.sourceContextCandidates[0].ref.semanticHash, b.sourceContextCandidates[0].ref.semanticHash);
  assert.equal(a.result.ref.semanticHash, b.result.ref.semanticHash);
  assert.equal(compilationSemanticDigest(a), compilationSemanticDigest(b));
});

test('changed compiler definition changes candidate provenance identity', () => {
  const a = compile(setup({ compilerVersion: '1', compilerConfiguration: { mode: 'fixture', promptHash: 'sha256:a' } }));
  const b = compile(setup({ compilerVersion: '2', compilerConfiguration: { mode: 'fixture', promptHash: 'sha256:b' } }));
  assert.notEqual(a.claimCandidates[0].semanticPayload.compilerDefinitionRef.semanticHash, b.claimCandidates[0].semanticPayload.compilerDefinitionRef.semanticHash);
  assert.notEqual(a.claimCandidates[0].ref.semanticHash, b.claimCandidates[0].ref.semanticHash);
});

test('published candidate version cannot be rewritten with changed assertion', () => {
  const env = setup();
  compile(env);
  const changed = proposalFor();
  changed.claims[0].assertion = 'Later interpretation must not rewrite the original candidate.';
  expectError(() => compile(env, changed), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('ScientificCompilationResult remains proposal-only and binds candidate/context refs', () => {
  const bundle = compile(setup());
  assert.equal(bundle.result.ref.kind, 'ScientificCompilationResult');
  assert.equal(bundle.result.semanticPayload.outputAuthority, 'PROPOSAL_ONLY');
  assert.equal(bundle.result.semanticPayload.candidateCount, 1);
  assert.equal(bundle.result.semanticPayload.claimCandidateRefs.length, 1);
  assert.equal(bundle.result.semanticPayload.sourceContextCandidateRefs.length, 1);
  assert.equal(
    bundle.sourceContextCandidates[0].semanticPayload.claimCandidateRef.semanticHash,
    bundle.claimCandidates[0].ref.semanticHash
  );
});

test('candidate direct publication audit binds exact SourceArtifact and compiler-definition inputs', () => {
  const env = setup();
  const bundle = compile(env);
  const claim = bundle.claimCandidates[0];
  const relatedEvents = env.ledger.auditFor(claim.ref);
  const publicationEvent = relatedEvents.find((event) => event.objectRef.semanticHash === claim.ref.semanticHash);
  assert.ok(publicationEvent, 'direct ClaimCandidate publication audit event must exist');
  assert.ok(publicationEvent.inputRefs.some((ref) => ref.semanticHash === env.artifact.ref.semanticHash));
  assert.ok(publicationEvent.inputRefs.some((ref) => ref.semanticHash === env.compilerDefinition.ref.semanticHash));
});

test('core rejects async extractor results and accepts only proposal materialization for external/provider work', () => {
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

test('local deterministic extractor receives defensive artifact bytes and remains proposal-only', () => {
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

test('zero extracted claims is a valid proposal-only compilation result, not proof of no scientific claims', () => {
  const env = setup();
  const bundle = compile(env, { claims: [], runMetadata: { reason: 'none-extracted' } }, 'compilation.zero-claims');
  assert.equal(bundle.result.semanticPayload.candidateCount, 0);
  assert.equal(bundle.result.semanticPayload.outputAuthority, 'PROPOSAL_ONLY');
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
