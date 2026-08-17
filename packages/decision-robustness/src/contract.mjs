import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeRuntimeExecutionEnvelope } from '../../implementation-broker/src/index.mjs';
import { normalizeRuntimeValue } from '../../runtime-results/src/index.mjs';

export const POLICY_ACTION_OUTPUT_CONTRACT_VERSION = 'adr.policy-action-output.v1';
export const MATERIAL_ACTION_SIGNATURE_CONTRACT_VERSION = 'adr.material-action-signature.v1';
export const DECISION_ROBUSTNESS_CONTRACT_VERSION = 'adr.decision-robustness.v1';
export const DECISION_ROBUSTNESS_AUTHORITY_CLASS = 'RUNTIME_DECISION_ROBUSTNESS_AUTHORITY';
export const DECISION_ROBUSTNESS_CLASSES = deepFreeze(['ROBUST', 'SENSITIVE', 'UNRESOLVED']);
export const DECISION_ROBUSTNESS_ACTION_STATUSES = deepFreeze(['ACTION_AVAILABLE', 'UNRESOLVED']);
export const ACTION_CHANGING_DIAGNOSTIC_CLASSES = deepFreeze([
  'ACTION_CHANGING', 'ACTION_STABLE', 'NOT_EVALUABLE'
]);
export const DECISION_ROBUSTNESS_UNRESOLVED_REASON_CODES = deepFreeze([
  'RUNTIME_PROFILE_ROBUSTNESS_REQUIREMENT_REQUIRED',
  'RUNTIME_ALTERNATIVE_COVERAGE_INSUFFICIENT',
  'NO_INCLUDED_RUNTIME_WORLD',
  'POLICY_SPECIFICATION_REQUIRED',
  'POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED',
  'POLICY_EXECUTION_EVIDENCE_MISSING',
  'POLICY_EXECUTION_FAILED',
  'POLICY_EQUIVALENCE_CONTRACT_MISMATCH'
]);

const ROBUSTNESS_CLASSES = new Set(DECISION_ROBUSTNESS_CLASSES);
const ACTION_STATUSES = new Set(DECISION_ROBUSTNESS_ACTION_STATUSES);
const DIAGNOSTIC_CLASSES = new Set(ACTION_CHANGING_DIAGNOSTIC_CLASSES);
const UNRESOLVED_REASONS = new Set(DECISION_ROBUSTNESS_UNRESOLVED_REASON_CODES);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;

const ACTION_OUTPUT_KEYS = new Set(['contractVersion', 'actionCode', 'parameters']);
const ACTION_PARAMETER_KEYS = new Set(['name', 'value']);
const SIGNATURE_KEYS = new Set([
  'contractVersion', 'policyRef', 'equivalenceMode', 'actionCode',
  'materialParameters', 'signatureHash'
]);
const SIGNATURE_PARAMETER_KEYS = new Set([
  'name', 'semanticId', 'valueType', 'unit', 'value'
]);
const ROBUSTNESS_KEYS = new Set([
  'contractVersion', 'authorityClass', 'decisionProblemRef', 'runtimeAlternativeSetRef',
  'runtimeProfileRef', 'runtimePlanRef', 'comparisonMethod', 'coverageAssessment',
  'commonPolicyRef', 'actionEvaluations', 'signatureGroups',
  'actionChangingDiagnostics', 'robustnessClass', 'unresolvedReasonCodes'
]);
const COMPARISON_KEYS = new Set([
  'methodId', 'methodVersion', 'comparisonMode', 'coverageRequirementSource'
]);
const COVERAGE_KEYS = new Set([
  'completenessClass', 'sufficientCompletenessClasses', 'sufficient'
]);
const ACTION_EVALUATION_KEYS = new Set([
  'pathId', 'runtimeBindingRef', 'policyRef', 'executionEnvelope', 'executionEvidenceHash',
  'status', 'materialActionSignature', 'reasonCodes'
]);
const SIGNATURE_GROUP_KEYS = new Set(['signatureHash', 'pathIds']);
const DIAGNOSTIC_KEYS = new Set([
  'dimensionId', 'dimensionType', 'pathIds', 'signatureHashes', 'diagnosticClass'
]);

