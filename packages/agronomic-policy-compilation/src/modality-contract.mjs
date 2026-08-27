import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION = 'adr.agronomic-normative-modality.v1';
export const AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-normative-modality-compilation.v1';
export const AGRONOMIC_NORMATIVE_MODALITY_FORCES = deepFreeze(['SHOULD', 'BEST_EFFORT', 'PERMITTED']);
export const AGRONOMIC_NORMATIVE_MODALITY_QUALIFIERS = deepFreeze(['AS_NEEDED', 'IF_NEEDED', 'IF_POSSIBLE']);
export const AGRONOMIC_NORMATIVE_MODALITY_TARGET_SCOPES = deepFreeze(['ACTION', 'TIMING_RELATION', 'PARAMETER_VALUE', 'OCCURRENCE']);

const FORCE_SET = new Set(AGRONOMIC_NORMATIVE_MODALITY_FORCES);
const QUALIFIER_SET = new Set(AGRONOMIC_NORMATIVE_MODALITY_QUALIFIERS);
const TARGET_SET = new Set(AGRONOMIC_NORMATIVE_MODALITY_TARGET_SCOPES);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicNormativeModalityCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicNormativeModalityCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicNormativeModalityCompilationError(
        'INVALID_AGRONOMIC_NORMATIVE_MODALITY_FIELD',
        `${name}.${key} is not part of the normative modality contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function refList(values, name, kinds, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'DUPLICATE_AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'DUPLICATE_AGRONOMIC_NORMATIVE_MODALITY_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function normalizeQualifiers(values) {
  const qualifiers = stringList(values ?? [], 'modality.qualifiers');
  for (const qualifier of qualifiers) {
    if (!QUALIFIER_SET.has(qualifier)) {
      throw new AgronomicNormativeModalityCompilationError(
        'INVALID_AGRONOMIC_NORMATIVE_MODALITY_QUALIFIER',
        `unsupported normative qualifier ${qualifier}`
      );
    }
  }
  return qualifiers;
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: requiredText(value.role, `${name}.role`),
    authorityRef: authorityRef(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: requiredText(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_INPUT',
      `${name} must be a non-empty array`
    );
  }
  const normalized = values.map((value, index) => authorityBinding(value, `${name}[${index}]`));
  const keys = normalized.map((binding) => JSON.stringify([binding.role, refKey(binding.authorityRef), binding.rationale]));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'DUPLICATE_AGRONOMIC_NORMATIVE_MODALITY_BINDING',
      `${name} cannot contain duplicate bindings`
    );
  }
  return deepFreeze([...normalized].sort((a, b) =>
    JSON.stringify([a.role, refKey(a.authorityRef), a.rationale])
      .localeCompare(JSON.stringify([b.role, refKey(b.authorityRef), b.rationale]))
  ));
}

export function normalizeAgronomicNormativeModality(value) {
  exactObject(value, 'AgronomicNormativeModality', new Set([
    'contractVersion', 'modalityId', 'sourceExpression', 'targetScope',
    'force', 'qualifiers', 'authorityBindings', 'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'modality.contractVersion') !== AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION) {
    throw new AgronomicNormativeModalityCompilationError(
      'UNSUPPORTED_AGRONOMIC_NORMATIVE_MODALITY_CONTRACT',
      'unsupported agronomic normative modality contractVersion'
    );
  }
  const targetScope = requiredText(value.targetScope, 'modality.targetScope');
  if (!TARGET_SET.has(targetScope)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_TARGET_SCOPE',
      `unsupported modality targetScope ${targetScope}`
    );
  }
  const force = value.force === undefined || value.force === null
    ? null
    : requiredText(value.force, 'modality.force');
  if (force !== null && !FORCE_SET.has(force)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_FORCE',
      `unsupported normative force ${force}`
    );
  }
  const qualifiers = normalizeQualifiers(value.qualifiers);
  if (force === null && qualifiers.length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_EMPTY',
      'normative modality requires a force or at least one qualifier'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: requiredText(value.modalityId, 'modality.modalityId'),
    sourceExpression: requiredText(value.sourceExpression, 'modality.sourceExpression'),
    targetScope,
    ...(force !== null ? { force } : {}),
    qualifiers,
    authorityBindings: authorityBindings(value.authorityBindings, 'modality.authorityBindings'),
    transformationRationale: requiredText(value.transformationRationale, 'modality.transformationRationale')
  });
}

export function agronomicNormativeModalityHash(value) {
  return semanticHash('AgronomicNormativeModality', normalizeAgronomicNormativeModality(value));
}

export function normalizeAgronomicNormativeModalityCompilation(value) {
  exactObject(value, 'AgronomicNormativeModalityCompilation', new Set([
    'contractVersion', 'authorityClass', 'sourceProtocolRefs', 'sourceProtocolArtifactRefs',
    'knowledgeRefs', 'modality', 'modalityHash', 'semanticReviewRef',
    'losslessCoverage', 'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion') !== AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicNormativeModalityCompilationError(
      'UNSUPPORTED_AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT',
      'unsupported agronomic normative modality compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY') {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY'
    );
  }

  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(value.sourceProtocolArtifactRefs, 'sourceProtocolArtifactRefs', new Set(['SourceArtifact']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const modality = normalizeAgronomicNormativeModality(value.modality);
  const modalityHash = requiredText(value.modalityHash, 'modalityHash');
  const expectedHash = agronomicNormativeModalityHash(modality);
  if (!HASH_RE.test(modalityHash) || modalityHash !== expectedHash) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_HASH_MISMATCH',
      'modalityHash must exactly match the normalized normative modality'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicNormativeModalityReviewDecision'])
  );

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_COVERAGE',
      'COMPLETE modality coverage cannot declare unrepresented modality elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_COVERAGE',
      'INCOMPLETE modality coverage must name at least one unrepresented modality element'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    modality,
    modalityHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicNormativeModalityCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicNormativeModalityCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.semanticReviewRef
  ]);
}
