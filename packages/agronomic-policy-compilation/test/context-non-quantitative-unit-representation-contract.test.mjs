import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION,
  AgronomicContextNonQuantitativeUnitRepresentationCompilationError,
  agronomicContextNonQuantitativeUnitRepresentationHash,
  normalizeAgronomicContextNonQuantitativeUnitRepresentation,
  normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
  logicalId: 'compilation.test.context-semantic-mapping',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextNonQuantitativeUnitRepresentationReviewDecision',
  logicalId: 'review.test.non-quantitative-unit-representation',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function representation(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION,
    representationId: 'representation.test.sustainable-corn.planting-date-unit',
    parentContextSemanticMappingCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    unitRepresentation: {
      kind: 'NOT_APPLICABLE',
      wireValue: 'NOT_APPLICABLE'
    },
    rationale:
      'DATE is non-quantitative in this accepted projection, so no measurement unit applies.',
    ...overrides
  };
}

function compilation(value = representation(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_AUTHORITY',
    representation: value,
    representationHash:
      agronomicContextNonQuantitativeUnitRepresentationHash(value),
    unitRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'NON_QUANTITATIVE_UNIT_REPRESENTATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_UNCERTAINTY_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_AUTHORITY',
      'NO_GENERAL_UNIT_REGISTRY'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof
        AgronomicContextNonQuantitativeUnitRepresentationCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact crop.planting_date DATE -> NOT_APPLICABLE representation', () => {
  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentation(
      representation()
    );
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.deepEqual(normalized.unitRepresentation, {
    kind: 'NOT_APPLICABLE',
    wireValue: 'NOT_APPLICABLE'
  });
});

test('representation hash is deterministic and material predecessor/reason changes identity', () => {
  const baseline = representation();
  assert.equal(
    agronomicContextNonQuantitativeUnitRepresentationHash(baseline),
    agronomicContextNonQuantitativeUnitRepresentationHash(
      structuredClone(baseline)
    )
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.parentContextSemanticMappingCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicContextNonQuantitativeUnitRepresentationHash(baseline),
    agronomicContextNonQuantitativeUnitRepresentationHash(predecessorDrift)
  );

  const rationaleDrift = structuredClone(baseline);
  rationaleDrift.rationale = 'Different reviewed rationale.';
  assert.notEqual(
    agronomicContextNonQuantitativeUnitRepresentationHash(baseline),
    agronomicContextNonQuantitativeUnitRepresentationHash(rationaleDrift)
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
        normalizeAgronomicContextNonQuantitativeUnitRepresentation(
          representation({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_TARGET'
    );
  }
});

test('rejects day, unitless, empty, null and omitted token substitutions', () => {
  for (const unitRepresentation of [
    { kind: 'NOT_APPLICABLE', wireValue: 'day' },
    { kind: 'NOT_APPLICABLE', wireValue: 'unitless' },
    { kind: 'NOT_APPLICABLE', wireValue: '' },
    { kind: 'NOT_APPLICABLE', wireValue: null },
    { kind: 'NOT_APPLICABLE' },
    { kind: 'UNITLESS', wireValue: 'NOT_APPLICABLE' }
  ]) {
    assert.throws(
      () =>
        normalizeAgronomicContextNonQuantitativeUnitRepresentation(
          representation({ unitRepresentation })
        ),
      AgronomicContextNonQuantitativeUnitRepresentationCompilationError
    );
  }
});

test('rejects generic DATE type-only inference for another semantic', () => {
  expectCode(
    () =>
      normalizeAgronomicContextNonQuantitativeUnitRepresentation(
        representation({
          targetContextSemantic: {
            semanticId: 'crop.emergence_date',
            value: { type: 'DATE', date: '2011-05-03' }
          }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_TARGET'
  );
});

test('rejects fields that would widen authority into missing-data or ContextDatum semantics', () => {
  for (const [key, value] of [
    ['sourceUnitStatus', 'NOT_REPORTED'],
    ['uncertainty', { type: 'NONE' }],
    ['effectiveInterval', {
      start: '2011-05-03T00:00:00Z',
      end: '2011-05-04T00:00:00Z'
    }],
    ['availableAt', '2011-05-03T00:00:00Z'],
    ['spatialSupport', { type: 'FARM' }]
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextNonQuantitativeUnitRepresentation({
          ...representation(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects representation hash mismatch', () => {
  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  expectCode(
    () =>
      normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(
        compilation(representation(), {
          representationHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(
        compilation(representation(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['TARGET_CONTEXT_SEMANTIC'],
            unrepresentedElements: ['NON_QUANTITATIVE_UNIT_REPRESENTATION']
          }
        })
      ),
    'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COVERAGE'
  );
});
