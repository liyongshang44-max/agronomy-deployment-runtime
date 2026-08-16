import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizePlanRef } from '../../information-requirement/src/index.mjs';

export const RUNTIME_BINDING_CONTRACT_VERSION = 'adr.runtime-binding.v1';
export const RUNTIME_BINDING_AUTHORITY_CLASS = 'RUNTIME_COMPOSITION_REPLAY_AUTHORITY';

const BINDING_KEYS = new Set([
  'contractVersion', 'authorityClass', 'runtimeEligibilityRef', 'runtimePlanRef',
  'selectedAlternativePathId', 'decisionProblemRef', 'deploymentRef', 'runtimeProfileRef',
  'knowledgeReleaseRef', 'contextManifestRef', 'knowledgeBindings',
  'transformationBindings', 'modelBindings', 'policyBindings', 'implementationBindings',
  'calibrationBindings', 'logicalTime', 'evidenceCutoff', 'limitations', 'assumptions',
  'correctnessClaim', 'unresolvedAlternativeCount'
]);
const KNOWLEDGE_BINDING_KEYS = new Set(['knowledgeRef', 'applicabilityAssessmentRef']);
const LIMITATION_KEYS = new Set(['sourceApplicabilityAssessmentRef', 'detail']);
const EXACT_EMPTY_BINDING_FIELDS = [
  ['transformationBindings', 'QualifiedTransformation'],
  ['modelBindings', 'Model'],
  ['policyBindings', 'Policy'],
  ['implementationBindings', 'Implementation'],
  ['calibrationBindings', 'CalibrationArtifact']
];

export class RuntimeBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeBindingError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_INPUT', `${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_FIELD', `${name}.${key} is not part of the frozen D01 contract`);
    }
  }
}

function exactRef(value, kind, name, allowedKinds = null) {
  const ref = assertAuthorityRef(value);
  if (allowedKinds ? !allowedKinds.includes(ref.kind) : ref.kind !== kind) {
    throw new RuntimeBindingError(
      'INVALID_RUNTIME_BINDING_REF',
      `${name} must be an exact ${allowedKinds ? allowedKinds.join(' or ') : kind} ref`
    );
  }
  return ref;
}

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalKnowledgeBindings(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SINGLE_SELECTED_KNOWLEDGE_REQUIRED',
      'D01 minimal RuntimeBinding freezes exactly one selected Knowledge/Applicability pair; unresolved alternatives cannot enter one binding'
    );
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `knowledgeBindings[${index}]`, KNOWLEDGE_BINDING_KEYS);
    return deepFreeze({
      knowledgeRef: exactRef(
        value.knowledgeRef,
        null,
        `knowledgeBindings[${index}].knowledgeRef`,
        ['QualifiedKnowledge', 'DerivedKnowledge']
      ),
      applicabilityAssessmentRef: exactRef(
        value.applicabilityAssessmentRef,
        'ApplicabilityAssessment',
        `knowledgeBindings[${index}].applicabilityAssessmentRef`
      )
    });
  });
  return deepFreeze(normalized);
}

function exactEmptyBindings(value, fieldName, authorityKind) {
  if (!Array.isArray(value)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_BINDINGS', `${fieldName} must be an array`);
  }
  if (value.length !== 0) {
    throw new RuntimeBindingError(
      'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED',
      `D01 minimal path cannot bind ${authorityKind}; the corresponding conditional spec/conformance/calibration authority must be implemented and exercised first`
    );
  }
  return deepFreeze([]);
}

function canonicalLimitations(values) {
  if (!Array.isArray(values)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_LIMITATIONS', 'limitations must be an array');
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `limitations[${index}]`, LIMITATION_KEYS);
    return deepFreeze({
      sourceApplicabilityAssessmentRef: exactRef(
        value.sourceApplicabilityAssessmentRef,
        'ApplicabilityAssessment',
        `limitations[${index}].sourceApplicabilityAssessmentRef`
      ),
      detail: cloneCanonicalValue(value.detail)
    });
  });
  const keyed = normalized.map((item) => [semanticHash('RuntimeBindingLimitation', item), item]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new RuntimeBindingError('DUPLICATE_RUNTIME_BINDING_LIMITATION', 'limitations cannot contain duplicates');
  }
  return deepFreeze(keyed.sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item));
}

