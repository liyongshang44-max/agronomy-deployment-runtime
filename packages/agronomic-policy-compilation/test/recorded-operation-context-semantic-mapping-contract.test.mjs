import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION,
  agronomicRecordedOperationContextSemanticMappingHash,
  normalizeAgronomicRecordedOperationContextSemanticMapping,
  normalizeAgronomicRecordedOperationContextSemanticMappingCompilation
} from '../src/index.mjs';

const parentOccurrenceCompilationRef = Object.freeze({
  kind: 'AgronomicRecordedOperationOccurrenceCompilation',
  logicalId: 'compilation.test.parent-occurrence',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});

const semanticNormalizationCompilationRef = Object.freeze({
  kind: 'AgronomicRecordedOperationSemanticNormalizationCompilation',
  logicalId: 'compilation.test.semantic-normalization',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

const semanticReviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingReviewDecision',
  logicalId: 'review.test.context-semantic-mapping',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});

function mapping(overrides = {}) {
  const value = {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION,
    mappingId: 'mapping.test.plant-corn-planting-date',
    parentOccurrenceCompilationRef,
    semanticNormalizationCompilationRef,
    sourceOperationSemantic: {
      family: 'PLANT',
      subject: { kind: 'CROP', code: 'CORN' }
    },
    sourceTemporalSupport: {
      kind: 'CALENDAR_DATE',
      date: '2011-05-03',
      precision: 'DAY'
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    transformationRationale:
      'Exact accepted recorded planting occurrence maps to the frozen planting-date semantic without creating ContextDatum.'
  };
  return Object.assign(value, overrides);
}

function compilation(value = mapping(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY',
    mapping: value,
    mappingHash: agronomicRecordedOperationContextSemanticMappingHash(value),
    semanticReviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SEMANTIC_NORMALIZATION',
        'SOURCE_OPERATION_SEMANTIC',
        'SOURCE_TEMPORAL_SUPPORT',
        'TARGET_CONTEXT_SEMANTIC_ID',
        'TARGET_CONTEXT_TYPED_DATE_VALUE'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_TIMESTAMP_OR_TIMEZONE_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_AUTHORITY'
    ],
    ...overrides
  };
}

test('normalizes first finite PLANT/CROP:CORN -> crop.planting_date DATE mapping', () => {
  const normalized = normalizeAgronomicRecordedOperationContextSemanticMapping(mapping());
  assert.deepEqual(normalized.sourceOperationSemantic, {
    family: 'PLANT',
    subject: { kind: 'CROP', code: 'CORN' }
  });
  assert.deepEqual(normalized.sourceTemporalSupport, {
    kind: 'CALENDAR_DATE',
    date: '2011-05-03',
    precision: 'DAY'
  });
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
});

test('mapping hash is deterministic and predecessor refs are material', () => {
  const baseline = mapping();
  assert.equal(
    agronomicRecordedOperationContextSemanticMappingHash(baseline),
    agronomicRecordedOperationContextSemanticMappingHash(structuredClone(baseline))
  );

  const changedParent = structuredClone(baseline);
  changedParent.parentOccurrenceCompilationRef.semanticHash =
    `sha256:${'4'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSemanticMappingHash(baseline),
    agronomicRecordedOperationContextSemanticMappingHash(changedParent)
  );

  const changedNormalization = structuredClone(baseline);
  changedNormalization.semanticNormalizationCompilationRef.semanticHash =
    `sha256:${'5'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSemanticMappingHash(baseline),
    agronomicRecordedOperationContextSemanticMappingHash(changedNormalization)
  );
});

test('changing source date requires the exact target DATE value to change with it', () => {
  const value = mapping();
  value.sourceTemporalSupport.date = '2011-05-04';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /target DATE value must exactly preserve/
  );
});

test('changing target date fails closed', () => {
  const value = mapping();
  value.targetContextSemantic.value.date = '2011-05-04';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /target DATE value must exactly preserve/
  );
});

test('v1 rejects unsupported operation family', () => {
  const value = mapping();
  value.sourceOperationSemantic.family = 'HARVEST';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /v1 supports only PLANT/
  );
});

test('v1 rejects unsupported operation subject kind', () => {
  const value = mapping();
  value.sourceOperationSemantic.subject.kind = 'MATERIAL';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /v1 supports only PLANT/
  );
});

test('v1 rejects unsupported operation subject code', () => {
  const value = mapping();
  value.sourceOperationSemantic.subject.code = 'SOYBEAN';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /v1 supports only PLANT/
  );
});

test('v1 rejects arbitrary semanticId', () => {
  const value = mapping();
  value.targetContextSemantic.semanticId = 'crop.harvest_date';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /crop\.planting_date/
  );
});

test('v1 rejects TIMESTAMP target value', () => {
  const value = mapping();
  value.targetContextSemantic.value.type = 'TIMESTAMP';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /crop\.planting_date/
  );
});

test('v1 rejects non-DAY source temporal support', () => {
  const value = mapping();
  value.sourceTemporalSupport.precision = 'SECOND';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
    /CALENDAR_DATE with DAY precision/
  );
});

test('compilation hash closes the exact mapping', () => {
  const value = mapping();
  const normalized =
    normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(compilation(value));
  assert.equal(
    normalized.mappingHash,
    agronomicRecordedOperationContextSemanticMappingHash(value)
  );

  const stale = compilation(value);
  stale.mapping.targetContextSemantic.value.date = '2011-05-04';
  stale.mapping.sourceTemporalSupport.date = '2011-05-04';
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(stale),
    /mappingHash must exactly match/
  );
});

test('COMPLETE local coverage rejects unrepresented targeted elements', () => {
  const value = compilation();
  value.losslessCoverage.unrepresentedElements = ['TARGET_VALUE'];
  assert.throws(
    () => normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(value),
    /COMPLETE mapping coverage/
  );
});

test('mapping contract rejects downstream authority laundering fields', () => {
  for (const forbidden of [
    'effectiveInterval',
    'availableAt',
    'timezone',
    'spatialSupport',
    'geometryRef',
    'epistemicClass',
    'provenanceClass',
    'unit',
    'uncertainty',
    'temporalSupport',
    'ContextDatum',
    'ContextManifest',
    'DecisionProblem',
    'Policy',
    'RuntimePlan',
    'DecisionResult',
    'ExecutionReceipt',
    'Outcome',
    'inverseMapping',
    'mappingComplete'
  ]) {
    const value = mapping();
    value[forbidden] = 'forbidden';
    assert.throws(
      () => normalizeAgronomicRecordedOperationContextSemanticMapping(value),
      /not part of the context-semantic mapping contract/,
      forbidden
    );
  }
});
