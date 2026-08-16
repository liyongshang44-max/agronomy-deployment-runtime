import assert from 'node:assert/strict';
import {
  buildAgronomistEscalationQueue,
  buildApplicabilityConflictQueue
} from '../../packages/workbench/src/index.mjs';
import { createWorkbenchWorld, projectCase } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('A11 case exposes exact source span → claim → origin context → qualification → target context → applicability chain', () => {
  const world = createWorkbenchWorld('chain');
  const c = world.workbenchCase;
  assert.equal(c.projectionKind, 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE');
  assert.deepEqual(c.scientificEvidence.knowledgeRef, world.assessment.semanticPayload.knowledgeRef);
  assert.equal(c.scientificEvidence.knowledgeKind, 'QualifiedKnowledge');
  assert.equal(c.scientificEvidence.claim.claimRef.kind, 'Claim');
  assert.equal(c.scientificEvidence.originContext.originContextRef.kind, 'SourceContext');
  assert(c.scientificEvidence.qualification.decisionRefs.length > 0);
  assert.deepEqual(c.targetContext.contextManifestRef, world.manifest.ref);
  assert.deepEqual(c.applicability.applicabilityAssessmentRef, world.assessment.ref);
  assert.deepEqual(c.why.knowledgeRetrievalResultRef, world.retrieval.ref);
});

test('exact retained SourceRegistry yields a bounded text preview of the exact claim locator', () => {
  const world = createWorkbenchWorld('source-preview');
  const span = world.workbenchCase.scientificEvidence.sourceSpan;
  assert.equal(span.retainedBytesVerified, true);
  assert.equal(span.previewAvailable, true);
  assert.equal(span.previewTruncated, false);
  assert.match(span.previewText, /maize/i);
  assert.match(span.previewText, /irrigation/i);
  assert.equal(span.sourceArtifactRef.semanticHash, world.env.qualified.artifact.ref.semanticHash);
});

test('without exact SourceRegistry A11 preserves source locator/hash but makes no byte-preview claim', () => {
  const world = createWorkbenchWorld('locator-only');
  const c = projectCase(world, { sourceRegistry: null });
  const span = c.scientificEvidence.sourceSpan;
  assert.equal(span.retainedBytesVerified, false);
  assert.equal(span.previewAvailable, false);
  assert.equal('previewText' in span, false);
  assert.equal(span.contentHash, world.env.qualified.artifact.semanticPayload.contentHash);
});

test('A11 Why-chain closes through A10/A08/A07/A06 exact authority refs', () => {
  const world = createWorkbenchWorld('why');
  const c = world.workbenchCase;
  assert.deepEqual(c.why.applicabilityAssessmentRef, world.assessment.ref);
  assert.deepEqual(c.why.decisionProblemRef, world.decision.ref);
  assert.deepEqual(c.why.contextManifestRef, world.manifest.ref);
  assert.deepEqual(c.why.knowledgeRetrievalResultRef, world.retrieval.ref);
  assert.deepEqual(c.why.deploymentRef, world.retrieval.semanticPayload.deploymentRef);
  assert.deepEqual(c.why.runtimeProfileRef, world.retrieval.semanticPayload.runtimeProfileRef);
  assert.deepEqual(c.why.knowledgeReleaseRef, world.retrieval.semanticPayload.knowledgeReleaseRef);
});

test('same exact authority/access world yields deterministic case projection hash', () => {
  const world = createWorkbenchWorld('deterministic');
  const a = world.workbenchCase;
  const b = projectCase(world);
  assert.equal(a.caseProjectionHash, b.caseProjectionHash);
  assert.deepEqual(a, b);
});

test('default escalation queue filters only NO_REVIEW_CANDIDATE and retains every review-required case', () => {
  const direct = createWorkbenchWorld('queue-direct');
  const conflict = createWorkbenchWorld('queue-conflict', { crop: 'wheat' });
  const gap = createWorkbenchWorld('queue-gap', { includeCrop: false });
  const queue = buildAgronomistEscalationQueue({
    cases: [direct.workbenchCase, conflict.workbenchCase, gap.workbenchCase]
  });
  assert.equal(queue.totalInputCases, 3);
  assert.equal(queue.noReviewCandidateCount, 1);
  assert.equal(queue.reviewRequiredCount, 2);
  assert.equal(queue.items.length, 2);
  assert(queue.items.every((item) => item.reviewRequired));
  assert(queue.items.some((item) => item.classification === 'KNOWLEDGE_CONFLICT'));
  assert(queue.items.some((item) => item.classification === 'CONTEXT_GAP'));
});

test('applicability conflict queue contains only exact KNOWLEDGE_CONFLICT cases', () => {
  const direct = createWorkbenchWorld('conflict-queue-direct');
  const conflict = createWorkbenchWorld('conflict-queue-conflict', { crop: 'wheat' });
  const queue = buildApplicabilityConflictQueue({ cases: [direct.workbenchCase, conflict.workbenchCase] });
  assert.equal(queue.conflictCount, 1);
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].classification, 'KNOWLEDGE_CONFLICT');
  assert.deepEqual(queue.items[0].applicabilityAssessmentRef, conflict.assessment.ref);
});

test('queue can include no-review candidates explicitly without reclassifying them', () => {
  const direct = createWorkbenchWorld('queue-all-direct');
  const conflict = createWorkbenchWorld('queue-all-conflict', { crop: 'wheat' });
  const queue = buildAgronomistEscalationQueue({
    cases: [direct.workbenchCase, conflict.workbenchCase],
    includeNoReviewCandidates: true
  });
  assert.equal(queue.items.length, 2);
  assert.equal(queue.reviewRequiredCount, 1);
  assert.equal(queue.noReviewCandidateCount, 1);
  const directItem = queue.items.find((item) => item.classification === 'NO_REVIEW_CANDIDATE');
  assert(directItem);
  assert.equal(directItem.reviewRequired, false);
});

console.log(`Agronomist Workbench case/queue acceptance: ${passed} passed`);
