import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  CONTEXT_VALUE_MODES,
  CONTEXT_VALUE_TYPES,
  EPISTEMIC_CLASSES,
  PROVENANCE_CLASSES,
  inlineContextDatumEnvelope,
  materializePublicContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import { baseDatum, principal, publishAuthorized } from './fixtures.mjs';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('publishes exact inline ContextDatum authority and frozen public wire contract', () => {
  const ledger = new AuthorityLedger();
  const record = publishAuthorized(ledger, 'ctx-soil-vwc-1', '1');
  const validated = validateContextDatumAuthority({ ledger, contextDatumRef: record.ref });
  assert.equal(validated.semanticPayload.authorityClass, 'CONTEXT_FACT');
  assert.equal(validated.semanticPayload.valueMode, 'INLINE');
  assert.equal(validated.semanticPayload.epistemicClass, 'OBSERVATION');
  assert.equal(validated.semanticPayload.provenanceClass, 'SENSOR');
  const wire = materializePublicContextDatum(record);
  assert.equal(wire.contract_version, 'adr.context-datum.v1');
  assert.equal(wire.datum_id, 'ctx-soil-vwc-1');
  assert.equal(wire.value.type, 'DECIMAL');
  assert.equal(wire.value.decimal, '0.32');
  assert.equal(wire.uncertainty.type, 'INTERVAL');
  assert.equal(wire.uncertainty.lower_decimal, '0.3');
  assert.equal(wire.uncertainty.upper_decimal, '0.34');
  assert.equal('lowerDecimal' in wire.uncertainty, false);
  assert.equal(wire.semantic_hash, record.ref.semanticHash);
  assert.equal(inlineContextDatumEnvelope(record).value_mode, 'INLINE');
  assert.deepEqual(CONTEXT_VALUE_MODES, ['INLINE', 'AUTHORIZED_REFERENCE']);
});

test('canonical decimal, RFC3339 offsets and set ordering are identity-stable', () => {
  const ledger = new AuthorityLedger();
  const a = publishAuthorized(ledger, 'ctx-canonical', '1', baseDatum({
    value: { type: 'SET', items: [{ type: 'DECIMAL', decimal: '0.3200' }, { type: 'DECIMAL', decimal: '0.340' }] },
    effectiveInterval: { start: '2026-08-16T03:00:00+02:00', end: '2026-08-16T04:00:00+02:00' },
    uncertainty: { type: 'CATEGORICAL_SET', values: ['HIGH', 'LOW'] }
  }), principal, 'canonical-a');
  const b = publishAuthorized(ledger, 'ctx-canonical', '1', baseDatum({
    value: { type: 'SET', items: [{ type: 'DECIMAL', decimal: '0.34' }, { type: 'DECIMAL', decimal: '0.32' }] },
    effectiveInterval: { start: '2026-08-16T01:00:00Z', end: '2026-08-16T02:00:00Z' },
    uncertainty: { type: 'CATEGORICAL_SET', values: ['LOW', 'HIGH'] }
  }), principal, 'canonical-b');
  assert.deepEqual(a.ref, b.ref);
});

const valueCases = [
  { type: 'DECIMAL', decimal: '12.5' },
  { type: 'INTEGER', integer: '12' },
  { type: 'BOOLEAN', boolean: true },
  { type: 'STRING', string: 'silty clay loam' },
  { type: 'CATEGORY', category: 'MID' },
  { type: 'DATE', date: '2026-04-22' },
  { type: 'TIMESTAMP', timestamp: '2026-08-16T02:00:00Z' },
  { type: 'INTERVAL', lower: { type: 'DECIMAL', decimal: '10' }, upper: { type: 'DECIMAL', decimal: '20' } },
  { type: 'SET', items: [{ type: 'CATEGORY', category: 'A' }, { type: 'CATEGORY', category: 'B' }] },
  { type: 'UNKNOWN', reasonCode: 'NOT_OBSERVED' }
];

test('supports every frozen ContextDatum value type without unsafe JS numeric coercion', () => {
  assert.deepEqual(CONTEXT_VALUE_TYPES, [
    'DECIMAL', 'INTEGER', 'BOOLEAN', 'STRING', 'CATEGORY',
    'DATE', 'TIMESTAMP', 'INTERVAL', 'SET', 'UNKNOWN'
  ]);
  for (const [index, value] of valueCases.entries()) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(
      ledger,
      `ctx-value-${index}`,
      '1',
      baseDatum({ value, unit: ['DECIMAL', 'INTEGER', 'INTERVAL'].includes(value.type) ? 'mm' : 'none' })
    );
    assert.equal(validateContextDatumAuthority({ ledger, contextDatumRef: record.ref }).semanticPayload.value.type, value.type);
    assert.equal(materializePublicContextDatum(record).value.type, value.type);
  }
});

