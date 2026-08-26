import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  AGRONOMIC_ACTION_TIMING_MODES,
  AGRONOMIC_PARAMETER_EXPRESSION_TYPES,
  AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RULE_COMPARATORS,
  AGRONOMIC_RULE_CONTRACT_VERSION,
  AGRONOMIC_RULE_LOGIC,
  AGRONOMIC_TEMPORAL_MODES,
  AgronomicPolicyCompilationError,
  normalizeAgronomicPolicyCompilation as normalizeBaseCompilation,
  normalizeDeclarativeAgronomicRule as normalizeBaseRule
} from './contract.mjs';

export {
  AGRONOMIC_ACTION_TIMING_MODES,
  AGRONOMIC_PARAMETER_EXPRESSION_TYPES,
  AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RULE_COMPARATORS,
  AGRONOMIC_RULE_CONTRACT_VERSION,
  AGRONOMIC_RULE_LOGIC,
  AGRONOMIC_TEMPORAL_MODES,
  AgronomicPolicyCompilationError
};

export const AGRONOMIC_COORDINATION_MODES = deepFreeze([
  'NONE',
  'NOTIFY',
  'APPROVAL_REQUIRED'
]);

const COORDINATION_MODES = new Set(AGRONOMIC_COORDINATION_MODES);
const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_DURATION_RE = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_POLICY_COMPILATION_FIELD',
        `${name}.${key} is not part of the agronomic compilation contract`
      );
    }
  }
}

function canonicalObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} must be an object`);
  }
  const normalized = cloneCanonicalValue(value);
  if (Object.keys(normalized).length === 0) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT', `${name} cannot be empty`);
  }
  return deepFreeze(normalized);
}

function duration(value, name) {
  const normalized = text(value, name);
  const match = ISO_DURATION_RE.exec(normalized);
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_POLICY_DURATION', `${name} must be a non-zero ISO-8601 duration`);
  }
  return normalized;
}

function ref(value, name, kinds) {
  const normalized = assertAuthorityRef(value);
  if (!kinds.has(normalized.kind)) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return normalized;
}

function refKey(value) {
  const normalized = assertAuthorityRef(value);
  return JSON.stringify([normalized.kind, normalized.logicalId, normalized.version, normalized.semanticHash]);
}

function stringList(values, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
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

function normalizeCoordination(value) {
  exactObject(value, 'coordination', new Set(['mode', 'channel', 'participants', 'authorityBindings']));
  const mode = text(value.mode, 'coordination.mode');
  if (!COORDINATION_MODES.has(mode)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_COORDINATION_MODE', `unsupported coordination mode ${mode}`);
  }
  const participants = stringList(value.participants ?? [], 'coordination.participants');
  const authorityBindings = deepFreeze((value.authorityBindings ?? []).map((binding, index) =>
    authorityBinding(binding, `coordination.authorityBindings[${index}]`)));
  if (mode === 'NONE') {
    if (value.channel !== undefined || participants.length > 0 || authorityBindings.length > 0) {
      throw new AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_COORDINATION',
        'coordination NONE cannot carry channel, participants or authority bindings'
      );
    }
    return deepFreeze({ mode, participants: deepFreeze([]), authorityBindings: deepFreeze([]) });
  }
  if (participants.length === 0) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_COORDINATION',
      `${mode} coordination requires at least one participant`
    );
  }
  return deepFreeze({
    mode,
    ...(value.channel ? { channel: text(value.channel, 'coordination.channel') } : {}),
    participants,
    authorityBindings
  });
}

function baseRuleInput(value) {
  const allowed = [
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
  ];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

export function normalizeDeclarativeAgronomicRule(value) {
  exactObject(value, 'DeclarativeAgronomicRule', new Set([
    'contractVersion',
    'ruleId',
    'decisionType',
    'inputs',
    'evaluationCadence',
    'trigger',
    'exceptions',
    'action',
    'coordination',
    'fallback',
    'humanGate',
    'limitations'
  ]));
  const base = normalizeBaseRule(baseRuleInput(value));
  const coordination = normalizeCoordination(value.coordination ?? { mode: 'NONE' });
  if (coordination.mode === 'APPROVAL_REQUIRED' && base.humanGate.required !== true) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_COORDINATION_HUMAN_GATE_MISMATCH',
      'APPROVAL_REQUIRED coordination requires humanGate.required=true'
    );
  }
  return deepFreeze({
    ...base,
    evaluationCadence: duration(value.evaluationCadence, 'evaluationCadence'),
    coordination
  });
}

export function declarativeAgronomicRuleHash(value) {
  return semanticHash('DeclarativeAgronomicRule', normalizeDeclarativeAgronomicRule(value));
}

export function agronomicModelDefinitionHash(definition) {
  return semanticHash('AgronomicModelDefinition', canonicalObject(definition, 'modelDefinition.definition'));
}

function normalizeModelDefinition(value, name) {
  exactObject(value, name, new Set([
    'modelRef',
    'semanticRole',
    'methodId',
    'inputSemanticIds',
    'outputSemanticIds',
    'definition',
    'definitionHash',
    'authorityBindings'
  ]));
  const definition = canonicalObject(value.definition, `${name}.definition`);
  const definitionHash = text(value.definitionHash, `${name}.definitionHash`);
  const computedHash = agronomicModelDefinitionHash(definition);
  if (!HASH_RE.test(definitionHash) || definitionHash !== computedHash) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_MODEL_DEFINITION_HASH_MISMATCH',
      `${name}.definitionHash must match the canonical declarative model definition`
    );
  }
  return deepFreeze({
    modelRef: ref(value.modelRef, `${name}.modelRef`, new Set(['Model'])),
    semanticRole: text(value.semanticRole, `${name}.semanticRole`),
    methodId: text(value.methodId, `${name}.methodId`),
    inputSemanticIds: stringList(value.inputSemanticIds, `${name}.inputSemanticIds`, { nonEmpty: true }),
    outputSemanticIds: stringList(value.outputSemanticIds, `${name}.outputSemanticIds`, { nonEmpty: true }),
    definition,
    definitionHash,
    authorityBindings: deepFreeze((value.authorityBindings ?? []).map((binding, index) =>
      authorityBinding(binding, `${name}.authorityBindings[${index}]`)))
  });
}

function normalizedModelDefinitions(values) {
  if (!Array.isArray(values)) {
    throw new AgronomicPolicyCompilationError('INVALID_AGRONOMIC_MODEL_DEFINITIONS', 'modelDefinitions must be an array');
  }
  const normalized = values.map((value, index) => normalizeModelDefinition(value, `modelDefinitions[${index}]`));
  const keys = normalized.map((item) => refKey(item.modelRef));
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicPolicyCompilationError('DUPLICATE_AGRONOMIC_MODEL_DEFINITION', 'modelDefinitions cannot repeat an exact Model ref');
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a.modelRef).localeCompare(refKey(b.modelRef))));
}

function stripExtendedRule(value) {
  return baseRuleInput(value);
}

function baseCompilationInput(value, baseRuleHash) {
  const allowed = [
    'contractVersion',
    'authorityClass',
    'sourceProtocolRefs',
    'knowledgeRefs',
    'modelRefs',
    'policyRef',
    'transformationRationale',
    'losslessCoverage',
    'approverPrincipal',
    'approvalRef',
    'limitations'
  ];
  const input = Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
  input.rule = stripExtendedRule(value.rule);
  input.ruleHash = baseRuleHash;
  return input;
}

export function normalizeAgronomicPolicyCompilation(value) {
  exactObject(value, 'AgronomicPolicyCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'sourceProtocolRefs',
    'knowledgeRefs',
    'modelRefs',
    'modelDefinitions',
    'policyRef',
    'rule',
    'ruleHash',
    'transformationRationale',
    'losslessCoverage',
    'approverPrincipal',
    'approvalRef',
    'limitations'
  ]));
  const extendedRule = normalizeDeclarativeAgronomicRule(value.rule);
  const suppliedRuleHash = text(value.ruleHash, 'ruleHash');
  const extendedRuleHash = declarativeAgronomicRuleHash(extendedRule);
  if (!HASH_RE.test(suppliedRuleHash) || suppliedRuleHash !== extendedRuleHash) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_RULE_HASH_MISMATCH',
      'ruleHash must exactly match the extended declarative agronomic rule'
    );
  }
  const baseRule = normalizeBaseRule(stripExtendedRule(value.rule));
  const baseRuleHash = semanticHash('DeclarativeAgronomicRule', baseRule);
  const base = normalizeBaseCompilation(baseCompilationInput(value, baseRuleHash));
  const modelDefinitions = normalizedModelDefinitions(value.modelDefinitions ?? []);
  const modelRefKeys = base.modelRefs.map(refKey).sort();
  const definitionRefKeys = modelDefinitions.map((item) => refKey(item.modelRef)).sort();
  if (JSON.stringify(modelRefKeys) !== JSON.stringify(definitionRefKeys)) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_MODEL_DEFINITION_COVERAGE_MISMATCH',
      'modelDefinitions must provide exactly one content-addressed declarative definition for every modelRef'
    );
  }
  return deepFreeze({
    ...base,
    rule: extendedRule,
    ruleHash: suppliedRuleHash,
    modelDefinitions
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
