import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RealPaperBenchmarkError,
  summarizeRealPaperBenchmark
} from '../../scripts/real-paper-benchmark/summarize.mjs';

const corpus = JSON.parse(readFileSync(resolve('benchmarks/real-paper-v1/corpus.json'), 'utf8'));
assert.equal(corpus.benchmarkVersion, 'adr.real-paper-benchmark.v1');
assert.equal(corpus.authorityClaim, 'REFERENCE_CORPUS_ONLY_NOT_SCIENTIFIC_AUTHORITY');
assert.equal(corpus.papers.length, 8);
assert.equal(new Set(corpus.papers.map((paper) => paper.paperId)).size, 8);
assert.ok(corpus.papers.every((paper) => paper.rightsAuthority === 'RUNTIME_ADJUDICATION_REQUIRED'));
assert.ok(corpus.papers.every((paper) => /^https:\/\//.test(paper.landingUrl)));
assert.ok(corpus.papers.every((paper) => Array.isArray(paper.stressDimensions) && paper.stressDimensions.length >= 4));

const calibrated = summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runId: 'fixture-calibrated',
  papers: [
    {
      paperId: 'paper-a',
      candidates: [
        {
          candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE',
          automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: 'ACCEPT_SOURCE_FAITHFUL', defectCodes: []
        },
        {
          candidateKey: 'a2', claimType: 'BOUNDARY_CONSTRAINT', compilerStatus: 'REVIEWABLE',
          automatedStatus: 'AUTO_REJECTED', referenceDisposition: 'REJECT_SOURCE_FAITHFUL',
          defectCodes: ['EVIDENCE_LOCATOR_INCOMPLETE']
        },
        {
          candidateKey: 'a3', claimType: 'CAUSAL_EFFECT', compilerStatus: 'REVIEWABLE',
          automatedStatus: 'ESCALATED_TO_HUMAN', referenceDisposition: 'REJECT_SOURCE_FAITHFUL',
          defectCodes: ['CAUSAL_ASSERTION_DECONTEXTUALIZED']
        }
      ]
    },
    {
      paperId: 'paper-b',
      candidates: [
        {
          candidateKey: 'b1', claimType: null, compilerStatus: 'INVALID', automatedStatus: null,
          referenceDisposition: null, defectCodes: ['INVALID_CLAIM_CANDIDATE_TYPE']
        },
        {
          candidateKey: 'b2', claimType: 'EVALUATION_CLAIM', compilerStatus: 'REVIEWABLE',
          automatedStatus: 'AUTO_REJECTED', referenceDisposition: 'ACCEPT_SOURCE_FAITHFUL',
          defectCodes: ['COMPOSITE_ASSERTION_SUPPORT_INCOMPLETE']
        }
      ]
    }
  ]
});

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

const falseAccept = summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runId: 'fixture-false-accept',
  papers: [{
    paperId: 'paper-a',
    candidates: [{
      candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE',
      automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: 'REJECT_SOURCE_FAITHFUL',
      defectCodes: ['TEMPORAL_WINDOW_OMITTED']
    }]
  }]
});
assert.equal(falseAccept.totals.falseAcceptCount, 1);
assert.equal(falseAccept.totals.falseAcceptRate, 1);
assert.equal(falseAccept.phaseASafetyGate, 'FAIL');

const incomplete = summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runId: 'fixture-incomplete-reference',
  papers: [{
    paperId: 'paper-a',
    candidates: [{
      candidateKey: 'a1', claimType: 'PARAMETER', compilerStatus: 'REVIEWABLE',
      automatedStatus: 'AUTO_ACCEPTED', referenceDisposition: null, defectCodes: []
    }]
  }]
});
assert.equal(incomplete.phaseASafetyGate, 'INCOMPLETE_REFERENCE_COVERAGE');
assert.equal(incomplete.totals.autoAcceptReferenceCoverage, 0);

assert.throws(() => summarizeRealPaperBenchmark({
  runVersion: 'adr.real-paper-benchmark-run.v1',
  benchmarkVersion: 'adr.real-paper-benchmark.v1',
  runId: 'fixture-invalid',
  papers: [{
    paperId: 'paper-a',
    candidates: [{
      candidateKey: 'x', claimType: null, compilerStatus: 'INVALID',
      automatedStatus: 'AUTO_REJECTED', referenceDisposition: null, defectCodes: []
    }]
  }]
}), (error) => error instanceof RealPaperBenchmarkError && error.code === 'INVALID_BENCHMARK_RUN');

console.log(JSON.stringify({ total: 4, passed: 4, failed: 0 }, null, 2));
