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
  PLANTING_DECISION_TYPE,
  PLANTING_LOGICAL_TIME,
  PLANTING_TARGET_OWNERSHIP,
  buildPlantingTargetWorld
} from './target-world.mjs';

const OWNERSHIP = PLANTING_TARGET_OWNERSHIP;
const RELEASE_TARGET = Object.freeze({ ...OWNERSHIP, programId: 'pilot-a' });
const EXPECTED_SOURCE_HASH = 'sha256:fd9d35b3d3dadc5ca1829e792689bb19690ed420efee101ddecf0f0082e3cc4d';
const SOURCE_LOCATOR = 'https://www.canr.msu.edu/news/soybean_planting_populations_affect_soybean_yields_and_profitability_in_mic';
const SOURCE_ASSERTION = 'For soybeans in 15-inch rows in Michigan, Michigan State University recommends a planting population of 150,000 seeds per acre.';
const SOURCE_EVIDENCE = '15 inches | 150,000';
const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
  { semanticId: 'jurisdiction.region', operator: 'EQUALS', value: 'michigan' },
  { semanticId: 'planting.row_spacing_in', operator: 'EQUALS', value: '15', unit: 'inch' }
]);

const world = buildPlantingTargetWorld();
const { ledger, snapshotStore, decision, manifest, validatedDatums } = world;
const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-09-04T10:00:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-planting-runtime-v1-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type ?? 'USER', id: principal.principalId ?? principal.id },
    details: {
      suite: 'real-kbs-soybean-planting-population-runtime-composition-v1',
      classification: 'REAL_SOURCE_RUNTIME_COMPOSITION_TEST_ONLY'
    }
  };
}
function serviceAudit(id, suffix, occurredAt) {
  return audit({ principalId: id, type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}
function locator(evidenceText, line) {
  return {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'TEXT_LINE_V1',
    coordinates: { line, evidenceText }
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
      sourceLocator: locator('Soybean planting populations affect soybean yields and profitability in Michigan', 1)
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'planting.row_spacing',
      valueCandidate: '15',
      unitCandidate: 'inch',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(SOURCE_EVIDENCE, 4)
    }]
  };
  families.JURISDICTION_ECONOMIC = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'jurisdiction.region',
      valueCandidate: 'michigan',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('Soybean planting populations affect soybean yields and profitability in Michigan', 1)
    }]
  };
  families.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: 'soybean planting population recommendation',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('Soybean planting population recommendations from Michigan State University', 2)
    }]
  };
  return families;
}
const contextAdjudication = Object.freeze({
  BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
  ENVIRONMENTAL: [],
  MANAGEMENT: [{ semanticId: 'planting.row_spacing_in', valueType: 'DECIMAL', unit: 'inch' }],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [],
  JURISDICTION_ECONOMIC: [{ semanticId: 'jurisdiction.region', valueType: 'CATEGORY' }]
});

