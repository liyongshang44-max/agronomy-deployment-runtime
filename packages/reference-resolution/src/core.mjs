import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { authorizeContextWrite } from '../../authorization/src/context-write.mjs';
import { validateContextDatumAuthority } from '../../context-contract/src/index.mjs';
import {
  ContextSnapshotError,
  ExactContextSnapshotStore,
  providerResponseContentHash
} from './retention.mjs';

export const AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION = 'adr.authorized-context-reference.v1';
export const CONTEXT_RECEIPT_CONTRACT_VERSION = 'adr.context-receipt.v1';
export const REPLAY_CLASSES = deepFreeze([
  'EXACT',
  'CONTENT_ADDRESSED_EXTERNAL',
  'PROVIDER_DEPENDENT',
  'NON_REPLAYABLE'
]);
export const REFERENCE_ADDRESSING_MODES = deepFreeze([
  'MUTABLE_LOCATOR',
  'VERSIONED_LOCATOR',
  'CONTENT_ADDRESSED'
]);
export const RETENTION_MODES = deepFreeze([
  'SNAPSHOT_RETAINED',
  'EXTERNAL_CONTENT_ADDRESS',
  'NOT_RETAINED'
]);

const ADDRESSING_SET = new Set(REFERENCE_ADDRESSING_MODES);
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const SECRET_KEY_RE = /^(?:token|access_?token|refresh_?token|api_?key|secret|password|credential|credentials|authorization|authorization_?header|bearer)$/i;
const SECRET_QUERY_RE = /^(?:token|access_token|refresh_token|api_key|apikey|key|secret|signature|sig|password)$/i;

export class ReferenceResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReferenceResolutionError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_FIELD', `${name}.${key} is not part of the frozen A03 contract`);
    }
  }
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const match = RFC3339_RE.exec(text);
  if (!match) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_TIME', `${name} must be strict RFC3339 with explicit timezone`);
  }
  const [, y, mo, d, h, mi, s, , zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_TIME', `${name} contains an impossible date/time`);
  }
  if (zone !== 'Z') {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) {
      throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_TIME', `${name} is not a valid timestamp`);
  }
  return parsed.toISOString();
}

function requireSha256(value, name) {
  const text = requiredText(value, name);
  if (!SHA256_RE.test(text)) {
    throw new ReferenceResolutionError('INVALID_CONTENT_HASH', `${name} must be lowercase sha256:<64 hex>`);
  }
  return text;
}

