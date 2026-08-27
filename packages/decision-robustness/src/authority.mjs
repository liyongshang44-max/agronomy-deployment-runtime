import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import { normalizeRuntimeExecutionEnvelope } from '../../implementation-broker/src/index.mjs';
import { validateRuntimeAlternativeSet } from '../../runtime-alternative-set/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../runtime-profile/src/index.mjs';
import {
  POLICY_CONTRACT_VERSION,
  POLICY_CONTRACT_VERSION_V3,
  validateSpecificationAuthority
} from '../../specification-registry/src/index.mjs';
import {
  DECISION_ROBUSTNESS_AUTHORITY_CLASS,
  DECISION_ROBUSTNESS_CONTRACT_VERSION,
  DecisionRobustnessError,
  decisionRobustnessExactRefs,
  deriveMaterialActionSignature,
  normalizeDecisionRobustness
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'logicalId', 'version', 'runtimeAlternativeSetRef', 'policyExecutions', 'audit'
]);
const EXECUTION_INPUT_KEYS = new Set(['runtimeBindingRef', 'executionEnvelope']);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new DecisionRobustnessError(
        'INVALID_DECISION_ROBUSTNESS_PUBLICATION_FIELD',
        `${name}.${key} is not a legal D05 input; callers cannot self-author robustness, signatures, coverage or confidence`
      );
    }
  }
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

function canonicalExecutions(values) {
  if (!Array.isArray(values)) {
    throw new DecisionRobustnessError(
      'INVALID_DECISION_ROBUSTNESS_EXECUTION_INPUT',
      'policyExecutions must be an array'
    );
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `policyExecutions[${index}]`, EXECUTION_INPUT_KEYS);
    const runtimeBindingRef = assertAuthorityRef(value.runtimeBindingRef);
    if (runtimeBindingRef.kind !== 'RuntimeBinding') {
      throw new DecisionRobustnessError(
        'INVALID_DECISION_ROBUSTNESS_EXECUTION_INPUT',
        `policyExecutions[${index}].runtimeBindingRef must be exact RuntimeBinding authority`
      );
    }
    let executionEnvelope;
    try {
      executionEnvelope = normalizeRuntimeExecutionEnvelope(value.executionEnvelope);
    } catch (error) {
      throw new DecisionRobustnessError(
        'INVALID_POLICY_EXECUTION_EVIDENCE',
        `policyExecutions[${index}] is not exact D02 execution evidence: ${error?.code ?? error?.message ?? 'invalid'}`
      );
    }
    return deepFreeze({ runtimeBindingRef, executionEnvelope });
  });
  const keys = normalized.map((item) => refKey(item.runtimeBindingRef));
  if (new Set(keys).size !== keys.length) {
    throw new DecisionRobustnessError(
      'DUPLICATE_DECISION_ROBUSTNESS_EXECUTION_EVIDENCE',
      'one exact execution evidence envelope per included RuntimeBinding is allowed in D05 v1'
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a.runtimeBindingRef).localeCompare(refKey(b.runtimeBindingRef))));
}

function executionMapForSet(setAuthority, policyExecutions) {
  const included = new Set(setAuthority.semanticPayload.includedBindings.map((item) => refKey(item.runtimeBindingRef)));
  const map = new Map();
  for (const evidence of canonicalExecutions(policyExecutions)) {
    const key = refKey(evidence.runtimeBindingRef);
    if (!included.has(key)) {
      throw new DecisionRobustnessError(
        'DECISION_ROBUSTNESS_EXECUTION_NOT_IN_ALTERNATIVE_SET',
        'D05 cannot compare convenient execution evidence outside the exact RuntimeAlternativeSet included world universe'
      );
    }
    map.set(key, evidence.executionEnvelope);
  }
  return map;
}

