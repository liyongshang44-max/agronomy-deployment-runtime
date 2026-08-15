import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
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
const USE = { use: 'CORN_IRRIGATION_APPLICABILITY' };

function audit(eventId, actorId, actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-08-15T15:50:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'k04-lifecycle' }
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
    logicalId: 'source.k04.lifecycle',
    version: '1',
    sourceType: 'PROTOCOL',
    title: 'K04 Lifecycle Source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-source', 'source-admin')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: 'artifact.k04.lifecycle',
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(TEXT, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: 'k04-lifecycle-v1',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T15:45:00Z' },
    audit: audit('evt-artifact', 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.k04.lifecycle',
    version: '1',
    compilerId: 'adr.k04.lifecycle',
    implementationVersion: '1',
    configuration: { fixture: true },
    audit: audit('evt-compiler', 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const bundle = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.k04.lifecycle',
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
    principalId: 'reviewer-k04-lifecycle',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k04.lifecycle.reviewer',
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-reviewer-role', 'iam-admin')
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.k04.lifecycle.review',
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
    reviewLogicalId: 'review.k04.lifecycle',
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
    claimLogicalId: 'claim.k04.lifecycle',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.k04.lifecycle',
    sourceContextVersion: '1',
    audit: audit('evt-source-faithful', reviewer.principalId)
  });

  const approver = createPrincipal({
    principalId: 'scientific-approver-k04-lifecycle',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const approverRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k04.lifecycle.approver',
    version: '1',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-approver-role', 'iam-admin')
  });
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: 'policy.k04.lifecycle.qualification',
    version: '1',
    resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
    ownership: source.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit('evt-qualification-policy', 'iam-admin')
  });

  return {
    ledger,
    reviewed,
    approver,
    approverRole,
    qualificationPolicy,
    service: new ScientificQualificationService({ ledger })
  };
}

function authorization(env, suffix) {
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeQualification({
      principal: env.approver,
      policy: env.qualificationPolicy,
      roleAssignments: [env.approverRole],
      qualificationTarget: USE,
      authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
    }),
    audit: audit(`evt-auth-${suffix}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
}

function decision(env, {
  logicalId,
  disposition,
  reasonCodes = [],
  supersedesDecisionRefs
}) {
  return env.service.recordQualificationDecision({
    decisionLogicalId: logicalId,
    decisionVersion: '1',
    claimRef: env.reviewed.claim.ref,
    sourceContextRef: env.reviewed.sourceContext.ref,
    disposition,
    qualificationTarget: USE,
    reasonCodes,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: authorization(env, logicalId).ref,
    ...(supersedesDecisionRefs ? { supersedesDecisionRefs } : {}),
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

test('conflicting active scientific judgments can converge only by superseding the complete active branch set', () => {
  const env = setup();
  const allow = decision(env, {
    logicalId: 'qualification.k04.lifecycle.allow',
    disposition: 'QUALIFY_USE'
  });
  const prohibit = decision(env, {
    logicalId: 'qualification.k04.lifecycle.prohibit',
    disposition: 'PROHIBIT_USE',
    reasonCodes: ['INDEPENDENT_REVIEW_DISAGREEMENT']
  });

  expectError(() => decision(env, {
    logicalId: 'qualification.k04.lifecycle.partial-resolution',
    disposition: 'QUALIFY_USE',
    supersedesDecisionRefs: [allow.ref]
  }), ScientificQualificationError, 'INCOMPLETE_QUALIFICATION_SUPERSESSION');

  const resolution = decision(env, {
    logicalId: 'qualification.k04.lifecycle.resolution',
    disposition: 'QUALIFY_USE',
    supersedesDecisionRefs: [allow.ref, prohibit.ref]
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.lifecycle.resolved',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [resolution.ref],
    audit: audit('evt-qk-resolved', env.approver.principalId)
  });

  const supersedes = env.ledger.lineageFor(resolution.ref)
    .filter((line) => line.relation === 'supersedes')
    .map((line) => line.to.semanticHash)
    .sort();
  assert.deepEqual(supersedes, [allow.ref.semanticHash, prohibit.ref.semanticHash].sort());
  assert.equal(
    env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: knowledge.ref, qualificationTarget: USE }),
    'QUALIFIED'
  );
});

test('revocation cannot be bypassed by republishing a QualifiedKnowledge from the revoked allow decision', () => {
  const env = setup();
  const allow = decision(env, {
    logicalId: 'qualification.k04.lifecycle.revocable',
    disposition: 'QUALIFY_USE'
  });
  const knowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.lifecycle.revocable',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allow.ref],
    audit: audit('evt-qk-revocable', env.approver.principalId)
  });

  const revocation = env.service.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.k04.lifecycle',
    revocationVersion: '1',
    qualifiedKnowledgeRef: knowledge.ref,
    qualificationTarget: USE,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: authorization(env, 'revocation').ref,
    reasonCodes: ['NEW_EVIDENCE_REQUIRES_REVIEW'],
    audit: audit('evt-revocation', env.approver.principalId)
  });

  assert.equal(
    env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: knowledge.ref, qualificationTarget: USE }),
    'REVOKED'
  );

  expectError(() => env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.lifecycle.resurrection',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [allow.ref],
    audit: audit('evt-qk-resurrection', env.approver.principalId)
  }), ScientificQualificationError, 'STALE_QUALIFICATION_DECISION');

  const prohibition = env.ledger.resolve(revocation.semanticPayload.prohibitionDecisionRef);
  assert.equal(prohibition.semanticPayload.disposition, 'PROHIBIT_USE');
  assert.deepEqual(prohibition.semanticPayload.supersedesDecisionRefs, [allow.ref]);

  const requalified = decision(env, {
    logicalId: 'qualification.k04.lifecycle.requalified-after-revocation',
    disposition: 'QUALIFY_USE',
    supersedesDecisionRefs: [prohibition.ref]
  });
  const newKnowledge = env.service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.k04.lifecycle.requalified',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [requalified.ref],
    supersedesQualifiedKnowledgeRef: knowledge.ref,
    audit: audit('evt-qk-requalified', env.approver.principalId)
  });
  assert.equal(
    env.service.qualifiedUseStatus({ qualifiedKnowledgeRef: newKnowledge.ref, qualificationTarget: USE }),
    'QUALIFIED'
  );
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
