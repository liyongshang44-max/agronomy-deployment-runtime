import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_API_OPERATIONS } from '../../packages/public-api/src/index.mjs';
import { createWorkbenchWorld } from '../workbench/fixture.mjs';
import {
  V03_COMMERCIAL_VALIDATION,
  V03_RELEASE_NON_AUTHORITY,
  V03_RELEASE_STATUS,
  createNonGeoxPilotWorld,
  createOperationalPilotEvidence,
  createRecoveryAndSloEvidence,
  createTenantStorageEvidence,
  createV03IntegratedReleaseEvidence,
  releaseOperationalNonclaims
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const FORBIDDEN_RUNTIME_KINDS = [
  'RuntimeEligibility',
  'RuntimeBinding',
  'DecisionRobustness',
  'DecisionResult'
];

test('v0.3 integrated pilot path does not require or fabricate Gate-D decision authority', async () => {
  const nonGeox = await createNonGeoxPilotWorld('integrity-no-gate-d');
  const kinds = new Set(nonGeox.world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind));
  assert.equal(kinds.has('ApplicabilityAssessment'), true);
  for (const forbidden of FORBIDDEN_RUNTIME_KINDS) assert.equal(kinds.has(forbidden), false, forbidden);
  assert.equal(nonGeox.world.workbenchCase.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(nonGeox.world.workbenchCase.reviewRequired, false);
});

test('v0.3 public product surface exposes Gate-A pilot operations without recommendation or DecisionResult contracts', () => {
  const serialized = JSON.stringify(PUBLIC_API_OPERATIONS);
  for (const forbidden of FORBIDDEN_RUNTIME_KINDS) assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(serialized.toUpperCase().includes('RECOMMENDATION'), false);
  assert.equal(PUBLIC_API_OPERATIONS.some((operation) => operation.operationId === 'getAgronomistWorkbenchCase'), true);
  assert.equal(PUBLIC_API_OPERATIONS.some((operation) => operation.operationId === 'listAgronomistEscalations'), true);
});

test('integrated release fixture remains non-GEOX so optional P04 cannot replace required P03', () => {
  const fixtureSource = readFileSync(new URL('./fixture.mjs', import.meta.url), 'utf8');
  assert.equal(fixtureSource.includes('adapters/geox'), false);
  assert.equal(fixtureSource.includes('REFERENCE_FIELD_PLATFORM_ID'), true);
  assert.equal(fixtureSource.includes('createReferenceFieldPlatformContextProvider'), true);
});

test('P06/P07/P08 operational substrate cannot mutate the exact Workbench classification or authority ledger', async () => {
  const nonGeox = await createNonGeoxPilotWorld('integrity-operational-nonclaim');
  const before = nonGeox.world.env.ledger.exportSnapshot();
  const caseHash = nonGeox.world.workbenchCase.caseProjectionHash;
  const classification = nonGeox.world.workbenchCase.classification;
  const operational = await createOperationalPilotEvidence(nonGeox.world, 'integrity-operational-nonclaim');
  createTenantStorageEvidence(nonGeox.providerMessage);
  createRecoveryAndSloEvidence(nonGeox.world, operational);
  const after = nonGeox.world.env.ledger.exportSnapshot();
  assert.deepEqual(after, before);
  assert.equal(nonGeox.world.workbenchCase.caseProjectionHash, caseHash);
  assert.equal(nonGeox.world.workbenchCase.classification, classification);
  const nonclaims = releaseOperationalNonclaims();
  assert.equal(nonclaims.release, V03_RELEASE_NON_AUTHORITY);
  assert.match(nonclaims.operations, /^NONE_/);
  assert.match(nonclaims.security, /^NONE_/);
  assert.match(nonclaims.recovery, /^NONE_/);
});

test('unknown and conflict cases remain expert-review cases regardless of release qualification', () => {
  const gap = createWorkbenchWorld('v03-release-gap', { includeCrop: false });
  const conflict = createWorkbenchWorld('v03-release-conflict', { crop: 'wheat' });
  assert.equal(gap.workbenchCase.classification, 'CONTEXT_GAP');
  assert.equal(gap.workbenchCase.reviewRequired, true);
  assert.equal(conflict.workbenchCase.classification, 'KNOWLEDGE_CONFLICT');
  assert.equal(conflict.workbenchCase.reviewRequired, true);
  for (const world of [gap, conflict]) {
    const kinds = new Set(world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind));
    for (const forbidden of FORBIDDEN_RUNTIME_KINDS) assert.equal(kinds.has(forbidden), false, forbidden);
  }
});

test('release qualification is software readiness only and cannot self-assert commercial success', async () => {
  const release = await createV03IntegratedReleaseEvidence('integrity-commercial-nonclaim');
  assert.equal(release.status, V03_RELEASE_STATUS);
  assert.equal(release.status, 'PAID_DESIGN_PARTNER_PILOT_CANDIDATE');
  assert.equal(release.commercialValidation, V03_COMMERCIAL_VALIDATION);
  assert.equal(release.commercialValidation, 'NOT_ESTABLISHED');
  assert.equal(release.authorityClaim, V03_RELEASE_NON_AUTHORITY);
  for (const forbiddenKey of [
    'commercialGo',
    'paidContinuation',
    'paidExpansion',
    'yieldUplift',
    'profitUplift',
    'causalEffect',
    'recommendationCorrectness'
  ]) assert.equal(Object.hasOwn(release, forbiddenKey), false, forbiddenKey);
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
console.log(`v0.3 paid-pilot integrated release integrity: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
