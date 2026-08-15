import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  ScientificQualificationError,
  ScientificQualificationService,
  qualificationResourceId
} from '../../packages/knowledge-registry/src/qualification.mjs';

const SOURCE_TEXT = [
  'Corn irrigation protocol.',
  'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.',
  'This protocol was evaluated under center-pivot irrigation.',
  'Groundwater depth was not reported.'
].join('\n');

const USE_APPLICABILITY = { use: 'CORN_IRRIGATION_APPLICABILITY' };
const USE_AUTONOMOUS_ACTION = { use: 'AUTONOMOUS_IRRIGATION_ACTION' };
const USE_OTHER = { use: 'OTHER_USE' };

function audit(eventId, actorId, actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-08-15T15:00:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'k04-acceptance' }
  };
}

function byteRange(text, excerpt) {
  const index = text.indexOf(excerpt);
  if (index < 0) throw new Error(`excerpt not found: ${excerpt}`);
  const start = Buffer.byteLength(text.slice(0, index), 'utf8');
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

function contextAdjudication() {
  return {
    BIOLOGICAL: [
      { semanticId: 'crop.code', valueType: 'CATEGORY' },
      { semanticId: 'crop.stage', valueType: 'CATEGORY' }
    ],
    ENVIRONMENTAL: [{ semanticId: 'soil.texture', valueType: 'CATEGORY' }],
    MANAGEMENT: [],
    OPERATIONAL: [{ semanticId: 'operation.irrigation_system', valueType: 'CATEGORY' }],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

function setupSourceFaithfulPair() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.k04.protocol',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'K04 Corn Irrigation Protocol',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { license: 'PRIVATE' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.k04.protocol',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(SOURCE_TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'k04-fixture-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T14:55:00Z' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.k04',
    version: '1',
    compilerId: 'adr.k04.fixture',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler', 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const assertion = 'For maize at V10 under silt loam soil, irrigation may be considered when root-zone depletion exceeds 45 percent.';
  const bundle = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.k04',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: 'depletion-threshold',
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion,
        structured: { threshold: { semanticHint: 'soil.root_zone.depletion_fraction', valueCandidate: '0.45' } },
        sourceLocator: byteRange(SOURCE_TEXT, assertion),
        sourceContext: sourceContextProposal()
      }]
    },
    audit: audit('evt-compilation', 'compiler-service', 'SERVICE_ACCOUNT')
  });

  const reviewer = createPrincipal({
    principalId: 'agronomy-reviewer',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k04.reviewer',
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-reviewer-role', 'iam-admin')
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.k04.source-review',
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: source.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit('evt-review-policy', 'iam-admin')
  });
  const reviewAuth = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy: reviewPolicy,
      roleAssignments: [reviewerRole],
      authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
    }),
    audit: audit('evt-review-auth', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
    reviewLogicalId: 'review.k04.source-faithful',
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuth.ref,
    claimLogicalId: 'claim.k04.corn-irrigation-threshold',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.k04.corn-irrigation-threshold',
    sourceContextVersion: '1',
    audit: audit('evt-source-faithful', reviewer.principalId)
  });

  return {
    ledger,
    sourceRegistry,
    source,
    artifact,
    compilerDefinition,
    bundle,
    reviewed,
    service: new ScientificQualificationService({ ledger })
  };
}

