import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const APPLICABILITY_ASSESSMENT_CONTRACT_VERSION = 'adr.applicability-assessment.v1';
export const APPLICABILITY_AUTHORITY_CLASS = 'SOURCE_TARGET_TRANSPORT_AUTHORITY';
export const TRANSPORT_STATUSES = deepFreeze([
  'DIRECTLY_APPLICABLE',
  'APPLICABLE_WITH_GOVERNED_TRANSFORM',
  'CALIBRATION_REQUIRED',
  'BOUNDED_EXTRAPOLATION',
  'UNRESOLVED',
  'CONFLICT',
  'NOT_RELEVANT'
]);
export const CONDITION_STATUSES = deepFreeze(['MATCH', 'MISMATCH', 'UNKNOWN', 'AMBIGUOUS', 'TRANSFORMABLE', 'INVALID']);
export const SCIENTIFIC_USE_STATUSES = deepFreeze(['QUALIFIED', 'PROHIBITED', 'REVOKED', 'UNQUALIFIED']);
export const DECISION_RELEVANCE_STATUSES = deepFreeze(['MATERIAL', 'NOT_RELEVANT']);
export const RUNTIME_USE_DISPOSITIONS = deepFreeze(['ALLOWED', 'CONDITIONAL', 'BLOCKED']);

const TRANSPORT_SET = new Set(TRANSPORT_STATUSES);
const CONDITION_SET = new Set(CONDITION_STATUSES);
const SCIENTIFIC_USE_SET = new Set(SCIENTIFIC_USE_STATUSES);
const RELEVANCE_SET = new Set(DECISION_RELEVANCE_STATUSES);
const RUNTIME_USE_SET = new Set(RUNTIME_USE_DISPOSITIONS);
const RESULT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'knowledgeRetrievalResultRef', 'knowledgeRef',
  'knowledgeOriginContextRefs', 'contextManifestRef', 'decisionProblemRef', 'usePurpose',
  'conditionResults', 'transportStatus', 'scientificUseStatus', 'decisionRelevance',
  'runtimeUse', 'requiredTransformationRefs', 'requiredCalibrationCodes', 'limitations',
  'conflicts', 'missingContextSemanticIds', 'unsupportedConstraintCodes'
]);
const CONDITION_KEYS = new Set([
  'source', 'semanticId', 'operator', 'expected', 'target', 'unit', 'status', 'disposition'
]);

export class ApplicabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApplicabilityError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new ApplicabilityError('INVALID_APPLICABILITY_FIELD', `${name}.${key} is not part of the frozen A08 contract`);
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (kind && ref.kind !== kind) throw new ApplicabilityError('INVALID_APPLICABILITY_REF', `${name} must be an exact ${kind} ref`);
  return ref;
}

function refKey(ref) {
  const r = assertAuthorityRef(ref);
  return JSON.stringify([r.kind, r.logicalId, r.version, r.semanticHash]);
}

function canonicalRefs(values, name, allowedKinds) {
  if (!Array.isArray(values) || values.length === 0) throw new ApplicabilityError('INVALID_APPLICABILITY_REFS', `${name} must be a non-empty array`);
  const refs = values.map((value, index) => {
    const ref = assertAuthorityRef(value);
    if (!allowedKinds.includes(ref.kind)) throw new ApplicabilityError('INVALID_APPLICABILITY_REF', `${name}[${index}] has unsupported kind ${ref.kind}`);
    return ref;
  });
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) throw new ApplicabilityError('DUPLICATE_APPLICABILITY_REF', `${name} cannot contain duplicate exact refs`);
  const sorted = [...refs].sort((a, b) => refKey(a).localeCompare(refKey(b)));
  if (JSON.stringify(keys) !== JSON.stringify(sorted.map(refKey))) {
    throw new ApplicabilityError('NONCANONICAL_APPLICABILITY_REFS', `${name} must use canonical exact-ref order`);
  }
  return deepFreeze(refs);
}

function canonicalObjects(values, name) {
  if (!Array.isArray(values)) throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be an array`);
  return deepFreeze(values.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name}[${index}] must be an object`);
    }
    return cloneCanonicalValue(value);
  }));
}

function canonicalStrings(values, name) {
  if (!Array.isArray(values)) throw new ApplicabilityError('INVALID_APPLICABILITY_INPUT', `${name} must be an array`);
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new ApplicabilityError('DUPLICATE_APPLICABILITY_VALUE', `${name} cannot contain duplicates`);
  const sorted = [...normalized].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(normalized)) throw new ApplicabilityError('NONCANONICAL_APPLICABILITY_VALUE', `${name} must be sorted`);
  return deepFreeze(normalized);
}

function normalizeCondition(value, index) {
  exactObject(value, `conditionResults[${index}]`, CONDITION_KEYS);
  const status = text(value.status, `conditionResults[${index}].status`);
  if (!CONDITION_SET.has(status)) throw new ApplicabilityError('INVALID_CONDITION_STATUS', `unsupported condition status ${status}`);
  const normalized = {
    source: text(value.source, `conditionResults[${index}].source`),
    semanticId: text(value.semanticId, `conditionResults[${index}].semanticId`),
    operator: text(value.operator, `conditionResults[${index}].operator`),
    expected: cloneCanonicalValue(value.expected),
    ...(value.target !== undefined ? { target: cloneCanonicalValue(value.target) } : {}),
    ...(value.unit !== undefined ? { unit: text(value.unit, `conditionResults[${index}].unit`) } : {}),
    status,
    disposition: text(value.disposition, `conditionResults[${index}].disposition`)
  };
  return deepFreeze(normalized);
}

