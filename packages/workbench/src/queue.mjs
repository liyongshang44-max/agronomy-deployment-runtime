import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { AgronomistWorkbenchError, validateAgronomistWorkbenchCase } from './case.mjs';

export const AGRONOMIST_ESCALATION_QUEUE_CONTRACT_VERSION = 'adr.agronomist-escalation-queue.v1';

function itemFromCase(workbenchCase) {
  return deepFreeze({
    caseProjectionHash: workbenchCase.caseProjectionHash,
    classification: workbenchCase.classification,
    reviewRequired: workbenchCase.reviewRequired,
    reasonCodes: cloneCanonicalValue(workbenchCase.reasonCodes),
    applicabilityAssessmentRef: workbenchCase.applicability.applicabilityAssessmentRef,
    decisionProblemRef: workbenchCase.targetContext.decisionProblemRef,
    contextManifestRef: workbenchCase.targetContext.contextManifestRef,
    knowledgeRef: workbenchCase.scientificEvidence.knowledgeRef,
    targetRef: cloneCanonicalValue(workbenchCase.targetContext.targetRef),
    programId: workbenchCase.targetContext.programId,
    logicalTime: workbenchCase.targetContext.logicalTime,
    transportStatus: workbenchCase.applicability.transportStatus
  });
}

function itemKey(item) {
  const ref = item.applicabilityAssessmentRef;
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function aggregateValidatedCases(cases, includeNoReviewCandidates) {
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

function validateCaseInputs(caseInputs, allowHistorical) {
  if (!Array.isArray(caseInputs)) {
    throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASES', 'caseInputs must be an array');
  }
  return caseInputs.map((input, index) => {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !input.ledger || !input.workbenchCase) {
      throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASE', `caseInputs[${index}] must include ledger and workbenchCase`);
    }
    return validateAgronomistWorkbenchCase({
      ledger: input.ledger,
      workbenchCase: input.workbenchCase,
      sourceRegistry: input.sourceRegistry,
      snapshotStore: input.snapshotStore,
      allowHistorical: input.allowHistorical ?? allowHistorical
    });
  });
}

export function projectAgronomistEscalationQueue({
  caseInputs,
  includeNoReviewCandidates = false,
  allowHistorical = false
}) {
  const validated = validateCaseInputs(caseInputs, allowHistorical);
  return aggregateValidatedCases(validated, includeNoReviewCandidates);
}

export function projectApplicabilityConflictQueue({ caseInputs, allowHistorical = false }) {
  const validated = validateCaseInputs(caseInputs, allowHistorical);
  const queue = aggregateValidatedCases(validated, true);
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
