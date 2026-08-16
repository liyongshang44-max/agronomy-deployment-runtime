import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';
import {
  INFORMATION_REQUIREMENT_STATUS_CONTRACT_VERSION,
  INFORMATION_REQUIREMENT_STATUSES,
  InformationRequirementError,
  exactObject,
  normalizeInformationAcquisitionCapability,
  normalizePlanRef,
  samePlanRef,
  text
} from './contract.mjs';
import {
  buildInformationAcquisitionOptions,
  planInformationRequirements,
  validateInformationRequirementAgainstPlan,
  validateRuntimePlanForInformationPlanning
} from './planner.mjs';

const STATUS_SET = new Set(INFORMATION_REQUIREMENT_STATUSES);

function runtimePlanIdentity(plan) {
  return normalizePlanRef({
    planId: plan.planId,
    planHash: plan.planHash,
    compilerVersion: plan.compilerVersion
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
    ...(successorPlan ? { successorPlanRef: runtimePlanIdentity(successorPlan) } : {}),
    status,
    satisfyingDatumRefs,
    basis: cloneCanonicalValue(basis),
    runtimeLegalityAuthority: 'NONE_R02_STATUS_IS_NOT_RUNTIME_ELIGIBILITY'
  };
  return deepFreeze({ ...payload, statusHash: semanticHash('InformationRequirementStatus', payload) });
}

export function deriveInformationRequirementStatus({
  ledger,
  originRuntimePlan,
  requirement,
  successorRuntimePlan,
  snapshotStore
}) {
  const authenticated = validateInformationRequirementAgainstPlan({
    ledger,
    originRuntimePlan,
    requirement,
    snapshotStore
  });
  const normalizedRequirement = authenticated.requirement;
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
  if (samePlanRef(normalizedRequirement.planRef, runtimePlanIdentity(successorPlan))) {
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
    if (sameAuthorityRef(successorManifest.record.ref, normalizedRequirement.originContextManifestRef)) {
      throw new InformationRequirementError(
        'INFORMATION_REQUIREMENT_NEW_CONTEXT_REQUIRED',
        'SATISFIED requires a successor ContextManifest rather than retroactive mutation of the origin context world'
      );
    }
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
  ledger,
  originRuntimePlan,
  requirement,
  capabilityCatalog,
  snapshotStore,
  reasonCode = 'NO_AUTHORIZED_ACQUISITION_PATH'
}) {
  const authenticated = validateInformationRequirementAgainstPlan({
    ledger,
    originRuntimePlan,
    requirement,
    snapshotStore
  });
  const normalizedRequirement = authenticated.requirement;
  exactObject(capabilityCatalog, 'capabilityCatalog', new Set([
    'completeness', 'capabilities', 'authorityClaim'
  ]));
  if (capabilityCatalog.completeness !== 'COMPLETE_FOR_REQUIREMENT'
    || capabilityCatalog.authorityClaim !== 'PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY') {
    throw new InformationRequirementError(
      'ACQUISITION_CATALOG_COMPLETENESS_REQUIRED',
      'UNSATISFIABLE requires an explicitly complete planning-only catalog with no evidence/runtime authority claim'
    );
  }
  if (!Array.isArray(capabilityCatalog.capabilities)) {
    throw new InformationRequirementError('INVALID_ACQUISITION_CAPABILITIES', 'capabilityCatalog.capabilities must be an array');
  }
  const capabilities = capabilityCatalog.capabilities.map(normalizeInformationAcquisitionCapability);
  const options = buildInformationAcquisitionOptions({
    ledger,
    originRuntimePlan: authenticated.originPlan,
    requirement: normalizedRequirement,
    capabilities,
    snapshotStore
  });
  if (options.length > 0) {
    throw new InformationRequirementError(
      'INFORMATION_REQUIREMENT_STILL_SATISFIABLE_BY_CATALOG',
      'UNSATISFIABLE cannot be derived while the declared-complete catalog contains a matching acquisition option'
    );
  }
  const catalogPayload = {
    completeness: 'COMPLETE_FOR_REQUIREMENT',
    authorityClaim: 'PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY',
    capabilities
  };
  return statusView({
    requirement: normalizedRequirement,
    successorPlan: null,
    status: 'UNSATISFIABLE',
    basis: {
      type: 'DECLARED_COMPLETE_ACQUISITION_CATALOG',
      reasonCode: text(reasonCode, 'reasonCode'),
      catalogHash: semanticHash('InformationAcquisitionCapabilityCatalog', catalogPayload),
      evidenceStatus: 'PLANNING_CAPABILITY_CATALOG_NOT_FIELD_EVIDENCE',
      runtimeLegalityStatus: 'NOT_EVALUATED_BY_R02'
    }
  });
}
