import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION, AgronomistWorkbenchError } from './case.mjs';

export const WORKBENCH_REVIEW_OUTCOMES = deepFreeze([
  'CONFIRMED_CLASSIFICATION',
  'REVIEWER_DISAGREED',
  'CONTEXT_REQUESTED',
  'AUTHORITY_ACTION_PERFORMED',
  'DEFERRED'
]);
const OUTCOME_SET = new Set(WORKBENCH_REVIEW_OUTCOMES);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function timestamp(value, name) {
  const raw = text(value, name);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT_TIME', `${name} must be a valid timestamp`);
  return parsed.toISOString();
}

function canonicalReasons(values) {
  if (!Array.isArray(values)) throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'reasonCodes must be an array');
  return deepFreeze([...new Set(values.map((value, index) => text(value, `reasonCodes[${index}]`)))].sort());
}

function validateCase(workbenchCase) {
  if (!workbenchCase || typeof workbenchCase !== 'object' || Array.isArray(workbenchCase)
    || workbenchCase.contractVersion !== AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION
    || workbenchCase.projectionKind !== 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE') {
    throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASE', 'review instrumentation requires an exact A11 case projection');
  }
  const { caseProjectionHash, ...basis } = workbenchCase;
  if (typeof caseProjectionHash !== 'string'
    || semanticHash('AgronomistWorkbenchCaseProjection', basis) !== caseProjectionHash) {
    throw new AgronomistWorkbenchError('WORKBENCH_CASE_HASH_MISMATCH', 'review instrumentation requires a reproducible case projection');
  }
  return workbenchCase;
}

export function startWorkbenchReviewMeasurement({ workbenchCase, reviewerId, startedAt }) {
  const c = validateCase(workbenchCase);
  const basis = {
    measurementKind: 'NON_AUTHORITY_WORKFLOW_METRIC',
    caseProjectionHash: c.caseProjectionHash,
    applicabilityAssessmentRef: c.applicability.applicabilityAssessmentRef,
    classificationAtStart: c.classification,
    reviewerId: text(reviewerId, 'reviewerId'),
    startedAt: timestamp(startedAt, 'startedAt')
  };
  return deepFreeze({
    ...basis,
    measurementId: semanticHash('AgronomistWorkbenchReviewMeasurement', basis)
  });
}

export function completeWorkbenchReviewMeasurement({ session, completedAt, outcome, reasonCodes = [] }) {
  if (!session || typeof session !== 'object' || Array.isArray(session)
    || session.measurementKind !== 'NON_AUTHORITY_WORKFLOW_METRIC'
    || typeof session.measurementId !== 'string') {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'valid review measurement session is required');
  }
  const normalizedOutcome = text(outcome, 'outcome');
  if (!OUTCOME_SET.has(normalizedOutcome)) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_OUTCOME', `unsupported review outcome ${normalizedOutcome}`);
  }
  const end = timestamp(completedAt, 'completedAt');
  const startMs = new Date(session.startedAt).getTime();
  const endMs = new Date(end).getTime();
  if (endMs < startMs) throw new AgronomistWorkbenchError('REVIEW_COMPLETED_BEFORE_START', 'completedAt cannot precede startedAt');
  const basis = {
    ...session,
    completedAt: end,
    durationMs: endMs - startMs,
    outcome: normalizedOutcome,
    reasonCodes: canonicalReasons(reasonCodes)
  };
  return deepFreeze({
    ...basis,
    completionHash: semanticHash('AgronomistWorkbenchReviewCompletion', basis)
  });
}

export function summarizeWorkbenchReviewMeasurements(measurements) {
  if (!Array.isArray(measurements)) throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENTS', 'measurements must be an array');
  const classificationCounts = {};
  const outcomeCounts = {};
  const reasonCounts = {};
  let totalDurationMs = 0;
  for (const measurement of measurements) {
    if (!measurement || measurement.measurementKind !== 'NON_AUTHORITY_WORKFLOW_METRIC'
      || typeof measurement.completionHash !== 'string' || !Number.isInteger(measurement.durationMs) || measurement.durationMs < 0) {
      throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'summary accepts only completed workbench review measurements');
    }
    const { completionHash, ...basis } = measurement;
    if (semanticHash('AgronomistWorkbenchReviewCompletion', basis) !== completionHash) {
      throw new AgronomistWorkbenchError('REVIEW_MEASUREMENT_HASH_MISMATCH', 'review measurement completion hash is not reproducible');
    }
    classificationCounts[measurement.classificationAtStart] = (classificationCounts[measurement.classificationAtStart] ?? 0) + 1;
    outcomeCounts[measurement.outcome] = (outcomeCounts[measurement.outcome] ?? 0) + 1;
    for (const reason of measurement.reasonCodes) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    totalDurationMs += measurement.durationMs;
  }
  const summary = {
    metricKind: 'NON_AUTHORITY_WORKFLOW_SUMMARY',
    reviewedCaseCount: measurements.length,
    totalReviewDurationMs: totalDurationMs,
    averageReviewDurationMs: measurements.length === 0 ? null : totalDurationMs / measurements.length,
    classificationCounts,
    outcomeCounts,
    reasonCounts
  };
  return deepFreeze({
    ...summary,
    summaryHash: semanticHash('AgronomistWorkbenchReviewSummary', summary)
  });
}
