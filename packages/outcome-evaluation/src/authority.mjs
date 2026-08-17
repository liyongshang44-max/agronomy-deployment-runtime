import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeOutcomeEvaluation,
  createPrincipal,
  outcomeEvaluationScope,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateOutcomeAuthority } from '../../outcome/src/index.mjs';
import {
  OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY,
  OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_EVALUATION_CONTRACT_VERSION,
  OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
  OUTCOME_EVALUATION_METHOD_REF,
  OutcomeEvaluationError,
  createOutcomeEvaluationPayload,
  normalizeOutcomeEvaluation
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'outcomeRefs', 'findings', 'principal',
  'authorizationDecisionAuditRef', 'audit'
]);

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new OutcomeEvaluationError(
        'INVALID_OUTCOME_EVALUATION_PUBLICATION_FIELD',
        `${name}.${key} is outside E02 publication input`
      );
    }
  }
}

function exactRefKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const unique = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    unique.set(exactRefKey(ref), ref);
  }
  return deepFreeze([...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

function sameRefSet(left, right) {
  const a = canonicalRefs(left).map(exactRefKey);
  const b = canonicalRefs(right).map(exactRefKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSemantic(left, right, domain) {
  return semanticHash(domain, left) === semanticHash(domain, right);
}

function evaluatorIdentity(principal) {
  const normalized = createPrincipal(principal);
  return deepFreeze({
    principalId: normalized.principalId,
    type: normalized.type,
    organizationId: normalized.organizationId,
    ...(normalized.tenantId ? { tenantId: normalized.tenantId } : {})
  });
}

function assertEvaluatorTarget(principal, targetRef) {
  const normalized = createPrincipal(principal);
  if (normalized.organizationId !== targetRef.organizationId
    || (normalized.tenantId ?? null) !== (targetRef.tenantId ?? null)) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_TARGET_SCOPE_DENIED',
      'OutcomeEvaluation evaluator organization/tenant must exactly match the frozen Outcome target cohort'
    );
  }
}

function collectOutcomeCohort({ ledger, outcomeRefs }) {
  if (!Array.isArray(outcomeRefs) || outcomeRefs.length === 0) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_OUTCOMES_REQUIRED', 'OutcomeEvaluation requires at least one exact Outcome');
  }
  const refs = canonicalRefs(outcomeRefs);
  if (refs.length !== outcomeRefs.length) {
    throw new OutcomeEvaluationError('DUPLICATE_OUTCOME_EVALUATION_REF', 'OutcomeEvaluation cannot duplicate Outcome evidence refs');
  }
  const outcomes = refs.map((ref) => validateOutcomeAuthority({ ledger, outcomeRef: ref }));
  const first = outcomes[0].semanticPayload;
  const targetRef = first.targetRef;
  const associationMode = first.association.mode;

  for (const outcome of outcomes.slice(1)) {
    const payload = outcome.semanticPayload;
    if (!sameSemantic(payload.targetRef, targetRef, 'OutcomeEvaluationTargetRef')) {
      throw new OutcomeEvaluationError('OUTCOME_EVALUATION_TARGET_MIXED', 'OutcomeEvaluation cannot mix target cohorts');
    }
    if (payload.association.mode !== associationMode) {
      throw new OutcomeEvaluationError('OUTCOME_EVALUATION_ASSOCIATION_MIXED', 'OutcomeEvaluation cannot mix ADR_BOUND and EXTERNAL_BOUND evidence');
    }
  }

  if (associationMode === 'ADR_BOUND') {
    const decisionProblemRef = first.association.decisionProblemRef;
    for (const outcome of outcomes.slice(1)) {
      if (!sameAuthorityRef(outcome.semanticPayload.association.decisionProblemRef, decisionProblemRef)) {
        throw new OutcomeEvaluationError(
          'OUTCOME_EVALUATION_DECISION_WORLD_MIXED',
          'ADR_BOUND OutcomeEvaluation cannot mix exact DecisionProblem worlds'
        );
      }
    }
    return deepFreeze({
      outcomes,
      outcomeRefs: refs,
      targetRef,
      associationMode,
      decisionProblemRef,
      externalDecisionRef: null,
      decisionResultRefs: canonicalRefs(outcomes.flatMap((outcome) =>
        outcome.semanticPayload.association.decisionResultRef ? [outcome.semanticPayload.association.decisionResultRef] : [])),
      runtimeBindingRefs: canonicalRefs(outcomes.flatMap((outcome) =>
        outcome.semanticPayload.association.runtimeBindingRef ? [outcome.semanticPayload.association.runtimeBindingRef] : []))
    });
  }

  const externalDecisionRef = first.association.externalDecisionRef;
  for (const outcome of outcomes.slice(1)) {
    if (!sameSemantic(
      outcome.semanticPayload.association.externalDecisionRef,
      externalDecisionRef,
      'OutcomeEvaluationExternalDecisionRef'
    )) {
      throw new OutcomeEvaluationError(
        'OUTCOME_EVALUATION_EXTERNAL_DECISION_MIXED',
        'EXTERNAL_BOUND OutcomeEvaluation cannot mix retained external decision identities'
      );
    }
  }
  return deepFreeze({
    outcomes,
    outcomeRefs: refs,
    targetRef,
    associationMode,
    decisionProblemRef: null,
    externalDecisionRef,
    decisionResultRefs: deepFreeze([]),
    runtimeBindingRefs: deepFreeze([])
  });
}

function authorizationScope(payload) {
  return outcomeEvaluationScope({
    organizationId: payload.targetRef.organizationId,
    tenantId: payload.targetRef.tenantId,
    evaluationId: payload.evaluationId
  });
}

function exactInputRefPresent(values, expected) {
  return Array.isArray(values) && values.some((value) => {
    try { return sameAuthorityRef(value, expected); } catch { return false; }
  });
}

function validateEvaluationAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  payload
}) {
  const ref = assertAuthorityRef(authorizationDecisionAuditRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUTHORIZATION_REQUIRED',
      'OutcomeEvaluation requires exact AuthorizationDecisionAudit'
    );
  }
  const stored = record.semanticPayload;
  const scope = authorizationScope(payload);
  if (stored.operation !== 'OUTCOME_EVALUATE' || stored.allowed !== true
    || !samePrincipalIdentity(stored.principal, principal)) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUTHORIZATION_INVALID',
      'stored authorization is not an allowed OUTCOME_EVALUATE decision for the exact evaluator'
    );
  }
  if (!sameSemantic(stored.request?.authorizationScope, scope, 'OutcomeEvaluationAuthorizationScope')) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUTHORIZATION_SCOPE_MISMATCH',
      'OutcomeEvaluation authorization must bind exact deterministic evaluation id'
    );
  }
  const assignments = (stored.assignmentRefs ?? []).map((assignmentRef) => ledger.resolve(assignmentRef));
  const replayed = authorizeOutcomeEvaluation({
    principal,
    roleAssignments: assignments,
    authorizationScope: scope
  });
  if (replayed.decisionHash !== stored.decisionHash
    || canonicalizeSemanticJson(replayed) !== canonicalizeSemanticJson(stored)) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUTHORIZATION_REPLAY_MISMATCH',
      'stored outcome.evaluate authorization cannot be reproduced from exact RoleAssignment authority'
    );
  }
  const auditValid = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'AUTHORIZATION_OUTCOME_EVALUATE_ALLOW'
      && assignments.every((assignment) => exactInputRefPresent(event.inputRefs, assignment.ref)));
  if (!auditValid) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUTHORIZATION_AUDIT_INVALID',
      'OutcomeEvaluation authorization lacks direct exact RoleAssignment audit inputs'
    );
  }
  return record;
}

