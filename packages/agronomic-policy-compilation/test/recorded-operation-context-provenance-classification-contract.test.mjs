import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION,
  agronomicRecordedOperationContextProvenanceClassificationHash,
  normalizeAgronomicRecordedOperationContextProvenanceClassification,
  normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation
} from '../src/index.mjs';

const epistemicRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextEpistemicClassificationCompilation',
  logicalId: 'compilation.test.context-epistemic-classification',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});

const sourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.value',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

const sourceArtifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.value',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});

const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextProvenanceClassificationReviewDecision',
  logicalId: 'review.test.context-provenance-classification',
  version: '1',
  semanticHash: `sha256:${'4'.repeat(64)}`
});

function classification(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: 'classification.test.planting-date.external-provider',
    contextEpistemicClassificationCompilationRef: epistemicRef,
    valueSource: {
      sourceRef,
      sourceArtifactRef,
      sourceArtifactContentHash: `sha256:${'5'.repeat(64)}`
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    epistemicClass: 'ASSERTION',
    provenanceClass: 'EXTERNAL_PROVIDER',
    classificationRationale:
      'The exact mapped value entered ADR through the reviewed external occurrence source channel.',
    ...overrides
  };
}

function compilation(value = classification(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification: value,
    classificationHash:
      agronomicRecordedOperationContextProvenanceClassificationHash(value),
    provenanceReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'CONTEXT_EPISTEMIC_CLASSIFICATION',
        'VALUE_SOURCE',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS',
        'PROVENANCE_CLASS'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CONTEXT_DATUM_SOURCE_WIRE',
      'NO_AVAILABLE_AT_AUTHORITY',
      'NO_GLOBAL_SOURCE_TYPE_TO_PROVENANCE_RULE'
    ],
    ...overrides
  };
}

test('normalizes first finite provenance classification as EXTERNAL_PROVIDER', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassification(
      classification()
    );
  assert.equal(normalized.provenanceClass, 'EXTERNAL_PROVIDER');
  assert.equal(normalized.epistemicClass, 'ASSERTION');
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
});

test('classification hash is deterministic and exact value-source identities are material', () => {
  const baseline = classification();
  assert.equal(
    agronomicRecordedOperationContextProvenanceClassificationHash(baseline),
    agronomicRecordedOperationContextProvenanceClassificationHash(
      structuredClone(baseline)
    )
  );

  for (const mutate of [
    (value) => {
      value.valueSource.sourceRef.semanticHash = `sha256:${'6'.repeat(64)}`;
    },
    (value) => {
      value.valueSource.sourceArtifactRef.semanticHash = `sha256:${'7'.repeat(64)}`;
    },
    (value) => {
      value.valueSource.sourceArtifactContentHash = `sha256:${'8'.repeat(64)}`;
    }
  ]) {
    const changed = structuredClone(baseline);
    mutate(changed);
    assert.notEqual(
      agronomicRecordedOperationContextProvenanceClassificationHash(baseline),
      agronomicRecordedOperationContextProvenanceClassificationHash(changed)
    );
  }
});

for (const provenanceClass of [
  'USER',
  'AGRONOMIST',
  'SENSOR',
  'MACHINERY',
  'REMOTE_SENSING',
  'CUSTOMER_SYSTEM',
  'LABORATORY',
  'MODEL',
  'PLATFORM'
]) {
  test(`v1 rejects ${provenanceClass} for the first value-source world`, () => {
    assert.throws(
      () =>
        normalizeAgronomicRecordedOperationContextProvenanceClassification(
          classification({ provenanceClass })
        ),
      /supports only EXTERNAL_PROVIDER/
    );
  });
}

test('v1 rejects epistemic-class drift', () => {
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextProvenanceClassification(
        classification({ epistemicClass: 'OBSERVATION' })
      ),
    /preserves only ASSERTION/
  );
});

test('v1 rejects target semantic drift', () => {
  const value = classification();
  value.targetContextSemantic.semanticId = 'crop.harvest_date';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextProvenanceClassification(value),
    /crop\.planting_date/
  );
});

test('v1 rejects target value type drift', () => {
  const value = classification();
  value.targetContextSemantic.value.type = 'TIMESTAMP';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextProvenanceClassification(value),
    /crop\.planting_date/
  );
});

test('compilation hash closes the exact provenance classification', () => {
  const value = classification();
  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(
      compilation(value)
    );
  assert.equal(
    normalized.classificationHash,
    agronomicRecordedOperationContextProvenanceClassificationHash(value)
  );

  const stale = compilation(value);
  stale.classification.classificationRationale = 'changed';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(
        stale
      ),
    /classificationHash must exactly match/
  );
});

test('COMPLETE local coverage rejects unrepresented targeted elements', () => {
  const value = compilation();
  value.losslessCoverage.unrepresentedElements = ['PROVENANCE_CLASS'];
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(
        value
      ),
    /COMPLETE classification coverage/
  );
});

test('classification contract rejects ContextDatum source-wire and downstream authority laundering fields', () => {
  for (const forbidden of [
    'providerId',
    'sourceRef',
    'contentHash',
    'source',
    'availableAt',
    'effectiveInterval',
    'timezone',
    'spatialSupport',
    'geometryRef',
    'unit',
    'uncertainty',
    'temporalSupport',
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
    'inverseProvenance',
    'classificationComplete'
  ]) {
    const value = classification();
    value[forbidden] = 'forbidden';
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextProvenanceClassification(value),
      /not part of the context-provenance classification contract/,
      forbidden
    );
  }
});
