import assert from 'node:assert/strict';
import {
  REFERENCE_ADDRESSING_MODES,
  REPLAY_CLASSES,
  ExactContextSnapshotStore,
  materializePublicAuthorizedContextReference,
  materializePublicResolvedContextDatumReceipt,
  providerResponseContentHash,
  validateAuthorizedContextReferenceAuthority,
  validateResolvedContextDatumReceiptAuthority
} from '../../packages/reference-resolution/src/index.mjs';
import {
  datumInput,
  freshLedger,
  principal,
  providerBytes,
  providerHash,
  publishDatum,
  publishReceipt,
  publishReference,
  referenceInput
} from './fixtures.mjs';

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

test('publishes AuthorizedContextReference with non-secret authorization-context identity', () => {
  const ledger = freshLedger();
  const record = publishReference(ledger);
  const validated = validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: record.ref });
  assert.equal(validated.semanticPayload.valueMode, 'AUTHORIZED_REFERENCE');
  assert.match(validated.semanticPayload.authorizationContext.authorizationHash, /^sha256:[0-9a-f]{64}$/);
  const wire = materializePublicAuthorizedContextReference(record);
  assert.equal(wire.contract_version, 'adr.authorized-context-reference.v1');
  assert.equal(wire.reference_id, 'cr-1');
  assert.equal(wire.authorization_context.connection_id, 'conn-customer-a');
  assert.equal('token' in wire.authorization_context, false);
});

test('provider authorization hash is canonical over non-secret connection + principal scope', () => {
  const a = freshLedger();
  const b = freshLedger();
  const refA = publishReference(a, 'cr-auth', referenceInput({
    authorizationContext: { principalScope: { tenantId: 'tenant-a', organizationId: 'org-a', fieldIds: ['field-1'] } }
  }));
  const refB = publishReference(b, 'cr-auth', referenceInput({
    authorizationContext: { principalScope: { organizationId: 'org-a', fieldIds: ['field-1'], tenantId: 'tenant-a' } }
  }));
  assert.equal(refA.semanticPayload.authorizationContext.authorizationHash, refB.semanticPayload.authorizationContext.authorizationHash);
  assert.equal(refA.ref.semanticHash, refB.ref.semanticHash);
});

test('EXACT replay exists only when exact provider response bytes are retained', () => {
  const ledger = freshLedger();
  const store = new ExactContextSnapshotStore();
  const result = publishReceipt(ledger, { retainSnapshot: true, snapshotStore: store });
  assert.equal(result.receipt.semanticPayload.replayClass, 'EXACT');
  assert.equal(result.receipt.semanticPayload.retention.mode, 'SNAPSHOT_RETAINED');
  assert.equal(store.count(), 1);
  const validated = validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: result.receipt.ref, snapshotStore: store });
  assert.equal(validated.receipt.semanticPayload.providerResponseHash, providerHash);
  assert.deepEqual(store.get(providerHash), providerBytes);
});

test('CONTENT_ADDRESSED_EXTERNAL requires exact expected provider response hash', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-content', referenceInput({
    addressingMode: 'CONTENT_ADDRESSED',
    expectedContentHash: providerHash
  }));
  const datum = publishDatum(ledger, 'cd-content');
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-content', reference, datum });
  assert.equal(receipt.semanticPayload.replayClass, 'CONTENT_ADDRESSED_EXTERNAL');
  assert.equal(receipt.semanticPayload.retention.mode, 'EXTERNAL_CONTENT_ADDRESS');
  validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref });
});

test('VERSIONED_LOCATOR without retained bytes is truthfully PROVIDER_DEPENDENT', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-versioned', referenceInput({
    addressingMode: 'VERSIONED_LOCATOR',
    versionToken: 'provider-version-42'
  }));
  const datum = publishDatum(ledger, 'cd-versioned');
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-versioned', reference, datum });
  assert.equal(receipt.semanticPayload.replayClass, 'PROVIDER_DEPENDENT');
  validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref });
});

