import assert from 'node:assert/strict';
import {
  OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY,
  OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY,
  OUTCOME_EVALUATION_METHOD_REF,
  validateOutcomeEvaluationAuthority
} from '../../packages/outcome-evaluation/src/index.mjs';
import { observationOutcome } from '../outcome/fixture.mjs';
import {
  adrEvaluationWorld,
  authorizeEvaluation,
  evaluatorPrincipal,
  externalEvaluationWorld,
  finding,
  findingsWith,
  publishAuthorizedEvaluation
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function byDimension(payload, dimension) {
  return payload.findings.find((finding) => finding.dimension === dimension);
}

function publishEvaluation(world, evaluator, findings) {
  const outcomeRefs = world.outcomes.map((record) => record.ref);
  const auth = authorizeEvaluation({ ledger: world.ledger, evaluator, outcomeRefs, findings });
  assert.equal(auth.decision.allowed, true);
  const record = publishAuthorizedEvaluation({
    ledger: world.ledger,
    evaluator,
    outcomeRefs,
    findings,
    authorization: auth.authorization
  });
  return { auth, record };
}

test('same exact Outcome can support strong model-error evidence while Knowledge falsehood remains explicitly inconclusive', () => {
  const world = adrEvaluationWorld('model-vs-knowledge');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    KNOWLEDGE: finding('KNOWLEDGE', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE',
      evidenceOutcomeRefs: evidence,
      limitationCodes: ['NO_DIRECT_KNOWLEDGE_COUNTERFACTUAL']
    }),
    MODEL: finding('MODEL', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'ASSOCIATIONAL',
      diagnosticCode: 'MODEL_PREDICTION_ERROR_EVIDENCE',
      evidenceOutcomeRefs: evidence,
      limitationCodes: ['NONCAUSAL_RESIDUAL_DIAGNOSTIC']
    })
  });
  const evaluator = evaluatorPrincipal('model-vs-knowledge');
  const { record } = publishEvaluation(world, evaluator, findings);
  const payload = record.semanticPayload;
  assert.equal(byDimension(payload, 'MODEL').evidenceWeightClass, 'STRONG');
  assert.equal(byDimension(payload, 'MODEL').disposition, 'SUPPORTS_CONCERN');
  assert.equal(byDimension(payload, 'KNOWLEDGE').evidenceWeightClass, 'LIMITED');
  assert.equal(byDimension(payload, 'KNOWLEDGE').disposition, 'INCONCLUSIVE');
  assert.ok(byDimension(payload, 'KNOWLEDGE').diagnosticCodes.includes('KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE'));
});

test('execution deviation is diagnosed in EXECUTION and does not get relabeled as MODEL failure', () => {
  const outcome = observationOutcome('execution-deviation', {
    semanticId: 'execution.applied_amount',
    value: { type: 'DECIMAL', decimal: '6' },
    unit: 'mm',
    verticalSupport: null,
    uncertainty: { type: 'INTERVAL', lowerDecimal: '5.5', upperDecimal: '6.5' }
  });
  const world = adrEvaluationWorld('execution-deviation', { outcomes: [outcome] });
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    EXECUTION: finding('EXECUTION', {
      disposition: 'SUPPORTS_CONCERN',
      weight: 'STRONG',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'EXECUTION_DEVIATION_EVIDENCE',
      evidenceOutcomeRefs: evidence
    }),
    MODEL: finding('MODEL', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'MODEL_EVIDENCE_INSUFFICIENT',
      evidenceOutcomeRefs: evidence,
      limitationCodes: ['EXECUTION_DEVIATION_CONFOUNDS_MODEL_DIAGNOSIS']
    })
  });
  const { record } = publishEvaluation(world, evaluatorPrincipal('execution-deviation'), findings);
  assert.equal(byDimension(record.semanticPayload, 'EXECUTION').disposition, 'SUPPORTS_CONCERN');
  assert.equal(byDimension(record.semanticPayload, 'MODEL').disposition, 'INCONCLUSIVE');
});

