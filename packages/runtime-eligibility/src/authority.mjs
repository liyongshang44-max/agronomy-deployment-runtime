import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateKnowledgeRetrievalResult } from '../../knowledge-retrieval/src/index.mjs';
import { compileRuntimePlan } from '../../runtime-plan/src/index.mjs';
import {
  RuntimeEligibilityError,
  normalizeRuntimeEligibility,
  text
} from './contract.mjs';
import { buildRuntimeEligibility } from './engine.mjs';

const PUBLISH_INPUT_KEYS = new Set([
  'ledger', 'logicalId', 'version', 'runtimePlan', 'snapshotStore', 'audit'
]);

function exactPublishInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', 'publication input must be an object');
  }
  for (const key of Object.keys(input)) {
    if (!PUBLISH_INPUT_KEYS.has(key)) {
      throw new RuntimeEligibilityError(
        'INVALID_RUNTIME_ELIGIBILITY_PUBLICATION_FIELD',
        `${key} is not a legal R03 publication input; RuntimeBinding/Decision outputs cannot authorize RuntimeEligibility`
      );
    }
  }
}

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const map = new Map();
  for (const ref of values) {
    const normalized = assertAuthorityRef(ref);
    map.set(refKey(normalized), normalized);
  }
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref));
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function expectedAuditInputs(payload, runtimeAuthorizationRef) {
  return canonicalRefs([
    payload.decisionProblemRef,
    payload.deploymentRef,
    payload.runtimeProfileRef,
    payload.contextManifestRef,
    payload.knowledgeRetrievalResultRef,
    ...payload.applicabilityAssessmentRefs,
    runtimeAuthorizationRef
  ]);
}

function runtimePlanFromPayload({ ledger, payload, snapshotStore }) {
  const plan = compileRuntimePlan({
    ledger,
    decisionProblemRef: payload.decisionProblemRef,
    deploymentRef: payload.deploymentRef,
    runtimeProfileRef: payload.runtimeProfileRef,
    contextManifestRef: payload.contextManifestRef,
    knowledgeRetrievalResultRef: payload.knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs: payload.applicabilityAssessmentRefs,
    ...(snapshotStore ? { snapshotStore } : {})
  });
  if (plan.planId !== payload.planRef.planId
    || plan.planHash !== payload.planRef.planHash
    || plan.compilerVersion !== payload.planRef.compilerVersion) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_PLAN_REPLAY_MISMATCH',
      'RuntimeEligibility exact authority refs do not reproduce the frozen RuntimePlan identity'
    );
  }
  return plan;
}

export function publishRuntimeEligibility(input) {
  exactPublishInput(input);
  const {
    ledger,
    logicalId,
    version,
    runtimePlan,
    snapshotStore,
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeEligibilityError('INVALID_LEDGER', 'R03 publication requires a replayable AuthorityLedger');
  }
  const payload = buildRuntimeEligibility({ ledger, runtimePlan, snapshotStore });
  const retrieval = validateKnowledgeRetrievalResult({
    ledger,
    knowledgeRetrievalResultRef: payload.knowledgeRetrievalResultRef
  });
  const actor = retrieval.retrievalPrincipal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_AUDIT_ACTOR_MISMATCH',
      'RuntimeEligibility publication actor must equal the exact authorized runtime principal from KnowledgeRetrievalResult'
    );
  }
  const inputRefs = expectedAuditInputs(payload, retrieval.runtimeAuthorization.ref);
  return ledger.publish({
    kind: 'RuntimeEligibility',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_RUNTIME_ELIGIBILITY',
      inputRefs,
      details: {
        ...(audit.details ?? {}),
        runtimeEligibilityPrincipal: actor,
        runtimeAuthorizationDecisionAuditRef: retrieval.runtimeAuthorization.ref,
        planRef: payload.planRef,
        runtimeEligibility: payload.runtimeEligibility,
        authorityClass: payload.authorityClass
      }
    }
  });
}

export function validateRuntimeEligibility({ ledger, runtimeEligibilityRef, snapshotStore }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeEligibilityError('INVALID_LEDGER', 'R03 validation requires a replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(runtimeEligibilityRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'RuntimeEligibility') {
    throw new RuntimeEligibilityError('RUNTIME_ELIGIBILITY_REQUIRED', 'expected exact RuntimeEligibility authority ref');
  }
  const stored = normalizeRuntimeEligibility(record.semanticPayload);
  if (semanticHash('RuntimeEligibility', stored) !== record.ref.semanticHash) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_SEMANTIC_HASH_MISMATCH',
      'stored RuntimeEligibility payload does not reproduce its authority ref'
    );
  }

  const plan = runtimePlanFromPayload({ ledger, payload: stored, snapshotStore });
  const expected = buildRuntimeEligibility({ ledger, runtimePlan: plan, snapshotStore });
  if (semanticHash('RuntimeEligibility', expected) !== record.ref.semanticHash) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_REPLAY_MISMATCH',
      'current exact runtime authority inputs do not reproduce the frozen RuntimeEligibility'
    );
  }
  const retrieval = validateKnowledgeRetrievalResult({
    ledger,
    knowledgeRetrievalResultRef: stored.knowledgeRetrievalResultRef
  });
  const actor = retrieval.retrievalPrincipal;
  const expectedInputs = expectedAuditInputs(stored, retrieval.runtimeAuthorization.ref);
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_RUNTIME_ELIGIBILITY'
      && event.actor?.id === actor.principalId
      && event.actor?.type === actor.type
      && event.details?.runtimeEligibilityPrincipal?.principalId === actor.principalId
      && event.details?.runtimeEligibilityPrincipal?.type === actor.type
      && event.details?.runtimeAuthorizationDecisionAuditRef
      && sameAuthorityRef(event.details.runtimeAuthorizationDecisionAuditRef, retrieval.runtimeAuthorization.ref)
      && canonicalizeSemanticJson(event.details?.planRef) === canonicalizeSemanticJson(stored.planRef)
      && event.details?.runtimeEligibility === stored.runtimeEligibility
      && sameRefSet(event.inputRefs, expectedInputs));
  if (!validAudit) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_PUBLICATION_AUTHORITY_INVALID',
      'RuntimeEligibility lacks exact runtime-principal audit closure over current plan authority inputs'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    runtimePlan: plan,
    retrievalAuthority: retrieval,
    runtimeEligibilityPrincipal: actor
  });
}
