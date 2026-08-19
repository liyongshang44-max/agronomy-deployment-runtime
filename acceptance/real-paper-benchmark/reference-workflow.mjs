import { strict as assert } from 'node:assert';
import {
  prepareReferenceWorksheet,
  ReferenceWorksheetError,
  REFERENCE_WORKSHEET_VERSION
} from '../../scripts/real-paper-benchmark/prepare-reference-worksheet.mjs';
import {
  finalizeReferenceAnnotation,
  REFERENCE_ANNOTATION_VERSION
} from '../../scripts/real-paper-benchmark/finalize-reference-annotation.mjs';
import { applyReferenceAnnotation } from '../../scripts/real-paper-benchmark/apply-reference-annotation.mjs';

const REF = (kind, logicalId, digit) => ({
  kind,
  logicalId,
  version: '1',
  semanticHash: `sha256:${digit.repeat(64)}`
});

function packet() {
  return {
    schemaVersion: 'adr.real-paper-reference-packet.v1',
    benchmarkVersion: 'adr.real-paper-benchmark.v1',
    paperId: 'RP001',
    codeHeadSha: '0123456789abcdef0123456789abcdef01234567',
    blindToAutomatedDisposition: true,
    frozenBeforeAutomatedReview: true,
    containsAutomatedDisposition: false,
    containsExtractionConfidence: false,
    containsLlm1ProviderModelIdentity: false,
    sourceEvidence: {
      sourceRef: REF('Source', 'source.rp001', '1'),
      sourceArtifactRef: REF('SourceArtifact', 'artifact.rp001', '2'),
      contentHash: `sha256:${'3'.repeat(64)}`,
      byteLength: 6045990,
      retentionRightsDecisionRef: REF('RightsDecision', 'rights.rp001.retain', '4')
    },
    compilationResultRef: REF('ScientificCompilationResult', 'compilation.rp001', '5'),
    candidateCount: 2,
    candidates: [
      {
        candidateKey: `claim.rp001.1@1#sha256:${'6'.repeat(64)}`,
        claimCandidateRef: REF('ClaimCandidate', 'claim.rp001.1', '6'),
        sourceContextCandidateRef: REF('SourceContextCandidate', 'context.rp001.1', '7'),
        claimType: 'PARAMETER',
        assertion: 'A source-faithful parameter candidate.',
        sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 4, evidenceText: 'parameter evidence' } },
        contextFamilies: { BIOLOGICAL: { status: 'NOT_REPORTED', dimensions: [] } }
      },
      {
        candidateKey: `claim.rp001.2@1#sha256:${'8'.repeat(64)}`,
        claimCandidateRef: REF('ClaimCandidate', 'claim.rp001.2', '8'),
        sourceContextCandidateRef: REF('SourceContextCandidate', 'context.rp001.2', '9'),
        claimType: 'BOUNDARY_CONSTRAINT',
        assertion: 'A candidate with incomplete source support.',
        sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 8, evidenceText: 'partial evidence' } },
        contextFamilies: { MANAGEMENT: { status: 'NOT_REPORTED', dimensions: [] } }
      }
    ],
    adjudicationContract: {
      outputVersion: 'adr.real-paper-reference-annotation.v1',
      allowedDispositions: ['ACCEPT_SOURCE_FAITHFUL', 'REJECT_SOURCE_FAITHFUL'],
      machineCandidateRepairForbidden: true
    },
    authorityClaim: 'REFERENCE_ADJUDICATION_INPUT_ONLY_NOT_REFERENCE_TRUTH_OR_SCIENTIFIC_AUTHORITY'
  };
}

function expectError(fn, code) {
  assert.throws(fn, (error) => error instanceof ReferenceWorksheetError && error.code === code);
}

const worksheet = prepareReferenceWorksheet(packet(), {
  adjudicatorId: 'reference-reviewer-1',
  provider: 'OPENAI',
  model: 'independent-reference-model'
});
assert.equal(worksheet.worksheetVersion, REFERENCE_WORKSHEET_VERSION);
assert.equal(worksheet.paperId, 'RP001');
assert.match(worksheet.sourcePacketHash, /^sha256:[0-9a-f]{64}$/);
assert.equal(worksheet.blindToAutomatedDisposition, true);
assert.equal(worksheet.frozenBeforeAutomatedReview, true);
assert.equal(worksheet.automatedResultAccessed, false);
assert.equal(worksheet.adjudications.length, 2);
assert.ok(worksheet.adjudications.every((item) => item.referenceDisposition === null));

const leakedStatus = packet();
leakedStatus.candidates[0].automatedStatus = 'AUTO_ACCEPTED';
expectError(
  () => prepareReferenceWorksheet(leakedStatus, { adjudicatorId: 'reference-reviewer-1' }),
  'REFERENCE_PACKET_CANDIDATE_FIELD_FORBIDDEN'
);

const leakedNestedReview = packet();
leakedNestedReview.candidates[0].contextFamilies.BIOLOGICAL.review = { disposition: 'ACCEPT_SOURCE_FAITHFUL' };
expectError(
  () => prepareReferenceWorksheet(leakedNestedReview, { adjudicatorId: 'reference-reviewer-1' }),
  'REFERENCE_PACKET_REVIEW_LEAK'
);

