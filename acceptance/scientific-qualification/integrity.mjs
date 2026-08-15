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

const TEXT = 'For maize at V10, irrigation may be considered.';
const USE_A = { use: 'CORN_IRRIGATION_APPLICABILITY' };

function audit(eventId, actorId, actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-08-15T15:35:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'k04-integrity' }
  };
}

function sourceContextProposal() {
  const context = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  context.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  return context;
}

function setup() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.k04.integrity',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'K04 Integrity Source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.k04.integrity',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'k04-integrity-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T15:30:00Z' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.k04.integrity',
    version: '1',
    compilerId: 'adr.k04.integrity',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler', 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const bundle = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.k04.integrity',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: 'claim-1',
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion: TEXT,
        sourceLocator: { kind: 'WHOLE_ARTIFACT' },
        sourceContext: sourceContextProposal()
      }]
    },
    audit: audit('evt-compilation', 'compiler-service', 'SERVICE_ACCOUNT')
  });

  const reviewer = createPrincipal({
    principalId: 'reviewer-k04-integrity',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k04.integrity.reviewer',
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-review-role', 'iam-admin')
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.k04.integrity.review',
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
    reviewLogicalId: 'review.k04.integrity',
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: {
      BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
      ENVIRONMENTAL: [],
      MANAGEMENT: [],
      OPERATIONAL: [],
      MEASUREMENT: [],
      JURISDICTION_ECONOMIC: []
    },
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuth.ref,
    claimLogicalId: 'claim.k04.integrity',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.k04.integrity',
    sourceContextVersion: '1',
    audit: audit('evt-source-faithful', reviewer.principalId)
  });

  const approver = createPrincipal({
    principalId: 'scientific-approver-k04-integrity',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const approverRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k04.integrity.approver',
    version: '1',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-approver-role', 'iam-admin')
  });
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.k04.integrity.qualification',
    version: '1',
    resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
    ownership: source.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit('evt-qualification-policy', 'iam-admin')
  });

  const service = new ScientificQualificationService({ ledger });
  return {
    ledger,
    source,
    bundle,
    reviewed,
    reviewer,
    reviewAuth,
    approver,
    approverRole,
    qualificationPolicy,
    service
  };
}