function assertNoSecretCarrier(value, path = 'authorizationContext') {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (/\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(value)) {
      throw new ReferenceResolutionError('SECRET_AUTH_MATERIAL_FORBIDDEN', `${path} must not contain bearer credentials`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretCarrier(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', `${path} must be semantic JSON`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) {
      throw new ReferenceResolutionError('SECRET_AUTH_MATERIAL_FORBIDDEN', `${path}.${key} is secret credential material and cannot enter ADR semantic identity`);
    }
    assertNoSecretCarrier(child, `${path}.${key}`);
  }
}

function assertLocatorNonSecret(locator) {
  const text = requiredText(locator, 'reference.locator');
  if (/\bBearer\s+/i.test(text) || /:\/\/[^/@\s]+:[^/@\s]+@/.test(text)) {
    throw new ReferenceResolutionError('SECRET_AUTH_MATERIAL_FORBIDDEN', 'reference.locator must not embed credentials');
  }
  const queryIndex = text.indexOf('?');
  if (queryIndex >= 0) {
    const query = text.slice(queryIndex + 1).split('#')[0];
    for (const pair of query.split('&')) {
      const [rawKey] = pair.split('=');
      let key = rawKey;
      try { key = decodeURIComponent(rawKey); } catch {}
      if (SECRET_QUERY_RE.test(key)) {
        throw new ReferenceResolutionError('SECRET_AUTH_MATERIAL_FORBIDDEN', `reference.locator query parameter ${key} looks credential-bearing`);
      }
    }
  }
  return text;
}

function normalizeTarget(target) {
  exactObject(target, 'target', new Set(['organizationId', 'tenantId']));
  return deepFreeze({
    organizationId: requiredText(target.organizationId, 'target.organizationId'),
    ...(target.tenantId ? { tenantId: requiredText(target.tenantId, 'target.tenantId') } : {})
  });
}

function samePrincipalIdentity(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function normalizeAuthorizationContext(value) {
  exactObject(value, 'authorizationContext', new Set(['connectionId', 'principalScope', 'authorizationHash']));
  const connectionId = requiredText(value.connectionId, 'authorizationContext.connectionId');
  if (!value.principalScope || typeof value.principalScope !== 'object' || Array.isArray(value.principalScope)) {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', 'authorizationContext.principalScope must be a non-secret object');
  }
  assertNoSecretCarrier(value.principalScope, 'authorizationContext.principalScope');
  const principalScope = cloneCanonicalValue(value.principalScope);
  const authorizationHash = semanticHash('ProviderAuthorizationContext', { connectionId, principalScope });
  if (value.authorizationHash !== undefined && requireSha256(value.authorizationHash, 'authorizationContext.authorizationHash') !== authorizationHash) {
    throw new ReferenceResolutionError(
      'AUTHORIZATION_CONTEXT_HASH_MISMATCH',
      'authorizationHash must be derived from non-secret connectionId + principalScope, never from a token'
    );
  }
  return deepFreeze({ connectionId, principalScope, authorizationHash });
}

function normalizeProviderReference(value) {
  exactObject(value, 'reference', new Set([
    'providerId', 'locator', 'addressingMode', 'versionToken', 'expectedContentHash'
  ]));
  const providerId = requiredText(value.providerId, 'reference.providerId');
  const locator = assertLocatorNonSecret(value.locator);
  const addressingMode = requiredText(value.addressingMode, 'reference.addressingMode');
  if (!ADDRESSING_SET.has(addressingMode)) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_ADDRESSING_MODE', `unsupported addressingMode ${addressingMode}`);
  }
  const versionToken = value.versionToken === undefined ? undefined : requiredText(value.versionToken, 'reference.versionToken');
  const expectedContentHash = value.expectedContentHash === undefined
    ? undefined
    : requireSha256(value.expectedContentHash, 'reference.expectedContentHash');
  if (addressingMode === 'VERSIONED_LOCATOR' && !versionToken) {
    throw new ReferenceResolutionError('REFERENCE_VERSION_TOKEN_REQUIRED', 'VERSIONED_LOCATOR requires versionToken');
  }
  if (addressingMode === 'CONTENT_ADDRESSED' && !expectedContentHash) {
    throw new ReferenceResolutionError('REFERENCE_CONTENT_HASH_REQUIRED', 'CONTENT_ADDRESSED requires expectedContentHash');
  }
  return deepFreeze({
    providerId,
    locator,
    addressingMode,
    ...(versionToken ? { versionToken } : {}),
    ...(expectedContentHash ? { expectedContentHash } : {})
  });
}

export function normalizeAuthorizedContextReference(input) {
  exactObject(input, 'authorizedContextReference', new Set([
    'contractVersion', 'semanticId', 'valueMode', 'reference', 'authorizationContext'
  ]));
  const contractVersion = requiredText(input.contractVersion, 'contractVersion');
  if (contractVersion !== AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION) {
    throw new ReferenceResolutionError('UNSUPPORTED_AUTHORIZED_REFERENCE_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  }
  const valueMode = requiredText(input.valueMode, 'valueMode');
  if (valueMode !== 'AUTHORIZED_REFERENCE') {
    throw new ReferenceResolutionError('INVALID_REFERENCE_VALUE_MODE', 'AuthorizedContextReference valueMode must be AUTHORIZED_REFERENCE');
  }
  return deepFreeze({
    contractVersion,
    semanticId: requiredText(input.semanticId, 'semanticId'),
    valueMode,
    reference: normalizeProviderReference(input.reference),
    authorizationContext: normalizeAuthorizationContext(input.authorizationContext)
  });
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function resolveKind(ledger, ref, kind, code) {
  const normalized = assertAuthorityRef(ref);
  const record = ledger.resolve(normalized);
  if (record.ref.kind !== kind) {
    throw new ReferenceResolutionError(code, `expected ${kind}, received ${record.ref.kind}`);
  }
  return record;
}

function writeScope(target, resourceType, logicalId) {
  return deepFreeze({
    organizationId: target.organizationId,
    ...(target.tenantId ? { tenantId: target.tenantId } : {}),
    resourceType,
    resourceId: requiredText(logicalId, 'logicalId')
  });
}

function validateWriteAuthorization({ ledger, authorizationDecisionAuditRef, principal, target, resourceType, logicalId }) {
  const record = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'CONTEXT_WRITE_AUTHORIZATION_REQUIRED'
  );
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new ReferenceResolutionError('CONTEXT_WRITE_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new ReferenceResolutionError('CONTEXT_WRITE_AUTHORIZATION_HASH_MISMATCH', 'stored context-write decisionHash is not reproducible');
  }
  const normalizedPrincipal = createPrincipal(principal);
  const expectedScope = writeScope(target, resourceType, logicalId);
  if (stored.operation !== 'CONTEXT_WRITE' || stored.allowed !== true || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, normalizedPrincipal)
    || semanticHash('ADR-A03-WRITE-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A03-WRITE-SCOPE', expectedScope)) {
    throw new ReferenceResolutionError('CONTEXT_WRITE_AUTHORIZATION_MISMATCH', 'stored authorization does not bind exact A03 resource scope');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new ReferenceResolutionError('CONTEXT_WRITE_ROLE_ASSIGNMENT_REQUIRED', 'A03 write requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'CONTEXT_WRITE_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeContextWrite({
    principal: normalizedPrincipal,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new ReferenceResolutionError('CONTEXT_WRITE_AUTHORIZATION_REPLAY_MISMATCH', 'stored context-write decision cannot be reproduced');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_CONTEXT_WRITE_ALLOW'
    && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)))) {
    throw new ReferenceResolutionError('CONTEXT_WRITE_AUTHORIZATION_AUDIT_INVALID', 'context-write authorization lacks direct RoleAssignment audit');
  }
  return record;
}

function assertAuditActor(audit, principal, code) {
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new ReferenceResolutionError(code, 'publication requires explicit audit metadata');
  }
  if (audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new ReferenceResolutionError(code, 'audit actor must equal exact publishing principal');
  }
}

export function publishAuthorizedContextReference({
  ledger,
  logicalId,
  version,
  target,
  reference,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ReferenceResolutionError('INVALID_LEDGER', 'AuthorizedContextReference requires replayable AuthorityLedger');
  }
  const normalizedPrincipal = createPrincipal(principal);
  const normalizedTarget = normalizeTarget(target);
  if (normalizedPrincipal.organizationId !== normalizedTarget.organizationId
    || (normalizedPrincipal.tenantId ?? null) !== (normalizedTarget.tenantId ?? null)) {
    throw new ReferenceResolutionError('AUTHORIZED_REFERENCE_TARGET_SCOPE_DENIED', 'publisher identity must exactly match reference target scope');
  }
  const semanticPayload = normalizeAuthorizedContextReference(reference);
  const authorization = validateWriteAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    target: normalizedTarget,
    resourceType: 'AUTHORIZED_CONTEXT_REFERENCE',
    logicalId
  });
  assertAuditActor(audit, normalizedPrincipal, 'AUTHORIZED_REFERENCE_AUDIT_ACTOR_MISMATCH');
  return ledger.publish({
    kind: 'AuthorizedContextReference',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload,
    audit: {
      ...audit,
      action: 'PUBLISH_AUTHORIZED_CONTEXT_REFERENCE',
      inputRefs: [authorization.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        creationPrincipal: normalizedPrincipal,
        targetScope: normalizedTarget,
        authorizationDecisionAuditRef: authorization.ref
      }
    }
  });
}