expectError(() => finalizeReferenceAnnotation(structuredClone(worksheet)), 'INVALID_REFERENCE_WORKSHEET');

const unblind = structuredClone(worksheet);
unblind.automatedResultAccessed = true;
unblind.adjudications[0].referenceDisposition = 'ACCEPT_SOURCE_FAITHFUL';
unblind.adjudications[0].rationale = 'Supported.';
unblind.adjudications[1].referenceDisposition = 'REJECT_SOURCE_FAITHFUL';
unblind.adjudications[1].defectCodes = ['EVIDENCE_LOCATOR_INCOMPLETE'];
unblind.adjudications[1].rationale = 'Locator is incomplete.';
expectError(() => finalizeReferenceAnnotation(unblind), 'REFERENCE_WORKSHEET_BLINDNESS_BROKEN');

const rejectWithoutDefect = structuredClone(worksheet);
rejectWithoutDefect.adjudications[0].referenceDisposition = 'ACCEPT_SOURCE_FAITHFUL';
rejectWithoutDefect.adjudications[0].rationale = 'Fully supported.';
rejectWithoutDefect.adjudications[1].referenceDisposition = 'REJECT_SOURCE_FAITHFUL';
rejectWithoutDefect.adjudications[1].rationale = 'Not fully supported.';
expectError(() => finalizeReferenceAnnotation(rejectWithoutDefect), 'REFERENCE_REJECT_DEFECT_REQUIRED');

const completed = structuredClone(worksheet);
completed.adjudications[0].referenceDisposition = 'ACCEPT_SOURCE_FAITHFUL';
completed.adjudications[0].rationale = 'Assertion, context and locator are fully source-supported.';
completed.adjudications[1].referenceDisposition = 'REJECT_SOURCE_FAITHFUL';
completed.adjudications[1].defectCodes = ['EVIDENCE_LOCATOR_INCOMPLETE'];
completed.adjudications[1].rationale = 'Claim-level locator does not cover the complete assertion.';
const annotation = finalizeReferenceAnnotation(completed);
assert.equal(annotation.annotationVersion, REFERENCE_ANNOTATION_VERSION);
assert.equal(annotation.paperId, 'RP001');
assert.equal(annotation.blindToAutomatedDisposition, true);
assert.equal(annotation.adjudications.length, 2);
assert.equal('assertion' in annotation.adjudications[0], false);
assert.equal('sourceLocator' in annotation.adjudications[0], false);
assert.equal('automatedStatus' in annotation.adjudications[0], false);

const preReferenceRun = {
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runMode: 'REAL',
  runId: 'rp001-pre-reference',
  execution: {
    repositoryFullName: 'liyongshang44-max/agronomy-deployment-runtime',
    codeHeadSha: packet().codeHeadSha,
    rightsEnforcement: 'RA02_EXACT_SUBJECT_FAIL_CLOSED'
  },
  papers: [{
    paperId: 'RP001',
    evidence: packet().sourceEvidence,
    candidates: [
      {
        candidateKey: packet().candidates[0].candidateKey,
        claimType: 'PARAMETER',
        compilerStatus: 'REVIEWABLE',
        automatedStatus: 'AUTO_ACCEPTED',
        referenceDisposition: null,
        defectCodes: []
      },
      {
        candidateKey: packet().candidates[1].candidateKey,
        claimType: 'BOUNDARY_CONSTRAINT',
        compilerStatus: 'REVIEWABLE',
        automatedStatus: 'AUTO_ACCEPTED',
        referenceDisposition: null,
        defectCodes: []
      }
    ]
  }]
};
const applied = applyReferenceAnnotation(preReferenceRun, annotation);
assert.equal(applied.referenceApplication.appliedCount, 2);
assert.equal(applied.referenceApplication.automatedStatusMutationAllowed, false);
assert.deepEqual(applied.run.execution, preReferenceRun.execution);
assert.deepEqual(applied.run.papers[0].evidence, preReferenceRun.papers[0].evidence);
assert.deepEqual(
  applied.run.papers[0].candidates.map((item) => item.automatedStatus),
  preReferenceRun.papers[0].candidates.map((item) => item.automatedStatus)
);
assert.equal(applied.run.papers[0].candidates[0].referenceDisposition, 'ACCEPT_SOURCE_FAITHFUL');
assert.equal(applied.run.papers[0].candidates[1].referenceDisposition, 'REJECT_SOURCE_FAITHFUL');
assert.deepEqual(applied.run.papers[0].candidates[1].defectCodes, ['EVIDENCE_LOCATOR_INCOMPLETE']);
assert.equal(applied.summary.totals.falseAcceptCount, 1);
assert.equal(applied.summary.phaseASafetyGate, 'FAIL');

const unknownCandidateAnnotation = structuredClone(annotation);
unknownCandidateAnnotation.adjudications[0].candidateKey = 'not-a-real-candidate';
assert.throws(
  () => applyReferenceAnnotation(preReferenceRun, unknownCandidateAnnotation),
  (error) => error?.code === 'REFERENCE_ANNOTATION_CANDIDATE_MISMATCH'
);

console.log(JSON.stringify({ total: 8, passed: 8, failed: 0 }, null, 2));
