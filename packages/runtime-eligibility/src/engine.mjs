import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';
import {
  planInformationRequirements,
  validateRuntimePlanForInformationPlanning
} from '../../information-requirement/src/index.mjs';
import {
  RUNTIME_ELIGIBILITY_AUTHORITY_CLASS,
  RUNTIME_ELIGIBILITY_CONTRACT_VERSION,
  RuntimeEligibilityError,
  normalizeRuntimeEligibility
} from './contract.mjs';

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function informationIdentity(requirement) {
  return deepFreeze({
    requirementId: requirement.requirementId,
    semanticHash: requirement.semanticHash
  });
}

function limitationKey(value) {
  return semanticHash('RuntimeEligibilityLimitation', value);
}

function canonicalLimitations(values) {
  const map = new Map();
  for (const value of values) map.set(limitationKey(value), deepFreeze(cloneCanonicalValue(value)));
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value));
}

function canonicalInformationRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = informationIdentity(value);
    map.set(canonicalizeSemanticJson(ref), ref);
  }
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value));
}

function resultNodeForPath(plan, path) {
  const nodeMap = new Map(plan.nodes.map((node) => [node.nodeId, node]));
  const resultNodes = path.nodeIds
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node) => node?.nodeType === 'RESULT');
  if (resultNodes.length !== 1) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_RESULT_NODE_REQUIRED',
      `RuntimePlan alternative ${path.pathId} must contain exactly one RESULT node`
    );
  }
  const result = resultNodes[0];
  if (!result.authorityRefs.some((ref) => sameAuthorityRef(ref, path.applicabilityAssessmentRef))) {
    throw new RuntimeEligibilityError(
      'RUNTIME_ELIGIBILITY_PATH_ASSESSMENT_MISMATCH',
      `RuntimePlan alternative ${path.pathId} result node does not bind its exact ApplicabilityAssessment`
    );
  }
  return result;
}

function mapHardReason(requirement) {
  const sourceCode = String(requirement.code ?? requirement.requirementType ?? 'UNKNOWN');
  let reasonCode;
  switch (requirement.requirementType) {
    case 'CALIBRATION_REQUIRED':
      reasonCode = 'CALIBRATION_AUTHORITY_REQUIRED';
      break;
    case 'REPLAY_REQUIREMENT':
      reasonCode = 'REPLAY_REQUIREMENT_UNSATISFIED';
      break;
    case 'UNSUPPORTED_CONSTRAINT':
      reasonCode = sourceCode.includes('TRANSFORM') ? 'PROHIBITED_TRANSFORM' : 'UNRESOLVABLE_SEMANTICS';
      break;
    case 'APPLICABILITY_CONFLICT': {
      const conflictCode = String(requirement.conflict?.code ?? sourceCode);
      reasonCode = conflictCode.includes('KNOWLEDGE_CONFLICT')
        ? 'KNOWLEDGE_CONFLICT'
        : 'UNRESOLVABLE_SEMANTICS';
      break;
    }
    case 'SCIENTIFIC_USE':
      if (sourceCode === 'PROHIBITED') reasonCode = 'KNOWLEDGE_USE_PROHIBITED';
      else if (sourceCode === 'REVOKED') reasonCode = 'KNOWLEDGE_REVOKED';
      else reasonCode = 'UNAUTHORIZED_KNOWLEDGE';
      break;
    case 'DECISION_RELEVANCE':
      reasonCode = 'KNOWLEDGE_NOT_DECISION_RELEVANT';
      break;
    case 'APPLICABILITY_RUNTIME_DISPOSITION':
      reasonCode = sourceCode === 'CONDITIONAL'
        ? 'RUNTIME_USE_CONDITIONAL_UNRESOLVED'
        : 'APPLICABILITY_RUNTIME_USE_BLOCKED';
      break;
    default:
      reasonCode = 'UNRESOLVABLE_RUNTIME_PLAN_REQUIREMENT';
      break;
  }
  return deepFreeze({
    reasonCode,
    runtimePlanRequirementId: requirement.requirementId,
    requirementType: requirement.requirementType,
    sourceCode
  });
}

