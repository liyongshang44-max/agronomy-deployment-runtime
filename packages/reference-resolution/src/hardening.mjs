import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import {
  normalizeAuthorizedContextReference as coreNormalizeReference,
  publishAuthorizedContextReference as corePublishReference,
  validateAuthorizedContextReferenceAuthority as coreValidateReference,
  publishResolvedContextDatumReceipt as corePublishReceipt,
  validateResolvedContextDatumReceiptAuthority as coreValidateReceipt,
  ReferenceResolutionError,
  providerResponseContentHash
} from './core.mjs';

const SHA256_RE = /^sha256:([0-9a-f]{64})$/;
const PRINCIPAL_SCOPE_KEYS = new Set([
  'organizationId',
  'tenantId',
  'subjectId',
  'fieldIds',
  'resourceIds',
  'semanticIds'
]);
const ARRAY_SCOPE_KEYS = new Set(['fieldIds', 'resourceIds', 'semanticIds']);
const SECRET_SCOPE_KEY_RE = /(?:token|secret|password|credential|authorization|bearer|api.?key|private.?key|session.?key)/i;
const SIGNED_QUERY_KEY_RE = /(?:^|[-_])(?:token|secret|password|credential|signature|security[-_]?token|api[-_]?key|access[-_]?key|signed[-_]?headers?|sig)(?:$|[-_])/i;

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', `${name} must be a non-empty non-secret identifier`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_FIELD', `${name}.${key} is not permitted by the A03 v0.1 contract`);
    }
  }
}

function canonicalIdentifierSet(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', `${name} must be a non-empty array of non-secret identifiers`);
  }
  const normalized = value.map((item, index) => requiredText(item, `${name}[${index}]`));
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    throw new ReferenceResolutionError('DUPLICATE_AUTHORIZATION_SCOPE_ID', `${name} cannot contain duplicate identifiers`);
  }
  return unique;
}

export function normalizeProviderPrincipalScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', 'authorizationContext.principalScope must be an object');
  }
  for (const key of Object.keys(value)) {
    if (!PRINCIPAL_SCOPE_KEYS.has(key)) {
      if (SECRET_SCOPE_KEY_RE.test(key)) {
        throw new ReferenceResolutionError(
          'SECRET_AUTH_MATERIAL_FORBIDDEN',
          `authorizationContext.principalScope.${key} is credential-shaped and cannot enter ADR semantic identity`
        );
      }
      throw new ReferenceResolutionError(
        'INVALID_REFERENCE_RESOLUTION_FIELD',
        `authorizationContext.principalScope.${key} is not a frozen non-secret scope field`
      );
    }
  }
  const organizationId = requiredText(value.organizationId, 'authorizationContext.principalScope.organizationId');
  const normalized = {
    organizationId,
    ...(value.tenantId !== undefined
      ? { tenantId: requiredText(value.tenantId, 'authorizationContext.principalScope.tenantId') }
      : {}),
    ...(value.subjectId !== undefined
      ? { subjectId: requiredText(value.subjectId, 'authorizationContext.principalScope.subjectId') }
      : {})
  };
  for (const key of ARRAY_SCOPE_KEYS) {
    if (value[key] !== undefined) normalized[key] = canonicalIdentifierSet(value[key], `authorizationContext.principalScope.${key}`);
  }
  return deepFreeze(normalized);
}

function assertNoSignedLocatorSecrets(locator) {
  const queryIndex = locator.indexOf('?');
  if (queryIndex < 0) return;
  const query = locator.slice(queryIndex + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const [rawKey] = pair.split('=');
    let key = rawKey;
    try { key = decodeURIComponent(rawKey); } catch {}
    if (SIGNED_QUERY_KEY_RE.test(key)) {
      throw new ReferenceResolutionError(
        'SECRET_AUTH_MATERIAL_FORBIDDEN',
        `reference.locator query parameter ${key} is credential/signature material and cannot enter semantic identity`
      );
    }
  }
}

function locatorBindsExpectedHash(locator, expectedContentHash) {
  const match = SHA256_RE.exec(expectedContentHash ?? '');
  if (!match) return false;
  const hex = match[1];
  let decoded = locator;
  try { decoded = decodeURIComponent(locator); } catch {}
  const lower = decoded.toLowerCase();
  return lower.includes(`sha256:${hex}`) || lower.includes(hex);
}

function hardenedReferenceInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ReferenceResolutionError('INVALID_REFERENCE_RESOLUTION_INPUT', 'AuthorizedContextReference input must be an object');
  }
  if (!input.authorizationContext || typeof input.authorizationContext !== 'object') {
    throw new ReferenceResolutionError('INVALID_AUTHORIZATION_CONTEXT', 'authorizationContext is required');
  }
  const principalScope = normalizeProviderPrincipalScope(input.authorizationContext.principalScope);
  const normalized = coreNormalizeReference({
    ...input,
    authorizationContext: {
      ...input.authorizationContext,
      principalScope
    }
  });
  assertNoSignedLocatorSecrets(normalized.reference.locator);
  if (normalized.reference.addressingMode === 'CONTENT_ADDRESSED'
    && !locatorBindsExpectedHash(normalized.reference.locator, normalized.reference.expectedContentHash)) {
    throw new ReferenceResolutionError(
      'CONTENT_ADDRESS_LOCATOR_NOT_BOUND',
      'CONTENT_ADDRESSED requires locator itself to bind the expected SHA-256; a mutable locator cannot self-assert stronger replay semantics'
    );
  }
  return normalized;
}

export function normalizeAuthorizedContextReference(input) {
  return hardenedReferenceInput(input);
}

