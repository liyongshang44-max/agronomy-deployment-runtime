import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { baseDatum, principal, publishAuthorized } from '../context-datum/fixtures.mjs';
import {
  OPERATIONAL_NON_AUTHORITY_CLAIM,
  OperationalFailure,
  OperationalJobError,
  OperationalJobJournal,
  createOperationalJobSpec,
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
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${String(digit).repeat(64)}`
  };
}

await test('job identity is deterministic and binds scoped idempotency to exact authority inputs', async () => {
  const refs = [ref('KnowledgeRelease', 'kr-1', 1), ref('ContextManifest', 'cm-1', 2)];
  const a = createOperationalJobSpec({
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_APPLICABILITY_REFRESH', idempotencyKey: 'case-001', inputAuthorityRefs: refs
  });
  const b = createOperationalJobSpec({
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_APPLICABILITY_REFRESH', idempotencyKey: 'case-001', inputAuthorityRefs: [...refs].reverse()
  });
  assert.equal(a.jobId, b.jobId);
  assert.equal(a.idempotencyScopeHash, b.idempotencyScopeHash);
  assert.equal(a.authorityClaim, OPERATIONAL_NON_AUTHORITY_CLAIM);

  const journal = new OperationalJobJournal();
  journal.ensureJob(a);
  assert.throws(
    () => journal.ensureJob({
      organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PILOT_APPLICABILITY_REFRESH', idempotencyKey: 'case-001',
      inputAuthorityRefs: [ref('KnowledgeRelease', 'kr-2', 3)]
    }),
    (error) => error instanceof OperationalJobError && error.code === 'IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_INPUTS'
  );
});

await test('provider failure is retained and retry-safe ContextDatum authority publication remains single-version', async () => {
  const ledger = new AuthorityLedger();
  let journal = new OperationalJobJournal();
  let executorCalls = 0;
  let firstPublishedRef = null;
  const job = {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    operation: 'CONTEXT_DATUM_INGRESS',
    idempotencyKey: 'sensor-event-20260817-001',
    inputAuthorityRefs: []
  };

  const first = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T12:00:00Z',
    completedAt: '2026-08-17T12:00:01Z',
    executor: async () => {
      executorCalls += 1;
      const record = publishAuthorized(
        ledger,
        'ctx-p06-retry-safe',
        '1',
        baseDatum({ source: { providerId: 'sensor-platform-a', sourceRef: 'p06-event-1', contentHash: 'sha256:p06-event-1' } }),
        principal,
        'p06-first'
      );
      firstPublishedRef = record.ref;
      throw new OperationalFailure({
        failureClass: 'PROVIDER_FAILURE',
        code: 'UPSTREAM_ACK_TIMEOUT',
        message: 'provider acknowledgement timed out after authority publication',
        retryable: true
      });
    }
  });
  assert.equal(first.disposition, 'EXECUTED_FAILURE');
  assert.equal(first.attempt.failure.failureClass, 'PROVIDER_FAILURE');
  assert.equal(ledger.listVersions(firstPublishedRef.kind, firstPublishedRef.logicalId).length, 1);

  journal = new OperationalJobJournal(journal.exportSnapshot());
  const second = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T12:01:00Z',
    completedAt: '2026-08-17T12:01:01Z',
    executor: async () => {
      executorCalls += 1;
      const record = publishAuthorized(
        ledger,
        'ctx-p06-retry-safe',
        '1',
        baseDatum({ source: { providerId: 'sensor-platform-a', sourceRef: 'p06-event-1', contentHash: 'sha256:p06-event-1' } }),
        principal,
        'p06-second'
      );
      return { outputAuthorityRefs: [record.ref] };
    }
  });
  assert.equal(second.disposition, 'EXECUTED_SUCCESS');
  assert.deepEqual(second.attempt.outputAuthorityRefs, [firstPublishedRef]);
  assert.equal(ledger.listVersions(firstPublishedRef.kind, firstPublishedRef.logicalId).length, 1);

  const replay = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T12:02:00Z',
    completedAt: '2026-08-17T12:02:01Z',
    executor: async () => {
      executorCalls += 1;
      throw new Error('successful operational retry must not redispatch');
    }
  });
  assert.equal(replay.disposition, 'REPLAYED_SUCCESS');
  assert.equal(executorCalls, 2);
  const trace = projectOperationalTrace({ journal, jobId: second.job.jobId });
  assert.deepEqual(trace.attempts.map((attempt) => attempt.status), ['FAILED', 'SUCCEEDED']);
  assert.equal(trace.attempts[0].failure.code, 'UPSTREAM_ACK_TIMEOUT');
  assert.deepEqual(trace.attempts[1].outputAuthorityRefs, [firstPublishedRef]);
});

await test('interrupted running attempt is recovered as historical transient failure before retry', async () => {
  let journal = new OperationalJobJournal();
  const job = journal.ensureJob({
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'ASYNC_COMPILATION', idempotencyKey: 'compile-001', inputAuthorityRefs: []
  });
  journal.beginAttempt({ jobId: job.jobId, startedAt: '2026-08-17T13:00:00Z' });
  journal = new OperationalJobJournal(journal.exportSnapshot());
  const recovered = journal.recoverInterruptedAttempts({ recoveredAt: '2026-08-17T13:00:30Z' });
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].status, 'FAILED');
  assert.equal(recovered[0].failure.failureClass, 'PLATFORM_TRANSIENT_FAILURE');
  assert.equal(recovered[0].failure.code, 'ATTEMPT_INTERRUPTED');
  assert.equal(recovered[0].failure.retryable, true);

  const retry = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-17T13:01:00Z',
    completedAt: '2026-08-17T13:01:02Z',
    executor: async () => ({ outputAuthorityRefs: [ref('ClaimCandidate', 'candidate-1', 4)] })
  });
  assert.equal(retry.disposition, 'EXECUTED_SUCCESS');
  const trace = projectOperationalTrace({ journal, jobId: job.jobId });
  assert.deepEqual(trace.attempts.map((attempt) => attempt.status), ['FAILED', 'SUCCEEDED']);
});

await test('scientific/runtime ineligibility is BLOCKED rather than provider/platform failure and non-retryable stays closed', async () => {
  const journal = new OperationalJobJournal();
  const providerJob = {
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'PROVIDER_RESOLUTION', idempotencyKey: 'provider-001', inputAuthorityRefs: []
  };
  const scienceJob = {
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'APPLICABILITY_EVALUATION', idempotencyKey: 'science-001', inputAuthorityRefs: []
  };

  const provider = await executeOperationalJob({
    journal, job: providerJob,
    startedAt: '2026-08-17T14:00:00Z', completedAt: '2026-08-17T14:00:01Z',
    executor: async () => { throw new OperationalFailure({ failureClass: 'PROVIDER_FAILURE', code: 'HTTP_503', retryable: true }); }
  });
  assert.equal(provider.attempt.status, 'FAILED');

  let scienceCalls = 0;
  const science = await executeOperationalJob({
    journal, job: scienceJob,
    startedAt: '2026-08-17T14:01:00Z', completedAt: '2026-08-17T14:01:01Z',
    executor: async () => {
      scienceCalls += 1;
      throw new OperationalFailure({ failureClass: 'SCIENTIFIC_INELIGIBILITY', code: 'MATERIAL_CONTEXT_CONFLICT', retryable: false });
    }
  });
  assert.equal(science.disposition, 'EXECUTED_BLOCKED');
  assert.equal(science.attempt.status, 'BLOCKED');

  const blockedRetry = await executeOperationalJob({
    journal, job: scienceJob,
    startedAt: '2026-08-17T14:02:00Z', completedAt: '2026-08-17T14:02:01Z',
    executor: async () => { scienceCalls += 1; return { outputAuthorityRefs: [] }; }
  });
  assert.equal(blockedRetry.disposition, 'RETRY_BLOCKED_NON_RETRYABLE');
  assert.equal(scienceCalls, 1);

  const metrics = summarizeOperationalTraces([
    projectOperationalTrace({ journal, jobId: provider.job.jobId }),
    projectOperationalTrace({ journal, jobId: science.job.jobId })
  ]);
  assert.equal(metrics.failedAttemptCountByClass.PROVIDER_FAILURE, 1);
  assert.equal(metrics.blockedAttemptCountByClass.SCIENTIFIC_INELIGIBILITY, 1);
});

await test('trace preserves exact backbone refs without copying authority payloads', async () => {
  const journal = new OperationalJobJournal();
  const backboneRefs = [
    ref('KnowledgeRelease', 'release-1', 1),
    ref('RuntimeProfile', 'profile-1', 2),
    ref('Deployment', 'deployment-1', 3),
    ref('ContextManifest', 'manifest-1', 4),
    ref('RuntimeBinding', 'binding-1', 5)
  ];
  const result = await executeOperationalJob({
    journal,
    job: {
      organizationId: 'org-a', tenantId: 'tenant-a', operation: 'RUNTIME_EVENT_PROJECTION', idempotencyKey: 'runtime-event-1', inputAuthorityRefs: backboneRefs
    },
    startedAt: '2026-08-17T15:00:00Z',
    completedAt: '2026-08-17T15:00:01Z',
    executor: async () => ({ outputAuthorityRefs: [ref('RuntimeResult', 'result-1', 6)] })
  });
  const trace = projectOperationalTrace({ journal, jobId: result.job.jobId });
  assert.deepEqual(trace.inputAuthorityRefs, createOperationalJobSpec({
    organizationId: 'org-a', tenantId: 'tenant-a', operation: 'RUNTIME_EVENT_PROJECTION', idempotencyKey: 'runtime-event-1', inputAuthorityRefs: backboneRefs
  }).inputAuthorityRefs);
  assert.equal(JSON.stringify(trace).includes('semanticPayload'), false);
  assert.equal(JSON.stringify(trace).includes('idempotencyKey'), false);
  assert.equal(trace.authorityClaim, OPERATIONAL_NON_AUTHORITY_CLAIM);
});

console.log(`P06 pilot operations acceptance: ${passed} passed`);
