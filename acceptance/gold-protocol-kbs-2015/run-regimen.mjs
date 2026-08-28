import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  normalizeAgronomicActionRegimen,
  publishAgronomicActionRegimenCompilation,
  publishAgronomicActionRegimenReviewDecision,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  validateAgronomicActionRegimenCompilationAuthority
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
const SOURCE_EXPRESSION =
  'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.';
const GOAL_OBJECT = 'plant growth from becoming established';
const SITE_CONTEXT = 'Kellogg Biological Station, Michigan State University';
const SYSTEM_CONTEXT =
  'System H: Continuous fallow system: No crop growth, no cover growth and no weed growth.';
const TREATMENT_CONTEXT = 'Treatment B21 Continuous fallow:';

function locator() {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: 20, evidenceText: SOURCE_EXPRESSION }
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
  logicalId: 'source.protocol.kbs-2015-action-regimen-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — B21 action-regimen source',
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
    benchmarkClass: 'REAL_SOURCE_CURATED_ACTION_REGIMEN_EXCERPT'
  },
  audit: audit({ type: 'USER', id: 'kbs-regimen-source-curator' }, 'kbs-regimen-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-action-regimen-gold',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-regimen-curated-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-28T02:15:00.000+08:00',
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
  audit: audit({ type: 'USER', id: 'kbs-regimen-source-curator' }, 'kbs-regimen-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-action-regimen',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-action-regimen.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-regimen-compiler' }, 'kbs-regimen-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const bundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-action-regimen-source-claim',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'b21-action-regimen',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: SOURCE_EXPRESSION,
      sourceLocator: locator(),
      sourceContext: b21ContextFamilies()
    }],
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_ACTION_REGIMEN_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-regimen-compiler' }, 'kbs-regimen-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-regimen-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.regimen-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-regimen-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.regimen-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-regimen-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-regimen-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = sourceFaithful.reviewCandidate({
  reviewLogicalId: 'review.gold.kbs.regimen.source-faithful.b21',
  reviewVersion: '1',
  compilationResultRef: bundle.result.ref,
  claimCandidateRef: bundle.claimCandidates[0].ref,
  sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication: b21ContextAdjudication(),
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuthorization.ref,
  claimLogicalId: 'claim.gold.kbs.regimen.b21',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.gold.kbs.regimen.b21',
  sourceContextVersion: '1',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-source-faithful')
});

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-regimen-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.regimen-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-regimen-scientific-role')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.regimen-qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: scientificApprover.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-regimen-qualification-policy')
});
const qualificationAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeQualification({
    principal: scientificApprover,
    policy: qualificationPolicy,
    roleAssignments: [scientificApproverRole],
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-regimen-qualification-auth')
});
const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.gold.kbs.regimen.b21',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: [],
  approverPrincipal: scientificApprover,
  authorizationDecisionAuditRef: qualificationAuthorization.ref,
  audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, 'kbs-regimen-qualification')
});
const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.gold.kbs.regimen.b21',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, 'kbs-regimen-qualified')
});

// Exact B21 source-semantic modality on the same Source/Artifact/Claim/Knowledge.
const modalityValue = {
  contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  modalityId: 'kbs-b21-as-needed-occurrence',
  sourceExpression: SOURCE_EXPRESSION,
  targetScope: 'OCCURRENCE',
  qualifiers: ['AS_NEEDED'],
  authorityBindings: [{
    role: 'SOURCE_MODALITY',
    authorityRef: knowledge.ref,
    rationale: 'Exact B21 source-qualified knowledge establishes the AS_NEEDED occurrence qualifier.'
  }],
  transformationRationale: 'Preserve AS_NEEDED without inferring current need, trigger, schedule, hard force, or execution truth.'
};
const modalityReview = publishAgronomicNormativeModalityReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.regimen.modality.b21',
  version: '1',
  knowledgeRefs: [knowledge.ref],
  modality: modalityValue,
  disposition: 'ACCEPT_MODALITY',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms qualifier-only AS_NEEDED semantics on the exact B21 proposition.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-modality-review')
});
const modalityCompilation = publishAgronomicNormativeModalityCompilation({
  ledger: env.ledger,
  logicalId: 'modality-compilation.gold.kbs.regimen.b21',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [knowledge.ref],
    modality: modalityValue,
    modalityHash: agronomicNormativeModalityHash(modalityValue),
    semanticReviewRef: modalityReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'CONDITIONAL_QUALIFIER'],
      unrepresentedElements: []
    },
    limitations: ['SOURCE_MODALITY_HAS_NO_HARD_FORCE', 'AS_NEEDED_NOT_RUNTIME_PREDICATE']
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-modality-publication')
});

