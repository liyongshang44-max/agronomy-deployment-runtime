import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
  AgronomicContextUncertaintyUnknownRepresentationCompilationError,
  agronomicContextUncertaintyUnknownRepresentationHash,
  normalizeAgronomicContextUncertaintyUnknownRepresentation,
  normalizeAgronomicContextUncertaintyUnknownRepresentationCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
  logicalId: 'compilation.test.context-semantic-mapping',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextUncertaintyUnknownRepresentationReviewDecision',
  logicalId: 'review.test.uncertainty-unknown-representation',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function representation(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
    representationId:
      'representation.test.sustainable-corn.planting-date.uncertainty-unknown',
    parentContextSemanticMappingCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    uncertaintyRepresentation: {
      type: 'UNKNOWN',
      reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
    },
    rationale:
      'The accepted evidence establishes the planting-date value but does not establish a supported uncertainty characterization.',
    ...overrides
  };
}

function compilation(value = representation(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_AUTHORITY',
    representation: value,
    representationHash:
      agronomicContextUncertaintyUnknownRepresentationHash(value),
    uncertaintyRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'UNCERTAINTY_UNKNOWN_REPRESENTATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'VALUE_REMAINS_KNOWN_DATE',
      'NO_UNCERTAINTY_NONE_AUTHORITY',
      'NO_SOURCE_GLOBAL_NOT_REPORTED_CLAIM',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextUncertaintyUnknownRepresentationCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact planting-date uncertainty UNKNOWN representation', () => {
  const normalized =
    normalizeAgronomicContextUncertaintyUnknownRepresentation(representation());
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.deepEqual(normalized.uncertaintyRepresentation, {
    type: 'UNKNOWN',
    reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
  });
});

test('representation hash is deterministic and material predecessor/reason changes identity', () => {
  const baseline = representation();
  assert.equal(
    agronomicContextUncertaintyUnknownRepresentationHash(baseline),
    agronomicContextUncertaintyUnknownRepresentationHash(
      structuredClone(baseline)
    )
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.parentContextSemanticMappingCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicContextUncertaintyUnknownRepresentationHash(baseline),
    agronomicContextUncertaintyUnknownRepresentationHash(predecessorDrift)
  );

  const rationaleDrift = structuredClone(baseline);
  rationaleDrift.rationale = 'Different reviewed rationale.';
  assert.notEqual(
    agronomicContextUncertaintyUnknownRepresentationHash(baseline),
    agronomicContextUncertaintyUnknownRepresentationHash(rationaleDrift)
  );
});

test('rejects wrong semantic id, wrong value type and wrong date', () => {
  for (const targetContextSemantic of [
    {
      semanticId: 'crop.harvest_date',
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
        normalizeAgronomicContextUncertaintyUnknownRepresentation(
          representation({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_TARGET'
    );
  }
});

test('rejects uncertainty NONE and wrong reasonCode', () => {
  for (const uncertaintyRepresentation of [
    {
      type: 'NONE',
      reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
    },
    {
      type: 'UNKNOWN',
      reasonCode: 'NOT_REPORTED'
    },
    {
      type: 'UNKNOWN',
      reasonCode: 'NOT_OBSERVED'
    }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextUncertaintyUnknownRepresentation(
          representation({ uncertaintyRepresentation })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION'
    );
  }
});

test('rejects fabricated interval, categorical set and distribution reference', () => {
  for (const uncertaintyRepresentation of [
    {
      type: 'INTERVAL',
      lowerDecimal: '-1',
      upperDecimal: '1'
    },
    {
      type: 'CATEGORICAL_SET',
      values: ['2011-05-02', '2011-05-03']
    },
    {
      type: 'DISTRIBUTION_REFERENCE',
      providerId: 'invented',
      sourceRef: 'invented'
    }
  ]) {
    assert.throws(
      () =>
        normalizeAgronomicContextUncertaintyUnknownRepresentation(
          representation({ uncertaintyRepresentation })
        ),
      AgronomicContextUncertaintyUnknownRepresentationCompilationError
    );
  }
});

test('rejects empty, null and omitted reasonCode', () => {
  for (const uncertaintyRepresentation of [
    { type: 'UNKNOWN', reasonCode: '' },
    { type: 'UNKNOWN', reasonCode: null },
    { type: 'UNKNOWN' }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextUncertaintyUnknownRepresentation(
          representation({ uncertaintyRepresentation })
        ),
      'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_INPUT'
    );
  }
});

test('rejects value-level UNKNOWN substitution', () => {
  expectCode(
    () =>
      normalizeAgronomicContextUncertaintyUnknownRepresentation(
        representation({
          targetContextSemantic: {
            semanticId: 'crop.planting_date',
            value: {
              type: 'UNKNOWN',
              reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
            }
          }
        })
      ),
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_FIELD'
  );
});

test('rejects generic DATE type-only inference for another semantic', () => {
  expectCode(
    () =>
      normalizeAgronomicContextUncertaintyUnknownRepresentation(
        representation({
          targetContextSemantic: {
            semanticId: 'crop.emergence_date',
            value: { type: 'DATE', date: '2011-05-03' }
          }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_TARGET'
  );
});

test('rejects source-global NOT_REPORTED and unrelated ContextDatum authority fields', () => {
  for (const [key, value] of [
    ['sourceUncertaintyStatus', 'NOT_REPORTED'],
    ['epistemicInferenceRule', 'ASSERTION_TO_UNKNOWN'],
    ['effectiveInterval', {
      start: '2011-05-03T00:00:00Z',
      end: '2011-05-04T00:00:00Z'
    }],
    ['availableAt', '2011-05-03T00:00:00Z'],
    ['spatialSupport', { type: 'FARM' }],
    ['verticalSupport', null],
    ['unit', 'NOT_APPLICABLE']
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextUncertaintyUnknownRepresentation({
          ...representation(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects representation hash mismatch', () => {
  const normalized =
    normalizeAgronomicContextUncertaintyUnknownRepresentationCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  expectCode(
    () =>
      normalizeAgronomicContextUncertaintyUnknownRepresentationCompilation(
        compilation(representation(), {
          representationHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicContextUncertaintyUnknownRepresentationCompilation(
        compilation(representation(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['TARGET_CONTEXT_SEMANTIC'],
            unrepresentedElements: ['UNCERTAINTY_UNKNOWN_REPRESENTATION']
          }
        })
      ),
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COVERAGE'
  );
});
