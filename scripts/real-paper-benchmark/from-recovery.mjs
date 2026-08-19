import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  REAL_PAPER_BENCHMARK_RUN_VERSION,
  REAL_PAPER_BENCHMARK_VERSION,
  RealPaperBenchmarkError,
  summarizeRealPaperBenchmark
} from './summarize.mjs';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RealPaperBenchmarkError('INVALID_RECOVERY_EXPORT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function candidateIdentity(candidate, index) {
  const ref = candidate?.claimCandidateRef;
  if (ref && typeof ref.logicalId === 'string' && typeof ref.version === 'string' && typeof ref.semanticHash === 'string') {
    return `${ref.logicalId}@${ref.version}#${ref.semanticHash}`;
  }
  return `candidate-${String(index + 1).padStart(4, '0')}`;
}

function automatedStatus(candidate) {
  const automated = candidate.automatedReview;
  if (!automated) return candidate.review ? 'SKIPPED_ALREADY_REVIEWED' : null;
  if (automated.effectiveDisposition === 'ACCEPT_SOURCE_FAITHFUL' && automated.status === 'TERMINAL_REVIEW_MATERIALIZED') {
    return 'AUTO_ACCEPTED';
  }
  if (automated.effectiveDisposition === 'REJECT_SOURCE_FAITHFUL' && automated.status === 'TERMINAL_REVIEW_MATERIALIZED') {
    return 'AUTO_REJECTED';
  }
  if (automated.effectiveDisposition === 'ESCALATE_TO_HUMAN') {
    return candidate.review ? 'ESCALATED_TO_HUMAN' : 'ESCALATED_PENDING_HUMAN';
  }
  throw new RealPaperBenchmarkError(
    'RECOVERY_AUTOMATED_STATE_INCOMPLETE',
    `candidate ${candidateIdentity(candidate, 0)} has automated state ${automated.status ?? 'UNKNOWN'} without a benchmark-safe mapping`
  );
}

function referenceIndex(referenceLabels, expectedPaperId) {
  if (!referenceLabels) return new Map();
  if (referenceLabels.annotationVersion !== 'adr.real-paper-reference-annotation.v1') {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION_VERSION', 'unsupported reference annotation version');
  }
  if (referenceLabels.blindToAutomatedDisposition !== true) {
    throw new RealPaperBenchmarkError(
      'REFERENCE_ANNOTATION_NOT_BLIND',
      'reference annotation must be completed without seeing the automated disposition'
    );
  }
  if (referenceLabels.paperId !== expectedPaperId) {
    throw new RealPaperBenchmarkError('REFERENCE_ANNOTATION_PAPER_MISMATCH', 'reference annotation paperId must match benchmark paperId');
  }
  if (!referenceLabels.adjudicator || typeof referenceLabels.adjudicator !== 'object' || Array.isArray(referenceLabels.adjudicator)) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ADJUDICATOR', 'reference adjudicator metadata is required');
  }
  requiredText(referenceLabels.adjudicator.type, 'reference.adjudicator.type');
  requiredText(referenceLabels.adjudicator.id, 'reference.adjudicator.id');
  if (!Array.isArray(referenceLabels.adjudications)) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', 'reference adjudications must be an array');
  }
  const map = new Map();
  for (const item of referenceLabels.adjudications) {
    const candidateKey = requiredText(item.candidateKey, 'reference.candidateKey');
    if (map.has(candidateKey)) throw new RealPaperBenchmarkError('DUPLICATE_REFERENCE_ANNOTATION', `duplicate reference annotation ${candidateKey}`);
    const disposition = requiredText(item.referenceDisposition, 'reference.referenceDisposition');
    if (!['ACCEPT_SOURCE_FAITHFUL', 'REJECT_SOURCE_FAITHFUL'].includes(disposition)) {
      throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', `unsupported reference disposition ${disposition}`);
    }
    const defectCodes = item.defectCodes ?? [];
    if (!Array.isArray(defectCodes)) throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', 'reference defectCodes must be an array');
    map.set(candidateKey, {
      referenceDisposition: disposition,
      defectCodes: defectCodes.map((code) => requiredText(code, 'reference.defectCode'))
    });
  }
  return map;
}

