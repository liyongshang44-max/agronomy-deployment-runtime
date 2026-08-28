import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicGoalConditionCompilationError,
  AgronomicPolicyObligationCompilationError,
  agronomicGoalConditionHash,
  agronomicPolicyObligationHash,
  normalizeAgronomicGoalCondition,
  normalizeAgronomicPolicyObligationCompilation,
  publishAgronomicGoalConditionCompilation,
  publishAgronomicGoalConditionReviewDecision,
  publishAgronomicPolicyObligationCompilation,
  validateAgronomicGoalConditionCompilationAuthority
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
import { ScientificQualificationService, qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import { SourceFaithfulReviewService, sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
import { ExactArtifactStore, SourceRegistry, sourceContentHash } from '../../packages/source-registry/src/index.mjs';
import { makeEnv, audit } from '../specification/fixture.mjs';

const OWNERSHIP = { organizationId: 'org-a', tenantId: 'tenant-a' };
const EXPECTED_EXCERPT_HASH = 'sha256:7e315b5e6ea0f6a65b9c2a919178585d36adc7ad42ceb06cf0dd708f19a2d140';

const specs = [
  {
    key: 'b21-prevent-establishment',
    page: 20,
    evidenceText: 'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.',
    relation: 'PREVENT',
    goalObjectExpression: 'plant growth from becoming established'
  },
  {
    key: 'aphid-control',
    page: 4,
    evidenceText: 'If needed an insecticide application can be used to control aphids.',
    relation: 'CONTROL',
    goalObjectExpression: 'aphids'
  }
];

function locator(spec) {
  return { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: spec.page, evidenceText: spec.evidenceText } };
}

const SITE_CONTEXT = 'Kellogg Biological Station, Michigan State University';
const SYSTEM_CONTEXT =
  'System H: Continuous fallow system: No crop growth, no cover growth and no weed growth.';
const TREATMENT_CONTEXT = 'Treatment B21 Continuous fallow:';

function contextLocator(page, evidenceText) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page, evidenceText }
  };
}

function contextFamilies(spec) {
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [
      family,
      { status: 'NOT_REPORTED', dimensions: [] }
    ])
  );
  if (spec.key !== 'b21-prevent-establishment') return families;
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

function contextAdjudication(spec) {
  const adjudication = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, []])
  );
  if (spec.key !== 'b21-prevent-establishment') return adjudication;
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
env.sourceRegistry = new SourceRegistry({ ledger: env.ledger, artifactStore: new ExactArtifactStore() });

