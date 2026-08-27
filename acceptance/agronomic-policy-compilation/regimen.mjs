import assert from 'node:assert/strict';

import {
  AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicActionRegimenCompilationError,
  agronomicActionRegimenHash,
  agronomicGoalConditionHash,
  agronomicNormativeModalityHash,
  publishAgronomicActionRegimenCompilation,
  publishAgronomicActionRegimenReviewDecision,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  validateAgronomicActionRegimenCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  audit,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

const SOURCE_EXPRESSION =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';

function expectError(fn, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof AgronomicActionRegimenCompilationError);
  assert.equal(caught.code, code);
}

const env = createEnvironment();

function bundle(label, assertion = SOURCE_EXPRESSION, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, { label, assertion, useTarget });
}

function auth(bundleValue) {
  return {
    reviewerPrincipal: bundleValue.reviewed.review.semanticPayload.reviewPrincipal,
    authorizationDecisionAuditRefs: [
      bundleValue.reviewed.review.semanticPayload.authorizationDecisionAuditRef
    ]
  };
}

function publishModality(bundleValue, label, sourceExpression = SOURCE_EXPRESSION) {
  const a = auth(bundleValue);
  const modality = {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: `modality.${label}.as-needed`,
    sourceExpression,
    targetScope: 'OCCURRENCE',
    qualifiers: ['AS_NEEDED'],
    authorityBindings: [{
      role: 'SOURCE_MODALITY',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge carries the AS_NEEDED occurrence qualifier.'
    }],
    transformationRationale: 'Preserve AS_NEEDED without inferring current need, trigger, schedule, hard force, or execution truth.'
  };
  const review = publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: `review.modality.regimen.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    modality,
    disposition: 'ACCEPT_MODALITY',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized review confirms qualifier-only AS_NEEDED source semantics.',
    audit: audit(`evt-regimen-modality-review-${label}`, a.reviewerPrincipal.principalId)
  });
  return publishAgronomicNormativeModalityCompilation({
    ledger: env.ledger,
    logicalId: `modality-compilation.regimen.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      modality,
      modalityHash: agronomicNormativeModalityHash(modality),
      semanticReviewRef: review.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'CONDITIONAL_QUALIFIER'],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_MODALITY_NOT_RUNTIME_NEED', 'SOURCE_MODALITY_HAS_NO_HARD_FORCE']
    },
    audit: audit(`evt-regimen-modality-publish-${label}`, a.reviewerPrincipal.principalId)
  });
}

function publishGoal(bundleValue, label, sourceExpression = SOURCE_EXPRESSION, goalObjectExpression = 'plant growth from becoming established') {
  const a = auth(bundleValue);
  const goalCondition = {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: `goal.${label}.prevent-establishment`,
    sourceExpression,
    targetScope: 'ACTION',
    relation: 'PREVENT',
    goalObjectExpression,
    authorityBindings: [{
      role: 'SOURCE_GOAL',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge carries the source-stated PREVENT purpose.'
    }],
    transformationRationale: 'Preserve source purpose without inferring trigger, current state, causal efficacy, objective, execution, or Outcome.'
  };
  const review = publishAgronomicGoalConditionReviewDecision({
    ledger: env.ledger,
    logicalId: `review.goal.regimen.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    goalCondition,
    disposition: 'ACCEPT_GOAL_CONDITION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized review confirms PREVENT action-goal source semantics.',
    audit: audit(`evt-regimen-goal-review-${label}`, a.reviewerPrincipal.principalId)
  });
  return publishAgronomicGoalConditionCompilation({
    ledger: env.ledger,
    logicalId: `goal-compilation.regimen.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      goalCondition,
      goalConditionHash: agronomicGoalConditionHash(goalCondition),
      semanticReviewRef: review.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_GOAL_NOT_RUNTIME_TRIGGER', 'SOURCE_GOAL_NOT_CAUSAL_EFFECT']
    },
    audit: audit(`evt-regimen-goal-publish-${label}`, a.reviewerPrincipal.principalId)
  });
}

