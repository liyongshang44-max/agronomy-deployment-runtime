import assert from 'node:assert/strict';
import {
  TRANSPORT_STATUSES,
  validateApplicabilityAssessment
} from '../../packages/applicability/src/index.mjs';
import { assess, createApplicabilityWorld, rebuildWorldWithTransportConstraints } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('A08 freezes the complete transport status vocabulary without claiming transform authority in the core path', () => {
  assert.deepEqual(TRANSPORT_STATUSES, [
    'DIRECTLY_APPLICABLE', 'APPLICABLE_WITH_GOVERNED_TRANSFORM', 'CALIBRATION_REQUIRED',
    'BOUNDED_EXTRAPOLATION', 'UNRESOLVED', 'CONFLICT', 'NOT_RELEVANT'
  ]);
});

test('exact K04 crop precondition + exact target ContextDatum yields DIRECTLY_APPLICABLE', () => {
  const world = createApplicabilityWorld('direct');
  const assessment = assess(world, { logicalId: 'applicability.direct' });
  assert.equal(assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(assessment.semanticPayload.scientificUseStatus, 'QUALIFIED');
  assert.equal(assessment.semanticPayload.decisionRelevance, 'MATERIAL');
  assert.equal(assessment.semanticPayload.runtimeUse, 'ALLOWED');
  assert.equal(assessment.semanticPayload.conditionResults[0].semanticId, 'crop.code');
  assert.equal(assessment.semanticPayload.conditionResults[0].status, 'MATCH');
  assert.equal(validateApplicabilityAssessment({ ledger: world.env.ledger, applicabilityAssessmentRef: assessment.ref }).record.ref.semanticHash, assessment.ref.semanticHash);
});

test('known hard precondition mismatch yields CONFLICT rather than low-confidence match', () => {
  const world = createApplicabilityWorld('conflict', { crop: 'wheat' });
  const assessment = assess(world, { logicalId: 'applicability.conflict' });
  assert.equal(assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert.equal(assessment.semanticPayload.runtimeUse, 'BLOCKED');
  assert(assessment.semanticPayload.conflicts.some((item) => item.code === 'SEMANTIC_PRECONDITION_MISMATCH'));
});

test('missing decision-material target semantic yields UNRESOLVED and names the missing semantic id', () => {
  const world = createApplicabilityWorld('missing', { includeCrop: false });
  const assessment = assess(world, { logicalId: 'applicability.missing' });
  assert.equal(assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.deepEqual(assessment.semanticPayload.missingContextSemanticIds, ['crop.code']);
  assert.equal(assessment.semanticPayload.runtimeUse, 'BLOCKED');
});

test('governed K04 CALIBRATION_REQUIRED constraint is detected but never treated as satisfied', () => {
  const world = rebuildWorldWithTransportConstraints('calibration', [{ type: 'CALIBRATION_REQUIRED', code: 'FIELD_CALIBRATION_REQUIRED' }]);
  const assessment = assess(world, { logicalId: 'applicability.calibration' });
  assert.equal(assessment.semanticPayload.transportStatus, 'CALIBRATION_REQUIRED');
  assert.deepEqual(assessment.semanticPayload.requiredCalibrationCodes, ['FIELD_CALIBRATION_REQUIRED']);
  assert.equal(assessment.semanticPayload.runtimeUse, 'CONDITIONAL');
});

test('governed K04 bounded-extrapolation constraint produces BOUNDED_EXTRAPOLATION with explicit limitation', () => {
  const world = rebuildWorldWithTransportConstraints('bounded', [{ type: 'BOUNDED_EXTRAPOLATION', code: 'SOURCE_DOMAIN_EDGE' }]);
  const assessment = assess(world, { logicalId: 'applicability.bounded' });
  assert.equal(assessment.semanticPayload.transportStatus, 'BOUNDED_EXTRAPOLATION');
  assert.equal(assessment.semanticPayload.runtimeUse, 'ALLOWED');
  assert(assessment.semanticPayload.limitations.some((item) => item.code === 'SOURCE_DOMAIN_EDGE'));
});

test('decision relevance is independently governed by K04 transport constraint and can return NOT_RELEVANT', () => {
  const world = rebuildWorldWithTransportConstraints('not-relevant', [{ type: 'DECISION_TYPE_IN', decisionTypes: ['NITROGEN_TIMING'] }]);
  const assessment = assess(world, { logicalId: 'applicability.not-relevant' });
  assert.equal(assessment.semanticPayload.transportStatus, 'NOT_RELEVANT');
  assert.equal(assessment.semanticPayload.decisionRelevance, 'NOT_RELEVANT');
  assert.equal(assessment.semanticPayload.scientificUseStatus, 'QUALIFIED');
  assert.equal(assessment.semanticPayload.runtimeUse, 'BLOCKED');
});

test('unsupported governed transport semantics fail conservatively to UNRESOLVED rather than guessed compatibility', () => {
  const world = rebuildWorldWithTransportConstraints('unsupported', [{ type: 'REGION_SIMILARITY_SCORE', threshold: '0.8' }]);
  const assessment = assess(world, { logicalId: 'applicability.unsupported' });
  assert.equal(assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.deepEqual(assessment.semanticPayload.unsupportedConstraintCodes, ['UNSUPPORTED_TRANSPORT_CONSTRAINT:REGION_SIMILARITY_SCORE']);
});

console.log(`Applicability positive acceptance: ${passed} passed`);
