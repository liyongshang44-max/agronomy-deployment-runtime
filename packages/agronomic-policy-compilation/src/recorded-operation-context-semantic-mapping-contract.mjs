import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-semantic-mapping.v1';
export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-context-semantic-mapping-compilation.v1';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TOKEN_RE = /^[A-Z][A-Z0-9_]*$/;

export class AgronomicRecordedOperationContextSemanticMappingCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicRecordedOperationContextSemanticMappingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_FIELD',
        `${name}.${key} is not part of the context-semantic mapping contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function token(value, name) {
  const normalized = requiredText(value, name);
  if (!TOKEN_RE.test(normalized)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_TOKEN',
      `${name} must be an uppercase semantic token`
    );
  }
  return normalized;
}

function calendarDate(value, name) {
  const text = requiredText(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE',
      `${name} must be YYYY-MM-DD`
    );
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE',
      `${name} must be a real calendar date`
    );
  }
  return text;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeSourceOperationSemantic(value) {
  exactObject(value, 'sourceOperationSemantic', new Set(['family', 'subject']));
  exactObject(value.subject, 'sourceOperationSemantic.subject', new Set(['kind', 'code']));
  const normalized = deepFreeze({
    family: token(value.family, 'sourceOperationSemantic.family'),
    subject: deepFreeze({
      kind: token(value.subject.kind, 'sourceOperationSemantic.subject.kind'),
      code: token(value.subject.code, 'sourceOperationSemantic.subject.code')
    })
  });
  if (normalized.family !== 'PLANT'
      || normalized.subject.kind !== 'CROP'
      || normalized.subject.code !== 'CORN') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_SEMANTIC',
      'v1 supports only PLANT / CROP:CORN'
    );
  }
  return normalized;
}

function normalizeSourceTemporalSupport(value) {
  exactObject(value, 'sourceTemporalSupport', new Set(['kind', 'date', 'precision']));
  const normalized = deepFreeze({
    kind: requiredText(value.kind, 'sourceTemporalSupport.kind'),
    date: calendarDate(value.date, 'sourceTemporalSupport.date'),
    precision: requiredText(value.precision, 'sourceTemporalSupport.precision')
  });
  if (normalized.kind !== 'CALENDAR_DATE' || normalized.precision !== 'DAY') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_TEMPORAL_SUPPORT',
      'v1 supports only CALENDAR_DATE with DAY precision'
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
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_TARGET_SEMANTIC',
      'v1 supports only crop.planting_date with DATE value'
    );
  }
  return deepFreeze({
    semanticId,
    value: deepFreeze({ type, date })
  });
}

export function normalizeAgronomicRecordedOperationContextSemanticMapping(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSemanticMapping',
    new Set([
      'contractVersion',
      'mappingId',
      'parentOccurrenceCompilationRef',
      'semanticNormalizationCompilationRef',
      'sourceOperationSemantic',
      'sourceTemporalSupport',
      'targetContextSemantic',
      'transformationRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT',
      'unsupported context-semantic mapping contractVersion'
    );
  }

  const sourceTemporalSupport = normalizeSourceTemporalSupport(value.sourceTemporalSupport);
  const targetContextSemantic = normalizeTargetContextSemantic(value.targetContextSemantic);
  if (sourceTemporalSupport.date !== targetContextSemantic.value.date) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE_MISMATCH',
      'target DATE value must exactly preserve the source occurrence date'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION,
    mappingId: requiredText(value.mappingId, 'mappingId'),
    parentOccurrenceCompilationRef: authorityRef(
      value.parentOccurrenceCompilationRef,
      'parentOccurrenceCompilationRef',
      new Set(['AgronomicRecordedOperationOccurrenceCompilation'])
    ),
    semanticNormalizationCompilationRef: authorityRef(
      value.semanticNormalizationCompilationRef,
      'semanticNormalizationCompilationRef',
      new Set(['AgronomicRecordedOperationSemanticNormalizationCompilation'])
    ),
    sourceOperationSemantic: normalizeSourceOperationSemantic(value.sourceOperationSemantic),
    sourceTemporalSupport,
    targetContextSemantic,
    transformationRationale: requiredText(value.transformationRationale, 'transformationRationale')
  });
}

export function agronomicRecordedOperationContextSemanticMappingHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationContextSemanticMapping',
    normalizeAgronomicRecordedOperationContextSemanticMapping(value)
  );
}

export function normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationContextSemanticMappingCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'mapping',
      'mappingHash',
      'semanticReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT',
      'unsupported context-semantic mapping compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY'
    );
  }

  const mapping = normalizeAgronomicRecordedOperationContextSemanticMapping(value.mapping);
  const mappingHash = hashValue(value.mappingHash, 'mappingHash');
  if (mappingHash !== agronomicRecordedOperationContextSemanticMappingHash(mapping)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_HASH_MISMATCH',
      'mappingHash must exactly match normalized mapping'
    );
  }

  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicRecordedOperationContextSemanticMappingReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COVERAGE',
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
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COVERAGE',
      'COMPLETE mapping coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COVERAGE',
      'INCOMPLETE mapping coverage must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY',
    mapping,
    mappingHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationContextSemanticMappingCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(value);
  const refs = [
    normalized.mapping.parentOccurrenceCompilationRef,
    normalized.mapping.semanticNormalizationCompilationRef,
    normalized.semanticReviewRef
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze(
    [...unique.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)))
  );
}