export function validateAuthorizedContextReferenceAuthority({ ledger, referenceRef }) {
  const record = resolveKind(
    ledger,
    referenceRef,
    'AuthorizedContextReference',
    'AUTHORIZED_CONTEXT_REFERENCE_REQUIRED'
  );
  const normalized = normalizeAuthorizedContextReference(record.semanticPayload);
  if (semanticHash('AuthorizedContextReference', normalized) !== record.ref.semanticHash) {
    throw new ReferenceResolutionError('AUTHORIZED_REFERENCE_SEMANTICS_INVALID', 'stored reference does not match frozen A03 semantics');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let authorization = null;
  let targetScope = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_AUTHORIZED_CONTEXT_REFERENCE'
      || !event.details?.creationPrincipal || !event.details?.targetScope
      || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const creator = createPrincipal(event.details.creationPrincipal);
      if (event.actor?.id !== creator.principalId || event.actor?.type !== creator.type
        || !exactRefIn(event.inputRefs, event.details.authorizationDecisionAuditRef)) continue;
      authorization = validateWriteAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: creator,
        target: event.details.targetScope,
        resourceType: 'AUTHORIZED_CONTEXT_REFERENCE',
        logicalId: record.ref.logicalId
      });
      targetScope = cloneCanonicalValue(event.details.targetScope);
      break;
    } catch {
      authorization = null;
      targetScope = null;
    }
  }
  if (!authorization || !targetScope) {
    throw new ReferenceResolutionError('AUTHORIZED_REFERENCE_AUDIT_INVALID', 'reference lacks replayable context.write publication authority');
  }
  return deepFreeze({ record, semanticPayload: normalized, writeAuthorization: authorization, targetScope });
}

