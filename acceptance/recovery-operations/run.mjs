import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  OperationalFailure,
  OperationalJobJournal,
  createOperationalJobSpec,
  projectOperationalTrace
} from '../../packages/operations/src/index.mjs';
import {
  createAuthorityRecoveryCheckpoint,
  restoreAuthorityRecoveryCheckpoint,
  createPilotIncident,
  replayPilotIncident,
  createDeploymentRollbackRecord,
  verifyDeploymentRollbackRecord,
  createPilotSloReport,
  RECOVERY_OPERATIONS_NON_AUTHORITY
} from '../../packages/recovery-operations/src/index.mjs';
import { publishDeploymentControlDecision } from '../../packages/deployment/src/index.mjs';
import {
  audit as deploymentAudit,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  policyDecisionWorld,
  publishRobustness,
  publishResult
} from '../decision-result/fixture.mjs';

let seq = 0;
function audit(id = 'recovery') {
  seq += 1;
  return {
    eventId: `p08-${id}-${seq}`,
    occurredAt: '2026-08-21T10:00:00.000Z',
    actor: { type: 'SERVICE_ACCOUNT', id: 'recovery-service' },
    details: { suite: 'p08' }
  };
}
function publishEvidence(ledger, kind, id, payload = { value: id }) {
  return ledger.publish({ kind, logicalId: id, version: '1', semanticPayload: payload, audit: audit(id) });
}
function makeTraceEvidence({ inputRef, operation, idempotencyKey, outcome, failureClass = null, durationMs = 100 }) {
  const journal = new OperationalJobJournal();
  const job = createOperationalJobSpec({
    organizationId: 'org-a', tenantId: 'tenant-a', operation, idempotencyKey, inputAuthorityRefs: [inputRef]
  });
  journal.ensureJob(job);
  const startedAt = '2026-08-21T10:00:00.000Z';
  const completedAt = new Date(new Date(startedAt).getTime() + durationMs).toISOString();
  const attempt = journal.beginAttempt({ jobId: job.jobId, startedAt });
  if (outcome === 'SUCCEEDED') {
    journal.succeedAttempt({ jobId: job.jobId, attemptId: attempt.attemptId, completedAt, outputAuthorityRefs: [] });
  } else {
    journal.failAttempt({
      jobId: job.jobId,
      attemptId: attempt.attemptId,
      completedAt,
      error: new OperationalFailure({
        failureClass,
        code: `P08_${failureClass}`,
        retryable: failureClass === 'PROVIDER_FAILURE' || failureClass === 'PLATFORM_TRANSIENT_FAILURE'
      })
    });
  }
  return {
    trace: projectOperationalTrace({ journal, jobId: job.jobId }),
    journalSnapshot: journal.exportSnapshot()
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

await test('recovery checkpoint restores exact authority semantics lineage and audit identities into a fresh ledger', () => {
  const ledger = new AuthorityLedger();
  const old = publishEvidence(ledger, 'RecoveryFixture', 'fixture.old', { amount: '10' });
  const current = ledger.publish({
    kind: 'RecoveryFixture',
    logicalId: 'fixture.current',
    version: '1',
    semanticPayload: { amount: '11' },
    operationalMetadata: { runtimeSeenAt: '2026-08-21T09:59:00Z' },
    audit: { ...audit('current'), inputRefs: [old.ref] }
  });
  const lineage = ledger.addLineage({
    relation: 'replaces', from: current.ref, to: old.ref,
    details: { reason: 'P08_RECOVERY_FIXTURE' }, audit: audit('lineage')
  });
  const checkpoint = createAuthorityRecoveryCheckpoint({ ledger, capturedAt: '2026-08-21T10:01:00Z' });
  const restored = restoreAuthorityRecoveryCheckpoint(checkpoint);
  assert.notEqual(restored.ledger, ledger);
  assert.deepEqual(restored.ledger.resolve(old.ref), ledger.resolve(old.ref));
  assert.deepEqual(restored.ledger.resolve(current.ref), ledger.resolve(current.ref));
  assert.deepEqual(restored.ledger.lineageFor(current.ref), [lineage]);
  assert.deepEqual(
    restored.ledger.exportSnapshot().audit.map((event) => event.eventHash).sort(),
    ledger.exportSnapshot().audit.map((event) => event.eventHash).sort()
  );
  assert.equal(restored.report.semanticStateHash, checkpoint.semanticStateHash);
  assert.equal(restored.report.authorityClaim, RECOVERY_OPERATIONS_NON_AUTHORITY);
});

await test('provider outage incident is classified from replayed P06 journal evidence and exact authority refs', () => {
  const ledger = new AuthorityLedger();
  const evidence = publishEvidence(ledger, 'ContextDatum', 'provider-input');
  const operationalTraceEvidence = makeTraceEvidence({
    inputRef: evidence.ref, operation: 'CONTEXT_PROVIDER_FETCH', idempotencyKey: 'provider-1',
    outcome: 'FAILED', failureClass: 'PROVIDER_FAILURE', durationMs: 250
  });
  const incident = createPilotIncident({
    ledger, incidentId: 'incident.provider', occurredAt: '2026-08-21T10:02:00Z',
    operationalTraceEvidence, decisionResultRef: null
  });
  assert.equal(incident.classification, 'PROVIDER_OUTAGE');
  assert.equal(incident.transportDisposition.genericServerError, false);
  assert.equal(replayPilotIncident({ ledger, incident }).incidentHash, incident.incidentHash);
});

await test('failed operation with exact RuntimeBinding evidence is classified separately as runtime failure', () => {
  const ledger = new AuthorityLedger();
  const binding = publishEvidence(ledger, 'RuntimeBinding', 'runtime-binding.p08', { frozenRuntimeWorld: true });
  const operationalTraceEvidence = makeTraceEvidence({
    inputRef: binding.ref, operation: 'RUNTIME_EXECUTION', idempotencyKey: 'runtime-1',
    outcome: 'FAILED', failureClass: 'PLATFORM_PERMANENT_FAILURE', durationMs: 400
  });
  const incident = createPilotIncident({
    ledger, incidentId: 'incident.runtime', occurredAt: '2026-08-21T10:03:00Z',
    operationalTraceEvidence, decisionResultRef: null
  });
  assert.equal(incident.classification, 'RUNTIME_FAILURE');
});

await test('governed D06 ABSTAIN remains a domain disposition and is never classified as generic 500', () => {
  const world = policyDecisionWorld('p08-abstain');
  const robustness = publishRobustness(world, { executionStatus: 'FAILED', label: 'p08-abstain' });
  const decision = publishResult(world, robustness, 'p08-abstain');
  assert.equal(decision.semanticPayload.decisionDisposition, 'ABSTAIN');
  const incident = createPilotIncident({
    ledger: world.env.ledger,
    incidentId: 'incident.abstain',
    occurredAt: '2026-08-21T10:04:00Z',
    operationalTraceEvidence: null,
    decisionResultRef: decision.ref
  });
  assert.equal(incident.classification, 'DECISION_ABSTAIN');
  assert.equal(incident.transportDisposition.class, 'DOMAIN_DISPOSITION');
  assert.equal(incident.transportDisposition.genericServerError, false);
  assert.equal(replayPilotIncident({ ledger: world.env.ledger, incident }).incidentHash, incident.incidentHash);
});

await test('forward rollback requires exact Deployment SUSPEND and preserves historical Binding/Decision refs', () => {
  const env = createDeploymentEnvironment('p08-rollback');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.p08.rollback' });
  const binding = publishEvidence(env.ledger, 'RuntimeBinding', 'binding.p08.rollback', { immutable: 'binding' });
  const decision = publishEvidence(env.ledger, 'DecisionResult', 'decision.p08.rollback', { immutable: 'decision' });
  const operationalTraceEvidence = makeTraceEvidence({
    inputRef: deployment.ref, operation: 'CONTEXT_PROVIDER_FETCH', idempotencyKey: 'rollback-provider',
    outcome: 'FAILED', failureClass: 'PROVIDER_FAILURE', durationMs: 500
  });
  const incident = createPilotIncident({
    ledger: env.ledger, incidentId: 'incident.rollback', occurredAt: '2026-08-21T10:05:00Z',
    operationalTraceEvidence, decisionResultRef: null
  });
  const controlAuth = createDeploymentAuthorization(env, deployment.ref.logicalId, {
    deployment: deployment.semanticPayload,
    action: 'SUSPEND'
  });
  assert.equal(controlAuth.decision.allowed, true);
  const suspend = publishDeploymentControlDecision({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    version: '1',
    action: 'SUSPEND',
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: controlAuth.recorded.ref,
    reasonCodes: ['P08_PROVIDER_OUTAGE'],
    audit: deploymentAudit(env.deploymentManager.principalId)
  });
  const rollback = createDeploymentRollbackRecord({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    suspendControlRef: suspend.ref,
    incident,
    preservedAuthorityRefs: [binding.ref, decision.ref],
    occurredAt: '2026-08-21T10:06:00Z'
  });
  assert.equal(rollback.rollbackMode, 'FORWARD_SUSPEND_NO_DATABASE_REWIND');
  assert.equal(rollback.semanticMutationAllowed, false);
  const verified = verifyDeploymentRollbackRecord({ ledger: env.ledger, incident, rollbackRecord: rollback });
  assert.equal(verified.historicalAuthorityPreserved, true);
  assert.deepEqual(env.ledger.resolve(binding.ref).semanticPayload, { immutable: 'binding' });
  assert.deepEqual(env.ledger.resolve(decision.ref).semanticPayload, { immutable: 'decision' });
});

await test('pilot SLO separates governed BLOCKED cases from service errors and measures provider outage budget', () => {
  const ledger = new AuthorityLedger();
  const input = publishEvidence(ledger, 'OperationalEvidence', 'slo-input');
  const traceEvidence = [
    makeTraceEvidence({ inputRef: input.ref, operation: 'PILOT_CASE', idempotencyKey: 'slo-success', outcome: 'SUCCEEDED', durationMs: 100 }),
    makeTraceEvidence({ inputRef: input.ref, operation: 'PILOT_CASE', idempotencyKey: 'slo-provider', outcome: 'FAILED', failureClass: 'PROVIDER_FAILURE', durationMs: 250 }),
    makeTraceEvidence({ inputRef: input.ref, operation: 'PILOT_CASE', idempotencyKey: 'slo-blocked', outcome: 'FAILED', failureClass: 'SCIENTIFIC_INELIGIBILITY', durationMs: 50 })
  ];
  const report = createPilotSloReport({
    traceEvidence,
    windowStart: '2026-08-21T10:00:00Z',
    windowEnd: '2026-08-21T11:00:00Z',
    objectives: { successTargetBasisPoints: 5000, maxP95DurationMs: 300, maxProviderOutageCount: 1 }
  });
  assert.equal(report.measurements.totalJobs, 3);
  assert.equal(report.measurements.serviceEligibleJobs, 2);
  assert.equal(report.measurements.governedBlockedJobs, 1);
  assert.equal(report.measurements.failedJobs, 1);
  assert.equal(report.measurements.providerOutageCount, 1);
  assert.equal(report.measurements.successBasisPoints, 5000);
  assert.equal(report.measurements.p95DurationMs, 250);
  assert.equal(report.blockedCountsAreNotServiceErrors, true);
  assert.equal(report.evaluation, 'PASS');
  assert.equal(report.evidenceHashes.length, 3);
  assert.equal(report.authorityClaim, RECOVERY_OPERATIONS_NON_AUTHORITY);
});

console.log(`P08 pilot recovery/SLO positive acceptance: ${passed} passed`);
