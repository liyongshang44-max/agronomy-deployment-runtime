import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicNormativeModalityCompilationError,
  AgronomicPolicyObligationCompilationError,
  agronomicNormativeModalityHash,
  agronomicPolicyObligationHash,
  normalizeAgronomicPolicyObligationCompilation,
  publishAgronomicNormativeModalityCompilation,
  publishAgronomicNormativeModalityReviewDecision,
  publishAgronomicPolicyObligationCompilation,
  validateAgronomicNormativeModalityCompilationAuthority
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
const EXPECTED_EXCERPT_HASH = 'sha256:6226c321b68c2f13fc024f5805eceaa4c69639e2a638bd41264861d47c39eceb';

const specs = [
  {
    key: 't3-should-three-fifths',
    page: 4,
    evidenceText: 'The amount on nitrogen applied to treatment 3 should be 3/5 of the total amount applied to treatment 1.',
    force: 'SHOULD',
    qualifiers: [],
    targetScope: 'PARAMETER_VALUE',
    disposition: 'ACCEPT_MODALITY'
  },
  {
    key: 't7-try-same-week',
    page: 11,
    evidenceText: 'Try to have the micro-plot area of treatment 7 tilled within the same week that tillage in treatment 1 is completed.',
    force: 'BEST_EFFORT',
    qualifiers: [],
    targetScope: 'TIMING_RELATION',
    disposition: 'ACCEPT_MODALITY'
  },
  {
    key: 't3-if-possible-before-chisel',
    page: 4,
    evidenceText: 'before chisel plowing, if possible',
    force: null,
    qualifiers: ['IF_POSSIBLE'],
    targetScope: 'TIMING_RELATION',
    disposition: 'ACCEPT_MODALITY'
  },
  {
    key: 'aphid-if-needed-can-be-used',
    page: 4,
    evidenceText: 'If needed an insecticide application can be used to control aphids.',
    force: 'PERMITTED',
    qualifiers: ['IF_NEEDED'],
    targetScope: 'ACTION',
    disposition: 'ACCEPT_MODALITY'
  },
  {
    key: 'b21-as-needed-occurrence',
    page: 20,
    evidenceText: 'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.',
    force: null,
    qualifiers: ['AS_NEEDED'],
    targetScope: 'OCCURRENCE',
    disposition: 'ACCEPT_MODALITY'
  },
  {
    key: 't6-logistical-may',
    page: 10,
    evidenceText: 'superphosphate, which may need to be specially ordered from the fertilizer dealer',
    force: 'PERMITTED',
    qualifiers: [],
    targetScope: 'ACTION',
    disposition: 'REJECT_MODALITY',
    reasonCodes: ['LOGISTICAL_MAY_NOT_AGRONOMIC_PERMISSION']
  }
];

function locator(spec) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: spec.page, evidenceText: spec.evidenceText }
  };
}

function emptyContextFamilies() {
  return Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
}

function emptyContextAdjudication() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, []]));
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});