function replayForResolution({ reference, providerResponseHash, snapshotStore, providerResponseBytes, retainSnapshot }) {
  if (retainSnapshot) {
    if (!snapshotStore || typeof snapshotStore.put !== 'function' || typeof snapshotStore.get !== 'function') {
      throw new ReferenceResolutionError('EXACT_RETENTION_STORE_REQUIRED', 'EXACT replay requires an exact snapshot store');
    }
    const retention = snapshotStore.put(providerResponseBytes);
    if (retention.contentHash !== providerResponseHash) {
      throw new ReferenceResolutionError('RETAINED_CONTENT_HASH_MISMATCH', 'retained provider bytes do not match observed provider response hash');
    }
    return deepFreeze({
      replayClass: 'EXACT',
      retention: {
        mode: 'SNAPSHOT_RETAINED',
        retentionRef: retention.retentionRef,
        storeKind: retention.storeKind,
        byteLength: retention.byteLength
      }
    });
  }

  const provider = reference.semanticPayload.reference;
  if (provider.addressingMode === 'CONTENT_ADDRESSED') {
    if (provider.expectedContentHash !== providerResponseHash) {
      throw new ReferenceResolutionError('EXPECTED_CONTENT_HASH_MISMATCH', 'content-addressed reference returned bytes different from expectedContentHash');
    }
    return deepFreeze({
      replayClass: 'CONTENT_ADDRESSED_EXTERNAL',
      retention: {
        mode: 'EXTERNAL_CONTENT_ADDRESS',
        retentionRef: provider.expectedContentHash,
        providerId: provider.providerId,
        locator: provider.locator
      }
    });
  }
  if (provider.addressingMode === 'VERSIONED_LOCATOR') {
    return deepFreeze({
      replayClass: 'PROVIDER_DEPENDENT',
      retention: {
        mode: 'NOT_RETAINED',
        providerId: provider.providerId,
        locator: provider.locator,
        versionToken: provider.versionToken
      }
    });
  }
  return deepFreeze({
    replayClass: 'NON_REPLAYABLE',
    retention: { mode: 'NOT_RETAINED' }
  });
}

function normalizeResolutionTimes(resolution, contextDatum) {
  exactObject(resolution, 'resolution', new Set(['resolvedAt', 'effectiveAt', 'availableAt']));
  const resolvedAt = normalizeTimestamp(resolution.resolvedAt, 'resolution.resolvedAt');
  const effectiveAt = normalizeTimestamp(resolution.effectiveAt, 'resolution.effectiveAt');
  const availableAt = normalizeTimestamp(resolution.availableAt, 'resolution.availableAt');
  if (availableAt !== contextDatum.availableAt) {
    throw new ReferenceResolutionError('RESOLUTION_AVAILABLE_TIME_MISMATCH', 'receipt availableAt must equal normalized ContextDatum availableAt');
  }
  if (effectiveAt < contextDatum.effectiveInterval.start || effectiveAt > contextDatum.effectiveInterval.end) {
    throw new ReferenceResolutionError('RESOLUTION_EFFECTIVE_TIME_MISMATCH', 'receipt effectiveAt must fall within normalized ContextDatum effectiveInterval');
  }
  if (resolvedAt < availableAt) {
    throw new ReferenceResolutionError('RESOLUTION_CHRONOLOGY_INVALID', 'resolvedAt cannot precede availableAt');
  }
  return deepFreeze({ resolvedAt, effectiveAt, availableAt });
}

