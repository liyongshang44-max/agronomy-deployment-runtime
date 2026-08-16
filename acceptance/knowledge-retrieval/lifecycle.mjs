import assert from 'node:assert/strict';
import {
  createPrincipal,
  publishBuiltinRoleAssignment
} from '../../packages/authorization/src/index.mjs';
import {
  publishDeploymentControlDecision
} from '../../packages/deployment/src/index.mjs';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import {
  executeKnowledgeRetrieval,
  validateKnowledgeRetrievalResult
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  authorizeForResource,
  USE_APPLICABILITY
} from '../derived-knowledge/fixture.mjs';
import {
  createDeploymentAuthorization
} from '../deployment/fixture.mjs';
import {
  audit,
  createRetrievalEnvironment,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('later Deployment suspension blocks current retrieval-result use but historical replay preserves exact candidates', () => {
  const env = createRetrievalEnvironment('suspend-history');
  const decision = publishDecision(env, { logicalId: 'decision.suspend-history' });
  const result = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.suspend-history',
    decisionProblem: decision
  });
  const originalCandidates = result.semanticPayload.candidateRefs;
  const controlAuth = createDeploymentAuthorization(env, env.deployment.ref.logicalId, {
    deployment: env.deployment.semanticPayload,
    action: 'SUSPEND'
  });
  publishDeploymentControlDecision({
    ledger: env.ledger,
    deploymentRef: env.deployment.ref,
    version: '1',
    action: 'SUSPEND',
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: controlAuth.recorded.ref,
    reasonCodes: ['A07_AFTER_RETRIEVAL'],
    audit: audit(env.deploymentManager.principalId)
  });
  assert.throws(() => validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: result.ref
  }));
  const historical = validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: result.ref,
    allowHistorical: true
  });
  assert.deepEqual(historical.semanticPayload.candidateRefs, originalCandidates);
});

test('later KnowledgeRelease invalidation blocks current retrieval-result use but historical replay preserves exact candidates', () => {
  const env = createRetrievalEnvironment('release-history');
  const decision = publishDecision(env, { logicalId: 'decision.release-history' });
  const result = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.release-history',
    decisionProblem: decision
  });
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(
      env.qualified.reviewed.claim.ref,
      env.qualified.reviewed.sourceContext.ref
    ),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'a07-release-history-revoke'
  });
  env.qualified.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a07.release-history',
    revocationVersion: '1',
    qualifiedKnowledgeRef: env.qualified.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_REVOCATION'],
    audit: audit(env.approver.principalId)
  });
  assert.throws(() => validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: result.ref
  }));
  const historical = validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: result.ref,
    allowHistorical: true
  });
  assert.equal(historical.record.ref.semanticHash, result.ref.semanticHash);
  assert.deepEqual(historical.semanticPayload.candidateRefs, result.semanticPayload.candidateRefs);
});

test('same retrieval semantic identity retried by another runtime principal cannot rebind original publication governance', () => {
  const env = createRetrievalEnvironment('retry-governance');
  const decision = publishDecision(env, { logicalId: 'decision.retry-governance' });
  const firstAuth = createRetrievalRuntimeAuthorization(env);
  const first = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.retry-governance',
    version: '1',
    decisionProblem: decision,
    runtimeAuthorization: firstAuth
  });

  const secondRuntime = createPrincipal({
    principalId: 'runtime-service-retry-second',
    type: 'SERVICE_ACCOUNT',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const secondRole = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.runtime-service.retry-second',
    version: '1',
    principal: secondRuntime,
    role: 'RUNTIME_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  const secondAuth = createRetrievalRuntimeAuthorization(env, {
    principal: secondRuntime,
    roleAssignments: [secondRole]
  });
  assert.equal(secondAuth.decision.allowed, true);

  const retried = executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.retry-governance',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: secondRuntime,
    runtimeAuthorizationDecisionAuditRef: secondAuth.recorded.ref,
    config: {},
    audit: audit(secondRuntime.principalId, secondRuntime.type)
  });
  assert.equal(retried.ref.semanticHash, first.ref.semanticHash);
  const publicationEvents = env.ledger.auditFor(first.ref)
    .filter((event) => event.action === 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT');
  assert.equal(publicationEvents.length, 1);
  const validated = validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: first.ref
  });
  assert.equal(validated.retrievalPrincipal.principalId, env.runtimePrincipal.principalId);
  assert.notEqual(validated.retrievalPrincipal.principalId, secondRuntime.principalId);
});

console.log('Knowledge retrieval lifecycle acceptance: 3 passed');
