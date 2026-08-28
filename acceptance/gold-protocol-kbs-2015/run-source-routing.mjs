import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
  AgronomicSourceAuthorityRoutingCompilationError,
  agronomicSourceAuthorityRoutingHash,
  normalizeAgronomicSourceAuthorityRouting,
  publishAgronomicSourceAuthorityRoutingCompilation,
  publishAgronomicSourceAuthorityRoutingReviewDecision,
  validateAgronomicSourceAuthorityRoutingCompilationAuthority
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
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';

const OWNERSHIP = { organizationId: 'org-a', tenantId: 'tenant-a' };
const PLANNING_HASH =
  'sha256:bdfeb538dcd12621c3ca8f49c19230651254437f219e0b9466a0465c9b29a6cf';
const RECORD_HASH =
  'sha256:cbfdb3d1a7870b825cead15d76515b5007c83d52d2f2d18700918b3a2d72ec0b';

const PLANNING_EXPRESSION =
  'This is a working protocol used for planning purposes. Due to potential changes in chemicals, fertilizer, varieties planted, planting dates etc… please refer to the agronomic field log for actual field operations that take place during 2015.';
const RECORD_EXPRESSION =
  'A narrative log of the agronomic activities or observations made on MCSE Treatments.';

let seq = 0;
function audit(actor, label) {
  seq += 1;
  return {
    eventId: `gold-source-routing-${seq}-${label}`,
    occurredAt: '2026-08-28T05:55:00.000Z',
    actor,
    details: { suite: 'kbs-2015-source-authority-routing-gold', label }
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

const ledger = new AuthorityLedger();
const sourceRegistry = new SourceRegistry({
  ledger,
  artifactStore: new ExactArtifactStore()
});

const planningBytes = readFileSync(
  new URL('./kbs-2015-source-routing-planning.txt', import.meta.url)
);
const recordBytes = readFileSync(
  new URL('./kbs-field-log-source-routing-catalog.txt', import.meta.url)
);
assert.equal(sourceContentHash(planningBytes), PLANNING_HASH);
assert.equal(sourceContentHash(recordBytes), RECORD_HASH);

const planningSource = sourceRegistry.registerSource({
  logicalId: 'source.gold.kbs-2015-planning-routing',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — planning authority disclaimer',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator:
    'https://lter.kbs.msu.edu/docs/agronomic_protocols/current_agronomic_protocol.pdf',
  metadata: {
    benchmarkClass: 'REAL_PUBLIC_SOURCE_CURATED_PLANNING_ROUTING_EXCERPT',
    originalPdfBytesRetainedByBenchmark: false
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'planning-source')
});

const planningArtifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.gold.kbs-2015-planning-routing',
  version: '1',
  sourceRef: planningSource.ref,
  bytes: planningBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-planning-routing-curated-excerpt',
  acquisition: {
    method: 'CURATED_PUBLIC_SOURCE_TRANSCRIPTION',
    acquiredAt: '2026-08-28T05:50:00Z',
    locator:
      'https://lter.kbs.msu.edu/docs/agronomic_protocols/current_agronomic_protocol.pdf',
    metadata: {
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    exactExcerptBytesRetained: true,
    originalPdfBytesRetainedByBenchmark: false
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'planning-artifact')
});

const recordSource = sourceRegistry.registerSource({
  logicalId: 'source.gold.kbs-field-log-catalog',
  version: '1',
  sourceType: 'OTHER',
  title: 'Agronomic Field Log — Main Cropping System Experiment (MCSE)',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University'
  },
  originLocator: 'https://lter.kbs.msu.edu/datatables/16',
  metadata: {
    benchmarkClass: 'REAL_PUBLIC_SOURCE_CURATED_RECORD_SOURCE_CATALOG',
    restrictedRowsRetainedByBenchmark: false
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'record-source')
});

const recordArtifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.gold.kbs-field-log-catalog',
  version: '1',
  sourceRef: recordSource.ref,
  bytes: recordBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-field-log-public-catalog-curated-excerpt',
  acquisition: {
    method: 'CURATED_PUBLIC_CATALOG_TRANSCRIPTION',
    acquiredAt: '2026-08-28T05:50:00Z',
    locator: 'https://lter.kbs.msu.edu/datatables/16',
    metadata: {
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT',
      restrictedDataRowsCopied: false
    }
  },
  metadata: {
    exactPublicCatalogBytesRetained: true,
    restrictedDataRowsRetained: false
  },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'record-artifact')
});

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.gold.source-authority-routing',
  version: '1',
  compilerId: 'adr.gold.public-source-authority-routing.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'WHOLE_ARTIFACT'
  },
  audit: audit(
    { type: 'SERVICE_ACCOUNT', id: 'gold-source-routing-compiler' },
    'compiler'
  )
});

