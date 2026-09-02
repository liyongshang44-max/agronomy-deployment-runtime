import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY,
  AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError,
  agronomicContextHistoricalTimezoneBoundaryResolutionHash,
  normalizeAgronomicContextHistoricalTimezoneBoundaryResolution,
  normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation
} from '../src/index.mjs';

const parentRef = Object.freeze({
  kind: 'AgronomicContextCalendarDateLocalCivilFrameBindingCompilation',
  logicalId: 'compilation.test.local-civil-frame',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision',
  logicalId: 'review.test.historical-timezone',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

function resolution(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION,
    resolutionId: 'resolution.test.sustainable-corn.historical-timezone',
    parentCalendarDateLocalCivilFrameBindingCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: {type: 'DATE', date: '2011-05-03'}
    },
    localCivilFrame: {
      kind: 'LOCAL_CIVIL_DAY',
      civilDate: '2011-05-03',
      zoneScheme: 'IANA',
      zoneId: 'America/Chicago'
    },
    timezoneRuleAuthority: structuredClone(
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY
    ),
    historicalResolution: {
      springTransitionDate: '2011-03-13',
      fallTransitionDate: '2011-11-06',
      baseOffset: '-06:00',
      daylightSave: '+01:00',
      effectiveOffset: '-05:00',
      dstState: 'DAYLIGHT'
    },
    localBoundaryProjection: {
      start: '2011-05-03T00:00:00-05:00',
      end: '2011-05-04T00:00:00-05:00'
    },
    effectiveInterval: {
      start: '2011-05-03T05:00:00.000Z',
      end: '2011-05-04T05:00:00.000Z'
    },
    rationale: 'Exact retained IANA tzdb 2026c rule replay for the finite DEC-0029 local civil day.',
    ...overrides
  };
}

function compilation(value = resolution(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_AUTHORITY',
    resolution: value,
    resolutionHash: agronomicContextHistoricalTimezoneBoundaryResolutionHash(value),
    boundaryReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'DEC_0029_LOCAL_CIVIL_DAY',
        'IANA_TZDB_2026C_RULE_AUTHORITY',
        '2011_DST_TRANSITIONS',
        'EFFECTIVE_OFFSET',
        'LOCAL_BOUNDARIES',
        'CANONICAL_UTC_EFFECTIVE_INTERVAL'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_GENERIC_TIMEZONE_ENGINE',
      'NO_HOST_TIMEZONE_AUTHORITY',
      'NO_INTERVAL_CLOSURE_POLICY',
      'NO_AVAILABLE_AT_MUTATION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError);
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes the exact first historical timezone boundary resolution', () => {
  const normalized = normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(resolution());
  assert.equal(normalized.timezoneRuleAuthority.provider, 'IANA_TZDB');
  assert.equal(normalized.timezoneRuleAuthority.release, '2026c');
  assert.equal(normalized.historicalResolution.effectiveOffset, '-05:00');
  assert.equal(normalized.historicalResolution.dstState, 'DAYLIGHT');
  assert.deepEqual(normalized.effectiveInterval, {
    start: '2011-05-03T05:00:00.000Z',
    end: '2011-05-04T05:00:00.000Z'
  });
});

test('resolution hash is deterministic and predecessor ref is material', () => {
  const value = resolution();
  assert.equal(
    agronomicContextHistoricalTimezoneBoundaryResolutionHash(value),
    agronomicContextHistoricalTimezoneBoundaryResolutionHash(structuredClone(value))
  );
  const drift = structuredClone(value);
  drift.parentCalendarDateLocalCivilFrameBindingCompilationRef.semanticHash =
    `sha256:${'3'.repeat(64)}`;
  assert.notEqual(
    agronomicContextHistoricalTimezoneBoundaryResolutionHash(value),
    agronomicContextHistoricalTimezoneBoundaryResolutionHash(drift)
  );
});

test('rejects target and local civil frame drift', () => {
  expectCode(
    () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
      resolution({
        targetContextSemantic: {
          semanticId: 'crop.planting_date',
          value: {type: 'TIMESTAMP', date: '2011-05-03'}
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_TARGET'
  );
  expectCode(
    () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
      resolution({
        localCivilFrame: {
          kind: 'LOCAL_CIVIL_DAY',
          civilDate: '2011-05-03',
          zoneScheme: 'IANA',
          zoneId: 'America/New_York'
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LOCAL_CIVIL_FRAME'
  );
});

test('rejects mutable, wrong-version and checksum rule authority', () => {
  for (const timezoneRuleAuthority of [
    {
      ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
      dataArtifact: 'tzdata-latest.tar.gz'
    },
    {
      ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
      release: '2026b'
    },
    {
      ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
      sha512: '0'.repeat(128)
    }
  ]) {
    expectCode(
      () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
        resolution({timezoneRuleAuthority})
      ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_AUTHORITY'
    );
  }
});

test('rejects transition, offset and DST substitution', () => {
  const cases = [
    {
      springTransitionDate: '2011-03-12',
      fallTransitionDate: '2011-11-06',
      baseOffset: '-06:00',
      daylightSave: '+01:00',
      effectiveOffset: '-05:00',
      dstState: 'DAYLIGHT'
    },
    {
      springTransitionDate: '2011-03-13',
      fallTransitionDate: '2011-11-06',
      baseOffset: '-06:00',
      daylightSave: '+00:00',
      effectiveOffset: '-06:00',
      dstState: 'STANDARD'
    }
  ];
  for (const historicalResolution of cases) {
    expectCode(
      () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
        resolution({historicalResolution})
      ),
      'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HISTORICAL_STATE'
    );
  }
});

test('rejects arbitrary local and UTC boundaries', () => {
  expectCode(
    () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
      resolution({
        localBoundaryProjection: {
          start: '2011-05-03T00:00:00-06:00',
          end: '2011-05-04T00:00:00-06:00'
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LOCAL_BOUNDARY'
  );
  expectCode(
    () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(
      resolution({
        effectiveInterval: {
          start: '2011-05-03T06:00:00.000Z',
          end: '2011-05-04T06:00:00.000Z'
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_EFFECTIVE_INTERVAL'
  );
});

test('rejects host fallback, availableAt and downstream publication widening', () => {
  for (const [key, value] of [
    ['hostTimezoneFallback', true],
    ['availableAt', '2026-08-30T13:00:00.000Z'],
    ['contextDatumRef', 'CD-1'],
    ['contextManifestRef', 'CM-1'],
    ['decisionProblemRef', 'DP-1'],
    ['intervalClosure', 'HALF_OPEN']
  ]) {
    expectCode(
      () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolution({
        ...resolution(),
        [key]: value
      }),
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  assert.equal(
    normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(compilation())
      .losslessCoverage.status,
    'COMPLETE'
  );
  expectCode(
    () => normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(
      compilation(resolution(), {resolutionHash: `sha256:${'f'.repeat(64)}`})
    ),
    'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HASH_MISMATCH'
  );
});
