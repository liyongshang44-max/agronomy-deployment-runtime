import assert from 'node:assert/strict';
import {
  ESCALATION_CLASSIFICATIONS,
  projectApplicabilityEscalation
} from '../../packages/workbench/src/index.mjs';
import {
  assess,
  createApplicabilityWorld,
  rebuildWorldWithTransportConstraints
} from '../applicability/fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function project(world, assessment) {
  return projectApplicabilityEscalation({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: assessment.ref
  });
}

test('A10 freezes the v0.3 product escalation taxonomy without creating runtime-decision states', () => {
  assert.deepEqual(ESCALATION_CLASSIFICATIONS, [
    'NO_REVIEW_CANDIDATE',
    'AGRONOMIST_REVIEW_REQUIRED',
    'CONTEXT_GAP',
    'KNOWLEDGE_CONFLICT',
    'CALIBRATION_NEEDED',
    'GOVERNED_TRANSFORM_NEEDED'
  ]);
});

test('directly applicable qualified material case with no blockers becomes NO_REVIEW_CANDIDATE only', () => {
  const world = createApplicabilityWorld('a10-direct');
  const assessment = assess(world, { logicalId: 'applicability.a10.direct' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(view.reviewRequired, false);
  assert.deepEqual(view.reasonCodes, ['DIRECTLY_APPLICABLE_NO_BLOCKERS']);
});

test('A08 CONFLICT becomes KNOWLEDGE_CONFLICT without softening the authority result', () => {
  const world = createApplicabilityWorld('a10-conflict', { crop: 'wheat' });
  const assessment = assess(world, { logicalId: 'applicability.a10.conflict' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'KNOWLEDGE_CONFLICT');
  assert.equal(view.reviewRequired, true);
  assert.equal(view.explanation.transportStatus, 'CONFLICT');
});

test('missing decision-material context becomes CONTEXT_GAP with exact semantic reason', () => {
  const world = createApplicabilityWorld('a10-gap', { includeCrop: false });
  const assessment = assess(world, { logicalId: 'applicability.a10.gap' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'CONTEXT_GAP');
  assert(view.reasonCodes.includes('MISSING_CONTEXT:crop.code'));
  assert.deepEqual(view.explanation.missingContextSemanticIds, ['crop.code']);
});

test('governed calibration requirement becomes CALIBRATION_NEEDED and remains unsatisfied', () => {
  const world = rebuildWorldWithTransportConstraints('a10-calibration', [
    { type: 'CALIBRATION_REQUIRED', code: 'FIELD_CALIBRATION_REQUIRED' }
  ]);
  const assessment = assess(world, { logicalId: 'applicability.a10.calibration' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'CALIBRATION_NEEDED');
  assert.equal(view.reviewRequired, true);
  assert(view.reasonCodes.includes('CALIBRATION:FIELD_CALIBRATION_REQUIRED'));
});

test('bounded extrapolation is never silently promoted to no-review', () => {
  const world = rebuildWorldWithTransportConstraints('a10-bounded', [
    { type: 'BOUNDED_EXTRAPOLATION', code: 'SOURCE_DOMAIN_EDGE' }
  ]);
  const assessment = assess(world, { logicalId: 'applicability.a10.bounded' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'AGRONOMIST_REVIEW_REQUIRED');
  assert.equal(view.reviewRequired, true);
  assert(view.reasonCodes.includes('BOUNDED_EXTRAPOLATION'));
});

test('unsupported unresolved transport semantics remain explicit AGRONOMIST_REVIEW_REQUIRED', () => {
  const world = rebuildWorldWithTransportConstraints('a10-unsupported', [
    { type: 'REGION_SIMILARITY_SCORE', threshold: '0.8' }
  ]);
  const assessment = assess(world, { logicalId: 'applicability.a10.unsupported' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'AGRONOMIST_REVIEW_REQUIRED');
  assert(view.reasonCodes.some((code) => code.includes('UNSUPPORTED_TRANSPORT_CONSTRAINT')));
});

test('explicit NOT_RELEVANT can leave the review queue without being called safe or actionable', () => {
  const world = rebuildWorldWithTransportConstraints('a10-not-relevant', [
    { type: 'DECISION_TYPE_IN', decisionTypes: ['NITROGEN_TIMING'] }
  ]);
  const assessment = assess(world, { logicalId: 'applicability.a10.not-relevant' });
  const view = project(world, assessment);
  assert.equal(view.classification, 'NO_REVIEW_CANDIDATE');
  assert.deepEqual(view.reasonCodes, ['NOT_DECISION_RELEVANT']);
  assert.equal(view.explanation.decisionRelevance, 'NOT_RELEVANT');
});

console.log(`Escalation read-model acceptance: ${passed} passed`);
