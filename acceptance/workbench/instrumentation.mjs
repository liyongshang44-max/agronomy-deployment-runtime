import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import {
  completeWorkbenchReviewMeasurement,
  startWorkbenchReviewMeasurement,
  summarizeWorkbenchReviewMeasurements
} from '../../packages/workbench/src/index.mjs';
import { createWorkbenchWorld } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function start(world, options = {}) {
  return startWorkbenchReviewMeasurement({
    ledger: world.env.ledger,
    workbenchCase: options.workbenchCase ?? world.workbenchCase,
    reviewerId: options.reviewerId ?? 'agronomist-1',
    startedAt: options.startedAt ?? '2026-08-22T10:00:00Z',
    sourceRegistry: world.env.sourceRegistry
  });
}
function completed(world, {
  reviewerId = 'agronomist-1',
  startedAt = '2026-08-22T10:00:00Z',
  completedAt = '2026-08-22T10:03:30Z',
  outcome = 'CONFIRMED_CLASSIFICATION',
  reasonCodes = ['SOURCE_AND_TARGET_EVIDENCE_CHECKED']
} = {}) {
  const session = start(world, { reviewerId, startedAt });
  return completeWorkbenchReviewMeasurement({ session, completedAt, outcome, reasonCodes });
}

test('A11 instrumentation validates exact case authority/access then measures review duration without publishing authority', () => {
  const world = createWorkbenchWorld('metric-duration', { crop: 'wheat' });
  const before = world.env.ledger.exportSnapshot();
  const measurement = completed(world);
  const after = world.env.ledger.exportSnapshot();
  assert.equal(measurement.measurementKind, 'NON_AUTHORITY_WORKFLOW_METRIC');
  assert.equal(measurement.durationMs, 210000);
  assert.deepEqual(measurement.reasonCodes, ['SOURCE_AND_TARGET_EVIDENCE_CHECKED']);
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.audit.length, before.audit.length);
  assert.equal(after.lineage.length, before.lineage.length);
});

test('review measurement cannot start from a forged case even when its deterministic case hash is recomputed', () => {
  const world = createWorkbenchWorld('metric-forged-case');
  const { caseProjectionHash, ...basis } = world.workbenchCase;
  const forgedBasis = { ...basis, classification: 'NO_REVIEW_CANDIDATE', reviewRequired: false, reasonCodes: ['FORGED_KPI_CASE'] };
  const forged = { ...forgedBasis, caseProjectionHash: semanticHash('AgronomistWorkbenchCaseProjection', forgedBasis) };
  assert.throws(() => start(world, { workbenchCase: forged }), (error) => error?.code === 'WORKBENCH_CASE_REPLAY_MISMATCH');
});

test('tampered review session measurementId is rejected before completion', () => {
  const world = createWorkbenchWorld('metric-session-tamper');
  const session = start(world);
  const tampered = { ...session, classificationAtStart: 'NO_REVIEW_CANDIDATE' };
  assert.throws(() => completeWorkbenchReviewMeasurement({
    session: tampered,
    completedAt: '2026-08-22T10:01:00Z',
    outcome: 'DEFERRED'
  }), (error) => error?.code === 'REVIEW_MEASUREMENT_SESSION_HASH_MISMATCH');
});

