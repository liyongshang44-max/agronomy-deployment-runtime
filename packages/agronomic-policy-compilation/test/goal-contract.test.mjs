import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  agronomicGoalConditionHash,
  normalizeAgronomicGoalCondition,
  normalizeAgronomicGoalConditionCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const knowledge = ref('QualifiedKnowledge', 'knowledge.goal', 'a');

function goal(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: 'goal.prevent-establishment',
    sourceExpression: 'Plots are tilled to prevent plant growth from becoming established.',
    targetScope: 'ACTION',
    relation: 'PREVENT',
    goalObjectExpression: 'plant growth from becoming established',
    authorityBindings: [{
      role: 'SOURCE_GOAL',
      authorityRef: knowledge,
      rationale: 'Exact source-qualified knowledge establishes the source-stated action purpose.'
    }],
    transformationRationale: 'Preserve source purpose only; do not infer trigger, current state, efficacy, outcome, or runtime objective.',
    ...overrides
  };
}

function compilation(value = goal(), status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'b')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'c')],
    knowledgeRefs: [knowledge],
    goalCondition: value,
    goalConditionHash: agronomicGoalConditionHash(value),
    semanticReviewRef: ref('AgronomicGoalConditionReviewDecision', 'review.goal', 'd'),
    losslessCoverage: {
      status,
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_GOAL_ELEMENT']
    },
    limitations: ['SOURCE_GOAL_NOT_RUNTIME_PREDICATE']
  };
}

test('normalizes source goal without creating executable semantics', () => {
  const normalized = normalizeAgronomicGoalCondition(goal());
  assert.equal(normalized.relation, 'PREVENT');
  assert.equal(normalized.targetScope, 'ACTION');
  assert.equal(normalized.goalObjectExpression, 'plant growth from becoming established');
  for (const forbidden of ['runtimeTrigger', 'currentState', 'objective', 'causalEffect', 'outcome']) {
    assert.equal(Object.hasOwn(normalized, forbidden), false);
  }
  assert.match(agronomicGoalConditionHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('v1 relation vocabulary is PREVENT or CONTROL only', () => {
  assert.equal(normalizeAgronomicGoalCondition(goal({ relation: 'PREVENT' })).relation, 'PREVENT');
  assert.equal(normalizeAgronomicGoalCondition(goal({ relation: 'CONTROL' })).relation, 'CONTROL');
  assert.throws(() => normalizeAgronomicGoalCondition(goal({ relation: 'OPTIMIZE' })), /unsupported goal-condition relation/);
});

test('v1 target scope is ACTION only', () => {
  assert.equal(normalizeAgronomicGoalCondition(goal({ targetScope: 'ACTION' })).targetScope, 'ACTION');
  assert.throws(() => normalizeAgronomicGoalCondition(goal({ targetScope: 'OCCURRENCE' })), /unsupported goal-condition targetScope/);
  assert.throws(() => normalizeAgronomicGoalCondition(goal({ targetScope: 'DECISION_OBJECTIVE' })), /unsupported goal-condition targetScope/);
});

test('rejects runtime/current-state/causal/outcome laundering fields', () => {
  for (const [field, value] of [
    ['runtimeTrigger', { semanticId: 'plant.established', operator: 'EQUALS', value: true }],
    ['currentState', 'PLANT_GROWTH_ESTABLISHED'],
    ['objective', 'PREVENT_ESTABLISHMENT_NOW'],
    ['causalEffect', 'TILLAGE_PREVENTS_ESTABLISHMENT'],
    ['outcome', 'GOAL_ACHIEVED']
  ]) {
    const candidate = goal();
    candidate[field] = value;
    assert.throws(() => normalizeAgronomicGoalCondition(candidate), /not part of the goal-condition contract/);
  }
});

test('hash fails closed on source, relation, target or goal-object drift', () => {
  const input = compilation();
  normalizeAgronomicGoalConditionCompilation(input);
  for (const mutate of [
    (value) => { value.goalCondition.sourceExpression = 'different source expression'; },
    (value) => { value.goalCondition.relation = 'CONTROL'; },
    (value) => { value.goalCondition.goalObjectExpression = 'different target'; }
  ]) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(() => normalizeAgronomicGoalConditionCompilation(drifted), /goalConditionHash/);
  }
});

test('COMPLETE is local to goal-condition semantics only', () => {
  const normalized = normalizeAgronomicGoalConditionCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.ok(normalized.limitations.includes('SOURCE_GOAL_NOT_RUNTIME_PREDICATE'));

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['WHOLE_STATEMENT_NOT_OPERATIONALIZED'];
  assert.throws(() => normalizeAgronomicGoalConditionCompilation(invalid), /COMPLETE goal-condition coverage/);
});
