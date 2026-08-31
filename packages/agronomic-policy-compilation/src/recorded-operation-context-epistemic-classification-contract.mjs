import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-epistemic-classification.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-epistemic-classification-compilation.v1';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextEpistemicClassificationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicRecordedOperationContextEpistemicClassificationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_FIELD',
        `${name}.${key} is not part of the context-epistemic classification contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function calendarDate(value, name) {
  const text = requiredText(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_DATE',
      `${name} must be YYYY-MM-DD`
    );
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_DATE',
      `${name} must be a real calendar date`
    );
  }
  return text;
}

function normalizePredecessorOccurrenceSemantics(value) {
  exactObject(
    value,
    'predecessorOccurrenceSemantics',
    new Set(['recordSemanticRole', 'occurrenceClass'])
  );
  const normalized = deepFreeze({
    recordSemanticRole: requiredText(
      value.recordSemanticRole,
      'predecessorOccurrenceSemantics.recordSemanticRole'
    ),
    occurrenceClass: requiredText(
      value.occurrenceClass,
      'predecessorOccurrenceSemantics.occurrenceClass'
    )
  });
  if (normalized.recordSemanticRole !== 'ACTUAL_FIELD_OPERATION_RECORD'
      || normalized.occurrenceClass !== 'SOURCE_RECORDED_OPERATION_OCCURRENCE') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_PREDECESSOR_SEMANTICS',
      'v1 supports only ACTUAL_FIELD_OPERATION_RECORD / SOURCE_RECORDED_OPERATION_OCCURRENCE'
    );
  }
  return normalized;
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = calendarDate(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_TARGET_SEMANTIC',
      'v1 supports only crop.planting_date with DATE value'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicRecordedOperationContextEpistemicClassification(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextEpistemicClassification',
    new Set([
      'contractVersion',
      'classificationId',
      'contextSemanticMappingCompilationRef',
      'predecessorOccurrenceSemantics',
      'targetContextSemantic',
      'epistemicClass',
      'classificationRationale'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT',
      'unsupported context-epistemic classification contractVersion'
    );
  }

  const epistemicClass = requiredText(value.epistemicClass, 'epistemicClass');
  if (epistemicClass !== 'ASSERTION') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASS',
      'v1 first source-recorded operation world supports only ASSERTION'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: requiredText(value.classificationId, 'classificationId'),
    contextSemanticMappingCompilationRef: authorityRef(
      value.contextSemanticMappingCompilationRef,
      'contextSemanticMappingCompilationRef',
      new Set(['AgronomicRecordedOperationContextSemanticMappingCompilation'])
    ),
    predecessorOccurrenceSemantics:
      normalizePredecessorOccurrenceSemantics(value.predecessorOccurrenceSemantics),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    epistemicClass,
    classificationRationale: requiredText(
      value.classificationRationale,
      'classificationRationale'
    )
  });
}

export function agronomicRecordedOperationContextEpistemicClassificationHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextEpistemicClassification',
    normalizeAgronomicRecordedOperationContextEpistemicClassification(value)
  );
}

export function normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextEpistemicClassificationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'classification',
      'classificationHash',
      'epistemicReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT',
      'unsupported context-epistemic classification compilation contractVersion'
    );
  }

  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY'
    );
  }

  const classification =
    normalizeAgronomicRecordedOperationContextEpistemicClassification(value.classification);
  const classificationHash = hashValue(value.classificationHash, 'classificationHash');
  if (classificationHash
      !== agronomicRecordedOperationContextEpistemicClassificationHash(classification)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_HASH_MISMATCH',
      'classificationHash must exactly match normalized classification'
    );
  }

  const epistemicReviewRef = authorityRef(
    value.epistemicReviewRef,
    'epistemicReviewRef',
    new Set(['AgronomicRecordedOperationContextEpistemicClassificationReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COVERAGE',
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
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COVERAGE',
      'COMPLETE classification coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COVERAGE',
      'INCOMPLETE classification coverage must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash,
    epistemicReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextEpistemicClassificationCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(value);
  return deepFreeze([
    normalized.classification.contextSemanticMappingCompilationRef,
    normalized.epistemicReviewRef
  ]);
}
