import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import {
  normalizeDeploymentTimestamp,
  resolveDeploymentForRuntime,
  validateDeploymentAuthority,
  validateDeploymentRuntimeReadAuthorization
} from '../../deployment/src/index.mjs';
import { KnowledgeRetrievalError, normalizeKnowledgeRetrievalResult } from './contract.mjs';
import { buildKnowledgeRetrievalResult } from './engine.mjs';

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeRetrievalError('INVALID_RETRIEVAL_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function resolveKind(ledger, ref, kind, code) {
  const normalizedRef = assertAuthorityRef(ref);
  const record = ledger.resolve(normalizedRef);
  if (record.ref.kind !== kind) throw new KnowledgeRetrievalError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
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

function assertDecisionDeploymentCompatibility(decision, deployment, profile) {
  const target = decision.targetRef;
  const scope = deployment.deploymentScope;
  if (target.organizationId !== scope.organizationId
    || (target.tenantId ?? null) !== (scope.tenantId ?? null)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_DECISION_DEPLOYMENT_SCOPE_MISMATCH', 'DecisionProblem organization/tenant must match Deployment');
  }
  if (!scope.decisionTypes.includes(decision.decisionType)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_DECISION_TYPE_NOT_DEPLOYED', 'DecisionProblem decisionType is outside Deployment scope');
  }
  if (!deployment.authorizedUse.usePurposes.includes(decision.usePurpose)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_USE_PURPOSE_NOT_DEPLOYED', 'DecisionProblem usePurpose is outside Deployment authorized use');
  }
  if (!deployment.authorizedUse.useClasses.includes(decision.useClass)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_USE_CLASS_NOT_DEPLOYED', 'DecisionProblem useClass is outside Deployment authorized use');
  }
  if (!profile.runtimeGovernance.allowedDecisionAuthorityModes.includes(decision.decisionAuthorityMode)) {
    throw new KnowledgeRetrievalError('RETRIEVAL_DECISION_AUTHORITY_MODE_NOT_ALLOWED', 'DecisionProblem authority mode is outside RuntimeProfile governance');
  }
  const logicalTime = normalizeDeploymentTimestamp(decision.logicalTime, 'DecisionProblem.logicalTime');
  const { start, end } = deployment.effectiveInterval;
  if (new Date(logicalTime).getTime() < new Date(start).getTime()
    || new Date(logicalTime).getTime() >= new Date(end).getTime()) {
    throw new KnowledgeRetrievalError('RETRIEVAL_DECISION_OUTSIDE_DEPLOYMENT_INTERVAL', 'DecisionProblem logicalTime is outside Deployment effective interval');
  }
}

function expectedAuditInputs(result, runtimeAuthorizationRef) {
  return [
    result.decisionProblemRef,
    result.deploymentRef,
    result.runtimeProfileRef,
    result.knowledgeReleaseRef,
    runtimeAuthorizationRef
  ];
}

function replayWorld({
  ledger,
  decisionProblemRef,
  deploymentRef,
  principal,
  runtimeAuthorizationDecisionAuditRef,
  allowHistorical
}) {
  const decisionAuthority = validateDecisionProblemAuthority({ ledger, decisionProblemRef });
  const actor = createPrincipal(principal);
  if (!allowHistorical) {
    const runtimeWorld = resolveDeploymentForRuntime({
      ledger,
      deploymentRef,
      principal: actor,
      authorizationDecisionAuditRef: runtimeAuthorizationDecisionAuditRef,
      atTime: decisionAuthority.semanticPayload.logicalTime
    });
    const deploymentAuthority = validateDeploymentAuthority({ ledger, deploymentRef });
    assertDecisionDeploymentCompatibility(
      decisionAuthority.semanticPayload,
      deploymentAuthority.semanticPayload,
      deploymentAuthority.profileAuthority.semanticPayload
    );
    return deepFreeze({
      decisionAuthority,
      deploymentAuthority,
      runtimeAuthorization: runtimeWorld.runtimeAuthorization,
      runtimeProfile: runtimeWorld.runtimeProfile,
      knowledgeRelease: runtimeWorld.knowledgeRelease
    });
  }

  const deploymentAuthority = validateDeploymentAuthority({
    ledger,
    deploymentRef,
    allowHistorical: true
  });
  assertDecisionDeploymentCompatibility(
    decisionAuthority.semanticPayload,
    deploymentAuthority.semanticPayload,
    deploymentAuthority.profileAuthority.semanticPayload
  );
  const runtimeAuthorization = validateDeploymentRuntimeReadAuthorization({
    ledger,
    authorizationDecisionAuditRef: runtimeAuthorizationDecisionAuditRef,
    principal: actor,
    deployment: deploymentAuthority.semanticPayload,
    logicalId: deploymentAuthority.record.ref.logicalId
  });
  return deepFreeze({
    decisionAuthority,
    deploymentAuthority,
    runtimeAuthorization,
    runtimeProfile: deploymentAuthority.profileAuthority.record,
    knowledgeRelease: deploymentAuthority.profileAuthority.knowledgeReleaseAuthority.release
  });
}

export function executeKnowledgeRetrieval({
  ledger,
  logicalId,
  version,
  decisionProblemRef,
  deploymentRef,
  principal,
  runtimeAuthorizationDecisionAuditRef,
  config = {},
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new KnowledgeRetrievalError('INVALID_LEDGER', 'A07 retrieval requires a replayable AuthorityLedger');
  }
  const id = text(logicalId, 'logicalId');
  const actor = createPrincipal(principal);
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new KnowledgeRetrievalError('RETRIEVAL_AUDIT_ACTOR_MISMATCH', 'retrieval audit actor must equal the exact runtime principal');
  }
  const world = replayWorld({
    ledger,
    decisionProblemRef,
    deploymentRef,
    principal: actor,
    runtimeAuthorizationDecisionAuditRef,
    allowHistorical: false
  });
  const result = buildKnowledgeRetrievalResult({
    decisionProblemRef: world.decisionAuthority.record.ref,
    decisionProblem: world.decisionAuthority.semanticPayload,
    deploymentRef: world.deploymentAuthority.record.ref,
    runtimeProfileRef: world.runtimeProfile.ref,
    knowledgeReleaseRef: world.knowledgeRelease.ref,
    releaseMemberRefs: world.knowledgeRelease.semanticPayload.memberRefs,
    config
  });
  return ledger.publish({
    kind: 'KnowledgeRetrievalResult',
    logicalId: id,
    version: text(version, 'version'),
    semanticPayload: result,
    audit: {
      ...audit,
      action: 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT',
      inputRefs: expectedAuditInputs(result, world.runtimeAuthorization.ref),
      details: {
        ...(audit.details ?? {}),
        retrievalPrincipal: actor,
        runtimeAuthorizationDecisionAuditRef: world.runtimeAuthorization.ref,
        authorityClass: result.authorityClass
      }
    }
  });
}

