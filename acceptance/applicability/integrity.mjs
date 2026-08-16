import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  ApplicabilityError,
  validateApplicabilityAssessment
} from '../../packages/applicability/src/index.mjs';
import { datumInput, publishManifest, publishProblem, publishDatum } from '../context-manifest/fixtures.mjs';
import { assess, audit, createApplicabilityWorld } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof ApplicabilityError && error.code === code);
}

test('candidate outside the exact KnowledgeRetrievalResult cannot be assessed', () => {
  const world = createApplicabilityWorld('candidate-boundary');
  const fake = world.env.ledger.publish({
    kind: 'QualifiedKnowledge', logicalId: 'not-retrieved', version: '1',
    semanticPayload: world.env.qualified.knowledge.semanticPayload,
    audit: audit(world.env.runtimePrincipal, 'fake-qk')
  });
  expectCode(() => assess(world, { logicalId: 'applicability.not-retrieved', knowledgeRef: fake.ref }), 'KNOWLEDGE_NOT_IN_RETRIEVAL_RESULT');
});

test('ContextManifest for a different exact DecisionProblem cannot be substituted', () => {
  const world = createApplicabilityWorld('manifest-dp');
  const otherDecision = publishProblem(world.env.ledger, 'other-dp-a08');
  const otherDatum = publishDatum(world.env.ledger, 'other-datum-a08');
  const otherManifest = publishManifest(world.env.ledger, {
    logicalId: 'other-manifest-a08',
    decisionProblem: otherDecision,
    datumRefs: [otherDatum.ref]
  });
  expectCode(() => assess(world, { logicalId: 'applicability.other-manifest', manifest: otherManifest }), 'APPLICABILITY_DECISION_PROBLEM_MISMATCH');
});

test('runtime actor cannot be replaced by an arbitrary publisher principal', () => {
  const world = createApplicabilityWorld('actor');
  const outsider = { principalId: 'outsider', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a', programIds: [] };
  expectCode(() => assess(world, { logicalId: 'applicability.actor', actor: outsider }), 'APPLICABILITY_AUDIT_ACTOR_MISMATCH');
});

test('generic ledger record with copied Applicability fields does not become valid transport authority', () => {
  const world = createApplicabilityWorld('forged');
  const valid = assess(world, { logicalId: 'applicability.valid-for-forge' });
  const forged = world.env.ledger.publish({
    kind: 'ApplicabilityAssessment',
    logicalId: 'applicability.forged',
    version: '1',
    semanticPayload: valid.semanticPayload,
    audit: audit(world.env.runtimePrincipal, 'forged')
  });
  expectCode(() => validateApplicabilityAssessment({ ledger: world.env.ledger, applicabilityAssessmentRef: forged.ref }), 'APPLICABILITY_PUBLICATION_AUTHORITY_INVALID');
});

test('Applicability contract refuses ACT/WAIT recommendation laundering', () => {
  const world = createApplicabilityWorld('decision-laundering');
  const valid = assess(world, { logicalId: 'applicability.no-decision' });
  const forgedPayload = { ...valid.semanticPayload, decisionDisposition: 'ACT' };
  const forged = world.env.ledger.publish({
    kind: 'ApplicabilityAssessment', logicalId: 'applicability.act', version: '1', semanticPayload: forgedPayload,
    audit: audit(world.env.runtimePrincipal, 'act')
  });
  expectCode(() => validateApplicabilityAssessment({ ledger: world.env.ledger, applicabilityAssessmentRef: forged.ref }), 'INVALID_APPLICABILITY_FIELD');
});

test('region/country similarity absent from governed constraints cannot create transport authority', () => {
  const world = createApplicabilityWorld('no-region-shortcut');
  const assessment = assess(world, { logicalId: 'applicability.no-region-shortcut' });
  assert.equal(assessment.semanticPayload.conditionResults.length, 1);
  assert.equal(assessment.semanticPayload.conditionResults[0].semanticId, 'crop.code');
  assert.equal(assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
});

test('multiple target datums for one material semantic are treated as AMBIGUOUS/UNRESOLVED', () => {
  const world = createApplicabilityWorld('ambiguous');
  const secondCrop = publishDatum(world.env.ledger, 'datum.a08.ambiguous.second', datumInput({
    semanticId: 'crop.code',
    value: { type: 'CATEGORY', category: 'wheat' },
    unit: '1',
    verticalSupport: null,
    availableAt: '2026-08-20T09:55:00Z',
    source: { providerId: 'a08-fixture', sourceRef: 'ambiguous-second', contentHash: 'sha256:ambiguous-second' }
  }));
  const manifest = publishManifest(world.env.ledger, {
    logicalId: 'manifest.a08.ambiguous.2',
    decisionProblem: world.decision,
    datumRefs: [...world.manifest.semanticPayload.datumRefs, secondCrop.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const assessment = assess(world, { logicalId: 'applicability.ambiguous', manifest });
  assert.equal(assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.equal(assessment.semanticPayload.conditionResults[0].status, 'AMBIGUOUS');
});

test('Applicability validation rejects records on an unrelated ledger', () => {
  const world = createApplicabilityWorld('ledger');
  const assessment = assess(world, { logicalId: 'applicability.ledger' });
  const other = new AuthorityLedger();
  assert.throws(() => validateApplicabilityAssessment({ ledger: other, applicabilityAssessmentRef: assessment.ref }));
});

console.log(`Applicability integrity acceptance: ${passed} passed`);