function qualificationAuth(env, target = USE_A, suffix = 'a') {
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeQualification({
      principal: env.approver,
      policy: env.qualificationPolicy,
      roleAssignments: [env.approverRole],
      qualificationTarget: target,
      authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
    }),
    audit: audit(`evt-qualification-auth-${suffix}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
}

function decision(env, {
  logicalId,
  disposition = 'QUALIFY_USE',
  target = USE_A,
  supersedesDecisionRef,
  reasonCodes = []
}) {
  return env.service.recordQualificationDecision({
    decisionLogicalId: logicalId,
    decisionVersion: '1',
    claimRef: env.reviewed.claim.ref,
    sourceContextRef: env.reviewed.sourceContext.ref,
    disposition,
    qualificationTarget: target,
    reasonCodes,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: qualificationAuth(env, target, logicalId).ref,
    ...(supersedesDecisionRef ? { supersedesDecisionRef } : {}),
    audit: audit(`evt-${logicalId}`, env.approver.principalId)
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

test('scientific-use target v1 rejects arbitrary context fields that could broaden or narrow authority invisibly', () => {
  const env = setup();
  const target = { use: 'CORN_IRRIGATION_APPLICABILITY', cultivar: 'P0306Q' };
  expectError(() => env.service.recordQualificationDecision({
    decisionLogicalId: 'qualification.k04.bad-target',
    decisionVersion: '1',
    claimRef: env.reviewed.claim.ref,
    sourceContextRef: env.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: target,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: qualificationAuth(env, USE_A, 'bad-target').ref,
    audit: audit('evt-bad-target', env.approver.principalId)
  }), ScientificQualificationError, 'INVALID_QUALIFICATION_TARGET');
});

test('competing active qualification judgments cannot be cherry-picked into QualifiedKnowledge', () => {
  const env = setup();
  const allowed = decision(env, { logicalId: 'qualification.k04.branch-allow' });
  decision(env, {
    logicalId: 'qualification.k04.branch-prohibit',
    disposition: 'PROHIBIT_USE',
    reasonCodes: ['INDEPENDENT_REVIEW_DISAGREEMENT']
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.cherry-pick',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allowed.ref],
    audit: audit('evt-qk-cherry-pick', env.approver.principalId)
  }), ScientificQualificationError, 'CONFLICTING_QUALIFICATION_DECISIONS');
});

test('superseded scientific-use decision is stale and cannot mint a new QualifiedKnowledge snapshot', () => {
  const env = setup();
  const v1 = decision(env, { logicalId: 'qualification.k04.stale-v1' });
  decision(env, {
    logicalId: 'qualification.k04.stale-v2',
    disposition: 'PROHIBIT_USE',
    reasonCodes: ['REQUALIFIED_AFTER_REVIEW'],
    supersedesDecisionRef: v1.ref
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.stale',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [v1.ref],
    audit: audit('evt-qk-stale', env.approver.principalId)
  }), ScientificQualificationError, 'STALE_QUALIFICATION_DECISION');
});

test('K04 revalidates K03 reviewer authorization rather than trusting ACCEPT_SOURCE_FAITHFUL vocabulary alone', () => {
  const env = setup();
  const fakeReview = env.ledger.publish({
    kind: 'SourceFaithfulReviewDecision',
    logicalId: 'review.k04.forged-upstream',
    version: '1',
    semanticPayload: {
      ...env.ledger.resolve(env.reviewed.review.ref).semanticPayload,
      authorizationDecisionAuditRef: {
        kind: 'AuthorizationDecisionAudit',
        logicalId: 'missing-review-authorization',
        version: '1',
        semanticHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }
    },
    audit: audit('evt-forged-review', env.reviewer.principalId)
  });
  const fakeClaim = env.ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.k04.forged-upstream',
    version: '1',
    semanticPayload: {
      ...env.reviewed.claim.semanticPayload,
      sourceFaithfulReviewRef: fakeReview.ref
    },
    audit: audit('evt-forged-claim', 'forger')
  });
  const fakeContext = env.ledger.publish({
    kind: 'SourceContext',
    logicalId: 'source-context.k04.forged-upstream',
    version: '1',
    semanticPayload: {
      ...env.reviewed.sourceContext.semanticPayload,
      claimRef: fakeClaim.ref,
      sourceFaithfulReviewRef: fakeReview.ref
    },
    audit: audit('evt-forged-context', 'forger')
  });

  expectError(() => env.service.recordQualificationDecision({
    decisionLogicalId: 'qualification.k04.forged-upstream',
    decisionVersion: '1',
    claimRef: fakeClaim.ref,
    sourceContextRef: fakeContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_A,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: qualificationAuth(env, USE_A, 'forged-upstream').ref,
    audit: audit('evt-qualification-forged-upstream', env.approver.principalId)
  }), AuthorityLedgerError, 'AUTHORITY_NOT_FOUND');
});

test('directly forged qualification decision with wrong publication actor cannot mint QualifiedKnowledge', () => {
  const env = setup();
  const auth = qualificationAuth(env, USE_A, 'forged-decision');
  const forged = env.ledger.publish({
    kind: 'ScientificQualificationDecision',
    logicalId: 'qualification.k04.direct-forgery',
    version: '1',
    semanticPayload: {
      claimRef: env.reviewed.claim.ref,
      sourceContextRef: env.reviewed.sourceContext.ref,
      sourceRef: env.source.ref,
      sourceFaithfulReviewRef: env.reviewed.review.ref,
      qualificationTarget: USE_A,
      disposition: 'QUALIFY_USE',
      limitations: [],
      effectModifiers: [],
      semanticPreconditions: [],
      transportConstraints: [],
      reasonCodes: [],
      approverPrincipal: env.approver,
      authorizationDecisionAuditRef: auth.ref,
      qualificationPolicyRef: env.qualificationPolicy.ref,
      authorityClass: 'SCIENTIFIC_QUALIFICATION_DECISION'
    },
    audit: {
      ...audit('evt-direct-forgery', 'forger'),
      inputRefs: [env.reviewed.claim.ref, env.reviewed.sourceContext.ref, auth.ref, env.qualificationPolicy.ref]
    }
  });
  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.direct-forgery',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [forged.ref],
    audit: audit('evt-qk-direct-forgery', env.approver.principalId)
  }), ScientificQualificationError, 'QUALIFICATION_DECISION_AUDIT_INVALID');
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
