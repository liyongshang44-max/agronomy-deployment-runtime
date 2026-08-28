import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicPolicyObligationCompilationError,
  agronomicPolicyObligationHash,
  normalizeAgronomicPolicyObligationCompilation,
  publishAgronomicPolicyObligationCompilation,
  validateAgronomicPolicyObligationCompilationAuthority
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
import { validateSpecificationAuthority } from '../../packages/specification-registry/src/index.mjs';
import {
  audit,
  makeEnv,
  manager,
  policySpec,
  publish
} from '../specification/fixture.mjs';

const OWNERSHIP = { organizationId: 'org-a', tenantId: 'tenant-a' };
const EXPECTED_EXCERPT_HASH = 'sha256:9a8122ffaf634a86e6e9d07c6ea0d4fa607ecdf3c3ba6a2969125a9655d4c2a4';
const SOURCE_LOCATOR = 'current_agronomic_protocol.pdf#obligation-excerpts';
const SYSTEM_CONTEXT =
  'System H: Continuous fallow system: No crop growth, no cover growth and no weed growth.';
const TREATMENT_CONTEXT = 'Treatment B21 Continuous fallow:';

const specs = [
  {
    key: 't6-cut-alfalfa-three-times-2015',
    page: 10,
    scope: 'Main Site Treatment 6',
    crop: 'alfalfa',
    decisionDomain: 'alfalfa cutting occurrence',
    assertion: 'For Main Site Treatment 6, the 2015 KBS LTER agronomic protocol directs that alfalfa be cut three times in 2015.',
    evidenceText: 'Cut alfalfa three times in 2015.'
  },
  {
    key: 'system-a-till-once-year',
    page: 15,
    scope: 'Biodiversity System A',
    crop: null,
    decisionDomain: 'fallow tillage occurrence',
    assertion: 'For Biodiversity System A, the KBS protocol states that plots are tilled once a year.',
    evidenceText: 'Plots are tilled once a year.'
  },
  {
    key: 'b21-till-as-needed-two-six-year',
    page: 20,
    scope: 'Treatment B21',
    crop: null,
    decisionDomain: 'continuous fallow tillage occurrence',
    assertion: 'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.',
    evidenceText: 'Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.'
  }
];

function locator(spec) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: spec.page, evidenceText: spec.evidenceText }
  };
}

function contextFamilies(spec) {
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  if (spec.crop) {
    families.BIOLOGICAL = {
      status: 'REPORTED',
      dimensions: [{
        semanticHint: 'crop.identity',
        valueCandidate: spec.crop,
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: locator(spec)
      }]
    };
  }
  families.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'site.identity',
      valueCandidate: 'Kellogg Biological Station',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: { page: spec.page, evidenceText: 'Kellogg Biological Station' }
      }
    }]
  };
  if (spec.key === 'b21-till-as-needed-two-six-year') {
    families.MANAGEMENT = {
      status: 'REPORTED',
      dimensions: [
        {
          semanticHint: 'system.identity',
          valueCandidate: 'System H',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: {
            kind: 'DOCUMENT_COORDINATE',
            scheme: 'PDF_PAGE_TEXT_V1',
            coordinates: { page: 20, evidenceText: SYSTEM_CONTEXT }
          }
        },
        {
          semanticHint: 'treatment.identity',
          valueCandidate: 'B21',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: {
            kind: 'DOCUMENT_COORDINATE',
            scheme: 'PDF_PAGE_TEXT_V1',
            coordinates: { page: 20, evidenceText: TREATMENT_CONTEXT }
          }
        },
        {
          semanticHint: 'management.system',
          valueCandidate: 'Continuous fallow',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: {
            kind: 'DOCUMENT_COORDINATE',
            scheme: 'PDF_PAGE_TEXT_V1',
            coordinates: { page: 20, evidenceText: TREATMENT_CONTEXT }
          }
        }
      ]
    };
  } else {
    families.MANAGEMENT = {
      status: 'REPORTED',
      dimensions: [{
        semanticHint: 'protocol.scope',
        valueCandidate: spec.scope,
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: locator(spec)
      }]
    };
  }
  families.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: spec.decisionDomain,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(spec)
    }]
  };
  return families;
}

