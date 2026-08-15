import { strict as assert } from 'node:assert';
import {
  CanonicalizationError,
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import { makeAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';

function audit(eventId, actorId = 'reviewer-1', inputRefs = []) {
  return {
    eventId,
    occurredAt: '2026-08-15T12:00:00.000Z',
    actor: { type: 'USER', id: actorId },
    inputRefs,
    details: { channel: 'acceptance' }
  };
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function expectError(fn, ErrorType, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

test('canonical JSON is independent of object insertion order', () => {
  const left = { z: 1, a: { y: true, x: 'value' }, list: [3, 2, 1] };
  const right = { list: [3, 2, 1], a: { x: 'value', y: true }, z: 1 };
  assert.equal(canonicalizeSemanticJson(left), canonicalizeSemanticJson(right));
  assert.equal(semanticHash('ExampleAuthority', left), semanticHash('ExampleAuthority', right));
});

test('semantic hash domain-separates object kinds', () => {
  const payload = { value: 'same' };
  assert.notEqual(semanticHash('Claim', payload), semanticHash('Policy', payload));
});

test('semantic change changes semantic hash', () => {
  assert.notEqual(
    semanticHash('Claim', { threshold: '10' }),
    semanticHash('Claim', { threshold: '11' })
  );
});

test('canonicalization rejects values that cannot carry stable semantic JSON identity', () => {
  expectError(() => canonicalizeSemanticJson({ value: Number.NaN }), CanonicalizationError, 'NON_FINITE_NUMBER');
  expectError(() => canonicalizeSemanticJson({ value: undefined }), CanonicalizationError, 'UNDEFINED_VALUE');
  const cycle = {};
  cycle.self = cycle;
  expectError(() => canonicalizeSemanticJson(cycle), CanonicalizationError, 'CYCLIC_VALUE');
  const sparse = [];
  sparse.length = 1;
  expectError(() => canonicalizeSemanticJson(sparse), CanonicalizationError, 'SPARSE_ARRAY');
});

test('published authority uses logical id + opaque version + semantic hash', () => {
  const ledger = new AuthorityLedger();
  const record = ledger.publish({
    kind: 'Claim',
    logicalId: 'corn.irrigation.threshold',
    version: 'v1',
    semanticPayload: { threshold: '0.40', unit: 'fraction' },
    audit: audit('evt-publish-v1')
  });

  assert.equal(record.ref.kind, 'Claim');
  assert.equal(record.ref.logicalId, 'corn.irrigation.threshold');
  assert.equal(record.ref.version, 'v1');
  assert.match(record.ref.semanticHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(ledger.resolve(record.ref), record);
});

test('operational metadata does not perturb semantic identity', () => {
  const ledger = new AuthorityLedger();
  const v1 = ledger.publish({
    kind: 'Claim',
    logicalId: 'example.same-semantics',
    version: 'v1',
    semanticPayload: { value: 'A' },
    operationalMetadata: { importedBy: 'worker-a', queueAttempt: 1 },
    audit: audit('evt-meta-v1')
  });
  const v2 = ledger.publish({
    kind: 'Claim',
    logicalId: 'example.same-semantics',
    version: 'v2',
    semanticPayload: { value: 'A' },
    operationalMetadata: { importedBy: 'worker-b', queueAttempt: 9 },
    audit: audit('evt-meta-v2')
  });

  assert.equal(v1.ref.semanticHash, v2.ref.semanticHash);
  assert.notDeepEqual(v1.operationalMetadata, v2.operationalMetadata);
});

test('published version cannot be semantically mutated in place', () => {
  const ledger = new AuthorityLedger();
  ledger.publish({
    kind: 'QualifiedKnowledge',
    logicalId: 'knowledge.water.rule',
    version: '3',
    semanticPayload: { status: 'QUALIFIED', value: 'A' },
    audit: audit('evt-qk-v3')
  });

  expectError(() => ledger.publish({
    kind: 'QualifiedKnowledge',
    logicalId: 'knowledge.water.rule',
    version: '3',
    semanticPayload: { status: 'QUALIFIED', value: 'B' },
    audit: audit('evt-qk-v3-mutation')
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

test('exact retry of a published identity is idempotent and does not rewrite history', () => {
  const ledger = new AuthorityLedger();
  const first = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.retry',
    version: '1',
    semanticPayload: { value: 'stable' },
    operationalMetadata: { attempt: 1 },
    audit: audit('evt-retry-1')
  });
  const second = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.retry',
    version: '1',
    semanticPayload: { value: 'stable' },
    operationalMetadata: { attempt: 2 },
    audit: audit('evt-retry-2')
  });

  assert.equal(first, second);
  assert.deepEqual(second.operationalMetadata, { attempt: 1 });
  assert.equal(ledger.auditFor(first.ref).length, 1);
});

test('old exact reference still resolves after a newer version is published', () => {
  const ledger = new AuthorityLedger();
  const v1 = ledger.publish({
    kind: 'ModelSpecification',
    logicalId: 'model.example',
    version: '1',
    semanticPayload: { equation: 'A' },
    audit: audit('evt-model-v1')
  });
  const v2 = ledger.publish({
    kind: 'ModelSpecification',
    logicalId: 'model.example',
    version: '2',
    semanticPayload: { equation: 'B' },
    audit: audit('evt-model-v2')
  });

  assert.equal(ledger.resolve(v1.ref).semanticPayload.equation, 'A');
  assert.equal(ledger.resolve(v2.ref).semanticPayload.equation, 'B');
  assert.equal(ledger.listVersions('ModelSpecification', 'model.example').length, 2);
});

test('reference hash mismatch is rejected even when logical id and version exist', () => {
  const ledger = new AuthorityLedger();
  const record = ledger.publish({
    kind: 'PolicySpecification',
    logicalId: 'policy.example',
    version: '1',
    semanticPayload: { action: 'WAIT' },
    audit: audit('evt-policy-v1')
  });
  const forged = makeAuthorityRef({
    ...record.ref,
    semanticHash: semanticHash('PolicySpecification', { action: 'ACT' })
  });

  expectError(() => ledger.resolve(forged), AuthorityLedgerError, 'AUTHORITY_HASH_MISMATCH');
});

test('lineage is explicit, immutable and independently auditable', () => {
  const ledger = new AuthorityLedger();
  const oldRecord = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.lineage',
    version: '1',
    semanticPayload: { value: 'old' },
    audit: audit('evt-lineage-old')
  });
  const newRecord = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.lineage',
    version: '2',
    semanticPayload: { value: 'new' },
    audit: audit('evt-lineage-new')
  });
  const lineage = ledger.addLineage({
    relation: 'supersedes',
    from: newRecord.ref,
    to: oldRecord.ref,
    audit: audit('evt-lineage-link', 'reviewer-2')
  });

  assert.equal(lineage.relation, 'supersedes');
  assert.equal(ledger.lineageFor(oldRecord.ref).length, 1);
  assert.equal(ledger.lineageFor(newRecord.ref).length, 1);
  assert.ok(ledger.auditFor(oldRecord.ref).some((event) => event.action === 'LINEAGE_SUPERSEDES'));
});

test('audit reconstructs creator and exact authority input refs', () => {
  const ledger = new AuthorityLedger();
  const source = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.input',
    version: '1',
    semanticPayload: { value: 'source' },
    audit: audit('evt-source')
  });
  const derived = ledger.publish({
    kind: 'DerivedKnowledge',
    logicalId: 'derived.output',
    version: '1',
    semanticPayload: { value: 'derived' },
    audit: audit('evt-derived', 'scientific-reviewer', [source.ref])
  });

  const events = ledger.auditFor(derived.ref);
  assert.equal(events.length, 1);
  assert.equal(events[0].actor.id, 'scientific-reviewer');
  assert.equal(events[0].inputRefs[0].semanticHash, source.ref.semanticHash);
});

