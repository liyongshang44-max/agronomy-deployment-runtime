import assert from 'node:assert/strict';
import * as publicApi from '../../packages/outcome-evaluation/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY,
  OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
  OUTCOME_EVALUATION_METHOD_REF,
  normalizeOutcomeEvaluation,
  outcomeEvaluationPublicationIdentity,
  publishOutcomeEvaluation,
  validateOutcomeEvaluationAuthority
} from '../../packages/outcome-evaluation/src/index.mjs';
import { createOutcomeEvaluationPayload } from '../../packages/outcome-evaluation/src/contract.mjs';
import {
  authorizeIngress,
  externalAssociation,
  ingressPrincipal,
  observationOutcome,
  publishAuthorizedOutcome
} from '../outcome/fixture.mjs';
import { baseDecisionProblem, publishDecision } from '../knowledge-retrieval/fixture.mjs';
import {
  adrEvaluationWorld,
  audit,
  authorizeEvaluation,
  evaluatorPrincipal,
  externalEvaluationWorld,
  finding,
  findingsWith,
  notEvaluated,
  publishAuthorizedEvaluation
} from './fixture.mjs';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('public E02 API does not expose unchecked payload creator', () => {
  assert.equal('createOutcomeEvaluationPayload' in publicApi, false);
  assert.equal(typeof publicApi.publishOutcomeEvaluation, 'function');
  assert.equal(typeof publicApi.validateOutcomeEvaluationAuthority, 'function');
});

test('publisher rejects caller-authored method/id/score/confidence/causal/control fields', () => {
  const world = externalEvaluationWorld('forbidden-fields');
  const evaluator = evaluatorPrincipal('forbidden-fields');
  const outcomeRefs = world.outcomes.map((record) => record.ref);
  const findings = findingsWith();
  const auth = authorizeEvaluation({ ledger: world.ledger, evaluator, outcomeRefs, findings });
  for (const extra of [
    { methodRef: OUTCOME_EVALUATION_METHOD_REF },
    { evaluationId: 'caller-id' },
    { aggregateScore: 0.9 },
    { confidence: 0.99 },
    { causalEffectAuthority: 'CAUSAL' },
    { controlMutationAuthority: 'MUTATE_POLICY' }
  ]) {
    assert.throws(
      () => publishOutcomeEvaluation({
        ledger: world.ledger,
        outcomeRefs,
        findings,
        principal: evaluator,
        authorizationDecisionAuditRef: auth.authorization.ref,
        audit: audit(evaluator, 'forbidden'),
        ...extra
      }),
      (error) => error?.code === 'INVALID_OUTCOME_EVALUATION_PUBLICATION_FIELD'
    );
  }
});

test('exact six-dimensional finding set is mandatory; missing or duplicate dimensions fail closed', () => {
  const world = externalEvaluationWorld('dimension-set');
  const evaluator = evaluatorPrincipal('dimension-set');
  const outcomeRefs = world.outcomes.map((record) => record.ref);
  const complete = findingsWith();
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs, principal: evaluator, findings: complete.slice(0, 5) }),
    (error) => error?.code === 'OUTCOME_EVALUATION_ALL_DIMENSIONS_REQUIRED'
  );
  const duplicate = [...complete];
  duplicate[5] = notEvaluated('MODEL');
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs, principal: evaluator, findings: duplicate }),
    (error) => error?.code === 'OUTCOME_EVALUATION_DIMENSION_SET_MISMATCH'
  );
});

test('execution diagnostic cannot be relabeled as MODEL failure', () => {
  const world = externalEvaluationWorld('execution-not-model');
  const evaluator = evaluatorPrincipal('execution-not-model');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    MODEL: finding('MODEL', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'EXECUTION_DEVIATION_EVIDENCE',
      evidenceOutcomeRefs: evidence
    })
  });
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs: evidence, principal: evaluator, findings }),
    (error) => error?.code === 'OUTCOME_EVALUATION_DIAGNOSTIC_DIMENSION_MISMATCH'
  );
});

test('governed diagnostic code fixes disposition and cannot be relabeled to stronger conclusion', () => {
  const world = externalEvaluationWorld('disposition-mismatch');
  const evaluator = evaluatorPrincipal('disposition-mismatch');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    KNOWLEDGE: finding('KNOWLEDGE', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE',
      evidenceOutcomeRefs: evidence
    })
  });
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs: evidence, principal: evaluator, findings }),
    (error) => error?.code === 'OUTCOME_EVALUATION_DIAGNOSTIC_DISPOSITION_MISMATCH'
  );
});

