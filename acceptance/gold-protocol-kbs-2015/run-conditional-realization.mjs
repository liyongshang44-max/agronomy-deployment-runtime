import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  normalizeAgronomicConditionalActionRealization,
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
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  ScientificQualificationService,
  qualificationResourceId
} from '../../packages/knowledge-registry/src/qualification.mjs';
import {
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  ExactArtifactStore,
  SourceRegistry,
  sourceContentHash
} from '../../packages/source-registry/src/index.mjs';
import { makeEnv, audit } from '../specification/fixture.mjs';

const OWNERSHIP = { organizationId: 'org-a', tenantId: 'tenant-a' };
const EXPECTED_EXCERPT_HASH =
  'sha256:fe7e3ff2e3f69562e8452d0456b7bb5b290a5edc651e3f95ecc202d4f120a1d2';

const REGIMEN_SOURCE =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';
const REALIZATION_SOURCE =
  'Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.';
const CONDITIONAL_SOURCE =
  'Plots can be chisel plowed and soil finished if more aggressive tillage is needed.';
const GOAL_OBJECT = 'plant growth from becoming established';

const claimSpecs = [
  { key: 'b21-parent-regimen', evidenceText: REGIMEN_SOURCE },
  { key: 'b21-parent-action-realization', evidenceText: REALIZATION_SOURCE },
  { key: 'b21-conditional-action-realization', evidenceText: CONDITIONAL_SOURCE }
];

function locator(spec) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: 20, evidenceText: spec.evidenceText }
  };
}

function emptyContextFamilies() {
  return Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [
      family,
      { status: 'NOT_REPORTED', dimensions: [] }
    ])
  );
}

function emptyContextAdjudication() {
  return Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, []])
  );
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});

const excerptBytes = readFileSync(
  new URL('./kbs-2015-realization-excerpts.txt', import.meta.url)
);
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-conditional-action-realization-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — B21 conditional action realization',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: 'current_agronomic_protocol.pdf#page=20',
  metadata: {
    sourcePage: 20,
    benchmarkClass: 'REAL_SOURCE_CURATED_CONDITIONAL_ACTION_REALIZATION_EXCERPTS'
  },
  audit: audit(
    { type: 'USER', id: 'kbs-conditional-source-curator' },
    'kbs-conditional-source'
  )
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-conditional-action-realization-gold',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-conditional-action-realization-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-28T04:20:00.000+08:00',
    locator: 'current_agronomic_protocol.pdf#page=20',
    metadata: {
      sourcePage: 20,
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    originalPdfBytesRetainedByThisBenchmark: false,
    exactExcerptBytesRetained: true
  },
  audit: audit(
    { type: 'USER', id: 'kbs-conditional-source-curator' },
    'kbs-conditional-artifact'
  )
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-conditional-action-realization',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-conditional-action-realization.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit(
    { type: 'SERVICE_ACCOUNT', id: 'gold-conditional-compiler' },
    'kbs-conditional-compiler'
  )
});

const compiler = new ScientificCompiler({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry
});

const bundle = compiler.materializeCompilationProposal({
  compilationLogicalId:
    'compilation.gold.kbs-2015-conditional-action-realization-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: claimSpecs.map((spec) => ({
      key: spec.key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: spec.evidenceText,
      sourceLocator: locator(spec),
      sourceContext: emptyContextFamilies()
    })),
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit(
    { type: 'SERVICE_ACCOUNT', id: 'gold-conditional-compiler' },
    'kbs-conditional-compilation'
  )
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-conditional-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});

const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.conditional-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(
    { type: 'USER', id: 'iam-admin' },
    'kbs-conditional-review-role'
  )
});

const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.conditional-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(
    { type: 'USER', id: 'iam-admin' },
    'kbs-conditional-review-policy'
  )
});

const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit(
    { type: 'SERVICE_ACCOUNT', id: 'iam-engine' },
    'kbs-conditional-review-auth'
  )
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });

