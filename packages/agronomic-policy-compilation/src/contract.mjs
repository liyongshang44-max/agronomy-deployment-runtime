import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION = 'adr.agronomic-policy-compilation.v1';
export const AGRONOMIC_RULE_CONTRACT_VERSION = 'adr.declarative-agronomic-rule.v1';

export const AGRONOMIC_RULE_COMPARATORS = deepFreeze([
  'LT',
  'LTE',
  'EQ',
  'GTE',
  'GT',
  'IN',
  'NOT_IN'
]);

export const AGRONOMIC_TEMPORAL_MODES = deepFreeze([
  'INSTANT',
  'CONSECUTIVE',
  'TRAILING_WINDOW',
  'FORECAST_WINDOW'
]);

export const AGRONOMIC_RULE_LOGIC = deepFreeze(['ALL', 'ANY']);
export const AGRONOMIC_ACTION_TIMING_MODES = deepFreeze(['IMMEDIATE', 'OFFSET']);
export const AGRONOMIC_PARAMETER_EXPRESSION_TYPES = deepFreeze([
  'CONSTANT',
  'COPY',
  'ABS',
  'NEGATE',
  'MIN',
  'MAX'
]);

const COMPARATOR_SET = new Set(AGRONOMIC_RULE_COMPARATORS);
const TEMPORAL_MODE_SET = new Set(AGRONOMIC_TEMPORAL_MODES);
const LOGIC_SET = new Set(AGRONOMIC_RULE_LOGIC);
const ACTION_TIMING_SET = new Set(AGRONOMIC_ACTION_TIMING_MODES);
const PARAMETER_EXPRESSION_SET = new Set(AGRONOMIC_PARAMETER_EXPRESSION_TYPES);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const SPECIFICATION_KINDS = new Set(['Model', 'Policy', 'QualifiedTransformation']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_DURATION_RE = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export class AgronomicPolicyCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicPolicyCompilationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_POLICY_COMPILATION_FIELD',
        `${name}.${key} is not part of ${AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION}`
      );
    }
  }
}

