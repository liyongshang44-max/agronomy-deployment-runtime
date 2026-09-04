import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { publishKnowledgeGovernancePolicy } from '../../packages/authorization/src/engine.mjs';
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
  ExactArtifactStore,
  SourceRegistry,
  sourceContentHash
} from '../../packages/source-registry/src/index.mjs';
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
import {
  publishRuntimeBinding,
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import {
  KBS_RGE_DECISION_TYPE,
  KBS_RGE_LOGICAL_TIME,
  KBS_RGE_TARGET_OWNERSHIP,
  buildKbsRgeIrrigationTargetWorld
} from './target-world.mjs';

const OWNERSHIP = KBS_RGE_TARGET_OWNERSHIP;
const RELEASE_TARGET = Object.freeze({ ...OWNERSHIP, programId: 'pilot-a' });
const EXPECTED_SOURCE_HASH = 'sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9';
const SOURCE_LOCATOR = 'current_agronomic_protocol.pdf#page=23';
const SOURCE_ASSERTION = 'When a negative plant available water value is observed for two consecutive days, an irrigation event is scheduled for the next day.';
const SOURCE_EVIDENCE = 'When a negative value is observed for two consecutive days, an irrigation event will be scheduled for the next day';
const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
  { semanticId: 'experiment.name', operator: 'EQUALS', value: 'Resource Gradient Experiment (N-rate Study)' }
]);

const world = buildKbsRgeIrrigationTargetWorld();
const { ledger, snapshotStore, decision, manifest, validatedDatums } = world;
const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-09-04T08:40:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-kbs-rge-runtime-v1-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type ?? 'USER', id: principal.principalId ?? principal.id },
    details: {
      suite: 'real-kbs-rge-irrigation-runtime-composition-v1',
      classification: 'REAL_SOURCE_RUNTIME_COMPOSITION_TEST_ONLY'
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
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
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
const contextAdjudication = Object.freeze({
  BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
  ENVIRONMENTAL: [{ semanticId: 'site.name', valueType: 'STRING' }],
  MANAGEMENT: [{ semanticId: 'experiment.name', valueType: 'STRING' }],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [],
  JURISDICTION_ECONOMIC: []
});

const sourceBytes = readFileSync(new URL('../gold-protocol-kbs-2015/kbs-2015-irrigation-page23.txt', import.meta.url));
assert.equal(sourceContentHash(sourceBytes), EXPECTED_SOURCE_HASH);
const source = sourceRegistry.registerSource({
  logicalId: 'source.real-kbs-rge-runtime-v1.protocol',
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
  originLocator: SOURCE_LOCATOR,
  metadata: { sourceDocument: 'current_agronomic_protocol.pdf', originalPdfPage: 23 },
  audit: audit({ type: 'USER', id: 'kbs-rge-runtime-source-curator' }, 'source', '2026-09-04T08:40:10.000Z')
});
const artifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.real-kbs-rge-runtime-v1.page23',
  version: '1',
  sourceRef: source.ref,
  bytes: sourceBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-irrigation-page23-whitespace-normalized-transcription-v1',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-26T15:30:00.000Z',
    locator: SOURCE_LOCATOR,
    metadata: {
      originalArtifactClass: 'USER_UPLOADED_PDF',
      originalPdfPage: 23,
      transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT'
    }
  },
  metadata: { originalPdfBytesRetainedByThisBenchmark: false, exactTranscriptionBytesRetained: true },
  audit: audit({ type: 'USER', id: 'kbs-rge-runtime-source-curator' }, 'artifact', '2026-09-04T08:40:20.000Z')
});
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.real-kbs-rge-runtime-v1',
  version: '1',
  compilerId: 'adr.real-kbs-rge-runtime-v1.curated',
  implementationVersion: '1',
  configuration: { sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE', locatorScheme: 'PDF_PAGE_TEXT_V1' },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'kbs-rge-runtime-compiler' }, 'compiler', '2026-09-04T08:40:30.000Z')
});
const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-kbs-rge-runtime-v1.two-day-trigger',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'two-day-trigger',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: SOURCE_ASSERTION,
      sourceLocator: locator(SOURCE_EVIDENCE),
      sourceContext: contextFamilies()
    }],
    runMetadata: { benchmark: 'REAL_KBS_RGE_IRRIGATION_RUNTIME_COMPOSITION_V1' }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'kbs-rge-runtime-compiler' }, 'compilation', '2026-09-04T08:41:00.000Z')
});