const reviewed = claimSpecs.map((spec, index) =>
  sourceFaithful.reviewCandidate({
    reviewLogicalId:
      `review.gold.kbs.conditional.source-faithful.${spec.key}`,
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[index].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[index].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: emptyContextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuthorization.ref,
    claimLogicalId: `claim.gold.kbs.conditional.${spec.key}`,
    claimVersion: '1',
    sourceContextLogicalId:
      `source-context.gold.kbs.conditional.${spec.key}`,
    sourceContextVersion: '1',
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      `kbs-conditional-source-faithful-${spec.key}`
    )
  })
);

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-conditional-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});

const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.conditional-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(
    { type: 'USER', id: 'iam-admin' },
    'kbs-conditional-scientific-role'
  )
});

const qualificationService = new ScientificQualificationService({
  ledger: env.ledger
});

function qualifyReviewed(index, key) {
  const item = reviewed[index];
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.conditional-qualification.${key}`,
    version: '1',
    resourceId: qualificationResourceId(item.claim.ref, item.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit(
      { type: 'USER', id: 'iam-admin' },
      `kbs-conditional-qualification-policy-${key}`
    )
  });

  const authorization = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeQualification({
      principal: scientificApprover,
      policy,
      roleAssignments: [scientificApproverRole],
      qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
      authorizationScope: OWNERSHIP
    }),
    audit: audit(
      { type: 'SERVICE_ACCOUNT', id: 'iam-engine' },
      `kbs-conditional-qualification-auth-${key}`
    )
  });

  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.conditional.${key}`,
    decisionVersion: '1',
    claimRef: item.claim.ref,
    sourceContextRef: item.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: [],
    approverPrincipal: scientificApprover,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit(
      { type: scientificApprover.type, id: scientificApprover.principalId },
      `kbs-conditional-qualification-${key}`
    )
  });

  return qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.conditional.${key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(
      { type: scientificApprover.type, id: scientificApprover.principalId },
      `kbs-conditional-qualified-${key}`
    )
  });
}

const parentKnowledge = qualifyReviewed(0, 'parent-regimen');
const realizationKnowledge = qualifyReviewed(1, 'parent-action-realization');
const conditionalKnowledge = qualifyReviewed(2, 'conditional-action-realization');

assert.notDeepEqual(parentKnowledge.ref, realizationKnowledge.ref);
assert.notDeepEqual(parentKnowledge.ref, conditionalKnowledge.ref);
assert.notDeepEqual(realizationKnowledge.ref, conditionalKnowledge.ref);

// Claim A -> exact parent Regimen.
const parentModality = {
  contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  modalityId: 'kbs-b21-conditional-parent-as-needed',
  sourceExpression: REGIMEN_SOURCE,
  targetScope: 'OCCURRENCE',
  qualifiers: ['AS_NEEDED'],
  authorityBindings: [{
    role: 'SOURCE_MODALITY',
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact Claim A knowledge establishes AS_NEEDED.'
  }],
  transformationRationale:
    'Preserve AS_NEEDED without hard force or runtime need.'
};

const parentModalityReview = publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.conditional.parent-modality',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  modality: parentModality,
  disposition: 'ACCEPT_MODALITY',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim A AS_NEEDED semantics.',
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-modality-review'
  )
});

const parentModalityCompilation =
  publishAgronomicNormativeModalityCompilation({
    ledger: env.ledger,
    logicalId: 'modality-compilation.gold.kbs.conditional.parent',
    version: '1',
    compilation: {
      contractVersion:
        AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [source.ref],
      sourceProtocolArtifactRefs: [artifact.ref],
      knowledgeRefs: [parentKnowledge.ref],
      modality: parentModality,
      modalityHash: agronomicNormativeModalityHash(parentModality),
      semanticReviewRef: parentModalityReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: [
          'SOURCE_EXPRESSION',
          'TARGET_SCOPE',
          'CONDITIONAL_QUALIFIER'
        ],
        unrepresentedElements: []
      },
      limitations: ['AS_NEEDED_NOT_RUNTIME_PREDICATE']
    },
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'kbs-conditional-parent-modality-publish'
    )
  });