function bindingWorlds({ ledger, setAuthority }) {
  return deepFreeze(setAuthority.semanticPayload.includedBindings.map((included) => {
    const binding = validateRuntimeBinding({ ledger, runtimeBindingRef: included.runtimeBindingRef });
    if (!sameAuthorityRef(binding.record.ref, included.runtimeBindingRef)
      || !sameAuthorityRef(binding.semanticPayload.runtimeEligibilityRef, setAuthority.semanticPayload.runtimeEligibilityRef)
      || canonicalizeSemanticJson(binding.semanticPayload.runtimePlanRef) !== canonicalizeSemanticJson(setAuthority.semanticPayload.runtimePlanRef)
      || !sameAuthorityRef(binding.semanticPayload.decisionProblemRef, setAuthority.semanticPayload.decisionProblemRef)
      || !sameAuthorityRef(binding.semanticPayload.deploymentRef, setAuthority.semanticPayload.deploymentRef)
      || !sameAuthorityRef(binding.semanticPayload.runtimeProfileRef, setAuthority.semanticPayload.runtimeProfileRef)
      || !sameAuthorityRef(binding.semanticPayload.contextManifestRef, setAuthority.semanticPayload.contextManifestRef)
      || binding.semanticPayload.selectedAlternativePathId !== included.pathId) {
      throw new DecisionRobustnessError(
        'DECISION_ROBUSTNESS_BINDING_WORLD_MISMATCH',
        'included RuntimeBinding must reproduce the exact RuntimeAlternativeSet decision/profile/context/plan/path world'
      );
    }
    return deepFreeze({ included, binding });
  }));
}

function exactExecutionTuple(binding) {
  const relation = binding.frozenWorldRelations.specificationExecution;
  if (!relation) return null;
  return deepFreeze({
    specificationRef: relation.specification.ref,
    implementationRef: relation.implementation.ref,
    implementationConformanceRef: relation.conformance.ref,
    specificationKind: relation.specification.ref.kind
  });
}

function assertExecutionMatchesBinding(envelope, binding, tuple) {
  if (!sameAuthorityRef(envelope.runtimeBindingRef, binding.record.ref)
    || !sameAuthorityRef(envelope.specificationRef, tuple.specificationRef)
    || !sameAuthorityRef(envelope.implementationRef, tuple.implementationRef)
    || !sameAuthorityRef(envelope.implementationConformanceRef, tuple.implementationConformanceRef)) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_EXECUTION_BINDING_MISMATCH',
      'Policy execution evidence must bind the exact included RuntimeBinding Specification/Implementation/Conformance tuple'
    );
  }
}

function validatePolicyDecisionActionSpace(decision, policy) {
  const allowed = new Set(decision.semanticPayload.actionSpace);
  for (const actionCode of policy.semanticPayload.actionSpace) {
    if (!allowed.has(actionCode)) {
      throw new DecisionRobustnessError(
        'DECISION_ROBUSTNESS_POLICY_ACTION_OUTSIDE_DECISION_PROBLEM',
        `Policy action ${actionCode} is outside exact DecisionProblem actionSpace`
      );
    }
  }
}

function unresolvedEvaluation({ included, binding, policyRef = null, envelope = null, reasons }) {
  return deepFreeze({
    pathId: included.pathId,
    runtimeBindingRef: binding.record.ref,
    policyRef,
    executionEnvelope: envelope,
    executionEvidenceHash: envelope ? semanticHash('RuntimeExecutionEvidence', envelope) : null,
    status: 'UNRESOLVED',
    materialActionSignature: null,
    reasonCodes: deepFreeze([...new Set(reasons)].sort())
  });
}

