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
import { AutomatedSourceFaithfulReviewError } from '../../../packages/knowledge-registry/src/automated-source-faithful.mjs';
import { RightsAuthorityError } from '../../../packages/rights-authority/src/index.mjs';
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
import { PilotAutomatedSourceFaithfulReviewAdapter } from './review/automated-review.mjs';
import { PilotAutomatedSourceFaithfulBatchService } from './review/automated-batch.mjs';
import {
  ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER,
  OpenAIAutomatedReviewError,
  reviewSourceFaithfulnessWithOpenAI
} from './review/openai-review.mjs';
import { PilotRightsEnforcementService } from './rights/enforcement.mjs';
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
const SOURCE_FAITHFUL_REVIEW_MODEL = process.env.ADR_SOURCE_FAITHFUL_REVIEW_MODEL ?? '';
const RIGHTS_JURISDICTION = process.env.ADR_RIGHTS_JURISDICTION ?? 'UNSPECIFIED';
const RIGHTS_RUNTIME_ID = 'pilot-runtime-service';
const RIGHTS_ENGINE_ID = 'pilot-rights-engine';
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
const automatedReviewAdapter = new PilotAutomatedSourceFaithfulReviewAdapter({ ledger });
const automatedReviewBatch = new PilotAutomatedSourceFaithfulBatchService({
  ledger,
  sourceRegistry,
  adapter: automatedReviewAdapter
});
const rights = new PilotRightsEnforcementService({
  ledger,
  operatorId: OPERATOR_ID,
  evaluatorId: RIGHTS_ENGINE_ID
});
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

function audit(eventId, { actorType = 'USER', channel = 'pilot-api-source-ingestion', inputRefs = [] } = {}) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: actorType, id: OPERATOR_ID },
    inputRefs,
    details: { channel }
  };
}

function uploadPath(pathname) {
  const match = pathname.match(/^\/operator\/source-uploads\/([^/]+)(?:\/(content|finalize|rights|extract|import-proposal|review|automated-review))?$/);
  if (!match) return null;
  return { uploadId: decodeURIComponent(match[1]), action: match[2] ?? null };
}

function recoveryPath(pathname) {
  const match = pathname.match(/^\/operator\/source-uploads\/([^/]+)\/compilations$/);
  if (!match) return null;
  return { uploadId: decodeURIComponent(match[1]) };
}

function extractionConfigured() { return Boolean(OPENAI_API_KEY && EXTRACTION_MODEL); }
function automatedReviewConfigured() { return Boolean(OPENAI_API_KEY && SOURCE_FAITHFUL_REVIEW_MODEL); }

function exactSubjectForRights(upload, selector) {
  if (selector === 'SOURCE') {
    if (!upload.sourceRef) throw new SourceIngestionError('SOURCE_AUTHORITY_REQUIRED', 'SOURCE rights provisioning requires pre-registered Source authority');
    return upload.sourceRef;
  }
  if (selector === 'SOURCE_ARTIFACT') {
    if (!upload.sourceArtifactRef) throw new SourceIngestionError('SOURCE_ARTIFACT_AUTHORITY_REQUIRED', 'SOURCE_ARTIFACT rights provisioning requires finalized SourceArtifact authority');
    return upload.sourceArtifactRef;
  }
  throw new SourceIngestionError('INVALID_RIGHTS_SUBJECT_SELECTOR', 'rights subject must be SOURCE or SOURCE_ARTIFACT');
}

