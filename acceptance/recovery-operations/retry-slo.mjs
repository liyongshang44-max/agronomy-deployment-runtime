import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  OperationalFailure,
  OperationalJobJournal,
  createOperationalJobSpec,
  projectOperationalTrace
} from '../../packages/operations/src/index.mjs';
import { createPilotSloReport } from '../../packages/recovery-operations/src/index.mjs';

const ledger = new AuthorityLedger();
const input = ledger.publish({
  kind: 'OperationalEvidence',
  logicalId: 'p08-provider-retry-input',
  version: '1',
  semanticPayload: { value: 'provider-retry' },
  audit: {
    eventId: 'p08-provider-retry-input-publish',
    occurredAt: '2026-08-21T10:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'p08-retry-test' }
  }
});

const journal = new OperationalJobJournal();
const job = createOperationalJobSpec({
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  operation: 'P08_PROVIDER_RETRY',
  idempotencyKey: 'p08-provider-retry',
  inputAuthorityRefs: [input.ref]
});
journal.ensureJob(job);

const first = journal.beginAttempt({
  jobId: job.jobId,
  startedAt: '2026-08-21T10:10:00.000Z'
});
journal.failAttempt({
  jobId: job.jobId,
  attemptId: first.attemptId,
  completedAt: '2026-08-21T10:10:00.100Z',
  error: new OperationalFailure({
    failureClass: 'PROVIDER_FAILURE',
    code: 'P08_PROVIDER_TEMPORARY_FAILURE',
    retryable: true
  })
});

const second = journal.beginAttempt({
  jobId: job.jobId,
  startedAt: '2026-08-21T10:10:01.000Z'
});
journal.succeedAttempt({
  jobId: job.jobId,
  attemptId: second.attemptId,
  completedAt: '2026-08-21T10:10:01.150Z',
  outputAuthorityRefs: []
});

const traceEvidence = [{
  trace: projectOperationalTrace({ journal, jobId: job.jobId }),
  journalSnapshot: journal.exportSnapshot()
}];

const strictBudget = createPilotSloReport({
  traceEvidence,
  windowStart: '2026-08-21T10:00:00Z',
  windowEnd: '2026-08-21T11:00:00Z',
  objectives: {
    successTargetBasisPoints: 10000,
    maxP95DurationMs: 1000,
    maxProviderOutageCount: 0
  }
});

assert.equal(strictBudget.measurements.succeededJobs, 1);
assert.equal(strictBudget.measurements.failedJobs, 0);
assert.equal(strictBudget.measurements.serviceEligibleJobs, 1);
assert.equal(strictBudget.measurements.successBasisPoints, 10000);
assert.equal(strictBudget.measurements.providerOutageCount, 1);
assert.equal(strictBudget.successObjectiveMet, true);
assert.equal(strictBudget.providerObjectiveMet, false);
assert.equal(strictBudget.evaluation, 'FAIL');

const tolerantBudget = createPilotSloReport({
  traceEvidence,
  windowStart: '2026-08-21T10:00:00Z',
  windowEnd: '2026-08-21T11:00:00Z',
  objectives: {
    successTargetBasisPoints: 10000,
    maxP95DurationMs: 1000,
    maxProviderOutageCount: 1
  }
});
assert.equal(tolerantBudget.measurements.providerOutageCount, 1);
assert.equal(tolerantBudget.evaluation, 'PASS');

console.log('P08 provider retry/outage accounting acceptance: PASS');
