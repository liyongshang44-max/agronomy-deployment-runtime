import assert from 'node:assert/strict';

import {
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicNormativeModalityCompilationError,
  agronomicNormativeModalityHash,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  validateAgronomicNormativeModalityCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  audit,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

function expectError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof AgronomicNormativeModalityCompilationError);
  assert.equal(caught.code, code);
}

const env = createEnvironment();

function bundle(label, assertion, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, { label, assertion, useTarget });
}

const permission = bundle(
  'normative-permission',
  'If needed an insecticide application can be used to control aphids.'
);

function binding(knowledgeRef) {
  return {
    role: 'SOURCE_MODALITY',
    authorityRef: knowledgeRef,
    rationale: 'The exact source-qualified knowledge carries the reviewed normative force and qualifier.'
  };
}

function modality({
  id = 'insecticide-if-needed-permitted',
  knowledgeRef = permission.knowledge.ref,
  sourceExpression = 'If needed an insecticide application can be used to control aphids.',
  targetScope = 'ACTION',
  force = 'PERMITTED',
  qualifiers = ['IF_NEEDED']
} = {}) {
  return {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: id,
    sourceExpression,
    targetScope,
    ...(force ? { force } : {}),
    qualifiers,
    authorityBindings: [binding(knowledgeRef)],
    transformationRationale: 'Preserve source normative force and conditional qualifier without inferring current need, feasibility, legality, ranking, or runtime eligibility.'
  };
}

function reviewAuthorization(bundleValue) {
  return {
    reviewerPrincipal: bundleValue.reviewed.review.semanticPayload.reviewPrincipal,
    authorizationDecisionAuditRefs: [
      bundleValue.reviewed.review.semanticPayload.authorizationDecisionAuditRef
    ]
  };
}

function acceptedReview({ label, bundleValue, modalityValue }) {
  const auth = reviewAuthorization(bundleValue);
  const review = publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: `review.modality.${label}`,
    version: '1',
    knowledgeRefs: [bundleValue.knowledge.ref],
    modality: modalityValue,
    disposition: 'ACCEPT_MODALITY',
    reviewerPrincipal: auth.reviewerPrincipal,
    authorizationDecisionAuditRefs: auth.authorizationDecisionAuditRefs,
    rationale: 'Authorized reviewer adjudicated the exact source expression as normative in the stated target scope.',
    audit: audit(`evt-modality-review-${label}`, auth.reviewerPrincipal.principalId)
  });
  return { review, reviewerPrincipal: auth.reviewerPrincipal };
}

const permissionModality = modality();
const permissionReview = acceptedReview({
  label: 'permission',
  bundleValue: permission,
  modalityValue: permissionModality
});

function compilation({ bundleValue, modalityValue, reviewRef, status = 'COMPLETE' }) {
  return {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [bundleValue.source.ref],
    sourceProtocolArtifactRefs: [bundleValue.artifact.ref],
    knowledgeRefs: [bundleValue.knowledge.ref],
    modality: modalityValue,
    modalityHash: agronomicNormativeModalityHash(modalityValue),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'NORMATIVE_FORCE', 'CONDITIONAL_QUALIFIER'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_MODALITY_ELEMENT']
    },
    limitations: [
      'SOURCE_MODALITY_NOT_CURRENT_NEED',
      'SOURCE_MODALITY_NOT_LEGAL_PERMISSION',
      'SOURCE_MODALITY_NOT_RUNTIME_ELIGIBILITY',
      'SOURCE_MODALITY_NOT_EXECUTION_EVIDENCE'
    ]
  };
}

const base = compilation({
  bundleValue: permission,
  modalityValue: permissionModality,
  reviewRef: permissionReview.review.ref
});
const published = publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.fixture.insecticide-if-needed',
  version: '1',
  compilation: base,
  audit: audit('evt-modality-publication', permissionReview.reviewerPrincipal.principalId)
});
const validated = validateAgronomicNormativeModalityCompilationAuthority({
  ledger: env.ledger,
  compilationRef: published.ref
});
assert.equal(validated.record.ref.kind, 'AgronomicNormativeModalityCompilation');
assert.equal(validated.semanticPayload.modality.force, 'PERMITTED');
assert.deepEqual(validated.semanticPayload.modality.qualifiers, ['IF_NEEDED']);

