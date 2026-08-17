import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateDecisionRobustness } from '../../decision-robustness/src/index.mjs';
import { validateSpecificationAuthority } from '../../specification-registry/src/index.mjs';
import {
  DECISION_RESULT_AUTHORITY_CLASS,
  DECISION_RESULT_CONTRACT_VERSION,
  DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
  DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY,
  DECISION_RESULT_WAIT_MODE,
  DecisionResultError,
  decisionResultExactRefs,
  normalizeDecisionResult
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'logicalId', 'version', 'decisionRobustnessRef', 'decidedAt', 'audit'
]);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new DecisionResultError(
        'INVALID_DECISION_RESULT_PUBLICATION_FIELD',
        `${name}.${key} is outside D06 publication input; callers cannot self-author disposition, action, ASK refs or abstention reasons`
      );
    }
  }
}

function normalizeDecidedAt(value) {
  const raw = text(value, 'decidedAt');
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new DecisionResultError('INVALID_DECISION_RESULT_TIME', 'decidedAt must be an explicit offset-aware timestamp');
  }
  return new Date(raw).toISOString();
}

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    map.set(refKey(ref), ref);
  }
  return deepFreeze([...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ref]) => ref));
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function exactInformationRefs(robustness) {
  const eligibility = robustness.runtimeAlternativeSet.historicalRuntimeEligibility.semanticPayload;
  return deepFreeze((eligibility.informationRequirements ?? [])
    .map((item) => deepFreeze({ requirementId: item.requirementId, semanticHash: item.semanticHash }))
    .sort((a, b) => a.requirementId.localeCompare(b.requirementId)));
}

function exactRuntimeBindingRefs(payload) {
  const refs = payload.actionEvaluations.map((item) => item.runtimeBindingRef);
  const map = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze([...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ref]) => ref));
}

function policyResultRef(decisionRobustnessRef, evaluation) {
  if (!evaluation.policyRef || !evaluation.executionEvidenceHash) return null;
  const core = {
    decisionRobustnessRef,
    pathId: evaluation.pathId,
    runtimeBindingRef: evaluation.runtimeBindingRef,
    policyRef: evaluation.policyRef,
    executionEvidenceHash: evaluation.executionEvidenceHash,
    materialActionSignatureHash: evaluation.materialActionSignature?.signatureHash ?? null
  };
  return deepFreeze({
    ...core,
    policyResultHash: semanticHash('PolicyResultReference', core)
  });
}

function exactPolicyResultRefs(robustness) {
  const refs = robustness.semanticPayload.actionEvaluations
    .map((evaluation) => policyResultRef(robustness.record.ref, evaluation))
    .filter(Boolean);
  return deepFreeze(refs.sort((a, b) => a.pathId.localeCompare(b.pathId)));
}

function exactCommonPolicy({ ledger, robustness, decision }) {
  const ref = robustness.semanticPayload.commonPolicyRef;
  if (!ref) return null;
  const policy = validateSpecificationAuthority({ ledger, specificationRef: ref });
  if (policy.record.ref.kind !== 'Policy' || !sameAuthorityRef(policy.record.ref, ref)) {
    throw new DecisionResultError('DECISION_RESULT_POLICY_AUTHORITY_INVALID', 'D06 common Policy authority must resolve exactly');
  }
  if (policy.semanticPayload.decisionType !== decision.semanticPayload.decisionType) {
    throw new DecisionResultError(
      'DECISION_RESULT_POLICY_DECISION_TYPE_MISMATCH',
      'DecisionResult Policy decisionType must equal exact DecisionProblem decisionType'
    );
  }
  const allowedActions = new Set(decision.semanticPayload.actionSpace);
  if (policy.semanticPayload.actionSpace.some((action) => !allowedActions.has(action))) {
    throw new DecisionResultError(
      'DECISION_RESULT_POLICY_ACTION_SPACE_MISMATCH',
      'DecisionResult Policy actionSpace must be contained in exact DecisionProblem actionSpace'
    );
  }
  return policy;
}

function assertDecisionTime(decision, decidedAt) {
  const decided = new Date(decidedAt).getTime();
  const logical = new Date(decision.semanticPayload.logicalTime).getTime();
  const deadline = new Date(decision.semanticPayload.decisionDeadline).getTime();
  if (decided < logical) {
    throw new DecisionResultError(
      'DECISION_RESULT_BEFORE_LOGICAL_TIME',
      'DecisionResult cannot be decided before exact DecisionProblem logicalTime'
    );
  }
  if (decided > deadline) {
    throw new DecisionResultError(
      'DECISION_RESULT_AFTER_DEADLINE',
      'DecisionResult cannot be first authored after exact DecisionProblem decisionDeadline'
    );
  }
}

