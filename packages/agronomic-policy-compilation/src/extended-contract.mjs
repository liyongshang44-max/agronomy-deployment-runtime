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
export const AGRONOMIC_TEMPORAL_CONSTRAINT_TARGETS = deepFreeze([
  'RULE_EVALUATION',
  'RULE_ACTION'
]);
export const AGRONOMIC_TEMPORAL_CONSTRAINT_RELATIONS = deepFreeze([
  'ON_OR_AFTER_DATE',
  'AFTER_DATE',
  'ON_OR_BEFORE_DATE',
  'BEFORE_DATE',
  'BEFORE_EVENT',
  'AFTER_EVENT',
  'MIN_OFFSET_BEFORE_EVENT',
  'MIN_OFFSET_AFTER_EVENT',
  'WITHIN_PERIOD_OF_EVENT'
]);
export const agronomicModelDefinitionHash = v1.agronomicModelDefinitionHash;

const KNOWLEDGE_KINDS = new Set(['QualifiedKnowledge', 'DerivedKnowledge']);
const TEMPORAL_TARGETS = new Set(AGRONOMIC_TEMPORAL_CONSTRAINT_TARGETS);
const TEMPORAL_RELATIONS = new Set(AGRONOMIC_TEMPORAL_CONSTRAINT_RELATIONS);
const CALENDAR_RELATIONS = new Set([
  'ON_OR_AFTER_DATE',
  'AFTER_DATE',
  'ON_OR_BEFORE_DATE',
  'BEFORE_DATE'
]);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DURATION_RE = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

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

function calendarDate(value, name) {
  const date = text(value, name);
  const parsed = DATE_RE.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_DATE',
      `${name} must be a valid YYYY-MM-DD calendar date`
    );
  }
  return date;
}

function duration(value, name) {
  const normalized = text(value, name);
  const match = ISO_DURATION_RE.exec(normalized);
  const parts = match ? match.slice(1).filter((part) => part !== undefined) : [];
  if (!match || parts.length === 0 || !parts.some((part) => Number(part) > 0)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_DURATION',
      `${name} must be a non-zero ISO-8601 duration`
    );
  }
  return normalized;
}

function normalizeTemporalConstraint(value, name) {
  exactObject(value, name, new Set([
    'target',
    'relation',
    'date',
    'eventSemanticId',
    'duration',
    'authorityBindings'
  ]));
  const target = text(value.target, `${name}.target`);
  if (!TEMPORAL_TARGETS.has(target)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_TARGET',
      `${name}.target is unsupported`
    );
  }
  const relation = text(value.relation, `${name}.relation`);
  if (!TEMPORAL_RELATIONS.has(relation)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_RELATION',
      `${name}.relation is unsupported`
    );
  }
  const bindings = authorityBindings(value.authorityBindings, `${name}.authorityBindings`, { nonEmpty: true });

  if (CALENDAR_RELATIONS.has(relation)) {
    if (value.eventSemanticId !== undefined || value.duration !== undefined) {
      throw new v1.AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_TEMPORAL_CONSTRAINT',
        `${relation} accepts date only and cannot carry eventSemanticId or duration`
      );
    }
    return deepFreeze({
      target,
      relation,
      date: calendarDate(value.date, `${name}.date`),
      authorityBindings: bindings
    });
  }

  if (value.date !== undefined) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_CONSTRAINT',
      `${relation} cannot carry a calendar date`
    );
  }
  const eventSemanticId = text(value.eventSemanticId, `${name}.eventSemanticId`);

  if (relation === 'BEFORE_EVENT' || relation === 'AFTER_EVENT') {
    if (value.duration !== undefined) {
      throw new v1.AgronomicPolicyCompilationError(
        'INVALID_AGRONOMIC_TEMPORAL_CONSTRAINT',
        `${relation} cannot carry duration; use an offset relation when a duration is source material`
      );
    }
    return deepFreeze({ target, relation, eventSemanticId, authorityBindings: bindings });
  }

  return deepFreeze({
    target,
    relation,
    eventSemanticId,
    duration: duration(value.duration, `${name}.duration`),
    authorityBindings: bindings
  });
}

function normalizeTemporalConstraints(values) {
  if (values === undefined) return deepFreeze([]);
  if (!Array.isArray(values)) {
    throw new v1.AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_TEMPORAL_CONSTRAINT',
      'temporalConstraints must be an array'
    );
  }
  return deepFreeze(values.map((value, index) => normalizeTemporalConstraint(value, `temporalConstraints[${index}]`)));
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
  delete stripped.temporalConstraints;
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
    'temporalConstraints',
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
  const temporalConstraints = normalizeTemporalConstraints(value.temporalConstraints);
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
    temporalConstraints,
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
