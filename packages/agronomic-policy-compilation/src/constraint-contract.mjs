import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  AGRONOMIC_RULE_COMPARATORS,
  AGRONOMIC_RULE_LOGIC
} from './contract.mjs';

export const AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION = 'adr.agronomic-policy-constraint.v1';
export const AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-policy-constraint-compilation.v1';
export const AGRONOMIC_POLICY_CONSTRAINT_EFFECTS = deepFreeze(['PROHIBIT']);

const COMPARATORS = new Set(AGRONOMIC_RULE_COMPARATORS);
const LOGIC = new Set(AGRONOMIC_RULE_LOGIC);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class AgronomicPolicyConstraintCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicPolicyConstraintCompilationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicPolicyConstraintCompilationError(
        'INVALID_AGRONOMIC_POLICY_CONSTRAINT_FIELD',
        `${name}.${key} is not part of the constraint contract`
      );
    }
  }
}

function authorityRef(value, name, kinds) {
  const ref = assertAuthorityRef(value);
  if (!kinds.has(ref.kind)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_AUTHORITY_REF',
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
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => authorityRef(value, `${name}[${index}]`, kinds));
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicPolicyConstraintCompilationError(
      'DUPLICATE_AGRONOMIC_POLICY_CONSTRAINT_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicPolicyConstraintCompilationError(
      'DUPLICATE_AGRONOMIC_POLICY_CONSTRAINT_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: text(value.role, `${name}.role`),
    authorityRef: authorityRef(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: text(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_INPUT',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  return deepFreeze(values.map((value, index) => authorityBinding(value, `${name}[${index}]`)));
}

function typedLiteral(value, name) {
  exactObject(value, name, new Set(['type', 'decimal', 'integer', 'boolean', 'string', 'category', 'unit']));
  const type = text(value.type, `${name}.type`);
  const unit = value.unit === undefined ? undefined : text(value.unit, `${name}.unit`);

  if (type === 'DECIMAL') {
    const decimal = text(value.decimal, `${name}.decimal`);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decimal)) {
      throw new AgronomicPolicyConstraintCompilationError(
        'INVALID_AGRONOMIC_POLICY_CONSTRAINT_LITERAL',
        `${name}.decimal must be canonical base-10 text`
      );
    }
    return deepFreeze({ type, decimal, ...(unit ? { unit } : {}) });
  }

  if (type === 'INTEGER') {
    const integer = text(value.integer, `${name}.integer`);
    if (!/^-?(?:0|[1-9]\d*)$/.test(integer)) {
      throw new AgronomicPolicyConstraintCompilationError(
        'INVALID_AGRONOMIC_POLICY_CONSTRAINT_LITERAL',
        `${name}.integer must be canonical integer text`
      );
    }
    return deepFreeze({ type, integer: integer === '-0' ? '0' : integer, ...(unit ? { unit } : {}) });
  }

  if (type === 'BOOLEAN') {
    if (typeof value.boolean !== 'boolean') {
      throw new AgronomicPolicyConstraintCompilationError(
        'INVALID_AGRONOMIC_POLICY_CONSTRAINT_LITERAL',
        `${name}.boolean must be boolean`
      );
    }
    return deepFreeze({ type, boolean: value.boolean });
  }

  if (type === 'STRING') {
    return deepFreeze({ type, string: text(value.string, `${name}.string`) });
  }

  if (type === 'CATEGORY') {
    return deepFreeze({ type, category: text(value.category, `${name}.category`) });
  }

  throw new AgronomicPolicyConstraintCompilationError(
    'INVALID_AGRONOMIC_POLICY_CONSTRAINT_LITERAL',
    `${name}.type is unsupported`
  );
}

function predicate(value, name) {
  exactObject(value, name, new Set(['semanticId', 'comparator', 'value', 'authorityBindings']));
  const comparator = text(value.comparator, `${name}.comparator`);
  if (!COMPARATORS.has(comparator)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_COMPARATOR',
      `${name}.comparator is unsupported`
    );
  }
  return deepFreeze({
    semanticId: text(value.semanticId, `${name}.semanticId`),
    comparator,
    value: typedLiteral(value.value, `${name}.value`),
    authorityBindings: authorityBindings(value.authorityBindings, `${name}.authorityBindings`, { nonEmpty: true })
  });
}

function conditionGroup(value, name) {
  exactObject(value, name, new Set(['logic', 'predicates']));
  const logic = text(value.logic, `${name}.logic`);
  if (!LOGIC.has(logic)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_LOGIC',
      `${name}.logic is unsupported`
    );
  }
  if (!Array.isArray(value.predicates) || value.predicates.length === 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_CONDITION',
      `${name}.predicates must be non-empty`
    );
  }
  return deepFreeze({
    logic,
    predicates: deepFreeze(value.predicates.map((item, index) => predicate(item, `${name}.predicates[${index}]`)))
  });
}

