import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-reference-hash-projection.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-source-reference-hash-projection-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID =
  'github.com/isudatateam/datateam';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF =
  'blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_FIELD',
        `${name}.${key} is not part of the source-reference/hash projection contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COORDINATE',
      `${name} must be a non-negative safe integer`
    );
  }
  return value;
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

function normalizeColumns(values) {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COORDINATE',
      'sourceLocator.coordinates.columns must contain exactly the three first-Gold evidence columns'
    );
  }
  const normalized = values.map((value, index) => {
    exactObject(value, `sourceLocator.coordinates.columns[${index}]`, new Set(['role', 'name']));
    return deepFreeze({
      role: requiredText(value.role, `sourceLocator.coordinates.columns[${index}].role`),
      name: requiredText(value.name, `sourceLocator.coordinates.columns[${index}].name`)
    });
  });
  const expected = [
    { role: 'SOURCE_NATIVE_SUBJECT', name: 'siteid' },
    { role: 'SOURCE_OPERATION_CODE', name: 'operation' },
    { role: 'TEMPORAL_SUPPORT', name: 'date' }
  ];
  if (JSON.stringify(normalized) !== JSON.stringify(expected)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COLUMNS',
      'v1 supports only the exact first Sustainable Corn evidence columns'
    );
  }
  return deepFreeze(normalized);
}

function normalizeSourceLocator(value) {
  exactObject(value, 'sourceLocator', new Set(['kind', 'scheme', 'coordinates', 'evidenceHash']));
  if (requiredText(value.kind, 'sourceLocator.kind') !== 'DOCUMENT_COORDINATE') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_LOCATOR',
      'v1 supports only DOCUMENT_COORDINATE'
    );
  }
  if (requiredText(value.scheme, 'sourceLocator.scheme') !== 'JUPYTER_OUTPUT_TABLE_ROW_V1') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_LOCATOR',
      'v1 supports only JUPYTER_OUTPUT_TABLE_ROW_V1'
    );
  }
  exactObject(
    value.coordinates,
    'sourceLocator.coordinates',
    new Set([
      'cellIndex',
      'outputIndex',
      'mimeType',
      'headerLineIndex',
      'rowIndex',
      'columns'
    ])
  );
  const coordinates = deepFreeze({
    cellIndex: integer(value.coordinates.cellIndex, 'sourceLocator.coordinates.cellIndex'),
    outputIndex: integer(value.coordinates.outputIndex, 'sourceLocator.coordinates.outputIndex'),
    mimeType: requiredText(value.coordinates.mimeType, 'sourceLocator.coordinates.mimeType'),
    headerLineIndex: integer(
      value.coordinates.headerLineIndex,
      'sourceLocator.coordinates.headerLineIndex'
    ),
    rowIndex: requiredText(value.coordinates.rowIndex, 'sourceLocator.coordinates.rowIndex'),
    columns: normalizeColumns(value.coordinates.columns)
  });
  if (
    coordinates.cellIndex !== 3
    || coordinates.outputIndex !== 0
    || coordinates.mimeType !== 'text/plain'
    || coordinates.headerLineIndex !== 0
    || coordinates.rowIndex !== '33'
  ) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COORDINATES',
      'v1 supports only the exact first Sustainable Corn persisted row coordinates'
    );
  }
  return deepFreeze({
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
    coordinates,
    evidenceHash: hashValue(value.evidenceHash, 'sourceLocator.evidenceHash')
  });
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = requiredText(value.value.date, 'targetContextSemantic.value.date');
  if (
    semanticId !== 'crop.planting_date'
    || type !== 'DATE'
    || date !== '2011-05-03'
  ) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
}

function normalizeProjectedSource(value, evidenceHash) {
  exactObject(value, 'projectedSource', new Set(['sourceRef', 'contentHash']));
  const sourceRef = requiredText(value.sourceRef, 'projectedSource.sourceRef');
  if (sourceRef !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_SOURCE_REF',
      'v1 supports only the exact first fact-level public sourceRef'
    );
  }
  const contentHash = hashValue(value.contentHash, 'projectedSource.contentHash');
  if (contentHash !== evidenceHash) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTENT_HASH_MISMATCH',
      'public projectedSource.contentHash must equal exact sourceLocator.evidenceHash'
    );
  }
  return deepFreeze({ sourceRef, contentHash });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceReferenceHashProjection',
    new Set([
      'contractVersion',
      'projectionId',
      'sourceProviderIdentityBindingCompilationRef',
      'providerId',
      'valueSource',
      'sourceLocator',
      'projectedSource',
      'targetContextSemantic',
      'epistemicClass',
      'provenanceClass',
      'projectionRationale'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT',
      'unsupported source-reference/hash projection contractVersion'
    );
  }

  const providerId = requiredText(value.providerId, 'providerId');
  if (providerId !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_PROVIDER_ID',
      'v1 preserves only providerId github.com/isudatateam/datateam'
    );
  }
  const epistemicClass = requiredText(value.epistemicClass, 'epistemicClass');
  if (epistemicClass !== 'ASSERTION') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_EPISTEMIC_CLASS',
      'v1 preserves only ASSERTION'
    );
  }
  const provenanceClass = requiredText(value.provenanceClass, 'provenanceClass');
  if (provenanceClass !== 'EXTERNAL_PROVIDER') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_PROVENANCE_CLASS',
      'v1 preserves only EXTERNAL_PROVIDER'
    );
  }

  const sourceLocator = normalizeSourceLocator(value.sourceLocator);

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION,
    projectionId: requiredText(value.projectionId, 'projectionId'),
    sourceProviderIdentityBindingCompilationRef: authorityRef(
      value.sourceProviderIdentityBindingCompilationRef,
      'sourceProviderIdentityBindingCompilationRef',
      new Set(['AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation'])
    ),
    providerId,
    valueSource: normalizeValueSource(value.valueSource),
    sourceLocator,
    projectedSource: normalizeProjectedSource(value.projectedSource, sourceLocator.evidenceHash),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    epistemicClass,
    provenanceClass,
    projectionRationale: requiredText(value.projectionRationale, 'projectionRationale')
  });
}

export function agronomicRecordedOperationContextSourceReferenceHashProjectionHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextSourceReferenceHashProjection',
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value)
  );
}

export function normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'projection',
      'projectionHash',
      'sourceReferenceReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT',
      'unsupported source-reference/hash projection compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_AUTHORITY',
      'invalid source-reference/hash projection authorityClass'
    );
  }
  const projection =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value.projection);
  const projectionHash = hashValue(value.projectionHash, 'projectionHash');
  if (projectionHash
      !== agronomicRecordedOperationContextSourceReferenceHashProjectionHash(projection)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_HASH_MISMATCH',
      'projectionHash must exactly match normalized projection'
    );
  }
  const sourceReferenceReviewRef = authorityRef(
    value.sourceReferenceReviewRef,
    'sourceReferenceReviewRef',
    new Set(['AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COVERAGE',
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
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COVERAGE',
      'COMPLETE projection coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COVERAGE',
      'INCOMPLETE projection coverage must name at least one unrepresented targeted element'
    );
  }
  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash,
    sourceReferenceReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(value);
  return deepFreeze([
    normalized.projection.sourceProviderIdentityBindingCompilationRef,
    normalized.projection.valueSource.sourceRef,
    normalized.projection.valueSource.sourceArtifactRef,
    normalized.sourceReferenceReviewRef
  ]);
}
