import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION = 'adr.agronomic-goal-condition.v1';
export const AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-goal-condition-compilation.v1';
export const AGRONOMIC_GOAL_CONDITION_RELATIONS = deepFreeze(['PREVENT', 'CONTROL']);
export const AGRONOMIC_GOAL_CONDITION_TARGET_SCOPES = deepFreeze(['ACTION']);

const RELATION_SET = new Set(AGRONOMIC_GOAL_CONDITION_RELATIONS);
const TARGET_SET = new Set(AGRONOMIC_GOAL_CONDITION_TARGET_SCOPES);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicGoalConditionCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicGoalConditionCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicGoalConditionCompilationError(
        'INVALID_AGRONOMIC_GOAL_CONDITION_FIELD',
        `${name}.${key} is not part of the goal-condition contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_AUTHORITY_REF',
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
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicGoalConditionCompilationError(
      'DUPLICATE_AGRONOMIC_GOAL_CONDITION_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicGoalConditionCompilationError('DUPLICATE_AGRONOMIC_GOAL_CONDITION_VALUE', `${name} cannot contain duplicates`);
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
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_INPUT', `${name} must be a non-empty array`);
  }
  const normalized = values.map((value, index) => authorityBinding(value, `${name}[${index}]`));
  const keys = normalized.map((binding) => JSON.stringify([binding.role, refKey(binding.authorityRef), binding.rationale]));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicGoalConditionCompilationError('DUPLICATE_AGRONOMIC_GOAL_CONDITION_BINDING', `${name} cannot contain duplicate bindings`);
  }
  return deepFreeze([...normalized].sort((a, b) =>
    JSON.stringify([a.role, refKey(a.authorityRef), a.rationale])
      .localeCompare(JSON.stringify([b.role, refKey(b.authorityRef), b.rationale]))
  ));
}

export function normalizeAgronomicGoalCondition(value) {
  exactObject(value, 'AgronomicGoalCondition', new Set([
    'contractVersion', 'goalConditionId', 'sourceExpression', 'targetScope', 'relation',
    'goalObjectExpression', 'authorityBindings', 'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'goalCondition.contractVersion') !== AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION) {
    throw new AgronomicGoalConditionCompilationError(
      'UNSUPPORTED_AGRONOMIC_GOAL_CONDITION_CONTRACT',
      'unsupported agronomic goal-condition contractVersion'
    );
  }
  const targetScope = requiredText(value.targetScope, 'goalCondition.targetScope');
  if (!TARGET_SET.has(targetScope)) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_TARGET_SCOPE',
      `unsupported goal-condition targetScope ${targetScope}`
    );
  }
  const relation = requiredText(value.relation, 'goalCondition.relation');
  if (!RELATION_SET.has(relation)) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_RELATION',
      `unsupported goal-condition relation ${relation}`
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: requiredText(value.goalConditionId, 'goalCondition.goalConditionId'),
    sourceExpression: requiredText(value.sourceExpression, 'goalCondition.sourceExpression'),
    targetScope,
    relation,
    goalObjectExpression: requiredText(value.goalObjectExpression, 'goalCondition.goalObjectExpression'),
    authorityBindings: authorityBindings(value.authorityBindings, 'goalCondition.authorityBindings'),
    transformationRationale: requiredText(value.transformationRationale, 'goalCondition.transformationRationale')
  });
}

export function agronomicGoalConditionHash(value) {
  return semanticHash('AgronomicGoalCondition', normalizeAgronomicGoalCondition(value));
}

export function normalizeAgronomicGoalConditionCompilation(value) {
  exactObject(value, 'AgronomicGoalConditionCompilation', new Set([
    'contractVersion', 'authorityClass', 'sourceProtocolRefs', 'sourceProtocolArtifactRefs', 'knowledgeRefs',
    'goalCondition', 'goalConditionHash', 'semanticReviewRef', 'losslessCoverage', 'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion') !== AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicGoalConditionCompilationError(
      'UNSUPPORTED_AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT',
      'unsupported agronomic goal-condition compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY') {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY'
    );
  }
  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(value.sourceProtocolArtifactRefs, 'sourceProtocolArtifactRefs', new Set(['SourceArtifact']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const goalCondition = normalizeAgronomicGoalCondition(value.goalCondition);
  const goalConditionHash = requiredText(value.goalConditionHash, 'goalConditionHash');
  const expectedHash = agronomicGoalConditionHash(goalCondition);
  if (!HASH_RE.test(goalConditionHash) || goalConditionHash !== expectedHash) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_HASH_MISMATCH',
      'goalConditionHash must exactly match the normalized goal condition'
    );
  }
  const semanticReviewRef = authorityRef(
    value.semanticReviewRef,
    'semanticReviewRef',
    new Set(['AgronomicGoalConditionReviewDecision'])
  );
  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_COVERAGE',
      'COMPLETE goal-condition coverage cannot declare unrepresented goal elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_COVERAGE',
      'INCOMPLETE goal-condition coverage must name at least one unrepresented goal element'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    goalCondition,
    goalConditionHash,
    semanticReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicGoalConditionCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicGoalConditionCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.semanticReviewRef
  ]);
}
