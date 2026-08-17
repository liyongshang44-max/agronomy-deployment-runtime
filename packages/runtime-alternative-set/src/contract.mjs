import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizePlanRef } from '../../information-requirement/src/index.mjs';

export const RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION = 'adr.runtime-alternative-set.v1';
export const RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS = 'RUNTIME_ROBUSTNESS_COVERAGE_AUTHORITY';
export const RUNTIME_ALTERNATIVE_COMPLETENESS_CLASSES = deepFreeze([
  'EXHAUSTIVE_ENUMERATION',
  'BOUNDED_ENVELOPE',
  'GOVERNED_COVERAGE',
  'INCOMPLETE'
]);
export const RUNTIME_ALTERNATIVE_EXCLUSION_REASON_CODES = deepFreeze([
  'LEGAL_PATH_BINDING_NOT_INCLUDED',
  'INFORMATION_REQUIRED',
  'NO_LEGAL_RUNTIME'
]);

const COMPLETENESS = new Set(RUNTIME_ALTERNATIVE_COMPLETENESS_CLASSES);
const EXCLUSION_REASON = new Set(RUNTIME_ALTERNATIVE_EXCLUSION_REASON_CODES);
const LEGAL_DISPOSITIONS = new Set(['LEGAL', 'LEGAL_WITH_LIMITATIONS']);
const PATH_DISPOSITIONS = new Set([
  'LEGAL',
  'LEGAL_WITH_LIMITATIONS',
  'INFORMATION_REQUIRED',
  'NO_LEGAL_RUNTIME'
]);
const DIMENSION_TYPES = new Set(['RUNTIME_PLAN_ALTERNATIVE', 'APPLICABILITY_CONFLICT']);

const SET_KEYS = new Set([
  'contractVersion', 'authorityClass', 'decisionProblemRef', 'deploymentRef',
  'runtimeProfileRef', 'contextManifestRef', 'runtimePlanRef', 'runtimeEligibilityRef',
  'generationMethod', 'materialUncertaintyDimensions', 'includedBindings',
  'excludedCandidates', 'coverage', 'completenessClass', 'robustnessClaim'
]);
const METHOD_KEYS = new Set([
  'methodId', 'methodVersion', 'runtimePlanCompilerVersion', 'universeBasis',
  'implementationVarianceSemantics'
]);
const DIMENSION_KEYS = new Set([
  'dimensionId', 'dimensionType', 'pathIds', 'sourceApplicabilityAssessmentRef', 'detail'
]);
const INCLUDED_KEYS = new Set([
  'pathId', 'runtimeBindingRef', 'knowledgeRef', 'applicabilityAssessmentRef'
]);
const EXCLUDED_KEYS = new Set([
  'pathId', 'knowledgeRef', 'applicabilityAssessmentRef', 'pathDisposition',
  'exclusionReasonCodes', 'sourceReasonCodes'
]);
const COVERAGE_KEYS = new Set([
  'candidatePathIds', 'legalPathIds', 'includedPathIds', 'uncoveredLegalPathIds'
]);

