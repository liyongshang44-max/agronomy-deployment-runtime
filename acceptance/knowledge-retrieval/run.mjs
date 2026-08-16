import assert from 'node:assert/strict';
import {
  KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS,
  RETRIEVAL_ENGINE,
  executeKnowledgeRetrieval,
  validateKnowledgeRetrievalResult
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  baseDecisionProblem,
  createRetrievalEnvironment,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision,
  audit
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('A07 publishes immutable non-scientific retrieval evidence over exact Deployment world', () => {
  const env = createRetrievalEnvironment('basic');
  const decision = publishDecision(env, { logicalId: 'decision.basic' });
  const result = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.basic',
    decisionProblem: decision
  });
  assert.equal(result.ref.kind, 'KnowledgeRetrievalResult');
  assert.equal(result.semanticPayload.authorityClass, KNOWLEDGE_RETRIEVAL_AUTHORITY_CLASS);
  assert.equal(result.semanticPayload.engine.engineId, RETRIEVAL_ENGINE.engineId);
  assert.equal(result.semanticPayload.decisionProblemRef.semanticHash, decision.ref.semanticHash);
  assert.equal(result.semanticPayload.deploymentRef.semanticHash, env.deployment.ref.semanticHash);
  assert.equal(result.semanticPayload.runtimeProfileRef.semanticHash, env.profile.ref.semanticHash);
  assert.equal(result.semanticPayload.knowledgeReleaseRef.semanticHash, env.release.ref.semanticHash);
  const validated = validateKnowledgeRetrievalResult({
    ledger: env.ledger,
    knowledgeRetrievalResultRef: result.ref
  });
  assert.equal(validated.record.ref.semanticHash, result.ref.semanticHash);
});

test('default exact-release scan returns every release member as an exact candidate ref', () => {
  const env = createRetrievalEnvironment('all-members');
  const result = executeAuthorizedRetrieval(env, { logicalId: 'retrieval.all-members' });
  assert.deepEqual(result.semanticPayload.candidateRefs, env.release.semanticPayload.memberRefs);
  assert.equal(result.semanticPayload.missDiagnostics.length, 0);
});

test('candidate entries carry no ranking score or scientific/applicability conclusion', () => {
  const env = createRetrievalEnvironment('no-score');
  const result = executeAuthorizedRetrieval(env, { logicalId: 'retrieval.no-score' });
  for (const ref of result.semanticPayload.candidateRefs) {
    assert.equal(typeof ref.semanticHash, 'string');
    assert.equal('score' in ref, false);
    assert.equal('applicability' in ref, false);
    assert.equal('qualified' in ref, false);
  }
});

test('retrieval result records deterministic engine/config/query/corpus snapshot identity', () => {
  const env = createRetrievalEnvironment('identity');
  const result = executeAuthorizedRetrieval(env, { logicalId: 'retrieval.identity' });
  assert.equal(result.semanticPayload.config.strategy, 'ALL_RELEASE_MEMBERS_BY_KIND');
  assert.equal(result.semanticPayload.config.contextSummaryMode, 'NONE');
  assert.equal(result.semanticPayload.querySemantics.decisionType, 'IRRIGATION_TIMING');
  assert.equal(result.semanticPayload.querySemantics.usePurpose, 'CORN_IRRIGATION_APPLICABILITY');
  assert.equal(result.semanticPayload.corpusSnapshot.sourceMode, 'EXACT_KNOWLEDGE_RELEASE');
  assert.equal(result.semanticPayload.corpusSnapshot.indexMode, 'NO_EXTERNAL_MUTABLE_INDEX');
  assert.match(result.semanticPayload.configHash, /^sha256:/);
  assert.match(result.semanticPayload.querySemanticHash, /^sha256:/);
  assert.match(result.semanticPayload.corpusSnapshot.memberSetHash, /^sha256:/);
  assert.match(result.semanticPayload.corpusSnapshot.indexSnapshotHash, /^sha256:/);
});

test('same retrieval authority inputs produce the same candidate identities and semantic result', () => {
  const env = createRetrievalEnvironment('deterministic');
  const decision = publishDecision(env, { logicalId: 'decision.deterministic' });
  const runtimeAuth = createRetrievalRuntimeAuthorization(env);
  const first = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.deterministic.a',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth
  });
  const second = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.deterministic.b',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth
  });
  assert.deepEqual(first.semanticPayload.candidateRefs, second.semanticPayload.candidateRefs);
  assert.equal(first.ref.semanticHash, second.ref.semanticHash);
});

test('candidate-kind config may produce an explicit retrieval miss without scientific rejection', () => {
  const env = createRetrievalEnvironment('miss');
  const result = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.miss',
    config: {
      strategy: 'ALL_RELEASE_MEMBERS_BY_KIND',
      candidateKinds: ['DerivedKnowledge'],
      contextSummaryMode: 'NONE'
    }
  });
  assert.deepEqual(result.semanticPayload.candidateRefs, []);
  assert.deepEqual(result.semanticPayload.missDiagnostics, [{
    code: 'NO_RELEASE_MEMBERS_OF_CONFIGURED_KIND',
    scope: 'RETRIEVAL_ONLY_NON_SCIENTIFIC'
  }]);
});

