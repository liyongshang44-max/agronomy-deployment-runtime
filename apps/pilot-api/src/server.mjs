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
import { materializePilotOpenApi } from '../../../packages/public-api/src/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '../../pilot-web');
const DATA_DIR = resolve(process.env.ADR_DATA_DIR ?? '.adr-pilot');
const ARTIFACT_DIR = join(DATA_DIR, 'artifacts');
const HOST = process.env.ADR_HOST ?? '127.0.0.1';
const PORT = Number(process.env.ADR_PORT ?? 8787);
const OPERATOR_TOKEN = process.env.ADR_OPERATOR_TOKEN ?? '';
const OPERATOR_ID = process.env.ADR_OPERATOR_ID ?? 'local-pilot-operator';
const MAX_UPLOAD_BYTES = Number(process.env.ADR_MAX_SOURCE_UPLOAD_BYTES ?? DEFAULT_MAX_SOURCE_UPLOAD_BYTES);
const MAX_JSON_BYTES = 1024 * 1024;

if (!Number.isSafeInteger(PORT) || PORT <= 0 || PORT > 65535) throw new Error('ADR_PORT must be a valid TCP port');
if (!Number.isSafeInteger(MAX_UPLOAD_BYTES) || MAX_UPLOAD_BYTES <= 0) {
  throw new Error('ADR_MAX_SOURCE_UPLOAD_BYTES must be a positive safe integer');
}
if (!OPERATOR_TOKEN) {
  throw new Error('ADR_OPERATOR_TOKEN is required; operator ingestion routes are never started without a bearer token');
}

mkdirSync(DATA_DIR, { recursive: true });
const ledger = new AuthorityLedger();
const artifactStore = new FileSystemScopedArtifactStore({ rootDir: ARTIFACT_DIR });
const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
const ingestion = new PilotSourceIngestionService({
  sourceRegistry,
  artifactStore,
  maxUploadBytes: MAX_UPLOAD_BYTES
});

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
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': bytes.byteLength,
    'cache-control': 'no-store'
  });
  res.end(bytes);
}

function operatorAuthorized(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);
  if (token.length !== OPERATOR_TOKEN.length) return false;
  let mismatch = 0;
  for (let index = 0; index < token.length; index += 1) {
    mismatch |= token.charCodeAt(index) ^ OPERATOR_TOKEN.charCodeAt(index);
  }
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new SourceIngestionError('INVALID_JSON', 'request body is not valid JSON');
  }
}

function audit(eventId) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: 'USER', id: OPERATOR_ID },
    details: { channel: 'pilot-api-source-ingestion' }
  };
}

function uploadPath(pathname) {
  const match = pathname.match(/^\/operator\/source-uploads\/([^/]+)(?:\/(content|finalize))?$/);
  if (!match) return null;
  return { uploadId: decodeURIComponent(match[1]), action: match[2] ?? null };
}

function errorStatus(error) {
  if (error instanceof SourceIngestionError) {
    if (error.code === 'SOURCE_UPLOAD_NOT_FOUND') return 404;
    if (error.code === 'SOURCE_UPLOAD_TOO_LARGE' || error.code === 'JSON_BODY_TOO_LARGE') return 413;
    if (error.code === 'SOURCE_UPLOAD_STATE_INVALID') return 409;
    return 400;
  }
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
    if (req.method === 'GET' && url.pathname === '/healthz') {
      json(res, 200, { ok: true, service: 'adr-pilot-api' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/readyz') {
      json(res, 200, {
        ready: true,
        service: 'adr-pilot-api',
        authorityPersistence: 'IN_MEMORY_NOT_RESTART_DURABLE',
        artifactPersistence: 'FILESYSTEM_SCOPED_CONTENT_ADDRESSABLE',
        maxSourceUploadBytes: MAX_UPLOAD_BYTES
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/openapi.json') {
      json(res, 200, materializePilotOpenApi());
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      text(res, 200, readFileSync(join(WEB_ROOT, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname.startsWith('/operator/')) {
      if (!operatorAuthorized(req)) {
        json(res, 401, { error: 'OPERATOR_AUTH_REQUIRED' });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/operator/source-uploads') {
        const body = await readJson(req);
        const upload = ingestion.createUpload(body);
        json(res, 201, upload);
        return;
      }

      const parsed = uploadPath(url.pathname);
      if (parsed && req.method === 'GET' && parsed.action === null) {
        json(res, 200, ingestion.getUpload(parsed.uploadId));
        return;
      }
      if (parsed && req.method === 'PUT' && parsed.action === 'content') {
        const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (contentType !== 'application/pdf') {
          json(res, 415, { error: 'PDF_CONTENT_TYPE_REQUIRED' });
          return;
        }
        const stored = await ingestion.uploadPdf({ uploadId: parsed.uploadId, readable: req });
        json(res, 201, stored);
        return;
      }
      if (parsed && req.method === 'POST' && parsed.action === 'finalize') {
        const result = ingestion.finalizeUpload({
          uploadId: parsed.uploadId,
          sourceAudit: audit(`evt-source-upload:${parsed.uploadId}:source`),
          artifactAudit: audit(`evt-source-upload:${parsed.uploadId}:artifact`)
        });
        json(res, 201, {
          upload: result.upload,
          sourceRef: result.source.ref,
          sourceArtifactRef: result.sourceArtifact.ref,
          contentHash: result.sourceArtifact.semanticPayload.contentHash,
          byteLength: result.sourceArtifact.semanticPayload.byteLength
        });
        return;
      }
    }

    json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const safe = safeError(error);
    if (safe.status === 500) console.error(error);
    json(res, safe.status, safe.body);
  }
});

server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.listen(PORT, HOST, () => {
  console.log(`ADR pilot API listening on http://${HOST}:${PORT}`);
  console.log(`Artifact directory: ${ARTIFACT_DIR}`);
  console.log(`Max source upload bytes: ${MAX_UPLOAD_BYTES}`);
  console.log('Authority persistence: IN_MEMORY_NOT_RESTART_DURABLE');
});
