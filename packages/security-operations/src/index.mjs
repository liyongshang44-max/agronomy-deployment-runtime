import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, authorityRefKey, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeAuditExport,
  authorizeRetentionManage,
  authorizeSecretManage,
  authorizeSecretUse,
  createPrincipal
} from '../../authorization/src/index.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';

export const SECURITY_OPERATIONS_NON_AUTHORITY = 'NONE_SECURITY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY';
export const SECURITY_EVENT_CONTRACT_VERSION = 'adr.security-event.v1';
export const RETENTION_DIRECTIVE_CONTRACT_VERSION = 'adr.artifact-retention-directive.v1';
export const AUDIT_EXPORT_CONTRACT_VERSION = 'adr.audit-export.v1';
export const SECRET_METADATA_CONTRACT_VERSION = 'adr.secret-metadata.v1';

const SECRET_BYTES = new WeakMap();
const ARTIFACT_BYTES = new WeakMap();

export class SecurityOperationsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecurityOperationsError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SecurityOperationsError('INVALID_SECURITY_OPERATIONS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, name) {
  if (value === undefined || value === null) return null;
  return requiredText(value, name);
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new SecurityOperationsError('INVALID_SECURITY_OPERATIONS_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function normalizeScope({ organizationId, tenantId = null }) {
  return deepFreeze({
    organizationId: requiredText(organizationId, 'organizationId'),
    ...(tenantId ? { tenantId: requiredText(tenantId, 'tenantId') } : {})
  });
}

function sameScope(left, right) {
  return left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function exactRefKey(ref) {
  const normalized = assertAuthorityRef(ref);
  return authorityRefKey(normalized);
}

function canonicalRefs(refs, name, { allowEmpty = true } = {}) {
  if (!Array.isArray(refs) || (!allowEmpty && refs.length === 0)) {
    throw new SecurityOperationsError('INVALID_AUTHORITY_REFS', `${name} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`);
  }
  const unique = new Map();
  for (const ref of refs) {
    const normalized = assertAuthorityRef(ref);
    unique.set(exactRefKey(normalized), normalized);
  }
  return deepFreeze([...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

function bufferValue(value, name) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new SecurityOperationsError('INVALID_SECRET_VALUE', `${name} must be a string, Buffer or Uint8Array`);
}

function artifactStorageKey(scopeInput, contentHash) {
  const scope = normalizeScope(scopeInput);
  const normalizedHash = requiredText(contentHash, 'contentHash');
  return semanticHash('PilotArtifactStorageKey', { scope, contentHash: normalizedHash });
}

function resolveKind(ledger, ref, kind, code) {
  const normalized = assertAuthorityRef(ref);
  const record = ledger.resolve(normalized);
  if (record.ref.kind !== kind) throw new SecurityOperationsError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function validateStoredAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  expectedOperation,
  recompute
}) {
  const record = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'SECURITY_AUTHORIZATION_REQUIRED'
  );
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new SecurityOperationsError('SECURITY_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new SecurityOperationsError('SECURITY_AUTHORIZATION_HASH_MISMATCH', 'stored authorization decision hash is not reproducible');
  }
  const normalizedPrincipal = createPrincipal(principal);
  if (stored.operation !== expectedOperation || stored.allowed !== true
    || stored.principal.principalId !== normalizedPrincipal.principalId
    || stored.principal.type !== normalizedPrincipal.type
    || stored.principal.organizationId !== normalizedPrincipal.organizationId
    || (stored.principal.tenantId ?? null) !== (normalizedPrincipal.tenantId ?? null)) {
    throw new SecurityOperationsError('SECURITY_AUTHORIZATION_MISMATCH', 'stored authorization does not bind exact operation/principal');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new SecurityOperationsError('SECURITY_ROLE_ASSIGNMENT_REQUIRED', 'security operation requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'SECURITY_ROLE_ASSIGNMENT_REQUIRED'));
  const replayed = recompute(assignments);
  if (!replayed.allowed || replayed.decisionHash !== stored.decisionHash) {
    throw new SecurityOperationsError('SECURITY_AUTHORIZATION_REPLAY_MISMATCH', 'security authorization cannot be replayed from exact RoleAssignments');
  }
  const directAudit = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!directAudit.some((event) => event.action === `AUTHORIZATION_${expectedOperation}_ALLOW`
    && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)))) {
    throw new SecurityOperationsError('SECURITY_AUTHORIZATION_AUDIT_INVALID', 'authorization decision lacks direct assignment audit closure');
  }
  return record;
}

function sourceArtifactWorld(ledger, artifactRef) {
  const artifact = resolveKind(ledger, artifactRef, 'SourceArtifact', 'SOURCE_ARTIFACT_REQUIRED');
  const source = resolveKind(ledger, artifact.semanticPayload.sourceRef, 'Source', 'SOURCE_ARTIFACT_SOURCE_REQUIRED');
  const ownership = source.semanticPayload.ownership;
  const scope = normalizeScope({ organizationId: ownership.organizationId, tenantId: ownership.tenantId ?? null });
  const rightsSnapshot = cloneCanonicalValue(artifact.semanticPayload.rightsSnapshot ?? null);
  return deepFreeze({
    artifact,
    source,
    scope,
    rightsSnapshotHash: semanticHash('SourceArtifactRightsSnapshot', rightsSnapshot)
  });
}

export class SecurityEventJournal {
  #events = [];

  record({ occurredAt, principal, eventType, resourceType, resourceId, outcome, reasonCode, authorizationDecisionAuditRef = null }) {
    const normalizedPrincipal = createPrincipal(principal);
    const payload = {
      contractVersion: SECURITY_EVENT_CONTRACT_VERSION,
      occurredAt: normalizeTimestamp(occurredAt, 'occurredAt'),
      scope: normalizeScope(normalizedPrincipal),
      actor: {
        principalId: normalizedPrincipal.principalId,
        type: normalizedPrincipal.type
      },
      eventType: requiredText(eventType, 'eventType'),
      resourceType: requiredText(resourceType, 'resourceType'),
      resourceId: requiredText(resourceId, 'resourceId'),
      outcome: requiredText(outcome, 'outcome'),
      reasonCode: requiredText(reasonCode, 'reasonCode'),
      ...(authorizationDecisionAuditRef
        ? { authorizationDecisionAuditRef: assertAuthorityRef(authorizationDecisionAuditRef) }
        : {}),
      authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
    };
    const event = deepFreeze({
      ...payload,
      eventHash: semanticHash('SecurityEvent', payload)
    });
    this.#events.push(event);
    return event;
  }

  list({ organizationId, tenantId = null }) {
    const scope = normalizeScope({ organizationId, tenantId });
    return deepFreeze(this.#events.filter((event) => sameScope(event.scope, scope)).map((event) => event));
  }
}

export class PilotSecretVault {
  #ledger;
  #events;
  #metadata = new Map();

  constructor({ ledger, securityEvents = new SecurityEventJournal() }) {
    if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
      throw new SecurityOperationsError('INVALID_LEDGER', 'PilotSecretVault requires AuthorityLedger resolve/auditFor');
    }
    this.#ledger = ledger;
    this.#events = securityEvents;
    SECRET_BYTES.set(this, new Map());
  }

  #secretKey(scope, secretId) {
    return semanticHash('PilotSecretLogicalScope', { scope, secretId });
  }

  #authorize({ operation, scope, secretId, principal, authorizationDecisionAuditRef }) {
    const authorizationScope = {
      ...scope,
      resourceId: secretId
    };
    const authorizer = operation === 'SECRET_MANAGE' ? authorizeSecretManage : authorizeSecretUse;
    return validateStoredAuthorization({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      principal,
      expectedOperation: operation,
      recompute: (assignments) => authorizer({
        principal,
        roleAssignments: assignments,
        authorizationScope
      })
    });
  }

  #deny({ occurredAt, principal, eventType, secretId, error, authorizationDecisionAuditRef = null }) {
    this.#events.record({
      occurredAt,
      principal,
      eventType,
      resourceType: 'SECRET',
      resourceId: secretId,
      outcome: 'DENY',
      reasonCode: error instanceof SecurityOperationsError ? error.code : 'SECRET_OPERATION_DENIED',
      authorizationDecisionAuditRef
    });
  }

  put({ organizationId, tenantId = null, secretId, value, principal, authorizationDecisionAuditRef, occurredAt }) {
    const scope = normalizeScope({ organizationId, tenantId });
    const id = requiredText(secretId, 'secretId');
    let authorization;
    try {
      authorization = this.#authorize({
        operation: 'SECRET_MANAGE', scope, secretId: id, principal, authorizationDecisionAuditRef
      });
    } catch (error) {
      this.#deny({
        occurredAt,
        principal,
        eventType: 'SECRET_STORE',
        secretId: id,
        error
      });
      throw error;
    }
    const key = this.#secretKey(scope, id);
    const previous = this.#metadata.get(key);
    const revision = (previous?.revision ?? 0) + 1;
    const metadataBasis = {
      contractVersion: SECRET_METADATA_CONTRACT_VERSION,
      scope,
      secretId: id,
      revision,
      secretHandle: semanticHash('PilotSecretHandle', { scope, secretId: id, revision }),
      authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
    };
    const metadata = deepFreeze({
      ...metadataBasis,
      metadataHash: semanticHash('PilotSecretMetadata', metadataBasis)
    });
    SECRET_BYTES.get(this).set(key, bufferValue(value, 'value'));
    this.#metadata.set(key, metadata);
    this.#events.record({
      occurredAt,
      principal,
      eventType: previous ? 'SECRET_ROTATED' : 'SECRET_STORED',
      resourceType: 'SECRET',
      resourceId: id,
      outcome: 'ALLOW',
      reasonCode: previous ? 'AUTHORIZED_ROTATION' : 'AUTHORIZED_STORAGE',
      authorizationDecisionAuditRef: authorization.ref
    });
    return metadata;
  }

  read({ organizationId, tenantId = null, secretId, principal, authorizationDecisionAuditRef, occurredAt }) {
    const scope = normalizeScope({ organizationId, tenantId });
    const id = requiredText(secretId, 'secretId');
    let authorization;
    try {
      authorization = this.#authorize({
        operation: 'SECRET_USE', scope, secretId: id, principal, authorizationDecisionAuditRef
      });
    } catch (error) {
      this.#deny({
        occurredAt,
        principal,
        eventType: 'SECRET_READ',
        secretId: id,
        error
      });
      throw error;
    }
    const key = this.#secretKey(scope, id);
    const bytes = SECRET_BYTES.get(this).get(key);
    if (!bytes) {
      const error = new SecurityOperationsError('SECRET_NOT_FOUND', 'secret does not exist in the authorized scope');
      this.#deny({
        occurredAt,
        principal,
        eventType: 'SECRET_READ',
        secretId: id,
        error,
        authorizationDecisionAuditRef: authorization.ref
      });
      throw error;
    }
    this.#events.record({
      occurredAt,
      principal,
      eventType: 'SECRET_READ',
      resourceType: 'SECRET',
      resourceId: id,
      outcome: 'ALLOW',
      reasonCode: 'AUTHORIZED_SECRET_USE',
      authorizationDecisionAuditRef: authorization.ref
    });
    return Buffer.from(bytes);
  }

  metadataSnapshot({ organizationId, tenantId = null }) {
    const scope = normalizeScope({ organizationId, tenantId });
    return deepFreeze(
      [...this.#metadata.values()]
        .filter((metadata) => sameScope(metadata.scope, scope))
        .sort((a, b) => a.secretId.localeCompare(b.secretId))
        .map((metadata) => metadata)
    );
  }
}

