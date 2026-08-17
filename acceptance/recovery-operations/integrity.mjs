import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  OperationalFailure,
  OperationalJobJournal,
  createOperationalJobSpec,
  projectOperationalTrace
} from '../../packages/operations/src/index.mjs';
import {
  RecoveryOperationsError,
  createAuthorityRecoveryCheckpoint,
  restoreAuthorityRecoveryCheckpoint,
  createPilotIncident,
  createDeploymentRollbackRecord,
  createPilotSloReport
} from '../../packages/recovery-operations/src/index.mjs';
import {
  createDeploymentEnvironment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';

let seq = 0;
function audit(id = 'integrity') {
  seq += 1;
  return {
    eventId: `p08-integrity-${id}-${seq}`,
    occurredAt: '2026-08-21T12:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'recovery-integrity' },
    details: { suite: 'p08-integrity' }
  };
}
function publishEvidence(ledger, kind, id, payload = { value: id }) {
  return ledger.publish({ kind, logicalId: id, version: '1', semanticPayload: payload, audit: audit(id) });
}
function traceEvidence({ inputRef, organizationId = 'org-a', tenantId = 'tenant-a', failureClass = 'PROVIDER_FAILURE', idempotencyKey = 'integrity-job' }) {
  const journal = new OperationalJobJournal();
  const job = createOperationalJobSpec({
    organizationId,
    tenantId,
    operation: 'P08_INTEGRITY_OPERATION',
    idempotencyKey,
    inputAuthorityRefs: [inputRef]
  });
  journal.ensureJob(job);
  const attempt = journal.beginAttempt({ jobId: job.jobId, startedAt: '2026-08-21T12:00:00.000Z' });
  journal.failAttempt({
    jobId: job.jobId,
    attemptId: attempt.attemptId,
    completedAt: '2026-08-21T12:00:00.100Z',
    error: new OperationalFailure({
      failureClass,
      code: `P08_${failureClass}`,
      retryable: failureClass === 'PROVIDER_FAILURE'
    })
  });
  return {
    trace: projectOperationalTrace({ journal, jobId: job.jobId }),
    journalSnapshot: journal.exportSnapshot()
  };
}
function recoveryStateHash(snapshot) {
  return semanticHash('AuthorityLedgerRecoveryState', {
    records: snapshot.records,
    lineage: snapshot.lineage,
    auditEventHashes: snapshot.audit.map((event) => event.eventHash).sort()
  });
}
function resealCheckpoint(checkpoint, snapshot) {
  const basis = {
    contractVersion: checkpoint.contractVersion,
    capturedAt: checkpoint.capturedAt,
    snapshot,
    snapshotHash: semanticHash('AuthorityLedgerRecoverySnapshot', snapshot),
    semanticStateHash: recoveryStateHash(snapshot),
    authorityClaim: checkpoint.authorityClaim
  };
  return {
    ...basis,
    checkpointHash: semanticHash('AuthorityRecoveryCheckpoint', basis)
  };
}

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

await test('recomputed outer checkpoint hashes cannot hide mutated authority semantics', () => {
  const ledger = new AuthorityLedger();
  publishEvidence(ledger, 'RecoveryFixture', 'checkpoint-mutation', { amount: '10' });
  const checkpoint = createAuthorityRecoveryCheckpoint({ ledger, capturedAt: '2026-08-21T12:01:00Z' });
  const snapshot = structuredClone(checkpoint.snapshot);
  snapshot.records[0].semanticPayload.amount = '999';
  const forged = resealCheckpoint(checkpoint, snapshot);
  assert.throws(
    () => restoreAuthorityRecoveryCheckpoint(forged),
    (error) => error instanceof RecoveryOperationsError && error.code === 'RECOVERY_RECORD_HASH_MISMATCH'
  );
});

await test('recovery snapshot payload widening fails closed even with recomputed envelope hashes', () => {
  const ledger = new AuthorityLedger();
  publishEvidence(ledger, 'RecoveryFixture', 'checkpoint-widen', { amount: '10' });
  const checkpoint = createAuthorityRecoveryCheckpoint({ ledger, capturedAt: '2026-08-21T12:02:00Z' });
  const snapshot = structuredClone(checkpoint.snapshot);
  snapshot.records[0].injectedRestoreAuthority = true;
  const forged = resealCheckpoint(checkpoint, snapshot);
  assert.throws(
    () => restoreAuthorityRecoveryCheckpoint(forged),
    (error) => error instanceof RecoveryOperationsError && error.code === 'RECOVERY_PAYLOAD_WIDENING_FORBIDDEN'
  );
});

await test('self-consistent tampered trace hash cannot override retained P06 journal failure classification', () => {
  const ledger = new AuthorityLedger();
  const input = publishEvidence(ledger, 'ContextDatum', 'trace-tamper');
  const evidence = traceEvidence({ inputRef: input.ref, failureClass: 'PROVIDER_FAILURE', idempotencyKey: 'trace-tamper' });
  const forgedTrace = structuredClone(evidence.trace);
  forgedTrace.attempts[0].failure.failureClass = 'PLATFORM_PERMANENT_FAILURE';
  const { traceHash: _oldHash, ...basis } = forgedTrace;
  forgedTrace.traceHash = semanticHash('OperationalTrace', basis);
  assert.throws(
    () => createPilotIncident({
      ledger,
      incidentId: 'incident.trace-tamper',
      occurredAt: '2026-08-21T12:03:00Z',
      operationalTraceEvidence: { trace: forgedTrace, journalSnapshot: evidence.journalSnapshot },
      decisionResultRef: null
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'OPERATIONAL_TRACE_REPLAY_MISMATCH'
  );
});

await test('SLO refuses cross-tenant evidence aggregation', () => {
  const ledger = new AuthorityLedger();
  const input = publishEvidence(ledger, 'OperationalEvidence', 'slo-cross-tenant');
  const a = traceEvidence({ inputRef: input.ref, organizationId: 'org-a', tenantId: 'tenant-a', idempotencyKey: 'slo-a' });
  const b = traceEvidence({ inputRef: input.ref, organizationId: 'org-a', tenantId: 'tenant-b', idempotencyKey: 'slo-b' });
  assert.throws(
    () => createPilotSloReport({
      traceEvidence: [a, b],
      windowStart: '2026-08-21T12:00:00Z',
      windowEnd: '2026-08-21T13:00:00Z',
      objectives: { successTargetBasisPoints: 0, maxP95DurationMs: 1000, maxProviderOutageCount: 10 }
    }),
    (error) => error?.code === 'CROSS_TENANT_OBSERVABILITY_FORBIDDEN'
  );
});

await test('rollback API rejects semantic feature/model/policy override fields before operational execution', () => {
  assert.throws(
    () => createDeploymentRollbackRecord({
      ledger: {},
      deploymentRef: {},
      suspendControlRef: {},
      incident: {},
      preservedAuthorityRefs: [],
      occurredAt: '2026-08-21T12:04:00Z',
      featureFlags: { replacePolicy: true }
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'RECOVERY_SEMANTIC_OVERRIDE_FORBIDDEN'
  );
});

await test('rollback cannot be declared before exact Deployment SUSPEND authority exists', () => {
  const env = createDeploymentEnvironment('p08-no-suspend');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.p08.no-suspend' });
  const evidence = traceEvidence({ inputRef: deployment.ref, idempotencyKey: 'no-suspend' });
  const incident = createPilotIncident({
    ledger: env.ledger,
    incidentId: 'incident.no-suspend',
    occurredAt: '2026-08-21T12:05:00Z',
    operationalTraceEvidence: evidence,
    decisionResultRef: null
  });
  assert.throws(
    () => createDeploymentRollbackRecord({
      ledger: env.ledger,
      deploymentRef: deployment.ref,
      suspendControlRef: deployment.ref,
      incident,
      preservedAuthorityRefs: [deployment.ref],
      occurredAt: '2026-08-21T12:06:00Z'
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'ROLLBACK_REQUIRES_EXACT_SUSPEND_CONTROL'
  );
});

await test('generic self-authored DecisionResult named ABSTAIN cannot become P08 incident evidence', () => {
  const ledger = new AuthorityLedger();
  const forged = ledger.publish({
    kind: 'DecisionResult',
    logicalId: 'forged-abstain',
    version: '1',
    semanticPayload: { decisionDisposition: 'ABSTAIN' },
    audit: audit('forged-abstain')
  });
  assert.throws(
    () => createPilotIncident({
      ledger,
      incidentId: 'incident.forged-abstain',
      occurredAt: '2026-08-21T12:07:00Z',
      operationalTraceEvidence: null,
      decisionResultRef: forged.ref
    }),
    (error) => error?.code !== 'NO_INCIDENT_EVIDENCE'
  );
});

await test('historical trace cannot be relabeled into another SLO window', () => {
  const ledger = new AuthorityLedger();
  const input = publishEvidence(ledger, 'OperationalEvidence', 'slo-window');
  const evidence = traceEvidence({ inputRef: input.ref, idempotencyKey: 'slo-window' });
  assert.throws(
    () => createPilotSloReport({
      traceEvidence: [evidence],
      windowStart: '2026-08-21T13:00:00Z',
      windowEnd: '2026-08-21T14:00:00Z',
      objectives: { successTargetBasisPoints: 0, maxP95DurationMs: 1000, maxProviderOutageCount: 10 }
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'SLO_TRACE_OUTSIDE_WINDOW'
  );
});

await test('rollback rejects an incident from another tenant even before control selection', () => {
  const env = createDeploymentEnvironment('p08-cross-tenant-rollback');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.p08.cross-tenant' });
  const evidence = traceEvidence({
    inputRef: deployment.ref,
    organizationId: 'org-a',
    tenantId: 'tenant-b',
    idempotencyKey: 'cross-tenant-rollback'
  });
  const incident = createPilotIncident({
    ledger: env.ledger,
    incidentId: 'incident.cross-tenant-rollback',
    occurredAt: '2026-08-21T12:08:00Z',
    operationalTraceEvidence: evidence,
    decisionResultRef: null
  });
  assert.throws(
    () => createDeploymentRollbackRecord({
      ledger: env.ledger,
      deploymentRef: deployment.ref,
      suspendControlRef: deployment.ref,
      incident,
      preservedAuthorityRefs: [deployment.ref],
      occurredAt: '2026-08-21T12:09:00Z'
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'ROLLBACK_INCIDENT_SCOPE_MISMATCH'
  );
});

await test('SLO cannot count the same exact operational job twice', () => {
  const ledger = new AuthorityLedger();
  const input = publishEvidence(ledger, 'OperationalEvidence', 'slo-duplicate');
  const evidence = traceEvidence({ inputRef: input.ref, idempotencyKey: 'slo-duplicate' });
  assert.throws(
    () => createPilotSloReport({
      traceEvidence: [evidence, evidence],
      windowStart: '2026-08-21T12:00:00Z',
      windowEnd: '2026-08-21T13:00:00Z',
      objectives: { successTargetBasisPoints: 0, maxP95DurationMs: 1000, maxProviderOutageCount: 10 }
    }),
    (error) => error instanceof RecoveryOperationsError && error.code === 'DUPLICATE_SLO_JOB_EVIDENCE'
  );
});

console.log(`P08 pilot recovery/SLO integrity acceptance: ${passed} passed`);