function authorizeArtifactOperations({ artifactRef, operations, purpose, actorId = RIGHTS_RUNTIME_ID, actorType = 'SERVICE_ACCOUNT' }) {
  return operations.map((operation) => rights.authorize({
    subjectRef: artifactRef,
    actorId,
    actorType,
    operation,
    purpose,
    jurisdiction: RIGHTS_JURISDICTION,
    enforceableObligations: []
  }));
}

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
  if (error instanceof RightsAuthorityError) {
    if (error.code === 'RIGHTS_DENIED') return 403;
    if (error.code.startsWith('INVALID_')) return 400;
    return 409;
  }
  if (error instanceof OpenAIExtractionError) return error.code === 'EXTRACTION_PROVIDER_NOT_CONFIGURED' ? 503 : 502;
  if (error instanceof OpenAIAutomatedReviewError) return 502;
  if (error instanceof AutomatedSourceFaithfulReviewError) return 409;
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
        rightsAuthority: {
          configured: true,
          enforcement: 'RA02_EXACT_SUBJECT_FAIL_CLOSED',
          jurisdiction: RIGHTS_JURISDICTION,
          sourceRetentionRequiresExplicitGrant: true,
          sourceArtifactUseRequiresExplicitGrant: true,
          sourceRightsDoNotInheritToArtifact: true,
          sourceMetadataRightsAreNotPermission: true
        },
        extraction: {
          configured: extractionConfigured(),
          provider: ADR_EXTRACTION_PROVIDER,
          model: EXTRACTION_MODEL || null,
          externalProcessingAuthorizationRequired: true,
          rightsOperationsRequired: ['READ_FOR_EXTRACTION', 'MODEL_EGRESS', 'RETAIN_DERIVED'],
          proposalAuthority: 'PROPOSAL_ONLY'
        },
        automatedSourceFaithfulReview: {
          configured: automatedReviewConfigured(),
          provider: ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER,
          model: SOURCE_FAITHFUL_REVIEW_MODEL || null,
          mode: 'BLIND_FALSIFICATION',
          externalProcessingAuthorizationRequired: true,
          rightsOperationsRequired: ['READ_FOR_EXTRACTION', 'MODEL_EGRESS', 'RETAIN_DERIVED'],
          outputAuthority: 'PROPOSAL_ONLY_BEFORE_DETERMINISTIC_PROMOTION',
          humanEscalation: true
        },
        manualExternalProposalImport: {
          configured: true,
          transport: 'USER_COPY_PASTE',
          modelIdentityAuthority: 'OPERATOR_DECLARED_NOT_VERIFIED',
          rightsOperationsRequired: ['READ_FOR_EXTRACTION', 'RETAIN_DERIVED'],
          proposalAuthority: 'PROPOSAL_ONLY'
        },
        sourceFaithfulReview: {
          configured: true,
          humanReviewAvailable: true,
          automatedBlindReviewAvailable: automatedReviewConfigured(),
          humanReviewRightsOperationRequired: 'RETAIN_DERIVED'
        }
      });
    }
    if (req.method === 'GET' && url.pathname === '/openapi.json') return json(res, 200, materializePilotOpenApi());
    if (req.method === 'GET' && url.pathname === '/automated-review.js') {
      return text(res, 200, readFileSync(join(WEB_ROOT, 'automated-review.js'), 'utf8'), 'application/javascript; charset=utf-8');
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const workbench = readFileSync(join(WEB_ROOT, 'index.html'), 'utf8')
        .replace('</body>', '<script src="/automated-review.js"></script>\n</body>');
      return text(res, 200, workbench, 'text/html; charset=utf-8');
    }

    if (url.pathname.startsWith('/operator/')) {
      if (!operatorAuthorized(req)) return json(res, 401, { error: 'OPERATOR_AUTH_REQUIRED' });

      if (req.method === 'POST' && url.pathname === '/operator/source-uploads') {
        const created = ingestion.createUpload(await readJson(req));
        const registered = ingestion.preRegisterSource({
          uploadId: created.uploadId,
          sourceAudit: audit(`evt-source-upload:${created.uploadId}:source-preregister`, { channel: 'pilot-api-source-preregistration' })
        });
        checkpointRuntime();
        return json(res, 201, {
          ...registered.upload,
          sourceRef: registered.source.ref,
          authorityClaim: 'SOURCE_METADATA_ONLY_NO_FULLTEXT_RETAINED'
        });
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

      if (parsed && req.method === 'POST' && parsed.action === 'rights') {
        const body = await readJson(req);
        const upload = ingestion.getUpload(parsed.uploadId);
        const subjectRef = exactSubjectForRights(upload, body.subject);
        if (!Array.isArray(body.rules) || body.rules.length === 0) {
          return json(res, 400, { error: 'RIGHTS_RULES_REQUIRED', message: 'rights provisioning requires non-empty rules[]' });
        }
        if (typeof body.validFrom !== 'string' || typeof body.validUntil !== 'string') {
          return json(res, 400, { error: 'RIGHTS_VALIDITY_REQUIRED', message: 'rights provisioning requires validFrom and validUntil' });
        }
        const provisioned = rights.provision({
          subjectRef,
          basisClass: body.basisClass,
          evidenceRefs: body.evidenceRefs ?? [],
          rules: body.rules,
          validFrom: body.validFrom,
          validUntil: body.validUntil,
          ...(typeof body.version === 'string' && body.version.trim() ? { version: body.version.trim() } : {})
        });
        checkpointRuntime();
        return json(res, 201, provisioned);
      }

      if (parsed && req.method === 'PUT' && parsed.action === 'content') {
        const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (contentType !== 'application/pdf') return json(res, 415, { error: 'PDF_CONTENT_TYPE_REQUIRED' });
        const upload = ingestion.getUpload(parsed.uploadId);
        if (!upload.sourceRef) return json(res, 409, { error: 'SOURCE_AUTHORITY_REQUIRED' });
        try {
          const retained = await rights.execute({
            subjectRef: upload.sourceRef,
            actorId: OPERATOR_ID,
            actorType: 'USER',
            operation: 'RETAIN_FULLTEXT',
            purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION',
            jurisdiction: RIGHTS_JURISDICTION,
            enforceableObligations: [],
            effectKey: `source-retention:${parsed.uploadId}`,
            sideEffect: async () => ingestion.uploadPdf({ uploadId: parsed.uploadId, readable: req })
          });
          checkpointRuntime();
          return json(res, 201, {
            ...retained.result,
            rightsDecisionRef: retained.rightsDecisionRef,
            rightsSideEffectReceiptRef: retained.sideEffectReceiptRef
          });
        } catch (error) {
          checkpointRuntime();
          throw error;
        }
      }

      if (parsed && req.method === 'POST' && parsed.action === 'finalize') {
        const upload = ingestion.getUpload(parsed.uploadId);
        if (!upload.sourceRef) return json(res, 409, { error: 'SOURCE_AUTHORITY_REQUIRED' });
        const retention = rights.sideEffectReceiptFor({
          effectKey: `source-retention:${parsed.uploadId}`,
          subjectRef: upload.sourceRef,
          operation: 'RETAIN_FULLTEXT'
        });
        const result = ingestion.finalizeUpload({
          uploadId: parsed.uploadId,
          sourceAudit: audit(`evt-source-upload:${parsed.uploadId}:source-finalize-unused`),
          artifactAudit: audit(`evt-source-upload:${parsed.uploadId}:artifact`, {
            inputRefs: [retention.semanticPayload.rightsDecisionRef, retention.ref]
          })
        });
        checkpointRuntime();
        return json(res, 201, {
          upload: result.upload,
          sourceRef: result.source.ref,
          sourceArtifactRef: result.sourceArtifact.ref,
          contentHash: result.sourceArtifact.semanticPayload.contentHash,
          byteLength: result.sourceArtifact.semanticPayload.byteLength,
          retentionRightsDecisionRef: retention.semanticPayload.rightsDecisionRef,
          retentionRightsSideEffectReceiptRef: retention.ref
        });
      }

      if (parsed && req.method === 'POST' && parsed.action === 'extract') {
        if (!extractionConfigured()) return json(res, 503, { error: 'EXTRACTION_PROVIDER_NOT_CONFIGURED', required: ['OPENAI_API_KEY', 'ADR_EXTRACTION_MODEL'] });
        const body = await readJson(req);
        if (body.externalProcessingAuthorized !== true) {
          return json(res, 409, {
            error: 'EXTERNAL_MODEL_PROCESSING_AUTHORIZATION_REQUIRED',
            message: 'externalProcessingAuthorized=true records operator confirmation but does not substitute for RightsDecision authority'
          });
        }
        const upload = ingestion.getUpload(parsed.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `extract requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        const artifact = sourceRegistry.resolveArtifact(upload.sourceArtifactRef);
        const authorizations = authorizeArtifactOperations({
          artifactRef: artifact.ref,
          operations: ['READ_FOR_EXTRACTION', 'MODEL_EGRESS', 'RETAIN_DERIVED'],
          purpose: 'SCIENTIFIC_CLAIM_EXTRACTION'
        });
        const rightsDecisionRefs = authorizations.map((item) => item.rightsDecisionRef);
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
          audit: audit(`evt-compilation:${parsed.uploadId}:${compilationVersion}`, {
            actorType: 'SERVICE',
            channel: 'pilot-api-source-extraction',
            inputRefs: rightsDecisionRefs
          })
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
          rightsDecisionRefs,
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
        const authorizations = authorizeArtifactOperations({
          artifactRef: artifact.ref,
          operations: ['READ_FOR_EXTRACTION', 'RETAIN_DERIVED'],
          purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
          actorId: OPERATOR_ID,
          actorType: 'USER'
        });
        const rightsDecisionRefs = authorizations.map((item) => item.rightsDecisionRef);
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
          audit: audit(`evt-manual-import:${parsed.uploadId}:${compilationVersion}`, {
            actorType: 'USER',
            channel: 'pilot-api-manual-external-proposal-import',
            inputRefs: rightsDecisionRefs
          })
        });
        checkpointRuntime();
        return json(res, 200, {
          preflight: imported.preflight,
          materialized: imported.materialized,
          compilationResultRef: imported.compilation?.ref ?? null,
          candidateCount: imported.candidates.length,
          candidates: imported.candidates,
          rightsDecisionRefs,
          authorityClaim: imported.materialized ? 'PROPOSAL_ONLY' : 'NO_AUTHORITY_MATERIALIZED'
        });
      }

      if (parsed && req.method === 'POST' && parsed.action === 'automated-review') {
        if (!automatedReviewConfigured()) {
          return json(res, 503, {
            error: 'AUTOMATED_REVIEW_PROVIDER_NOT_CONFIGURED',
            required: ['OPENAI_API_KEY', 'ADR_SOURCE_FAITHFUL_REVIEW_MODEL']
          });
        }
        const body = await readJson(req);
        if (body.externalProcessingAuthorized !== true) {
          return json(res, 409, {
            error: 'EXTERNAL_MODEL_PROCESSING_AUTHORIZATION_REQUIRED',
            message: 'externalProcessingAuthorized=true records operator confirmation but does not substitute for RightsDecision authority'
          });
        }
        if (!body.compilationResultRef) {
          return json(res, 400, {
            error: 'COMPILATION_RESULT_REF_REQUIRED',
            message: 'automated review requires exact compilationResultRef'
          });
        }
        const upload = ingestion.getUpload(parsed.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `automated review requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        const versionPrefix = typeof body.versionPrefix === 'string' && body.versionPrefix.trim()
          ? body.versionPrefix.trim() : `auto-${new Date().toISOString()}`;
        const result = await automatedReviewBatch.run({
          sourceArtifactRef: upload.sourceArtifactRef,
          compilationResultRef: body.compilationResultRef,
          filename: upload.filename,
          retryEscalated: body.retryEscalated === true,
          versionPrefix,
          prepareCandidate: async ({ artifact }) => {
            const authorizations = authorizeArtifactOperations({
              artifactRef: artifact.ref,
              operations: ['READ_FOR_EXTRACTION', 'MODEL_EGRESS', 'RETAIN_DERIVED'],
              purpose: 'SOURCE_FAITHFUL_REVIEW'
            });
            return {
              rightsDecisionRefs: authorizations.map((item) => item.rightsDecisionRef),
              readable: sourceRegistry.readArtifactStream(artifact.ref)
            };
          },
          reviewer: ({ readable, byteLength, filename, blindPacket }) => reviewSourceFaithfulnessWithOpenAI({
            readable,
            byteLength,
            filename,
            blindPacket,
            model: SOURCE_FAITHFUL_REVIEW_MODEL,
            apiKey: OPENAI_API_KEY
          }),
          onCandidateComplete: async () => { checkpointRuntime(); }
        });
        checkpointRuntime();
        return json(res, 200, result);
      }

      if (parsed && req.method === 'POST' && parsed.action === 'review') {
        const body = await readJson(req);
        const upload = ingestion.getUpload(parsed.uploadId);
        if (upload.state !== 'SOURCE_MATERIALIZED' || !upload.sourceArtifactRef) {
          return json(res, 409, { error: 'SOURCE_UPLOAD_STATE_INVALID', message: `human review requires SOURCE_MATERIALIZED, received ${upload.state}` });
        }
        const derived = rights.authorize({
          subjectRef: upload.sourceArtifactRef,
          actorId: OPERATOR_ID,
          actorType: 'USER',
          operation: 'RETAIN_DERIVED',
          purpose: 'SOURCE_FAITHFUL_REVIEW',
          jurisdiction: RIGHTS_JURISDICTION,
          enforceableObligations: []
        });
        const reviewed = reviewAdapter.review({
          compilationResultRef: body.compilationResultRef,
          claimCandidateRef: body.claimCandidateRef,
          sourceContextCandidateRef: body.sourceContextCandidateRef,
          disposition: body.disposition,
          reasonCodes: body.reasonCodes ?? [],
          rationale: body.rationale,
          contextAdjudication: body.contextAdjudication,
          rightsDecisionRefs: [derived.rightsDecisionRef],
          version: typeof body.reviewVersion === 'string' && body.reviewVersion.trim() ? body.reviewVersion.trim() : `review-${new Date().toISOString()}`
        });
        checkpointRuntime();
        return json(res, 201, {
          reviewRef: reviewed.review.ref,
          disposition: reviewed.review.semanticPayload.disposition,
          claimRef: reviewed.claim?.ref ?? null,
          sourceContextRef: reviewed.sourceContext?.ref ?? null,
          rightsDecisionRefs: [derived.rightsDecisionRef],
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
  console.log(`Rights enforcement: RA02_EXACT_SUBJECT_FAIL_CLOSED (${RIGHTS_JURISDICTION})`);
  console.log(`Extraction provider: ${extractionConfigured() ? `${ADR_EXTRACTION_PROVIDER}/${EXTRACTION_MODEL}` : 'NOT_CONFIGURED'}`);
  console.log(`Automated source-faithful reviewer: ${automatedReviewConfigured() ? `${ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER}/${SOURCE_FAITHFUL_REVIEW_MODEL}` : 'NOT_CONFIGURED'}`);
  console.log('Manual external proposal import: ENABLED');
  console.log('Human source-faithful review: ENABLED');
  console.log('Authority persistence: LOCAL_CHECKPOINT_RESTART_DURABLE_V1');
});
