import { createHash } from 'node:crypto';

export const ADR_CANONICAL_JSON_VERSION = 'adr-canonical-json-v1';
export const ADR_SEMANTIC_HASH_VERSION = 'adr-semantic-hash-v1';

export class CanonicalizationError extends TypeError {
  constructor(code, message, path = '$') {
    super(`${message} at ${path}`);
    this.name = 'CanonicalizationError';
    this.code = code;
    this.path = path;
  }
}

function compareUtf16(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function encodeCanonical(value, path, stack) {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError('NON_FINITE_NUMBER', 'semantic JSON does not permit non-finite numbers', path);
      }
      if (Object.is(value, -0)) return '0';
      return JSON.stringify(value);
    }
    case 'undefined':
      throw new CanonicalizationError('UNDEFINED_VALUE', 'semantic JSON does not permit undefined', path);
    case 'bigint':
      throw new CanonicalizationError('BIGINT_VALUE', 'semantic JSON does not permit bigint; use an explicit string representation', path);
    case 'function':
      throw new CanonicalizationError('FUNCTION_VALUE', 'semantic JSON does not permit functions', path);
    case 'symbol':
      throw new CanonicalizationError('SYMBOL_VALUE', 'semantic JSON does not permit symbols', path);
    case 'object':
      break;
    default:
      throw new CanonicalizationError('UNSUPPORTED_VALUE', `unsupported semantic JSON type ${typeof value}`, path);
  }

  if (stack.has(value)) {
    throw new CanonicalizationError('CYCLIC_VALUE', 'semantic JSON must be acyclic', path);
  }
  stack.add(value);

  try {
    if (Array.isArray(value)) {
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new CanonicalizationError('SPARSE_ARRAY', 'semantic JSON does not permit sparse arrays', `${path}[${index}]`);
        }
        items.push(encodeCanonical(value[index], `${path}[${index}]`, stack));
      }
      return `[${items.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalizationError('NON_PLAIN_OBJECT', 'semantic JSON requires plain objects', path);
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new CanonicalizationError('SYMBOL_KEY', 'semantic JSON does not permit symbol keys', path);
    }

    const names = Object.getOwnPropertyNames(value);
    const enumerableNames = Object.keys(value);
    if (names.length !== enumerableNames.length) {
      throw new CanonicalizationError('NON_ENUMERABLE_PROPERTY', 'semantic JSON does not permit hidden non-enumerable properties', path);
    }

    const keys = enumerableNames.sort(compareUtf16);
    const fields = [];
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new CanonicalizationError('ACCESSOR_PROPERTY', 'semantic JSON does not permit accessor properties', `${path}.${key}`);
      }
      fields.push(`${JSON.stringify(key)}:${encodeCanonical(descriptor.value, `${path}.${key}`, stack)}`);
    }
    return `{${fields.join(',')}}`;
  } finally {
    stack.delete(value);
  }
}

export function canonicalizeSemanticJson(value) {
  return encodeCanonical(value, '$', new WeakSet());
}

export function cloneCanonicalValue(value) {
  return JSON.parse(canonicalizeSemanticJson(value));
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assertKind(kind) {
  if (typeof kind !== 'string' || kind.trim().length === 0) {
    throw new CanonicalizationError('INVALID_KIND', 'semantic object kind must be a non-empty string', '$kind');
  }
  return kind.trim();
}

export function semanticHash(kind, semanticPayload) {
  const normalizedKind = assertKind(kind);
  const canonicalPayload = canonicalizeSemanticJson(semanticPayload);
  const preimage = `${ADR_SEMANTIC_HASH_VERSION}\nkind:${normalizedKind}\n${canonicalPayload}`;
  const digest = createHash('sha256').update(preimage, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

export function semanticDigest(kind, semanticPayload) {
  return deepFreeze({
    canonicalizationVersion: ADR_CANONICAL_JSON_VERSION,
    semanticHashVersion: ADR_SEMANTIC_HASH_VERSION,
    kind: assertKind(kind),
    canonicalPayload: canonicalizeSemanticJson(semanticPayload),
    semanticHash: semanticHash(kind, semanticPayload)
  });
}
