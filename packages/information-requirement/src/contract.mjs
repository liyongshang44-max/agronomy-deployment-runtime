import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  EPISTEMIC_CLASSES,
  PROVENANCE_CLASSES
} from '../../context-contract/src/index.mjs';

export const INFORMATION_REQUIREMENT_CONTRACT_VERSION = 'adr.information-requirement.v1';
export const INFORMATION_PLANNING_RESULT_CONTRACT_VERSION = 'adr.information-planning-result.v1';
export const INFORMATION_ACQUISITION_OPTION_CONTRACT_VERSION = 'adr.information-acquisition-option.v1';
export const INFORMATION_REQUIREMENT_STATUS_CONTRACT_VERSION = 'adr.information-requirement-status.v1';

export const INFORMATION_REQUIREMENT_STATUSES = deepFreeze([
  'OPEN',
  'SATISFIED',
  'UNSATISFIABLE',
  'NO_LONGER_DECISION_MATERIAL'
]);

export const INFORMATION_ACQUISITION_CHANNELS = deepFreeze([
  'EXISTING_CONTEXT',
  'DERIVED_STATE',
  'REMOTE_SENSING',
  'CUSTOMER_API',
  'USER_QUESTION',
  'SCOUTING',
  'LABORATORY',
  'SENSOR'
]);

export const INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES = deepFreeze([
  'MISSING_CONTEXT',
  'RUNTIME_PROFILE_CONTEXT'
]);

const STATUS_SET = new Set(INFORMATION_REQUIREMENT_STATUSES);
const CHANNEL_SET = new Set(INFORMATION_ACQUISITION_CHANNELS);
const EPISTEMIC_SET = new Set(EPISTEMIC_CLASSES);
const PROVENANCE_SET = new Set(PROVENANCE_CLASSES);
const ADDRESSABLE_TYPE_SET = new Set(INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES);
const ALLOWED_REASON_CODES = new Set([
  'MISSING_CONTEXT:MISSING_CONTEXT_SEMANTIC_ID',
  'RUNTIME_PROFILE_CONTEXT:REQUIRED_SEMANTIC_MISSING',
  'RUNTIME_PROFILE_CONTEXT:EPISTEMIC_CLASS_UNSATISFIED'
]);
const REQUIREMENT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'requirementId', 'planRef',
  'decisionProblemRef', 'deploymentRef', 'runtimeProfileRef', 'originContextManifestRef',
  'semanticId', 'requiredBy', 'runtimePlanRequirementIds', 'reasonCodes',
  'acceptableEpistemicClasses', 'acceptableProvenanceClasses', 'acceptanceConstraintBasis',
  'requiredResolution', 'deadline', 'decisionMateriality', 'status', 'statusBasis', 'semanticHash'
]);
const PLAN_REF_KEYS = new Set(['planId', 'planHash', 'compilerVersion']);
const REQUIRED_BY_KEYS = new Set(['sourceType', 'authorityRef']);
const CONSTRAINT_BASIS_KEYS = new Set(['epistemic', 'provenance']);
const RESOLUTION_KEYS = new Set(['mode', 'semanticId', 'minimumMatchingDatumCount']);
const STATUS_BASIS_KEYS = new Set(['type', 'planHash']);
const CAPABILITY_KEYS = new Set([
  'capabilityId', 'providerId', 'channel', 'semanticIds', 'epistemicClasses',
  'provenanceClasses', 'relativeCostRank', 'estimatedLatencySeconds', 'qualityDescriptor'
]);

export class InformationRequirementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InformationRequirementError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function exactObject(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_INPUT', `${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_FIELD', `${name}.${key} is not part of the frozen R02 contract`);
    }
  }
}

export function canonicalStrings(values, name, { allowed = null, nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_INPUT', `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new InformationRequirementError('DUPLICATE_INFORMATION_REQUIREMENT_VALUE', `${name} cannot contain duplicates`);
  }
  if (allowed) {
    for (const value of normalized) {
      if (!allowed.has(value)) {
        throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_VALUE', `${name} contains unsupported value ${value}`);
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

export function normalizePlanRef(value, name = 'planRef') {
  exactObject(value, name, PLAN_REF_KEYS);
  const normalized = {
    planId: text(value.planId, `${name}.planId`),
    planHash: text(value.planHash, `${name}.planHash`),
    compilerVersion: text(value.compilerVersion, `${name}.compilerVersion`)
  };
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized.planHash)) {
    throw new InformationRequirementError('INVALID_INFORMATION_PLAN_HASH', `${name}.planHash must be an exact SHA-256 semantic hash`);
  }
  return deepFreeze(normalized);
}

export function samePlanRef(left, right) {
  const a = normalizePlanRef(left, 'leftPlanRef');
  const b = normalizePlanRef(right, 'rightPlanRef');
  return a.planId === b.planId && a.planHash === b.planHash && a.compilerVersion === b.compilerVersion;
}

function normalizeRequiredBy(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIRED_BY', 'requiredBy must be a non-empty array');
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `requiredBy[${index}]`, REQUIRED_BY_KEYS);
    const sourceType = text(value.sourceType, `requiredBy[${index}].sourceType`);
    const authorityRef = assertAuthorityRef(value.authorityRef);
    const expectedKind = sourceType === 'APPLICABILITY_ASSESSMENT'
      ? 'ApplicabilityAssessment'
      : sourceType === 'RUNTIME_PROFILE'
        ? 'RuntimeProfile'
        : null;
    if (!expectedKind || authorityRef.kind !== expectedKind) {
      throw new InformationRequirementError(
        'INVALID_INFORMATION_REQUIRED_BY',
        `requiredBy[${index}] sourceType/ref kind is outside the frozen R02 provenance vocabulary`
      );
    }
    return deepFreeze({ sourceType, authorityRef });
  });
  const keyed = normalized.map((item) => [semanticHash('InformationRequirementRequiredBy', item), item]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new InformationRequirementError('DUPLICATE_INFORMATION_REQUIRED_BY', 'requiredBy cannot contain duplicate authority descriptors');
  }
  return deepFreeze(keyed.sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item));
}