const incomplete = compilation({
  bundleValue: permission,
  modalityValue: permissionModality,
  reviewRef: permissionReview.review.ref,
  status: 'INCOMPLETE'
});
expectError(() => publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.fixture.incomplete',
  version: '1',
  compilation: incomplete,
  audit: audit('evt-modality-incomplete', permissionReview.reviewerPrincipal.principalId)
}), 'AGRONOMIC_NORMATIVE_MODALITY_INCOMPLETE_NOT_PUBLISHABLE');

const driftedModality = modality({ force: 'SHOULD', qualifiers: [] });
const drifted = compilation({
  bundleValue: permission,
  modalityValue: driftedModality,
  reviewRef: permissionReview.review.ref
});
expectError(() => publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.fixture.review-drift',
  version: '1',
  compilation: drifted,
  audit: audit('evt-modality-review-drift', permissionReview.reviewerPrincipal.principalId)
}), 'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_MISMATCH');

const other = bundle(
  'normative-undeclared',
  'The protocol contains a separate source-qualified normative statement.'
);
const undeclaredModality = modality({ knowledgeRef: other.knowledge.ref });
const auth = reviewAuthorization(permission);
expectError(() => publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.modality.undeclared-binding',
  version: '1',
  knowledgeRefs: [permission.knowledge.ref],
  modality: undeclaredModality,
  disposition: 'ACCEPT_MODALITY',
  reviewerPrincipal: auth.reviewerPrincipal,
  authorizationDecisionAuditRefs: auth.authorizationDecisionAuditRefs,
  rationale: 'Negative authority closure case.',
  audit: audit('evt-modality-undeclared', auth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_NOT_DECLARED');

const wrongUse = bundle(
  'normative-wrong-use',
  'The source contains a statement qualified for a different scientific use.',
  { use: 'OTHER_SCIENTIFIC_USE' }
);
const wrongUseAuth = reviewAuthorization(wrongUse);
expectError(() => publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.modality.wrong-use',
  version: '1',
  knowledgeRefs: [wrongUse.knowledge.ref],
  modality: modality({ knowledgeRef: wrongUse.knowledge.ref }),
  disposition: 'ACCEPT_MODALITY',
  reviewerPrincipal: wrongUseAuth.reviewerPrincipal,
  authorizationDecisionAuditRefs: wrongUseAuth.authorizationDecisionAuditRefs,
  rationale: 'Negative scientific-use case.',
  audit: audit('evt-modality-wrong-use', wrongUseAuth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_NORMATIVE_MODALITY_KNOWLEDGE_AUTHORITY_INVALID');

const logistical = bundle(
  'normative-logistical-may',
  'superphosphate, which may need to be specially ordered from the fertilizer dealer'
);
const logisticalModality = modality({
  id: 'logistical-may-lookalike',
  knowledgeRef: logistical.knowledge.ref,
  sourceExpression: 'superphosphate, which may need to be specially ordered from the fertilizer dealer',
  targetScope: 'ACTION',
  force: 'PERMITTED',
  qualifiers: []
});
const logisticalAuth = reviewAuthorization(logistical);
const rejectedReview = publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.modality.logistical-may',
  version: '1',
  knowledgeRefs: [logistical.knowledge.ref],
  modality: logisticalModality,
  disposition: 'REJECT_MODALITY',
  reasonCodes: ['LOGISTICAL_MAY_NOT_AGRONOMIC_PERMISSION'],
  reviewerPrincipal: logisticalAuth.reviewerPrincipal,
  authorizationDecisionAuditRefs: logisticalAuth.authorizationDecisionAuditRefs,
  rationale: 'The token may expresses logistical possibility/necessity, not permission for an agronomic action.',
  audit: audit('evt-modality-logistical-review', logisticalAuth.reviewerPrincipal.principalId)
});
const rejectedCompilation = compilation({
  bundleValue: logistical,
  modalityValue: logisticalModality,
  reviewRef: rejectedReview.ref
});
expectError(() => publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.fixture.logistical-may',
  version: '1',
  compilation: rejectedCompilation,
  audit: audit('evt-modality-logistical-publication', logisticalAuth.reviewerPrincipal.principalId)
}), 'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_REJECTED');

const forbiddenRuntimeKinds = new Set([
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
  authority: 'AgronomicNormativeModalityCompilation',
  validCompilation: validated.record.ref,
  requiredKnowledgeUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticReviewRequired: true,
  lexicalMayRejected: true,
  lexicalMayRejectionReason: rejectedReview.semanticPayload.reasonCodes,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'REVIEW_MISMATCH',
    'AUTHORITY_NOT_DECLARED',
    'KNOWLEDGE_WRONG_USE',
    'LOGISTICAL_MAY_REJECTED'
  ],
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
