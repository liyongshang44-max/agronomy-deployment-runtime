import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-native-timezone-identity-binding.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-native-timezone-identity-binding-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLES =
  deepFreeze([
    'DECAGON_SITE_TIMEZONE_IDENTITY',
    'WATERTABLE_SITE_TIMEZONE_IDENTITY'
  ]);

const EVIDENCE_ROLES =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLES);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_FIELD',
        `${name}.${key} is not part of the source-native timezone identity binding contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([
    value.kind,
    value.logicalId,
    value.version,
    value.semanticHash
  ]);
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function nonNegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_BYTE_RANGE',
      `${name} must be a non-negative safe integer`
    );
  }
  return value;
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_BYTE_RANGE',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeSourceNativeSubject(value) {
  exactObject(value, 'sourceNativeSubject', new Set(['name', 'value']));
  const normalized = deepFreeze({
    name: requiredText(value.name, 'sourceNativeSubject.name'),
    value: requiredText(value.value, 'sourceNativeSubject.value')
  });
  if (normalized.name !== 'siteid' || normalized.value !== 'SERF') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_SUBJECT',
      'v1 supports only source-native subject siteid = SERF'
    );
  }
  return normalized;
}

function normalizeByteRangeLocator(value, name) {
  exactObject(
    value,
    name,
    new Set(['kind', 'start', 'endExclusive', 'evidenceHash'])
  );
  if (value.kind !== 'BYTE_RANGE') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_LOCATOR',
      `${name}.kind must be BYTE_RANGE in v1`
    );
  }
  const start = nonNegativeSafeInteger(value.start, `${name}.start`);
  const endExclusive = positiveSafeInteger(
    value.endExclusive,
    `${name}.endExclusive`
  );
  if (endExclusive <= start) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_BYTE_RANGE',
      `${name}.endExclusive must be greater than start`
    );
  }
  return deepFreeze({
    kind: 'BYTE_RANGE',
    start,
    endExclusive,
    evidenceHash: hashValue(value.evidenceHash, `${name}.evidenceHash`)
  });
}

function normalizeEvidenceItem(value, index) {
  const name = `timezoneEvidence[${index}]`;
  exactObject(
    value,
    name,
    new Set([
      'evidenceRole',
      'sourceRef',
      'sourceArtifactRef',
      'sourceArtifactContentHash',
      'sourceLocator'
    ])
  );
  const evidenceRole = requiredText(value.evidenceRole, `${name}.evidenceRole`);
  if (!EVIDENCE_ROLES.has(evidenceRole)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLE',
      `${name}.evidenceRole has unsupported value ${evidenceRole}`
    );
  }
  return deepFreeze({
    evidenceRole,
    sourceRef: authorityRef(
      value.sourceRef,
      `${name}.sourceRef`,
      new Set(['Source'])
    ),
    sourceArtifactRef: authorityRef(
      value.sourceArtifactRef,
      `${name}.sourceArtifactRef`,
      new Set(['SourceArtifact'])
    ),
    sourceArtifactContentHash: hashValue(
      value.sourceArtifactContentHash,
      `${name}.sourceArtifactContentHash`
    ),
    sourceLocator: normalizeByteRangeLocator(
      value.sourceLocator,
      `${name}.sourceLocator`
    )
  });
}

function normalizeTimezoneEvidence(values) {
  if (!Array.isArray(values) || values.length !== 2) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_REQUIRED',
      'v1 timezoneEvidence must contain exactly two reviewed evidence items'
    );
  }
  const normalized = values.map(normalizeEvidenceItem);
  const roles = normalized.map((item) => item.evidenceRole);
  if (new Set(roles).size !== roles.length) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLE',
      'v1 timezoneEvidence must contain each evidence role exactly once'
    );
  }
  for (const required of AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLES) {
    if (!roles.includes(required)) {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'INCOMPLETE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE',
        `timezoneEvidence must include ${required}`
      );
    }
  }
  return deepFreeze(
    [...normalized].sort((a, b) => a.evidenceRole.localeCompare(b.evidenceRole))
  );
}

function normalizeSourceTimezone(value) {
  exactObject(value, 'sourceTimezone', new Set(['scheme', 'zoneId']));
  const scheme = requiredText(value.scheme, 'sourceTimezone.scheme');
  const zoneId = requiredText(value.zoneId, 'sourceTimezone.zoneId');
  if (scheme !== 'IANA' || zoneId !== 'America/Chicago') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY',
      'v1 supports only IANA / America/Chicago'
    );
  }
  return deepFreeze({ scheme, zoneId });
}

export function normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding',
    new Set([
      'contractVersion',
      'bindingId',
      'temporalSupportClassificationCompilationRef',
      'targetIdentityBindingCompilationRef',
      'sourceNativeSubject',
      'timezoneEvidence',
      'sourceTimezone',
      'bindingRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT',
      'unsupported source-native timezone identity binding contractVersion'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: requiredText(value.bindingId, 'bindingId'),
    temporalSupportClassificationCompilationRef: authorityRef(
      value.temporalSupportClassificationCompilationRef,
      'temporalSupportClassificationCompilationRef',
      new Set([
        'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation'
      ])
    ),
    targetIdentityBindingCompilationRef: authorityRef(
      value.targetIdentityBindingCompilationRef,
      'targetIdentityBindingCompilationRef',
      new Set(['AgronomicRecordedOperationTargetIdentityBindingCompilation'])
    ),
    sourceNativeSubject: normalizeSourceNativeSubject(value.sourceNativeSubject),
    timezoneEvidence: normalizeTimezoneEvidence(value.timezoneEvidence),
    sourceTimezone: normalizeSourceTimezone(value.sourceTimezone),
    bindingRationale: requiredText(value.bindingRationale, 'bindingRationale')
  });
}

export function agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding',
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(value)
  );
}

export function normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'binding',
      'bindingHash',
      'timezoneReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT',
      'unsupported source-native timezone identity binding compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY',
      'invalid source-native timezone identity binding authorityClass'
    );
  }

  const binding =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
      value.binding
    );
  const bindingHash = hashValue(value.bindingHash, 'bindingHash');
  const expectedHash =
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(binding);
  if (bindingHash !== expectedHash) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_HASH_MISMATCH',
      'bindingHash must exactly match normalized source-native timezone identity binding'
    );
  }

  const timezoneReviewRef = authorityRef(
    value.timezoneReviewRef,
    'timezoneReviewRef',
    new Set([
      'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision'
    ])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(
    value.losslessCoverage.coveredElements ?? [],
    'losslessCoverage.coveredElements'
  );
  const unrepresentedElements = stringList(
    value.losslessCoverage.unrepresentedElements ?? [],
    'losslessCoverage.unrepresentedElements'
  );
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COVERAGE',
      'COMPLETE timezone identity binding cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COVERAGE',
      'INCOMPLETE timezone identity binding must name unrepresented targeted elements'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash,
    timezoneReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
      value
    );
  const refs = [
    normalized.binding.temporalSupportClassificationCompilationRef,
    normalized.binding.targetIdentityBindingCompilationRef,
    ...normalized.binding.timezoneEvidence.flatMap((item) => [
      item.sourceRef,
      item.sourceArtifactRef
    ]),
    normalized.timezoneReviewRef
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze(
    [...unique.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)))
  );
}