// Exact B21 source-semantic goal on the same Source/Artifact/Claim/Knowledge.
const goalValue = {
  contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  goalConditionId: 'kbs-b21-prevent-plant-establishment',
  sourceExpression: SOURCE_EXPRESSION,
  targetScope: 'ACTION',
  relation: 'PREVENT',
  goalObjectExpression: GOAL_OBJECT,
  authorityBindings: [{
    role: 'SOURCE_GOAL',
    authorityRef: knowledge.ref,
    rationale: 'Exact B21 source-qualified knowledge establishes the PREVENT purpose.'
  }],
  transformationRationale: 'Preserve source purpose without inferring trigger, current state, causal efficacy, objective, execution, or Outcome.'
};
const goalReview = publishAgronomicGoalConditionReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.regimen.goal.b21',
  version: '1',
  knowledgeRefs: [knowledge.ref],
  goalCondition: goalValue,
  disposition: 'ACCEPT_GOAL_CONDITION',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms PREVENT action-goal semantics on the exact B21 proposition.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-goal-review')
});
const goalCompilation = publishAgronomicGoalConditionCompilation({
  ledger: env.ledger,
  logicalId: 'goal-compilation.gold.kbs.regimen.b21',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [knowledge.ref],
    goalCondition: goalValue,
    goalConditionHash: agronomicGoalConditionHash(goalValue),
    semanticReviewRef: goalReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
      unrepresentedElements: []
    },
    limitations: ['SOURCE_GOAL_NOT_RUNTIME_TRIGGER', 'SOURCE_GOAL_NOT_CAUSAL_EFFECT']
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-goal-publication')
});

const regimenValue = {
  contractVersion: AGRONOMIC_ACTION_REGIMEN_CONTRACT_VERSION,
  regimenId: 'kbs-b21-as-needed-bounded-prevent-regimen',
  sourceExpression: SOURCE_EXPRESSION,
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
    authorityRef: knowledge.ref,
    rationale: 'Exact B21 source-qualified knowledge establishes the complete targeted source-regimen proposition.'
  }],
  transformationRationale: 'Bind TILL, literal 2-6/year range, exact AS_NEEDED modality and exact PREVENT goal without hard obligation, runtime need, schedule, execution, or Outcome semantics.'
};

const regimenReview = publishAgronomicActionRegimenReviewDecision({
  ledger: env.ledger,
  logicalId: 'review.gold.kbs.action-regimen.b21',
  version: '1',
  knowledgeRefs: [knowledge.ref],
  regimen: regimenValue,
  disposition: 'ACCEPT_ACTION_REGIMEN',
  reviewerPrincipal: reviewer,
  authorizationDecisionAuditRefs: [reviewAuthorization.ref],
  rationale: 'Authorized review confirms that action, literal occurrence range, AS_NEEDED qualifier and PREVENT purpose are facets of the same exact B21 source proposition.',
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-semantic-review')
});

const regimenCompilation = publishAgronomicActionRegimenCompilation({
  ledger: env.ledger,
  logicalId: 'action-regimen-compilation.gold.kbs.b21',
  version: '1',
  compilation: {
    contractVersion: AGRONOMIC_ACTION_REGIMEN_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [knowledge.ref],
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
      'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
      'PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE',
      'REGIMEN_COMPLETENESS_IS_LOCAL_NOT_B21_SECTION_COMPLETENESS',
      'ALTERNATIVE_TILLAGE_METHODS_UNRESOLVED',
      'AS_NEEDED_NOT_RUNTIME_PREDICATE',
      'SOURCE_RANGE_NOT_MANDATORY_MIN_MAX',
      'ANNUAL_RANGE_NOT_SCHEDULE',
      'SOURCE_GOAL_NOT_CAUSAL_EFFECT',
      'SOURCE_REGIMEN_NOT_EXECUTION_OR_OUTCOME'
    ]
  },
  audit: audit({ type: reviewer.type, id: reviewer.principalId }, 'kbs-regimen-publication')
});

