import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  agronomicPolicyConstraintHash,
  publishAgronomicPolicyConstraintCompilation,
  validateAgronomicPolicyConstraintCompilationAuthority
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
const EXPECTED_EXCERPT_HASH = 'sha256:5021d6c3f01414a3f8c5633d746eca5cd0c68db3f041aa8274647e5ffec358cf';
const SOURCE_LOCATOR = 'current_agronomic_protocol.pdf#prohibition-excerpts';

const specs = [
  {
    key: 't6-no-nitrogen',
    page: 10,
    treatment: 'Main Site Treatment 6',
    crop: 'alfalfa',
    decisionDomain: 'nitrogen input control',
    assertion: 'For Main Site Treatment 6 in the 2015 KBS LTER agronomic protocol, nitrogen must not be added.',
    evidenceText: 'Do not add any nitrogen to treatment 6.'
  },
  {
    key: 't7-no-till-except-microplot',
    page: 11,
    treatment: 'Main Site Treatment 7',
    crop: null,
    decisionDomain: 'tillage control',
    assertion: 'For Main Site Treatment 7, tillage is prohibited at any time except in the micro-plot area.',
    evidenceText: 'No mowing or tillage within any treatment 7 plot at any time, except for the micro-plot area.'
  },
  {
    key: 't7-no-mow-except-microplot',
    page: 11,
    treatment: 'Main Site Treatment 7',
    crop: null,
    decisionDomain: 'mowing control',
    assertion: 'For Main Site Treatment 7, mowing is prohibited at any time except in the micro-plot area.',
    evidenceText: 'No mowing or tillage within any treatment 7 plot at any time, except for the micro-plot area.'
  },
  {
    key: 't8nt-do-not-till',
    page: 13,
    treatment: 'Main Site Treatment 8nt',
    crop: 'soybean',
    decisionDomain: 'tillage control',
    assertion: 'For Main Site Treatment 8nt in the 2015 KBS LTER agronomic protocol, tillage is prohibited.',
    evidenceText: 'Tillage: No-till. DO NOT TILL.'
  },
  {
    key: 'nrate-no-24d-within-seven-days',
    page: 21,
    treatment: 'Nitrogen Rate Study',
    crop: 'soybean',
    decisionDomain: 'herbicide tank-mix control',
    assertion: 'In the Nitrogen Rate Study, if the Roundup application is within seven days of planting, 2,4-D must not be used in the tank mix.',
    evidenceText: 'If Roundup application is within 7 days of planting do not use 2,4-D in the tank mix.'
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
        coordinates: { page: spec.page, evidenceText: '2015 LTER Agronomic Protocol Kellogg Biological Station' }
      }
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'treatment.identity',
      valueCandidate: spec.treatment,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(spec)
    }]
  };
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
    MANAGEMENT: [{ semanticId: 'treatment.name', valueType: 'STRING' }],
    OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

function boolPort(semanticId) {
  return { semanticId, valueType: 'BOOLEAN', unit: '1', epistemicClasses: ['CONFIGURATION'] };
}

function decimalPort(semanticId, unit) {
  return { semanticId, valueType: 'DECIMAL', unit, epistemicClasses: ['DERIVED'] };
}

function actionSemantics(actionSpace) {
  return {
    equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
    actions: actionSpace.map((actionCode) => ({ actionCode, parameters: [] }))
  };
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({ ledger: env.ledger, artifactStore: new ExactArtifactStore() });

const excerptBytes = readFileSync(new URL('./kbs-2015-prohibition-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.kbs-2015-prohibition-gold',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — prohibition excerpts',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: SOURCE_LOCATOR,
  metadata: {
    sourcePages: [10, 11, 13, 21],
    benchmarkClass: 'REAL_SOURCE_CURATED_PROHIBITION_EXCERPTS'
  },
  audit: audit({ type: 'USER', id: 'kbs-constraint-source-curator' }, 'kbs-constraint-source')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.kbs-2015-prohibition-excerpts',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-prohibition-curated-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-27T03:45:00.000Z',
    locator: SOURCE_LOCATOR,
    metadata: {
      sourcePages: [10, 11, 13, 21],
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    originalPdfBytesRetainedByThisBenchmark: false,
    exactExcerptBytesRetained: true
  },
  audit: audit({ type: 'USER', id: 'kbs-constraint-source-curator' }, 'kbs-constraint-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.gold.kbs-2015-prohibitions',
  version: '1',
  compilerId: 'adr.gold.kbs-2015-prohibitions.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-prohibition-compiler' }, 'kbs-constraint-compiler')
});

