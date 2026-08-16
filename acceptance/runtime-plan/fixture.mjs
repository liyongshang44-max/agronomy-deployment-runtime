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
import { publishRuntimeProfile } from '../../packages/runtime-profile/src/index.mjs';
import {
  USE_APPLICABILITY,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';
import {
  RELEASE_TARGET,
  audit as profileAudit,
  baseProfile,
  createProfileAuthorization
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
  datumInput,
  publishDatum,
  publishManifest
} from '../context-manifest/fixtures.mjs';
import {
  assess,
  createApplicabilityWorld
} from '../applicability/fixture.mjs';

const SOURCE_HASHES = Object.freeze({
  profileSoil: `sha256:${'a'.repeat(64)}`,
  crop: `sha256:${'b'.repeat(64)}`,
  soil: `sha256:${'c'.repeat(64)}`
});

let seq = 0;
function audit(actorId, actorType = 'USER') {
  seq += 1;
  return {
    eventId: `r01-${seq}`,
    occurredAt: '2026-08-16T12:30:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'runtime-plan' }
  };
}

function manifestHasSemantic(ledger, manifest, semanticId) {
  return manifest.semanticPayload.datumRefs.some((ref) =>
    ledger.resolve(ref).semanticPayload.semanticId === semanticId);
}

function addProfileSoilIfMissing(world, label) {
  if (manifestHasSemantic(world.env.ledger, world.manifest, 'soil.volumetric_water_content')) {
    return world.manifest;
  }
  const soil = publishDatum(world.env.ledger, `datum.r01.${label}.profile-soil`, datumInput({
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.24' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'SENSOR',
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:55:00Z',
    temporalSupport: { type: 'INTERVAL' },
    source: {
      providerId: 'r01-fixture',
      sourceRef: `profile-soil-${label}`,
      contentHash: SOURCE_HASHES.profileSoil
    }
  }));
  return publishManifest(world.env.ledger, {
    logicalId: `manifest.r01.${label}.profile-complete`,
    decisionProblem: world.decision,
    datumRefs: [...world.manifest.semanticPayload.datumRefs, soil.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
}

export function directPlanWorld(label = 'direct', options = {}) {
  const { omitProfileSoil = false, ...applicabilityOptions } = options;
  const base = createApplicabilityWorld(`r01-${label}`, applicabilityOptions);
  const manifest = omitProfileSoil ? base.manifest : addProfileSoilIfMissing(base, label);
  const world = {
    ...base,
    deployment: base.env.deployment,
    manifest
  };
  const assessment = assess(world, {
    logicalId: `applicability.r01.${label}`,
    manifest
  });
  return { ...world, assessments: [assessment] };
}

export function planCompilerInput(world, overrides = {}) {
  return {
    ledger: world.env.ledger,
    decisionProblemRef: world.decision.ref,
    deploymentRef: world.deployment.ref,
    runtimeProfileRef: world.env.profile.ref,
    contextManifestRef: world.manifest.ref,
    knowledgeRetrievalResultRef: world.retrieval.ref,
    applicabilityAssessmentRefs: world.assessments.map((assessment) => assessment.ref),
    ...overrides
  };
}

function memberEntitlement(env, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.r01.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit('iam-admin')
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
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  return {
    knowledgeRef: knowledge.ref,
    policyRef: policy.ref,
    authorizationDecisionAuditRef: recorded.ref
  };
}

function publishMultiRelease(env, members, label) {
  const entitlements = members.map((member, index) => memberEntitlement(env, member, `${label}.${index + 1}`));
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.r01.${label}`,
    version: '1',
    memberEntitlements: entitlements,
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(env.releaseManager.principalId)
  }).release;
}

function publishProfileForRelease(env, release, label) {
  const logicalId = `runtime-profile.r01.${label}`;
  const profile = baseProfile(env, { knowledgeReleaseRef: release.ref });
  const authorization = createProfileAuthorization(env, logicalId);
  assert.equal(authorization.decision.allowed, true);
  return publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile,
    principal: env.profileManager,
    authorizationDecisionAuditRef: authorization.recorded.ref,
    audit: profileAudit(env.profileManager.principalId)
  });
}

export function multiCandidatePlanWorld(label = 'alternatives') {
  const env = createRetrievalEnvironment(`r01-multi-${label}`);
  const firstKnowledge = env.qualified.knowledge;
  const secondQualified = makeQualifiedKnowledge(env, {
    label: `r01-multi-second-${label}`,
    assertion: 'Use a second independently qualified irrigation threshold candidate.',
    useTarget: USE_APPLICABILITY
  });
  const release = publishMultiRelease(env, [firstKnowledge, secondQualified.knowledge], label);
  const profile = publishProfileForRelease(env, release, label);
  const deploymentEnv = { ...env, profile };
  const deployment = publishAuthorizedDeployment(deploymentEnv, {
    logicalId: `deployment.r01.${label}`,
    version: '1',
    deployment: baseDeployment(deploymentEnv)
  });
  const decision = publishDecision(env, {
    logicalId: `decision.r01.${label}`,
    version: '1'
  });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.r01.${label}`,
    version: '1',
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  assert.equal(retrieval.semanticPayload.candidateRefs.length, 2);

  const crop = publishDatum(env.ledger, `datum.r01.${label}.crop`, datumInput({
    semanticId: 'crop.code',
    value: { type: 'CATEGORY', category: 'maize' },
    epistemicClass: 'ASSERTION',
    provenanceClass: 'USER',
    effectiveInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
    availableAt: '2026-08-20T09:00:00Z',
    temporalSupport: { type: 'INTERVAL' },
    source: {
      providerId: 'r01-fixture',
      sourceRef: `crop-${label}`,
      contentHash: SOURCE_HASHES.crop
    }
  }));
  const soil = publishDatum(env.ledger, `datum.r01.${label}.soil`, datumInput({
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.24' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'SENSOR',
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:55:00Z',
    temporalSupport: { type: 'INTERVAL' },
    source: {
      providerId: 'r01-fixture',
      sourceRef: `soil-${label}`,
      contentHash: SOURCE_HASHES.soil
    }
  }));
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.r01.${label}`,
    decisionProblem: decision,
    datumRefs: [crop.ref, soil.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const baseWorld = { env: { ...env, profile }, decision, deployment, retrieval, manifest };
  const assessments = retrieval.semanticPayload.candidateRefs.map((knowledgeRef, index) => assess(baseWorld, {
    logicalId: `applicability.r01.${label}.${index + 1}`,
    knowledgeRef,
    manifest
  }));
  return { ...baseWorld, assessments, release, firstKnowledge, secondKnowledge: secondQualified.knowledge };
}
