import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  normalizeExternalOutcomeRef,
  normalizeOutcomeTargetRef
} from '../../outcome/src/contract.mjs';

export const OUTCOME_EVALUATION_CONTRACT_VERSION = 'adr.outcome-evaluation.v1';
export const OUTCOME_EVALUATION_AUTHORITY_CLASS = 'POST_RUNTIME_DIMENSIONED_EVALUATION_AUTHORITY';
export const OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY = 'NONE_OUTCOME_EVALUATION_IS_NOT_CAUSAL_EFFECT_AUTHORITY';
export const OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY = 'NONE_OUTCOME_EVALUATION_CANNOT_MUTATE_CONTROL_AUTHORITY';
export const OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY = 'NONE_OUTCOME_EVALUATION_HAS_NO_AGGREGATE_SCORE_AUTHORITY';

export const OUTCOME_EVALUATION_DIMENSIONS = deepFreeze([
  'KNOWLEDGE',
  'TRANSPORT',
  'MODEL',
  'POLICY',
  'EXECUTION',
  'COMMERCIAL'
]);
export const OUTCOME_EVALUATION_DISPOSITIONS = deepFreeze([
  'SUPPORTS_CONCERN',
  'SUPPORTS_CONFORMANCE',
  'INCONCLUSIVE',
  'NOT_EVALUATED'
]);
export const OUTCOME_EVIDENCE_WEIGHT_CLASSES = deepFreeze([
  'NONE',
  'LIMITED',
  'MODERATE',
  'STRONG'
]);
export const OUTCOME_EVALUATION_INTERPRETATION_CLASSES = deepFreeze([
  'NONE',
  'DESCRIPTIVE',
  'ASSOCIATIONAL'
]);

const DIAGNOSTIC_RULES = deepFreeze({
  KNOWLEDGE: {
    KNOWLEDGE_EVIDENCE_CONSISTENT_WITH_EXPECTED_RESPONSE: 'SUPPORTS_CONFORMANCE',
    KNOWLEDGE_RESPONSE_INCONSISTENCY_EVIDENCE: 'SUPPORTS_CONCERN',
    KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE: 'INCONCLUSIVE',
    KNOWLEDGE_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    KNOWLEDGE_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  },
  TRANSPORT: {
    TRANSPORT_EVIDENCE_CONSISTENT_WITH_TARGET_TRANSFER: 'SUPPORTS_CONFORMANCE',
    TRANSPORT_TARGET_MISMATCH_EVIDENCE: 'SUPPORTS_CONCERN',
    TRANSPORT_EFFECT_MODIFIER_MISMATCH_EVIDENCE: 'SUPPORTS_CONCERN',
    TRANSPORT_EVIDENCE_INSUFFICIENT: 'INCONCLUSIVE',
    TRANSPORT_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    TRANSPORT_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  },
  MODEL: {
    MODEL_PREDICTION_CONSISTENCY_EVIDENCE: 'SUPPORTS_CONFORMANCE',
    MODEL_PREDICTION_ERROR_EVIDENCE: 'SUPPORTS_CONCERN',
    MODEL_CALIBRATION_MISMATCH_EVIDENCE: 'SUPPORTS_CONCERN',
    MODEL_EVIDENCE_INSUFFICIENT: 'INCONCLUSIVE',
    MODEL_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    MODEL_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  },
  POLICY: {
    POLICY_ACTION_CONSISTENCY_EVIDENCE: 'SUPPORTS_CONFORMANCE',
    POLICY_ACTION_MISMATCH_EVIDENCE: 'SUPPORTS_CONCERN',
    POLICY_CONSTRAINT_MISMATCH_EVIDENCE: 'SUPPORTS_CONCERN',
    POLICY_EVIDENCE_INSUFFICIENT: 'INCONCLUSIVE',
    POLICY_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    POLICY_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  },
  EXECUTION: {
    EXECUTION_CONSISTENCY_EVIDENCE: 'SUPPORTS_CONFORMANCE',
    EXECUTION_DEVIATION_EVIDENCE: 'SUPPORTS_CONCERN',
    EXECUTION_NOT_OBSERVED: 'INCONCLUSIVE',
    EXECUTION_EVIDENCE_INSUFFICIENT: 'INCONCLUSIVE',
    EXECUTION_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    EXECUTION_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  },
  COMMERCIAL: {
    COMMERCIAL_TARGET_SUPPORT_EVIDENCE: 'SUPPORTS_CONFORMANCE',
    COMMERCIAL_SHORTFALL_EVIDENCE: 'SUPPORTS_CONCERN',
    COMMERCIAL_EVIDENCE_INSUFFICIENT: 'INCONCLUSIVE',
    COMMERCIAL_EVIDENCE_CONFLICTING: 'INCONCLUSIVE',
    COMMERCIAL_EVIDENCE_NOT_EVALUATED: 'NOT_EVALUATED'
  }
});

