import assert from 'node:assert/strict';
import { assertAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import {
  OPERATIONAL_NON_AUTHORITY_CLAIM,
  OperationalFailure,
  OperationalJobError,
  OperationalJobJournal,
  executeOperationalJob,
  projectOperationalTrace,
  summarizeOperationalTraces
} from '../../packages/operations/src/index.mjs';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function ref(kind, logicalId, digit) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${String(digit).repeat(64)}` };
}

await test('unknown executor exceptions are classified without leaking error messages into traces', async () => {
  const journal = new OperationalJobJournal();
  const result = await executeOperationalJob({
    journal,
    job: { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PRIVATE_PROVIDER_CALL', idempotencyKey: 'private-1', inputAuthorityRefs: [] },
    startedAt: '2026-08-17T16:00:00Z',
    completedAt: '2026-08-17T16:00:01Z',
    executor: async () => { throw new Error('SECRET_API_KEY=do-not-log-this'); }
  });
  assert.equal(result.attempt.failure.failureClass, 'UNCLASSIFIED_PLATFORM_FAILURE');
  const trace = projectOperationalTrace({ journal, jobId: result.job.jobId });
  const serialized = JSON.stringify(trace);
  assert.equal(serialized.includes('SECRET_API_KEY'), false);
  assert.equal(serialized.includes('do-not-log-this'), false);
  assert.equal('message' in trace.attempts[0].failure, false);
});

await test('tenant-aware metrics refuse cross-tenant aggregation', async () => {
  const traces = [];
  for (const tenantId of ['tenant-a', 'tenant-b']) {
    const journal = new OperationalJobJournal();
    const result = await executeOperationalJob({
      journal,
      job: { organizationId: 'org-a', tenantId, operation: 'PILOT_JOB', idempotencyKey: `job-${tenantId}`, inputAuthorityRefs: [] },
      startedAt: '2026-08-17T16:10:00Z',
      completedAt: '2026-08-17T16:10:01Z',
      executor: async () => ({ outputAuthorityRefs: [] })
    });
    traces.push(projectOperationalTrace({ journal, jobId: result.job.jobId }));
  }
  assert.throws(
    () => summarizeOperationalTraces(traces),
    (error) => error instanceof OperationalJobError && error.code === 'CROSS_TENANT_OBSERVABILITY_FORBIDDEN'
  );
});

await test('journal snapshot tampering fails closed', async () => {
  const journal = new OperationalJobJournal();
  const result = await executeOperationalJob({
    journal,
    job: { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_JOB', idempotencyKey: 'snapshot-1', inputAuthorityRefs: [] },
    startedAt: '2026-08-17T16:20:00Z',
    completedAt: '2026-08-17T16:20:01Z',
    executor: async () => ({ outputAuthorityRefs: [ref('ContextDatum', 'ctx-1', 1)] })
  });
  const snapshot = JSON.parse(JSON.stringify(journal.exportSnapshot()));
  snapshot.jobs[0].job.operation = 'TAMPERED_OPERATION';
  const { snapshotHash: _oldHash, ...basis } = snapshot;
  snapshot.snapshotHash = semanticHash('OperationalJobJournalSnapshot', basis);
  assert.throws(
    () => new OperationalJobJournal(snapshot),
    (error) => error instanceof OperationalJobError && error.code === 'JOB_SPEC_HASH_MISMATCH'
  );
  assert.equal(result.attempt.status, 'SUCCEEDED');
});

await test('restored failure payload cannot widen even when integrity hashes are recomputed', async () => {
  const journal = new OperationalJobJournal();
  const result = await executeOperationalJob({
    journal,
    job: { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PRIVATE_PROVIDER_CALL', idempotencyKey: 'snapshot-failure-widening-1', inputAuthorityRefs: [] },
    startedAt: '2026-08-17T16:25:00Z',
    completedAt: '2026-08-17T16:25:01Z',
    executor: async () => { throw new OperationalFailure({ failureClass: 'PROVIDER_FAILURE', code: 'HTTP_503', retryable: true }); }
  });
  assert.equal(result.attempt.status, 'FAILED');
  const snapshot = JSON.parse(JSON.stringify(journal.exportSnapshot()));
  const attempt = snapshot.jobs[0].attempts[0];
  attempt.failure.message = 'SECRET_API_KEY=injected-through-storage';
  const { attemptRecordHash: _oldAttemptHash, ...attemptBasis } = attempt;
  attempt.attemptRecordHash = semanticHash('OperationalJobAttemptRecord', attemptBasis);
  const { snapshotHash: _oldSnapshotHash, ...snapshotBasis } = snapshot;
  snapshot.snapshotHash = semanticHash('OperationalJobJournalSnapshot', snapshotBasis);
  assert.throws(
    () => new OperationalJobJournal(snapshot),
    (error) => error instanceof OperationalJobError && error.code === 'INVALID_FAILURE_RECORD'
  );
});

await test('restored history cannot forge a retry after a non-retryable failure', async () => {
  const journal = new OperationalJobJournal();
  const job = { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PROVIDER_RESOLUTION', idempotencyKey: 'retry-history-1', inputAuthorityRefs: [] };
  const first = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T16:27:00Z',
    completedAt: '2026-08-17T16:27:01Z',
    executor: async () => { throw new OperationalFailure({ failureClass: 'PROVIDER_FAILURE', code: 'HTTP_503', retryable: true }); }
  });
  assert.equal(first.attempt.status, 'FAILED');
  const second = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T16:28:00Z',
    completedAt: '2026-08-17T16:28:01Z',
    executor: async () => ({ outputAuthorityRefs: [] })
  });
  assert.equal(second.attempt.status, 'SUCCEEDED');

  const snapshot = JSON.parse(JSON.stringify(journal.exportSnapshot()));
  const firstAttempt = snapshot.jobs[0].attempts[0];
  firstAttempt.failure.retryable = false;
  const { attemptRecordHash: _oldAttemptHash, ...attemptBasis } = firstAttempt;
  firstAttempt.attemptRecordHash = semanticHash('OperationalJobAttemptRecord', attemptBasis);
  const { snapshotHash: _oldSnapshotHash, ...snapshotBasis } = snapshot;
  snapshot.snapshotHash = semanticHash('OperationalJobJournalSnapshot', snapshotBasis);
  assert.throws(
    () => new OperationalJobJournal(snapshot),
    (error) => error instanceof OperationalJobError && error.code === 'INVALID_RETRY_HISTORY'
  );
});

await test('terminal attempt cannot be overwritten by a later failure record', async () => {
  const journal = new OperationalJobJournal();
  const result = await executeOperationalJob({
    journal,
    job: { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_JOB', idempotencyKey: 'terminal-1', inputAuthorityRefs: [] },
    startedAt: '2026-08-17T16:30:00Z',
    completedAt: '2026-08-17T16:30:01Z',
    executor: async () => ({ outputAuthorityRefs: [] })
  });
  assert.throws(
    () => journal.failAttempt({
      jobId: result.job.jobId,
      attemptId: result.attempt.attemptId,
      completedAt: '2026-08-17T16:30:02Z',
      error: new OperationalFailure({ failureClass: 'PLATFORM_TRANSIENT_FAILURE', code: 'LATE_FAILURE', retryable: true })
    }),
    (error) => error instanceof OperationalJobError && error.code === 'ATTEMPT_ALREADY_TERMINAL'
  );
});

await test('operational trace is explicitly not an AuthorityRef or domain evidence object', async () => {
  const journal = new OperationalJobJournal();
  const result = await executeOperationalJob({
    journal,
    job: { organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_JOB', idempotencyKey: 'non-authority-1', inputAuthorityRefs: [] },
    startedAt: '2026-08-17T16:40:00Z',
    completedAt: '2026-08-17T16:40:01Z',
    executor: async () => ({ outputAuthorityRefs: [] })
  });
  const trace = projectOperationalTrace({ journal, jobId: result.job.jobId });
  assert.equal(trace.authorityClaim, OPERATIONAL_NON_AUTHORITY_CLAIM);
  assert.equal('ref' in trace, false);
  assert.throws(() => assertAuthorityRef(trace));
});

console.log(`P06 pilot operations integrity: ${passed} passed`);