function validateResolvedDatumAgainstReference(reference, datum, providerResponseHash) {
  if (datum.semanticPayload.semanticId !== reference.semanticPayload.semanticId) {
    throw new ReferenceResolutionError('RESOLVED_SEMANTIC_ID_MISMATCH', 'resolved ContextDatum semanticId must equal reference semanticId');
  }
  if (datum.semanticPayload.source.providerId !== reference.semanticPayload.reference.providerId) {
    throw new ReferenceResolutionError('RESOLVED_PROVIDER_MISMATCH', 'resolved ContextDatum source providerId must equal reference providerId');
  }
  if (datum.semanticPayload.source.contentHash !== providerResponseHash) {
    throw new ReferenceResolutionError('RESOLVED_CONTENT_HASH_MISMATCH', 'resolved ContextDatum source contentHash must bind exact provider response bytes');
  }
}

export function publishResolvedContextDatumReceipt({
  ledger,
  logicalId,
  version,
  referenceRef,
  normalizedContextDatumRef,
  providerResponseBytes,
  resolution,
  retainSnapshot = false,
  snapshotStore,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ReferenceResolutionError('INVALID_LEDGER', 'ResolvedContextDatumReceipt requires replayable AuthorityLedger');
  }
  if (!(providerResponseBytes instanceof Uint8Array) && !Buffer.isBuffer(providerResponseBytes)) {
    throw new ReferenceResolutionError('EXACT_PROVIDER_RESPONSE_BYTES_REQUIRED', 'resolution requires exact provider response bytes even when bytes are not retained');
  }
  const reference = validateAuthorizedContextReferenceAuthority({ ledger, referenceRef });
  const datum = validateContextDatumAuthority({ ledger, contextDatumRef: normalizedContextDatumRef });
  const providerResponseHash = providerResponseContentHash(providerResponseBytes);
  validateResolvedDatumAgainstReference(reference, datum, providerResponseHash);

  const datumTarget = datum.writeAuthorization.semanticPayload.request.authorizationScope;
  const refTarget = reference.targetScope;
  if (datumTarget.organizationId !== refTarget.organizationId
    || (datumTarget.tenantId ?? null) !== (refTarget.tenantId ?? null)) {
    throw new ReferenceResolutionError('RESOLVED_CONTEXT_TARGET_MISMATCH', 'resolved ContextDatum must belong to exact reference organization/tenant');
  }
  const times = normalizeResolutionTimes(resolution, datum.semanticPayload);
  const replay = replayForResolution({
    reference,
    providerResponseHash,
    snapshotStore,
    providerResponseBytes,
    retainSnapshot
  });
  const normalizedPrincipal = createPrincipal(principal);
  if (normalizedPrincipal.organizationId !== refTarget.organizationId
    || (normalizedPrincipal.tenantId ?? null) !== (refTarget.tenantId ?? null)) {
    throw new ReferenceResolutionError('CONTEXT_RECEIPT_TARGET_SCOPE_DENIED', 'receipt publisher must match reference organization/tenant');
  }
  const writeAuthorization = validateWriteAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    target: refTarget,
    resourceType: 'RESOLVED_CONTEXT_DATUM_RECEIPT',
    logicalId
  });
  assertAuditActor(audit, normalizedPrincipal, 'CONTEXT_RECEIPT_AUDIT_ACTOR_MISMATCH');

  const semanticPayload = deepFreeze({
    contractVersion: CONTEXT_RECEIPT_CONTRACT_VERSION,
    referenceRef: reference.record.ref,
    referenceHash: reference.record.ref.semanticHash,
    resolvedContextDatumRef: datum.record.ref,
    normalizedContextDatumHash: datum.record.ref.semanticHash,
    resolvedAt: times.resolvedAt,
    effectiveAt: times.effectiveAt,
    availableAt: times.availableAt,
    authorizationContextHash: reference.semanticPayload.authorizationContext.authorizationHash,
    providerResponseHash,
    retention: replay.retention,
    replayClass: replay.replayClass
  });

  return ledger.publish({
    kind: 'ResolvedContextDatumReceipt',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload,
    audit: {
      ...audit,
      action: 'PUBLISH_RESOLVED_CONTEXT_DATUM_RECEIPT',
      inputRefs: [reference.record.ref, datum.record.ref, writeAuthorization.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        creationPrincipal: normalizedPrincipal,
        targetScope: refTarget,
        authorizationDecisionAuditRef: writeAuthorization.ref
      }
    }
  });
}

