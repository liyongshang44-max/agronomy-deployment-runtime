import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RealPaperBenchmarkError,
  summarizeRealPaperBenchmark
} from '../../scripts/real-paper-benchmark/summarize.mjs';

const corpus = JSON.parse(readFileSync(resolve('docs/implementation/real-paper-benchmark/corpus-v1.json'), 'utf8'));
assert.equal(corpus.benchmarkId, 'ADR_REAL_PAPER_BENCHMARK_V1');
assert.equal(corpus.status, 'REFERENCE_CORPUS_ONLY_NOT_DOMAIN_AUTHORITY');
assert.equal(corpus.goldStatus, 'NOT_ESTABLISHED');
assert.ok(Array.isArray(corpus.papers) && corpus.papers.length >= 1);
assert.equal(new Set(corpus.papers.map((paper) => paper.paperId)).size, corpus.papers.length);
const rp001 = corpus.papers.find((paper) => paper.paperId === 'RP001');
assert.ok(rp001, 'RP001 frozen baseline must remain in corpus authority');
assert.equal(rp001.license, 'CC_BY_4_0');
assert.equal(rp001.referenceAnnotationStatus, 'PENDING_INDEPENDENT_ANNOTATION_AND_DOMAIN_EXPERT_ADJUDICATION');
assert.equal(rp001.externalProcessing.operatorConfirmationStillRequired, true);
assert.equal(rp001.externalProcessing.automaticAuthorizationFromLicense, false);

