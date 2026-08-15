import { createHash } from 'node:crypto';
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

export class SourceRegistry {
  #ledger;
  #artifactStore;

  constructor({ ledger, artifactStore = new ExactArtifactStore() }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
      throw new SourceRegistryError('INVALID_LEDGER', 'SourceRegistry requires the shared AuthorityLedger contract');
    }
    if (!artifactStore || typeof artifactStore.put !== 'function' || typeof artifactStore.get !== 'function') {
      throw new SourceRegistryError('INVALID_ARTIFACT_STORE', 'SourceRegistry requires an exact artifact store');
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
    const retention = this.#artifactStore.put(exactBytes);

    if (!acquisition || typeof acquisition !== 'object' || Array.isArray(acquisition)) {
      throw new SourceRegistryError('INVALID_ACQUISITION', 'SourceArtifact acquisition metadata is required');
    }
    const acquiredAt = normalizeTimestamp(acquisition.acquiredAt, 'acquisition.acquiredAt');
    const method = requiredText(acquisition.method, 'acquisition.method');
    const locator = optionalText(acquisition.locator, 'acquisition.locator');

    return this.#ledger.publish({
      kind: 'SourceArtifact',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        sourceRef: exactSource.ref,
        mediaType: requiredText(mediaType, 'mediaType'),
        materializationIdentity: requiredText(materializationIdentity, 'materializationIdentity'),
        contentHash: retention.contentHash,
        byteLength: retention.byteLength,
        retention: {
          storeKind: retention.storeKind,
          retentionId: retention.retentionId
        },
        acquisition: {
          method,
          acquiredAt,
          ...(locator ? { locator } : {}),
          metadata: cloneCanonicalValue(acquisition.metadata ?? {})
        },
        ...(rightsSnapshot !== undefined ? { rightsSnapshot: cloneCanonicalValue(rightsSnapshot) } : {}),
        metadata: cloneCanonicalValue(metadata)
      },
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
    const bytes = this.#artifactStore.get(artifact.semanticPayload.contentHash);
    const actualHash = sourceContentHash(bytes);
    if (actualHash !== artifact.semanticPayload.contentHash) {
      throw new SourceRegistryError('ARTIFACT_CONTENT_HASH_MISMATCH', 'retained bytes no longer match SourceArtifact contentHash');
    }
    if (bytes.byteLength !== artifact.semanticPayload.byteLength) {
      throw new SourceRegistryError('ARTIFACT_BYTE_LENGTH_MISMATCH', 'retained bytes no longer match SourceArtifact byteLength');
    }
    return bytes;
  }

  artifactStore() {
    return this.#artifactStore;
  }
}
