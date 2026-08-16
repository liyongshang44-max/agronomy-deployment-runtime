import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';

export const ESCALATION_READ_MODEL_CONTRACT_VERSION = 'adr.escalation-read-model.v1';
export const ESCALATION_CLASSIFICATIONS = deepFreeze([
  'NO_REVIEW_CANDIDATE',
  'AGRONOMIST_REVIEW_REQUIRED',
  'CONTEXT_GAP',
  'KNOWLEDGE_CONFLICT',
  'CALIBRATION_NEEDED',
  'GOVERNED_TRANSFORM_NEEDED'
]);

const CLASSIFICATION_SET = new Set(ESCALATION_CLASSIFICATIONS);

export class EscalationReadModelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EscalationReadModelError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EscalationReadModelError('INVALID_ESCALATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function canonicalReasons(values) {
  const normalized = values.map((value, index) => text(value, `reasonCodes[${index}]`));
  return deepFreeze([...new Set(normalized)].sort());
}

function objectCodes(values, prefix) {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    if (typeof value.code === 'string' && value.code.trim()) return [`${prefix}:${value.code.trim()}`];
    return [];
  });
}

function directNoReviewEligible(payload) {
  return payload.scientificUseStatus === 'QUALIFIED'
    && payload.decisionRelevance === 'MATERIAL'
    && payload.runtimeUse === 'ALLOWED'
    && (payload.conflicts ?? []).length === 0
    && (payload.missingContextSemanticIds ?? []).length === 0
    && (payload.unsupportedConstraintCodes ?? []).length === 0
    && (payload.requiredCalibrationCodes ?? []).length === 0
    && (payload.requiredTransformationRefs ?? []).length === 0
    && (payload.limitations ?? []).length === 0;
}

export function classifyApplicabilityPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new EscalationReadModelError('INVALID_ESCALATION_INPUT', 'Applicability payload is required');
  }
  const status = text(payload.transportStatus, 'transportStatus');
  const reasons = [];
  let classification;

  switch (status) {
    case 'CONFLICT':
      classification = 'KNOWLEDGE_CONFLICT';
      reasons.push('TRANSPORT_CONFLICT', ...objectCodes(payload.conflicts, 'CONFLICT'));
      break;
    case 'CALIBRATION_REQUIRED':
      classification = 'CALIBRATION_NEEDED';
      reasons.push('CALIBRATION_REQUIRED', ...(payload.requiredCalibrationCodes ?? []).map((code) => `CALIBRATION:${code}`));
      break;
    case 'APPLICABLE_WITH_GOVERNED_TRANSFORM':
      classification = 'GOVERNED_TRANSFORM_NEEDED';
      reasons.push('GOVERNED_TRANSFORM_REQUIRED');
      break;
    case 'UNRESOLVED':
      if ((payload.missingContextSemanticIds ?? []).length > 0) {
        classification = 'CONTEXT_GAP';
        reasons.push('MISSING_DECISION_MATERIAL_CONTEXT', ...(payload.missingContextSemanticIds ?? []).map((id) => `MISSING_CONTEXT:${id}`));
      } else {
        classification = 'AGRONOMIST_REVIEW_REQUIRED';
        reasons.push('UNRESOLVED_TRANSPORT', ...(payload.unsupportedConstraintCodes ?? []).map((code) => `UNSUPPORTED:${code}`));
      }
      break;
    case 'BOUNDED_EXTRAPOLATION':
      classification = 'AGRONOMIST_REVIEW_REQUIRED';
      reasons.push('BOUNDED_EXTRAPOLATION', ...objectCodes(payload.limitations, 'LIMITATION'));
      break;
    case 'NOT_RELEVANT':
      classification = 'NO_REVIEW_CANDIDATE';
      reasons.push('NOT_DECISION_RELEVANT');
      break;
    case 'DIRECTLY_APPLICABLE':
      if (directNoReviewEligible(payload)) {
        classification = 'NO_REVIEW_CANDIDATE';
        reasons.push('DIRECTLY_APPLICABLE_NO_BLOCKERS');
      } else {
        classification = 'AGRONOMIST_REVIEW_REQUIRED';
        reasons.push('DIRECT_APPLICABILITY_HAS_REVIEW_MATERIAL_LIMITATION');
        if (payload.scientificUseStatus !== 'QUALIFIED') reasons.push(`SCIENTIFIC_USE:${payload.scientificUseStatus}`);
        if (payload.decisionRelevance !== 'MATERIAL') reasons.push(`DECISION_RELEVANCE:${payload.decisionRelevance}`);
        if (payload.runtimeUse !== 'ALLOWED') reasons.push(`APPLICABILITY_RUNTIME_USE:${payload.runtimeUse}`);
        reasons.push(...objectCodes(payload.limitations, 'LIMITATION'));
        reasons.push(...(payload.unsupportedConstraintCodes ?? []).map((code) => `UNSUPPORTED:${code}`));
      }
      break;
    default:
      throw new EscalationReadModelError('UNSUPPORTED_TRANSPORT_STATUS', `unsupported Applicability transport status ${status}`);
  }

  if (!CLASSIFICATION_SET.has(classification)) {
    throw new EscalationReadModelError('INVALID_ESCALATION_CLASSIFICATION', `unsupported classification ${classification}`);
  }
  return deepFreeze({
    classification,
    reviewRequired: classification !== 'NO_REVIEW_CANDIDATE',
    reasonCodes: canonicalReasons(reasons)
  });
}