const sourceBytes = readFileSync(new URL('./msu-soybean-planting-population-recommendation-excerpt.txt', import.meta.url));
assert.equal(sourceContentHash(sourceBytes), EXPECTED_SOURCE_HASH);
const source = sourceRegistry.registerSource({
  logicalId: 'source.real-msu-soybean-planting-population-v1',
  version: '1',
  sourceType: 'PUBLICATION',
  title: 'Soybean planting populations affect soybean yields and profitability in Michigan',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Michigan State University Extension',
    publicationDate: '2011-02-22'
  },
  sourceVersionLabel: '2011-02-22',
  originLocator: SOURCE_LOCATOR,
  metadata: {
    artifactClass: 'CURATED_OFFICIAL_WEB_EXCERPT',
    recommendationTableRow: '15 inches | 150,000'
  },
  audit: audit({ type: 'USER', id: 'planting-source-curator' }, 'source', '2026-09-04T10:00:10.000Z')
});
const artifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.real-msu-soybean-planting-population-v1.excerpt',
  version: '1',
  sourceRef: source.ref,
  bytes: sourceBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'msu-extension-soybean-planting-population-curated-official-web-excerpt-v1',
  acquisition: {
    method: 'CURATED_OFFICIAL_WEB_EXCERPT',
    acquiredAt: '2026-09-04T09:55:00.000Z',
    locator: SOURCE_LOCATOR,
    metadata: {
      transcriptionPolicy: 'EXACT_RETAINED_TITLE_TABLE_HEADER_AND_15_INCH_ROW_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    fullWebPageBytesRetainedByThisBenchmark: false,
    exactEvidenceExcerptBytesRetained: true
  },
  audit: audit({ type: 'USER', id: 'planting-source-curator' }, 'artifact', '2026-09-04T10:00:20.000Z')
});
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.real-msu-soybean-planting-population-v1',
  version: '1',
  compilerId: 'adr.real-msu-soybean-planting-population.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_OFFICIAL_WEB_EXCERPT',
    locatorScheme: 'TEXT_LINE_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'planting-source-compiler' }, 'compiler', '2026-09-04T10:00:30.000Z')
});
const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-msu-soybean-planting-population-v1.15in-150k',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'soybean-15in-150k',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: SOURCE_ASSERTION,
      sourceLocator: locator(SOURCE_EVIDENCE, 4),
      sourceContext: contextFamilies()
    }],
    runMetadata: { benchmark: 'REAL_MSU_SOYBEAN_PLANTING_POPULATION_RUNTIME_COMPOSITION_V1' }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'planting-source-compiler' }, 'compilation', '2026-09-04T10:01:00.000Z')
});

const reviewer = createPrincipal({ principalId: 'planting-runtime-v1-reviewer', type: 'USER', ...OWNERSHIP });
const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(reviewer, 'reviewer-role', '2026-09-04T10:01:10.000Z')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.planting-runtime-v1.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(reviewer, 'review-policy', '2026-09-04T10:01:20.000Z')
});
const reviewAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'review-auth', '2026-09-04T10:01:30.000Z')
});
const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
  reviewLogicalId: 'review.real-msu-soybean-planting-population-v1.15in-150k',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.real-msu-soybean-planting-population-v1.15in-150k',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-msu-soybean-planting-population-v1.15in-150k',
  sourceContextVersion: '1',
  audit: audit(reviewer, 'source-faithful-review', '2026-09-04T10:02:00.000Z')
});

const approver = createPrincipal({ principalId: 'planting-runtime-v1-scientific-approver', type: 'USER', ...OWNERSHIP });
const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(approver, 'approver-role', '2026-09-04T10:02:10.000Z')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.planting-runtime-v1.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(approver, 'qualification-policy', '2026-09-04T10:02:20.000Z')
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
  audit: serviceAudit('iam-engine', 'qualification-auth', '2026-09-04T10:02:30.000Z')
});
const qualificationService = new ScientificQualificationService({ ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-msu-soybean-planting-population-v1.15in-150k',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: EXPECTED_PRECONDITIONS,
  limitations: [{
    code: 'RECOMMENDATION_NOT_HISTORICAL_OPERATION_TRUTH',
    statement: 'The recommendation does not assert that a target field actually planted 150000 seeds per acre.'
  }],
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit(approver, 'qualification', '2026-09-04T10:03:00.000Z')
});
const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-msu-soybean-planting-population-v1.15in-150k',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit(approver, 'qualified-knowledge', '2026-09-04T10:03:10.000Z')
});
const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions
  .map((entry) => entry.value)
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(frozenPreconditions, [...EXPECTED_PRECONDITIONS].sort((a, b) => a.semanticId.localeCompare(b.semanticId)));
assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);
assert.equal(knowledge.semanticPayload.limitations.length, 1);

const releaseManager = createPrincipal({
  principalId: 'planting-runtime-v1-release-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const releaseRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'planting-runtime-v1-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role', '2026-09-04T10:03:20.000Z')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.planting-runtime-v1.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(knowledge.ref),
  ownership: knowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: audit(releaseManager, 'release-policy', '2026-09-04T10:03:30.000Z')
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
  audit: serviceAudit('iam-engine', 'release-auth', '2026-09-04T10:03:40.000Z')
});
const release = new KnowledgeReleaseService({ ledger }).publishRelease({
  logicalId: 'release.real-msu-soybean-planting-population-v1',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: knowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuth.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publish', '2026-09-04T10:04:00.000Z')
}).release;