function expectedAuditInputs(payload, authorizationRef) {
  return canonicalRefs([
    authorizationRef,
    ...payload.outcomeRefs,
    ...(payload.decisionProblemRef ? [payload.decisionProblemRef] : []),
    ...payload.decisionResultRefs,
    ...payload.runtimeBindingRefs
  ]);
}

function sameFindingPayload(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

export function outcomeEvaluationPublicationIdentity({ ledger, outcomeRefs, principal, findings }) {
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new OutcomeEvaluationError('INVALID_LEDGER', 'OutcomeEvaluation identity requires replayable AuthorityLedger');
  }
  const cohort = collectOutcomeCohort({ ledger, outcomeRefs });
  assertEvaluatorTarget(principal, cohort.targetRef);
  const payload = createOutcomeEvaluationPayload({
    evaluator: evaluatorIdentity(principal),
    targetRef: cohort.targetRef,
    associationMode: cohort.associationMode,
    decisionProblemRef: cohort.decisionProblemRef,
    externalDecisionRef: cohort.externalDecisionRef,
    outcomeRefs: cohort.outcomeRefs,
    decisionResultRefs: cohort.decisionResultRefs,
    runtimeBindingRefs: cohort.runtimeBindingRefs,
    findings
  });
  return deepFreeze({
    evaluationId: payload.evaluationId,
    authorizationScope: authorizationScope(payload),
    semanticPayload: payload
  });
}

