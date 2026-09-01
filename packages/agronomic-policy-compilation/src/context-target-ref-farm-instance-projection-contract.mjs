import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION =
  'adr.agronomic-context-target-ref-farm-instance-projection.v1';
export const AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-target-ref-farm-instance-projection-compilation.v1';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TARGET_ID_RE = /^target_src_[0-9a-f]{64}$/;

export class AgronomicContextTargetRefFarmInstanceProjectionCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextTargetRefFarmInstanceProjectionCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_FIELD',
        `${name}.${key} is not part of the target-ref FARM instance projection contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_VALUE',
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
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({
    semanticId,
    value: deepFreeze({ type, date })
  });
}

function normalizeSourceBackedTargetIdentity(value) {
  exactObject(
    value,
    'sourceBackedTargetIdentity',
    new Set(['namespaceRef', 'granularity', 'targetId'])
  );
  const namespaceRef = authorityRef(
    value.namespaceRef,
    'sourceBackedTargetIdentity.namespaceRef',
    new Set(['Source'])
  );
  const granularity = requiredText(
    value.granularity,
    'sourceBackedTargetIdentity.granularity'
  );
  const targetId = requiredText(value.targetId, 'sourceBackedTargetIdentity.targetId');
  if (granularity !== 'FARM') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_GRANULARITY',
      'v1 supports only source-backed FARM target identity'
    );
  }
  if (!TARGET_ID_RE.test(targetId)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET_ID',
      'sourceBackedTargetIdentity.targetId must be target_src_<64 lowercase hex>'
    );
  }
  return deepFreeze({ namespaceRef, granularity, targetId });
}

function normalizeTargetRefProjection(value, targetId) {
  exactObject(value, 'targetRefProjection', new Set(['field', 'value']));
  const field = requiredText(value.field, 'targetRefProjection.field');
  const projectedValue = requiredText(value.value, 'targetRefProjection.value');
  if (field !== 'farmId') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_FIELD',
      'v1 supports only targetRef.farmId projection'
    );
  }
  if (projectedValue !== targetId) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_VALUE_MISMATCH',
      'targetRefProjection.value must equal exact sourceBackedTargetIdentity.targetId'
    );
  }
  return deepFreeze({ field, value: projectedValue });
}

export function normalizeAgronomicContextTargetRefFarmInstanceProjection(value) {
  exactObject(
    value,
    'AgronomicContextTargetRefFarmInstanceProjection',
    new Set([
      'contractVersion',
      'projectionId',
      'parentContextSpatialSupportClassificationCompilationRef',
      'targetContextSemantic',
      'sourceBackedTargetIdentity',
      'targetRefProjection',
      'rationale'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT',
      'unsupported target-ref FARM instance projection contractVersion'
    );
  }
  const sourceBackedTargetIdentity =
    normalizeSourceBackedTargetIdentity(value.sourceBackedTargetIdentity);
  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION,
    projectionId: requiredText(value.projectionId, 'projectionId'),
    parentContextSpatialSupportClassificationCompilationRef: authorityRef(
      value.parentContextSpatialSupportClassificationCompilationRef,
      'parentContextSpatialSupportClassificationCompilationRef',
      new Set([
        'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation'
      ])
    ),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    sourceBackedTargetIdentity,
    targetRefProjection: normalizeTargetRefProjection(
      value.targetRefProjection,
      sourceBackedTargetIdentity.targetId
    ),
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextTargetRefFarmInstanceProjectionHash(value) {
  return semanticHash(
    'AgronomicContextTargetRefFarmInstanceProjection',
    normalizeAgronomicContextTargetRefFarmInstanceProjection(value)
  );
}

export function normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(value) {
  exactObject(
    value,
    'AgronomicContextTargetRefFarmInstanceProjectionCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'projection',
      'projectionHash',
      'targetRefProjectionReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT',
      'unsupported target-ref FARM instance projection compilation contractVersion'
    );
  }
  if (
    value.authorityClass
      !== 'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_AUTHORITY'
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_AUTHORITY',
      'invalid target-ref FARM instance projection authorityClass'
    );
  }

  const projection =
    normalizeAgronomicContextTargetRefFarmInstanceProjection(value.projection);
  const projectionHash = hashValue(value.projectionHash, 'projectionHash');
  if (
    projectionHash !== agronomicContextTargetRefFarmInstanceProjectionHash(projection)
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_HASH_MISMATCH',
      'projectionHash must exactly match normalized projection'
    );
  }

  const targetRefProjectionReviewRef = authorityRef(
    value.targetRefProjectionReviewRef,
    'targetRefProjectionReviewRef',
    new Set(['AgronomicContextTargetRefFarmInstanceProjectionReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COVERAGE',
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
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COVERAGE',
      'COMPLETE projection cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COVERAGE',
      'INCOMPLETE projection must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash,
    targetRefProjectionReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextTargetRefFarmInstanceProjectionCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(value);
  return deepFreeze([
    normalized.projection.parentContextSpatialSupportClassificationCompilationRef,
    normalized.targetRefProjectionReviewRef
  ]);
}
