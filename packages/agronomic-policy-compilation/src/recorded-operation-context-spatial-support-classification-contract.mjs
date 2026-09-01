import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-spatial-support-classification.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-spatial-support-classification-compilation.v1';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_FIELD',
        `${name}.${key} is not part of the spatial-support classification contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_VALUE',
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
}

function normalizeSourceNativeSubject(value) {
  exactObject(value, 'sourceNativeSubject', new Set(['name', 'value']));
  const normalized = deepFreeze({
    name: requiredText(value.name, 'sourceNativeSubject.name'),
    value: requiredText(value.value, 'sourceNativeSubject.value')
  });
  if (normalized.name !== 'siteid' || normalized.value !== 'SERF') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_SUBJECT',
      'v1 supports only source-native subject siteid = SERF'
    );
  }
  return normalized;
}

function normalizeSourceBackedTargetIdentity(value) {
  exactObject(
    value,
    'sourceBackedTargetIdentity',
    new Set(['granularity', 'targetId'])
  );
  const granularity = requiredText(
    value.granularity,
    'sourceBackedTargetIdentity.granularity'
  );
  const targetId = requiredText(value.targetId, 'sourceBackedTargetIdentity.targetId');
  if (granularity !== 'FARM') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TARGET_GRANULARITY',
      'v1 supports only source-backed target granularity FARM'
    );
  }
  return deepFreeze({ granularity, targetId });
}

function normalizeSpatialSupport(value) {
  exactObject(value, 'spatialSupport', new Set(['type']));
  const type = requiredText(value.type, 'spatialSupport.type');
  if (type !== 'FARM') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TYPE',
      'v1 supports only spatialSupport.type = FARM'
    );
  }
  return deepFreeze({ type });
}

export function normalizeAgronomicRecordedOperationContextSpatialSupportClassification(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSpatialSupportClassification',
    new Set([
      'contractVersion',
      'classificationId',
      'contextSemanticMappingCompilationRef',
      'targetIdentityBindingCompilationRef',
      'targetContextSemantic',
      'sourceNativeSubject',
      'sourceBackedTargetIdentity',
      'spatialSupport',
      'classificationRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT',
      'unsupported spatial-support classification contractVersion'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: requiredText(value.classificationId, 'classificationId'),
    contextSemanticMappingCompilationRef: authorityRef(
      value.contextSemanticMappingCompilationRef,
      'contextSemanticMappingCompilationRef',
      new Set(['AgronomicRecordedOperationContextSemanticMappingCompilation'])
    ),
    targetIdentityBindingCompilationRef: authorityRef(
      value.targetIdentityBindingCompilationRef,
      'targetIdentityBindingCompilationRef',
      new Set(['AgronomicRecordedOperationTargetIdentityBindingCompilation'])
    ),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    sourceNativeSubject: normalizeSourceNativeSubject(value.sourceNativeSubject),
    sourceBackedTargetIdentity:
      normalizeSourceBackedTargetIdentity(value.sourceBackedTargetIdentity),
    spatialSupport: normalizeSpatialSupport(value.spatialSupport),
    classificationRationale: requiredText(
      value.classificationRationale,
      'classificationRationale'
    )
  });
}

export function agronomicRecordedOperationContextSpatialSupportClassificationHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextSpatialSupportClassification',
    normalizeAgronomicRecordedOperationContextSpatialSupportClassification(value)
  );
}

export function normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'classification',
      'classificationHash',
      'spatialSupportReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT',
      'unsupported spatial-support classification compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUTHORITY',
      'invalid spatial-support classification authorityClass'
    );
  }

  const classification =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
      value.classification
    );
  const classificationHash = hashValue(value.classificationHash, 'classificationHash');
  if (classificationHash
      !== agronomicRecordedOperationContextSpatialSupportClassificationHash(classification)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_HASH_MISMATCH',
      'classificationHash must exactly match normalized spatial-support classification'
    );
  }

  const spatialSupportReviewRef = authorityRef(
    value.spatialSupportReviewRef,
    'spatialSupportReviewRef',
    new Set([
      'AgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision'
    ])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COVERAGE',
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COVERAGE',
      'COMPLETE spatial-support classification cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COVERAGE',
      'INCOMPLETE spatial-support classification must name unrepresented targeted elements'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash,
    spatialSupportReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(value);
  return deepFreeze([
    normalized.classification.contextSemanticMappingCompilationRef,
    normalized.classification.targetIdentityBindingCompilationRef,
    normalized.spatialSupportReviewRef
  ]);
}
