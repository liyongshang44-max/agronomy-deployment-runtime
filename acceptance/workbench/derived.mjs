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
import { projectAgronomistWorkbenchCase } from '../../packages/workbench/src/index.mjs';
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
import { assess, audit, publishTargetDatum } from '../applicability/fixture.mjs';
import {
  createInspectionAuthorization,
  createWorkbenchPrincipal
} from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function publishReleaseForKnowledge(env, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.a11.derived-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit(env.releaseManager, 'a11-derived-release-policy')
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
    audit: audit({ principalId: 'iam-engine-a11-derived', type: 'SERVICE_ACCOUNT' }, 'a11-derived-release-auth')
  });
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.a11.derived.${label}`,
    version: '1',
    memberEntitlements: [{
      knowledgeRef: knowledge.ref,
      policyRef: policy.ref,
      authorizationDecisionAuditRef: recorded.ref
    }],
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(env.releaseManager, 'a11-derived-release')
  }).release;
}

function createDerivedWorkbenchWorld(label) {
  const env = createRetrievalEnvironment(`a11-derived-${label}`);
  const first = env.qualified;
  const second = makeQualifiedKnowledge(env, {
    label: `a11-derived-${label}-b`,
    assertion: 'A second governed maize irrigation source supports the same scientific use.',
    useTarget: USE_APPLICABILITY
  });

  const methodLogicalId = `method.a11.derived.${label}`;
  const methodApproval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(methodLogicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: `a11-derived-${label}-method`
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
    audit: scientificAudit(`evt-a11-derived-method-${label}`, env.approver.principalId)
  });
  const synthesisApproval = authorizeForResource(env, {
    resourceId: synthesisResourceId(method.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: `a11-derived-${label}-synthesis`
  });
  const derived = service.derive({
    derivedKnowledgeLogicalId: `derived.a11.${label}`,
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: `derived-context.a11.${label}`,
    derivedContextVersion: '1',
    derivationMethodRef: method.ref,
    inputBindings: [
      { qualifiedKnowledgeRef: first.knowledge.ref, useTarget: USE_APPLICABILITY },
      { qualifiedKnowledgeRef: second.knowledge.ref, useTarget: USE_APPLICABILITY }
    ],
    semanticRole: 'corn.irrigation.depletion_threshold',
    assertion: 'Governed synthesis preserves both exact maize source domains.',
    unresolvedContextHeterogeneity: [],
    limitations: [],
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: synthesisApproval.authAudit.ref,
    audit: scientificAudit(`evt-a11-derived-${label}`, env.approver.principalId)
  });

  const release = publishReleaseForKnowledge(env, derived.derivedKnowledge, label);
  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.a11.derived.${label}`,
    version: '1',
    profile: baseProfile(env, { knowledgeReleaseRef: release.ref })
  });
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.a11.derived.${label}`,
    version: '1',
    deployment: baseDeployment(env, { runtimeProfileRef: profile.ref })
  });
  const decision = publishDecision(env, { logicalId: `decision.a11.derived.${label}` });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.a11.derived.${label}`,
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  const crop = publishTargetDatum(env, { suffix: `a11-derived-${label}-crop` });
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.a11.derived.${label}`,
    decisionProblem: decision,
    datumRefs: [crop.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const assessment = assess({ env, decision, runtimeAuthorization, retrieval, manifest }, {
    logicalId: `applicability.a11.derived.${label}`,
    knowledgeRef: derived.derivedKnowledge.ref
  });

  const world = { env, first, second, derived, release, profile, deployment, decision, retrieval, manifest, assessment };
  const { principal, role } = createWorkbenchPrincipal(world, { principalId: `agronomist-derived-${label}` });
  world.workbenchPrincipal = principal;
  world.workbenchRole = role;
  const knowledgeRefs = [derived.derivedKnowledge.ref, first.knowledge.ref, second.knowledge.ref];
  world.inspectionAuthorizations = knowledgeRefs.map((knowledgeRef) => {
    const inspection = createInspectionAuthorization(world, { knowledgeRef });
    return { knowledgeRef, authorizationDecisionAuditRef: inspection.recorded.ref };
  });
  return world;
}

function project(world, inspectionAuthorizations = world.inspectionAuthorizations) {
  return projectAgronomistWorkbenchCase({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: world.assessment.ref,
    workbenchPrincipal: world.workbenchPrincipal,
    inspectionAuthorizations,
    sourceRegistry: world.env.sourceRegistry
  });
}

test('DerivedKnowledge workbench case binds exact DerivedKnowledgeContext and displays every exact input QualifiedKnowledge evidence chain', () => {
  const world = createDerivedWorkbenchWorld('origin');
  const c = project(world);
  assert.equal(c.scientificEvidence.knowledgeKind, 'DerivedKnowledge');
  assert.deepEqual(c.scientificEvidence.knowledgeRef, world.derived.derivedKnowledge.ref);
  assert.deepEqual(c.scientificEvidence.originContext.originContextRef, world.derived.derivedContext.ref);
  assert.equal(c.scientificEvidence.originContext.originContextRef.kind, 'DerivedKnowledgeContext');
  assert.equal(c.scientificEvidence.inputQualifiedEvidence.length, 2);
  const inputRefs = c.scientificEvidence.inputQualifiedEvidence.map((item) => item.knowledgeRef.semanticHash).sort();
  assert.deepEqual(inputRefs, [world.first.knowledge.ref.semanticHash, world.second.knowledge.ref.semanticHash].sort());
  assert(c.scientificEvidence.inputQualifiedEvidence.every((item) => item.originContext.originContextRef.kind === 'SourceContext'));
  assert.equal(c.evidenceAccess.inspectionAuthorizations.length, 3);
  assert.equal(c.applicability.transportStatus, 'DIRECTLY_APPLICABLE');
});

test('DerivedKnowledge workbench case fails closed when human inspection authority for any exact input QualifiedKnowledge is missing', () => {
  const world = createDerivedWorkbenchWorld('missing-input-access');
  const incomplete = world.inspectionAuthorizations.filter((item) =>
    item.knowledgeRef.semanticHash !== world.second.knowledge.ref.semanticHash);
  assert.equal(incomplete.length, 2);
  assert.throws(() => project(world, incomplete),
    (error) => error?.code === 'WORKBENCH_INSPECTION_AUTHORIZATION_REQUIRED'
      || error?.code === 'WORKBENCH_INSPECTION_AUTHORIZATION_SET_MISMATCH');
});

console.log(`Agronomist Workbench DerivedKnowledge acceptance: ${passed} passed`);
