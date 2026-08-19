import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore, PilotSourceIngestionService } from '../../packages/source-ingestion/src/index.mjs';
import { loadPilotCheckpoint } from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';
import { RealPaperBenchmarkError, summarizeRealPaperBenchmark } from './summarize.mjs';

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RealPaperBenchmarkError('INVALID_REAL_RUN_EVIDENCE', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function retentionReceiptFor({ ledger, uploadId, sourceRef }) {
  const effectKey = `source-retention:${uploadId}`;
  const matches = ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'PilotRightsSideEffectReceipt'
    && record.semanticPayload?.authorityClass === 'OPERATIONAL_EVIDENCE_ONLY_NOT_RIGHTS_GRANT'
    && record.semanticPayload?.effectKey === effectKey
    && record.semanticPayload?.operation === 'RETAIN_FULLTEXT'
    && sameAuthorityRef(record.semanticPayload?.subjectRef, sourceRef));
  if (matches.length === 0) {
    throw new RealPaperBenchmarkError('RETENTION_RIGHTS_EVIDENCE_REQUIRED', `no exact RETAIN_FULLTEXT side-effect receipt exists for upload ${uploadId}`);
  }
  if (matches.length > 1) {
    throw new RealPaperBenchmarkError('RETENTION_RIGHTS_EVIDENCE_AMBIGUOUS', `multiple RETAIN_FULLTEXT side-effect receipts exist for upload ${uploadId}`);
  }
  return matches[0];
}

export function projectRealExecutionEvidence({
  paperId,
  dataDir,
  uploadId,
  codeHeadSha,
  repositoryFullName = 'liyongshang44-max/agronomy-deployment-runtime'
}) {
  const safePaperId = requiredText(paperId, 'paperId');
  const safeUploadId = requiredText(uploadId, 'uploadId');
  const safeCodeHead = requiredText(codeHeadSha, 'codeHeadSha');
  if (!COMMIT_SHA_RE.test(safeCodeHead)) {
    throw new RealPaperBenchmarkError('INVALID_REAL_RUN_EVIDENCE', 'codeHeadSha must be an exact 40-character lowercase commit SHA');
  }
  const root = resolve(requiredText(dataDir, 'dataDir'));
  const checkpoint = loadPilotCheckpoint({ path: join(root, 'runtime-checkpoint.json') });
  if (!checkpoint) {
    throw new RealPaperBenchmarkError('PILOT_CHECKPOINT_REQUIRED', 'durable pilot checkpoint does not exist');
  }

  // Rehydrate through the production persistence/ingestion path. Constructor restore
  // re-inspects the retained content-addressed object, so this projection does not trust
  // the ledger contentHash without verifying the exact retained bytes still match it.
  const ledger = AuthorityLedger.fromSnapshot(checkpoint.ledger);
  const artifactStore = new FileSystemScopedArtifactStore({ rootDir: join(root, 'artifacts') });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const ingestion = new PilotSourceIngestionService({
    sourceRegistry,
    artifactStore,
    snapshot: checkpoint.ingestion
  });
  const upload = ingestion.getUpload(safeUploadId);
  if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceRef || !upload.sourceArtifactRef) {
    throw new RealPaperBenchmarkError(
      'SOURCE_ARTIFACT_EVIDENCE_REQUIRED',
      `REAL benchmark evidence requires SOURCE_MATERIALIZED upload, received ${upload.state}`
    );
  }
  const source = sourceRegistry.resolveSource(upload.sourceRef);
  const artifact = sourceRegistry.resolveArtifact(upload.sourceArtifactRef);
  const retentionReceipt = retentionReceiptFor({ ledger, uploadId: safeUploadId, sourceRef: source.ref });
  const decision = ledger.resolve(retentionReceipt.semanticPayload.rightsDecisionRef);
  if (decision.ref.kind !== 'RightsDecision'
    || decision.semanticPayload?.operation !== 'RETAIN_FULLTEXT'
    || decision.semanticPayload?.outcome !== 'ALLOW'
    || !sameAuthorityRef(decision.semanticPayload?.subjectRef, source.ref)) {
    throw new RealPaperBenchmarkError('RETENTION_RIGHTS_EVIDENCE_INVALID', 'retention receipt does not bind an exact ALLOW RETAIN_FULLTEXT RightsDecision for the Source');
  }

  const evidence = {
    paperId: safePaperId,
    execution: {
      repositoryFullName: requiredText(repositoryFullName, 'repositoryFullName'),
      codeHeadSha: safeCodeHead,
      rightsEnforcement: 'RA02_EXACT_SUBJECT_FAIL_CLOSED'
    },
    paperEvidence: {
      sourceRef: source.ref,
      sourceArtifactRef: artifact.ref,
      contentHash: artifact.semanticPayload.contentHash,
      byteLength: artifact.semanticPayload.byteLength,
      retentionRightsDecisionRef: decision.ref
    },
    verification: {
      checkpointFormat: 'ADR_PILOT_LOCAL_CHECKPOINT_V1',
      artifactRetentionRehydratedAndVerified: true,
      retentionRightsReceiptRef: retentionReceipt.ref
    },
    authorityClaim: 'BENCHMARK_EXECUTION_EVIDENCE_PROJECTION_ONLY'
  };

  // Reuse the REAL-run validator as an independent contract check before returning.
  summarizeRealPaperBenchmark({
    runVersion: 'adr.real-paper-benchmark-run.v1',
    benchmarkVersion: 'adr.real-paper-benchmark.v1',
    runMode: 'REAL',
    runId: `evidence-check-${safePaperId}`,
    execution: evidence.execution,
    papers: [{ paperId: safePaperId, evidence: evidence.paperEvidence, candidates: [] }]
  });
  return evidence;
}

function main() {
  const [paperId, dataDir, uploadId, codeHeadSha, repositoryFullName] = process.argv.slice(2);
  if (!paperId || !dataDir || !uploadId || !codeHeadSha) {
    console.error('usage: node scripts/real-paper-benchmark/execution-evidence-from-checkpoint.mjs <paperId> <ADR_DATA_DIR> <uploadId> <exact-code-head-sha> [repositoryFullName]');
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(projectRealExecutionEvidence({
    paperId,
    dataDir,
    uploadId,
    codeHeadSha,
    ...(repositoryFullName ? { repositoryFullName } : {})
  }), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