test('review summary reports volume/time/classification/outcome/reason counts only', () => {
  const conflict = createWorkbenchWorld('metric-conflict', { crop: 'wheat' });
  const gap = createWorkbenchWorld('metric-gap', { includeCrop: false });
  const a = completed(conflict, {
    reviewerId: 'agronomist-a', completedAt: '2026-08-22T10:02:00Z',
    outcome: 'CONFIRMED_CLASSIFICATION', reasonCodes: ['KNOWLEDGE_CONFLICT_CONFIRMED']
  });
  const b = completed(gap, {
    reviewerId: 'agronomist-b', startedAt: '2026-08-22T11:00:00Z', completedAt: '2026-08-22T11:04:00Z',
    outcome: 'CONTEXT_REQUESTED', reasonCodes: ['MISSING_CROP_CONTEXT']
  });
  const summary = summarizeWorkbenchReviewMeasurements([a, b]);
  assert.equal(summary.metricKind, 'NON_AUTHORITY_WORKFLOW_SUMMARY');
  assert.equal(summary.reviewedCaseCount, 2);
  assert.equal(summary.totalReviewDurationMs, 360000);
  assert.equal(summary.averageReviewDurationMs, 180000);
  assert.equal(summary.classificationCounts.KNOWLEDGE_CONFLICT, 1);
  assert.equal(summary.classificationCounts.CONTEXT_GAP, 1);
  assert.equal(summary.outcomeCounts.CONFIRMED_CLASSIFICATION, 1);
  assert.equal(summary.outcomeCounts.CONTEXT_REQUESTED, 1);
  assert.equal(summary.reasonCounts.MISSING_CROP_CONTEXT, 1);
});

test('REVIEWER_DISAGREED is a workflow observation and cannot rewrite the frozen case classification', () => {
  const world = createWorkbenchWorld('metric-disagreement', { crop: 'wheat' });
  const originalHash = world.workbenchCase.caseProjectionHash;
  const originalClassification = world.workbenchCase.classification;
  const measurement = completed(world, {
    outcome: 'REVIEWER_DISAGREED', reasonCodes: ['NEEDS_SEPARATE_SCIENTIFIC_REASSESSMENT']
  });
  assert.equal(measurement.outcome, 'REVIEWER_DISAGREED');
  assert.equal(world.workbenchCase.caseProjectionHash, originalHash);
  assert.equal(world.workbenchCase.classification, originalClassification);
  assert.equal(originalClassification, 'KNOWLEDGE_CONFLICT');
});

test('completedAt before startedAt is rejected instead of producing negative review time', () => {
  const world = createWorkbenchWorld('metric-time-order');
  const session = start(world, { reviewerId: 'agronomist-time' });
  assert.throws(() => completeWorkbenchReviewMeasurement({
    session, completedAt: '2026-08-22T09:59:59Z', outcome: 'DEFERRED'
  }), (error) => error?.code === 'REVIEW_COMPLETED_BEFORE_START');
});

test('summary rejects a tampered workflow completion hash', () => {
  const world = createWorkbenchWorld('metric-tamper');
  const measurement = completed(world);
  const tampered = { ...measurement, durationMs: measurement.durationMs + 1 };
  assert.throws(() => summarizeWorkbenchReviewMeasurements([tampered]),
    (error) => error?.code === 'REVIEW_MEASUREMENT_HASH_MISMATCH');
});

test('summary also rejects a tampered embedded session even if attacker recomputes completion hash', () => {
  const world = createWorkbenchWorld('metric-session-summary-tamper');
  const measurement = completed(world);
  const { completionHash, ...basis } = measurement;
  const forgedBasis = { ...basis, classificationAtStart: 'NO_REVIEW_CANDIDATE' };
  const forged = { ...forgedBasis, completionHash: semanticHash('AgronomistWorkbenchReviewCompletion', forgedBasis) };
  assert.throws(() => summarizeWorkbenchReviewMeasurements([forged]),
    (error) => error?.code === 'REVIEW_MEASUREMENT_SESSION_HASH_MISMATCH');
});

test('workflow metrics contain no SAFE/ACT/WAIT or authority mutation semantics', () => {
  const world = createWorkbenchWorld('metric-nonclaim');
  const measurement = completed(world);
  const summary = summarizeWorkbenchReviewMeasurements([measurement]);
  const text = JSON.stringify({ measurement, summary }).toUpperCase();
  assert(!/(^|[^A-Z])SAFE([^A-Z]|$)/.test(text));
  assert(!/(^|[^A-Z])ACT([^A-Z]|$)/.test(text));
  assert(!/(^|[^A-Z])WAIT([^A-Z]|$)/.test(text));
  assert(!text.includes('SCIENTIFIC_AUTHORITY'));
  assert(!text.includes('DECISIONRESULT'));
});

console.log(`Agronomist Workbench instrumentation acceptance: ${passed} passed`);
