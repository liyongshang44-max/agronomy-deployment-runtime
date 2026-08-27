import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  agronomicActionRegimenHash,
  normalizeAgronomicActionRegimen,
  normalizeAgronomicActionRegimenCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const knowledge = ref('QualifiedKnowledge', 'knowledge.regimen', 'a');

function regimen(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
    regimenId: 'b21-as-needed-tillage-regimen',
    sourceExpression: 'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.',
    actionCode: 'TILL',
    occurrenceDescriptor: {
      mode: 'SOURCE_STATED_BOUNDED_RANGE',
      minCount: 2,
      maxCount: 6,
      period: { kind: 'EACH_CALENDAR_YEAR' }
    },
    modalityCompilationRef: ref('AgronomicNormativeModalityCompilation', 'modality.b21.as-needed', 'b'),
    goalConditionCompilationRef: ref('AgronomicGoalConditionCompilation', 'goal.b21.prevent', 'c'),
    authorityBindings: [{
      role: 'SOURCE_REGIMEN',
      authorityRef: knowledge,
      rationale: 'Exact source-qualified knowledge establishes the full B21 action-regimen proposition.'
    }],
    transformationRationale: 'Preserve action, literal annual range, exact AS_NEEDED modality and exact PREVENT goal without hard obligation or runtime semantics.',
    ...overrides
  };
}

function compilation(value = regimen(), status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'd')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'e')],
    knowledgeRefs: [knowledge],
    regimen: value,
    regimenHash: agronomicActionRegimenHash(value),
    semanticReviewRef: ref('AgronomicActionRegimenReviewDecision', 'review.regimen', 'f'),
    losslessCoverage: {
      status,
      coveredElements: ['ACTION', 'SOURCE_STATED_BOUNDED_RANGE', 'AS_NEEDED_MODALITY', 'PREVENT_GOAL', 'SOURCE_EXPRESSION'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_REGIMEN_ELEMENT']
    },
    limitations: ['SOURCE_REGIMEN_NOT_HARD_OBLIGATION']
  };
}

test('normalizes B21 source regimen without hard obligation or runtime semantics', () => {
  const normalized = normalizeAgronomicActionRegimen(regimen());
  assert.equal(normalized.actionCode, 'TILL');
  assert.deepEqual(normalized.occurrenceDescriptor, {
    mode: 'SOURCE_STATED_BOUNDED_RANGE',
    minCount: 2,
    maxCount: 6,
    period: { kind: 'EACH_CALENDAR_YEAR' }
  });
  for (const forbidden of [
    'effect', 'force', 'runtimeNeedPredicate', 'schedule', 'dueState',
    'satisfaction', 'violation', 'currentState', 'outcome'
  ]) {
    assert.equal(Object.hasOwn(normalized, forbidden), false);
  }
});

test('v1 occurrence descriptor preserves literal bounded range only', () => {
  assert.equal(
    normalizeAgronomicActionRegimen(regimen()).occurrenceDescriptor.mode,
    'SOURCE_STATED_BOUNDED_RANGE'
  );
  assert.throws(
    () => normalizeAgronomicActionRegimen(regimen({
      occurrenceDescriptor: {
        mode: 'EXACT_COUNT',
        minCount: 2,
        maxCount: 6,
        period: { kind: 'EACH_CALENDAR_YEAR' }
      }
    })),
    /unsupported action-regimen occurrence mode/
  );
  assert.throws(
    () => normalizeAgronomicActionRegimen(regimen({
      occurrenceDescriptor: {
        mode: 'SOURCE_STATED_BOUNDED_RANGE',
        minCount: 7,
        maxCount: 6,
        period: { kind: 'EACH_CALENDAR_YEAR' }
      }
    })),
    /minCount must be <= maxCount/
  );
});

test('v1 is restricted to source-proven TILL action shape', () => {
  assert.throws(
    () => normalizeAgronomicActionRegimen(regimen({ actionCode: 'SPRAY' })),
    /accepts only the source-proven TILL/
  );
});

test('rejects hard-force, runtime, schedule, satisfaction and outcome laundering fields', () => {
  const fields = [
    ['effect', 'REQUIRE'],
    ['force', 'REQUIRE'],
    ['runtimeNeedPredicate', { semanticId: 'weed.established', operator: 'EQUALS', value: true }],
    ['schedule', { cadence: 'P60D' }],
    ['dueState', 'DUE'],
    ['satisfaction', 'SATISFIED_AFTER_SIX'],
    ['violation', 'VIOLATED_BELOW_TWO'],
    ['currentState', 'NEEDS_TILLAGE'],
    ['outcome', 'PREVENTED_ESTABLISHMENT']
  ];
  for (const [field, value] of fields) {
    const candidate = regimen();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicActionRegimen(candidate),
      /not part of the action-regimen contract/
    );
  }
});

test('hash fails closed on action, range, period or predecessor drift', () => {
  const input = compilation();
  normalizeAgronomicActionRegimenCompilation(input);
  const mutations = [
    (value) => { value.regimen.sourceExpression = 'different source proposition'; },
    (value) => { value.regimen.occurrenceDescriptor.minCount = 3; },
    (value) => { value.regimen.occurrenceDescriptor.maxCount = 7; },
    (value) => { value.regimen.modalityCompilationRef.logicalId = 'different.modality'; },
    (value) => { value.regimen.goalConditionCompilationRef.logicalId = 'different.goal'; }
  ];
  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () => normalizeAgronomicActionRegimenCompilation(drifted),
      /regimenHash/
    );
  }
});

test('COMPLETE remains local to regimen semantics only', () => {
  const normalized = normalizeAgronomicActionRegimenCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.ok(normalized.limitations.includes('SOURCE_REGIMEN_NOT_HARD_OBLIGATION'));

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['RUNTIME_NEED_PREDICATE'];
  assert.throws(
    () => normalizeAgronomicActionRegimenCompilation(invalid),
    /COMPLETE action-regimen coverage/
  );
});
