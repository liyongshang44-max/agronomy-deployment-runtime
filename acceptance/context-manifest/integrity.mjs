import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { PERMISSIONS, recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { ExactContextSnapshotStore } from '../../packages/reference-resolution/src/index.mjs';
import { publishContextManifest, validateContextManifestAuthority } from '../../packages/context-manifest/src/index.mjs';
import {
  audit,
  datumInput,
  freshLedger,
  principal,
  publishDatum,
  publishManifest,
  publishProblem,
  publishResolvedPair,
  targetRef,
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

test('ContextManifest requires at least one exact ContextDatum member', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const { recorded } = writeAuthorization(ledger, 'cm-empty', 'CONTEXT_MANIFEST');
  assert.throws(
    () => publishContextManifest({
      ledger, logicalId: 'cm-empty', version: '1', decisionProblemRef: problem.ref,
      evidenceCutoff: '2026-08-16T02:05:00Z', datumRefs: [], principal,
      authorizationDecisionAuditRef: recorded.ref, audit: audit()
    }),
    (error) => error?.code === 'INVALID_CONTEXT_MANIFEST_MEMBERSHIP'
  );
});

test('ContextManifest rejects duplicate exact datum and receipt refs', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'dupe' });
  for (const args of [
    { datumRefs: [pair.datum.ref, pair.datum.ref], receiptRefs: [pair.receipt.ref] },
    { datumRefs: [pair.datum.ref], receiptRefs: [pair.receipt.ref, pair.receipt.ref] }
  ]) {
    assert.throws(
      () => publishManifest(ledger, { logicalId: `cm-dupe-${Math.random()}`, decisionProblem: problem, ...args }),
      (error) => error?.code === 'DUPLICATE_CONTEXT_MANIFEST_MEMBER'
    );
  }
});

test('AuthorizedContextReference cannot enter manifest as a resolved receipt', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'wrong-kind' });
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-wrong-kind', decisionProblem: problem,
      datumRefs: [pair.datum.ref], receiptRefs: [pair.reference.ref]
    }),
    (error) => error?.code === 'INVALID_CONTEXT_MANIFEST_MEMBER_KIND'
  );
});

test('receipt cannot enter manifest without its exact resolved ContextDatum member', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'missing-datum' });
  const unrelated = publishDatum(ledger, 'cd-unrelated');
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-missing-receipt-datum', decisionProblem: problem,
      datumRefs: [unrelated.ref], receiptRefs: [pair.receipt.ref]
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_RECEIPT_DATUM_MISSING'
  );
});

test('datum available after evidenceCutoff cannot enter manifest', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const late = publishDatum(ledger, 'cd-late', datumInput({ availableAt: '2026-08-16T02:06:00Z' }));
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-late-datum', decisionProblem: problem, datumRefs: [late.ref], evidenceCutoff: '2026-08-16T02:05:00Z'
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_EVIDENCE_AFTER_CUTOFF'
  );
});

test('receipt resolved after evidenceCutoff cannot enter manifest', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'late-receipt', resolvedAt: '2026-08-16T02:07:00Z' });
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-late-receipt', decisionProblem: problem, datumRefs: [pair.datum.ref], receiptRefs: [pair.receipt.ref], evidenceCutoff: '2026-08-16T02:05:00Z'
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_EVIDENCE_AFTER_CUTOFF'
  );
});

test('manifest publication time cannot precede evidenceCutoff', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-time-travel', decisionProblem: problem, datumRefs: [datum.ref],
      evidenceCutoff: '2026-08-16T02:05:00Z', auditOccurredAt: '2026-08-16T02:04:59Z'
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_CREATED_BEFORE_CUTOFF'
  );
});

test('ContextManifest publisher must match DecisionProblem organization/tenant', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const foreign = { ...principal, tenantId: 'tenant-b' };
  assert.throws(
    () => publishManifest(ledger, { logicalId: 'cm-foreign', decisionProblem: problem, datumRefs: [datum.ref], actor: foreign }),
    (error) => error?.code === 'CONTEXT_MANIFEST_TARGET_SCOPE_DENIED'
  );
});

test('ContextDatum from another tenant cannot enter a manifest even with a same-id principal', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const foreignPrincipal = { ...principal, tenantId: 'tenant-b' };
  const foreignDatum = publishDatum(ledger, 'cd-foreign', undefined, foreignPrincipal);
  assert.throws(
    () => publishManifest(ledger, { logicalId: 'cm-foreign-datum', decisionProblem: problem, datumRefs: [foreignDatum.ref] }),
    (error) => error?.code === 'CONTEXT_MANIFEST_DATUM_TARGET_MISMATCH'
  );
});

