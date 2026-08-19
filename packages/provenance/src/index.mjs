import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, authorityRefKey, makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createAuditEvent } from '../../audit/src/index.mjs';

export const LINEAGE_RELATIONS = deepFreeze([
  'supersedes',
  'superseded_by',
  'revokes',
  'derived_from',
  'requalifies',
  'replaces'
]);

const LINEAGE_RELATION_SET = new Set(LINEAGE_RELATIONS);

export class AuthorityLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthorityLedgerError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuthorityLedgerError('INVALID_AUTHORITY_IDENTITY', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function freezeCanonical(value) {
  return deepFreeze(cloneCanonicalValue(value));
}

function lineageKey(record) {
  return record.lineageHash;
}

function preparePublication({ kind, logicalId, version, semanticPayload, operationalMetadata = {}, audit }) {
  const normalizedKind = requiredText(kind, 'kind');
  const normalizedLogicalId = requiredText(logicalId, 'logicalId');
  const normalizedVersion = requiredText(version, 'version');
  const payload = freezeCanonical(semanticPayload);
  const metadata = freezeCanonical(operationalMetadata);
  const hash = semanticHash(normalizedKind, payload);
  const ref = makeAuthorityRef({ kind: normalizedKind, logicalId: normalizedLogicalId, version: normalizedVersion, semanticHash: hash });
  if (!audit) throw new AuthorityLedgerError('AUDIT_REQUIRED', 'publishing authority requires explicit audit metadata');
  const record = deepFreeze({ ref, semanticPayload: payload, operationalMetadata: metadata });
  const event = createAuditEvent({
    ...audit,
    action: audit.action ?? 'PUBLISH_AUTHORITY',
    objectRef: ref,
    inputRefs: audit.inputRefs ?? []
  });
  return { ref, record, event };
}

function prepareLineage({ relation, from, to, audit, details = {} }, resolveRecord) {
  if (!LINEAGE_RELATION_SET.has(relation)) {
    throw new AuthorityLedgerError('INVALID_LINEAGE_RELATION', `unsupported lineage relation ${relation}`);
  }
  if (!audit) throw new AuthorityLedgerError('AUDIT_REQUIRED', 'lineage creation requires explicit audit metadata');
  const fromRecord = resolveRecord(from);
  const toRecord = resolveRecord(to);
  const semanticPayload = { relation, from: fromRecord.ref, to: toRecord.ref };
  const record = deepFreeze({
    ...semanticPayload,
    details: freezeCanonical(details),
    lineageHash: semanticHash('AuthorityLineage', semanticPayload)
  });
  const event = createAuditEvent({
    ...audit,
    action: audit.action ?? `LINEAGE_${relation.toUpperCase()}`,
    objectRef: fromRecord.ref,
    inputRefs: [toRecord.ref, ...(audit.inputRefs ?? [])],
    details: { relation, lineageHash: record.lineageHash, ...(audit.details ?? {}) }
  });
  return { record, event };
}

function validateRestoredRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AuthorityLedgerError('INVALID_AUTHORITY_SNAPSHOT', 'snapshot authority record must be an object');
  }
  const ref = assertAuthorityRef(input.ref);
  const semanticPayload = freezeCanonical(input.semanticPayload);
  const operationalMetadata = freezeCanonical(input.operationalMetadata ?? {});
  const recomputed = semanticHash(ref.kind, semanticPayload);
  if (recomputed !== ref.semanticHash) {
    throw new AuthorityLedgerError(
      'SNAPSHOT_AUTHORITY_HASH_MISMATCH',
      `snapshot authority ${ref.kind}/${ref.logicalId}@${ref.version} semantic hash does not match payload`
    );
  }
  return deepFreeze({ ref, semanticPayload, operationalMetadata });
}