const excerptBytes = readFileSync(new URL('./kbs-2015-modality-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-goal-condition-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — goal-condition excerpts',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'kbs-goal-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-goal-condition-gold',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain',
  materializationIdentity: 'kbs-2015-goal-condition-curated-excerpts',
  acquisition: { method: 'CURATED_EXCERPT', acquiredAt: '2026-08-28T01:00:00.000+08:00' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'kbs-goal-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-goal-condition',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-goal-condition.curated',
  implementationVersion: '1',
  configuration: { sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE', locatorScheme: 'PDF_PAGE_TEXT_V1' },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-goal-compiler' }, 'kbs-goal-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const bundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-goal-condition-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: specs.map((spec) => ({
      key: spec.key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: spec.evidenceText,
      sourceLocator: locator(spec),
      sourceContext: contextFamilies(spec)
    })),
    runMetadata: { benchmark: 'KBS_2015_AGRONOMIC_GOAL_CONDITION_GOLD', curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE' }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-goal-compiler' }, 'kbs-goal-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-goal-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.goal-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-goal-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.goal-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-goal-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-goal-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = bundle.claimCandidates.map((candidate, index) => {
  const spec = specs[index];
  return sourceFaithful.reviewCandidate({
    reviewLogicalId: `review.gold.kbs.goal.source-faithful.${spec.key}`,
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: candidate.ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[index].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(spec),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuthorization.ref,
    claimLogicalId: `claim.gold.kbs.goal.${spec.key}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.gold.kbs.goal.${spec.key}`,
    sourceContextVersion: '1',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-goal-source-faithful-${spec.key}`)
  });
});

const b21Reviewed = reviewed[specs.findIndex((spec) => spec.key === 'b21-prevent-establishment')];
assert.equal(
  b21Reviewed.sourceContext.semanticPayload.contextFamilies.ENVIRONMENTAL
    .dimensions[0].value.string,
  'Kellogg Biological Station'
);
assert.deepEqual(
  b21Reviewed.sourceContext.semanticPayload.contextFamilies.MANAGEMENT.dimensions
    .map((dimension) => [dimension.semanticId, dimension.value]),
  [
    ['system.name', { type: 'STRING', string: 'System H' }],
    ['treatment.name', { type: 'STRING', string: 'B21' }],
    ['management.system', { type: 'CATEGORY', category: 'Continuous fallow' }]
  ]
);

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-goal-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.goal-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-goal-scientific-role')
});

const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const knowledgeByKey = new Map();
for (let index = 0; index < reviewed.length; index += 1) {
  const item = reviewed[index];
  const spec = specs[index];
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.goal.qualification.${spec.key}`,
    version: '1',
    resourceId: qualificationResourceId(item.claim.ref, item.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `kbs-goal-qualification-policy-${spec.key}`)
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
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, `kbs-goal-qualification-auth-${spec.key}`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.goal.${spec.key}`,
    decisionVersion: '1',
    claimRef: item.claim.ref,
    sourceContextRef: item.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: [],
    approverPrincipal: scientificApprover,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-goal-qualification-${spec.key}`)
  });
  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.goal.${spec.key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-goal-qualified-${spec.key}`)
  });
  knowledgeByKey.set(spec.key, knowledge);
}

function goalFor(spec, knowledge) {
  return {
    contractVersion: AGRONOMIC_GOAL_CONDITION_CONTRACT_VERSION,
    goalConditionId: spec.key,
    sourceExpression: spec.evidenceText,
    targetScope: 'ACTION',
    relation: spec.relation,
    goalObjectExpression: spec.goalObjectExpression,
    authorityBindings: [{
      role: 'SOURCE_GOAL',
      authorityRef: knowledge.ref,
      rationale: 'Exact source-qualified KBS knowledge establishes the source-stated purpose attached to this action.'
    }],
    transformationRationale: 'Preserve source purpose only; do not create runtime objective, trigger, current state, causal efficacy, execution truth, or Outcome.'
  };
}

const positiveCompilations = [];
for (const spec of specs) {
  const knowledge = knowledgeByKey.get(spec.key);
  const goalCondition = goalFor(spec, knowledge);
  const semanticReview = publishAgronomicGoalConditionReviewDecision({
    ledger: env.ledger,
    logicalId: `review.gold.kbs.goal.semantic.${spec.key}`,
    version: '1',
    knowledgeRefs: [knowledge.ref],
    goalCondition,
    disposition: 'ACCEPT_GOAL_CONDITION',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [reviewAuthorization.ref],
    rationale: 'Authorized semantic review confirms the exact KBS clause states the purpose of the governed action.',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-goal-semantic-review-${spec.key}`)
  });
  const compilation = {
    contractVersion: AGRONOMIC_GOAL_CONDITION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [knowledge.ref],
    goalCondition,
    goalConditionHash: agronomicGoalConditionHash(goalCondition),
    semanticReviewRef: semanticReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['SOURCE_EXPRESSION', 'TARGET_SCOPE', 'GOAL_RELATION', 'GOAL_OBJECT_EXPRESSION'],
      unrepresentedElements: []
    },
    limitations: [
      'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
      'PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE',
      'GOAL_COMPLETENESS_IS_LOCAL_NOT_WHOLE_STATEMENT_COMPLETENESS',
      'SOURCE_GOAL_NOT_RUNTIME_TRIGGER',
      'SOURCE_GOAL_NOT_CAUSAL_EFFECT',
      'SOURCE_GOAL_NOT_OUTCOME'
    ]
  };
  const published = publishAgronomicGoalConditionCompilation({
    ledger: env.ledger,
    logicalId: `goal-compilation.gold.kbs.${spec.key}`,
    version: '1',
    compilation,
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-goal-publication-${spec.key}`)
  });
  positiveCompilations.push(validateAgronomicGoalConditionCompilationAuthority({
    ledger: env.ledger,
    compilationRef: published.ref
  }));
}

assert.equal(positiveCompilations.length, 2);
const byId = new Map(positiveCompilations.map((item) => [item.semanticPayload.goalCondition.goalConditionId, item.semanticPayload.goalCondition]));
assert.equal(byId.get('b21-prevent-establishment').relation, 'PREVENT');
assert.equal(byId.get('b21-prevent-establishment').targetScope, 'ACTION');
assert.equal(byId.get('b21-prevent-establishment').goalObjectExpression, 'plant growth from becoming established');
assert.equal(byId.get('aphid-control').relation, 'CONTROL');
assert.equal(byId.get('aphid-control').targetScope, 'ACTION');
assert.equal(byId.get('aphid-control').goalObjectExpression, 'aphids');
for (const value of byId.values()) {
  assert.equal(Object.hasOwn(value, 'force'), false);
  assert.equal(Object.hasOwn(value, 'qualifiers'), false);
  assert.equal(Object.hasOwn(value, 'occurrence'), false);
}

// Real-source negative boundaries: source purpose must not be laundered into runtime/current/causal/outcome authority.
const b21Goal = goalFor(specs[0], knowledgeByKey.get(specs[0].key));
const realSourceBoundaryDenials = [];
for (const [field, value] of [
  ['runtimeTrigger', { semanticId: 'plant.growth.established', operator: 'EQUALS', value: true }],
  ['currentState', 'PLANT_GROWTH_ESTABLISHED'],
  ['causalEffect', 'TILLAGE_PREVENTS_PLANT_ESTABLISHMENT'],
  ['outcome', 'PREVENTION_GOAL_ACHIEVED'],
  ['objective', 'PREVENT_PLANT_ESTABLISHMENT_NOW']
]) {
  const candidate = structuredClone(b21Goal);
  candidate[field] = value;
  let error = null;
  try { normalizeAgronomicGoalCondition(candidate); } catch (caught) { error = caught; }
  assert.ok(error instanceof AgronomicGoalConditionCompilationError);
  assert.equal(error.code, 'INVALID_AGRONOMIC_GOAL_CONDITION_FIELD');
  realSourceBoundaryDenials.push(field);
}

// Local goal COMPLETE must not upgrade B21 Obligation v1; v1 has no accepted modality/goal binding fields.
const b21Knowledge = knowledgeByKey.get('b21-prevent-establishment');
const b21Obligation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  obligationId: 'b21-two-six-times-year-still-incomplete-after-goal',
  decisionType: 'TILLAGE_CONTROL',
  effect: 'REQUIRE',
  actionCode: 'TILL',
  occurrence: {
    mode: 'BOUNDED_COUNT',
    minCount: 2,
    maxCount: 6,
    period: {
      kind: 'EACH_CALENDAR_YEAR',
      authorityBindings: [{
        role: 'COUNTING_PERIOD',
        authorityRef: b21Knowledge.ref,
        rationale: 'The source states an annual count range.'
      }]
    },
    authorityBindings: [{
      role: 'OCCURRENCE_CARDINALITY',
      authorityRef: b21Knowledge.ref,
      rationale: 'The source states 2-6 occurrences.'
    }]
  },
  authorityBindings: [{
    role: 'REQUIRED_ACTION',
    authorityRef: b21Knowledge.ref,
    rationale: 'Structural candidate only; publication remains denied.'
  }]
};
const fakeRef = (kind, logicalId, char) => ({ kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` });
const b21ObligationCompilation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
  sourceProtocolRefs: [source.ref],
  sourceProtocolArtifactRefs: [artifact.ref],
  knowledgeRefs: [b21Knowledge.ref],
  policyRef: fakeRef('Policy', 'policy.b21.placeholder', 'a'),
  obligation: b21Obligation,
  obligationHash: agronomicPolicyObligationHash(b21Obligation),
  transformationRationale: 'DEC-0007 and DEC-0008 establish separate modality and goal authorities; Obligation v1 has no accepted binding fields for them.',
  losslessCoverage: {
    status: 'INCOMPLETE',
    coveredElements: ['ACTION', 'CARDINALITY', 'COUNTING_PERIOD'],
    unrepresentedElements: [
      'NORMATIVE_MODALITY_BINDING_NOT_SUPPORTED_BY_OBLIGATION_V1',
      'GOAL_CONDITION_BINDING_NOT_SUPPORTED_BY_OBLIGATION_V1'
    ]
  },
  approverPrincipal: {
    principalId: 'placeholder',
    type: 'USER',
    organizationId: OWNERSHIP.organizationId,
    tenantId: OWNERSHIP.tenantId
  },
  approvalRef: fakeRef('AuthorizationDecisionAudit', 'auth.b21.placeholder', 'b'),
  limitations: ['B21_OBLIGATION_V1_REMAINS_INCOMPLETE_AFTER_SEPARATE_GOAL_AUTHORITY']
};
const normalizedB21Obligation = normalizeAgronomicPolicyObligationCompilation(b21ObligationCompilation);
assert.equal(normalizedB21Obligation.losslessCoverage.status, 'INCOMPLETE');
let b21ObligationDenial = null;
try {
  publishAgronomicPolicyObligationCompilation({
    ledger: env.ledger,
    logicalId: 'obligation-compilation.gold.kbs.b21.after-dec-0008.must-not-publish',
    version: '1',
    compilation: b21ObligationCompilation,
    audit: audit({ type: 'USER', id: 'placeholder' }, 'kbs-b21-after-goal')
  });
} catch (error) { b21ObligationDenial = error; }
assert.ok(b21ObligationDenial instanceof AgronomicPolicyObligationCompilationError);
assert.equal(b21ObligationDenial.code, 'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_NOT_PUBLISHABLE');

const forbiddenRuntimeKinds = new Set([
  'ContextAssertion', 'RuntimeBinding', 'RuntimeEligibility', 'DecisionResult', 'ExecutionReceipt', 'Outcome'
]);
const runtimeRecords = env.ledger.exportSnapshot().records.filter((record) => forbiddenRuntimeKinds.has(record.ref.kind));
assert.equal(runtimeRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_GOAL_CONDITION_GOLD',
  decision: 'DEC_0008_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  claimCount: reviewed.length,
  qualifiedKnowledgeCount: knowledgeByKey.size,
  publishedGoalConditionCompilationCount: positiveCompilations.length,
  positiveShapes: ['PREVENT_ACTION_GOAL', 'CONTROL_ACTION_GOAL'],
  realSourceBoundaryDenials,
  b21Boundary: {
    goalCoverageComplete: true,
    obligationCoverageStatus: normalizedB21Obligation.losslessCoverage.status,
    remainingUnrepresentedElements: normalizedB21Obligation.losslessCoverage.unrepresentedElements,
    obligationPublicationDenied: true,
    denialCode: b21ObligationDenial.code
  },
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