function makeApprover(env, {
  principalId = 'scientific-approver',
  role = 'SCIENTIFIC_APPROVER',
  qualificationScope = [{ use: '*' }],
  policyLogicalId = 'policy.k04.qualification'
} = {}) {
  const principal = createPrincipal({
    principalId,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const roleAssignment = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.k04.${principalId}`,
    version: '1',
    principal,
    role,
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(`evt-role-${principalId}`, 'iam-admin')
  });
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: policyLogicalId,
    version: '1',
    resourceId: qualificationResourceId(env.reviewed.claim.ref, env.reviewed.sourceContext.ref),
    ownership: env.source.semanticPayload.ownership,
    visibilityPolicy: [{ principalId }],
    qualificationScope,
    deploymentScope: [{ organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' }],
    audit: audit(`evt-policy-${principalId}`, 'iam-admin')
  });
  return { principal, roleAssignment, policy };
}

function authorizeTarget(env, authority, target, suffix = target.use) {
  const decision = authorizeKnowledgeQualification({
    principal: authority.principal,
    policy: authority.policy,
    roleAssignments: [authority.roleAssignment],
    qualificationTarget: target,
    authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
  });
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-${authority.principal.principalId}-${suffix}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
}

function qualificationDecision(env, authority, {
  logicalId,
  target,
  disposition,
  authAudit = authorizeTarget(env, authority, target, logicalId),
  reasonCodes = [],
  limitations = [],
  effectModifiers = [],
  semanticPreconditions = [],
  transportConstraints = [],
  supersedesDecisionRef
}) {
  return env.service.recordQualificationDecision({
    decisionLogicalId: logicalId,
    decisionVersion: '1',
    claimRef: env.reviewed.claim.ref,
    sourceContextRef: env.reviewed.sourceContext.ref,
    disposition,
    qualificationTarget: target,
    limitations,
    effectModifiers,
    semanticPreconditions,
    transportConstraints,
    reasonCodes,
    approverPrincipal: authority.principal,
    authorizationDecisionAuditRef: authAudit.ref,
    ...(supersedesDecisionRef ? { supersedesDecisionRef } : {}),
    audit: audit(`evt-${logicalId}`, authority.principal.principalId)
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

test('same Claim can be qualified for one scientific use and explicitly prohibited for another', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const allowed = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.allowed',
    target: USE_APPLICABILITY,
    disposition: 'QUALIFY_USE',
    limitations: [{ code: 'SOURCE_CONTEXT_BOUNDED' }],
    effectModifiers: [{ semanticId: 'soil.texture' }],
    semanticPreconditions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    transportConstraints: [{ code: 'REQUIRES_SOURCE_TO_TARGET_ADJUDICATION' }]
  });
  const prohibited = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.prohibited',
    target: USE_AUTONOMOUS_ACTION,
    disposition: 'PROHIBIT_USE',
    reasonCodes: ['SOURCE_DOES_NOT_ESTABLISH_AUTONOMOUS_ACTION_AUTHORITY']
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.corn-irrigation-threshold',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allowed.ref, prohibited.ref],
    audit: audit('evt-qk', approver.principal.principalId)
  });

  assert.equal(knowledge.ref.kind, 'QualifiedKnowledge');
  assert.deepEqual(knowledge.semanticPayload.allowedUses, [USE_APPLICABILITY]);
  assert.deepEqual(knowledge.semanticPayload.forbiddenUses, [USE_AUTONOMOUS_ACTION]);
  assert.equal(env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: knowledge.ref, qualificationTarget: USE_APPLICABILITY }), 'QUALIFIED');
  assert.equal(env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: knowledge.ref, qualificationTarget: USE_AUTONOMOUS_ACTION }), 'PROHIBITED');
  assert.equal(knowledge.semanticPayload.limitations[0].value.code, 'SOURCE_CONTEXT_BOUNDED');
});

test('QualifiedKnowledge is scientific-use authority only, not applicability/runtime/deployment authority', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const allowed = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.boundary', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.boundary',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allowed.ref],
    audit: audit('evt-qk-boundary', approver.principal.principalId)
  });
  assert.equal(knowledge.semanticPayload.authorityClass, 'SCIENTIFIC_USE_AUTHORITY');
  for (const forbiddenField of ['applicability', 'applicabilityStatus', 'runtimeEligibility', 'decision', 'deploymentScope', 'rolloutStage']) {
    assert.ok(!(forbiddenField in knowledge.semanticPayload), `${forbiddenField} must not appear in QualifiedKnowledge authority`);
  }
});

test('source-faithful review alone cannot mint QualifiedKnowledge without qualification decisions', () => {
  const env = setupSourceFaithfulPair();
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.no-decisions',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [],
    audit: audit('evt-no-decisions', 'scientific-approver')
  }), ScientificQualificationError, 'QUALIFICATION_DECISIONS_REQUIRED');
});

test('AGRONOMY_REVIEWER authorization cannot qualify scientific use', () => {
  const env = setupSourceFaithfulPair();
  const reviewerAuthority = makeApprover(env, {
    principalId: 'reviewer-not-approver',
    role: 'AGRONOMY_REVIEWER',
    policyLogicalId: 'policy.k04.reviewer-not-approver'
  });
  const authAudit = authorizeTarget(env, reviewerAuthority, USE_APPLICABILITY, 'reviewer-denied');
  assert.equal(authAudit.semanticPayload.allowed, false);
  expectError(() => qualificationDecision(env, reviewerAuthority, {
    logicalId: 'qualification.k04.reviewer-denied',
    target: USE_APPLICABILITY,
    disposition: 'QUALIFY_USE',
    authAudit
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_DENIED');
});

test('COMPILER_SERVICE cannot self-qualify a compiler proposal or final Claim', () => {
  const env = setupSourceFaithfulPair();
  const compilerAuthority = makeApprover(env, {
    principalId: 'compiler-service',
    role: 'COMPILER_SERVICE',
    policyLogicalId: 'policy.k04.compiler-denied'
  });
  const authAudit = authorizeTarget(env, compilerAuthority, USE_APPLICABILITY, 'compiler-denied');
  assert.equal(authAudit.semanticPayload.allowed, false);
  expectError(() => qualificationDecision(env, compilerAuthority, {
    logicalId: 'qualification.k04.compiler-denied',
    target: USE_APPLICABILITY,
    disposition: 'QUALIFY_USE',
    authAudit
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_DENIED');
});

test('authorization for use A cannot be replayed to qualify use B', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const authForA = authorizeTarget(env, approver, USE_APPLICABILITY, 'use-a');
  expectError(() => qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.auth-target-mismatch',
    target: USE_OTHER,
    disposition: 'QUALIFY_USE',
    authAudit: authForA
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_MISMATCH');
});

test('qualification scope is enforced independently from scientific approver role', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env, {
    qualificationScope: [{ use: 'CORN_IRRIGATION_APPLICABILITY' }],
    policyLogicalId: 'policy.k04.narrow-scope'
  });
  const denied = authorizeTarget(env, approver, USE_OTHER, 'scope-denied');
  assert.equal(denied.semanticPayload.allowed, false);
  expectError(() => qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.scope-denied',
    target: USE_OTHER,
    disposition: 'QUALIFY_USE',
    authAudit: denied
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_DENIED');
});

test('self-consistent forged authorization audit cannot substitute for reproducible F03 authority', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const legitimate = authorizeTarget(env, approver, USE_APPLICABILITY, 'legitimate');
  const forged = env.ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: 'fake-k04-authorization',
    version: '1',
    semanticPayload: {
      ...legitimate.semanticPayload,
      decisionHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      assignmentRefs: []
    },
    audit: audit('evt-forged-auth', 'forger')
  });
  expectError(() => qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.forged-auth',
    target: USE_APPLICABILITY,
    disposition: 'QUALIFY_USE',
    authAudit: forged
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_MISMATCH');
});

test('forged final Claim/SourceContext without accepted K03 authority chain cannot be qualified', () => {
  const env = setupSourceFaithfulPair();
  const fakeClaim = env.ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.k04.forged',
    version: '1',
    semanticPayload: {
      ...env.reviewed.claim.semanticPayload,
      sourceFaithfulReviewRef: { kind: 'SourceFaithfulReviewDecision', logicalId: 'missing', version: '1', semanticHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
    },
    audit: audit('evt-fake-claim', 'forger')
  });
  const fakeContext = env.ledger.publish({
    kind: 'SourceContext',
    logicalId: 'source-context.k04.forged',
    version: '1',
    semanticPayload: {
      ...env.reviewed.sourceContext.semanticPayload,
      claimRef: fakeClaim.ref,
      sourceFaithfulReviewRef: fakeClaim.semanticPayload.sourceFaithfulReviewRef
    },
    audit: audit('evt-fake-context', 'forger')
  });
  const approver = createPrincipal({ principalId: 'fake-chain-approver', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  expectError(() => env.service.recordQualificationDecision({
    decisionLogicalId: 'qualification.k04.forged-chain',
    decisionVersion: '1',
    claimRef: fakeClaim.ref,
    sourceContextRef: fakeContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: approver,
    authorizationDecisionAuditRef: { kind: 'AuthorizationDecisionAudit', logicalId: 'missing', version: '1', semanticHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    audit: audit('evt-fake-chain-qualification', approver.principalId)
  }), AuthorityLedgerError, 'AUTHORITY_NOT_FOUND');
});

test('prohibition-only decisions cannot masquerade as QualifiedKnowledge', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const prohibited = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.only-prohibited',
    target: USE_AUTONOMOUS_ACTION,
    disposition: 'PROHIBIT_USE',
    reasonCodes: ['NOT_AUTHORIZED']
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.only-prohibited',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [prohibited.ref],
    audit: audit('evt-qk-only-prohibited', approver.principal.principalId)
  }), ScientificQualificationError, 'QUALIFIED_USE_REQUIRED');
});

test('conflicting decisions for the same use target cannot be hidden inside one QualifiedKnowledge', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const allowed = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.conflict-allowed', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  const prohibited = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.conflict-prohibited', target: USE_APPLICABILITY, disposition: 'PROHIBIT_USE', reasonCodes: ['CONFLICT_TEST']
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.conflict',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allowed.ref, prohibited.ref],
    audit: audit('evt-qk-conflict', approver.principal.principalId)
  }), ScientificQualificationError, 'CONFLICTING_QUALIFICATION_DECISIONS');
});

test('QualifiedKnowledge version cannot be silently rewritten with changed scientific-use semantics', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const first = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.immutable-a', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.immutable',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [first.ref],
    audit: audit('evt-qk-immutable-a', approver.principal.principalId)
  });
  const second = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.immutable-b', target: USE_OTHER, disposition: 'QUALIFY_USE'
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.immutable',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [second.ref],
    audit: audit('evt-qk-immutable-b', approver.principal.principalId)
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('requalification creates a new immutable QualifiedKnowledge version and explicit lineage without rewriting history', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const firstDecision = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.requalify-v1', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  const v1 = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.requalify',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [firstDecision.ref],
    audit: audit('evt-qk-requalify-v1', approver.principal.principalId)
  });
  const secondDecision = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.requalify-v2', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE',
    limitations: [{ code: 'UPDATED_LIMITATION' }], supersedesDecisionRef: firstDecision.ref
  });
  const v2 = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.requalify',
    qualifiedKnowledgeVersion: '2',
    qualificationDecisionRefs: [secondDecision.ref],
    supersedesQualifiedKnowledgeRef: v1.ref,
    audit: audit('evt-qk-requalify-v2', approver.principal.principalId)
  });
  assert.equal(env.ledger.resolve(v1.ref).ref.semanticHash, v1.ref.semanticHash);
  assert.notEqual(v2.ref.semanticHash, v1.ref.semanticHash);
  assert.ok(env.ledger.lineageFor(v2.ref).some((line) => line.relation === 'requalifies' && line.to.semanticHash === v1.ref.semanticHash));
  assert.ok(env.ledger.lineageFor(secondDecision.ref).some((line) => line.relation === 'supersedes' && line.to.semanticHash === firstDecision.ref.semanticHash));
});

test('authorized revocation removes current use authority without mutating historical QualifiedKnowledge', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const decision = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.revocable', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.revocable',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit('evt-qk-revocable', approver.principal.principalId)
  });
  const beforeHash = knowledge.ref.semanticHash;
  const revokeAuth = authorizeTarget(env, approver, USE_APPLICABILITY, 'revoke');
  const revocation = env.service.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.k04.applicability',
    revocationVersion: '1',
    qualifiedKnowledgeRef: knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: approver.principal,
    authorizationDecisionAuditRef: revokeAuth.ref,
    reasonCodes: ['NEW_EVIDENCE_REQUIRES_REVIEW'],
    audit: audit('evt-revocation', approver.principal.principalId)
  });
  assert.equal(env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: knowledge.ref, qualificationTarget: USE_APPLICABILITY }), 'REVOKED');
  assert.equal(env.ledger.resolve(knowledge.ref).ref.semanticHash, beforeHash);
  assert.ok(env.ledger.lineageFor(knowledge.ref).some((line) => line.relation === 'revokes' && line.from.semanticHash === revocation.ref.semanticHash));
});

test('revocation cannot target an unqualified use and cannot be performed with denied authorization', () => {
  const env = setupSourceFaithfulPair();
  const approver = makeApprover(env);
  const decision = qualificationDecision(env, approver, {
    logicalId: 'qualification.k04.revoke-guard', target: USE_APPLICABILITY, disposition: 'QUALIFY_USE'
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.revoke-guard',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit('evt-qk-revoke-guard', approver.principal.principalId)
  });
  expectError(() => env.service.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.k04.not-qualified',
    revocationVersion: '1',
    qualifiedKnowledgeRef: knowledge.ref,
    qualificationTarget: USE_OTHER,
    approverPrincipal: approver.principal,
    authorizationDecisionAuditRef: authorizeTarget(env, approver, USE_OTHER, 'other').ref,
    reasonCodes: ['TEST'],
    audit: audit('evt-revoke-not-qualified', approver.principal.principalId)
  }), ScientificQualificationError, 'QUALIFIED_USE_NOT_FOUND');

  const reviewerAuthority = makeApprover(env, {
    principalId: 'revocation-reviewer', role: 'AGRONOMY_REVIEWER', policyLogicalId: 'policy.k04.revocation-reviewer'
  });
  const deniedAuth = authorizeTarget(env, reviewerAuthority, USE_APPLICABILITY, 'revocation-denied');
  expectError(() => env.service.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.k04.denied',
    revocationVersion: '1',
    qualifiedKnowledgeRef: knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: reviewerAuthority.principal,
    authorizationDecisionAuditRef: deniedAuth.ref,
    reasonCodes: ['TEST'],
    audit: audit('evt-revoke-denied', reviewerAuthority.principal.principalId)
  }), ScientificQualificationError, 'QUALIFICATION_AUTHORIZATION_DENIED');
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