export class RuntimeAlternativeSetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeAlternativeSetError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_INPUT', `${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new RuntimeAlternativeSetError(
        'INVALID_RUNTIME_ALTERNATIVE_SET_FIELD',
        `${name}.${key} is not part of the frozen D04 contract`
      );
    }
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_REF', `${name} must be an exact ${kind} ref`);
  }
  return ref;
}

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function stringSet(values, name, { allowEmpty = true, allowed = null } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_SET_VALUES',
      `${name} must be ${allowEmpty ? 'an' : 'a non-empty'} array`
    );
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new RuntimeAlternativeSetError('DUPLICATE_RUNTIME_ALTERNATIVE_SET_VALUE', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) {
        throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_VALUE', `${name} contains unsupported value ${value}`);
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeGenerationMethod(value) {
  exactObject(value, 'generationMethod', METHOD_KEYS);
  const normalized = {
    methodId: text(value.methodId, 'generationMethod.methodId'),
    methodVersion: text(value.methodVersion, 'generationMethod.methodVersion'),
    runtimePlanCompilerVersion: text(value.runtimePlanCompilerVersion, 'generationMethod.runtimePlanCompilerVersion'),
    universeBasis: text(value.universeBasis, 'generationMethod.universeBasis'),
    implementationVarianceSemantics: text(
      value.implementationVarianceSemantics,
      'generationMethod.implementationVarianceSemantics'
    )
  };
  if (normalized.methodId !== 'ADR_RUNTIME_ALTERNATIVE_ENUMERATOR'
    || normalized.methodVersion !== '1'
    || normalized.universeBasis !== 'EXACT_RUNTIME_PLAN_PATHS_ADJUDICATED_BY_RUNTIME_ELIGIBILITY'
    || normalized.implementationVarianceSemantics !== 'OUTSIDE_D04_V1_COVERAGE_DOMAIN_REQUIRES_SEPARATE_GOVERNED_DIMENSION') {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_UNGOVERNED_GENERATION_METHOD',
      'D04 v1 generation method is fixed; callers cannot redefine the coverage universe or hide implementation variance'
    );
  }
  return deepFreeze(normalized);
}

function dimensionCore(value) {
  return {
    dimensionType: value.dimensionType,
    pathIds: value.pathIds,
    ...(value.sourceApplicabilityAssessmentRef
      ? { sourceApplicabilityAssessmentRef: value.sourceApplicabilityAssessmentRef }
      : {}),
    ...(value.detail !== undefined ? { detail: value.detail } : {})
  };
}

