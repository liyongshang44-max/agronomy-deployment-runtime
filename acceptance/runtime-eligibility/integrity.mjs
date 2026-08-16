import assert from 'node:assert/strict';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  buildRuntimeEligibility,
  normalizeRuntimeEligibility,
  publishRuntimeEligibility,
  validateRuntimeEligibility
} from '../../packages/runtime-eligibility/src/index.mjs';
import {
  audit,
  directEligibilityWorld,
  publishEligibility,
  transportEligibilityWorld
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('tampered RuntimePlan cannot be adjudicated even when old plan hash text is retained', () => {
  const world = directEligibilityWorld('tampered-plan');
  const tampered = structuredClone(world.runtimePlan);
  tampered.openRequirements.push({
    requirementId: 'requirement:forged',
    requirementType: 'CALIBRATION_REQUIRED',
    code: 'FORGED'
  });
  assert.throws(
    () => buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: tampered }),
    (error) => error?.code === 'RUNTIME_PLAN_REPLAY_MISMATCH'
  );
});

test('evaluator rejects acquisition options, RuntimeBinding and decision outputs as hidden predecessors', () => {
  const world = directEligibilityWorld('closed-input');
  for (const [key, value] of [
    ['acquisitionOptions', []],
    ['runtimeBindingRef', { kind: 'RuntimeBinding' }],
    ['decisionResultRef', { kind: 'DecisionResult' }],
    ['selectedAction', 'IRRIGATE_NOW']
  ]) {
    assert.throws(
      () => buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan, [key]: value }),
      (error) => error?.code === 'INVALID_RUNTIME_ELIGIBILITY_INPUT_FIELD',
      key
    );
  }
});

test('RuntimeEligibility contract rejects embedded action/decision authority fields', () => {
  const world = directEligibilityWorld('no-decision-field');
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  for (const [key, value] of [
    ['selectedAction', 'IRRIGATE_NOW'],
    ['decisionDisposition', 'ACT'],
    ['decisionResultRef', { kind: 'DecisionResult' }]
  ]) {
    assert.throws(
      () => normalizeRuntimeEligibility({ ...result, [key]: value }),
      (error) => error?.code === 'INVALID_RUNTIME_ELIGIBILITY_FIELD',
      key
    );
  }
});

test('publisher rejects downstream authority fields instead of silently ignoring them', () => {
  const world = directEligibilityWorld('publish-closed-input');
  assert.throws(
    () => publishRuntimeEligibility({
      ledger: world.env.ledger,
      logicalId: 'runtime-eligibility.r03.bad-input',
      version: '1',
      runtimePlan: world.runtimePlan,
      runtimeBindingRef: { kind: 'RuntimeBinding' },
      audit: audit(world.env.runtimePrincipal)
    }),
    (error) => error?.code === 'INVALID_RUNTIME_ELIGIBILITY_PUBLICATION_FIELD'
  );
});

test('only exact retrieval runtime principal may publish RuntimeEligibility', () => {
  const world = directEligibilityWorld('wrong-actor');
  assert.throws(
    () => publishRuntimeEligibility({
      ledger: world.env.ledger,
      logicalId: 'runtime-eligibility.r03.wrong-actor',
      version: '1',
      runtimePlan: world.runtimePlan,
      audit: {
        eventId: 'wrong-actor',
        occurredAt: '2026-08-20T10:10:00.000Z',
        actor: { type: 'USER', id: 'not-runtime-principal' },
        details: { suite: 'runtime-eligibility' }
      }
    }),
    (error) => error?.code === 'RUNTIME_ELIGIBILITY_AUDIT_ACTOR_MISMATCH'
  );
});