const reviewer = createPrincipal({ principalId: 'kbs-rge-runtime-v1-reviewer', type: 'USER', ...OWNERSHIP });
const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(reviewer, 'reviewer-role', '2026-09-04T08:41:10.000Z')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-rge-runtime-v1.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(reviewer, 'review-policy', '2026-09-04T08:41:20.000Z')
});
const reviewAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'review-auth', '2026-09-04T08:41:30.000Z')
});
const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
  reviewLogicalId: 'review.real-kbs-rge-runtime-v1.two-day-trigger',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.real-kbs-rge-runtime-v1.two-day-trigger',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-kbs-rge-runtime-v1.two-day-trigger',
  sourceContextVersion: '1',
  audit: audit(reviewer, 'source-faithful-review', '2026-09-04T08:42:00.000Z')
});

const approver = createPrincipal({ principalId: 'kbs-rge-runtime-v1-scientific-approver', type: 'USER', ...OWNERSHIP });
const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(approver, 'approver-role', '2026-09-04T08:42:10.000Z')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-rge-runtime-v1.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(approver, 'qualification-policy', '2026-09-04T08:42:20.000Z')
});
const qualificationAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeQualification({
    principal: approver,
    policy: qualificationPolicy,
    roleAssignments: [approverRole],
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'qualification-auth', '2026-09-04T08:42:30.000Z')
});
const qualificationService = new ScientificQualificationService({ ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-kbs-rge-runtime-v1.two-day-trigger',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: EXPECTED_PRECONDITIONS,
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit(approver, 'qualification', '2026-09-04T08:43:00.000Z')
});
const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-kbs-rge-runtime-v1.two-day-trigger',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit(approver, 'qualified-knowledge', '2026-09-04T08:43:10.000Z')
});
const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions
  .map((entry) => entry.value)
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(frozenPreconditions, [...EXPECTED_PRECONDITIONS].sort((a, b) => a.semanticId.localeCompare(b.semanticId)));
assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);

const releaseManager = createPrincipal({
  principalId: 'kbs-rge-runtime-v1-release-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const releaseRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'kbs-rge-runtime-v1-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role', '2026-09-04T08:43:20.000Z')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-rge-runtime-v1.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(knowledge.ref),
  ownership: knowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: audit(releaseManager, 'release-policy', '2026-09-04T08:43:30.000Z')
});
const releaseDecision = authorizeKnowledgeRelease({
  principal: releaseManager,
  policy: releasePolicy,
  roleAssignments: [releaseRole],
  releaseTarget: RELEASE_TARGET
});
assert.equal(releaseDecision.allowed, true);
const releaseAuth = recordAuthorizationDecision({
  ledger,
  decision: releaseDecision,
  audit: serviceAudit('iam-engine', 'release-auth', '2026-09-04T08:43:40.000Z')
});
const release = new KnowledgeReleaseService({ ledger }).publishRelease({
  logicalId: 'release.real-kbs-rge-runtime-v1',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: knowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuth.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publish', '2026-09-04T08:44:00.000Z')
}).release;

