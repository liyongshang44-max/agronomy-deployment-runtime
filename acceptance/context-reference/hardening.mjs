import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  ExactContextSnapshotStore,
  publishAuthorizedContextReference,
  validateAuthorizedContextReferenceAuthority,
  validateResolvedContextDatumReceiptAuthority
} from '../../packages/reference-resolution/src/index.mjs';
import {
  audit,
  freshLedger,
  principal,
  providerBytes,
  providerHash,
  publishDatum,
  publishReceipt,
  publishReference,
  referenceInput,
  target,
  writeAuthorization
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

test('mutable locator cannot self-assert CONTENT_ADDRESSED_EXTERNAL replay', () => {
  const ledger = freshLedger();
  const { recorded } = writeAuthorization(ledger, 'cr-fake-content-address', 'AUTHORIZED_CONTEXT_REFERENCE');
  assert.throws(
    () => publishAuthorizedContextReference({
      ledger,
      logicalId: 'cr-fake-content-address',
      version: '1',
      target,
      reference: referenceInput({
        addressingMode: 'CONTENT_ADDRESSED',
        expectedContentHash: providerHash,
        reference: { locator: '/field/1/state/vwc' }
      }),
      principal,
      authorizationDecisionAuditRef: recorded.ref,
      audit: audit()
    }),
    (error) => error?.code === 'CONTENT_ADDRESS_LOCATOR_NOT_BOUND'
  );
});

test('content-addressed locator accepts URL-encoded exact SHA-256 binding', () => {
  const ledger = freshLedger();
  const encoded = encodeURIComponent(providerHash);
  const record = publishReference(ledger, 'cr-encoded-content-address', referenceInput({
    addressingMode: 'CONTENT_ADDRESSED',
    expectedContentHash: providerHash,
    reference: { locator: `/objects/${encoded}` }
  }));
  assert.equal(validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: record.ref }).record.ref.semanticHash, record.ref.semanticHash);
});

test('signed provider URLs cannot carry cloud signature credentials into semantic identity', () => {
  for (const locator of [
    'https://example.test/state?X-Amz-Signature=abc',
    'https://example.test/state?X-Amz-Credential=abc',
    'https://example.test/state?X-Amz-Security-Token=abc',
    'https://example.test/state?X-Goog-Signature=abc'
  ]) {
    const ledger = freshLedger();
    const { recorded } = writeAuthorization(ledger, 'cr-signed-url', 'AUTHORIZED_CONTEXT_REFERENCE');
    assert.throws(
      () => publishAuthorizedContextReference({
        ledger,
        logicalId: 'cr-signed-url',
        version: '1',
        target,
        reference: referenceInput({ reference: { locator } }),
        principal,
        authorizationDecisionAuditRef: recorded.ref,
        audit: audit()
      }),
      (error) => error?.code === 'SECRET_AUTH_MATERIAL_FORBIDDEN'
    );
  }
});

test('provider principalScope is a closed non-secret semantic envelope', () => {
  for (const [key, expectedCode] of [
    ['sessionKey', 'SECRET_AUTH_MATERIAL_FORBIDDEN'],
    ['clientSecret', 'SECRET_AUTH_MATERIAL_FORBIDDEN'],
    ['region', 'INVALID_REFERENCE_RESOLUTION_FIELD']
  ]) {
    const ledger = freshLedger();
    const { recorded } = writeAuthorization(ledger, `cr-scope-${key}`, 'AUTHORIZED_CONTEXT_REFERENCE');
    assert.throws(
      () => publishAuthorizedContextReference({
        ledger,
        logicalId: `cr-scope-${key}`,
        version: '1',
        target,
        reference: referenceInput({
          authorizationContext: {
            principalScope: { organizationId: 'org-a', tenantId: 'tenant-a', [key]: 'opaque-value' }
          }
        }),
        principal,
        authorizationDecisionAuditRef: recorded.ref,
        audit: audit()
      }),
      (error) => error?.code === expectedCode
    );
  }
});

