import assert from 'node:assert/strict';
import {
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import { KnowledgeReleaseService, releaseMemberResourceId } from '../../packages/knowledge-release/src/index.mjs';
import { assessKnowledgeApplicability } from '../../packages/applicability/src/index.mjs';
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
  datumInput,
  publishDatum,
  publishManifest
} from '../context-manifest/fixtures.mjs';
import { USE_APPLICABILITY, audit as scientificAudit } from '../derived-knowledge/fixture.mjs';

let seq = 0;
export function audit(actor, suffix = 'a08') {
  seq += 1;
  return {
    eventId: `a08-${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:05:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'applicability' }
  };
}

export function publishTargetDatum(env, {
  suffix = 'crop',
  semanticId = 'crop.code',
  value = { type: 'CATEGORY', category: 'maize' },
  unit = '1',
  epistemicClass = 'OBSERVATION'
} = {}) {
  return publishDatum(env.ledger, `datum.a08.${suffix}`, datumInput({
    semanticId,
    value,
    unit,
    epistemicClass,
    verticalSupport: null,
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:55:00Z',
    source: { providerId: 'a08-fixture', sourceRef: `target-${suffix}`, contentHash: `sha256:a08-${suffix}` }
  }));
}

export function createApplicabilityWorld(label = 'base', {
  crop = 'maize',
  includeCrop = true,
  extraDatums = [],
  decisionProblem
} = {}) {
  const env = createRetrievalEnvironment(`a08-${label}`);
  const decision = publishDecision(env, {
    logicalId: `decision.a08.${label}`,
    ...(decisionProblem ? { problem: decisionProblem } : {})
  });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env);
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.a08.${label}`,
    decisionProblem: decision,
    runtimeAuthorization
  });
  const datumRefs = [];
  if (includeCrop) datumRefs.push(publishTargetDatum(env, { suffix: `${label}-crop`, value: { type: 'CATEGORY', category: crop } }).ref);
  if (!includeCrop || extraDatums.length > 0) {
    const soil = publishTargetDatum(env, {
      suffix: `${label}-soil`,
      semanticId: 'soil.volumetric_water_content',
      value: { type: 'DECIMAL', decimal: '0.31' },
      unit: 'm3_per_m3'
    });
    datumRefs.push(soil.ref);
  }
  datumRefs.push(...extraDatums.map((datum) => datum.ref ?? datum));
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.a08.${label}`,
    decisionProblem: decision,
    datumRefs,
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  return { env, decision, runtimeAuthorization, retrieval, manifest };
}

export function assess(world, {
  logicalId = 'applicability.a08',
  version = '1',
  knowledgeRef = world.retrieval.semanticPayload.candidateRefs[0],
  manifest = world.manifest,
  actor = world.env.runtimePrincipal
} = {}) {
  return assessKnowledgeApplicability({
    ledger: world.env.ledger,
    logicalId,
    version,
    knowledgeRetrievalResultRef: world.retrieval.ref,
    knowledgeRef,
    contextManifestRef: manifest.ref,
    audit: audit(actor)
  });
}

export function rebuildWorldWithTransportConstraints(label, transportConstraints) {
  const env = createRetrievalEnvironment(`a08-${label}`);
  const old = env.qualified;
  const decision2 = old.qualification.recordQualificationDecision({
    decisionLogicalId: `qualification.a08.${label}.2`,
    decisionVersion: '2',
    claimRef: old.reviewed.claim.ref,
    sourceContextRef: old.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_APPLICABILITY,
    semanticPreconditions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    transportConstraints,
    approverPrincipal: old.approver,
    authorizationDecisionAuditRef: old.decision.semanticPayload.authorizationDecisionAuditRef,
    supersedesDecisionRef: old.decision.ref,
    audit: scientificAudit(`evt-a08-qualification-${label}`, old.approver.principalId)
  });
  const knowledge2 = old.qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.a08.${label}.2`,
    qualifiedKnowledgeVersion: '2',
    qualificationDecisionRefs: [decision2.ref],
    supersedesQualifiedKnowledgeRef: old.knowledge.ref,
    audit: scientificAudit(`evt-a08-qualified-${label}`, old.approver.principalId)
  });

  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.a08.release-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge2.ref),
    ownership: knowledge2.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit(env.releaseManager, 'release-policy')
  });
  const releaseDecision = authorizeKnowledgeRelease({
    principal: env.releaseManager,
    policy,
    roleAssignments: [env.releaseManagerRole],
    releaseTarget: RELEASE_TARGET
  });
  assert.equal(releaseDecision.allowed, true);
  const releaseAuth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: releaseDecision,
    audit: audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, 'release-auth')
  });
  const release = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.a08.${label}.2`,
    version: '2',
    memberEntitlements: [{ knowledgeRef: knowledge2.ref, policyRef: policy.ref, authorizationDecisionAuditRef: releaseAuth.ref }],
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(env.releaseManager, 'release')
  }).release;

  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.a08.${label}.2`,
    version: '2',
    profile: baseProfile(env, { knowledgeReleaseRef: release.ref })
  });
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.a08.${label}.2`,
    version: '2',
    deployment: baseDeployment(env, { runtimeProfileRef: profile.ref })
  });
  const decision = publishDecision(env, { logicalId: `decision.a08.${label}.2` });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.a08.${label}.2`,
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  const cropDatum = publishTargetDatum(env, { suffix: `${label}-crop-2` });
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.a08.${label}.2`,
    decisionProblem: decision,
    datumRefs: [cropDatum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  return { env, decision, runtimeAuthorization, retrieval, manifest, knowledge: knowledge2, release, profile, deployment };
}
