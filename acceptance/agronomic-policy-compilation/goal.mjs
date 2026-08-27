import assert from 'node:assert/strict';

import {
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicGoalConditionCompilationError,
  agronomicGoalConditionHash,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  validateAgronomicGoalConditionCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import { audit, createEnvironment, makeQualifiedKnowledge } from '../derived-knowledge/fixture.mjs';

function expectError(fn, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof AgronomicGoalConditionCompilationError);
  assert.equal(caught.code, code);
}

const env = createEnvironment();

function bundle(label, assertion, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, { label, assertion, useTarget });
}

const prevention = bundle(
  'goal-prevention',
  'Plots are tilled as needed to prevent plant growth from becoming established.'
);

function binding(knowledgeRef) {
  return {
    role: 'SOURCE_GOAL',
    authorityRef: knowledgeRef,
    rationale: 'The exact source-qualified knowledge carries the reviewed source-stated agronomic purpose.'
  };
}

function goalCondition({
  id = 'prevent-plant-establishment',
  knowledgeRef = prevention.knowledge.ref,
  sourceExpression = 'Plots are tilled as needed to prevent plant growth from becoming established.',
  relation = 'PREVENT',
  goalObjectExpression = 'plant growth from becoming established'
} = {}) {
  return {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: id,
    sourceExpression,
    targetScope: 'ACTION',
    relation,
    goalObjectExpression,
    authorityBindings: [binding(knowledgeRef)],
    transformationRationale: 'Preserve source purpose only; do not create a runtime trigger, current-state claim, causal effect, DecisionProblem objective, execution fact, or Outcome.'
  };
}

function reviewAuthorization(bundleValue) {
  return {
    reviewerPrincipal: bundleValue.reviewed.review.semanticPayload.reviewPrincipal,
    authorizationDecisionAuditRefs: [bundleValue.reviewed.review.semanticPayload.authorizationDecisionAuditRef]
  };
}