export function publishOutcomeEvaluation(input) {
  exactObject(input, 'OutcomeEvaluationPublicationInput', PUBLISH_KEYS);
  const {
    ledger,
    outcomeRefs,
    findings,
    principal,
    authorizationDecisionAuditRef,
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new OutcomeEvaluationError('INVALID_LEDGER', 'OutcomeEvaluation publication requires replayable AuthorityLedger');
  }
  const identity = outcomeEvaluationPublicationIdentity({ ledger, outcomeRefs, principal, findings });
  const payload = identity.semanticPayload;
  const normalizedPrincipal = createPrincipal(principal);
  const authorization = validateEvaluationAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    payload
  });
  if (!audit || audit.actor?.id !== normalizedPrincipal.principalId || audit.actor?.type !== normalizedPrincipal.type) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_AUDIT_ACTOR_MISMATCH',
      'OutcomeEvaluation audit actor must equal exact authorized evaluator'
    );
  }

  return ledger.publish({
    kind: 'OutcomeEvaluation',
    logicalId: payload.evaluationId,
    version: '1',
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_OUTCOME_EVALUATION',
      inputRefs: expectedAuditInputs(payload, authorization.ref),
      details: {
        ...(audit.details ?? {}),
        evaluator: payload.evaluator,
        authorizationDecisionAuditRef: authorization.ref,
        methodRef: payload.methodRef,
        targetRef: payload.targetRef,
        associationMode: payload.associationMode,
        externalDecisionRef: payload.externalDecisionRef,
        outcomeRefs: payload.outcomeRefs,
        findingDiagnostics: payload.findings.map((finding) => ({
          dimension: finding.dimension,
          disposition: finding.disposition,
          evidenceWeightClass: finding.evidenceWeightClass,
          interpretationClass: finding.interpretationClass,
          diagnosticCodes: finding.diagnosticCodes
        })),
        causalEffectAuthority: OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
        controlMutationAuthority: OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
        aggregateScoreAuthority: OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY
      }
    }
  });
}

