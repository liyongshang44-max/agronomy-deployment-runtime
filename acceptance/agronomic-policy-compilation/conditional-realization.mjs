import assert from 'node:assert/strict';

import {
  AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicConditionalActionRealizationCompilationError,
  agronomicActionRealizationHash,
  agronomicActionRegimenHash,
  agronomicConditionalActionRealizationHash,
  agronomicGoalConditionHash,
  agronomicNormativeModalityHash,
  publishAgronomicActionRealizationCompilation,
  publishAgronomicActionRealizationReviewDecision,
  publishAgronomicActionRegimenCompilation,
  publishAgronomicActionRegimenReviewDecision,
  publishAgronomicConditionalActionRealizationCompilation,
  publishAgronomicConditionalActionRealizationReviewDecision,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  validateAgronomicConditionalActionRealizationCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  audit,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

const REGIMEN_SOURCE =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';
const REALIZATION_SOURCE =
  'Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.';
const CONDITIONAL_SOURCE =
  'Plots can be chisel plowed and soil finished if more aggressive tillage is needed.';
const COMBINED_ASSERTION =
  `${REGIMEN_SOURCE} ${REALIZATION_SOURCE} ${CONDITIONAL_SOURCE}`;

function expectError(fn, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof AgronomicConditionalActionRealizationCompilationError);
  assert.equal(caught.code, code);
}

const env = createEnvironment();