function validateRestoredLineage(input, resolveRecord) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AuthorityLedgerError('INVALID_AUTHORITY_SNAPSHOT', 'snapshot lineage record must be an object');
  }
  const relation = requiredText(input.relation, 'lineage.relation');
  if (!LINEAGE_RELATION_SET.has(relation)) {
    throw new AuthorityLedgerError('INVALID_LINEAGE_RELATION', `unsupported lineage relation ${relation}`);
  }
  const from = resolveRecord(input.from).ref;
  const to = resolveRecord(input.to).ref;
  const expectedHash = semanticHash('AuthorityLineage', { relation, from, to });
  if (requiredText(input.lineageHash, 'lineage.lineageHash') !== expectedHash) {
    throw new AuthorityLedgerError('SNAPSHOT_LINEAGE_HASH_MISMATCH', `snapshot lineage ${relation} hash does not match exact refs`);
  }
  return deepFreeze({ relation, from, to, details: freezeCanonical(input.details ?? {}), lineageHash: expectedHash });
}

function validateRestoredAuditEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AuthorityLedgerError('INVALID_AUTHORITY_SNAPSHOT', 'snapshot audit event must be an object');
  }
  const recomputed = createAuditEvent({
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    actor: input.actor,
    action: input.action,
    objectRef: input.objectRef,
    inputRefs: input.inputRefs ?? [],
    details: input.details ?? {}
  });
  if (requiredText(input.eventHash, 'audit.eventHash') !== recomputed.eventHash) {
    throw new AuthorityLedgerError('SNAPSHOT_AUDIT_HASH_MISMATCH', `snapshot audit event ${recomputed.eventId} hash does not match payload`);
  }
  return recomputed;
}

export class AuthorityLedger {
  #records = new Map();
  #lineage = new Map();
  #audit = [];

  static fromSnapshot(snapshot) {
    const ledger = new AuthorityLedger();
    ledger.restoreSnapshot(snapshot);
    return ledger;
  }

  restoreSnapshot(snapshot) {
    if (this.#records.size !== 0 || this.#lineage.size !== 0 || this.#audit.length !== 0) {
      throw new AuthorityLedgerError('LEDGER_NOT_EMPTY', 'authority snapshot restore requires an empty ledger');
    }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
      || !Array.isArray(snapshot.records) || !Array.isArray(snapshot.lineage) || !Array.isArray(snapshot.audit)) {
      throw new AuthorityLedgerError('INVALID_AUTHORITY_SNAPSHOT', 'snapshot must contain records[], lineage[], and audit[]');
    }

    const stagedRecords = new Map();
    for (const input of snapshot.records) {
      const record = validateRestoredRecord(input);
      const key = authorityRefKey(record.ref);
      const existing = stagedRecords.get(key);
      if (existing) {
        if (!sameAuthorityRef(existing.ref, record.ref)) {
          throw new AuthorityLedgerError('SNAPSHOT_AUTHORITY_COLLISION', `snapshot contains conflicting authority identity ${key}`);
        }
        continue;
      }
      stagedRecords.set(key, record);
    }

    const resolveStaged = (refInput) => {
      const ref = assertAuthorityRef(refInput);
      const record = stagedRecords.get(authorityRefKey(ref));
      if (!record) {
        throw new AuthorityLedgerError('SNAPSHOT_AUTHORITY_NOT_FOUND', `snapshot reference ${ref.kind}/${ref.logicalId}@${ref.version} is not present`);
      }
      if (!sameAuthorityRef(record.ref, ref)) {
        throw new AuthorityLedgerError('SNAPSHOT_AUTHORITY_HASH_MISMATCH', `snapshot reference ${ref.kind}/${ref.logicalId}@${ref.version} hash differs from restored record`);
      }
      return record;
    };

    const stagedLineage = new Map();
    for (const input of snapshot.lineage) {
      const record = validateRestoredLineage(input, resolveStaged);
      const existing = stagedLineage.get(record.lineageHash);
      if (existing && (!sameAuthorityRef(existing.from, record.from) || !sameAuthorityRef(existing.to, record.to) || existing.relation !== record.relation)) {
        throw new AuthorityLedgerError('SNAPSHOT_LINEAGE_COLLISION', `snapshot lineage ${record.lineageHash} collides`);
      }
      stagedLineage.set(record.lineageHash, record);
    }

    const stagedAudit = snapshot.audit.map(validateRestoredAuditEvent);
    for (const event of stagedAudit) {
      resolveStaged(event.objectRef);
    }

