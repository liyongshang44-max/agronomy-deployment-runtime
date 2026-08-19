import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';

export const DEFAULT_MAX_SOURCE_UPLOAD_BYTES = 1024 * 1024 * 1024;

export const SOURCE_UPLOAD_STATES = deepFreeze([
  'CREATED',
  'UPLOADING',
  'STORED',
  'SOURCE_MATERIALIZED',
  'EXTRACTION_QUEUED',
  'EXTRACTING',
  'CANDIDATES_READY',
  'FAILED'
]);

const STATE_SET = new Set(SOURCE_UPLOAD_STATES);
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');
const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const VERIFY_BUFFER_BYTES = 1024 * 1024;

export class SourceIngestionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SourceIngestionError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SourceIngestionError('INVALID_SOURCE_INGESTION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new SourceIngestionError('INVALID_SOURCE_INGESTION_SCOPE', 'scope must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(scope.organizationId, 'scope.organizationId'),
    ...(scope.tenantId ? { tenantId: requiredText(scope.tenantId, 'scope.tenantId') } : {})
  });
}

function sameScope(left, right) {
  const a = normalizeScope(left);
  const b = normalizeScope(right);
  return a.organizationId === b.organizationId && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function scopeKey(scopeInput) {
  const scope = normalizeScope(scopeInput);
  return createHash('sha256')
    .update(JSON.stringify([scope.organizationId, scope.tenantId ?? null]), 'utf8')
    .digest('hex');
}

function normalizeContentHash(value) {
  const contentHash = requiredText(value, 'contentHash');
  if (!CONTENT_HASH_RE.test(contentHash)) {
    throw new SourceIngestionError('INVALID_CONTENT_HASH', 'contentHash must be sha256:<64 lowercase hex>');
  }
  return contentHash;
}

function retentionReceipt(scopeInput, contentHashInput, byteLength) {
  const scope = normalizeScope(scopeInput);
  const contentHash = normalizeContentHash(contentHashInput);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new SourceIngestionError('INVALID_BYTE_LENGTH', 'byteLength must be a non-negative safe integer');
  }
  const key = scopeKey(scope);
  return deepFreeze({
    storeKind: 'FILESYSTEM_SCOPED_CONTENT_ADDRESSABLE_PILOT_V1',
    retentionId: `filecas:${key}:${contentHash.slice('sha256:'.length)}`,
    contentHash,
    byteLength
  });
}

function normalizeSnapshotReceipt(scope, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', 'retentionReceipt must be an object');
  }
  const expected = retentionReceipt(scope, input.contentHash, input.byteLength);
  if (input.storeKind !== expected.storeKind || input.retentionId !== expected.retentionId) {
    throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_RETENTION_MISMATCH', 'retention receipt identity does not match exact scope/content hash');
  }
  return expected;
}

function hashFileSync(path) {
  const fd = openSync(path, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(VERIFY_BUFFER_BYTES);
  let byteLength = 0;
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      byteLength += bytesRead;
    }
  } finally {
    closeSync(fd);
  }
  return { contentHash: `sha256:${hash.digest('hex')}`, byteLength };
}

async function safeUnlinkAsync(path) {
  try { await unlink(path); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
}

function pdfValidatedReadable(readable) {
  if (!readable || typeof readable[Symbol.asyncIterator] !== 'function') {
    throw new SourceIngestionError('READABLE_STREAM_REQUIRED', 'PDF upload requires an async-iterable readable stream');
  }
  async function* validate() {
    let prefix = Buffer.alloc(0);
    let signatureValidated = false;
    for await (const chunk of readable) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!signatureValidated && prefix.byteLength < PDF_MAGIC.byteLength) {
        const needed = PDF_MAGIC.byteLength - prefix.byteLength;
        prefix = Buffer.concat([prefix, bytes.subarray(0, needed)]);
        if (prefix.byteLength === PDF_MAGIC.byteLength) {
          if (!prefix.equals(PDF_MAGIC)) throw new SourceIngestionError('PDF_SIGNATURE_INVALID', 'uploaded source does not begin with %PDF-');
          signatureValidated = true;
        }
      }
      yield bytes;
    }
    if (!signatureValidated) throw new SourceIngestionError('PDF_SIGNATURE_INVALID', 'uploaded source does not begin with %PDF-');
  }
  return Readable.from(validate());
}

export class FileSystemScopedArtifactStore {
  #rootDir;

