import assert from 'node:assert/strict';
import {
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  createPrincipal,
  publishBuiltinRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  DEPLOYMENT_CONTRACT_VERSION,
  deploymentNeedsProductionAuthority,
  publishDeployment
} from '../../packages/deployment/src/index.mjs';
import {
  baseProfile,
  createRuntimeProfileEnvironment,
  publishAuthorizedProfile
} from '../runtime-profile/fixture.mjs';

let seq = 0;
export function audit(actorId, actorType = 'USER', prefix = 'a06') {
  seq += 1;
  return {
    eventId: `${prefix}-${seq}`,
    occurredAt: '2026-08-16T10:30:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'deployment' }
  };
}

export function createDeploymentEnvironment(label = 'base', profileOverrides = {}) {
  const env = createRuntimeProfileEnvironment(`a06-${label}`);
  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.a06.${label}`,
    version: '1',
    profile: baseProfile(env, profileOverrides)
  });
  const deploymentManager = createPrincipal({
    principalId: `deployment-manager-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const deploymentManagerRole = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.deployment-manager.${label}`,
    version: '1',
    principal: deploymentManager,
    role: 'DEPLOYMENT_MANAGER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  const runtimePrincipal = createPrincipal({
    principalId: `runtime-service-${label}`,
    type: 'SERVICE_ACCOUNT',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const runtimeRole = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.runtime-service.${label}`,
    version: '1',
    principal: runtimePrincipal,
    role: 'RUNTIME_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  return {
    ...env,
    profile,
    deploymentManager,
    deploymentManagerRole,
    runtimePrincipal,
    runtimeRole
  };
}

export function baseDeployment(env, overrides = {}) {
  return {
    contractVersion: DEPLOYMENT_CONTRACT_VERSION,
    runtimeProfileRef: env.profile.ref,
    deploymentScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      programId: 'pilot-a',
      regions: ['region-east'],
      crops: ['maize'],
      decisionTypes: ['IRRIGATION_TIMING']
    },
    authorizedUse: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY']
    },
    effectiveInterval: {
      start: '2026-08-16T00:00:00Z',
      end: '2026-09-16T00:00:00Z'
    },
    runtimeEnvironment: 'STAGING',
    rolloutStage: 'SHADOW',
    ...overrides
  };
}

export function createDeploymentAuthorization(env, logicalId, {
  principal = env.deploymentManager,
  roleAssignments = [env.deploymentManagerRole],
  deployment = baseDeployment(env),
  action = 'PUBLISH'
} = {}) {
  const production = deploymentNeedsProductionAuthority(deployment);
  const decision = authorizeDeploymentControl({
    principal,
    roleAssignments,
    authorizationScope: {
      organizationId: deployment.deploymentScope.organizationId,
      ...(deployment.deploymentScope.tenantId ? { tenantId: deployment.deploymentScope.tenantId } : {}),
      programId: deployment.deploymentScope.programId,
      resourceType: 'DEPLOYMENT',
      resourceId: logicalId
    },
    action,
    production
  });
  const recorded = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  return { decision, recorded };
}

export function publishAuthorizedDeployment(env, {
  logicalId = 'deployment.a06',
  version = '1',
  deployment = baseDeployment(env),
  principal = env.deploymentManager,
  authorization
} = {}) {
  const auth = authorization ?? createDeploymentAuthorization(env, logicalId, { principal, deployment });
  assert.equal(auth.decision.allowed, true);
  return publishDeployment({
    ledger: env.ledger,
    logicalId,
    version,
    deployment,
    principal,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(principal.principalId)
  });
}

export function createRuntimeReadAuthorization(env, logicalId, {
  principal = env.runtimePrincipal,
  roleAssignments = [env.runtimeRole],
  deployment = baseDeployment(env)
} = {}) {
  const decision = authorizeDeploymentRuntimeRead({
    principal,
    roleAssignments,
    authorizationScope: {
      organizationId: deployment.deploymentScope.organizationId,
      ...(deployment.deploymentScope.tenantId ? { tenantId: deployment.deploymentScope.tenantId } : {}),
      programId: deployment.deploymentScope.programId,
      resourceType: 'DEPLOYMENT',
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
