import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION =
  'adr.agronomic-context-vertical-support-non-applicability.v1';
export const AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-vertical-support-non-applicability-compilation.v1';

export class AgronomicContextVerticalSupportNonApplicabilityCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextVerticalSupportNonApplicabilityCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_FIELD',
        `${name}.${key} is not part of the vertical-support non-applicability contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_HASH',
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
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_TARGET',
      'v1 supports only crop.planting_date = DATE 2011-05-03'
    );
  }
  return deepFreeze({
    semanticId,
    value: deepFreeze({ type, date })
  });
}

function normalizeVerticalSupportRepresentation(value) {
  exactObject(value, 'verticalSupportRepresentation', new Set(['kind', 'wireValue']));
  const kind = requiredText(value.kind, 'verticalSupportRepresentation.kind');
  if (kind !== 'NOT_APPLICABLE' || value.wireValue !== null) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REPRESENTATION',
      'v1 supports only kind=NOT_APPLICABLE and wireValue=null'
    );
  }
  return deepFreeze({ kind, wireValue: null });
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicContextVerticalSupportNonApplicability(value) {
  exactObject(
    value,
    'AgronomicContextVerticalSupportNonApplicability',
    new Set([
      'contractVersion',
      'representationId',
      'parentContextSemanticMappingCompilationRef',
      'targetContextSemantic',
      'verticalSupportRepresentation',
      'rationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT',
      'unsupported vertical-support non-applicability contractVersion'
    );
  }
  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION,
    representationId: requiredText(value.representationId, 'representationId'),
    parentContextSemanticMappingCompilationRef: authorityRef(
      value.parentContextSemanticMappingCompilationRef,
      'parentContextSemanticMappingCompilationRef',
      new Set(['AgronomicRecordedOperationContextSemanticMappingCompilation'])
    ),
    targetContextSemantic: normalizeTargetContextSemantic(value.targetContextSemantic),
    verticalSupportRepresentation: normalizeVerticalSupportRepresentation(value.verticalSupportRepresentation),
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextVerticalSupportNonApplicabilityHash(value) {
  return semanticHash(
    'AgronomicContextVerticalSupportNonApplicability',
    normalizeAgronomicContextVerticalSupportNonApplicability(value)
  );
}

export function normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(value) {
  exactObject(
    value,
    'AgronomicContextVerticalSupportNonApplicabilityCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'representation',
      'representationHash',
      'verticalSupportRepresentationReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT',
      'unsupported vertical-support non-applicability compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_AUTHORITY') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_AUTHORITY',
      'invalid vertical-support non-applicability authorityClass'
    );
  }

  const representation =
    normalizeAgronomicContextVerticalSupportNonApplicability(value.representation);
  const representationHash = hashValue(value.representationHash, 'representationHash');
  if (representationHash
      !== agronomicContextVerticalSupportNonApplicabilityHash(representation)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_HASH_MISMATCH',
      'representationHash must exactly match normalized representation'
    );
  }

  const verticalSupportRepresentationReviewRef = authorityRef(
    value.verticalSupportRepresentationReviewRef,
    'verticalSupportRepresentationReviewRef',
    new Set(['AgronomicContextVerticalSupportNonApplicabilityReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COVERAGE',
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
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COVERAGE',
      'COMPLETE vertical-support non-applicability cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COVERAGE',
      'INCOMPLETE vertical-support non-applicability must name at least one unrepresented targeted element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_AUTHORITY',
    representation,
    representationHash,
    verticalSupportRepresentationReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextVerticalSupportNonApplicabilityCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(value);
  return deepFreeze([
    normalized.representation.parentContextSemanticMappingCompilationRef,
    normalized.verticalSupportRepresentationReviewRef
  ]);
}
