import assert from 'node:assert/strict';
import { ExactContextSnapshotStore } from '../../packages/reference-resolution/src/index.mjs';
import {
  CONTEXT_MANIFEST_REPLAY_CLASSES,
  materializePublicContextManifest,
  targetContextSnapshot,
  validateContextManifestAuthority
} from '../../packages/context-manifest/src/index.mjs';
import {
  datumInput,
  freshLedger,
  problemInput,
  publishDatum,
  publishManifest,
  publishProblem,
  publishResolvedPair
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

test('publishes immutable ContextManifest bound to exact DecisionProblem-derived target world', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const manifest = publishManifest(ledger, { decisionProblem: problem, datumRefs: [datum.ref] });
  const validated = validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref });
  assert.deepEqual(validated.semanticPayload.decisionProblemRef, problem.ref);
  assert.deepEqual(validated.semanticPayload.targetRef, problem.semanticPayload.targetRef);
  assert.equal(validated.semanticPayload.logicalTime, problem.semanticPayload.logicalTime);
  assert.equal(validated.semanticPayload.evidenceCutoff, '2026-08-16T02:05:00.000Z');
  assert.equal(validated.semanticPayload.replayClass, 'EXACT');
});

test('inline-only ContextManifest is EXACT because normalized datum authority is retained exactly', () => {
  const ledger = freshLedger();
  const manifest = publishManifest(ledger);
  assert.equal(validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref }).semanticPayload.replayClass, 'EXACT');
});

test('EXACT receipt preserves EXACT manifest replay only with retained provider bytes', () => {
  const ledger = freshLedger();
  const store = new ExactContextSnapshotStore();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'exact', retainSnapshot: true, snapshotStore: store });
  const manifest = publishManifest(ledger, {
    logicalId: 'cm-exact',
    decisionProblem: problem,
    datumRefs: [pair.datum.ref],
    receiptRefs: [pair.receipt.ref],
    snapshotStore: store
  });
  assert.equal(validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref, snapshotStore: store }).semanticPayload.replayClass, 'EXACT');
});

test('CONTENT_ADDRESSED_EXTERNAL receipt conservatively sets manifest replay class', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'content', addressingMode: 'CONTENT_ADDRESSED' });
  const manifest = publishManifest(ledger, {
    logicalId: 'cm-content', decisionProblem: problem, datumRefs: [pair.datum.ref], receiptRefs: [pair.receipt.ref]
  });
  assert.equal(validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref }).semanticPayload.replayClass, 'CONTENT_ADDRESSED_EXTERNAL');
});

test('PROVIDER_DEPENDENT receipt conservatively sets manifest replay class', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const pair = publishResolvedPair(ledger, { suffix: 'versioned', addressingMode: 'VERSIONED_LOCATOR', versionToken: 'v42' });
  const manifest = publishManifest(ledger, {
    logicalId: 'cm-versioned', decisionProblem: problem, datumRefs: [pair.datum.ref], receiptRefs: [pair.receipt.ref]
  });
  assert.equal(validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref }).semanticPayload.replayClass, 'PROVIDER_DEPENDENT');
});

test('NON_REPLAYABLE receipt dominates manifest replay classification', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const store = new ExactContextSnapshotStore();
  const exact = publishResolvedPair(ledger, { suffix: 'mixed-exact', retainSnapshot: true, snapshotStore: store });
  const mutable = publishResolvedPair(ledger, { suffix: 'mixed-mutable' });
  const manifest = publishManifest(ledger, {
    logicalId: 'cm-mixed',
    decisionProblem: problem,
    datumRefs: [exact.datum.ref, mutable.datum.ref],
    receiptRefs: [exact.receipt.ref, mutable.receipt.ref],
    snapshotStore: store
  });
  assert.equal(validateContextManifestAuthority({ ledger, contextManifestRef: manifest.ref, snapshotStore: store }).semanticPayload.replayClass, 'NON_REPLAYABLE');
});

test('manifest replay class vocabulary is frozen and ordered from strongest to weakest', () => {
  assert.deepEqual(CONTEXT_MANIFEST_REPLAY_CLASSES, [
    'EXACT', 'CONTENT_ADDRESSED_EXTERNAL', 'PROVIDER_DEPENDENT', 'NON_REPLAYABLE'
  ]);
});

test('datum and receipt membership ordering does not perturb manifest semantic identity', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const a = publishResolvedPair(ledger, { suffix: 'order-a' });
  const b = publishResolvedPair(ledger, { suffix: 'order-b' });
  const first = publishManifest(ledger, {
    logicalId: 'cm-order', version: '1', decisionProblem: problem,
    datumRefs: [a.datum.ref, b.datum.ref], receiptRefs: [a.receipt.ref, b.receipt.ref]
  });
  const retry = publishManifest(ledger, {
    logicalId: 'cm-order', version: '1', decisionProblem: problem,
    datumRefs: [b.datum.ref, a.datum.ref], receiptRefs: [b.receipt.ref, a.receipt.ref]
  });
  assert.deepEqual(first.ref, retry.ref);
});