const expansion = JSON.parse(readFileSync(resolve('benchmarks/real-paper-v1/expansion-candidates.json'), 'utf8'));
assert.equal(expansion.candidateSetVersion, 'adr.real-paper-expansion-candidates.v1');
assert.equal(expansion.authorityClaim, 'DISCOVERY_CANDIDATES_ONLY_NOT_CORPUS_AUTHORITY');
assert.equal(expansion.papers.length, 8);
assert.equal(new Set(expansion.papers.map((paper) => paper.paperId)).size, 8);
assert.ok(expansion.papers.every((paper) => paper.rightsAuthority === 'RUNTIME_ADJUDICATION_REQUIRED'));
assert.ok(expansion.papers.every((paper) => /^https:\/\//.test(paper.landingUrl)));
assert.ok(expansion.papers.every((paper) => Array.isArray(paper.stressDimensions) && paper.stressDimensions.length >= 4));
assert.ok(expansion.papers.every((paper) => !corpus.papers.some((frozen) => frozen.paperId === paper.paperId)));

function fixtureRun(runId, papers) {
  return {
    runVersion: 'adr.real-paper-benchmark-run.v1',
    benchmarkVersion: 'adr.real-paper-benchmark.v1',
    runMode: 'FIXTURE',
    runId,
    papers
  };
}

const calibrated = summarizeRealPaperBenchmark(fixtureRun('fixture-calibrated', [
  {
    paperId: 'paper-a',
    candidates: [
      { candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE', automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: 'ACCEPT_SOURCE_FAITHFUL', defectCodes: [] },
      { candidateKey: 'a2', claimType: 'BOUNDARY_CONSTRAINT', compilerStatus: 'REVIEWABLE', automatedStatus: 'AUTO_REJECTED', referenceDisposition: 'REJECT_SOURCE_FAITHFUL', defectCodes: ['EVIDENCE_LOCATOR_INCOMPLETE'] },
      { candidateKey: 'a3', claimType: 'CAUSAL_EFFECT', compilerStatus: 'REVIEWABLE', automatedStatus: 'ESCALATED_TO_HUMAN', referenceDisposition: 'REJECT_SOURCE_FAITHFUL', defectCodes: ['CAUSAL_ASSERTION_DECONTEXTUALIZED'] }
    ]
  },
  {
    paperId: 'paper-b',
    candidates: [
      { candidateKey: 'b1', claimType: null, compilerStatus: 'INVALID', automatedStatus: null, referenceDisposition: null, defectCodes: ['INVALID_CLAIM_CANDIDATE_TYPE'] },
      { candidateKey: 'b2', claimType: 'EVALUATION_CLAIM', compilerStatus: 'REVIEWABLE', automatedStatus: 'AUTO_REJECTED', referenceDisposition: 'ACCEPT_SOURCE_FAITHFUL', defectCodes: ['COMPOSITE_ASSERTION_SUPPORT_INCOMPLETE'] }
    ]
  }
]));

assert.equal(calibrated.runMode, 'FIXTURE');
assert.equal(calibrated.exactEvidenceGate, 'FIXTURE_NOT_REAL_EVIDENCE');
assert.equal(calibrated.totals.paperCount, 2);
assert.equal(calibrated.totals.rawCandidateCount, 5);
assert.equal(calibrated.totals.reviewableCount, 4);
assert.equal(calibrated.totals.invalidCount, 1);
assert.equal(calibrated.totals.autoAcceptedCount, 1);
assert.equal(calibrated.totals.autoRejectedCount, 2);
assert.equal(calibrated.totals.escalatedCount, 1);
assert.equal(calibrated.totals.autoResolvedCount, 3);
assert.equal(calibrated.totals.autoResolutionRate, 0.75);
assert.equal(calibrated.totals.escalationRate, 0.25);
assert.equal(calibrated.totals.invalidRate, 0.2);
assert.equal(calibrated.totals.referenceAdjudicatedAutoAcceptCount, 1);
assert.equal(calibrated.totals.referenceAdjudicatedAutoRejectCount, 2);
assert.equal(calibrated.totals.automatedAgreementCount, 2);
assert.equal(calibrated.totals.falseAcceptCount, 0);
assert.equal(calibrated.totals.falseRejectCount, 1);
assert.equal(calibrated.totals.falseAcceptRate, 0);
assert.equal(calibrated.totals.falseRejectRate, 0.5);
assert.equal(calibrated.phaseASafetyGate, 'PASS');
assert.equal(calibrated.defectCodeCounts.EVIDENCE_LOCATOR_INCOMPLETE, 1);
assert.equal(calibrated.claimTypeCounts.PARAMETER, 1);
assert.equal(calibrated.authorityClaim, 'BENCHMARK_METRICS_ARE_NOT_SCIENTIFIC_AUTHORITY');

const falseAccept = summarizeRealPaperBenchmark(fixtureRun('fixture-false-accept', [{
  paperId: 'paper-a',
  candidates: [{ candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE', automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: 'REJECT_SOURCE_FAITHFUL', defectCodes: ['TEMPORAL_WINDOW_OMITTED'] }]
}]));
assert.equal(falseAccept.totals.falseAcceptCount, 1);
assert.equal(falseAccept.totals.falseAcceptRate, 1);
assert.equal(falseAccept.phaseASafetyGate, 'FAIL');

const incomplete = summarizeRealPaperBenchmark(fixtureRun('fixture-incomplete-reference', [{
  paperId: 'paper-a',
  candidates: [{ candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE', automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: null, defectCodes: [] }]
}]));
assert.equal(incomplete.phaseASafetyGate, 'INCOMPLETE_REFERENCE_COVERAGE');
assert.equal(incomplete.totals.autoAcceptReferenceCoverage, 0);

assert.throws(() => summarizeRealPaperBenchmark(fixtureRun('fixture-invalid', [{
  paperId: 'paper-a',
  candidates: [{ candidateKey: 'x', claimType: null, compilerStatus: 'INVALID', automatedStatus: 'AUTO_REJECTED', referenceDisposition: null, defectCodes: [] }]
}])), (error) => error instanceof RealPaperBenchmarkError && error.code === 'INVALID_BENCHMARK_RUN');

assert.throws(() => summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runMode: 'REAL',
  runId: 'real-missing-evidence',
  papers: [{ paperId: 'RP001', candidates: [] }]
}), (error) => error instanceof RealPaperBenchmarkError && error.code === 'REAL_RUN_EXECUTION_EVIDENCE_REQUIRED');

const real = summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runMode: 'REAL',
  runId: 'real-exact-evidence-fixture',
  execution: {
    repositoryFullName: 'liyongshang44-max/agronomy-deployment-runtime',
    codeHeadSha: '0123456789abcdef0123456789abcdef01234567',
    rightsEnforcement: 'RA02_EXACT_SUBJECT_FAIL_CLOSED'
  },
  papers: [{
    paperId: 'RP001',
    evidence: {
      sourceRef: { kind: 'Source', logicalId: 'source.rp001', version: '1', semanticHash: `sha256:${'1'.repeat(64)}` },
      sourceArtifactRef: { kind: 'SourceArtifact', logicalId: 'artifact.rp001', version: '1', semanticHash: `sha256:${'2'.repeat(64)}` },
      contentHash: `sha256:${'3'.repeat(64)}`,
      byteLength: 123456,
      retentionRightsDecisionRef: { kind: 'RightsDecision', logicalId: 'rights.rp001.retain', version: '1', semanticHash: `sha256:${'4'.repeat(64)}` }
    },
    candidates: [{
      candidateKey: 'rp001-c1', claimType: 'BOUNDARY_CONSTRAINT', compilerStatus: 'REVIEWABLE',
      automatedStatus: 'AUTO_REJECTED', referenceDisposition: 'REJECT_SOURCE_FAITHFUL', defectCodes: ['TEMPORAL_FIDELITY']
    }]
  }]
});
assert.equal(real.runMode, 'REAL');
assert.equal(real.exactEvidenceGate, 'PASS');
assert.equal(real.execution.codeHeadSha, '0123456789abcdef0123456789abcdef01234567');
assert.equal(real.phaseASafetyGate, 'PASS');

console.log(JSON.stringify({ total: 7, passed: 7, failed: 0 }, null, 2));