export const OUTCOME_EVALUATION_DIAGNOSTIC_CODES = deepFreeze(
  Object.fromEntries(Object.entries(DIAGNOSTIC_RULES).map(([dimension, rules]) => [dimension, Object.keys(rules).sort()]))
);

const METHOD_SPEC = deepFreeze({
  methodId: 'ADR_DIMENSIONED_OUTCOME_EVALUATOR',
  version: '1',
  dimensions: OUTCOME_EVALUATION_DIMENSIONS,
  dispositions: OUTCOME_EVALUATION_DISPOSITIONS,
  evidenceWeightClasses: OUTCOME_EVIDENCE_WEIGHT_CLASSES,
  interpretationClasses: OUTCOME_EVALUATION_INTERPRETATION_CLASSES,
  diagnosticCodes: OUTCOME_EVALUATION_DIAGNOSTIC_CODES,
  causalClaimClass: 'DESCRIPTIVE_OR_ASSOCIATIONAL_ONLY',
  aggregateScoring: 'PROHIBITED',
  directControlMutation: 'PROHIBITED'
});
export const OUTCOME_EVALUATION_METHOD_REF = deepFreeze({
  methodId: METHOD_SPEC.methodId,
  version: METHOD_SPEC.version,
  semanticHash: semanticHash('OutcomeEvaluationMethod', METHOD_SPEC)
});

const DIMENSION_SET = new Set(OUTCOME_EVALUATION_DIMENSIONS);
const DISPOSITION_SET = new Set(OUTCOME_EVALUATION_DISPOSITIONS);
const WEIGHT_SET = new Set(OUTCOME_EVIDENCE_WEIGHT_CLASSES);
const INTERPRETATION_SET = new Set(OUTCOME_EVALUATION_INTERPRETATION_CLASSES);
const EVALUATOR_KEYS = new Set(['principalId', 'type', 'organizationId', 'tenantId']);
const METHOD_KEYS = new Set(['methodId', 'version', 'semanticHash']);
const FINDING_KEYS = new Set([
  'dimension', 'disposition', 'evidenceWeightClass', 'interpretationClass',
  'diagnosticCodes', 'evidenceOutcomeRefs', 'limitationCodes'
]);
const PAYLOAD_KEYS = new Set([
  'contractVersion', 'authorityClass', 'evaluationId', 'methodRef', 'evaluator',
  'targetRef', 'associationMode', 'decisionProblemRef', 'externalDecisionRef',
  'outcomeRefs', 'decisionResultRefs', 'runtimeBindingRefs', 'findings',
  'causalEffectAuthority', 'controlMutationAuthority', 'aggregateScoreAuthority'
]);
const ASSOCIATION_MODES = new Set(['ADR_BOUND', 'EXTERNAL_BOUND']);
const CODE_RE = /^[A-Z][A-Z0-9_]{2,}$/;

export class OutcomeEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OutcomeEvaluationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

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
      throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_FIELD', `${name}.${key} is outside the frozen E02 contract`);
    }
  }
}