const compiler = new ScientificCompiler({ ledger, sourceRegistry });

function compileClaim({ label, artifact, assertion }) {
  return compiler.materializeCompilationProposal({
    compilationLogicalId: `compilation.gold.source-routing.${label}`,
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: label,
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion,
        sourceLocator: { kind: 'WHOLE_ARTIFACT' },
        sourceContext: emptyContextFamilies()
      }],
      runMetadata: {
        benchmark: 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_GOLD',
        sourceRole: label
      }
    },
    audit: audit(
      { type: 'SERVICE_ACCOUNT', id: 'gold-source-routing-compiler' },
      `compile-${label}`
    )
  });
}

const planningBundle = compileClaim({
  label: 'planning-routing',
  artifact: planningArtifact,
  assertion: PLANNING_EXPRESSION
});
const recordBundle = compileClaim({
  label: 'actual-operation-record-source',
  artifact: recordArtifact,
  assertion: RECORD_EXPRESSION
});

const reviewer = createPrincipal({
  principalId: 'gold-source-routing-reviewer',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});

const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.gold.source-routing-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'reviewer-role')
});

function sourceReviewAuthorization(source, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.gold.source-routing-review.${label}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `review-policy-${label}`)
  });
  return recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy,
      roleAssignments: [reviewerRole],
      authorizationScope: OWNERSHIP
    }),
    audit: audit(
      { type: 'SERVICE_ACCOUNT', id: 'iam-engine' },
      `review-auth-${label}`
    )
  });
}

const planningReviewAuth =
  sourceReviewAuthorization(planningSource, 'planning');
const recordReviewAuth =
  sourceReviewAuthorization(recordSource, 'record');

const sourceFaithful = new SourceFaithfulReviewService({ ledger });

function reviewClaim({ label, bundle, authRef }) {
  return sourceFaithful.reviewCandidate({
    reviewLogicalId: `review.gold.source-routing.source-faithful.${label}`,
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: emptyContextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: authRef,
    claimLogicalId: `claim.gold.source-routing.${label}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.gold.source-routing.${label}`,
    sourceContextVersion: '1',
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      `source-faithful-${label}`
    )
  });
}

const planningReviewed = reviewClaim({
  label: 'planning',
  bundle: planningBundle,
  authRef: planningReviewAuth.ref
});
const recordReviewed = reviewClaim({
  label: 'record',
  bundle: recordBundle,
  authRef: recordReviewAuth.ref
});

const approver = createPrincipal({
  principalId: 'gold-source-routing-scientific-approver',
  type: 'USER',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId
});

const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.gold.source-routing-scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'approver-role')
});

const qualification = new ScientificQualificationService({ ledger });

