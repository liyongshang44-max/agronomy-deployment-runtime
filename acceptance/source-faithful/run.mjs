import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { makeAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  SourceFaithfulReviewError,
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';

const SOURCE_TEXT = [
  'Corn irrigation protocol.',
  'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
  'This protocol was evaluated under center-pivot irrigation.',
  'Groundwater depth was not reported.'
].join('\n');

function audit(eventId, actorId = 'scientific-reviewer', actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-08-15T14:30:00.000Z',
    actor: { type: actorType, id: actorId },
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
  const context = Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [
      { semanticHint: 'crop.identity', valueCandidate: 'maize', supportClass: 'EXPLICIT_SOURCE', sourceLocator: byteRange(SOURCE_TEXT, 'maize') },
      { semanticHint: 'crop.stage', valueCandidate: 'V10', supportClass: 'EXPLICIT_SOURCE', sourceLocator: byteRange(SOURCE_TEXT, 'V10') }
    ]
  };
  context.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{ semanticHint: 'soil.texture', valueCandidate: 'silt loam', supportClass: 'EXPLICIT_SOURCE', sourceLocator: byteRange(SOURCE_TEXT, 'silt loam') }]
  };
  context.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{ semanticHint: 'irrigation.system', valueCandidate: 'center-pivot', supportClass: 'EXPLICIT_SOURCE', sourceLocator: byteRange(SOURCE_TEXT, 'center-pivot irrigation') }]
  };
  return context;
}

