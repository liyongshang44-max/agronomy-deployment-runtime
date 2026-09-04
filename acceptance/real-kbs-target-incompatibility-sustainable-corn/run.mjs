import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  publishAgronomicDecisionProblemWithFarmTargetBinding,
  validateAgronomicDecisionProblemFarmTargetPublicationAuthority,
  publishAgronomicContextManifestFromGovernedWorld,
  validateAgronomicContextManifestGovernedWorldAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { authorizeRuntimeProfileManage } from '../../packages/authorization/src/runtime-profile-control.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  ScientificQualificationService,
  qualificationResourceId
} from '../../packages/knowledge-registry/src/qualification.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeReleaseService,
  releaseMemberResourceId
} from '../../packages/knowledge-release/src/index.mjs';
import {
  RUNTIME_PROFILE_CONTRACT_VERSION,
  publishRuntimeProfile,
  validateRuntimeProfileAuthority
} from '../../packages/runtime-profile/src/index.mjs';
import {
  DEPLOYMENT_CONTRACT_VERSION,
  deploymentNeedsProductionAuthority,
  publishDeployment,
  validateDeploymentAuthority
} from '../../packages/deployment/src/index.mjs';
import {
  executeKnowledgeRetrieval,
  validateKnowledgeRetrievalResult
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  assessKnowledgeApplicability,
  validateApplicabilityAssessment
} from '../../packages/applicability/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import {
  publishRuntimeEligibility,
  validateRuntimeEligibility
} from '../../packages/runtime-eligibility/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { sourceContentHash } from '../../packages/source-registry/src/index.mjs';
import {
  env,
  historicalTimezoneRuleEvidence,
  decisionWorld,
  validatedManifest,
  exactTargetId
} from '../gold-recorded-operation-context-manifest-governed-world-sustainable-corn/run.mjs';

const OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
const RELEASE_TARGET = Object.freeze({
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programId: 'pilot-a'
});
const KBS_TRANSCRIPTION_HASH =
  'sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9';