test('Knowledge falsehood cannot be invented as a free diagnostic code from yield outcome', () => {
  const world = externalEvaluationWorld('knowledge-false-code');
  const evaluator = evaluatorPrincipal('knowledge-false-code');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    KNOWLEDGE: finding('KNOWLEDGE', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'KNOWLEDGE_FALSE',
      evidenceOutcomeRefs: evidence
    })
  });
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs: evidence, principal: evaluator, findings }),
    (error) => error?.code === 'OUTCOME_EVALUATION_DIAGNOSTIC_DIMENSION_MISMATCH'
  );
});

test('finding cannot cite Outcome outside frozen evaluation evidence cohort', () => {
  const world = externalEvaluationWorld('foreign-evidence', {
    outcomes: [observationOutcome('foreign-a'), observationOutcome('foreign-b', {
      source: {
        providerId: 'provider-foreign-b',
        sourceRef: 'source-foreign-b-001',
        contentHash: `sha256:${'e'.repeat(64)}`
      }
    })]
  });
  const evaluator = evaluatorPrincipal('foreign-evidence');
  const included = [world.outcomes[0].ref];
  const findings = findingsWith({
    MODEL: finding('MODEL', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'MODEL_EVIDENCE_INSUFFICIENT',
      evidenceOutcomeRefs: [world.outcomes[1].ref]
    })
  });
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({ ledger: world.ledger, outcomeRefs: included, principal: evaluator, findings }),
    (error) => error?.code === 'OUTCOME_EVALUATION_FOREIGN_EVIDENCE'
  );
});

test('ADR and external Outcome associations cannot be mixed into one evaluation', () => {
  const cohort = adrEvaluationWorld('association-mix');
  const externalOutcome = observationOutcome('association-mix-external', {
    source: {
      providerId: 'provider-association-mix-external',
      sourceRef: 'source-association-mix-external-001',
      contentHash: `sha256:${'a'.repeat(64)}`
    }
  });
  const external = externalAssociation('association-mix');
  const ingress = ingressPrincipal('association-mix-external');
  const auth = authorizeIngress({
    ledger: cohort.ledger,
    principal: ingress,
    target: cohort.target,
    outcome: externalOutcome,
    association: external
  });
  const externalRecord = publishAuthorizedOutcome({
    ledger: cohort.ledger,
    principal: ingress,
    target: cohort.target,
    outcome: externalOutcome,
    association: external,
    authorization: auth.authorization
  });
  const refs = [cohort.outcomes[0].ref, externalRecord.ref];
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({
      ledger: cohort.ledger,
      outcomeRefs: refs,
      principal: evaluatorPrincipal('association-mix'),
      findings: findingsWith()
    }),
    (error) => error?.code === 'OUTCOME_EVALUATION_ASSOCIATION_MIXED'
  );
});

test('two exact ADR DecisionProblems cannot be silently collapsed into one evaluation world', () => {
  const cohort = adrEvaluationWorld('decision-mix');
  const secondDecision = publishDecision(cohort.world.env, {
    logicalId: 'decision.e02.second-world',
    version: '1',
    problem: baseDecisionProblem({ decisionAuthorityMode: 'ADR_POLICY' })
  });
  const secondOutcome = observationOutcome('decision-mix-second', {
    source: {
      providerId: 'provider-decision-mix-second',
      sourceRef: 'source-decision-mix-second-001',
      contentHash: `sha256:${'b'.repeat(64)}`
    }
  });
  const association = {
    mode: 'ADR_BOUND',
    decisionProblemRef: secondDecision.ref,
    decisionResultRef: null,
    runtimeBindingRef: null,
    externalDecisionRef: null,
    externalExecutionRef: {
      providerId: 'external-second-execution',
      sourceRef: 'second-execution-001',
      contentHash: `sha256:${'c'.repeat(64)}`,
      occurredAt: '2026-08-20T11:30:00.000Z'
    }
  };
  const ingress = ingressPrincipal('decision-mix-second');
  const auth = authorizeIngress({
    ledger: cohort.ledger,
    principal: ingress,
    target: cohort.target,
    outcome: secondOutcome,
    association
  });
  const secondRecord = publishAuthorizedOutcome({
    ledger: cohort.ledger,
    principal: ingress,
    target: cohort.target,
    outcome: secondOutcome,
    association,
    authorization: auth.authorization
  });
  assert.throws(
    () => outcomeEvaluationPublicationIdentity({
      ledger: cohort.ledger,
      outcomeRefs: [cohort.outcomes[0].ref, secondRecord.ref],
      principal: evaluatorPrincipal('decision-mix'),
      findings: findingsWith()
    }),
    (error) => error?.code === 'OUTCOME_EVALUATION_DECISION_WORLD_MIXED'
  );
});

