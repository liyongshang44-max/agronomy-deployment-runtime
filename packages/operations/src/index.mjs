import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const PILOT_OPERATIONAL_JOB_CONTRACT_VERSION = 'adr.operational-job.v1';
export const PILOT_OPERATIONAL_ATTEMPT_CONTRACT_VERSION = 'adr.operational-job-attempt.v1';
export const PILOT_OPERATIONAL_JOURNAL_SNAPSHOT_VERSION = 'adr.operational-job-journal.v1';
export const OPERATIONAL_NON_AUTHORITY_CLAIM = 'NONE_OPERATIONAL_METADATA_IS_NOT_DOMAIN_AUTHORITY';

export const OPERATIONAL_FAILURE_CLASSES = deepFreeze([
  'PROVIDER_FAILURE',
  'INTEGRATION_FAILURE',
  'AUTHORIZATION_FAILURE',
  'SCIENTIFIC_INELIGIBILITY',
  'RUNTIME_INELIGIBILITY',
  'PLATFORM_TRANSIENT_FAILURE',
  'PLATFORM_PERMANENT_FAILURE',
  'UNCLASSIFIED_PLATFORM_FAILURE'
]);
const FAILURE_CLASS_SET = new Set(OPERATIONAL_FAILURE_CLASSES);
const TERMINAL_STATUS_SET = new Set(['SUCCEEDED', 'FAILED', 'BLOCKED']);
const BLOCKING_CLASS_SET = new Set(['SCIENTIFIC_INELIGIBILITY', 'RUNTIME_INELIGIBILITY']);

export class OperationalJobError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OperationalJobError';
    this.code = code;
  }
}

