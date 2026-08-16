import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizePlanRef } from '../../information-requirement/src/index.mjs';

export const RUNTIME_ELIGIBILITY_CONTRACT_VERSION = 'adr.runtime-eligibility.v1';
export const RUNTIME_ELIGIBILITY_AUTHORITY_CLASS = 'RUNTIME_LEGALITY_AUTHORITY';
export const RUNTIME_ELIGIBILITY_STATES = deepFreeze([
  'RUNTIME_ELIGIBLE',
  'RUNTIME_ELIGIBLE_WITH_LIMITATIONS',
  'INFORMATION_REQUIRED',
  'NO_LEGAL_RUNTIME'
]);
export const RUNTIME_PATH_DISPOSITIONS = deepFreeze([
  'LEGAL',
  'LEGAL_WITH_LIMITATIONS',
  'INFORMATION_REQUIRED',
  'NO_LEGAL_RUNTIME'
]);
export const RUNTIME_ELIGIBILITY_REASON_CODES = deepFreeze([
  'LEGAL_RUNTIME_ONLY_WITH_LIMITATIONS',
  'DECISION_MATERIAL_INFORMATION_OPEN',
  'KNOWLEDGE_CONFLICT',
  'KNOWLEDGE_USE_PROHIBITED',
  'KNOWLEDGE_REVOKED',
  'UNAUTHORIZED_KNOWLEDGE',
  'KNOWLEDGE_NOT_DECISION_RELEVANT',
  'CALIBRATION_AUTHORITY_REQUIRED',
  'REPLAY_REQUIREMENT_UNSATISFIED',
  'UNRESOLVABLE_SEMANTICS',
  'PROHIBITED_TRANSFORM',
  'NO_COMPATIBLE_MODEL',
  'NO_COMPATIBLE_POLICY',
  'DEPENDENCY_CYCLE',
  'APPLICABILITY_RUNTIME_USE_BLOCKED',
  'RUNTIME_USE_CONDITIONAL_UNRESOLVED',
  'UNRESOLVABLE_RUNTIME_PLAN_REQUIREMENT'
]);

const STATE_SET = new Set(RUNTIME_ELIGIBILITY_STATES);
const PATH_DISPOSITION_SET = new Set(RUNTIME_PATH_DISPOSITIONS);
const REASON_SET = new Set(RUNTIME_ELIGIBILITY_REASON_CODES);
const RESULT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'planRef',
  'decisionProblemRef', 'deploymentRef', 'runtimeProfileRef', 'contextManifestRef',
  'knowledgeRetrievalResultRef', 'applicabilityAssessmentRefs',
  'runtimeEligibility', 'legalRuntimeCandidateCount', 'informationPendingCandidateCount',
  'hardBlockedCandidateCount', 'informationRequirements', 'limitations', 'reasonCodes',
  'alternativeEvaluations', 'decisionAuthorityClaim'
]);
const INFORMATION_REF_KEYS = new Set(['requirementId', 'semanticHash']);
const PATH_KEYS = new Set([
  'pathId', 'knowledgeRef', 'applicabilityAssessmentRef', 'disposition',
  'informationRequirements', 'limitations', 'reasonCodes', 'reasonDetails'
]);
const LIMITATION_KEYS = new Set(['sourceApplicabilityAssessmentRef', 'detail']);
const REASON_DETAIL_KEYS = new Set([
  'reasonCode', 'runtimePlanRequirementId', 'requirementType', 'sourceCode'
]);

export class RuntimeEligibilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeEligibilityError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new RuntimeEligibilityError(
        'INVALID_RUNTIME_ELIGIBILITY_FIELD',
        `${name}.${key} is not part of the frozen R03 contract`
      );
    }
  }
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return canonicalizeSemanticJson(value);
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_REF', `${name} must be an exact ${kind} ref`);
  }
  return ref;
}

function canonicalRefs(values, kind, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_REFS', `${name} must be a non-empty array`);
  }
  const refs = values.map((value, index) => exactRef(value, kind, `${name}[${index}]`));
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new RuntimeEligibilityError('DUPLICATE_RUNTIME_ELIGIBILITY_REF', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...refs].sort((left, right) => refKey(left).localeCompare(refKey(right))));
}

