import { deepFreeze } from '../../canonicalization/src/index.mjs';

export const IMPLEMENTATION_CONTRACT_VERSION = 'adr.implementation.v1';
export const IMPLEMENTATION_AUTHORITY_CLASS = 'EXECUTABLE_IMPLEMENTATION_IDENTITY';
export const IMPLEMENTATION_PROVIDER_TYPES = deepFreeze([
  'INTERNAL',
  'HTTP',
  'CUSTOMER',
  'GEOX',
  'WASM',
  'BATCH'
]);

const PROVIDERS = new Set(IMPLEMENTATION_PROVIDER_TYPES);
const LOCATOR_KIND_BY_PROVIDER = deepFreeze({
  INTERNAL: 'INTERNAL_FUNCTION',
  HTTP: 'HTTPS_ENDPOINT',
  CUSTOMER: 'CUSTOMER_RUNTIME',
  GEOX: 'GEOX_RUNTIME',
  WASM: 'WASM_MODULE',
  BATCH: 'BATCH_JOB'
});
const HASH_RE = /^sha256:[a-f0-9]{64}$/;

export class ImplementationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImplementationError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ImplementationError('INVALID_IMPLEMENTATION_FIELD', `${name}.${key} is not part of the frozen S02 contract`);
    }
  }
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_HASH', `${name} must be canonical sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function controlScope(value) {
  exactObject(value, 'controlScope', new Set(['organizationId', 'tenantId']));
  return deepFreeze({
    organizationId: text(value.organizationId, 'controlScope.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'controlScope.tenantId') } : {})
  });
}

function executionLocator(value, providerType) {
  exactObject(value, 'executionLocator', new Set(['kind', 'value']));
  const kind = text(value.kind, 'executionLocator.kind');
  const expected = LOCATOR_KIND_BY_PROVIDER[providerType];
  if (kind !== expected) {
    throw new ImplementationError(
      'IMPLEMENTATION_LOCATOR_PROVIDER_MISMATCH',
      `${providerType} requires executionLocator.kind ${expected}`
    );
  }
  const locator = text(value.value, 'executionLocator.value');
  if (kind === 'HTTPS_ENDPOINT') {
    let parsed;
    try { parsed = new URL(locator); }
    catch { throw new ImplementationError('INVALID_IMPLEMENTATION_ENDPOINT', 'HTTP implementation locator must be an absolute HTTPS URL'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new ImplementationError(
        'INVALID_IMPLEMENTATION_ENDPOINT',
        'HTTP implementation locator must be credential-free HTTPS without query or fragment'
      );
    }
    return deepFreeze({ kind, value: parsed.toString() });
  }
  if (/\s/.test(locator)) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_LOCATOR', 'non-HTTP execution locator cannot contain whitespace');
  }
  return deepFreeze({ kind, value: locator });
}

function artifact(value) {
  exactObject(value, 'artifact', new Set(['artifactId', 'contentHash']));
  return deepFreeze({
    artifactId: text(value.artifactId, 'artifact.artifactId'),
    contentHash: hash(value.contentHash, 'artifact.contentHash')
  });
}

function runtimeMetadata(value) {
  exactObject(value, 'runtimeMetadata', new Set(['runtime', 'runtimeVersion', 'platform', 'architecture']));
  return deepFreeze({
    runtime: text(value.runtime, 'runtimeMetadata.runtime'),
    runtimeVersion: text(value.runtimeVersion, 'runtimeMetadata.runtimeVersion'),
    platform: text(value.platform, 'runtimeMetadata.platform'),
    architecture: text(value.architecture, 'runtimeMetadata.architecture')
  });
}

function strings(values, name) {
  if (!Array.isArray(values)) throw new ImplementationError('INVALID_IMPLEMENTATION_INPUT', `${name} must be an array`);
  const normalized = values.map((item, index) => text(item, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new ImplementationError('DUPLICATE_IMPLEMENTATION_CONSTRAINT', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeImplementation(value) {
  exactObject(value, 'Implementation', new Set([
    'contractVersion',
    'authorityClass',
    'controlScope',
    'providerType',
    'implementationDigest',
    'executionLocator',
    'artifact',
    'runtimeMetadata',
    'operationalConstraints',
    'conformanceClaim'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== IMPLEMENTATION_CONTRACT_VERSION) {
    throw new ImplementationError('UNSUPPORTED_IMPLEMENTATION_CONTRACT', 'unsupported Implementation contractVersion');
  }
  if (value.authorityClass !== undefined && value.authorityClass !== IMPLEMENTATION_AUTHORITY_CLASS) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_AUTHORITY_CLASS', 'invalid Implementation authorityClass');
  }
  const providerType = text(value.providerType, 'providerType');
  if (!PROVIDERS.has(providerType)) {
    throw new ImplementationError('INVALID_IMPLEMENTATION_PROVIDER_TYPE', `unsupported providerType ${providerType}`);
  }
  const conformanceClaim = text(value.conformanceClaim, 'conformanceClaim');
  if (conformanceClaim !== 'NONE_REGISTRATION_ONLY') {
    throw new ImplementationError(
      'IMPLEMENTATION_CONFORMANCE_LAUNDERING',
      'Implementation registration cannot claim specification conformance'
    );
  }
  return deepFreeze({
    contractVersion: IMPLEMENTATION_CONTRACT_VERSION,
    authorityClass: IMPLEMENTATION_AUTHORITY_CLASS,
    controlScope: controlScope(value.controlScope),
    providerType,
    implementationDigest: hash(value.implementationDigest, 'implementationDigest'),
    executionLocator: executionLocator(value.executionLocator, providerType),
    artifact: artifact(value.artifact),
    runtimeMetadata: runtimeMetadata(value.runtimeMetadata),
    operationalConstraints: strings(value.operationalConstraints ?? [], 'operationalConstraints'),
    conformanceClaim
  });
}
