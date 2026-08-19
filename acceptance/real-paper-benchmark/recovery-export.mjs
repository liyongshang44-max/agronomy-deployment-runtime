import { strict as assert } from 'node:assert';
import {
  benchmarkPaperFromRecovery,
  buildBenchmarkRun
} from '../../scripts/real-paper-benchmark/from-recovery.mjs';
import { summarizeRealPaperBenchmark } from '../../scripts/real-paper-benchmark/summarize.mjs';

function ref(id) {
  return {
    kind: 'ClaimCandidate',
    logicalId: `claim-candidate.${id}`,
    version: '1',
    semanticHash: `sha256:${id.padEnd(64, '0').slice(0, 64)}`
  };
}

const compilation = {
  runMetadata: { originalCandidateCount: 4, invalidCandidateCount: 1 },
  candidates: [
    {
      claimCandidateRef: ref('a1'),
      claimType: 'PARAMETER',
      automatedReview: {
        effectiveDisposition: 'ACCEPT_SOURCE_FAITHFUL',
        status: 'TERMINAL_REVIEW_MATERIALIZED'
      },
      review: { disposition: 'ACCEPT_SOURCE_FAITHFUL' }
    },
    {
      claimCandidateRef: ref('a2'),
      claimType: 'CAUSAL_EFFECT',
      automatedReview: {
        effectiveDisposition: 'ESCALATE_TO_HUMAN',
        status: 'ESCALATED_PENDING_HUMAN'
      },
      review: null
    },
    {
      claimCandidateRef: ref('a3'),
      claimType: 'BOUNDARY_CONSTRAINT',
      automatedReview: {
        effectiveDisposition: 'ESCALATE_TO_HUMAN',
        status: 'TERMINAL_REVIEW_MATERIALIZED'
      },
      review: { disposition: 'REJECT_SOURCE_FAITHFUL' }
    }
  ]
};

const noReference = benchmarkPaperFromRecovery({ paperId: 'fixture-paper', compilation });
assert.equal(noReference.candidates.length, 4);
assert.equal(noReference.candidates[0].automatedStatus, 'AUTO_ACCEPTED');
assert.equal(noReference.candidates[0].referenceDisposition, null, 'automated promoted review must not self-label as reference truth');
assert.equal(noReference.candidates[1].automatedStatus, 'ESCALATED_PENDING_HUMAN');
assert.equal(noReference.candidates[2].automatedStatus, 'ESCALATED_TO_HUMAN');
assert.equal(noReference.candidates[2].referenceDisposition, null, 'later human authority review is not silently copied into benchmark reference labels');
assert.equal(noReference.candidates[3].compilerStatus, 'INVALID');

const acceptedKey = noReference.candidates[0].candidateKey;
const escalatedKey = noReference.candidates[2].candidateKey;
const withReference = benchmarkPaperFromRecovery({
  paperId: 'fixture-paper',
  compilation,
  referenceLabels: {
    annotationVersion: 'adr.real-paper-reference-annotation.v1',
    adjudications: [
      {
        candidateKey: acceptedKey,
        referenceDisposition: 'REJECT_SOURCE_FAITHFUL',
        defectCodes: ['TEMPORAL_WINDOW_OMITTED']
      },
      {
        candidateKey: escalatedKey,
        referenceDisposition: 'REJECT_SOURCE_FAITHFUL',
        defectCodes: ['EVIDENCE_LOCATOR_INCOMPLETE']
      }
    ]
  }
});
assert.equal(withReference.candidates[0].referenceDisposition, 'REJECT_SOURCE_FAITHFUL');
assert.deepEqual(withReference.candidates[0].defectCodes, ['TEMPORAL_WINDOW_OMITTED']);
assert.equal(withReference.candidates[2].referenceDisposition, 'REJECT_SOURCE_FAITHFUL');

const run = buildBenchmarkRun({ runId: 'fixture-recovery-export', papers: [withReference] });
const summary = summarizeRealPaperBenchmark(run);
assert.equal(summary.totals.rawCandidateCount, 4);
assert.equal(summary.totals.reviewableCount, 3);
assert.equal(summary.totals.invalidCount, 1);
assert.equal(summary.totals.autoAcceptedCount, 1);
assert.equal(summary.totals.escalatedCount, 2);
assert.equal(summary.totals.falseAcceptCount, 1);
assert.equal(summary.phaseASafetyGate, 'FAIL');
assert.equal(summary.authorityClaim, 'BENCHMARK_METRICS_ARE_NOT_SCIENTIFIC_AUTHORITY');

console.log(JSON.stringify({ total: 3, passed: 3, failed: 0 }, null, 2));