const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const compilationBundle = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.gold.kbs-2015-prohibition-source-claims',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: specs.map((spec) => ({
      key: spec.key,
      claimType: 'BOUNDARY_CONSTRAINT',
      assertion: spec.assertion,
      sourceLocator: locator(spec),
      sourceContext: contextFamilies(spec)
    })),
    runMetadata: {
      benchmark: 'KBS_2015_AGRONOMIC_PROHIBITION_GOLD',
      curationMode: 'HUMAN_CURATED_ACCEPTANCE_FIXTURE'
    }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'gold-prohibition-compiler' }, 'kbs-constraint-compilation')
});

const reviewer = createPrincipal({
  principalId: 'gold-kbs-prohibition-agronomy-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.prohibition-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-constraint-review-role')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.gold.kbs.prohibition-source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-constraint-review-policy')
});
const reviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'kbs-constraint-review-auth')
});

const sourceFaithful = new SourceFaithfulReviewService({ ledger: env.ledger });
const reviewed = compilationBundle.claimCandidates.map((candidate, index) => {
  const spec = specs[index];
  return sourceFaithful.reviewCandidate({
    reviewLogicalId: `review.gold.kbs.prohibition.${spec.key}`,
    reviewVersion: '1',
    compilationResultRef: compilationBundle.result.ref,
    claimCandidateRef: candidate.ref,
    sourceContextCandidateRef: compilationBundle.sourceContextCandidates[index].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(spec),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuthorization.ref,
    claimLogicalId: `claim.gold.kbs.prohibition.${spec.key}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.gold.kbs.prohibition.${spec.key}`,
    sourceContextVersion: '1',
    audit: audit({ type: reviewer.type, id: reviewer.principalId }, `kbs-constraint-source-faithful-${spec.key}`)
  });
});

const scientificApprover = createPrincipal({
  principalId: 'gold-kbs-prohibition-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});
const scientificApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.kbs.prohibition-scientific-approver',
  version: '1',
  principal: scientificApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'kbs-constraint-scientific-role')
});

const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const knowledgeByKey = new Map();

