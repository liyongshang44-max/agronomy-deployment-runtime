import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeOutcomeWrite,
  createPrincipal,
  outcomeWriteScope,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import { validateDecisionResult } from '../../decision-result/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import {
  OUTCOME_AUTHORITY_CLASS,
  OUTCOME_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_CONTRACT_VERSION,
  OUTCOME_UPSTREAM_AUTHORITY_MUTATION,
  OutcomeError,
  createOutcomePayload,
  normalizeOutcome,
  outcomeExactRefs,
  outcomeIdentity
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'targetRef', 'outcome', 'association', 'principal',
  'authorizationDecisionAuditRef', 'audit'
]);

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OutcomeError('INVALID_OUTCOME_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OutcomeError('INVALID_OUTCOME_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new OutcomeError('INVALID_OUTCOME_PUBLICATION_FIELD', `${name}.${key} is outside E01 publication input`);
    }
  }
}

function sameSemantic(left, right, domain = 'OutcomeSemanticEquality') {
  return semanticHash(domain, left) === semanticHash(domain, right);
}

function exactRefSet(values) {
  const unique = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    unique.set(canonicalizeSemanticJson(ref), ref);
  }
  return [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function sameRefSet(left, right) {
  const a = exactRefSet(left).map((ref) => canonicalizeSemanticJson(ref));
  const b = exactRefSet(right).map((ref) => canonicalizeSemanticJson(ref));
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assertPrincipalOwnsTarget(principal, targetRef) {
  if (principal.organizationId !== targetRef.organizationId
    || (principal.tenantId ?? null) !== (targetRef.tenantId ?? null)) {
    throw new OutcomeError(
      'OUTCOME_TARGET_SCOPE_DENIED',
      'Outcome ingress principal organization/tenant must exactly match Outcome target scope'
    );
  }
}

function associationAnchor(outcomePayload, world) {
  const timestamps = [];
  if (world.decisionProblem) timestamps.push(world.decisionProblem.semanticPayload.logicalTime);
  if (world.decisionResult) timestamps.push(world.decisionResult.semanticPayload.decidedAt);
  const association = outcomePayload.association;
  if (association.externalDecisionRef) timestamps.push(association.externalDecisionRef.occurredAt);
  if (association.externalExecutionRef) timestamps.push(association.externalExecutionRef.occurredAt);
  return timestamps.sort().at(-1) ?? null;
}

function validateAssociationWorld({ ledger, payload }) {
  const association = payload.association;
  if (association.mode === 'EXTERNAL_BOUND') {
    const anchor = associationAnchor(payload, { decisionProblem: null, decisionResult: null });
    if (anchor && payload.effectiveInterval.end < anchor) {
      throw new OutcomeError(
        'OUTCOME_PREDECISION_EVIDENCE_FORBIDDEN',
        'EXTERNAL_BOUND Outcome effective interval must not end before the retained decision/execution evidence anchor'
      );
    }
    if (anchor && payload.availableAt < anchor) {
      throw new OutcomeError('OUTCOME_AVAILABLE_BEFORE_ASSOCIATION', 'Outcome cannot be available before its external decision/execution evidence anchor');
    }
    return deepFreeze({ decisionProblem: null, decisionResult: null, runtimeBinding: null });
  }

  const decisionProblem = validateDecisionProblemAuthority({
    ledger,
    decisionProblemRef: association.decisionProblemRef
  });
  if (!sameSemantic(decisionProblem.semanticPayload.targetRef, payload.targetRef, 'OutcomeTargetRef')) {
    throw new OutcomeError(
      'OUTCOME_DECISION_TARGET_MISMATCH',
      'ADR_BOUND Outcome targetRef must equal exact DecisionProblem targetRef'
    );
  }

  let decisionResult = null;
  if (association.decisionResultRef) {
    decisionResult = validateDecisionResult({ ledger, decisionResultRef: association.decisionResultRef });
    if (!sameAuthorityRef(decisionResult.semanticPayload.decisionProblemRef, decisionProblem.record.ref)) {
      throw new OutcomeError(
        'OUTCOME_DECISION_RESULT_WORLD_MISMATCH',
        'Outcome DecisionResult must belong to the exact associated DecisionProblem'
      );
    }
  }

  let runtimeBinding = null;
  if (association.runtimeBindingRef) {
    runtimeBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: association.runtimeBindingRef });
    if (!sameAuthorityRef(runtimeBinding.semanticPayload.decisionProblemRef, decisionProblem.record.ref)) {
      throw new OutcomeError(
        'OUTCOME_RUNTIME_BINDING_WORLD_MISMATCH',
        'Outcome RuntimeBinding must belong to the exact associated DecisionProblem'
      );
    }
  }

  const anchor = associationAnchor(payload, { decisionProblem, decisionResult });
  if (anchor && payload.effectiveInterval.end < anchor) {
    throw new OutcomeError(
      'OUTCOME_PREDECISION_EVIDENCE_FORBIDDEN',
      'Outcome effective interval must not end before the exact ADR decision/execution association anchor'
    );
  }
  if (anchor && payload.availableAt < anchor) {
    throw new OutcomeError('OUTCOME_AVAILABLE_BEFORE_ASSOCIATION', 'Outcome cannot be available before the exact ADR association anchor');
  }

  return deepFreeze({ decisionProblem, decisionResult, runtimeBinding });
}

