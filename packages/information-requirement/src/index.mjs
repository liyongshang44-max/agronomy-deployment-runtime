import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  EPISTEMIC_CLASSES,
  PROVENANCE_CLASSES
} from '../../context-contract/src/index.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../runtime-profile/src/index.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';
import { compileRuntimePlan } from '../../runtime-plan/src/index.mjs';

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

const STATUS_SET = new Set(INFORMATION_REQUIREMENT_STATUSES);
const CHANNEL_SET = new Set(INFORMATION_ACQUISITION_CHANNELS);
const EPISTEMIC_SET = new Set(EPISTEMIC_CLASSES);
const PROVENANCE_SET = new Set(PROVENANCE_CLASSES);
const INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES = new Set([
  'MISSING_CONTEXT',
  'RUNTIME_PROFILE_CONTEXT'
]);
const CAPABILITY_KEYS = new Set([
  'capabilityId',
  'providerId',
  'channel',
  'semanticIds',
  'epistemicClasses',
  'provenanceClasses',
  'relativeCostRank',
  'estimatedLatencySeconds',
  'qualityDescriptor'
]);
const REQUIREMENT_KEYS = new Set([
  'contractVersion',
  'authorityClass',
  'requirementId',
  'planRef',
  'decisionProblemRef',
  'deploymentRef',
  'runtimeProfileRef',
  'originContextManifestRef',
  'semanticId',
  'requiredBy',
  'runtimePlanRequirementIds',
  'reasonCodes',
  'acceptableEpistemicClasses',
  'acceptableProvenanceClasses',
  'acceptanceConstraintBasis',
  'requiredResolution',
  'deadline',
  'decisionMateriality',
  'status',
  'statusBasis',
  'semanticHash'
]);

export class InformationRequirementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InformationRequirementError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowedKeys) {
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

function canonicalStrings(values, name, { allowed = null, nonEmpty = false } = {}) {
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

function planRef(plan) {
  return deepFreeze({
    planId: text(plan.planId, 'RuntimePlan.planId'),
    planHash: text(plan.planHash, 'RuntimePlan.planHash'),
    compilerVersion: text(plan.compilerVersion, 'RuntimePlan.compilerVersion')
  });
}

function samePlanRef(left, right) {
  return left?.planId === right?.planId
    && left?.planHash === right?.planHash
    && left?.compilerVersion === right?.compilerVersion;
}

function runtimePlanReplayInput(ledger, plan, snapshotStore) {
  return {
    ledger,
    decisionProblemRef: plan.decisionProblemRef,
    deploymentRef: plan.deploymentRef,
    runtimeProfileRef: plan.runtimeProfileRef,
    contextManifestRef: plan.contextManifestRef,
    knowledgeRetrievalResultRef: plan.knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs: plan.applicabilityAssessmentRefs,
    ...(snapshotStore ? { snapshotStore } : {})
  };
}

export function validateRuntimePlanForInformationPlanning({ ledger, runtimePlan, snapshotStore }) {
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new InformationRequirementError('INVALID_LEDGER', 'R02 requires a replayable AuthorityLedger');
  }
  if (!runtimePlan || typeof runtimePlan !== 'object' || Array.isArray(runtimePlan)) {
    throw new InformationRequirementError('INVALID_RUNTIME_PLAN', 'R02 requires an exact RuntimePlan read model');
  }
  const expected = compileRuntimePlan(runtimePlanReplayInput(ledger, runtimePlan, snapshotStore));
  if (expected.planHash !== runtimePlan.planHash
    || expected.planId !== runtimePlan.planId
    || canonicalizeSemanticJson(expected) !== canonicalizeSemanticJson(runtimePlan)) {
    throw new InformationRequirementError(
      'RUNTIME_PLAN_REPLAY_MISMATCH',
      'supplied RuntimePlan does not reproduce from its exact current authority inputs'
    );
  }
  return expected;
}

function exactRequiredByDescriptors(requirements) {
  const descriptors = [];
  for (const requirement of requirements) {
    if (requirement.sourceApplicabilityAssessmentRef) {
      descriptors.push({
        sourceType: 'APPLICABILITY_ASSESSMENT',
        authorityRef: assertAuthorityRef(requirement.sourceApplicabilityAssessmentRef)
      });
    }
    if (requirement.sourceRuntimeProfileRef) {
      descriptors.push({
        sourceType: 'RUNTIME_PROFILE',
        authorityRef: assertAuthorityRef(requirement.sourceRuntimeProfileRef)
      });
    }
  }
  const map = new Map();
  for (const descriptor of descriptors) {
    map.set(semanticHash('InformationRequirementRequiredBy', descriptor), deepFreeze(descriptor));
  }
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value));
}