function assertReferenceCanonical(record) {
  const hardened = hardenedReferenceInput(record.semanticPayload);
  if (semanticHash('AuthorizedContextReference', hardened) !== record.ref.semanticHash) {
    throw new ReferenceResolutionError(
      'AUTHORIZED_REFERENCE_NONCANONICAL',
      'AuthorizedContextReference semantic identity is not canonical under the A03 v0.1 principal-scope/content-address rules'
    );
  }
  return hardened;
}

export function publishAuthorizedContextReference(args) {
  const reference = hardenedReferenceInput(args.reference);
  return corePublishReference({ ...args, reference });
}

export function validateAuthorizedContextReferenceAuthority(args) {
  const validated = coreValidateReference(args);
  const semanticPayload = assertReferenceCanonical(validated.record);
  return deepFreeze({ ...validated, semanticPayload });
}

function assertExactKeys(value, name, keys) {
  exactObject(value, name, keys);
  for (const key of keys) {
    if (!(key in value)) {
      throw new ReferenceResolutionError('INVALID_RETENTION_SHAPE', `${name}.${key} is required`);
    }
  }
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ReferenceResolutionError('INVALID_RETENTION_SHAPE', `${name} must be a non-negative safe integer`);
  }
  return value;
}

function assertRetentionTruth({ payload, reference, snapshotStore }) {
  const retention = payload.retention;
  const provider = reference.semanticPayload.reference;

  if (payload.replayClass === 'EXACT') {
    assertExactKeys(retention, 'retention', new Set(['mode', 'retentionRef', 'storeKind', 'byteLength']));
    if (retention.mode !== 'SNAPSHOT_RETAINED'
      || retention.storeKind !== 'ADR_CONTROLLED_CONTENT_ADDRESSABLE_SNAPSHOT'
      || retention.retentionRef !== payload.providerResponseHash) {
      throw new ReferenceResolutionError('EXACT_RETENTION_SHAPE_INVALID', 'EXACT replay must bind ADR-controlled retained bytes by the exact provider response hash');
    }
    assertNonNegativeInteger(retention.byteLength, 'retention.byteLength');
    if (!snapshotStore || typeof snapshotStore.get !== 'function') {
      throw new ReferenceResolutionError('EXACT_REPLAY_NOT_PROVABLE', 'EXACT replay requires an accessible snapshot store');
    }
    let bytes;
    try {
      bytes = snapshotStore.get(retention.retentionRef);
    } catch {
      throw new ReferenceResolutionError('EXACT_REPLAY_NOT_PROVABLE', 'retained provider bytes are unavailable');
    }
    if (providerResponseContentHash(bytes) !== payload.providerResponseHash || bytes.byteLength !== retention.byteLength) {
      throw new ReferenceResolutionError('EXACT_REPLAY_CONTENT_MISMATCH', 'retained bytes/hash/byteLength do not match the receipt');
    }
    return;
  }

  if (payload.replayClass === 'CONTENT_ADDRESSED_EXTERNAL') {
    assertExactKeys(retention, 'retention', new Set(['mode', 'retentionRef', 'providerId', 'locator']));
    if (retention.mode !== 'EXTERNAL_CONTENT_ADDRESS'
      || retention.retentionRef !== payload.providerResponseHash
      || retention.providerId !== provider.providerId
      || retention.locator !== provider.locator
      || provider.addressingMode !== 'CONTENT_ADDRESSED'
      || provider.expectedContentHash !== payload.providerResponseHash
      || !locatorBindsExpectedHash(provider.locator, provider.expectedContentHash)) {
      throw new ReferenceResolutionError('CONTENT_ADDRESSED_REPLAY_NOT_PROVABLE', 'external content-addressed replay lacks exact locator/hash binding');
    }
    return;
  }

  if (payload.replayClass === 'PROVIDER_DEPENDENT') {
    assertExactKeys(retention, 'retention', new Set(['mode', 'providerId', 'locator', 'versionToken']));
    if (retention.mode !== 'NOT_RETAINED'
      || provider.addressingMode !== 'VERSIONED_LOCATOR'
      || retention.providerId !== provider.providerId
      || retention.locator !== provider.locator
      || retention.versionToken !== provider.versionToken) {
      throw new ReferenceResolutionError('PROVIDER_DEPENDENT_REPLAY_INVALID', 'provider-dependent replay must bind the exact versioned provider locator');
    }
    return;
  }

  if (payload.replayClass === 'NON_REPLAYABLE') {
    assertExactKeys(retention, 'retention', new Set(['mode']));
    if (retention.mode !== 'NOT_RETAINED' || provider.addressingMode !== 'MUTABLE_LOCATOR') {
      throw new ReferenceResolutionError('NON_REPLAYABLE_CLASS_INVALID', 'NON_REPLAYABLE must represent a mutable non-retained reference');
    }
    return;
  }

  throw new ReferenceResolutionError('INVALID_REPLAY_CLASS', `unsupported replayClass ${payload.replayClass}`);
}

export function publishResolvedContextDatumReceipt(args) {
  validateAuthorizedContextReferenceAuthority({ ledger: args.ledger, referenceRef: args.referenceRef });
  return corePublishReceipt(args);
}

export function validateResolvedContextDatumReceiptAuthority(args) {
  const validated = coreValidateReceipt(args);
  const reference = validateAuthorizedContextReferenceAuthority({
    ledger: args.ledger,
    referenceRef: validated.receipt.semanticPayload.referenceRef
  });
  assertRetentionTruth({
    payload: validated.receipt.semanticPayload,
    reference,
    snapshotStore: args.snapshotStore
  });
  return deepFreeze({ ...validated, reference });
}
