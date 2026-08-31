import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-provenance-classification.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-provenance-classification-compilation.v1';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicRecordedOperationContextProvenanceClassificationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicRecordedOperationContextProvenanceClassificationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_FIELD',
        `${name}.${key} is not part of the context-provenance classification contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function calendarDate(value, name) {
  const text = requiredText(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_DATE',
      `${name} must be YYYY-MM-DD`
    );
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_DATE',
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

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = calendarDate(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_TARGET_SEMANTIC',
      'v1 supports only crop.planting_date with DATE value'
    );
  }
  return deepFreeze({ semanticId, value: deepFreeze({ type, date }) });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicRecordedOperationContextProvenanceClassification(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextProvenanceClassification',
    new Set([
      'contractVersion',
      'classificationId',
      'contextEpistemicClassificationCompilationRef',
      'valueSource',
      'targetContextSemantic',
      'epistemicClass',
      'provenanceClass',
      'classificationRationale'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT',
      'unsupported context-provenance classification contractVersion'
    );
  }

  const epistemicClass = requiredText(value.epistemicClass, 'epistemicClass');
  if (epistemicClass !== 'ASSERTION') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_EPISTEMIC_CLASS',
      'v1 provenance classification preserves only ASSERTION'
    );
  }

  const provenanceClass = requiredText(value.provenanceClass, 'provenanceClass');
  if (provenanceClass !== 'EXTERNAL_PROVIDER') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASS',
      'v1 first value-source world supports only EXTERNAL_PROVIDER'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: requiredText(value.classificationId, 'classificationId'),
    contextEpistemicClassificationCompilationRef: authorityRef(
      value.contextEpistemicClassificationCompilationRef,
      'contextEpistemicClassificationCompilationRef',
      new Set(['AgronomicRecordedOperationContextEpistemicClassificationCompilation'])
    ),
    valueSource: normalizeValueSource(value.valueSource),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    epistemicClass,
    provenanceClass,
    classificationRationale: requiredText(
      value.classificationRationale,
      'classificationRationale'
    )
  });
}

export function agronomicRecordedOperationContextProvenanceClassificationHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextProvenanceClassification',
    normalizeAgronomicRecordedOperationContextProvenanceClassification(value)
  );
}

export function normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextProvenanceClassificationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'classification',
      'classificationHash',
      'provenanceReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );

  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT',
      'unsupported context-provenance classification compilation contractVersion'
    );
  }

  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY'
    );
  }

  const classification =
    normalizeAgronomicRecordedOperationContextProvenanceClassification(value.classification);
  const classificationHash = hashValue(value.classificationHash, 'classificationHash');
  if (classificationHash
      !== agronomicRecordedOperationContextProvenanceClassificationHash(classification)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_HASH_MISMATCH',
      'classificationHash must exactly match normalized classification'
    );
  }

  const provenanceReviewRef = authorityRef(
    value.provenanceReviewRef,
    'provenanceReviewRef',
    new Set(['AgronomicRecordedOperationContextProvenanceClassificationReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COVERAGE',
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
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COVERAGE',
      'COMPLETE classification coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COVERAGE',
      'INCOMPLETE classification coverage must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash,
    provenanceReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextProvenanceClassificationCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(value);
  return deepFreeze([
    normalized.classification.contextEpistemicClassificationCompilationRef,
    normalized.classification.valueSource.sourceRef,
    normalized.classification.valueSource.sourceArtifactRef,
    normalized.provenanceReviewRef
  ]);
}
