import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE,
  AgronomicContextDatumAssemblyCompilationError,
  agronomicContextDatumAssemblyHash,
  normalizeAgronomicContextDatumAssembly,
  normalizeAgronomicContextDatumAssemblyCompilation
} from '../src/index.mjs';

function ref(kind, seed) {
  return {
    kind,
    logicalId: 'test.' + seed,
    version: '1',
    semanticHash: 'sha256:' + seed.repeat(64).slice(0, 64)
  };
}

const predecessorRefs = {
  contextSemanticMappingCompilationRef:
    ref('AgronomicRecordedOperationContextSemanticMappingCompilation', '1'),
  epistemicClassificationCompilationRef:
    ref('AgronomicRecordedOperationContextEpistemicClassificationCompilation', '2'),
  provenanceClassificationCompilationRef:
    ref('AgronomicRecordedOperationContextProvenanceClassificationCompilation', '3'),
  sourceReferenceHashProjectionCompilationRef:
    ref('AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation', '4'),
  temporalSupportClassificationCompilationRef:
    ref('AgronomicRecordedOperationContextTemporalSupportClassificationCompilation', '5'),
  spatialSupportClassificationCompilationRef:
    ref('AgronomicRecordedOperationContextSpatialSupportClassificationCompilation', '6'),
  unitRepresentationCompilationRef:
    ref('AgronomicContextNonQuantitativeUnitRepresentationCompilation', '7'),
  verticalSupportNonApplicabilityCompilationRef:
    ref('AgronomicContextVerticalSupportNonApplicabilityCompilation', '8'),
  uncertaintyUnknownRepresentationCompilationRef:
    ref('AgronomicContextUncertaintyUnknownRepresentationCompilation', '9'),
  sourceAcquisitionAvailabilityProjectionCompilationRef:
    ref('AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation', 'a'),
  historicalTimezoneBoundaryResolutionCompilationRef:
    ref('AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation', 'b')
};
const reviewRef =
  ref('AgronomicContextDatumAssemblyReviewDecision', 'c');

function assembly(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION,
    assemblyId: 'assembly.test.sustainable-corn',
    predecessorRefs: structuredClone(predecessorRefs),
    datumTemplate:
      structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
    rationale: 'Exact first-world assembly.',
    ...overrides
  };
}

function compilation(value = assembly(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_AUTHORITY',
    assembly: value,
    assemblyHash: agronomicContextDatumAssemblyHash(value),
    assemblyReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['ALL_FIRST_CONTEXT_DATUM_FIELDS'],
      unrepresentedElements: []
    },
    limitations: ['NO_GENERIC_ASSEMBLY_RULE'],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof AgronomicContextDatumAssemblyCompilationError);
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact first ContextDatum assembly template', () => {
  const normalized = normalizeAgronomicContextDatumAssembly(assembly());
  assert.equal(normalized.datumTemplate.semanticId, 'crop.planting_date');
  assert.deepEqual(normalized.datumTemplate.value, {
    type: 'DATE',
    date: '2011-05-03'
  });
  assert.equal(normalized.datumTemplate.unit, 'NOT_APPLICABLE');
  assert.equal(
    normalized.datumTemplate.effectiveInterval.start,
    '2011-05-03T05:00:00.000Z'
  );
  assert.equal(
    Object.hasOwn(normalized.datumTemplate.spatialSupport, 'geometryRef'),
    false
  );
});

test('assembly identity is deterministic and predecessor refs are material', () => {
  const a = assembly();
  assert.equal(
    agronomicContextDatumAssemblyHash(a),
    agronomicContextDatumAssemblyHash(structuredClone(a))
  );
  const drift = structuredClone(a);
  drift.predecessorRefs.contextSemanticMappingCompilationRef.semanticHash =
    'sha256:' + 'f'.repeat(64);
  assert.notEqual(
    agronomicContextDatumAssemblyHash(a),
    agronomicContextDatumAssemblyHash(drift)
  );
});

test('rejects wrong predecessor kind', () => {
  const drift = structuredClone(predecessorRefs);
  drift.unitRepresentationCompilationRef =
    ref('AgronomicContextVerticalSupportNonApplicabilityCompilation', 'd');
  expectCode(
    () => normalizeAgronomicContextDatumAssembly(
      assembly({ predecessorRefs: drift })
    ),
    'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AUTHORITY_REF'
  );
});

test('rejects field drift and DATE to TIMESTAMP mutation', () => {
  for (const datumTemplate of [
    {
      ...structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
      unit: 'day'
    },
    {
      ...structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
      value: { type: 'TIMESTAMP', timestamp: '2011-05-03T05:00:00.000Z' }
    },
    {
      ...structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
      spatialSupport: { type: 'FARM', geometryRef: 'target_src_fake' }
    }
  ]) {
    expectCode(
      () => normalizeAgronomicContextDatumAssembly(
        assembly({ datumTemplate })
      ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TEMPLATE'
    );
  }
});

test('rejects targetRef/farmId and publication-scope injection into datum template', () => {
  for (const key of ['targetRef', 'farmId', 'organizationId', 'tenantId']) {
    const datumTemplate =
      structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE);
    datumTemplate[key] = 'forbidden';
    assert.throws(() =>
      normalizeAgronomicContextDatumAssembly(assembly({ datumTemplate }))
    );
  }
});

test('normalizes COMPLETE assembly compilation and detects hash mismatch', () => {
  assert.equal(
    normalizeAgronomicContextDatumAssemblyCompilation(compilation())
      .losslessCoverage.status,
    'COMPLETE'
  );
  expectCode(
    () => normalizeAgronomicContextDatumAssemblyCompilation(
      compilation(assembly(), { assemblyHash: 'sha256:' + '0'.repeat(64) })
    ),
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_HASH_MISMATCH'
  );
});

test('INCOMPLETE assembly requires explicit unresolved elements', () => {
  expectCode(
    () => normalizeAgronomicContextDatumAssemblyCompilation(
      compilation(assembly(), {
        losslessCoverage: {
          status: 'INCOMPLETE',
          coveredElements: [],
          unrepresentedElements: []
        }
      })
    ),
    'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COVERAGE'
  );
});