  constructor({ rootDir }) {
    this.#rootDir = resolve(requiredText(rootDir, 'rootDir'));
    mkdirSync(this.#rootDir, { recursive: true });
  }

  #scopeDir(scopeInput) { return join(this.#rootDir, scopeKey(scopeInput)); }
  #objectPath(scopeInput, contentHashInput) {
    const contentHash = normalizeContentHash(contentHashInput);
    return join(this.#scopeDir(scopeInput), 'objects', contentHash.slice('sha256:'.length));
  }
  #stagingDir(scopeInput) { return join(this.#scopeDir(scopeInput), 'staging'); }

  putForScope(scopeInput, bytesInput) {
    const scope = normalizeScope(scopeInput);
    const bytes = Buffer.isBuffer(bytesInput)
      ? Buffer.from(bytesInput)
      : bytesInput instanceof Uint8Array
        ? Buffer.from(bytesInput.buffer, bytesInput.byteOffset, bytesInput.byteLength)
        : null;
    if (!bytes) throw new SourceIngestionError('EXACT_BYTES_REQUIRED', 'putForScope requires Buffer or Uint8Array');
    const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const objectPath = this.#objectPath(scope, contentHash);
    mkdirSync(join(this.#scopeDir(scope), 'objects'), { recursive: true });
    if (!existsSync(objectPath)) writeFileSync(objectPath, bytes, { flag: 'wx' });
    const inspected = this.inspectForScope(scope, contentHash);
    if (inspected.byteLength !== bytes.byteLength) throw new SourceIngestionError('RETAINED_OBJECT_LENGTH_MISMATCH', 'retained object length differs from exact input bytes');
    return inspected;
  }

  getForScope(scopeInput, contentHashInput) {
    const objectPath = this.#objectPath(normalizeScope(scopeInput), contentHashInput);
    if (!existsSync(objectPath)) throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    return readFileSync(objectPath);
  }

  hasForScope(scopeInput, contentHashInput) { return existsSync(this.#objectPath(normalizeScope(scopeInput), contentHashInput)); }

  inspectForScope(scopeInput, contentHashInput) {
    const scope = normalizeScope(scopeInput);
    const contentHash = normalizeContentHash(contentHashInput);
    const objectPath = this.#objectPath(scope, contentHash);
    if (!existsSync(objectPath)) throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    const info = statSync(objectPath);
    if (!info.isFile()) throw new SourceIngestionError('INVALID_RETAINED_OBJECT', 'retained artifact path is not a file');
    const verified = hashFileSync(objectPath);
    if (verified.contentHash !== contentHash) throw new SourceIngestionError('RETAINED_OBJECT_HASH_MISMATCH', 'scoped retained object bytes do not match requested content hash');
    if (verified.byteLength !== info.size) throw new SourceIngestionError('RETAINED_OBJECT_LENGTH_MISMATCH', 'scoped retained object changed during integrity inspection');
    return retentionReceipt(scope, verified.contentHash, verified.byteLength);
  }

  createReadStreamForScope(scopeInput, contentHashInput) {
    const scope = normalizeScope(scopeInput);
    const contentHash = normalizeContentHash(contentHashInput);
    const objectPath = this.#objectPath(scope, contentHash);
    if (!existsSync(objectPath)) throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    return createReadStream(objectPath);
  }

  async putStreamForScope(scopeInput, readable, { maxBytes = DEFAULT_MAX_SOURCE_UPLOAD_BYTES } = {}) {
    const scope = normalizeScope(scopeInput);
    if (!readable || typeof readable.pipe !== 'function') throw new SourceIngestionError('READABLE_STREAM_REQUIRED', 'putStreamForScope requires a readable stream');
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new SourceIngestionError('INVALID_MAX_UPLOAD_BYTES', 'maxBytes must be a positive safe integer');
    const scopeDir = this.#scopeDir(scope);
    const stagingDir = this.#stagingDir(scope);
    const objectsDir = join(scopeDir, 'objects');
    await mkdir(stagingDir, { recursive: true });
    await mkdir(objectsDir, { recursive: true });
    const stagingPath = join(stagingDir, `${randomUUID()}.part`);
    const hash = createHash('sha256');
    let byteLength = 0;
    const meter = new Transform({
      transform(chunk, encoding, callback) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        byteLength += bytes.byteLength;
        if (byteLength > maxBytes) {
          callback(new SourceIngestionError('SOURCE_UPLOAD_TOO_LARGE', `source upload exceeded configured maximum of ${maxBytes} bytes`));
          return;
        }
        hash.update(bytes);
        callback(null, bytes);
      }
    });
    try {
      await pipeline(readable, meter, createWriteStream(stagingPath, { flags: 'wx' }));
      if (byteLength === 0) throw new SourceIngestionError('EMPTY_SOURCE_UPLOAD', 'source upload body is empty');
      const contentHash = `sha256:${hash.digest('hex')}`;
      const objectPath = this.#objectPath(scope, contentHash);
      try { await rename(stagingPath, objectPath); }
      catch (error) {
        if (error?.code === 'EEXIST' || error?.code === 'EPERM') {
          const existing = await stat(objectPath).catch(() => null);
          if (!existing?.isFile() || existing.size !== byteLength) throw error;
          const inspected = this.inspectForScope(scope, contentHash);
          if (inspected.byteLength !== byteLength) throw error;
          await safeUnlinkAsync(stagingPath);
        } else throw error;
      }
      const retained = await stat(objectPath);
      if (!retained.isFile() || retained.size !== byteLength) throw new SourceIngestionError('RETAINED_OBJECT_LENGTH_MISMATCH', 'committed retained object does not match streamed byte length');
      return retentionReceipt(scope, contentHash, retained.size);
    } catch (error) {
      await safeUnlinkAsync(stagingPath);
      throw error;
    }
  }
}

function normalizeSourceDraft(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new SourceIngestionError('SOURCE_DRAFT_REQUIRED', 'source draft is required');
  return deepFreeze({
    logicalId: requiredText(source.logicalId, 'source.logicalId'),
    version: requiredText(source.version, 'source.version'),
    sourceType: requiredText(source.sourceType, 'source.sourceType'),
    title: requiredText(source.title, 'source.title'),
    bibliographic: structuredClone(source.bibliographic ?? {}),
    ...(source.edition ? { edition: requiredText(source.edition, 'source.edition') } : {}),
    ...(source.sourceVersionLabel ? { sourceVersionLabel: requiredText(source.sourceVersionLabel, 'source.sourceVersionLabel') } : {}),
    ...(source.originLocator ? { originLocator: requiredText(source.originLocator, 'source.originLocator') } : {}),
    rights: structuredClone(source.rights ?? {}),
    metadata: structuredClone(source.metadata ?? {})
  });
}

function normalizeArtifactDraft(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new SourceIngestionError('ARTIFACT_DRAFT_REQUIRED', 'artifact draft is required');
  return deepFreeze({
    logicalId: requiredText(artifact.logicalId, 'artifact.logicalId'),
    version: requiredText(artifact.version, 'artifact.version'),
    mediaType: requiredText(artifact.mediaType, 'artifact.mediaType'),
    materializationIdentity: requiredText(artifact.materializationIdentity, 'artifact.materializationIdentity'),
    acquisition: structuredClone(artifact.acquisition ?? {}),
    ...(artifact.rightsSnapshot !== undefined ? { rightsSnapshot: structuredClone(artifact.rightsSnapshot) } : {}),
    metadata: structuredClone(artifact.metadata ?? {})
  });
}

function publicSession(session) {
  return deepFreeze({
    uploadId: session.uploadId,
    scope: session.scope,
    filename: session.filename,
    declaredMediaType: session.declaredMediaType,
    state: session.state,
    ...(session.retentionReceipt ? { retentionReceipt: session.retentionReceipt } : {}),
    ...(session.sourceRef ? { sourceRef: session.sourceRef } : {}),
    ...(session.sourceArtifactRef ? { sourceArtifactRef: session.sourceArtifactRef } : {}),
    ...(session.failureCode ? { failureCode: session.failureCode } : {})
  });
}

function restoredSession(input, { artifactStore, sourceRegistry }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', 'session must be an object');
  const scope = normalizeScope(input.scope);
  const declaredMediaType = requiredText(input.declaredMediaType, 'declaredMediaType');
  if (declaredMediaType !== 'application/pdf') throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', 'restored session media type must be application/pdf');
  const state = requiredText(input.state, 'state');
  if (!STATE_SET.has(state)) throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_STATE', `unsupported source upload state ${state}`);
  const session = {
    uploadId: requiredText(input.uploadId, 'uploadId'),
    scope,
    filename: requiredText(input.filename, 'filename'),
    declaredMediaType,
    source: normalizeSourceDraft(input.source),
    artifact: normalizeArtifactDraft(input.artifact),
    state,
    ...(input.failureCode ? { failureCode: requiredText(input.failureCode, 'failureCode') } : {})
  };
  if (input.retentionReceipt) {
    const receipt = normalizeSnapshotReceipt(scope, input.retentionReceipt);
    const inspected = artifactStore.inspectForScope(scope, receipt.contentHash);
    if (inspected.storeKind !== receipt.storeKind || inspected.retentionId !== receipt.retentionId
      || inspected.contentHash !== receipt.contentHash || inspected.byteLength !== receipt.byteLength) {
      throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_RETENTION_MISMATCH', 'restored retained PDF does not match snapshot receipt');
    }
    session.retentionReceipt = receipt;
  }
  if (input.sourceRef) session.sourceRef = assertAuthorityRef(input.sourceRef);
  if (input.sourceArtifactRef) session.sourceArtifactRef = assertAuthorityRef(input.sourceArtifactRef);

  const requiresRetention = ['STORED', 'SOURCE_MATERIALIZED', 'EXTRACTION_QUEUED', 'EXTRACTING', 'CANDIDATES_READY'].includes(state);
  if (requiresRetention && !session.retentionReceipt) {
    throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', `${state} session requires retentionReceipt`);
  }
  const requiresAuthority = ['SOURCE_MATERIALIZED', 'EXTRACTION_QUEUED', 'EXTRACTING', 'CANDIDATES_READY'].includes(state);
  if (requiresAuthority && (!session.sourceRef || !session.sourceArtifactRef)) {
    throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', `${state} session requires sourceRef and sourceArtifactRef`);
  }
  if (session.sourceArtifactRef && !session.sourceRef) {
    throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', 'sourceArtifactRef cannot exist without sourceRef');
  }
  if (session.sourceRef) {
    const source = sourceRegistry.resolveSource(session.sourceRef);
    if (!sameScope(source.semanticPayload.ownership, scope)) throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_SCOPE_MISMATCH', 'restored Source ownership does not match upload scope');
    if (session.sourceArtifactRef) {
      const artifact = sourceRegistry.resolveArtifact(session.sourceArtifactRef);
      if (!sameAuthorityRef(artifact.semanticPayload.sourceRef, source.ref)) throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_AUTHORITY_MISMATCH', 'restored SourceArtifact does not bind restored Source');
      if (session.retentionReceipt) {
        if (artifact.semanticPayload.contentHash !== session.retentionReceipt.contentHash
          || artifact.semanticPayload.byteLength !== session.retentionReceipt.byteLength
          || artifact.semanticPayload.retention?.storeKind !== session.retentionReceipt.storeKind
          || artifact.semanticPayload.retention?.retentionId !== session.retentionReceipt.retentionId) {
          throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_AUTHORITY_MISMATCH', 'restored SourceArtifact does not match retained PDF receipt');
        }
      }
    }
  }
  return session;
}

export class PilotSourceIngestionService {
  #sourceRegistry;
  #artifactStore;
  #maxUploadBytes;
  #sessions = new Map();

  constructor({ sourceRegistry, artifactStore, maxUploadBytes = DEFAULT_MAX_SOURCE_UPLOAD_BYTES, snapshot = null }) {
    if (!sourceRegistry || typeof sourceRegistry.registerSource !== 'function'
      || typeof sourceRegistry.materializeRetainedArtifact !== 'function'
      || typeof sourceRegistry.resolveSource !== 'function'
      || typeof sourceRegistry.resolveArtifact !== 'function') {
      throw new SourceIngestionError('INVALID_SOURCE_REGISTRY', 'sourceRegistry retained-artifact support is required');
    }
    if (!artifactStore || typeof artifactStore.putStreamForScope !== 'function' || typeof artifactStore.inspectForScope !== 'function') {
      throw new SourceIngestionError('INVALID_ARTIFACT_STORE', 'streaming scoped artifact store is required');
    }
    if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes <= 0) throw new SourceIngestionError('INVALID_MAX_UPLOAD_BYTES', 'maxUploadBytes must be a positive safe integer');
    this.#sourceRegistry = sourceRegistry;
    this.#artifactStore = artifactStore;
    this.#maxUploadBytes = maxUploadBytes;
    if (snapshot) this.restoreSnapshot(snapshot);
  }

  restoreSnapshot(snapshot) {
    if (this.#sessions.size !== 0) throw new SourceIngestionError('SOURCE_UPLOAD_SESSIONS_NOT_EMPTY', 'session snapshot restore requires an empty service');
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || !Array.isArray(snapshot.sessions)) {
      throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_SNAPSHOT', 'snapshot must contain sessions[]');
    }
    const staged = new Map();
    for (const input of snapshot.sessions) {
      const session = restoredSession(input, { artifactStore: this.#artifactStore, sourceRegistry: this.#sourceRegistry });
      if (staged.has(session.uploadId)) throw new SourceIngestionError('SOURCE_UPLOAD_SNAPSHOT_COLLISION', `duplicate uploadId ${session.uploadId}`);
      staged.set(session.uploadId, session);
    }
    this.#sessions = staged;
    return this;
  }

  exportSnapshot() {
    return deepFreeze({ sessions: [...this.#sessions.values()].map((session) => structuredClone(session)) });
  }

  createUpload({ scope, filename, declaredMediaType = 'application/pdf', source, artifact }) {
    const normalizedScope = normalizeScope(scope);
    const normalizedMediaType = requiredText(declaredMediaType, 'declaredMediaType');
    if (normalizedMediaType !== 'application/pdf') throw new SourceIngestionError('UNSUPPORTED_SOURCE_MEDIA_TYPE', 'pilot source upload currently accepts application/pdf only');
    const uploadId = randomUUID();
    const session = {
      uploadId,
      scope: normalizedScope,
      filename: requiredText(filename, 'filename'),
      declaredMediaType: normalizedMediaType,
      source: normalizeSourceDraft(source),
      artifact: normalizeArtifactDraft(artifact),
      state: 'CREATED'
    };
    this.#sessions.set(uploadId, session);
    return publicSession(session);
  }

  preRegisterSource({ uploadId, sourceAudit }) {
    const session = this.#mutableSession(uploadId);
    if (session.state !== 'CREATED') {
      throw new SourceIngestionError('SOURCE_UPLOAD_STATE_INVALID', `cannot pre-register Source from state ${session.state}`);
    }
    const source = this.#sourceRegistry.registerSource({ ...session.source, ownership: session.scope, audit: sourceAudit });
    session.sourceRef = source.ref;
    return deepFreeze({ upload: publicSession(session), source });
  }

  getUpload(uploadId) {
    const session = this.#sessions.get(requiredText(uploadId, 'uploadId'));
    if (!session) throw new SourceIngestionError('SOURCE_UPLOAD_NOT_FOUND', 'source upload session does not exist');
    return publicSession(session);
  }

  #mutableSession(uploadId) {
    const id = requiredText(uploadId, 'uploadId');
    const session = this.#sessions.get(id);
    if (!session) throw new SourceIngestionError('SOURCE_UPLOAD_NOT_FOUND', 'source upload session does not exist');
    return session;
  }

  async uploadPdf({ uploadId, readable }) {
    const session = this.#mutableSession(uploadId);
    if (session.state !== 'CREATED') throw new SourceIngestionError('SOURCE_UPLOAD_STATE_INVALID', `cannot upload content from state ${session.state}`);
    session.state = 'UPLOADING';
    try {
      const retention = await this.#artifactStore.putStreamForScope(session.scope, pdfValidatedReadable(readable), { maxBytes: this.#maxUploadBytes });
      session.retentionReceipt = retention;
      session.state = 'STORED';
      return publicSession(session);
    } catch (error) {
      session.state = 'FAILED';
      session.failureCode = error instanceof SourceIngestionError ? error.code : 'SOURCE_UPLOAD_FAILED';
      throw error;
    }
  }

  finalizeUpload({ uploadId, sourceAudit, artifactAudit }) {
    const session = this.#mutableSession(uploadId);
    if (session.state !== 'STORED' || !session.retentionReceipt) throw new SourceIngestionError('SOURCE_UPLOAD_STATE_INVALID', `cannot finalize source upload from state ${session.state}`);
    const source = session.sourceRef
      ? this.#sourceRegistry.resolveSource(session.sourceRef)
      : this.#sourceRegistry.registerSource({ ...session.source, ownership: session.scope, audit: sourceAudit });
    const sourceArtifact = this.#sourceRegistry.materializeRetainedArtifact({
      ...session.artifact,
      sourceRef: source.ref,
      retentionReceipt: session.retentionReceipt,
      audit: artifactAudit
    });
    session.sourceRef = source.ref;
    session.sourceArtifactRef = sourceArtifact.ref;
    session.state = 'SOURCE_MATERIALIZED';
    return deepFreeze({ upload: publicSession(session), source, sourceArtifact });
  }

  markState({ uploadId, state, failureCode = null }) {
    const session = this.#mutableSession(uploadId);
    const normalized = requiredText(state, 'state');
    if (!STATE_SET.has(normalized)) throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_STATE', `unsupported source upload state ${normalized}`);
    session.state = normalized;
    session.failureCode = failureCode ? requiredText(failureCode, 'failureCode') : null;
    return publicSession(session);
  }
}