function assessmentLimitations(assessment) {
  const payload = assessment.semanticPayload;
  const values = (payload.limitations ?? []).map((detail) => ({
    sourceApplicabilityAssessmentRef: assessment.record.ref,
    detail: cloneCanonicalValue(detail)
  }));
  if (payload.transportStatus === 'BOUNDED_EXTRAPOLATION'
    && !values.some((value) => value.detail?.code === 'BOUNDED_EXTRAPOLATION')) {
    values.push({
      sourceApplicabilityAssessmentRef: assessment.record.ref,
      detail: {
        code: 'BOUNDED_EXTRAPOLATION',
        source: 'APPLICABILITY_TRANSPORT_STATUS'
      }
    });
  }
  return canonicalLimitations(values);
}

function evaluatePath({ plan, path, requirementById, informationByPlanRequirementId, assessment }) {
  const resultNode = resultNodeForPath(plan, path);
  const requirements = resultNode.openRequirementRefs.map((requirementId) => {
    const requirement = requirementById.get(requirementId);
    if (!requirement) {
      throw new RuntimeEligibilityError(
        'RUNTIME_ELIGIBILITY_REQUIREMENT_MISSING',
        `RuntimePlan RESULT node references unknown requirement ${requirementId}`
      );
    }
    return requirement;
  });

  const informationRequirements = canonicalInformationRefs(
    requirements
      .map((requirement) => informationByPlanRequirementId.get(requirement.requirementId))
      .filter(Boolean)
  );
  const informationRequirementIds = new Set(
    requirements
      .filter((requirement) => informationByPlanRequirementId.has(requirement.requirementId))
      .map((requirement) => requirement.requirementId)
  );
  let hardRequirements = requirements.filter((requirement) =>
    !informationRequirementIds.has(requirement.requirementId));

  const hasSubstantiveCompanion = requirements.some((requirement) =>
    requirement.requirementType !== 'APPLICABILITY_RUNTIME_DISPOSITION');
  if (hasSubstantiveCompanion) {
    hardRequirements = hardRequirements.filter((requirement) =>
      requirement.requirementType !== 'APPLICABILITY_RUNTIME_DISPOSITION');
  }

  const reasonDetails = hardRequirements.map(mapHardReason);
  const reasonCodes = [...new Set(reasonDetails.map((detail) => detail.reasonCode))].sort();
  const limitations = assessmentLimitations(assessment);

  let disposition;
  if (hardRequirements.length > 0) disposition = 'NO_LEGAL_RUNTIME';
  else if (informationRequirements.length > 0) disposition = 'INFORMATION_REQUIRED';
  else if (limitations.length > 0) disposition = 'LEGAL_WITH_LIMITATIONS';
  else disposition = 'LEGAL';

  return deepFreeze({
    pathId: path.pathId,
    knowledgeRef: path.knowledgeRef,
    applicabilityAssessmentRef: path.applicabilityAssessmentRef,
    disposition,
    informationRequirements,
    limitations,
    reasonCodes: deepFreeze(reasonCodes),
    reasonDetails: deepFreeze(reasonDetails
      .sort((left, right) => semanticHash('RuntimeEligibilityReasonDetail', left)
        .localeCompare(semanticHash('RuntimeEligibilityReasonDetail', right))))
  });
}

