import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
  AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError,
  agronomicRecordedOperationContextSpatialSupportClassificationHash,
  normalizeAgronomicRecordedOperationContextSpatialSupportClassification,
  normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation
} from '../src/index.mjs';

const contextRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
  logicalId: 'compilation.test.context-semantic',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const identityRef = Object.freeze({
  kind: 'AgronomicRecordedOperationTargetIdentityBindingCompilation',
  logicalId: 'compilation.test.target-identity',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision',
  logicalId: 'review.test.spatial-support',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});

function classification(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId: 'classification.test.sustainable-corn.spatial-support',
    contextSemanticMappingCompilationRef: contextRef,
    targetIdentityBindingCompilationRef: identityRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    sourceNativeSubject: { name: 'siteid', value: 'SERF' },
    sourceBackedTargetIdentity: {
      granularity: 'FARM',
      targetId: 'target_src_test_serf_farm'
    },
    spatialSupport: { type: 'FARM' },
    classificationRationale:
      'Classify exact source-backed FARM target granularity without geometry or target-instance projection.',
    ...overrides
  };
}

function compilation(value = classification(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification: value,
    classificationHash:
      agronomicRecordedOperationContextSpatialSupportClassificationHash(value),
    spatialSupportReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'CONTEXT_SEMANTIC_PREDECESSOR',
        'TARGET_IDENTITY_PREDECESSOR',
        'CO_PREDECESSOR_CONVERGENCE',
        'SPATIAL_SUPPORT_CLASSIFICATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_GEOMETRY_REF',
      'NO_TARGET_INSTANCE_IDENTITY',
      'NO_FIELD_PLOT_ZONE',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof
        AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact first SERF FARM spatial-support classification', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
      classification()
    );
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.deepEqual(normalized.sourceNativeSubject, {
    name: 'siteid',
    value: 'SERF'
  });
  assert.deepEqual(normalized.sourceBackedTargetIdentity, {
    granularity: 'FARM',
    targetId: 'target_src_test_serf_farm'
  });
  assert.deepEqual(normalized.spatialSupport, { type: 'FARM' });
});

test('classification hash is deterministic and both predecessor refs are material', () => {
  const baseline = classification();
  assert.equal(
    agronomicRecordedOperationContextSpatialSupportClassificationHash(baseline),
    agronomicRecordedOperationContextSpatialSupportClassificationHash(
      structuredClone(baseline)
    )
  );

  const contextDrift = structuredClone(baseline);
  contextDrift.contextSemanticMappingCompilationRef.semanticHash =
    `sha256:${'4'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSpatialSupportClassificationHash(baseline),
    agronomicRecordedOperationContextSpatialSupportClassificationHash(contextDrift)
  );

  const identityDrift = structuredClone(baseline);
  identityDrift.targetIdentityBindingCompilationRef.semanticHash =
    `sha256:${'5'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSpatialSupportClassificationHash(baseline),
    agronomicRecordedOperationContextSpatialSupportClassificationHash(identityDrift)
  );
});

test('rejects target semantic/value drift', () => {
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
        normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
          classification({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TARGET'
    );
  }
});

test('rejects source subject and target granularity drift', () => {
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
        classification({
          sourceNativeSubject: { name: 'siteid', value: 'NWREC' }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_SUBJECT'
  );

  for (const granularity of ['FIELD', 'PLOT', 'ZONE', 'POINT', 'POLYGON']) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
          classification({
            sourceBackedTargetIdentity: {
              granularity,
              targetId: 'target_src_test_serf'
            }
          })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TARGET_GRANULARITY'
    );
  }
});

test('rejects every non-FARM spatial-support type', () => {
  for (const type of [
    'FIELD',
    'PLOT',
    'ZONE',
    'POINT',
    'POLYGON',
    'REGION',
    'SEASON',
    'SITE',
    'UNKNOWN'
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
          classification({ spatialSupport: { type } })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TYPE'
    );
  }
});

test('contract rejects geometryRef, geometry, target-instance and temporal widening', () => {
  const topLevelWidening = [
    ['targetInstanceRef', 'target_src_test_serf_farm'],
    ['geometry', { type: 'Polygon', coordinates: [] }],
    ['effectiveInterval', {
      start: '2011-05-03T05:00:00Z',
      end: '2011-05-04T05:00:00Z'
    }],
    ['availableAt', '2011-05-03T05:00:00Z']
  ];
  for (const [key, value] of topLevelWidening) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSpatialSupportClassification({
          ...classification(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_FIELD'
    );
  }

  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
        classification({
          spatialSupport: {
            type: 'FARM',
            geometryRef: 'target_src_test_serf_farm'
          }
        })
      ),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_FIELD'
  );
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.deepEqual(normalized.losslessCoverage.unrepresentedElements, []);

  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(
        compilation(classification(), {
          classificationHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(
        compilation(classification(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['SPATIAL_SUPPORT_CLASSIFICATION'],
            unrepresentedElements: ['TARGET_IDENTITY_LINEAGE']
          }
        })
      ),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COVERAGE'
  );
});