test('accepts every frozen EpistemicClass without inferring provenance', () => {
  assert.deepEqual(EPISTEMIC_CLASSES, [
    'OBSERVATION', 'ASSERTION', 'DERIVED', 'STATE_ESTIMATE',
    'FORECAST', 'CONFIGURATION', 'MODEL_PRIOR'
  ]);
  for (const epistemicClass of EPISTEMIC_CLASSES) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(
      ledger,
      `ctx-epistemic-${epistemicClass.toLowerCase()}`,
      '1',
      baseDatum({ epistemicClass, provenanceClass: 'PLATFORM' })
    );
    assert.equal(record.semanticPayload.epistemicClass, epistemicClass);
    assert.equal(record.semanticPayload.provenanceClass, 'PLATFORM');
  }
});

test('accepts every frozen ProvenanceClass without upgrading epistemic class', () => {
  assert.deepEqual(PROVENANCE_CLASSES, [
    'USER', 'AGRONOMIST', 'SENSOR', 'MACHINERY', 'REMOTE_SENSING',
    'EXTERNAL_PROVIDER', 'CUSTOMER_SYSTEM', 'LABORATORY', 'MODEL', 'PLATFORM'
  ]);
  for (const provenanceClass of PROVENANCE_CLASSES) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(
      ledger,
      `ctx-provenance-${provenanceClass.toLowerCase()}`,
      '1',
      baseDatum({ epistemicClass: 'ASSERTION', provenanceClass })
    );
    assert.equal(record.semanticPayload.epistemicClass, 'ASSERTION');
    assert.equal(record.semanticPayload.provenanceClass, provenanceClass);
  }
});

test('epistemic class is independent from provenance class for the same real-world claim', () => {
  const ledger = new AuthorityLedger();
  const grower = publishAuthorized(ledger, 'ctx-planting-grower', '1', baseDatum({
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2026-04-22' },
    unit: 'none',
    epistemicClass: 'ASSERTION',
    provenanceClass: 'CUSTOMER_SYSTEM'
  }));
  const machine = publishAuthorized(ledger, 'ctx-planting-machine', '1', baseDatum({
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2026-04-22' },
    unit: 'none',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'MACHINERY'
  }));
  assert.equal(grower.semanticPayload.epistemicClass, 'ASSERTION');
  assert.equal(machine.semanticPayload.epistemicClass, 'OBSERVATION');
  assert.notEqual(grower.ref.semanticHash, machine.ref.semanticHash);
});

for (const [label, override] of [
  ['semantic-id', { semanticId: 'soil.root_zone_water_storage' }],
  ['value', { value: { type: 'DECIMAL', decimal: '0.31' } }],
  ['unit', { unit: 'percent' }],
  ['epistemic', { epistemicClass: 'STATE_ESTIMATE' }],
  ['provenance', { provenanceClass: 'MODEL' }],
  ['effective-time', { effectiveInterval: { start: '2026-08-16T00:00:00Z', end: '2026-08-16T01:00:00Z' } }],
  ['available-at', { availableAt: '2026-08-16T02:05:00Z' }],
  ['spatial-support', { spatialSupport: { type: 'FIELD', geometryRef: 'field-1' } }],
  ['vertical-support', { verticalSupport: { fromMm: '0', toMm: '600' } }],
  ['temporal-support', { temporalSupport: { type: 'INSTANT' } }],
  ['uncertainty', { uncertainty: { type: 'NONE' } }],
  ['source', { source: { providerId: 'provider-b', sourceRef: 'obs-b', contentHash: 'sha256:b' } }]
]) {
  test(`material ${label} change changes ContextDatum semantic identity`, () => {
    const ledger = new AuthorityLedger();
    const a = publishAuthorized(ledger, `ctx-material-${label}`, '1', baseDatum());
    const b = publishAuthorized(ledger, `ctx-material-${label}`, '2', baseDatum(override));
    assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
  });
}

test('historical exact ContextDatum ref replays after a later version', () => {
  const ledger = new AuthorityLedger();
  const old = publishAuthorized(
    ledger,
    'ctx-replay',
    '1',
    baseDatum({ value: { type: 'DECIMAL', decimal: '0.30' } }),
    principal,
    'replay-old'
  );
  publishAuthorized(
    ledger,
    'ctx-replay',
    '2',
    baseDatum({ value: { type: 'DECIMAL', decimal: '0.35' } }),
    principal,
    'replay-new'
  );
  assert.equal(validateContextDatumAuthority({ ledger, contextDatumRef: old.ref }).semanticPayload.value.decimal, '0.3');
});

console.log(`ContextDatum acceptance: ${passed} passed`);