function contextAdjudication(spec) {
  return {
    BIOLOGICAL: spec.crop ? [{ semanticId: 'crop.code', valueType: 'CATEGORY' }] : [],
    ENVIRONMENTAL: [{ semanticId: 'site.name', valueType: 'STRING' }],
    MANAGEMENT: spec.key === 'b21-till-as-needed-two-six-year'
      ? [
          { semanticId: 'system.name', valueType: 'STRING' },
          { semanticId: 'treatment.name', valueType: 'STRING' },
          { semanticId: 'management.system', valueType: 'CATEGORY' }
        ]
      : [{ semanticId: 'protocol.scope', valueType: 'STRING' }],
    OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

function qualificationPreconditions(spec) {
  if (spec.key !== 'b21-till-as-needed-two-six-year') {
    return [{ semanticId: 'protocol.scope', operator: 'EQUALS', value: spec.scope }];
  }
  return [
    { semanticId: 'system.name', operator: 'EQUALS', value: 'System H' },
    { semanticId: 'treatment.name', operator: 'EQUALS', value: 'B21' },
    { semanticId: 'management.system', operator: 'EQUALS', value: 'Continuous fallow' }
  ];
}

function boolPort(semanticId) {
  return { semanticId, valueType: 'BOOLEAN', unit: '1', epistemicClasses: ['CONFIGURATION'] };
}

function actionSemantics(actionSpace) {
  return {
    equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
    actions: actionSpace.map((actionCode) => ({ actionCode, parameters: [] }))
  };
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});

const excerptBytes = readFileSync(new URL('./kbs-2015-obligation-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-obligation-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — obligation excerpts',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: SOURCE_LOCATOR,
  metadata: {
    sourcePages: [10, 15, 20],
    benchmarkClass: 'REAL_SOURCE_CURATED_OBLIGATION_EXCERPTS'
  },
  audit: audit({ type: 'USER', id: 'kbs-obligation-source-curator' }, 'kbs-obligation-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-obligation-excerpts',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-obligation-curated-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-27T10:15:00.000Z',
    locator: SOURCE_LOCATOR,
    metadata: {
      sourcePages: [10, 15, 20],
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    originalPdfBytesRetainedByThisBenchmark: false,
    exactExcerptBytesRetained: true
  },
  audit: audit({ type: 'USER', id: 'kbs-obligation-source-curator' }, 'kbs-obligation-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-obligations',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-obligations.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-obligation-compiler' }, 'kbs-obligation-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const compilationBundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-obligation-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: specs.map((spec) => ({
      key: spec.key,
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: spec.assertion,
      sourceLocator: locator(spec),
      sourceContext: contextFamilies(spec)
    })),
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_OBLIGATION_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-obligation-compiler' }, 'kbs-obligation-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-obligation-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.obligation-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-obligation-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.obligation-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-obligation-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-obligation-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = compilationBundle.claimCandidates.map((candidate, index) => {
  const spec = specs[index];
  return sourceFaithful.reviewCandidate({
    reviewLogicalId: `review.gold.kbs.obligation.${spec.key}`,
    reviewVersion: '1',
    compilationResultRef: compilationBundle.result.ref,
    claimCandidateRef: candidate.ref,
    sourceContextCandidateRef: compilationBundle.sourceContextCandidates[index].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(spec),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuthorization.ref,
    claimLogicalId: `claim.gold.kbs.obligation.${spec.key}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.gold.kbs.obligation.${spec.key}`,
    sourceContextVersion: '1',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-obligation-source-faithful-${spec.key}`)
  });
});

const b21Reviewed = reviewed[specs.findIndex((spec) =>
  spec.key === 'b21-till-as-needed-two-six-year')];
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
  principalId: 'gold-kbs-obligation-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.obligation-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-obligation-scientific-role')
});

const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const knowledgeByKey = new Map();

for (let index = 0; index < reviewed.length; index += 1) {
  const reviewedItem = reviewed[index];
  const spec = specs[index];
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.obligation.qualification.${spec.key}`,
    version: '1',
    resourceId: qualificationResourceId(reviewedItem.claim.ref, reviewedItem.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `kbs-obligation-qualification-policy-${spec.key}`)
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
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, `kbs-obligation-qualification-auth-${spec.key}`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.obligation.${spec.key}`,
    decisionVersion: '1',
    claimRef: reviewedItem.claim.ref,
    sourceContextRef: reviewedItem.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: qualificationPreconditions(spec),
    approverPrincipal: scientificApprover,
    authorizationDecisionAuditRef: qualificationAuthorization.ref,
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-obligation-qualification-${spec.key}`)
  });
  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.obligation.${spec.key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-obligation-qualified-${spec.key}`)
  });
  knowledgeByKey.set(spec.key, knowledge);
}

function publishPolicy({ logicalId, decisionType, actionSpace, inputSemanticId }) {
  return publish(env, 'Policy', logicalId, '1', policySpec({
    contractVersion: 'adr.policy.v3',
    decisionType,
    actionSpace,
    actionSemantics: actionSemantics(actionSpace),
    requiredInputs: [boolPort(inputSemanticId)],
    requiredRuntimeOutputs: [],
    decisionLogic: {
      methodId: `${logicalId}.obligation-context`,
      definitionHash: `sha256:${'f'.repeat(64)}`
    },
    thresholdAuthority: { mode: 'SPEC_DEFINED', authorityRefs: [] },
    operationalConstraints: [],
    jurisdictionConstraints: [],
    humanGate: { mode: 'NONE' },
    fallback: { disposition: 'WAIT' },
    abstentionConditions: [],
    limitations: ['KBS_2015_PROTOCOL_OBLIGATION_BENCHMARK']
  }));
}

const policies = {
  t6: publishPolicy({
    logicalId: 'policy.gold.kbs.t6.alfalfa-cutting-obligation',
    decisionType: 'ALFALFA_CUTTING_CONTROL',
    actionSpace: ['CUT_ALFALFA', 'DO_NOT_CUT_ALFALFA'],
    inputSemanticId: 'context.is_treatment_6'
  }),
  systemA: publishPolicy({
    logicalId: 'policy.gold.kbs.system-a.tillage-obligation',
    decisionType: 'TILLAGE_CONTROL',
    actionSpace: ['TILL', 'DO_NOT_TILL'],
    inputSemanticId: 'context.is_biodiversity_system_a'
  }),
  b21: publishPolicy({
    logicalId: 'policy.gold.kbs.b21.tillage-obligation-candidate',
    decisionType: 'TILLAGE_CONTROL',
    actionSpace: ['TILL', 'DO_NOT_TILL'],
    inputSemanticId: 'context.is_biodiversity_b21'
  })
};

function authorityBindings(knowledgeRef) {
  return {
    action: [{
      role: 'REQUIRED_ACTION',
      authorityRef: knowledgeRef,
      rationale: 'The source-qualified knowledge establishes the action occurrence instruction.'
    }],
    occurrence: [{
      role: 'OCCURRENCE_CARDINALITY',
      authorityRef: knowledgeRef,
      rationale: 'The source-qualified knowledge establishes the occurrence count or count range.'
    }],
    period: [{
      role: 'COUNTING_PERIOD',
      authorityRef: knowledgeRef,
      rationale: 'The source-qualified knowledge establishes the calendar counting period.'
    }]
  };
}

function makeObligation({
  obligationId,
  knowledgeRef,
  decisionType,
  actionCode,
  occurrence
}) {
  const bindings = authorityBindings(knowledgeRef);
  return {
    contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
    obligationId,
    decisionType,
    effect: 'REQUIRE',
    actionCode,
    occurrence: {
      ...occurrence,
      period: {
        ...occurrence.period,
        authorityBindings: bindings.period
      },
      authorityBindings: bindings.occurrence
    },
    authorityBindings: bindings.action
  };
}

function compilationFor({ policy, knowledge, obligation, status, unrepresentedElements = [] }) {
  const policyAuthority = validateSpecificationAuthority({
    ledger: env.ledger,
    specificationRef: policy.ref
  });
  const approverPrincipal = {
    principalId: manager.principalId,
    type: manager.type,
    organizationId: manager.organizationId,
    tenantId: manager.tenantId
  };
  return {
    approverPrincipal,
    value: {
      contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [source.ref],
      sourceProtocolArtifactRefs: [artifact.ref],
      knowledgeRefs: [knowledge.ref],
      policyRef: policy.ref,
      obligation,
      obligationHash: agronomicPolicyObligationHash(obligation),
      transformationRationale: 'Preserve only source-explicit action occurrence cardinality and counting period. Do not invent trigger, schedule, due-state, fallback, satisfaction, violation, or execution truth.',
      losslessCoverage: {
        status,
        coveredElements: ['ACTION', 'CARDINALITY', 'COUNTING_PERIOD', 'SOURCE_ARTIFACT'],
        unrepresentedElements
      },
      approverPrincipal,
      approvalRef: policyAuthority.managementAuthorization.ref,
      limitations: [
        'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
        'PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE'
      ]
    }
  };
}

const t6Knowledge = knowledgeByKey.get('t6-cut-alfalfa-three-times-2015');
const t6Obligation = makeObligation({
  obligationId: 't6-cut-alfalfa-three-times-2015',
  knowledgeRef: t6Knowledge.ref,
  decisionType: 'ALFALFA_CUTTING_CONTROL',
  actionCode: 'CUT_ALFALFA',
  occurrence: {
    mode: 'EXACT_COUNT',
    exactCount: 3,
    period: { kind: 'FIXED_CALENDAR_YEAR', year: 2015 }
  }
});
const t6Compilation = compilationFor({
  policy: policies.t6,
  knowledge: t6Knowledge,
  obligation: t6Obligation,
  status: 'COMPLETE'
});

const systemAKnowledge = knowledgeByKey.get('system-a-till-once-year');
const systemAObligation = makeObligation({
  obligationId: 'system-a-till-once-each-calendar-year',
  knowledgeRef: systemAKnowledge.ref,
  decisionType: 'TILLAGE_CONTROL',
  actionCode: 'TILL',
  occurrence: {
    mode: 'EXACT_COUNT',
    exactCount: 1,
    period: { kind: 'EACH_CALENDAR_YEAR' }
  }
});
const systemACompilation = compilationFor({
  policy: policies.systemA,
  knowledge: systemAKnowledge,
  obligation: systemAObligation,
  status: 'COMPLETE'
});

function publishGold(logicalId, candidate) {
  const published = publishAgronomicPolicyObligationCompilation({
    ledger: env.ledger,
    logicalId,
    version: '1',
    compilation: candidate.value,
    audit: audit({
      type: candidate.approverPrincipal.type,
      id: candidate.approverPrincipal.principalId
    }, logicalId)
  });
  return validateAgronomicPolicyObligationCompilationAuthority({
    ledger: env.ledger,
    compilationRef: published.ref
  });
}

const publishedObligations = [
  publishGold('obligation-compilation.gold.kbs.t6-cut-three-times-2015', t6Compilation),
  publishGold('obligation-compilation.gold.kbs.system-a-till-once-year', systemACompilation)
];

const b21Knowledge = knowledgeByKey.get('b21-till-as-needed-two-six-year');
const b21Obligation = makeObligation({
  obligationId: 'b21-till-two-six-times-each-calendar-year-candidate',
  knowledgeRef: b21Knowledge.ref,
  decisionType: 'TILLAGE_CONTROL',
  actionCode: 'TILL',
  occurrence: {
    mode: 'BOUNDED_COUNT',
    minCount: 2,
    maxCount: 6,
    period: { kind: 'EACH_CALENDAR_YEAR' }
  }
});
const b21Compilation = compilationFor({
  policy: policies.b21,
  knowledge: b21Knowledge,
  obligation: b21Obligation,
  status: 'INCOMPLETE',
  unrepresentedElements: [
    'GOAL_CONDITION_PREVENT_PLANT_GROWTH_ESTABLISHMENT',
    'NORMATIVE_MODALITY_AS_NEEDED'
  ]
});
const normalizedB21 = normalizeAgronomicPolicyObligationCompilation(b21Compilation.value);
assert.equal(normalizedB21.losslessCoverage.status, 'INCOMPLETE');
assert.deepEqual(normalizedB21.losslessCoverage.unrepresentedElements, [
  'GOAL_CONDITION_PREVENT_PLANT_GROWTH_ESTABLISHMENT',
  'NORMATIVE_MODALITY_AS_NEEDED'
]);

let b21PublicationError = null;
try {
  publishAgronomicPolicyObligationCompilation({
    ledger: env.ledger,
    logicalId: 'obligation-compilation.gold.kbs.b21-should-not-publish',
    version: '1',
    compilation: b21Compilation.value,
    audit: audit({
      type: b21Compilation.approverPrincipal.type,
      id: b21Compilation.approverPrincipal.principalId
    }, 'kbs-b21-incomplete-obligation')
  });
} catch (error) {
  b21PublicationError = error;
}
assert.ok(b21PublicationError instanceof AgronomicPolicyObligationCompilationError);
assert.equal(b21PublicationError.code, 'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_NOT_PUBLISHABLE');

for (let index = 0; index < reviewed.length; index += 1) {
  const knowledge = knowledgeByKey.get(specs[index].key);
  assert.equal(
    qualificationService.qualifiedUseStatus({
      qualifiedKnowledgeRef: knowledge.ref,
      qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
    }),
    'QUALIFIED'
  );
  const claim = env.ledger.resolve(knowledge.semanticPayload.claimRef);
  assert.deepEqual(claim.semanticPayload.sourceRef, source.ref);
  assert.deepEqual(claim.semanticPayload.sourceArtifactRef, artifact.ref);
  assert.equal(claim.semanticPayload.sourceLocator.coordinates.page, specs[index].page);
}

assert.equal(publishedObligations[0].semanticPayload.obligation.occurrence.exactCount, 3);
assert.equal(publishedObligations[0].semanticPayload.obligation.occurrence.period.year, 2015);
assert.equal(publishedObligations[1].semanticPayload.obligation.occurrence.exactCount, 1);
assert.equal(publishedObligations[1].semanticPayload.obligation.occurrence.period.kind, 'EACH_CALENDAR_YEAR');

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
  benchmark: 'KBS_2015_AGRONOMIC_POLICY_OBLIGATION_GOLD',
  decision: 'DEC_0006_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  claimCount: reviewed.length,
  qualifiedKnowledgeCount: knowledgeByKey.size,
  publishedObligationCompilationCount: publishedObligations.length,
  positiveShapes: [
    'EXACT_COUNT_FIXED_CALENDAR_YEAR',
    'EXACT_COUNT_EACH_CALENDAR_YEAR'
  ],
  boundedCandidate: {
    sourceScope: 'Treatment B21',
    minCount: normalizedB21.obligation.occurrence.minCount,
    maxCount: normalizedB21.obligation.occurrence.maxCount,
    periodKind: normalizedB21.obligation.occurrence.period.kind,
    coverageStatus: normalizedB21.losslessCoverage.status,
    unrepresentedElements: normalizedB21.losslessCoverage.unrepresentedElements,
    publicationDenied: true,
    denialCode: b21PublicationError.code
  },
  policyContractVersion: 'adr.policy.v3',
  policyRuntimeOutputCount: 0,
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