function exactRef(value, kind, name) {
  if (value === null) return null;
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function canonicalRefs(values, kind, name, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new OutcomeEvaluationError(
      'INVALID_OUTCOME_EVALUATION_REFS',
      `${name} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`
    );
  }
  const refs = values.map((value, index) => exactRef(value, kind, `${name}[${index}]`));
  const keyed = refs.map((ref) => [canonicalizeSemanticJson(ref), ref]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new OutcomeEvaluationError('DUPLICATE_OUTCOME_EVALUATION_REF', `${name} cannot contain duplicates`);
  }
  return deepFreeze(keyed.sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

function evaluatorIdentity(value) {
  exactObject(value, 'evaluator', EVALUATOR_KEYS);
  const type = text(value.type, 'evaluator.type');
  if (!['USER', 'SERVICE_ACCOUNT'].includes(type)) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATOR_TYPE', `unsupported evaluator type ${type}`);
  }
  return deepFreeze({
    principalId: text(value.principalId, 'evaluator.principalId'),
    type,
    organizationId: text(value.organizationId, 'evaluator.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'evaluator.tenantId') } : {})
  });
}

function normalizeMethodRef(value) {
  exactObject(value, 'methodRef', METHOD_KEYS);
  const normalized = {
    methodId: text(value.methodId, 'methodRef.methodId'),
    version: text(value.version, 'methodRef.version'),
    semanticHash: text(value.semanticHash, 'methodRef.semanticHash')
  };
  if (canonicalizeSemanticJson(normalized) !== canonicalizeSemanticJson(OUTCOME_EVALUATION_METHOD_REF)) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_METHOD_MISMATCH', 'OutcomeEvaluation must bind the frozen E02 evaluation method');
  }
  return OUTCOME_EVALUATION_METHOD_REF;
}

function canonicalCodes(values, name) {
  if (!Array.isArray(values)) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_CODES', `${name} must be an array`);
  }
  const codes = values.map((value, index) => text(value, `${name}[${index}]`));
  for (const code of codes) {
    if (!CODE_RE.test(code)) {
      throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_CODE', `${name} contains invalid code ${code}`);
    }
  }
  if (new Set(codes).size !== codes.length) {
    throw new OutcomeEvaluationError('DUPLICATE_OUTCOME_EVALUATION_CODE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...codes].sort());
}

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function normalizeFinding(value, index, outcomeRefKeys) {
  exactObject(value, `findings[${index}]`, FINDING_KEYS);
  const dimension = text(value.dimension, `findings[${index}].dimension`);
  const disposition = text(value.disposition, `findings[${index}].disposition`);
  const evidenceWeightClass = text(value.evidenceWeightClass, `findings[${index}].evidenceWeightClass`);
  const interpretationClass = text(value.interpretationClass, `findings[${index}].interpretationClass`);
  if (!DIMENSION_SET.has(dimension)) throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_DIMENSION', `unsupported dimension ${dimension}`);
  if (!DISPOSITION_SET.has(disposition)) throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_DISPOSITION', `unsupported disposition ${disposition}`);
  if (!WEIGHT_SET.has(evidenceWeightClass)) throw new OutcomeEvaluationError('INVALID_OUTCOME_EVIDENCE_WEIGHT', `unsupported evidence weight ${evidenceWeightClass}`);
  if (!INTERPRETATION_SET.has(interpretationClass)) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_INTERPRETATION_CLASS', `unsupported interpretation class ${interpretationClass}`);
  }

  const diagnosticCodes = canonicalCodes(value.diagnosticCodes, `findings[${index}].diagnosticCodes`);
  if (diagnosticCodes.length === 0) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_DIAGNOSTIC_REQUIRED', `${dimension} requires at least one diagnostic code`);
  }
  const rules = DIAGNOSTIC_RULES[dimension];
  for (const code of diagnosticCodes) {
    if (!(code in rules)) {
      throw new OutcomeEvaluationError(
        'OUTCOME_EVALUATION_DIAGNOSTIC_DIMENSION_MISMATCH',
        `${code} is not governed ${dimension} evidence`
      );
    }
    if (rules[code] !== disposition) {
      throw new OutcomeEvaluationError(
        'OUTCOME_EVALUATION_DIAGNOSTIC_DISPOSITION_MISMATCH',
        `${code} requires disposition ${rules[code]}, not ${disposition}`
      );
    }
  }

  const evidenceOutcomeRefs = canonicalRefs(
    value.evidenceOutcomeRefs,
    'Outcome',
    `findings[${index}].evidenceOutcomeRefs`,
    { allowEmpty: true }
  );
  for (const ref of evidenceOutcomeRefs) {
    if (!outcomeRefKeys.has(refKey(ref))) {
      throw new OutcomeEvaluationError(
        'OUTCOME_EVALUATION_FOREIGN_EVIDENCE',
        `${dimension} finding cites Outcome outside the frozen evaluation evidence set`
      );
    }
  }
  const limitationCodes = canonicalCodes(value.limitationCodes ?? [], `findings[${index}].limitationCodes`);

  if (disposition === 'NOT_EVALUATED') {
    if (evidenceWeightClass !== 'NONE' || interpretationClass !== 'NONE' || evidenceOutcomeRefs.length !== 0) {
      throw new OutcomeEvaluationError(
        'OUTCOME_EVALUATION_NOT_EVALUATED_SEMANTICS_INVALID',
        'NOT_EVALUATED requires NONE weight/interpretation and no evidence refs'
      );
    }
  } else {
    if (evidenceOutcomeRefs.length === 0) {
      throw new OutcomeEvaluationError('OUTCOME_EVALUATION_EVIDENCE_REQUIRED', `${dimension} evaluated finding requires exact Outcome evidence`);
    }
    if (interpretationClass === 'NONE') {
      throw new OutcomeEvaluationError('OUTCOME_EVALUATION_INTERPRETATION_REQUIRED', `${dimension} evaluated finding requires DESCRIPTIVE or ASSOCIATIONAL interpretation`);
    }
    if (['SUPPORTS_CONCERN', 'SUPPORTS_CONFORMANCE'].includes(disposition) && evidenceWeightClass === 'NONE') {
      throw new OutcomeEvaluationError('OUTCOME_EVALUATION_WEIGHT_REQUIRED', `${dimension} directional finding cannot use NONE evidence weight`);
    }
  }

  return deepFreeze({
    dimension,
    disposition,
    evidenceWeightClass,
    interpretationClass,
    diagnosticCodes,
    evidenceOutcomeRefs,
    limitationCodes
  });
}