export function validateKnowledgeRetrievalResult({
  ledger,
  knowledgeRetrievalResultRef,
  allowHistorical = false
}) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new KnowledgeRetrievalError('INVALID_LEDGER', 'A07 validation requires a replayable AuthorityLedger');
  }
  const record = resolveKind(
    ledger,
    knowledgeRetrievalResultRef,
    'KnowledgeRetrievalResult',
    'KNOWLEDGE_RETRIEVAL_RESULT_REQUIRED'
  );
  const stored = normalizeKnowledgeRetrievalResult(record.semanticPayload);
  if (semanticHash('KnowledgeRetrievalResult', stored) !== record.ref.semanticHash) {
    throw new KnowledgeRetrievalError('RETRIEVAL_RESULT_SEMANTIC_HASH_MISMATCH', 'stored retrieval result does not reproduce authority ref');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let validated = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT'
      || !event.details?.retrievalPrincipal
      || !event.details?.runtimeAuthorizationDecisionAuditRef) continue;
    try {
      const actor = createPrincipal(event.details.retrievalPrincipal);
      if (event.actor?.id !== actor.principalId || event.actor?.type !== actor.type) continue;
      const world = replayWorld({
        ledger,
        decisionProblemRef: stored.decisionProblemRef,
        deploymentRef: stored.deploymentRef,
        principal: actor,
        runtimeAuthorizationDecisionAuditRef: event.details.runtimeAuthorizationDecisionAuditRef,
        allowHistorical
      });
      if (!sameAuthorityRef(world.runtimeProfile.ref, stored.runtimeProfileRef)
        || !sameAuthorityRef(world.knowledgeRelease.ref, stored.knowledgeReleaseRef)) continue;
      const expected = buildKnowledgeRetrievalResult({
        decisionProblemRef: world.decisionAuthority.record.ref,
        decisionProblem: world.decisionAuthority.semanticPayload,
        deploymentRef: world.deploymentAuthority.record.ref,
        runtimeProfileRef: world.runtimeProfile.ref,
        knowledgeReleaseRef: world.knowledgeRelease.ref,
        releaseMemberRefs: world.knowledgeRelease.semanticPayload.memberRefs,
        config: stored.config
      });
      if (semanticHash('KnowledgeRetrievalResult', expected) !== record.ref.semanticHash) continue;
      if (!sameRefSet(event.inputRefs, expectedAuditInputs(expected, world.runtimeAuthorization.ref))) continue;
      validated = { world, actor, expected, runtimeAuthorization: world.runtimeAuthorization };
      break;
    } catch {
      validated = null;
    }
  }
  if (!validated) {
    throw new KnowledgeRetrievalError('RETRIEVAL_PUBLICATION_AUTHORITY_INVALID', 'retrieval result lacks exact replayable DecisionProblem/Deployment/runtime-use publication authority');
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    decisionAuthority: validated.world.decisionAuthority,
    deploymentAuthority: validated.world.deploymentAuthority,
    runtimeAuthorization: validated.runtimeAuthorization,
    retrievalPrincipal: validated.actor
  });
}