function bundle(
  label,
  assertion = COMBINED_ASSERTION,
  useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
) {
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

function publishModality({
  bundleValue,
  label,
  sourceExpression,
  targetScope,
  qualifiers,
  force
}) {
  const a = auth(bundleValue);
  const modality = {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: `modality.conditional.${label}`,
    sourceExpression,
    targetScope,
    ...(force ? { force } : {}),
    qualifiers,
    authorityBindings: [{
      role: 'SOURCE_MODALITY',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the reviewed source modality.'
    }],
    transformationRationale:
      'Preserve reviewed source modality without inventing runtime condition state.'
  };
  const review = publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: `review.modality.conditional.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    modality,
    disposition: 'ACCEPT_MODALITY',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review confirms the exact source modality.',
    audit: audit(`evt-conditional-modality-review-${label}`, a.reviewerPrincipal.principalId)
  });
  return publishAgronomicNormativeModalityCompilation({
    ledger: env.ledger,
    logicalId: `modality-compilation.conditional.${label}`,
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
      limitations: ['SOURCE_MODALITY_NOT_RUNTIME_CONDITION']
    },
    audit: audit(`evt-conditional-modality-publish-${label}`, a.reviewerPrincipal.principalId)
  });
}

function publishParentStack(bundleValue, label) {
  const a = auth(bundleValue);

  const regimenModality = publishModality({
    bundleValue,
    label: `${label}.regimen-as-needed`,
    sourceExpression: REGIMEN_SOURCE,
    targetScope: 'OCCURRENCE',
    qualifiers: ['AS_NEEDED']
  });

  const goalCondition = {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: `goal.conditional.${label}.prevent`,
    sourceExpression: REGIMEN_SOURCE,
    targetScope: 'ACTION',
    relation: 'PREVENT',
    goalObjectExpression: 'plant growth from becoming established',
    authorityBindings: [{
      role: 'SOURCE_GOAL',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the PREVENT goal.'
    }],
    transformationRationale:
      'Preserve source goal without runtime trigger or causal-efficacy semantics.'
  };
  const goalReview = publishAgronomicGoalConditionReviewDecision({
    ledger: env.ledger,
    logicalId: `review.goal.conditional.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    goalCondition,
    disposition: 'ACCEPT_GOAL_CONDITION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review confirms the source goal.',
    audit: audit(`evt-conditional-goal-review-${label}`, a.reviewerPrincipal.principalId)
  });
  const goalCompilation = publishAgronomicGoalConditionCompilation({
    ledger: env.ledger,
    logicalId: `goal-compilation.conditional.${label}`,
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
        coveredElements: [
          'SOURCE_EXPRESSION',
          'TARGET_SCOPE',
          'GOAL_RELATION',
          'GOAL_OBJECT_EXPRESSION'
        ],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_GOAL_NOT_CAUSAL_EFFECT']
    },
    audit: audit(`evt-conditional-goal-publish-${label}`, a.reviewerPrincipal.principalId)
  });

  const regimen = {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
    regimenId: `regimen.conditional.${label}`,
    sourceExpression: REGIMEN_SOURCE,
    actionCode: 'TILL',
    occurrenceDescriptor: {
      mode: 'SOURCE_STATED_BOUNDED_RANGE',
      minCount: 2,
      maxCount: 6,
      period: { kind: 'EACH_CALENDAR_YEAR' }
    },
    modalityCompilationRef: regimenModality.ref,
    goalConditionCompilationRef: goalCompilation.ref,
    authorityBindings: [{
      role: 'SOURCE_REGIMEN',
      authorityRef: bundleValue.knowledge.ref,
      rationale: 'Exact source-qualified knowledge establishes the parent source regimen.'
    }],
    transformationRationale:
      'Preserve parent TILL regimen without hard obligation or runtime semantics.'
  };
  const regimenReview = publishAgronomicActionRegimenReviewDecision({
    ledger: env.ledger,
    logicalId: `review.regimen.conditional.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    regimen,
    disposition: 'ACCEPT_ACTION_REGIMEN',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review confirms the parent source regimen.',
    audit: audit(`evt-conditional-regimen-review-${label}`, a.reviewerPrincipal.principalId)
  });
  const parentRegimen = publishAgronomicActionRegimenCompilation({
    ledger: env.ledger,
    logicalId: `regimen-compilation.conditional.${label}`,
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
        coveredElements: [
          'ACTION',
          'SOURCE_STATED_BOUNDED_RANGE',
          'AS_NEEDED_MODALITY',
          'PREVENT_GOAL',
          'SOURCE_EXPRESSION'
        ],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_REGIMEN_NOT_RUNTIME_DECISION']
    },
    audit: audit(`evt-conditional-regimen-publish-${label}`, a.reviewerPrincipal.principalId)
  });

  const realization = {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
    realizationId: `realization.conditional.${label}`,
    sourceExpression: REALIZATION_SOURCE,
    parentRegimenCompilationRef: parentRegimen.ref,
    targetActionCode: 'TILL',
    realizationSet: {
      closure: 'OPEN_SOURCE_DEFINED',
      alternatives: [
        {
          kind: 'NAMED_METHOD',
          methodCode: 'SOIL_FINISHING',
          sourceExpression: 'soil finishing'
        },
        {
          kind: 'NAMED_METHOD',
          methodCode: 'ROTOTILLING',
          sourceExpression: 'rototilling'
        },
        {
          kind: 'SOURCE_DEFINED_OPEN_CLASS',
          classExpression:
            'any tillage that keeps plant growth from becoming established',
          membershipCriterionExpression:
            'keeps plant growth from becoming established'
        }
      ]
    },
    authorityBindings: [{
      role: 'SOURCE_ACTION_REALIZATION',
      authorityRef: bundleValue.knowledge.ref,
      rationale:
        'Exact source-qualified knowledge establishes the parent action-realization proposition.'
    }],
    transformationRationale:
      'Preserve parent source-open TILL realizations without runtime or permission semantics.'
  };
  const realizationReview = publishAgronomicActionRealizationReviewDecision({
    ledger: env.ledger,
    logicalId: `review.realization.conditional.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    realization,
    disposition: 'ACCEPT_ACTION_REALIZATION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale: 'Authorized semantic review confirms the parent TILL realization set.',
    audit: audit(
      `evt-conditional-realization-review-${label}`,
      a.reviewerPrincipal.principalId
    )
  });
  const parentActionRealization = publishAgronomicActionRealizationCompilation({
    ledger: env.ledger,
    logicalId: `action-realization-compilation.conditional.${label}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [bundleValue.source.ref],
      sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
      knowledgeRefs: [bundleValue.knowledge.ref],
      realization,
      realizationHash: agronomicActionRealizationHash(realization),
      semanticReviewRef: realizationReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: [
          'PARENT_TILL_REFINEMENT',
          'NAMED_METHODS',
          'SOURCE_DEFINED_OPEN_CLASS',
          'OPEN_CLOSURE'
        ],
        unrepresentedElements: []
      },
      limitations: ['SOURCE_REALIZATION_NOT_RUNTIME_ALTERNATIVE_SET']
    },
    audit: audit(
      `evt-conditional-realization-publish-${label}`,
      a.reviewerPrincipal.principalId
    )
  });

  return { parentRegimen, parentActionRealization };
}

function conditionalValue({
  bundleValue,
  parentRegimenRef,
  parentActionRealizationRef,
  modalityRef,
  sourceExpression = CONDITIONAL_SOURCE
}) {
  return {
    contractVersion: AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
    conditionalRealizationId: 'fixture.conditional-tillage',
    sourceExpression,
    parentRegimenCompilationRef: parentRegimenRef,
    parentActionRealizationCompilationRef: parentActionRealizationRef,
    targetActionCode: 'TILL',
    compoundRealization: {
      composition: 'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
      components: [
        {
          kind: 'SOURCE_NAMED_METHOD',
          methodCode: 'CHISEL_PLOWING',
          sourceExpression: 'chisel plowed'
        },
        {
          kind: 'EXISTING_SOURCE_METHOD',
          methodCode: 'SOIL_FINISHING',
          sourceExpression: 'soil finished'
        }
      ]
    },
    modalityCompilationRef: modalityRef,
    sourceCondition: {
      expression: 'more aggressive tillage is needed',
      objectExpression: 'more aggressive tillage'
    },
    authorityBindings: [{
      role: 'SOURCE_CONDITIONAL_ACTION_REALIZATION',
      authorityRef: bundleValue.knowledge.ref,
      rationale:
        'Exact source-qualified knowledge establishes the conditional compound realization.'
    }],
    transformationRationale:
      'Preserve IF_NEEDED compound realization without runtime predicate, order, ranking, permission or execution semantics.'
  };
}

function reviewConditional(bundleValue, conditionalRealization, label) {
  const a = auth(bundleValue);
  return publishAgronomicConditionalActionRealizationReviewDecision({
    ledger: env.ledger,
    logicalId: `review.conditional-action-realization.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    conditionalRealization,
    disposition: 'ACCEPT_CONDITIONAL_ACTION_REALIZATION',
    reviewerPrincipal: a.reviewerPrincipal,
    authorizationDecisionAuditRefs: a.authorizationDecisionAuditRefs,
    rationale:
      'Authorized review confirms existing SOIL_FINISHING identity, new CHISEL_PLOWING identity, source conjunction without order, and exact IF_NEEDED condition semantics.',
    audit: audit(
      `evt-conditional-action-realization-review-${label}`,
      a.reviewerPrincipal.principalId
    )
  });
}