export function buildRuntimeEligibility({ ledger, runtimePlan, snapshotStore }) {
  const plan = validateRuntimePlanForInformationPlanning({
    ledger,
    runtimePlan,
    snapshotStore
  });
  const informationPlanning = planInformationRequirements({
    ledger,
    runtimePlan: plan,
    acquisitionCapabilities: [],
    snapshotStore
  });

  const requirementById = new Map(plan.openRequirements.map((requirement) => [requirement.requirementId, requirement]));
  const informationByPlanRequirementId = new Map();
  for (const requirement of informationPlanning.informationRequirements) {
    for (const planRequirementId of requirement.runtimePlanRequirementIds) {
      if (informationByPlanRequirementId.has(planRequirementId)) {
        throw new RuntimeEligibilityError(
          'RUNTIME_ELIGIBILITY_INFORMATION_REQUIREMENT_AMBIGUOUS',
          `RuntimePlan requirement ${planRequirementId} maps to more than one InformationRequirement`
        );
      }
      informationByPlanRequirementId.set(planRequirementId, requirement);
    }
  }

  const assessments = plan.applicabilityAssessmentRefs.map((ref) => validateApplicabilityAssessment({
    ledger,
    applicabilityAssessmentRef: ref,
    snapshotStore
  }));
  const assessmentByRef = new Map(assessments.map((assessment) => [refKey(assessment.record.ref), assessment]));

  const alternatives = plan.alternativePaths.map((path) => {
    const assessment = assessmentByRef.get(refKey(path.applicabilityAssessmentRef));
    if (!assessment) {
      throw new RuntimeEligibilityError(
        'RUNTIME_ELIGIBILITY_ASSESSMENT_REQUIRED',
        `RuntimePlan alternative ${path.pathId} lacks its exact validated ApplicabilityAssessment`
      );
    }
    return evaluatePath({
      plan,
      path,
      requirementById,
      informationByPlanRequirementId,
      assessment
    });
  }).sort((left, right) => left.pathId.localeCompare(right.pathId));

  const legal = alternatives.filter((path) => path.disposition === 'LEGAL');
  const limited = alternatives.filter((path) => path.disposition === 'LEGAL_WITH_LIMITATIONS');
  const informationPending = alternatives.filter((path) => path.disposition === 'INFORMATION_REQUIRED');
  const hardBlocked = alternatives.filter((path) => path.disposition === 'NO_LEGAL_RUNTIME');

  let runtimeEligibility;
  let informationRequirements = [];
  let limitations = [];
  let reasonCodes = [];
  if (legal.length > 0) {
    runtimeEligibility = 'RUNTIME_ELIGIBLE';
  } else if (limited.length > 0) {
    runtimeEligibility = 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS';
    limitations = canonicalLimitations(limited.flatMap((path) => path.limitations));
    reasonCodes = ['LEGAL_RUNTIME_ONLY_WITH_LIMITATIONS'];
  } else if (informationPending.length > 0) {
    runtimeEligibility = 'INFORMATION_REQUIRED';
    informationRequirements = canonicalInformationRefs(
      informationPending.flatMap((path) => path.informationRequirements)
    );
    reasonCodes = ['DECISION_MATERIAL_INFORMATION_OPEN'];
  } else {
    runtimeEligibility = 'NO_LEGAL_RUNTIME';
    reasonCodes = [...new Set(hardBlocked.flatMap((path) => path.reasonCodes))].sort();
    if (reasonCodes.length === 0) reasonCodes = ['UNRESOLVABLE_RUNTIME_PLAN_REQUIREMENT'];
  }

  return normalizeRuntimeEligibility({
    contractVersion: RUNTIME_ELIGIBILITY_CONTRACT_VERSION,
    authorityClass: RUNTIME_ELIGIBILITY_AUTHORITY_CLASS,
    planRef: {
      planId: plan.planId,
      planHash: plan.planHash,
      compilerVersion: plan.compilerVersion
    },
    decisionProblemRef: plan.decisionProblemRef,
    deploymentRef: plan.deploymentRef,
    runtimeProfileRef: plan.runtimeProfileRef,
    contextManifestRef: plan.contextManifestRef,
    knowledgeRetrievalResultRef: plan.knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs: plan.applicabilityAssessmentRefs,
    runtimeEligibility,
    legalRuntimeCandidateCount: legal.length + limited.length,
    informationPendingCandidateCount: informationPending.length,
    hardBlockedCandidateCount: hardBlocked.length,
    informationRequirements,
    limitations,
    reasonCodes,
    alternativeEvaluations: alternatives,
    decisionAuthorityClaim: 'NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION'
  });
}