function regimen({ bundleValue, modalityRef, goalRef, sourceExpression = SOURCE_EXPRESSION }) {
  return {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
    regimenId: 'fixture.b21.action-regimen',
    sourceExpression,
    actionCode: 'TILL',
    occurrenceDescriptor: {
      mode: 'SOURCE_STATED_BOUNDED_RANGE',
      minCount: 2,
      maxCount: 6,
      period: { kind: 'EACH_CALENDAR_YEAR' }
    },
    modalityCompilationRef: modalityRef,
    goalConditionCompilationRef: goalRef,
    authorityBindings: [{
      role: 'SOURCE_REGIMEN',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the whole repeated-action proposition.'
    }],
    transformationRationale: 'Bind exact action, literal annual range, exact AS_NEEDED modality and exact PREVENT goal without creating hard obligation or runtime semantics.'
  };
}

function reviewRegimen({ bundleValue, regimenValue, label = 'base' }) {
  const a = auth(bundleValue);
  return publishAgronomicActionRegimenReviewDecision({
    ledger: env.ledger,
    logicalId: `review.action-regimen.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    regimen: regimenValue,
    disposition: 'ACCEPT_ACTION_REGIMEN',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized review confirms that action, literal range, AS_NEEDED modality and PREVENT goal belong to the same source proposition.',
    audit: audit(`evt-action-regimen-review-${label}`, a.reviewerPrincipal.principalId)
  });
}

function compilation({ bundleValue, regimenValue, reviewRef, status = 'COMPLETE' }) {
  return {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [bundleValue.source.ref],
    sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
    knowledgeRefs: [bundleValue.knowledge.ref],
    regimen: regimenValue,
    regimenHash: agronomicActionRegimenHash(regimenValue),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'ACTION',
        'SOURCE_STATED_BOUNDED_RANGE',
        'AS_NEEDED_MODALITY',
        'PREVENT_GOAL',
        'SOURCE_EXPRESSION'
      ],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_REGIMEN_ELEMENT']
    },
    limitations: [
      'SOURCE_REGIMEN_NOT_HARD_OBLIGATION',
      'SOURCE_RANGE_NOT_MANDATORY_MIN_MAX',
      'AS_NEEDED_NOT_RUNTIME_PREDICATE',
      'ANNUAL_RANGE_NOT_SCHEDULE',
      'SOURCE_GOAL_NOT_CAUSAL_EFFECT',
      'SOURCE_REGIMEN_NOT_EXECUTION_OR_OUTCOME'
    ]
  };
}

const b21 = bundle('action-regimen-b21');
const modality = publishModality(b21, 'b21');
const goal = publishGoal(b21, 'b21');
const baseRegimen = regimen({
  bundleValue: b21,
  modalityRef: modality.ref,
  goalRef: goal.ref
});
const semanticReview = reviewRegimen({ bundleValue: b21, regimenValue: baseRegimen });
const published = publishAgronomicActionRegimenCompilation({
  ledger: env.ledger,
  logicalId: 'action-regimen-compilation.fixture.b21',
  version: '1',
  compilation: compilation({
    bundleValue: b21,
    regimenValue: baseRegimen,
    reviewRef: semanticReview.ref
  }),
  audit: audit('evt-action-regimen-publication', auth(b21).reviewerPrincipal.principalId)
});
const validated = validateAgronomicActionRegimenCompilationAuthority({
  ledger: env.ledger,
  compilationRef: published.ref
});

assert.equal(validated.record.ref.kind, 'AgronomicActionRegimenCompilation');
assert.equal(validated.semanticPayload.regimen.actionCode, 'TILL');
assert.deepEqual(validated.semanticPayload.regimen.occurrenceDescriptor, {
  mode: 'SOURCE_STATED_BOUNDED_RANGE',
  minCount: 2,
  maxCount: 6,
  period: { kind: 'EACH_CALENDAR_YEAR' }
});
assert.equal(Object.hasOwn(validated.semanticPayload.regimen, 'force'), false);
assert.equal(Object.hasOwn(validated.semanticPayload.regimen, 'effect'), false);

const incomplete = compilation({
  bundleValue: b21,
  regimenValue: baseRegimen,
  reviewRef: semanticReview.ref,
  status: 'INCOMPLETE'
});
expectError(() => publishAgronomicActionRegimenCompilation({
  ledger: env.ledger,
  logicalId: 'action-regimen-compilation.fixture.incomplete',
  version: '1',
  compilation: incomplete,
  audit: audit('evt-action-regimen-incomplete', auth(b21).reviewerPrincipal.principalId)
}), 'AGRONOMIC_ACTION_REGIMEN_INCOMPLETE_NOT_PUBLISHABLE');

const otherModalityBundle = bundle(
  'action-regimen-other-modality',
  'Plots are tilled as needed in a separate source proposition to manage another context.'
);
const otherModality = publishModality(
  otherModalityBundle,
  'other',
  'Plots are tilled as needed in a separate source proposition to manage another context.'
);
const crossModality = regimen({
  bundleValue: b21,
  modalityRef: otherModality.ref,
  goalRef: goal.ref
});
expectError(() => reviewRegimen({
  bundleValue: b21,
  regimenValue: crossModality,
  label: 'cross-modality'
}), 'AGRONOMIC_ACTION_REGIMEN_CROSS_PROPOSITION_PREDECESSOR_MISMATCH');

const otherGoalBundle = bundle(
  'action-regimen-other-goal',
  'Plots are tilled as needed (2-6 times a year) to prevent a different source-defined target.'
);
const otherGoal = publishGoal(
  otherGoalBundle,
  'other',
  'Plots are tilled as needed (2-6 times a year) to prevent a different source-defined target.',
  'different source-defined target'
);
const crossGoal = regimen({
  bundleValue: b21,
  modalityRef: modality.ref,
  goalRef: otherGoal.ref
});
expectError(() => reviewRegimen({
  bundleValue: b21,
  regimenValue: crossGoal,
  label: 'cross-goal'
}), 'AGRONOMIC_ACTION_REGIMEN_CROSS_PROPOSITION_PREDECESSOR_MISMATCH');

const sourceMismatch = regimen({
  bundleValue: b21,
  modalityRef: modality.ref,
  goalRef: goal.ref,
  sourceExpression: 'A source expression not present in the exact Claim.'
});
expectError(() => reviewRegimen({
  bundleValue: b21,
  regimenValue: sourceMismatch,
  label: 'source-mismatch'
}), 'AGRONOMIC_ACTION_REGIMEN_SOURCE_EXPRESSION_MISMATCH');

const wrongUse = bundle(
  'action-regimen-wrong-use',
  SOURCE_EXPRESSION,
  { use: 'OTHER_SCIENTIFIC_USE' }
);
const wrongUseRegimen = regimen({
  bundleValue: wrongUse,
  modalityRef: modality.ref,
  goalRef: goal.ref
});
expectError(() => reviewRegimen({
  bundleValue: wrongUse,
  regimenValue: wrongUseRegimen,
  label: 'wrong-use'
}), 'AGRONOMIC_ACTION_REGIMEN_KNOWLEDGE_AUTHORITY_INVALID');

const forbiddenRuntimeKinds = new Set([
  'ContextAssertion',
  'RuntimeBinding',
  'RuntimeEligibility',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const runtimeRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenRuntimeKinds.has(record.ref.kind));
assert.equal(runtimeRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicActionRegimenCompilation',
  validCompilation: validated.record.ref,
  pattern: 'AS_NEEDED + SOURCE_STATED_BOUNDED_RANGE + PREVENT + ACTION',
  normativeForcePresent: false,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'CROSS_PROPOSITION_MODALITY_DENIED',
    'CROSS_PROPOSITION_GOAL_DENIED',
    'SOURCE_EXPRESSION_MISMATCH',
    'KNOWLEDGE_WRONG_USE'
  ],
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