function compilation(
  bundleValue,
  conditionalRealization,
  reviewRef,
  status = 'COMPLETE'
) {
  return {
    contractVersion:
      AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [bundleValue.source.ref],
    sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
    knowledgeRefs: [bundleValue.knowledge.ref],
    conditionalRealization,
    conditionalRealizationHash:
      agronomicConditionalActionRealizationHash(conditionalRealization),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_TILL',
        'CHISEL_PLOWING',
        'SOIL_FINISHING',
        'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
        'IF_NEEDED',
        'SOURCE_CONDITION'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_CONDITIONAL_ELEMENT']
    },
    limitations: [
      'SOURCE_CONDITION_NOT_RUNTIME_PREDICATE',
      'SOURCE_CONJUNCTION_NOT_ORDER',
      'CAN_BE_NOT_PERMISSION',
      'AGGRESSIVENESS_NOT_SCALE_OR_RANK',
      'COMPOUND_NOT_ASSUMED_PARENT_OPEN_CLASS_MEMBER',
      'SOURCE_CONDITIONAL_REALIZATION_NOT_RUNTIME_ELIGIBILITY'
    ]
  };
}

const base = bundle('conditional-realization-base');
const parents = publishParentStack(base, 'base');
const ifNeeded = publishModality({
  bundleValue: base,
  label: 'base.if-needed',
  sourceExpression: CONDITIONAL_SOURCE,
  targetScope: 'ACTION',
  qualifiers: ['IF_NEEDED']
});

const candidate = conditionalValue({
  bundleValue: base,
  parentRegimenRef: parents.parentRegimen.ref,
  parentActionRealizationRef: parents.parentActionRealization.ref,
  modalityRef: ifNeeded.ref
});
const semanticReview = reviewConditional(base, candidate, 'base');
const published = publishAgronomicConditionalActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'conditional-action-realization-compilation.fixture',
  version: '1',
  compilation: compilation(base, candidate, semanticReview.ref),
  audit: audit(
    'evt-conditional-action-realization-publication',
    auth(base).reviewerPrincipal.principalId
  )
});
const validated =
  validateAgronomicConditionalActionRealizationCompilationAuthority({
    ledger: env.ledger,
    compilationRef: published.ref
  });