function robustAction(robustness, policy) {
  const payload = robustness.semanticPayload;
  if (!policy || payload.robustnessClass !== 'ROBUST') return null;
  if (payload.signatureGroups.length !== 1) {
    throw new DecisionResultError(
      'DECISION_RESULT_ROBUST_SIGNATURE_REQUIRED',
      'ROBUST DecisionRobustness must contain exactly one MaterialActionSignature group'
    );
  }
  const available = payload.actionEvaluations.filter((item) => item.status === 'ACTION_AVAILABLE');
  if (available.length === 0 || available.length !== payload.actionEvaluations.length) {
    throw new DecisionResultError(
      'DECISION_RESULT_ROBUST_ACTION_EVIDENCE_INCOMPLETE',
      'ACT requires successful exact Policy action evidence for every included RuntimeBinding'
    );
  }
  const expected = payload.signatureGroups[0].signatureHash;
  if (available.some((item) => item.materialActionSignature?.signatureHash !== expected)) {
    throw new DecisionResultError(
      'DECISION_RESULT_ROBUST_SIGNATURE_MISMATCH',
      'ROBUST signature group does not match exact per-world MaterialActionSignature evidence'
    );
  }
  const action = available[0].materialActionSignature;
  if (!sameAuthorityRef(action.policyRef, policy.record.ref)) {
    throw new DecisionResultError(
      'DECISION_RESULT_ACTION_POLICY_MISMATCH',
      'ROBUST MaterialActionSignature must derive from exact common Policy'
    );
  }
  return action;
}

function abstentionReasons(robustness, policyFallback = null) {
  const reasons = new Set();
  const payload = robustness.semanticPayload;
  if (payload.robustnessClass === 'SENSITIVE') reasons.add('DECISION_ROBUSTNESS_SENSITIVE');
  if (payload.robustnessClass === 'UNRESOLVED') {
    reasons.add('DECISION_ROBUSTNESS_UNRESOLVED');
    for (const reason of payload.unresolvedReasonCodes) reasons.add(reason);
  }
  if (policyFallback === 'ABSTAIN') reasons.add('POLICY_FALLBACK_ABSTAIN');
  if (policyFallback === 'EXTERNAL_AUTHORITY') reasons.add('POLICY_FALLBACK_EXTERNAL_AUTHORITY');
  if (!policyFallback) reasons.add('POLICY_AUTHORITY_UNAVAILABLE_FOR_ACTION');
  return deepFreeze([...reasons].sort());
}

