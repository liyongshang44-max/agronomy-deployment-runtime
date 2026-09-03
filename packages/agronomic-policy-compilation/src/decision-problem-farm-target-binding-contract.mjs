import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION =
  'adr.agronomic-decision-problem-farm-target-binding.v1';
export const AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-decision-problem-farm-target-binding-compilation.v1';

const TARGET_ID_RE = /^target_src_[0-9a-f]{64}$/;

export class AgronomicDecisionProblemFarmTargetBindingCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicDecisionProblemFarmTargetBindingCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be a non-empty string'
    );
  }
  return value.trim();
}

function exactObject(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be an object'
    );
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_FIELD',
        name + '.' + key + ' is not part of the DEC-0032 contract'
      );
    }
  }
}

function authorityRef(value, name, kind) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_AUTHORITY_REF',
      name + ' must be an exact authority ref'
    );
  }
  if (ref.kind !== kind) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_AUTHORITY_REF',
      name + ' must reference ' + kind
    );
  }
  return ref;
}

function exactStringSet(values, name, expected) {
  if (!Array.isArray(values)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, name + '[' + index + ']')
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'DUPLICATE_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_VALUE',
      name + ' cannot contain duplicates'
    );
  }
  const sorted = [...normalized].sort();
  const required = [...expected].sort();
  if (
    sorted.length !== required.length
    || !sorted.every((value, index) => value === required[index])
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_OWNERSHIP',
      name + ' must equal the exact DEC-0032 ownership set'
    );
  }
  return deepFreeze(sorted);
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, name + '[' + index + ']')
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'DUPLICATE_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_VALUE',
      name + ' cannot contain duplicates'
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicDecisionProblemFarmTargetBinding(value) {
  exactObject(
    value,
    'AgronomicDecisionProblemFarmTargetBinding',
    new Set([
      'contractVersion',
      'bindingId',
      'parentTargetRefFarmInstanceProjectionCompilationRef',
      'sourceBackedTargetComponent',
      'deploymentOwnedTargetFields',
      'forbiddenUnestablishedTargetFields',
      'decisionIntentAuthority',
      'targetBindingRule',
      'rationale'
    ])
  );

  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT',
      'unsupported DEC-0032 binding contractVersion'
    );
  }

  exactObject(
    value.sourceBackedTargetComponent,
    'sourceBackedTargetComponent',
    new Set(['field', 'value'])
  );
  const field = requiredText(
    value.sourceBackedTargetComponent.field,
    'sourceBackedTargetComponent.field'
  );
  const targetId = requiredText(
    value.sourceBackedTargetComponent.value,
    'sourceBackedTargetComponent.value'
  );
  if (field !== 'farmId') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPONENT',
      'DEC-0032 v1 supports only targetRef.farmId'
    );
  }
  if (!TARGET_ID_RE.test(targetId)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_FARM_ID',
      'sourceBackedTargetComponent.value must be target_src_<64 lowercase hex>'
    );
  }

  exactObject(
    value.deploymentOwnedTargetFields,
    'deploymentOwnedTargetFields',
    new Set(['required', 'optional'])
  );
  const requiredFields = exactStringSet(
    value.deploymentOwnedTargetFields.required,
    'deploymentOwnedTargetFields.required',
    ['organizationId']
  );
  const optionalFields = exactStringSet(
    value.deploymentOwnedTargetFields.optional,
    'deploymentOwnedTargetFields.optional',
    ['tenantId']
  );

  exactObject(
    value.forbiddenUnestablishedTargetFields,
    'forbiddenUnestablishedTargetFields',
    new Set(['fields'])
  );
  const forbiddenFields = exactStringSet(
    value.forbiddenUnestablishedTargetFields.fields,
    'forbiddenUnestablishedTargetFields.fields',
    ['fieldId', 'seasonId', 'zoneId']
  );

  const decisionIntentAuthority = requiredText(
    value.decisionIntentAuthority,
    'decisionIntentAuthority'
  );
  if (decisionIntentAuthority !== 'A01_AUTHORIZED_CREATOR') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INTENT_AUTHORITY',
      'DEC-0032 decision intent authority must remain A01_AUTHORIZED_CREATOR'
    );
  }

  const targetBindingRule = requiredText(
    value.targetBindingRule,
    'targetBindingRule'
  );
  if (targetBindingRule !== 'INJECT_EXACT_PARENT_FARM_ID') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_RULE',
      'DEC-0032 v1 requires INJECT_EXACT_PARENT_FARM_ID'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION,
    bindingId: requiredText(value.bindingId, 'bindingId'),
    parentTargetRefFarmInstanceProjectionCompilationRef: authorityRef(
      value.parentTargetRefFarmInstanceProjectionCompilationRef,
      'parentTargetRefFarmInstanceProjectionCompilationRef',
      'AgronomicContextTargetRefFarmInstanceProjectionCompilation'
    ),
    sourceBackedTargetComponent: deepFreeze({
      field: 'farmId',
      value: targetId
    }),
    deploymentOwnedTargetFields: deepFreeze({
      required: requiredFields,
      optional: optionalFields
    }),
    forbiddenUnestablishedTargetFields: deepFreeze({
      fields: forbiddenFields
    }),
    decisionIntentAuthority: 'A01_AUTHORIZED_CREATOR',
    targetBindingRule: 'INJECT_EXACT_PARENT_FARM_ID',
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicDecisionProblemFarmTargetBindingHash(value) {
  return semanticHash(
    'AgronomicDecisionProblemFarmTargetBinding',
    normalizeAgronomicDecisionProblemFarmTargetBinding(value)
  );
}

export function normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(value) {
  exactObject(
    value,
    'AgronomicDecisionProblemFarmTargetBindingCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'binding',
      'bindingHash',
      'bindingReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT',
      'unsupported DEC-0032 binding compilation contractVersion'
    );
  }
  if (
    value.authorityClass
      !== 'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY'
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_AUTHORITY',
      'invalid DEC-0032 binding authorityClass'
    );
  }

  const binding = normalizeAgronomicDecisionProblemFarmTargetBinding(value.binding);
  const bindingHash = requiredText(value.bindingHash, 'bindingHash');
  if (bindingHash !== agronomicDecisionProblemFarmTargetBindingHash(binding)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_HASH_MISMATCH',
      'bindingHash must match exact normalized DEC-0032 binding'
    );
  }

  const bindingReviewRef = authorityRef(
    value.bindingReviewRef,
    'bindingReviewRef',
    'AgronomicDecisionProblemFarmTargetBindingReviewDecision'
  );

  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COVERAGE',
      'coverage status must be COMPLETE or INCOMPLETE'
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
  if (status === 'COMPLETE' && unrepresentedElements.length > 0) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COVERAGE',
      'COMPLETE cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COVERAGE',
      'INCOMPLETE must name unresolved targeted elements'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash,
    bindingReviewRef,
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicDecisionProblemFarmTargetBindingCompilationAuthorityRefs(value) {
  const normalized =
    normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(value);
  return deepFreeze([
    normalized.binding.parentTargetRefFarmInstanceProjectionCompilationRef,
    normalized.bindingReviewRef
  ]);
}