const excerptBytes = readFileSync(new URL('./kbs-2015-modality-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-normative-modality-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — normative modality excerpts',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'kbs-modality-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-normative-modality-gold',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain',
  materializationIdentity: 'kbs-2015-normative-modality-curated-excerpts',
  acquisition: { method: 'CURATED_EXCERPT', acquiredAt: '2026-08-27T15:30:00.000Z' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'kbs-modality-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-normative-modality',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-normative-modality.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-modality-compiler' }, 'kbs-modality-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const bundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-normative-modality-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: specs.map((spec) => ({
      key: spec.key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: spec.evidenceText,
      sourceLocator: locator(spec),
      sourceContext: emptyContextFamilies()
    })),
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_NORMATIVE_MODALITY_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-modality-compiler' }, 'kbs-modality-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-modality-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.modality-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-modality-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.modality-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-modality-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-modality-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = bundle.claimCandidates.map((candidate, index) => {
  const spec = specs[index];
  return sourceFaithful.reviewCandidate({
    reviewLogicalId: `review.gold.kbs.modality.source-faithful.${spec.key}`,
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: candidate.ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[index].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: emptyContextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuthorization.ref,
    claimLogicalId: `claim.gold.kbs.modality.${spec.key}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.gold.kbs.modality.${spec.key}`,
    sourceContextVersion: '1',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-modality-source-faithful-${spec.key}`)
  });
});

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-modality-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.modality-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-modality-scientific-role')
});

const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const knowledgeByKey = new Map();

for (let index = 0; index < reviewed.length; index += 1) {
  const item = reviewed[index];
  const spec = specs[index];
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.modality.qualification.${spec.key}`,
    version: '1',
    resourceId: qualificationResourceId(item.claim.ref, item.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `kbs-modality-qualification-policy-${spec.key}`)
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
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, `kbs-modality-qualification-auth-${spec.key}`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.modality.${spec.key}`,
    decisionVersion: '1',
    claimRef: item.claim.ref,
    sourceContextRef: item.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: [],
    approverPrincipal: scientificApprover,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-modality-qualification-${spec.key}`)
  });
  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.modality.${spec.key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-modality-qualified-${spec.key}`)
  });
  knowledgeByKey.set(spec.key, knowledge);
}

function modalityFor(spec, knowledge) {
  return {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: spec.key,
    sourceExpression: spec.evidenceText,
    targetScope: spec.targetScope,
    ...(spec.force ? { force: spec.force } : {}),
    qualifiers: spec.qualifiers,
    authorityBindings: [{
      role: 'SOURCE_MODALITY',
      authorityRef: knowledge.ref,
      rationale: 'Exact source-qualified KBS knowledge establishes the candidate normative force/qualifier for this target scope.'
    }],
    transformationRationale: 'Preserve only the source modality; do not create runtime need, feasibility, legal permission, ranking, schedule, execution, or outcome truth.'
  };
}

const positiveCompilations = [];
let lexicalMayDenial = null;

for (const spec of specs) {
  const knowledge = knowledgeByKey.get(spec.key);
  const modality = modalityFor(spec, knowledge);
  const semanticReview = publishAgronomicNormativeModalityReviewDecision({
    ledger: env.ledger,
    logicalId: `review.gold.kbs.modality.semantic.${spec.key}`,
    version: '1',
    knowledgeRefs: [knowledge.ref],
    modality,
    disposition: spec.disposition,
    reasonCodes: spec.reasonCodes ?? [],
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [reviewAuthorization.ref],
    rationale: spec.disposition === 'ACCEPT_MODALITY'
      ? 'Authorized semantic review accepts the exact KBS source modality without lexical upgrading.'
      : 'The KBS phrase uses may for logistical possibility/necessity, not agronomic permission.',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-modality-semantic-review-${spec.key}`)
  });

  const compilation = {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [source.ref],
    sourceProtocolArtifactRefs: [artifact.ref],
    knowledgeRefs: [knowledge.ref],
    modality,
    modalityHash: agronomicNormativeModalityHash(modality),
    semanticReviewRef: semanticReview.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'SOURCE_EXPRESSION',
        'TARGET_SCOPE',
        ...(spec.force ? ['NORMATIVE_FORCE'] : []),
        ...(spec.qualifiers.length ? ['CONDITIONAL_QUALIFIER'] : [])
      ],
      unrepresentedElements: []
    },
    limitations: [
      'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
      'PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE',
      'MODALITY_COMPLETENESS_IS_LOCAL_NOT_WHOLE_STATEMENT_COMPLETENESS'
    ]
  };

  if (spec.disposition === 'ACCEPT_MODALITY') {
    const published = publishAgronomicNormativeModalityCompilation({
      ledger: env.ledger,
      logicalId: `modality-compilation.gold.kbs.${spec.key}`,
      version: '1',
      compilation,
      audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-modality-publication-${spec.key}`)
    });
    positiveCompilations.push(validateAgronomicNormativeModalityCompilationAuthority({
      ledger: env.ledger,
      compilationRef: published.ref
    }));
  } else {
    try {
      publishAgronomicNormativeModalityCompilation({
        ledger: env.ledger,
        logicalId: `modality-compilation.gold.kbs.${spec.key}.must-not-publish`,
        version: '1',
        compilation,
        audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-modality-rejected-publication-${spec.key}`)
      });
    } catch (error) {
      lexicalMayDenial = error;
    }
  }
}

assert.equal(positiveCompilations.length, 5);
assert.ok(lexicalMayDenial instanceof AgronomicNormativeModalityCompilationError);
assert.equal(lexicalMayDenial.code, 'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_REJECTED');