function assertReplayTruth({ receipt, reference, snapshotStore }) {
  const payload = receipt.semanticPayload;
  const provider = reference.semanticPayload.reference;
  if (!REPLAY_CLASSES.includes(payload.replayClass)) {
    throw new ReferenceResolutionError('INVALID_REPLAY_CLASS', `unsupported replayClass ${payload.replayClass}`);
  }
  if (!RETENTION_MODES.includes(payload.retention?.mode)) {
    throw new ReferenceResolutionError('INVALID_RETENTION_MODE', `unsupported retention mode ${payload.retention?.mode}`);
  }
  if (payload.replayClass === 'EXACT') {
    if (payload.retention.mode !== 'SNAPSHOT_RETAINED' || !snapshotStore
      || typeof snapshotStore.get !== 'function') {
      throw new ReferenceResolutionError('EXACT_REPLAY_NOT_PROVABLE', 'EXACT replay requires accessible retained provider bytes');
    }
    let bytes;
    try {
      bytes = snapshotStore.get(payload.retention.retentionRef);
    } catch (error) {
      if (error instanceof ContextSnapshotError) {
        throw new ReferenceResolutionError('EXACT_REPLAY_NOT_PROVABLE', 'retained provider bytes are unavailable');
      }
      throw error;
    }
    if (providerResponseContentHash(bytes) !== payload.providerResponseHash) {
      throw new ReferenceResolutionError('EXACT_REPLAY_CONTENT_MISMATCH', 'retained provider bytes do not match receipt providerResponseHash');
    }
    return;
  }
  if (payload.replayClass === 'CONTENT_ADDRESSED_EXTERNAL') {
    if (payload.retention.mode !== 'EXTERNAL_CONTENT_ADDRESS'
      || provider.addressingMode !== 'CONTENT_ADDRESSED'
      || provider.expectedContentHash !== payload.providerResponseHash
      || payload.retention.retentionRef !== provider.expectedContentHash) {
      throw new ReferenceResolutionError('CONTENT_ADDRESSED_REPLAY_NOT_PROVABLE', 'external content-addressed replay claim is not supported by exact reference/hash evidence');
    }
    return;
  }
  if (payload.replayClass === 'PROVIDER_DEPENDENT') {
    if (payload.retention.mode !== 'NOT_RETAINED' || provider.addressingMode !== 'VERSIONED_LOCATOR' || !provider.versionToken) {
      throw new ReferenceResolutionError('PROVIDER_DEPENDENT_REPLAY_INVALID', 'provider-dependent replay requires a versioned non-retained locator');
    }
    return;
  }
  if (payload.retention.mode !== 'NOT_RETAINED' || provider.addressingMode !== 'MUTABLE_LOCATOR') {
    throw new ReferenceResolutionError('NON_REPLAYABLE_CLASS_INVALID', 'NON_REPLAYABLE must represent a mutable, non-retained reference result');
  }
}