function dispositionPayload({ robustness, decision, policy, informationRequirementRefs }) {
  const mode = decision.semanticPayload.decisionAuthorityMode;
  if (mode === 'RUNTIME_ONLY') {
    throw new DecisionResultError(
      'DECISION_RESULT_RUNTIME_ONLY_FORBIDDEN',
      'decision_authority_mode=RUNTIME_ONLY must stop at runtime legality/results and cannot fabricate DecisionResult'
    );
  }
  if (!['ADR_POLICY', 'EXTERNAL_POLICY'].includes(mode)) {
    throw new DecisionResultError('DECISION_RESULT_AUTHORITY_MODE_FORBIDDEN', `unsupported DecisionProblem authority mode ${mode}`);
  }
  if (mode === 'EXTERNAL_POLICY' && !policy) {
    throw new DecisionResultError(
      'EXTERNAL_POLICY_AUTHORITY_REF_REQUIRED',
      'EXTERNAL_POLICY DecisionResult requires exact common Policy authority; ADR cannot fabricate an external policy decision'
    );
  }

  const action = robustAction(robustness, policy);
  if (action) {
    return {
      decisionAuthority: { mode, authorityRef: policy.record.ref },
      decisionDisposition: 'ACT',
      structuredAction: action,
      waitSemantics: null,
      informationRequirementRefs: [],
      abstentionReasonAuthority: null,
      humanGate: { mode: policy.semanticPayload.humanGate.mode, policyRef: policy.record.ref }
    };
  }

  if (informationRequirementRefs.length > 0) {
    return {
      decisionAuthority: {
        mode,
        authorityRef: policy ? policy.record.ref : robustness.record.ref
      },
      decisionDisposition: 'ASK',
      structuredAction: null,
      waitSemantics: null,
      informationRequirementRefs,
      abstentionReasonAuthority: null,
      humanGate: policy ? { mode: policy.semanticPayload.humanGate.mode, policyRef: policy.record.ref } : null
    };
  }

  if (!policy) {
    return {
      decisionAuthority: { mode, authorityRef: robustness.record.ref },
      decisionDisposition: 'ABSTAIN',
      structuredAction: null,
      waitSemantics: null,
      informationRequirementRefs: [],
      abstentionReasonAuthority: {
        decisionRobustnessRef: robustness.record.ref,
        policyRef: null,
        reasonCodes: abstentionReasons(robustness)
      },
      humanGate: null
    };
  }

  const fallback = policy.semanticPayload.fallback.disposition;
  if (fallback === 'WAIT') {
    return {
      decisionAuthority: { mode, authorityRef: policy.record.ref },
      decisionDisposition: 'WAIT',
      structuredAction: null,
      waitSemantics: {
        mode: DECISION_RESULT_WAIT_MODE,
        decisionDeadline: decision.semanticPayload.decisionDeadline,
        basis: 'POLICY_FALLBACK_WAIT',
        decisionRobustnessRef: robustness.record.ref,
        policyRef: policy.record.ref
      },
      informationRequirementRefs: [],
      abstentionReasonAuthority: null,
      humanGate: { mode: policy.semanticPayload.humanGate.mode, policyRef: policy.record.ref }
    };
  }

  if (!['ABSTAIN', 'EXTERNAL_AUTHORITY'].includes(fallback)) {
    throw new DecisionResultError('DECISION_RESULT_POLICY_FALLBACK_UNSUPPORTED', `unsupported exact Policy fallback ${fallback}`);
  }
  return {
    decisionAuthority: { mode, authorityRef: policy.record.ref },
    decisionDisposition: 'ABSTAIN',
    structuredAction: null,
    waitSemantics: null,
    informationRequirementRefs: [],
    abstentionReasonAuthority: {
      decisionRobustnessRef: robustness.record.ref,
      policyRef: policy.record.ref,
      reasonCodes: abstentionReasons(robustness, fallback)
    },
    humanGate: { mode: policy.semanticPayload.humanGate.mode, policyRef: policy.record.ref }
  };
}

function buildHistoricalDecisionResult({ ledger, decisionRobustnessRef, decidedAt }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionResultError('INVALID_LEDGER', 'D06 requires a replayable AuthorityLedger');
  }
  const robustness = validateDecisionRobustness({ ledger, decisionRobustnessRef });
  const decision = robustness.decisionProblem;
  const normalizedDecidedAt = normalizeDecidedAt(decidedAt);
  assertDecisionTime(decision, normalizedDecidedAt);
  const policy = exactCommonPolicy({ ledger, robustness, decision });
  const informationRequirementRefs = exactInformationRefs(robustness);
  const disposition = dispositionPayload({ robustness, decision, policy, informationRequirementRefs });
  const policyResultRefs = policy ? exactPolicyResultRefs(robustness) : deepFreeze([]);
  const runtimeBindingRefs = exactRuntimeBindingRefs(robustness.semanticPayload);

  const payload = normalizeDecisionResult({
    contractVersion: DECISION_RESULT_CONTRACT_VERSION,
    authorityClass: DECISION_RESULT_AUTHORITY_CLASS,
    decisionProblemRef: decision.record.ref,
    decisionAuthority: disposition.decisionAuthority,
    decisionDisposition: disposition.decisionDisposition,
    structuredAction: disposition.structuredAction,
    waitSemantics: disposition.waitSemantics,
    informationRequirementRefs: disposition.informationRequirementRefs,
    abstentionReasonAuthority: disposition.abstentionReasonAuthority,
    humanGate: disposition.humanGate,
    policyResultRefs,
    decisionRobustnessRef: robustness.record.ref,
    runtimeAlternativeSetRef: robustness.semanticPayload.runtimeAlternativeSetRef,
    runtimeBindingRefs,
    decidedAt: normalizedDecidedAt,
    humanApprovalAuthority: DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
    machineExecutionAuthority: DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY
  });
  return deepFreeze({ robustness, decision, policy, payload });
}

function expectedAuditInputs(payload) {
  return canonicalRefs(decisionResultExactRefs(payload));
}

