import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-provider-identity-binding.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-provider-identity-binding-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID =
  'github.com/isudatateam/datateam';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR =
  'https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_FIELD',
        `${name}.${key} is not part of the provider-identity binding contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function calendarDate(value, name) {
  const text = requiredText(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_DATE',
      `${name} must be YYYY-MM-DD`
    );
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_DATE',
      `${name} must be a real calendar date`
    );
  }
  return text;
}

function normalizeValueSource(value) {
  exactObject(
    value,
    'valueSource',
    new Set(['sourceRef', 'sourceArtifactRef', 'sourceArtifactContentHash'])
  );
  return deepFreeze({
    sourceRef: authorityRef(value.sourceRef, 'valueSource.sourceRef', new Set(['Source'])),
    sourceArtifactRef: authorityRef(
      value.sourceArtifactRef,
      'valueSource.sourceArtifactRef',
      new Set(['SourceArtifact'])
    ),
    sourceArtifactContentHash: hashValue(
      value.sourceArtifactContentHash,
      'valueSource.sourceArtifactContentHash'
    )
  });
}

function normalizeSourceNamespaceEvidence(value) {
  exactObject(
    value,
    'sourceNamespaceEvidence',
    new Set(['exactOriginLocator'])
  );
  const exactOriginLocator = requiredText(
    value.exactOriginLocator,
    'sourceNamespaceEvidence.exactOriginLocator'
  );
  if (exactOriginLocator
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_ORIGIN_LOCATOR',
      'v1 supports only the exact first Sustainable Corn occurrence origin locator'
    );
  }
  return deepFreeze({ exactOriginLocator });
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = calendarDate(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_TARGET_SEMANTIC',
      'v1 supports only crop.planting_date with DATE value'
    );
  }
  return deepFreeze({
    semanticId,
    value: deepFreeze({ type, date })
  });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceProviderIdentityBinding',
    new Set([
      'contractVersion',
      'bindingId',
      'contextProvenanceClassificationCompilationRef',
      'valueSource',
      'sourceNamespaceEvidence',
      'targetContextSemantic',
      'epistemicClass',
      'provenanceClass',
      'providerId',
      'bindingRationale'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT',
      'unsupported provider-identity binding contractVersion'
    );
  }

  const epistemicClass = requiredText(value.epistemicClass, 'epistemicClass');
  if (epistemicClass !== 'ASSERTION') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_EPISTEMIC_CLASS',
      'v1 provider identity binding preserves only ASSERTION'
    );
  }

  const provenanceClass = requiredText(value.provenanceClass, 'provenanceClass');
  if (provenanceClass !== 'EXTERNAL_PROVIDER') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_PROVENANCE_CLASS',
      'v1 provider identity binding preserves only EXTERNAL_PROVIDER'
    );
  }

  const providerId = requiredText(value.providerId, 'providerId');
  if (providerId
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_PROVIDER_ID',
      `v1 supports only providerId ${AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID}`
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: requiredText(value.bindingId, 'bindingId'),
    contextProvenanceClassificationCompilationRef: authorityRef(
      value.contextProvenanceClassificationCompilationRef,
      'contextProvenanceClassificationCompilationRef',
      new Set(['AgronomicRecordedOperationContextProvenanceClassificationCompilation'])
    ),
    valueSource: normalizeValueSource(value.valueSource),
    sourceNamespaceEvidence:
      normalizeSourceNamespaceEvidence(value.sourceNamespaceEvidence),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    epistemicClass,
    provenanceClass,
    providerId,
    bindingRationale: requiredText(value.bindingRationale, 'bindingRationale')
  });
}

export function agronomicRecordedOperationContextSourceProviderIdentityBindingHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextSourceProviderIdentityBinding',
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(value)
  );
}

export function normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'binding',
      'bindingHash',
      'providerIdentityReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT',
      'unsupported provider-identity binding compilation contractVersion'
    );
  }

  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY'
    );
  }

  const binding =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(value.binding);
  const bindingHash = hashValue(value.bindingHash, 'bindingHash');
  if (bindingHash
      !== agronomicRecordedOperationContextSourceProviderIdentityBindingHash(binding)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_HASH_MISMATCH',
      'bindingHash must exactly match normalized provider-identity binding'
    );
  }

  const providerIdentityReviewRef = authorityRef(
    value.providerIdentityReviewRef,
    'providerIdentityReviewRef',
    new Set(['AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COVERAGE',
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
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COVERAGE',
      'COMPLETE provider-identity coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COVERAGE',
      'INCOMPLETE provider-identity coverage must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash,
    providerIdentityReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(value);
  return deepFreeze([
    normalized.binding.contextProvenanceClassificationCompilationRef,
    normalized.binding.valueSource.sourceRef,
    normalized.binding.valueSource.sourceArtifactRef,
    normalized.providerIdentityReviewRef
  ]);
}