test('decision.problem.create permission cannot substitute for ContextManifest context.write', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const { decision } = writeAuthorization(ledger, 'cm-wrong-permission', 'CONTEXT_MANIFEST', principal, {
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE], expectAllowed: false
  });
  assert.equal(decision.allowed, false);
  const denied = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'denied') });
  assert.throws(
    () => publishContextManifest({
      ledger, logicalId: 'cm-wrong-permission', version: '1', decisionProblemRef: problem.ref,
      evidenceCutoff: '2026-08-16T02:05:00Z', datumRefs: [datum.ref], principal,
      authorizationDecisionAuditRef: denied.ref, audit: audit()
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('ContextManifest write authorization is bound to exact logical id', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const { recorded } = writeAuthorization(ledger, 'cm-authorized-a', 'CONTEXT_MANIFEST');
  assert.throws(
    () => publishContextManifest({
      ledger, logicalId: 'cm-unauthorized-b', version: '1', decisionProblemRef: problem.ref,
      evidenceCutoff: '2026-08-16T02:05:00Z', datumRefs: [datum.ref], principal,
      authorizationDecisionAuditRef: recorded.ref, audit: audit()
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('publication audit actor cannot impersonate manifest creator', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const { recorded } = writeAuthorization(ledger, 'cm-audit-actor', 'CONTEXT_MANIFEST');
  const foreignActor = { ...principal, principalId: 'other-service' };
  assert.throws(
    () => publishContextManifest({
      ledger, logicalId: 'cm-audit-actor', version: '1', decisionProblemRef: problem.ref,
      evidenceCutoff: '2026-08-16T02:05:00Z', datumRefs: [datum.ref], principal,
      authorizationDecisionAuditRef: recorded.ref, audit: audit(foreignActor)
    }),
    (error) => error?.code === 'CONTEXT_MANIFEST_AUDIT_ACTOR_MISMATCH'
  );
});

test('EXACT receipt cannot enter/validate manifest when retained provider bytes are unavailable', () => {
  const ledger = freshLedger();
  const store = new ExactContextSnapshotStore();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'lost-exact', retainSnapshot: true, snapshotStore: store });
  assert.throws(
    () => publishManifest(ledger, {
      logicalId: 'cm-lost-exact', decisionProblem: problem, datumRefs: [pair.datum.ref], receiptRefs: [pair.receipt.ref],
      snapshotStore: new ExactContextSnapshotStore()
    }),
    (error) => error?.code === 'EXACT_REPLAY_NOT_PROVABLE'
  );
});

test('same logical/version manifest cannot be rewritten with changed membership', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const a = publishDatum(ledger, 'cd-immutable-a');
  const b = publishDatum(ledger, 'cd-immutable-b');
  publishManifest(ledger, { logicalId: 'cm-immutable', version: '1', decisionProblem: problem, datumRefs: [a.ref] });
  assert.throws(
    () => publishManifest(ledger, { logicalId: 'cm-immutable', version: '1', decisionProblem: problem, datumRefs: [b.ref] }),
    (error) => error?.code === 'SEMANTIC_MUTATION_FORBIDDEN'
  );
});

test('generic-ledger forged ContextDatum cannot enter a valid ContextManifest', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const templateLedger = freshLedger();
  const template = publishDatum(templateLedger, 'cd-template');
  const forged = ledger.publish({
    kind: 'ContextDatum', logicalId: 'cd-forged', version: '1',
    semanticPayload: { ...template.semanticPayload, datumId: 'cd-forged' },
    audit: { ...audit(), action: 'PUBLISH_CONTEXT_DATUM', inputRefs: [] }
  });
  assert.throws(
    () => publishManifest(ledger, { logicalId: 'cm-forged-datum', decisionProblem: problem, datumRefs: [forged.ref] }),
    (error) => ['CONTEXT_DATUM_AUDIT_INVALID', 'CONTEXT_DATUM_SEMANTICS_INVALID'].includes(error?.code)
  );
});

test('generic-ledger forged manifest with copied vocabulary cannot become authority', () => {
  const ledger = freshLedger();
  const valid = publishManifest(ledger, { logicalId: 'cm-valid-for-template' });
  const forgedPayload = { ...valid.semanticPayload, evidenceCutoff: '2026-08-16T02:04:00.000Z' };
  const forged = ledger.publish({
    kind: 'ContextManifest', logicalId: 'cm-forged', version: '1', semanticPayload: forgedPayload,
    audit: {
      ...audit(), action: 'PUBLISH_CONTEXT_MANIFEST', inputRefs: [forgedPayload.decisionProblemRef, ...forgedPayload.datumRefs],
      details: { creationPrincipal: principal, targetScope: targetRef, replayClass: forgedPayload.replayClass }
    }
  });
  assert.throws(
    () => validateContextManifestAuthority({ ledger, contextManifestRef: forged.ref }),
    (error) => ['CONTEXT_MANIFEST_SEMANTICS_INVALID', 'CONTEXT_MANIFEST_AUDIT_INVALID', 'CONTEXT_MANIFEST_EVIDENCE_AFTER_CUTOFF'].includes(error?.code)
  );
});

test('hidden extra audit input ref invalidates forged ContextManifest publication authority', () => {
  const ledger = freshLedger();
  const valid = publishManifest(ledger, { logicalId: 'cm-input-set-template' });
  const extra = ledger.publish({ kind: 'RuntimeResult', logicalId: 'runtime-extra', version: '1', semanticPayload: { status: 'opaque' }, audit: audit() });
  const payload = valid.semanticPayload;
  const { recorded } = writeAuthorization(ledger, 'cm-hidden-input', 'CONTEXT_MANIFEST');
  const forged = ledger.publish({
    kind: 'ContextManifest', logicalId: 'cm-hidden-input', version: '1', semanticPayload: payload,
    audit: {
      ...audit(),
      action: 'PUBLISH_CONTEXT_MANIFEST',
      inputRefs: [payload.decisionProblemRef, ...payload.datumRefs, ...payload.resolvedReferenceReceiptRefs, recorded.ref, extra.ref],
      details: { creationPrincipal: principal, targetScope: targetRef, authorizationDecisionAuditRef: recorded.ref, replayClass: payload.replayClass }
    }
  });
  assert.throws(
    () => validateContextManifestAuthority({ ledger, contextManifestRef: forged.ref }),
    (error) => error?.code === 'CONTEXT_MANIFEST_AUDIT_INVALID'
  );
});

console.log(`ContextManifest integrity acceptance: ${passed} passed`);