function authorizationScope(payload) {
  return outcomeWriteScope({
    organizationId: payload.targetRef.organizationId,
    tenantId: payload.targetRef.tenantId,
    outcomeId: payload.outcomeId
  });
}

function exactInputRefPresent(values, expected) {
  return Array.isArray(values) && values.some((value) => {
    try { return sameAuthorityRef(value, expected); } catch { return false; }
  });
}

function validateOutcomeWriteAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  payload
}) {
  const ref = assertAuthorityRef(authorizationDecisionAuditRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new OutcomeError('OUTCOME_WRITE_AUTHORIZATION_REQUIRED', 'Outcome requires exact AuthorizationDecisionAudit');
  }
  const stored = record.semanticPayload;
  const scope = authorizationScope(payload);
  if (stored.operation !== 'OUTCOME_WRITE' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, principal)) {
    throw new OutcomeError('OUTCOME_WRITE_AUTHORIZATION_INVALID', 'stored authorization is not an allowed OUTCOME_WRITE decision for exact principal');
  }
  if (!sameSemantic(stored.request?.authorizationScope, scope, 'OutcomeWriteScope')) {
    throw new OutcomeError('OUTCOME_WRITE_AUTHORIZATION_SCOPE_MISMATCH', 'Outcome authorization scope must bind exact deterministic Outcome id');
  }
  const assignments = (stored.assignmentRefs ?? []).map((assignmentRef) => ledger.resolve(assignmentRef));
  const replayed = authorizeOutcomeWrite({
    principal,
    roleAssignments: assignments,
    authorizationScope: scope
  });
  if (replayed.decisionHash !== stored.decisionHash
    || canonicalizeSemanticJson(replayed) !== canonicalizeSemanticJson(stored)) {
    throw new OutcomeError('OUTCOME_WRITE_AUTHORIZATION_REPLAY_MISMATCH', 'stored outcome.write authorization cannot be reproduced from exact RoleAssignment authority');
  }
  const auditValid = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'AUTHORIZATION_OUTCOME_WRITE_ALLOW'
      && assignments.every((assignment) => exactInputRefPresent(event.inputRefs, assignment.ref)));
  if (!auditValid) {
    throw new OutcomeError('OUTCOME_WRITE_AUTHORIZATION_AUDIT_INVALID', 'Outcome authorization lacks direct exact RoleAssignment audit inputs');
  }
  return record;
}

function expectedAuditInputs(payload, authorizationRef) {
  return exactRefSet([authorizationRef, ...outcomeExactRefs(payload)]);
}

export function publishOutcome(input) {
  exactObject(input, 'OutcomePublicationInput', PUBLISH_KEYS);
  const {
    ledger,
    targetRef,
    outcome,
    association,
    principal,
    authorizationDecisionAuditRef,
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new OutcomeError('INVALID_LEDGER', 'Outcome publication requires replayable AuthorityLedger');
  }
  const normalizedPrincipal = createPrincipal(principal);
  const payload = createOutcomePayload({ targetRef, outcome, association });
  assertPrincipalOwnsTarget(normalizedPrincipal, payload.targetRef);
  const world = validateAssociationWorld({ ledger, payload });
  const authorization = validateOutcomeWriteAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    payload
  });
  if (!audit || audit.actor?.id !== normalizedPrincipal.principalId || audit.actor?.type !== normalizedPrincipal.type) {
    throw new OutcomeError('OUTCOME_AUDIT_ACTOR_MISMATCH', 'Outcome audit actor must equal exact authorized ingress principal');
  }

  return ledger.publish({
    kind: 'Outcome',
    logicalId: payload.outcomeId,
    version: '1',
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_OUTCOME',
      inputRefs: expectedAuditInputs(payload, authorization.ref),
      details: {
        ...(audit.details ?? {}),
        outcomeIngressPrincipal: normalizedPrincipal,
        authorizationDecisionAuditRef: authorization.ref,
        targetRef: payload.targetRef,
        associationMode: payload.association.mode,
        decisionProblemRef: payload.association.decisionProblemRef,
        decisionResultRef: payload.association.decisionResultRef,
        runtimeBindingRef: payload.association.runtimeBindingRef,
        externalDecisionRef: payload.association.externalDecisionRef,
        externalExecutionRef: payload.association.externalExecutionRef,
        outcomeSource: payload.source,
        causalEffectAuthority: OUTCOME_CAUSAL_EFFECT_AUTHORITY,
        upstreamAuthorityMutation: OUTCOME_UPSTREAM_AUTHORITY_MUTATION,
        associationReplayClass: world.decisionProblem ? 'ADR_EXACT_AUTHORITY_REPLAY' : 'EXTERNAL_CONTENT_ADDRESSED_ASSOCIATION'
      }
    }
  });
}

