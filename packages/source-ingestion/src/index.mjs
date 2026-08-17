import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { deepFreeze } from '../../canonicalization/src/index.mjs';

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

function safeUnlink(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function safeUnlinkAsync(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export class FileSystemScopedArtifactStore {
  #rootDir;

  constructor({ rootDir }) {
    this.#rootDir = resolve(requiredText(rootDir, 'rootDir'));
    mkdirSync(this.#rootDir, { recursive: true });
  }

  #scopeDir(scopeInput) {
    return join(this.#rootDir, scopeKey(scopeInput));
  }

  #objectPath(scopeInput, contentHashInput) {
    const contentHash = normalizeContentHash(contentHashInput);
    return join(this.#scopeDir(scopeInput), 'objects', contentHash.slice('sha256:'.length));
  }

  #stagingDir(scopeInput) {
    return join(this.#scopeDir(scopeInput), 'staging');
  }

  putForScope(scopeInput, bytesInput) {
    const scope = normalizeScope(scopeInput);
    const bytes = Buffer.isBuffer(bytesInput)
      ? Buffer.from(bytesInput)
      : bytesInput instanceof Uint8Array
        ? Buffer.from(bytesInput.buffer, bytesInput.byteOffset, bytesInput.byteLength)
        : null;
    if (!bytes) {
      throw new SourceIngestionError('EXACT_BYTES_REQUIRED', 'putForScope requires Buffer or Uint8Array');
    }
    const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const objectPath = this.#objectPath(scope, contentHash);
    mkdirSync(join(this.#scopeDir(scope), 'objects'), { recursive: true });
    if (!existsSync(objectPath)) writeFileSync(objectPath, bytes, { flag: 'wx' });
    const actualLength = statSync(objectPath).size;
    if (actualLength !== bytes.byteLength) {
      throw new SourceIngestionError('RETAINED_OBJECT_LENGTH_MISMATCH', 'retained object length differs from exact input bytes');
    }
    return retentionReceipt(scope, contentHash, actualLength);
  }

  getForScope(scopeInput, contentHashInput) {
    const objectPath = this.#objectPath(normalizeScope(scopeInput), contentHashInput);
    if (!existsSync(objectPath)) {
      throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    }
    return readFileSync(objectPath);
  }

  hasForScope(scopeInput, contentHashInput) {
    return existsSync(this.#objectPath(normalizeScope(scopeInput), contentHashInput));
  }

  inspectForScope(scopeInput, contentHashInput) {
    const scope = normalizeScope(scopeInput);
    const contentHash = normalizeContentHash(contentHashInput);
    const objectPath = this.#objectPath(scope, contentHash);
    if (!existsSync(objectPath)) {
      throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    }
    const info = statSync(objectPath);
    if (!info.isFile()) {
      throw new SourceIngestionError('INVALID_RETAINED_OBJECT', 'retained artifact path is not a file');
    }
    return retentionReceipt(scope, contentHash, info.size);
  }

  createReadStreamForScope(scopeInput, contentHashInput) {
    const scope = normalizeScope(scopeInput);
    const contentHash = normalizeContentHash(contentHashInput);
    const objectPath = this.#objectPath(scope, contentHash);
    if (!existsSync(objectPath)) {
      throw new SourceIngestionError('ARTIFACT_CONTENT_NOT_RETAINED', 'scoped retained object does not exist');
    }
    return createReadStream(objectPath);
  }

  async putStreamForScope(scopeInput, readable, { maxBytes = DEFAULT_MAX_SOURCE_UPLOAD_BYTES } = {}) {
    const scope = normalizeScope(scopeInput);
    if (!readable || typeof readable.pipe !== 'function') {
      throw new SourceIngestionError('READABLE_STREAM_REQUIRED', 'putStreamForScope requires a readable stream');
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new SourceIngestionError('INVALID_MAX_UPLOAD_BYTES', 'maxBytes must be a positive safe integer');
    }

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
          callback(new SourceIngestionError(
            'SOURCE_UPLOAD_TOO_LARGE',
            `source upload exceeded configured maximum of ${maxBytes} bytes`
          ));
          return;
        }
        hash.update(bytes);
        callback(null, bytes);
      }
    });

    try {
      await pipeline(readable, meter, createWriteStream(stagingPath, { flags: 'wx' }));
      if (byteLength === 0) {
        throw new SourceIngestionError('EMPTY_SOURCE_UPLOAD', 'source upload body is empty');
      }
      const contentHash = `sha256:${hash.digest('hex')}`;
      const objectPath = this.#objectPath(scope, contentHash);
      try {
        await rename(stagingPath, objectPath);
      } catch (error) {
        if (error?.code === 'EEXIST' || error?.code === 'EPERM') {
          const existing = await stat(objectPath).catch(() => null);
          if (!existing?.isFile() || existing.size !== byteLength) throw error;
          await safeUnlinkAsync(stagingPath);
        } else {
          throw error;
        }
      }
      const retained = await stat(objectPath);
      if (!retained.isFile() || retained.size !== byteLength) {
        throw new SourceIngestionError(
          'RETAINED_OBJECT_LENGTH_MISMATCH',
          'committed retained object does not match streamed byte length'
        );
      }
      return retentionReceipt(scope, contentHash, retained.size);
    } catch (error) {
      await safeUnlinkAsync(stagingPath);
      throw error;
    }
  }
}

function normalizeSourceDraft(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new SourceIngestionError('SOURCE_DRAFT_REQUIRED', 'source draft is required');
  }
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
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new SourceIngestionError('ARTIFACT_DRAFT_REQUIRED', 'artifact draft is required');
  }
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

export class PilotSourceIngestionService {
  #sourceRegistry;
  #artifactStore;
  #maxUploadBytes;
  #sessions = new Map();

  constructor({ sourceRegistry, artifactStore, maxUploadBytes = DEFAULT_MAX_SOURCE_UPLOAD_BYTES }) {
    if (!sourceRegistry || typeof sourceRegistry.registerSource !== 'function'
      || typeof sourceRegistry.materializeRetainedArtifact !== 'function') {
      throw new SourceIngestionError('INVALID_SOURCE_REGISTRY', 'sourceRegistry retained-artifact support is required');
    }
    if (!artifactStore || typeof artifactStore.putStreamForScope !== 'function'
      || typeof artifactStore.inspectForScope !== 'function') {
      throw new SourceIngestionError('INVALID_ARTIFACT_STORE', 'streaming scoped artifact store is required');
    }
    if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes <= 0) {
      throw new SourceIngestionError('INVALID_MAX_UPLOAD_BYTES', 'maxUploadBytes must be a positive safe integer');
    }
    this.#sourceRegistry = sourceRegistry;
    this.#artifactStore = artifactStore;
    this.#maxUploadBytes = maxUploadBytes;
  }

  createUpload({ scope, filename, declaredMediaType = 'application/pdf', source, artifact }) {
    const normalizedScope = normalizeScope(scope);
    const normalizedMediaType = requiredText(declaredMediaType, 'declaredMediaType');
    if (normalizedMediaType !== 'application/pdf') {
      throw new SourceIngestionError('UNSUPPORTED_SOURCE_MEDIA_TYPE', 'pilot source upload currently accepts application/pdf only');
    }
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
    if (session.state !== 'CREATED') {
      throw new SourceIngestionError('SOURCE_UPLOAD_STATE_INVALID', `cannot upload content from state ${session.state}`);
    }
    session.state = 'UPLOADING';

    let prefix = Buffer.alloc(0);
    const signatureCheck = new Transform({
      transform(chunk, encoding, callback) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        if (prefix.byteLength < PDF_MAGIC.byteLength) {
          const needed = PDF_MAGIC.byteLength - prefix.byteLength;
          prefix = Buffer.concat([prefix, bytes.subarray(0, needed)]);
        }
        callback(null, bytes);
      },
      flush(callback) {
        if (prefix.byteLength < PDF_MAGIC.byteLength || !prefix.equals(PDF_MAGIC)) {
          callback(new SourceIngestionError('PDF_SIGNATURE_INVALID', 'uploaded source does not begin with %PDF-'));
          return;
        }
        callback();
      }
    });

    try {
      readable.on('error', (error) => signatureCheck.destroy(error));
      const retention = await this.#artifactStore.putStreamForScope(
        session.scope,
        readable.pipe(signatureCheck),
        { maxBytes: this.#maxUploadBytes }
      );
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
    if (session.state !== 'STORED' || !session.retentionReceipt) {
      throw new SourceIngestionError('SOURCE_UPLOAD_STATE_INVALID', `cannot finalize source upload from state ${session.state}`);
    }

    const source = this.#sourceRegistry.registerSource({
      ...session.source,
      ownership: session.scope,
      audit: sourceAudit
    });
    const sourceArtifact = this.#sourceRegistry.materializeRetainedArtifact({
      ...session.artifact,
      sourceRef: source.ref,
      retentionReceipt: session.retentionReceipt,
      audit: artifactAudit
    });
    session.sourceRef = source.ref;
    session.sourceArtifactRef = sourceArtifact.ref;
    session.state = 'SOURCE_MATERIALIZED';
    return deepFreeze({
      upload: publicSession(session),
      source,
      sourceArtifact
    });
  }

  markState({ uploadId, state, failureCode = null }) {
    const session = this.#mutableSession(uploadId);
    const normalized = requiredText(state, 'state');
    if (!STATE_SET.has(normalized)) {
      throw new SourceIngestionError('INVALID_SOURCE_UPLOAD_STATE', `unsupported source upload state ${normalized}`);
    }
    session.state = normalized;
    session.failureCode = failureCode ? requiredText(failureCode, 'failureCode') : null;
    return publicSession(session);
  }
}