const goalValue = {
  contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  goalConditionId: 'kbs-b21-conditional-parent-prevent',
  sourceExpression: REGIMEN_SOURCE,
  targetScope: 'ACTION',
  relation: 'PREVENT',
  goalObjectExpression: GOAL_OBJECT,
  authorityBindings: [{
    role: 'SOURCE_GOAL',
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact Claim A knowledge establishes PREVENT goal.'
  }],
  transformationRationale:
    'Preserve source goal without runtime trigger or causal efficacy.'
};

const goalReview = publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.conditional.parent-goal',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  goalCondition: goalValue,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim A PREVENT goal.',
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-goal-review'
  )
});

const goalCompilation = publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.gold.kbs.conditional.parent',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [parentKnowledge.ref],
    goalCondition: goalValue,
    goalConditionHash: agronomicGoalConditionHash(goalValue),
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
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-goal-publish'
  )
});

const regimenValue = {
  contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  regimenId: 'kbs-b21-conditional-parent-regimen',
  sourceExpression: REGIMEN_SOURCE,
  actionCode: 'TILL',
  occurrenceDescriptor: {
    mode: 'SOURCE_STATED_BOUNDED_RANGE',
    minCount: 2,
    maxCount: 6,
    period: { kind: 'EACH_CALENDAR_YEAR' }
  },
  modalityCompilationRef: parentModalityCompilation.ref,
  goalConditionCompilationRef: goalCompilation.ref,
  authorityBindings: [{
    role: 'SOURCE_REGIMEN',
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact Claim A establishes the parent source regimen.'
  }],
  transformationRationale:
    'Preserve parent TILL regimen independently from Claims B and C.'
};

const regimenReview = publishAgronomicActionRegimenReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.conditional.parent-regimen',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  regimen: regimenValue,
  disposition: 'ACCEPT_ACTION_REGIMEN',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim A establishes parent TILL regimen.',
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-regimen-review'
  )
});

const parentRegimen = publishAgronomicActionRegimenCompilation({
  ledger: env.ledger,
  logicalId: 'regimen-compilation.gold.kbs.conditional.parent',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [parentKnowledge.ref],
    regimen: regimenValue,
    regimenHash: agronomicActionRegimenHash(regimenValue),
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
    limitations: [
      'ACTION_REALIZATION_AND_CONDITIONAL_SENTENCES_SEPARATELY_GOVERNED'
    ]
  },
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-regimen-publish'
  )
});

// Claim B -> exact parent Action Realization.
const realizationValue = {
  contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
  realizationId: 'kbs-b21-conditional-parent-realization',
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
    authorityRef: realizationKnowledge.ref,
    rationale: 'Exact Claim B establishes parent source-open TILL realizations.'
  }],
  transformationRationale:
    'Preserve Claim B source-open realization set independently from conditional Claim C.'
};

const realizationReview = publishAgronomicActionRealizationReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.conditional.parent-realization',
  version: '1',
  knowledgeRefs: [realizationKnowledge.ref],
  realization: realizationValue,
  disposition: 'ACCEPT_ACTION_REALIZATION',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim B source realization semantics.',
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-realization-review'
  )
});

const parentActionRealization = publishAgronomicActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'action-realization-compilation.gold.kbs.conditional.parent',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [realizationKnowledge.ref],
    realization: realizationValue,
    realizationHash: agronomicActionRealizationHash(realizationValue),
    semanticReviewRef: realizationReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_TILL_REFINEMENT',
        'SOIL_FINISHING_NAMED_METHOD',
        'ROTOTILLING_NAMED_METHOD',
        'SOURCE_DEFINED_OPEN_CLASS',
        'OPEN_CLOSURE'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'CONDITIONAL_CHISEL_PLOW_SENTENCE_SEPARATELY_GOVERNED'
    ]
  },
  audit: audit(
    { type: reviewer.type, id: reviewer.principalId },
    'kbs-conditional-parent-realization-publish'
  )
});