test('material retrieval config change changes retrieval semantic identity', () => {
  const env = createRetrievalEnvironment('config-identity');
  const decision = publishDecision(env, { logicalId: 'decision.config-identity' });
  const runtimeAuth = createRetrievalRuntimeAuthorization(env);
  const all = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.config.all',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth
  });
  const derivedOnly = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.config.derived',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth,
    config: { candidateKinds: ['DerivedKnowledge'], strategy: 'ALL_RELEASE_MEMBERS_BY_KIND', contextSummaryMode: 'NONE' }
  });
  assert.notEqual(all.ref.semanticHash, derivedOnly.ref.semanticHash);
});

test('material DecisionProblem query change changes retrieval identity without inventing new candidate science', () => {
  const env = createRetrievalEnvironment('decision-identity');
  const firstDecision = publishDecision(env, { logicalId: 'decision.query.a' });
  const secondDecision = publishDecision(env, {
    logicalId: 'decision.query.b',
    problem: baseDecisionProblem({ objective: { code: 'MINIMIZE_IRRIGATION_COST' } })
  });
  const runtimeAuth = createRetrievalRuntimeAuthorization(env);
  const first = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.query.a', decisionProblem: firstDecision, runtimeAuthorization: runtimeAuth
  });
  const second = executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.query.b', decisionProblem: secondDecision, runtimeAuthorization: runtimeAuth
  });
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
  assert.deepEqual(first.semanticPayload.candidateRefs, second.semanticPayload.candidateRefs);
});

test('retrieval binds DecisionProblem use purpose/class/type to exact Deployment authorization world', () => {
  for (const [label, override] of [
    ['decision-type', { decisionType: 'NITROGEN_TIMING' }],
    ['use-purpose', { usePurpose: 'MODEL_PARAMETER_PRIOR' }],
    ['use-class', { useClass: 'RESEARCH' }]
  ]) {
    const env = createRetrievalEnvironment(`mismatch-${label}`);
    const decision = publishDecision(env, {
      logicalId: `decision.mismatch.${label}`,
      problem: baseDecisionProblem(override)
    });
    const auth = createRetrievalRuntimeAuthorization(env);
    assert.throws(() => executeKnowledgeRetrieval({
      ledger: env.ledger,
      logicalId: `retrieval.mismatch.${label}`,
      version: '1',
      decisionProblemRef: decision.ref,
      deploymentRef: env.deployment.ref,
      principal: env.runtimePrincipal,
      runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
      config: {},
      audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
    }));
  }
});

test('DecisionProblem authority mode must be allowed by exact RuntimeProfile governance', () => {
  const env = createRetrievalEnvironment('mode-mismatch');
  const decision = publishDecision(env, {
    logicalId: 'decision.mode-mismatch',
    problem: baseDecisionProblem({ decisionAuthorityMode: 'ADR_POLICY' })
  });
  const auth = createRetrievalRuntimeAuthorization(env);
  assert.throws(() => executeKnowledgeRetrieval({
    ledger: env.ledger,
    logicalId: 'retrieval.mode-mismatch',
    version: '1',
    decisionProblemRef: decision.ref,
    deploymentRef: env.deployment.ref,
    principal: env.runtimePrincipal,
    runtimeAuthorizationDecisionAuditRef: auth.recorded.ref,
    config: {},
    audit: audit(env.runtimePrincipal.principalId, env.runtimePrincipal.type)
  }));
});

test('A07 minimal retrieval refuses hidden ContextManifest summary use', () => {
  const env = createRetrievalEnvironment('no-context-summary');
  assert.throws(() => executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.context-summary',
    config: { strategy: 'ALL_RELEASE_MEMBERS_BY_KIND', candidateKinds: ['QualifiedKnowledge'], contextSummaryMode: 'CONTEXT_MANIFEST' }
  }), (error) => error?.code === 'A07_CONTEXT_SUMMARY_NOT_ENABLED');
});

test('same retrieval logical/version cannot be semantically rewritten', () => {
  const env = createRetrievalEnvironment('immutability');
  const decision = publishDecision(env, { logicalId: 'decision.immutable' });
  const runtimeAuth = createRetrievalRuntimeAuthorization(env);
  executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.immutable',
    version: '1',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth
  });
  assert.throws(() => executeAuthorizedRetrieval(env, {
    logicalId: 'retrieval.immutable',
    version: '1',
    decisionProblem: decision,
    runtimeAuthorization: runtimeAuth,
    config: { strategy: 'ALL_RELEASE_MEMBERS_BY_KIND', candidateKinds: ['DerivedKnowledge'], contextSummaryMode: 'NONE' }
  }));
});

console.log('Knowledge retrieval acceptance: 12 passed');
