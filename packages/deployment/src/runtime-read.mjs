import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeDeploymentRuntimeRead,
  createPrincipal,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { DeploymentError, normalizeDeploymentTimestamp } from './contract.mjs';
import { currentDeploymentState } from './lifecycle.mjs';
import { deploymentAuthorizationScope } from './validation.mjs';

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new DeploymentError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function validateRuntimeReadAuthorization({ ledger, ref, principal, deployment, logicalId }) {
  const authRecord = resolveKind(ledger, ref, 'AuthorizationDecisionAudit', 'DEPLOYMENT_RUNTIME_AUTHORIZATION_REQUIRED');
  const stored = authRecord.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_AUTHORIZATION_INVALID', 'runtime read requires a content-addressed AuthorizationDecision');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_AUTHORIZATION_HASH_MISMATCH', 'runtime-read authorization hash is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedScope = deploymentAuthorizationScope(deployment, logicalId);
  if (stored.operation !== 'DEPLOYMENT_RUNTIME_READ'
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, actor)
    || semanticHash('ADR-A06-DEPLOYMENT-RUNTIME-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A06-DEPLOYMENT-RUNTIME-SCOPE', expectedScope)) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_AUTHORIZATION_MISMATCH', 'runtime-read authorization does not bind exact principal/scope/deployment');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_ROLE_ASSIGNMENT_REQUIRED', 'runtime read requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((assignmentRef) =>
    resolveKind(ledger, assignmentRef, 'RoleAssignment', 'DEPLOYMENT_RUNTIME_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeDeploymentRuntimeRead({
    principal: actor,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_AUTHORIZATION_REPLAY_MISMATCH', 'runtime-read authorization cannot be replayed');
  }
  const direct = ledger.auditFor(authRecord.ref).filter((event) => sameAuthorityRef(event.objectRef, authRecord.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_DEPLOYMENT_RUNTIME_READ_ALLOW'
    && stored.assignmentRefs.every((assignmentRef) =>
      event.inputRefs.some((refValue) => sameAuthorityRef(refValue, assignmentRef))))) {
    throw new DeploymentError('DEPLOYMENT_RUNTIME_AUTHORIZATION_AUDIT_INVALID', 'runtime-read authorization lacks direct RoleAssignment audit inputs');
  }
  return authRecord;
}

export function resolveDeploymentForRuntime({
  ledger,
  deploymentRef,
  principal,
  authorizationDecisionAuditRef,
  atTime
}) {
  const state = currentDeploymentState({ ledger, deploymentRef, allowHistorical: false });
  if (state.rolloutStage === 'SUSPENDED' || state.rolloutStage === 'DEPRECATED') {
    throw new DeploymentError('DEPLOYMENT_NOT_RUNTIME_ACTIVE', `Deployment is ${state.rolloutStage}`);
  }
  const time = normalizeDeploymentTimestamp(atTime, 'atTime');
  const { start, end } = state.deploymentAuthority.semanticPayload.effectiveInterval;
  if (new Date(time).getTime() < new Date(start).getTime() || new Date(time).getTime() >= new Date(end).getTime()) {
    throw new DeploymentError('DEPLOYMENT_OUTSIDE_EFFECTIVE_INTERVAL', 'runtime read is outside Deployment effective interval');
  }
  const actor = createPrincipal(principal);
  const authorization = validateRuntimeReadAuthorization({
    ledger,
    ref: authorizationDecisionAuditRef,
    principal: actor,
    deployment: state.deploymentAuthority.semanticPayload,
    logicalId: state.deploymentAuthority.record.ref.logicalId
  });
  return deepFreeze({
    deployment: state.deploymentAuthority.record,
    semanticPayload: state.deploymentAuthority.semanticPayload,
    currentRolloutStage: state.rolloutStage,
    runtimeProfile: state.deploymentAuthority.profileAuthority.record,
    knowledgeRelease: state.deploymentAuthority.profileAuthority.knowledgeReleaseAuthority.release,
    runtimeAuthorization: authorization,
    atTime: time
  });
}
