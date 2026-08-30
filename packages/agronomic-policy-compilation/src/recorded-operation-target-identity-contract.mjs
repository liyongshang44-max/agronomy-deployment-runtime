import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-target-identity-binding.v1';
export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-target-identity-binding-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_GRANULARITIES =
  deepFreeze(['FARM']);

export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_ROLES =
  deepFreeze([
    'SOURCE_NATIVE_IDENTIFIER_CONTEXT',
    'TARGET_GRANULARITY_MEANING'
  ]);

const GRANULARITIES =
  new Set(AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_GRANULARITIES);
const EVIDENCE_ROLES =
  new Set(AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_ROLES);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TARGET_ID_RE = /^target_src_[0-9a-f]{64}$/;

export class AgronomicRecordedOperationTargetIdentityBindingCompilationError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationTargetIdentityBindingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_FIELD',
        `${name}.${key} is not part of the target-identity contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUTHORITY_REF',
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
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_HASH',
      `${name} must be a sha256 semantic/content hash`
    );
  }
  return normalized;
}

function nonNegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BYTE_RANGE',
      `${name} must be a non-negative safe integer`
    );
  }
  return value;
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BYTE_RANGE',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeIdentifier(value, name) {
  exactObject(value, name, new Set(['name', 'value']));
  return deepFreeze({
    name: requiredText(value.name, `${name}.name`),
    value: requiredText(value.value, `${name}.value`)
  });
}

function normalizeByteRangeLocator(value, name) {
  exactObject(
    value,
    name,
    new Set(['kind', 'start', 'endExclusive', 'evidenceHash'])
  );
  if (value.kind !== 'BYTE_RANGE') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_LOCATOR',
      `${name}.kind must be BYTE_RANGE in v1`
    );
  }
  const start = nonNegativeSafeInteger(value.start, `${name}.start`);
  const endExclusive = positiveSafeInteger(
    value.endExclusive,
    `${name}.endExclusive`
  );
  if (endExclusive <= start) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BYTE_RANGE',
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
  const name = `identityEvidence[${index}]`;
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
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_ROLE',
      `${name}.evidenceRole has unsupported value ${evidenceRole}`
    );
  }
  return deepFreeze({
    evidenceRole,
    sourceRef: authorityRef(value.sourceRef, `${name}.sourceRef`, new Set(['Source'])),
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

function normalizeIdentityEvidence(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_REQUIRED',
      'identityEvidence must be a non-empty array'
    );
  }
  const normalized = values.map(normalizeEvidenceItem);
  const roles = normalized.map((item) => item.evidenceRole);
  if (new Set(roles).size !== roles.length) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_ROLE',
      'v1 identityEvidence must contain each evidence role at most once'
    );
  }
  for (const required of AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE_ROLES) {
    if (!roles.includes(required)) {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'INCOMPLETE_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE',
        `identityEvidence must include ${required}`
      );
    }
  }
  return deepFreeze(
    [...normalized].sort((a, b) => a.evidenceRole.localeCompare(b.evidenceRole))
  );
}

export function deriveAgronomicRecordedOperationSourceBackedTargetId({
  namespaceRef,
  identifierName,
  identifierValue,
  granularity
}) {
  const normalizedNamespace = authorityRef(
    namespaceRef,
    'namespaceRef',
    new Set(['Source'])
  );
  const normalizedGranularity = requiredText(granularity, 'granularity');
  if (!GRANULARITIES.has(normalizedGranularity)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_GRANULARITY',
      `v1 target granularity must be one of: ${[...GRANULARITIES].join(', ')}`
    );
  }
  const digest = semanticHash(
    'AgronomicRecordedOperationSourceBackedTargetIdentityKey',
    {
      identityContractVersion:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
      namespaceRef: normalizedNamespace,
      sourceNativeIdentifier: {
        name: requiredText(identifierName, 'identifierName'),
        value: requiredText(identifierValue, 'identifierValue')
      },
      granularity: normalizedGranularity
    }
  );
  return `target_src_${digest.slice('sha256:'.length)}`;
}

export function normalizeAgronomicRecordedOperationTargetIdentityBinding(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationTargetIdentityBinding',
    new Set([
      'contractVersion',
      'bindingId',
      'parentOccurrenceCompilationRef',
      'sourceNativeSubject',
      'sourceBackedTargetIdentity',
      'identityEvidence',
      'applicability',
      'transformationRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_CONTRACT',
      'unsupported target-identity binding contractVersion'
    );
  }

  const sourceNativeSubject =
    normalizeIdentifier(value.sourceNativeSubject, 'sourceNativeSubject');

  exactObject(
    value.sourceBackedTargetIdentity,
    'sourceBackedTargetIdentity',
    new Set(['namespaceRef', 'granularity', 'targetId'])
  );
  const namespaceRef = authorityRef(
    value.sourceBackedTargetIdentity.namespaceRef,
    'sourceBackedTargetIdentity.namespaceRef',
    new Set(['Source'])
  );
  const granularity = requiredText(
    value.sourceBackedTargetIdentity.granularity,
    'sourceBackedTargetIdentity.granularity'
  );
  if (!GRANULARITIES.has(granularity)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_GRANULARITY',
      'v1 source-backed target granularity must be FARM'
    );
  }
  const targetId = requiredText(
    value.sourceBackedTargetIdentity.targetId,
    'sourceBackedTargetIdentity.targetId'
  );
  if (!TARGET_ID_RE.test(targetId)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SOURCE_BACKED_TARGET_ID',
      'sourceBackedTargetIdentity.targetId must be target_src_<64hex>'
    );
  }
  const expectedTargetId =
    deriveAgronomicRecordedOperationSourceBackedTargetId({
      namespaceRef,
      identifierName: sourceNativeSubject.name,
      identifierValue: sourceNativeSubject.value,
      granularity
    });
  if (targetId !== expectedTargetId) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SOURCE_BACKED_TARGET_ID_MISMATCH',
      'targetId must be derived only from exact source namespace, source-native identifier, granularity and contract version'
    );
  }

  exactObject(
    value.applicability,
    'applicability',
    new Set([
      'appliesToOccurrenceSourceRef',
      'appliesToSourceNativeIdentifier'
    ])
  );

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: requiredText(value.bindingId, 'bindingId'),
    parentOccurrenceCompilationRef: authorityRef(
      value.parentOccurrenceCompilationRef,
      'parentOccurrenceCompilationRef',
      new Set(['AgronomicRecordedOperationOccurrenceCompilation'])
    ),
    sourceNativeSubject,
    sourceBackedTargetIdentity: deepFreeze({
      namespaceRef,
      granularity,
      targetId
    }),
    identityEvidence: normalizeIdentityEvidence(value.identityEvidence),
    applicability: deepFreeze({
      appliesToOccurrenceSourceRef: authorityRef(
        value.applicability.appliesToOccurrenceSourceRef,
        'applicability.appliesToOccurrenceSourceRef',
        new Set(['Source'])
      ),
      appliesToSourceNativeIdentifier: normalizeIdentifier(
        value.applicability.appliesToSourceNativeIdentifier,
        'applicability.appliesToSourceNativeIdentifier'
      )
    }),
    transformationRationale: requiredText(
      value.transformationRationale,
      'transformationRationale'
    )
  });
}

export function agronomicRecordedOperationTargetIdentityBindingHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationTargetIdentityBinding',
    normalizeAgronomicRecordedOperationTargetIdentityBinding(value)
  );
}

export function normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(
  value
) {
  exactObject(
    value,
    'AgronomicRecordedOperationTargetIdentityBindingCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'binding',
      'bindingHash',
      'identityReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COMPILATION_CONTRACT',
      'unsupported target-identity binding compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY'
    );
  }

  const binding = normalizeAgronomicRecordedOperationTargetIdentityBinding(
    value.binding
  );
  const bindingHash = hashValue(value.bindingHash, 'bindingHash');
  const expectedHash =
    agronomicRecordedOperationTargetIdentityBindingHash(binding);
  if (bindingHash !== expectedHash) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_HASH_MISMATCH',
      'bindingHash must exactly match normalized target identity binding'
    );
  }

  const identityReviewRef = authorityRef(
    value.identityReviewRef,
    'identityReviewRef',
    new Set(['AgronomicRecordedOperationTargetIdentityBindingReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COVERAGE',
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
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COVERAGE',
      'COMPLETE targeted identity coverage cannot declare unrepresented elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COVERAGE',
      'INCOMPLETE targeted identity coverage must name unrepresented elements'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash,
    identityReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationTargetIdentityBindingCompilationAuthorityRefs(
  value
) {
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(value);
  const refs = [
    normalized.binding.parentOccurrenceCompilationRef,
    normalized.binding.sourceBackedTargetIdentity.namespaceRef,
    normalized.binding.applicability.appliesToOccurrenceSourceRef,
    ...normalized.binding.identityEvidence.flatMap((item) => [
      item.sourceRef,
      item.sourceArtifactRef
    ]),
    normalized.identityReviewRef
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze(
    [...unique.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)))
  );
}
