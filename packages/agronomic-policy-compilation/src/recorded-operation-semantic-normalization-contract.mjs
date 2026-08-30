import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-semantic-normalization.v1';
export const AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-semantic-normalization-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_ROLES = deepFreeze([
  'SOURCE_CODE_NAMESPACE_CONTEXT',
  'NORMALIZED_OPERATION_MEANING'
]);

const EVIDENCE_ROLES =
  new Set(AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_ROLES);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TOKEN_RE = /^[A-Z][A-Z0-9_]*$/;

export class AgronomicRecordedOperationSemanticNormalizationCompilationError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name =
      'AgronomicRecordedOperationSemanticNormalizationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_FIELD',
        `${name}.${key} is not part of the semantic-normalization contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([
    value.kind,
    value.logicalId,
    value.version,
    value.semanticHash
  ]);
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_HASH',
      `${name} must be a sha256 semantic/content hash`
    );
  }
  return normalized;
}

function token(value, name) {
  const normalized = requiredText(value, name);
  if (!TOKEN_RE.test(normalized)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_TOKEN',
      `${name} must be an uppercase semantic token`
    );
  }
  return normalized;
}

function nonNegativeSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_BYTE_RANGE',
      `${name} must be a non-negative safe integer`
    );
  }
  return value;
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_BYTE_RANGE',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeByteRangeLocator(value, name) {
  exactObject(
    value,
    name,
    new Set(['kind', 'start', 'endExclusive', 'evidenceHash'])
  );
  if (value.kind !== 'BYTE_RANGE') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_LOCATOR',
      `${name}.kind must be BYTE_RANGE in v1`
    );
  }
  const start = nonNegativeSafeInteger(value.start, `${name}.start`);
  const endExclusive = positiveSafeInteger(
    value.endExclusive,
    `${name}.endExclusive`
  );
  if (endExclusive <= start) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_BYTE_RANGE',
      `${name}.endExclusive must be greater than start`
    );
  }
  return deepFreeze({
    kind: 'BYTE_RANGE',
    start,
    endExclusive,
    evidenceHash: hashValue(value.evidenceHash, `${name}.evidenceHash`)
  });
}

function normalizeSemanticEvidenceItem(value, index) {
  const name = `semanticEvidence[${index}]`;
  exactObject(
    value,
    name,
    new Set([
      'evidenceRole',
      'sourceRef',
      'sourceArtifactRef',
      'sourceArtifactContentHash',
      'sourceLocator'
    ])
  );
  const evidenceRole = requiredText(value.evidenceRole, `${name}.evidenceRole`);
  if (!EVIDENCE_ROLES.has(evidenceRole)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_ROLE',
      `${name}.evidenceRole has unsupported value ${evidenceRole}`
    );
  }
  return deepFreeze({
    evidenceRole,
    sourceRef: authorityRef(value.sourceRef, `${name}.sourceRef`, new Set(['Source'])),
    sourceArtifactRef: authorityRef(
      value.sourceArtifactRef,
      `${name}.sourceArtifactRef`,
      new Set(['SourceArtifact'])
    ),
    sourceArtifactContentHash: hashValue(
      value.sourceArtifactContentHash,
      `${name}.sourceArtifactContentHash`
    ),
    sourceLocator: normalizeByteRangeLocator(
      value.sourceLocator,
      `${name}.sourceLocator`
    )
  });
}

function normalizeSemanticEvidence(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_REQUIRED',
      'semanticEvidence must be a non-empty array'
    );
  }
  const normalized = values.map(normalizeSemanticEvidenceItem);
  const roles = normalized.map((item) => item.evidenceRole);
  if (new Set(roles).size !== roles.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_ROLE',
      'v1 semanticEvidence must contain each evidence role at most once'
    );
  }
  for (const required of AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE_ROLES) {
    if (!roles.includes(required)) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'INCOMPLETE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE',
        `semanticEvidence must include ${required}`
      );
    }
  }

  const itemKeys = normalized.map((item) => JSON.stringify([
    item.evidenceRole,
    refKey(item.sourceRef),
    refKey(item.sourceArtifactRef),
    item.sourceLocator.start,
    item.sourceLocator.endExclusive,
    item.sourceLocator.evidenceHash
  ]));
  if (new Set(itemKeys).size !== itemKeys.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE',
      'semanticEvidence cannot contain duplicate exact evidence items'
    );
  }

  return deepFreeze(
    [...normalized].sort((a, b) => a.evidenceRole.localeCompare(b.evidenceRole))
  );
}

function normalizeNormalizedOperation(value) {
  exactObject(value, 'normalizedOperation', new Set(['family', 'subject']));
  exactObject(value.subject, 'normalizedOperation.subject', new Set(['kind', 'code']));
  return deepFreeze({
    family: token(value.family, 'normalizedOperation.family'),
    subject: deepFreeze({
      kind: token(value.subject.kind, 'normalizedOperation.subject.kind'),
      code: token(value.subject.code, 'normalizedOperation.subject.code')
    })
  });
}

function normalizeApplicability(value) {
  exactObject(
    value,
    'applicability',
    new Set([
      'appliesToOccurrenceSourceRef',
      'appliesToSourceOperationCode'
    ])
  );
  return deepFreeze({
    appliesToOccurrenceSourceRef: authorityRef(
      value.appliesToOccurrenceSourceRef,
      'applicability.appliesToOccurrenceSourceRef',
      new Set(['Source'])
    ),
    appliesToSourceOperationCode: requiredText(
      value.appliesToSourceOperationCode,
      'applicability.appliesToSourceOperationCode'
    )
  });
}

export function normalizeAgronomicRecordedOperationSemanticNormalization(value) {
  exactObject(
    value,
    'AgronomicRecordedOperationSemanticNormalization',
    new Set([
      'contractVersion',
      'normalizationId',
      'parentOccurrenceCompilationRef',
      'sourceCode',
      'normalizedOperation',
      'semanticEvidence',
      'applicability',
      'transformationRationale'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT',
      'unsupported semantic-normalization contractVersion'
    );
  }
  exactObject(value.sourceCode, 'sourceCode', new Set(['sourceOperationCode']));

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
    normalizationId: requiredText(value.normalizationId, 'normalizationId'),
    parentOccurrenceCompilationRef: authorityRef(
      value.parentOccurrenceCompilationRef,
      'parentOccurrenceCompilationRef',
      new Set(['AgronomicRecordedOperationOccurrenceCompilation'])
    ),
    sourceCode: deepFreeze({
      sourceOperationCode: requiredText(
        value.sourceCode.sourceOperationCode,
        'sourceCode.sourceOperationCode'
      )
    }),
    normalizedOperation: normalizeNormalizedOperation(value.normalizedOperation),
    semanticEvidence: normalizeSemanticEvidence(value.semanticEvidence),
    applicability: normalizeApplicability(value.applicability),
    transformationRationale: requiredText(
      value.transformationRationale,
      'transformationRationale'
    )
  });
}

export function agronomicRecordedOperationSemanticNormalizationHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationSemanticNormalization',
    normalizeAgronomicRecordedOperationSemanticNormalization(value)
  );
}

export function normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
  value
) {
  exactObject(
    value,
    'AgronomicRecordedOperationSemanticNormalizationCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'normalization',
      'normalizationHash',
      'semanticReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT',
      'unsupported semantic-normalization compilation contractVersion'
    );
  }
  if (value.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY'
    );
  }

  const normalization =
    normalizeAgronomicRecordedOperationSemanticNormalization(value.normalization);
  const normalizationHash = hashValue(value.normalizationHash, 'normalizationHash');
  const expectedHash =
    agronomicRecordedOperationSemanticNormalizationHash(normalization);
  if (normalizationHash !== expectedHash) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_HASH_MISMATCH',
      'normalizationHash must exactly match normalized semantic normalization'
    );
  }

  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicRecordedOperationSemanticNormalizationReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COVERAGE',
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
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COVERAGE',
      'COMPLETE normalization coverage cannot declare unrepresented targeted semantic elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COVERAGE',
      'INCOMPLETE normalization coverage must name at least one unrepresented targeted semantic element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY',
    normalization,
    normalizationHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationSemanticNormalizationCompilationAuthorityRefs(
  value
) {
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(value);
  const refs = [
    normalized.normalization.parentOccurrenceCompilationRef,
    normalized.normalization.applicability.appliesToOccurrenceSourceRef,
    ...normalized.normalization.semanticEvidence.flatMap((item) => [
      item.sourceRef,
      item.sourceArtifactRef
    ]),
    normalized.semanticReviewRef
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze(
    [...unique.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)))
  );
}