export function validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef, snapshotStore }) {
  const receipt = resolveKind(
    ledger,
    receiptRef,
    'ResolvedContextDatumReceipt',
    'RESOLVED_CONTEXT_DATUM_RECEIPT_REQUIRED'
  );
  const payload = receipt.semanticPayload;
  if (payload.contractVersion !== CONTEXT_RECEIPT_CONTRACT_VERSION) {
    throw new ReferenceResolutionError('UNSUPPORTED_CONTEXT_RECEIPT_CONTRACT', 'receipt contractVersion is invalid');
  }
  const reference = validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: payload.referenceRef });
  const datum = validateContextDatumAuthority({ ledger, contextDatumRef: payload.resolvedContextDatumRef });
  if (payload.referenceHash !== reference.record.ref.semanticHash
    || payload.normalizedContextDatumHash !== datum.record.ref.semanticHash
    || payload.authorizationContextHash !== reference.semanticPayload.authorizationContext.authorizationHash) {
    throw new ReferenceResolutionError('CONTEXT_RECEIPT_HASH_BINDING_INVALID', 'receipt hashes do not bind exact reference/context authorization authority');
  }
  validateResolvedDatumAgainstReference(reference, datum, payload.providerResponseHash);
  const times = normalizeResolutionTimes({
    resolvedAt: payload.resolvedAt,
    effectiveAt: payload.effectiveAt,
    availableAt: payload.availableAt
  }, datum.semanticPayload);
  const normalizedPayload = deepFreeze({
    contractVersion: CONTEXT_RECEIPT_CONTRACT_VERSION,
    referenceRef: reference.record.ref,
    referenceHash: reference.record.ref.semanticHash,
    resolvedContextDatumRef: datum.record.ref,
    normalizedContextDatumHash: datum.record.ref.semanticHash,
    resolvedAt: times.resolvedAt,
    effectiveAt: times.effectiveAt,
    availableAt: times.availableAt,
    authorizationContextHash: reference.semanticPayload.authorizationContext.authorizationHash,
    providerResponseHash: requireSha256(payload.providerResponseHash, 'providerResponseHash'),
    retention: cloneCanonicalValue(payload.retention),
    replayClass: requiredText(payload.replayClass, 'replayClass')
  });
  if (semanticHash('ResolvedContextDatumReceipt', normalizedPayload) !== receipt.ref.semanticHash) {
    throw new ReferenceResolutionError('CONTEXT_RECEIPT_SEMANTICS_INVALID', 'stored receipt does not match frozen A03 semantic contract');
  }
  assertReplayTruth({ receipt, reference, snapshotStore });

  const refTarget = reference.targetScope;
  const direct = ledger.auditFor(receipt.ref).filter((event) => sameAuthorityRef(event.objectRef, receipt.ref));
  let writeAuthorization = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_RESOLVED_CONTEXT_DATUM_RECEIPT'
      || !event.details?.creationPrincipal || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const creator = createPrincipal(event.details.creationPrincipal);
      if (event.actor?.id !== creator.principalId || event.actor?.type !== creator.type
        || !exactRefIn(event.inputRefs, reference.record.ref)
        || !exactRefIn(event.inputRefs, datum.record.ref)
        || !exactRefIn(event.inputRefs, event.details.authorizationDecisionAuditRef)) continue;
      writeAuthorization = validateWriteAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: creator,
        target: refTarget,
        resourceType: 'RESOLVED_CONTEXT_DATUM_RECEIPT',
        logicalId: receipt.ref.logicalId
      });
      break;
    } catch {
      writeAuthorization = null;
    }
  }
  if (!writeAuthorization) {
    throw new ReferenceResolutionError('CONTEXT_RECEIPT_AUDIT_INVALID', 'receipt lacks replayable reference/datum/context.write authority');
  }
  return deepFreeze({ receipt, reference, contextDatum: datum, writeAuthorization });
}

export function materializePublicAuthorizedContextReference(record) {
  if (!record?.ref || record.ref.kind !== 'AuthorizedContextReference') {
    throw new ReferenceResolutionError('AUTHORIZED_CONTEXT_REFERENCE_REQUIRED', 'AuthorizedContextReference record required');
  }
  const p = record.semanticPayload;
  return deepFreeze({
    contract_version: p.contractVersion,
    reference_id: record.ref.logicalId,
    semantic_id: p.semanticId,
    value_mode: p.valueMode,
    reference: {
      provider_id: p.reference.providerId,
      locator: p.reference.locator,
      addressing_mode: p.reference.addressingMode,
      ...(p.reference.versionToken ? { version_token: p.reference.versionToken } : {}),
      ...(p.reference.expectedContentHash ? { expected_content_hash: p.reference.expectedContentHash } : {})
    },
    authorization_context: {
      connection_id: p.authorizationContext.connectionId,
      principal_scope: cloneCanonicalValue(p.authorizationContext.principalScope),
      authorization_hash: p.authorizationContext.authorizationHash
    },
    semantic_hash: record.ref.semanticHash
  });
}

export function materializePublicResolvedContextDatumReceipt(record) {
  if (!record?.ref || record.ref.kind !== 'ResolvedContextDatumReceipt') {
    throw new ReferenceResolutionError('RESOLVED_CONTEXT_DATUM_RECEIPT_REQUIRED', 'ResolvedContextDatumReceipt record required');
  }
  const p = record.semanticPayload;
  return deepFreeze({
    contract_version: p.contractVersion,
    receipt_id: record.ref.logicalId,
    reference_id: p.referenceRef.logicalId,
    reference_hash: p.referenceHash,
    resolved_at: p.resolvedAt,
    effective_at: p.effectiveAt,
    available_at: p.availableAt,
    authorization_context_hash: p.authorizationContextHash,
    provider_response_hash: p.providerResponseHash,
    normalized_context_datum_hash: p.normalizedContextDatumHash,
    retention: {
      mode: p.retention.mode,
      ...(p.retention.retentionRef ? { retention_ref: p.retention.retentionRef } : {})
    },
    replay_class: p.replayClass,
    semantic_hash: record.ref.semanticHash
  });
}

export { ExactContextSnapshotStore, providerResponseContentHash };