export class DecisionRobustnessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecisionRobustnessError';
    this.code = code;
  }
}

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
        'INVALID_DECISION_ROBUSTNESS_FIELD',
        `${name}.${key} is outside the frozen D05 contract`
      );
    }
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function stringList(values, name, { allowEmpty = true, allowed = null } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new DecisionRobustnessError(
      'INVALID_DECISION_ROBUSTNESS_INPUT',
      `${name} must be ${allowEmpty ? 'an' : 'a non-empty'} array`
    );
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new DecisionRobustnessError('DUPLICATE_DECISION_ROBUSTNESS_VALUE', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) {
        throw new DecisionRobustnessError(
          'INVALID_DECISION_ROBUSTNESS_ENUM',
          `${name} contains unsupported value ${value}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function sameJson(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_HASH', `${name} must be sha256:<64 lowercase hex>`);
  }
  return normalized;
}

export function normalizePolicyActionOutput(value) {
  exactObject(value, 'PolicyActionOutput', ACTION_OUTPUT_KEYS);
  if (value.contractVersion !== POLICY_ACTION_OUTPUT_CONTRACT_VERSION) {
    throw new DecisionRobustnessError(
      'UNSUPPORTED_POLICY_ACTION_OUTPUT_CONTRACT',
      `unsupported PolicyActionOutput contractVersion ${value.contractVersion}`
    );
  }
  if (!Array.isArray(value.parameters)) {
    throw new DecisionRobustnessError('INVALID_POLICY_ACTION_OUTPUT', 'PolicyActionOutput.parameters must be an array');
  }
  const parameters = value.parameters.map((parameter, index) => {
    exactObject(parameter, `parameters[${index}]`, ACTION_PARAMETER_KEYS);
    return deepFreeze({
      name: text(parameter.name, `parameters[${index}].name`),
      value: cloneCanonicalValue(parameter.value)
    });
  });
  const names = parameters.map((item) => item.name);
  if (new Set(names).size !== names.length) {
    throw new DecisionRobustnessError('DUPLICATE_POLICY_ACTION_PARAMETER', 'PolicyActionOutput cannot repeat parameter name');
  }
  return deepFreeze({
    contractVersion: POLICY_ACTION_OUTPUT_CONTRACT_VERSION,
    actionCode: text(value.actionCode, 'actionCode'),
    parameters: deepFreeze([...parameters].sort((a, b) => a.name.localeCompare(b.name)))
  });
}

function signatureCore(value) {
  return {
    contractVersion: MATERIAL_ACTION_SIGNATURE_CONTRACT_VERSION,
    policyRef: value.policyRef,
    equivalenceMode: value.equivalenceMode,
    actionCode: value.actionCode,
    materialParameters: value.materialParameters
  };
}

function normalizeSignatureParameter(value, index) {
  exactObject(value, `materialParameters[${index}]`, SIGNATURE_PARAMETER_KEYS);
  const valueType = text(value.valueType, `materialParameters[${index}].valueType`);
  let normalizedValue;
  try {
    normalizedValue = normalizeRuntimeValue(value.value, `materialParameters[${index}].value`);
  } catch (error) {
    throw new DecisionRobustnessError(
      'INVALID_MATERIAL_ACTION_VALUE',
      `material action value is invalid: ${error?.code ?? error?.message ?? 'invalid'}`
    );
  }
  if (normalizedValue.type !== valueType) {
    throw new DecisionRobustnessError(
      'MATERIAL_ACTION_VALUE_TYPE_MISMATCH',
      `material parameter value type ${normalizedValue.type} does not equal declared ${valueType}`
    );
  }
  return deepFreeze({
    name: text(value.name, `materialParameters[${index}].name`),
    semanticId: text(value.semanticId, `materialParameters[${index}].semanticId`),
    valueType,
    unit: text(value.unit, `materialParameters[${index}].unit`),
    value: normalizedValue
  });
}

export function normalizeMaterialActionSignature(value) {
  exactObject(value, 'MaterialActionSignature', SIGNATURE_KEYS);
  if (value.contractVersion !== MATERIAL_ACTION_SIGNATURE_CONTRACT_VERSION) {
    throw new DecisionRobustnessError(
      'UNSUPPORTED_MATERIAL_ACTION_SIGNATURE_CONTRACT',
      `unsupported MaterialActionSignature contractVersion ${value.contractVersion}`
    );
  }
  const policyRef = exactRef(value.policyRef, 'Policy', 'policyRef');
  const equivalenceMode = text(value.equivalenceMode, 'equivalenceMode');
  if (equivalenceMode !== 'EXACT_MATERIAL_PARAMETERS') {
    throw new DecisionRobustnessError(
      'INVALID_MATERIAL_ACTION_EQUIVALENCE_MODE',
      'MaterialActionSignature requires exact Policy material-parameter equivalence'
    );
  }
  if (!Array.isArray(value.materialParameters)) {
    throw new DecisionRobustnessError('INVALID_MATERIAL_ACTION_SIGNATURE', 'materialParameters must be an array');
  }
  const materialParameters = value.materialParameters.map(normalizeSignatureParameter);
  const names = materialParameters.map((item) => item.name);
  const semanticIds = materialParameters.map((item) => item.semanticId);
  if (new Set(names).size !== names.length || new Set(semanticIds).size !== semanticIds.length) {
    throw new DecisionRobustnessError(
      'DUPLICATE_MATERIAL_ACTION_PARAMETER',
      'MaterialActionSignature cannot repeat material parameter name or semanticId'
    );
  }
  const normalized = {
    contractVersion: MATERIAL_ACTION_SIGNATURE_CONTRACT_VERSION,
    policyRef,
    equivalenceMode,
    actionCode: text(value.actionCode, 'actionCode'),
    materialParameters: deepFreeze([...materialParameters].sort((a, b) => a.name.localeCompare(b.name)))
  };
  const expectedHash = semanticHash('MaterialActionSignature', signatureCore(normalized));
  if (hash(value.signatureHash, 'signatureHash') !== expectedHash) {
    throw new DecisionRobustnessError(
      'MATERIAL_ACTION_SIGNATURE_HASH_MISMATCH',
      'signatureHash must reproduce exact governed action/material-parameter semantics'
    );
  }
  return deepFreeze({ ...normalized, signatureHash: expectedHash });
}

export function deriveMaterialActionSignature({ policyRef, policyPayload, rawOutput }) {
  const exactPolicyRef = exactRef(policyRef, 'Policy', 'policyRef');
  if (!policyPayload || policyPayload.contractVersion !== 'adr.policy.v2'
    || policyPayload.actionSemantics?.equivalenceMode !== 'EXACT_MATERIAL_PARAMETERS') {
    throw new DecisionRobustnessError(
      'POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED',
      'MaterialActionSignature requires exact adr.policy.v2 actionSemantics authority'
    );
  }
  const output = normalizePolicyActionOutput(rawOutput);
  const action = policyPayload.actionSemantics.actions.find((item) => item.actionCode === output.actionCode);
  if (!action || !policyPayload.actionSpace.includes(output.actionCode)) {
    throw new DecisionRobustnessError(
      'POLICY_ACTION_OUTPUT_ACTION_UNKNOWN',
      `action ${output.actionCode} is outside exact Policy action semantics`
    );
  }
  const provided = new Map(output.parameters.map((item) => [item.name, item]));
  const allowed = new Set(action.parameters.map((item) => item.name));
  for (const name of provided.keys()) {
    if (!allowed.has(name)) {
      throw new DecisionRobustnessError(
        'POLICY_ACTION_OUTPUT_PARAMETER_UNKNOWN',
        `executor supplied undeclared Policy action parameter ${name}`
      );
    }
  }
  const materialParameters = [];
  for (const parameter of action.parameters) {
    const evidence = provided.get(parameter.name);
    if (parameter.required && !evidence) {
      throw new DecisionRobustnessError(
        'POLICY_ACTION_OUTPUT_REQUIRED_PARAMETER_MISSING',
        `required Policy action parameter ${parameter.name} is absent`
      );
    }
    if (!evidence) continue;
    let normalizedValue;
    try {
      normalizedValue = normalizeRuntimeValue(evidence.value, `PolicyActionOutput.${parameter.name}`);
    } catch (error) {
      throw new DecisionRobustnessError(
        'POLICY_ACTION_OUTPUT_VALUE_INVALID',
        `parameter ${parameter.name} has invalid typed value: ${error?.code ?? error?.message ?? 'invalid'}`
      );
    }
    if (normalizedValue.type !== parameter.valueType) {
      throw new DecisionRobustnessError(
        'POLICY_ACTION_OUTPUT_VALUE_TYPE_MISMATCH',
        `parameter ${parameter.name} value type ${normalizedValue.type} does not equal Policy ${parameter.valueType}`
      );
    }
    if (parameter.material) {
      materialParameters.push(deepFreeze({
        name: parameter.name,
        semanticId: parameter.semanticId,
        valueType: parameter.valueType,
        unit: parameter.unit,
        value: normalizedValue
      }));
    }
  }
  const core = {
    contractVersion: MATERIAL_ACTION_SIGNATURE_CONTRACT_VERSION,
    policyRef: exactPolicyRef,
    equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
    actionCode: output.actionCode,
    materialParameters: deepFreeze([...materialParameters].sort((a, b) => a.name.localeCompare(b.name)))
  };
  return normalizeMaterialActionSignature({
    ...core,
    signatureHash: semanticHash('MaterialActionSignature', core)
  });
}

function normalizeComparisonMethod(value) {
  exactObject(value, 'comparisonMethod', COMPARISON_KEYS);
  const normalized = {
    methodId: text(value.methodId, 'comparisonMethod.methodId'),
    methodVersion: text(value.methodVersion, 'comparisonMethod.methodVersion'),
    comparisonMode: text(value.comparisonMode, 'comparisonMethod.comparisonMode'),
    coverageRequirementSource: text(value.coverageRequirementSource, 'comparisonMethod.coverageRequirementSource')
  };
  if (normalized.methodId !== 'ADR_MATERIAL_ACTION_ROBUSTNESS'
    || normalized.methodVersion !== '1'
    || normalized.comparisonMode !== 'EXACT_MATERIAL_ACTION_SIGNATURE'
    || normalized.coverageRequirementSource !== 'RUNTIME_PROFILE') {
    throw new DecisionRobustnessError(
      'UNGOVERNED_DECISION_ROBUSTNESS_METHOD',
      'D05 v1 comparison method is fixed and cannot be replaced by confidence/probability heuristics'
    );
  }
  return deepFreeze(normalized);
}

function normalizeCoverageAssessment(value) {
  exactObject(value, 'coverageAssessment', COVERAGE_KEYS);
  if (typeof value.sufficient !== 'boolean') {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', 'coverageAssessment.sufficient must be boolean');
  }
  return deepFreeze({
    completenessClass: text(value.completenessClass, 'coverageAssessment.completenessClass'),
    sufficientCompletenessClasses: stringList(
      value.sufficientCompletenessClasses,
      'coverageAssessment.sufficientCompletenessClasses'
    ),
    sufficient: value.sufficient
  });
}

function normalizeActionEvaluation(value, index) {
  exactObject(value, `actionEvaluations[${index}]`, ACTION_EVALUATION_KEYS);
  const status = text(value.status, `actionEvaluations[${index}].status`);
  if (!ACTION_STATUSES.has(status)) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_ENUM', `unsupported action status ${status}`);
  }
  const policyRef = value.policyRef === null ? null : exactRef(value.policyRef, 'Policy', `actionEvaluations[${index}].policyRef`);
  let executionEnvelope = null;
  let executionEvidenceHash = null;
  if (value.executionEnvelope !== null) {
    try {
      executionEnvelope = normalizeRuntimeExecutionEnvelope(value.executionEnvelope);
    } catch (error) {
      throw new DecisionRobustnessError(
        'INVALID_POLICY_EXECUTION_EVIDENCE',
        `action evaluation execution evidence is invalid: ${error?.code ?? error?.message ?? 'invalid'}`
      );
    }
    executionEvidenceHash = semanticHash('RuntimeExecutionEvidence', executionEnvelope);
    if (hash(value.executionEvidenceHash, `actionEvaluations[${index}].executionEvidenceHash`) !== executionEvidenceHash) {
      throw new DecisionRobustnessError(
        'POLICY_EXECUTION_EVIDENCE_HASH_MISMATCH',
        'executionEvidenceHash must reproduce exact normalized D02 execution envelope'
      );
    }
  } else if (value.executionEvidenceHash !== null) {
    throw new DecisionRobustnessError(
      'POLICY_EXECUTION_EVIDENCE_HASH_WITHOUT_EVIDENCE',
      'execution evidence hash cannot exist without retained execution envelope'
    );
  }
  const materialActionSignature = value.materialActionSignature === null
    ? null
    : normalizeMaterialActionSignature(value.materialActionSignature);
  const reasonCodes = stringList(
    value.reasonCodes,
    `actionEvaluations[${index}].reasonCodes`,
    { allowed: UNRESOLVED_REASONS }
  );
  if (status === 'ACTION_AVAILABLE') {
    if (!policyRef || !executionEnvelope || executionEnvelope.status !== 'SUCCEEDED'
      || !materialActionSignature || reasonCodes.length !== 0) {
      throw new DecisionRobustnessError(
        'INVALID_ACTION_AVAILABLE_EVALUATION',
        'ACTION_AVAILABLE requires Policy, succeeded execution evidence, MaterialActionSignature and no unresolved reasons'
      );
    }
    if (!sameJson(materialActionSignature.policyRef, policyRef)) {
      throw new DecisionRobustnessError(
        'ACTION_SIGNATURE_POLICY_MISMATCH',
        'MaterialActionSignature policyRef must equal action evaluation Policy'
      );
    }
  } else if (materialActionSignature !== null || reasonCodes.length === 0) {
    throw new DecisionRobustnessError(
      'INVALID_UNRESOLVED_ACTION_EVALUATION',
      'UNRESOLVED action evaluation requires no signature and at least one governed reason'
    );
  }
  return deepFreeze({
    pathId: text(value.pathId, `actionEvaluations[${index}].pathId`),
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', `actionEvaluations[${index}].runtimeBindingRef`),
    policyRef,
    executionEnvelope,
    executionEvidenceHash,
    status,
    materialActionSignature,
    reasonCodes
  });
}

function normalizeSignatureGroup(value, index) {
  exactObject(value, `signatureGroups[${index}]`, SIGNATURE_GROUP_KEYS);
  return deepFreeze({
    signatureHash: hash(value.signatureHash, `signatureGroups[${index}].signatureHash`),
    pathIds: stringList(value.pathIds, `signatureGroups[${index}].pathIds`, { allowEmpty: false })
  });
}

function normalizeDiagnostic(value, index) {
  exactObject(value, `actionChangingDiagnostics[${index}]`, DIAGNOSTIC_KEYS);
  const diagnosticClass = text(value.diagnosticClass, `actionChangingDiagnostics[${index}].diagnosticClass`);
  if (!DIAGNOSTIC_CLASSES.has(diagnosticClass)) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_ENUM', `unsupported diagnostic class ${diagnosticClass}`);
  }
  return deepFreeze({
    dimensionId: text(value.dimensionId, `actionChangingDiagnostics[${index}].dimensionId`),
    dimensionType: text(value.dimensionType, `actionChangingDiagnostics[${index}].dimensionType`),
    pathIds: stringList(value.pathIds, `actionChangingDiagnostics[${index}].pathIds`, { allowEmpty: false }),
    signatureHashes: stringList(value.signatureHashes, `actionChangingDiagnostics[${index}].signatureHashes`),
    diagnosticClass
  });
}

function validateGroupRelations(actionEvaluations, signatureGroups) {
  const available = actionEvaluations.filter((item) => item.status === 'ACTION_AVAILABLE');
  const expected = new Map();
  for (const evaluation of available) {
    const signatureHash = evaluation.materialActionSignature.signatureHash;
    const paths = expected.get(signatureHash) ?? [];
    paths.push(evaluation.pathId);
    expected.set(signatureHash, paths);
  }
  const expectedGroups = [...expected.entries()]
    .map(([signatureHash, pathIds]) => ({ signatureHash, pathIds: [...pathIds].sort() }))
    .sort((a, b) => a.signatureHash.localeCompare(b.signatureHash));
  const actualGroups = signatureGroups.map((item) => ({ signatureHash: item.signatureHash, pathIds: item.pathIds }));
  if (!sameJson(actualGroups, expectedGroups)) {
    throw new DecisionRobustnessError(
      'DECISION_ROBUSTNESS_SIGNATURE_GROUP_MISMATCH',
      'signatureGroups must exactly group available MaterialActionSignatures by exact semantic hash'
    );
  }
}

export function normalizeDecisionRobustness(value) {
  exactObject(value, 'DecisionRobustness', ROBUSTNESS_KEYS);
  if (value.contractVersion !== DECISION_ROBUSTNESS_CONTRACT_VERSION) {
    throw new DecisionRobustnessError(
      'UNSUPPORTED_DECISION_ROBUSTNESS_CONTRACT',
      `unsupported contractVersion ${value.contractVersion}`
    );
  }
  if (value.authorityClass !== DECISION_ROBUSTNESS_AUTHORITY_CLASS) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_AUTHORITY_CLASS', 'DecisionRobustness authority class mismatch');
  }
  const actionEvaluations = (() => {
    if (!Array.isArray(value.actionEvaluations)) {
      throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', 'actionEvaluations must be an array');
    }
    const normalized = value.actionEvaluations.map(normalizeActionEvaluation);
    const pathIds = normalized.map((item) => item.pathId);
    const bindingRefs = normalized.map((item) => canonicalizeSemanticJson(item.runtimeBindingRef));
    if (new Set(pathIds).size !== pathIds.length || new Set(bindingRefs).size !== bindingRefs.length) {
      throw new DecisionRobustnessError(
        'DUPLICATE_DECISION_ROBUSTNESS_ACTION_EVALUATION',
        'one action evaluation per path and exact RuntimeBinding is allowed'
      );
    }
    return deepFreeze([...normalized].sort((a, b) => a.pathId.localeCompare(b.pathId)));
  })();
  const signatureGroups = (() => {
    if (!Array.isArray(value.signatureGroups)) {
      throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', 'signatureGroups must be an array');
    }
    const groups = value.signatureGroups.map(normalizeSignatureGroup)
      .sort((a, b) => a.signatureHash.localeCompare(b.signatureHash));
    const hashes = groups.map((item) => item.signatureHash);
    if (new Set(hashes).size !== hashes.length) {
      throw new DecisionRobustnessError('DUPLICATE_DECISION_ROBUSTNESS_SIGNATURE_GROUP', 'signatureGroups cannot repeat signatureHash');
    }
    return deepFreeze(groups);
  })();
  validateGroupRelations(actionEvaluations, signatureGroups);
  const actionChangingDiagnostics = (() => {
    if (!Array.isArray(value.actionChangingDiagnostics)) {
      throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_INPUT', 'actionChangingDiagnostics must be an array');
    }
    const diagnostics = value.actionChangingDiagnostics.map(normalizeDiagnostic)
      .sort((a, b) => a.dimensionId.localeCompare(b.dimensionId));
    const ids = diagnostics.map((item) => item.dimensionId);
    if (new Set(ids).size !== ids.length) {
      throw new DecisionRobustnessError('DUPLICATE_DECISION_ROBUSTNESS_DIAGNOSTIC', 'one diagnostic per material dimension is allowed');
    }
    return deepFreeze(diagnostics);
  })();
  const robustnessClass = text(value.robustnessClass, 'robustnessClass');
  if (!ROBUSTNESS_CLASSES.has(robustnessClass)) {
    throw new DecisionRobustnessError('INVALID_DECISION_ROBUSTNESS_ENUM', `unsupported robustness class ${robustnessClass}`);
  }
  const unresolvedReasonCodes = stringList(
    value.unresolvedReasonCodes,
    'unresolvedReasonCodes',
    { allowed: UNRESOLVED_REASONS }
  );
  if (robustnessClass === 'UNRESOLVED' && unresolvedReasonCodes.length === 0) {
    throw new DecisionRobustnessError('DECISION_ROBUSTNESS_UNRESOLVED_REASON_REQUIRED', 'UNRESOLVED requires governed reason codes');
  }
  if (robustnessClass !== 'UNRESOLVED' && unresolvedReasonCodes.length !== 0) {
    throw new DecisionRobustnessError('DECISION_ROBUSTNESS_RESOLVED_WITH_UNRESOLVED_REASONS', 'resolved robustness cannot retain unresolved reason codes');
  }
  return deepFreeze({
    contractVersion: DECISION_ROBUSTNESS_CONTRACT_VERSION,
    authorityClass: DECISION_ROBUSTNESS_AUTHORITY_CLASS,
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    runtimeAlternativeSetRef: exactRef(value.runtimeAlternativeSetRef, 'RuntimeAlternativeSet', 'runtimeAlternativeSetRef'),
    runtimeProfileRef: exactRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef'),
    runtimePlanRef: cloneCanonicalValue(value.runtimePlanRef),
    comparisonMethod: normalizeComparisonMethod(value.comparisonMethod),
    coverageAssessment: normalizeCoverageAssessment(value.coverageAssessment),
    commonPolicyRef: value.commonPolicyRef === null ? null : exactRef(value.commonPolicyRef, 'Policy', 'commonPolicyRef'),
    actionEvaluations,
    signatureGroups,
    actionChangingDiagnostics,
    robustnessClass,
    unresolvedReasonCodes
  });
}

export function decisionRobustnessExactRefs(payload) {
  const normalized = normalizeDecisionRobustness(payload);
  const refs = [
    normalized.decisionProblemRef,
    normalized.runtimeAlternativeSetRef,
    normalized.runtimeProfileRef,
    ...normalized.actionEvaluations.map((item) => item.runtimeBindingRef),
    ...normalized.actionEvaluations.flatMap((item) => item.policyRef ? [item.policyRef] : [])
  ];
  const map = new Map(refs.map((ref) => [canonicalizeSemanticJson(ref), ref]));
  return deepFreeze([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}
