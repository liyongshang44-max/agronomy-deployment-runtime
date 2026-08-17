import assert from 'node:assert/strict';
import {
  V03_COMMERCIAL_VALIDATION,
  V03_RELEASE_NON_AUTHORITY,
  V03_RELEASE_STATUS,
  createNonGeoxPilotWorld,
  createOperationalPilotEvidence,
  createRecoveryAndSloEvidence,
  createReviewMeasurementEvidence,
  createTenantStorageEvidence,
  createV03IntegratedReleaseEvidence,
  toWireRef
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function sameRef(left, right) {
  return left.kind === right.kind
    && left.logicalId === right.logicalId
    && left.version === right.version
    && left.semanticHash === right.semanticHash;
}

test('non-GEOX design-partner context traverses P02/P03 into the exact Gate-A Workbench path', async () => {
  const evidence = await createNonGeoxPilotWorld('positive-nongeox');
  assert.equal(evidence.request.path, '/v1/context-data');
  assert.equal(evidence.request.body.resource.semantic_id, 'crop.code');
  assert.equal(evidence.providerDatum.semanticPayload.source.providerId, 'reference-field-platform');
  assert.deepEqual(evidence.response.ref, toWireRef(evidence.providerDatum.ref));
  assert.equal(evidence.world.assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(evidence.world.workbenchCase.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(evidence.world.workbenchCase.reviewRequired, false);
});

test('P06 operational envelope binds the exact pilot authority backbone and exact retry replays without redispatch', async () => {
  const nonGeox = await createNonGeoxPilotWorld('positive-p06');
  const operational = await createOperationalPilotEvidence(nonGeox.world, 'positive-p06');
  assert.equal(operational.result.disposition, 'EXECUTED_SUCCESS');
  assert.equal(operational.replay.disposition, 'REPLAYED_SUCCESS');
  assert.equal(operational.executorCalls, 1);
  assert.equal(operational.trace.authorityClaim, 'NONE_OPERATIONAL_METADATA_IS_NOT_DOMAIN_AUTHORITY');
  for (const expected of [
    nonGeox.world.env.release.ref,
    nonGeox.world.decision.ref,
    nonGeox.world.manifest.ref,
    nonGeox.world.assessment.ref
  ]) {
    assert.equal(operational.trace.inputAuthorityRefs.some((ref) => sameRef(ref, expected)), true);
  }
  assert.equal(operational.trace.attempts.length, 1);
  assert.deepEqual(operational.trace.attempts[0].outputAuthorityRefs, [nonGeox.world.assessment.ref]);
});

test('P07 pilot artifact retention keeps the exact customer payload tenant-scoped', async () => {
  const nonGeox = await createNonGeoxPilotWorld('positive-p07');
  const storage = createTenantStorageEvidence(nonGeox.providerMessage);
  assert.equal(storage.store.hasForScope(storage.scope, storage.retained.contentHash), true);
  assert.deepEqual(storage.store.getForScope(storage.scope, storage.retained.contentHash), storage.bytes);
  assert.equal(storage.store.hasForScope(
    { organizationId: 'org-a', tenantId: 'tenant-b' },
    storage.retained.contentHash
  ), false);
  assert.throws(
    () => storage.store.getForScope(
      { organizationId: 'org-a', tenantId: 'tenant-b' },
      storage.retained.contentHash
    ),
    (error) => error?.code === 'ARTIFACT_CONTENT_NOT_RETAINED'
  );
});

test('P08 recovers the exact Gate-A authority world and evaluates the same P06 pilot job inside SLO', async () => {
  const nonGeox = await createNonGeoxPilotWorld('positive-p08');
  const operational = await createOperationalPilotEvidence(nonGeox.world, 'positive-p08');
  const recovery = createRecoveryAndSloEvidence(nonGeox.world, operational);
  for (const expected of [
    nonGeox.world.decision.ref,
    nonGeox.world.manifest.ref,
    nonGeox.world.assessment.ref
  ]) {
    assert.deepEqual(recovery.restored.ledger.resolve(expected).ref, expected);
  }
  assert.equal(recovery.restored.report.semanticStateHash, recovery.checkpoint.semanticStateHash);
  assert.equal(recovery.slo.evaluation, 'PASS');
  assert.equal(recovery.slo.measurements.succeededJobs, 1);
  assert.equal(recovery.slo.measurements.successBasisPoints, 10000);
  assert.equal(recovery.slo.measurements.providerOutageCount, 0);
});

test('A11 pilot instrumentation measures expert review work without becoming authority or commercial proof', () => {
  const review = createReviewMeasurementEvidence();
  assert.equal(review.conflict.workbenchCase.classification, 'KNOWLEDGE_CONFLICT');
  assert.equal(review.conflict.workbenchCase.reviewRequired, true);
  assert.equal(review.measurement.measurementKind, 'NON_AUTHORITY_WORKFLOW_METRIC');
  assert.equal(review.measurement.durationMs, 120000);
  assert.equal(review.summary.metricKind, 'NON_AUTHORITY_WORKFLOW_SUMMARY');
  assert.equal(review.summary.reviewedCaseCount, 1);
  assert.equal(review.summary.totalReviewDurationMs, 120000);
  assert.equal(review.summary.classificationCounts.KNOWLEDGE_CONFLICT, 1);
});

test('integrated release evidence closes the exact v0.3 software slice as a paid-pilot candidate only', async () => {
  const release = await createV03IntegratedReleaseEvidence('positive-release');
  assert.equal(release.status, V03_RELEASE_STATUS);
  assert.equal(release.commercialValidation, V03_COMMERCIAL_VALIDATION);
  assert.equal(release.commercialValidation, 'NOT_ESTABLISHED');
  assert.equal(release.authorityClaim, V03_RELEASE_NON_AUTHORITY);
  assert.deepEqual(release.requiredClosure, [
    'GATE_A', 'MTL-A11', 'MTL-P01', 'MTL-P02', 'MTL-P03',
    'MTL-P06', 'MTL-P07', 'MTL-P08_PILOT_SUBSET'
  ]);
  assert.match(release.publicApiVersion, /pilot-v0\.3/);
  assert.equal(release.providerId, 'reference-field-platform');
  assert.equal(release.workbenchClassification, 'NO_REVIEW_CANDIDATE');
  assert.equal(release.recovery.slo.evaluation, 'PASS');
  assert.equal(release.operational.executorCalls, 1);
  assert.equal(release.consumed.authorityClaim, 'NONE_TRANSPORT_CONSUMER_ONLY');
  assert.equal(typeof release.releaseEvidenceHash, 'string');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`v0.3 paid-pilot integrated release acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
