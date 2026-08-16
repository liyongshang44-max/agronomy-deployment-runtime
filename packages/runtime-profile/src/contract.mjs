import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { EPISTEMIC_CLASSES } from '../../context-contract/src/index.mjs';
import { DECISION_AUTHORITY_MODES } from '../../decision-problem/src/index.mjs';

export const RUNTIME_PROFILE_CONTRACT_VERSION = 'adr.runtime-profile.v1';
export const RUNTIME_PROFILE_AUTHORITY_CLASS = 'RUNTIME_COMPOSITION_POLICY';
export const RUNTIME_PROFILE_REPLAY_CLASSES = deepFreeze([
  'EXACT',
  'CONTENT_ADDRESSED_EXTERNAL',
  'PROVIDER_DEPENDENT',
  'NON_REPLAYABLE'
]);
export const RUNTIME_ENVIRONMENTS = deepFreeze(['DEVELOPMENT', 'STAGING', 'PRODUCTION']);
export const ROLLOUT_STAGES = deepFreeze([
  'DRAFT', 'SANDBOX', 'SHADOW', 'PILOT', 'PRODUCTION', 'SUSPENDED', 'DEPRECATED'
]);

const REPLAY_CLASS_SET = new Set(RUNTIME_PROFILE_REPLAY_CLASSES);
const EPISTEMIC_CLASS_SET = new Set(EPISTEMIC_CLASSES);
const AUTHORITY_MODE_SET = new Set(DECISION_AUTHORITY_MODES);
const RUNTIME_ENVIRONMENT_SET = new Set(RUNTIME_ENVIRONMENTS);
const ROLLOUT_STAGE_SET = new Set(ROLLOUT_STAGES);
const PROFILE_KEYS = new Set([
  'contractVersion', 'authorityClass', 'controlScope', 'knowledgeReleaseRef',
  'contextRequirements', 'replayRequirement', 'runtimeGovernance',
  'allowedUseDeploymentConstraints'
]);
const FORBIDDEN_SPEC_KEYS = new Set([
  'transformationConstraints', 'modelConstraints', 'policyConstraints',
  'implementationConstraints', 'calibrationConstraints', 'transformationRefs',
  'modelRefs', 'policyRefs', 'implementationRefs', 'calibrationRefs'
]);
const CONTEXT_REQUIREMENT_KEYS = new Set(['requiredSemanticIds', 'epistemicConstraints']);
const GOVERNANCE_KEYS = new Set([
  'allowedDecisionAuthorityModes', 'knowledgeSelectionMode', 'contextBindingMode', 'applicabilityMode'
]);
const USE_DEPLOYMENT_KEYS = new Set(['usePurposes', 'useClasses', 'runtimeEnvironments', 'rolloutStages']);

export class RuntimeProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeProfileError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_FIELD', `${name}.${key} is not part of ${RUNTIME_PROFILE_CONTRACT_VERSION}`);
    }
  }
}

