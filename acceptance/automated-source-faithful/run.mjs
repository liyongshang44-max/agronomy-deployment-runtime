import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY,
  AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS
} from '../../packages/knowledge-registry/src/automated-source-faithful.mjs';
import { PilotAutomatedSourceFaithfulReviewAdapter } from '../../apps/pilot-api/src/review/automated-review.mjs';

const SOURCE_TEXT = [
  'Maize irrigation field study.',
  'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
  'The study used center-pivot irrigation.'
].join('\n');

function audit(eventId, actorId = 'compiler-service', actorType = 'SERVICE_ACCOUNT') {
  return {
    eventId,
    occurredAt: '2026-08-19T02:30:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'automated-source-faithful-acceptance' }
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

function checks(overrides = {}) {
  return Object.fromEntries(AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS.map((name) => [name, overrides[name] ?? 'PASS']));
}

function reviewerMetadata({ provider = 'REVIEW_PROVIDER_B', model = 'review-model-b' } = {}) {
  return {
    provider,
    model,
    promptVersion: 'adr-source-faithful-review-prompt-v1',
    schemaVersion: 'adr-source-faithful-review-output-v1',
    reviewMode: 'BLIND_FALSIFICATION'
  };
}

function setup({ extractionProvider = 'EXTRACT_PROVIDER_A', extractionModel = 'extract-model-a' } = {}) {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: `source.auto-review.${extractionProvider}.${extractionModel}`,
    version: '1',
    sourceType: 'PUBLICATION',
    title: 'Automated review fixture',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { license: 'INTERNAL_EVALUATION' },
    audit: audit('evt-source', 'source-admin', 'USER')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: `artifact.auto-review.${extractionProvider}.${extractionModel}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(SOURCE_TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'automated-review-fixture',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-19T02:00:00Z', locator: 'fixture://automated-review' },
    audit: audit('evt-artifact', 'source-admin', 'USER')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.auto-review',
    version: '1',
    compilerId: 'adr.auto-review.fixture',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler-definition')
  });
  const assertion = 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.';
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const compiled = compiler.materializeCompilationProposal({
    compilationLogicalId: `compilation.auto-review.${extractionProvider}.${extractionModel}`,
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: 'irrigation-threshold',
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion,
        confidence: 0.99,
        sourceLocator: byteRange(SOURCE_TEXT, assertion),
        sourceContext: sourceContextProposal()
      }],
      runMetadata: {
        provider: extractionProvider,
        model: extractionModel,
        extractionConfidence: 0.99,
        extractorRationale: 'must never enter blind reviewer packet'
      }
    },
    audit: audit('evt-compilation')
  });
  return {
    ledger,
    sourceRegistry,
    compiled,
    adapter: new PilotAutomatedSourceFaithfulReviewAdapter({ ledger })
  };
}

function output(overrides = {}) {
  return {
    disposition: overrides.disposition ?? 'ACCEPT_SOURCE_FAITHFUL',
    reasonCodes: overrides.reasonCodes ?? [],
    rationale: overrides.rationale ?? 'The assertion and all attached source context are fully supported by the exact source evidence.',
    reviewConfidence: overrides.reviewConfidence ?? 0.98,
    checks: overrides.checks ?? checks(),
    ...(overrides.contextAdjudication === null ? {} : { contextAdjudication: overrides.contextAdjudication ?? contextAdjudication() })
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('blind packet excludes extractor identity/confidence/rationale while preserving opaque exact bindings', () => {
  const env = setup();
  const claim = env.compiled.claimCandidates[0];
  const context = env.compiled.sourceContextCandidates[0];
  const blind = env.adapter.blindPacket({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: claim.ref,
    sourceContextCandidateRef: context.ref
  });
  const serialized = JSON.stringify(blind.packet);
  assert.equal(serialized.includes('EXTRACT_PROVIDER_A'), false);
  assert.equal(serialized.includes('extract-model-a'), false);
  assert.equal(serialized.includes('0.99'), false, 'extractor confidence must not leak into blind packet');
  assert.equal(serialized.includes('must never enter blind reviewer packet'), false);
  assert.equal(serialized.includes(claim.ref.logicalId), false, 'candidate logicalId must not leak into provider-facing packet');
  assert.equal(serialized.includes(claim.semanticPayload.sourceArtifactRef.logicalId), false, 'artifact logicalId must not leak into provider-facing packet');
  assert.equal(blind.packet.opaqueBinding.claimCandidateSemanticHash, claim.ref.semanticHash);
  assert.equal(blind.packet.opaqueBinding.sourceContextCandidateSemanticHash, context.ref.semanticHash);
  assert.equal(blind.packet.opaqueBinding.sourceArtifactContentHash, claim.semanticPayload.sourceArtifactContentHash);
  assert.equal(blind.packet.claim.assertion, claim.semanticPayload.assertion);
});

test('independent high-confidence all-pass LLM2 review auto-accepts and mints Source assertion with SERVICE_ACCOUNT reviewer', () => {
  const env = setup();
  const claim = env.compiled.claimCandidates[0];
  const context = env.compiled.sourceContextCandidates[0];
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: claim.ref,
    sourceContextCandidateRef: context.ref,
    reviewerMetadata: reviewerMetadata(),
    output: output(),
    version: 'auto-accept-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'ACCEPT_SOURCE_FAITHFUL');
  assert.equal(result.proposal.semanticPayload.outputAuthority, 'PROPOSAL_ONLY');
  assert.equal(result.review.semanticPayload.reviewPrincipal.type, 'SERVICE_ACCOUNT');
  assert.equal(result.review.semanticPayload.disposition, 'ACCEPT_SOURCE_FAITHFUL');
  assert.equal(result.claim.semanticPayload.authorityClass, 'SOURCE_ASSERTION');
  assert.equal(result.sourceContext.semanticPayload.authorityClass, 'SOURCE_CONTEXT');
  const reviewAudit = env.ledger.auditFor(result.review.ref).find((event) => event.objectRef.semanticHash === result.review.ref.semanticHash);
  assert.ok(reviewAudit.inputRefs.some((ref) => ref.semanticHash === result.proposal.ref.semanticHash));
});

test('same extractor and reviewer model cannot auto-resolve and escalates without minting Claim', () => {
  const env = setup();
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: env.compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: env.compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: reviewerMetadata({ provider: 'EXTRACT_PROVIDER_A', model: 'extract-model-a' }),
    output: output(),
    version: 'same-model-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
  assert.ok(result.adjudication.promotionReasons.includes('REVIEWER_NOT_INDEPENDENT'));
  assert.equal(result.review, null);
  assert.equal(result.claim, null);
});

test('low-confidence proposed acceptance escalates rather than silently accepting or rejecting', () => {
  const env = setup();
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: env.compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: env.compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: reviewerMetadata(),
    output: output({ reviewConfidence: DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY.minAutoAcceptConfidence - 0.01 }),
    version: 'low-confidence-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
  assert.ok(result.adjudication.promotionReasons.includes('AUTO_ACCEPT_CONFIDENCE_BELOW_THRESHOLD'));
  assert.equal(result.claim, null);
});

test('any failed fidelity check prevents auto-accept and escalates', () => {
  const env = setup();
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: env.compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: env.compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: reviewerMetadata(),
    output: output({ checks: checks({ EVIDENCE_COVERAGE: 'FAIL' }) }),
    version: 'failed-check-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
  assert.ok(result.adjudication.promotionReasons.includes('AUTO_ACCEPT_REVIEW_CHECK_FAILED'));
  assert.equal(result.claim, null);
});

test('independent high-confidence rejection with explicit defect auto-rejects and mints no Claim', () => {
  const env = setup();
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: env.compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: env.compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: reviewerMetadata(),
    output: output({
      disposition: 'REJECT_SOURCE_FAITHFUL',
      reasonCodes: ['EVIDENCE_LOCATOR_INCOMPLETE'],
      checks: checks({ EVIDENCE_COVERAGE: 'FAIL' }),
      contextAdjudication: null
    }),
    version: 'auto-reject-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'REJECT_SOURCE_FAITHFUL');
  assert.equal(result.review.semanticPayload.disposition, 'REJECT_SOURCE_FAITHFUL');
  assert.equal(result.claim, null);
  assert.equal(result.sourceContext, null);
});

test('reviewer-requested escalation produces proposal only and never impersonates human review', () => {
  const env = setup();
  const result = env.adapter.review({
    compilationResultRef: env.compiled.result.ref,
    claimCandidateRef: env.compiled.claimCandidates[0].ref,
    sourceContextCandidateRef: env.compiled.sourceContextCandidates[0].ref,
    reviewerMetadata: reviewerMetadata(),
    output: output({
      disposition: 'ESCALATE_TO_HUMAN',
      reviewConfidence: 0.70,
      contextAdjudication: null
    }),
    version: 'explicit-escalation-v1'
  });
  assert.equal(result.adjudication.effectiveDisposition, 'ESCALATE_TO_HUMAN');
  assert.equal(result.proposal.ref.kind, 'AutomatedSourceFaithfulReviewProposal');
  assert.equal(result.review, null);
  assert.equal(result.claim, null);
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