function normalizeConstraintBasis(value) {
  exactObject(value, 'acceptanceConstraintBasis', CONSTRAINT_BASIS_KEYS);
  const epistemic = text(value.epistemic, 'acceptanceConstraintBasis.epistemic');
  const provenance = text(value.provenance, 'acceptanceConstraintBasis.provenance');
  if (!['EXACT_RUNTIME_PROFILE_CONSTRAINT', 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT'].includes(epistemic)) {
    throw new InformationRequirementError('INVALID_INFORMATION_CONSTRAINT_BASIS', 'unsupported epistemic acceptance constraint basis');
  }
  if (provenance !== 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT') {
    throw new InformationRequirementError(
      'INVALID_INFORMATION_CONSTRAINT_BASIS',
      'R02 v1 cannot invent a provenance restriction absent an upstream RuntimeProfile provenance contract'
    );
  }
  return deepFreeze({ epistemic, provenance });
}

function normalizeResolution(value, semanticId) {
  exactObject(value, 'requiredResolution', RESOLUTION_KEYS);
  if (value.mode !== 'CONTEXT_DATUM_SEMANTIC_ID_PRESENT'
    || text(value.semanticId, 'requiredResolution.semanticId') !== semanticId
    || value.minimumMatchingDatumCount !== 1) {
    throw new InformationRequirementError(
      'INVALID_INFORMATION_REQUIRED_RESOLUTION',
      'R02 v1 resolution is exactly one acceptable ContextDatum for the required semantic id'
    );
  }
  return deepFreeze({
    mode: 'CONTEXT_DATUM_SEMANTIC_ID_PRESENT',
    semanticId,
    minimumMatchingDatumCount: 1
  });
}

function normalizeStatusBasis(value, plan) {
  exactObject(value, 'statusBasis', STATUS_BASIS_KEYS);
  if (value.type !== 'ORIGIN_RUNTIME_PLAN_OPEN_REQUIREMENT'
    || text(value.planHash, 'statusBasis.planHash') !== plan.planHash) {
    throw new InformationRequirementError(
      'INVALID_INFORMATION_STATUS_BASIS',
      'OPEN InformationRequirement must bind its exact origin RuntimePlan hash'
    );
  }
  return deepFreeze({ type: value.type, planHash: plan.planHash });
}

function normalizeAuthorityRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_REF', `${name} must be an exact ${kind} ref`);
  }
  return ref;
}

