import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment
} from '../../packages/authorization/src/index.mjs';
import {
  publishDeploymentControlDecision
} from '../../packages/deployment/src/index.mjs';
import {
  KnowledgeRetrievalError,
  executeKnowledgeRetrieval,
  validateKnowledgeRetrievalResult
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  createDeploymentAuthorization
} from '../deployment/fixture.mjs';
import {
  audit,
  baseDecisionProblem,
  createRetrievalEnvironment,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectRetrievalError(fn) {
  assert.throws(fn, (error) => error instanceof KnowledgeRetrievalError || error?.name?.includes('Deployment'));
}

test('foreign-tenant DecisionProblem cannot retrieve candidates through local Deployment', () => {
  const env = createRetrievalEnvironment('foreign-decision');
  const foreignCreator = createPrincipal({
    principalId: 'decision-creator-foreign',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-b'
  });
  const decision = publishDecision(env, {
    logicalId: 'decision.foreign',
    actor: foreignCreator,
    problem: baseDecisionProblem({
      targetRef: {
        organizationId: 'org-a',
        tenantId: 'tenant-b',
        farmId: 'farm-1',
        fieldId: 'field-1',
        seasonId: 'season-2026'
      }
    })
  });
  const auth = createRetrievalRuntimeAuthorization(env);
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.foreign',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

test('runtime service scoped to another program cannot disclose retrieval candidates', () => {
  const env = createRetrievalEnvironment('wrong-program');
  const wrongRole = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.runtime-wrong-program',
    version: '1',
    principal: env.runtimePrincipal,
    role: 'RUNTIME_WRONG_PROGRAM',
    roleDefinitionVersion: 'a07-test-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RUNTIME_USE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-b' },
    audit: audit('iam-admin')
  });
  const auth = createRetrievalRuntimeAuthorization(env, { roleAssignments: [wrongRole] });
  assert.equal(auth.decision.allowed, false);
  const decision = publishDecision(env, { logicalId: 'decision.wrong-program' });
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.wrong-program',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

test('human knowledge.inspect authority cannot substitute for runtime-use retrieval authority', () => {
  const env = createRetrievalEnvironment('inspect-not-runtime');
  const inspector = createPrincipal({
    principalId: 'human-inspector',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const inspectRole = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.human-inspector',
    version: '1',
    principal: inspector,
    role: 'HUMAN_INSPECTOR',
    roleDefinitionVersion: 'a07-test-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_INSPECT],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' },
    audit: audit('iam-admin')
  });
  const auth = createRetrievalRuntimeAuthorization(env, { principal: inspector, roleAssignments: [inspectRole] });
  assert.equal(auth.decision.allowed, false);
  const decision = publishDecision(env, { logicalId: 'decision.inspect-not-runtime' });
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.inspect-not-runtime',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: inspector,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(inspector.principalId, inspector.type)
  }));
});

test('suspended Deployment blocks new retrieval before candidate disclosure', () => {
  const env = createRetrievalEnvironment('suspended');
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
    reasonCodes: ['A07_SUSPEND'],
    audit: audit(env.deploymentManager.principalId)
  });
  const decision = publishDecision(env, { logicalId: 'decision.suspended' });
  const auth = createRetrievalRuntimeAuthorization(env);
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.suspended',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

test('DecisionProblem logical time outside Deployment interval blocks retrieval', () => {
  const env = createRetrievalEnvironment('outside-time');
  const decision = publishDecision(env, {
    logicalId: 'decision.outside-time',
    problem: baseDecisionProblem({
      logicalTime: '2026-10-01T10:00:00Z',
      decisionDeadline: '2026-10-01T14:00:00Z'
    })
  });
  const auth = createRetrievalRuntimeAuthorization(env);
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.outside-time',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

test('generic result with copied publication vocabulary and hidden input fails validation', () => {
  const env = createRetrievalEnvironment('hidden-input');
  const legitimate = executeAuthorizedRetrieval(env, { logicalId: 'retrieval.legitimate' });
  const event = env.ledger.auditFor(legitimate.ref).find((item) => item.action === 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT');
  const forged = env.ledger.publish({
    kind: 'KnowledgeRetrievalResult',
    logicalId: 'retrieval.forged-hidden-input',
    version: '1',
    semanticPayload: legitimate.semanticPayload,
    audit: {
      ...audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type),
      action: 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT',
      inputRefs: [...event.inputRefs, env.runtimeRole.ref],
      details: event.details
    }
  });
  assert.throws(() => validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: forged.ref
  }), (error) => error?.code === 'RETRIEVAL_PUBLICATION_AUTHORITY_INVALID');
});

test('result payload cannot smuggle ranking score, applicability or scientific qualification', () => {
  const env = createRetrievalEnvironment('no-smuggle');
  const legitimate = executeAuthorizedRetrieval(env, { logicalId: 'retrieval.no-smuggle.legit' });
  for (const [key, value] of [
    ['rankingScores', [{ ref: legitimate.semanticPayload.candidateRefs[0], score: 0.99 }]],
    ['applicabilityStatus', 'DIRECTLY_APPLICABLE'],
    ['qualificationStatus', 'QUALIFIED']
  ]) {
    const forged = env.ledger.publish({
      kind: 'KnowledgeRetrievalResult',
      logicalId: `retrieval.no-smuggle.${key}`,
      version: '1',
      semanticPayload: { ...legitimate.semanticPayload, [key]: value },
      audit: audit('attacker')
    });
    assert.throws(() => validateKnowledgeRetrievalResult({
      ledger: env.ledger,
      knowledgeRetrievalResultRef: forged.ref
    }), (error) => error?.code === 'INVALID_RETRIEVAL_FIELD');
  }
});

test('zero-candidate result cannot use scientific/applicability rejection language', () => {
  const env = createRetrievalEnvironment('miss-language');
  const legitimate = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.miss-language.legit',
    config: { strategy: 'ALL_RELEASE_MEMBERS_BY_KIND', candidateKinds: ['DerivedKnowledge'], contextSummaryMode: 'NONE' }
  });
  const forged = env.ledger.publish({
    kind: 'KnowledgeRetrievalResult',
    logicalId: 'retrieval.miss-language.forged',
    version: '1',
    semanticPayload: {
      ...legitimate.semanticPayload,
      missDiagnostics: [{ code: 'NOT_APPLICABLE', scope: 'SCIENTIFIC_CONCLUSION' }]
    },
    audit: audit('attacker')
  });
  assert.throws(() => validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: forged.ref
  }), (error) => error?.code === 'INVALID_RETRIEVAL_MISS_SCOPE');
});

test('unsupported mutable/external retrieval index configuration fails closed', () => {
  const env = createRetrievalEnvironment('mutable-index');
  assert.throws(() => executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.mutable-index',
    config: {
      strategy: 'VECTOR_DB_LATEST',
      candidateKinds: ['QualifiedKnowledge'],
      contextSummaryMode: 'NONE'
    }
  }), (error) => error?.code === 'UNSUPPORTED_RETRIEVAL_STRATEGY');
});

test('exact KnowledgeRelease ref cannot substitute for Deployment ref', () => {
  const env = createRetrievalEnvironment('deployment-required');
  const decision = publishDecision(env, { logicalId: 'decision.deployment-required' });
  const auth = createRetrievalRuntimeAuthorization(env);
  expectRetrievalError(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.deployment-required',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.release.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

console.log('Knowledge retrieval integrity acceptance: 10 passed');