test('mutable non-retained provider reference is truthfully NON_REPLAYABLE', () => {
  const ledger = freshLedger();
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-mutable' });
  assert.equal(receipt.semanticPayload.replayClass, 'NON_REPLAYABLE');
  assert.equal(receipt.semanticPayload.retention.mode, 'NOT_RETAINED');
  validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref });
});

test('all four frozen ReplayClass values are represented by governed resolution evidence', () => {
  assert.deepEqual(REPLAY_CLASSES, [
    'EXACT', 'CONTENT_ADDRESSED_EXTERNAL', 'PROVIDER_DEPENDENT', 'NON_REPLAYABLE'
  ]);
  assert.deepEqual(REFERENCE_ADDRESSING_MODES, [
    'MUTABLE_LOCATOR', 'VERSIONED_LOCATOR', 'CONTENT_ADDRESSED'
  ]);
});

test('receipt freezes exact reference, ContextDatum and chronology hashes', () => {
  const ledger = freshLedger();
  const { receipt, reference, datum } = publishReceipt(ledger, { receiptId: 'rcr-bindings' });
  assert.deepEqual(receipt.semanticPayload.referenceRef, reference.ref);
  assert.equal(receipt.semanticPayload.referenceHash, reference.ref.semanticHash);
  assert.deepEqual(receipt.semanticPayload.resolvedContextDatumRef, datum.ref);
  assert.equal(receipt.semanticPayload.normalizedContextDatumHash, datum.ref.semanticHash);
  assert.equal(receipt.semanticPayload.availableAt, datum.semanticPayload.availableAt);
  assert.equal(receipt.semanticPayload.providerResponseHash, providerHash);
});

test('public receipt reports what was actually read without provider credentials', () => {
  const ledger = freshLedger();
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-wire' });
  const wire = materializePublicResolvedContextDatumReceipt(receipt);
  assert.equal(wire.contract_version, 'adr.context-receipt.v1');
  assert.equal(wire.receipt_id, 'rcr-wire');
  assert.equal(wire.provider_response_hash, providerHash);
  assert.equal(wire.normalized_context_datum_hash, receipt.semanticPayload.normalizedContextDatumHash);
  assert.equal(wire.replay_class, 'NON_REPLAYABLE');
  assert.equal('authorization_token' in wire, false);
});

test('later provider/reference versions do not rewrite historical exact receipt', () => {
  const ledger = freshLedger();
  const store = new ExactContextSnapshotStore();
  const oldReference = publishReference(ledger, 'cr-history', referenceInput(), principal, '1');
  const oldDatum = publishDatum(ledger, 'cd-history-old');
  const old = publishReceipt(ledger, {
    receiptId: 'rcr-history',
    reference: oldReference,
    datum: oldDatum,
    retainSnapshot: true,
    snapshotStore: store,
    version: '1'
  }).receipt;

  const newBytes = Buffer.from('{"vwc":"0.40","available_at":"2026-08-16T02:01:00Z"}', 'utf8');
  const newHash = providerResponseContentHash(newBytes);
  const newReference = publishReference(ledger, 'cr-history', referenceInput({
    reference: { locator: '/field/1/state/vwc?revision=2' }
  }), principal, '2');
  const newDatum = publishDatum(ledger, 'cd-history-new', datumInput({
    value: { type: 'DECIMAL', decimal: '0.4' },
    source: { providerId: 'customer-context-api', sourceRef: 'field/1/vwc/revision/2', contentHash: newHash }
  }));
  publishReceipt(ledger, {
    receiptId: 'rcr-history',
    reference: newReference,
    datum: newDatum,
    bytes: newBytes,
    retainSnapshot: true,
    snapshotStore: store,
    version: '2'
  });
  const historical = validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: old.ref, snapshotStore: store });
  assert.equal(historical.receipt.semanticPayload.providerResponseHash, providerHash);
});

console.log(`Context reference/resolution acceptance: ${passed} passed`);