test('published RuntimeEligibility audit binds exact runtime authorization and all current plan authority refs', () => {
  const world = directEligibilityWorld('audit-closure');
  const record = publishEligibility(world, 'audit-closure');
  const validated = validateRuntimeEligibility({ ledger: world.env.ledger, runtimeEligibilityRef: record.ref });
  const events = world.env.ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref) && event.action === 'PUBLISH_RUNTIME_ELIGIBILITY');
  assert.equal(events.length, 1);
  const event = events[0];
  const runtimeAuthRef = validated.retrievalAuthority.runtimeAuthorization.ref;
  assert.ok(event.inputRefs.some((ref) => sameAuthorityRef(ref, runtimeAuthRef)));
  assert.ok(event.inputRefs.some((ref) => sameAuthorityRef(ref, record.semanticPayload.decisionProblemRef)));
  assert.ok(event.inputRefs.some((ref) => sameAuthorityRef(ref, record.semanticPayload.contextManifestRef)));
  for (const ref of record.semanticPayload.applicabilityAssessmentRefs) {
    assert.ok(event.inputRefs.some((input) => sameAuthorityRef(input, ref)));
  }
});

test('pure RuntimeEligibility evaluation is deterministic and read-only', () => {
  const world = directEligibilityWorld('deterministic');
  const before = world.env.ledger.exportSnapshot();
  const first = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  const second = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.deepEqual(second, first);
  assert.deepEqual(world.env.ledger.exportSnapshot(), before);
});

test('RuntimeEligibility publication does not mutate ContextManifest or Applicability authority', () => {
  const world = directEligibilityWorld('immutability');
  const manifestBefore = structuredClone(world.env.ledger.resolve(world.manifest.ref).semanticPayload);
  const assessmentBefore = structuredClone(world.env.ledger.resolve(world.assessments[0].ref).semanticPayload);
  publishEligibility(world, 'immutability');
  assert.deepEqual(world.env.ledger.resolve(world.manifest.ref).semanticPayload, manifestBefore);
  assert.deepEqual(world.env.ledger.resolve(world.assessments[0].ref).semanticPayload, assessmentBefore);
});

test('RuntimeEligibility carries structured limitations rather than scalar confidence', () => {
  const world = transportEligibilityWorld('structured-limitations', [
    { type: 'BOUNDED_EXTRAPOLATION', code: 'LIMITED_ENVELOPE' }
  ]);
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS');
  assert.ok(result.limitations.length > 0);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'confidence'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'score'), false);
  assert.equal(result.limitations.every((item) => item.sourceApplicabilityAssessmentRef && item.detail), true);
});

test('calibration requirement cannot be auto-waived to reduce blocked rate', () => {
  const world = transportEligibilityWorld('no-calibration-waiver', [
    { type: 'CALIBRATION_REQUIRED', code: 'LOCAL_CALIBRATION' }
  ]);
  const result = buildRuntimeEligibility({ ledger: world.env.ledger, runtimePlan: world.runtimePlan });
  assert.equal(result.runtimeEligibility, 'NO_LEGAL_RUNTIME');
  assert.equal(result.legalRuntimeCandidateCount, 0);
  assert.ok(result.reasonCodes.includes('CALIBRATION_AUTHORITY_REQUIRED'));
});

test('RuntimeEligibility validation rejects non-RuntimeEligibility authority refs', () => {
  const world = directEligibilityWorld('wrong-kind');
  assert.throws(
    () => validateRuntimeEligibility({
      ledger: world.env.ledger,
      runtimeEligibilityRef: world.decision.ref
    }),
    (error) => error?.code === 'RUNTIME_ELIGIBILITY_REQUIRED'
  );
});

test('published runtime legality remains explicitly distinct from ACT/WAIT/ASK/ABSTAIN', () => {
  const world = directEligibilityWorld('nonclaim');
  const record = publishEligibility(world, 'nonclaim');
  assert.equal(record.semanticPayload.decisionAuthorityClaim, 'NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION');
  assert.equal(Object.prototype.hasOwnProperty.call(record.semanticPayload, 'decisionDisposition'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(record.semanticPayload, 'selectedAction'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(record.semanticPayload, 'decisionResult'), false);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`R03 RuntimeEligibility integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