function list(values, name, { allowEmpty = false, allowed } = {}) {
  if (!Array.isArray(values)) throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', `${name} must be an array`);
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (!allowEmpty && normalized.length === 0) throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', `${name} cannot be empty`);
  if (new Set(normalized).size !== normalized.length) {
    throw new RuntimeProfileError('DUPLICATE_RUNTIME_PROFILE_CONSTRAINT', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_ENUM', `${name} contains unsupported value ${value}`);
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeControlScope(value) {
  exactObject(value, 'controlScope', new Set(['organizationId', 'tenantId']));
  return deepFreeze({
    organizationId: text(value.organizationId, 'controlScope.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'controlScope.tenantId') } : {})
  });
}

function normalizeContextRequirements(value) {
  exactObject(value, 'contextRequirements', CONTEXT_REQUIREMENT_KEYS);
  const requiredSemanticIds = list(
    value.requiredSemanticIds ?? [],
    'contextRequirements.requiredSemanticIds',
    { allowEmpty: true }
  );
  const source = value.epistemicConstraints ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_CONTEXT_REQUIREMENT', 'epistemicConstraints must be an object');
  }
  const epistemicConstraints = {};
  for (const semanticId of Object.keys(source).sort()) {
    const id = text(semanticId, 'contextRequirements.epistemicConstraints semantic id');
    if (!requiredSemanticIds.includes(id)) {
      throw new RuntimeProfileError(
        'RUNTIME_PROFILE_EPISTEMIC_CONSTRAINT_WITHOUT_REQUIRED_SEMANTIC',
        `${id} must also be a requiredSemanticId`
      );
    }
    epistemicConstraints[id] = list(
      source[semanticId],
      `contextRequirements.epistemicConstraints.${id}`,
      { allowed: EPISTEMIC_CLASS_SET }
    );
  }
  return deepFreeze({ requiredSemanticIds, epistemicConstraints: deepFreeze(epistemicConstraints) });
}

function normalizeReplayRequirement(value) {
  exactObject(value, 'replayRequirement', new Set(['minimum']));
  const minimum = text(value.minimum, 'replayRequirement.minimum');
  if (!REPLAY_CLASS_SET.has(minimum)) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_REPLAY_REQUIREMENT', `unsupported replay minimum ${minimum}`);
  }
  return deepFreeze({ minimum });
}

function normalizeRuntimeGovernance(value) {
  exactObject(value, 'runtimeGovernance', GOVERNANCE_KEYS);
  const allowedDecisionAuthorityModes = list(
    value.allowedDecisionAuthorityModes,
    'runtimeGovernance.allowedDecisionAuthorityModes',
    { allowed: AUTHORITY_MODE_SET }
  );
  const knowledgeSelectionMode = text(value.knowledgeSelectionMode, 'runtimeGovernance.knowledgeSelectionMode');
  const contextBindingMode = text(value.contextBindingMode, 'runtimeGovernance.contextBindingMode');
  const applicabilityMode = text(value.applicabilityMode, 'runtimeGovernance.applicabilityMode');
  if (knowledgeSelectionMode !== 'EXACT_KNOWLEDGE_RELEASE') {
    throw new RuntimeProfileError('RUNTIME_PROFILE_DYNAMIC_KNOWLEDGE_FORBIDDEN', 'minimal RuntimeProfile requires exact KnowledgeRelease selection');
  }
  if (contextBindingMode !== 'EXACT_CONTEXT_MANIFEST') {
    throw new RuntimeProfileError('RUNTIME_PROFILE_MUTABLE_CONTEXT_FORBIDDEN', 'minimal RuntimeProfile requires exact ContextManifest binding');
  }
  if (applicabilityMode !== 'EXACT_APPLICABILITY_ASSESSMENTS') {
    throw new RuntimeProfileError('RUNTIME_PROFILE_APPLICABILITY_BYPASS_FORBIDDEN', 'minimal RuntimeProfile requires exact ApplicabilityAssessment authority');
  }
  return deepFreeze({ allowedDecisionAuthorityModes, knowledgeSelectionMode, contextBindingMode, applicabilityMode });
}

function normalizeUseDeployment(value) {
  exactObject(value, 'allowedUseDeploymentConstraints', USE_DEPLOYMENT_KEYS);
  return deepFreeze({
    usePurposes: list(value.usePurposes, 'allowedUseDeploymentConstraints.usePurposes'),
    useClasses: list(value.useClasses, 'allowedUseDeploymentConstraints.useClasses'),
    runtimeEnvironments: list(value.runtimeEnvironments, 'allowedUseDeploymentConstraints.runtimeEnvironments', { allowed: RUNTIME_ENVIRONMENT_SET }),
    rolloutStages: list(value.rolloutStages, 'allowedUseDeploymentConstraints.rolloutStages', { allowed: ROLLOUT_STAGE_SET })
  });
}

function assertMinimalShape(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', 'profile must be an object');
  }
  for (const key of Object.keys(profile)) {
    if (FORBIDDEN_SPEC_KEYS.has(key)) {
      throw new RuntimeProfileError(
        'RUNTIME_PROFILE_SPEC_AUTHORITY_NOT_AVAILABLE',
        `${key} requires its conditional specification/conformance/calibration predecessor and is forbidden in MTL-A05 minimal profile`
      );
    }
    if (!PROFILE_KEYS.has(key)) throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_FIELD', `${key} is not part of the MTL-A05 minimal RuntimeProfile contract`);
  }
}

export function normalizeRuntimeProfile(profile) {
  assertMinimalShape(profile);
  const contractVersion = text(profile.contractVersion, 'contractVersion');
  if (contractVersion !== RUNTIME_PROFILE_CONTRACT_VERSION) {
    throw new RuntimeProfileError('UNSUPPORTED_RUNTIME_PROFILE_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  }
  if (profile.authorityClass !== undefined && profile.authorityClass !== RUNTIME_PROFILE_AUTHORITY_CLASS) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_AUTHORITY_CLASS', `authorityClass must be ${RUNTIME_PROFILE_AUTHORITY_CLASS}`);
  }
  const knowledgeReleaseRef = assertAuthorityRef(profile.knowledgeReleaseRef);
  if (knowledgeReleaseRef.kind !== 'KnowledgeRelease') {
    throw new RuntimeProfileError('RUNTIME_PROFILE_KNOWLEDGE_RELEASE_REQUIRED', 'knowledgeReleaseRef must be an exact KnowledgeRelease ref');
  }
  return deepFreeze({
    contractVersion,
    authorityClass: RUNTIME_PROFILE_AUTHORITY_CLASS,
    controlScope: normalizeControlScope(profile.controlScope),
    knowledgeReleaseRef,
    contextRequirements: normalizeContextRequirements(profile.contextRequirements),
    replayRequirement: normalizeReplayRequirement(profile.replayRequirement),
    runtimeGovernance: normalizeRuntimeGovernance(profile.runtimeGovernance),
    allowedUseDeploymentConstraints: normalizeUseDeployment(profile.allowedUseDeploymentConstraints)
  });
}

export function cloneRuntimeProfile(value) {
  return cloneCanonicalValue(normalizeRuntimeProfile(value));
}