function canonicalStrings(values, name, allowed = null) {
  if (!Array.isArray(values)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new RuntimeEligibilityError('DUPLICATE_RUNTIME_ELIGIBILITY_VALUE', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) {
        throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_VALUE', `${name} contains unsupported value ${value}`);
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeInformationRefs(values, name) {
  if (!Array.isArray(values)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `${name}[${index}]`, INFORMATION_REF_KEYS);
    const requirementId = text(value.requirementId, `${name}[${index}].requirementId`);
    const hash = text(value.semanticHash, `${name}[${index}].semanticHash`);
    if (!/^ir:[0-9a-f]{24}$/.test(requirementId) || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
      throw new RuntimeEligibilityError('INVALID_INFORMATION_REQUIREMENT_IDENTITY', `${name}[${index}] has invalid requirement identity`);
    }
    return deepFreeze({ requirementId, semanticHash: hash });
  });
  const keyed = normalized.map((value) => [canonicalizeSemanticJson(value), value]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new RuntimeEligibilityError('DUPLICATE_INFORMATION_REQUIREMENT_IDENTITY', `${name} cannot contain duplicates`);
  }
  return deepFreeze(keyed.sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value));
}

function normalizeLimitations(values, name) {
  if (!Array.isArray(values)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `${name}[${index}]`, LIMITATION_KEYS);
    return deepFreeze({
      sourceApplicabilityAssessmentRef: exactRef(
        value.sourceApplicabilityAssessmentRef,
        'ApplicabilityAssessment',
        `${name}[${index}].sourceApplicabilityAssessmentRef`
      ),
      detail: cloneCanonicalValue(value.detail)
    });
  });
  const keyed = normalized.map((value) => [semanticHash('RuntimeEligibilityLimitation', value), value]);
  return deepFreeze([...new Map(keyed).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value));
}

function normalizeReasonDetails(values, name) {
  if (!Array.isArray(values)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `${name}[${index}]`, REASON_DETAIL_KEYS);
    const reasonCode = text(value.reasonCode, `${name}[${index}].reasonCode`);
    if (!REASON_SET.has(reasonCode)) {
      throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_REASON', `unsupported reason code ${reasonCode}`);
    }
    return deepFreeze({
      reasonCode,
      runtimePlanRequirementId: text(value.runtimePlanRequirementId, `${name}[${index}].runtimePlanRequirementId`),
      requirementType: text(value.requirementType, `${name}[${index}].requirementType`),
      sourceCode: text(value.sourceCode, `${name}[${index}].sourceCode`)
    });
  });
  const keyed = normalized.map((value) => [semanticHash('RuntimeEligibilityReasonDetail', value), value]);
  return deepFreeze([...new Map(keyed).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value));
}

function normalizeAlternative(value, index) {
  exactObject(value, `alternativeEvaluations[${index}]`, PATH_KEYS);
  const disposition = text(value.disposition, `alternativeEvaluations[${index}].disposition`);
  if (!PATH_DISPOSITION_SET.has(disposition)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_PATH_DISPOSITION', `unsupported path disposition ${disposition}`);
  }
  return deepFreeze({
    pathId: text(value.pathId, `alternativeEvaluations[${index}].pathId`),
    knowledgeRef: assertAuthorityRef(value.knowledgeRef),
    applicabilityAssessmentRef: exactRef(
      value.applicabilityAssessmentRef,
      'ApplicabilityAssessment',
      `alternativeEvaluations[${index}].applicabilityAssessmentRef`
    ),
    disposition,
    informationRequirements: normalizeInformationRefs(
      value.informationRequirements,
      `alternativeEvaluations[${index}].informationRequirements`
    ),
    limitations: normalizeLimitations(value.limitations, `alternativeEvaluations[${index}].limitations`),
    reasonCodes: canonicalStrings(value.reasonCodes, `alternativeEvaluations[${index}].reasonCodes`, REASON_SET),
    reasonDetails: normalizeReasonDetails(value.reasonDetails, `alternativeEvaluations[${index}].reasonDetails`)
  });
}