export function publishDecisionResult(input) {
  exactObject(input, 'DecisionResultPublicationInput', PUBLISH_KEYS);
  const {
    ledger,
    logicalId,
    version,
    decisionRobustnessRef,
    decidedAt,
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function') {
    throw new DecisionResultError('INVALID_LEDGER', 'D06 publication requires AuthorityLedger.publish');
  }
  const world = buildHistoricalDecisionResult({ ledger, decisionRobustnessRef, decidedAt });
  const actor = world.robustness.decisionRobustnessPrincipal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new DecisionResultError(
      'DECISION_RESULT_AUDIT_ACTOR_MISMATCH',
      'DecisionResult publisher must equal the exact runtime principal that published DecisionRobustness'
    );
  }
  const record = ledger.publish({
    kind: 'DecisionResult',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: world.payload,
    audit: {
      ...audit,
      action: 'PUBLISH_DECISION_RESULT',
      inputRefs: expectedAuditInputs(world.payload),
      details: {
        ...(audit.details ?? {}),
        decisionResultPrincipal: deepFreeze({
          principalId: actor.principalId,
          type: actor.type
        }),
        decisionProblemRef: world.payload.decisionProblemRef,
        decisionRobustnessRef: world.payload.decisionRobustnessRef,
        runtimeAlternativeSetRef: world.payload.runtimeAlternativeSetRef,
        decisionAuthority: world.payload.decisionAuthority,
        decisionDisposition: world.payload.decisionDisposition,
        informationRequirementRefs: world.payload.informationRequirementRefs,
        policyResultHashes: world.payload.policyResultRefs.map((item) => item.policyResultHash),
        humanApprovalAuthority: world.payload.humanApprovalAuthority,
        machineExecutionAuthority: world.payload.machineExecutionAuthority
      }
    }
  });
  return record;
}

export function validateDecisionResult({ ledger, decisionResultRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionResultError('INVALID_LEDGER', 'D06 validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(decisionResultRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'DecisionResult') {
    throw new DecisionResultError('DECISION_RESULT_REQUIRED', 'expected exact DecisionResult authority ref');
  }
  const stored = normalizeDecisionResult(record.semanticPayload);
  if (semanticHash('DecisionResult', stored) !== record.ref.semanticHash) {
    throw new DecisionResultError(
      'DECISION_RESULT_SEMANTIC_HASH_MISMATCH',
      'stored DecisionResult does not reproduce its exact semantic authority identity'
    );
  }
  const world = buildHistoricalDecisionResult({
    ledger,
    decisionRobustnessRef: stored.decisionRobustnessRef,
    decidedAt: stored.decidedAt
  });
  if (canonicalizeSemanticJson(world.payload) !== canonicalizeSemanticJson(stored)) {
    throw new DecisionResultError(
      'DECISION_RESULT_REPLAY_MISMATCH',
      'exact DecisionProblem, DecisionRobustness, Policy/fallback, InformationRequirements and runtime evidence do not reproduce frozen DecisionResult'
    );
  }
  const actor = world.robustness.decisionRobustnessPrincipal;
  const expectedInputs = expectedAuditInputs(stored);
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_DECISION_RESULT'
      && event.actor?.id === actor.principalId
      && event.actor?.type === actor.type
      && event.details?.decisionResultPrincipal?.principalId === actor.principalId
      && event.details?.decisionResultPrincipal?.type === actor.type
      && event.details?.decisionRobustnessRef
      && sameAuthorityRef(event.details.decisionRobustnessRef, stored.decisionRobustnessRef)
      && event.details?.runtimeAlternativeSetRef
      && sameAuthorityRef(event.details.runtimeAlternativeSetRef, stored.runtimeAlternativeSetRef)
      && event.details?.decisionDisposition === stored.decisionDisposition
      && canonicalizeSemanticJson(event.details?.decisionAuthority) === canonicalizeSemanticJson(stored.decisionAuthority)
      && canonicalizeSemanticJson(event.details?.informationRequirementRefs ?? []) === canonicalizeSemanticJson(stored.informationRequirementRefs)
      && canonicalizeSemanticJson(event.details?.policyResultHashes ?? []) === canonicalizeSemanticJson(stored.policyResultRefs.map((item) => item.policyResultHash))
      && event.details?.humanApprovalAuthority === DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY
      && event.details?.machineExecutionAuthority === DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY
      && sameRefSet(event.inputRefs, expectedInputs));
  if (!validAudit) {
    throw new DecisionResultError(
      'DECISION_RESULT_PUBLICATION_AUTHORITY_INVALID',
      'DecisionResult lacks exact runtime-principal audit closure over DecisionRobustness, decision authority and disposition evidence'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    decisionProblem: world.decision,
    decisionRobustness: world.robustness,
    policy: world.policy,
    decisionResultPrincipal: actor,
    replayMode: 'EXACT_FROZEN_DECISION_ROBUSTNESS_POLICY_AND_DISPOSITION_EVIDENCE',
    humanApprovalAuthority: DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY,
    machineExecutionAuthority: DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY
  });
}
