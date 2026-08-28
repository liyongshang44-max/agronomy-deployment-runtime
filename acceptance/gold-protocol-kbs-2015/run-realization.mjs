import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  normalizeAgronomicActionRealization,
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
const EXPECTED_EXCERPT_HASH = 'sha256:8ac1dcc6f329b05cc8c0c2bdca8cb4f2ef2fc0e89ac3820e1dcf98d232cc7cf9';

const REGIMEN_SOURCE =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';
const REALIZATION_SOURCE =
  'Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.';
const NEIGHBOR_SOURCE =
  'Plots can be chisel plowed and soil finished if more aggressive tillage is needed.';
const GOAL_OBJECT = 'plant growth from becoming established';
const SITE_CONTEXT = 'Kellogg Biological Station, Michigan State University';
const SYSTEM_CONTEXT =
  'System H: Continuous fallow system: No crop growth, no cover growth and no weed growth.';
const TREATMENT_CONTEXT = 'Treatment B21 Continuous fallow:';

const claimSpecs = [
  { key: 'b21-regimen-parent', evidenceText: REGIMEN_SOURCE },
  { key: 'b21-action-realization', evidenceText: REALIZATION_SOURCE },
  { key: 'b21-neighbor-conditional-chisel', evidenceText: NEIGHBOR_SOURCE }
];

function locator(spec) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: 20, evidenceText: spec.evidenceText }
  };
}

function contextLocator(page, evidenceText) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page, evidenceText }
  };
}

function b21ContextFamilies() {
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [
      family,
      { status: 'NOT_REPORTED', dimensions: [] }
    ])
  );
  families.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'site.identity',
      valueCandidate: 'Kellogg Biological Station',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: contextLocator(0, SITE_CONTEXT)
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [
      {
        semanticHint: 'system.identity',
        valueCandidate: 'System H',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: contextLocator(20, SYSTEM_CONTEXT)
      },
      {
        semanticHint: 'treatment.identity',
        valueCandidate: 'B21',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: contextLocator(20, TREATMENT_CONTEXT)
      },
      {
        semanticHint: 'management.system',
        valueCandidate: 'Continuous fallow',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: contextLocator(20, TREATMENT_CONTEXT)
      }
    ]
  };
  return families;
}

function b21ContextAdjudication() {
  const adjudication = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, []])
  );
  adjudication.ENVIRONMENTAL = [
    { semanticId: 'site.name', valueType: 'STRING' }
  ];
  adjudication.MANAGEMENT = [
    { semanticId: 'system.name', valueType: 'STRING' },
    { semanticId: 'treatment.name', valueType: 'STRING' },
    { semanticId: 'management.system', valueType: 'CATEGORY' }
  ];
  return adjudication;
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});