assert.equal(
  validated.record.ref.kind,
  'AgronomicConditionalActionRealizationCompilation'
);
assert.equal(
  validated.semanticPayload.conditionalRealization.compoundRealization.composition,
  'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED'
);
assert.deepEqual(
  validated.semanticPayload.conditionalRealization.compoundRealization.components
    .map((item) => item.methodCode).sort(),
  ['CHISEL_PLOWING', 'SOIL_FINISHING']
);
assert.deepEqual(
  validated.modalityAuthority.semanticPayload.modality.qualifiers,
  ['IF_NEEDED']
);
assert.equal(
  Object.hasOwn(validated.modalityAuthority.semanticPayload.modality, 'force'),
  false
);

expectError(() => publishAgronomicConditionalActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'conditional-action-realization-compilation.fixture.incomplete',
  version: '1',
  compilation: compilation(base, candidate, semanticReview.ref, 'INCOMPLETE'),
  audit: audit(
    'evt-conditional-action-realization-incomplete',
    auth(base).reviewerPrincipal.principalId
  )
}), 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INCOMPLETE_NOT_PUBLISHABLE');

const unrelated = bundle('conditional-realization-unrelated');
const unrelatedParents = publishParentStack(unrelated, 'unrelated');
const wrongParent = conditionalValue({
  bundleValue: base,
  parentRegimenRef: unrelatedParents.parentRegimen.ref,
  parentActionRealizationRef: unrelatedParents.parentActionRealization.ref,
  modalityRef: ifNeeded.ref
});
expectError(
  () => reviewConditional(base, wrongParent, 'wrong-parent'),
  'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PARENT_SOURCE_MISMATCH'
);

const wrongQualifier = publishModality({
  bundleValue: base,
  label: 'wrong-qualifier',
  sourceExpression: CONDITIONAL_SOURCE,
  targetScope: 'ACTION',
  qualifiers: ['AS_NEEDED']
});
const wrongModalityCandidate = conditionalValue({
  bundleValue: base,
  parentRegimenRef: parents.parentRegimen.ref,
  parentActionRealizationRef: parents.parentActionRealization.ref,
  modalityRef: wrongQualifier.ref
});
expectError(
  () => reviewConditional(base, wrongModalityCandidate, 'wrong-modality'),
  'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_MODALITY_SHAPE_INVALID'
);

const sourceMismatch = conditionalValue({
  bundleValue: base,
  parentRegimenRef: parents.parentRegimen.ref,
  parentActionRealizationRef: parents.parentActionRealization.ref,
  modalityRef: ifNeeded.ref,
  sourceExpression: 'A conditional source expression absent from exact Claim evidence.'
});
expectError(
  () => reviewConditional(base, sourceMismatch, 'source-mismatch'),
  'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SOURCE_EXPRESSION_MISMATCH'
);

const wrongUse = bundle(
  'conditional-realization-wrong-use',
  COMBINED_ASSERTION,
  { use: 'OTHER_SCIENTIFIC_USE' }
);
const wrongUseParents = publishParentStack(base, 'wrong-use-parent-holder');
const wrongUseModality = ifNeeded;
const wrongUseCandidate = conditionalValue({
  bundleValue: wrongUse,
  parentRegimenRef: wrongUseParents.parentRegimen.ref,
  parentActionRealizationRef: wrongUseParents.parentActionRealization.ref,
  modalityRef: wrongUseModality.ref
});
expectError(
  () => reviewConditional(wrongUse, wrongUseCandidate, 'wrong-use'),
  'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_KNOWLEDGE_AUTHORITY_INVALID'
);

const drifted = structuredClone(compilation(base, candidate, semanticReview.ref));
drifted.conditionalRealization.transformationRationale =
  'Different reviewed semantics are not authorized by the original review.';
drifted.conditionalRealizationHash =
  agronomicConditionalActionRealizationHash(drifted.conditionalRealization);
expectError(() => publishAgronomicConditionalActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'conditional-action-realization-compilation.fixture.review-drift',
  version: '1',
  compilation: drifted,
  audit: audit(
    'evt-conditional-action-realization-review-drift',
    auth(base).reviewerPrincipal.principalId
  )
}), 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_MISMATCH');

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
  authority: 'AgronomicConditionalActionRealizationCompilation',
  validCompilation: validated.record.ref,
  parentRegimen: validated.parentRegimenAuthority.record.ref,
  parentActionRealization: validated.parentActionRealizationAuthority.record.ref,
  modality: validated.modalityAuthority.record.ref,
  composition: 'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
  conditionExpression: 'more aggressive tillage is needed',
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'UNRELATED_PARENT_SOURCE_DENIED',
    'WRONG_MODALITY_QUALIFIER_DENIED',
    'SOURCE_EXPRESSION_MISMATCH',
    'KNOWLEDGE_WRONG_USE',
    'REVIEW_DRIFT_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
