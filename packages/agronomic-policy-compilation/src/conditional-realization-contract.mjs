import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION =
  'adr.agronomic-conditional-action-realization.v1';
export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-conditional-action-realization-compilation.v1';

export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPOSITIONS = deepFreeze([
  'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED'
]);

export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPONENT_KINDS = deepFreeze([
  'SOURCE_NAMED_METHOD',
  'EXISTING_SOURCE_METHOD'
]);

export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_METHOD_CODES = deepFreeze([
  'CHISEL_PLOWING',
  'SOIL_FINISHING'
]);

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

const COMPONENT_SOURCE = Object.freeze({
  CHISEL_PLOWING: {
    kind: 'SOURCE_NAMED_METHOD',
    sourceExpression: 'chisel plowed'
  },
  SOIL_FINISHING: {
    kind: 'EXISTING_SOURCE_METHOD',
    sourceExpression: 'soil finished'
  }
});

const CONDITION_EXPRESSION = 'more aggressive tillage is needed';
const CONDITION_OBJECT_EXPRESSION = 'more aggressive tillage';

export class AgronomicConditionalActionRealizationCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicConditionalActionRealizationCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_FIELD',
        `${name}.${key} is not part of the conditional action-realization contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUTHORITY_REF',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) =>
    authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: requiredText(value.role, `${name}.role`),
    authorityRef: authorityRef(
      value.authorityRef,
      `${name}.authorityRef`,
      KNOWLEDGE_KINDS
    ),
    rationale: requiredText(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INPUT',
      `${name} must be a non-empty array`
    );
  }
  const normalized = values.map((value, index) =>
    authorityBinding(value, `${name}[${index}]`));
  const keys = normalized.map((binding) =>
    JSON.stringify([binding.role, refKey(binding.authorityRef), binding.rationale]));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_BINDING',
      `${name} cannot contain duplicate bindings`
    );
  }
  return deepFreeze([...normalized].sort((a, b) =>
    JSON.stringify([a.role, refKey(a.authorityRef), a.rationale])
      .localeCompare(JSON.stringify([b.role, refKey(b.authorityRef), b.rationale]))
  ));
}

function normalizeComponent(value, index) {
  const name = `conditionalRealization.compoundRealization.components[${index}]`;
  exactObject(value, name, new Set(['kind', 'methodCode', 'sourceExpression']));
  const kind = requiredText(value.kind, `${name}.kind`);
  const methodCode = requiredText(value.methodCode, `${name}.methodCode`);
  const sourceExpression = requiredText(value.sourceExpression, `${name}.sourceExpression`);
  if (!Object.hasOwn(COMPONENT_SOURCE, methodCode)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_METHOD',
      `DEC-0011 v1 does not admit method ${methodCode}`
    );
  }
  const expected = COMPONENT_SOURCE[methodCode];
  if (kind !== expected.kind || sourceExpression !== expected.sourceExpression) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPONENT_SOURCE_MISMATCH',
      `${methodCode} must retain its exact accepted component kind and source expression`
    );
  }
  return deepFreeze({ kind, methodCode, sourceExpression });
}

function componentKey(value) {
  return JSON.stringify([value.kind, value.methodCode, value.sourceExpression]);
}

function normalizeCompoundRealization(value) {
  exactObject(
    value,
    'conditionalRealization.compoundRealization',
    new Set(['composition', 'components'])
  );
  const composition = requiredText(
    value.composition,
    'conditionalRealization.compoundRealization.composition'
  );
  if (composition !== 'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPOSITION',
      'DEC-0011 v1 requires SOURCE_CONJUNCTION_NO_ORDER_ASSERTED composition'
    );
  }
  if (!Array.isArray(value.components)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPONENTS',
      'conditionalRealization.compoundRealization.components must be an array'
    );
  }
  const components = value.components.map(normalizeComponent);
  if (new Set(components.map(componentKey)).size !== components.length) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPONENT',
      'conditional realization components cannot contain duplicates'
    );
  }
  const codes = components.map((item) => item.methodCode).sort();
  if (components.length !== 2
    || JSON.stringify(codes) !== JSON.stringify(['CHISEL_PLOWING', 'SOIL_FINISHING'])) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_V1_SHAPE_MISMATCH',
      'DEC-0011 v1 requires exactly CHISEL_PLOWING and SOIL_FINISHING'
    );
  }
  return deepFreeze({
    composition,
    components: deepFreeze([...components].sort((a, b) =>
      componentKey(a).localeCompare(componentKey(b))))
  });
}

function normalizeSourceCondition(value) {
  exactObject(
    value,
    'conditionalRealization.sourceCondition',
    new Set(['expression', 'objectExpression'])
  );
  const expression = requiredText(
    value.expression,
    'conditionalRealization.sourceCondition.expression'
  );
  const objectExpression = requiredText(
    value.objectExpression,
    'conditionalRealization.sourceCondition.objectExpression'
  );
  if (expression !== CONDITION_EXPRESSION
    || objectExpression !== CONDITION_OBJECT_EXPRESSION) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONDITION_SOURCE_MISMATCH',
      'DEC-0011 v1 must retain the exact accepted condition and condition-object expressions'
    );
  }
  return deepFreeze({ expression, objectExpression });
}

export function normalizeAgronomicConditionalActionRealization(value) {
  exactObject(value, 'AgronomicConditionalActionRealization', new Set([
    'contractVersion',
    'conditionalRealizationId',
    'sourceExpression',
    'parentRegimenCompilationRef',
    'parentActionRealizationCompilationRef',
    'targetActionCode',
    'compoundRealization',
    'modalityCompilationRef',
    'sourceCondition',
    'authorityBindings',
    'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'conditionalRealization.contractVersion')
    !== AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT',
      'unsupported agronomic conditional action-realization contractVersion'
    );
  }
  const targetActionCode = requiredText(
    value.targetActionCode,
    'conditionalRealization.targetActionCode'
  );
  if (targetActionCode !== 'TILL') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_ACTION',
      'DEC-0011 v1 accepts only refinement of source-proven TILL action'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
    conditionalRealizationId: requiredText(
      value.conditionalRealizationId,
      'conditionalRealization.conditionalRealizationId'
    ),
    sourceExpression: requiredText(
      value.sourceExpression,
      'conditionalRealization.sourceExpression'
    ),
    parentRegimenCompilationRef: authorityRef(
      value.parentRegimenCompilationRef,
      'conditionalRealization.parentRegimenCompilationRef',
      new Set(['AgronomicActionRegimenCompilation'])
    ),
    parentActionRealizationCompilationRef: authorityRef(
      value.parentActionRealizationCompilationRef,
      'conditionalRealization.parentActionRealizationCompilationRef',
      new Set(['AgronomicActionRealizationCompilation'])
    ),
    targetActionCode,
    compoundRealization: normalizeCompoundRealization(value.compoundRealization),
    modalityCompilationRef: authorityRef(
      value.modalityCompilationRef,
      'conditionalRealization.modalityCompilationRef',
      new Set(['AgronomicNormativeModalityCompilation'])
    ),
    sourceCondition: normalizeSourceCondition(value.sourceCondition),
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'conditionalRealization.authorityBindings'
    ),
    transformationRationale: requiredText(
      value.transformationRationale,
      'conditionalRealization.transformationRationale'
    )
  });
}

export function agronomicConditionalActionRealizationHash(value) {
  return semanticHash(
    'AgronomicConditionalActionRealization',
    normalizeAgronomicConditionalActionRealization(value)
  );
}

export function normalizeAgronomicConditionalActionRealizationCompilation(value) {
  exactObject(value, 'AgronomicConditionalActionRealizationCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'sourceProtocolRefs',
    'sourceProtocolArtifactRefs',
    'knowledgeRefs',
    'conditionalRealization',
    'conditionalRealizationHash',
    'semanticReviewRef',
    'losslessCoverage',
    'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT',
      'unsupported agronomic conditional action-realization compilation contractVersion'
    );
  }
  if (value.authorityClass
    !== 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY'
    );
  }

  const sourceProtocolRefs = refList(
    value.sourceProtocolRefs,
    'sourceProtocolRefs',
    new Set(['Source']),
    { nonEmpty: true }
  );
  const sourceProtocolArtifactRefs = refList(
    value.sourceProtocolArtifactRefs,
    'sourceProtocolArtifactRefs',
    new Set(['SourceArtifact']),
    { nonEmpty: true }
  );
  const knowledgeRefs = refList(
    value.knowledgeRefs,
    'knowledgeRefs',
    KNOWLEDGE_KINDS,
    { nonEmpty: true }
  );
  const conditionalRealization = normalizeAgronomicConditionalActionRealization(
    value.conditionalRealization
  );
  const conditionalRealizationHash = requiredText(
    value.conditionalRealizationHash,
    'conditionalRealizationHash'
  );
  const expectedHash = agronomicConditionalActionRealizationHash(conditionalRealization);
  if (!HASH_RE.test(conditionalRealizationHash)
    || conditionalRealizationHash !== expectedHash) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_HASH_MISMATCH',
      'conditionalRealizationHash must exactly match the normalized conditional action realization'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicConditionalActionRealizationReviewDecision'])
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COVERAGE',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COVERAGE',
      'COMPLETE conditional action-realization coverage cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COVERAGE',
      'INCOMPLETE conditional action-realization coverage must name at least one targeted unrepresented element'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    conditionalRealization,
    conditionalRealizationHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicConditionalActionRealizationCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicConditionalActionRealizationCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.conditionalRealization.parentRegimenCompilationRef,
    normalized.conditionalRealization.parentActionRealizationCompilationRef,
    normalized.conditionalRealization.modalityCompilationRef,
    normalized.semanticReviewRef
  ]);
}