const KBS_SOURCE_LOCATOR = 'current_agronomic_protocol.pdf#page=23';
const KBS_PDF_PAGE = 23;
const EVIDENCE_CUTOFF = '2026-08-30T14:00:00.000Z';
const LOGICAL_TIME = '2026-08-31T00:00:00.000Z';
const DECISION_DEADLINE = '2026-08-31T12:00:00.000Z';
const DECISION_TYPE = 'MACHINE_ACCEPTANCE_KBS_TARGET_INCOMPATIBILITY';
const EXPECTED_MISSING = Object.freeze(['crop.code', 'experiment.name']);

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-08-31T00:05:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-real-kbs-target-incompatibility-${seq}-${suffix}`,
    occurredAt,
    actor: {
      type: principal.type ?? 'USER',
      id: principal.principalId ?? principal.id
    },
    details: {
      suite: 'real-kbs-target-incompatibility-sustainable-corn',
      classification: 'REAL_SOURCE_NEGATIVE_TARGET_COMPATIBILITY_TEST_ONLY'
    }
  };
}

function serviceAudit(id, suffix, occurredAt) {
  return audit({ principalId: id, type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}

function locator(evidenceText) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: KBS_PDF_PAGE, evidenceText }
  };
}

function contextFamilies() {
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [
      family,
      { status: 'NOT_REPORTED', dimensions: [] }
    ])
  );
  families.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'soybean',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('soybean-specific soil water budget spreadsheet')
    }]
  };
  families.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'site.identity',
      valueCandidate: 'Kellogg Biological Station',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('2015 LTER Agronomic Protocol Kellogg Biological Station')
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'experiment.identity',
      valueCandidate: 'Resource Gradient Experiment (N-rate Study)',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('Irrigation Scheduling for the Resource Gradient Experiment (N-rate Study)')
    }]
  };
  families.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: 'irrigation scheduling',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('Irrigation Scheduling for the Resource Gradient Experiment (N-rate Study)')
    }]
  };
  return families;
}

function contextAdjudication() {
  return {
    BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
    ENVIRONMENTAL: [{ semanticId: 'site.name', valueType: 'STRING' }],
    MANAGEMENT: [{ semanticId: 'experiment.name', valueType: 'STRING' }],
    OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

// ---------------------------------------------------------------------------
// 1. Build a temporally non-lookahead Sustainable Corn A01/A04 world.
//    The FARM identity and ContextDatum remain exact DEC-0032/DEC-0031 authority.
//    Only test decision intent and evidence cutoff are newly supplied.
// ---------------------------------------------------------------------------

const decisionCreator = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-decision-creator',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
});
const decisionCreatorRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.decision-creator',
  version: '1',
  principal: decisionCreator,
  role: 'DECISION_PROBLEM_CREATOR',
  roleDefinitionVersion: 'real-kbs-target-incompatibility-v1',
  permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'DECISION_PROBLEM'
  },
  audit: audit(decisionCreator, 'decision-role')
});

const decisionLogicalId = 'dp.real-kbs-target-incompatibility.sustainable-corn';
const decisionAuthorizationDecision = authorizeDecisionProblemCreation({
  principal: decisionCreator,
  roleAssignments: [decisionCreatorRole],
  authorizationScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'DECISION_PROBLEM',
    resourceId: decisionLogicalId
  }
});
assert.equal(decisionAuthorizationDecision.allowed, true);
const decisionAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: decisionAuthorizationDecision,
  audit: serviceAudit('iam-engine', 'decision-authorization')
});

const decision = publishAgronomicDecisionProblemWithFarmTargetBinding({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  farmTargetBindingCompilationRef:
    decisionWorld.validated.bindingCompilation.ref,
  logicalId: decisionLogicalId,
  version: '1',
  deploymentScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  },
  decisionIntent: {
    decisionType: DECISION_TYPE,
    logicalTime: LOGICAL_TIME,
    decisionHorizon: { duration: 'PT24H' },
    objective: { code: 'MACHINE_ACCEPTANCE_TARGET_COMPATIBILITY_ONLY' },
    actionSpace: [
      'MACHINE_ACCEPTANCE_FIXTURE_ACTION_A',
      'MACHINE_ACCEPTANCE_FIXTURE_ACTION_B'
    ],
    constraints: [],
    usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    useClass: 'TEST_ONLY',
    decisionAuthorityMode: 'RUNTIME_ONLY',
    decisionDeadline: DECISION_DEADLINE
  },
  principal: decisionCreator,
  authorizationDecisionAuditRef: decisionAuthorization.ref,
  audit: audit(decisionCreator, 'decision-publication')
});
const decisionValidated =
  validateAgronomicDecisionProblemFarmTargetPublicationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    decisionProblemRef: decision.ref
  });
assert.deepEqual(decisionValidated.semanticPayload.targetRef, {
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  farmId: exactTargetId
});
assert.equal(
  decisionValidated.semanticPayload.usePurpose,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use
);
assert.equal(decisionValidated.semanticPayload.logicalTime, LOGICAL_TIME);

const manifestWriter = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-manifest-writer',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
});
const manifestWriterRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.manifest-writer',
  version: '1',
  principal: manifestWriter,
  role: 'CONTEXT_MANIFEST_WRITER',
  roleDefinitionVersion: 'real-kbs-target-incompatibility-v1',
  permissions: [PERMISSIONS.CONTEXT_WRITE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'CONTEXT_MANIFEST'
  },
  audit: audit(manifestWriter, 'manifest-role')
});
const manifestLogicalId = 'cm.real-kbs-target-incompatibility.sustainable-corn';
const manifestAuthorizationDecision = authorizeContextWrite({
  principal: manifestWriter,
  roleAssignments: [manifestWriterRole],
  authorizationScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'CONTEXT_MANIFEST',
    resourceId: manifestLogicalId
  }
});
assert.equal(manifestAuthorizationDecision.allowed, true);
const manifestAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: manifestAuthorizationDecision,
  audit: serviceAudit('iam-engine', 'manifest-authorization')
});
const manifest = publishAgronomicContextManifestFromGovernedWorld({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  timezoneRuleEvidence: historicalTimezoneRuleEvidence,
  decisionProblemRef: decision.ref,
  contextDatumRef: validatedManifest.contextDatum.ref,
  evidenceCutoff: EVIDENCE_CUTOFF,
  logicalId: manifestLogicalId,
  version: '1',
  principal: manifestWriter,
  authorizationDecisionAuditRef: manifestAuthorization.ref,
  audit: audit(manifestWriter, 'manifest-publication')
});
const manifestValidated =
  validateAgronomicContextManifestGovernedWorldAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    contextManifestRef: manifest.ref
  });
assert.equal(manifestValidated.sourceBackedFarmId, exactTargetId);
assert.deepEqual(manifestValidated.manifest.semanticPayload.datumRefs, [
  validatedManifest.contextDatum.ref
]);
assert.equal(manifestValidated.manifest.semanticPayload.evidenceCutoff, EVIDENCE_CUTOFF);
assert.equal(manifestValidated.manifest.semanticPayload.logicalTime, LOGICAL_TIME);
assert.ok(
  new Date(manifestValidated.contextDatum.semanticPayload.availableAt).getTime()
    <= new Date(EVIDENCE_CUTOFF).getTime()
);
assert.ok(new Date(EVIDENCE_CUTOFF).getTime() < new Date(LOGICAL_TIME).getTime());

// ---------------------------------------------------------------------------
// 2. Compile one exact real KBS 2015 QualifiedKnowledge authority into the same
//    ledger. This is real-source scientific authority, not a synthetic knowledge
//    fixture. Its target conditions remain soybean + KBS Resource Gradient Study.
// ---------------------------------------------------------------------------

const kbsBytes = readFileSync(
  new URL('../gold-protocol-kbs-2015/kbs-2015-irrigation-page23.txt', import.meta.url)
);
assert.equal(sourceContentHash(kbsBytes), KBS_TRANSCRIPTION_HASH);

const kbsSource = env.sourceRegistry.registerSource({
  logicalId: 'source.real-kbs-target-incompatibility.protocol',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — Resource Gradient Experiment irrigation scheduling',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: KBS_SOURCE_LOCATOR,
  metadata: {
    sourceDocument: 'current_agronomic_protocol.pdf',
    originalPdfPage: KBS_PDF_PAGE,
    benchmarkClass: 'REAL_SOURCE_CURATED_TRANSCRIPTION'
  },
  audit: audit(
    { principalId: 'kbs-source-curator', type: 'USER' },
    'kbs-source',
    '2026-08-30T14:10:00.000Z'
  )
});
const kbsArtifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.real-kbs-target-incompatibility.page23',
  version: '1',
  sourceRef: kbsSource.ref,
  bytes: kbsBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-irrigation-page23-whitespace-normalized-transcription-v1',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-26T15:30:00.000Z',
    locator: KBS_SOURCE_LOCATOR,
    metadata: {
      originalArtifactClass: 'USER_UPLOADED_PDF',
      originalPdfPage: KBS_PDF_PAGE,
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    originalPdfBytesRetainedByThisBenchmark: false,
    exactTranscriptionBytesRetained: true
  },
  audit: audit(
    { principalId: 'kbs-source-curator', type: 'USER' },
    'kbs-artifact',
    '2026-08-30T14:11:00.000Z'
  )
});

const kbsCompilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.real-kbs-target-incompatibility',
  version: '1',
  compilerId: 'adr.real-kbs-target-incompatibility.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE',
    locatorScheme: 'PDF_PAGE_TEXT_V1'
  },
  audit: audit(
    { principalId: 'kbs-compiler', type: 'SERVICE_ACCOUNT' },
    'kbs-compiler',
    '2026-08-30T14:12:00.000Z'
  )
});
const kbsCompiler = new ScientificCompiler({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry
});
const kbsCompilation = kbsCompiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-kbs-target-incompatibility.two-day-trigger',
  version: '1',
  sourceArtifactRef: kbsArtifact.ref,
  compilerDefinitionRef: kbsCompilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'two-day-trigger',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion:
        'When a negative plant available water value is observed for two consecutive days, an irrigation event is scheduled for the next day.',
      sourceLocator: locator(
        'When a negative value is observed for two consecutive days, an irrigation event will be scheduled for the next day'
      ),
      sourceContext: contextFamilies()
    }],
    runMetadata: {
      benchmark: 'REAL_KBS_2015_TARGET_INCOMPATIBILITY_V1',
      curationMode: 'HUMAN_CURATED_EXACT_TRANSCRIPTION'
    }
  },
  audit: audit(
    { principalId: 'kbs-compiler', type: 'SERVICE_ACCOUNT' },
    'kbs-compilation',
    '2026-08-30T14:13:00.000Z'
  )
});

const kbsReviewer = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const kbsReviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.reviewer',
  version: '1',
  principal: kbsReviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(kbsReviewer, 'kbs-reviewer-role', '2026-08-30T14:14:00.000Z')
});
const kbsReviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.real-kbs-target-incompatibility.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(kbsSource.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: kbsReviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: 'org-a' }],
  audit: audit(kbsReviewer, 'kbs-review-policy', '2026-08-30T14:15:00.000Z')
});
const kbsReviewAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: kbsReviewer,
    policy: kbsReviewPolicy,
    roleAssignments: [kbsReviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'kbs-review-authorization', '2026-08-30T14:16:00.000Z')
});
const kbsReviewed = new SourceFaithfulReviewService({
  ledger: env.ledger
}).reviewCandidate({
  reviewLogicalId: 'review.real-kbs-target-incompatibility.two-day-trigger',
  reviewVersion: '1',
  compilationResultRef: kbsCompilation.result.ref,
  claimCandidateRef: kbsCompilation.claimCandidates[0].ref,
  sourceContextCandidateRef: kbsCompilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication: contextAdjudication(),
  reviewPrincipal: kbsReviewer,
  authorizationDecisionAuditRef: kbsReviewAuthorization.ref,
  claimLogicalId: 'claim.real-kbs-target-incompatibility.two-day-trigger',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-kbs-target-incompatibility.two-day-trigger',
  sourceContextVersion: '1',
  audit: audit(kbsReviewer, 'kbs-source-faithful', '2026-08-30T14:17:00.000Z')
});

const kbsApprover = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-scientific-approver',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const kbsApproverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.scientific-approver',
  version: '1',
  principal: kbsApprover,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(kbsApprover, 'kbs-approver-role', '2026-08-30T14:18:00.000Z')
});
const kbsQualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.real-kbs-target-incompatibility.qualification',
  version: '1',
  resourceId: qualificationResourceId(
    kbsReviewed.claim.ref,
    kbsReviewed.sourceContext.ref
  ),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: kbsApprover.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: 'org-a' }],
  audit: audit(kbsApprover, 'kbs-qualification-policy', '2026-08-30T14:19:00.000Z')
});
const kbsQualificationAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeQualification({
    principal: kbsApprover,
    policy: kbsQualificationPolicy,
    roleAssignments: [kbsApproverRole],
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit(
    'iam-engine',
    'kbs-qualification-authorization',
    '2026-08-30T14:20:00.000Z'
  )
});
const kbsQualification = new ScientificQualificationService({ ledger: env.ledger });
const kbsQualificationDecision = kbsQualification.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-kbs-target-incompatibility.two-day-trigger',
  decisionVersion: '1',
  claimRef: kbsReviewed.claim.ref,
  sourceContextRef: kbsReviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: [
    { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
    {
      semanticId: 'experiment.name',
      operator: 'EQUALS',
      value: 'Resource Gradient Experiment (N-rate Study)'
    }
  ],
  approverPrincipal: kbsApprover,
  authorizationDecisionAuditRef: kbsQualificationAuthorization.ref,
  audit: audit(kbsApprover, 'kbs-qualification', '2026-08-30T14:21:00.000Z')
});
const kbsKnowledge = kbsQualification.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-kbs-target-incompatibility.two-day-trigger',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [kbsQualificationDecision.ref],
  audit: audit(kbsApprover, 'kbs-qualified-knowledge', '2026-08-30T14:22:00.000Z')
});
assert.deepEqual(
  kbsKnowledge.semanticPayload.semanticPreconditions,
  [
    { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
    {
      semanticId: 'experiment.name',
      operator: 'EQUALS',
      value: 'Resource Gradient Experiment (N-rate Study)'
    }
  ]
);
assert.deepEqual(kbsKnowledge.semanticPayload.allowedUses, [
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
]);

// ---------------------------------------------------------------------------
// 3. Release real KBS knowledge under a TEST_ONLY runtime deployment whose use
//    purpose exactly matches its qualified scientific use.
// ---------------------------------------------------------------------------

const releaseManager = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-release-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const releaseManagerRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'real-kbs-target-incompatibility-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-manager-role')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.real-kbs-target-incompatibility.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(kbsKnowledge.ref),
  ownership: kbsKnowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: audit(releaseManager, 'release-policy')
});
const releaseDecision = authorizeKnowledgeRelease({
  principal: releaseManager,
  policy: releasePolicy,
  roleAssignments: [releaseManagerRole],
  releaseTarget: RELEASE_TARGET
});
assert.equal(releaseDecision.allowed, true);
const releaseAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: releaseDecision,
  audit: serviceAudit('iam-engine', 'release-authorization')
});
const release = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
  logicalId: 'release.real-kbs-target-incompatibility',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: kbsKnowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuthorization.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publication')
}).release;

const profileManager = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-profile-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const profileManagerRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'real-kbs-target-incompatibility-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'RUNTIME_PROFILE'
  },
  audit: audit(profileManager, 'profile-manager-role')
});
const profileLogicalId = 'runtime-profile.real-kbs-target-incompatibility';
const profileAuthorizationDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileManagerRole],
  authorizationScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'RUNTIME_PROFILE',
    resourceId: profileLogicalId
  }
});
assert.equal(profileAuthorizationDecision.allowed, true);
const profileAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: profileAuthorizationDecision,
  audit: serviceAudit('iam-engine', 'profile-authorization')
});
const profile = publishRuntimeProfile({
  ledger: env.ledger,
  logicalId: profileLogicalId,
  version: '1',
  profile: {
    contractVersion: RUNTIME_PROFILE_CONTRACT_VERSION,
    controlScope: OWNERSHIP,
    knowledgeReleaseRef: release.ref,
    contextRequirements: {
      requiredSemanticIds: ['crop.planting_date'],
      epistemicConstraints: {
        'crop.planting_date': ['ASSERTION']
      }
    },
    replayRequirement: { minimum: 'EXACT' },
    runtimeGovernance: {
      allowedDecisionAuthorityModes: ['RUNTIME_ONLY'],
      knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
      contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
      applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
    },
    allowedUseDeploymentConstraints: {
      usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
      useClasses: ['TEST_ONLY'],
      runtimeEnvironments: ['STAGING'],
      rolloutStages: ['SHADOW']
    }
  },
  principal: profileManager,
  authorizationDecisionAuditRef: profileAuthorization.ref,
  audit: audit(profileManager, 'profile-publication')
});
validateRuntimeProfileAuthority({ ledger: env.ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-deployment-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const deploymentManagerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-manager-role')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programId: 'pilot-a',
    regions: ['MACHINE_ACCEPTANCE_FIXTURE_REGION'],
    crops: ['MACHINE_ACCEPTANCE_FIXTURE_CROP'],
    decisionTypes: [DECISION_TYPE]
  },
  authorizedUse: {
    usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: {
    start: '2026-08-30T00:00:00.000Z',
    end: '2026-09-30T00:00:00.000Z'
  },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.real-kbs-target-incompatibility';
const deploymentAuthorizationDecision = authorizeDeploymentControl({
  principal: deploymentManager,
  roleAssignments: [deploymentManagerRole],
  authorizationScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programId: 'pilot-a',
    resourceType: 'DEPLOYMENT',
    resourceId: deploymentLogicalId
  },
  action: 'PUBLISH',
  production: false
});
assert.equal(deploymentAuthorizationDecision.allowed, true);
const deploymentAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: deploymentAuthorizationDecision,
  audit: serviceAudit('iam-engine', 'deployment-authorization')
});
const deployment = publishDeployment({
  ledger: env.ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuthorization.ref,
  audit: audit(deploymentManager, 'deployment-publication')
});
validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 'real-kbs-target-incompatibility-runtime-service',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-kbs-target-incompatibility.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role')
});
const runtimeAuthorizationDecision = authorizeDeploymentRuntimeRead({
  principal: runtimePrincipal,
  roleAssignments: [runtimeRole],
  authorizationScope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programId: 'pilot-a',
    resourceType: 'DEPLOYMENT',
    resourceId: deployment.ref.logicalId
  }
});
assert.equal(runtimeAuthorizationDecision.allowed, true);
const runtimeAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: runtimeAuthorizationDecision,
  audit: serviceAudit('iam-engine', 'runtime-authorization')
});

// ---------------------------------------------------------------------------
// 4. A08 must reject target applicability only because the exact KBS material
//    conditions are absent from the exact Sustainable Corn ContextManifest.
// ---------------------------------------------------------------------------

const retrieval = executeKnowledgeRetrieval({
  ledger: env.ledger,
  logicalId: 'retrieval.real-kbs-target-incompatibility',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuthorization.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publication')
});
const retrievalValidated = validateKnowledgeRetrievalResult({
  ledger: env.ledger,
  knowledgeRetrievalResultRef: retrieval.ref
});
assert.deepEqual(retrievalValidated.semanticPayload.candidateRefs, [kbsKnowledge.ref]);
assert.equal(
  retrievalValidated.semanticPayload.querySemantics.usePurpose,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use
);

const applicability = assessKnowledgeApplicability({
  ledger: env.ledger,
  logicalId: 'applicability.real-kbs-target-incompatibility',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: kbsKnowledge.ref,
  contextManifestRef: manifest.ref,
  audit: audit(runtimePrincipal, 'applicability-publication')
});
const applicabilityValidated = validateApplicabilityAssessment({
  ledger: env.ledger,
  applicabilityAssessmentRef: applicability.ref
});
assert.equal(applicabilityValidated.semanticPayload.scientificUseStatus, 'QUALIFIED');
assert.equal(applicabilityValidated.semanticPayload.transportStatus, 'UNRESOLVED');
assert.equal(applicabilityValidated.semanticPayload.runtimeUse, 'BLOCKED');
assert.deepEqual(
  applicabilityValidated.semanticPayload.missingContextSemanticIds,
  EXPECTED_MISSING
);
assert.equal(applicabilityValidated.semanticPayload.conflicts.length, 0);
for (const semanticId of EXPECTED_MISSING) {
  const condition = applicabilityValidated.semanticPayload.conditionResults.find(
    (item) => item.semanticId === semanticId && item.source === 'SEMANTIC_PRECONDITION'
  );
  assert.ok(condition, `missing condition result for ${semanticId}`);
  assert.equal(condition.status, 'UNKNOWN');
  assert.equal(condition.disposition, 'UNRESOLVED');
  assert.equal(Object.prototype.hasOwnProperty.call(condition, 'target'), false);
}
assert.equal(
  applicabilityValidated.semanticPayload.conditionResults.some(
    (item) => item.semanticId === 'crop.planting_date'
  ),
  false
);

const plan = compileRuntimePlan({
  ledger: env.ledger,
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  runtimeProfileRef: profile.ref,
  contextManifestRef: manifest.ref,
  knowledgeRetrievalResultRef: retrieval.ref,
  applicabilityAssessmentRefs: [applicability.ref]
});
assert.equal(plan.alternativePaths.length, 1);
assert.equal(plan.alternativePaths[0].compilerState, 'BLOCKED_BY_APPLICABILITY');
const missingRequirements = plan.openRequirements
  .filter((item) => item.requirementType === 'MISSING_CONTEXT')
  .map((item) => item.semanticId)
  .sort();
assert.deepEqual(missingRequirements, EXPECTED_MISSING);
assert.equal(
  plan.openRequirements.some(
    (item) => item.requirementType === 'SCIENTIFIC_USE'
  ),
  false
);
assert.equal(
  plan.openRequirements.some(
    (item) => item.requirementType === 'APPLICABILITY_CONFLICT'
  ),
  false
);
assert.equal(
  plan.openRequirements.some(
    (item) => item.requirementType === 'APPLICABILITY_RUNTIME_DISPOSITION'
      && item.code === 'BLOCKED'
  ),
  true
);

const eligibility = publishRuntimeEligibility({
  ledger: env.ledger,
  logicalId: 'runtime-eligibility.real-kbs-target-incompatibility',
  version: '1',
  runtimePlan: plan,
  audit: audit(runtimePrincipal, 'runtime-eligibility-publication')
});
const eligibilityValidated = validateRuntimeEligibility({
  ledger: env.ledger,
  runtimeEligibilityRef: eligibility.ref
});
assert.equal(eligibilityValidated.semanticPayload.runtimeEligibility, 'INFORMATION_REQUIRED');
assert.equal(eligibilityValidated.semanticPayload.legalRuntimeCandidateCount, 0);
assert.equal(eligibilityValidated.semanticPayload.informationPendingCandidateCount, 1);
assert.equal(eligibilityValidated.semanticPayload.hardBlockedCandidateCount, 0);
assert.deepEqual(
  eligibilityValidated.semanticPayload.reasonCodes,
  ['DECISION_MATERIAL_INFORMATION_OPEN']
);
assert.equal(eligibilityValidated.semanticPayload.alternativeEvaluations.length, 1);
assert.equal(
  eligibilityValidated.semanticPayload.alternativeEvaluations[0].disposition,
  'INFORMATION_REQUIRED'
);
assert.equal(
  eligibilityValidated.semanticPayload.alternativeEvaluations[0].reasonCodes.length,
  0
);
assert.equal(
  eligibilityValidated.semanticPayload.informationRequirements.length,
  2
);

let bindingFailure;
try {
  publishRuntimeBinding({
    ledger: env.ledger,
    logicalId: 'runtime-binding.real-kbs-target-incompatibility',
    version: '1',
    runtimeEligibilityRef: eligibility.ref,
    selectedAlternativePathId: plan.alternativePaths[0].pathId,
    audit: audit(runtimePrincipal, 'runtime-binding-denied')
  });
} catch (error) {
  bindingFailure = error;
}
assert.ok(bindingFailure);
assert.equal(bindingFailure.code, 'RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE');

const records = env.ledger.exportSnapshot().records;
assert.equal(
  records.some(
    (record) => record.ref.kind === 'RuntimeBinding'
      && record.ref.logicalId === 'runtime-binding.real-kbs-target-incompatibility'
  ),
  false
);
const forbiddenKinds = new Set([
  'RuntimeResult',
  'RuntimeDatum',
  'RuntimeAlternativeSet',
  'DecisionRobustness',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome',
  'OutcomeEvaluation'
]);
const forbiddenRecords = records.filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'FIRST_REAL_KNOWLEDGE_REAL_TARGET_INCOMPATIBILITY_PROOF',
  classification: 'REAL_SOURCE_NEGATIVE_TARGET_COMPATIBILITY_TEST_ONLY',
  targetWorld: {
    source: 'SUSTAINABLE_CORN_SERF',
    sourceBackedFarmId: exactTargetId,
    decisionProblemRef: decision.ref,
    contextManifestRef: manifest.ref,
    contextDatumRef: validatedManifest.contextDatum.ref,
    contextSemanticIds: ['crop.planting_date'],
    datumAvailableAt: validatedManifest.contextDatum.semanticPayload.availableAt,
    evidenceCutoff: EVIDENCE_CUTOFF,
    logicalTime: LOGICAL_TIME,
    noLookaheadFixture: true
  },
  knowledgeWorld: {
    source: 'KBS_2015_RGE_IRRIGATION_PROTOCOL_PAGE_23',
    sourceArtifactHash: KBS_TRANSCRIPTION_HASH,
    qualifiedKnowledgeRef: kbsKnowledge.ref,
    qualifiedUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    semanticPreconditions: kbsKnowledge.semanticPayload.semanticPreconditions
  },
  applicability: {
    scientificUseStatus: applicabilityValidated.semanticPayload.scientificUseStatus,
    transportStatus: applicabilityValidated.semanticPayload.transportStatus,
    runtimeUse: applicabilityValidated.semanticPayload.runtimeUse,
    missingContextSemanticIds:
      applicabilityValidated.semanticPayload.missingContextSemanticIds,
    conflicts: applicabilityValidated.semanticPayload.conflicts
  },
  runtime: {
    runtimePlanId: plan.planId,
    runtimePlanHash: plan.planHash,
    compilerState: plan.alternativePaths[0].compilerState,
    runtimeEligibilityRef: eligibility.ref,
    runtimeEligibility: eligibilityValidated.semanticPayload.runtimeEligibility,
    d01FailureCode: bindingFailure.code
  },
  knowledgeBadClaim: false,
  targetIncompatibilityClaim: 'UNRESOLVED_MISSING_MATERIAL_CONTEXT_ONLY',
  cropStateInferredFromPlantingOccurrence: false,
  experimentIdentityInferredFromFarmOrProvider: false,
  runtimeBindingCreated: false,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false,
  genericRuntimeContractsModified: false,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
