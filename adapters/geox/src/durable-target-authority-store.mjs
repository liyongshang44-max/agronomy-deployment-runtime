import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION } from './target-authority-resolver.mjs';

export const GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION = 'adr.geox-durable-target-authority-store.v1';
export const GEOX_DURABLE_TARGET_AUTHORITY_STORE_CLASS = 'PROCESS_DURABLE_CONTENT_ADDRESSED_FILESYSTEM';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class GeoxDurableTargetAuthorityStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxDurableTargetAuthorityStoreError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxDurableTargetAuthorityStoreError(code, message);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function requireHash(value, name) {
  if (typeof value !== 'string' || !HASH_RE.test(value)) {
    fail('GEOX_DURABLE_TARGET_AUTHORITY_HASH_INVALID', `${name} must be lowercase sha256:<64-hex>`);
  }
  return value;
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('GEOX_DURABLE_TARGET_AUTHORITY_INPUT_INVALID', `${name} must be an object`);
  }
  return value;
}

function hashFilename(hash, suffix) {
  return `${requireHash(hash, 'hash').slice('sha256:'.length)}${suffix}`;
}

function readExact(path, missingCode, label) {
  try {
    return readFileSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') fail(missingCode, `${label} is unavailable`);
    fail('GEOX_DURABLE_TARGET_AUTHORITY_IO_FAILED', `${label} read failed: ${error?.message ?? error}`);
  }
}

function writeImmutable(path, bytes, collisionCode, label) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor = null;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;

    try {
      linkSync(temporaryPath, path);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existing = readExact(path, 'GEOX_DURABLE_TARGET_AUTHORITY_IMMUTABLE_FILE_MISSING', label);
      if (!existing.equals(bytes)) {
        fail(collisionCode, `${label} already exists with different bytes`);
      }
    }
  } catch (error) {
    if (error instanceof GeoxDurableTargetAuthorityStoreError) throw error;
    fail('GEOX_DURABLE_TARGET_AUTHORITY_IO_FAILED', `${label} write failed: ${error?.message ?? error}`);
  } finally {
    if (descriptor !== null) {
      try { closeSync(descriptor); } catch {}
    }
    try { unlinkSync(temporaryPath); } catch (error) {
      if (error?.code !== 'ENOENT') {
        fail('GEOX_DURABLE_TARGET_AUTHORITY_IO_FAILED', `${label} temp cleanup failed: ${error?.message ?? error}`);
      }
    }
  }
}

export class GeoxDurableTargetAuthorityStore {
  #rootDir;
  #snapshotDir;
  #receiptDir;

  constructor({ rootDir } = {}) {
    if (typeof rootDir !== 'string' || rootDir.trim().length === 0) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_ROOT_INVALID', 'rootDir must be non-empty text');
    }
    this.#rootDir = resolve(rootDir);
    this.#snapshotDir = join(this.#rootDir, 'v1', 'snapshots');
    this.#receiptDir = join(this.#rootDir, 'v1', 'receipts');
    try {
      mkdirSync(this.#snapshotDir, { recursive: true });
      mkdirSync(this.#receiptDir, { recursive: true });
    } catch (error) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_IO_FAILED', `store initialization failed: ${error?.message ?? error}`);
    }
  }

  get storeVersion() {
    return GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION;
  }

  get storeClass() {
    return GEOX_DURABLE_TARGET_AUTHORITY_STORE_CLASS;
  }

  retain(bytes) {
    if (!Buffer.isBuffer(bytes)) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_BYTES_REQUIRED', 'snapshot bytes must be Buffer');
    }
    const contentHash = sha256(bytes);
    const path = join(this.#snapshotDir, hashFilename(contentHash, '.blob'));
    writeImmutable(path, bytes, 'GEOX_DURABLE_TARGET_AUTHORITY_SNAPSHOT_HASH_COLLISION', `snapshot ${contentHash}`);
    return contentHash;
  }

  get(contentHash) {
    const normalized = requireHash(contentHash, 'contentHash');
    const bytes = readExact(
      join(this.#snapshotDir, hashFilename(normalized, '.blob')),
      'GEOX_DURABLE_TARGET_AUTHORITY_SNAPSHOT_MISSING',
      `snapshot ${normalized}`
    );
    if (sha256(bytes) !== normalized) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_SNAPSHOT_HASH_MISMATCH', `snapshot ${normalized} changed bytes`);
    }
    return Buffer.from(bytes);
  }

  has(contentHash) {
    const normalized = requireHash(contentHash, 'contentHash');
    return existsSync(join(this.#snapshotDir, hashFilename(normalized, '.blob')));
  }

  count() {
    try {
      return readdirSync(this.#snapshotDir).filter((name) => /^[0-9a-f]{64}\.blob$/.test(name)).length;
    } catch (error) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_IO_FAILED', `snapshot count failed: ${error?.message ?? error}`);
    }
  }

  persistReceipt(receipt) {
    const normalized = requireObject(receipt, 'receipt');
    if (normalized.contract_version !== GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_INVALID', 'receipt contract version is not supported');
    }
    const bytes = Buffer.from(JSON.stringify(normalized), 'utf8');
    const receiptHash = sha256(bytes);
    const path = join(this.#receiptDir, hashFilename(receiptHash, '.json'));
    writeImmutable(path, bytes, 'GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_HASH_COLLISION', `receipt ${receiptHash}`);
    return receiptHash;
  }

  loadReceipt(receiptHash) {
    const normalized = requireHash(receiptHash, 'receiptHash');
    const bytes = readExact(
      join(this.#receiptDir, hashFilename(normalized, '.json')),
      'GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_MISSING',
      `receipt ${normalized}`
    );
    if (sha256(bytes) !== normalized) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_HASH_MISMATCH', `receipt ${normalized} changed bytes`);
    }
    let receipt;
    try {
      receipt = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_INVALID', `receipt ${normalized} is not valid JSON`);
    }
    if (receipt?.contract_version !== GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION) {
      fail('GEOX_DURABLE_TARGET_AUTHORITY_RECEIPT_INVALID', `receipt ${normalized} contract version changed`);
    }
    return receipt;
  }
}
