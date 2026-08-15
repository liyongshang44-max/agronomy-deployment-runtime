import assert from 'node:assert/strict';
import {
  datumInput,
  freshLedger,
  publishDatum,
  publishManifest,
  publishProblem
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

test('changed exact datum membership creates a new ContextManifest semantic identity', () => {
  const ledger = freshLedger();
  const problem = publishProblem(ledger);
  const firstDatum = publishDatum(
    ledger,
    'cd-membership-a',
    datumInput({ value: { type: 'DECIMAL', decimal: '0.32' } })
  );
  const secondDatum = publishDatum(
    ledger,
    'cd-membership-b',
    datumInput({ value: { type: 'DECIMAL', decimal: '0.41' } })
  );
  const first = publishManifest(ledger, {
    logicalId: 'cm-membership',
    version: '1',
    decisionProblem: problem,
    datumRefs: [firstDatum.ref]
  });
  const second = publishManifest(ledger, {
    logicalId: 'cm-membership',
    version: '2',
    decisionProblem: problem,
    datumRefs: [secondDatum.ref]
  });
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
  assert.notDeepEqual(first.semanticPayload.datumRefs, second.semanticPayload.datumRefs);
});

test('publication created_at is operational metadata and does not perturb ContextManifest semantic identity', () => {
  const firstLedger = freshLedger();
  const secondLedger = freshLedger();
  const firstProblem = publishProblem(firstLedger, 'dp-created-at');
  const secondProblem = publishProblem(secondLedger, 'dp-created-at');
  const firstDatum = publishDatum(firstLedger, 'cd-created-at');
  const secondDatum = publishDatum(secondLedger, 'cd-created-at');
  const first = publishManifest(firstLedger, {
    logicalId: 'cm-created-at',
    version: '1',
    decisionProblem: firstProblem,
    datumRefs: [firstDatum.ref],
    auditOccurredAt: '2026-08-16T02:06:00Z'
  });
  const second = publishManifest(secondLedger, {
    logicalId: 'cm-created-at',
    version: '1',
    decisionProblem: secondProblem,
    datumRefs: [secondDatum.ref],
    auditOccurredAt: '2026-08-16T02:09:00Z'
  });
  assert.equal(first.ref.semanticHash, second.ref.semanticHash);
  assert.deepEqual(first.semanticPayload, second.semanticPayload);
});

console.log(`ContextManifest identity acceptance: ${passed} passed`);
