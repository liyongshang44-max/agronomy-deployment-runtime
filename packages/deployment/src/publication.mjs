import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { DeploymentError, normalizeDeployment } from './contract.mjs';
import {
  validateDeploymentControlAuthorization,
  validateDeploymentProfileCompatibility
} from './validation.mjs';

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}
function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}
function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = left.map(refKey).sort();
  const b = right.map(refKey).sort();
  return a.every((value, index) => value === b[index]);
}
function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new DeploymentError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function validatePublicationAudit({ ledger, record, deployment, authorization, principal }) {
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const expectedInputs = [deployment.runtimeProfileRef, authorization.ref];
  if (!direct.some((event) =>
    event.action === 'PUBLISH_DEPLOYMENT'
      && event.actor?.id === principal.principalId
      && event.actor?.type === principal.type
      && sameRefSet(event.inputRefs, expectedInputs)
      && sameAuthorityRef(event.details?.authorizationDecisionAuditRef, authorization.ref))) {
    throw new DeploymentError('DEPLOYMENT_PUBLICATION_AUDIT_INVALID', 'Deployment publication must bind exactly RuntimeProfile + deployment authorization');
  }
}

export function publishDeployment({
  ledger,
  logicalId,
  version,
  deployment,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DeploymentError('INVALID_LEDGER', 'Deployment publication requires a replayable AuthorityLedger');
  }
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new DeploymentError('DEPLOYMENT_AUDIT_REQUIRED', 'Deployment publication requires explicit audit metadata');
  }
  const id = text(logicalId, 'logicalId');
  const actor = createPrincipal(principal);
  const payload = normalizeDeployment(deployment);
  if (actor.organizationId !== payload.deploymentScope.organizationId
    || (actor.tenantId ?? null) !== (payload.deploymentScope.tenantId ?? null)) {
    throw new DeploymentError('DEPLOYMENT_CONTROLLER_SCOPE_DENIED', 'Deployment controller organization/tenant must equal deployment scope');
  }
  validateDeploymentProfileCompatibility({ ledger, deployment: payload, allowHistorical: false });
  const authorization = validateDeploymentControlAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: actor,
    deployment: payload,
    logicalId: id,
    action: 'PUBLISH'
  });
  if (audit.actor.id !== actor.principalId || audit.actor.type !== actor.type) {
    throw new DeploymentError('DEPLOYMENT_AUDIT_ACTOR_MISMATCH', 'audit actor must equal exact Deployment controller');
  }
  return ledger.publish({
    kind: 'Deployment',
    logicalId: id,
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_DEPLOYMENT',
      inputRefs: [payload.runtimeProfileRef, authorization.ref],
      details: {
        ...(audit.details ?? {}),
        controlPrincipal: actor,
        deploymentScope: payload.deploymentScope,
        authorizationDecisionAuditRef: authorization.ref
      }
    }
  });
}

export function validateDeploymentAuthority({ ledger, deploymentRef, allowHistorical = false }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DeploymentError('INVALID_LEDGER', 'Deployment validation requires a replayable AuthorityLedger');
  }
  const record = resolveKind(ledger, deploymentRef, 'Deployment', 'DEPLOYMENT_REQUIRED');
  const payload = normalizeDeployment(record.semanticPayload);
  if (semanticHash('Deployment', payload) !== record.ref.semanticHash) {
    throw new DeploymentError('DEPLOYMENT_SEMANTIC_HASH_MISMATCH', 'stored Deployment payload does not reproduce authority ref');
  }
  const { profileAuthority, releaseTarget } = validateDeploymentProfileCompatibility({
    ledger,
    deployment: payload,
    allowHistorical
  });
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let publicationAuthorization = null;
  let controller = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_DEPLOYMENT' || !event.details?.controlPrincipal || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const actor = createPrincipal(event.details.controlPrincipal);
      if (event.actor?.id !== actor.principalId || event.actor?.type !== actor.type) continue;
      const candidate = validateDeploymentControlAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: actor,
        deployment: payload,
        logicalId: record.ref.logicalId,
        action: 'PUBLISH'
      });
      validatePublicationAudit({ ledger, record, deployment: payload, authorization: candidate, principal: actor });
      publicationAuthorization = candidate;
      controller = actor;
      break;
    } catch {
      publicationAuthorization = null;
      controller = null;
    }
  }
  if (!publicationAuthorization || !controller) {
    throw new DeploymentError('DEPLOYMENT_PUBLICATION_AUTHORITY_INVALID', 'Deployment lacks direct replayable publication authority');
  }
  return deepFreeze({
    record,
    semanticPayload: payload,
    profileAuthority,
    releaseTarget,
    publicationAuthorization,
    controller
  });
}