function contextAdjudication() {
  return {
    BIOLOGICAL: [
      { semanticId: 'crop.code', valueType: 'CATEGORY' },
      { semanticId: 'crop.stage', valueType: 'CATEGORY' }
    ],
    ENVIRONMENTAL: [{ semanticId: 'soil.texture', valueType: 'CATEGORY' }],
    MANAGEMENT: [],
    OPERATIONAL: [{ semanticId: 'irrigation.system', valueType: 'CATEGORY' }],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

function compilationProposal({ key = 'depletion-threshold' } = {}) {
  const assertion = 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.';
  return {
    claims: [{
      key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion,
      structured: { threshold: { semanticHint: 'soil.root_zone.depletion_fraction', valueCandidate: '0.45' } },
      sourceLocator: byteRange(SOURCE_TEXT, assertion),
      sourceContext: sourceContextProposal()
    }],
    runMetadata: { fixture: 'k03-source-faithful' }
  };
}

function publishReviewAuthorization({ ledger, source, reviewer, role = 'AGRONOMY_REVIEWER', suffix = 'default' }) {
  const roleAssignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.k03.${suffix}`,
    version: '1',
    principal: reviewer,
    role,
    scope: { organizationId: source.semanticPayload.ownership.organizationId, tenantId: source.semanticPayload.ownership.tenantId },
    audit: audit(`evt-role-${suffix}`, 'iam-admin')
  });
  const policy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.k03.${suffix}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: source.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: source.semanticPayload.ownership.organizationId }],
    audit: audit(`evt-policy-${suffix}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeInspection({
    principal: reviewer,
    policy,
    roleAssignments: [roleAssignment],
    authorizationScope: { organizationId: source.semanticPayload.ownership.organizationId, tenantId: source.semanticPayload.ownership.tenantId }
  });
  const authorizationAudit = recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit(`evt-auth-${suffix}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { roleAssignment, policy, decision, authorizationAudit };
}

function setup({ reviewerRole = 'AGRONOMY_REVIEWER' } = {}) {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.protocol.k03', version: '1', sourceType: 'PROTOCOL', title: 'Corn Irrigation Protocol',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    bibliographic: { authoringOrganization: 'Example Agronomy Co' }, rights: { license: 'PRIVATE' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.protocol.k03', version: '1', sourceRef: source.ref, bytes: Buffer.from(SOURCE_TEXT, 'utf8'),
    mediaType: 'text/plain', materializationIdentity: 'k03-fixture-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T14:20:00Z', locator: 'fixture://k03' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger, logicalId: 'compiler.k03', version: '1', compilerId: 'adr.k03.fixture-compiler', implementationVersion: '1',
    configuration: { fixture: true }, audit: audit('evt-compiler-definition', 'compiler-admin')
  });
  const reviewer = createPrincipal({ principalId: 'scientific-reviewer', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const authorization = publishReviewAuthorization({ ledger, source, reviewer, role: reviewerRole });
  return {
    ledger, sourceRegistry, source, artifact, compilerDefinition,
    compiler: new ScientificCompiler({ ledger, sourceRegistry }),
    reviewService: new SourceFaithfulReviewService({ ledger }), reviewer, authorization
  };
}

function compile(env, { logicalId = 'compilation.k03', key = 'depletion-threshold' } = {}) {
  return env.compiler.materializeCompilationProposal({
    compilationLogicalId: logicalId, version: '1', sourceArtifactRef: env.artifact.ref, compilerDefinitionRef: env.compilerDefinition.ref,
    proposal: compilationProposal({ key }), audit: audit(`evt-${logicalId}`, 'compiler-service', 'SERVICE_ACCOUNT')
  });
}

function review(env, bundle, overrides = {}) {
  return env.reviewService.reviewCandidate({
    reviewLogicalId: overrides.reviewLogicalId ?? 'review.k03.accept',
    reviewVersion: overrides.reviewVersion ?? '1',
    compilationResultRef: overrides.compilationResultRef ?? bundle.result.ref,
    claimCandidateRef: overrides.claimCandidateRef ?? bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: overrides.sourceContextCandidateRef ?? bundle.sourceContextCandidates[0].ref,
    disposition: overrides.disposition ?? 'ACCEPT_SOURCE_FAITHFUL',
    reasonCodes: overrides.reasonCodes ?? [],
    contextAdjudication: overrides.contextAdjudication ?? contextAdjudication(),
    reviewPrincipal: overrides.reviewPrincipal ?? env.reviewer,
    authorizationDecisionAuditRef: overrides.authorizationDecisionAuditRef ?? env.authorization.authorizationAudit.ref,
    claimLogicalId: overrides.claimLogicalId ?? 'claim.corn-water.depletion-threshold', claimVersion: overrides.claimVersion ?? '1',
    sourceContextLogicalId: overrides.sourceContextLogicalId ?? 'source-context.corn-water.depletion-threshold', sourceContextVersion: overrides.sourceContextVersion ?? '1',
    audit: audit(overrides.auditEventId ?? 'evt-k03-review', overrides.auditActorId ?? env.reviewer.principalId)
  });
}

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'} (${caught?.code ?? 'no code'})`);
  assert.equal(caught.code, code);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('accepted exact candidate materializes Claim and canonical SourceContext', () => {
  const env = setup(); const bundle = compile(env); const result = review(env, bundle);
  assert.equal(result.claim.ref.kind, 'Claim');
  assert.equal(result.sourceContext.ref.kind, 'SourceContext');
  assert.equal(result.sourceContext.semanticPayload.claimRef.semanticHash, result.claim.ref.semanticHash);
  assert.equal(result.review.semanticPayload.authorizationDecisionAuditRef.semanticHash, env.authorization.authorizationAudit.ref.semanticHash);
});

test('final Claim is source assertion authority and does not freeze compiler structured proposal vocabulary', () => {
  const env = setup(); const bundle = compile(env); const { claim } = review(env, bundle);
  assert.equal(claim.semanticPayload.assertion, bundle.claimCandidates[0].semanticPayload.assertion);
  assert.equal(claim.semanticPayload.authorityClass, 'SOURCE_ASSERTION');
  assert.ok(!('structured' in claim.semanticPayload));
  assert.ok(!('extractionConfidence' in claim.semanticPayload));
  assert.ok(!('qualification' in claim.semanticPayload));
});

test('final SourceContext uses canonical semantic-id/value envelope rather than candidate vocabulary', () => {
  const env = setup(); const bundle = compile(env); const { sourceContext } = review(env, bundle);
  const biological = sourceContext.semanticPayload.contextFamilies.BIOLOGICAL;
  assert.equal(biological.dimensions[0].semanticId, 'crop.code');
  assert.deepEqual(biological.dimensions[0].value, { type: 'CATEGORY', category: 'maize' });
  assert.ok(!('semanticHint' in biological.dimensions[0]));
  assert.ok(!('valueCandidate' in biological.dimensions[0]));
  assert.equal(sourceContext.semanticPayload.contextFamilies.MANAGEMENT.status, 'NOT_REPORTED');
});

test('non-canonical semantic adjudication cannot become SourceContext authority', () => {
  const env = setup(); const bundle = compile(env); const bad = contextAdjudication();
  bad.BIOLOGICAL[0] = { semanticId: 'crop identity', valueType: 'CATEGORY' };
  expectError(() => review(env, bundle, { reviewLogicalId: 'review.k03.bad-semantic', contextAdjudication: bad }), SourceFaithfulReviewError, 'INVALID_SEMANTIC_ID');
  assert.equal(env.ledger.listVersions('SourceContext', 'source-context.corn-water.depletion-threshold').length, 0);
});

test('rejected review requires reason and creates no Claim or SourceContext', () => {
  const env = setup(); const bundle = compile(env);
  const rejected = review(env, bundle, { reviewLogicalId: 'review.k03.reject', disposition: 'REJECT_SOURCE_FAITHFUL', reasonCodes: ['SOURCE_LOCATOR_DOES_NOT_SUPPORT_ASSERTION'] });
  assert.equal(rejected.claim, null); assert.equal(rejected.sourceContext, null);
});

test('rejection without reason is invalid', () => {
  const env = setup(); const bundle = compile(env);
  expectError(() => review(env, bundle, { reviewLogicalId: 'review.k03.reject-no-reason', disposition: 'REJECT_SOURCE_FAITHFUL', reasonCodes: [] }), SourceFaithfulReviewError, 'REJECTION_REASON_REQUIRED');
});

test('orphan candidate outside exact completed compilation is rejected', () => {
  const env = setup(); const a = compile(env, { logicalId: 'compilation.k03.a', key: 'a' }); const b = compile(env, { logicalId: 'compilation.k03.b', key: 'b' });
  expectError(() => review(env, a, { reviewLogicalId: 'review.k03.orphan', claimCandidateRef: b.claimCandidates[0].ref }), SourceFaithfulReviewError, 'CLAIM_CANDIDATE_NOT_IN_COMPILATION');
});

test('self-consistent forged bundle with nonexistent upstream Source/Artifact/Compiler cannot mint authority', () => {
  const env = setup();
  const fakeSourceRef = makeAuthorityRef({ kind: 'Source', logicalId: 'fake.source', version: '1', semanticHash: `sha256:${'1'.repeat(64)}` });
  const fakeArtifactRef = makeAuthorityRef({ kind: 'SourceArtifact', logicalId: 'fake.artifact', version: '1', semanticHash: `sha256:${'2'.repeat(64)}` });
  const fakeCompilerRef = makeAuthorityRef({ kind: 'ScientificCompilerDefinition', logicalId: 'fake.compiler', version: '1', semanticHash: `sha256:${'3'.repeat(64)}` });
  const contentHash = `sha256:${'4'.repeat(64)}`;
  const claim = env.ledger.publish({ kind: 'ClaimCandidate', logicalId: 'fake.claim', version: '1', semanticPayload: {
    claimType: 'PARAMETER', assertion: 'fake', sourceRef: fakeSourceRef, sourceArtifactRef: fakeArtifactRef, sourceArtifactContentHash: contentHash,
    sourceLocator: { kind: 'WHOLE_ARTIFACT', contentHash, byteLength: 1 }, compilerDefinitionRef: fakeCompilerRef, authorityClass: 'CANDIDATE_PROPOSAL'
  }, audit: audit('evt-fake-claim', 'forger') });
  const context = env.ledger.publish({ kind: 'SourceContextCandidate', logicalId: 'fake.context', version: '1', semanticPayload: {
    claimCandidateRef: claim.ref, sourceRef: fakeSourceRef, sourceArtifactRef: fakeArtifactRef, sourceArtifactContentHash: contentHash, compilerDefinitionRef: fakeCompilerRef,
    contextFamilies: Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])), authorityClass: 'CANDIDATE_PROPOSAL'
  }, audit: audit('evt-fake-context', 'forger') });
  const result = env.ledger.publish({ kind: 'ScientificCompilationResult', logicalId: 'fake.result', version: '1', semanticPayload: {
    sourceRef: fakeSourceRef, sourceArtifactRef: fakeArtifactRef, sourceArtifactContentHash: contentHash, compilerDefinitionRef: fakeCompilerRef,
    claimCandidateRefs: [claim.ref], sourceContextCandidateRefs: [context.ref], candidateCount: 1, runMetadata: {}, outputAuthority: 'PROPOSAL_ONLY'
  }, audit: audit('evt-fake-result', 'forger') });
  expectError(() => review(env, { result, claimCandidates: [claim], sourceContextCandidates: [context] }, {
    reviewLogicalId: 'review.k03.forged-bundle', contextAdjudication: { BIOLOGICAL: [], ENVIRONMENTAL: [], MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: [] }
  }), AuthorityLedgerError, 'AUTHORITY_NOT_FOUND');
  assert.equal(env.ledger.listVersions('Claim', 'claim.corn-water.depletion-threshold').length, 0);
});