export function validateOutcomeAuthority({ ledger, outcomeRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new OutcomeError('INVALID_LEDGER', 'Outcome validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(outcomeRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'Outcome') {
    throw new OutcomeError('OUTCOME_REQUIRED', 'expected exact Outcome authority ref');
  }
  const payload = normalizeOutcome(record.semanticPayload);
  if (semanticHash('Outcome', payload) !== record.ref.semanticHash) {
    throw new OutcomeError('OUTCOME_SEMANTIC_HASH_MISMATCH', 'stored Outcome does not reproduce its exact semantic identity');
  }
  const identity = outcomeIdentity({
    targetRef: payload.targetRef,
    outcome: {
      semanticId: payload.semanticId,
      value: payload.value,
      unit: payload.unit,
      epistemicClass: payload.epistemicClass,
      provenanceClass: payload.provenanceClass,
      effectiveInterval: payload.effectiveInterval,
      availableAt: payload.availableAt,
      spatialSupport: payload.spatialSupport,
      verticalSupport: payload.verticalSupport,
      temporalSupport: payload.temporalSupport,
      uncertainty: payload.uncertainty,
      source: payload.source
    },
    association: payload.association
  });
  if (record.ref.logicalId !== identity.outcomeId || record.ref.version !== '1') {
    throw new OutcomeError('OUTCOME_LEDGER_IDENTITY_MISMATCH', 'Outcome ledger identity must equal deterministic ingress identity at immutable version 1');
  }

  const world = validateAssociationWorld({ ledger, payload });
  const candidateAudits = ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref) && event.action === 'PUBLISH_OUTCOME');
  let validAudit = null;
  for (const event of candidateAudits) {
    try {
      const principal = createPrincipal(event.details?.outcomeIngressPrincipal);
      assertPrincipalOwnsTarget(principal, payload.targetRef);
      if (event.actor?.id !== principal.principalId || event.actor?.type !== principal.type) continue;
      if (!event.details?.authorizationDecisionAuditRef) continue;
      const authorization = validateOutcomeWriteAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal,
        payload
      });
      if (!sameRefSet(event.inputRefs, expectedAuditInputs(payload, authorization.ref))) continue;
      if (!sameSemantic(event.details?.targetRef, payload.targetRef, 'OutcomeTargetRef')) continue;
      if (event.details?.associationMode !== payload.association.mode) continue;
      if (!sameSemantic(event.details?.externalDecisionRef, payload.association.externalDecisionRef, 'OutcomeExternalDecision')) continue;
      if (!sameSemantic(event.details?.externalExecutionRef, payload.association.externalExecutionRef, 'OutcomeExternalExecution')) continue;
      if (!sameSemantic(event.details?.outcomeSource, payload.source, 'OutcomeSource')) continue;
      if (event.details?.causalEffectAuthority !== OUTCOME_CAUSAL_EFFECT_AUTHORITY
        || event.details?.upstreamAuthorityMutation !== OUTCOME_UPSTREAM_AUTHORITY_MUTATION) continue;
      validAudit = { event, principal, authorization };
      break;
    } catch {
      validAudit = null;
    }
  }
  if (!validAudit) {
    throw new OutcomeError(
      'OUTCOME_PUBLICATION_AUTHORITY_INVALID',
      'Outcome lacks exact replayable outcome.write authorization and association audit closure'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: payload,
    decisionProblem: world.decisionProblem,
    decisionResult: world.decisionResult,
    runtimeBinding: world.runtimeBinding,
    outcomeIngressPrincipal: validAudit.principal,
    authorizationDecisionAuditRef: validAudit.authorization.ref,
    replayMode: payload.association.mode === 'ADR_BOUND'
      ? 'ADR_EXACT_AUTHORITY_REPLAY_WITH_CONTENT_ADDRESSED_EXTERNAL_EXECUTION_IF_PRESENT'
      : 'EXTERNAL_CONTENT_ADDRESSED_ASSOCIATION_REPLAY',
    causalEffectAuthority: OUTCOME_CAUSAL_EFFECT_AUTHORITY,
    upstreamAuthorityMutation: OUTCOME_UPSTREAM_AUTHORITY_MUTATION
  });
}

export function outcomePublicationIdentity({ targetRef, outcome, association }) {
  const identity = outcomeIdentity({ targetRef, outcome, association });
  return deepFreeze({
    outcomeId: identity.outcomeId,
    authorizationScope: outcomeWriteScope({
      organizationId: identity.draft.targetRef.organizationId,
      tenantId: identity.draft.targetRef.tenantId,
      outcomeId: identity.outcomeId
    })
  });
}

export const OUTCOME_PUBLICATION_CONTRACT = deepFreeze({
  contractVersion: OUTCOME_CONTRACT_VERSION,
  authorityClass: OUTCOME_AUTHORITY_CLASS
});
