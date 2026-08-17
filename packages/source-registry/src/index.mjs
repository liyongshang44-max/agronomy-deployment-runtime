import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const SOURCE_TYPES = deepFreeze([
  'PUBLICATION',
  'PROTOCOL',
  'LABEL',
  'TRIAL_REPORT',
  'CULTIVAR_DOCUMENT',
  'REGULATORY_DOCUMENT',
  'DATASET_DOCUMENTATION',
  'OTHER'
]);

const SOURCE_TYPE_SET = new Set(SOURCE_TYPES);

export class SourceRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SourceRegistryError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SourceRegistryError('INVALID_SOURCE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, name) {
  if (value === undefined || value === null) return undefined;
  return requiredText(value, name);
}

function normalizeSourceType(value) {
  const normalized = requiredText(value, 'sourceType');
  if (!SOURCE_TYPE_SET.has(normalized)) {
    throw new SourceRegistryError('INVALID_SOURCE_TYPE', `unsupported source type ${normalized}`);
  }
  return normalized;
}

function normalizeOwnership(ownership) {
  if (!ownership || typeof ownership !== 'object' || Array.isArray(ownership)) {
    throw new SourceRegistryError('INVALID_SOURCE_OWNERSHIP', 'ownership must be an object');
  }
  return deepFreeze({
    organizationId: requiredText(ownership.organizationId, 'ownership.organizationId'),
    ...(ownership.tenantId ? { tenantId: requiredText(ownership.tenantId, 'ownership.tenantId') } : {})
  });
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new SourceRegistryError('INVALID_SOURCE_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function normalizeBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  throw new SourceRegistryError(
    'EXACT_BYTES_REQUIRED',
    'SourceArtifact materialization requires Buffer/Uint8Array exact bytes; encode text explicitly before calling'
  );
}

function normalizeAcquisition(acquisition) {
  if (!acquisition || typeof acquisition !== 'object' || Array.isArray(acquisition)) {
    throw new SourceRegistryError('INVALID_ACQUISITION', 'SourceArtifact acquisition metadata is required');
  }
  const acquiredAt = normalizeTimestamp(acquisition.acquiredAt, 'acquisition.acquiredAt');
  const method = requiredText(acquisition.method, 'acquisition.method');
  const locator = optionalText(acquisition.locator, 'acquisition.locator');
  return deepFreeze({
    method,
    acquiredAt,
    ...(locator ? { locator } : {}),
    metadata: cloneCanonicalValue(acquisition.metadata ?? {})
  });
}

function normalizeRetentionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new SourceRegistryError('INVALID_RETENTION_RECEIPT', 'retentionReceipt must be an object');
  }
  const byteLength = receipt.byteLength;
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new SourceRegistryError('INVALID_RETENTION_RECEIPT', 'retentionReceipt.byteLength must be a non-negative safe integer');
  }
  return deepFreeze({
    storeKind: requiredText(receipt.storeKind, 'retentionReceipt.storeKind'),
    retentionId: requiredText(receipt.retentionId, 'retentionReceipt.retentionId'),
    contentHash: requiredText(receipt.contentHash, 'retentionReceipt.contentHash'),
    byteLength
  });
}