export function benchmarkPaperFromRecovery({ paperId, compilation, referenceLabels = null, evidence = null }) {
  const safePaperId = requiredText(paperId, 'paperId');
  if (!compilation || typeof compilation !== 'object' || !Array.isArray(compilation.candidates)) {
    throw new RealPaperBenchmarkError('INVALID_RECOVERY_EXPORT', 'compilation with candidates[] is required');
  }
  const references = referenceIndex(referenceLabels, safePaperId);
  const candidates = compilation.candidates.map((candidate, index) => {
    const candidateKey = candidateIdentity(candidate, index);
    const status = automatedStatus(candidate);
    if (!status) {
      throw new RealPaperBenchmarkError('RECOVERY_CANDIDATE_NOT_AUTOMATED', `candidate ${candidateKey} has no automated or prior terminal review state`);
    }
    const reference = references.get(candidateKey) ?? null;
    return {
      candidateKey,
      claimType: candidate.claimType ?? null,
      compilerStatus: 'REVIEWABLE',
      automatedStatus: status,
      referenceDisposition: reference?.referenceDisposition ?? null,
      defectCodes: reference?.defectCodes ?? []
    };
  });

  const originalCandidateCount = compilation.runMetadata?.originalCandidateCount;
  const invalidCandidateCount = compilation.runMetadata?.invalidCandidateCount;
  if (Number.isSafeInteger(originalCandidateCount) && Number.isSafeInteger(invalidCandidateCount)
    && originalCandidateCount >= candidates.length && invalidCandidateCount === originalCandidateCount - candidates.length) {
    for (let index = 0; index < invalidCandidateCount; index += 1) {
      candidates.push({
        candidateKey: `compiler-invalid-${String(index + 1).padStart(4, '0')}`,
        claimType: null,
        compilerStatus: 'INVALID',
        automatedStatus: null,
        referenceDisposition: null,
        defectCodes: ['COMPILER_INVALID_CANDIDATE_BODY_NOT_RECOVERED']
      });
    }
  }

  return {
    paperId: safePaperId,
    ...(evidence ? { evidence } : {}),
    candidates
  };
}

export function buildBenchmarkRun({ runId, papers, runMode = 'FIXTURE', execution = null }) {
  const run = {
    runVersion: REAL_PAPER_BENCHMARK_RUN_VERSION,
    benchmarkVersion: REAL_PAPER_BENCHMARK_VERSION,
    runMode,
    runId: requiredText(runId, 'runId'),
    ...(execution ? { execution } : {}),
    papers
  };
  summarizeRealPaperBenchmark(run);
  return run;
}

function main() {
  const [paperId, recoveryPath, referencePath, executionEvidencePath] = process.argv.slice(2);
  if (!paperId || !recoveryPath) {
    console.error('usage: node scripts/real-paper-benchmark/from-recovery.mjs <paperId> <compilation-recovery.json> [reference-annotation.json] [real-execution-evidence.json]');
    process.exitCode = 2;
    return;
  }
  const recovery = JSON.parse(readFileSync(recoveryPath, 'utf8'));
  const referenceLabels = referencePath ? JSON.parse(readFileSync(referencePath, 'utf8')) : null;
  const executionEvidence = executionEvidencePath ? JSON.parse(readFileSync(executionEvidencePath, 'utf8')) : null;
  if (!Array.isArray(recovery.compilations) || recovery.compilations.length !== 1) {
    throw new RealPaperBenchmarkError('RECOVERY_COMPILATION_SELECTION_REQUIRED', 'input recovery JSON must contain exactly one selected compilation');
  }
  if (executionEvidence && executionEvidence.paperId !== paperId) {
    throw new RealPaperBenchmarkError('REAL_RUN_EVIDENCE_PAPER_MISMATCH', 'real execution evidence paperId must match selected paperId');
  }
  const paper = benchmarkPaperFromRecovery({
    paperId,
    compilation: recovery.compilations[0],
    referenceLabels,
    evidence: executionEvidence?.paperEvidence ?? null
  });
  const run = buildBenchmarkRun({
    runId: `recovery-${paperId}`,
    papers: [paper],
    runMode: executionEvidence ? 'REAL' : 'FIXTURE',
    execution: executionEvidence?.execution ?? null
  });
  console.log(JSON.stringify({ run, summary: summarizeRealPaperBenchmark(run) }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
