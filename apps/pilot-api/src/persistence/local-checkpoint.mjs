import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../../../packages/canonicalization/src/index.mjs';

export const PILOT_CHECKPOINT_FORMAT = 'ADR_PILOT_LOCAL_CHECKPOINT_V1';

export class PilotCheckpointError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PilotCheckpointError';
    this.code = code;
  }
}

function checkpointEnvelope(payload) {
  const canonicalPayload = cloneCanonicalValue(payload);
  return deepFreeze({
    format: PILOT_CHECKPOINT_FORMAT,
    payload: canonicalPayload,
    checkpointHash: semanticHash('AdrPilotLocalCheckpoint', canonicalPayload)
  });
}

export function loadPilotCheckpoint({ path }) {
  const filePath = resolve(path);
  if (!existsSync(filePath)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_INVALID_JSON', 'pilot runtime checkpoint is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.format !== PILOT_CHECKPOINT_FORMAT) {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_FORMAT_INVALID', `checkpoint format must be ${PILOT_CHECKPOINT_FORMAT}`);
  }
  if (!parsed.payload || typeof parsed.payload !== 'object' || Array.isArray(parsed.payload)) {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_PAYLOAD_INVALID', 'checkpoint payload must be an object');
  }
  const expected = semanticHash('AdrPilotLocalCheckpoint', parsed.payload);
  if (parsed.checkpointHash !== expected) {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_HASH_MISMATCH', 'pilot runtime checkpoint checksum does not match payload');
  }
  return deepFreeze(cloneCanonicalValue(parsed.payload));
}

export function savePilotCheckpoint({ path, ledger, ingestion }) {
  if (!ledger || typeof ledger.exportSnapshot !== 'function') {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_LEDGER_REQUIRED', 'ledger.exportSnapshot is required');
  }
  if (!ingestion || typeof ingestion.exportSnapshot !== 'function') {
    throw new PilotCheckpointError('PILOT_CHECKPOINT_INGESTION_REQUIRED', 'ingestion.exportSnapshot is required');
  }
  const filePath = resolve(path);
  mkdirSync(dirname(filePath), { recursive: true });
  const envelope = checkpointEnvelope({
    ledger: ledger.exportSnapshot(),
    ingestion: ingestion.exportSnapshot()
  });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(tempPath, filePath);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
  return envelope.checkpointHash;
}