function evaluateBindingAction({ ledger, decision, included, binding, executionMap }) {
  const tuple = exactExecutionTuple(binding);
  const supplied = executionMap.get(refKey(binding.record.ref)) ?? null;
  if (!tuple || tuple.specificationKind !== 'Policy') {
    if (supplied) {
      throw new DecisionRobustnessError(
        'DECISION_ROBUSTNESS_NON_POLICY_EXECUTION_EVIDENCE',
        'D05 action comparison accepts execution evidence only for included RuntimeBindings whose exact executable Specification is Policy'
      );
    }
    return deepFreeze({
      evaluation: unresolvedEvaluation({
        included,
        binding,
        reasons: ['POLICY_SPECIFICATION_REQUIRED']
      }),
      policy: null
    });
  }

  const policy = validateSpecificationAuthority({ ledger, specificationRef: tuple.specificationRef });
  validatePolicyDecisionActionSpace(decision, policy);
  if (supplied) assertExecutionMatchesBinding(supplied, binding, tuple);

  if (![POLICY_CONTRACT_VERSION, POLICY_CONTRACT_VERSION_V3].includes(policy.semanticPayload.contractVersion)
    || policy.semanticPayload.actionSemantics?.equivalenceMode !== 'EXACT_MATERIAL_PARAMETERS') {
    return deepFreeze({
      evaluation: unresolvedEvaluation({
        included,
        binding,
        policyRef: policy.record.ref,
        envelope: supplied,
        reasons: ['POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED']
      }),
      policy
    });
  }
  if (!supplied) {
    return deepFreeze({
      evaluation: unresolvedEvaluation({
        included,
        binding,
        policyRef: policy.record.ref,
        reasons: ['POLICY_EXECUTION_EVIDENCE_MISSING']
      }),
      policy
    });
  }
  if (supplied.status !== 'SUCCEEDED') {
    return deepFreeze({
      evaluation: unresolvedEvaluation({
        included,
        binding,
        policyRef: policy.record.ref,
        envelope: supplied,
        reasons: ['POLICY_EXECUTION_FAILED']
      }),
      policy
    });
  }

  const signature = deriveMaterialActionSignature({
    policyRef: policy.record.ref,
    policyPayload: policy.semanticPayload,
    rawOutput: supplied.rawOutput
  });
  return deepFreeze({
    evaluation: deepFreeze({
      pathId: included.pathId,
      runtimeBindingRef: binding.record.ref,
      policyRef: policy.record.ref,
      executionEnvelope: supplied,
      executionEvidenceHash: semanticHash('RuntimeExecutionEvidence', supplied),
      status: 'ACTION_AVAILABLE',
      materialActionSignature: signature,
      reasonCodes: deepFreeze([])
    }),
    policy
  });
}

function commonPolicyRef(actionWorlds) {
  if (actionWorlds.length === 0 || actionWorlds.some((world) => !world.policy)) return null;
  const first = actionWorlds[0].policy.record.ref;
  return actionWorlds.every((world) => sameAuthorityRef(world.policy.record.ref, first)) ? first : null;
}

function signatureGroups(actionEvaluations) {
  const groups = new Map();
  for (const evaluation of actionEvaluations) {
    if (evaluation.status !== 'ACTION_AVAILABLE') continue;
    const key = evaluation.materialActionSignature.signatureHash;
    const paths = groups.get(key) ?? [];
    paths.push(evaluation.pathId);
    groups.set(key, paths);
  }
  return deepFreeze([...groups.entries()]
    .map(([signatureHash, pathIds]) => deepFreeze({
      signatureHash,
      pathIds: deepFreeze([...pathIds].sort())
    }))
    .sort((a, b) => a.signatureHash.localeCompare(b.signatureHash)));
}

function actionChangingDiagnostics(setPayload, actionEvaluations) {
  const byPath = new Map(actionEvaluations.map((item) => [item.pathId, item]));
  return deepFreeze(setPayload.materialUncertaintyDimensions.map((dimension) => {
    const signatures = [...new Set(dimension.pathIds
      .map((pathId) => byPath.get(pathId))
      .filter((item) => item?.status === 'ACTION_AVAILABLE')
      .map((item) => item.materialActionSignature.signatureHash))].sort();
    const evaluableCount = dimension.pathIds.filter((pathId) => byPath.get(pathId)?.status === 'ACTION_AVAILABLE').length;
    const diagnosticClass = evaluableCount < 2
      ? 'NOT_EVALUABLE'
      : signatures.length > 1
        ? 'ACTION_CHANGING'
        : 'ACTION_STABLE';
    return deepFreeze({
      dimensionId: dimension.dimensionId,
      dimensionType: dimension.dimensionType,
      pathIds: deepFreeze([...dimension.pathIds].sort()),
      signatureHashes: deepFreeze(signatures),
      diagnosticClass
    });
  }).sort((a, b) => a.dimensionId.localeCompare(b.dimensionId)));
}

