import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION,
  AgronomicContextVerticalSupportNonApplicabilityCompilationError,
  agronomicContextVerticalSupportNonApplicabilityHash,
  normalizeAgronomicContextVerticalSupportNonApplicability,
  normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
  logicalId: 'compilation.test.context-semantic-mapping',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextVerticalSupportNonApplicabilityReviewDecision',
  logicalId: 'review.test.vertical-support-non-applicability',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function representation(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION,
    representationId:
      'representation.test.sustainable-corn.planting-date.vertical-support',
    parentContextSemanticMappingCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    verticalSupportRepresentation: {
      kind: 'NOT_APPLICABLE',
      wireValue: null
    },
    rationale:
      'No physical vertical support interval applies to this exact planting-date semantic/value.',
    ...overrides
  };
}

function compilation(value = representation(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_AUTHORITY',
    representation: value,
    representationHash:
      agronomicContextVerticalSupportNonApplicabilityHash(value),
    verticalSupportRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'VERTICAL_SUPPORT_NON_APPLICABILITY'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_UNCERTAINTY_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_AUTHORITY',
      'NO_DEPTH_INFERENCE'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextVerticalSupportNonApplicabilityCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact crop.planting_date DATE -> verticalSupport null representation', () => {
  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicability(
      representation()
    );
  assert.deepEqual(normalized.targetContextSemantic, {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  });
  assert.deepEqual(normalized.verticalSupportRepresentation, {
    kind: 'NOT_APPLICABLE',
    wireValue: null
  });
});

test('representation hash is deterministic and material predecessor/reason changes identity', () => {
  const baseline = representation();
  assert.equal(
    agronomicContextVerticalSupportNonApplicabilityHash(baseline),
    agronomicContextVerticalSupportNonApplicabilityHash(
      structuredClone(baseline)
    )
  );

  const predecessorDrift = structuredClone(baseline);
  predecessorDrift.parentContextSemanticMappingCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicContextVerticalSupportNonApplicabilityHash(baseline),
    agronomicContextVerticalSupportNonApplicabilityHash(predecessorDrift)
  );

  const rationaleDrift = structuredClone(baseline);
  rationaleDrift.rationale = 'Different reviewed rationale.';
  assert.notEqual(
    agronomicContextVerticalSupportNonApplicabilityHash(baseline),
    agronomicContextVerticalSupportNonApplicabilityHash(rationaleDrift)
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
        normalizeAgronomicContextVerticalSupportNonApplicability(
          representation({ targetContextSemantic })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_TARGET'
    );
  }
});

test('rejects zero-depth, arbitrary depth and omitted vertical support substitutions', () => {
  for (const verticalSupportRepresentation of [
    {
      kind: 'NOT_APPLICABLE',
      wireValue: { fromMm: '0', toMm: '0' }
    },
    {
      kind: 'NOT_APPLICABLE',
      wireValue: { fromMm: '0', toMm: '50' }
    },
    {
      kind: 'NOT_APPLICABLE'
    },
    {
      kind: 'DEPTH_INTERVAL',
      wireValue: null
    }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextVerticalSupportNonApplicability(
          representation({ verticalSupportRepresentation })
        ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REPRESENTATION'
    );
  }
});

test('rejects generic DATE type-only inference for another semantic', () => {
  expectCode(
    () =>
      normalizeAgronomicContextVerticalSupportNonApplicability(
        representation({
          targetContextSemantic: {
            semanticId: 'crop.emergence_date',
            value: { type: 'DATE', date: '2011-05-03' }
          }
        })
      ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_TARGET'
  );
});

test('rejects fields that widen null into missing-data or unrelated ContextDatum authority', () => {
  for (const [key, value] of [
    ['sourceVerticalSupportStatus', 'NOT_REPORTED'],
    ['uncertainty', { type: 'NONE' }],
    ['effectiveInterval', {
      start: '2011-05-03T00:00:00Z',
      end: '2011-05-04T00:00:00Z'
    }],
    ['availableAt', '2011-05-03T00:00:00Z'],
    ['spatialSupport', { type: 'FARM' }],
    ['unit', 'NOT_APPLICABLE']
  ]) {
    expectCode(
      () =>
        normalizeAgronomicContextVerticalSupportNonApplicability({
          ...representation(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects representation hash mismatch', () => {
  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  expectCode(
    () =>
      normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(
        compilation(representation(), {
          representationHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(
        compilation(representation(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['TARGET_CONTEXT_SEMANTIC'],
            unrepresentedElements: ['VERTICAL_SUPPORT_NON_APPLICABILITY']
          }
        })
      ),
    'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COVERAGE'
  );
});