// Claim C -> exact qualifier-only IF_NEEDED modality.
const conditionalModalityValue = {
  contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  modalityId: 'kbs-b21-conditional-if-needed',
  sourceExpression: CONDITIONAL_SOURCE,
  targetScope: 'ACTION',
  qualifiers: ['IF_NEEDED'],
  authorityBindings: [{
    role: 'SOURCE_MODALITY',
    authorityRef: conditionalKnowledge.ref,
    rationale: 'Exact Claim C establishes IF_NEEDED action qualifier.'
  }],
  transformationRationale:
    'Preserve IF_NEEDED without force, runtime predicate or current-need semantics.'
};

const conditionalModalityReview =
  publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: 'review.gold.kbs.conditional.if-needed',
    version: '1',
    knowledgeRefs: [conditionalKnowledge.ref],
    modality: conditionalModalityValue,
    disposition: 'ACCEPT_MODALITY',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [reviewAuthorization.ref],
    rationale: 'Authorized review confirms Claim C qualifier-only IF_NEEDED.',
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'kbs-conditional-if-needed-review'
    )
  });

const conditionalModalityCompilation =
  publishAgronomicNormativeModalityCompilation({
    ledger: env.ledger,
    logicalId: 'modality-compilation.gold.kbs.conditional.if-needed',
    version: '1',
    compilation: {
      contractVersion:
        AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [source.ref],
      sourceProtocolArtifactRefs: [artifact.ref],
      knowledgeRefs: [conditionalKnowledge.ref],
      modality: conditionalModalityValue,
      modalityHash: agronomicNormativeModalityHash(conditionalModalityValue),
      semanticReviewRef: conditionalModalityReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: [
          'SOURCE_EXPRESSION',
          'TARGET_SCOPE',
          'CONDITIONAL_QUALIFIER'
        ],
        unrepresentedElements: []
      },
      limitations: [
        'IF_NEEDED_NOT_RUNTIME_NEED',
        'SOURCE_MODALITY_HAS_NO_NORMATIVE_FORCE'
      ]
    },
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'kbs-conditional-if-needed-publish'
    )
  });

// Claim C -> Conditional Action Realization.
const conditionalValue = {
  contractVersion: AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
  conditionalRealizationId: 'kbs-b21-conditional-chisel-soil-finish',
  sourceExpression: CONDITIONAL_SOURCE,
  parentRegimenCompilationRef: parentRegimen.ref,
  parentActionRealizationCompilationRef: parentActionRealization.ref,
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
  modalityCompilationRef: conditionalModalityCompilation.ref,
  sourceCondition: {
    expression: 'more aggressive tillage is needed',
    objectExpression: 'more aggressive tillage'
  },
  authorityBindings: [{
    role: 'SOURCE_CONDITIONAL_ACTION_REALIZATION',
    authorityRef: conditionalKnowledge.ref,
    rationale:
      'Exact Claim C establishes the conditional compound realization and exact source condition.'
  }],
  transformationRationale:
    'Preserve CHISEL_PLOWING plus existing SOIL_FINISHING under qualifier-only IF_NEEDED with source conjunction and no order asserted.'
};

const conditionalReview =
  publishAgronomicConditionalActionRealizationReviewDecision({
    ledger: env.ledger,
    logicalId: 'review.gold.kbs.conditional-action-realization.b21',
    version: '1',
    knowledgeRefs: [conditionalKnowledge.ref],
    conditionalRealization: conditionalValue,
    disposition: 'ACCEPT_CONDITIONAL_ACTION_REALIZATION',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [reviewAuthorization.ref],
    rationale:
      'Authorized review explicitly binds Claim C "soil finished" to the exact parent SOIL_FINISHING identity, retains CHISEL_PLOWING, preserves source conjunction without order, and binds IF_NEEDED to the exact source condition.',
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'kbs-conditional-action-realization-review'
    )
  });