test('compiler definition must remain CANDIDATE_ONLY across full upstream closure', () => {
  const env = setup(); const bundle = compile(env);
  const badCompiler = env.ledger.publish({ kind: 'ScientificCompilerDefinition', logicalId: 'compiler.bad', version: '1', semanticPayload: {
    compilerId: 'bad', implementationVersion: '1', extractionContractVersion: 'x', locatorContractVersion: 'x', configuration: {}, outputAuthority: 'QUALIFIED'
  }, audit: audit('evt-bad-compiler', 'compiler-admin') });
  const claim = env.ledger.publish({ kind: 'ClaimCandidate', logicalId: 'claim.bad-compiler', version: '1', semanticPayload: { ...bundle.claimCandidates[0].semanticPayload, compilerDefinitionRef: badCompiler.ref }, audit: audit('evt-bad-compiler-claim', 'forger') });
  const context = env.ledger.publish({ kind: 'SourceContextCandidate', logicalId: 'context.bad-compiler', version: '1', semanticPayload: { ...bundle.sourceContextCandidates[0].semanticPayload, claimCandidateRef: claim.ref, compilerDefinitionRef: badCompiler.ref }, audit: audit('evt-bad-compiler-context', 'forger') });
  const result = env.ledger.publish({ kind: 'ScientificCompilationResult', logicalId: 'result.bad-compiler', version: '1', semanticPayload: { ...bundle.result.semanticPayload, compilerDefinitionRef: badCompiler.ref, claimCandidateRefs: [claim.ref], sourceContextCandidateRefs: [context.ref] }, audit: audit('evt-bad-compiler-result', 'forger') });
  expectError(() => review(env, { result, claimCandidates: [claim], sourceContextCandidates: [context] }, { reviewLogicalId: 'review.k03.bad-compiler' }), SourceFaithfulReviewError, 'UPSTREAM_PROVENANCE_INVALID');
});

