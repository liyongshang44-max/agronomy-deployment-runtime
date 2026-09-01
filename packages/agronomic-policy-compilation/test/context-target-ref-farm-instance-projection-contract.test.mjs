import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION,
  AgronomicContextTargetRefFarmInstanceProjectionCompilationError,
  agronomicContextTargetRefFarmInstanceProjectionHash,
  normalizeAgronomicContextTargetRefFarmInstanceProjection,
  normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation',
  logicalId: 'compilation.test.context-spatial-support',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const sourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.sustainable-corn',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextTargetRefFarmInstanceProjectionReviewDecision',
  logicalId: 'review.test.target-ref-farm-instance',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});
const targetId = 'target_src_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function projection(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION,
    projectionId:
      'projection.test.sustainable-corn.target-ref-farm-instance',
    parentContextSpatialSupportClassificationCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    sourceBackedTargetIdentity: {
      namespaceRef: sourceRef,
      granularity: 'FARM',
      targetId
    },
    targetRefProjection: {
      field: 'farmId',
      value: targetId
    },
    rationale:
      'Project exact source-backed FARM target identity into targetRef.farmId only.',
    ...overrides
  };
}

function compilation(value = projection(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_AUTHORITY',
    projection: value,
    projectionHash: agronomicContextTargetRefFarmInstanceProjectionHash(value),
    targetRefProjectionReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SPATIAL_SUPPORT',
        'SOURCE_BACKED_FARM_TARGET_IDENTITY',
        'TARGET_REF_FARM_ID_PROJECTION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_COMPLETE_TARGET_REF',
      'NO_GEOMETRY',
      'NO_DECISION_PROBLEM_PUBLICATION',
      'NO_CONTEXT_MANIFEST_PUBLICATION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextTargetRefFarmInstanceProjectionCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact FARM targetRef projection', () => {
  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjection(projection());
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.deepEqual(normalized.sourceBackedTargetIdentity, {
    namespaceRef: sourceRef,
    granularity: 'FARM',
    targetId
  });
  assert.deepEqual(normalized.targetRefProjection, {
    field: 'farmId',
    value: targetId
  });
});

test('projection hash is deterministic and predecessor/source target identity are material', () => {
  const baseline = projection();
  assert.equal(
    agronomicContextTargetRefFarmInstanceProjectionHash(baseline),
    agronomicContextTargetRefFarmInstanceProjectionHash(structuredClone(baseline))
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.parentContextSpatialSupportClassificationCompilationRef.semanticHash =
    `sha256:${'4'.repeat(64)}`;
  assert.notEqual(
    agronomicContextTargetRefFarmInstanceProjectionHash(baseline),
    agronomicContextTargetRefFarmInstanceProjectionHash(predecessorDrift)
  );

  const namespaceDrift = structuredClone(baseline);
  namespaceDrift.sourceBackedTargetIdentity.namespaceRef.semanticHash =
    `sha256:${'5'.repeat(64)}`;
  assert.notEqual(
    agronomicContextTargetRefFarmInstanceProjectionHash(baseline),
    agronomicContextTargetRefFarmInstanceProjectionHash(namespaceDrift)
  );
});

test('rejects semantic/value drift', () => {
  for (const targetContextSemantic of [
    {
      semanticId: 'crop.emergence_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    {
      semanticId: 'crop.planting_date',
      value: { type: 'TIMESTAMP', date: '2011-05-03' }
    },
    {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-04' }
    }
  ]) {
    expectCode(
      () => normalizeAgronomicContextTargetRefFarmInstanceProjection(
        projection({ targetContextSemantic })
      ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET'
    );
  }
});

test('rejects non-FARM target granularity and malformed target ids', () => {
  expectCode(
    () => normalizeAgronomicContextTargetRefFarmInstanceProjection(
      projection({
        sourceBackedTargetIdentity: {
          namespaceRef: sourceRef,
          granularity: 'FIELD',
          targetId
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_GRANULARITY'
  );

  expectCode(
    () => normalizeAgronomicContextTargetRefFarmInstanceProjection(
      projection({
        sourceBackedTargetIdentity: {
          namespaceRef: sourceRef,
          granularity: 'FARM',
          targetId: 'SERF'
        },
        targetRefProjection: { field: 'farmId', value: 'SERF' }
      })
    ),
    'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET_ID'
  );
});

test('rejects raw SERF, display name, arbitrary farmId and wrong targetRef field', () => {
  for (const targetRefProjection of [
    { field: 'farmId', value: 'SERF' },
    { field: 'farmId', value: 'Southeast Research and Demonstration Farm' },
    { field: 'farmId', value: `target_src_${'b'.repeat(64)}` }
  ]) {
    expectCode(
      () => normalizeAgronomicContextTargetRefFarmInstanceProjection(
        projection({ targetRefProjection })
      ),
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_VALUE_MISMATCH'
    );
  }

  for (const field of ['fieldId', 'seasonId', 'zoneId', 'organizationId', 'tenantId']) {
    expectCode(
      () => normalizeAgronomicContextTargetRefFarmInstanceProjection(
        projection({ targetRefProjection: { field, value: targetId } })
      ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_FIELD'
    );
  }
});

test('rejects widening into complete targetRef, geometry or unrelated publication authority', () => {
  for (const [key, value] of [
    ['organizationId', 'org-a'],
    ['tenantId', 'tenant-a'],
    ['fieldId', 'field-a'],
    ['seasonId', '2011'],
    ['zoneId', 'zone-a'],
    ['geometryRef', targetId],
    ['spatialSupport', { type: 'FARM' }],
    ['decisionProblemRef', 'DP-1'],
    ['contextManifestRef', 'CM-1'],
    ['contextDatumRef', 'CD-1'],
    ['availableAt', '2011-05-03T00:00:00Z']
  ]) {
    expectCode(
      () => normalizeAgronomicContextTargetRefFarmInstanceProjection({
        ...projection(),
        [key]: value
      }),
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  expectCode(
    () => normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(
      compilation(projection(), {
        projectionHash: `sha256:${'f'.repeat(64)}`
      })
    ),
    'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () => normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(
      compilation(projection(), {
        losslessCoverage: {
          status: 'COMPLETE',
          coveredElements: ['TARGET_REF_FARM_ID_PROJECTION'],
          unrepresentedElements: ['TARGET_IDENTITY_LINEAGE']
        }
      })
    ),
    'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COVERAGE'
  );
});