export function normalizeInformationRequirement(value) {
  exactObject(value, 'InformationRequirement', REQUIREMENT_KEYS);
  if (value.contractVersion !== INFORMATION_REQUIREMENT_CONTRACT_VERSION) {
    throw new InformationRequirementError('UNSUPPORTED_INFORMATION_REQUIREMENT_CONTRACT', `unsupported contractVersion ${value.contractVersion}`);
  }
  if (value.authorityClass !== 'INFORMATION_NEED_ONLY') {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_AUTHORITY_CLASS', 'InformationRequirement authority is information-need only');
  }
  const requirementId = text(value.requirementId, 'requirementId');
  if (!/^ir:[0-9a-f]{24}$/.test(requirementId)) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_ID', 'requirementId must use the frozen content-derived R02 identity format');
  }
  const plan = normalizePlanRef(value.planRef);
  const semanticId = text(value.semanticId, 'semanticId');
  const status = text(value.status, 'status');
  if (!STATUS_SET.has(status) || status !== 'OPEN') {
    throw new InformationRequirementError(
      'INVALID_INFORMATION_REQUIREMENT_STATUS',
      'base InformationRequirement is immutable OPEN need authority; later lifecycle is represented by a separate status read model'
    );
  }
  const reasonCodes = canonicalStrings(value.reasonCodes, 'reasonCodes', { allowed: ALLOWED_REASON_CODES, nonEmpty: true });
  if (!reasonCodes.some((code) => ADDRESSABLE_TYPE_SET.has(code.split(':')[0]))) {
    throw new InformationRequirementError('INVALID_INFORMATION_REASON_CODE', 'InformationRequirement must arise from an information-addressable RuntimePlan gap');
  }
  const acceptableEpistemicClasses = canonicalStrings(value.acceptableEpistemicClasses, 'acceptableEpistemicClasses', {
    allowed: EPISTEMIC_SET,
    nonEmpty: true
  });
  const acceptableProvenanceClasses = canonicalStrings(value.acceptableProvenanceClasses, 'acceptableProvenanceClasses', {
    allowed: PROVENANCE_SET,
    nonEmpty: true
  });
  const constraintBasis = normalizeConstraintBasis(value.acceptanceConstraintBasis);
  if (constraintBasis.provenance === 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT'
    && canonicalizeSemanticJson(acceptableProvenanceClasses) !== canonicalizeSemanticJson([...PROVENANCE_CLASSES].sort())) {
    throw new InformationRequirementError(
      'INFORMATION_PROVENANCE_RESTRICTION_WITHOUT_AUTHORITY',
      'R02 cannot narrow provenance classes when no upstream RuntimeProfile provenance restriction exists'
    );
  }
  const normalized = {
    contractVersion: INFORMATION_REQUIREMENT_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_NEED_ONLY',
    requirementId,
    planRef: plan,
    decisionProblemRef: normalizeAuthorityRef(value.decisionProblemRef, 'DecisionProblem', 'decisionProblemRef'),
    deploymentRef: normalizeAuthorityRef(value.deploymentRef, 'Deployment', 'deploymentRef'),
    runtimeProfileRef: normalizeAuthorityRef(value.runtimeProfileRef, 'RuntimeProfile', 'runtimeProfileRef'),
    originContextManifestRef: normalizeAuthorityRef(value.originContextManifestRef, 'ContextManifest', 'originContextManifestRef'),
    semanticId,
    requiredBy: normalizeRequiredBy(value.requiredBy),
    runtimePlanRequirementIds: canonicalStrings(value.runtimePlanRequirementIds, 'runtimePlanRequirementIds', { nonEmpty: true }),
    reasonCodes,
    acceptableEpistemicClasses,
    acceptableProvenanceClasses,
    acceptanceConstraintBasis: constraintBasis,
    requiredResolution: normalizeResolution(value.requiredResolution, semanticId),
    deadline: text(value.deadline, 'deadline'),
    decisionMateriality: text(value.decisionMateriality, 'decisionMateriality'),
    status: 'OPEN',
    statusBasis: normalizeStatusBasis(value.statusBasis, plan)
  };
  if (normalized.decisionMateriality !== 'MATERIAL') {
    throw new InformationRequirementError('INVALID_INFORMATION_MATERIALITY', 'R02 creates requirements only for decision-material gaps');
  }
  const suppliedHash = text(value.semanticHash, 'semanticHash');
  if (!/^sha256:[0-9a-f]{64}$/.test(suppliedHash)
    || semanticHash('InformationRequirement', normalized) !== suppliedHash) {
    throw new InformationRequirementError('INFORMATION_REQUIREMENT_HASH_MISMATCH', 'InformationRequirement semanticHash is not reproducible');
  }
  return deepFreeze({ ...cloneCanonicalValue(normalized), semanticHash: suppliedHash });
}

export function normalizeInformationAcquisitionCapability(value) {
  exactObject(value, 'InformationAcquisitionCapability', CAPABILITY_KEYS);
  const channel = text(value.channel, 'channel');
  if (!CHANNEL_SET.has(channel)) {
    throw new InformationRequirementError('INVALID_ACQUISITION_CHANNEL', `unsupported acquisition channel ${channel}`);
  }
  if (!Number.isSafeInteger(value.relativeCostRank) || value.relativeCostRank < 0) {
    throw new InformationRequirementError('INVALID_ACQUISITION_COST', 'relativeCostRank must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(value.estimatedLatencySeconds) || value.estimatedLatencySeconds < 0) {
    throw new InformationRequirementError('INVALID_ACQUISITION_LATENCY', 'estimatedLatencySeconds must be a non-negative safe integer');
  }
  return deepFreeze({
    capabilityId: text(value.capabilityId, 'capabilityId'),
    ...(value.providerId ? { providerId: text(value.providerId, 'providerId') } : {}),
    channel,
    semanticIds: canonicalStrings(value.semanticIds, 'semanticIds', { nonEmpty: true }),
    epistemicClasses: canonicalStrings(value.epistemicClasses, 'epistemicClasses', {
      allowed: EPISTEMIC_SET,
      nonEmpty: true
    }),
    provenanceClasses: canonicalStrings(value.provenanceClasses, 'provenanceClasses', {
      allowed: PROVENANCE_SET,
      nonEmpty: true
    }),
    relativeCostRank: value.relativeCostRank,
    estimatedLatencySeconds: value.estimatedLatencySeconds,
    ...(value.qualityDescriptor ? { qualityDescriptor: text(value.qualityDescriptor, 'qualityDescriptor') } : {})
  });
}

export function informationRequirementSemanticHash(payload) {
  return semanticHash('InformationRequirement', payload);
}