export function normalizeRuntimeEligibility(value) {
  exactObject(value, 'RuntimeEligibility', RESULT_KEYS);
  if (value.contractVersion !== RUNTIME_ELIGIBILITY_CONTRACT_VERSION) {
    throw new RuntimeEligibilityError('UNSUPPORTED_RUNTIME_ELIGIBILITY_CONTRACT', `unsupported contractVersion ${value.contractVersion}`);
  }
  if (value.authorityClass !== RUNTIME_ELIGIBILITY_AUTHORITY_CLASS) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_AUTHORITY_CLASS', 'RuntimeEligibility authority class mismatch');
  }
  const state = text(value.runtimeEligibility, 'runtimeEligibility');
  if (!STATE_SET.has(state)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_STATE', `unsupported RuntimeEligibility ${state}`);
  }
  for (const [name, count] of [
    ['legalRuntimeCandidateCount', value.legalRuntimeCandidateCount],
    ['informationPendingCandidateCount', value.informationPendingCandidateCount],
    ['hardBlockedCandidateCount', value.hardBlockedCandidateCount]
  ]) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_COUNT', `${name} must be a non-negative safe integer`);
    }
  }
  if (value.decisionAuthorityClaim !== 'NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION') {
    throw new RuntimeEligibilityError('RUNTIME_ELIGIBILITY_DECISION_LAUNDERING', 'RuntimeEligibility cannot carry decision authority');
  }
  const alternatives = (value.alternativeEvaluations ?? []).map(normalizeAlternative);
  if (alternatives.length === 0) {
    throw new RuntimeEligibilityError('RUNTIME_ELIGIBILITY_ALTERNATIVES_REQUIRED', 'RuntimeEligibility requires at least one RuntimePlan alternative evaluation');
  }
  const pathIds = alternatives.map((item) => item.pathId);
  if (new Set(pathIds).size !== pathIds.length) {
    throw new RuntimeEligibilityError('DUPLICATE_RUNTIME_PATH_EVALUATION', 'alternativeEvaluations cannot duplicate path IDs');
  }
  alternatives.sort((a, b) => a.pathId.localeCompare(b.pathId));
  return deepFreeze({
    contractVersion: RUNTIME_ELIGIBILITY_CONTRACT_VERSION,
    authorityClass: RUNTIME_ELIGIBILITY_AUTHORITY_CLASS,
    planRef: normalizePlanRef(value.planRef),
    decisionProblemRef: exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    deploymentRef: exactRef(value.deploymentRef, 'Deployment', 'deploymentRef'),
    runtimeProfileRef: exactRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef'),
    contextManifestRef: exactRef(value.contextManifestRef, 'ContextManifest', 'contextManifestRef'),
    knowledgeRetrievalResultRef: exactRef(
      value.knowledgeRetrievalResultRef,
      'KnowledgeRetrievalResult',
      'knowledgeRetrievalResultRef'
    ),
    applicabilityAssessmentRefs: canonicalRefs(
      value.applicabilityAssessmentRefs,
      'ApplicabilityAssessment',
      'applicabilityAssessmentRefs'
    ),
    runtimeEligibility: state,
    legalRuntimeCandidateCount: value.legalRuntimeCandidateCount,
    informationPendingCandidateCount: value.informationPendingCandidateCount,
    hardBlockedCandidateCount: value.hardBlockedCandidateCount,
    informationRequirements: normalizeInformationRefs(value.informationRequirements ?? [], 'informationRequirements'),
    limitations: normalizeLimitations(value.limitations ?? [], 'limitations'),
    reasonCodes: canonicalStrings(value.reasonCodes ?? [], 'reasonCodes', REASON_SET),
    alternativeEvaluations: deepFreeze(alternatives),
    decisionAuthorityClaim: 'NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION'
  });
}

export function runtimeEligibilitySemanticHash(value) {
  return semanticHash('RuntimeEligibility', normalizeRuntimeEligibility(value));
}