function normalizeFindings(values, outcomeRefs) {
  if (!Array.isArray(values) || values.length !== OUTCOME_EVALUATION_DIMENSIONS.length) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_ALL_DIMENSIONS_REQUIRED',
      'OutcomeEvaluation must contain exactly one finding for every frozen evaluation dimension'
    );
  }
  const outcomeRefKeys = new Set(outcomeRefs.map(refKey));
  const findings = values.map((value, index) => normalizeFinding(value, index, outcomeRefKeys));
  const dimensions = findings.map((finding) => finding.dimension);
  if (new Set(dimensions).size !== OUTCOME_EVALUATION_DIMENSIONS.length
    || !OUTCOME_EVALUATION_DIMENSIONS.every((dimension) => dimensions.includes(dimension))) {
    throw new OutcomeEvaluationError(
      'OUTCOME_EVALUATION_DIMENSION_SET_MISMATCH',
      'OutcomeEvaluation dimensions must exactly equal the frozen six-dimensional evaluation set'
    );
  }
  const byDimension = new Map(findings.map((finding) => [finding.dimension, finding]));
  return deepFreeze(OUTCOME_EVALUATION_DIMENSIONS.map((dimension) => byDimension.get(dimension)));
}

function evaluationIdentityCore(value) {
  return {
    methodRef: value.methodRef,
    evaluator: value.evaluator,
    targetRef: value.targetRef,
    associationMode: value.associationMode,
    decisionProblemRef: value.decisionProblemRef,
    externalDecisionRef: value.externalDecisionRef,
    outcomeRefs: value.outcomeRefs
  };
}

