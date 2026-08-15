import { createHash } from 'node:crypto';
import { deepFreeze } from '../../canonicalization/src/index.mjs';

export class ContextSnapshotError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextSnapshotError';
    this.code = code;
  }
}

function normalizeBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  throw new ContextSnapshotError(
    'EXACT_PROVIDER_RESPONSE_BYTES_REQUIRED',
    'reference resolution requires exact provider response bytes as Buffer/Uint8Array'
  );
}

export function providerResponseContentHash(bytes) {
  const normalized = normalizeBytes(bytes);
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

export class ExactContextSnapshotStore {
  #objects = new Map();

  put(bytes) {
    const normalized = normalizeBytes(bytes);
    const contentHash = providerResponseContentHash(normalized);
    if (!this.#objects.has(contentHash)) this.#objects.set(contentHash, Buffer.from(normalized));
    return deepFreeze({
      storeKind: 'ADR_CONTROLLED_CONTENT_ADDRESSABLE_SNAPSHOT',
      retentionRef: contentHash,
      contentHash,
      byteLength: normalized.byteLength
    });
  }

  has(contentHash) {
    return this.#objects.has(contentHash);
  }

  get(contentHash) {
    const bytes = this.#objects.get(contentHash);
    if (!bytes) {
      throw new ContextSnapshotError('CONTEXT_SNAPSHOT_NOT_RETAINED', `provider response ${contentHash} is not retained`);
    }
    return Buffer.from(bytes);
  }

  count() {
    return this.#objects.size;
  }
}
