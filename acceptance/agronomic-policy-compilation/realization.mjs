import assert from 'node:assert/strict';

import {
  AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicActionRealizationCompilationError,
  agronomicActionRealizationHash,
  agronomicActionRegimenHash,
  agronomicGoalConditionHash,
  agronomicNormativeModalityHash,
  publishAgronomicActionRealizationCompilation,
  publishAgronomicActionRealizationReviewDecision,
  publishAgronomicActionRegimenCompilation,
  publishAgronomicActionRegimenReviewDecision,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  validateAgronomicActionRealizationCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import { audit, createEnvironment, makeQualifiedKnowledge } from '../derived-knowledge/fixture.mjs';

const REGIMEN_SOURCE =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';
const REALIZATION_SOURCE =
  'Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.';
const COMBINED_ASSERTION = `${REGIMEN_SOURCE} ${REALIZATION_SOURCE}`;

function expectError(fn, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof AgronomicActionRealizationCompilationError);
  assert.equal(caught.code, code);
}

const env = createEnvironment();

function bundle(label, assertion = COMBINED_ASSERTION, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
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

function publishParent(bundleValue, label) {
  const a = auth(bundleValue);

  const modality = {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: `modality.${label}.as-needed`,
    sourceExpression: REGIMEN_SOURCE,
    targetScope: 'OCCURRENCE',
    qualifiers: ['AS_NEEDED'],
    authorityBindings: [{
      role: 'SOURCE_MODALITY',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes AS_NEEDED.'
    }],
    transformationRationale: 'Preserve AS_NEEDED without runtime or hard-force semantics.'
  };
  const modalityReview = publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: `review.realization.modality.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    modality,
    disposition: 'ACCEPT_MODALITY',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review.',
    audit: audit(`evt-realization-modality-review-${label}`, a.reviewerPrincipal.principalId)
  });
  const modalityCompilation = publishAgronomicNormativeModalityCompilation({
    ledger: env.ledger,
    logicalId: `modality-compilation.realization.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      modality,
      modalityHash: agronomicNormativeModalityHash(modality),
      semanticReviewRef: modalityReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'CONDITIONAL_QUALIFIER'],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_MODALITY_NOT_RUNTIME_NEED']
    },
    audit: audit(`evt-realization-modality-publish-${label}`, a.reviewerPrincipal.principalId)
  });

  const goalCondition = {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: `goal.${label}.prevent`,
    sourceExpression: REGIMEN_SOURCE,
    targetScope: 'ACTION',
    relation: 'PREVENT',
    goalObjectExpression: 'plant growth from becoming established',
    authorityBindings: [{
      role: 'SOURCE_GOAL',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the PREVENT goal.'
    }],
    transformationRationale: 'Preserve source goal without runtime or causal semantics.'
  };
  const goalReview = publishAgronomicGoalConditionReviewDecision({
    ledger: env.ledger,
    logicalId: `review.realization.goal.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    goalCondition,
    disposition: 'ACCEPT_GOAL_CONDITION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review.',
    audit: audit(`evt-realization-goal-review-${label}`, a.reviewerPrincipal.principalId)
  });
  const goalCompilation = publishAgronomicGoalConditionCompilation({
    ledger: env.ledger,
    logicalId: `goal-compilation.realization.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      goalCondition,
      goalConditionHash: agronomicGoalConditionHash(goalCondition),
      semanticReviewRef: goalReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_GOAL_NOT_CAUSAL_EFFECT']
    },
    audit: audit(`evt-realization-goal-publish-${label}`, a.reviewerPrincipal.principalId)
  });

  const regimen = {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
    regimenId: `regimen.${label}.b21`,
    sourceExpression: REGIMEN_SOURCE,
    actionCode: 'TILL',
    occurrenceDescriptor: {
      mode: 'SOURCE_STATED_BOUNDED_RANGE',
      minCount: 2,
      maxCount: 6,
      period: { kind: 'EACH_CALENDAR_YEAR' }
    },
    modalityCompilationRef: modalityCompilation.ref,
    goalConditionCompilationRef: goalCompilation.ref,
    authorityBindings: [{
      role: 'SOURCE_REGIMEN',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the source action regimen.'
    }],
    transformationRationale: 'Preserve the source regimen without hard obligation or runtime semantics.'
  };
  const regimenReview = publishAgronomicActionRegimenReviewDecision({
    ledger: env.ledger,
    logicalId: `review.realization.regimen.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    regimen,
    disposition: 'ACCEPT_ACTION_REGIMEN',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized source-regimen review.',
    audit: audit(`evt-realization-regimen-review-${label}`, a.reviewerPrincipal.principalId)
  });
  return publishAgronomicActionRegimenCompilation({
    ledger: env.ledger,
    logicalId: `regimen-compilation.realization.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      regimen,
      regimenHash: agronomicActionRegimenHash(regimen),
      semanticReviewRef: regimenReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: ['ACTION', 'SOURCE_STATED_BOUNDED_RANGE', 'AS_NEEDED_MODALITY', 'PREVENT_GOAL', 'SOURCE_EXPRESSION'],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_REGIMEN_NOT_HARD_OBLIGATION']
    },
    audit: audit(`evt-realization-regimen-publish-${label}`, a.reviewerPrincipal.principalId)
  });
}