function reasonCodes(requirements) {
  return canonicalStrings(requirements.map((requirement) =>
    `${requirement.requirementType}:${requirement.code}`), 'reasonCodes', { nonEmpty: true });
}

function acceptableContextClasses(profile, semanticId) {
  const configured = profile.contextRequirements.epistemicConstraints[semanticId];
  const epistemic = configured?.length
    ? canonicalStrings(configured, 'acceptableEpistemicClasses', { allowed: EPISTEMIC_SET, nonEmpty: true })
    : deepFreeze([...EPISTEMIC_CLASSES].sort());
  return deepFreeze({
    epistemic,
    provenance: deepFreeze([...PROVENANCE_CLASSES].sort()),
    basis: {
      epistemic: configured?.length ? 'EXACT_RUNTIME_PROFILE_CONSTRAINT' : 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT',
      provenance: 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT'
    }
  });
}

function stableRequirementId({ plan, semanticId }) {
  const basis = {
    decisionProblemRef: plan.decisionProblemRef,
    deploymentRef: plan.deploymentRef,
    runtimeProfileRef: plan.runtimeProfileRef,
    semanticId
  };
  return `ir:${semanticHash('InformationRequirementLogicalIdentity', basis).slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function buildRequirement({ plan, decision, profile, semanticId, sourceRequirements }) {
  const classes = acceptableContextClasses(profile, semanticId);
  const payload = {
    contractVersion: INFORMATION_REQUIREMENT_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_NEED_ONLY',
    requirementId: stableRequirementId({ plan, semanticId }),
    planRef: planRef(plan),
    decisionProblemRef: plan.decisionProblemRef,
    deploymentRef: plan.deploymentRef,
    runtimeProfileRef: plan.runtimeProfileRef,
    originContextManifestRef: plan.contextManifestRef,
    semanticId,
    requiredBy: exactRequiredByDescriptors(sourceRequirements),
    runtimePlanRequirementIds: canonicalStrings(
      sourceRequirements.map((requirement) => text(requirement.requirementId, 'RuntimePlan.requirementId')),
      'runtimePlanRequirementIds',
      { nonEmpty: true }
    ),
    reasonCodes: reasonCodes(sourceRequirements),
    acceptableEpistemicClasses: classes.epistemic,
    acceptableProvenanceClasses: classes.provenance,
    acceptanceConstraintBasis: classes.basis,
    requiredResolution: {
      mode: 'CONTEXT_DATUM_SEMANTIC_ID_PRESENT',
      semanticId,
      minimumMatchingDatumCount: 1
    },
    deadline: text(decision.decisionDeadline, 'DecisionProblem.decisionDeadline'),
    decisionMateriality: 'MATERIAL',
    status: 'OPEN',
    statusBasis: {
      type: 'ORIGIN_RUNTIME_PLAN_OPEN_REQUIREMENT',
      planHash: plan.planHash
    }
  };
  return deepFreeze({
    ...payload,
    semanticHash: semanticHash('InformationRequirement', payload)
  });
}

export function normalizeInformationRequirement(value) {
  exactObject(value, 'InformationRequirement', REQUIREMENT_KEYS);
  if (value.contractVersion !== INFORMATION_REQUIREMENT_CONTRACT_VERSION) {
    throw new InformationRequirementError('UNSUPPORTED_INFORMATION_REQUIREMENT_CONTRACT', `unsupported contractVersion ${value.contractVersion}`);
  }
  if (value.authorityClass !== 'INFORMATION_NEED_ONLY') {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_AUTHORITY_CLASS', 'InformationRequirement authority is information-need only');
  }
  const status = text(value.status, 'status');
  if (!STATUS_SET.has(status)) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_STATUS', `unsupported status ${status}`);
  }
  const semanticId = text(value.semanticId, 'semanticId');
  const normalized = cloneCanonicalValue({
    ...value,
    semanticId,
    status,
    acceptableEpistemicClasses: canonicalStrings(value.acceptableEpistemicClasses, 'acceptableEpistemicClasses', {
      allowed: EPISTEMIC_SET,
      nonEmpty: true
    }),
    acceptableProvenanceClasses: canonicalStrings(value.acceptableProvenanceClasses, 'acceptableProvenanceClasses', {
      allowed: PROVENANCE_SET,
      nonEmpty: true
    })
  });
  const suppliedHash = text(normalized.semanticHash, 'semanticHash');
  delete normalized.semanticHash;
  if (semanticHash('InformationRequirement', normalized) !== suppliedHash) {
    throw new InformationRequirementError('INFORMATION_REQUIREMENT_HASH_MISMATCH', 'InformationRequirement semanticHash is not reproducible');
  }
  return deepFreeze({ ...normalized, semanticHash: suppliedHash });
}

function informationAddressableGroups(plan) {
  const groups = new Map();
  const nonInformationBlockers = [];
  for (const requirement of plan.openRequirements) {
    if (INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES.has(requirement.requirementType) && requirement.semanticId) {
      const semanticId = text(requirement.semanticId, 'RuntimePlan.openRequirement.semanticId');
      const list = groups.get(semanticId) ?? [];
      list.push(requirement);
      groups.set(semanticId, list);
    } else {
      nonInformationBlockers.push(cloneCanonicalValue(requirement));
    }
  }
  return { groups, nonInformationBlockers };
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

function intersection(left, right) {
  const allowed = new Set(right);
  return left.filter((value) => allowed.has(value));
}

export function buildInformationAcquisitionOptions({ requirement, capabilities = [] }) {
  const normalizedRequirement = normalizeInformationRequirement(requirement);
  if (!Array.isArray(capabilities)) {
    throw new InformationRequirementError('INVALID_ACQUISITION_CAPABILITIES', 'capabilities must be an array');
  }
  const normalizedCapabilities = capabilities.map(normalizeInformationAcquisitionCapability);
  const options = [];
  for (const capability of normalizedCapabilities) {
    if (!capability.semanticIds.includes(normalizedRequirement.semanticId)) continue;
    const epistemic = intersection(
      capability.epistemicClasses,
      normalizedRequirement.acceptableEpistemicClasses
    ).sort();
    const provenance = intersection(
      capability.provenanceClasses,
      normalizedRequirement.acceptableProvenanceClasses
    ).sort();
    if (epistemic.length === 0 || provenance.length === 0) continue;
    const basis = {
      requirementId: normalizedRequirement.requirementId,
      requirementSemanticHash: normalizedRequirement.semanticHash,
      capabilityId: capability.capabilityId,
      semanticId: normalizedRequirement.semanticId,
      channel: capability.channel,
      acceptableEpistemicClasses: epistemic,
      acceptableProvenanceClasses: provenance,
      relativeCostRank: capability.relativeCostRank,
      estimatedLatencySeconds: capability.estimatedLatencySeconds
    };
    const option = {
      contractVersion: INFORMATION_ACQUISITION_OPTION_CONTRACT_VERSION,
      authorityClass: 'ACQUISITION_OPTION_NON_EVIDENCE',
      optionId: `iao:${semanticHash('InformationAcquisitionOptionIdentity', basis).slice('sha256:'.length, 'sha256:'.length + 24)}`,
      requirementId: normalizedRequirement.requirementId,
      requirementSemanticHash: normalizedRequirement.semanticHash,
      capabilityId: capability.capabilityId,
      ...(capability.providerId ? { providerId: capability.providerId } : {}),
      channel: capability.channel,
      semanticId: normalizedRequirement.semanticId,
      acceptableEpistemicClasses: deepFreeze(epistemic),
      acceptableProvenanceClasses: deepFreeze(provenance),
      relativeCostRank: capability.relativeCostRank,
      estimatedLatencySeconds: capability.estimatedLatencySeconds,
      ...(capability.qualityDescriptor ? { qualityDescriptor: capability.qualityDescriptor } : {}),
      evidenceStatus: 'NOT_EVIDENCE',
      requirementStatusEffect: 'NONE_UNTIL_AUTHORIZED_CONTEXT_EXISTS'
    };
    options.push(deepFreeze({
      ...option,
      semanticHash: semanticHash('InformationAcquisitionOption', option)
    }));
  }
  return deepFreeze(options.sort((left, right) =>
    left.relativeCostRank - right.relativeCostRank
      || left.estimatedLatencySeconds - right.estimatedLatencySeconds
      || left.capabilityId.localeCompare(right.capabilityId)));
}

function planningResult({ plan, requirements, nonInformationBlockers, acquisitionOptions }) {
  const payload = {
    contractVersion: INFORMATION_PLANNING_RESULT_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_PLANNING_NON_EVIDENCE',
    planRef: planRef(plan),
    decisionProblemRef: plan.decisionProblemRef,
    deploymentRef: plan.deploymentRef,
    runtimeProfileRef: plan.runtimeProfileRef,
    contextManifestRef: plan.contextManifestRef,
    informationRequirements: requirements,
    nonInformationBlockers: deepFreeze(nonInformationBlockers
      .map(cloneCanonicalValue)
      .sort((left, right) => text(left.requirementId, 'nonInformationBlocker.requirementId')
        .localeCompare(text(right.requirementId, 'nonInformationBlocker.requirementId')))),
    acquisitionOptions,
    evidenceStatus: 'NO_ACQUISITION_OPTION_IS_EVIDENCE'
  };
  return deepFreeze({
    ...payload,
    planningHash: semanticHash('InformationPlanningResult', payload)
  });
}

export function planInformationRequirements({ ledger, runtimePlan, acquisitionCapabilities = [], snapshotStore }) {
  const plan = validateRuntimePlanForInformationPlanning({ ledger, runtimePlan, snapshotStore });
  const decisionAuthority = validateDecisionProblemAuthority({
    ledger,
    decisionProblemRef: plan.decisionProblemRef
  });
  const profileAuthority = validateRuntimeProfileAuthority({
    ledger,
    runtimeProfileRef: plan.runtimeProfileRef
  });
  const { groups, nonInformationBlockers } = informationAddressableGroups(plan);
  const requirements = deepFreeze([...groups.entries()]
    .map(([semanticId, sourceRequirements]) => buildRequirement({
      plan,
      decision: decisionAuthority.semanticPayload,
      profile: profileAuthority.semanticPayload,
      semanticId,
      sourceRequirements
    }))
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
  const options = deepFreeze(requirements.flatMap((requirement) =>
    buildInformationAcquisitionOptions({ requirement, capabilities: acquisitionCapabilities }))
    .sort((left, right) =>
      left.requirementId.localeCompare(right.requirementId)
        || left.relativeCostRank - right.relativeCostRank
        || left.estimatedLatencySeconds - right.estimatedLatencySeconds
        || left.capabilityId.localeCompare(right.capabilityId)));
  return planningResult({
    plan,
    requirements,
    nonInformationBlockers,
    acquisitionOptions: options
  });
}

function matchingContextDatumRefs({ ledger, manifest, requirement }) {
  const matches = [];
  for (const ref of manifest.semanticPayload.datumRefs) {
    const record = ledger.resolve(ref);
    const payload = record.semanticPayload;
    if (record.ref.kind !== 'ContextDatum') continue;
    if (payload.semanticId !== requirement.semanticId) continue;
    if (!requirement.acceptableEpistemicClasses.includes(payload.epistemicClass)) continue;
    if (!requirement.acceptableProvenanceClasses.includes(payload.provenanceClass)) continue;
    matches.push(record.ref);
  }
  return deepFreeze(matches.sort((left, right) =>
    canonicalizeSemanticJson(left).localeCompare(canonicalizeSemanticJson(right))));
}

function statusView({ requirement, successorPlan, status, satisfyingDatumRefs = [], basis }) {
  if (!STATUS_SET.has(status)) {
    throw new InformationRequirementError('INVALID_INFORMATION_REQUIREMENT_STATUS', `unsupported status ${status}`);
  }
  const payload = {
    contractVersion: INFORMATION_REQUIREMENT_STATUS_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_REQUIREMENT_STATUS_READ_MODEL',
    requirementId: requirement.requirementId,
    originRequirementSemanticHash: requirement.semanticHash,
    originPlanRef: requirement.planRef,
    ...(successorPlan ? { successorPlanRef: planRef(successorPlan) } : {}),
    status,
    satisfyingDatumRefs,
    basis: cloneCanonicalValue(basis)
  };
  return deepFreeze({
    ...payload,
    statusHash: semanticHash('InformationRequirementStatus', payload)
  });
}

export function deriveInformationRequirementStatus({
  ledger,
  requirement,
  successorRuntimePlan,
  snapshotStore
}) {
  const normalizedRequirement = normalizeInformationRequirement(requirement);
  const successorPlan = validateRuntimePlanForInformationPlanning({
    ledger,
    runtimePlan: successorRuntimePlan,
    snapshotStore
  });
  if (!sameAuthorityRef(successorPlan.decisionProblemRef, normalizedRequirement.decisionProblemRef)
    || !sameAuthorityRef(successorPlan.deploymentRef, normalizedRequirement.deploymentRef)
    || !sameAuthorityRef(successorPlan.runtimeProfileRef, normalizedRequirement.runtimeProfileRef)) {
    throw new InformationRequirementError(
      'INFORMATION_REQUIREMENT_SUCCESSOR_WORLD_MISMATCH',
      'status derivation requires the same exact DecisionProblem/Deployment/RuntimeProfile world'
    );
  }
  if (samePlanRef(normalizedRequirement.planRef, planRef(successorPlan))) {
    throw new InformationRequirementError(
      'INFORMATION_REQUIREMENT_SUCCESSOR_PLAN_REQUIRED',
      'status cannot advance against the same RuntimePlan snapshot'
    );
  }
  const successorPlanning = planInformationRequirements({
    ledger,
    runtimePlan: successorPlan,
    acquisitionCapabilities: [],
    snapshotStore
  });
  const persisted = successorPlanning.informationRequirements.find((item) =>
    item.requirementId === normalizedRequirement.requirementId);
  if (persisted) {
    return statusView({
      requirement: normalizedRequirement,
      successorPlan,
      status: 'OPEN',
      basis: {
        type: 'SUCCESSOR_RUNTIME_PLAN_REQUIREMENT_PERSISTS',
        successorRequirementSemanticHash: persisted.semanticHash
      }
    });
  }

  const successorManifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef: successorPlan.contextManifestRef,
    snapshotStore
  });
  const matches = matchingContextDatumRefs({
    ledger,
    manifest: successorManifest,
    requirement: normalizedRequirement
  });
  if (matches.length > 0) {
    return statusView({
      requirement: normalizedRequirement,
      successorPlan,
      status: 'SATISFIED',
      satisfyingDatumRefs: matches,
      basis: {
        type: 'SUCCESSOR_CONTEXT_AND_RECOMPILE',
        successorContextManifestRef: successorManifest.record.ref
      }
    });
  }
  return statusView({
    requirement: normalizedRequirement,
    successorPlan,
    status: 'NO_LONGER_DECISION_MATERIAL',
    basis: {
      type: 'SUCCESSOR_RUNTIME_PLAN_NO_LONGER_REQUIRES_SEMANTIC',
      successorContextManifestRef: successorManifest.record.ref
    }
  });
}

export function deriveUnsatisfiableInformationRequirementStatus({
  requirement,
  capabilityCatalog,
  reasonCode = 'NO_AUTHORIZED_ACQUISITION_PATH'
}) {
  const normalizedRequirement = normalizeInformationRequirement(requirement);
  exactObject(capabilityCatalog, 'capabilityCatalog', new Set(['completeness', 'capabilities']));
  if (capabilityCatalog.completeness !== 'COMPLETE_FOR_REQUIREMENT') {
    throw new InformationRequirementError(
      'ACQUISITION_CATALOG_COMPLETENESS_REQUIRED',
      'UNSATISFIABLE may be derived only from a catalog explicitly declared complete for this requirement'
    );
  }
  const capabilities = Array.isArray(capabilityCatalog.capabilities)
    ? capabilityCatalog.capabilities
    : (() => { throw new InformationRequirementError('INVALID_ACQUISITION_CAPABILITIES', 'capabilityCatalog.capabilities must be an array'); })();
  const options = buildInformationAcquisitionOptions({
    requirement: normalizedRequirement,
    capabilities
  });
  if (options.length > 0) {
    throw new InformationRequirementError(
      'INFORMATION_REQUIREMENT_STILL_SATISFIABLE_BY_CATALOG',
      'UNSATISFIABLE cannot be derived while the declared-complete catalog contains a matching acquisition option'
    );
  }
  return statusView({
    requirement: normalizedRequirement,
    successorPlan: null,
    status: 'UNSATISFIABLE',
    basis: {
      type: 'DECLARED_COMPLETE_ACQUISITION_CATALOG',
      reasonCode: text(reasonCode, 'reasonCode'),
      catalogHash: semanticHash('InformationAcquisitionCapabilityCatalog', {
        completeness: capabilityCatalog.completeness,
        capabilities: capabilities.map(normalizeInformationAcquisitionCapability)
      }),
      evidenceStatus: 'PLANNING_CAPABILITY_CATALOG_NOT_FIELD_EVIDENCE'
    }
  });
}
