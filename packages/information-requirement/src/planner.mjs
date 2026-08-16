import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { EPISTEMIC_CLASSES, PROVENANCE_CLASSES } from '../../context-contract/src/index.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../runtime-profile/src/index.mjs';
import { compileRuntimePlan } from '../../runtime-plan/src/index.mjs';
import {
  INFORMATION_ACQUISITION_OPTION_CONTRACT_VERSION,
  INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES,
  INFORMATION_PLANNING_RESULT_CONTRACT_VERSION,
  INFORMATION_REQUIREMENT_CONTRACT_VERSION,
  InformationRequirementError,
  canonicalStrings,
  normalizeInformationAcquisitionCapability,
  normalizeInformationRequirement,
  normalizePlanRef,
  text
} from './contract.mjs';

const ADDRESSABLE_TYPE_SET = new Set(INFORMATION_ADDRESSABLE_REQUIREMENT_TYPES);

function runtimePlanIdentity(plan) {
  return normalizePlanRef({
    planId: plan.planId,
    planHash: plan.planHash,
    compilerVersion: plan.compilerVersion
  });
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
      const ref = assertAuthorityRef(requirement.sourceApplicabilityAssessmentRef);
      if (ref.kind !== 'ApplicabilityAssessment') {
        throw new InformationRequirementError('INVALID_INFORMATION_REQUIRED_BY', 'sourceApplicabilityAssessmentRef must be exact ApplicabilityAssessment');
      }
      descriptors.push({ sourceType: 'APPLICABILITY_ASSESSMENT', authorityRef: ref });
    }
    if (requirement.sourceRuntimeProfileRef) {
      const ref = assertAuthorityRef(requirement.sourceRuntimeProfileRef);
      if (ref.kind !== 'RuntimeProfile') {
        throw new InformationRequirementError('INVALID_INFORMATION_REQUIRED_BY', 'sourceRuntimeProfileRef must be exact RuntimeProfile');
      }
      descriptors.push({ sourceType: 'RUNTIME_PROFILE', authorityRef: ref });
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

function acceptableContextClasses(profile, semanticId) {
  const configured = profile.contextRequirements.epistemicConstraints[semanticId];
  return deepFreeze({
    epistemic: configured?.length
      ? canonicalStrings(configured, 'acceptableEpistemicClasses', { nonEmpty: true })
      : deepFreeze([...EPISTEMIC_CLASSES].sort()),
    provenance: deepFreeze([...PROVENANCE_CLASSES].sort()),
    basis: {
      epistemic: configured?.length
        ? 'EXACT_RUNTIME_PROFILE_CONSTRAINT'
        : 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT',
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

function informationAddressableGroups(plan) {
  const groups = new Map();
  const nonInformationBlockers = [];
  for (const requirement of plan.openRequirements) {
    if (ADDRESSABLE_TYPE_SET.has(requirement.requirementType) && requirement.semanticId) {
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

function buildRequirement({ plan, decision, profile, semanticId, sourceRequirements }) {
  const classes = acceptableContextClasses(profile, semanticId);
  const reasonCodes = canonicalStrings(
    sourceRequirements.map((requirement) => `${requirement.requirementType}:${requirement.code}`),
    'reasonCodes',
    { nonEmpty: true }
  );
  const payload = {
    contractVersion: INFORMATION_REQUIREMENT_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_NEED_ONLY',
    requirementId: stableRequirementId({ plan, semanticId }),
    planRef: runtimePlanIdentity(plan),
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
    reasonCodes,
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
  return normalizeInformationRequirement({
    ...payload,
    semanticHash: semanticHash('InformationRequirement', payload)
  });
}

function derivePlanningCore({ ledger, runtimePlan, snapshotStore }) {
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
  return deepFreeze({ plan, requirements, nonInformationBlockers });
}

function intersection(left, right) {
  const allowed = new Set(right);
  return left.filter((value) => allowed.has(value));
}

function optionsForRequirement(requirement, capabilities) {
  const options = [];
  for (const capability of capabilities) {
    if (!capability.semanticIds.includes(requirement.semanticId)) continue;
    const epistemic = intersection(capability.epistemicClasses, requirement.acceptableEpistemicClasses).sort();
    const provenance = intersection(capability.provenanceClasses, requirement.acceptableProvenanceClasses).sort();
    if (epistemic.length === 0 || provenance.length === 0) continue;
    const basis = {
      requirementId: requirement.requirementId,
      requirementSemanticHash: requirement.semanticHash,
      capabilityId: capability.capabilityId,
      semanticId: requirement.semanticId,
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
      requirementId: requirement.requirementId,
      requirementSemanticHash: requirement.semanticHash,
      capabilityId: capability.capabilityId,
      ...(capability.providerId ? { providerId: capability.providerId } : {}),
      channel: capability.channel,
      semanticId: requirement.semanticId,
      acceptableEpistemicClasses: deepFreeze(epistemic),
      acceptableProvenanceClasses: deepFreeze(provenance),
      relativeCostRank: capability.relativeCostRank,
      estimatedLatencySeconds: capability.estimatedLatencySeconds,
      ...(capability.qualityDescriptor ? { qualityDescriptor: capability.qualityDescriptor } : {}),
      evidenceStatus: 'NOT_EVIDENCE',
      requirementStatusEffect: 'NONE_UNTIL_AUTHORIZED_CONTEXT_EXISTS'
    };
    options.push(deepFreeze({ ...option, semanticHash: semanticHash('InformationAcquisitionOption', option) }));
  }
  return deepFreeze(options.sort((left, right) =>
    left.relativeCostRank - right.relativeCostRank
      || left.estimatedLatencySeconds - right.estimatedLatencySeconds
      || left.capabilityId.localeCompare(right.capabilityId)));
}

function exactRequirementMatch(requirement, expected) {
  const normalized = normalizeInformationRequirement(requirement);
  return normalized.requirementId === expected.requirementId
    && normalized.semanticHash === expected.semanticHash
    && canonicalizeSemanticJson(normalized) === canonicalizeSemanticJson(expected);
}

export function validateInformationRequirementAgainstPlan({
  ledger,
  originRuntimePlan,
  requirement,
  snapshotStore
}) {
  const core = derivePlanningCore({ ledger, runtimePlan: originRuntimePlan, snapshotStore });
  const normalized = normalizeInformationRequirement(requirement);
  const expected = core.requirements.find((candidate) => candidate.requirementId === normalized.requirementId);
  if (!expected || !exactRequirementMatch(normalized, expected)) {
    throw new InformationRequirementError(
      'INFORMATION_REQUIREMENT_ORIGIN_MISMATCH',
      'InformationRequirement must be exactly reproducible from the supplied exact origin RuntimePlan'
    );
  }
  return deepFreeze({ requirement: expected, originPlan: core.plan, planningCore: core });
}

export function buildInformationAcquisitionOptions({
  ledger,
  originRuntimePlan,
  requirement,
  capabilities = [],
  snapshotStore
}) {
  if (!Array.isArray(capabilities)) {
    throw new InformationRequirementError('INVALID_ACQUISITION_CAPABILITIES', 'capabilities must be an array');
  }
  const authenticated = validateInformationRequirementAgainstPlan({
    ledger,
    originRuntimePlan,
    requirement,
    snapshotStore
  });
  const normalizedCapabilities = capabilities.map(normalizeInformationAcquisitionCapability);
  return optionsForRequirement(authenticated.requirement, normalizedCapabilities);
}

function planningResult({ plan, requirements, nonInformationBlockers, acquisitionOptions }) {
  const payload = {
    contractVersion: INFORMATION_PLANNING_RESULT_CONTRACT_VERSION,
    authorityClass: 'INFORMATION_PLANNING_NON_EVIDENCE',
    planRef: runtimePlanIdentity(plan),
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
  return deepFreeze({ ...payload, planningHash: semanticHash('InformationPlanningResult', payload) });
}

export function planInformationRequirements({
  ledger,
  runtimePlan,
  acquisitionCapabilities = [],
  snapshotStore
}) {
  if (!Array.isArray(acquisitionCapabilities)) {
    throw new InformationRequirementError('INVALID_ACQUISITION_CAPABILITIES', 'acquisitionCapabilities must be an array');
  }
  const core = derivePlanningCore({ ledger, runtimePlan, snapshotStore });
  const normalizedCapabilities = acquisitionCapabilities.map(normalizeInformationAcquisitionCapability);
  const acquisitionOptions = deepFreeze(core.requirements
    .flatMap((requirement) => optionsForRequirement(requirement, normalizedCapabilities))
    .sort((left, right) =>
      left.requirementId.localeCompare(right.requirementId)
        || left.relativeCostRank - right.relativeCostRank
        || left.estimatedLatencySeconds - right.estimatedLatencySeconds
        || left.capabilityId.localeCompare(right.capabilityId)));
  return planningResult({
    plan: core.plan,
    requirements: core.requirements,
    nonInformationBlockers: core.nonInformationBlockers,
    acquisitionOptions
  });
}