    this.#records = stagedRecords;
    this.#lineage = stagedLineage;
    this.#audit = stagedAudit;
    return this;
  }

  publish({ kind, logicalId, version, semanticPayload, operationalMetadata = {}, audit }) {
    const prepared = preparePublication({ kind, logicalId, version, semanticPayload, operationalMetadata, audit });
    const key = authorityRefKey(prepared.ref);
    const existing = this.#records.get(key);
    if (existing) {
      if (existing.ref.semanticHash !== prepared.ref.semanticHash) {
        throw new AuthorityLedgerError('SEMANTIC_MUTATION_FORBIDDEN', `published authority ${prepared.ref.kind}/${prepared.ref.logicalId}@${prepared.ref.version} already exists with different semantics`);
      }
      return existing;
    }
    this.#records.set(key, prepared.record);
    this.#audit.push(prepared.event);
    return prepared.record;
  }

  publishBatch(entries) {
    if (!Array.isArray(entries) || entries.length === 0) throw new AuthorityLedgerError('INVALID_AUTHORITY_BATCH', 'publishBatch requires a non-empty array');
    const stagedByKey = new Map();
    const resultRecords = [];
    for (const entry of entries) {
      const prepared = preparePublication(entry);
      const key = authorityRefKey(prepared.ref);
      const existing = this.#records.get(key);
      const staged = stagedByKey.get(key);
      if (existing) {
        if (existing.ref.semanticHash !== prepared.ref.semanticHash) throw new AuthorityLedgerError('SEMANTIC_MUTATION_FORBIDDEN', `published authority ${prepared.ref.kind}/${prepared.ref.logicalId}@${prepared.ref.version} already exists with different semantics`);
        resultRecords.push(existing);
        continue;
      }
      if (staged) {
        if (staged.ref.semanticHash !== prepared.ref.semanticHash) throw new AuthorityLedgerError('SEMANTIC_MUTATION_FORBIDDEN', `authority batch contains conflicting semantics for ${prepared.ref.kind}/${prepared.ref.logicalId}@${prepared.ref.version}`);
        resultRecords.push(staged.record);
        continue;
      }
      stagedByKey.set(key, prepared);
      resultRecords.push(prepared.record);
    }
    for (const [key, prepared] of stagedByKey.entries()) {
      this.#records.set(key, prepared.record);
      this.#audit.push(prepared.event);
    }
    return deepFreeze(resultRecords);
  }

  publishBatchWithLineage({ entries, lineages }) {
    if (!Array.isArray(entries) || entries.length === 0) throw new AuthorityLedgerError('INVALID_AUTHORITY_BATCH', 'publishBatchWithLineage requires a non-empty entries array');
    if (!Array.isArray(lineages)) throw new AuthorityLedgerError('INVALID_LINEAGE_BATCH', 'publishBatchWithLineage lineages must be an array');
    const stagedByKey = new Map();
    const resultRecords = [];
    for (const entry of entries) {
      const prepared = preparePublication(entry);
      const key = authorityRefKey(prepared.ref);
      const existing = this.#records.get(key);
      const staged = stagedByKey.get(key);
      if (existing) {
        if (existing.ref.semanticHash !== prepared.ref.semanticHash) throw new AuthorityLedgerError('SEMANTIC_MUTATION_FORBIDDEN', `published authority ${prepared.ref.kind}/${prepared.ref.logicalId}@${prepared.ref.version} already exists with different semantics`);
        resultRecords.push(existing);
        continue;
      }
      if (staged) {
        if (staged.ref.semanticHash !== prepared.ref.semanticHash) throw new AuthorityLedgerError('SEMANTIC_MUTATION_FORBIDDEN', `authority batch contains conflicting semantics for ${prepared.ref.kind}/${prepared.ref.logicalId}@${prepared.ref.version}`);
        resultRecords.push(staged.record);
        continue;
      }
      stagedByKey.set(key, prepared);
      resultRecords.push(prepared.record);
    }
    const resolveStagedOrExisting = (ref) => {
      const normalized = assertAuthorityRef(ref);
      const key = authorityRefKey(normalized);
      const staged = stagedByKey.get(key);
      if (staged) {
        if (staged.ref.semanticHash !== normalized.semanticHash) throw new AuthorityLedgerError('AUTHORITY_HASH_MISMATCH', `staged authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} semantic hash does not match`);
        return staged.record;
      }
      const existing = this.#records.get(key);
      if (!existing) throw new AuthorityLedgerError('AUTHORITY_NOT_FOUND', `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} not found during lineage preflight`);
      if (existing.ref.semanticHash !== normalized.semanticHash) throw new AuthorityLedgerError('AUTHORITY_HASH_MISMATCH', `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} exists but semantic hash does not match`);
      return existing;
    };
    const stagedLineage = new Map();
    for (const lineage of lineages) {
      const prepared = prepareLineage(lineage, resolveStagedOrExisting);
      const key = lineageKey(prepared.record);
      const existing = this.#lineage.get(key);
      const staged = stagedLineage.get(key);
      if (existing) {
        if (!sameAuthorityRef(existing.from, prepared.record.from) || !sameAuthorityRef(existing.to, prepared.record.to) || existing.relation !== prepared.record.relation) {
          throw new AuthorityLedgerError('LINEAGE_COLLISION', `lineage ${key} exists with different semantics`);
        }
        continue;
      }
      if (staged) continue;
      stagedLineage.set(key, prepared);
    }
    for (const [key, prepared] of stagedByKey.entries()) {
      this.#records.set(key, prepared.record);
      this.#audit.push(prepared.event);
    }
    for (const [key, prepared] of stagedLineage.entries()) {
      this.#lineage.set(key, prepared.record);
      this.#audit.push(prepared.event);
    }
    return deepFreeze({ records: resultRecords, lineage: [...stagedLineage.values()].map((prepared) => prepared.record) });
  }

  resolve(ref) {
    const normalized = assertAuthorityRef(ref);
    const key = authorityRefKey(normalized);
    const record = this.#records.get(key);
    if (!record) throw new AuthorityLedgerError('AUTHORITY_NOT_FOUND', `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} not found`);
    if (record.ref.semanticHash !== normalized.semanticHash) throw new AuthorityLedgerError('AUTHORITY_HASH_MISMATCH', `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} exists but semantic hash does not match`);
    return record;
  }

  has(ref) {
    try { this.resolve(ref); return true; }
    catch (error) {
      if (error instanceof AuthorityLedgerError && (error.code === 'AUTHORITY_NOT_FOUND' || error.code === 'AUTHORITY_HASH_MISMATCH')) return false;
      throw error;
    }
  }

  listVersions(kind, logicalId) {
    const normalizedKind = requiredText(kind, 'kind');
    const normalizedLogicalId = requiredText(logicalId, 'logicalId');
    return deepFreeze([...this.#records.values()].filter((record) => record.ref.kind === normalizedKind && record.ref.logicalId === normalizedLogicalId).map((record) => record.ref));
  }

  addLineage({ relation, from, to, audit, details = {} }) {
    const prepared = prepareLineage({ relation, from, to, audit, details }, (ref) => this.resolve(ref));
    const existing = this.#lineage.get(lineageKey(prepared.record));
    if (existing) return existing;
    this.#lineage.set(lineageKey(prepared.record), prepared.record);
    this.#audit.push(prepared.event);
    return prepared.record;
  }

  lineageFor(ref) {
    const normalized = assertAuthorityRef(ref);
    this.resolve(normalized);
    return deepFreeze([...this.#lineage.values()].filter((record) => sameAuthorityRef(record.from, normalized) || sameAuthorityRef(record.to, normalized)));
  }

  auditFor(ref) {
    const normalized = assertAuthorityRef(ref);
    this.resolve(normalized);
    return deepFreeze(this.#audit.filter((event) => sameAuthorityRef(event.objectRef, normalized) || event.inputRefs.some((inputRef) => sameAuthorityRef(inputRef, normalized))));
  }

  exportSnapshot() {
    return freezeCanonical({ records: [...this.#records.values()], lineage: [...this.#lineage.values()], audit: this.#audit });
  }
}