function acceptedReview({ label, bundleValue, goalValue }) {
  const auth = reviewAuthorization(bundleValue);
  const review = publishAgronomicGoalConditionReviewDecision({
    ledger: env.ledger,
    logicalId: `review.goal.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    goalCondition: goalValue,
    disposition: 'ACCEPT_GOAL_CONDITION',
    reviewerPrincipal: auth.reviewerPrincipal,
    authorizationDecisionAuditRefs: auth.authorizationDecisionAuditRefs,
    rationale: 'Authorized agronomy review confirms that the exact expression functions as the source-stated purpose of the action.',
    audit: audit(`evt-goal-review-${label}`, auth.reviewerPrincipal.principalId)
  });
  return { review, reviewerPrincipal: auth.reviewerPrincipal };
}

function compilation({ bundleValue, goalValue, reviewRef, status = 'COMPLETE' }) {
  return {
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [bundleValue.source.ref],
    sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
    knowledgeRefs: [bundleValue.knowledge.ref],
    goalCondition: goalValue,
    goalConditionHash: agronomicGoalConditionHash(goalValue),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_GOAL_ELEMENT']
    },
    limitations: [
      'SOURCE_GOAL_NOT_RUNTIME_TRIGGER',
      'SOURCE_GOAL_NOT_CURRENT_STATE',
      'SOURCE_GOAL_NOT_CAUSAL_EFFECT',
      'SOURCE_GOAL_NOT_OUTCOME'
    ]
  };
}

const preventGoal = goalCondition();
const preventReview = acceptedReview({ label: 'prevent', bundleValue: prevention, goalValue: preventGoal });
const base = compilation({ bundleValue: prevention, goalValue: preventGoal, reviewRef: preventReview.review.ref });
const published = publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.fixture.prevent-establishment',
  version: '1',
  compilation: base,
  audit: audit('evt-goal-publication', preventReview.reviewerPrincipal.principalId)
});
const validated = validateAgronomicGoalConditionCompilationAuthority({ ledger: env.ledger, compilationRef: published.ref });
assert.equal(validated.record.ref.kind, 'AgronomicGoalConditionCompilation');
assert.equal(validated.semanticPayload.goalCondition.relation, 'PREVENT');
assert.equal(validated.semanticPayload.goalCondition.targetScope, 'ACTION');

const incomplete = compilation({
  bundleValue: prevention,
  goalValue: preventGoal,
  reviewRef: preventReview.review.ref,
  status: 'INCOMPLETE'
});
expectError(() => publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.fixture.incomplete',
  version: '1',
  compilation: incomplete,
  audit: audit('evt-goal-incomplete', preventReview.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_INCOMPLETE_NOT_PUBLISHABLE');

const driftedGoal = goalCondition({ relation: 'CONTROL' });
const drifted = compilation({ bundleValue: prevention, goalValue: driftedGoal, reviewRef: preventReview.review.ref });
expectError(() => publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.fixture.review-drift',
  version: '1',
  compilation: drifted,
  audit: audit('evt-goal-review-drift', preventReview.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_REVIEW_MISMATCH');

const other = bundle('goal-undeclared', 'A separate governed source states another agronomic purpose.');
const undeclaredGoal = goalCondition({ knowledgeRef: other.knowledge.ref });
const auth = reviewAuthorization(prevention);
expectError(() => publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.goal.undeclared-binding',
  version: '1',
  knowledgeRefs: [prevention.knowledge.ref],
  goalCondition: undeclaredGoal,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: auth.reviewerPrincipal,
  authorizationDecisionAuditRefs: auth.authorizationDecisionAuditRefs,
  rationale: 'Negative authority closure case.',
  audit: audit('evt-goal-undeclared', auth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_AUTHORITY_NOT_DECLARED');

const wrongUse = bundle(
  'goal-wrong-use',
  'The action is described to control a target, but this knowledge is qualified for another scientific use.',
  { use: 'OTHER_SCIENTIFIC_USE' }
);
const wrongUseAuth = reviewAuthorization(wrongUse);
const wrongUseGoal = goalCondition({
  id: 'wrong-use-control',
  knowledgeRef: wrongUse.knowledge.ref,
  sourceExpression: 'The action is described to control a target, but this knowledge is qualified for another scientific use.',
  relation: 'CONTROL',
  goalObjectExpression: 'a target'
});
expectError(() => publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.goal.wrong-use',
  version: '1',
  knowledgeRefs: [wrongUse.knowledge.ref],
  goalCondition: wrongUseGoal,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: wrongUseAuth.reviewerPrincipal,
  authorizationDecisionAuditRefs: wrongUseAuth.authorizationDecisionAuditRefs,
  rationale: 'Negative scientific-use case.',
  audit: audit('evt-goal-wrong-use', wrongUseAuth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_KNOWLEDGE_AUTHORITY_INVALID');

const mismatched = goalCondition({
  sourceExpression: 'This text is not present in the exact source-qualified claim.',
  goalObjectExpression: 'not present'
});
expectError(() => publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.goal.source-expression-mismatch',
  version: '1',
  knowledgeRefs: [prevention.knowledge.ref],
  goalCondition: mismatched,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: auth.reviewerPrincipal,
  authorizationDecisionAuditRefs: auth.authorizationDecisionAuditRefs,
  rationale: 'Negative source-expression closure case.',
  audit: audit('evt-goal-source-expression-mismatch', auth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_SOURCE_EXPRESSION_MISMATCH');

const explanatory = bundle(
  'goal-explanatory-lookalike',
  'The discussion notes that weed control was observed after tillage, without stating an action purpose.'
);
const explanatoryGoal = goalCondition({
  id: 'explanatory-lookalike',
  knowledgeRef: explanatory.knowledge.ref,
  sourceExpression: 'The discussion notes that weed control was observed after tillage, without stating an action purpose.',
  relation: 'CONTROL',
  goalObjectExpression: 'weed control'
});
const explanatoryAuth = reviewAuthorization(explanatory);
const rejectedReview = publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.goal.explanatory-lookalike',
  version: '1',
  knowledgeRefs: [explanatory.knowledge.ref],
  goalCondition: explanatoryGoal,
  disposition: 'REJECT_GOAL_CONDITION',
  reasonCodes: ['EXPLANATORY_OR_OUTCOME_LANGUAGE_NOT_SOURCE_PURPOSE'],
  reviewerPrincipal: explanatoryAuth.reviewerPrincipal,
  authorizationDecisionAuditRefs: explanatoryAuth.authorizationDecisionAuditRefs,
  rationale: 'The phrase is descriptive discussion, not a source-stated purpose attached to the agronomic action.',
  audit: audit('evt-goal-explanatory-review', explanatoryAuth.reviewerPrincipal.principalId)
});
const rejectedCompilation = compilation({
  bundleValue: explanatory,
  goalValue: explanatoryGoal,
  reviewRef: rejectedReview.ref
});
expectError(() => publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.fixture.explanatory-lookalike',
  version: '1',
  compilation: rejectedCompilation,
  audit: audit('evt-goal-explanatory-publication', explanatoryAuth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_GOAL_CONDITION_REVIEW_REJECTED');

const forbiddenRuntimeKinds = new Set(['RuntimeBinding', 'RuntimeEligibility', 'DecisionResult', 'ExecutionReceipt', 'Outcome']);
const runtimeRecords = env.ledger.exportSnapshot().records.filter((record) => forbiddenRuntimeKinds.has(record.ref.kind));
assert.equal(runtimeRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicGoalConditionCompilation',
  validCompilation: validated.record.ref,
  requiredKnowledgeUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticReviewRequired: true,
  sourceExpressionClosureRequired: true,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'REVIEW_MISMATCH',
    'AUTHORITY_NOT_DECLARED',
    'KNOWLEDGE_WRONG_USE',
    'SOURCE_EXPRESSION_MISMATCH',
    'NON_PURPOSE_LOOKALIKE_REJECTED'
  ],
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