export function validateOutcomeEvaluationAuthority({ ledger, outcomeEvaluationRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new OutcomeEvaluationError('INVALID_LEDGER', 'OutcomeEvaluation validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(outcomeEvaluationRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'OutcomeEvaluation') {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_REQUIRED', 'expected exact OutcomeEvaluation authority ref');
  }
  const payload = normalizeOutcomeEvaluation(record.semanticPayload);
  if (semanticHash('OutcomeEvaluation', payload) !== record.ref.semanticHash) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_SEMANTIC_HASH_MISMATCH',
      'stored OutcomeEvaluation does not reproduce its exact semantic identity'
    );
  }
  if (record.ref.logicalId !== payload.evaluationId || record.ref.version !== '1') {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_LEDGER_IDENTITY_MISMATCH',
      'OutcomeEvaluation ledger identity must equal deterministic evaluation id at immutable version 1'
    );
  }

  const cohort = collectOutcomeCohort({ ledger, outcomeRefs: payload.outcomeRefs });
  if (!sameSemantic(cohort.targetRef, payload.targetRef, 'OutcomeEvaluationTargetRef')
    || cohort.associationMode !== payload.associationMode
    || !sameSemantic(cohort.externalDecisionRef, payload.externalDecisionRef, 'OutcomeEvaluationExternalDecisionRef')
    || !sameRefSet(cohort.decisionResultRefs, payload.decisionResultRefs)
    || !sameRefSet(cohort.runtimeBindingRefs, payload.runtimeBindingRefs)
    || ((cohort.decisionProblemRef === null) !== (payload.decisionProblemRef === null))
    || (cohort.decisionProblemRef && !sameAuthorityRef(cohort.decisionProblemRef, payload.decisionProblemRef))) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_COHORT_REPLAY_MISMATCH',
      'stored OutcomeEvaluation cohort no longer reproduces from exact Outcome authorities'
    );
  }

  const candidateAudits = ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref) && event.action === 'PUBLISH_OUTCOME_EVALUATION');
  let validAudit = null;
  for (const event of candidateAudits) {
    try {
      const evaluator = createPrincipal({ ...event.details?.evaluator, programIds: [] });
      assertEvaluatorTarget(evaluator, payload.targetRef);
      if (event.actor?.id !== evaluator.principalId || event.actor?.type !== evaluator.type) continue;
      if (!event.details?.authorizationDecisionAuditRef) continue;
      const authorization = validateEvaluationAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: evaluator,
        payload
      });
      if (!sameRefSet(event.inputRefs, expectedAuditInputs(payload, authorization.ref))) continue;
      if (!sameSemantic(event.details?.methodRef, OUTCOME_EVALUATION_METHOD_REF, 'OutcomeEvaluationMethodRef')) continue;
      if (!sameSemantic(event.details?.targetRef, payload.targetRef, 'OutcomeEvaluationTargetRef')) continue;
      if (event.details?.associationMode !== payload.associationMode) continue;
      if (!sameSemantic(event.details?.externalDecisionRef, payload.externalDecisionRef, 'OutcomeEvaluationExternalDecisionRef')) continue;
      if (!sameRefSet(event.details?.outcomeRefs ?? [], payload.outcomeRefs)) continue;
      const expectedFindingDiagnostics = payload.findings.map((finding) => ({
        dimension: finding.dimension,
        disposition: finding.disposition,
        evidenceWeightClass: finding.evidenceWeightClass,
        interpretationClass: finding.interpretationClass,
        diagnosticCodes: finding.diagnosticCodes
      }));
      if (!sameFindingPayload(event.details?.findingDiagnostics, expectedFindingDiagnostics)) continue;
      if (event.details?.causalEffectAuthority !== OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY
        || event.details?.controlMutationAuthority !== OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY
        || event.details?.aggregateScoreAuthority !== OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY) continue;
      validAudit = { event, evaluator, authorization };
      break;
    } catch {
      validAudit = null;
    }
  }
  if (!validAudit) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_PUBLICATION_AUTHORITY_INVALID',
      'OutcomeEvaluation lacks exact replayable outcome.evaluate authorization and evaluation audit closure'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: payload,
    outcomes: cohort.outcomes,
    evaluator: validAudit.evaluator,
    authorizationDecisionAuditRef: validAudit.authorization.ref,
    methodRef: OUTCOME_EVALUATION_METHOD_REF,
    replayMode: payload.associationMode === 'ADR_BOUND'
      ? 'ADR_DIMENSIONED_OUTCOME_EVALUATION_EXACT_REPLAY'
      : 'EXTERNAL_DIMENSIONED_OUTCOME_EVALUATION_EXACT_REPLAY',
    causalEffectAuthority: OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
    controlMutationAuthority: OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
    aggregateScoreAuthority: OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY
  });
}

export const OUTCOME_EVALUATION_PUBLICATION_CONTRACT = deepFreeze({
  contractVersion: OUTCOME_EVALUATION_CONTRACT_VERSION,
  authorityClass: OUTCOME_EVALUATION_AUTHORITY_CLASS
});
