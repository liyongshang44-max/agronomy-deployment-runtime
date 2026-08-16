import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { AgronomistWorkbenchError, validateAgronomistWorkbenchCase } from './case.mjs';

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
  if (Number.isNaN(parsed.getTime())) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function canonicalReasons(values) {
  if (!Array.isArray(values)) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'reasonCodes must be an array');
  }
  return deepFreeze([...new Set(values.map((value, index) => text(value, `reasonCodes[${index}]`)))].sort());
}

function sessionBasis(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)
    || session.measurementKind !== 'NON_AUTHORITY_WORKFLOW_METRIC') {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'valid review measurement session is required');
  }
  return {
    measurementKind: 'NON_AUTHORITY_WORKFLOW_METRIC',
    caseProjectionHash: text(session.caseProjectionHash, 'caseProjectionHash'),
    applicabilityAssessmentRef: session.applicabilityAssessmentRef,
    classificationAtStart: text(session.classificationAtStart, 'classificationAtStart'),
    reviewerId: text(session.reviewerId, 'reviewerId'),
    startedAt: timestamp(session.startedAt, 'startedAt')
  };
}

function validateSession(session) {
  const basis = sessionBasis(session);
  if (typeof session.measurementId !== 'string'
    || semanticHash('AgronomistWorkbenchReviewMeasurement', basis) !== session.measurementId) {
    throw new AgronomistWorkbenchError('REVIEW_MEASUREMENT_SESSION_HASH_MISMATCH', 'review measurement session hash is not reproducible');
  }
  return deepFreeze({ ...basis, measurementId: session.measurementId });
}

export function startWorkbenchReviewMeasurement({
  ledger,
  workbenchCase,
  reviewerId,
  startedAt,
  sourceRegistry,
  snapshotStore,
  allowHistorical = false
}) {
  const c = validateAgronomistWorkbenchCase({
    ledger,
    workbenchCase,
    sourceRegistry,
    snapshotStore,
    allowHistorical
  });
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
  const validSession = validateSession(session);
  const normalizedOutcome = text(outcome, 'outcome');
  if (!OUTCOME_SET.has(normalizedOutcome)) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_OUTCOME', `unsupported review outcome ${normalizedOutcome}`);
  }
  const end = timestamp(completedAt, 'completedAt');
  const startMs = new Date(validSession.startedAt).getTime();
  const endMs = new Date(end).getTime();
  if (endMs < startMs) {
    throw new AgronomistWorkbenchError('REVIEW_COMPLETED_BEFORE_START', 'completedAt cannot precede startedAt');
  }
  const basis = {
    ...validSession,
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

function validateCompletion(measurement) {
  if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)
    || typeof measurement.completionHash !== 'string'
    || !Number.isInteger(measurement.durationMs) || measurement.durationMs < 0) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENT', 'summary accepts only completed workbench review measurements');
  }
  validateSession(measurement);
  const { completionHash, ...basis } = measurement;
  if (semanticHash('AgronomistWorkbenchReviewCompletion', basis) !== completionHash) {
    throw new AgronomistWorkbenchError('REVIEW_MEASUREMENT_HASH_MISMATCH', 'review measurement completion hash is not reproducible');
  }
  return measurement;
}

export function summarizeWorkbenchReviewMeasurements(measurements) {
  if (!Array.isArray(measurements)) {
    throw new AgronomistWorkbenchError('INVALID_REVIEW_MEASUREMENTS', 'measurements must be an array');
  }
  const classificationCounts = {};
  const outcomeCounts = {};
  const reasonCounts = {};
  let totalDurationMs = 0;
  for (const measurement of measurements.map(validateCompletion)) {
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
