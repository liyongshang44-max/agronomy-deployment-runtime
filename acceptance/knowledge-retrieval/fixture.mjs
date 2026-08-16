import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  publishDecisionProblem
} from '../../packages/decision-problem/src/index.mjs';
import {
  executeKnowledgeRetrieval
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  audit as deploymentAudit,
  createDeploymentEnvironment,
  createRuntimeReadAuthorization,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';

let seq = 0;
export function audit(actorId, actorType = 'USER', prefix = 'a07') {
  seq += 1;
  return {
    eventId: `${prefix}-${seq}`,
    occurredAt: '2026-08-16T11:00:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { suite: 'knowledge-retrieval' }
  };
}

export function createRetrievalEnvironment(label = 'base') {
  const env = createDeploymentEnvironment(`a07-${label}`);
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.a07.${label}`,
    version: '1'
  });
  const decisionCreator = {
    principalId: `decision-creator-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  };
  return { ...env, deployment, decisionCreator };
}

export function baseDecisionProblem(overrides = {}) {
  return {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: 'IRRIGATION_TIMING',
    targetRef: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      farmId: 'farm-1',
      fieldId: 'field-1',
      seasonId: 'season-2026'
    },
    logicalTime: '2026-08-20T10:00:00Z',
    decisionHorizon: { duration: 'PT72H' },
    objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
    actionSpace: ['WAIT', 'IRRIGATE_NOW', 'IRRIGATE_WITHIN_48H'],
    constraints: [],
    usePurpose: 'CORN_IRRIGATION_APPLICABILITY',
    useClass: 'ADVISORY',
    decisionAuthorityMode: 'RUNTIME_ONLY',
    decisionDeadline: '2026-08-20T14:00:00Z',
    ...overrides
  };
}

export function publishDecision(env, {
  logicalId = 'decision.a07',
  version = '1',
  problem = baseDecisionProblem(),
  actor = env.decisionCreator
} = {}) {
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.decision-create.${logicalId}.${version}`,
    version: '1',
    principal: actor,
    role: 'DECISION_PROBLEM_CREATOR',
    roleDefinitionVersion: 'a07-fixture-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM'
    },
    audit: audit('iam-admin')
  });
  const decision = authorizeDecisionProblemCreation({
    principal: actor,
    roleAssignments: [role],
    authorizationScope: {
      organizationId: problem.targetRef.organizationId,
      ...(problem.targetRef.tenantId ? { tenantId: problem.targetRef.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  const recorded = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit('iam-engine', 'SERVICE_ACCOUNT')
  });
  return publishDecisionProblem({
    ledger: env.ledger,
    logicalId,
    version,
    problem,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor.principalId, actor.type)
  });
}

export function createRetrievalRuntimeAuthorization(env, {
  deployment = env.deployment,
  principal = env.runtimePrincipal,
  roleAssignments = [env.runtimeRole]
} = {}) {
  return createRuntimeReadAuthorization(env, deployment.ref.logicalId, {
    principal,
    roleAssignments,
    deployment: deployment.semanticPayload
  });
}

export function executeAuthorizedRetrieval(env, {
  logicalId = 'retrieval.a07',
  version = '1',
  decisionProblem = publishDecision(env),
  deployment = env.deployment,
  principal = env.runtimePrincipal,
  runtimeAuthorization,
  config = {}
} = {}) {
  const auth = runtimeAuthorization ?? createRetrievalRuntimeAuthorization(env, {
    deployment,
    principal
  });
  assert.equal(auth.decision.allowed, true);
  return executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId,
    version,
    decisionProblemRef: decisionProblem.ref,
    deploymentRef: deployment.ref,
    principal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config,
    audit: audit(principal.principalId, principal.type)
  });
}
