import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
  AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError,
  agronomicContextSourceAcquisitionAvailabilityProjectionHash,
  normalizeAgronomicContextSourceAcquisitionAvailabilityProjection,
  normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation',
  logicalId: 'compilation.test.source-reference-hash',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const sourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.sustainable-corn',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});
const artifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.sustainable-corn',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision',
  logicalId: 'review.test.availability',
  version: '1',
  semanticHash: `sha256:${'4'.repeat(64)}`
});

function projection(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
    projectionId: 'projection.test.sustainable-corn.available-at',
    parentSourceReferenceHashProjectionCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    valueSource: {
      sourceRef,
      sourceArtifactRef: artifactRef,
      sourceArtifactContentHash: `sha256:${'5'.repeat(64)}`
    },
    sourceArtifactAcquisition: {
      method: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD,
      acquiredAt: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
    },
    availableAtProjection: {
      basis: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
      availableAt: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
    },
    rationale:
      'Use exact value-source artifact acquisition as conservative ADR evidence availability.',
    ...overrides
  };
}

function compilation(value = projection(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_AUTHORITY',
    projection: value,
    projectionHash:
      agronomicContextSourceAcquisitionAvailabilityProjectionHash(value),
    availabilityProjectionReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_SOURCE_REFERENCE_HASH',
        'VALUE_SOURCE_ARTIFACT_ACQUISITION',
        'AVAILABLE_AT_PROJECTION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_UPSTREAM_FIRST_PUBLICATION_TIME',
      'NO_EFFECTIVE_INTERVAL',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof
        AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact first source-acquisition availability projection', () => {
  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
      projection()
    );
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.equal(
    normalized.sourceArtifactAcquisition.acquiredAt,
    '2026-08-30T13:00:00.000Z'
  );
  assert.deepEqual(normalized.availableAtProjection, {
    basis: 'VALUE_SOURCE_ARTIFACT_ACQUISITION',
    availableAt: '2026-08-30T13:00:00.000Z'
  });
});

test('projection hash is deterministic and exact predecessor/value source are material', () => {
  const baseline = projection();
  assert.equal(
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(baseline),
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(
      structuredClone(baseline)
    )
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.parentSourceReferenceHashProjectionCompilationRef.semanticHash =
    `sha256:${'6'.repeat(64)}`;
  assert.notEqual(
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(baseline),
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(predecessorDrift)
  );

  const artifactDrift = structuredClone(baseline);
  artifactDrift.valueSource.sourceArtifactRef.semanticHash =
    `sha256:${'7'.repeat(64)}`;
  assert.notEqual(
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(baseline),
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(artifactDrift)
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
      () =>
        normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
          projection({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_TARGET'
    );
  }
});

test('rejects acquisition method and timestamp drift', () => {
  expectCode(
    () =>
      normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
        projection({
          sourceArtifactAcquisition: {
            method: 'GIT_COMMIT_TIME',
            acquiredAt:
              AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
          }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_METHOD'
  );

  for (const acquiredAt of [
    '2011-05-03T00:00:00.000Z',
    '2026-08-30T12:59:59.000Z',
    '2026-09-02T00:00:00.000Z'
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
          projection({
            sourceArtifactAcquisition: {
              method:
                AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD,
              acquiredAt
            }
          })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_TIMESTAMP'
    );
  }
});

test('rejects arbitrary availableAt and unsupported availability basis', () => {
  expectCode(
    () =>
      normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
        projection({
          availableAtProjection: {
            basis: 'UPSTREAM_FIRST_PUBLICATION',
            availableAt:
              AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
          }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS'
  );

  expectCode(
    () =>
      normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(
        projection({
          availableAtProjection: {
            basis: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
            availableAt: '2011-05-03T00:00:00.000Z'
          }
        })
      ),
    'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_VALUE_MISMATCH'
  );
});

test('rejects widening into effective time, timezone or downstream publication authority', () => {
  for (const [key, value] of [
    ['effectiveInterval', {
      start: '2011-05-03T05:00:00.000Z',
      end: '2011-05-04T05:00:00.000Z'
    }],
    ['timezoneId', 'America/Chicago'],
    ['utcOffset', '-05:00'],
    ['dstState', 'DAYLIGHT'],
    ['tzdbVersion', '2026a'],
    ['contextDatumRef', 'CD-1'],
    ['contextManifestRef', 'CM-1'],
    ['decisionProblemRef', 'DP-1'],
    ['upstreamFirstPublishedAt', '2011-05-03T00:00:00.000Z'],
    ['reviewedAt', '2026-09-02T00:00:00.000Z']
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextSourceAcquisitionAvailabilityProjection({
          ...projection(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  expectCode(
    () =>
      normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(
        compilation(projection(), {
          projectionHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(
        compilation(projection(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['AVAILABLE_AT_PROJECTION'],
            unrepresentedElements: ['VALUE_SOURCE_ARTIFACT_ACQUISITION']
          }
        })
      ),
    'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COVERAGE'
  );
});
