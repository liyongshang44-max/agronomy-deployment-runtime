import assert from 'node:assert/strict';
import { PERMISSIONS } from '../../packages/authorization/src/index.mjs';
import {
  ExactContextSnapshotStore,
  publishAuthorizedContextReference,
  publishResolvedContextDatumReceipt,
  validateAuthorizedContextReferenceAuthority,
  validateResolvedContextDatumReceiptAuthority
} from '../../packages/reference-resolution/src/index.mjs';
import {
  audit,
  datumInput,
  freshLedger,
  principal,
  providerBytes,
  providerHash,
  publishDatum,
  publishReceipt,
  publishReference,
  referenceInput,
  resolutionTimes,
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

test('provider bearer/API credentials cannot enter reference semantic identity', () => {
  for (const input of [
    referenceInput({ authorizationContext: { principalScope: { organizationId: 'org-a', token: 'secret' } } }),
    referenceInput({ reference: { locator: 'https://example.test/state?access_token=secret' } }),
    referenceInput({ reference: { locator: 'https://user:pass@example.test/state' } })
  ]) {
    const ledger = freshLedger();
    const { recorded } = writeAuthorization(ledger, 'cr-secret', 'AUTHORIZED_CONTEXT_REFERENCE');
    assert.throws(
      () => publishAuthorizedContextReference({ ledger, logicalId: 'cr-secret', version: '1', target, reference: input, principal, authorizationDecisionAuditRef: recorded.ref, audit: audit() }),
      (error) => error?.code === 'SECRET_AUTH_MATERIAL_FORBIDDEN'
    );
  }
});

test('caller-supplied authorizationHash must equal non-secret canonical authorization context', () => {
  const ledger = freshLedger();
  const { recorded } = writeAuthorization(ledger, 'cr-auth-hash', 'AUTHORIZED_CONTEXT_REFERENCE');
  assert.throws(
    () => publishAuthorizedContextReference({
      ledger,
      logicalId: 'cr-auth-hash',
      version: '1',
      target,
      reference: referenceInput({ authorizationContext: { authorizationHash: `sha256:${'0'.repeat(64)}` } }),
      principal,
      authorizationDecisionAuditRef: recorded.ref,
      audit: audit()
    }),
    (error) => error?.code === 'AUTHORIZATION_CONTEXT_HASH_MISMATCH'
  );
});

test('VERSIONED_LOCATOR requires versionToken and CONTENT_ADDRESSED requires expectedContentHash', () => {
  for (const reference of [
    referenceInput({ addressingMode: 'VERSIONED_LOCATOR' }),
    referenceInput({ addressingMode: 'CONTENT_ADDRESSED' })
  ]) {
    const ledger = freshLedger();
    const { recorded } = writeAuthorization(ledger, 'cr-addressing', 'AUTHORIZED_CONTEXT_REFERENCE');
    assert.throws(
      () => publishAuthorizedContextReference({ ledger, logicalId: 'cr-addressing', version: '1', target, reference, principal, authorizationDecisionAuditRef: recorded.ref, audit: audit() }),
      (error) => ['REFERENCE_VERSION_TOKEN_REQUIRED', 'REFERENCE_CONTENT_HASH_REQUIRED'].includes(error?.code)
    );
  }
});

test('content-addressed reference cannot accept provider bytes with a different hash', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-bad-hash', referenceInput({
    addressingMode: 'CONTENT_ADDRESSED', expectedContentHash: `sha256:${'1'.repeat(64)}`
  }));
  const datum = publishDatum(ledger, 'cd-bad-hash');
  assert.throws(
    () => publishReceipt(ledger, { receiptId: 'rcr-bad-hash', reference, datum }),
    (error) => error?.code === 'EXPECTED_CONTENT_HASH_MISMATCH'
  );
});

test('resolved ContextDatum semantic id must equal AuthorizedContextReference semantic id', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-semantic');
  const datum = publishDatum(ledger, 'cd-semantic', datumInput({ semanticId: 'weather.precipitation' }));
  assert.throws(
    () => publishReceipt(ledger, { receiptId: 'rcr-semantic', reference, datum }),
    (error) => error?.code === 'RESOLVED_SEMANTIC_ID_MISMATCH'
  );
});

test('resolved ContextDatum provider and response hash must bind the exact provider response', () => {
  for (const source of [
    { providerId: 'other-provider', sourceRef: 'field/1/vwc', contentHash: providerHash },
    { providerId: 'customer-context-api', sourceRef: 'field/1/vwc', contentHash: `sha256:${'2'.repeat(64)}` }
  ]) {
    const ledger = freshLedger();
    const reference = publishReference(ledger, 'cr-source-binding');
    const datum = publishDatum(ledger, 'cd-source-binding', datumInput({ source }));
    assert.throws(
      () => publishReceipt(ledger, { receiptId: 'rcr-source-binding', reference, datum }),
      (error) => ['RESOLVED_PROVIDER_MISMATCH', 'RESOLVED_CONTENT_HASH_MISMATCH'].includes(error?.code)
    );
  }
});

test('receipt chronology must match ContextDatum support and availability', () => {
  for (const resolution of [
    resolutionTimes({ availableAt: '2026-08-16T02:02:00Z' }),
    resolutionTimes({ effectiveAt: '2026-08-16T03:00:00Z' }),
    resolutionTimes({ resolvedAt: '2026-08-16T02:00:00Z' })
  ]) {
    const ledger = freshLedger();
    assert.throws(
      () => publishReceipt(ledger, { receiptId: 'rcr-time', resolution }),
      (error) => [
        'RESOLUTION_AVAILABLE_TIME_MISMATCH',
        'RESOLUTION_EFFECTIVE_TIME_MISMATCH',
        'RESOLUTION_CHRONOLOGY_INVALID'
      ].includes(error?.code)
    );
  }
});