function realization(bundleValue, parentRef, sourceExpression = REALIZATION_SOURCE) {
  return {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
    realizationId: 'fixture.b21.tillage-realization',
    sourceExpression,
    parentRegimenCompilationRef: parentRef,
    targetActionCode: 'TILL',
    realizationSet: {
      closure: 'OPEN_SOURCE_DEFINED',
      alternatives: [
        { kind: 'NAMED_METHOD', methodCode: 'SOIL_FINISHING', sourceExpression: 'soil finishing' },
        { kind: 'NAMED_METHOD', methodCode: 'ROTOTILLING', sourceExpression: 'rototilling' },
        {
          kind: 'SOURCE_DEFINED_OPEN_CLASS',
          classExpression: 'any tillage that keeps plant growth from becoming established',
          membershipCriterionExpression: 'keeps plant growth from becoming established'
        }
      ]
    },
    authorityBindings: [{
      role: 'SOURCE_ACTION_REALIZATION',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the source action-realization proposition.'
    }],
    transformationRationale: 'Preserve source-open TILL realizations without permission, exclusivity, ranking, equivalence, runtime eligibility or causal efficacy.'
  };
}

function review(bundleValue, value, label) {
  const a = auth(bundleValue);
  return publishAgronomicActionRealizationReviewDecision({
    ledger: env.ledger,
    logicalId: `review.action-realization.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    realization: value,
    disposition: 'ACCEPT_ACTION_REALIZATION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized review confirms that the source realization sentence refines the exact parent TILL regimen.',
    audit: audit(`evt-action-realization-review-${label}`, a.reviewerPrincipal.principalId)
  });
}

function compilation(bundleValue, value, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [bundleValue.source.ref],
    sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
    knowledgeRefs: [bundleValue.knowledge.ref],
    realization: value,
    realizationHash: agronomicActionRealizationHash(value),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: ['PARENT_TILL_REFINEMENT', 'NAMED_METHODS', 'SOURCE_DEFINED_OPEN_CLASS', 'OPEN_CLOSURE'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_REALIZATION_ELEMENT']
    },
    limitations: [
      'SOURCE_REALIZATION_NOT_RUNTIME_ALTERNATIVE_SET',
      'SOURCE_REALIZATION_NOT_POLICY_ACTION_SPACE',
      'CAN_BE_NOT_PERMISSION',
      'OPEN_CLASS_NOT_CAUSAL_EFFECT',
      'REALIZATIONS_NOT_ASSUMED_EXCLUSIVE_OR_EQUIVALENT'
    ]
  };
}

const base = bundle('action-realization-base');
const parent = publishParent(base, 'base');
const value = realization(base, parent.ref);
const semanticReview = review(base, value, 'base');
const published = publishAgronomicActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'action-realization-compilation.fixture.b21',
  version: '1',
  compilation: compilation(base, value, semanticReview.ref),
  audit: audit('evt-action-realization-publication', auth(base).reviewerPrincipal.principalId)
});
const validated = validateAgronomicActionRealizationCompilationAuthority({
  ledger: env.ledger,
  compilationRef: published.ref
});
assert.equal(validated.record.ref.kind, 'AgronomicActionRealizationCompilation');
assert.equal(validated.semanticPayload.realization.realizationSet.closure, 'OPEN_SOURCE_DEFINED');
assert.equal(validated.parentRegimenAuthority.semanticPayload.regimen.actionCode, 'TILL');

expectError(() => publishAgronomicActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'action-realization-compilation.fixture.incomplete',
  version: '1',
  compilation: compilation(base, value, semanticReview.ref, 'INCOMPLETE'),
  audit: audit('evt-action-realization-incomplete', auth(base).reviewerPrincipal.principalId)
}), 'AGRONOMIC_ACTION_REALIZATION_INCOMPLETE_NOT_PUBLISHABLE');

const unrelated = bundle('action-realization-unrelated-parent');
const unrelatedParent = publishParent(unrelated, 'unrelated');
const wrongParentValue = realization(base, unrelatedParent.ref);
expectError(
  () => review(base, wrongParentValue, 'wrong-parent'),
  'AGRONOMIC_ACTION_REALIZATION_PARENT_SOURCE_MISMATCH'
);

const mismatchValue = realization(
  base,
  parent.ref,
  'This realization expression is absent from exact source-qualified evidence.'
);
expectError(
  () => review(base, mismatchValue, 'source-mismatch'),
  'AGRONOMIC_ACTION_REALIZATION_SOURCE_EXPRESSION_MISMATCH'
);

const wrongUse = bundle('action-realization-wrong-use', COMBINED_ASSERTION, { use: 'OTHER_SCIENTIFIC_USE' });
const wrongUseValue = realization(wrongUse, parent.ref);
expectError(
  () => review(wrongUse, wrongUseValue, 'wrong-use'),
  'AGRONOMIC_ACTION_REALIZATION_KNOWLEDGE_AUTHORITY_INVALID'
);

const drifted = structuredClone(compilation(base, value, semanticReview.ref));
drifted.realization.transformationRationale = 'Different accepted semantics are not authorized by the original review.';
drifted.realizationHash = agronomicActionRealizationHash(drifted.realization);
expectError(() => publishAgronomicActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'action-realization-compilation.fixture.review-drift',
  version: '1',
  compilation: drifted,
  audit: audit('evt-action-realization-review-drift', auth(base).reviewerPrincipal.principalId)
}), 'AGRONOMIC_ACTION_REALIZATION_REVIEW_MISMATCH');

const forbiddenKinds = new Set([
  'Policy',
  'RuntimePlan',
  'RuntimeEligibility',
  'RuntimeBinding',
  'RuntimeAlternativeSet',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const forbiddenRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicActionRealizationCompilation',
  validCompilation: validated.record.ref,
  parentRegimen: validated.parentRegimenAuthority.record.ref,
  closure: validated.semanticPayload.realization.realizationSet.closure,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'UNRELATED_PARENT_SOURCE_DENIED',
    'SOURCE_EXPRESSION_MISMATCH',
    'KNOWLEDGE_WRONG_USE',
    'REVIEW_DRIFT_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