const profileManager = createPrincipal({
  principalId: 'kbs-rge-runtime-v1-profile-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const profileRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'kbs-rge-runtime-v1-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role', '2026-09-04T08:44:10.000Z')
});
const profileLogicalId = 'runtime-profile.real-kbs-rge-runtime-v1';
const profileDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE', resourceId: profileLogicalId }
});
assert.equal(profileDecision.allowed, true);
const profileAuth = recordAuthorizationDecision({
  ledger,
  decision: profileDecision,
  audit: serviceAudit('iam-engine', 'profile-auth', '2026-09-04T08:44:20.000Z')
});
const requiredSemanticIds = ['crop.code', 'experiment.name'];
const profile = publishRuntimeProfile({
  ledger,
  logicalId: profileLogicalId,
  version: '1',
  profile: {
    contractVersion: RUNTIME_PROFILE_CONTRACT_VERSION,
    controlScope: OWNERSHIP,
    knowledgeReleaseRef: release.ref,
    contextRequirements: {
      requiredSemanticIds,
      epistemicConstraints: Object.fromEntries(requiredSemanticIds.map((id) => [id, ['ASSERTION']]))
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
  audit: audit(profileManager, 'profile-publish', '2026-09-04T08:44:30.000Z')
});
validateRuntimeProfileAuthority({ ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 'kbs-rge-runtime-v1-deployment-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-role', '2026-09-04T08:44:40.000Z')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    ...RELEASE_TARGET,
    regions: ['KBS_MAIN_SITE'],
    crops: ['SOYBEAN'],
    decisionTypes: [KBS_RGE_DECISION_TYPE]
  },
  authorizedUse: {
    usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.real-kbs-rge-runtime-v1';
const deploymentDecision = authorizeDeploymentControl({
  principal: deploymentManager,
  roleAssignments: [deploymentRole],
  authorizationScope: { ...RELEASE_TARGET, resourceType: 'DEPLOYMENT', resourceId: deploymentLogicalId },
  action: 'PUBLISH',
  production: false
});
assert.equal(deploymentDecision.allowed, true);
const deploymentAuth = recordAuthorizationDecision({
  ledger,
  decision: deploymentDecision,
  audit: serviceAudit('iam-engine', 'deployment-auth', '2026-09-04T08:44:50.000Z')
});
const deployment = publishDeployment({
  ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuth.ref,
  audit: audit(deploymentManager, 'deployment-publish', '2026-09-04T08:45:00.000Z')
});
validateDeploymentAuthority({ ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 'kbs-rge-runtime-v1-runtime-service', type: 'SERVICE_ACCOUNT', ...OWNERSHIP, programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-rge-runtime-v1.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role', '2026-09-04T08:45:10.000Z')
});
const runtimeDecision = authorizeDeploymentRuntimeRead({
  principal: runtimePrincipal,
  roleAssignments: [runtimeRole],
  authorizationScope: { ...RELEASE_TARGET, resourceType: 'DEPLOYMENT', resourceId: deployment.ref.logicalId }
});
assert.equal(runtimeDecision.allowed, true);
const runtimeAuth = recordAuthorizationDecision({
  ledger,
  decision: runtimeDecision,
  audit: serviceAudit('iam-engine', 'runtime-auth', '2026-09-04T08:45:20.000Z')
});

const retrieval = executeKnowledgeRetrieval({
  ledger,
  logicalId: 'retrieval.real-kbs-rge-runtime-v1',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish', '2026-09-04T08:46:00.000Z')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: retrieval.ref });
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs, [knowledge.ref]);

const applicability = assessKnowledgeApplicability({
  ledger,
  logicalId: 'applicability.real-kbs-rge-runtime-v1',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: knowledge.ref,
  contextManifestRef: manifest.ref,
  snapshotStore,
  audit: audit(runtimePrincipal, 'applicability-publish', '2026-09-04T08:47:00.000Z')
});
const validatedApplicability = validateApplicabilityAssessment({
  ledger,
  applicabilityAssessmentRef: applicability.ref,
  snapshotStore
});
assert.equal(validatedApplicability.semanticPayload.scientificUseStatus, 'QUALIFIED');
assert.equal(validatedApplicability.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
assert.equal(validatedApplicability.semanticPayload.runtimeUse, 'ALLOWED');
assert.deepEqual(validatedApplicability.semanticPayload.missingContextSemanticIds, []);
assert.deepEqual(validatedApplicability.semanticPayload.conflicts, []);
assert.deepEqual(validatedApplicability.semanticPayload.unsupportedConstraintCodes, []);
assert.equal(validatedApplicability.semanticPayload.conditionResults.length, 2);
for (const expected of EXPECTED_PRECONDITIONS) {
  const condition = validatedApplicability.semanticPayload.conditionResults.find(
    (item) => item.source === 'SEMANTIC_PRECONDITION' && item.semanticId === expected.semanticId
  );
  assert.ok(condition, `missing A08 condition result for ${expected.semanticId}`);
  assert.equal(condition.status, 'MATCH');
  assert.equal(condition.disposition, 'MATCH');
}

const targetIndex = Object.fromEntries(validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload.value]));
assert.deepEqual(targetIndex['crop.code'], { type: 'CATEGORY', category: 'soybean' });
assert.deepEqual(targetIndex['experiment.name'], { type: 'STRING', string: 'Resource Gradient Experiment (N-rate Study)' });
assert.equal('plant_available_water' in targetIndex, false);
assert.ok(new Date(KBS_RGE_LOGICAL_TIME) > new Date(world.validatedManifest.semanticPayload.evidenceCutoff));

const plan = compileRuntimePlan({
  ledger,
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  runtimeProfileRef: profile.ref,
  contextManifestRef: manifest.ref,
  knowledgeRetrievalResultRef: retrieval.ref,
  applicabilityAssessmentRefs: [applicability.ref],
  snapshotStore
});

const eligibility = publishRuntimeEligibility({
  ledger,
  logicalId: 'runtime-eligibility.real-kbs-rge-runtime-v1',
  version: '1',
  runtimePlan: plan,
  snapshotStore,
  audit: audit(runtimePrincipal, 'runtime-eligibility-publish', '2026-09-04T08:48:00.000Z')
});
const validatedEligibility = validateRuntimeEligibility({
  ledger,
  runtimeEligibilityRef: eligibility.ref,
  snapshotStore
});

let binding = null;
let validatedBinding = null;
let bindingFailure = null;
if (validatedEligibility.semanticPayload.runtimeEligibility === 'RUNTIME_ELIGIBLE') {
  const legalPath = validatedEligibility.semanticPayload.alternativeEvaluations.find((item) => item.disposition === 'LEGAL');
  assert.ok(legalPath);
  binding = publishRuntimeBinding({
    ledger,
    logicalId: 'runtime-binding.real-kbs-rge-runtime-v1',
    version: '1',
    runtimeEligibilityRef: eligibility.ref,
    selectedAlternativePathId: legalPath.pathId,
    snapshotStore,
    audit: audit(runtimePrincipal, 'runtime-binding-publish', '2026-09-04T08:49:00.000Z')
  });
  validatedBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: binding.ref });
  assert.equal(validatedBinding.semanticPayload.contextManifestRef.semanticHash, manifest.ref.semanticHash);
  assert.equal(validatedBinding.semanticPayload.decisionProblemRef.semanticHash, decision.ref.semanticHash);
  assert.equal(validatedBinding.semanticPayload.knowledgeReleaseRef.semanticHash, release.ref.semanticHash);
  assert.equal(validatedBinding.semanticPayload.logicalTime, new Date(KBS_RGE_LOGICAL_TIME).toISOString());
  assert.deepEqual(validatedBinding.semanticPayload.knowledgeBindings, [{
    knowledgeRef: knowledge.ref,
    applicabilityAssessmentRef: applicability.ref
  }]);
} else {
  try {
    publishRuntimeBinding({
      ledger,
      logicalId: 'runtime-binding.real-kbs-rge-runtime-v1.denied',
      version: '1',
      runtimeEligibilityRef: eligibility.ref,
      selectedAlternativePathId: plan.alternativePaths[0]?.pathId ?? 'NO_PATH',
      snapshotStore,
      audit: audit(runtimePrincipal, 'runtime-binding-denied', '2026-09-04T08:49:00.000Z')
    });
  } catch (error) {
    bindingFailure = error;
  }
  assert.ok(bindingFailure);
}

const records = ledger.exportSnapshot().records;
const forbiddenKinds = new Set([
  'RuntimeResult', 'RuntimeDatum', 'RuntimeAlternativeSet', 'DecisionRobustness',
  'DecisionResult', 'ExecutionReceipt', 'Outcome', 'OutcomeEvaluation'
]);
assert.equal(records.filter((record) => forbiddenKinds.has(record.ref.kind)).length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_IRRIGATION_A08_R01_R03_D01_CHALLENGE',
  classification: 'RETROSPECTIVE_REAL_SOURCE_RUNTIME_COMPOSITION_TEST_ONLY',
  targetWorld: {
    source: 'KBS_PUBLIC_RGE_TARGET_CONTEXT_ADAPTER',
    decisionProblemRef: decision.ref,
    contextManifestRef: manifest.ref,
    contextSemanticIds: requiredSemanticIds,
    replayClass: world.validatedManifest.semanticPayload.replayClass,
    targetRefPromotedToFarmFieldOrZone: false,
    waterOrTriggerContextFabricated: false,
    logicalTime: new Date(KBS_RGE_LOGICAL_TIME).toISOString(),
    evidenceCutoff: world.validatedManifest.semanticPayload.evidenceCutoff
  },
  knowledgeWorld: {
    source: 'KBS_2015_RGE_IRRIGATION_PROTOCOL_PAGE_23',
    sourceArtifactHash: EXPECTED_SOURCE_HASH,
    qualifiedKnowledgeRef: knowledge.ref,
    knowledgeReleaseRef: release.ref,
    semanticPreconditions: frozenPreconditions
  },
  applicability: {
    assessmentRef: applicability.ref,
    scientificUseStatus: validatedApplicability.semanticPayload.scientificUseStatus,
    transportStatus: validatedApplicability.semanticPayload.transportStatus,
    runtimeUse: validatedApplicability.semanticPayload.runtimeUse,
    missingContextSemanticIds: validatedApplicability.semanticPayload.missingContextSemanticIds
  },
  runtimePlan: {
    runtimePlanId: plan.runtimePlanId ?? plan.planId,
    runtimePlanHash: plan.runtimePlanHash ?? plan.planHash,
    openRequirements: plan.openRequirements,
    alternativePathCount: plan.alternativePaths.length,
    compilerStates: plan.alternativePaths.map((item) => item.compilerState)
  },
  runtimeEligibility: {
    runtimeEligibilityRef: eligibility.ref,
    disposition: validatedEligibility.semanticPayload.runtimeEligibility,
    reasonCodes: validatedEligibility.semanticPayload.reasonCodes,
    informationRequirements: validatedEligibility.semanticPayload.informationRequirements,
    legalAlternativeCount: validatedEligibility.semanticPayload.alternativeEvaluations.filter((item) => item.disposition === 'LEGAL').length
  },
  runtimeBinding: binding ? {
    runtimeBindingRef: binding.ref,
    selectedAlternativePathId: validatedBinding.semanticPayload.selectedAlternativePathId,
    knowledgeBindings: validatedBinding.semanticPayload.knowledgeBindings,
    correctnessClaim: validatedBinding.semanticPayload.correctnessClaim
  } : {
    created: false,
    denialCode: bindingFailure?.code ?? null
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));