test('favorable commercial Outcome may support COMMERCIAL target without claiming Knowledge truth or ADR effectiveness', () => {
  const favorable = observationOutcome('commercial-favorable', {
    semanticId: 'commercial.gross_margin_delta',
    value: { type: 'DECIMAL', decimal: '42.5' },
    unit: 'GBP_per_ha',
    epistemicClass: 'DERIVED',
    provenanceClass: 'PLATFORM',
    verticalSupport: null,
    uncertainty: { type: 'INTERVAL', lowerDecimal: '30', upperDecimal: '55' }
  });
  const world = adrEvaluationWorld('commercial-favorable', { outcomes: [favorable] });
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    COMMERCIAL: finding('COMMERCIAL', {
      disposition: 'SUPPORTS_CONFORMANCE',
      weight: 'MODERATE',
      interpretation: 'ASSOCIATIONAL',
      diagnosticCode: 'COMMERCIAL_TARGET_SUPPORT_EVIDENCE',
      evidenceOutcomeRefs: evidence,
      limitationCodes: ['NO_CAUSAL_ATTRIBUTION_DESIGN']
    }),
    KNOWLEDGE: finding('KNOWLEDGE', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE',
      evidenceOutcomeRefs: evidence
    })
  });
  const { record } = publishEvaluation(world, evaluatorPrincipal('commercial-favorable'), findings);
  assert.equal(byDimension(record.semanticPayload, 'COMMERCIAL').disposition, 'SUPPORTS_CONFORMANCE');
  assert.equal(byDimension(record.semanticPayload, 'KNOWLEDGE').disposition, 'INCONCLUSIVE');
  assert.equal(record.semanticPayload.causalEffectAuthority, OUTCOME_EVALUATION_CAUSAL_EFFECT_AUTHORITY);
  assert.equal(record.semanticPayload.controlMutationAuthority, OUTCOME_EVALUATION_CONTROL_MUTATION_AUTHORITY);
  assert.equal(record.semanticPayload.aggregateScoreAuthority, OUTCOME_EVALUATION_AGGREGATE_SCORE_AUTHORITY);
});

test('multiple Outcomes from one exact cohort are frozen into one replayable six-dimensional evidence set', () => {
  const outcomes = [
    observationOutcome('multi-soil'),
    observationOutcome('multi-yield', {
      semanticId: 'yield.harvested_mass_per_area',
      value: { type: 'DECIMAL', decimal: '12.1' },
      unit: 't_per_ha',
      verticalSupport: null,
      uncertainty: { type: 'INTERVAL', lowerDecimal: '11.8', upperDecimal: '12.4' },
      source: {
        providerId: 'provider-multi-yield',
        sourceRef: 'source-multi-yield-001',
        contentHash: `sha256:${'d'.repeat(64)}`
      }
    })
  ];
  const world = adrEvaluationWorld('multi', { outcomes });
  const evidence = world.outcomes.map((record) => record.ref);
  const findings = findingsWith({
    TRANSPORT: finding('TRANSPORT', {
      disposition: 'SUPPORTS_CONFORMANCE',
      weight: 'MODERATE',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'TRANSPORT_EVIDENCE_CONSISTENT_WITH_TARGET_TRANSFER',
      evidenceOutcomeRefs: evidence
    })
  });
  const evaluator = evaluatorPrincipal('multi');
  const { record } = publishEvaluation(world, evaluator, findings);
  const replay = validateOutcomeEvaluationAuthority({ ledger: world.ledger, outcomeEvaluationRef: record.ref });
  assert.equal(replay.semanticPayload.outcomeRefs.length, 2);
  assert.equal(replay.semanticPayload.findings.length, 6);
  assert.deepEqual(replay.methodRef, OUTCOME_EVALUATION_METHOD_REF);
  assert.equal(replay.replayMode, 'ADR_DIMENSIONED_OUTCOME_EVALUATION_EXACT_REPLAY');
});

test('fully external Outcome cohort can be evaluated without fabricating ADR DecisionProblem/Runtime refs', () => {
  const world = externalEvaluationWorld('external');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    EXECUTION: finding('EXECUTION', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'EXECUTION_EVIDENCE_INSUFFICIENT',
      evidenceOutcomeRefs: evidence
    })
  });
  const { record } = publishEvaluation(world, evaluatorPrincipal('external'), findings);
  const replay = validateOutcomeEvaluationAuthority({ ledger: world.ledger, outcomeEvaluationRef: record.ref });
  assert.equal(replay.semanticPayload.associationMode, 'EXTERNAL_BOUND');
  assert.equal(replay.semanticPayload.decisionProblemRef, null);
  assert.deepEqual(replay.semanticPayload.decisionResultRefs, []);
  assert.deepEqual(replay.semanticPayload.runtimeBindingRefs, []);
  assert.equal(replay.replayMode, 'EXTERNAL_DIMENSIONED_OUTCOME_EVALUATION_EXACT_REPLAY');
});

test('same method/evidence cohort evaluated by independent evaluators produces separate immutable authority identities', () => {
  const world = externalEvaluationWorld('independent-evaluators');
  const evidence = [world.outcomes[0].ref];
  const findings = findingsWith({
    COMMERCIAL: finding('COMMERCIAL', {
      disposition: 'INCONCLUSIVE',
      weight: 'LIMITED',
      interpretation: 'DESCRIPTIVE',
      diagnosticCode: 'COMMERCIAL_EVIDENCE_INSUFFICIENT',
      evidenceOutcomeRefs: evidence
    })
  });
  const first = publishEvaluation(world, evaluatorPrincipal('reviewer-a'), findings).record;
  const second = publishEvaluation(world, evaluatorPrincipal('reviewer-b'), findings).record;
  assert.notEqual(first.ref.logicalId, second.ref.logicalId);
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
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
console.log(`E02 OutcomeEvaluation acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
