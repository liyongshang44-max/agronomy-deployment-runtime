import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import * as Workbench from '../../packages/workbench/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment
} from '../../packages/authorization/src/index.mjs';
import { USE_APPLICABILITY } from '../derived-knowledge/fixture.mjs';
import {
  createInspectionAuthorization,
  createWorkbenchPrincipal,
  createWorkbenchWorld,
  projectCase,
  workbenchAudit
} from './fixture.mjs';

const {
  WORKBENCH_AUTHORITY_ACTIONS,
  projectAgronomistEscalationQueue,
  projectAgronomistWorkbenchCase
} = Workbench;

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function laterAudit(actor, suffix) {
  return {
    eventId: `a11-later-${suffix}`,
    occurredAt: '2026-08-23T10:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'agronomist-workbench-integrity' }
  };
}
function caseInput(world, workbenchCase = world.workbenchCase) {
  return { ledger: world.env.ledger, workbenchCase, sourceRegistry: world.env.sourceRegistry };
}

test('human workbench evidence view requires exact inspection authorization and cannot inherit runtime-use entitlement', () => {
  const world = createWorkbenchWorld('missing-inspection');
  assert.throws(() => projectCase(world, { inspectionAuthorizations: [] }));
  assert.equal(world.env.runtimeRole.semanticPayload.permissions.includes(PERMISSIONS.KNOWLEDGE_RUNTIME_USE), true);
  assert.equal(world.env.runtimeRole.semanticPayload.permissions.includes(PERMISSIONS.KNOWLEDGE_INSPECT), false);
});

test('knowledge.inspect without source.read cannot expose Source/Claim evidence in Agronomist Workbench', () => {
  const base = createWorkbenchWorld('inspect-only-base');
  const { principal, role } = createWorkbenchPrincipal(base, {
    principalId: 'inspect-only-a11',
    permissions: [PERMISSIONS.KNOWLEDGE_INSPECT]
  });
  assert.throws(() => createInspectionAuthorization(base, { principal, roleAssignments: [role] }),
    (error) => error?.code === 'WORKBENCH_SOURCE_READ_PERMISSION_DENIED');
});

test('same-tenant agronomist outside the exact Deployment program cannot mint A11 evidence access', () => {
  const world = createWorkbenchWorld('wrong-program-base');
  const { principal, role } = createWorkbenchPrincipal(world, {
    principalId: 'same-tenant-no-program-a11',
    programIds: [],
    permissions: [PERMISSIONS.KNOWLEDGE_INSPECT, PERMISSIONS.SOURCE_READ]
  });
  assert.throws(() => createInspectionAuthorization(world, { principal, roleAssignments: [role] }),
    (error) => error?.code === 'WORKBENCH_PROGRAM_ACCESS_DENIED');
});

test('inspection policy bound to the wrong knowledge resource cannot be used by A11', () => {
  const world = createWorkbenchWorld('wrong-policy');
  assert.throws(() => createInspectionAuthorization(world, {
    policyResourceId: 'agronomist-workbench-inspection:QualifiedKnowledge/wrong@1#sha256:wrong'
  }), (error) => error?.code === 'WORKBENCH_INSPECTION_POLICY_MISMATCH');
});

test('cross-tenant workbench principal can never read target Context merely because knowledge visibility is explicitly granted', () => {
  const world = createWorkbenchWorld('cross-tenant');
  const foreign = createPrincipal({
    principalId: 'foreign-agronomist-a11', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-b', programIds: ['pilot-a']
  });
  const role = publishRoleAssignment({
    ledger: world.env.ledger,
    logicalId: 'role.a11.foreign-explicit-target-scope', version: '1', principal: foreign,
    role: 'A11_FOREIGN_EXPLICIT_READER', roleDefinitionVersion: 'a11-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_INSPECT, PERMISSIONS.SOURCE_READ],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: workbenchAudit({ principalId: 'iam-admin', type: 'USER' }, 'foreign-role')
  });
  const inspection = createInspectionAuthorization(world, { principal: foreign, roleAssignments: [role], visibilityPrincipalId: foreign.principalId });
  assert.equal(inspection.decision.allowed, true);
  assert.throws(() => projectAgronomistWorkbenchCase({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: world.assessment.ref,
    workbenchPrincipal: foreign,
    inspectionAuthorizations: [{ knowledgeRef: world.assessment.semanticPayload.knowledgeRef, authorizationDecisionAuditRef: inspection.recorded.ref }],
    sourceRegistry: world.env.sourceRegistry
  }), (error) => error?.code === 'WORKBENCH_TARGET_CONTEXT_ACCESS_DENIED');
});