const validated = validateAgronomicActionRegimenCompilationAuthority({
  ledger: env.ledger,
  compilationRef: regimenCompilation.ref
});

assert.equal(validated.semanticPayload.regimen.actionCode, 'TILL');
assert.equal(validated.semanticPayload.regimen.occurrenceDescriptor.minCount, 2);
assert.equal(validated.semanticPayload.regimen.occurrenceDescriptor.maxCount, 6);
assert.equal(validated.semanticPayload.regimen.occurrenceDescriptor.period.kind, 'EACH_CALENDAR_YEAR');
assert.equal(Object.hasOwn(validated.semanticPayload.regimen, 'force'), false);
assert.equal(Object.hasOwn(validated.semanticPayload.regimen, 'effect'), false);
assert.deepEqual(validated.modalityAuthority.semanticPayload.modality.qualifiers, ['AS_NEEDED']);
assert.equal(Object.hasOwn(validated.modalityAuthority.semanticPayload.modality, 'force'), false);
assert.equal(validated.goalAuthority.semanticPayload.goalCondition.relation, 'PREVENT');

// Exact real-source fail-closed laundering checks.
const realSourceBoundaryDenials = [];
for (const [field, value] of [
  ['effect', 'REQUIRE'],
  ['force', 'REQUIRE'],
  ['mandatoryMinCount', 2],
  ['mandatoryMaxCount', 6],
  ['runtimeNeedPredicate', { semanticId: 'plant.growth.established', operator: 'EQUALS', value: true }],
  ['schedule', { cadence: 'P60D' }],
  ['satisfaction', 'SATISFIED_AFTER_SIX'],
  ['violation', 'VIOLATED_BELOW_TWO'],
  ['currentState', 'TILLAGE_NEEDED_NOW'],
  ['outcome', 'PLANT_ESTABLISHMENT_PREVENTED']
]) {
  const candidate = structuredClone(regimenValue);
  candidate[field] = value;
  let error = null;
  try { normalizeAgronomicActionRegimen(candidate); } catch (caught) { error = caught; }
  assert.ok(error instanceof AgronomicActionRegimenCompilationError);
  assert.equal(error.code, 'INVALID_AGRONOMIC_ACTION_REGIMEN_FIELD');
  realSourceBoundaryDenials.push(field);
}

const records = env.ledger.exportSnapshot().records;
assert.equal(records.filter((record) => record.ref.kind === 'AgronomicPolicyObligationCompilation').length, 0);
const forbiddenRuntimeKinds = new Set([
  'ContextAssertion',
  'RuntimeBinding',
  'RuntimeEligibility',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const runtimeRecords = records.filter((record) => forbiddenRuntimeKinds.has(record.ref.kind));
assert.equal(runtimeRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_ACTION_REGIMEN_GOLD',
  decision: 'DEC_0009_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  sourceExpression: SOURCE_EXPRESSION,
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  samePropositionClosure: {
    sourceRef: source.ref,
    sourceArtifactRef: artifact.ref,
    knowledgeRef: knowledge.ref,
    modalityCompilationRef: modalityCompilation.ref,
    goalConditionCompilationRef: goalCompilation.ref,
    regimenCompilationRef: regimenCompilation.ref
  },
  publishedShape: {
    actionCode: 'TILL',
    occurrenceMode: 'SOURCE_STATED_BOUNDED_RANGE',
    minCount: 2,
    maxCount: 6,
    period: 'EACH_CALENDAR_YEAR',
    modalityQualifier: 'AS_NEEDED',
    normativeForcePresent: false,
    goalRelation: 'PREVENT'
  },
  localCoverageComplete: true,
  fullB21SectionComplete: false,
  alternativeTillageMethodsResolved: false,
  hardObligationAuthorityCreated: false,
  realSourceBoundaryDenials,
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
