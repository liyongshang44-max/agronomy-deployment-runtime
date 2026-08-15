import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  CONTEXT_VALUE_MODES,
  inlineContextDatumEnvelope,
  materializePublicContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import { audit, baseDatum, principal, publishAuthorized } from './fixtures.mjs';

function test(name, fn) { try { fn(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; } }

test('publishes exact inline ContextDatum authority and public contract', () => {
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
  assert.equal(wire.semantic_hash, record.ref.semanticHash);
  assert.equal(inlineContextDatumEnvelope(record).value_mode, 'INLINE');
  assert.deepEqual(CONTEXT_VALUE_MODES, ['INLINE', 'AUTHORIZED_REFERENCE']);
});

test('canonical decimal, timestamps and set ordering are identity-stable', () => {
  const ledger = new AuthorityLedger();
  const a = publishAuthorized(ledger, 'ctx-canonical', '1', baseDatum({
    value: { type: 'set', items: [{ type: 'decimal', decimal: '0.3200' }, { type: 'decimal', decimal: '0.340' }] },
    effectiveInterval: { start: '2026-08-16T03:00:00+02:00', end: '2026-08-16T04:00:00+02:00' },
    uncertainty: { type: 'CATEGORICAL_SET', values: ['HIGH', 'LOW'] }
  }), principal, 'canonical-a');
  const b = publishAuthorized(ledger, 'ctx-canonical', '1', baseDatum({
    value: { type: 'set', items: [{ type: 'decimal', decimal: '0.34' }, { type: 'decimal', decimal: '0.32' }] },
    effectiveInterval: { start: '2026-08-16T01:00:00Z', end: '2026-08-16T02:00:00Z' },
    uncertainty: { type: 'CATEGORICAL_SET', values: ['LOW', 'HIGH'] }
  }), principal, 'canonical-b');
  assert.deepEqual(a.ref, b.ref);
});

const valueCases = [
  { type: 'decimal', decimal: '12.5' },
  { type: 'integer', integer: '12' },
  { type: 'boolean', boolean: true },
  { type: 'string', string: 'silty clay loam' },
  { type: 'category', category: 'MID' },
  { type: 'date', date: '2026-04-22' },
  { type: 'timestamp', timestamp: '2026-08-16T02:00:00Z' },
  { type: 'interval', lower: { type: 'decimal', decimal: '10' }, upper: { type: 'decimal', decimal: '20' } },
  { type: 'set', items: [{ type: 'category', category: 'A' }, { type: 'category', category: 'B' }] },
  { type: 'unknown', reasonCode: 'NOT_OBSERVED' }
];

test('supports every frozen ContextDatum value type without unsafe JS numeric coercion', () => {
  for (const [index, value] of valueCases.entries()) {
    const ledger = new AuthorityLedger();
    const record = publishAuthorized(ledger, `ctx-value-${index}`, '1', baseDatum({ value, unit: ['decimal', 'integer', 'interval'].includes(value.type) ? 'mm' : 'none' }));
    assert.equal(validateContextDatumAuthority({ ledger, contextDatumRef: record.ref }).semanticPayload.value.type, value.type);
  }
});

test('epistemic class is independent from provenance class', () => {
  const ledger = new AuthorityLedger();
  const grower = publishAuthorized(ledger, 'ctx-planting-grower', '1', baseDatum({
    semanticId: 'crop.planting_date', value: { type: 'date', date: '2026-04-22' }, unit: 'none', epistemicClass: 'ASSERTION', provenanceClass: 'CUSTOMER_SYSTEM'
  }));
  const machine = publishAuthorized(ledger, 'ctx-planting-machine', '1', baseDatum({
    semanticId: 'crop.planting_date', value: { type: 'date', date: '2026-04-22' }, unit: 'none', epistemicClass: 'OBSERVATION', provenanceClass: 'MACHINERY'
  }));
  assert.equal(grower.semanticPayload.epistemicClass, 'ASSERTION');
  assert.equal(machine.semanticPayload.epistemicClass, 'OBSERVATION');
  assert.notEqual(grower.ref.semanticHash, machine.ref.semanticHash);
});

for (const [label, override] of [
  ['semantic-id', { semanticId: 'soil.water.storage' }],
  ['value', { value: { type: 'decimal', decimal: '0.31' } }],
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
  const old = publishAuthorized(ledger, 'ctx-replay', '1', baseDatum({ value: { type: 'decimal', decimal: '0.30' } }), principal, 'replay-old');
  publishAuthorized(ledger, 'ctx-replay', '2', baseDatum({ value: { type: 'decimal', decimal: '0.35' } }), principal, 'replay-new');
  assert.equal(validateContextDatumAuthority({ ledger, contextDatumRef: old.ref }).semanticPayload.value.decimal, '0.3');
});

console.log('ContextDatum acceptance: 18 passed');