function qualify({ label, reviewed }) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.gold.source-routing-qualification.${label}`,
    version: '1',
    resourceId: qualificationResourceId(
      reviewed.claim.ref,
      reviewed.sourceContext.ref
    ),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit({ type: 'USER', id: 'iam-admin' }, `qualification-policy-${label}`)
  });
  const authRecord = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeQualification({
      principal: approver,
      policy,
      roleAssignments: [approverRole],
      qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
      authorizationScope: OWNERSHIP
    }),
    audit: audit(
      { type: 'SERVICE_ACCOUNT', id: 'iam-engine' },
      `qualification-auth-${label}`
    )
  });
  const decision = qualification.recordQualificationDecision({
    decisionLogicalId: `qualification.gold.source-routing.${label}`,
    decisionVersion: '1',
    claimRef: reviewed.claim.ref,
    sourceContextRef: reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions: [],
    approverPrincipal: approver,
    authorizationDecisionAuditRef: authRecord.ref,
    audit: audit(
      { type: approver.type, id: approver.principalId },
      `qualification-${label}`
    )
  });
  return qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.gold.source-routing.${label}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(
      { type: approver.type, id: approver.principalId },
      `qualified-${label}`
    )
  });
}

const planningKnowledge = qualify({
  label: 'planning',
  reviewed: planningReviewed
});
const recordKnowledge = qualify({
  label: 'record',
  reviewed: recordReviewed
});

const routing = {
  contractVersion: AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
  routingId: 'kbs-2015-planning-to-field-log-actual-operation-routing',
  sourceExpression: PLANNING_EXPRESSION,
  actualOperationRecordSourceExpression: RECORD_EXPRESSION,
  planningSourceRef: planningSource.ref,
  actualOperationRecordSourceRef: recordSource.ref,
  subjectScope: 'FIELD_OPERATION_OCCURRENCE',
  planningRole: 'PLANNED_MANAGEMENT_GUIDANCE',
  actualOperationRole: 'ACTUAL_FIELD_OPERATION_RECORD',
  routingRelation: 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE',
  temporalScope: { kind: 'CALENDAR_YEAR', year: 2015 },
  authorityBindings: [
    {
      role: 'PLANNING_ROUTING_ASSERTION',
      authorityRef: planningKnowledge.ref,
      rationale:
        'Exact 2015 protocol evidence establishes planning-only intent and routes actual operation questions to the agronomic field log.'
    },
    {
      role: 'ACTUAL_OPERATION_RECORD_SOURCE_IDENTITY',
      authorityRef: recordKnowledge.ref,
      rationale:
        'Exact public catalog evidence establishes the referenced source as a narrative agronomic activity/observation log.'
    }
  ],
  transformationRationale:
    'Preserve scoped planning-versus-actual source authority without global precedence, source supersession, event synthesis or missing-record inference.'
};

const routingReview =
  publishAgronomicSourceAuthorityRoutingReviewDecision({
    ledger,
    logicalId: 'review.gold.kbs-2015-source-authority-routing',
    version: '1',
    planningKnowledgeRefs: [planningKnowledge.ref],
    actualOperationRecordKnowledgeRefs: [recordKnowledge.ref],
    planningSourceArtifactRefs: [planningArtifact.ref],
    actualOperationRecordSourceArtifactRefs: [recordArtifact.ref],
    routing,
    disposition: 'ACCEPT_SOURCE_AUTHORITY_ROUTING',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [
      planningReviewAuth.ref,
      recordReviewAuth.ref
    ],
    rationale:
      'Authorized review confirms that the protocol remains planning guidance while actual 2015 field-operation occurrence is routed to the separately governed field-log record source.',
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'routing-review'
    )
  });

const compilation =
  publishAgronomicSourceAuthorityRoutingCompilation({
    ledger,
    logicalId: 'source-authority-routing-compilation.gold.kbs-2015',
    version: '1',
    compilation: {
      contractVersion:
        AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
      authorityClass:
        'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
      planningSourceArtifactRefs: [planningArtifact.ref],
      actualOperationRecordSourceArtifactRefs: [recordArtifact.ref],
      planningKnowledgeRefs: [planningKnowledge.ref],
      actualOperationRecordKnowledgeRefs: [recordKnowledge.ref],
      routing,
      routingHash: agronomicSourceAuthorityRoutingHash(routing),
      semanticReviewRef: routingReview.ref,
      losslessCoverage: {
        status: 'COMPLETE',
        coveredElements: [
          'PLANNING_SOURCE',
          'ACTUAL_OPERATION_RECORD_SOURCE',
          'PLANNING_ROLE',
          'ACTUAL_OPERATION_ROLE',
          'FIELD_OPERATION_OCCURRENCE_SCOPE',
          'SCOPED_ROUTING',
          'CALENDAR_YEAR_2015'
        ],
        unrepresentedElements: []
      },
      limitations: [
        'PUBLIC_CATALOG_METADATA_ONLY_NO_RESTRICTED_ROWS',
        'ROUTING_NOT_GLOBAL_SOURCE_PRECEDENCE',
        'NO_WHOLE_SOURCE_SUPERSESSION',
        'NO_EVENT_LEVEL_FIELD_LOG_INGESTION',
        'MISSING_RECORD_NOT_NON_EXECUTION',
        'ROUTING_NOT_EXECUTION_RECEIPT',
        'ROUTING_NOT_OUTCOME',
        'ROUTING_NOT_PLANNED_VS_ACTUAL_RECONCILIATION'
      ]
    },
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'routing-publication'
    )
  });

const validated =
  validateAgronomicSourceAuthorityRoutingCompilationAuthority({
    ledger,
    compilationRef: compilation.ref
  });

assert.equal(
  validated.semanticPayload.routing.planningRole,
  'PLANNED_MANAGEMENT_GUIDANCE'
);
assert.equal(
  validated.semanticPayload.routing.actualOperationRole,
  'ACTUAL_FIELD_OPERATION_RECORD'
);
assert.equal(
  validated.semanticPayload.routing.subjectScope,
  'FIELD_OPERATION_OCCURRENCE'
);
assert.equal(
  validated.semanticPayload.routing.routingRelation,
  'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE'
);
assert.deepEqual(validated.semanticPayload.routing.temporalScope, {
  kind: 'CALENDAR_YEAR',
  year: 2015
});
assert.notDeepEqual(
  validated.planningSource.ref,
  validated.actualOperationRecordSource.ref
);

const boundaryDenials = [];
for (const [field, fieldValue] of [
  ['globalPrecedence', 'ACTUAL_OVER_PLANNED'],
  ['supersedes', true],
  ['recordComplete', true],
  ['absenceMeansNonExecution', true],
  ['operationOccurred', true],
  ['operationId', 'operation-1'],
  ['executionStatus', 'EXECUTED'],
  ['executionReceiptRef', { kind: 'ExecutionReceipt' }],
  ['decisionResultRef', { kind: 'DecisionResult' }],
  ['runtimeBindingRef', { kind: 'RuntimeBinding' }],
  ['runtimeAlternativeSetRef', { kind: 'RuntimeAlternativeSet' }],
  ['policyRef', { kind: 'Policy' }],
  ['outcomeRef', { kind: 'Outcome' }]
]) {
  const candidate = structuredClone(routing);
  candidate[field] = fieldValue;
  let error = null;
  try {
    normalizeAgronomicSourceAuthorityRouting(candidate);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof AgronomicSourceAuthorityRoutingCompilationError);
  assert.equal(error.code, 'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_FIELD');
  boundaryDenials.push(field);
}

const wrongYear = structuredClone(routing);
wrongYear.temporalScope.year = 2016;
let yearError = null;
try {
  publishAgronomicSourceAuthorityRoutingReviewDecision({
    ledger,
    logicalId: 'review.gold.kbs-2015-source-routing-wrong-year',
    version: '1',
    planningKnowledgeRefs: [planningKnowledge.ref],
    actualOperationRecordKnowledgeRefs: [recordKnowledge.ref],
    planningSourceArtifactRefs: [planningArtifact.ref],
    actualOperationRecordSourceArtifactRefs: [recordArtifact.ref],
    routing: wrongYear,
    disposition: 'ACCEPT_SOURCE_AUTHORITY_ROUTING',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [
      planningReviewAuth.ref,
      recordReviewAuth.ref
    ],
    audit: audit(
      { type: reviewer.type, id: reviewer.principalId },
      'wrong-year-review'
    )
  });
} catch (error) {
  yearError = error;
}
assert.ok(yearError instanceof AgronomicSourceAuthorityRoutingCompilationError);
assert.equal(
  yearError.code,
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_TEMPORAL_SOURCE_MISMATCH'
);
boundaryDenials.push('CALENDAR_YEAR_2016');

assert.equal(
  ledger.exportSnapshot().lineage.some((lineage) =>
    lineage.relation === 'supersedes'
      && (
        (lineage.from.logicalId === planningSource.ref.logicalId
          && lineage.to.logicalId === recordSource.ref.logicalId)
        || (lineage.from.logicalId === recordSource.ref.logicalId
          && lineage.to.logicalId === planningSource.ref.logicalId)
      )),
  false
);

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
const forbiddenRecords = ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: 'KBS_2015_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_GOLD',
  decision: 'DEC_0012_ACCEPTED_IMPLEMENTATION_CANDIDATE',
  planningArtifactHash: PLANNING_HASH,
  actualRecordCatalogArtifactHash: RECORD_HASH,
  originalPdfBytesRetainedByBenchmark: false,
  restrictedFieldLogRowsRetainedByBenchmark: false,
  planningSourceRef: planningSource.ref,
  actualOperationRecordSourceRef: recordSource.ref,
  planningClaimRef: planningReviewed.claim.ref,
  actualOperationRecordSourceClaimRef: recordReviewed.claim.ref,
  routingCompilationRef: compilation.ref,
  publishedShape: {
    subjectScope: 'FIELD_OPERATION_OCCURRENCE',
    planningRole: 'PLANNED_MANAGEMENT_GUIDANCE',
    actualOperationRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    routingRelation: 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE',
    temporalScope: { kind: 'CALENDAR_YEAR', year: 2015 },
    globalSourcePrecedencePresent: false,
    wholeSourceSupersessionPresent: false,
    operationEventPresent: false,
    absenceMeansNonExecution: false
  },
  boundaryDenials,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