export function materialUncertaintyDimensionId(value) {
  const hash = semanticHash('RuntimeAlternativeMaterialDimensionIdentity', dimensionCore(value));
  return `dimension:${hash.slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function normalizeMaterialDimension(value, index) {
  exactObject(value, `materialUncertaintyDimensions[${index}]`, DIMENSION_KEYS);
  const dimensionType = text(value.dimensionType, `materialUncertaintyDimensions[${index}].dimensionType`);
  if (!DIMENSION_TYPES.has(dimensionType)) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_DIMENSION_TYPE',
      `unsupported material uncertainty dimension ${dimensionType}`
    );
  }
  const pathIds = stringSet(value.pathIds, `materialUncertaintyDimensions[${index}].pathIds`, { allowEmpty: false });
  const normalized = {
    dimensionType,
    pathIds,
    ...(value.sourceApplicabilityAssessmentRef
      ? {
        sourceApplicabilityAssessmentRef: exactRef(
          value.sourceApplicabilityAssessmentRef,
          'ApplicabilityAssessment',
          `materialUncertaintyDimensions[${index}].sourceApplicabilityAssessmentRef`
        )
      }
      : {}),
    ...(value.detail !== undefined ? { detail: cloneCanonicalValue(value.detail) } : {})
  };
  if (dimensionType === 'RUNTIME_PLAN_ALTERNATIVE') {
    if (pathIds.length < 2 || normalized.sourceApplicabilityAssessmentRef || normalized.detail !== undefined) {
      throw new RuntimeAlternativeSetError(
        'INVALID_RUNTIME_PLAN_ALTERNATIVE_DIMENSION',
        'RUNTIME_PLAN_ALTERNATIVE dimension requires at least two path IDs and no assessment-specific detail'
      );
    }
  } else if (pathIds.length !== 1 || !normalized.sourceApplicabilityAssessmentRef || normalized.detail === undefined) {
    throw new RuntimeAlternativeSetError(
      'INVALID_APPLICABILITY_CONFLICT_DIMENSION',
      'APPLICABILITY_CONFLICT dimension requires one path, one exact ApplicabilityAssessment ref and exact conflict detail'
    );
  }
  const expectedId = materialUncertaintyDimensionId(normalized);
  if (text(value.dimensionId, `materialUncertaintyDimensions[${index}].dimensionId`) !== expectedId) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_DIMENSION_IDENTITY_MISMATCH',
      'material uncertainty dimension ID must derive from exact governed dimension semantics'
    );
  }
  return deepFreeze({ dimensionId: expectedId, ...normalized });
}

function normalizeIncluded(value, index) {
  exactObject(value, `includedBindings[${index}]`, INCLUDED_KEYS);
  return deepFreeze({
    pathId: text(value.pathId, `includedBindings[${index}].pathId`),
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', `includedBindings[${index}].runtimeBindingRef`),
    knowledgeRef: assertAuthorityRef(value.knowledgeRef),
    applicabilityAssessmentRef: exactRef(
      value.applicabilityAssessmentRef,
      'ApplicabilityAssessment',
      `includedBindings[${index}].applicabilityAssessmentRef`
    )
  });
}

function normalizeExcluded(value, index) {
  exactObject(value, `excludedCandidates[${index}]`, EXCLUDED_KEYS);
  const pathDisposition = text(value.pathDisposition, `excludedCandidates[${index}].pathDisposition`);
  if (!PATH_DISPOSITIONS.has(pathDisposition)) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_PATH_DISPOSITION',
      `unsupported historical path disposition ${pathDisposition}`
    );
  }
  const exclusionReasonCodes = stringSet(
    value.exclusionReasonCodes,
    `excludedCandidates[${index}].exclusionReasonCodes`,
    { allowEmpty: false, allowed: EXCLUSION_REASON }
  );
  if (LEGAL_DISPOSITIONS.has(pathDisposition) && !exclusionReasonCodes.includes('LEGAL_PATH_BINDING_NOT_INCLUDED')) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_UNCOVERED_LEGAL_PATH_REASON_REQUIRED',
      'excluded legal path must explicitly state LEGAL_PATH_BINDING_NOT_INCLUDED'
    );
  }
  if (pathDisposition === 'INFORMATION_REQUIRED' && !exclusionReasonCodes.includes('INFORMATION_REQUIRED')) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_INFORMATION_EXCLUSION_REASON_REQUIRED',
      'INFORMATION_REQUIRED path must retain its governed exclusion class'
    );
  }
  if (pathDisposition === 'NO_LEGAL_RUNTIME' && !exclusionReasonCodes.includes('NO_LEGAL_RUNTIME')) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_NO_LEGAL_RUNTIME_REASON_REQUIRED',
      'NO_LEGAL_RUNTIME path must retain its governed exclusion class'
    );
  }
  return deepFreeze({
    pathId: text(value.pathId, `excludedCandidates[${index}].pathId`),
    knowledgeRef: assertAuthorityRef(value.knowledgeRef),
    applicabilityAssessmentRef: exactRef(
      value.applicabilityAssessmentRef,
      'ApplicabilityAssessment',
      `excludedCandidates[${index}].applicabilityAssessmentRef`
    ),
    pathDisposition,
    exclusionReasonCodes,
    sourceReasonCodes: stringSet(value.sourceReasonCodes ?? [], `excludedCandidates[${index}].sourceReasonCodes`)
  });
}

function normalizeCoverage(value) {
  exactObject(value, 'coverage', COVERAGE_KEYS);
  return deepFreeze({
    candidatePathIds: stringSet(value.candidatePathIds, 'coverage.candidatePathIds'),
    legalPathIds: stringSet(value.legalPathIds, 'coverage.legalPathIds'),
    includedPathIds: stringSet(value.includedPathIds, 'coverage.includedPathIds'),
    uncoveredLegalPathIds: stringSet(value.uncoveredLegalPathIds, 'coverage.uncoveredLegalPathIds')
  });
}

function validateCoverageRelations({ includedBindings, excludedCandidates, coverage, completenessClass }) {
  const includedPathIds = stringSet(includedBindings.map((item) => item.pathId), 'derived.includedPathIds');
  const excludedPathIds = stringSet(excludedCandidates.map((item) => item.pathId), 'derived.excludedPathIds');
  if (includedPathIds.some((pathId) => excludedPathIds.includes(pathId))) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_PATH_BOTH_INCLUDED_AND_EXCLUDED',
      'one RuntimePlan path cannot be both included and excluded'
    );
  }
  const candidatePathIds = stringSet([...includedPathIds, ...excludedPathIds], 'derived.candidatePathIds');
  const uncoveredLegalPathIds = stringSet(
    excludedCandidates.filter((item) => LEGAL_DISPOSITIONS.has(item.pathDisposition)).map((item) => item.pathId),
    'derived.uncoveredLegalPathIds'
  );
  const legalPathIds = stringSet([...includedPathIds, ...uncoveredLegalPathIds], 'derived.legalPathIds');
  for (const [name, actual, expected] of [
    ['candidatePathIds', coverage.candidatePathIds, candidatePathIds],
    ['legalPathIds', coverage.legalPathIds, legalPathIds],
    ['includedPathIds', coverage.includedPathIds, includedPathIds],
    ['uncoveredLegalPathIds', coverage.uncoveredLegalPathIds, uncoveredLegalPathIds]
  ]) {
    if (!sameStrings(actual, expected)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_COVERAGE_MISMATCH',
        `coverage.${name} must exactly reproduce included/excluded RuntimePlan path accounting`
      );
    }
  }
  const expectedCompleteness = uncoveredLegalPathIds.length === 0 ? 'EXHAUSTIVE_ENUMERATION' : 'INCOMPLETE';
  if (completenessClass !== expectedCompleteness) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_COMPLETENESS_LAUNDERING',
      `D04 v1 exact-path method requires ${expectedCompleteness} for this coverage ledger`
    );
  }
}

export function normalizeRuntimeAlternativeSet(value) {
  exactObject(value, 'RuntimeAlternativeSet', SET_KEYS);
  if (value.contractVersion !== RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION) {
    throw new RuntimeAlternativeSetError(
      'UNSUPPORTED_RUNTIME_ALTERNATIVE_SET_CONTRACT',
      `unsupported contractVersion ${value.contractVersion}`
    );
  }
  if (value.authorityClass !== RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS',
      'RuntimeAlternativeSet authority class mismatch'
    );
  }
  const completenessClass = text(value.completenessClass, 'completenessClass');
  if (!COMPLETENESS.has(completenessClass)) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_COMPLETENESS_CLASS',
      `unsupported completeness class ${completenessClass}`
    );
  }
  if (completenessClass === 'BOUNDED_ENVELOPE' || completenessClass === 'GOVERNED_COVERAGE') {
    throw new RuntimeAlternativeSetError(
      'D04_GOVERNED_COVERAGE_AUTHORITY_NOT_IMPLEMENTED',
      `${completenessClass} requires a qualified upstream coverage/sampling authority not present in the current RuntimeProfile contract`
    );
  }
  if (value.robustnessClaim !== 'NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS') {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_ROBUSTNESS_LAUNDERING',
      'RuntimeAlternativeSet defines coverage only and cannot claim ROBUST/SENSITIVE/UNRESOLVED'
    );
  }
  const generationMethod = normalizeGenerationMethod(value.generationMethod);
  const runtimePlanRef = normalizePlanRef(value.runtimePlanRef);
  if (generationMethod.runtimePlanCompilerVersion !== runtimePlanRef.compilerVersion) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_COMPILER_VERSION_MISMATCH',
      'generation method must bind the exact RuntimePlan compiler version'
    );
  }
  const materialUncertaintyDimensions = (value.materialUncertaintyDimensions ?? [])
    .map(normalizeMaterialDimension)
    .sort((left, right) => left.dimensionId.localeCompare(right.dimensionId));
  if (new Set(materialUncertaintyDimensions.map((item) => item.dimensionId)).size !== materialUncertaintyDimensions.length) {
    throw new RuntimeAlternativeSetError(
      'DUPLICATE_RUNTIME_ALTERNATIVE_DIMENSION',
      'material uncertainty dimensions cannot duplicate exact dimension identity'
    );
  }
  const includedBindings = (value.includedBindings ?? [])
    .map(normalizeIncluded)
    .sort((left, right) => left.pathId.localeCompare(right.pathId));
  if (new Set(includedBindings.map((item) => item.pathId)).size !== includedBindings.length) {
    throw new RuntimeAlternativeSetError(
      'DUPLICATE_RUNTIME_ALTERNATIVE_PATH_BINDING',
      'D04 v1 admits at most one exact RuntimeBinding per semantic RuntimePlan path'
    );
  }
  const includedRefs = includedBindings.map((item) => refKey(item.runtimeBindingRef));
  if (new Set(includedRefs).size !== includedRefs.length) {
    throw new RuntimeAlternativeSetError(
      'DUPLICATE_RUNTIME_ALTERNATIVE_BINDING_REF',
      'included RuntimeBinding refs cannot duplicate'
    );
  }
  const excludedCandidates = (value.excludedCandidates ?? [])
    .map(normalizeExcluded)
    .sort((left, right) => left.pathId.localeCompare(right.pathId));
  if (new Set(excludedCandidates.map((item) => item.pathId)).size !== excludedCandidates.length) {
    throw new RuntimeAlternativeSetError(
      'DUPLICATE_RUNTIME_ALTERNATIVE_EXCLUDED_PATH',
      'excluded candidate paths cannot duplicate'
    );
  }
  const coverage = normalizeCoverage(value.coverage);
  validateCoverageRelations({ includedBindings, excludedCandidates, coverage, completenessClass });
  const candidatePaths = new Set(coverage.candidatePathIds);
  for (const dimension of materialUncertaintyDimensions) {
    if (dimension.pathIds.some((pathId) => !candidatePaths.has(pathId))) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_DIMENSION_OUTSIDE_COVERAGE_DOMAIN',
        'material uncertainty dimension cannot reference a path outside exact coverage domain'
      );
    }
  }
  return deepFreeze({
    contractVersion: RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION,
    authorityClass: RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS,
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    deploymentRef: exactRef(value.deploymentRef, 'Deployment', 'deploymentRef'),
    runtimeProfileRef: exactRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef'),
    contextManifestRef: exactRef(value.contextManifestRef, 'ContextManifest', 'contextManifestRef'),
    runtimePlanRef,
    runtimeEligibilityRef: exactRef(value.runtimeEligibilityRef, 'RuntimeEligibility', 'runtimeEligibilityRef'),
    generationMethod,
    materialUncertaintyDimensions: deepFreeze(materialUncertaintyDimensions),
    includedBindings: deepFreeze(includedBindings),
    excludedCandidates: deepFreeze(excludedCandidates),
    coverage,
    completenessClass,
    robustnessClaim: 'NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS'
  });
}

export function runtimeAlternativeSetSemanticHash(value) {
  return semanticHash('RuntimeAlternativeSet', normalizeRuntimeAlternativeSet(value));
}

export function runtimeAlternativeSetExactRefs(value) {
  const payload = normalizeRuntimeAlternativeSet(value);
  const refs = [
    payload.decisionProblemRef,
    payload.deploymentRef,
    payload.runtimeProfileRef,
    payload.contextManifestRef,
    payload.runtimeEligibilityRef,
    ...payload.includedBindings.flatMap((item) => [
      item.runtimeBindingRef,
      item.knowledgeRef,
      item.applicabilityAssessmentRef
    ]),
    ...payload.excludedCandidates.flatMap((item) => [item.knowledgeRef, item.applicabilityAssessmentRef]),
    ...payload.materialUncertaintyDimensions.flatMap((item) =>
      item.sourceApplicabilityAssessmentRef ? [item.sourceApplicabilityAssessmentRef] : [])
  ];
  const map = new Map(refs.map((ref) => [refKey(ref), assertAuthorityRef(ref)]));
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref));
}