const profileManager = createPrincipal({
  principalId: 'planting-runtime-v1-profile-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const profileRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'planting-runtime-v1-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role', '2026-09-04T10:04:10.000Z')
});
const profileLogicalId = 'runtime-profile.real-msu-soybean-planting-population-v1';
const profileDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE', resourceId: profileLogicalId }
});
assert.equal(profileDecision.allowed, true);
const profileAuth = recordAuthorizationDecision({
  ledger,
  decision: profileDecision,
  audit: serviceAudit('iam-engine', 'profile-auth', '2026-09-04T10:04:20.000Z')
});
const requiredSemanticIds = ['crop.code', 'jurisdiction.region', 'planting.row_spacing_in'];
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
      allowedDecisionAuthorityModes: ['ADR_POLICY'],
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
  audit: audit(profileManager, 'profile-publish', '2026-09-04T10:04:30.000Z')
});
validateRuntimeProfileAuthority({ ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 'planting-runtime-v1-deployment-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-role', '2026-09-04T10:04:40.000Z')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    ...RELEASE_TARGET,
    regions: ['MICHIGAN'],
    crops: ['SOYBEAN'],
    decisionTypes: [PLANTING_DECISION_TYPE]
  },
  authorizedUse: {
    usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: { start: '2026-09-04T00:00:00.000Z', end: '2026-09-05T00:00:00.000Z' },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.real-msu-soybean-planting-population-v1';
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
  audit: serviceAudit('iam-engine', 'deployment-auth', '2026-09-04T10:04:50.000Z')
});
const deployment = publishDeployment({
  ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuth.ref,
  audit: audit(deploymentManager, 'deployment-publish', '2026-09-04T10:05:00.000Z')
});
validateDeploymentAuthority({ ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 'planting-runtime-v1-runtime-service', type: 'SERVICE_ACCOUNT', ...OWNERSHIP, programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.planting-runtime-v1.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role', '2026-09-04T10:05:10.000Z')
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
  audit: serviceAudit('iam-engine', 'runtime-auth', '2026-09-04T10:05:20.000Z')
});

const retrieval = executeKnowledgeRetrieval({
  ledger,
  logicalId: 'retrieval.real-msu-soybean-planting-population-v1',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish', '2026-09-04T10:06:00.000Z')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: retrieval.ref });
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs, [knowledge.ref]);

const applicability = assessKnowledgeApplicability({
  ledger,
  logicalId: 'applicability.real-msu-soybean-planting-population-v1',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: knowledge.ref,
  contextManifestRef: manifest.ref,
  snapshotStore,
  audit: audit(runtimePrincipal, 'applicability-publish', '2026-09-04T10:07:00.000Z')
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
assert.equal(validatedApplicability.semanticPayload.conditionResults.length, 3);
for (const expected of EXPECTED_PRECONDITIONS) {
  const condition = validatedApplicability.semanticPayload.conditionResults.find(
    (item) => item.source === 'SEMANTIC_PRECONDITION' && item.semanticId === expected.semanticId
  );
  assert.ok(condition, `missing A08 condition result for ${expected.semanticId}`);
  assert.equal(condition.status, 'MATCH');
  assert.equal(condition.disposition, 'MATCH');
}

const targetIndex = Object.fromEntries(validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload]));
assert.deepEqual(targetIndex['crop.code'].value, { type: 'CATEGORY', category: 'soybean' });
assert.deepEqual(targetIndex['jurisdiction.region'].value, { type: 'CATEGORY', category: 'michigan' });
assert.deepEqual(targetIndex['planting.row_spacing_in'].value, { type: 'DECIMAL', decimal: '15' });
assert.equal(targetIndex['planting.row_spacing_in'].unit, 'inch');
assert.equal('planting.population_seeds_per_acre' in targetIndex, false);
assert.equal(world.adapterResponse.source_evidence[0].historical_operation_planting_population_seeds_per_acre, '180000');
assert.ok(new Date(PLANTING_LOGICAL_TIME) > new Date(world.validatedManifest.semanticPayload.evidenceCutoff));

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
  logicalId: 'runtime-eligibility.real-msu-soybean-planting-population-v1',
  version: '1',
  runtimePlan: plan,
  snapshotStore,
  audit: audit(runtimePrincipal, 'runtime-eligibility-publish', '2026-09-04T10:08:00.000Z')
});
const validatedEligibility = validateRuntimeEligibility({
  ledger,
  runtimeEligibilityRef: eligibility.ref,
  snapshotStore
});
assert.equal(plan.openRequirements.length, 0, 'positive planting world must have no R01 open requirements');
assert.equal(validatedEligibility.semanticPayload.runtimeEligibility, 'RUNTIME_ELIGIBLE');
assert.deepEqual(validatedEligibility.semanticPayload.informationRequirements, []);
const legalPaths = validatedEligibility.semanticPayload.alternativeEvaluations.filter((item) => item.disposition === 'LEGAL');
assert.equal(legalPaths.length, 1, 'positive planting world must have exactly one legal runtime alternative');

