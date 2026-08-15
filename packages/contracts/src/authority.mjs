const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export class AuthorityReferenceError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'AuthorityReferenceError';
    this.code = code;
  }
}

function requiredToken(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuthorityReferenceError('INVALID_AUTHORITY_REF', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function makeAuthorityRef({ kind, logicalId, version, semanticHash }) {
  const normalized = {
    kind: requiredToken(kind, 'kind'),
    logicalId: requiredToken(logicalId, 'logicalId'),
    version: requiredToken(version, 'version'),
    semanticHash: requiredToken(semanticHash, 'semanticHash')
  };
  if (!SHA256_PATTERN.test(normalized.semanticHash)) {
    throw new AuthorityReferenceError('INVALID_SEMANTIC_HASH', `semanticHash must match ${SHA256_PATTERN}`);
  }
  return Object.freeze(normalized);
}

export function assertAuthorityRef(ref) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    throw new AuthorityReferenceError('INVALID_AUTHORITY_REF', 'authority ref must be an object');
  }
  return makeAuthorityRef(ref);
}

export function authorityRefKey(ref) {
  const normalized = assertAuthorityRef(ref);
  return JSON.stringify([normalized.kind, normalized.logicalId, normalized.version]);
}

export function sameAuthorityRef(left, right) {
  const a = assertAuthorityRef(left);
  const b = assertAuthorityRef(right);
  return a.kind === b.kind
    && a.logicalId === b.logicalId
    && a.version === b.version
    && a.semanticHash === b.semanticHash;
}