test('published authority payload and metadata are deeply frozen', () => {
  const ledger = new AuthorityLedger();
  const record = ledger.publish({
    kind: 'KnowledgeRelease',
    logicalId: 'release.example',
    version: '2026.08',
    semanticPayload: { members: [{ id: 'a' }] },
    operationalMetadata: { import: { channel: 'test' } },
    audit: audit('evt-freeze')
  });

  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.semanticPayload));
  assert.ok(Object.isFrozen(record.semanticPayload.members));
  assert.ok(Object.isFrozen(record.semanticPayload.members[0]));
  assert.ok(Object.isFrozen(record.operationalMetadata.import));
});

test('snapshot preserves exact historical authority, lineage and audit data', () => {
  const ledger = new AuthorityLedger();
  const v1 = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.snapshot',
    version: '1',
    semanticPayload: { value: 'one' },
    audit: audit('evt-snapshot-1')
  });
  const v2 = ledger.publish({
    kind: 'Claim',
    logicalId: 'claim.snapshot',
    version: '2',
    semanticPayload: { value: 'two' },
    audit: audit('evt-snapshot-2')
  });
  ledger.addLineage({
    relation: 'supersedes',
    from: v2.ref,
    to: v1.ref,
    audit: audit('evt-snapshot-lineage')
  });

  const snapshot = ledger.exportSnapshot();
  assert.equal(snapshot.records.length, 2);
  assert.equal(snapshot.lineage.length, 1);
  assert.equal(snapshot.audit.length, 3);
  assert.equal(snapshot.records[0].ref.semanticHash, v1.ref.semanticHash);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
