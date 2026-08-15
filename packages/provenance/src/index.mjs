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

export class AuthorityLedger {
  #records = new Map();
  #lineage = new Map();
  #audit = [];

  publish({
    kind,
    logicalId,
    version,
    semanticPayload,
    operationalMetadata = {},
    audit
  }) {
    const normalizedKind = requiredText(kind, 'kind');
    const normalizedLogicalId = requiredText(logicalId, 'logicalId');
    const normalizedVersion = requiredText(version, 'version');
    const payload = freezeCanonical(semanticPayload);
    const metadata = freezeCanonical(operationalMetadata);
    const hash = semanticHash(normalizedKind, payload);
    const ref = makeAuthorityRef({
      kind: normalizedKind,
      logicalId: normalizedLogicalId,
      version: normalizedVersion,
      semanticHash: hash
    });
    const key = authorityRefKey(ref);
    const existing = this.#records.get(key);

    if (existing) {
      if (existing.ref.semanticHash !== ref.semanticHash) {
        throw new AuthorityLedgerError(
          'SEMANTIC_MUTATION_FORBIDDEN',
          `published authority ${normalizedKind}/${normalizedLogicalId}@${normalizedVersion} already exists with different semantics`
        );
      }
      return existing;
    }

    if (!audit) {
      throw new AuthorityLedgerError('AUDIT_REQUIRED', 'publishing authority requires explicit audit metadata');
    }

    const record = deepFreeze({
      ref,
      semanticPayload: payload,
      operationalMetadata: metadata
    });
    const event = createAuditEvent({
      ...audit,
      action: audit.action ?? 'PUBLISH_AUTHORITY',
      objectRef: ref,
      inputRefs: audit.inputRefs ?? []
    });

    this.#records.set(key, record);
    this.#audit.push(event);
    return record;
  }

  resolve(ref) {
    const normalized = assertAuthorityRef(ref);
    const key = authorityRefKey(normalized);
    const record = this.#records.get(key);
    if (!record) {
      throw new AuthorityLedgerError('AUTHORITY_NOT_FOUND', `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} not found`);
    }
    if (record.ref.semanticHash !== normalized.semanticHash) {
      throw new AuthorityLedgerError(
        'AUTHORITY_HASH_MISMATCH',
        `authority ${normalized.kind}/${normalized.logicalId}@${normalized.version} exists but semantic hash does not match`
      );
    }
    return record;
  }

  has(ref) {
    try {
      this.resolve(ref);
      return true;
    } catch (error) {
      if (error instanceof AuthorityLedgerError && (error.code === 'AUTHORITY_NOT_FOUND' || error.code === 'AUTHORITY_HASH_MISMATCH')) return false;
      throw error;
    }
  }

  listVersions(kind, logicalId) {
    const normalizedKind = requiredText(kind, 'kind');
    const normalizedLogicalId = requiredText(logicalId, 'logicalId');
    return deepFreeze(
      [...this.#records.values()]
        .filter((record) => record.ref.kind === normalizedKind && record.ref.logicalId === normalizedLogicalId)
        .map((record) => record.ref)
    );
  }

  addLineage({ relation, from, to, audit, details = {} }) {
    if (!LINEAGE_RELATION_SET.has(relation)) {
      throw new AuthorityLedgerError('INVALID_LINEAGE_RELATION', `unsupported lineage relation ${relation}`);
    }
    if (!audit) throw new AuthorityLedgerError('AUDIT_REQUIRED', 'lineage creation requires explicit audit metadata');

    const fromRecord = this.resolve(from);
    const toRecord = this.resolve(to);
    const semanticPayload = {
      relation,
      from: fromRecord.ref,
      to: toRecord.ref
    };
    const record = deepFreeze({
      ...semanticPayload,
      details: freezeCanonical(details),
      lineageHash: semanticHash('AuthorityLineage', semanticPayload)
    });

    const existing = this.#lineage.get(lineageKey(record));
    if (existing) return existing;

    this.#lineage.set(lineageKey(record), record);
    this.#audit.push(createAuditEvent({
      ...audit,
      action: audit.action ?? `LINEAGE_${relation.toUpperCase()}`,
      objectRef: fromRecord.ref,
      inputRefs: [toRecord.ref, ...(audit.inputRefs ?? [])],
      details: {
        relation,
        lineageHash: record.lineageHash,
        ...(audit.details ?? {})
      }
    }));
    return record;
  }

  lineageFor(ref) {
    const normalized = assertAuthorityRef(ref);
    this.resolve(normalized);
    return deepFreeze(
      [...this.#lineage.values()].filter(
        (record) => sameAuthorityRef(record.from, normalized) || sameAuthorityRef(record.to, normalized)
      )
    );
  }

  auditFor(ref) {
    const normalized = assertAuthorityRef(ref);
    this.resolve(normalized);
    return deepFreeze(
      this.#audit.filter(
        (event) => sameAuthorityRef(event.objectRef, normalized)
          || event.inputRefs.some((inputRef) => sameAuthorityRef(inputRef, normalized))
      )
    );
  }

  exportSnapshot() {
    return freezeCanonical({
      records: [...this.#records.values()],
      lineage: [...this.#lineage.values()],
      audit: this.#audit
    });
  }
}
