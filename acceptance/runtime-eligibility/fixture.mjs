import assert from 'node:assert/strict';
import {
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeReleaseService,
  releaseMemberResourceId
} from '../../packages/knowledge-release/src/index.mjs';
import {
  assess,
  publishTargetDatum,
  rebuildWorldWithTransportConstraints
} from '../applicability/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';
import {
  USE_APPLICABILITY,
  audit as scientificAudit,
  makeQualifiedKnowledge
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
import {
  directPlanWorld,
  multiCandidatePlanWorld,
  planCompilerInput
} from '../runtime-plan/fixture.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import { publishRuntimeEligibility } from '../../packages/runtime-eligibility/src/index.mjs';

let seq = 0;
export function audit(actor, suffix = 'r03') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:10:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'runtime-eligibility' }
  };
}

export function compileWorld(world) {
  return compileRuntimePlan(planCompilerInput(world));
}

export function directEligibilityWorld(label = 'direct', options = {}) {
  const world = directPlanWorld(`r03-${label}`, options);
  return { ...world, runtimePlan: compileWorld(world) };
}

export function multiEligibilityWorld(label = 'multi') {
  const world = multiCandidatePlanWorld(`r03-${label}`);
  return { ...world, runtimePlan: compileWorld(world) };
}

export function transportEligibilityWorld(label, transportConstraints) {
  const base = rebuildWorldWithTransportConstraints(`r03-${label}`, transportConstraints);
  const soil = publishTargetDatum(base.env, {
    suffix: `r03-${label}-soil`,
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.27' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION'
  });
  const manifest = publishManifest(base.env.ledger, {
    logicalId: `manifest.r03.${label}`,
    decisionProblem: base.decision,
    datumRefs: [...base.manifest.semanticPayload.datumRefs, soil.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const world = {
    ...base,
    env: { ...base.env, profile: base.profile },
    deployment: base.deployment,
    manifest
  };
  const assessment = assess(world, {
    logicalId: `applicability.r03.${label}`,
    knowledgeRef: base.retrieval.semanticPayload.candidateRefs[0],
    manifest
  });
  const complete = { ...world, assessments: [assessment] };
  return { ...complete, runtimePlan: compileWorld(complete) };
}

function memberEntitlement(env, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.r03.mixed.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit(env.releaseManager, `mixed-policy-${label}`)
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
    audit: audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, `mixed-release-auth-${label}`)
  });
  return {
    knowledgeRef: knowledge.ref,
    policyRef: policy.ref,
    authorizationDecisionAuditRef: recorded.ref
  };
}

export function mixedEligibilityWorld(label = 'legal-plus-calibration') {
  const env = createRetrievalEnvironment(`r03-mixed-${label}`);
  const directKnowledge = env.qualified.knowledge;
  const second = makeQualifiedKnowledge(env, {
    label: `r03-mixed-second-${label}`,
    assertion: 'A second qualified candidate requires local calibration before runtime use.',
    useTarget: USE_APPLICABILITY
  });
  const constrainedDecision = second.qualification.recordQualificationDecision({
    decisionLogicalId: `qualification.r03.mixed.${label}.2`,
    decisionVersion: '2',
    claimRef: second.reviewed.claim.ref,
    sourceContextRef: second.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_APPLICABILITY,
    semanticPreconditions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    transportConstraints: [{ type: 'CALIBRATION_REQUIRED', code: 'MIXED_LOCAL_CALIBRATION_REQUIRED' }],
    approverPrincipal: second.approver,
    authorizationDecisionAuditRef: second.decision.semanticPayload.authorizationDecisionAuditRef,
    supersedesDecisionRef: second.decision.ref,
    audit: scientificAudit(`evt-r03-mixed-qualification-${label}`, second.approver.principalId)
  });
  const constrainedKnowledge = second.qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.r03.mixed.${label}.2`,
    qualifiedKnowledgeVersion: '2',
    qualificationDecisionRefs: [constrainedDecision.ref],
    supersedesQualifiedKnowledgeRef: second.knowledge.ref,
    audit: scientificAudit(`evt-r03-mixed-qualified-${label}`, second.approver.principalId)
  });

  const release = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.r03.mixed.${label}`,
    version: '1',
    memberEntitlements: [
      memberEntitlement(env, directKnowledge, `${label}.direct`),
      memberEntitlement(env, constrainedKnowledge, `${label}.calibration`)
    ],
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(env.releaseManager, `mixed-release-${label}`)
  }).release;
  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.r03.mixed.${label}`,
    version: '1',
    profile: baseProfile(env, { knowledgeReleaseRef: release.ref })
  });
  const deploymentEnv = { ...env, profile };
  const deployment = publishAuthorizedDeployment(deploymentEnv, {
    logicalId: `deployment.r03.mixed.${label}`,
    version: '1',
    deployment: baseDeployment(deploymentEnv)
  });
  const decision = publishDecision(env, {
    logicalId: `decision.r03.mixed.${label}`,
    version: '1'
  });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.r03.mixed.${label}`,
    version: '1',
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  assert.equal(retrieval.semanticPayload.candidateRefs.length, 2);

  const crop = publishTargetDatum(env, { suffix: `r03-mixed-${label}-crop` });
  const soil = publishTargetDatum(env, {
    suffix: `r03-mixed-${label}-soil`,
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.26' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION'
  });
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.r03.mixed.${label}`,
    decisionProblem: decision,
    datumRefs: [crop.ref, soil.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const baseWorld = {
    env: { ...env, profile },
    decision,
    deployment,
    retrieval,
    manifest
  };
  const assessments = retrieval.semanticPayload.candidateRefs.map((knowledgeRef, index) => assess(baseWorld, {
    logicalId: `applicability.r03.mixed.${label}.${index + 1}`,
    knowledgeRef,
    manifest
  }));
  const complete = {
    ...baseWorld,
    assessments,
    release,
    directKnowledge,
    constrainedKnowledge
  };
  return { ...complete, runtimePlan: compileWorld(complete) };
}

export function publishEligibility(world, label = 'base') {
  return publishRuntimeEligibility({
    ledger: world.env.ledger,
    logicalId: `runtime-eligibility.r03.${label}`,
    version: '1',
    runtimePlan: world.runtimePlan,
    audit: audit(world.env.runtimePrincipal, `publish-${label}`)
  });
}