const byId = new Map(
  positiveCompilations.map((item) => [item.semanticPayload.modality.modalityId, item.semanticPayload.modality])
);
assert.equal(byId.get('t3-should-three-fifths').force, 'SHOULD');
assert.equal(byId.get('t3-should-three-fifths').targetScope, 'PARAMETER_VALUE');
assert.equal(byId.get('t7-try-same-week').force, 'BEST_EFFORT');
assert.equal(byId.get('t7-try-same-week').targetScope, 'TIMING_RELATION');
assert.deepEqual(byId.get('t3-if-possible-before-chisel').qualifiers, ['IF_POSSIBLE']);
assert.equal(Object.hasOwn(byId.get('t3-if-possible-before-chisel'), 'force'), false);
assert.equal(byId.get('aphid-if-needed-can-be-used').force, 'PERMITTED');
assert.deepEqual(byId.get('aphid-if-needed-can-be-used').qualifiers, ['IF_NEEDED']);
assert.deepEqual(byId.get('b21-as-needed-occurrence').qualifiers, ['AS_NEEDED']);
assert.equal(byId.get('b21-as-needed-occurrence').targetScope, 'OCCURRENCE');

const b21Knowledge = knowledgeByKey.get('b21-as-needed-occurrence');
const b21Obligation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  obligationId: 'b21-two-six-times-year-still-incomplete-after-modality',
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
    rationale: 'Structural candidate only; hard REQUIRE publication remains denied.'
  }]
};
const fakeRef = (kind, logicalId, char) => ({
  kind,
  logicalId,
  version: '1',
  semanticHash: `sha256:${char.repeat(64)}`
});
const b21ObligationCompilation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
  sourceProtocolRefs: [source.ref],
  sourceProtocolArtifactRefs: [artifact.ref],
  knowledgeRefs: [b21Knowledge.ref],
  policyRef: fakeRef('Policy', 'policy.b21.placeholder', 'a'),
  obligation: b21Obligation,
  obligationHash: agronomicPolicyObligationHash(b21Obligation),
  transformationRationale: 'DEC-0007 closes AS_NEEDED modality only; the purpose/goal condition remains unrepresented.',
  losslessCoverage: {
    status: 'INCOMPLETE',
    coveredElements: ['ACTION', 'CARDINALITY', 'COUNTING_PERIOD', 'NORMATIVE_MODALITY_AS_NEEDED'],
    unrepresentedElements: ['GOAL_CONDITION_PREVENT_PLANT_GROWTH_ESTABLISHMENT']
  },
  approverPrincipal: {
    principalId: 'placeholder',
    type: 'USER',
    organizationId: OWNERSHIP.organizationId,
    tenantId: OWNERSHIP.tenantId
  },
  approvalRef: fakeRef('AuthorizationDecisionAudit', 'auth.b21.placeholder', 'b'),
  limitations: ['B21_GOAL_CONDITION_REMAINS_UNREPRESENTED']
};
const normalizedB21Obligation = normalizeAgronomicPolicyObligationCompilation(b21ObligationCompilation);
assert.deepEqual(
  normalizedB21Obligation.losslessCoverage.unrepresentedElements,
  ['GOAL_CONDITION_PREVENT_PLANT_GROWTH_ESTABLISHMENT']
);
let b21ObligationDenial = null;
try {
  publishAgronomicPolicyObligationCompilation({
    ledger: env.ledger,
    logicalId: 'obligation-compilation.gold.kbs.b21.after-dec-0007.must-not-publish',
    version: '1',
    compilation: b21ObligationCompilation,
    audit: audit({ type: 'USER', id: 'placeholder' }, 'kbs-b21-after-modality')
  });
} catch (error) {
  b21ObligationDenial = error;
}
assert.ok(b21ObligationDenial instanceof AgronomicPolicyObligationCompilationError);
assert.equal(b21ObligationDenial.code, 'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_NOT_PUBLISHABLE');

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
  benchmark: 'KBS_2015_AGRONOMIC_NORMATIVE_MODALITY_GOLD',
  decision: 'DEC_0007_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  claimCount: reviewed.length,
  qualifiedKnowledgeCount: knowledgeByKey.size,
  publishedModalityCompilationCount: positiveCompilations.length,
  positiveShapes: [
    'SHOULD_PARAMETER_VALUE',
    'BEST_EFFORT_TIMING_RELATION',
    'IF_POSSIBLE_TIMING_RELATION',
    'PERMITTED_PLUS_IF_NEEDED_ACTION',
    'AS_NEEDED_OCCURRENCE'
  ],
  lexicalNegative: {
    sourcePage: 10,
    phraseClass: 'LOGISTICAL_MAY',
    publicationDenied: true,
    denialCode: lexicalMayDenial.code
  },
  b21Boundary: {
    modalityCoverageComplete: true,
    obligationCoverageStatus: normalizedB21Obligation.losslessCoverage.status,
    remainingUnrepresentedElements: normalizedB21Obligation.losslessCoverage.unrepresentedElements,
    obligationPublicationDenied: true,
    denialCode: b21ObligationDenial.code
  },
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
