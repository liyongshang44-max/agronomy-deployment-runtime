import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
  AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError,
  agronomicRecordedOperationContextTemporalSupportClassificationHash,
  normalizeAgronomicRecordedOperationContextTemporalSupportClassification,
  normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation
} from '../src/index.mjs';

const predecessorRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation',
  logicalId: 'compilation.test.source-reference-hash',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision',
  logicalId: 'review.test.temporal-support',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function classification(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: 'classification.test.sustainable-corn.temporal-support',
    sourceReferenceHashProjectionCompilationRef: predecessorRef,
    sourceTemporalSupport: {
      kind: 'CALENDAR_DATE',
      date: '2011-05-03',
      precision: 'DAY'
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    temporalSupport: { type: 'INTERVAL' },
    classificationRationale:
      'Classify exact DAY precision as interval support without timestamp bounds.',
    ...overrides
  };
}

function compilation(value = classification(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification: value,
    classificationHash:
      agronomicRecordedOperationContextTemporalSupportClassificationHash(value),
    temporalSupportReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'SOURCE_TEMPORAL_SUPPORT',
        'TARGET_TEMPORAL_SUPPORT_CLASSIFICATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_EFFECTIVE_INTERVAL',
      'NO_TIMEZONE',
      'NO_AVAILABLE_AT',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof
        AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact first DAY -> INTERVAL temporal-support classification', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassification(
      classification()
    );
  assert.deepEqual(normalized.sourceTemporalSupport, {
    kind: 'CALENDAR_DATE',
    date: '2011-05-03',
    precision: 'DAY'
  });
  assert.deepEqual(normalized.temporalSupport, { type: 'INTERVAL' });
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
});

test('classification hash is deterministic and material fields change identity', () => {
  const baseline = classification();
  assert.equal(
    agronomicRecordedOperationContextTemporalSupportClassificationHash(baseline),
    agronomicRecordedOperationContextTemporalSupportClassificationHash(
      structuredClone(baseline)
    )
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.sourceReferenceHashProjectionCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextTemporalSupportClassificationHash(baseline),
    agronomicRecordedOperationContextTemporalSupportClassificationHash(
      predecessorDrift
    )
  );

  const rationaleDrift = structuredClone(baseline);
  rationaleDrift.classificationRationale = 'Reviewed alternate rationale.';
  assert.notEqual(
    agronomicRecordedOperationContextTemporalSupportClassificationHash(baseline),
    agronomicRecordedOperationContextTemporalSupportClassificationHash(
      rationaleDrift
    )
  );
});

test('rejects source temporal kind/date/precision drift', () => {
  for (const sourceTemporalSupport of [
    { kind: 'TIMESTAMP', date: '2011-05-03', precision: 'DAY' },
    { kind: 'CALENDAR_DATE', date: '2011-05-04', precision: 'DAY' },
    { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'SECOND' }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextTemporalSupportClassification(
          classification({ sourceTemporalSupport })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_SOURCE'
    );
  }
});

test('rejects INSTANT and every unsupported target temporal-support class', () => {
  for (const type of [
    'INSTANT',
    'POINT',
    'TIMESTAMP',
    'DAY',
    'CALENDAR_DAY',
    'UNKNOWN'
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextTemporalSupportClassification(
          classification({ temporalSupport: { type } })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TYPE'
    );
  }
});

test('rejects target semantic or DATE value drift', () => {
  for (const targetContextSemantic of [
    {
      semanticId: 'crop.emergence_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-04' }
    },
    {
      semanticId: 'crop.planting_date',
      value: { type: 'TIMESTAMP', date: '2011-05-03' }
    }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextTemporalSupportClassification(
          classification({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TARGET'
    );
  }
});

test('contract rejects timezone/effectiveInterval/availableAt widening', () => {
  for (const [key, value] of [
    ['timezone', 'America/Chicago'],
    ['effectiveInterval', {
      start: '2011-05-03T05:00:00Z',
      end: '2011-05-04T05:00:00Z'
    }],
    ['availableAt', '2011-05-03T05:00:00Z']
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextTemporalSupportClassification({
          ...classification(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.deepEqual(normalized.losslessCoverage.unrepresentedElements, []);

  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(
        compilation(classification(), {
          classificationHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(
        compilation(classification(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['SOURCE_TEMPORAL_SUPPORT'],
            unrepresentedElements: ['TARGET_TEMPORAL_SUPPORT_CLASSIFICATION']
          }
        })
      ),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COVERAGE'
  );
});
