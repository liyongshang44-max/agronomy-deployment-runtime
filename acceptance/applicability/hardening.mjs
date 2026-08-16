import assert from 'node:assert/strict';
import {
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import { KnowledgeReleaseService, releaseMemberResourceId } from '../../packages/knowledge-release/src/index.mjs';
import {
  DerivedKnowledgeService,
  derivationMethodResourceId,
  synthesisResourceId
} from '../../packages/synthesis-engine/src/index.mjs';
import {
  validateApplicabilityAssessment
} from '../../packages/applicability/src/index.mjs';
import {
  USE_APPLICABILITY,
  authorizeForResource,
  makeQualifiedKnowledge,
  audit as scientificAudit
} from '../derived-knowledge/fixture.mjs';
import {
  RELEASE_TARGET,
  baseProfile,
  publishAuthorizedProfile
} from '../runtime-profile/fixture.mjs';
import {
  baseDeployment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  createRetrievalEnvironment,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from '../knowledge-retrieval/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';
import { assess, audit, createApplicabilityWorld, publishTargetDatum } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function laterAudit(actor, suffix) {
  return {
    eventId: `a08-later-${suffix}`,
    occurredAt: '2026-08-21T10:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'applicability-hardening' }
  };
}

function publishReleaseForKnowledge(env, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.a08.derived-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit(env.releaseManager, 'derived-release-policy')
  });
  const decision = authorizeKnowledgeRelease({
    principal: env.releaseManager,
    policy,
    roleAssignments: [env.releaseManagerRole],
    releaseTarget: RELEASE_TARGET
  });
  assert.equal(decision.allowed, true);
  const recorded = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ principalId: 'iam-engine-a08', type: 'SERVICE_ACCOUNT' }, 'derived-release-auth')
  });
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.a08.derived.${label}`,
    version: '1',
    memberEntitlements: [{ knowledgeRef: knowledge.ref, policyRef: policy.ref, authorizationDecisionAuditRef: recorded.ref }],
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(env.releaseManager, 'derived-release')
  }).release;
}

function createDerivedWorld(label, { unresolvedContextHeterogeneity = [] } = {}) {
  const env = createRetrievalEnvironment(`derived-${label}`);
  const first = env.qualified;
  const second = makeQualifiedKnowledge(env, {
    label: `a08-derived-${label}-b`,
    assertion: 'A second governed maize irrigation source supports the same scientific use.',
    useTarget: USE_APPLICABILITY
  });
  const methodLogicalId = `method.a08.derived.${label}`;
  const methodApproval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(methodLogicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: `a08-derived-${label}-method`
  });
  const service = new DerivedKnowledgeService({ ledger: env.ledger });
  const method = service.publishDerivationMethod({
    logicalId: methodLogicalId,
    version: '1',
    methodType: 'GOVERNED_SYNTHESIS',
    semanticRole: 'corn.irrigation.depletion_threshold',
    minimumInputs: 2,
    contextPolicy: 'PRESERVE_ALL_ORIGINS',
    methodSpec: { estimator: 'GOVERNED_CONSENSUS' },
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: methodApproval.authAudit.ref,
    audit: scientificAudit(`evt-a08-derived-method-${label}`, env.approver.principalId)
  });
  const synthesisApproval = authorizeForResource(env, {
    resourceId: synthesisResourceId(method.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: `a08-derived-${label}-synthesis`
  });
  const derived = service.derive({
    derivedKnowledgeLogicalId: `derived.a08.${label}`,
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: `derived-context.a08.${label}`,
    derivedContextVersion: '1',
    derivationMethodRef: method.ref,
    inputBindings: [
      { qualifiedKnowledgeRef: first.knowledge.ref, useTarget: USE_APPLICABILITY },
      { qualifiedKnowledgeRef: second.knowledge.ref, useTarget: USE_APPLICABILITY }
    ],
    semanticRole: 'corn.irrigation.depletion_threshold',
    assertion: 'Governed synthesis preserves both exact maize source domains.',
    unresolvedContextHeterogeneity,
    limitations: [],
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: synthesisApproval.authAudit.ref,
    audit: scientificAudit(`evt-a08-derived-${label}`, env.approver.principalId)
  });

  const release = publishReleaseForKnowledge(env, derived.derivedKnowledge, label);
  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.a08.derived.${label}`,
    version: '1',
    profile: baseProfile(env, { knowledgeReleaseRef: release.ref })
  });
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.a08.derived.${label}`,
    version: '1',
    deployment: baseDeployment(env, { runtimeProfileRef: profile.ref })
  });
  const decision = publishDecision(env, { logicalId: `decision.a08.derived.${label}` });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.a08.derived.${label}`,
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  const crop = publishTargetDatum(env, { suffix: `derived-${label}-crop` });
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.a08.derived.${label}`,
    decisionProblem: decision,
    datumRefs: [crop.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  return { env, first, second, derived, release, profile, deployment, decision, retrieval, manifest };
}

test('DerivedKnowledge applicability binds exact DerivedKnowledgeContext rather than choosing one arbitrary SourceContext', () => {
  const world = createDerivedWorld('origin');
  const assessment = assess(world, {
    logicalId: 'applicability.a08.derived.origin',
    knowledgeRef: world.derived.derivedKnowledge.ref
  });
  assert.equal(assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.deepEqual(assessment.semanticPayload.knowledgeOriginContextRefs, [world.derived.derivedContext.ref]);
  assert(!assessment.semanticPayload.knowledgeOriginContextRefs.some((ref) => ref.kind === 'SourceContext'));
  assert.equal(validateApplicabilityAssessment({ ledger: world.env.ledger, applicabilityAssessmentRef: assessment.ref }).record.ref.semanticHash, assessment.ref.semanticHash);
});

test('unresolved DerivedKnowledge origin heterogeneity fails conservatively to UNRESOLVED', () => {
  const world = createDerivedWorld('heterogeneity', {
    unresolvedContextHeterogeneity: [{ semanticId: 'soil.texture', issue: 'SOURCE_DOMAINS_DISAGREE' }]
  });
  const assessment = assess(world, {
    logicalId: 'applicability.a08.derived.heterogeneity',
    knowledgeRef: world.derived.derivedKnowledge.ref
  });
  assert.equal(assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert(assessment.semanticPayload.unsupportedConstraintCodes.includes('DERIVED_CONTEXT_HETEROGENEITY_UNRESOLVED'));
  assert.equal(assessment.semanticPayload.runtimeUse, 'BLOCKED');
});

test('later QualifiedKnowledge revocation blocks current applicability validation but preserves exact historical replay', () => {
  const world = createApplicabilityWorld('historical-revocation');
  const assessment = assess(world, { logicalId: 'applicability.a08.historical-revocation' });
  const q = world.env.qualified;
  q.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a08.historical-revocation',
    revocationVersion: '1',
    qualifiedKnowledgeRef: q.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: q.approver,
    authorizationDecisionAuditRef: q.decision.semanticPayload.authorizationDecisionAuditRef,
    reasonCodes: ['A08_HISTORICAL_REPLAY_FIXTURE'],
    audit: laterAudit(q.approver, 'qk-revocation')
  });
  assert.throws(() => validateApplicabilityAssessment({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: assessment.ref
  }));
  const historical = validateApplicabilityAssessment({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: assessment.ref,
    allowHistorical: true
  });
  assert.equal(historical.record.ref.semanticHash, assessment.ref.semanticHash);
  assert.equal(historical.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(historical.semanticPayload.scientificUseStatus, 'QUALIFIED');
});

console.log(`Applicability hardening acceptance: ${passed} passed`);
