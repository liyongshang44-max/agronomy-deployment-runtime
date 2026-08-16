import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION, AgronomistWorkbenchError } from './case.mjs';

export const AGRONOMIST_ESCALATION_QUEUE_CONTRACT_VERSION = 'adr.agronomist-escalation-queue.v1';

function validateCaseProjection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASE', 'workbench queue requires case projections');
  }
  if (value.contractVersion !== AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION
    || value.projectionKind !== 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE'
    || typeof value.caseProjectionHash !== 'string') {
    throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASE', 'case projection contract/kind/hash is invalid');
  }
  const { caseProjectionHash, ...basis } = value;
  if (semanticHash('AgronomistWorkbenchCaseProjection', basis) !== caseProjectionHash) {
    throw new AgronomistWorkbenchError('WORKBENCH_CASE_HASH_MISMATCH', 'case projection hash is not reproducible');
  }
  if ((value.classification === 'NO_REVIEW_CANDIDATE') === Boolean(value.reviewRequired)) {
    throw new AgronomistWorkbenchError('WORKBENCH_CASE_CLASSIFICATION_INCONSISTENT', 'reviewRequired contradicts product classification');
  }
  return value;
}

function itemFromCase(workbenchCase) {
  const c = validateCaseProjection(workbenchCase);
  return deepFreeze({
    caseProjectionHash: c.caseProjectionHash,
    classification: c.classification,
    reviewRequired: c.reviewRequired,
    reasonCodes: cloneCanonicalValue(c.reasonCodes),
    applicabilityAssessmentRef: c.applicability.applicabilityAssessmentRef,
    decisionProblemRef: c.targetContext.decisionProblemRef,
    contextManifestRef: c.targetContext.contextManifestRef,
    knowledgeRef: c.scientificEvidence.knowledgeRef,
    targetRef: cloneCanonicalValue(c.targetContext.targetRef),
    logicalTime: c.targetContext.logicalTime,
    transportStatus: c.applicability.transportStatus
  });
}

function itemKey(item) {
  return JSON.stringify([
    item.applicabilityAssessmentRef.kind,
    item.applicabilityAssessmentRef.logicalId,
    item.applicabilityAssessmentRef.version,
    item.applicabilityAssessmentRef.semanticHash
  ]);
}

export function buildAgronomistEscalationQueue({ cases, includeNoReviewCandidates = false }) {
  if (!Array.isArray(cases)) throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASES', 'cases must be an array');
  const all = cases.map(itemFromCase);
  const keys = all.map(itemKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomistWorkbenchError('DUPLICATE_WORKBENCH_CASE', 'queue cannot contain duplicate exact ApplicabilityAssessment cases');
  }
  const visible = all.filter((item) => includeNoReviewCandidates || item.reviewRequired);
  visible.sort((a, b) => {
    if (a.reviewRequired !== b.reviewRequired) return a.reviewRequired ? -1 : 1;
    const classification = a.classification.localeCompare(b.classification);
    if (classification !== 0) return classification;
    return itemKey(a).localeCompare(itemKey(b));
  });
  const projection = {
    contractVersion: AGRONOMIST_ESCALATION_QUEUE_CONTRACT_VERSION,
    projectionKind: 'NON_AUTHORITY_AGRONOMIST_ESCALATION_QUEUE',
    includeNoReviewCandidates: Boolean(includeNoReviewCandidates),
    totalInputCases: all.length,
    reviewRequiredCount: all.filter((item) => item.reviewRequired).length,
    noReviewCandidateCount: all.filter((item) => !item.reviewRequired).length,
    items: visible
  };
  return deepFreeze({
    ...projection,
    queueProjectionHash: semanticHash('AgronomistEscalationQueueProjection', projection)
  });
}

export function buildApplicabilityConflictQueue({ cases }) {
  const queue = buildAgronomistEscalationQueue({ cases, includeNoReviewCandidates: true });
  const conflicts = queue.items.filter((item) => item.classification === 'KNOWLEDGE_CONFLICT');
  const projection = {
    contractVersion: AGRONOMIST_ESCALATION_QUEUE_CONTRACT_VERSION,
    projectionKind: 'NON_AUTHORITY_APPLICABILITY_CONFLICT_QUEUE',
    items: conflicts,
    conflictCount: conflicts.length
  };
  return deepFreeze({
    ...projection,
    queueProjectionHash: semanticHash('ApplicabilityConflictQueueProjection', projection)
  });
}
