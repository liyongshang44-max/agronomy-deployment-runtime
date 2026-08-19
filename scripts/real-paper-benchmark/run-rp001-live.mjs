import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPilotCheckpoint } from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';
import {
  benchmarkPaperFromRecovery,
  buildBenchmarkRun
} from './from-recovery.mjs';
import { projectRealExecutionEvidence } from './execution-evidence-from-checkpoint.mjs';
import { summarizeRealPaperBenchmark } from './summarize.mjs';

const PAPER_ID = 'RP001';
const SOURCE_LOGICAL_ID = 'source.paper.doi-10.3390-plants11213007';
const BASE_URL = (process.env.ADR_PILOT_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const TOKEN = required(process.env.ADR_OPERATOR_TOKEN, 'ADR_OPERATOR_TOKEN');
const DATA_DIR = resolve(required(process.env.ADR_DATA_DIR, 'ADR_DATA_DIR'));
const OUTPUT_DIR = resolve(process.env.ADR_RP001_LIVE_OUTPUT_DIR ?? '.adr-benchmark/rp001-live');
const CODE_HEAD = exactCodeHead(process.env.ADR_CODE_HEAD_SHA ?? '');
const JURISDICTION = required(process.env.ADR_RIGHTS_JURISDICTION ?? 'UNSPECIFIED', 'ADR_RIGHTS_JURISDICTION');
const EXTERNAL_PROCESSING_AUTHORIZED = process.env.ADR_EXTERNAL_PROCESSING_AUTHORIZED === 'true';

function required(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
}

function exactCodeHead(value) {
  const head = required(value, 'ADR_CODE_HEAD_SHA').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('ADR_CODE_HEAD_SHA must be an exact 40-character git SHA');
  return head;
}

async function requestJson(path, { method = 'GET', body = null, authorized = true } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(authorized ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = { raw: text }; }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function selectRp001Upload(checkpoint) {
  const sessions = checkpoint?.ingestion?.sessions;
  if (!Array.isArray(sessions)) throw new Error('pilot checkpoint ingestion.sessions[] is required');
  const matches = sessions.filter((session) =>
    session?.source?.logicalId === SOURCE_LOGICAL_ID
      || session?.source?.metadata?.paperId === PAPER_ID);
  if (matches.length !== 1) throw new Error(`expected exactly one RP001 upload session, found ${matches.length}`);
  const upload = matches[0];
  if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
    throw new Error(`RP001 live run requires SOURCE_MATERIALIZED, received ${upload.state}`);
  }
  return upload;
}

if (!EXTERNAL_PROCESSING_AUTHORIZED) {
  throw new Error('ADR_EXTERNAL_PROCESSING_AUTHORIZED=true is required before RP001 external LLM processing');
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const initialCheckpoint = loadPilotCheckpoint({ path: join(DATA_DIR, 'runtime-checkpoint.json') });
if (!initialCheckpoint) throw new Error('RP001 materialization checkpoint is required');
const upload = selectRp001Upload(initialCheckpoint);
const uploadPath = `/operator/source-uploads/${encodeURIComponent(upload.uploadId)}`;

const ready = await requestJson('/readyz', { authorized: false });
if (!ready?.ready) throw new Error('pilot runtime is not ready');
if (!ready?.extraction?.configured) throw new Error('pilot LLM1 extraction provider is not configured');
if (!ready?.automatedSourceFaithfulReview?.configured && !ready?.automatedReview?.configured) {
  throw new Error('pilot LLM2 source-faithful reviewer is not configured');
}

const now = new Date();
const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const rights = await requestJson(`${uploadPath}/rights`, {
  method: 'POST',
  body: {
    subject: 'SOURCE_ARTIFACT',
    basisClass: 'LICENSE',
    rules: [
      {
        operation: 'READ_FOR_EXTRACTION',
        purposes: ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW'],
        jurisdictions: [JURISDICTION],
        obligations: []
      },
      {
        operation: 'MODEL_EGRESS',
        purposes: ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW'],
        jurisdictions: [JURISDICTION],
        obligations: []
      },
      {
        operation: 'RETAIN_DERIVED',
        purposes: ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW'],
        jurisdictions: [JURISDICTION],
        obligations: []
      }
    ],
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    version: `rp001-live-${CODE_HEAD.slice(0, 12)}`
  }
});
writeFileSync(join(OUTPUT_DIR, 'source-artifact-rights.json'), `${JSON.stringify(rights, null, 2)}\n`, 'utf8');

const extraction = await requestJson(`${uploadPath}/extract`, {
  method: 'POST',
  body: {
    externalProcessingAuthorized: true,
    compilationLogicalId: 'compilation.real-paper.RP001',
    compilationVersion: `rp001-llm1-${CODE_HEAD.slice(0, 12)}`
  }
});
writeFileSync(join(OUTPUT_DIR, 'llm1-extraction.json'), `${JSON.stringify(extraction, null, 2)}\n`, 'utf8');
if (!extraction?.compilationResultRef || !Number.isSafeInteger(extraction?.candidateCount)) {
  throw new Error('LLM1 extraction did not return exact compilationResultRef and candidateCount');
}

const automatedReview = await requestJson(`${uploadPath}/automated-review`, {
  method: 'POST',
  body: {
    externalProcessingAuthorized: true,
    compilationResultRef: extraction.compilationResultRef,
    retryEscalated: false,
    versionPrefix: `rp001-llm2-${CODE_HEAD.slice(0, 12)}`
  }
});
writeFileSync(join(OUTPUT_DIR, 'llm2-review.json'), `${JSON.stringify(automatedReview, null, 2)}\n`, 'utf8');

const recovery = await requestJson(`${uploadPath}/compilations`);
writeFileSync(join(OUTPUT_DIR, 'recovery.json'), `${JSON.stringify(recovery, null, 2)}\n`, 'utf8');
if (!Array.isArray(recovery.compilations) || recovery.compilations.length !== 1) {
  throw new Error(`RP001 live benchmark requires exactly one recoverable compilation, found ${recovery.compilations?.length ?? 'invalid'}`);
}

const executionEvidence = projectRealExecutionEvidence({
  paperId: PAPER_ID,
  dataDir: DATA_DIR,
  uploadId: upload.uploadId,
  codeHeadSha: CODE_HEAD
});
writeFileSync(join(OUTPUT_DIR, 'real-execution-evidence.json'), `${JSON.stringify(executionEvidence, null, 2)}\n`, 'utf8');

const paper = benchmarkPaperFromRecovery({
  paperId: PAPER_ID,
  compilation: recovery.compilations[0],
  referenceLabels: null,
  evidence: executionEvidence.paperEvidence
});
const benchmarkRun = buildBenchmarkRun({
  runId: `rp001-${CODE_HEAD.slice(0, 12)}-pre-reference`,
  papers: [paper],
  runMode: 'REAL',
  execution: executionEvidence.execution
});
const summary = summarizeRealPaperBenchmark(benchmarkRun);
writeFileSync(join(OUTPUT_DIR, 'benchmark-run-pre-reference.json'), `${JSON.stringify(benchmarkRun, null, 2)}\n`, 'utf8');
writeFileSync(join(OUTPUT_DIR, 'benchmark-summary-pre-reference.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

const finalCheckpoint = loadPilotCheckpoint({ path: join(DATA_DIR, 'runtime-checkpoint.json') });
const qualifications = finalCheckpoint.ledger.records.filter((record) => record.ref?.kind === 'ScientificQualificationDecision');
if (qualifications.length !== 0) {
  throw new Error(`automated source-faithful benchmark must not create ScientificQualificationDecision; found ${qualifications.length}`);
}

const result = {
  schemaVersion: 'adr.rp001-live-llm1-llm2-run.v1',
  paperId: PAPER_ID,
  codeHeadSha: CODE_HEAD,
  uploadId: upload.uploadId,
  sourceArtifactRef: upload.sourceArtifactRef,
  rightsGrantRef: rights.rightsGrantRef,
  compilationResultRef: extraction.compilationResultRef,
  llm1CandidateCount: extraction.candidateCount,
  llm2Batch: automatedReview,
  phaseASafetyGate: summary.phaseASafetyGate,
  referenceStatus: 'PENDING_BLIND_INDEPENDENT_REFERENCE_ADJUDICATION',
  scientificQualificationDecisionCount: 0,
  authorityClaim: 'BENCHMARK_RUN_OBSERVATION_ONLY_NOT_SCIENTIFIC_QUALIFICATION'
};
writeFileSync(join(OUTPUT_DIR, 'rp001-live-run.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
