import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import * as v1 from './extended-contract-v1.mjs';

export {
  AGRONOMIC_ACTION_TIMING_MODES,
  AGRONOMIC_COORDINATION_MODES,
  AGRONOMIC_PARAMETER_EXPRESSION_TYPES,
  AGRONOMIC_POLICY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RULE_COMPARATORS,
  AGRONOMIC_RULE_CONTRACT_VERSION,
  AGRONOMIC_RULE_LOGIC,
  AGRONOMIC_TEMPORAL_MODES,
  AgronomicPolicyCompilationError
} from './extended-contract-v1.mjs';

export const AGRONOMIC_RULE_CONTRACT_VERSION_V2 = 'adr.declarative-agronomic-rule.v2';
export const agronomicModelDefinitionHash = v1.agronomicModelDefinitionHash;

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new v1.AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_POLICY_COMPILATION_FIELD',
        `${name}.${key} is not part of the agronomic compilation contract`
      );
    }
  }
}

function authorityBinding(value, name) {
  exactObject(value, name, new Set(['role', 'authorityRef', 'rationale']));
  const authorityRef = assertAuthorityRef(value.authorityRef);
  if (!KNOWLEDGE_KINDS.has(authorityRef.kind)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_AUTHORITY_REF',
      `${name}.authorityRef must reference QualifiedKnowledge or DerivedKnowledge`
    );
  }
  return deepFreeze({
    role: text(value.role, `${name}.role`),
    authorityRef,
    rationale: text(value.rationale, `${name}.rationale`)
  });
}

function authorityBindings(values, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_INPUT',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  return deepFreeze(values.map((value, index) => authorityBinding(value, `${name}[${index}]`)));
}

function normalizeEvaluationStart(value) {
  exactObject(value, 'evaluationStart', new Set(['date', 'authorityBindings']));
  const date = text(value.date, 'evaluationStart.date');
  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_EVALUATION_START_DATE',
      'evaluationStart.date must be a valid YYYY-MM-DD calendar date'
    );
  }
  return deepFreeze({
    date,
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'evaluationStart.authorityBindings',
      { nonEmpty: true }
    )
  });
}

function normalizeCoordinator(value) {
  exactObject(value, 'coordination.coordinator', new Set(['sourceLabel', 'authorityBindings']));
  return deepFreeze({
    sourceLabel: text(value.sourceLabel, 'coordination.coordinator.sourceLabel'),
    authorityBindings: authorityBindings(
      value.authorityBindings,
      'coordination.coordinator.authorityBindings',
      { nonEmpty: true }
    )
  });
}

function stripRuleToV1(value) {
  const stripped = cloneCanonicalValue(value);
  stripped.contractVersion = v1.AGRONOMIC_RULE_CONTRACT_VERSION;
  delete stripped.evaluationStart;
  if (stripped.coordination && typeof stripped.coordination === 'object' && !Array.isArray(stripped.coordination)) {
    delete stripped.coordination.coordinator;
  }
  return stripped;
}

function normalizeRuleV2(value) {
  exactObject(value, 'DeclarativeAgronomicRule', new Set([
    'contractVersion',
    'ruleId',
    'decisionType',
    'inputs',
    'evaluationCadence',
    'evaluationStart',
    'trigger',
    'exceptions',
    'action',
    'coordination',
    'fallback',
    'humanGate',
    'limitations'
  ]));
  if (value.coordination !== undefined) {
    exactObject(value.coordination, 'coordination', new Set([
      'mode',
      'channel',
      'participants',
      'coordinator',
      'authorityBindings'
    ]));
  }
  const normalizedV1 = v1.normalizeDeclarativeAgronomicRule(stripRuleToV1(value));
  const evaluationStart = value.evaluationStart === undefined
    ? undefined
    : normalizeEvaluationStart(value.evaluationStart);
  const coordinator = value.coordination?.coordinator === undefined
    ? undefined
    : normalizeCoordinator(value.coordination.coordinator);
  if (coordinator && normalizedV1.coordination.mode === 'NONE') {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_COORDINATION',
      'coordination NONE cannot carry a coordinator'
    );
  }
  return deepFreeze({
    ...normalizedV1,
    contractVersion: AGRONOMIC_RULE_CONTRACT_VERSION_V2,
    ...(evaluationStart ? { evaluationStart } : {}),
    coordination: deepFreeze({
      ...normalizedV1.coordination,
      ...(coordinator ? { coordinator } : {})
    })
  });
}

export function normalizeDeclarativeAgronomicRule(value) {
  const version = text(value?.contractVersion, 'contractVersion');
  if (version === v1.AGRONOMIC_RULE_CONTRACT_VERSION) {
    return v1.normalizeDeclarativeAgronomicRule(value);
  }
  if (version === AGRONOMIC_RULE_CONTRACT_VERSION_V2) {
    return normalizeRuleV2(value);
  }
  throw new v1.AgronomicPolicyCompilationError(
    'UNSUPPORTED_AGRONOMIC_RULE_CONTRACT',
    `unsupported declarative agronomic rule contractVersion ${version}`
  );
}

export function declarativeAgronomicRuleHash(value) {
  return semanticHash('DeclarativeAgronomicRule', normalizeDeclarativeAgronomicRule(value));
}

export function normalizeAgronomicPolicyCompilation(value) {
  const version = text(value?.rule?.contractVersion, 'rule.contractVersion');
  if (version === v1.AGRONOMIC_RULE_CONTRACT_VERSION) {
    return v1.normalizeAgronomicPolicyCompilation(value);
  }
  if (version !== AGRONOMIC_RULE_CONTRACT_VERSION_V2) {
    throw new v1.AgronomicPolicyCompilationError(
      'UNSUPPORTED_AGRONOMIC_RULE_CONTRACT',
      `unsupported declarative agronomic rule contractVersion ${version}`
    );
  }

  const normalizedRule = normalizeRuleV2(value.rule);
  const suppliedRuleHash = text(value.ruleHash, 'ruleHash');
  const expectedRuleHash = declarativeAgronomicRuleHash(normalizedRule);
  if (!HASH_RE.test(suppliedRuleHash) || suppliedRuleHash !== expectedRuleHash) {
    throw new v1.AgronomicPolicyCompilationError(
      'AGRONOMIC_RULE_HASH_MISMATCH',
      'ruleHash must exactly match the v2 declarative agronomic rule'
    );
  }

  const downgraded = cloneCanonicalValue(value);
  downgraded.rule = stripRuleToV1(value.rule);
  downgraded.ruleHash = v1.declarativeAgronomicRuleHash(downgraded.rule);
  const normalizedBase = v1.normalizeAgronomicPolicyCompilation(downgraded);

  return deepFreeze({
    ...normalizedBase,
    rule: normalizedRule,
    ruleHash: suppliedRuleHash
  });
}

export function agronomicPolicyCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicPolicyCompilation(value);
  return deepFreeze([
    ...normalized.sourceProtocolRefs,
    ...normalized.sourceProtocolArtifactRefs,
    ...normalized.knowledgeRefs,
    ...normalized.modelRefs,
    normalized.policyRef,
    normalized.approvalRef
  ]);
}
