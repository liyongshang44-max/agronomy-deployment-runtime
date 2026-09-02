import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION =
  'adr.agronomic-context-source-acquisition-availability-projection.v1';
export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-source-acquisition-availability-projection-compilation.v1';

export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP =
  '2026-08-30T13:00:00.000Z';
export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD =
  'REPOSITORY_RETAINED_PUBLIC_GOLD';
export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS =
  'VALUE_SOURCE_ARTIFACT_ACQUISITION';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_FIELD',
        `${name}.${key} is not part of the source-acquisition availability projection contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = requiredText(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE' || date !== '2011-05-03') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
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

function normalizeSourceArtifactAcquisition(value) {
  exactObject(
    value,
    'sourceArtifactAcquisition',
    new Set(['method', 'acquiredAt'])
  );
  const method = requiredText(value.method, 'sourceArtifactAcquisition.method');
  const acquiredAt = requiredText(
    value.acquiredAt,
    'sourceArtifactAcquisition.acquiredAt'
  );
  if (method !== AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_METHOD',
      'v1 supports only the exact first SourceArtifact acquisition method'
    );
  }
  if (acquiredAt !== AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_TIMESTAMP',
      'v1 supports only the exact first value-source artifact acquisition timestamp'
    );
  }
  return deepFreeze({ method, acquiredAt });
}

function normalizeAvailableAtProjection(value, acquisition) {
  exactObject(value, 'availableAtProjection', new Set(['basis', 'availableAt']));
  const basis = requiredText(value.basis, 'availableAtProjection.basis');
  const availableAt = requiredText(value.availableAt, 'availableAtProjection.availableAt');
  if (basis !== AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS',
      'v1 supports only VALUE_SOURCE_ARTIFACT_ACQUISITION'
    );
  }
  if (availableAt !== acquisition.acquiredAt) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_VALUE_MISMATCH',
      'availableAt must exactly equal sourceArtifactAcquisition.acquiredAt'
    );
  }
  return deepFreeze({ basis, availableAt });
}

export function normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(value) {
  exactObject(
    value,
    'AgronomicContextSourceAcquisitionAvailabilityProjection',
    new Set([
      'contractVersion',
      'projectionId',
      'parentSourceReferenceHashProjectionCompilationRef',
      'targetContextSemantic',
      'valueSource',
      'sourceArtifactAcquisition',
      'availableAtProjection',
      'rationale'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT',
      'unsupported source-acquisition availability projection contractVersion'
    );
  }

  const sourceArtifactAcquisition =
    normalizeSourceArtifactAcquisition(value.sourceArtifactAcquisition);

  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
    projectionId: requiredText(value.projectionId, 'projectionId'),
    parentSourceReferenceHashProjectionCompilationRef: authorityRef(
      value.parentSourceReferenceHashProjectionCompilationRef,
      'parentSourceReferenceHashProjectionCompilationRef',
      new Set([
        'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation'
      ])
    ),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    valueSource: normalizeValueSource(value.valueSource),
    sourceArtifactAcquisition,
    availableAtProjection: normalizeAvailableAtProjection(
      value.availableAtProjection,
      sourceArtifactAcquisition
    ),
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextSourceAcquisitionAvailabilityProjectionHash(value) {
  return semanticHash(
    'AgronomicContextSourceAcquisitionAvailabilityProjection',
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(value)
  );
}

export function normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(value) {
  exactObject(
    value,
    'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'projection',
      'projectionHash',
      'availabilityProjectionReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT',
      'unsupported source-acquisition availability projection compilation contractVersion'
    );
  }
  if (
    value.authorityClass
      !== 'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_AUTHORITY'
  ) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUTHORITY',
      'invalid source-acquisition availability projection authorityClass'
    );
  }

  const projection =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(value.projection);
  const projectionHash = hashValue(value.projectionHash, 'projectionHash');
  if (
    projectionHash !==
      agronomicContextSourceAcquisitionAvailabilityProjectionHash(projection)
  ) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_HASH_MISMATCH',
      'projectionHash must exactly match normalized projection'
    );
  }

  const availabilityProjectionReviewRef = authorityRef(
    value.availabilityProjectionReviewRef,
    'availabilityProjectionReviewRef',
    new Set([
      'AgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision'
    ])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COVERAGE',
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
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COVERAGE',
      'COMPLETE projection cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COVERAGE',
      'INCOMPLETE projection must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash,
    availabilityProjectionReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(value);
  return deepFreeze([
    normalized.projection.parentSourceReferenceHashProjectionCompilationRef,
    normalized.projection.valueSource.sourceRef,
    normalized.projection.valueSource.sourceArtifactRef,
    normalized.availabilityProjectionReviewRef
  ]);
}