export function sourceContentHash(bytes) {
  const normalized = normalizeBytes(bytes);
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

export class ExactArtifactStore {
  #objects = new Map();

  put(bytes) {
    const normalized = normalizeBytes(bytes);
    const contentHash = sourceContentHash(normalized);
    const existing = this.#objects.get(contentHash);
    if (!existing) this.#objects.set(contentHash, Buffer.from(normalized));
    return deepFreeze({
      storeKind: 'IN_MEMORY_CONTENT_ADDRESSABLE_REFERENCE',
      retentionId: contentHash,
      contentHash,
      byteLength: normalized.byteLength
    });
  }

  has(contentHash) {
    return this.#objects.has(requiredText(contentHash, 'contentHash'));
  }

  get(contentHash) {
    const normalizedHash = requiredText(contentHash, 'contentHash');
    const bytes = this.#objects.get(normalizedHash);
    if (!bytes) throw new SourceRegistryError('ARTIFACT_CONTENT_NOT_RETAINED', `artifact content ${normalizedHash} is not retained`);
    return Buffer.from(bytes);
  }

  count() {
    return this.#objects.size;
  }
}

function sourceRecord(record) {
  if (!record?.ref || record.ref.kind !== 'Source') {
    throw new SourceRegistryError('SOURCE_REQUIRED', 'expected an exact published Source authority record');
  }
  return record;
}

function sourceArtifactRecord(record) {
  if (!record?.ref || record.ref.kind !== 'SourceArtifact') {
    throw new SourceRegistryError('SOURCE_ARTIFACT_REQUIRED', 'expected an exact published SourceArtifact authority record');
  }
  return record;
}

function hasLegacyArtifactStoreContract(store) {
  return typeof store?.put === 'function' && typeof store?.get === 'function';
}

function hasScopedArtifactStoreContract(store) {
  return typeof store?.putForScope === 'function' && typeof store?.getForScope === 'function';
}

function hasScopedRetentionInspectionContract(store) {
  return typeof store?.inspectForScope === 'function';
}

function hasScopedStreamReadContract(store) {
  return typeof store?.createReadStreamForScope === 'function';
}

function putArtifactBytes(store, ownership, bytes) {
  if (hasScopedArtifactStoreContract(store)) {
    return store.putForScope(normalizeOwnership(ownership), bytes);
  }
  if (hasLegacyArtifactStoreContract(store)) return store.put(bytes);
  throw new SourceRegistryError(
    'ARTIFACT_STORE_BYTE_PUT_UNSUPPORTED',
    'configured artifact store does not support synchronous exact-byte materialization'
  );
}

function getArtifactBytes(store, ownership, contentHash) {
  if (hasScopedArtifactStoreContract(store)) {
    return store.getForScope(normalizeOwnership(ownership), contentHash);
  }
  if (hasLegacyArtifactStoreContract(store)) return store.get(contentHash);
  throw new SourceRegistryError(
    'ARTIFACT_STORE_BYTE_READ_UNSUPPORTED',
    'configured artifact store does not support bounded exact-byte reads; use readArtifactStream when available'
  );
}

function inspectRetainedArtifact(store, ownership, receipt) {
  if (!hasScopedRetentionInspectionContract(store)) {
    throw new SourceRegistryError(
      'ARTIFACT_STORE_RETENTION_INSPECTION_UNSUPPORTED',
      'retained-artifact finalization requires scoped artifact-store inspection'
    );
  }
  const inspected = normalizeRetentionReceipt(
    store.inspectForScope(normalizeOwnership(ownership), receipt.contentHash)
  );
  for (const field of ['storeKind', 'retentionId', 'contentHash', 'byteLength']) {
    if (inspected[field] !== receipt[field]) {
      throw new SourceRegistryError(
        'RETENTION_RECEIPT_MISMATCH',
        `retentionReceipt.${field} does not match the exact retained object`
      );
    }
  }
  return inspected;
}

function artifactSemanticPayload({
  source,
  mediaType,
  materializationIdentity,
  retention,
  acquisition,
  rightsSnapshot,
  metadata
}) {
  return {
    sourceRef: source.ref,
    mediaType: requiredText(mediaType, 'mediaType'),
    materializationIdentity: requiredText(materializationIdentity, 'materializationIdentity'),
    contentHash: retention.contentHash,
    byteLength: retention.byteLength,
    retention: {
      storeKind: retention.storeKind,
      retentionId: retention.retentionId
    },
    acquisition: normalizeAcquisition(acquisition),
    ...(rightsSnapshot !== undefined ? { rightsSnapshot: cloneCanonicalValue(rightsSnapshot) } : {}),
    metadata: cloneCanonicalValue(metadata ?? {})
  };
}

export class SourceRegistry {
  #ledger;
  #artifactStore;

  constructor({ ledger, artifactStore = new ExactArtifactStore() }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
      throw new SourceRegistryError('INVALID_LEDGER', 'SourceRegistry requires the shared AuthorityLedger contract');
    }
    if (!artifactStore || (!hasLegacyArtifactStoreContract(artifactStore)
      && !hasScopedArtifactStoreContract(artifactStore)
      && !hasScopedRetentionInspectionContract(artifactStore))) {
      throw new SourceRegistryError(
        'INVALID_ARTIFACT_STORE',
        'SourceRegistry requires exact artifact byte storage or scoped retained-object inspection'
      );
    }
    this.#ledger = ledger;
    this.#artifactStore = artifactStore;
  }

  registerSource({
    logicalId,
    version,
    sourceType,
    title,
    ownership,
    bibliographic = {},
    edition,
    sourceVersionLabel,
    originLocator,
    rights = {},
    metadata = {},
    audit
  }) {
    return this.#ledger.publish({
      kind: 'Source',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        sourceType: normalizeSourceType(sourceType),
        title: requiredText(title, 'title'),
        ownership: normalizeOwnership(ownership),
        bibliographic: cloneCanonicalValue(bibliographic),
        ...(optionalText(edition, 'edition') ? { edition: optionalText(edition, 'edition') } : {}),
        ...(optionalText(sourceVersionLabel, 'sourceVersionLabel')
          ? { sourceVersionLabel: optionalText(sourceVersionLabel, 'sourceVersionLabel') }
          : {}),
        ...(optionalText(originLocator, 'originLocator') ? { originLocator: optionalText(originLocator, 'originLocator') } : {}),
        rights: cloneCanonicalValue(rights),
        metadata: cloneCanonicalValue(metadata)
      },
      audit
    });
  }

  linkSourceSupersedes({ newerSourceRef, olderSourceRef, audit, details = {} }) {
    const newer = sourceRecord(this.#ledger.resolve(assertAuthorityRef(newerSourceRef)));
    const older = sourceRecord(this.#ledger.resolve(assertAuthorityRef(olderSourceRef)));
    return this.#ledger.addLineage({
      relation: 'supersedes',
      from: newer.ref,
      to: older.ref,
      details,
      audit
    });
  }

  materializeArtifact({
    logicalId,
    version,
    sourceRef,
    bytes,
    mediaType,
    materializationIdentity,
    acquisition,
    rightsSnapshot,
    metadata = {},
    audit
  }) {
    const exactSource = sourceRecord(this.#ledger.resolve(assertAuthorityRef(sourceRef)));
    const exactBytes = normalizeBytes(bytes);
    const retention = normalizeRetentionReceipt(
      putArtifactBytes(this.#artifactStore, exactSource.semanticPayload.ownership, exactBytes)
    );

    return this.#ledger.publish({
      kind: 'SourceArtifact',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: artifactSemanticPayload({
        source: exactSource,
        mediaType,
        materializationIdentity,
        retention,
        acquisition,
        rightsSnapshot,
        metadata
      }),
      audit: {
        ...audit,
        inputRefs: [exactSource.ref, ...(audit?.inputRefs ?? [])]
      }
    });
  }

  materializeRetainedArtifact({
    logicalId,
    version,
    sourceRef,
    retentionReceipt,
    mediaType,
    materializationIdentity,
    acquisition,
    rightsSnapshot,
    metadata = {},
    audit
  }) {
    const exactSource = sourceRecord(this.#ledger.resolve(assertAuthorityRef(sourceRef)));
    const receipt = normalizeRetentionReceipt(retentionReceipt);
    const retention = inspectRetainedArtifact(
      this.#artifactStore,
      exactSource.semanticPayload.ownership,
      receipt
    );

    return this.#ledger.publish({
      kind: 'SourceArtifact',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: artifactSemanticPayload({
        source: exactSource,
        mediaType,
        materializationIdentity,
        retention,
        acquisition,
        rightsSnapshot,
        metadata
      }),
      audit: {
        ...audit,
        inputRefs: [exactSource.ref, ...(audit?.inputRefs ?? [])]
      }
    });
  }

  resolveSource(ref) {
    return sourceRecord(this.#ledger.resolve(assertAuthorityRef(ref)));
  }

  resolveArtifact(ref) {
    return sourceArtifactRecord(this.#ledger.resolve(assertAuthorityRef(ref)));
  }

  readArtifactBytes(ref) {
    const artifact = this.resolveArtifact(ref);
    const source = this.resolveSource(artifact.semanticPayload.sourceRef);
    const bytes = getArtifactBytes(
      this.#artifactStore,
      source.semanticPayload.ownership,
      artifact.semanticPayload.contentHash
    );
    const actualHash = sourceContentHash(bytes);
    if (actualHash !== artifact.semanticPayload.contentHash) {
      throw new SourceRegistryError('ARTIFACT_CONTENT_HASH_MISMATCH', 'retained bytes no longer match SourceArtifact contentHash');
    }
    if (bytes.byteLength !== artifact.semanticPayload.byteLength) {
      throw new SourceRegistryError('ARTIFACT_BYTE_LENGTH_MISMATCH', 'retained bytes no longer match SourceArtifact byteLength');
    }
    return bytes;
  }

  readArtifactStream(ref) {
    const artifact = this.resolveArtifact(ref);
    const source = this.resolveSource(artifact.semanticPayload.sourceRef);
    if (!hasScopedStreamReadContract(this.#artifactStore)) {
      throw new SourceRegistryError(
        'ARTIFACT_STREAM_READ_UNSUPPORTED',
        'configured artifact store does not support scoped streaming reads'
      );
    }
    const input = this.#artifactStore.createReadStreamForScope(
      normalizeOwnership(source.semanticPayload.ownership),
      artifact.semanticPayload.contentHash
    );
    if (!input || typeof input.pipe !== 'function') {
      throw new SourceRegistryError('INVALID_ARTIFACT_STREAM', 'artifact store returned an invalid readable stream');
    }

    const expectedHash = artifact.semanticPayload.contentHash;
    const expectedLength = artifact.semanticPayload.byteLength;
    const hash = createHash('sha256');
    let byteLength = 0;
    const verifier = new Transform({
      transform(chunk, encoding, callback) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        byteLength += bytes.byteLength;
        hash.update(bytes);
        callback(null, bytes);
      },
      flush(callback) {
        const actualHash = `sha256:${hash.digest('hex')}`;
        if (actualHash !== expectedHash) {
          callback(new SourceRegistryError(
            'ARTIFACT_CONTENT_HASH_MISMATCH',
            'streamed retained bytes no longer match SourceArtifact contentHash'
          ));
          return;
        }
        if (byteLength !== expectedLength) {
          callback(new SourceRegistryError(
            'ARTIFACT_BYTE_LENGTH_MISMATCH',
            'streamed retained bytes no longer match SourceArtifact byteLength'
          ));
          return;
        }
        callback();
      }
    });
    input.on('error', (error) => verifier.destroy(error));
    return input.pipe(verifier);
  }

  artifactStore() {
    return this.#artifactStore;
  }
}
