import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeDeploymentControl,
  createPrincipal,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../runtime-profile/src/index.mjs';
import { DeploymentError, normalizeDeployment } from './contract.mjs';

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) {
    throw new DeploymentError(code, `expected ${kind}, received ${record.ref.kind}`);
  }
  return record;
}

function subset(selected, allowed) {
  return selected.every((value) => allowed.includes(value));
}

export function deploymentNeedsProductionAuthority(deployment) {
  const value = normalizeDeployment(deployment);
  return value.runtimeEnvironment === 'PRODUCTION' || value.rolloutStage === 'PRODUCTION';
}

export function deploymentAuthorizationScope(deployment, logicalId) {
  const value = normalizeDeployment(deployment);
  return deepFreeze({
    organizationId: value.deploymentScope.organizationId,
    ...(value.deploymentScope.tenantId ? { tenantId: value.deploymentScope.tenantId } : {}),
    programId: value.deploymentScope.programId,
    resourceType: 'DEPLOYMENT',
    resourceId: text(logicalId, 'logicalId')
  });
}

export function validateDeploymentProfileCompatibility({ ledger, deployment, allowHistorical = false }) {
  const value = normalizeDeployment(deployment);
  const profileAuthority = validateRuntimeProfileAuthority({
    ledger,
    runtimeProfileRef: value.runtimeProfileRef,
    allowHistorical
  });
  const profile = profileAuthority.semanticPayload;
  const releaseTarget = profileAuthority.knowledgeReleaseAuthority.publicationDecision?.semanticPayload?.releaseTarget;
  if (!releaseTarget?.programId) {
    throw new DeploymentError(
      'DEPLOYMENT_RELEASE_PROGRAM_ENTITLEMENT_REQUIRED',
      'A06 requires the exact KnowledgeRelease publication authority to include programId'
    );
  }
  const scope = value.deploymentScope;
  if (scope.organizationId !== profile.controlScope.organizationId
    || (scope.tenantId ?? null) !== (profile.controlScope.tenantId ?? null)) {
    throw new DeploymentError('DEPLOYMENT_PROFILE_SCOPE_MISMATCH', 'Deployment organization/tenant must equal RuntimeProfile control scope');
  }
  if (releaseTarget.organizationId !== scope.organizationId
    || (releaseTarget.tenantId ?? null) !== (scope.tenantId ?? null)
    || releaseTarget.programId !== scope.programId) {
    throw new DeploymentError(
      'DEPLOYMENT_RELEASE_ENTITLEMENT_SCOPE_MISMATCH',
      'Deployment organization/tenant/program must equal the exact KnowledgeRelease entitlement target'
    );
  }
  const allowed = profile.allowedUseDeploymentConstraints;
  if (!subset(value.authorizedUse.usePurposes, allowed.usePurposes)) {
    throw new DeploymentError('DEPLOYMENT_USE_PURPOSE_NOT_ALLOWED', 'Deployment usePurposes exceed RuntimeProfile constraints');
  }
  if (!subset(value.authorizedUse.useClasses, allowed.useClasses)) {
    throw new DeploymentError('DEPLOYMENT_USE_CLASS_NOT_ALLOWED', 'Deployment useClasses exceed RuntimeProfile constraints');
  }
  if (!allowed.runtimeEnvironments.includes(value.runtimeEnvironment)) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_ENVIRONMENT_NOT_ALLOWED', 'runtimeEnvironment is outside RuntimeProfile constraints');
  }
  if (!allowed.rolloutStages.includes(value.rolloutStage)) {
    throw new DeploymentError('DEPLOYMENT_ROLLOUT_STAGE_NOT_ALLOWED', 'rolloutStage is outside RuntimeProfile constraints');
  }
  return deepFreeze({ profileAuthority, releaseTarget });
}

export function validateDeploymentControlAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  deployment,
  logicalId,
  action = 'PUBLISH'
}) {
  const authRecord = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'DEPLOYMENT_AUTHORIZATION_REQUIRED'
  );
  const stored = authRecord.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new DeploymentError('DEPLOYMENT_AUTHORIZATION_INVALID', 'Deployment control requires a content-addressed AuthorizationDecision');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new DeploymentError('DEPLOYMENT_AUTHORIZATION_HASH_MISMATCH', 'stored Deployment authorization hash is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedScope = deploymentAuthorizationScope(deployment, logicalId);
  const production = deploymentNeedsProductionAuthority(deployment);
  const expectedOperation = `DEPLOYMENT_${action}${production ? '_PRODUCTION' : ''}`;
  if (stored.operation !== expectedOperation
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, actor)
    || semanticHash('ADR-A06-DEPLOYMENT-AUTH-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A06-DEPLOYMENT-AUTH-SCOPE', expectedScope)
    || stored.request?.action !== action
    || Boolean(stored.request?.production) !== production) {
    throw new DeploymentError('DEPLOYMENT_AUTHORIZATION_MISMATCH', 'authorization does not bind exact controller/action/scope/deployment id');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new DeploymentError('DEPLOYMENT_ROLE_ASSIGNMENT_REQUIRED', 'Deployment control requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'DEPLOYMENT_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeDeploymentControl({
    principal: actor,
    roleAssignments: assignments,
    authorizationScope: expectedScope,
    action,
    production
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new DeploymentError('DEPLOYMENT_AUTHORIZATION_REPLAY_MISMATCH', 'Deployment authorization cannot be replayed from exact RoleAssignments');
  }
  const direct = ledger.auditFor(authRecord.ref).filter((event) => sameAuthorityRef(event.objectRef, authRecord.ref));
  if (!direct.some((event) =>
    event.action === `AUTHORIZATION_${expectedOperation}_ALLOW`
      && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)))) {
    throw new DeploymentError('DEPLOYMENT_AUTHORIZATION_AUDIT_INVALID', 'Deployment authorization lacks direct RoleAssignment audit inputs');
  }
  return authRecord;
}
