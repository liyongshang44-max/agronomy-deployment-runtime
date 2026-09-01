import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF,
  agronomicRecordedOperationContextSourceReferenceHashProjectionHash,
  normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection,
  normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation
} from '../src/index.mjs';

const providerBindingRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation',
  logicalId: 'compilation.test.provider-identity',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const sourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.value',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});
const artifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.value',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision',
  logicalId: 'review.test.source-reference-hash',
  version: '1',
  semanticHash: `sha256:${'4'.repeat(64)}`
});
const evidenceHash = `sha256:${'5'.repeat(64)}`;

function projection(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION,
    projectionId: 'projection.test.sustainable-corn.source-wire',
    sourceProviderIdentityBindingCompilationRef: providerBindingRef,
    providerId:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID,
    valueSource: {
      sourceRef,
      sourceArtifactRef: artifactRef,
      sourceArtifactContentHash: `sha256:${'6'.repeat(64)}`
    },
    sourceLocator: {
      kind: 'DOCUMENT_COORDINATE',
      scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
      coordinates: {
        cellIndex: 3,
        outputIndex: 0,
        mimeType: 'text/plain',
        headerLineIndex: 0,
        rowIndex: '33',
        columns: [
          { role: 'SOURCE_NATIVE_SUBJECT', name: 'siteid' },
          { role: 'SOURCE_OPERATION_CODE', name: 'operation' },
          { role: 'TEMPORAL_SUPPORT', name: 'date' }
        ]
      },
      evidenceHash
    },
    projectedSource: {
      sourceRef:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF,
      contentHash: evidenceHash
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    epistemicClass: 'ASSERTION',
    provenanceClass: 'EXTERNAL_PROVIDER',
    projectionRationale:
      'Project exact persisted row reference plus row-level evidence hash.',
    ...overrides
  };
}

function compilation(value = projection(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_AUTHORITY',
    projection: value,
    projectionHash:
      agronomicRecordedOperationContextSourceReferenceHashProjectionHash(value),
    sourceReferenceReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PROVIDER_ID',
        'VALUE_SOURCE',
        'SOURCE_LOCATOR',
        'PUBLIC_SOURCE_REF',
        'PUBLIC_CONTENT_HASH'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_GENERIC_LOCATOR_FORMATTER'
    ],
    ...overrides
  };
}

test('normalizes exact first fact-level sourceRef and evidenceHash contentHash', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(
      projection()
    );
  assert.equal(
    normalized.projectedSource.sourceRef,
    AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
  );
  assert.equal(normalized.projectedSource.contentHash, evidenceHash);
  assert.equal(normalized.sourceLocator.evidenceHash, evidenceHash);
});

test('projection hash is deterministic and locator/value-source identity is material', () => {
  const baseline = projection();
  assert.equal(
    agronomicRecordedOperationContextSourceReferenceHashProjectionHash(baseline),
    agronomicRecordedOperationContextSourceReferenceHashProjectionHash(
      structuredClone(baseline)
    )
  );
  for (const mutate of [
    (value) => { value.valueSource.sourceRef.semanticHash = `sha256:${'7'.repeat(64)}`; },
    (value) => { value.valueSource.sourceArtifactRef.semanticHash = `sha256:${'8'.repeat(64)}`; },
    (value) => { value.sourceLocator.evidenceHash = `sha256:${'9'.repeat(64)}`; value.projectedSource.contentHash = value.sourceLocator.evidenceHash; }
  ]) {
    const changed = structuredClone(baseline);
    mutate(changed);
    assert.notEqual(
      agronomicRecordedOperationContextSourceReferenceHashProjectionHash(baseline),
      agronomicRecordedOperationContextSourceReferenceHashProjectionHash(changed)
    );
  }
});

test('rejects sourceRef that loses fact-level row identity', () => {
  for (const bad of [
    'scripts/cscap/chicago.ipynb',
    'blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb',
    AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
      .replace('rowIndex=33', 'rowIndex=32'),
    AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
      .replace('4847e7b3b4aad42193de3f5f0da6f81f6b62dc50', '0000000000000000000000000000000000000000')
  ]) {
    const value = projection();
    value.projectedSource.sourceRef = bad;
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value),
      /exact first fact-level public sourceRef/
    );
  }
});

test('rejects artifact hash, occurrence hash, or arbitrary hash as public contentHash', () => {
  for (const bad of [
    `sha256:${'6'.repeat(64)}`,
    `sha256:${'a'.repeat(64)}`,
    `sha256:${'b'.repeat(64)}`
  ]) {
    const value = projection();
    value.projectedSource.contentHash = bad;
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value),
      /must equal exact sourceLocator\.evidenceHash/
    );
  }
});

test('rejects exact row coordinate drift', () => {
  for (const mutate of [
    (value) => { value.sourceLocator.coordinates.cellIndex = 2; },
    (value) => { value.sourceLocator.coordinates.outputIndex = 1; },
    (value) => { value.sourceLocator.coordinates.mimeType = 'application/json'; },
    (value) => { value.sourceLocator.coordinates.headerLineIndex = 1; },
    (value) => { value.sourceLocator.coordinates.rowIndex = '32'; }
  ]) {
    const value = projection();
    mutate(value);
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value),
      /exact first Sustainable Corn persisted row coordinates/
    );
  }
});

test('rejects provider, epistemic, provenance and target drift', () => {
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(
      projection({ providerId: 'github.com' })
    ),
    /preserves only providerId/
  );
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(
      projection({ epistemicClass: 'OBSERVATION' })
    ),
    /preserves only ASSERTION/
  );
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(
      projection({ provenanceClass: 'PLATFORM' })
    ),
    /preserves only EXTERNAL_PROVIDER/
  );
  const target = projection();
  target.targetContextSemantic.value.date = '2011-05-04';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(target),
    /crop\.planting_date = DATE 2011-05-03/
  );
});

test('compilation hash closes exact projection', () => {
  const value = projection();
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(
      compilation(value)
    );
  assert.equal(
    normalized.projectionHash,
    agronomicRecordedOperationContextSourceReferenceHashProjectionHash(value)
  );
  const stale = compilation(value);
  stale.projection.projectionRationale = 'changed';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(stale),
    /projectionHash must exactly match/
  );
});

test('rejects downstream ContextDatum field laundering', () => {
  for (const forbidden of [
    'ContextDatum',
    'availableAt',
    'effectiveInterval',
    'spatialSupport',
    'verticalSupport',
    'unit',
    'uncertainty',
    'temporalSupport',
    'DecisionProblem',
    'Policy',
    'RuntimePlan',
    'ExecutionReceipt',
    'Outcome',
    'genericFormatter',
    'inverseProjection'
  ]) {
    const value = projection();
    value[forbidden] = 'forbidden';
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(value),
      /not part of the source-reference\/hash projection contract/
    );
  }
});