const conditionalCompilation =
  publishAgronomicConditionalActionRealizationCompilation({
    ledger: env.ledger,
    logicalId: 'conditional-action-realization-compilation.gold.kbs.b21',
    version: '1',
    compilation: {
      contractVersion:
        AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
      authorityClass:
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [source.ref],
      sourceProtocolArtifactRefs: [artifact.ref],
      knowledgeRefs: [conditionalKnowledge.ref],
      conditionalRealization: conditionalValue,
      conditionalRealizationHash:
        agronomicConditionalActionRealizationHash(conditionalValue),
      semanticReviewRef: conditionalReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: [
          'PARENT_TILL',
          'CHISEL_PLOWING',
          'SOIL_FINISHING',
          'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
          'IF_NEEDED',
          'SOURCE_CONDITION_EXPRESSION',
          'SOURCE_CONDITION_OBJECT'
        ],
        unrepresentedElements: []
      },
      limitations: [
        'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
        'CONDITIONAL_COMPLETENESS_IS_LOCAL_TO_CLAIM_C',
        'IF_NEEDED_NOT_RUNTIME_PREDICATE',
        'SOURCE_CONJUNCTION_NOT_EXECUTION_ORDER',
        'CAN_BE_NOT_PERMISSION',
        'MORE_AGGRESSIVE_TILLAGE_NOT_MEASURABLE_SCALE',
        'CURRENT_NEED_NOT_ESTABLISHED',
        'COMPOUND_NOT_ASSUMED_PARENT_OPEN_CLASS_MEMBER',
        'COMPOUND_NOT_CAUSAL_EFFECT_AUTHORITY',
        'SOURCE_CONDITIONAL_REALIZATION_NOT_RUNTIME_ELIGIBILITY',
        'SOURCE_CONDITIONAL_REALIZATION_NOT_EXECUTION_OR_OUTCOME'
      ]
    },
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'kbs-conditional-action-realization-publish'
    )
  });

const validated =
  validateAgronomicConditionalActionRealizationCompilationAuthority({
    ledger: env.ledger,
    compilationRef: conditionalCompilation.ref
  });

assert.equal(
  validated.parentRegimenAuthority.record.ref.logicalId,
  parentRegimen.ref.logicalId
);
assert.equal(
  validated.parentActionRealizationAuthority.record.ref.logicalId,
  parentActionRealization.ref.logicalId
);
assert.equal(
  validated.parentRegimenAuthority.semanticPayload.regimen.actionCode,
  'TILL'
);
assert.equal(
  validated.parentActionRealizationAuthority.semanticPayload.realization
    .targetActionCode,
  'TILL'
);

const parentSoilFinishing =
  validated.parentActionRealizationAuthority.semanticPayload.realization
    .realizationSet.alternatives
    .find((item) =>
      item.kind === 'NAMED_METHOD'
      && item.methodCode === 'SOIL_FINISHING');
assert.equal(parentSoilFinishing.sourceExpression, 'soil finishing');

const conditional = validated.semanticPayload.conditionalRealization;
assert.equal(
  conditional.compoundRealization.composition,
  'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED'
);
assert.deepEqual(
  conditional.compoundRealization.components
    .map((item) => item.methodCode).sort(),
  ['CHISEL_PLOWING', 'SOIL_FINISHING']
);
assert.equal(
  conditional.compoundRealization.components
    .find((item) => item.methodCode === 'SOIL_FINISHING')
    .sourceExpression,
  'soil finished'
);
assert.deepEqual(conditional.sourceCondition, {
  expression: 'more aggressive tillage is needed',
  objectExpression: 'more aggressive tillage'
});
assert.deepEqual(
  validated.modalityAuthority.semanticPayload.modality.qualifiers,
  ['IF_NEEDED']
);
assert.equal(
  validated.modalityAuthority.semanticPayload.modality.targetScope,
  'ACTION'
);
assert.equal(
  Object.hasOwn(validated.modalityAuthority.semanticPayload.modality, 'force'),
  false
);