function buildHistoricalRobustnessWorld({ ledger, runtimeAlternativeSetRef, policyExecutions }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionRobustnessError('INVALID_LEDGER', 'D05 requires a replayable AuthorityLedger');
  }
  const setAuthority = validateRuntimeAlternativeSet({ ledger, runtimeAlternativeSetRef });
  const decision = validateDecisionProblemAuthority({
    ledger,
    decisionProblemRef: setAuthority.semanticPayload.decisionProblemRef
  });
  const profile = validateRuntimeProfileAuthority({
    ledger,
    runtimeProfileRef: setAuthority.semanticPayload.runtimeProfileRef,
    allowHistorical: true
  });
  const executions = executionMapForSet(setAuthority, policyExecutions);
  const worlds = bindingWorlds({ ledger, setAuthority });
  const actionWorlds = worlds.map(({ included, binding }) =>
    evaluateBindingAction({ ledger, decision, included, binding, executionMap: executions }));
  const actionEvaluations = deepFreeze(actionWorlds.map((world) => world.evaluation)
    .sort((a, b) => a.pathId.localeCompare(b.pathId)));
  const commonPolicy = commonPolicyRef(actionWorlds);
  const groups = signatureGroups(actionEvaluations);

  const requirement = profile.semanticPayload.robustnessRequirement ?? null;
  const sufficientCompletenessClasses = requirement?.sufficientCompletenessClasses ?? [];
  const coverageSufficient = requirement !== null
    && sufficientCompletenessClasses.includes(setAuthority.semanticPayload.completenessClass);
  const unresolved = new Set();
  if (!requirement) unresolved.add('RUNTIME_PROFILE_ROBUSTNESS_REQUIREMENT_REQUIRED');
  if (!coverageSufficient) unresolved.add('RUNTIME_ALTERNATIVE_COVERAGE_INSUFFICIENT');
  if (worlds.length === 0) unresolved.add('NO_INCLUDED_RUNTIME_WORLD');
  for (const evaluation of actionEvaluations) {
    for (const reason of evaluation.reasonCodes) unresolved.add(reason);
  }
  const policies = actionWorlds.filter((world) => world.policy).map((world) => world.policy.record.ref);
  if (policies.length > 0 && !commonPolicy) unresolved.add('POLICY_EQUIVALENCE_CONTRACT_MISMATCH');
  if (requirement && requirement.comparisonMode !== 'EXACT_MATERIAL_ACTION_SIGNATURE') {
    unresolved.add('POLICY_EQUIVALENCE_CONTRACT_MISMATCH');
  }

  const robustnessClass = unresolved.size > 0
    ? 'UNRESOLVED'
    : groups.length === 1
      ? 'ROBUST'
      : groups.length > 1
        ? 'SENSITIVE'
        : 'UNRESOLVED';
  if (robustnessClass === 'UNRESOLVED' && unresolved.size === 0) {
    unresolved.add('POLICY_EXECUTION_EVIDENCE_MISSING');
  }

  const payload = normalizeDecisionRobustness({
    contractVersion: DECISION_ROBUSTNESS_CONTRACT_VERSION,
    authorityClass: DECISION_ROBUSTNESS_AUTHORITY_CLASS,
    decisionProblemRef: setAuthority.semanticPayload.decisionProblemRef,
    runtimeAlternativeSetRef: setAuthority.record.ref,
    runtimeProfileRef: setAuthority.semanticPayload.runtimeProfileRef,
    runtimePlanRef: setAuthority.semanticPayload.runtimePlanRef,
    comparisonMethod: {
      methodId: 'ADR_MATERIAL_ACTION_ROBUSTNESS',
      methodVersion: '1',
      comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
      coverageRequirementSource: 'RUNTIME_PROFILE'
    },
    coverageAssessment: {
      completenessClass: setAuthority.semanticPayload.completenessClass,
      sufficientCompletenessClasses,
      sufficient: coverageSufficient
    },
    commonPolicyRef: commonPolicy,
    actionEvaluations,
    signatureGroups: groups,
    actionChangingDiagnostics: actionChangingDiagnostics(setAuthority.semanticPayload, actionEvaluations),
    robustnessClass,
    unresolvedReasonCodes: deepFreeze([...unresolved].sort())
  });
  return deepFreeze({ setAuthority, decision, profile, actionWorlds: deepFreeze(actionWorlds), payload });
}

function expectedAuditInputs(payload) {
  return canonicalRefs(decisionRobustnessExactRefs(payload));
}