test('material evidence-cutoff change creates a new manifest semantic identity', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const a = publishManifest(ledger, { logicalId: 'cm-cutoff', version: '1', decisionProblem: problem, datumRefs: [datum.ref], evidenceCutoff: '2026-08-16T02:05:00Z' });
  const b = publishManifest(ledger, { logicalId: 'cm-cutoff', version: '2', decisionProblem: problem, datumRefs: [datum.ref], evidenceCutoff: '2026-08-16T02:06:00Z', auditOccurredAt: '2026-08-16T02:07:00Z' });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('material DecisionProblem objective change under the same logical id changes manifest semantic identity', () => {
  const ledger = freshLedger();
  const datum = publishDatum(ledger);
  const aProblem = publishProblem(ledger, 'dp-manifest', problemInput(), undefined, '1');
  const bProblem = publishProblem(
    ledger,
    'dp-manifest',
    problemInput({ objective: { code: 'MINIMIZE_IRRIGATION_WATER' } }),
    undefined,
    '2'
  );
  assert.notEqual(aProblem.ref.semanticHash, bProblem.ref.semanticHash);
  const a = publishManifest(ledger, { logicalId: 'cm-problem', version: '1', decisionProblem: aProblem, datumRefs: [datum.ref] });
  const b = publishManifest(ledger, { logicalId: 'cm-problem', version: '2', decisionProblem: bProblem, datumRefs: [datum.ref] });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('later changed ContextDatum version does not rewrite historical manifest membership', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const oldDatum = publishDatum(ledger, 'cd-history', datumInput({ value: { type: 'DECIMAL', decimal: '0.32' } }), undefined, '1');
  const oldManifest = publishManifest(ledger, { logicalId: 'cm-history', version: '1', decisionProblem: problem, datumRefs: [oldDatum.ref] });
  const newerDatum = publishDatum(ledger, 'cd-history', datumInput({ value: { type: 'DECIMAL', decimal: '0.40' } }), undefined, '2');
  assert.notEqual(oldDatum.ref.semanticHash, newerDatum.ref.semanticHash);
  const historical = validateContextManifestAuthority({ ledger, contextManifestRef: oldManifest.ref });
  assert.deepEqual(historical.semanticPayload.datumRefs, [oldDatum.ref]);
  assert.equal(historical.semanticPayload.datumRefs.some((ref) => ref.semanticHash === newerDatum.ref.semanticHash), false);
});

test('later changed reference/datum/receipt versions do not rewrite historical manifest membership', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const oldBytes = Buffer.from('{"revision":1,"vwc":"0.33"}', 'utf8');
  const oldPair = publishResolvedPair(ledger, {
    suffix: 'receipt-history',
    bytes: oldBytes,
    referenceVersion: '1',
    datumVersion: '1',
    receiptVersion: '1'
  });
  const oldManifest = publishManifest(ledger, {
    logicalId: 'cm-receipt-history',
    version: '1',
    decisionProblem: problem,
    datumRefs: [oldPair.datum.ref],
    receiptRefs: [oldPair.receipt.ref]
  });

  const newBytes = Buffer.from('{"revision":2,"vwc":"0.38"}', 'utf8');
  const newPair = publishResolvedPair(ledger, {
    suffix: 'receipt-history',
    bytes: newBytes,
    referenceVersion: '2',
    datumVersion: '2',
    receiptVersion: '2',
    resolvedAt: '2026-08-16T02:04:00Z'
  });
  assert.notEqual(oldPair.datum.ref.semanticHash, newPair.datum.ref.semanticHash);
  assert.notEqual(oldPair.receipt.ref.semanticHash, newPair.receipt.ref.semanticHash);

  const historical = validateContextManifestAuthority({ ledger, contextManifestRef: oldManifest.ref });
  assert.deepEqual(historical.semanticPayload.datumRefs, [oldPair.datum.ref]);
  assert.deepEqual(historical.semanticPayload.resolvedReferenceReceiptRefs, [oldPair.receipt.ref]);
  assert.equal(historical.semanticPayload.resolvedReferenceReceiptRefs.some((ref) => ref.semanticHash === newPair.receipt.ref.semanticHash), false);
});

test('public ContextManifest and TargetContext snapshot expose exact frozen membership without mutable pool access', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const datum = publishDatum(ledger);
  const manifest = publishManifest(ledger, { logicalId: 'cm-wire', decisionProblem: problem, datumRefs: [datum.ref] });
  const wire = materializePublicContextManifest({ ledger, contextManifestRef: manifest.ref });
  assert.equal(wire.contract_version, 'adr.context-manifest.v1');
  assert.equal(wire.context_manifest_id, 'cm-wire');
  assert.equal(wire.target_ref.field_id, 'field-1');
  assert.deepEqual(wire.datum_refs, [{ datum_id: datum.ref.logicalId, semantic_hash: datum.ref.semanticHash }]);
  assert.match(wire.created_at, /^2026-08-16T02:06:00\.000Z$/);
  assert.equal(wire.manifest_semantic_hash, manifest.ref.semanticHash);
  const snapshot = targetContextSnapshot({ ledger, contextManifestRef: manifest.ref });
  assert.deepEqual(snapshot.datumRefs, [datum.ref]);
  assert.equal(Object.isFrozen(snapshot), true);
});

console.log(`ContextManifest acceptance: ${passed} passed`);