test('same evaluator/method/evidence identity cannot overwrite findings on retry', () => {
  const world = externalEvaluationWorld('finding-mutation');
  const evaluator = evaluatorPrincipal('finding-mutation');
  const refs = [world.outcomes[0].ref];
  const firstFindings = findingsWith({
    MODEL: finding('MODEL', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'MODEL_EVIDENCE_INSUFFICIENT',
      evidenceOutcomeRefs: refs
    })
  });
  const auth = authorizeEvaluation({ ledger: world.ledger, evaluator, outcomeRefs: refs, findings: firstFindings });
  publishAuthorizedEvaluation({
    ledger: world.ledger,
    evaluator,
    outcomeRefs: refs,
    findings: firstFindings,
    authorization: auth.authorization
  });
  const changedFindings = findingsWith({
    MODEL: finding('MODEL', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'ASSOCIATIONAL',
      diagnosticCode: 'MODEL_PREDICTION_ERROR_EVIDENCE',
      evidenceOutcomeRefs: refs
    })
  });
  assert.throws(
    () => publishAuthorizedEvaluation({
      ledger: world.ledger,
      evaluator,
      outcomeRefs: refs,
      findings: changedFindings,
      authorization: auth.authorization
    }),
    (error) => error?.code === 'SEMANTIC_MUTATION_FORBIDDEN'
  );
});

test('tampered fixed evaluation method hash is rejected even when payload is otherwise structured', () => {
  const world = externalEvaluationWorld('method-tamper');
  const evaluator = evaluatorPrincipal('method-tamper');
  const refs = [world.outcomes[0].ref];
  const payload = createOutcomeEvaluationPayload({
    evaluator,
    targetRef: world.target,
    associationMode: 'EXTERNAL_BOUND',
    decisionProblemRef: null,
    externalDecisionRef: world.association.externalDecisionRef,
    outcomeRefs: refs,
    decisionResultRefs: [],
    runtimeBindingRefs: [],
    findings: findingsWith()
  });
  const forged = clone(payload);
  forged.methodRef.semanticHash = `sha256:${'f'.repeat(64)}`;
  assert.throws(() => normalizeOutcomeEvaluation(forged), (error) => error?.code === 'OUTCOME_EVALUATION_METHOD_MISMATCH');
});

test('structurally self-consistent direct ledger publication without outcome.evaluate audit fails validator', () => {
  const world = externalEvaluationWorld('forged-direct');
  const evaluator = evaluatorPrincipal('forged-direct');
  const refs = [world.outcomes[0].ref];
  const payload = createOutcomeEvaluationPayload({
    evaluator,
    targetRef: world.target,
    associationMode: 'EXTERNAL_BOUND',
    decisionProblemRef: null,
    externalDecisionRef: world.association.externalDecisionRef,
    outcomeRefs: refs,
    decisionResultRefs: [],
    runtimeBindingRefs: [],
    findings: findingsWith()
  });
  const forged = world.ledger.publish({
    kind: 'OutcomeEvaluation',
    logicalId: payload.evaluationId,
    version: '1',
    semanticPayload: payload,
    audit: audit({ principalId: 'forger', type: 'SERVICE_ACCOUNT' }, 'forged')
  });
  assert.throws(
    () => validateOutcomeEvaluationAuthority({ ledger: world.ledger, outcomeEvaluationRef: forged.ref }),
    (error) => error?.code === 'OUTCOME_EVALUATION_PUBLICATION_AUTHORITY_INVALID'
  );
});

test('OutcomeEvaluation normalization permanently rejects causal/control/aggregate-score laundering', () => {
  const world = externalEvaluationWorld('nonclaim-tamper');
  const evaluator = evaluatorPrincipal('nonclaim-tamper');
  const payload = createOutcomeEvaluationPayload({
    evaluator,
    targetRef: world.target,
    associationMode: 'EXTERNAL_BOUND',
    decisionProblemRef: null,
    externalDecisionRef: world.association.externalDecisionRef,
    outcomeRefs: [world.outcomes[0].ref],
    decisionResultRefs: [],
    runtimeBindingRefs: [],
    findings: findingsWith()
  });
  for (const [field, value, code] of [
    ['causalEffectAuthority', 'CAUSAL_EFFECT_PROVEN', 'OUTCOME_EVALUATION_CAUSAL_LAUNDERING'],
    ['controlMutationAuthority', 'MUTATE_POLICY', 'OUTCOME_EVALUATION_CONTROL_LAUNDERING'],
    ['aggregateScoreAuthority', 'SCORE_0_99', 'OUTCOME_EVALUATION_SCORE_LAUNDERING']
  ]) {
    const forged = clone(payload);
    forged[field] = value;
    assert.throws(() => normalizeOutcomeEvaluation(forged), (error) => error?.code === code);
  }
  assert.equal(payload.causalEffectAuthority, OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY);
  assert.equal(payload.controlMutationAuthority, OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY);
  assert.equal(payload.aggregateScoreAuthority, OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`::error title=${name.replaceAll(',', ' ')}::${String(error?.stack ?? error).replaceAll('\n', '%0A')}`);
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`E02 OutcomeEvaluation integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