// Exact real-source fail-closed semantic laundering checks.
const boundaryDenials = [];
for (const [field, fieldValue] of [
  ['force', 'PERMITTED'],
  ['effect', 'PERMITTED'],
  ['semanticId', 'tillage.aggressiveness_need'],
  ['comparator', 'EQUALS'],
  ['value', true],
  ['currentNeed', true],
  ['needThreshold', 1],
  ['aggressivenessScore', 3],
  ['aggressivenessRank', 1],
  ['baselineAggressiveness', 2],
  ['before', 'SOIL_FINISHING'],
  ['after', 'CHISEL_PLOWING'],
  ['sequence', ['CHISEL_PLOWING', 'SOIL_FINISHING']],
  ['memberOfParentOpenClass', true],
  ['runtimeEligibility', 'ELIGIBLE'],
  ['availability', 'AVAILABLE'],
  ['ranking', 1],
  ['equivalence', 'MATERIAL_EQUIVALENT'],
  ['causalEffect', 'PREVENTS_PLANT_ESTABLISHMENT'],
  ['implementationId', 'implement-1'],
  ['outcome', 'PLANT_ESTABLISHMENT_PREVENTED']
]) {
  const candidate = structuredClone(conditionalValue);
  candidate[field] = fieldValue;
  let error = null;
  try {
    normalizeAgronomicConditionalActionRealization(candidate);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof AgronomicConditionalActionRealizationCompilationError);
  assert.equal(
    error.code,
    'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_FIELD'
  );
  boundaryDenials.push(field);
}

for (const forbiddenComposition of ['ORDERED_SEQUENCE', 'CHISEL_THEN_FINISH']) {
  const candidate = structuredClone(conditionalValue);
  candidate.compoundRealization.composition = forbiddenComposition;
  let error = null;
  try {
    normalizeAgronomicConditionalActionRealization(candidate);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof AgronomicConditionalActionRealizationCompilationError);
  assert.equal(
    error.code,
    'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPOSITION'
  );
}
boundaryDenials.push('ORDERED_COMPOSITION');

for (const droppedCode of ['CHISEL_PLOWING', 'SOIL_FINISHING']) {
  const candidate = structuredClone(conditionalValue);
  candidate.compoundRealization.components =
    candidate.compoundRealization.components.filter(
      (item) => item.methodCode !== droppedCode
    );
  let error = null;
  try {
    normalizeAgronomicConditionalActionRealization(candidate);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof AgronomicConditionalActionRealizationCompilationError);
  assert.equal(
    error.code,
    'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_V1_SHAPE_MISMATCH'
  );
}
boundaryDenials.push('DROPPED_COMPOUND_COMPONENT');

const records = env.ledger.exportSnapshot().records;

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

const forbiddenRecords = records.filter((record) =>
  forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

const claimHashes = reviewed.map((item) => item.claim.ref.semanticHash);
assert.equal(new Set(claimHashes).size, 3);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_GOLD',
  decision: 'DEC_0011_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  claimLineage: {
    parentRegimenClaimRef: reviewed[0].claim.ref,
    parentActionRealizationClaimRef: reviewed[1].claim.ref,
    conditionalActionRealizationClaimRef: reviewed[2].claim.ref,
    allThreeClaimsDistinct: new Set(claimHashes).size === 3,
    sourceRef: source.ref,
    sourceArtifactRef: artifact.ref
  },
  parentRegimenRef: parentRegimen.ref,
  parentActionRealizationRef: parentActionRealization.ref,
  conditionalModalityRef: conditionalModalityCompilation.ref,
  conditionalActionRealizationRef: conditionalCompilation.ref,
  publishedShape: {
    targetActionCode: 'TILL',
    components: conditional.compoundRealization.components
      .map((item) => ({
        methodCode: item.methodCode,
        sourceExpression: item.sourceExpression
      })),
    composition: conditional.compoundRealization.composition,
    qualifier: 'IF_NEEDED',
    normativeForcePresent: false,
    sourceConditionExpression: conditional.sourceCondition.expression,
    sourceConditionObjectExpression:
      conditional.sourceCondition.objectExpression,
    runtimePredicatePresent: false,
    executionOrderPresent: false,
    aggressivenessScalePresent: false,
    currentNeedStatePresent: false,
    parentOpenClassMembershipPresent: false
  },
  localCoverageComplete: true,
  fullB21OperationalizationComplete: false,
  boundaryDenials,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
