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
const IMPLEMENTATION_BINDING_KEYS = new Set([
  'specificationRef', 'implementationRef', 'implementationConformanceRef', 'executionContext'
]);
const EXECUTION_CONTEXT_KEYS = new Set([
  'runtime', 'runtimeVersion', 'platform', 'architecture', 'runtimeEnvironment', 'capabilities'
]);
const LIMITATION_KEYS = new Set(['sourceApplicabilityAssessmentRef', 'detail']);

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

function canonicalStringSet(values, name) {
  if (!Array.isArray(values)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_EXECUTION_CONTEXT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new RuntimeBindingError('DUPLICATE_RUNTIME_BINDING_EXECUTION_CAPABILITY', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort());
}

function canonicalKnowledgeBindings(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SINGLE_SELECTED_KNOWLEDGE_REQUIRED',
      'D01 RuntimeBinding freezes exactly one selected Knowledge/Applicability pair; unresolved alternatives cannot enter one binding'
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

function canonicalSpecRefs(values, fieldName, kind) {
  if (!Array.isArray(values)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_BINDINGS', `${fieldName} must be an array`);
  }
  if (values.length > 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_S03_SINGLE_EXECUTION_BINDING_ONLY',
      'S03 conditional RuntimeBinding seam permits at most one exact executable specification binding in v1'
    );
  }
  return deepFreeze(values.map((value, index) => exactRef(value, kind, `${fieldName}[${index}]`)));
}

function canonicalExecutionContext(value, name) {
  exactObject(value, name, EXECUTION_CONTEXT_KEYS);
  return deepFreeze({
    runtime: text(value.runtime, `${name}.runtime`),
    runtimeVersion: text(value.runtimeVersion, `${name}.runtimeVersion`),
    platform: text(value.platform, `${name}.platform`),
    architecture: text(value.architecture, `${name}.architecture`),
    runtimeEnvironment: text(value.runtimeEnvironment, `${name}.runtimeEnvironment`),
    capabilities: canonicalStringSet(value.capabilities, `${name}.capabilities`)
  });
}

function canonicalImplementationBindings(values, specificationRefs) {
  if (!Array.isArray(values)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_BINDINGS', 'implementationBindings must be an array');
  }
  if (values.length > 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_S03_SINGLE_EXECUTION_BINDING_ONLY',
      'S03 conditional RuntimeBinding seam permits at most one exact implementation/conformance binding in v1'
    );
  }
  if (specificationRefs.length === 0 && values.length !== 0) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_IMPLEMENTATION_WITHOUT_SPECIFICATION',
      'Implementation/Conformance cannot enter RuntimeBinding without one exact S01 specification ref'
    );
  }
  if (specificationRefs.length === 1 && values.length !== 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SPECIFICATION_WITHOUT_IMPLEMENTATION',
      'one exact S01 specification ref requires one exact Implementation/ImplementationConformance binding'
    );
  }
  if (values.length === 0) return deepFreeze([]);
  const value = values[0];
  exactObject(value, 'implementationBindings[0]', IMPLEMENTATION_BINDING_KEYS);
  const specificationRef = exactRef(
    value.specificationRef,
    null,
    'implementationBindings[0].specificationRef',
    ['QualifiedTransformation', 'Model', 'Policy']
  );
  if (refKey(specificationRef) !== refKey(specificationRefs[0])) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SPECIFICATION_EXECUTION_RELATION_MISMATCH',
      'implementation binding specificationRef must equal the exact transformation/model/policy binding'
    );
  }
  return deepFreeze([deepFreeze({
    specificationRef,
    implementationRef: exactRef(value.implementationRef, 'Implementation', 'implementationBindings[0].implementationRef'),
    implementationConformanceRef: exactRef(
      value.implementationConformanceRef,
      'ImplementationConformance',
      'implementationBindings[0].implementationConformanceRef'
    ),
    executionContext: canonicalExecutionContext(value.executionContext, 'implementationBindings[0].executionContext')
  })]);
}

function exactEmptyCalibrationBindings(value) {
  if (!Array.isArray(value)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_BINDINGS', 'calibrationBindings must be an array');
  }
  if (value.length !== 0) {
    throw new RuntimeBindingError(
      'D01_CONDITIONAL_CALIBRATION_AUTHORITY_NOT_IMPLEMENTED',
      'calibrationBindings require MTL-S04 CalibrationArtifact authority and remain unavailable in the S03 seam'
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
      'D01 has no upstream governed assumption authority; unresolved requirements cannot be hidden as assumptions'
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
  const transformationBindings = canonicalSpecRefs(value.transformationBindings, 'transformationBindings', 'QualifiedTransformation');
  const modelBindings = canonicalSpecRefs(value.modelBindings, 'modelBindings', 'Model');
  const policyBindings = canonicalSpecRefs(value.policyBindings, 'policyBindings', 'Policy');
  const specificationRefs = [...transformationBindings, ...modelBindings, ...policyBindings];
  if (specificationRefs.length > 1) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_S03_SINGLE_EXECUTION_BINDING_ONLY',
      'S03 v1 conditional seam permits exactly zero or one executable specification relation per RuntimeBinding'
    );
  }
  const implementationBindings = canonicalImplementationBindings(value.implementationBindings, specificationRefs);
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
    transformationBindings,
    modelBindings,
    policyBindings,
    implementationBindings,
    calibrationBindings: exactEmptyCalibrationBindings(value.calibrationBindings),
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
    ...payload.knowledgeBindings.flatMap((binding) => [binding.knowledgeRef, binding.applicabilityAssessmentRef]),
    ...payload.transformationBindings,
    ...payload.modelBindings,
    ...payload.policyBindings,
    ...payload.implementationBindings.flatMap((binding) => [
      binding.specificationRef,
      binding.implementationRef,
      binding.implementationConformanceRef
    ])
  ].sort((left, right) => refKey(left).localeCompare(refKey(right))));
}