function bool(value, name) {
  if (typeof value !== 'boolean') {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be boolean`);
  }
  return value;
}

function integer(value, name, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT',
      `${name} must be a safe integer >= ${minimum}`
    );
  }
  return value;
}

function duration(value, name) {
  const normalized = text(value, name);
  const match = ISO_DURATION_RE.exec(normalized);
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_DURATION',
      `${name} must be a non-zero ISO-8601 duration`
    );
  }
  return normalized;
}

function ref(value, name, allowedKinds) {
  const normalized = assertAuthorityRef(value);
  if (!allowedKinds.has(normalized.kind)) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_AUTHORITY_REF',
      `${name} must reference one of: ${[...allowedKinds].join(', ')}`
    );
  }
  return normalized;
}

function refList(values, name, allowedKinds, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) => ref(value, `${name}[${index}]`, allowedKinds));
  const keyed = normalized.map((item) => [JSON.stringify([item.kind, item.logicalId, item.version, item.semanticHash]), item]);
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new AgronomicPolicyCompilationError('DUPLICATE_AGRONOMIC_POLICY_AUTHORITY_REF', `${name} cannot contain duplicate exact refs`);
  }
  return deepFreeze(keyed.sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be an array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicPolicyCompilationError('DUPLICATE_AGRONOMIC_POLICY_VALUE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort());
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  return deepFreeze({
    role: text(value.role, `${name}.role`),
    authorityRef: ref(value.authorityRef, `${name}.authorityRef`, KNOWLEDGE_KINDS),
    rationale: text(value.rationale, `${name}.rationale`)
  });
}

function typedLiteral(value, name) {
  exactObject(value, name, new Set(['type', 'decimal', 'integer', 'boolean', 'string', 'category', 'unit']));
  const type = text(value.type, `${name}.type`);
  const allowed = new Set(['DECIMAL', 'INTEGER', 'BOOLEAN', 'STRING', 'CATEGORY']);
  if (!allowed.has(type)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_LITERAL', `${name}.type is unsupported`);
  }
  const unit = value.unit === undefined ? undefined : text(value.unit, `${name}.unit`);
  if (type === 'DECIMAL') {
    const decimal = text(value.decimal, `${name}.decimal`);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decimal)) {
      throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_LITERAL', `${name}.decimal must be canonical base-10 text`);
    }
    return deepFreeze({ type, decimal, ...(unit ? { unit } : {}) });
  }
  if (type === 'INTEGER') {
    const integerValue = text(value.integer, `${name}.integer`);
    if (!/^-?(?:0|[1-9]\d*)$/.test(integerValue)) {
      throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_LITERAL', `${name}.integer must be canonical integer text`);
    }
    return deepFreeze({ type, integer: integerValue === '-0' ? '0' : integerValue, ...(unit ? { unit } : {}) });
  }
  if (type === 'BOOLEAN') {
    return deepFreeze({ type, boolean: bool(value.boolean, `${name}.boolean`) });
  }
  if (type === 'STRING') {
    return deepFreeze({ type, string: text(value.string, `${name}.string`) });
  }
  return deepFreeze({ type, category: text(value.category, `${name}.category`) });
}

function temporalQualifier(value, name) {
  exactObject(value, name, new Set(['mode', 'count', 'period', 'window']));
  const mode = text(value.mode, `${name}.mode`);
  if (!TEMPORAL_MODE_SET.has(mode)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_TEMPORAL_MODE', `${name}.mode is unsupported`);
  }
  if (mode === 'INSTANT') return deepFreeze({ mode });
  if (mode === 'CONSECUTIVE') {
    return deepFreeze({
      mode,
      count: integer(value.count, `${name}.count`, { minimum: 1 }),
      period: duration(value.period, `${name}.period`)
    });
  }
  return deepFreeze({ mode, window: duration(value.window, `${name}.window`) });
}

function predicate(value, name) {
  exactObject(value, name, new Set(['semanticId', 'comparator', 'value', 'temporal', 'authorityBindings']));
  const comparator = text(value.comparator, `${name}.comparator`);
  if (!COMPARATOR_SET.has(comparator)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_COMPARATOR', `${name}.comparator is unsupported`);
  }
  return deepFreeze({
    semanticId: text(value.semanticId, `${name}.semanticId`),
    comparator,
    value: typedLiteral(value.value, `${name}.value`),
    temporal: temporalQualifier(value.temporal ?? { mode: 'INSTANT' }, `${name}.temporal`),
    authorityBindings: deepFreeze((value.authorityBindings ?? []).map((binding, index) =>
      authorityBinding(binding, `${name}.authorityBindings[${index}]`)))
  });
}

function conditionGroup(value, name) {
  exactObject(value, name, new Set(['logic', 'predicates']));
  const logic = text(value.logic, `${name}.logic`);
  if (!LOGIC_SET.has(logic)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_LOGIC', `${name}.logic is unsupported`);
  }
  if (!Array.isArray(value.predicates) || value.predicates.length === 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_CONDITION', `${name}.predicates must be non-empty`);
  }
  return deepFreeze({
    logic,
    predicates: deepFreeze(value.predicates.map((item, index) => predicate(item, `${name}.predicates[${index}]`)))
  });
}

function parameterExpression(value, name) {
  exactObject(value, name, new Set(['type', 'value', 'sourceSemanticId', 'authorityBindings']));
  const type = text(value.type, `${name}.type`);
  if (!PARAMETER_EXPRESSION_SET.has(type)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_PARAMETER_EXPRESSION', `${name}.type is unsupported`);
  }
  const authorityBindings = deepFreeze((value.authorityBindings ?? []).map((binding, index) =>
    authorityBinding(binding, `${name}.authorityBindings[${index}]`)));
  if (type === 'CONSTANT') {
    return deepFreeze({ type, value: typedLiteral(value.value, `${name}.value`), authorityBindings });
  }
  return deepFreeze({
    type,
    sourceSemanticId: text(value.sourceSemanticId, `${name}.sourceSemanticId`),
    authorityBindings
  });
}

function actionTiming(value, name) {
  exactObject(value, name, new Set(['mode', 'offset']));
  const mode = text(value.mode, `${name}.mode`);
  if (!ACTION_TIMING_SET.has(mode)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_ACTION_TIMING', `${name}.mode is unsupported`);
  }
  if (mode === 'IMMEDIATE') return deepFreeze({ mode });
  return deepFreeze({ mode, offset: duration(value.offset, `${name}.offset`) });
}

function action(value, name) {
  exactObject(value, name, new Set(['actionCode', 'timing', 'parameters', 'authorityBindings']));
  if (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_ACTION', `${name}.parameters must be an object`);
  }
  const parameters = {};
  for (const [parameterName, expression] of Object.entries(value.parameters)) {
    parameters[text(parameterName, `${name}.parameterName`)] = parameterExpression(expression, `${name}.parameters.${parameterName}`);
  }
  return deepFreeze({
    actionCode: text(value.actionCode, `${name}.actionCode`),
    timing: actionTiming(value.timing ?? { mode: 'IMMEDIATE' }, `${name}.timing`),
    parameters: deepFreeze(parameters),
    authorityBindings: deepFreeze((value.authorityBindings ?? []).map((binding, index) =>
      authorityBinding(binding, `${name}.authorityBindings[${index}]`)))
  });
}

export function normalizeDeclarativeAgronomicRule(value) {
  exactObject(value, 'DeclarativeAgronomicRule', new Set([
    'contractVersion',
    'ruleId',
    'decisionType',
    'inputs',
    'trigger',
    'exceptions',
    'action',
    'fallback',
    'humanGate',
    'limitations'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== AGRONOMIC_RULE_CONTRACT_VERSION) {
    throw new AgronomicPolicyCompilationError('UNSUPPORTED_AGRONOMIC_RULE_CONTRACT', 'unsupported declarative agronomic rule contract');
  }
  const exceptions = value.exceptions ?? [];
  if (!Array.isArray(exceptions)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_RULE_EXCEPTION', 'exceptions must be an array');
  }
  exactObject(value.fallback, 'fallback', new Set(['disposition']));
  exactObject(value.humanGate, 'humanGate', new Set(['required']));
  return deepFreeze({
    contractVersion: AGRONOMIC_RULE_CONTRACT_VERSION,
    ruleId: text(value.ruleId, 'ruleId'),
    decisionType: text(value.decisionType, 'decisionType'),
    inputs: stringList(value.inputs ?? [], 'inputs'),
    trigger: conditionGroup(value.trigger, 'trigger'),
    exceptions: deepFreeze(exceptions.map((exception, index) => conditionGroup(exception, `exceptions[${index}]`))),
    action: action(value.action, 'action'),
    fallback: deepFreeze({ disposition: text(value.fallback.disposition, 'fallback.disposition') }),
    humanGate: deepFreeze({ required: bool(value.humanGate.required, 'humanGate.required') }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function declarativeAgronomicRuleHash(value) {
  return semanticHash('DeclarativeAgronomicRule', normalizeDeclarativeAgronomicRule(value));
}

export function normalizeAgronomicPolicyCompilation(value) {
  exactObject(value, 'AgronomicPolicyCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'sourceProtocolRefs',
    'knowledgeRefs',
    'modelRefs',
    'policyRef',
    'rule',
    'ruleHash',
    'transformationRationale',
    'losslessCoverage',
    'approverPrincipal',
    'approvalRef',
    'limitations'
  ]));
  if (text(value.contractVersion, 'contractVersion') !== AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicPolicyCompilationError('UNSUPPORTED_AGRONOMIC_POLICY_COMPILATION_CONTRACT', 'unsupported agronomic policy compilation contract');
  }
  if (value.authorityClass !== 'AGRONOMIC_POLICY_COMPILATION_AUTHORITY') {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_AUTHORITY', 'authorityClass must be AGRONOMIC_POLICY_COMPILATION_AUTHORITY');
  }
  const sourceProtocolRefs = refList(value.sourceProtocolRefs, 'sourceProtocolRefs', new Set(['Source']), { nonEmpty: true });
  const knowledgeRefs = refList(value.knowledgeRefs, 'knowledgeRefs', KNOWLEDGE_KINDS, { nonEmpty: true });
  const modelRefs = refList(value.modelRefs ?? [], 'modelRefs', new Set(['Model']));
  const policyRef = ref(value.policyRef, 'policyRef', new Set(['Policy']));
  const rule = normalizeDeclarativeAgronomicRule(value.rule);
  const computedRuleHash = declarativeAgronomicRuleHash(rule);
  const suppliedRuleHash = text(value.ruleHash, 'ruleHash');
  if (!HASH_RE.test(suppliedRuleHash) || suppliedRuleHash !== computedRuleHash) {
    throw new AgronomicPolicyCompilationError('AGRONOMIC_RULE_HASH_MISMATCH', 'ruleHash must exactly match the normalized declarative rule');
  }
  exactObject(value.losslessCoverage, 'losslessCoverage', new Set(['status', 'coveredElements', 'unrepresentedElements']));
  const coverageStatus = text(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(coverageStatus)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COVERAGE', 'losslessCoverage.status must be COMPLETE or INCOMPLETE');
  }
  const coveredElements = stringList(value.losslessCoverage.coveredElements ?? [], 'losslessCoverage.coveredElements');
  const unrepresentedElements = stringList(value.losslessCoverage.unrepresentedElements ?? [], 'losslessCoverage.unrepresentedElements');
  if (coverageStatus === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COVERAGE', 'COMPLETE coverage cannot declare unrepresented elements');
  }
  if (coverageStatus === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COVERAGE', 'INCOMPLETE coverage must name at least one unrepresented element');
  }
  const approvalRef = ref(value.approvalRef, 'approvalRef', new Set(['AuthorizationDecisionAudit', 'ScientificQualificationDecision']));
  const approverPrincipal = value.approverPrincipal;
  exactObject(approverPrincipal, 'approverPrincipal', new Set(['principalId', 'type', 'organizationId', 'tenantId']));
  return deepFreeze({
    contractVersion: AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_POLICY_COMPILATION_AUTHORITY',
    sourceProtocolRefs,
    knowledgeRefs,
    modelRefs,
    policyRef,
    rule,
    ruleHash: suppliedRuleHash,
    transformationRationale: text(value.transformationRationale, 'transformationRationale'),
    losslessCoverage: deepFreeze({ status: coverageStatus, coveredElements, unrepresentedElements }),
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

export function agronomicPolicyCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicPolicyCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.knowledgeRefs,
    ...normalized.modelRefs,
    normalized.policyRef,
    normalized.approvalRef
  ]);
}
