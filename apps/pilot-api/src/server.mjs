import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthorityLedger } from '../../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../../packages/source-registry/src/index.mjs';
import {
  DEFAULT_MAX_SOURCE_UPLOAD_BYTES,
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService,
  SourceIngestionError
} from '../../../packages/source-ingestion/src/index.mjs';
import {
  ScientificCompiler,
  ScientificCompilerError,
  createDeterministicCompilerDefinition
} from '../../../packages/scientific-compiler/src/index.mjs';
import { SourceFaithfulReviewError } from '../../../packages/knowledge-registry/src/source-faithful.mjs';
import { materializePilotOpenApi } from '../../../packages/public-api/src/index.mjs';
import {
  ADR_EXTRACTION_PROMPT_VERSION,
  ADR_EXTRACTION_PROVIDER,
  ADR_EXTRACTION_SCHEMA_VERSION,
  OpenAIExtractionError,
  extractCompilationProposalWithOpenAI
} from './extraction/openai.mjs';
import { ManualExternalProposalImportService } from './extraction/manual-import.mjs';
import { PilotReviewAdapter } from './review/pilot-review.mjs';
import { listRecoverableCompilations } from './recovery/compilation-recovery.mjs';
import {
  PilotCheckpointError,
  loadPilotCheckpoint,
  savePilotCheckpoint
} from './persistence/local-checkpoint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '../../pilot-web');
const DATA_DIR = resolve(process.env.ADR_DATA_DIR ?? '.adr-pilot');
const ARTIFACT_DIR = join(DATA_DIR, 'artifacts');
const CHECKPOINT_PATH = join(DATA_DIR, 'runtime-checkpoint.json');
const HOST = process.env.ADR_HOST ?? '127.0.0.1';
const PORT = Number(process.env.ADR_PORT ?? 8787);
const OPERATOR_TOKEN = process.env.ADR_OPERATOR_TOKEN ?? '';
const OPERATOR_ID = process.env.ADR_OPERATOR_ID ?? 'local-pilot-operator';
const MAX_UPLOAD_BYTES = Number(process.env.ADR_MAX_SOURCE_UPLOAD_BYTES ?? DEFAULT_MAX_SOURCE_UPLOAD_BYTES);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const EXTRACTION_MODEL = process.env.ADR_EXTRACTION_MODEL ?? '';
const MAX_JSON_BYTES = 1024 * 1024;

if (!Number.isSafeInteger(PORT) || PORT <= 0 || PORT > 65535) throw new Error('ADR_PORT must be a valid TCP port');
if (!Number.isSafeInteger(MAX_UPLOAD_BYTES) || MAX_UPLOAD_BYTES <= 0) throw new Error('ADR_MAX_SOURCE_UPLOAD_BYTES must be a positive safe integer');
if (!OPERATOR_TOKEN) throw new Error('ADR_OPERATOR_TOKEN is required; operator ingestion routes are never started without a bearer token');

mkdirSync(DATA_DIR, { recursive: true });
const restoredCheckpoint = loadPilotCheckpoint({ path: CHECKPOINT_PATH });
const ledger = restoredCheckpoint ? AuthorityLedger.fromSnapshot(restoredCheckpoint.ledger) : new AuthorityLedger();
const artifactStore = new FileSystemScopedArtifactStore({ rootDir: ARTIFACT_DIR });
const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
const ingestion = new PilotSourceIngestionService({
  sourceRegistry,
  artifactStore,
  maxUploadBytes: MAX_UPLOAD_BYTES,
  snapshot: restoredCheckpoint?.ingestion ?? null
});
const compiler = new ScientificCompiler({ ledger, sourceRegistry });
const manualProposalImporter = new ManualExternalProposalImportService({ ledger, sourceRegistry, artifactStore });
const reviewAdapter = new PilotReviewAdapter({ ledger, operatorId: OPERATOR_ID });
let compilerDefinition = null;
let checkpointHash = restoredCheckpoint ? 'RESTORED_AND_VERIFIED' : 'EMPTY_RUNTIME';

function checkpointRuntime() {
  checkpointHash = savePilotCheckpoint({ path: CHECKPOINT_PATH, ledger, ingestion });
  return checkpointHash;
}

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload, null, 2));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store'
  });
  res.end(body);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  const bytes = Buffer.from(body);
  res.writeHead(status, { 'content-type': contentType, 'content-length': bytes.byteLength, 'cache-control': 'no-store' });
  res.end(bytes);
}