export class PilotSecureArtifactStore {
  constructor() {
    ARTIFACT_BYTES.set(this, new Map());
  }

  putForScope(scopeInput, bytes) {
    const scope = normalizeScope(scopeInput);
    const normalized = bufferValue(bytes, 'bytes');
    const contentHash = sourceContentHash(normalized);
    const key = artifactStorageKey(scope, contentHash);
    const objects = ARTIFACT_BYTES.get(this);
    if (!objects.has(key)) objects.set(key, Buffer.from(normalized));
    return deepFreeze({
      storeKind: 'PILOT_GOVERNED_TENANT_SCOPED_CONTENT_ADDRESSABLE_REFERENCE',
      retentionId: semanticHash('PilotArtifactRetentionId', { scope, contentHash }),
      contentHash,
      byteLength: normalized.byteLength
    });
  }

  hasForScope(scopeInput, contentHash) {
    return ARTIFACT_BYTES.get(this).has(artifactStorageKey(scopeInput, contentHash));
  }

  getForScope(scopeInput, contentHash) {
    const scope = normalizeScope(scopeInput);
    const normalizedHash = requiredText(contentHash, 'contentHash');
    const bytes = ARTIFACT_BYTES.get(this).get(artifactStorageKey(scope, normalizedHash));
    if (!bytes) {
      throw new SecurityOperationsError(
        'ARTIFACT_CONTENT_NOT_RETAINED',
        `artifact ${normalizedHash} is not retained in the requested tenant scope`
      );
    }
    return Buffer.from(bytes);
  }

