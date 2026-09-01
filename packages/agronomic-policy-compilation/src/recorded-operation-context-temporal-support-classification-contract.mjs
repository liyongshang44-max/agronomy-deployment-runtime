import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-temporal-support-classification.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-temporal-support-classification-compilation.v1';

export class AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_FIELD',
        `${name}.${key} is not part of the temporal-support classification contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function normalizeSourceTemporalSupport(value) {
  exactObject(
    value,
    'sourceTemporalSupport',
    new Set(['kind', 'date', 'precision'])
  );
  const kind = requiredText(value.kind, 'sourceTemporalSupport.kind');
  const date = requiredText(value.date, 'sourceTemporalSupport.date');
  const precision = requiredText(value.precision, 'sourceTemporalSupport.precision');
  if (kind !== 'CALENDAR_DATE' || date !== '2011-05-03' || precision !== 'DAY') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_SOURCE',
      'v1 supports only CALENDAR_DATE / 2011-05-03 / DAY'
    );
  }
  return deepFreeze({ kind, date, precision });
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = requiredText(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE' || date !== '2011-05-03') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
}

function normalizeTargetTemporalSupport(value) {
  exactObject(value, 'temporalSupport', new Set(['type']));
  const type = requiredText(value.type, 'temporalSupport.type');
  if (type !== 'INTERVAL') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TYPE',
      'v1 supports only temporalSupport.type = INTERVAL'
    );
  }
  return deepFreeze({ type });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicRecordedOperationContextTemporalSupportClassification(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextTemporalSupportClassification',
    new Set([
      'contractVersion',
      'classificationId',
      'sourceReferenceHashProjectionCompilationRef',
      'sourceTemporalSupport',
      'targetContextSemantic',
      'temporalSupport',
      'classificationRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT',
      'unsupported temporal-support classification contractVersion'
    );
  }
  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: requiredText(value.classificationId, 'classificationId'),
    sourceReferenceHashProjectionCompilationRef: authorityRef(
      value.sourceReferenceHashProjectionCompilationRef,
      'sourceReferenceHashProjectionCompilationRef',
      new Set(['AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation'])
    ),
    sourceTemporalSupport: normalizeSourceTemporalSupport(value.sourceTemporalSupport),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    temporalSupport: normalizeTargetTemporalSupport(value.temporalSupport),
    classificationRationale: requiredText(
      value.classificationRationale,
      'classificationRationale'
    )
  });
}

export function agronomicRecordedOperationContextTemporalSupportClassificationHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextTemporalSupportClassification',
    normalizeAgronomicRecordedOperationContextTemporalSupportClassification(value)
  );
}

export function normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'classification',
      'classificationHash',
      'temporalSupportReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT',
      'unsupported temporal-support classification compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_AUTHORITY',
      'invalid temporal-support classification authorityClass'
    );
  }
  const classification =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassification(value.classification);
  const classificationHash = hashValue(value.classificationHash, 'classificationHash');
  if (classificationHash
      !== agronomicRecordedOperationContextTemporalSupportClassificationHash(classification)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_HASH_MISMATCH',
      'classificationHash must exactly match normalized classification'
    );
  }
  const temporalSupportReviewRef = authorityRef(
    value.temporalSupportReviewRef,
    'temporalSupportReviewRef',
    new Set(['AgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision'])
  );
  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COVERAGE',
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
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COVERAGE',
      'COMPLETE temporal-support classification cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COVERAGE',
      'INCOMPLETE temporal-support classification must name at least one unrepresented targeted element'
    );
  }
  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash,
    temporalSupportReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(value);
  return deepFreeze([
    normalized.classification.sourceReferenceHashProjectionCompilationRef,
    normalized.temporalSupportReviewRef
  ]);
}
