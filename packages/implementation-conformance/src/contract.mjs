import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const IMPLEMENTATION_CONFORMANCE_CONTRACT_VERSION = 'adr.implementation-conformance.v1';
export const IMPLEMENTATION_CONFORMANCE_AUTHORITY_CLASS = 'SPECIFICATION_IMPLEMENTATION_CONFORMANCE';
export const IMPLEMENTATION_CONFORMANCE_STATUS = 'QUALIFIED';
export const REQUIRED_COMPATIBILITY_TEST_TYPES = deepFreeze([
  'INPUT_CONTRACT_COMPATIBILITY',
  'OUTPUT_CONTRACT_COMPATIBILITY',
  'EXECUTION_FIXTURE'
]);
export const RUNTIME_ENVIRONMENTS = deepFreeze(['DEVELOPMENT', 'STAGING', 'PRODUCTION']);

const TEST_TYPES = new Set(REQUIRED_COMPATIBILITY_TEST_TYPES);
const ENVIRONMENTS = new Set(RUNTIME_ENVIRONMENTS);
const SPEC_KINDS = new Set(['QualifiedTransformation', 'Model', 'Policy']);
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export class ImplementationConformanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImplementationConformanceError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ImplementationConformanceError('INVALID_CONFORMANCE_FIELD', `${name}.${key} is not part of the frozen S03 contract`);
    }
  }
}

