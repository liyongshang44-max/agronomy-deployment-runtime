import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION = 'adr.agronomic-action-realization.v1';
export const AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-action-realization-compilation.v1';
export const AGRONOMIC_ACTION_REALIZATION_SET_CLOSURES = deepFreeze(['OPEN_SOURCE_DEFINED']);
export const AGRONOMIC_ACTION_REALIZATION_ALTERNATIVE_KINDS = deepFreeze([
  'NAMED_METHOD',
  'SOURCE_DEFINED_OPEN_CLASS'
]);
export const AGRONOMIC_ACTION_REALIZATION_NAMED_METHOD_CODES = deepFreeze([
  'SOIL_FINISHING',
  'ROTOTILLING'
]);

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const NAMED_METHOD_SOURCE = Object.freeze({
  SOIL_FINISHING: 'soil finishing',
  ROTOTILLING: 'rototilling'
});
const OPEN_CLASS_EXPRESSION = 'any tillage that keeps plant growth from becoming established';
const OPEN_CLASS_CRITERION = 'keeps plant growth from becoming established';

export class AgronomicActionRealizationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicActionRealizationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicActionRealizationCompilationError(
        'INVALID_AGRONOMIC_ACTION_REALIZATION_FIELD',
        `${name}.${key} is not part of the action-realization contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_AUTHORITY_REF',
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
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REALIZATION_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REALIZATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
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
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_INPUT',
      `${name} must be a non-empty array`
    );
  }
  const normalized = values.map((value, index) => authorityBinding(value, `${name}[${index}]`));
  const keys = normalized.map((binding) => JSON.stringify([binding.role, refKey(binding.authorityRef), binding.rationale]));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REALIZATION_BINDING',
      `${name} cannot contain duplicate bindings`
    );
  }
  return deepFreeze([...normalized].sort((a, b) =>
    JSON.stringify([a.role, refKey(a.authorityRef), a.rationale])
      .localeCompare(JSON.stringify([b.role, refKey(b.authorityRef), b.rationale]))
  ));
}

function normalizeAlternative(value, index) {
  const name = `realization.realizationSet.alternatives[${index}]`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_ALTERNATIVE',
      `${name} must be an object`
    );
  }
  const kind = requiredText(value.kind, `${name}.kind`);
  if (kind === 'NAMED_METHOD') {
    exactObject(value, name, new Set(['kind', 'methodCode', 'sourceExpression']));
    const methodCode = requiredText(value.methodCode, `${name}.methodCode`);
    if (!Object.hasOwn(NAMED_METHOD_SOURCE, methodCode)) {
      throw new AgronomicActionRealizationCompilationError(
        'INVALID_AGRONOMIC_ACTION_REALIZATION_NAMED_METHOD',
        `DEC-0010 v1 does not admit named method ${methodCode}`
      );
    }
    const sourceExpression = requiredText(value.sourceExpression, `${name}.sourceExpression`);
    if (sourceExpression !== NAMED_METHOD_SOURCE[methodCode]) {
      throw new AgronomicActionRealizationCompilationError(
        'AGRONOMIC_ACTION_REALIZATION_NAMED_METHOD_SOURCE_MISMATCH',
        `${methodCode} must retain its exact accepted source expression`
      );
    }
    return deepFreeze({ kind, methodCode, sourceExpression });
  }
  if (kind === 'SOURCE_DEFINED_OPEN_CLASS') {
    exactObject(value, name, new Set(['kind', 'classExpression', 'membershipCriterionExpression']));
    const classExpression = requiredText(value.classExpression, `${name}.classExpression`);
    const membershipCriterionExpression = requiredText(
      value.membershipCriterionExpression,
      `${name}.membershipCriterionExpression`
    );
    if (classExpression !== OPEN_CLASS_EXPRESSION
      || membershipCriterionExpression !== OPEN_CLASS_CRITERION) {
      throw new AgronomicActionRealizationCompilationError(
        'AGRONOMIC_ACTION_REALIZATION_OPEN_CLASS_SOURCE_MISMATCH',
        'DEC-0010 v1 must retain the exact accepted source-defined open class and criterion expressions'
      );
    }
    return deepFreeze({ kind, classExpression, membershipCriterionExpression });
  }
  throw new AgronomicActionRealizationCompilationError(
    'INVALID_AGRONOMIC_ACTION_REALIZATION_ALTERNATIVE_KIND',
    `unsupported action-realization alternative kind ${kind}`
  );
}

function alternativeKey(value) {
  return value.kind === 'NAMED_METHOD'
    ? JSON.stringify([value.kind, value.methodCode, value.sourceExpression])
    : JSON.stringify([value.kind, value.classExpression, value.membershipCriterionExpression]);
}

function normalizeRealizationSet(value) {
  exactObject(value, 'realization.realizationSet', new Set(['closure', 'alternatives']));
  const closure = requiredText(value.closure, 'realization.realizationSet.closure');
  if (closure !== 'OPEN_SOURCE_DEFINED') {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_SET_CLOSURE',
      'DEC-0010 v1 requires OPEN_SOURCE_DEFINED realization-set closure'
    );
  }
  if (!Array.isArray(value.alternatives)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_ALTERNATIVES',
      'realization.realizationSet.alternatives must be an array'
    );
  }
  const alternatives = value.alternatives.map(normalizeAlternative);
  if (new Set(alternatives.map(alternativeKey)).size !== alternatives.length) {
    throw new AgronomicActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REALIZATION_ALTERNATIVE',
      'realization alternatives cannot contain duplicate source semantics'
    );
  }
  const namedCodes = alternatives
    .filter((item) => item.kind === 'NAMED_METHOD')
    .map((item) => item.methodCode)
    .sort();
  const openClasses = alternatives.filter((item) => item.kind === 'SOURCE_DEFINED_OPEN_CLASS');
  if (JSON.stringify(namedCodes) !== JSON.stringify(['ROTOTILLING', 'SOIL_FINISHING'])
    || openClasses.length !== 1
    || alternatives.length !== 3) {
    throw new AgronomicActionRealizationCompilationError(
      'AGRONOMIC_ACTION_REALIZATION_V1_SHAPE_MISMATCH',
      'DEC-0010 v1 requires exactly SOIL_FINISHING, ROTOTILLING and one source-defined open class'
    );
  }
  return deepFreeze({
    closure,
    alternatives: deepFreeze([...alternatives].sort((a, b) => alternativeKey(a).localeCompare(alternativeKey(b))))
  });
}

export function normalizeAgronomicActionRealization(value) {
  exactObject(value, 'AgronomicActionRealization', new Set([
    'contractVersion', 'realizationId', 'sourceExpression', 'parentRegimenCompilationRef',
    'targetActionCode', 'realizationSet', 'authorityBindings', 'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'realization.contractVersion') !== AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION) {
    throw new AgronomicActionRealizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_ACTION_REALIZATION_CONTRACT',
      'unsupported agronomic action-realization contractVersion'
    );
  }
  const targetActionCode = requiredText(value.targetActionCode, 'realization.targetActionCode');
  if (targetActionCode !== 'TILL') {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_ACTION',
      'DEC-0010 v1 accepts only refinement of source-proven TILL action'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
    realizationId: requiredText(value.realizationId, 'realization.realizationId'),
    sourceExpression: requiredText(value.sourceExpression, 'realization.sourceExpression'),
    parentRegimenCompilationRef: authorityRef(
      value.parentRegimenCompilationRef,
      'realization.parentRegimenCompilationRef',
      new Set(['AgronomicActionRegimenCompilation'])
    ),
    targetActionCode,
    realizationSet: normalizeRealizationSet(value.realizationSet),
    authorityBindings: authorityBindings(value.authorityBindings, 'realization.authorityBindings'),
    transformationRationale: requiredText(value.transformationRationale, 'realization.transformationRationale')
  });
}

export function agronomicActionRealizationHash(value) {
  return semanticHash('AgronomicActionRealization', normalizeAgronomicActionRealization(value));
}

export function normalizeAgronomicActionRealizationCompilation(value) {
  exactObject(value, 'AgronomicActionRealizationCompilation', new Set([
    'contractVersion', 'authorityClass', 'sourceProtocolRefs', 'sourceProtocolArtifactRefs',
    'knowledgeRefs', 'realization', 'realizationHash', 'semanticReviewRef',
    'losslessCoverage', 'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion') !== AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicActionRealizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT',
      'unsupported agronomic action-realization compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY') {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY'
    );
  }

  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(
    value.sourceProtocolArtifactRefs,
    'sourceProtocolArtifactRefs',
    new Set(['SourceArtifact']),
    { nonEmpty: true }
  );
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const realization = normalizeAgronomicActionRealization(value.realization);
  const realizationHash = requiredText(value.realizationHash, 'realizationHash');
  const expectedHash = agronomicActionRealizationHash(realization);
  if (!HASH_RE.test(realizationHash) || realizationHash !== expectedHash) {
    throw new AgronomicActionRealizationCompilationError(
      'AGRONOMIC_ACTION_REALIZATION_HASH_MISMATCH',
      'realizationHash must exactly match the normalized action realization'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicActionRealizationReviewDecision'])
  );

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(
    value.losslessCoverage.unrepresentedElements ?? [],
    'losslessCoverage.unrepresentedElements'
  );
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_COVERAGE',
      'COMPLETE action-realization coverage cannot declare unrepresented targeted realization elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicActionRealizationCompilationError(
      'INVALID_AGRONOMIC_ACTION_REALIZATION_COVERAGE',
      'INCOMPLETE action-realization coverage must name at least one unrepresented targeted realization element'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    realization,
    realizationHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicActionRealizationCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicActionRealizationCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.realization.parentRegimenCompilationRef,
    normalized.semanticReviewRef
  ]);
}