  count() {
    return ARTIFACT_BYTES.get(this).size;
  }
}

function privilegedArtifactDelete(store, scope, contentHash) {
  const objects = ARTIFACT_BYTES.get(store);
  if (!objects) throw new SecurityOperationsError('INVALID_SECURE_ARTIFACT_STORE', 'retention controller requires PilotSecureArtifactStore');
  return objects.delete(artifactStorageKey(scope, contentHash));
}

export class ArtifactRetentionController {
  #ledger;
  #store;
  #events;
  #directives = new Map();
  #directiveHistory = new Map();
  #status = new Map();

  constructor({ ledger, artifactStore, securityEvents = new SecurityEventJournal() }) {
    if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
      throw new SecurityOperationsError('INVALID_LEDGER', 'ArtifactRetentionController requires AuthorityLedger resolve/auditFor');
    }
    if (!(artifactStore instanceof PilotSecureArtifactStore)) {
      throw new SecurityOperationsError('INVALID_SECURE_ARTIFACT_STORE', 'pilot retention requires PilotSecureArtifactStore');
    }
    this.#ledger = ledger;
    this.#store = artifactStore;
    this.#events = securityEvents;
  }

  #authorize({ artifactRef, scope, principal, authorizationDecisionAuditRef }) {
    return validateStoredAuthorization({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      principal,
      expectedOperation: 'RETENTION_MANAGE',
      recompute: (assignments) => authorizeRetentionManage({
        principal,
        roleAssignments: assignments,
        authorizationScope: {
          ...scope,
          resourceId: artifactRef.logicalId
        },
        artifactRef
      })
    });
  }

  setDirective({
    artifactRef,
    organizationId,
    tenantId = null,
    retentionMode,
    retainUntil = null,
    legalHold = false,
    auditExportAllowed = false,
    preserveExactReplay = true,
    principal,
    authorizationDecisionAuditRef,
    occurredAt
  }) {
    const world = sourceArtifactWorld(this.#ledger, artifactRef);
    const scope = normalizeScope({ organizationId, tenantId });
    if (!sameScope(world.scope, scope)) {
      throw new SecurityOperationsError('RETENTION_SCOPE_MISMATCH', 'retention scope must match exact Source ownership');
    }
    const mode = requiredText(retentionMode, 'retentionMode');
    if (!['RETAIN', 'DELETE_AFTER'].includes(mode)) {
      throw new SecurityOperationsError('INVALID_RETENTION_MODE', `unsupported retention mode ${mode}`);
    }
    const normalizedRetainUntil = retainUntil ? normalizeTimestamp(retainUntil, 'retainUntil') : null;
    if (mode === 'DELETE_AFTER' && !normalizedRetainUntil) {
      throw new SecurityOperationsError('RETAIN_UNTIL_REQUIRED', 'DELETE_AFTER requires retainUntil');
    }
    if (mode === 'RETAIN' && normalizedRetainUntil) {
      throw new SecurityOperationsError('RETAIN_UNTIL_FORBIDDEN', 'RETAIN cannot carry retainUntil');
    }
    const authorization = this.#authorize({
      artifactRef: world.artifact.ref,
      scope,
      principal,
      authorizationDecisionAuditRef
    });
    const basis = {
      contractVersion: RETENTION_DIRECTIVE_CONTRACT_VERSION,
      scope,
      artifactRef: world.artifact.ref,
      contentHash: world.artifact.semanticPayload.contentHash,
      rightsSnapshotHash: world.rightsSnapshotHash,
      retentionMode: mode,
      retainUntil: normalizedRetainUntil,
      legalHold: Boolean(legalHold),
      auditExportAllowed: Boolean(auditExportAllowed),
      preserveExactReplay: Boolean(preserveExactReplay),
      crossTenantTraining: 'DENIED_NO_P07_OVERRIDE',
      authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
    };
    const directive = deepFreeze({
      ...basis,
      directiveHash: semanticHash('ArtifactRetentionDirective', basis)
    });
    const artifactKey = exactRefKey(world.artifact.ref);
    this.#directives.set(artifactKey, directive);
    const history = this.#directiveHistory.get(artifactKey) ?? [];
    history.push(directive);
    this.#directiveHistory.set(artifactKey, history);
    if (!this.#status.has(artifactKey)) {
      this.#status.set(artifactKey, 'EXACT_MATERIAL_AVAILABLE');
    }
    this.#events.record({
      occurredAt,
      principal,
      eventType: 'RETENTION_DIRECTIVE_SET',
      resourceType: 'SOURCE_ARTIFACT',
      resourceId: world.artifact.ref.logicalId,
      outcome: 'ALLOW',
      reasonCode: 'AUTHORIZED_RETENTION_CONTROL',
      authorizationDecisionAuditRef: authorization.ref
    });
    return directive;
  }

  directiveFor(artifactRef) {
    const normalized = assertAuthorityRef(artifactRef);
    const directive = this.#directives.get(exactRefKey(normalized));
    if (!directive) throw new SecurityOperationsError('RETENTION_DIRECTIVE_REQUIRED', 'exact SourceArtifact lacks pilot retention directive');
    return directive;
  }

  directiveHistoryFor(artifactRef) {
    const normalized = assertAuthorityRef(artifactRef);
    const history = this.#directiveHistory.get(exactRefKey(normalized)) ?? [];
    return deepFreeze([...history]);
  }

  statusFor(artifactRef) {
    const normalized = assertAuthorityRef(artifactRef);
    const directive = this.directiveFor(normalized);
    const available = this.#store.hasForScope(directive.scope, directive.contentHash);
    const observed = available ? 'EXACT_MATERIAL_AVAILABLE' : 'EXACT_MATERIAL_UNAVAILABLE';
    this.#status.set(exactRefKey(normalized), observed);
    return deepFreeze({
      artifactRef: normalized,
      availability: observed,
      declaredAuthorityReplaySemanticsMutated: false,
      authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
    });
  }

  deleteArtifact({ artifactRef, principal, authorizationDecisionAuditRef, occurredAt }) {
    const world = sourceArtifactWorld(this.#ledger, artifactRef);
    const directive = this.directiveFor(world.artifact.ref);
    const authorization = this.#authorize({
      artifactRef: world.artifact.ref,
      scope: world.scope,
      principal,
      authorizationDecisionAuditRef
    });
    const at = normalizeTimestamp(occurredAt, 'occurredAt');
    const deny = (code) => {
      this.#events.record({
        occurredAt: at,
        principal,
        eventType: 'ARTIFACT_DELETE',
        resourceType: 'SOURCE_ARTIFACT',
        resourceId: world.artifact.ref.logicalId,
        outcome: 'DENY',
        reasonCode: code,
        authorizationDecisionAuditRef: authorization.ref
      });
      throw new SecurityOperationsError(code, `artifact deletion denied: ${code}`);
    };
    if (directive.rightsSnapshotHash !== world.rightsSnapshotHash) deny('RIGHTS_BASIS_MISMATCH');
    if (directive.legalHold) deny('LEGAL_HOLD_ACTIVE');
    if (directive.preserveExactReplay) deny('EXACT_REPLAY_PROTECTED');
    if (directive.retentionMode !== 'DELETE_AFTER') deny('RETENTION_REQUIRES_PRESERVATION');
    if (at < directive.retainUntil) deny('RETENTION_WINDOW_ACTIVE');
    privilegedArtifactDelete(this.#store, world.scope, directive.contentHash);
    this.#status.set(exactRefKey(world.artifact.ref), 'EXACT_MATERIAL_UNAVAILABLE');
    this.#events.record({
      occurredAt: at,
      principal,
      eventType: 'ARTIFACT_DELETE',
      resourceType: 'SOURCE_ARTIFACT',
      resourceId: world.artifact.ref.logicalId,
      outcome: 'ALLOW',
      reasonCode: 'AUTHORIZED_RETENTION_EXPIRY',
      authorizationDecisionAuditRef: authorization.ref
    });
    return this.statusFor(world.artifact.ref);
  }

  assertAuditExportAllowed(artifactRef) {
    const world = sourceArtifactWorld(this.#ledger, artifactRef);
    const directive = this.directiveFor(world.artifact.ref);
    if (directive.rightsSnapshotHash !== world.rightsSnapshotHash) {
      throw new SecurityOperationsError('RIGHTS_BASIS_MISMATCH', 'retention directive no longer binds exact rights snapshot');
    }
    if (!directive.auditExportAllowed) {
      throw new SecurityOperationsError('ARTIFACT_AUDIT_EXPORT_DENIED', 'artifact rights/retention directive denies audit export');
    }
    return directive;
  }

  trainingUseDecision({ artifactRef, targetOrganizationId, targetTenantId = null }) {
    const world = sourceArtifactWorld(this.#ledger, artifactRef);
    const target = normalizeScope({ organizationId: targetOrganizationId, tenantId: targetTenantId });
    if (!sameScope(world.scope, target)) {
      return deepFreeze({
        allowed: false,
        reason: 'CROSS_TENANT_TRAINING_DENIED_BY_DEFAULT',
        authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
      });
    }
    return deepFreeze({
      allowed: false,
      reason: 'TRAINING_NOT_AUTHORIZED_BY_P07',
      authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
    });
  }
}

function directScopeCandidates(record) {
  const p = record.semanticPayload ?? {};
  const values = [
    p.ownership,
    p.targetRef,
    p.targetScope,
    p.principal,
    p.scope,
    p.request?.authorizationScope,
    p.deploymentTarget,
    p.organizationId ? { organizationId: p.organizationId, tenantId: p.tenantId } : null
  ].filter((value) => value?.organizationId);
  const unique = new Map();
  for (const value of values) {
    const scope = normalizeScope({ organizationId: value.organizationId, tenantId: value.tenantId ?? null });
    unique.set(JSON.stringify(scope), scope);
  }
  return [...unique.values()];
}

function auditEventsForObject(snapshot, ref) {
  return snapshot.audit.filter((event) => sameAuthorityRef(event.objectRef, ref));
}

function recordMap(snapshot) {
  return new Map(snapshot.records.map((record) => [exactRefKey(record.ref), record]));
}

function deriveRecordScope({ ref, records, snapshot, memo = new Map(), stack = new Set() }) {
  const key = exactRefKey(ref);
  if (memo.has(key)) return memo.get(key);
  if (stack.has(key)) throw new SecurityOperationsError('AUDIT_SCOPE_CYCLE', 'scope derivation encountered an authority cycle');
  stack.add(key);
  const record = records.get(key);
  if (!record) throw new SecurityOperationsError('AUDIT_EXPORT_AUTHORITY_NOT_FOUND', `authority ${key} missing from ledger snapshot`);
  const direct = directScopeCandidates(record);
  if (direct.length > 1) throw new SecurityOperationsError('AUDIT_SCOPE_AMBIGUOUS', `authority ${key} carries conflicting direct scopes`);
  if (direct.length === 1) {
    memo.set(key, direct[0]);
    stack.delete(key);
    return direct[0];
  }
  const discovered = new Map();
  for (const event of auditEventsForObject(snapshot, record.ref)) {
    for (const inputRef of event.inputRefs) {
      const inputKey = exactRefKey(inputRef);
      if (!records.has(inputKey)) {
        stack.delete(key);
        throw new SecurityOperationsError(
          'AUDIT_EXPORT_INPUT_AUTHORITY_MISSING',
          `authority ${key} audit references missing exact input ${inputKey}`
        );
      }
      try {
        const scope = deriveRecordScope({ ref: inputRef, records, snapshot, memo, stack });
        discovered.set(JSON.stringify(scope), scope);
      } catch (error) {
        if (!(error instanceof SecurityOperationsError)
          || !['AUDIT_SCOPE_UNPROVEN', 'AUDIT_SCOPE_AMBIGUOUS'].includes(error.code)) throw error;
      }
    }
  }
  stack.delete(key);
  if (discovered.size === 0) throw new SecurityOperationsError('AUDIT_SCOPE_UNPROVEN', `authority ${key} scope cannot be proven`);
  if (discovered.size > 1) throw new SecurityOperationsError('AUDIT_SCOPE_AMBIGUOUS', `authority ${key} depends on multiple tenant scopes`);
  const scope = [...discovered.values()][0];
  memo.set(key, scope);
  return scope;
}

function sanitizedAuditEvent(event) {
  const exported = {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actor: event.actor,
    action: event.action,
    objectRef: event.objectRef,
    inputRefs: canonicalRefs(event.inputRefs, 'audit.inputRefs'),
    detailsHash: semanticHash('AuditEventDetails', event.details ?? {}),
    eventHash: event.eventHash
  };
  return deepFreeze(exported);
}

function sanitizedLineage(record) {
  return deepFreeze({
    relation: record.relation,
    from: record.from,
    to: record.to,
    detailsHash: semanticHash('AuthorityLineageDetails', record.details ?? {}),
    lineageHash: record.lineageHash
  });
}

export function createTenantAuditExport({
  ledger,
  rootRefs,
  organizationId,
  tenantId = null,
  principal,
  authorizationDecisionAuditRef,
  retentionController,
  occurredAt,
  securityEvents = new SecurityEventJournal()
}) {
  if (!ledger || typeof ledger.exportSnapshot !== 'function' || typeof ledger.resolve !== 'function') {
    throw new SecurityOperationsError('INVALID_LEDGER', 'audit export requires AuthorityLedger exportSnapshot/resolve');
  }
  const scope = normalizeScope({ organizationId, tenantId });
  const roots = canonicalRefs(rootRefs, 'rootRefs', { allowEmpty: false });
  const exportRequestId = semanticHash('PilotAuditExportRequest', { scope, rootRefs: roots });
  const authorizationScope = { ...scope, resourceId: exportRequestId };
  const authorization = validateStoredAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal,
    expectedOperation: 'AUDIT_EXPORT',
    recompute: (assignments) => authorizeAuditExport({
      principal,
      roleAssignments: assignments,
      authorizationScope,
      rootRefs: roots
    })
  });
  const deny = (code, message) => {
    securityEvents.record({
      occurredAt,
      principal,
      eventType: 'AUDIT_EXPORT',
      resourceType: 'AUDIT_EXPORT',
      resourceId: exportRequestId,
      outcome: 'DENY',
      reasonCode: code,
      authorizationDecisionAuditRef: authorization.ref
    });
    throw new SecurityOperationsError(code, message);
  };
  const snapshot = ledger.exportSnapshot();
  const records = recordMap(snapshot);
  const scopeMemo = new Map();
  const queue = [...roots];
  const included = new Map();
  const includedAudit = new Map();

  while (queue.length > 0) {
    const ref = queue.shift();
    const key = exactRefKey(ref);
    if (included.has(key)) continue;
    const record = records.get(key);
    if (!record) deny('AUDIT_EXPORT_AUTHORITY_NOT_FOUND', `authority ${key} missing from ledger`);
    let recordScope;
    try {
      recordScope = deriveRecordScope({ ref: record.ref, records, snapshot, memo: scopeMemo });
    } catch (error) {
      if (error instanceof SecurityOperationsError) deny(error.code, error.message);
      throw error;
    }
    if (!sameScope(recordScope, scope)) {
      deny('CROSS_TENANT_AUDIT_EXPORT_DENIED', 'audit dependency closure crosses requested tenant scope');
    }
    if (record.ref.kind === 'SourceArtifact') {
      if (!(retentionController instanceof ArtifactRetentionController)) {
        deny('RETENTION_CONTROLLER_REQUIRED', 'SourceArtifact audit export requires rights-aware retention controller');
      }
      try {
        retentionController.assertAuditExportAllowed(record.ref);
      } catch (error) {
        if (error instanceof SecurityOperationsError) deny(error.code, error.message);
        throw error;
      }
    }
    included.set(key, record);
    for (const event of auditEventsForObject(snapshot, record.ref)) {
      includedAudit.set(event.eventHash, event);
      for (const inputRef of event.inputRefs) {
        const inputKey = exactRefKey(inputRef);
        if (!records.has(inputKey)) {
          deny('AUDIT_EXPORT_INPUT_AUTHORITY_MISSING', `audit dependency ${inputKey} is missing from ledger`);
        }
        queue.push(inputRef);
      }
    }
  }

  const includedKeys = new Set(included.keys());
  const lineage = snapshot.lineage.filter((record) =>
    includedKeys.has(exactRefKey(record.from)) && includedKeys.has(exactRefKey(record.to)));
  const body = {
    contractVersion: AUDIT_EXPORT_CONTRACT_VERSION,
    scope,
    rootRefs: roots,
    authorityRefs: canonicalRefs([...included.values()].map((record) => record.ref), 'authorityRefs'),
    auditEvents: [...includedAudit.values()].sort((a, b) => a.eventHash.localeCompare(b.eventHash)).map(sanitizedAuditEvent),
    lineage: lineage.sort((a, b) => a.lineageHash.localeCompare(b.lineageHash)).map(sanitizedLineage),
    semanticPayloadIncluded: false,
    rawSourceArtifactBytesIncluded: false,
    authorityClaim: SECURITY_OPERATIONS_NON_AUTHORITY
  };
  const exported = deepFreeze({ ...body, exportHash: semanticHash('TenantAuditExport', body) });
  securityEvents.record({
    occurredAt,
    principal,
    eventType: 'AUDIT_EXPORT',
    resourceType: 'AUDIT_EXPORT',
    resourceId: exportRequestId,
    outcome: 'ALLOW',
    reasonCode: 'AUTHORIZED_TENANT_AUDIT_EXPORT',
    authorizationDecisionAuditRef: authorization.ref
  });
  return exported;
}