export function publishDecisionRobustness(input) {
  exactObject(input, 'DecisionRobustnessPublicationInput', PUBLISH_KEYS);
  const {
    ledger,
    logicalId,
    version,
    runtimeAlternativeSetRef,
    policyExecutions = [],
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function') {
    throw new DecisionRobustnessError('INVALID_LEDGER', 'D05 publication requires AuthorityLedger.publish');
  }
  const world = buildHistoricalRobustnessWorld({ ledger, runtimeAlternativeSetRef, policyExecutions });
  const actor = world.setAuthority.runtimeAlternativeSetPrincipal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_AUDIT_ACTOR_MISMATCH',
      'DecisionRobustness publisher must equal the exact runtime principal that froze RuntimeAlternativeSet authority'
    );
  }
  return ledger.publish({
    kind: 'DecisionRobustness',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: world.payload,
    audit: {
      ...audit,
      action: 'PUBLISH_DECISION_ROBUSTNESS',
      inputRefs: expectedAuditInputs(world.payload),
      details: {
        ...(audit.details ?? {}),
        decisionRobustnessPrincipal: cloneCanonicalValue(actor),
        runtimeAlternativeSetRef: world.setAuthority.record.ref,
        robustnessClass: world.payload.robustnessClass,
        completenessClass: world.payload.coverageAssessment.completenessClass,
        comparisonMode: world.payload.comparisonMethod.comparisonMode,
        availableActionCount: world.payload.actionEvaluations.filter((item) => item.status === 'ACTION_AVAILABLE').length,
        signatureGroupCount: world.payload.signatureGroups.length
      }
    }
  });
}

export function validateDecisionRobustness({ ledger, decisionRobustnessRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionRobustnessError('INVALID_LEDGER', 'D05 validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(decisionRobustnessRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'DecisionRobustness') {
    throw new DecisionRobustnessError('DECISION_ROBUSTNESS_REQUIRED', 'expected exact DecisionRobustness authority ref');
  }
  const stored = normalizeDecisionRobustness(record.semanticPayload);
  if (semanticHash('DecisionRobustness', stored) !== record.ref.semanticHash) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_SEMANTIC_HASH_MISMATCH',
      'stored DecisionRobustness does not reproduce its exact semantic authority identity'
    );
  }
  const world = buildHistoricalRobustnessWorld({
    ledger,
    runtimeAlternativeSetRef: stored.runtimeAlternativeSetRef,
    policyExecutions: stored.actionEvaluations
      .filter((item) => item.executionEnvelope !== null)
      .map((item) => ({ runtimeBindingRef: item.runtimeBindingRef, executionEnvelope: item.executionEnvelope }))
  });
  if (canonicalizeSemanticJson(world.payload) !== canonicalizeSemanticJson(stored)) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_REPLAY_MISMATCH',
      'exact RuntimeAlternativeSet, RuntimeProfile, RuntimeBindings, Policies and retained D02 evidence do not reproduce frozen robustness semantics'
    );
  }
  const actor = world.setAuthority.runtimeAlternativeSetPrincipal;
  const expectedInputs = expectedAuditInputs(stored);
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_DECISION_ROBUSTNESS'
      && event.actor?.id === actor.principalId
      && event.actor?.type === actor.type
      && event.details?.decisionRobustnessPrincipal?.principalId === actor.principalId
      && event.details?.decisionRobustnessPrincipal?.type === actor.type
      && event.details?.runtimeAlternativeSetRef
      && sameAuthorityRef(event.details.runtimeAlternativeSetRef, stored.runtimeAlternativeSetRef)
      && event.details?.robustnessClass === stored.robustnessClass
      && event.details?.completenessClass === stored.coverageAssessment.completenessClass
      && event.details?.comparisonMode === stored.comparisonMethod.comparisonMode
      && event.details?.availableActionCount === stored.actionEvaluations.filter((item) => item.status === 'ACTION_AVAILABLE').length
      && event.details?.signatureGroupCount === stored.signatureGroups.length
      && sameRefSet(event.inputRefs, expectedInputs));
  if (!validAudit) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_PUBLICATION_AUTHORITY_INVALID',
      'DecisionRobustness lacks exact runtime-principal audit closure over coverage, bindings, Policy semantics and action evidence'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    runtimeAlternativeSet: world.setAuthority,
    decisionProblem: world.decision,
    runtimeProfile: world.profile,
    actionWorlds: world.actionWorlds,
    decisionRobustnessPrincipal: actor,
    replayMode: 'EXACT_FROZEN_RUNTIME_ALTERNATIVE_SET_AND_POLICY_EXECUTION_EVIDENCE'
  });
}