test('unauthorized reviewer cannot mint review/Claim/SourceContext authority', () => {
  const env = setup({ reviewerRole: 'AGRONOMIST' }); const bundle = compile(env);
  expectError(() => review(env, bundle), SourceFaithfulReviewError, 'REVIEWER_PERMISSION_DENIED');
  assert.equal(env.ledger.listVersions('SourceFaithfulReviewDecision', 'review.k03.accept').length, 0);
});

test('review actor must equal exact authorized principal', () => {
  const env = setup(); const bundle = compile(env);
  expectError(() => review(env, bundle, { auditActorId: 'someone-else' }), SourceFaithfulReviewError, 'REVIEW_ACTOR_MISMATCH');
});

test('Claim and SourceContext authority publication is all-or-none after accepted review', () => {
  const env = setup(); const bundle = compile(env);
  env.ledger.publish({ kind: 'SourceContext', logicalId: 'source-context.atomicity', version: '1', semanticPayload: { deliberately: 'conflicting-existing-authority' }, audit: audit('evt-preexisting-context', 'fixture-admin') });
  expectError(() => review(env, bundle, { reviewLogicalId: 'review.k03.atomicity', claimLogicalId: 'claim.atomicity', sourceContextLogicalId: 'source-context.atomicity' }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
  assert.equal(env.ledger.listVersions('Claim', 'claim.atomicity').length, 0);
  assert.equal(env.ledger.listVersions('SourceFaithfulReviewDecision', 'review.k03.atomicity').length, 1);
});

test('published Claim/SourceContext versions cannot be rewritten', () => {
  const env = setup(); const first = compile(env, { logicalId: 'compilation.k03.first', key: 'first' });
  review(env, first, { reviewLogicalId: 'review.k03.first', claimLogicalId: 'claim.immutable', sourceContextLogicalId: 'context.immutable' });
  const second = compile(env, { logicalId: 'compilation.k03.second', key: 'second' });
  expectError(() => review(env, second, { reviewLogicalId: 'review.k03.second', claimLogicalId: 'claim.immutable', sourceContextLogicalId: 'context.immutable' }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('audit and lineage bind authorization, review and exact proposal provenance', () => {
  const env = setup(); const bundle = compile(env); const result = review(env, bundle);
  const direct = env.ledger.auditFor(result.claim.ref).find((event) => event.objectRef.semanticHash === result.claim.ref.semanticHash);
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === result.review.ref.semanticHash));
  assert.ok(direct.inputRefs.some((ref) => ref.semanticHash === env.authorization.authorizationAudit.ref.semanticHash));
  assert.ok(env.ledger.lineageFor(result.claim.ref).some((line) => line.relation === 'derived_from' && line.to.semanticHash === bundle.claimCandidates[0].ref.semanticHash));
});

test('accepted source-faithful review creates no QualifiedKnowledge', () => {
  const env = setup(); const bundle = compile(env); review(env, bundle);
  assert.equal(env.ledger.listVersions('QualifiedKnowledge', 'claim.corn-water.depletion-threshold').length, 0);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exit(1);