export class OperationalFailure extends Error {
  constructor({ failureClass, code, message = code, retryable = false }) {
    if (!FAILURE_CLASS_SET.has(failureClass)) {
      throw new OperationalJobError('INVALID_FAILURE_CLASS', `unsupported operational failure class ${failureClass}`);
    }
    const normalizedCode = requiredText(code, 'code');
    super(typeof message === 'string' && message.length > 0 ? message : normalizedCode);
    this.name = 'OperationalFailure';
    this.failureClass = failureClass;
    this.code = normalizedCode;
    this.retryable = Boolean(retryable);
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OperationalJobError('INVALID_OPERATIONAL_FIELD', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, name) {
  if (value === null || value === undefined) return null;
  return requiredText(value, name);
}

function timestamp(value, name) {
  const raw = requiredText(value, name);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new OperationalJobError('INVALID_OPERATIONAL_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function canonicalAuthorityRefs(refs, name) {
  if (!Array.isArray(refs)) {
    throw new OperationalJobError('INVALID_AUTHORITY_REFS', `${name} must be an array`);
  }
  const byKey = new Map();
  for (const ref of refs) {
    const normalized = assertAuthorityRef(ref);
    byKey.set(exactRefKey(normalized), normalized);
  }
  return deepFreeze([...byKey.values()].sort((a, b) => {
    const left = exactRefKey(a);
    const right = exactRefKey(b);
    return left < right ? -1 : left > right ? 1 : 0;
  }));
}

function sameCanonicalValue(left, right, kind = 'OperationalContractComparison') {
  return semanticHash(kind, left) === semanticHash(kind, right);
}

function exactObjectKeys(value, allowedKeys, code, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OperationalJobError(code, `${name} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new OperationalJobError(code, `${name} contains fields outside its closed operational contract`);
  }
}

function normalizeScope({ organizationId, tenantId = null }) {
  return deepFreeze({
    organizationId: requiredText(organizationId, 'organizationId'),
    tenantId: optionalText(tenantId, 'tenantId')
  });
}

function jobSemanticBasis({ organizationId, tenantId = null, operation, idempotencyKey, inputAuthorityRefs = [] }) {
  const scope = normalizeScope({ organizationId, tenantId });
  return deepFreeze({
    contractVersion: PILOT_OPERATIONAL_JOB_CONTRACT_VERSION,
    ...scope,
    operation: requiredText(operation, 'operation'),
    idempotencyKey: requiredText(idempotencyKey, 'idempotencyKey'),
    inputAuthorityRefs: canonicalAuthorityRefs(inputAuthorityRefs, 'inputAuthorityRefs')
  });
}

export function createOperationalJobSpec(input) {
  const basis = jobSemanticBasis(input);
  const idempotencyScopeBasis = {
    organizationId: basis.organizationId,
    tenantId: basis.tenantId,
    operation: basis.operation,
    idempotencyKey: basis.idempotencyKey
  };
  return deepFreeze({
    ...basis,
    jobId: semanticHash('OperationalJob', basis),
    idempotencyScopeHash: semanticHash('OperationalIdempotencyScope', idempotencyScopeBasis),
    authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
  });
}

function validateJobSpec(job) {
  exactObjectKeys(job, [
    'contractVersion', 'organizationId', 'tenantId', 'operation', 'idempotencyKey',
    'inputAuthorityRefs', 'jobId', 'idempotencyScopeHash', 'authorityClaim'
  ], 'INVALID_JOB_SPEC', 'job');
  const expected = createOperationalJobSpec(job);
  if (job.jobId !== expected.jobId || job.idempotencyScopeHash !== expected.idempotencyScopeHash
    || job.authorityClaim !== OPERATIONAL_NON_AUTHORITY_CLAIM
    || !sameCanonicalValue(job, expected, 'OperationalStoredJobContract')) {
    throw new OperationalJobError('JOB_SPEC_HASH_MISMATCH', 'operational job identity/shape is not reproducible');
  }
  return expected;
}

function attemptBase({ jobId, attemptNumber, startedAt }) {
  if (!Number.isInteger(attemptNumber) || attemptNumber <= 0) {
    throw new OperationalJobError('INVALID_ATTEMPT_NUMBER', 'attemptNumber must be a positive integer');
  }
  return deepFreeze({
    contractVersion: PILOT_OPERATIONAL_ATTEMPT_CONTRACT_VERSION,
    jobId: requiredText(jobId, 'jobId'),
    attemptNumber,
    startedAt: timestamp(startedAt, 'startedAt')
  });
}

function sealAttempt(payload) {
  const basis = cloneCanonicalValue(payload);
  return deepFreeze({
    ...basis,
    attemptRecordHash: semanticHash('OperationalJobAttemptRecord', basis)
  });
}

function runningAttempt({ jobId, attemptNumber, startedAt }) {
  const base = attemptBase({ jobId, attemptNumber, startedAt });
  return sealAttempt({
    ...base,
    attemptId: semanticHash('OperationalJobAttempt', base),
    status: 'RUNNING',
    authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
  });
}

function durationMs(startedAt, completedAt) {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(completedAt).getTime();
  if (endMs < startMs) {
    throw new OperationalJobError('ATTEMPT_TIME_REGRESSION', 'completedAt cannot precede startedAt');
  }
  return endMs - startMs;
}

function terminalSuccess(attempt, completedAt, outputAuthorityRefs) {
  const completed = timestamp(completedAt, 'completedAt');
  const { attemptRecordHash: _oldHash, ...base } = attempt;
  return sealAttempt({
    ...base,
    status: 'SUCCEEDED',
    completedAt: completed,
    durationMs: durationMs(attempt.startedAt, completed),
    outputAuthorityRefs: canonicalAuthorityRefs(outputAuthorityRefs, 'outputAuthorityRefs')
  });
}

function normalizeFailure(error) {
  if (error instanceof OperationalFailure) {
    return deepFreeze({
      failureClass: error.failureClass,
      code: error.code,
      retryable: error.retryable
    });
  }
  return deepFreeze({
    failureClass: 'UNCLASSIFIED_PLATFORM_FAILURE',
    code: 'UNCLASSIFIED_EXECUTOR_FAILURE',
    retryable: false
  });
}

function terminalFailure(attempt, completedAt, error) {
  const completed = timestamp(completedAt, 'completedAt');
  const failure = normalizeFailure(error);
  const { attemptRecordHash: _oldHash, ...base } = attempt;
  return sealAttempt({
    ...base,
    status: BLOCKING_CLASS_SET.has(failure.failureClass) ? 'BLOCKED' : 'FAILED',
    completedAt: completed,
    durationMs: durationMs(attempt.startedAt, completed),
    failure
  });
}

function validateFailureRecord(failure) {
  exactObjectKeys(failure, ['failureClass', 'code', 'retryable'], 'INVALID_FAILURE_RECORD', 'attempt.failure');
  if (!FAILURE_CLASS_SET.has(failure.failureClass) || typeof failure.retryable !== 'boolean') {
    throw new OperationalJobError('INVALID_FAILURE_RECORD', 'failed attempt must contain a governed failure class and retryability');
  }
  const code = requiredText(failure.code, 'attempt.failure.code');
  if (code !== failure.code) {
    throw new OperationalJobError('INVALID_FAILURE_RECORD', 'failure code must already be canonical');
  }
  return deepFreeze({ failureClass: failure.failureClass, code, retryable: failure.retryable });
}

function validateAttempt(attempt, jobId, expectedNumber) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new OperationalJobError('INVALID_ATTEMPT_RECORD', 'attempt must be an object');
  }
  const status = attempt.status;
  if (status === 'RUNNING') {
    exactObjectKeys(attempt, [
      'contractVersion', 'jobId', 'attemptNumber', 'startedAt', 'attemptId', 'status', 'authorityClaim', 'attemptRecordHash'
    ], 'INVALID_RUNNING_ATTEMPT', 'running attempt');
  } else if (status === 'SUCCEEDED') {
    exactObjectKeys(attempt, [
      'contractVersion', 'jobId', 'attemptNumber', 'startedAt', 'attemptId', 'status', 'authorityClaim',
      'completedAt', 'durationMs', 'outputAuthorityRefs', 'attemptRecordHash'
    ], 'INVALID_SUCCESS_ATTEMPT', 'successful attempt');
  } else if (status === 'FAILED' || status === 'BLOCKED') {
    exactObjectKeys(attempt, [
      'contractVersion', 'jobId', 'attemptNumber', 'startedAt', 'attemptId', 'status', 'authorityClaim',
      'completedAt', 'durationMs', 'failure', 'attemptRecordHash'
    ], 'INVALID_FAILURE_RECORD', 'failed/blocked attempt');
  } else {
    throw new OperationalJobError('INVALID_ATTEMPT_STATUS', `unsupported attempt status ${status}`);
  }

  const base = attemptBase({ jobId, attemptNumber: expectedNumber, startedAt: attempt.startedAt });
  const expectedAttemptId = semanticHash('OperationalJobAttempt', base);
  if (attempt.attemptId !== expectedAttemptId || attempt.jobId !== jobId || attempt.attemptNumber !== expectedNumber) {
    throw new OperationalJobError('ATTEMPT_IDENTITY_MISMATCH', 'attempt identity is not reproducible');
  }
  const { attemptRecordHash, ...recordBasis } = attempt;
  if (semanticHash('OperationalJobAttemptRecord', recordBasis) !== attemptRecordHash) {
    throw new OperationalJobError('ATTEMPT_RECORD_HASH_MISMATCH', 'attempt record hash is not reproducible');
  }
  if (attempt.authorityClaim !== OPERATIONAL_NON_AUTHORITY_CLAIM) {
    throw new OperationalJobError('INVALID_OPERATIONAL_AUTHORITY_CLAIM', 'operational attempt must remain non-authority');
  }
  if (attempt.status === 'RUNNING') return deepFreeze(cloneCanonicalValue(attempt));
  if (!TERMINAL_STATUS_SET.has(attempt.status)) {
    throw new OperationalJobError('INVALID_ATTEMPT_STATUS', `unsupported attempt status ${attempt.status}`);
  }
  timestamp(attempt.completedAt, 'attempt.completedAt');
  if (!Number.isInteger(attempt.durationMs) || attempt.durationMs < 0
    || attempt.durationMs !== durationMs(attempt.startedAt, attempt.completedAt)) {
    throw new OperationalJobError('INVALID_ATTEMPT_DURATION', 'attempt duration is invalid');
  }
  if (attempt.status === 'SUCCEEDED') {
    const canonicalRefs = canonicalAuthorityRefs(attempt.outputAuthorityRefs, 'attempt.outputAuthorityRefs');
    if (!sameCanonicalValue(attempt.outputAuthorityRefs, canonicalRefs, 'OperationalOutputAuthorityRefs')) {
      throw new OperationalJobError('NONCANONICAL_OUTPUT_AUTHORITY_REFS', 'successful attempt output refs must use canonical unique ordering');
    }
  } else {
    validateFailureRecord(attempt.failure);
  }
  return deepFreeze(cloneCanonicalValue(attempt));
}

function validateAttemptHistory(attempts) {
  for (let index = 0; index < attempts.length - 1; index += 1) {
    const attempt = attempts[index];
    if ((attempt.status !== 'FAILED' && attempt.status !== 'BLOCKED') || attempt.failure.retryable !== true) {
      throw new OperationalJobError(
        'INVALID_RETRY_HISTORY',
        'only retryable failed/blocked attempts may have a later attempt in restored history'
      );
    }
  }
}

function snapshotPayload(entries) {
  return {
    snapshotVersion: PILOT_OPERATIONAL_JOURNAL_SNAPSHOT_VERSION,
    authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM,
    jobs: entries
  };
}

export class OperationalJobJournal {
  #jobs = new Map();
  #idempotency = new Map();

  constructor(snapshot = null) {
    if (snapshot !== null) this.#restore(snapshot);
  }

  #restore(snapshot) {
    exactObjectKeys(snapshot, ['snapshotVersion', 'authorityClaim', 'jobs', 'snapshotHash'], 'INVALID_JOURNAL_SNAPSHOT', 'journal snapshot');
    if (snapshot.snapshotVersion !== PILOT_OPERATIONAL_JOURNAL_SNAPSHOT_VERSION
      || snapshot.authorityClaim !== OPERATIONAL_NON_AUTHORITY_CLAIM
      || !Array.isArray(snapshot.jobs)) {
      throw new OperationalJobError('INVALID_JOURNAL_SNAPSHOT', 'invalid operational journal snapshot');
    }
    const { snapshotHash, ...basis } = snapshot;
    if (semanticHash('OperationalJobJournalSnapshot', basis) !== snapshotHash) {
      throw new OperationalJobError('JOURNAL_SNAPSHOT_HASH_MISMATCH', 'operational journal snapshot hash is not reproducible');
    }
    for (const entry of snapshot.jobs) {
      exactObjectKeys(entry, ['job', 'attempts'], 'INVALID_JOURNAL_JOB_ENTRY', 'journal job entry');
      if (!Array.isArray(entry.attempts)) {
        throw new OperationalJobError('INVALID_JOURNAL_JOB_ENTRY', 'journal job entry must contain attempts');
      }
      const job = validateJobSpec(entry.job);
      if (this.#jobs.has(job.jobId)) throw new OperationalJobError('DUPLICATE_JOB_ID', `duplicate job ${job.jobId}`);
      const prior = this.#idempotency.get(job.idempotencyScopeHash);
      if (prior && prior !== job.jobId) {
        throw new OperationalJobError('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_INPUTS', 'snapshot reuses idempotency key with different job semantics');
      }
      const attempts = entry.attempts.map((attempt, index) => validateAttempt(attempt, job.jobId, index + 1));
      validateAttemptHistory(attempts);
      if (attempts.filter((attempt) => attempt.status === 'RUNNING').length > 1
        || (attempts.some((attempt) => attempt.status === 'RUNNING') && attempts.at(-1).status !== 'RUNNING')) {
        throw new OperationalJobError('INVALID_ACTIVE_ATTEMPT_HISTORY', 'only the final attempt may remain running');
      }
      const successes = attempts.filter((attempt) => attempt.status === 'SUCCEEDED');
      if (successes.length > 1 || (successes.length === 1 && attempts.at(-1).status !== 'SUCCEEDED')) {
        throw new OperationalJobError('INVALID_SUCCESS_HISTORY', 'a successful job is terminal and may have only one successful attempt');
      }
      this.#jobs.set(job.jobId, { job, attempts: [...attempts] });
      this.#idempotency.set(job.idempotencyScopeHash, job.jobId);
    }
  }

  ensureJob(input) {
    const job = createOperationalJobSpec(input);
    const existingForKey = this.#idempotency.get(job.idempotencyScopeHash);
    if (existingForKey && existingForKey !== job.jobId) {
      throw new OperationalJobError(
        'IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_INPUTS',
        'same scoped idempotency key cannot be rebound to different operational inputs'
      );
    }
    const existing = this.#jobs.get(job.jobId);
    if (existing) return existing.job;
    this.#jobs.set(job.jobId, { job, attempts: [] });
    this.#idempotency.set(job.idempotencyScopeHash, job.jobId);
    return job;
  }

  getJob(jobId) {
    const normalizedId = requiredText(jobId, 'jobId');
    const entry = this.#jobs.get(normalizedId);
    if (!entry) throw new OperationalJobError('JOB_NOT_FOUND', `operational job ${normalizedId} not found`);
    return deepFreeze({ job: entry.job, attempts: deepFreeze(entry.attempts.map((attempt) => attempt)) });
  }

  beginAttempt({ jobId, startedAt }) {
    const entry = this.#jobs.get(requiredText(jobId, 'jobId'));
    if (!entry) throw new OperationalJobError('JOB_NOT_FOUND', `operational job ${jobId} not found`);
    const last = entry.attempts.at(-1);
    if (last?.status === 'RUNNING') {
      throw new OperationalJobError('ACTIVE_ATTEMPT_EXISTS', 'cannot start another attempt while one remains running');
    }
    if (last?.status === 'SUCCEEDED') {
      throw new OperationalJobError('JOB_ALREADY_SUCCEEDED', 'successful operational job is terminal');
    }
    const attempt = runningAttempt({
      jobId: entry.job.jobId,
      attemptNumber: entry.attempts.length + 1,
      startedAt
    });
    entry.attempts.push(attempt);
    return attempt;
  }

  succeedAttempt({ jobId, attemptId, completedAt, outputAuthorityRefs = [] }) {
    const entry = this.#jobs.get(requiredText(jobId, 'jobId'));
    if (!entry) throw new OperationalJobError('JOB_NOT_FOUND', `operational job ${jobId} not found`);
    const index = entry.attempts.findIndex((attempt) => attempt.attemptId === attemptId);
    if (index < 0) throw new OperationalJobError('ATTEMPT_NOT_FOUND', `attempt ${attemptId} not found`);
    const attempt = entry.attempts[index];
    if (attempt.status !== 'RUNNING') {
      throw new OperationalJobError('ATTEMPT_ALREADY_TERMINAL', 'terminal attempt cannot be overwritten');
    }
    if (index !== entry.attempts.length - 1) {
      throw new OperationalJobError('ATTEMPT_ORDER_VIOLATION', 'only the active final attempt may complete');
    }
    const completed = terminalSuccess(attempt, completedAt, outputAuthorityRefs);
    entry.attempts[index] = completed;
    return completed;
  }

  failAttempt({ jobId, attemptId, completedAt, error }) {
    const entry = this.#jobs.get(requiredText(jobId, 'jobId'));
    if (!entry) throw new OperationalJobError('JOB_NOT_FOUND', `operational job ${jobId} not found`);
    const index = entry.attempts.findIndex((attempt) => attempt.attemptId === attemptId);
    if (index < 0) throw new OperationalJobError('ATTEMPT_NOT_FOUND', `attempt ${attemptId} not found`);
    const attempt = entry.attempts[index];
    if (attempt.status !== 'RUNNING') {
      throw new OperationalJobError('ATTEMPT_ALREADY_TERMINAL', 'terminal attempt cannot be overwritten');
    }
    if (index !== entry.attempts.length - 1) {
      throw new OperationalJobError('ATTEMPT_ORDER_VIOLATION', 'only the active final attempt may complete');
    }
    const completed = terminalFailure(attempt, completedAt, error);
    entry.attempts[index] = completed;
    return completed;
  }

  recoverInterruptedAttempts({ recoveredAt }) {
    const recovered = timestamp(recoveredAt, 'recoveredAt');
    const recoveredAttempts = [];
    for (const entry of this.#jobs.values()) {
      const last = entry.attempts.at(-1);
      if (!last || last.status !== 'RUNNING') continue;
      const failed = terminalFailure(last, recovered, new OperationalFailure({
        failureClass: 'PLATFORM_TRANSIENT_FAILURE',
        code: 'ATTEMPT_INTERRUPTED',
        message: 'attempt was interrupted before a terminal operational record was persisted',
        retryable: true
      }));
      entry.attempts[entry.attempts.length - 1] = failed;
      recoveredAttempts.push(failed);
    }
    return deepFreeze(recoveredAttempts);
  }

  exportSnapshot() {
    const jobs = [...this.#jobs.values()]
      .map((entry) => ({ job: entry.job, attempts: entry.attempts }))
      .sort((a, b) => (a.job.jobId < b.job.jobId ? -1 : a.job.jobId > b.job.jobId ? 1 : 0));
    const basis = snapshotPayload(cloneCanonicalValue(jobs));
    return deepFreeze({
      ...basis,
      snapshotHash: semanticHash('OperationalJobJournalSnapshot', basis)
    });
  }
}

function successfulAttempt(entry) {
  const last = entry.attempts.at(-1);
  return last?.status === 'SUCCEEDED' ? last : null;
}

export async function executeOperationalJob({
  journal,
  job,
  startedAt,
  completedAt,
  executor
}) {
  if (!(journal instanceof OperationalJobJournal)) {
    throw new OperationalJobError('INVALID_JOB_JOURNAL', 'journal must be an OperationalJobJournal');
  }
  if (typeof executor !== 'function') {
    throw new OperationalJobError('INVALID_JOB_EXECUTOR', 'executor must be a function');
  }
  const spec = journal.ensureJob(job);
  const current = journal.getJob(spec.jobId);
  const succeeded = successfulAttempt(current);
  if (succeeded) {
    return deepFreeze({
      disposition: 'REPLAYED_SUCCESS',
      job: spec,
      attempt: succeeded,
      authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
    });
  }
  const last = current.attempts.at(-1);
  if ((last?.status === 'FAILED' || last?.status === 'BLOCKED') && last.failure.retryable !== true) {
    return deepFreeze({
      disposition: 'RETRY_BLOCKED_NON_RETRYABLE',
      job: spec,
      attempt: last,
      authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
    });
  }
  const attempt = journal.beginAttempt({ jobId: spec.jobId, startedAt });
  try {
    const result = await executor(deepFreeze({
      job: spec,
      attempt,
      executionIdempotencyKey: spec.jobId
    }));
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new OperationalFailure({
        failureClass: 'PLATFORM_PERMANENT_FAILURE',
        code: 'INVALID_EXECUTOR_RESULT',
        message: 'executor must return an object',
        retryable: false
      });
    }
    const completed = journal.succeedAttempt({
      jobId: spec.jobId,
      attemptId: attempt.attemptId,
      completedAt,
      outputAuthorityRefs: result.outputAuthorityRefs ?? []
    });
    return deepFreeze({
      disposition: 'EXECUTED_SUCCESS',
      job: spec,
      attempt: completed,
      authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
    });
  } catch (error) {
    const completed = journal.failAttempt({
      jobId: spec.jobId,
      attemptId: attempt.attemptId,
      completedAt,
      error
    });
    return deepFreeze({
      disposition: completed.status === 'BLOCKED' ? 'EXECUTED_BLOCKED' : 'EXECUTED_FAILURE',
      job: spec,
      attempt: completed,
      authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM
    });
  }
}

function traceAttempt(attempt) {
  const base = {
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt
  };
  if (attempt.status === 'RUNNING') return base;
  const terminal = {
    ...base,
    completedAt: attempt.completedAt,
    durationMs: attempt.durationMs
  };
  if (attempt.status === 'SUCCEEDED') terminal.outputAuthorityRefs = attempt.outputAuthorityRefs;
  else terminal.failure = {
    failureClass: attempt.failure.failureClass,
    code: attempt.failure.code,
    retryable: attempt.failure.retryable
  };
  return terminal;
}

export function projectOperationalTrace({ journal, jobId }) {
  if (!(journal instanceof OperationalJobJournal)) {
    throw new OperationalJobError('INVALID_JOB_JOURNAL', 'journal must be an OperationalJobJournal');
  }
  const entry = journal.getJob(jobId);
  const trace = {
    traceKind: 'NON_AUTHORITY_OPERATIONAL_TRACE',
    authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM,
    organizationId: entry.job.organizationId,
    tenantId: entry.job.tenantId,
    jobId: entry.job.jobId,
    operation: entry.job.operation,
    inputAuthorityRefs: entry.job.inputAuthorityRefs,
    attempts: entry.attempts.map(traceAttempt)
  };
  return deepFreeze({
    ...trace,
    traceHash: semanticHash('OperationalTrace', trace)
  });
}

export function summarizeOperationalTraces(traces) {
  if (!Array.isArray(traces)) {
    throw new OperationalJobError('INVALID_OPERATIONAL_TRACES', 'traces must be an array');
  }
  if (traces.length === 0) {
    const empty = {
      metricKind: 'NON_AUTHORITY_OPERATIONAL_METRICS',
      authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM,
      organizationId: null,
      tenantId: null,
      jobCount: 0,
      attemptCount: 0,
      succeededJobCount: 0,
      failedAttemptCountByClass: {},
      blockedAttemptCountByClass: {}
    };
    return deepFreeze({ ...empty, metricsHash: semanticHash('OperationalMetrics', empty) });
  }
  const first = traces[0];
  const organizationId = requiredText(first.organizationId, 'trace.organizationId');
  const tenantId = optionalText(first.tenantId, 'trace.tenantId');
  let attemptCount = 0;
  let succeededJobCount = 0;
  const failedAttemptCountByClass = {};
  const blockedAttemptCountByClass = {};
  for (const trace of traces) {
    if (!trace || trace.traceKind !== 'NON_AUTHORITY_OPERATIONAL_TRACE'
      || trace.authorityClaim !== OPERATIONAL_NON_AUTHORITY_CLAIM
      || trace.organizationId !== organizationId || trace.tenantId !== tenantId) {
      throw new OperationalJobError('CROSS_TENANT_OBSERVABILITY_FORBIDDEN', 'operational metrics cannot combine different organization/tenant scopes');
    }
    const { traceHash, ...traceBasis } = trace;
    if (semanticHash('OperationalTrace', traceBasis) !== traceHash) {
      throw new OperationalJobError('TRACE_HASH_MISMATCH', 'operational trace hash is not reproducible');
    }
    attemptCount += trace.attempts.length;
    if (trace.attempts.at(-1)?.status === 'SUCCEEDED') succeededJobCount += 1;
    for (const attempt of trace.attempts) {
      if (attempt.status === 'FAILED') {
        failedAttemptCountByClass[attempt.failure.failureClass] = (failedAttemptCountByClass[attempt.failure.failureClass] ?? 0) + 1;
      } else if (attempt.status === 'BLOCKED') {
        blockedAttemptCountByClass[attempt.failure.failureClass] = (blockedAttemptCountByClass[attempt.failure.failureClass] ?? 0) + 1;
      }
    }
  }
  const metrics = {
    metricKind: 'NON_AUTHORITY_OPERATIONAL_METRICS',
    authorityClaim: OPERATIONAL_NON_AUTHORITY_CLAIM,
    organizationId,
    tenantId,
    jobCount: traces.length,
    attemptCount,
    succeededJobCount,
    failedAttemptCountByClass,
    blockedAttemptCountByClass
  };
  return deepFreeze({
    ...metrics,
    metricsHash: semanticHash('OperationalMetrics', metrics)
  });
}
