import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  projectApplicabilityEscalation
} from '../../packages/workbench/src/index.mjs';
import { USE_APPLICABILITY } from '../derived-knowledge/fixture.mjs';
import { assess, audit, createApplicabilityWorld } from '../applicability/fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function laterAudit(actor, suffix) {
  return {
    eventId: `a10-later-${suffix}`,
    occurredAt: '2026-08-21T10:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'escalation-read-model' }
  };
}

function project(world, assessment, options = {}) {
  return projectApplicabilityEscalation({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: assessment.ref,
    ...options
  });
}

function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allStrings(item, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, nested]) => {
    out.push(key);
    allStrings(nested, out);
  });
  return out;
}

test('A10 projection closes exact Why-chain through A08, A07 and A06 authority refs', () => {
  const world = createApplicabilityWorld('a10-why');
  const assessment = assess(world, { logicalId: 'applicability.a10.why' });
  const view = project(world, assessment);
  assert.deepEqual(view.why.applicabilityAssessmentRef, assessment.ref);
  assert.deepEqual(view.why.decisionProblemRef, assessment.semanticPayload.decisionProblemRef);
  assert.deepEqual(view.why.contextManifestRef, world.manifest.ref);
  assert.deepEqual(view.why.knowledgeRetrievalResultRef, world.retrieval.ref);
  assert.deepEqual(view.why.deploymentRef, world.retrieval.semanticPayload.deploymentRef);
  assert.deepEqual(view.why.runtimeProfileRef, world.retrieval.semanticPayload.runtimeProfileRef);
  assert.deepEqual(view.why.knowledgeReleaseRef, world.retrieval.semanticPayload.knowledgeReleaseRef);
});

test('A10 is a pure read model and publishes no new ledger authority records or audits', () => {
  const world = createApplicabilityWorld('a10-pure');
  const assessment = assess(world, { logicalId: 'applicability.a10.pure' });
  const before = world.env.ledger.exportSnapshot();
  project(world, assessment);
  const after = world.env.ledger.exportSnapshot();
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.auditEvents.length, before.auditEvents.length);
  assert.equal(after.lineage.length, before.lineage.length);
});

test('same exact authority world yields deterministic projection hash', () => {
  const world = createApplicabilityWorld('a10-deterministic');
  const assessment = assess(world, { logicalId: 'applicability.a10.deterministic' });
  const a = project(world, assessment);
  const b = project(world, assessment);
  assert.equal(a.projectionHash, b.projectionHash);
  assert.deepEqual(a, b);
});

test('read model contains no SAFE ACT WAIT recommendation or decision-result vocabulary', () => {
  const world = createApplicabilityWorld('a10-nonclaim');
  const assessment = assess(world, { logicalId: 'applicability.a10.nonclaim' });
  const view = project(world, assessment);
  const text = allStrings(view).join(' ').toUpperCase();
  assert(!/(^|[^A-Z])SAFE([^A-Z]|$)/.test(text));
  assert(!/(^|[^A-Z])ACT([^A-Z]|$)/.test(text));
  assert(!/(^|[^A-Z])WAIT([^A-Z]|$)/.test(text));
  assert(!text.includes('DECISIONRESULT'));
  assert(!text.includes('RECOMMENDATION'));
});

test('generic forged ApplicabilityAssessment cannot enter A10 through copied payload vocabulary', () => {
  const world = createApplicabilityWorld('a10-forged');
  const valid = assess(world, { logicalId: 'applicability.a10.valid' });
  const forged = world.env.ledger.publish({
    kind: 'ApplicabilityAssessment',
    logicalId: 'applicability.a10.forged',
    version: '1',
    semanticPayload: valid.semanticPayload,
    audit: audit(world.env.runtimePrincipal, 'forged-a10')
  });
  assert.throws(() => projectApplicabilityEscalation({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: forged.ref
  }));
});

test('projection cannot be reconstructed on an unrelated ledger from refs alone', () => {
  const world = createApplicabilityWorld('a10-ledger');
  const assessment = assess(world, { logicalId: 'applicability.a10.ledger' });
  const unrelated = new AuthorityLedger();
  assert.throws(() => projectApplicabilityEscalation({
    ledger: unrelated,
    applicabilityAssessmentRef: assessment.ref
  }));
});

test('later scientific-use revocation blocks current read model but historical projection preserves the exact prior classification', () => {
  const world = createApplicabilityWorld('a10-history');
  const assessment = assess(world, { logicalId: 'applicability.a10.history' });
  const before = project(world, assessment);
  const q = world.env.qualified;
  q.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a10.history',
    revocationVersion: '1',
    qualifiedKnowledgeRef: q.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: q.approver,
    authorizationDecisionAuditRef: q.decision.semanticPayload.authorizationDecisionAuditRef,
    reasonCodes: ['A10_HISTORICAL_PROJECTION_FIXTURE'],
    audit: laterAudit(q.approver, 'revocation')
  });
  assert.throws(() => project(world, assessment));
  const historical = project(world, assessment, { allowHistorical: true });
  assert.equal(historical.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(historical.projectionHash, before.projectionHash);
});

console.log(`Escalation read-model integrity acceptance: ${passed} passed`);