test('reference cannot satisfy receipt authority merely by existing', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-only');
  assert.throws(
    () => validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: reference.ref }),
    (error) => error?.code === 'RESOLVED_CONTEXT_DATUM_RECEIPT_REQUIRED'
  );
});

test('EXACT replay validation fails closed when retained bytes are unavailable', () => {
  const ledger = freshLedger();
  const store = new ExactContextSnapshotStore();
  const { receipt } = publishReceipt(ledger, { receiptId: 'rcr-exact-missing', retainSnapshot: true, snapshotStore: store });
  assert.throws(
    () => validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: receipt.ref, snapshotStore: new ExactContextSnapshotStore() }),
    (error) => error?.code === 'EXACT_REPLAY_NOT_PROVABLE'
  );
});

test('reference write authorization is bound to exact resource type and logical id', () => {
  const ledger = freshLedger();
  const { recorded: wrongType } = writeAuthorization(ledger, 'cr-scope', 'CONTEXT_DATUM');
  assert.throws(
    () => publishAuthorizedContextReference({ ledger, logicalId: 'cr-scope', version: '1', target, reference: referenceInput(), principal, authorizationDecisionAuditRef: wrongType.ref, audit: audit() }),
    (error) => error?.code === 'CONTEXT_WRITE_AUTHORIZATION_MISMATCH'
  );
  const { recorded: wrongId } = writeAuthorization(ledger, 'cr-other', 'AUTHORIZED_CONTEXT_REFERENCE');
  assert.throws(
    () => publishAuthorizedContextReference({ ledger, logicalId: 'cr-scope', version: '1', target, reference: referenceInput(), principal, authorizationDecisionAuditRef: wrongId.ref, audit: audit() }),
    (error) => error?.code === 'CONTEXT_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('receipt write authorization is bound to receipt resource type and exact logical id', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-receipt-auth');
  const datum = publishDatum(ledger, 'cd-receipt-auth');
  const { recorded } = writeAuthorization(ledger, 'rcr-other', 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  assert.throws(
    () => publishResolvedContextDatumReceipt({
      ledger,
      logicalId: 'rcr-auth',
      version: '1',
      referenceRef: reference.ref,
      normalizedContextDatumRef: datum.ref,
      providerResponseBytes: providerBytes,
      resolution: resolutionTimes(),
      principal,
      authorizationDecisionAuditRef: recorded.ref,
      audit: audit()
    }),
    (error) => error?.code === 'CONTEXT_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('decision.problem.create cannot substitute for context.write in A03', () => {
  const ledger = freshLedger();
  const { decision } = writeAuthorization(ledger, 'cr-wrong-permission', 'AUTHORIZED_CONTEXT_REFERENCE', principal, {
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE], expectAllowed: false
  });
  assert.equal(decision.allowed, false);
  assert(decision.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('foreign tenant cannot publish AuthorizedContextReference for another tenant', () => {
  const foreign = { ...principal, tenantId: 'tenant-b' };
  const ledger = freshLedger();
  const { recorded } = writeAuthorization(ledger, 'cr-foreign', 'AUTHORIZED_CONTEXT_REFERENCE', foreign);
  assert.throws(
    () => publishAuthorizedContextReference({ ledger, logicalId: 'cr-foreign', version: '1', target, reference: referenceInput(), principal: foreign, authorizationDecisionAuditRef: recorded.ref, audit: audit(foreign) }),
    (error) => error?.code === 'AUTHORIZED_REFERENCE_TARGET_SCOPE_DENIED'
  );
});

test('generic-ledger forged reference with copied audit vocabulary is rejected', () => {
  const ledger = freshLedger();
  const templateLedger = freshLedger();
  const template = publishReference(templateLedger, 'cr-template');
  const forged = ledger.publish({
    kind: 'AuthorizedContextReference',
    logicalId: 'cr-forged',
    version: '1',
    semanticPayload: template.semanticPayload,
    audit: {
      ...audit(),
      action: 'PUBLISH_AUTHORIZED_CONTEXT_REFERENCE',
      inputRefs: [],
      details: { creationPrincipal: principal, targetScope: target }
    }
  });
  assert.throws(
    () => validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: forged.ref }),
    (error) => error?.code === 'AUTHORIZED_REFERENCE_AUDIT_INVALID'
  );
});

test('generic-ledger forged receipt cannot overclaim EXACT replay', () => {
  const ledger = freshLedger();
  const reference = publishReference(ledger, 'cr-forged-receipt');
  const datum = publishDatum(ledger, 'cd-forged-receipt');
  const forgedPayload = {
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
    retention: { mode: 'NOT_RETAINED' },
    replayClass: 'EXACT'
  };
  const forged = ledger.publish({
    kind: 'ResolvedContextDatumReceipt',
    logicalId: 'rcr-forged',
    version: '1',
    semanticPayload: forgedPayload,
    audit: { ...audit(), action: 'PUBLISH_RESOLVED_CONTEXT_DATUM_RECEIPT', inputRefs: [reference.ref, datum.ref] }
  });
  assert.throws(
    () => validateResolvedContextDatumReceiptAuthority({ ledger, receiptRef: forged.ref, snapshotStore: new ExactContextSnapshotStore() }),
    (error) => ['EXACT_REPLAY_NOT_PROVABLE', 'CONTEXT_RECEIPT_AUDIT_INVALID'].includes(error?.code)
  );
});

console.log(`Context reference/resolution integrity acceptance: ${passed} passed`);