function operatorAuthorized(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);
  if (token.length !== OPERATOR_TOKEN.length) return false;
  let mismatch = 0;
  for (let index = 0; index < token.length; index += 1) mismatch |= token.charCodeAt(index) ^ OPERATOR_TOKEN.charCodeAt(index);
  return mismatch === 0;
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.byteLength;
    if (total > MAX_JSON_BYTES) throw new SourceIngestionError('JSON_BODY_TOO_LARGE', 'JSON body exceeds 1 MiB');
    chunks.push(chunk);
  }
  if (total === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new SourceIngestionError('INVALID_JSON', 'request body is not valid JSON'); }
}

function audit(eventId, { actorType = 'USER', channel = 'pilot-api-source-ingestion' } = {}) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: actorType, id: OPERATOR_ID },
    details: { channel }
  };
}

function uploadPath(pathname) {
  const match = pathname.match(/^\/operator\/source-uploads\/([^/]+)(?:\/(content|finalize|extract|import-proposal|review))?$/);
  if (!match) return null;
  return { uploadId: decodeURIComponent(match[1]), action: match[2] ?? null };
}

function recoveryPath(pathname) {
  const match = pathname.match(/^\/operator\/source-uploads\/([^/]+)\/compilations$/);
  if (!match) return null;
  return { uploadId: decodeURIComponent(match[1]) };
}

function extractionConfigured() { return Boolean(OPENAI_API_KEY && EXTRACTION_MODEL); }

function extractionCompilerDefinition() {
  if (!extractionConfigured()) throw new OpenAIExtractionError('EXTRACTION_PROVIDER_NOT_CONFIGURED', 'OPENAI_API_KEY and ADR_EXTRACTION_MODEL are required');
  if (compilerDefinition) return compilerDefinition;
  compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.openai-paper-extraction',
    version: '1',
    compilerId: 'openai-paper-extraction',
    implementationVersion: 'pilot-v1',
    extractionContractVersion: ADR_EXTRACTION_SCHEMA_VERSION,
    locatorContractVersion: 'PDF_PAGE_TEXT_V1',
    configuration: {
      provider: ADR_EXTRACTION_PROVIDER,
      model: EXTRACTION_MODEL,
      promptVersion: ADR_EXTRACTION_PROMPT_VERSION,
      schemaVersion: ADR_EXTRACTION_SCHEMA_VERSION,
      outputAuthority: 'PROPOSAL_ONLY'
    },
    audit: audit('evt-compiler-definition:openai-paper-extraction:v1', { actorType: 'SERVICE', channel: 'pilot-api-source-extraction' })
  });
  return compilerDefinition;
}

function errorStatus(error) {
  if (error instanceof SourceIngestionError) {
    if (error.code === 'SOURCE_UPLOAD_NOT_FOUND') return 404;
    if (error.code === 'SOURCE_UPLOAD_TOO_LARGE' || error.code === 'JSON_BODY_TOO_LARGE') return 413;
    if (error.code === 'SOURCE_UPLOAD_STATE_INVALID') return 409;
    return 400;
  }
  if (error instanceof OpenAIExtractionError) return error.code === 'EXTRACTION_PROVIDER_NOT_CONFIGURED' ? 503 : 502;
  if (error instanceof ScientificCompilerError || error instanceof SourceFaithfulReviewError) return 409;
  if (error instanceof PilotCheckpointError) return 500;
  if (typeof error?.code === 'string' && error.code.includes('AUTHORITY')) return 409;
  return 500;
}