test('generic forged AuthorizationDecisionAudit with copied decision payload cannot mint A11 inspection access', () => {
  const world = createWorkbenchWorld('forged-auth');
  const forged = world.env.ledger.publish({
    kind: 'AuthorizationDecisionAudit', logicalId: 'forged-a11-auth', version: '1',
    semanticPayload: world.inspection.recorded.semanticPayload,
    audit: workbenchAudit({ principalId: 'attacker', type: 'USER' }, 'forged-auth')
  });
  assert.throws(() => projectCase(world, {
    inspectionAuthorizations: [{ knowledgeRef: world.assessment.semanticPayload.knowledgeRef, authorizationDecisionAuditRef: forged.ref }]
  }));
});

test('A11 public API exposes only authority-validating queue projectors, not raw hash-only queue builders', () => {
  assert.equal('buildAgronomistEscalationQueue' in Workbench, false);
  assert.equal('buildApplicabilityConflictQueue' in Workbench, false);
  assert.equal(typeof Workbench.projectAgronomistEscalationQueue, 'function');
  assert.equal(typeof Workbench.validateAgronomistWorkbenchCase, 'function');
});

test('queue rejects a forged case even when attacker recomputes a valid deterministic case hash', () => {
  const world = createWorkbenchWorld('forged-case');
  const { caseProjectionHash, ...basis } = world.workbenchCase;
  const forgedBasis = { ...basis, classification: 'AGRONOMIST_REVIEW_REQUIRED', reviewRequired: true, reasonCodes: ['FORGED_REVIEW_STATE'] };
  const forged = { ...forgedBasis, caseProjectionHash: semanticHash('AgronomistWorkbenchCaseProjection', forgedBasis) };
  assert.throws(() => projectAgronomistEscalationQueue({ caseInputs: [caseInput(world, forged)] }),
    (error) => error?.code === 'WORKBENCH_CASE_REPLAY_MISMATCH');
});

test('A11 case and validated queue projection are pure reads and do not mutate authority records/audit/lineage', () => {
  const world = createWorkbenchWorld('pure');
  const before = world.env.ledger.exportSnapshot();
  const c = projectCase(world);
  projectAgronomistEscalationQueue({ caseInputs: [caseInput(world, c)], includeNoReviewCandidates: true });
  const after = world.env.ledger.exportSnapshot();
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.audit.length, before.audit.length);
  assert.equal(after.lineage.length, before.lineage.length);
});

test('public A11 action vocabulary contains no generic accept/override/applicability-mutation shortcut', () => {
  assert.equal(WORKBENCH_AUTHORITY_ACTIONS.some((name) => /ACCEPT|OVERRIDE|APPLICABILITY/.test(name)), false);
});

test('later QualifiedKnowledge revocation blocks current A11 case but exact historical case remains replayable', () => {
  const world = createWorkbenchWorld('history');
  const original = world.workbenchCase;
  const q = world.env.qualified;
  q.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a11.history', revocationVersion: '1',
    qualifiedKnowledgeRef: q.knowledge.ref, qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: q.approver,
    authorizationDecisionAuditRef: q.decision.semanticPayload.authorizationDecisionAuditRef,
    reasonCodes: ['A11_HISTORICAL_CASE_FIXTURE'], audit: laterAudit(q.approver, 'revocation')
  });
  assert.throws(() => projectCase(world));
  const historical = projectCase(world, { allowHistorical: true });
  assert.equal(historical.classification, original.classification);
  assert.equal(historical.caseProjectionHash, original.caseProjectionHash);
  assert.equal(historical.scientificEvidence.claim.assertion, original.scientificEvidence.claim.assertion);
});

console.log(`Agronomist Workbench integrity acceptance: ${passed} passed`);