function hash(value, name) {
  const normalized = text(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_HASH', `${name} must be canonical sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

export function normalizeConformanceTimestamp(value, name = 'timestamp') {
  const raw = text(value, name);
  const match = RFC3339_RE.exec(raw);
  if (!match) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_TIME', `${name} must be explicit RFC3339 with timezone and <= millisecond precision`);
  }
  const [, y, m, d, hh, mm, ss, , zone] = match;
  const year = Number(y); const month = Number(m); const day = Number(d);
  const hour = Number(hh); const minute = Number(mm); const second = Number(ss);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_TIME', `${name} contains impossible calendar/clock values`);
  }
  if (zone !== 'Z') {
    const oh = Number(zone.slice(1, 3)); const om = Number(zone.slice(4, 6));
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) {
      throw new ImplementationConformanceError('INVALID_CONFORMANCE_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new ImplementationConformanceError('INVALID_CONFORMANCE_TIME', `${name} is invalid`);
  return parsed.toISOString();
}

function controlScope(value) {
  exactObject(value, 'controlScope', new Set(['organizationId', 'tenantId']));
  return deepFreeze({
    organizationId: text(value.organizationId, 'controlScope.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'controlScope.tenantId') } : {})
  });
}

function method(value) {
  exactObject(value, 'qualificationMethod', new Set(['methodId', 'definitionHash']));
  return deepFreeze({
    methodId: text(value.methodId, 'qualificationMethod.methodId'),
    definitionHash: hash(value.definitionHash, 'qualificationMethod.definitionHash')
  });
}

function compatibilityTests(values) {
  if (!Array.isArray(values)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_INPUT', 'compatibilityTests must be an array');
  const normalized = values.map((value, index) => {
    const name = `compatibilityTests[${index}]`;
    exactObject(value, name, new Set(['testType', 'testId', 'definitionHash', 'resultHash', 'outcome']));
    const testType = text(value.testType, `${name}.testType`);
    if (!TEST_TYPES.has(testType)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_TEST_TYPE', `unsupported testType ${testType}`);
    const outcome = text(value.outcome, `${name}.outcome`);
    if (outcome !== 'PASS') {
      throw new ImplementationConformanceError('CONFORMANCE_TEST_NOT_PASSING', 'only a complete all-PASS test set can mint QUALIFIED conformance authority');
    }
    return deepFreeze({
      testType,
      testId: text(value.testId, `${name}.testId`),
      definitionHash: hash(value.definitionHash, `${name}.definitionHash`),
      resultHash: hash(value.resultHash, `${name}.resultHash`),
      outcome
    });
  });
  const types = normalized.map((item) => item.testType);
  if (new Set(types).size !== types.length) throw new ImplementationConformanceError('DUPLICATE_CONFORMANCE_TEST_TYPE', 'one compatibility test per required type is allowed');
  for (const required of REQUIRED_COMPATIBILITY_TEST_TYPES) {
    if (!types.includes(required)) {
      throw new ImplementationConformanceError('INCOMPLETE_CONFORMANCE_TEST_SET', `required compatibility test ${required} is missing`);
    }
  }
  return deepFreeze([...normalized].sort((a, b) => a.testType.localeCompare(b.testType)));
}

function executionEnvironment(value) {
  exactObject(value, 'qualifiedExecutionEnvironment', new Set([
    'runtime', 'runtimeVersion', 'platform', 'architecture', 'runtimeEnvironments', 'requiredCapabilities'
  ]));
  const envs = stringSet(value.runtimeEnvironments, 'qualifiedExecutionEnvironment.runtimeEnvironments', { allowed: ENVIRONMENTS, nonEmpty: true });
  return deepFreeze({
    runtime: text(value.runtime, 'qualifiedExecutionEnvironment.runtime'),
    runtimeVersion: text(value.runtimeVersion, 'qualifiedExecutionEnvironment.runtimeVersion'),
    platform: text(value.platform, 'qualifiedExecutionEnvironment.platform'),
    architecture: text(value.architecture, 'qualifiedExecutionEnvironment.architecture'),
    runtimeEnvironments: envs,
    requiredCapabilities: stringSet(value.requiredCapabilities ?? [], 'qualifiedExecutionEnvironment.requiredCapabilities')
  });
}

function stringSet(values, name, { allowed = null, nonEmpty = false } = {}) {
  if (!Array.isArray(values)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_INPUT', `${name} must be an array`);
  if (nonEmpty && values.length === 0) throw new ImplementationConformanceError('INVALID_CONFORMANCE_INPUT', `${name} cannot be empty`);
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new ImplementationConformanceError('DUPLICATE_CONFORMANCE_VALUE', `${name} cannot contain duplicates`);
  if (allowed) for (const item of normalized) if (!allowed.has(item)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_ENUM', `${name} contains unsupported value ${item}`);
  return deepFreeze([...normalized].sort());
}

function validityInterval(value) {
  exactObject(value, 'validityInterval', new Set(['start', 'end']));
  const start = normalizeConformanceTimestamp(value.start, 'validityInterval.start');
  const end = normalizeConformanceTimestamp(value.end, 'validityInterval.end');
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_INTERVAL', 'validityInterval.end must be after start');
  }
  return deepFreeze({ start, end });
}

export function normalizeImplementationConformance(value) {
  exactObject(value, 'ImplementationConformance', new Set([
    'contractVersion', 'authorityClass', 'controlScope', 'specificationRef', 'implementationRef',
    'qualificationStatus', 'qualificationMethod', 'compatibilityTests', 'qualifiedInputSemanticsHash',
    'qualifiedOutputSemanticsHash', 'implementationDigest', 'artifactContentHash',
    'qualifiedExecutionEnvironment', 'knownLimitations', 'validityInterval'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== IMPLEMENTATION_CONFORMANCE_CONTRACT_VERSION) {
    throw new ImplementationConformanceError('UNSUPPORTED_CONFORMANCE_CONTRACT', 'unsupported ImplementationConformance contractVersion');
  }
  if (value.authorityClass !== undefined && value.authorityClass !== IMPLEMENTATION_CONFORMANCE_AUTHORITY_CLASS) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_AUTHORITY_CLASS', 'invalid authorityClass');
  }
  const specificationRef = assertAuthorityRef(value.specificationRef);
  if (!SPEC_KINDS.has(specificationRef.kind)) throw new ImplementationConformanceError('SPECIFICATION_REQUIRED', 'specificationRef must be QualifiedTransformation, Model, or Policy');
  const implementationRef = assertAuthorityRef(value.implementationRef);
  if (implementationRef.kind !== 'Implementation') throw new ImplementationConformanceError('IMPLEMENTATION_REQUIRED', 'implementationRef must be Implementation');
  if (text(value.qualificationStatus, 'qualificationStatus') !== IMPLEMENTATION_CONFORMANCE_STATUS) {
    throw new ImplementationConformanceError('CONFORMANCE_NOT_QUALIFIED', 'ImplementationConformance authority can only represent QUALIFIED relation');
  }
  return deepFreeze({
    contractVersion: IMPLEMENTATION_CONFORMANCE_CONTRACT_VERSION,
    authorityClass: IMPLEMENTATION_CONFORMANCE_AUTHORITY_CLASS,
    controlScope: controlScope(value.controlScope),
    specificationRef,
    implementationRef,
    qualificationStatus: IMPLEMENTATION_CONFORMANCE_STATUS,
    qualificationMethod: method(value.qualificationMethod),
    compatibilityTests: compatibilityTests(value.compatibilityTests),
    qualifiedInputSemanticsHash: hash(value.qualifiedInputSemanticsHash, 'qualifiedInputSemanticsHash'),
    qualifiedOutputSemanticsHash: hash(value.qualifiedOutputSemanticsHash, 'qualifiedOutputSemanticsHash'),
    implementationDigest: hash(value.implementationDigest, 'implementationDigest'),
    artifactContentHash: hash(value.artifactContentHash, 'artifactContentHash'),
    qualifiedExecutionEnvironment: executionEnvironment(value.qualifiedExecutionEnvironment),
    knownLimitations: stringSet(value.knownLimitations ?? [], 'knownLimitations'),
    validityInterval: validityInterval(value.validityInterval)
  });
}
