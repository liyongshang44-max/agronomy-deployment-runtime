import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  createPrincipal,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeRuntimeProfileManage } from '../../packages/authorization/src/runtime-profile-control.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import { releaseMemberResourceId } from '../../packages/knowledge-release/src/index.mjs';
import { KnowledgeReleaseService } from '../../packages/knowledge-release/src/index.mjs';
import {
  RUNTIME_PROFILE_CONTRACT_VERSION,
  publishRuntimeProfile
} from '../../packages/runtime-profile/src/index.mjs';
import {
  USE_APPLICABILITY,
  audit as baseAudit,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

export const RELEASE_TARGET = {
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programId: 'pilot-a'
};

let seq = 0;
export function audit(actorId, actorType = 'USER', prefix = 'a05') {
  seq += 1;
  return {
    ...baseAudit(`${prefix}-${seq}`, actorId, actorType),
    details: { suite: 'runtime-profile' }
  };
}

export function createRuntimeProfileEnvironment(label = 'base') {
  const env = createEnvironment();
  const qualified = makeQualifiedKnowledge(env, {
    label: `a05-${label}`,
    assertion: 'Maintain irrigation depletion within the qualified threshold.',
    useTarget: USE_APPLICABILITY
  });

  const releaseManager = createPrincipal({
    principalId: `release-manager-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const releaseManagerRole = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.release-manager.${label}`,
    version: '1',
    principal: releaseManager,
    role: 'KNOWLEDGE_RELEASE_MANAGER',
    roleDefinitionVersion: 'a05-fixture-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
    scope: RELEASE_TARGET,
    audit: audit('iam-admin')
  });
  const memberPolicy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.release-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(qualified.knowledge.ref),
    ownership: qualified.knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit('iam-admin')
  });
  const releaseDecision = authorizeKnowledgeRelease({
    principal: releaseManager,
    policy: memberPolicy,
    roleAssignments: [releaseManagerRole],
    releaseTarget: RELEASE_TARGET
  });
  assert.equal(releaseDecision.allowed, true);
  const releaseAuthorization = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: releaseDecision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  const releaseBundle = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.a05.${label}`,
    version: '1',
    memberEntitlements: [{
      knowledgeRef: qualified.knowledge.ref,
      policyRef: memberPolicy.ref,
      authorizationDecisionAuditRef: releaseAuthorization.ref
    }],
    publisherPrincipal: releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: audit(releaseManager.principalId)
  });
  const release = releaseBundle.release;

  const profileManager = createPrincipal({
    principalId: `profile-manager-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const profileManagerRole = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.profile-manager.${label}`,
    version: '1',
    principal: profileManager,
    role: 'RUNTIME_PROFILE_MANAGER',
    roleDefinitionVersion: 'a05-v1',
    permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'RUNTIME_PROFILE' },
    audit: audit('iam-admin')
  });

  return {
    ...env,
    qualified,
    releaseManager,
    releaseManagerRole,
    release,
    releaseBundle,
    profileManager,
    profileManagerRole
  };
}

export function baseProfile(env, overrides = {}) {
  return {
    contractVersion: RUNTIME_PROFILE_CONTRACT_VERSION,
    controlScope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    knowledgeReleaseRef: env.release.ref,
    contextRequirements: {
      requiredSemanticIds: ['crop.code', 'soil.volumetric_water_content'],
      epistemicConstraints: {
        'crop.code': ['ASSERTION', 'OBSERVATION'],
        'soil.volumetric_water_content': ['OBSERVATION', 'STATE_ESTIMATE']
      }
    },
    replayRequirement: { minimum: 'EXACT' },
    runtimeGovernance: {
      allowedDecisionAuthorityModes: ['RUNTIME_ONLY'],
      knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
      contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
      applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
    },
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['DEVELOPMENT', 'STAGING'],
      rolloutStages: ['DRAFT', 'SANDBOX', 'SHADOW']
    },
    ...overrides
  };
}

export function createProfileAuthorization(env, logicalId, {
  principal = env.profileManager,
  roleAssignments = [env.profileManagerRole]
} = {}) {
  const decision = authorizeRuntimeProfileManage({
    principal,
    roleAssignments,
    authorizationScope: {
      organizationId: principal.organizationId,
      ...(principal.tenantId ? { tenantId: principal.tenantId } : {}),
      resourceType: 'RUNTIME_PROFILE',
      resourceId: logicalId
    }
  });
  const recorded = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  return { decision, recorded };
}

export function publishAuthorizedProfile(env, {
  logicalId = 'runtime-profile.a05',
  version = '1',
  profile = baseProfile(env),
  principal = env.profileManager,
  authorization
} = {}) {
  const auth = authorization ?? createProfileAuthorization(env, logicalId, { principal });
  assert.equal(auth.decision.allowed, true);
  return publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version,
    profile,
    principal,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(principal.principalId)
  });
}
