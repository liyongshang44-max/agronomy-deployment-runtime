import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  RealPaperBenchmarkError,
  summarizeRealPaperBenchmark
} from './summarize.mjs';

const ANNOTATION_VERSION = 'adr.real-paper-reference-annotation.v1';
const DISPOSITIONS = new Set(['ACCEPT_SOURCE_FAITHFUL', 'REJECT_SOURCE_FAITHFUL']);

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function referenceMap(annotation) {
  if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', 'reference annotation must be an object');
  }
  if (annotation.annotationVersion !== ANNOTATION_VERSION) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION_VERSION', `annotationVersion must be ${ANNOTATION_VERSION}`);
  }
  if (annotation.blindToAutomatedDisposition !== true) {
    throw new RealPaperBenchmarkError('REFERENCE_ANNOTATION_NOT_BLIND', 'reference annotation must be blind to automated disposition');
  }
  const paperId = requiredText(annotation.paperId, 'reference.paperId');
  if (!annotation.adjudicator || typeof annotation.adjudicator !== 'object' || Array.isArray(annotation.adjudicator)) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ADJUDICATOR', 'reference adjudicator is required');
  }
  requiredText(annotation.adjudicator.type, 'reference.adjudicator.type');
  requiredText(annotation.adjudicator.id, 'reference.adjudicator.id');
  if (!Array.isArray(annotation.adjudications)) {
    throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', 'reference.adjudications must be an array');
  }
  const map = new Map();
  for (const [index, item] of annotation.adjudications.entries()) {
    const candidateKey = requiredText(item?.candidateKey, `reference.adjudications[${index}].candidateKey`);
    if (map.has(candidateKey)) {
      throw new RealPaperBenchmarkError('DUPLICATE_REFERENCE_ANNOTATION', `duplicate reference candidate ${candidateKey}`);
    }
    const referenceDisposition = requiredText(
      item?.referenceDisposition,
      `reference.adjudications[${index}].referenceDisposition`
    );
    if (!DISPOSITIONS.has(referenceDisposition)) {
      throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', `unsupported reference disposition ${referenceDisposition}`);
    }
    if (!Array.isArray(item.defectCodes)) {
      throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', `reference.adjudications[${index}].defectCodes must be an array`);
    }
    const defectCodes = [...new Set(item.defectCodes.map((code, codeIndex) =>
      requiredText(code, `reference.adjudications[${index}].defectCodes[${codeIndex}]`)))].sort();
    if (referenceDisposition === 'REJECT_SOURCE_FAITHFUL' && defectCodes.length === 0) {
      throw new RealPaperBenchmarkError('INVALID_REFERENCE_ANNOTATION', `reference rejection ${candidateKey} requires defectCodes`);
    }
    map.set(candidateKey, { referenceDisposition, defectCodes });
  }
  return { paperId, map };
}

export function applyReferenceAnnotation(preReferenceRun, annotation) {
  const preSummary = summarizeRealPaperBenchmark(preReferenceRun);
  const references = referenceMap(annotation);
  const papers = preReferenceRun.papers.map((paper) => ({
    ...structuredClone(paper),
    candidates: paper.candidates.map((candidate) => structuredClone(candidate))
  }));
  const paper = papers.find((item) => item.paperId === references.paperId);
  if (!paper) {
    throw new RealPaperBenchmarkError(
      'REFERENCE_ANNOTATION_PAPER_MISMATCH',
      `reference paper ${references.paperId} is not present in benchmark run`
    );
  }
  const known = new Map(paper.candidates.map((candidate) => [candidate.candidateKey, candidate]));
  for (const [candidateKey, reference] of references.map.entries()) {
    const candidate = known.get(candidateKey);
    if (!candidate) {
      throw new RealPaperBenchmarkError('REFERENCE_ANNOTATION_CANDIDATE_MISMATCH', `unknown reference candidate ${candidateKey}`);
    }
    if (candidate.compilerStatus !== 'REVIEWABLE') {
      throw new RealPaperBenchmarkError(
        'REFERENCE_ANNOTATION_CANDIDATE_INVALID',
        `reference annotation cannot label compiler-invalid candidate ${candidateKey}`
      );
    }
    if (candidate.referenceDisposition !== null && candidate.referenceDisposition !== undefined) {
      throw new RealPaperBenchmarkError(
        'REFERENCE_ANNOTATION_ALREADY_APPLIED',
        `candidate ${candidateKey} already contains reference truth; expected pre-reference run`
      );
    }
    candidate.referenceDisposition = reference.referenceDisposition;
    candidate.defectCodes = reference.defectCodes;
  }
  const run = {
    ...structuredClone(preReferenceRun),
    runId: `${preReferenceRun.runId}-referenced`,
    papers
  };
  const summary = summarizeRealPaperBenchmark(run);
  return {
    run,
    summary,
    referenceApplication: {
      annotationVersion: ANNOTATION_VERSION,
      paperId: references.paperId,
      appliedCount: references.map.size,
      automatedStatusMutationAllowed: false,
      preReferencePhaseASafetyGate: preSummary.phaseASafetyGate,
      authorityClaim: 'REFERENCE_LABEL_APPLICATION_ONLY_NOT_SCIENTIFIC_AUTHORITY'
    }
  };
}

function main() {
  const [preReferenceRunPath, annotationPath, outputRunPath, outputSummaryPath] = process.argv.slice(2);
  if (!preReferenceRunPath || !annotationPath || !outputRunPath || !outputSummaryPath) {
    console.error('usage: node scripts/real-paper-benchmark/apply-reference-annotation.mjs <benchmark-run-pre-reference.json> <reference-annotation.json> <final-run.json> <final-summary.json>');
    process.exitCode = 2;
    return;
  }
  const preReferenceRun = JSON.parse(readFileSync(preReferenceRunPath, 'utf8'));
  const annotation = JSON.parse(readFileSync(annotationPath, 'utf8'));
  const result = applyReferenceAnnotation(preReferenceRun, annotation);
  writeFileSync(outputRunPath, `${JSON.stringify(result.run, null, 2)}\n`, 'utf8');
  writeFileSync(outputSummaryPath, `${JSON.stringify(result.summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result.referenceApplication, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