function safeError(error) {
  const status = errorStatus(error);
  return {
    status,
    body: {
      error: status === 500 ? 'INTERNAL_SERVER_ERROR' : (error.code ?? 'REQUEST_REJECTED'),
      message: status === 500 ? 'request failed' : error.message
    }
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'adr-pilot-api' });
    if (req.method === 'GET' && url.pathname === '/readyz') {
      return json(res, 200, {
        ready: true,
        service: 'adr-pilot-api',
        authorityPersistence: 'LOCAL_CHECKPOINT_RESTART_DURABLE_V1',
        artifactPersistence: 'FILESYSTEM_SCOPED_CONTENT_ADDRESSABLE',
        checkpoint: { path: CHECKPOINT_PATH, state: checkpointHash },
        maxSourceUploadBytes: MAX_UPLOAD_BYTES,
        extraction: {
          configured: extractionConfigured(),
          provider: ADR_EXTRACTION_PROVIDER,
          model: EXTRACTION_MODEL || null,
          externalProcessingAuthorizationRequired: true,
          proposalAuthority: 'PROPOSAL_ONLY'
        },
        manualExternalProposalImport: {
          configured: true,
          transport: 'USER_COPY_PASTE',
          modelIdentityAuthority: 'OPERATOR_DECLARED_NOT_VERIFIED',
          proposalAuthority: 'PROPOSAL_ONLY'
        },
        sourceFaithfulReview: { configured: true, humanDispositionRequired: true }
      });
    }
    if (req.method === 'GET' && url.pathname === '/openapi.json') return json(res, 200, materializePilotOpenApi());
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return text(res, 200, readFileSync(join(WEB_ROOT, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    }

    if (url.pathname.startsWith('/operator/')) {
      if (!operatorAuthorized(req)) return json(res, 401, { error: 'OPERATOR_AUTH_REQUIRED' });

      if (req.method === 'POST' && url.pathname === '/operator/source-uploads') {
        const created = ingestion.createUpload(await readJson(req));
        checkpointRuntime();
        return json(res, 201, created);
      }

      const recovery = recoveryPath(url.pathname);
      if (recovery && req.method === 'GET') {
        const upload = ingestion.getUpload(recovery.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `compilation recovery requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        return json(res, 200, listRecoverableCompilations({ ledger, sourceArtifactRef: upload.sourceArtifactRef }));
      }

      const parsed = uploadPath(url.pathname);
      if (parsed && req.method === 'GET' && parsed.action === null) return json(res, 200, ingestion.getUpload(parsed.uploadId));
      if (parsed && req.method === 'PUT' && parsed.action === 'content') {
        const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (contentType !== 'application/pdf') return json(res, 415, { error: 'PDF_CONTENT_TYPE_REQUIRED' });
        try {
          const stored = await ingestion.uploadPdf({ uploadId: parsed.uploadId, readable: req });
          checkpointRuntime();
          return json(res, 201, stored);
        } catch (error) {
          checkpointRuntime();
          throw error;
        }
      }
      if (parsed && req.method === 'POST' && parsed.action === 'finalize') {
        const result = ingestion.finalizeUpload({
          uploadId: parsed.uploadId,
          sourceAudit: audit(`evt-source-upload:${parsed.uploadId}:source`),
          artifactAudit: audit(`evt-source-upload:${parsed.uploadId}:artifact`)
        });
        checkpointRuntime();
        return json(res, 201, {
          upload: result.upload,
          sourceRef: result.source.ref,
          sourceArtifactRef: result.sourceArtifact.ref,
          contentHash: result.sourceArtifact.semanticPayload.contentHash,
          byteLength: result.sourceArtifact.semanticPayload.byteLength
        });
      }
      if (parsed && req.method === 'POST' && parsed.action === 'extract') {
        if (!extractionConfigured()) return json(res, 503, { error: 'EXTRACTION_PROVIDER_NOT_CONFIGURED', required: ['OPENAI_API_KEY', 'ADR_EXTRACTION_MODEL'] });
        const body = await readJson(req);
        if (body.externalProcessingAuthorized !== true) {
          return json(res, 409, {
            error: 'EXTERNAL_MODEL_PROCESSING_AUTHORIZATION_REQUIRED',
            message: 'set externalProcessingAuthorized=true only when this SourceArtifact may be sent to the configured external model provider'
          });
        }
        const upload = ingestion.getUpload(parsed.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `extract requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        const artifact = sourceRegistry.resolveArtifact(upload.sourceArtifactRef);
        const providerResult = await extractCompilationProposalWithOpenAI({
          readable: sourceRegistry.readArtifactStream(artifact.ref),
          byteLength: artifact.semanticPayload.byteLength,
          filename: upload.filename,
          model: EXTRACTION_MODEL,
          apiKey: OPENAI_API_KEY
        });
        const definition = extractionCompilerDefinition();
        const compilationVersion = typeof body.compilationVersion === 'string' && body.compilationVersion.trim()
          ? body.compilationVersion.trim() : `run-${new Date().toISOString()}`;
        const compilationLogicalId = typeof body.compilationLogicalId === 'string' && body.compilationLogicalId.trim()
          ? body.compilationLogicalId.trim() : `compilation.${artifact.ref.logicalId}`;
        const compiled = compiler.materializeCompilationProposal({
          compilationLogicalId,
          version: compilationVersion,
          sourceArtifactRef: artifact.ref,
          compilerDefinitionRef: definition.ref,
          proposal: providerResult.proposal,
          audit: audit(`evt-compilation:${parsed.uploadId}:${compilationVersion}`, { actorType: 'SERVICE', channel: 'pilot-api-source-extraction' })
        });
        checkpointRuntime();
        const candidates = compiled.claimCandidates.map((claimRecord, index) => {
          const contextRecord = compiled.sourceContextCandidates[index];
          return {
            claimCandidateRef: claimRecord.ref,
            sourceContextCandidateRef: contextRecord.ref,
            claimType: claimRecord.semanticPayload.claimType,
            assertion: claimRecord.semanticPayload.assertion,
            sourceLocator: claimRecord.semanticPayload.sourceLocator,
            extractionConfidence: claimRecord.semanticPayload.extractionConfidence ?? null,
            contextFamilies: contextRecord.semanticPayload.contextFamilies
          };
        });
        return json(res, 201, {
          compilationResultRef: compiled.result.ref,
          candidateCount: candidates.length,
          candidates,
          providerTrace: {
            provider: providerResult.providerTrace.provider,
            model: providerResult.providerTrace.model,
            responseId: providerResult.providerTrace.responseId,
            uploadedBytes: providerResult.providerTrace.uploadedBytes,
            fileDeletedAfterExtraction: providerResult.providerTrace.fileDeletedAfterExtraction
          },
          authorityClaim: 'PROPOSAL_ONLY'
        });
      }
      if (parsed && req.method === 'POST' && parsed.action === 'import-proposal') {
        const body = await readJson(req);
        const upload = ingestion.getUpload(parsed.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `manual import requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        const artifact = sourceRegistry.resolveArtifact(upload.sourceArtifactRef);
        const compilationVersion = typeof body.compilationVersion === 'string' && body.compilationVersion.trim()
          ? body.compilationVersion.trim() : `manual-${new Date().toISOString()}`;
        const compilationLogicalId = typeof body.compilationLogicalId === 'string' && body.compilationLogicalId.trim()
          ? body.compilationLogicalId.trim() : `compilation.manual-import.${artifact.ref.logicalId}`;
        const imported = manualProposalImporter.import({
          sourceArtifactRef: artifact.ref,
          proposal: body.proposal,
          providerLabel: body.providerLabel ?? 'EXTERNAL_WEB',
          modelLabel: body.modelLabel ?? 'UNKNOWN_MODEL',
          compilationLogicalId,
          version: compilationVersion,
          audit: audit(`evt-manual-import:${parsed.uploadId}:${compilationVersion}`, { actorType: 'USER', channel: 'pilot-api-manual-external-proposal-import' })
        });
        checkpointRuntime();
        return json(res, 200, {
          preflight: imported.preflight,
          materialized: imported.materialized,
          compilationResultRef: imported.compilation?.ref ?? null,
          candidateCount: imported.candidates.length,
          candidates: imported.candidates,
          authorityClaim: imported.materialized ? 'PROPOSAL_ONLY' : 'NO_AUTHORITY_MATERIALIZED'
        });
      }
      if (parsed && req.method === 'POST' && parsed.action === 'review') {
        const body = await readJson(req);
        const reviewed = reviewAdapter.review({
          compilationResultRef: body.compilationResultRef,
          claimCandidateRef: body.claimCandidateRef,
          sourceContextCandidateRef: body.sourceContextCandidateRef,
          disposition: body.disposition,
          reasonCodes: body.reasonCodes ?? [],
          rationale: body.rationale,
          contextAdjudication: body.contextAdjudication,
          version: typeof body.reviewVersion === 'string' && body.reviewVersion.trim() ? body.reviewVersion.trim() : `review-${new Date().toISOString()}`
        });
        checkpointRuntime();
        return json(res, 201, {
          reviewRef: reviewed.review.ref,
          disposition: reviewed.review.semanticPayload.disposition,
          claimRef: reviewed.claim?.ref ?? null,
          sourceContextRef: reviewed.sourceContext?.ref ?? null,
          authorityClaim: reviewed.claim ? 'SOURCE_ASSERTION' : 'REVIEW_DECISION_ONLY'
        });
      }
    }

    return json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const safe = safeError(error);
    if (safe.status === 500) console.error(error);
    return json(res, safe.status, safe.body);
  }
});

server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.listen(PORT, HOST, () => {
  console.log(`ADR pilot API listening on http://${HOST}:${PORT}`);
  console.log(`Artifact directory: ${ARTIFACT_DIR}`);
  console.log(`Checkpoint: ${CHECKPOINT_PATH} (${checkpointHash})`);
  console.log(`Max source upload bytes: ${MAX_UPLOAD_BYTES}`);
  console.log(`Extraction provider: ${extractionConfigured() ? `${ADR_EXTRACTION_PROVIDER}/${EXTRACTION_MODEL}` : 'NOT_CONFIGURED'}`);
  console.log('Manual external proposal import: ENABLED');
  console.log('Source-faithful review: ENABLED');
  console.log('Authority persistence: LOCAL_CHECKPOINT_RESTART_DURABLE_V1');
});