for (let index = 0; index < reviewed.length; index += 1) {
  const reviewedItem = reviewed[index];
  const spec = specs[index];
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.kbs.prohibition.qualification.${spec.key}`,
    version: '1',
    resourceId: qualificationResourceId(reviewedItem.claim.ref, reviewedItem.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: scientificApprover.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `kbs-constraint-qualification-policy-${spec.key}`)
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
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, `kbs-constraint-qualification-auth-${spec.key}`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.kbs.prohibition.${spec.key}`,
    decisionVersion: '1',
    claimRef: reviewedItem.claim.ref,
    sourceContextRef: reviewedItem.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: [
      { semanticId: 'treatment.name', operator: 'EQUALS', value: spec.treatment }
    ],
    approverPrincipal: scientificApprover,
    authorizationDecisionAuditRef: qualificationAuthorization.ref,
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-constraint-qualification-${spec.key}`)
  });
  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.kbs.prohibition.${spec.key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit({ type: scientificApprover.type, id: scientificApprover.principalId }, `kbs-constraint-qualified-${spec.key}`)
  });
  knowledgeByKey.set(spec.key, knowledge);
}

function publishPolicy({ logicalId, decisionType, actionSpace, inputs }) {
  return publish(env, 'Policy', logicalId, '1', policySpec({
    decisionType,
    actionSpace,
    actionSemantics: actionSemantics(actionSpace),
    requiredInputs: [],
    requiredRuntimeOutputs: inputs,
    decisionLogic: {
      methodId: `${logicalId}.candidate-evaluation`,
      definitionHash: `sha256:${'f'.repeat(64)}`
    },
    thresholdAuthority: { mode: 'SPEC_DEFINED', authorityRefs: [] },
    operationalConstraints: [],
    jurisdictionConstraints: [],
    humanGate: { mode: 'NONE' },
    fallback: { disposition: 'WAIT' },
    abstentionConditions: [],
    limitations: ['KBS_2015_PROTOCOL_CONSTRAINT_BENCHMARK']
  }));
}

function condition(semanticId, value, knowledgeRef, role) {
  return {
    logic: 'ALL',
    predicates: [{
      semanticId,
      comparator: 'EQ',
      value: { type: 'BOOLEAN', boolean: value },
      authorityBindings: [{
        role,
        authorityRef: knowledgeRef,
        rationale: 'The source-bounded knowledge establishes the exact context or exception for this prohibition.'
      }]
    }]
  };
}

const policies = {
  t6: publishPolicy({
    logicalId: 'policy.gold.kbs.t6.nitrogen-control',
    decisionType: 'NITROGEN_INPUT_CONTROL',
    actionSpace: ['APPLY_NITROGEN', 'DO_NOT_APPLY_NITROGEN'],
    inputs: [boolPort('context.is_treatment_6')]
  }),
  t7: publishPolicy({
    logicalId: 'policy.gold.kbs.t7.field-operation-control',
    decisionType: 'FIELD_OPERATION_CONTROL',
    actionSpace: ['TILL', 'MOW', 'DO_NOT_TILL', 'DO_NOT_MOW'],
    inputs: [boolPort('context.is_treatment_7'), boolPort('context.is_microplot')]
  }),
  t8nt: publishPolicy({
    logicalId: 'policy.gold.kbs.t8nt.tillage-control',
    decisionType: 'TILLAGE_CONTROL',
    actionSpace: ['TILL', 'DO_NOT_TILL'],
    inputs: [boolPort('context.is_treatment_8nt')]
  }),
  nrate: publishPolicy({
    logicalId: 'policy.gold.kbs.nrate.herbicide-mix-control',
    decisionType: 'HERBICIDE_TANK_MIX_CONTROL',
    actionSpace: ['INCLUDE_2_4_D_IN_TANK_MIX', 'EXCLUDE_2_4_D_FROM_TANK_MIX'],
    inputs: [decimalPort('derived.days_before_planting', 'd')]
  })
};

function publishConstraint({
  logicalId,
  policy,
  knowledgeKey,
  decisionType,
  actionCode,
  when,
  exceptions = [],
  coveredElements
}) {
  const knowledge = knowledgeByKey.get(knowledgeKey);
  const policyAuthority = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: policy.ref });
  const constraint = {
    contractVersion: AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
    constraintId: logicalId,
    decisionType,
    effect: 'PROHIBIT',
    actionCode,
    ...(when ? { when } : {}),
    exceptions,
    authorityBindings: [{
      role: 'PROHIBITED_ACTION',
      authorityRef: knowledge.ref,
      rationale: 'The source explicitly prohibits this action in the governed source context.'
    }]
  };
  const constraintHash = agronomicPolicyConstraintHash(constraint);
  const approverPrincipal = {
    principalId: manager.principalId,
    type: manager.type,
    organizationId: manager.organizationId,
    tenantId: manager.tenantId
  };
  const published = publishAgronomicPolicyConstraintCompilation({
    ledger: env.ledger,
    logicalId: `constraint-compilation.gold.kbs.${logicalId}`,
    version: '1',
    compilation: {
      contractVersion: AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
      authorityClass: 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
      sourceProtocolRefs: [source.ref],
      sourceProtocolArtifactRefs: [artifact.ref],
      knowledgeRefs: [knowledge.ref],
      policyRef: policy.ref,
      constraint,
      constraintHash,
      transformationRationale: 'Compile only source-explicit negative authority. Context flags expose the already-qualified source scope; no positive action, cadence, execution fact, or machine interlock is invented.',
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements,
        unrepresentedElements: []
      },
      approverPrincipal,
      approvalRef: policyAuthority.managementAuthorization.ref,
      limitations: [
        'CURATED_EXCERPT_ARTIFACT_NOT_ORIGINAL_PDF_BYTES',
        'PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE'
      ]
    },
    audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, `kbs-constraint-publish-${logicalId}`)
  });
  return validateAgronomicPolicyConstraintCompilationAuthority({
    ledger: env.ledger,
    compilationRef: published.ref
  });
}

const t6Knowledge = knowledgeByKey.get('t6-no-nitrogen').ref;
const t7TillKnowledge = knowledgeByKey.get('t7-no-till-except-microplot').ref;
const t7MowKnowledge = knowledgeByKey.get('t7-no-mow-except-microplot').ref;
const t8Knowledge = knowledgeByKey.get('t8nt-do-not-till').ref;
const nrateKnowledge = knowledgeByKey.get('nrate-no-24d-within-seven-days').ref;

const constraints = [
  publishConstraint({
    logicalId: 't6-no-nitrogen',
    policy: policies.t6,
    knowledgeKey: 't6-no-nitrogen',
    decisionType: 'NITROGEN_INPUT_CONTROL',
    actionCode: 'APPLY_NITROGEN',
    when: condition('context.is_treatment_6', true, t6Knowledge, 'SOURCE_CONTEXT_SCOPE'),
    coveredElements: ['ACTION_TARGET', 'PROHIBITION', 'SOURCE_CONTEXT_SCOPE']
  }),
  publishConstraint({
    logicalId: 't7-no-till-except-microplot',
    policy: policies.t7,
    knowledgeKey: 't7-no-till-except-microplot',
    decisionType: 'FIELD_OPERATION_CONTROL',
    actionCode: 'TILL',
    when: condition('context.is_treatment_7', true, t7TillKnowledge, 'SOURCE_CONTEXT_SCOPE'),
    exceptions: [condition('context.is_microplot', true, t7TillKnowledge, 'SOURCE_EXCEPTION')],
    coveredElements: ['ACTION_TARGET_TILL', 'EXCEPTION_MICROPLOT', 'PROHIBITION', 'SOURCE_CONTEXT_SCOPE']
  }),
  publishConstraint({
    logicalId: 't7-no-mow-except-microplot',
    policy: policies.t7,
    knowledgeKey: 't7-no-mow-except-microplot',
    decisionType: 'FIELD_OPERATION_CONTROL',
    actionCode: 'MOW',
    when: condition('context.is_treatment_7', true, t7MowKnowledge, 'SOURCE_CONTEXT_SCOPE'),
    exceptions: [condition('context.is_microplot', true, t7MowKnowledge, 'SOURCE_EXCEPTION')],
    coveredElements: ['ACTION_TARGET_MOW', 'EXCEPTION_MICROPLOT', 'PROHIBITION', 'SOURCE_CONTEXT_SCOPE']
  }),
  publishConstraint({
    logicalId: 't8nt-do-not-till',
    policy: policies.t8nt,
    knowledgeKey: 't8nt-do-not-till',
    decisionType: 'TILLAGE_CONTROL',
    actionCode: 'TILL',
    when: condition('context.is_treatment_8nt', true, t8Knowledge, 'SOURCE_CONTEXT_SCOPE'),
    coveredElements: ['ACTION_TARGET', 'PROHIBITION', 'SOURCE_CONTEXT_SCOPE']
  }),
  publishConstraint({
    logicalId: 'nrate-no-24d-within-seven-days',
    policy: policies.nrate,
    knowledgeKey: 'nrate-no-24d-within-seven-days',
    decisionType: 'HERBICIDE_TANK_MIX_CONTROL',
    actionCode: 'INCLUDE_2_4_D_IN_TANK_MIX',
    when: {
      logic: 'ALL',
      predicates: [{
        semanticId: 'derived.days_before_planting',
        comparator: 'LT',
        value: { type: 'DECIMAL', decimal: '7', unit: 'd' },
        authorityBindings: [{
          role: 'SOURCE_CONDITIONAL_BOUNDARY',
          authorityRef: nrateKnowledge,
          rationale: 'The source requires 2,4-D seven days before planting and prohibits it in the tank mix when the application is within seven days; LT 7 preserves the stated boundary.'
        }]
      }]
    },
    coveredElements: ['ACTION_TARGET', 'CONDITIONAL_BOUNDARY_LT_7_DAYS', 'PROHIBITION']
  })
];

assert.equal(constraints.length, 5);
assert.equal(constraints[1].semanticPayload.constraint.exceptions.length, 1);
assert.equal(constraints[2].semanticPayload.constraint.exceptions.length, 1);
assert.equal(constraints[4].semanticPayload.constraint.when.predicates[0].comparator, 'LT');
assert.equal(constraints[4].semanticPayload.constraint.when.predicates[0].value.decimal, '7');

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

const forbiddenRuntimeKinds = new Set([
  'RuntimeBinding',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const runtimeRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenRuntimeKinds.has(record.ref.kind));
assert.equal(runtimeRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_PROHIBITION_CONSTRAINT_GOLD',
  decision: 'DEC-0004_PROPOSED_NOT_NORMATIVE',
  claimCount: reviewed.length,
  qualifiedKnowledgeCount: knowledgeByKey.size,
  constraintCompilationCount: constraints.length,
  shapes: [
    'UNCONDITIONAL_SOURCE_CONTEXT_PROHIBITION',
    'EXPLICIT_EXCEPTION_TILL',
    'EXPLICIT_EXCEPTION_MOW',
    'UNCONDITIONAL_TILLAGE_PROHIBITION',
    'CONDITIONAL_LT_7_DAY_MATERIAL_PROHIBITION'
  ],
  sourceArtifactHash: EXPECTED_EXCERPT_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  executionAuthorityRecordsCreated: runtimeRecords.length
}, null, 2));