export function projectApplicabilityEscalation({
  ledger,
  applicabilityAssessmentRef,
  snapshotStore,
  allowHistorical = false
}) {
  const validated = validateApplicabilityAssessment({
    ledger,
    applicabilityAssessmentRef,
    snapshotStore,
    allowHistorical
  });
  const applicability = validated.semanticPayload;
  const retrieval = validated.retrievalAuthority.semanticPayload;
  const classification = classifyApplicabilityPayload(applicability);

  const projection = {
    contractVersion: ESCALATION_READ_MODEL_CONTRACT_VERSION,
    projectionKind: 'NON_AUTHORITY_WORKFLOW_READ_MODEL',
    classification: classification.classification,
    reviewRequired: classification.reviewRequired,
    reasonCodes: classification.reasonCodes,
    why: {
      decisionProblemRef: applicability.decisionProblemRef,
      contextManifestRef: applicability.contextManifestRef,
      knowledgeRetrievalResultRef: applicability.knowledgeRetrievalResultRef,
      applicabilityAssessmentRef: validated.record.ref,
      deploymentRef: retrieval.deploymentRef,
      runtimeProfileRef: retrieval.runtimeProfileRef,
      knowledgeReleaseRef: retrieval.knowledgeReleaseRef,
      knowledgeRef: applicability.knowledgeRef,
      knowledgeOriginContextRefs: applicability.knowledgeOriginContextRefs
    },
    explanation: {
      transportStatus: applicability.transportStatus,
      scientificUseStatus: applicability.scientificUseStatus,
      decisionRelevance: applicability.decisionRelevance,
      applicabilityRuntimeUse: applicability.runtimeUse,
      conditionResults: cloneCanonicalValue(applicability.conditionResults),
      missingContextSemanticIds: cloneCanonicalValue(applicability.missingContextSemanticIds),
      requiredCalibrationCodes: cloneCanonicalValue(applicability.requiredCalibrationCodes),
      requiredTransformationRefs: cloneCanonicalValue(applicability.requiredTransformationRefs),
      limitations: cloneCanonicalValue(applicability.limitations),
      conflicts: cloneCanonicalValue(applicability.conflicts),
      unsupportedConstraintCodes: cloneCanonicalValue(applicability.unsupportedConstraintCodes)
    }
  };
  return deepFreeze({
    ...projection,
    projectionHash: semanticHash('EscalationReadModelProjection', projection)
  });
}
