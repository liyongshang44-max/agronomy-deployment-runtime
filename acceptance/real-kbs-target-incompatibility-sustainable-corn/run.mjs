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
const KBS_HASH = 'sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9';
const KBS_LOCATOR = 'current_agronomic_protocol.pdf#page=23';
const CUTOFF = '2026-08-30T14:00:00.000Z';
const LOGICAL_TIME = '2026-08-31T00:00:00.000Z';
const DEADLINE = '2026-08-31T12:00:00.000Z';
const DECISION_TYPE = 'MACHINE_ACCEPTANCE_KBS_TARGET_INCOMPATIBILITY';
const EXPECTED_MISSING = ['crop.code', 'experiment.name'];

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-08-31T00:05:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-kbs-target-incompatibility-${seq}-${suffix}`,
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
    coordinates: { page: 23, evidenceText }
  };
}
function contextFamilies() {
  const families = Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [
    family,
    { status: 'NOT_REPORTED', dimensions: [] }
  ]));
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
const contextAdjudication = {
  BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
  ENVIRONMENTAL: [{ semanticId: 'site.name', valueType: 'STRING' }],
  MANAGEMENT: [{ semanticId: 'experiment.name', valueType: 'STRING' }],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [],
  JURISDICTION_ECONOMIC: []
};

// Build a no-lookahead Sustainable Corn target world whose scientific use matches KBS.
const decisionCreator = createPrincipal({
  principalId: 'kbs-incompat-decision-creator',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const decisionRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.decision-creator',
  version: '1',
  principal: decisionCreator,
  role: 'DECISION_PROBLEM_CREATOR',
  roleDefinitionVersion: 'kbs-incompat-v1',
  permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
  scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'DECISION_PROBLEM' },
  audit: audit(decisionCreator, 'decision-role')
});
const decisionLogicalId = 'dp.real-kbs-target-incompatibility.sustainable-corn';
const decisionAuthDecision = authorizeDecisionProblemCreation({
  principal: decisionCreator,
  roleAssignments: [decisionRole],
  authorizationScope: {
    organizationId: 'org-a', tenantId: 'tenant-a',
    resourceType: 'DECISION_PROBLEM', resourceId: decisionLogicalId
  }
});
assert.equal(decisionAuthDecision.allowed, true);
const decisionAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: decisionAuthDecision,
  audit: serviceAudit('iam-engine', 'decision-auth')
});
const decision = publishAgronomicDecisionProblemWithFarmTargetBinding({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  farmTargetBindingCompilationRef: decisionWorld.validated.bindingCompilation.ref,
  logicalId: decisionLogicalId,
  version: '1',
  deploymentScope: OWNERSHIP,
  decisionIntent: {
    decisionType: DECISION_TYPE,
    logicalTime: LOGICAL_TIME,
    decisionHorizon: { duration: 'PT24H' },
    objective: { code: 'MACHINE_ACCEPTANCE_TARGET_COMPATIBILITY_ONLY' },
    actionSpace: ['MACHINE_ACCEPTANCE_FIXTURE_ACTION_A', 'MACHINE_ACCEPTANCE_FIXTURE_ACTION_B'],
    constraints: [],
    usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    useClass: 'TEST_ONLY',
    decisionAuthorityMode: 'RUNTIME_ONLY',
    decisionDeadline: DEADLINE
  },
  principal: decisionCreator,
  authorizationDecisionAuditRef: decisionAuth.ref,
  audit: audit(decisionCreator, 'decision-publish')
});
const validatedDecision = validateAgronomicDecisionProblemFarmTargetPublicationAuthority({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  decisionProblemRef: decision.ref
});
assert.deepEqual(validatedDecision.semanticPayload.targetRef, {
  organizationId: 'org-a', tenantId: 'tenant-a', farmId: exactTargetId
});
assert.equal(validatedDecision.semanticPayload.usePurpose, AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use);
assert.equal(validatedDecision.semanticPayload.logicalTime, LOGICAL_TIME);

const manifestWriter = createPrincipal({
  principalId: 'kbs-incompat-manifest-writer',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a', tenantId: 'tenant-a'
});
const manifestRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.manifest-writer',
  version: '1',
  principal: manifestWriter,
  role: 'CONTEXT_MANIFEST_WRITER',
  roleDefinitionVersion: 'kbs-incompat-v1',
  permissions: [PERMISSIONS.CONTEXT_WRITE],
  scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_MANIFEST' },
  audit: audit(manifestWriter, 'manifest-role')
});
const manifestLogicalId = 'cm.real-kbs-target-incompatibility.sustainable-corn';
const manifestAuthDecision = authorizeContextWrite({
  principal: manifestWriter,
  roleAssignments: [manifestRole],
  authorizationScope: {
    organizationId: 'org-a', tenantId: 'tenant-a',
    resourceType: 'CONTEXT_MANIFEST', resourceId: manifestLogicalId
  }
});
assert.equal(manifestAuthDecision.allowed, true);
const manifestAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: manifestAuthDecision,
  audit: serviceAudit('iam-engine', 'manifest-auth')
});
const manifest = publishAgronomicContextManifestFromGovernedWorld({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  timezoneRuleEvidence: historicalTimezoneRuleEvidence,
  decisionProblemRef: decision.ref,
  contextDatumRef: validatedManifest.contextDatum.ref,
  evidenceCutoff: CUTOFF,
  logicalId: manifestLogicalId,
  version: '1',
  principal: manifestWriter,
  authorizationDecisionAuditRef: manifestAuth.ref,
  audit: audit(manifestWriter, 'manifest-publish')
});
const validatedTarget = validateAgronomicContextManifestGovernedWorldAuthority({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  timezoneRuleEvidence: historicalTimezoneRuleEvidence,
  contextManifestRef: manifest.ref
});
assert.equal(validatedTarget.sourceBackedFarmId, exactTargetId);
assert.deepEqual(validatedTarget.manifest.semanticPayload.datumRefs, [validatedManifest.contextDatum.ref]);
assert.equal(validatedTarget.manifest.semanticPayload.evidenceCutoff, CUTOFF);
assert.equal(validatedTarget.manifest.semanticPayload.logicalTime, LOGICAL_TIME);
assert.ok(new Date(validatedTarget.contextDatum.semanticPayload.availableAt) <= new Date(CUTOFF));
assert.ok(new Date(CUTOFF) < new Date(LOGICAL_TIME));

// Compile one real KBS 2015 source-faithful QualifiedKnowledge into this same ledger.
const kbsBytes = readFileSync(new URL('../gold-protocol-kbs-2015/kbs-2015-irrigation-page23.txt', import.meta.url));
assert.equal(sourceContentHash(kbsBytes), KBS_HASH);
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
  originLocator: KBS_LOCATOR,
  metadata: { sourceDocument: 'current_agronomic_protocol.pdf', originalPdfPage: 23 },
  audit: audit({ principalId: 'kbs-source-curator', type: 'USER' }, 'kbs-source', '2026-08-30T14:10:00.000Z')
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
    locator: KBS_LOCATOR,
    metadata: {
      originalArtifactClass: 'USER_UPLOADED_PDF', originalPdfPage: 23,
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: { originalPdfBytesRetainedByThisBenchmark: false, exactTranscriptionBytesRetained: true },
  audit: audit({ principalId: 'kbs-source-curator', type: 'USER' }, 'kbs-artifact', '2026-08-30T14:11:00.000Z')
});
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger: env.ledger,
  logicalId: 'compiler.real-kbs-target-incompatibility',
  version: '1',
  compilerId: 'adr.real-kbs-target-incompatibility.curated',
  implementationVersion: '1',
  configuration: { sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE', locatorScheme: 'PDF_PAGE_TEXT_V1' },
  audit: audit({ principalId: 'kbs-compiler', type: 'SERVICE_ACCOUNT' }, 'kbs-compiler', '2026-08-30T14:12:00.000Z')
});
const compiler = new ScientificCompiler({ ledger: env.ledger, sourceRegistry: env.sourceRegistry });
const compilation = compiler.materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-kbs-target-incompatibility.two-day-trigger',
  version: '1',
  sourceArtifactRef: kbsArtifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'two-day-trigger',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: 'When a negative plant available water value is observed for two consecutive days, an irrigation event is scheduled for the next day.',
      sourceLocator: locator('When a negative value is observed for two consecutive days, an irrigation event will be scheduled for the next day'),
      sourceContext: contextFamilies()
    }],
    runMetadata: { benchmark: 'REAL_KBS_2015_TARGET_INCOMPATIBILITY_V1' }
  },
  audit: audit({ principalId: 'kbs-compiler', type: 'SERVICE_ACCOUNT' }, 'kbs-compilation', '2026-08-30T14:13:00.000Z')
});
const reviewer = createPrincipal({
  principalId: 'kbs-incompat-reviewer', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(reviewer, 'reviewer-role', '2026-08-30T14:14:00.000Z')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.kbs-incompat.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(kbsSource.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: 'org-a' }],
  audit: audit(reviewer, 'review-policy', '2026-08-30T14:15:00.000Z')
});
const reviewAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'review-auth', '2026-08-30T14:16:00.000Z')
});
const reviewed = new SourceFaithfulReviewService({ ledger: env.ledger }).reviewCandidate({
  reviewLogicalId: 'review.real-kbs-target-incompatibility.two-day-trigger',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.real-kbs-target-incompatibility.two-day-trigger',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-kbs-target-incompatibility.two-day-trigger',
  sourceContextVersion: '1',
  audit: audit(reviewer, 'source-faithful-review', '2026-08-30T14:17:00.000Z')
});
const approver = createPrincipal({
  principalId: 'kbs-incompat-scientific-approver', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
const approverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(approver, 'approver-role', '2026-08-30T14:18:00.000Z')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.kbs-incompat.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: 'org-a' }],
  audit: audit(approver, 'qualification-policy', '2026-08-30T14:19:00.000Z')
});
const qualificationAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: authorizeKnowledgeQualification({
    principal: approver,
    policy: qualificationPolicy,
    roleAssignments: [approverRole],
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'qualification-auth', '2026-08-30T14:20:00.000Z')
});
const qualificationService = new ScientificQualificationService({ ledger: env.ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-kbs-target-incompatibility.two-day-trigger',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: [
    { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
    { semanticId: 'experiment.name', operator: 'EQUALS', value: 'Resource Gradient Experiment (N-rate Study)' }
  ],
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit(approver, 'qualification', '2026-08-30T14:21:00.000Z')
});
const kbsKnowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-kbs-target-incompatibility.two-day-trigger',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit(approver, 'qualified-knowledge', '2026-08-30T14:22:00.000Z')
});
const frozenPreconditions = kbsKnowledge.semanticPayload.semanticPreconditions
  .map((entry) => {
    assert.deepEqual(entry.qualificationDecisionRef, qualificationDecision.ref);
    return entry.value;
  })
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(frozenPreconditions, [
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
  { semanticId: 'experiment.name', operator: 'EQUALS', value: 'Resource Gradient Experiment (N-rate Study)' }
]);
assert.deepEqual(kbsKnowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);

// Freeze the real QK into a TEST_ONLY KnowledgeRelease / RuntimeProfile / Deployment.
const releaseManager = createPrincipal({
  principalId: 'kbs-incompat-release-manager', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a', programIds: ['pilot-a']
});
const releaseRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'kbs-incompat-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.kbs-incompat.release-member',
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
  roleAssignments: [releaseRole],
  releaseTarget: RELEASE_TARGET
});
assert.equal(releaseDecision.allowed, true);
const releaseAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: releaseDecision,
  audit: serviceAudit('iam-engine', 'release-auth')
});
const release = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
  logicalId: 'release.real-kbs-target-incompatibility',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: kbsKnowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuth.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publish')
}).release;

const profileManager = createPrincipal({
  principalId: 'kbs-incompat-profile-manager', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a', programIds: ['pilot-a']
});
const profileRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'kbs-incompat-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role')
});
const profileLogicalId = 'runtime-profile.real-kbs-target-incompatibility';
const profileAuthDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileRole],
  authorizationScope: {
    organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'RUNTIME_PROFILE', resourceId: profileLogicalId
  }
});
assert.equal(profileAuthDecision.allowed, true);
const profileAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: profileAuthDecision,
  audit: serviceAudit('iam-engine', 'profile-auth')
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
      epistemicConstraints: { 'crop.planting_date': ['ASSERTION'] }
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
  authorizationDecisionAuditRef: profileAuth.ref,
  audit: audit(profileManager, 'profile-publish')
});
validateRuntimeProfileAuthority({ ledger: env.ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 'kbs-incompat-deployment-manager', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a', programIds: ['pilot-a']
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-role')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a',
    regions: ['MACHINE_ACCEPTANCE_FIXTURE_REGION'],
    crops: ['MACHINE_ACCEPTANCE_FIXTURE_CROP'],
    decisionTypes: [DECISION_TYPE]
  },
  authorizedUse: {
    usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: { start: '2026-08-30T00:00:00.000Z', end: '2026-09-30T00:00:00.000Z' },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.real-kbs-target-incompatibility';
const deploymentAuthDecision = authorizeDeploymentControl({
  principal: deploymentManager,
  roleAssignments: [deploymentRole],
  authorizationScope: {
    organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a',
    resourceType: 'DEPLOYMENT', resourceId: deploymentLogicalId
  },
  action: 'PUBLISH',
  production: false
});
assert.equal(deploymentAuthDecision.allowed, true);
const deploymentAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: deploymentAuthDecision,
  audit: serviceAudit('iam-engine', 'deployment-auth')
});
const deployment = publishDeployment({
  ledger: env.ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuth.ref,
  audit: audit(deploymentManager, 'deployment-publish')
});
validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 'kbs-incompat-runtime-service', type: 'SERVICE_ACCOUNT', organizationId: 'org-a', tenantId: 'tenant-a', programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.kbs-incompat.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role')
});
const runtimeAuthDecision = authorizeDeploymentRuntimeRead({
  principal: runtimePrincipal,
  roleAssignments: [runtimeRole],
  authorizationScope: {
    organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a',
    resourceType: 'DEPLOYMENT', resourceId: deployment.ref.logicalId
  }
});
assert.equal(runtimeAuthDecision.allowed, true);
const runtimeAuth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision: runtimeAuthDecision,
  audit: serviceAudit('iam-engine', 'runtime-auth')
});

// Existing runtime contracts must preserve the source-target incompatibility.
const retrieval = executeKnowledgeRetrieval({
  ledger: env.ledger,
  logicalId: 'retrieval.real-kbs-target-incompatibility',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({
  ledger: env.ledger,
  knowledgeRetrievalResultRef: retrieval.ref
});
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs, [kbsKnowledge.ref]);
assert.equal(validatedRetrieval.semanticPayload.querySemantics.usePurpose, AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use);

const applicability = assessKnowledgeApplicability({
  ledger: env.ledger,
  logicalId: 'applicability.real-kbs-target-incompatibility',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: kbsKnowledge.ref,
  contextManifestRef: manifest.ref,
  audit: audit(runtimePrincipal, 'applicability-publish')
});
const validatedApplicability = validateApplicabilityAssessment({
  ledger: env.ledger,
  applicabilityAssessmentRef: applicability.ref
});
assert.equal(validatedApplicability.semanticPayload.scientificUseStatus, 'QUALIFIED');
assert.equal(validatedApplicability.semanticPayload.transportStatus, 'UNRESOLVED');
assert.equal(validatedApplicability.semanticPayload.runtimeUse, 'BLOCKED');
assert.deepEqual(validatedApplicability.semanticPayload.missingContextSemanticIds, EXPECTED_MISSING);
assert.deepEqual(validatedApplicability.semanticPayload.conflicts, []);
for (const semanticId of EXPECTED_MISSING) {
  const condition = validatedApplicability.semanticPayload.conditionResults.find(
    (item) => item.source === 'SEMANTIC_PRECONDITION' && item.semanticId === semanticId
  );
  assert.ok(condition);
  assert.equal(condition.status, 'UNKNOWN');
  assert.equal(condition.disposition, 'UNRESOLVED');
  assert.equal(Object.hasOwn(condition, 'target'), false);
}
assert.equal(
  validatedApplicability.semanticPayload.conditionResults.some((item) => item.semanticId === 'crop.planting_date'),
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
assert.deepEqual(
  plan.openRequirements.filter((item) => item.requirementType === 'MISSING_CONTEXT')
    .map((item) => item.semanticId).sort(),
  EXPECTED_MISSING
);
assert.equal(plan.openRequirements.some((item) => item.requirementType === 'SCIENTIFIC_USE'), false);
assert.equal(plan.openRequirements.some((item) => item.requirementType === 'APPLICABILITY_CONFLICT'), false);

const eligibility = publishRuntimeEligibility({
  ledger: env.ledger,
  logicalId: 'runtime-eligibility.real-kbs-target-incompatibility',
  version: '1',
  runtimePlan: plan,
  audit: audit(runtimePrincipal, 'eligibility-publish')
});
const validatedEligibility = validateRuntimeEligibility({
  ledger: env.ledger,
  runtimeEligibilityRef: eligibility.ref
});
assert.equal(validatedEligibility.semanticPayload.runtimeEligibility, 'INFORMATION_REQUIRED');
assert.equal(validatedEligibility.semanticPayload.legalRuntimeCandidateCount, 0);
assert.equal(validatedEligibility.semanticPayload.informationPendingCandidateCount, 1);
assert.equal(validatedEligibility.semanticPayload.hardBlockedCandidateCount, 0);
assert.deepEqual(validatedEligibility.semanticPayload.reasonCodes, ['DECISION_MATERIAL_INFORMATION_OPEN']);
assert.equal(validatedEligibility.semanticPayload.informationRequirements.length, 2);
assert.equal(validatedEligibility.semanticPayload.alternativeEvaluations.length, 1);
assert.equal(validatedEligibility.semanticPayload.alternativeEvaluations[0].disposition, 'INFORMATION_REQUIRED');
assert.deepEqual(validatedEligibility.semanticPayload.alternativeEvaluations[0].reasonCodes, []);

let bindingFailure;
try {
  publishRuntimeBinding({
    ledger: env.ledger,
    logicalId: 'runtime-binding.real-kbs-target-incompatibility',
    version: '1',
    runtimeEligibilityRef: eligibility.ref,
    selectedAlternativePathId: plan.alternativePaths[0].pathId,
    audit: audit(runtimePrincipal, 'binding-denied')
  });
} catch (error) {
  bindingFailure = error;
}
assert.ok(bindingFailure);
assert.equal(bindingFailure.code, 'RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE');

const records = env.ledger.exportSnapshot().records;
assert.equal(records.some((record) =>
  record.ref.kind === 'RuntimeBinding'
    && record.ref.logicalId === 'runtime-binding.real-kbs-target-incompatibility'), false);
const forbiddenKinds = new Set([
  'RuntimeResult', 'RuntimeDatum', 'RuntimeAlternativeSet', 'DecisionRobustness',
  'DecisionResult', 'ExecutionReceipt', 'Outcome', 'OutcomeEvaluation'
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
    evidenceCutoff: CUTOFF,
    logicalTime: LOGICAL_TIME,
    noLookaheadFixture: true
  },
  knowledgeWorld: {
    source: 'KBS_2015_RGE_IRRIGATION_PROTOCOL_PAGE_23',
    sourceArtifactHash: KBS_HASH,
    qualifiedKnowledgeRef: kbsKnowledge.ref,
    qualifiedUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    semanticPreconditions: frozenPreconditions
  },
  applicability: {
    scientificUseStatus: validatedApplicability.semanticPayload.scientificUseStatus,
    transportStatus: validatedApplicability.semanticPayload.transportStatus,
    runtimeUse: validatedApplicability.semanticPayload.runtimeUse,
    missingContextSemanticIds: validatedApplicability.semanticPayload.missingContextSemanticIds,
    conflicts: validatedApplicability.semanticPayload.conflicts
  },
  runtime: {
    runtimePlanId: plan.planId,
    runtimePlanHash: plan.planHash,
    compilerState: plan.alternativePaths[0].compilerState,
    runtimeEligibilityRef: eligibility.ref,
    runtimeEligibility: validatedEligibility.semanticPayload.runtimeEligibility,
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
