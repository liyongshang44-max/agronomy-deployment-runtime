import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION,
  AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError,
  agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash,
  normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding,
  normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation
} from '../src/index.mjs';

const temporalRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation',
  logicalId: 'compilation.test.temporal-support',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});
const targetIdentityRef = Object.freeze({
  kind: 'AgronomicRecordedOperationTargetIdentityBindingCompilation',
  logicalId: 'compilation.test.target-identity',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});
const decagonSourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.decagon',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});
const decagonArtifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.decagon',
  version: '1',
  semanticHash: `sha256:${'4'.repeat(64)}`
});
const waterSourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.watertable',
  version: '1',
  semanticHash: `sha256:${'5'.repeat(64)}`
});
const waterArtifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.watertable',
  version: '1',
  semanticHash: `sha256:${'6'.repeat(64)}`
});
const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision',
  logicalId: 'review.test.timezone',
  version: '1',
  semanticHash: `sha256:${'7'.repeat(64)}`
});

function evidence(role, sourceRef, artifactRef, start, endExclusive, digit) {
  return {
    evidenceRole: role,
    sourceRef,
    sourceArtifactRef: artifactRef,
    sourceArtifactContentHash: `sha256:${digit.repeat(64)}`,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start,
      endExclusive,
      evidenceHash: `sha256:${digit.repeat(64)}`
    }
  };
}

function binding(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.test.sustainable-corn.serf-timezone',
    temporalSupportClassificationCompilationRef: temporalRef,
    targetIdentityBindingCompilationRef: targetIdentityRef,
    sourceNativeSubject: { name: 'siteid', value: 'SERF' },
    timezoneEvidence: [
      evidence(
        'DECAGON_SITE_TIMEZONE_IDENTITY',
        decagonSourceRef,
        decagonArtifactRef,
        1170,
        1301,
        '8'
      ),
      evidence(
        'WATERTABLE_SITE_TIMEZONE_IDENTITY',
        waterSourceRef,
        waterArtifactRef,
        2106,
        2237,
        '9'
      )
    ],
    sourceTimezone: { scheme: 'IANA', zoneId: 'America/Chicago' },
    bindingRationale:
      'Bind exact source-native SERF identity to reviewed IANA timezone identity only.',
    ...overrides
  };
}

function compilation(value = binding(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding: value,
    bindingHash:
      agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(value),
    timezoneReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'TEMPORAL_SUPPORT_PREDECESSOR',
        'TARGET_IDENTITY_CO_PREDECESSOR',
        'SOURCE_NATIVE_SUBJECT',
        'TIMEZONE_EVIDENCE',
        'TIMEZONE_IDENTITY'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CALENDAR_DATE_LOCAL_FRAME_BINDING',
      'NO_OFFSET_OR_DST',
      'NO_TZDB_VERSION',
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
        AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact first SERF -> IANA America/Chicago timezone identity binding', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
      binding()
    );
  assert.deepEqual(normalized.sourceNativeSubject, {
    name: 'siteid',
    value: 'SERF'
  });
  assert.deepEqual(normalized.sourceTimezone, {
    scheme: 'IANA',
    zoneId: 'America/Chicago'
  });
  assert.deepEqual(
    normalized.timezoneEvidence.map((item) => item.evidenceRole),
    [
      'DECAGON_SITE_TIMEZONE_IDENTITY',
      'WATERTABLE_SITE_TIMEZONE_IDENTITY'
    ]
  );
});

test('binding hash is deterministic and both co-predecessor refs are material', () => {
  const baseline = binding();
  assert.equal(
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(baseline),
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
      structuredClone(baseline)
    )
  );

  const temporalDrift = structuredClone(baseline);
  temporalDrift.temporalSupportClassificationCompilationRef.semanticHash =
    `sha256:${'a'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(baseline),
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
      temporalDrift
    )
  );

  const identityDrift = structuredClone(baseline);
  identityDrift.targetIdentityBindingCompilationRef.semanticHash =
    `sha256:${'b'.repeat(64)}`;
  assert.notEqual(
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(baseline),
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
      identityDrift
    )
  );
});

test('rejects source-native subject drift', () => {
  for (const sourceNativeSubject of [
    { name: 'siteid', value: 'ISUAG' },
    { name: 'siteid', value: 'GILMORE' },
    { name: 'farmid', value: 'SERF' }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
          binding({ sourceNativeSubject })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_SUBJECT'
    );
  }
});

test('rejects aliases, offsets and alternate timezone identities', () => {
  for (const sourceTimezone of [
    { scheme: 'IANA', zoneId: 'America/New_York' },
    { scheme: 'IANA', zoneId: 'US/Central' },
    { scheme: 'DISPLAY', zoneId: 'Central Time' },
    { scheme: 'ABBREVIATION', zoneId: 'CST' },
    { scheme: 'ABBREVIATION', zoneId: 'CDT' },
    { scheme: 'UTC_OFFSET', zoneId: '-05:00' },
    { scheme: 'UTC_OFFSET', zoneId: '-06:00' }
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
          binding({ sourceTimezone })
        ),
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY'
    );
  }
});

test('requires exactly the two accepted evidence roles', () => {
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
        binding({ timezoneEvidence: [binding().timezoneEvidence[0]] })
      ),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_REQUIRED'
  );

  const duplicated = [
    binding().timezoneEvidence[0],
    structuredClone(binding().timezoneEvidence[0])
  ];
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
        binding({ timezoneEvidence: duplicated })
      ),
    'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLE'
  );
});

test('contract rejects offset, DST, TZDB, local-frame and effective-interval widening', () => {
  for (const [key, value] of [
    ['utcOffset', '-05:00'],
    ['dstState', 'DAYLIGHT'],
    ['tzdbVersion', '2026a'],
    ['calendarDateFrame', 'LOCAL_CIVIL_DAY'],
    ['effectiveInterval', {
      start: '2011-05-03T05:00:00Z',
      end: '2011-05-04T05:00:00Z'
    }],
    ['availableAt', '2011-05-03T05:00:00Z']
  ]) {
    expectCode(
      () =>
        normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding({
          ...binding(),
          [key]: value
        }),
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_FIELD'
    );
  }
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.deepEqual(normalized.losslessCoverage.unrepresentedElements, []);

  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
        compilation(binding(), {
          bindingHash: `sha256:${'f'.repeat(64)}`
        })
      ),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_HASH_MISMATCH'
  );
});

test('COMPLETE coverage cannot hide targeted unrepresented elements', () => {
  expectCode(
    () =>
      normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
        compilation(binding(), {
          losslessCoverage: {
            status: 'COMPLETE',
            coveredElements: ['SOURCE_NATIVE_SUBJECT'],
            unrepresentedElements: ['TIMEZONE_IDENTITY']
          }
        })
      ),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COVERAGE'
  );
});