const binding = publishRuntimeBinding({
  ledger,
  logicalId: 'runtime-binding.real-msu-soybean-planting-population-v1',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  selectedAlternativePathId: legalPaths[0].pathId,
  snapshotStore,
  audit: audit(runtimePrincipal, 'runtime-binding-publish', '2026-09-04T10:09:00.000Z')
});
const validatedBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: binding.ref });
assert.equal(validatedBinding.semanticPayload.contextManifestRef.semanticHash, manifest.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.decisionProblemRef.semanticHash, decision.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.knowledgeReleaseRef.semanticHash, release.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.logicalTime, new Date(PLANTING_LOGICAL_TIME).toISOString());
assert.deepEqual(validatedBinding.semanticPayload.knowledgeBindings, [{
  knowledgeRef: knowledge.ref,
  applicabilityAssessmentRef: applicability.ref
}]);

const records = ledger.exportSnapshot().records;
const forbiddenKinds = new Set([
  'RuntimeResult', 'RuntimeDatum', 'RuntimeAlternativeSet', 'DecisionRobustness',
  'DecisionResult', 'ExecutionReceipt', 'Outcome', 'OutcomeEvaluation'
]);
assert.equal(records.filter((record) => forbiddenKinds.has(record.ref.kind)).length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_PLANTING_A08_R01_R03_D01_STRICT_POSITIVE',
  classification: 'RETROSPECTIVE_REAL_SOURCE_RUNTIME_COMPOSITION_TEST_ONLY',
  targetWorld: {
    source: 'KBS_PUBLIC_SOYBEAN_15IN_TARGET_CONTEXT_ADAPTER',
    decisionProblemRef: decision.ref,
    contextManifestRef: manifest.ref,
    contextSemanticIds: requiredSemanticIds,
    replayClass: world.validatedManifest.semanticPayload.replayClass,
    targetRefPromotedToFarmFieldOrZone: false,
    historicalOperationPopulationSeedsPerAcre: '180000',
    historicalOperationPopulationPromotedToDecisionInput: false,
    logicalTime: new Date(PLANTING_LOGICAL_TIME).toISOString(),
    evidenceCutoff: world.validatedManifest.semanticPayload.evidenceCutoff
  },
  knowledgeWorld: {
    source: 'MSU_EXTENSION_SOYBEAN_PLANTING_POPULATION_RECOMMENDATION',
    sourceArtifactHash: EXPECTED_SOURCE_HASH,
    sourceAssertion: SOURCE_ASSERTION,
    recommendationPopulationSeedsPerAcre: '150000',
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
    legalAlternativeCount: legalPaths.length
  },
  runtimeBinding: {
    runtimeBindingRef: binding.ref,
    selectedAlternativePathId: validatedBinding.semanticPayload.selectedAlternativePathId,
    knowledgeBindings: validatedBinding.semanticPayload.knowledgeBindings,
    correctnessClaim: validatedBinding.semanticPayload.correctnessClaim
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));
