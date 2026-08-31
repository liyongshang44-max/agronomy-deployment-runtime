import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION,
  agronomicRecordedOperationContextEpistemicClassificationHash,
  normalizeAgronomicRecordedOperationContextEpistemicClassification,
  normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation
} from '../src/index.mjs';

const mappingRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
  logicalId: 'compilation.test.context-semantic-mapping',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});

const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextEpistemicClassificationReviewDecision',
  logicalId: 'review.test.context-epistemic-classification',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function classification(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: 'classification.test.planting-date-assertion',
    contextSemanticMappingCompilationRef: mappingRef,
    predecessorOccurrenceSemantics: {
      recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
      occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE'
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    epistemicClass: 'ASSERTION',
    classificationRationale:
      'The exact source-recorded operation world establishes an external-source statement about reality without direct-measurement or telemetry authority.',
    ...overrides
  };
}

function compilation(value = classification(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification: value,
    classificationHash:
      agronomicRecordedOperationContextEpistemicClassificationHash(value),
    epistemicReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'CONTEXT_SEMANTIC_MAPPING',
        'PARENT_OCCURRENCE_SEMANTICS',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_OBSERVATION_UPGRADE',
      'NO_PROVENANCE_CLASS_AUTHORITY',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

test('normalizes first finite source-recorded planting-date classification as ASSERTION', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassification(
      classification()
    );
  assert.equal(normalized.epistemicClass, 'ASSERTION');
  assert.deepEqual(normalized.predecessorOccurrenceSemantics, {
    recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE'
  });
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
});

test('classification hash is deterministic and mapping ref is material', () => {
  const baseline = classification();
  assert.equal(
    agronomicRecordedOperationContextEpistemicClassificationHash(baseline),
    agronomicRecordedOperationContextEpistemicClassificationHash(
      structuredClone(baseline)
    )
  );
  const changed = structuredClone(baseline);
  changed.contextSemanticMappingCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextEpistemicClassificationHash(baseline),
    agronomicRecordedOperationContextEpistemicClassificationHash(changed)
  );
});

for (const epistemicClass of [
  'OBSERVATION',
  'DERIVED',
  'STATE_ESTIMATE',
  'FORECAST',
  'CONFIGURATION',
  'MODEL_PRIOR'
]) {
  test(`v1 rejects ${epistemicClass} for the first source-recorded world`, () => {
    assert.throws(
      () =>
        normalizeAgronomicRecordedOperationContextEpistemicClassification(
          classification({ epistemicClass })
        ),
      /supports only ASSERTION/
    );
  });
}

test('v1 rejects predecessor recordSemanticRole drift', () => {
  const value = classification();
  value.predecessorOccurrenceSemantics.recordSemanticRole = 'PLANNED_OPERATION';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextEpistemicClassification(value),
    /ACTUAL_FIELD_OPERATION_RECORD/
  );
});

test('v1 rejects predecessor occurrenceClass drift', () => {
  const value = classification();
  value.predecessorOccurrenceSemantics.occurrenceClass = 'EXECUTION_RECEIPT';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextEpistemicClassification(value),
    /SOURCE_RECORDED_OPERATION_OCCURRENCE/
  );
});

test('v1 rejects target semantic drift', () => {
  const value = classification();
  value.targetContextSemantic.semanticId = 'crop.harvest_date';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextEpistemicClassification(value),
    /crop\.planting_date/
  );
});

test('v1 rejects target value type drift', () => {
  const value = classification();
  value.targetContextSemantic.value.type = 'TIMESTAMP';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextEpistemicClassification(value),
    /crop\.planting_date/
  );
});

test('compilation hash closes the exact classification', () => {
  const value = classification();
  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(
      compilation(value)
    );
  assert.equal(
    normalized.classificationHash,
    agronomicRecordedOperationContextEpistemicClassificationHash(value)
  );

  const stale = compilation(value);
  stale.classification.classificationRationale = 'changed';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(
        stale
      ),
    /classificationHash must exactly match/
  );
});

test('COMPLETE local coverage rejects unrepresented targeted elements', () => {
  const value = compilation();
  value.losslessCoverage.unrepresentedElements = ['EPISTEMIC_CLASS'];
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(
        value
      ),
    /COMPLETE classification coverage/
  );
});

test('classification contract rejects provenance and downstream authority laundering fields', () => {
  for (const forbidden of [
    'provenanceClass',
    'effectiveInterval',
    'availableAt',
    'timezone',
    'spatialSupport',
    'geometryRef',
    'unit',
    'uncertainty',
    'temporalSupport',
    'source',
    'ContextDatum',
    'ContextManifest',
    'DecisionProblem',
    'Policy',
    'RuntimePlan',
    'RuntimeEligibility',
    'RuntimeBinding',
    'DecisionResult',
    'ExecutionReceipt',
    'Outcome',
    'inverseClassification',
    'classificationComplete'
  ]) {
    const value = classification();
    value[forbidden] = 'forbidden';
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextEpistemicClassification(value),
      /not part of the context-epistemic classification contract/,
      forbidden
    );
  }
});
