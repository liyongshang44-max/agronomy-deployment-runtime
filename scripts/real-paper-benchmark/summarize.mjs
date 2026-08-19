import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REAL_PAPER_BENCHMARK_RUN_VERSION = 'adr.real-paper-benchmark-run.v1';
export const REAL_PAPER_BENCHMARK_VERSION = 'adr.real-paper-benchmark.v1';

const COMPILER_STATUSES = new Set(['REVIEWABLE', 'INVALID']);
const AUTOMATED_STATUSES = new Set([
  'AUTO_ACCEPTED',
  'AUTO_REJECTED',
  'ESCALATED_TO_HUMAN',
  'ESCALATED_PENDING_HUMAN',
  'SKIPPED_ALREADY_REVIEWED'
]);
const REFERENCE_DISPOSITIONS = new Set([
  'ACCEPT_SOURCE_FAITHFUL',
  'REJECT_SOURCE_FAITHFUL'
]);

export class RealPaperBenchmarkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RealPaperBenchmarkError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function finiteRatio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function normalizeCandidate(candidate, path) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path} must be an object`);
  }
  const candidateKey = requiredText(candidate.candidateKey, `${path}.candidateKey`);
  const compilerStatus = requiredText(candidate.compilerStatus, `${path}.compilerStatus`);
  if (!COMPILER_STATUSES.has(compilerStatus)) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path}.compilerStatus is unsupported`);
  }
  const claimType = candidate.claimType === null || candidate.claimType === undefined
    ? null
    : requiredText(candidate.claimType, `${path}.claimType`);
  const automatedStatus = candidate.automatedStatus === null || candidate.automatedStatus === undefined
    ? null
    : requiredText(candidate.automatedStatus, `${path}.automatedStatus`);
  const referenceDisposition = candidate.referenceDisposition === null || candidate.referenceDisposition === undefined
    ? null
    : requiredText(candidate.referenceDisposition, `${path}.referenceDisposition`);
  const defectCodes = candidate.defectCodes ?? [];
  if (!Array.isArray(defectCodes)) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path}.defectCodes must be an array`);
  }
  const normalizedDefects = [...new Set(defectCodes.map((code, index) => requiredText(code, `${path}.defectCodes[${index}]`)))].sort();

  if (compilerStatus === 'INVALID') {
    if (automatedStatus !== null) {
      throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path} INVALID candidate cannot have automatedStatus`);
    }
    if (referenceDisposition !== null) {
      throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path} INVALID candidate cannot have source-faithful referenceDisposition`);
    }
  } else {
    if (!AUTOMATED_STATUSES.has(automatedStatus)) {
      throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path} REVIEWABLE candidate requires supported automatedStatus`);
    }
    if (referenceDisposition !== null && !REFERENCE_DISPOSITIONS.has(referenceDisposition)) {
      throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path}.referenceDisposition is unsupported`);
    }
  }

  return {
    candidateKey,
    claimType,
    compilerStatus,
    automatedStatus,
    referenceDisposition,
    defectCodes: normalizedDefects
  };
}

function normalizeRun(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', 'benchmark run must be an object');
  }
  if (run.runVersion !== REAL_PAPER_BENCHMARK_RUN_VERSION) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN_VERSION', `runVersion must be ${REAL_PAPER_BENCHMARK_RUN_VERSION}`);
  }
  if (run.benchmarkVersion !== REAL_PAPER_BENCHMARK_VERSION) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_VERSION', `benchmarkVersion must be ${REAL_PAPER_BENCHMARK_VERSION}`);
  }
  const runId = requiredText(run.runId, 'runId');
  if (!Array.isArray(run.papers)) {
    throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', 'papers must be an array');
  }
  const paperIds = new Set();
  const papers = run.papers.map((paper, paperIndex) => {
    const path = `papers[${paperIndex}]`;
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) {
      throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path} must be an object`);
    }
    const paperId = requiredText(paper.paperId, `${path}.paperId`);
    if (paperIds.has(paperId)) throw new RealPaperBenchmarkError('DUPLICATE_BENCHMARK_PAPER', `duplicate paperId ${paperId}`);
    paperIds.add(paperId);
    if (!Array.isArray(paper.candidates)) throw new RealPaperBenchmarkError('INVALID_BENCHMARK_RUN', `${path}.candidates must be an array`);
    const candidateKeys = new Set();
    const candidates = paper.candidates.map((candidate, candidateIndex) => {
      const normalized = normalizeCandidate(candidate, `${path}.candidates[${candidateIndex}]`);
      if (candidateKeys.has(normalized.candidateKey)) {
        throw new RealPaperBenchmarkError('DUPLICATE_BENCHMARK_CANDIDATE', `duplicate candidateKey ${paperId}/${normalized.candidateKey}`);
      }
      candidateKeys.add(normalized.candidateKey);
      return normalized;
    });
    return { paperId, candidates };
  });
  return { runId, papers };
}