export function outcomeEvaluationIdentity(value) {
  const core = evaluationIdentityCore(value);
  const hash = semanticHash('OutcomeEvaluationIdentity', core);
  return `outcome-evaluation:${hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;
}

export function normalizeOutcomeEvaluation(value) {
  exactObject(value, 'OutcomeEvaluation', PAYLOAD_KEYS);
  if (value.contractVersion !== OUTCOME_EVALUATION_CONTRACT_VERSION
    || value.authorityClass !== OUTCOME_EVALUATION_AUTHORITY_CLASS) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_CONTRACT', 'OutcomeEvaluation contractVersion/authorityClass mismatch');
  }
  if (value.causalEffectAuthority !== OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_CAUSAL_LAUNDERING', 'OutcomeEvaluation cannot claim causal-effect authority');
  }
  if (value.controlMutationAuthority !== OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_CONTROL_LAUNDERING', 'OutcomeEvaluation cannot mutate control authority');
  }
  if (value.aggregateScoreAuthority !== OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_SCORE_LAUNDERING', 'OutcomeEvaluation cannot collapse dimensions into aggregate score authority');
  }

  const methodRef = normalizeMethodRef(value.methodRef);
  const evaluator = evaluatorIdentity(value.evaluator);
  const targetRef = normalizeOutcomeTargetRef(value.targetRef);
  const associationMode = text(value.associationMode, 'associationMode');
  if (!ASSOCIATION_MODES.has(associationMode)) {
    throw new OutcomeEvaluationError('INVALID_OUTCOME_EVALUATION_ASSOCIATION_MODE', `unsupported association mode ${associationMode}`);
  }
  const decisionProblemRef = exactRef(value.decisionProblemRef ?? null, 'DecisionProblem', 'decisionProblemRef');
  const externalDecisionRef = normalizeExternalOutcomeRef(value.externalDecisionRef ?? null, 'externalDecisionRef');
  if (associationMode === 'ADR_BOUND' && (!decisionProblemRef || externalDecisionRef)) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_ASSOCIATION_LAUNDERING', 'ADR_BOUND evaluation requires DecisionProblem and forbids externalDecisionRef');
  }
  if (associationMode === 'EXTERNAL_BOUND' && (decisionProblemRef || !externalDecisionRef)) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_ASSOCIATION_LAUNDERING', 'EXTERNAL_BOUND evaluation requires externalDecisionRef and forbids DecisionProblem');
  }

  const outcomeRefs = canonicalRefs(value.outcomeRefs, 'Outcome', 'outcomeRefs');
  const decisionResultRefs = canonicalRefs(value.decisionResultRefs ?? [], 'DecisionResult', 'decisionResultRefs', { allowEmpty: true });
  const runtimeBindingRefs = canonicalRefs(value.runtimeBindingRefs ?? [], 'RuntimeBinding', 'runtimeBindingRefs', { allowEmpty: true });
  const findings = normalizeFindings(value.findings, outcomeRefs);
  const normalized = {
    contractVersion: OUTCOME_EVALUATION_CONTRACT_VERSION,
    authorityClass: OUTCOME_EVALUATION_AUTHORITY_CLASS,
    evaluationId: text(value.evaluationId, 'evaluationId'),
    methodRef,
    evaluator,
    targetRef,
    associationMode,
    decisionProblemRef,
    externalDecisionRef,
    outcomeRefs,
    decisionResultRefs,
    runtimeBindingRefs,
    findings,
    causalEffectAuthority: OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
    controlMutationAuthority: OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
    aggregateScoreAuthority: OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY
  };
  const expectedId = outcomeEvaluationIdentity(normalized);
  if (normalized.evaluationId !== expectedId) {
    throw new OutcomeEvaluationError('OUTCOME_EVALUATION_IDENTITY_MISMATCH', 'evaluationId must be deterministic for exact method/evaluator/evidence cohort');
  }
  return deepFreeze(normalized);
}

export function createOutcomeEvaluationPayload({
  evaluator,
  targetRef,
  associationMode,
  decisionProblemRef,
  externalDecisionRef,
  outcomeRefs,
  decisionResultRefs,
  runtimeBindingRefs,
  findings
}) {
  const draft = {
    contractVersion: OUTCOME_EVALUATION_CONTRACT_VERSION,
    authorityClass: OUTCOME_EVALUATION_AUTHORITY_CLASS,
    evaluationId: 'pending',
    methodRef: OUTCOME_EVALUATION_METHOD_REF,
    evaluator: evaluatorIdentity(evaluator),
    targetRef: normalizeOutcomeTargetRef(targetRef),
    associationMode,
    decisionProblemRef: decisionProblemRef ?? null,
    externalDecisionRef: externalDecisionRef ?? null,
    outcomeRefs,
    decisionResultRefs,
    runtimeBindingRefs,
    findings,
    causalEffectAuthority: OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
    controlMutationAuthority: OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
    aggregateScoreAuthority: OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY
  };
  draft.evaluationId = outcomeEvaluationIdentity({
    methodRef: OUTCOME_EVALUATION_METHOD_REF,
    evaluator: draft.evaluator,
    targetRef: draft.targetRef,
    associationMode,
    decisionProblemRef: decisionProblemRef ?? null,
    externalDecisionRef: externalDecisionRef ?? null,
    outcomeRefs: canonicalRefs(outcomeRefs, 'Outcome', 'outcomeRefs')
  });
  return normalizeOutcomeEvaluation(draft);
}