export function normalizeAgronomicPolicyConstraint(value) {
  exactObject(value, 'AgronomicPolicyConstraint', new Set([
    'contractVersion',
    'constraintId',
    'decisionType',
    'effect',
    'actionCode',
    'when',
    'exceptions',
    'authorityBindings'
  ]));
  if (text(value.contractVersion, 'constraint.contractVersion') !== AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION) {
    throw new AgronomicPolicyConstraintCompilationError(
      'UNSUPPORTED_AGRONOMIC_POLICY_CONSTRAINT_CONTRACT',
      'unsupported agronomic policy constraint contractVersion'
    );
  }
  const effect = text(value.effect, 'constraint.effect');
  if (!AGRONOMIC_POLICY_CONSTRAINT_EFFECTS.includes(effect)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_EFFECT',
      `unsupported agronomic policy constraint effect ${effect}`
    );
  }
  const exceptions = value.exceptions ?? [];
  if (!Array.isArray(exceptions)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_EXCEPTION',
      'constraint.exceptions must be an array'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
    constraintId: text(value.constraintId, 'constraint.constraintId'),
    decisionType: text(value.decisionType, 'constraint.decisionType'),
    effect,
    actionCode: text(value.actionCode, 'constraint.actionCode'),
    ...(value.when === undefined ? {} : { when: conditionGroup(value.when, 'constraint.when') }),
    exceptions: deepFreeze(exceptions.map((item, index) => conditionGroup(item, `constraint.exceptions[${index}]`))),
    authorityBindings: authorityBindings(value.authorityBindings, 'constraint.authorityBindings', { nonEmpty: true })
  });
}

export function agronomicPolicyConstraintHash(value) {
  return semanticHash('AgronomicPolicyConstraint', normalizeAgronomicPolicyConstraint(value));
}

export function normalizeAgronomicPolicyConstraintCompilation(value) {
  exactObject(value, 'AgronomicPolicyConstraintCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'sourceProtocolRefs',
    'sourceProtocolArtifactRefs',
    'knowledgeRefs',
    'policyRef',
    'constraint',
    'constraintHash',
    'transformationRationale',
    'losslessCoverage',
    'approverPrincipal',
    'approvalRef',
    'limitations'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicPolicyConstraintCompilationError(
      'UNSUPPORTED_AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT',
      'unsupported agronomic policy constraint compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY') {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY'
    );
  }
  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const sourceProtocolArtifactRefs = refList(value.sourceProtocolArtifactRefs, 'sourceProtocolArtifactRefs', new Set(['SourceArtifact']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const policyRef = authorityRef(value.policyRef, 'policyRef', new Set(['Policy']));
  const constraint = normalizeAgronomicPolicyConstraint(value.constraint);
  const constraintHash = text(value.constraintHash, 'constraintHash');
  const computedConstraintHash = agronomicPolicyConstraintHash(constraint);
  if (!HASH_RE.test(constraintHash) || constraintHash !== computedConstraintHash) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_HASH_MISMATCH',
      'constraintHash must exactly match the normalized agronomic policy constraint'
    );
  }

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const status = text(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_COVERAGE',
      'COMPLETE coverage cannot declare unrepresented elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_COVERAGE',
      'INCOMPLETE coverage must name at least one unrepresented element'
    );
  }

  const approverPrincipal = value.approverPrincipal;
  exactObject(approverPrincipal, 'approverPrincipal', new Set(['principalId', 'type', 'organizationId', 'tenantId']));
  const approvalRef = authorityRef(value.approvalRef, 'approvalRef', new Set(['AuthorizationDecisionAudit']));

  return deepFreeze({
    contractVersion: AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    sourceProtocolArtifactRefs,
    knowledgeRefs,
    policyRef,
    constraint,
    constraintHash,
    transformationRationale: text(value.transformationRationale, 'transformationRationale'),
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    approverPrincipal: deepFreeze({
      principalId: text(approverPrincipal.principalId, 'approverPrincipal.principalId'),
      type: text(approverPrincipal.type, 'approverPrincipal.type'),
      organizationId: text(approverPrincipal.organizationId, 'approverPrincipal.organizationId'),
      ...(approverPrincipal.tenantId ? { tenantId: text(approverPrincipal.tenantId, 'approverPrincipal.tenantId') } : {})
    }),
    approvalRef,
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicPolicyConstraintCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicPolicyConstraintCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    normalized.policyRef,
    normalized.approvalRef
  ]);
}