const excerptBytes = readFileSync(new URL('./kbs-2015-realization-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-action-realization-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — B21 action realization excerpts',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: 'current_agronomic_protocol.pdf#pages=0,20',
  metadata: {
    sourcePages: [0, 20],
    benchmarkClass: 'REAL_SOURCE_CURATED_ACTION_REALIZATION_EXCERPTS'
  },
  audit: audit({ type: 'USER', id: 'kbs-realization-source-curator' }, 'kbs-realization-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-action-realization-gold',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-action-realization-curated-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-28T03:15:00.000+08:00',
    locator: 'current_agronomic_protocol.pdf#pages=0,20',
    metadata: {
      sourcePages: [0, 20],
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    originalPdfBytesRetainedByThisBenchmark: false,
    exactExcerptBytesRetained: true
  },
  audit: audit({ type: 'USER', id: 'kbs-realization-source-curator' }, 'kbs-realization-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-action-realization',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-action-realization.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-realization-compiler' }, 'kbs-realization-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const bundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-action-realization-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: claimSpecs.map((spec) => ({
      key: spec.key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: spec.evidenceText,
      sourceLocator: locator(spec),
      sourceContext: b21ContextFamilies()
    })),
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_ACTION_REALIZATION_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-realization-compiler' }, 'kbs-realization-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-realization-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.realization-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-realization-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.realization-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-realization-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-realization-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = claimSpecs.map((spec, index) => sourceFaithful.reviewCandidate({
  reviewLogicalId: `review.gold.kbs.realization.source-faithful.${spec.key}`,
  reviewVersion: '1',
  compilationResultRef: bundle.result.ref,
  claimCandidateRef: bundle.claimCandidates[index].ref,
  sourceContextCandidateRef: bundle.sourceContextCandidates[index].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication: b21ContextAdjudication(),
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuthorization.ref,
  claimLogicalId: `claim.gold.kbs.realization.${spec.key}`,
  claimVersion: '1',
  sourceContextLogicalId: `source-context.gold.kbs.realization.${spec.key}`,
  sourceContextVersion: '1',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-realization-source-faithful-${spec.key}`)
}));

for (const item of reviewed) {
  assert.equal(
    item.sourceContext.semanticPayload.contextFamilies.ENVIRONMENTAL
      .dimensions[0].value.string,
    'Kellogg Biological Station'
  );
  assert.deepEqual(
    item.sourceContext.semanticPayload.contextFamilies.MANAGEMENT.dimensions
      .map((dimension) => [dimension.semanticId, dimension.value]),
    [
      ['system.name', { type: 'STRING', string: 'System H' }],
      ['treatment.name', { type: 'STRING', string: 'B21' }],
      ['management.system', { type: 'CATEGORY', category: 'Continuous fallow' }]
    ]
  );
}

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-realization-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.realization-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-realization-scientific-role')
});
const qualificationService = new ScientificQualificationService({ ledger: env.ledger });

function qualifyReviewed(index, key) {
  const item = reviewed[index];
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.realization-qualification.${key}`,
    version: '1',
    resourceId: qualificationResourceId(item.claim.ref, item.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `kbs-realization-qualification-policy-${key}`)
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
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, `kbs-realization-qualification-auth-${key}`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.realization.${key}`,
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
      `kbs-realization-qualification-${key}`
    )
  });
  return qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.realization.${key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(
      { type: scientificApprover.type, id: scientificApprover.principalId },
      `kbs-realization-qualified-${key}`
    )
  });
}

const parentKnowledge = qualifyReviewed(0, 'parent-regimen');
const realizationKnowledge = qualifyReviewed(1, 'action-realization');
assert.notDeepEqual(parentKnowledge.ref, realizationKnowledge.ref);

// Parent Regimen is independently governed from Claim A.
const modalityValue = {
  contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  modalityId: 'kbs-b21-realization-parent-as-needed',
  sourceExpression: REGIMEN_SOURCE,
  targetScope: 'OCCURRENCE',
  qualifiers: ['AS_NEEDED'],
  authorityBindings: [{
    role: 'SOURCE_MODALITY',
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact parent-regimen KBS knowledge establishes AS_NEEDED.'
  }],
  transformationRationale: 'Preserve AS_NEEDED without hard force or runtime need.'
};
const modalityReview = publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.realization.parent-modality',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  modality: modalityValue,
  disposition: 'ACCEPT_MODALITY',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms parent-regimen AS_NEEDED semantics.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-modality-review')
});
const modalityCompilation = publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.gold.kbs.realization.parent',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [parentKnowledge.ref],
    modality: modalityValue,
    modalityHash: agronomicNormativeModalityHash(modalityValue),
    semanticReviewRef: modalityReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'CONDITIONAL_QUALIFIER'],
      unrepresentedElements: []
    },
    limitations: ['AS_NEEDED_NOT_RUNTIME_PREDICATE']
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-modality-publish')
});

const goalValue = {
  contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  goalConditionId: 'kbs-b21-realization-parent-prevent',
  sourceExpression: REGIMEN_SOURCE,
  targetScope: 'ACTION',
  relation: 'PREVENT',
  goalObjectExpression: GOAL_OBJECT,
  authorityBindings: [{
    role: 'SOURCE_GOAL',
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact parent-regimen KBS knowledge establishes the PREVENT goal.'
  }],
  transformationRationale: 'Preserve source goal without runtime trigger or causal efficacy.'
};
const goalReview = publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.realization.parent-goal',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  goalCondition: goalValue,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms parent-regimen PREVENT semantics.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-goal-review')
});
const goalCompilation = publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.gold.kbs.realization.parent',
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
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
      unrepresentedElements: []
    },
    limitations: ['SOURCE_GOAL_NOT_CAUSAL_EFFECT']
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-goal-publish')
});

const regimenValue = {
  contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  regimenId: 'kbs-b21-realization-parent-regimen',
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
    authorityRef: parentKnowledge.ref,
    rationale: 'Exact Claim A KBS knowledge establishes the parent source regimen.'
  }],
  transformationRationale: 'Preserve the parent TILL regimen independently of the next realization sentence.'
};
const regimenReview = publishAgronomicActionRegimenReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.realization.parent-regimen',
  version: '1',
  knowledgeRefs: [parentKnowledge.ref],
  regimen: regimenValue,
  disposition: 'ACCEPT_ACTION_REGIMEN',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim A establishes the exact parent TILL regimen.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-regimen-review')
});
const parentRegimen = publishAgronomicActionRegimenCompilation({
  ledger: env.ledger,
  logicalId: 'regimen-compilation.gold.kbs.realization.parent',
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
      coveredElements: ['ACTION', 'SOURCE_STATED_BOUNDED_RANGE', 'AS_NEEDED_MODALITY', 'PREVENT_GOAL', 'SOURCE_EXPRESSION'],
      unrepresentedElements: []
    },
    limitations: ['ACTION_REALIZATION_SENTENCE_SEPARATELY_GOVERNED']
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-parent-regimen-publish')
});

// Claim B independently establishes how the parent TILL action may be realized.
const realizationValue = {
  contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
  realizationId: 'kbs-b21-tillage-source-realizations',
  sourceExpression: REALIZATION_SOURCE,
  parentRegimenCompilationRef: parentRegimen.ref,
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
    authorityRef: realizationKnowledge.ref,
    rationale: 'Exact Claim B KBS knowledge establishes the source-open realization set for parent TILL.'
  }],
  transformationRationale: 'Preserve named methods and source-defined open class without PERMITTED, exclusivity, equivalence, ranking, runtime eligibility or causal efficacy.'
};

const realizationReview = publishAgronomicActionRealizationReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.action-realization.b21',
  version: '1',
  knowledgeRefs: [realizationKnowledge.ref],
  realization: realizationValue,
  disposition: 'ACCEPT_ACTION_REALIZATION',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms Claim B refines the exact parent TILL action while remaining a distinct source proposition.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-semantic-review')
});

const realizationCompilation = publishAgronomicActionRealizationCompilation({
  ledger: env.ledger,
  logicalId: 'action-realization-compilation.gold.kbs.b21',
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
      'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
      'REALIZATION_COMPLETENESS_IS_LOCAL_TO_TARGET_SENTENCE',
      'NEIGHBOR_CHISEL_PLOW_CONDITIONAL_SENTENCE_UNREPRESENTED',
      'CAN_BE_NOT_PERMISSION',
      'OPEN_CLASS_NOT_CAUSAL_EFFECT',
      'REALIZATIONS_NOT_ASSUMED_EXCLUSIVE_DISJOINT_OR_EQUIVALENT',
      'SOURCE_REALIZATION_NOT_RUNTIME_ELIGIBILITY_OR_AVAILABILITY',
      'SOURCE_REALIZATION_NOT_POLICY_ACTION_SPACE',
      'SOURCE_REALIZATION_NOT_EXECUTION_OR_OUTCOME'
    ]
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-realization-publication')
});

const validated = validateAgronomicActionRealizationCompilationAuthority({
  ledger: env.ledger,
  compilationRef: realizationCompilation.ref
});

assert.equal(validated.parentRegimenAuthority.record.ref.logicalId, parentRegimen.ref.logicalId);
assert.equal(validated.parentRegimenAuthority.semanticPayload.regimen.actionCode, 'TILL');
assert.equal(validated.semanticPayload.realization.realizationSet.closure, 'OPEN_SOURCE_DEFINED');

const alternatives = validated.semanticPayload.realization.realizationSet.alternatives;
const namedCodes = alternatives.filter((item) => item.kind === 'NAMED_METHOD').map((item) => item.methodCode).sort();
assert.deepEqual(namedCodes, ['ROTOTILLING', 'SOIL_FINISHING']);
const openClass = alternatives.find((item) => item.kind === 'SOURCE_DEFINED_OPEN_CLASS');
assert.equal(openClass.classExpression, 'any tillage that keeps plant growth from becoming established');
assert.equal(openClass.membershipCriterionExpression, 'keeps plant growth from becoming established');

// Exact real-source fail-closed laundering checks.
const boundaryDenials = [];
for (const [field, value] of [
  ['force', 'PERMITTED'],
  ['effect', 'PERMITTED'],
  ['exclusive', true],
  ['disjoint', true],
  ['runtimeEligibility', 'ELIGIBLE'],
  ['availability', 'AVAILABLE'],
  ['ranking', 1],
  ['equivalence', 'MATERIAL_EQUIVALENT'],
  ['causalEffect', 'PREVENTS_PLANT_ESTABLISHMENT'],
  ['implementationId', 'implement-1'],
  ['outcome', 'PLANT_ESTABLISHMENT_PREVENTED']
]) {
  const candidate = structuredClone(realizationValue);
  candidate[field] = value;
  let error = null;
  try { normalizeAgronomicActionRealization(candidate); } catch (caught) { error = caught; }
  assert.ok(error instanceof AgronomicActionRealizationCompilationError);
  assert.equal(error.code, 'INVALID_AGRONOMIC_ACTION_REALIZATION_FIELD');
  boundaryDenials.push(field);
}

const closed = structuredClone(realizationValue);
closed.realizationSet.closure = 'CLOSED';
assert.throws(
  () => normalizeAgronomicActionRealization(closed),
  (error) => error instanceof AgronomicActionRealizationCompilationError
    && error.code === 'INVALID_AGRONOMIC_ACTION_REALIZATION_SET_CLOSURE'
);
boundaryDenials.push('CLOSED_REALIZATION_SET');

const chiselLaundering = structuredClone(realizationValue);
chiselLaundering.realizationSet.alternatives.push({
  kind: 'NAMED_METHOD',
  methodCode: 'CHISEL_PLOW',
  sourceExpression: 'chisel plowed'
});
let chiselError = null;
try { normalizeAgronomicActionRealization(chiselLaundering); } catch (error) { chiselError = error; }
assert.ok(chiselError instanceof AgronomicActionRealizationCompilationError);
assert.equal(chiselError.code, 'INVALID_AGRONOMIC_ACTION_REALIZATION_NAMED_METHOD');
assert.ok(NEIGHBOR_SOURCE.includes('chisel plowed'));
boundaryDenials.push('NEIGHBOR_CHISEL_PLOW');

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
const forbiddenRecords = records.filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_ACTION_REALIZATION_GOLD',
  decision: 'DEC_0010_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  claimLineage: {
    parentRegimenClaimRef: reviewed[0].claim.ref,
    realizationClaimRef: reviewed[1].claim.ref,
    neighborConditionalClaimRef: reviewed[2].claim.ref,
    parentAndRealizationClaimsDistinct: reviewed[0].claim.ref.semanticHash !== reviewed[1].claim.ref.semanticHash,
    sourceRef: source.ref,
    sourceArtifactRef: artifact.ref
  },
  parentRegimenRef: parentRegimen.ref,
  actionRealizationRef: realizationCompilation.ref,
  publishedShape: {
    targetActionCode: 'TILL',
    closure: 'OPEN_SOURCE_DEFINED',
    namedMethods: namedCodes,
    openClassExpression: openClass.classExpression,
    openClassCriterionExpression: openClass.membershipCriterionExpression,
    normativeForcePresent: false,
    exclusivityClaimPresent: false,
    equivalenceClaimPresent: false
  },
  localCoverageComplete: true,
  fullB21SectionComplete: false,
  neighborConditionalSentenceRepresented: false,
  boundaryDenials,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