export function summarizeRealPaperBenchmark(run) {
  const normalized = normalizeRun(run);
  const totals = {
    paperCount: normalized.papers.length,
    rawCandidateCount: 0,
    reviewableCount: 0,
    invalidCount: 0,
    autoAcceptedCount: 0,
    autoRejectedCount: 0,
    escalatedCount: 0,
    skippedCount: 0,
    referenceAdjudicatedCount: 0,
    referenceAdjudicatedAutoAcceptCount: 0,
    referenceAdjudicatedAutoRejectCount: 0,
    automatedAgreementCount: 0,
    falseAcceptCount: 0,
    falseRejectCount: 0
  };
  const defectCodeCounts = {};
  const claimTypeCounts = {};
  const byPaper = [];

  for (const paper of normalized.papers) {
    const paperCounts = {
      paperId: paper.paperId,
      rawCandidateCount: paper.candidates.length,
      reviewableCount: 0,
      invalidCount: 0,
      autoAcceptedCount: 0,
      autoRejectedCount: 0,
      escalatedCount: 0,
      skippedCount: 0,
      referenceAdjudicatedCount: 0,
      falseAcceptCount: 0,
      falseRejectCount: 0
    };
    totals.rawCandidateCount += paper.candidates.length;

    for (const candidate of paper.candidates) {
      if (candidate.claimType) increment(claimTypeCounts, candidate.claimType);
      for (const code of candidate.defectCodes) increment(defectCodeCounts, code);

      if (candidate.compilerStatus === 'INVALID') {
        totals.invalidCount += 1;
        paperCounts.invalidCount += 1;
        continue;
      }

      totals.reviewableCount += 1;
      paperCounts.reviewableCount += 1;
      if (candidate.automatedStatus === 'AUTO_ACCEPTED') {
        totals.autoAcceptedCount += 1;
        paperCounts.autoAcceptedCount += 1;
      } else if (candidate.automatedStatus === 'AUTO_REJECTED') {
        totals.autoRejectedCount += 1;
        paperCounts.autoRejectedCount += 1;
      } else if (candidate.automatedStatus === 'ESCALATED_TO_HUMAN' || candidate.automatedStatus === 'ESCALATED_PENDING_HUMAN') {
        totals.escalatedCount += 1;
        paperCounts.escalatedCount += 1;
      } else if (candidate.automatedStatus === 'SKIPPED_ALREADY_REVIEWED') {
        totals.skippedCount += 1;
        paperCounts.skippedCount += 1;
      }

      if (candidate.referenceDisposition) {
        totals.referenceAdjudicatedCount += 1;
        paperCounts.referenceAdjudicatedCount += 1;
      }
      if (candidate.automatedStatus === 'AUTO_ACCEPTED' && candidate.referenceDisposition) {
        totals.referenceAdjudicatedAutoAcceptCount += 1;
        if (candidate.referenceDisposition === 'ACCEPT_SOURCE_FAITHFUL') totals.automatedAgreementCount += 1;
        else {
          totals.falseAcceptCount += 1;
          paperCounts.falseAcceptCount += 1;
        }
      }
      if (candidate.automatedStatus === 'AUTO_REJECTED' && candidate.referenceDisposition) {
        totals.referenceAdjudicatedAutoRejectCount += 1;
        if (candidate.referenceDisposition === 'REJECT_SOURCE_FAITHFUL') totals.automatedAgreementCount += 1;
        else {
          totals.falseRejectCount += 1;
          paperCounts.falseRejectCount += 1;
        }
      }
    }
    byPaper.push(paperCounts);
  }

  const autoResolvedCount = totals.autoAcceptedCount + totals.autoRejectedCount;
  const autoAcceptReferenceCoverage = finiteRatio(totals.referenceAdjudicatedAutoAcceptCount, totals.autoAcceptedCount);
  const phaseASafetyGate = totals.falseAcceptCount > 0
    ? 'FAIL'
    : totals.autoAcceptedCount > totals.referenceAdjudicatedAutoAcceptCount
      ? 'INCOMPLETE_REFERENCE_COVERAGE'
      : 'PASS';

  return {
    benchmarkVersion: REAL_PAPER_BENCHMARK_VERSION,
    runVersion: REAL_PAPER_BENCHMARK_RUN_VERSION,
    runId: normalized.runId,
    totals: {
      ...totals,
      autoResolvedCount,
      autoResolutionRate: finiteRatio(autoResolvedCount, totals.reviewableCount),
      escalationRate: finiteRatio(totals.escalatedCount, totals.reviewableCount),
      invalidRate: finiteRatio(totals.invalidCount, totals.rawCandidateCount),
      autoAcceptReferenceCoverage,
      falseAcceptRate: finiteRatio(totals.falseAcceptCount, totals.referenceAdjudicatedAutoAcceptCount),
      falseRejectRate: finiteRatio(totals.falseRejectCount, totals.referenceAdjudicatedAutoRejectCount)
    },
    phaseASafetyGate,
    byPaper,
    claimTypeCounts,
    defectCodeCounts,
    authorityClaim: 'BENCHMARK_METRICS_ARE_NOT_SCIENTIFIC_AUTHORITY'
  };
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/real-paper-benchmark/summarize.mjs <run.json>');
    process.exitCode = 2;
    return;
  }
  const run = JSON.parse(readFileSync(path, 'utf8'));
  console.log(JSON.stringify(summarizeRealPaperBenchmark(run), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
