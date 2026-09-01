import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION =
  'adr.agronomic-context-non-quantitative-unit-representation.v1';
export const AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-non-quantitative-unit-representation-compilation.v1';

export class AgronomicContextNonQuantitativeUnitRepresentationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextNonQuantitativeUnitRepresentationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_FIELD',
        `${name}.${key} is not part of the non-quantitative unit representation contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_HASH',
      `${name} must be a sha256 hash`
    );
  }
  return normalized;
}

function normalizeTargetContextSemantic(value) {
  exactObject(value, 'targetContextSemantic', new Set(['semanticId', 'value']));
  exactObject(value.value, 'targetContextSemantic.value', new Set(['type', 'date']));
  const semanticId = requiredText(value.semanticId, 'targetContextSemantic.semanticId');
  const type = requiredText(value.value.type, 'targetContextSemantic.value.type');
  const date = requiredText(value.value.date, 'targetContextSemantic.value.date');
  if (semanticId !== 'crop.planting_date' || type !== 'DATE' || date !== '2011-05-03') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({
    semanticId,
    value: deepFreeze({ type, date })
  });
}

function normalizeUnitRepresentation(value) {
  exactObject(value, 'unitRepresentation', new Set(['kind', 'wireValue']));
  const kind = requiredText(value.kind, 'unitRepresentation.kind');
  const wireValue = requiredText(value.wireValue, 'unitRepresentation.wireValue');
  if (kind !== 'NOT_APPLICABLE' || wireValue !== 'NOT_APPLICABLE') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_TOKEN',
      'v1 supports only kind=NOT_APPLICABLE and wireValue=NOT_APPLICABLE'
    );
  }
  return deepFreeze({ kind, wireValue });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicContextNonQuantitativeUnitRepresentation(value) {
  exactObject(
    value,
    'AgronomicContextNonQuantitativeUnitRepresentation',
    new Set([
      'contractVersion',
      'representationId',
      'parentContextSemanticMappingCompilationRef',
      'targetContextSemantic',
      'unitRepresentation',
      'rationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT',
      'unsupported non-quantitative unit representation contractVersion'
    );
  }
  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION,
    representationId: requiredText(value.representationId, 'representationId'),
    parentContextSemanticMappingCompilationRef: authorityRef(
      value.parentContextSemanticMappingCompilationRef,
      'parentContextSemanticMappingCompilationRef',
      new Set(['AgronomicRecordedOperationContextSemanticMappingCompilation'])
    ),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    unitRepresentation: normalizeUnitRepresentation(value.unitRepresentation),
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextNonQuantitativeUnitRepresentationHash(value) {
  return semanticHash(
    'AgronomicContextNonQuantitativeUnitRepresentation',
    normalizeAgronomicContextNonQuantitativeUnitRepresentation(value)
  );
}

export function normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(value) {
  exactObject(
    value,
    'AgronomicContextNonQuantitativeUnitRepresentationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'representation',
      'representationHash',
      'unitRepresentationReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT',
      'unsupported non-quantitative unit representation compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_AUTHORITY') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_AUTHORITY',
      'invalid non-quantitative unit representation authorityClass'
    );
  }

  const representation =
    normalizeAgronomicContextNonQuantitativeUnitRepresentation(value.representation);
  const representationHash = hashValue(value.representationHash, 'representationHash');
  if (representationHash
      !== agronomicContextNonQuantitativeUnitRepresentationHash(representation)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_HASH_MISMATCH',
      'representationHash must exactly match normalized representation'
    );
  }

  const unitRepresentationReviewRef = authorityRef(
    value.unitRepresentationReviewRef,
    'unitRepresentationReviewRef',
    new Set(['AgronomicContextNonQuantitativeUnitRepresentationReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COVERAGE',
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COVERAGE',
      'COMPLETE unit representation cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COVERAGE',
      'INCOMPLETE unit representation must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_AUTHORITY',
    representation,
    representationHash,
    unitRepresentationReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextNonQuantitativeUnitRepresentationCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(value);
  return deepFreeze([
    normalized.representation.parentContextSemanticMappingCompilationRef,
    normalized.unitRepresentationReviewRef
  ]);
}