test('provider principalScope identifier sets canonicalize order but reject duplicates', () => {
  const a = freshLedger();
  const b = freshLedger();
  const refA = publishReference(a, 'cr-scope-order', referenceInput({
    authorizationContext: {
      principalScope: {
        organizationId: 'org-a', tenantId: 'tenant-a', fieldIds: ['field-b', 'field-a'], semanticIds: ['soil.vwc', 'crop.stage']
      }
    }
  }));
  const refB = publishReference(b, 'cr-scope-order', referenceInput({
    authorizationContext: {
      principalScope: {
        organizationId: 'org-a', tenantId: 'tenant-a', semanticIds: ['crop.stage', 'soil.vwc'], fieldIds: ['field-a', 'field-b']
      }
    }
  }));
  assert.equal(refA.ref.semanticHash, refB.ref.semanticHash);

  const ledger = freshLedger();
  const { recorded } = writeAuthorization(ledger, 'cr-scope-duplicate', 'AUTHORIZED_CONTEXT_REFERENCE');
  assert.throws(
    () => publishAuthorizedContextReference({
      ledger,
      logicalId: 'cr-scope-duplicate',
      version: '1',
      target,
      reference: referenceInput({ authorizationContext: { principalScope: { organizationId: 'org-a', fieldIds: ['field-a', 'field-a'] } } }),
      principal,
      authorizationDecisionAuditRef: recorded.ref,
      audit: audit()
    }),
    (error) => error?.code === 'DUPLICATE_AUTHORIZATION_SCOPE_ID'
  );
});

test('exact snapshot retention deduplicates identical bytes and returns defensive copies', () => {
  const store = new ExactContextSnapshotStore();
  const first = store.put(providerBytes);
  const second = store.put(providerBytes);
  assert.equal(first.retentionRef, second.retentionRef);
  assert.equal(store.count(), 1);
  const read = store.get(first.retentionRef);
  read[0] = read[0] ^ 0xff;
  assert.deepEqual(store.get(first.retentionRef), providerBytes);
});

function forgeExactReceipt(ledger, { extraRetention = {}, byteLength = providerBytes.byteLength } = {}) {
  const reference = publishReference(ledger, 'cr-retention-forge');
  const datum = publishDatum(ledger, 'cd-retention-forge');
  const store = new ExactContextSnapshotStore();
  store.put(providerBytes);
  const { recorded } = writeAuthorization(ledger, 'rcr-retention-forge', 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  const payload = {
    contractVersion: 'adr.context-receipt.v1',
    referenceRef: reference.ref,
    referenceHash: reference.ref.semanticHash,
    resolvedContextDatumRef: datum.ref,
    normalizedContextDatumHash: datum.ref.semanticHash,
    resolvedAt: '2026-08-16T02:03:00.000Z',
    effectiveAt: '2026-08-16T02:00:00.000Z',
    availableAt: '2026-08-16T02:01:00.000Z',
    authorizationContextHash: reference.semanticPayload.authorizationContext.authorizationHash,
    providerResponseHash: providerHash,
    retention: {
      mode: 'SNAPSHOT_RETAINED',
      retentionRef: providerHash,
      storeKind: 'ADR_CONTROLLED_CONTENT_ADDRESSABLE_SNAPSHOT',
      byteLength,
      ...extraRetention
    },
    replayClass: 'EXACT'
  };
  const receipt = ledger.publish({
    kind: 'ResolvedContextDatumReceipt',
    logicalId: 'rcr-retention-forge',
    version: '1',
    semanticPayload: payload,
    audit: {
      ...audit(),
      action: 'PUBLISH_RESOLVED_CONTEXT_DATUM_RECEIPT',
      inputRefs: [reference.ref, datum.ref, recorded.ref],
      details: {
        creationPrincipal: principal,
        targetScope: target,
        authorizationDecisionAuditRef: recorded.ref
      }
    }
  });
  return { receipt, store };
}

test('EXACT receipt cannot hide extra retention semantics', () => {
  const ledger = freshLedger();
  const { receipt, store } = forgeExactReceipt(ledger, { extraRetention: { opaqueLocator: 'somewhere-else' } });
  assert.throws(
    () => validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref, snapshotStore: store }),
    (error) => error?.code === 'INVALID_REFERENCE_RESOLUTION_FIELD'
  );
});

test('EXACT receipt byteLength must match retained provider bytes', () => {
  const ledger = freshLedger();
  const { receipt, store } = forgeExactReceipt(ledger, { byteLength: providerBytes.byteLength + 1 });
  assert.throws(
    () => validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref, snapshotStore: store }),
    (error) => error?.code === 'EXACT_REPLAY_CONTENT_MISMATCH'
  );
});

test('legitimate EXACT receipt passes hardened retention proof', () => {
  const ledger = new AuthorityLedger();
  const store = new ExactContextSnapshotStore();
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-hardened-exact', retainSnapshot: true, snapshotStore: store });
  assert.equal(
    validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref, snapshotStore: store }).receipt.ref.semanticHash,
    receipt.ref.semanticHash
  );
});

console.log(`Context reference/resolution hardening acceptance: ${passed} passed`);