function canonicalAssumptions(values) {
  if (!Array.isArray(values)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_ASSUMPTIONS', 'assumptions must be an array');
  }
  if (values.length !== 0) {
    throw new RuntimeBindingError(
      'D01_UNAUTHORIZED_ASSUMPTION',
      'D01 minimal path has no upstream governed assumption authority; unresolved requirements cannot be hidden as assumptions'
    );
  }
  return deepFreeze([]);
}

export function normalizeRuntimeBinding(value) {
  exactObject(value, 'RuntimeBinding', BINDING_KEYS);
  if (value.contractVersion !== RUNTIME_BINDING_CONTRACT_VERSION) {
    throw new RuntimeBindingError('UNSUPPORTED_RUNTIME_BINDING_CONTRACT', `unsupported contractVersion ${value.contractVersion}`);
  }
  if (value.authorityClass !== RUNTIME_BINDING_AUTHORITY_CLASS) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_AUTHORITY_CLASS', 'RuntimeBinding authority class mismatch');
  }
  if (value.correctnessClaim !== 'NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS') {
    throw new RuntimeBindingError('RUNTIME_BINDING_CORRECTNESS_LAUNDERING', 'RuntimeBinding cannot claim scientific correctness');
  }
  if (value.unresolvedAlternativeCount !== 0) {
    throw new RuntimeBindingError('RUNTIME_BINDING_UNRESOLVED_ALTERNATIVES', 'RuntimeBinding cannot contain unresolved alternatives');
  }
  const runtimeEligibilityRef = exactRef(value.runtimeEligibilityRef, 'RuntimeEligibility', 'runtimeEligibilityRef');
  const decisionProblemRef = exactRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef');
  const deploymentRef = exactRef(value.deploymentRef, 'Deployment', 'deploymentRef');
  const runtimeProfileRef = exactRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef');
  const knowledgeReleaseRef = exactRef(value.knowledgeReleaseRef, 'KnowledgeRelease', 'knowledgeReleaseRef');
  const contextManifestRef = exactRef(value.contextManifestRef, 'ContextManifest', 'contextManifestRef');
  const runtimePlanRef = normalizePlanRef(value.runtimePlanRef);
  const selectedAlternativePathId = text(value.selectedAlternativePathId, 'selectedAlternativePathId');
  const logicalTime = text(value.logicalTime, 'logicalTime');
  const evidenceCutoff = text(value.evidenceCutoff, 'evidenceCutoff');
  const knowledgeBindings = canonicalKnowledgeBindings(value.knowledgeBindings);
  const emptyBindings = Object.fromEntries(EXACT_EMPTY_BINDING_FIELDS.map(([fieldName, kind]) => [
    fieldName,
    exactEmptyBindings(value[fieldName], fieldName, kind)
  ]));
  return deepFreeze({
    contractVersion: RUNTIME_BINDING_CONTRACT_VERSION,
    authorityClass: RUNTIME_BINDING_AUTHORITY_CLASS,
    runtimeEligibilityRef,
    runtimePlanRef,
    selectedAlternativePathId,
    decisionProblemRef,
    deploymentRef,
    runtimeProfileRef,
    knowledgeReleaseRef,
    contextManifestRef,
    knowledgeBindings,
    ...emptyBindings,
    logicalTime,
    evidenceCutoff,
    limitations: canonicalLimitations(value.limitations),
    assumptions: canonicalAssumptions(value.assumptions),
    correctnessClaim: 'NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS',
    unresolvedAlternativeCount: 0
  });
}

export function runtimeBindingSemanticHash(value) {
  return semanticHash('RuntimeBinding', normalizeRuntimeBinding(value));
}

export function runtimeBindingExactRefs(value) {
  const payload = normalizeRuntimeBinding(value);
  return deepFreeze([
    payload.runtimeEligibilityRef,
    payload.decisionProblemRef,
    payload.deploymentRef,
    payload.runtimeProfileRef,
    payload.knowledgeReleaseRef,
    payload.contextManifestRef,
    ...payload.knowledgeBindings.flatMap((binding) => [binding.knowledgeRef, binding.applicabilityAssessmentRef])
  ].sort((left, right) => refKey(left).localeCompare(refKey(right))));
}