export function normalizeApplicabilityAssessment(value) {
  exactObject(value, 'ApplicabilityAssessment', RESULT_KEYS);
  const contractVersion = text(value.contractVersion, 'contractVersion');
  if (contractVersion !== APPLICABILITY_ASSESSMENT_CONTRACT_VERSION) throw new ApplicabilityError('UNSUPPORTED_APPLICABILITY_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  if (value.authorityClass !== APPLICABILITY_AUTHORITY_CLASS) throw new ApplicabilityError('INVALID_APPLICABILITY_AUTHORITY_CLASS', `authorityClass must be ${APPLICABILITY_AUTHORITY_CLASS}`);
  const transportStatus = text(value.transportStatus, 'transportStatus');
  const scientificUseStatus = text(value.scientificUseStatus, 'scientificUseStatus');
  const decisionRelevance = text(value.decisionRelevance, 'decisionRelevance');
  const runtimeUse = text(value.runtimeUse, 'runtimeUse');
  if (!TRANSPORT_SET.has(transportStatus)) throw new ApplicabilityError('INVALID_TRANSPORT_STATUS', `unsupported transportStatus ${transportStatus}`);
  if (!SCIENTIFIC_USE_SET.has(scientificUseStatus)) throw new ApplicabilityError('INVALID_SCIENTIFIC_USE_STATUS', `unsupported scientificUseStatus ${scientificUseStatus}`);
  if (!RELEVANCE_SET.has(decisionRelevance)) throw new ApplicabilityError('INVALID_DECISION_RELEVANCE', `unsupported decisionRelevance ${decisionRelevance}`);
  if (!RUNTIME_USE_SET.has(runtimeUse)) throw new ApplicabilityError('INVALID_RUNTIME_USE_DISPOSITION', `unsupported runtimeUse ${runtimeUse}`);
  if (transportStatus === 'APPLICABLE_WITH_GOVERNED_TRANSFORM' && (value.requiredTransformationRefs ?? []).length === 0) {
    throw new ApplicabilityError('TRANSFORMATION_AUTHORITY_REQUIRED', 'governed-transform applicability requires exact QualifiedTransformation refs');
  }
  if (transportStatus !== 'APPLICABLE_WITH_GOVERNED_TRANSFORM' && (value.requiredTransformationRefs ?? []).length !== 0) {
    throw new ApplicabilityError('SPURIOUS_TRANSFORMATION_AUTHORITY', 'A08 core cannot attach transformation refs outside governed-transform status');
  }
  if (transportStatus === 'CALIBRATION_REQUIRED' && (value.requiredCalibrationCodes ?? []).length === 0) {
    throw new ApplicabilityError('CALIBRATION_REQUIREMENT_REQUIRED', 'CALIBRATION_REQUIRED must identify at least one governed calibration requirement code');
  }
  return deepFreeze({
    contractVersion,
    authorityClass: APPLICABILITY_AUTHORITY_CLASS,
    knowledgeRetrievalResultRef: exactRef(value.knowledgeRetrievalResultRef, 'KnowledgeRetrievalResult', 'knowledgeRetrievalResultRef'),
    knowledgeRef: exactRef(value.knowledgeRef, null, 'knowledgeRef'),
    knowledgeOriginContextRefs: canonicalRefs(value.knowledgeOriginContextRefs, 'knowledgeOriginContextRefs', ['SourceContext', 'DerivedKnowledgeContext']),
    contextManifestRef: exactRef(value.contextManifestRef, 'ContextManifest', 'contextManifestRef'),
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    usePurpose: text(value.usePurpose, 'usePurpose'),
    conditionResults: deepFreeze((value.conditionResults ?? []).map(normalizeCondition)),
    transportStatus,
    scientificUseStatus,
    decisionRelevance,
    runtimeUse,
    requiredTransformationRefs: deepFreeze((value.requiredTransformationRefs ?? []).map((ref, index) => exactRef(ref, 'QualifiedTransformation', `requiredTransformationRefs[${index}]`))),
    requiredCalibrationCodes: canonicalStrings(value.requiredCalibrationCodes ?? [], 'requiredCalibrationCodes'),
    limitations: canonicalObjects(value.limitations ?? [], 'limitations'),
    conflicts: canonicalObjects(value.conflicts ?? [], 'conflicts'),
    missingContextSemanticIds: canonicalStrings(value.missingContextSemanticIds ?? [], 'missingContextSemanticIds'),
    unsupportedConstraintCodes: canonicalStrings(value.unsupportedConstraintCodes ?? [], 'unsupportedConstraintCodes')
  });
}

export function applicabilitySemanticHash(value) {
  return semanticHash('ApplicabilityAssessment', normalizeApplicabilityAssessment(value));
}
