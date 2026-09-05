import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { publishKnowledgeGovernancePolicy } from '../../packages/authorization/src/engine.mjs';
import { authorizeRuntimeProfileManage } from '../../packages/authorization/src/runtime-profile-control.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  publishDecisionProblem,
  validateDecisionProblemAuthority
} from '../../packages/decision-problem/src/index.mjs';
import {
  publishContextManifest,
  validateContextManifestAuthority
} from '../../packages/context-manifest/src/index.mjs';
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
  RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
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
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '../../adapters/geox/src/target-correspondence-profile-registry.mjs';
import {
  KBS_T4R1_EVIDENCE_CUTOFF,
  KBS_T4R1_TARGET_OWNERSHIP,
  buildKbsT4R1TargetWorld
} from '../real-kbs-t4r1-target-correspondence/target-world.mjs';

export const CORN_DECISION_TYPE = 'CORN_HYBRID_SEEDING_RATE_RANGE_ADVISORY';
export const CORN_LOGICAL_TIME = '2026-09-05T00:20:00.000Z';
export const CORN_DEADLINE = '2026-09-05T01:20:00.000Z';
export const CORN_TARGET_OWNERSHIP = KBS_T4R1_TARGET_OWNERSHIP;

const OWNERSHIP = CORN_TARGET_OWNERSHIP;
const RELEASE_TARGET = Object.freeze({ ...OWNERSHIP, programId: 'pilot-kbs-t4r1-corn' });
const EXPECTED_SOURCE_HASH = 'sha256:cf0454506315cc8f5ee4f0939348dc15977e6930f9b4ae0da7b6df93bc18e273';
const SOURCE_LOCATOR = 'https://alseed.com/wp-content/uploads/2026/08/Tech-Sheet-Blue-River-43-96P-1.pdf';
const SOURCE_ASSERTION =
  'The Blue River 43-96P tech sheet states a recommended planting population range of 28,000 to 36,000 seeds per acre.';
const SOURCE_EVIDENCE = 'Population Rec: 28-36K';
const EXPECTED_LIMITATION_CODE = 'RECOMMENDED_RANGE_NOT_HISTORICAL_OPERATION_TRUTH';
const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'corn' },
  { semanticId: 'planting.hybrid', operator: 'EQUALS', value: '43-96P' }
]);

const correspondenceWorld = buildKbsT4R1TargetWorld();
const {
  ledger,
  snapshotStore,
  principal: targetPrincipal,
  datumRefs,
  receiptRefs,
  validatedDatums
} = correspondenceWorld;

const correspondenceProfile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(correspondenceProfile);
assert.equal(correspondenceProfile.replayableResolverSupported, true);
assert.equal(correspondenceProfile.provider.treatment_code, correspondenceWorld.providerTarget.treatment);
assert.equal(correspondenceProfile.provider.replicate_code, correspondenceWorld.providerTarget.replicate);
assert.equal(correspondenceProfile.provider.crop_code, correspondenceWorld.providerTarget.crop);
assert.equal(correspondenceProfile.provider.hybrid_code, correspondenceWorld.providerTarget.hybrid);
assert.equal(correspondenceProfile.provider.planting_observation_id, correspondenceWorld.providerTarget.plantingObservationId);

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-09-05T00:12:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-t4r1-corn-decision-v1-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type ?? 'USER', id: principal.principalId ?? principal.id },
    details: {
      suite: 'real-kbs-t4r1-corn-hybrid-population-decision-v1',
      classification: 'SAME_TARGET_REAL_SOURCE_DECISION_RESULT_SHADOW_QUALIFICATION_ONLY'
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
      valueCandidate: 'corn',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('96-DAY CRM BLUE RIVER ORGANIC CORN HYBRID', 2)
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'planting.hybrid',
      valueCandidate: '43-96P',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator('BLUE RIVER 43-96P', 1)
    }]
  };
  families.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: 'corn hybrid planting population recommendation',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(SOURCE_EVIDENCE, 3)
    }]
  };
  return families;
}
const contextAdjudication = Object.freeze({
  BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
  ENVIRONMENTAL: [],
  MANAGEMENT: [{ semanticId: 'planting.hybrid', valueType: 'STRING' }],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [],
  JURISDICTION_ECONOMIC: []
});

const decisionLogicalId = 'decision-problem.kbs-t4r1-2026.corn-hybrid-seeding-rate-range-advisory';
const decisionRole = publishRoleAssignment({
  ledger,
  logicalId: `role.kbs-t4r1-corn.decision.${decisionLogicalId}`,
  version: '1',
  principal: targetPrincipal,
  role: 'KBS_T4R1_CORN_DECISION_CREATOR',
  roleDefinitionVersion: 'kbs-t4r1-corn-decision-v1',
  permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
  scope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM' },
  audit: audit(targetPrincipal, 'decision-role', '2026-09-05T00:12:00.000Z')
});
const decisionAuthorization = authorizeDecisionProblemCreation({
  principal: targetPrincipal,
  roleAssignments: [decisionRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM', resourceId: decisionLogicalId }
});
assert.equal(decisionAuthorization.allowed, true);
const decisionAuth = recordAuthorizationDecision({
  ledger,
  decision: decisionAuthorization,
  audit: serviceAudit('iam-engine', 'decision-auth', '2026-09-05T00:12:10.000Z')
});
const decision = publishDecisionProblem({
  ledger,
  logicalId: decisionLogicalId,
  version: '1',
  problem: {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: CORN_DECISION_TYPE,
    targetRef: OWNERSHIP,
    logicalTime: CORN_LOGICAL_TIME,
    decisionHorizon: { duration: 'PT24H' },
    objective: { code: 'RETROSPECTIVELY_EVALUATE_EXACT_HYBRID_SEEDING_RATE_RANGE_GUIDANCE' },
    actionSpace: ['SET_CORN_SEEDING_RATE_RANGE', 'ABSTAIN'],
    constraints: [{
      type: 'RETROSPECTIVE_EVALUATION_SLICE',
      start: correspondenceWorld.adapterResponse.evaluation_slice.start,
      end: correspondenceWorld.adapterResponse.evaluation_slice.end,
      targetContextSelector: {
        semanticId: 'planting.hybrid',
        operator: 'EQUALS',
        value: '43-96P'
      }
    }],
    usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    useClass: 'TEST_ONLY',
    decisionAuthorityMode: 'ADR_POLICY',
    decisionDeadline: CORN_DEADLINE
  },
  principal: targetPrincipal,
  authorizationDecisionAuditRef: decisionAuth.ref,
  audit: audit(targetPrincipal, 'decision-publish', '2026-09-05T00:12:20.000Z')
});
const validatedDecision = validateDecisionProblemAuthority({ ledger, decisionProblemRef: decision.ref });
assert.deepEqual(validatedDecision.semanticPayload.targetRef, correspondenceWorld.decision.semanticPayload.targetRef);
assert.equal(validatedDecision.semanticPayload.decisionType, CORN_DECISION_TYPE);
assert.equal(validatedDecision.semanticPayload.decisionAuthorityMode, 'ADR_POLICY');
assert.equal('farmId' in validatedDecision.semanticPayload.targetRef, false);
assert.equal('fieldId' in validatedDecision.semanticPayload.targetRef, false);
assert.equal('zoneId' in validatedDecision.semanticPayload.targetRef, false);

function publishManifestAuthorization(logicalId) {
  const role = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-t4r1-corn.manifest.${logicalId}`,
    version: '1',
    principal: targetPrincipal,
    role: 'KBS_T4R1_CORN_CONTEXT_GATEWAY',
    roleDefinitionVersion: 'kbs-t4r1-corn-decision-v1',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: { ...OWNERSHIP, resourceType: 'CONTEXT_MANIFEST' },
    audit: audit(targetPrincipal, 'manifest-role', '2026-09-05T00:12:30.000Z')
  });
  const authorization = authorizeContextWrite({
    principal: targetPrincipal,
    roleAssignments: [role],
    authorizationScope: { ...OWNERSHIP, resourceType: 'CONTEXT_MANIFEST', resourceId: logicalId }
  });
  assert.equal(authorization.allowed, true);
  return recordAuthorizationDecision({
    ledger,
    decision: authorization,
    audit: serviceAudit('iam-engine', 'manifest-auth', '2026-09-05T00:12:40.000Z')
  });
}

const manifestLogicalId = 'context-manifest.kbs-t4r1-2026.corn-hybrid-seeding-rate-range-advisory';
const manifestAuth = publishManifestAuthorization(manifestLogicalId);
const manifest = publishContextManifest({
  ledger,
  logicalId: manifestLogicalId,
  version: '1',
  decisionProblemRef: decision.ref,
  evidenceCutoff: KBS_T4R1_EVIDENCE_CUTOFF,
  datumRefs,
  resolvedReferenceReceiptRefs: receiptRefs,
  snapshotStore,
  principal: targetPrincipal,
  authorizationDecisionAuditRef: manifestAuth.ref,
  audit: audit(targetPrincipal, 'manifest-publish', '2026-09-05T00:12:50.000Z')
});
const validatedManifest = validateContextManifestAuthority({
  ledger,
  contextManifestRef: manifest.ref,
  snapshotStore
});
assert.equal(validatedManifest.semanticPayload.replayClass, 'EXACT');
assert.deepEqual(validatedManifest.semanticPayload.datumRefs, correspondenceWorld.manifest.semanticPayload.datumRefs);
assert.deepEqual(
  validatedManifest.semanticPayload.resolvedReferenceReceiptRefs,
  correspondenceWorld.manifest.semanticPayload.resolvedReferenceReceiptRefs
);
assert.ok(new Date(KBS_T4R1_EVIDENCE_CUTOFF) < new Date(CORN_LOGICAL_TIME));

const targetIndex = Object.fromEntries(validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload]));
assert.deepEqual(targetIndex['crop.code'].value, { type: 'CATEGORY', category: 'corn' });
assert.deepEqual(targetIndex['planting.hybrid'].value, { type: 'STRING', string: '43-96P' });
assert.deepEqual(targetIndex['treatment.code'].value, { type: 'CATEGORY', category: 'T4' });
assert.deepEqual(targetIndex['replicate.code'].value, { type: 'CATEGORY', category: 'R1' });
assert.equal('planting.population_seeds_per_acre' in targetIndex, false);
assert.equal('planting.population_recommended_min_seeds_per_acre' in targetIndex, false);
assert.equal('planting.population_recommended_max_seeds_per_acre' in targetIndex, false);

const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
const sourceBytes = readFileSync(new URL('./blue-river-43-96p-population-recommendation-excerpt.txt', import.meta.url));
assert.equal(sourceContentHash(sourceBytes), EXPECTED_SOURCE_HASH);
const source = sourceRegistry.registerSource({
  logicalId: 'source.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  sourceType: 'CULTIVAR_DOCUMENT',
  title: 'Blue River 43-96P Tech Sheet',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Albert Lea Seed / Blue River'
  },
  sourceVersionLabel: '2026-08-tech-sheet',
  originLocator: SOURCE_LOCATOR,
  metadata: {
    artifactClass: 'CURATED_OFFICIAL_PRODUCT_TECH_SHEET_EXCERPT',
    populationRecommendation: '28-36K'
  },
  audit: audit({ type: 'USER', id: 't4r1-corn-source-curator' }, 'source', '2026-09-05T00:13:00.000Z')
});
const artifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.real-blue-river-43-96p-population-recommendation-v1.excerpt',
  version: '1',
  sourceRef: source.ref,
  bytes: sourceBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'blue-river-43-96p-curated-official-tech-sheet-excerpt-v1',
  acquisition: {
    method: 'CURATED_OFFICIAL_PRODUCT_TECH_SHEET_EXCERPT',
    acquiredAt: '2026-09-05T00:13:10.000Z',
    locator: SOURCE_LOCATOR,
    metadata: {
      transcriptionPolicy: 'EXACT_RETAINED_HYBRID_IDENTITY_CROP_IDENTITY_AND_POPULATION_RECOMMENDATION_NO_SEMANTIC_EDIT'
    }
  },
  metadata: {
    fullPdfBytesRetainedByThisBenchmark: false,
    exactEvidenceExcerptBytesRetained: true
  },
  audit: audit({ type: 'USER', id: 't4r1-corn-source-curator' }, 'artifact', '2026-09-05T00:13:20.000Z')
});
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  compilerId: 'adr.real-blue-river-43-96p-population-recommendation.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_OFFICIAL_PRODUCT_TECH_SHEET_EXCERPT',
    locatorScheme: 'TEXT_LINE_V1'
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 't4r1-corn-source-compiler' }, 'compiler', '2026-09-05T00:13:30.000Z')
});
const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'blue-river-43-96p-28k-36k',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: SOURCE_ASSERTION,
      sourceLocator: locator(SOURCE_EVIDENCE, 3),
      sourceContext: contextFamilies()
    }],
    runMetadata: { benchmark: 'REAL_KBS_T4R1_CORN_SAME_TARGET_DECISION_V1' }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 't4r1-corn-source-compiler' }, 'compilation', '2026-09-05T00:13:40.000Z')
});

const reviewer = createPrincipal({ principalId: 't4r1-corn-runtime-v1-reviewer', type: 'USER', ...OWNERSHIP });
const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(reviewer, 'reviewer-role', '2026-09-05T00:13:50.000Z')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.t4r1-corn-runtime-v1.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(reviewer, 'review-policy', '2026-09-05T00:14:00.000Z')
});
const reviewAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'review-auth', '2026-09-05T00:14:10.000Z')
});
const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
  reviewLogicalId: 'review.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  sourceContextVersion: '1',
  audit: audit(reviewer, 'source-faithful-review', '2026-09-05T00:14:20.000Z')
});

const approver = createPrincipal({ principalId: 't4r1-corn-runtime-v1-scientific-approver', type: 'USER', ...OWNERSHIP });
const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(approver, 'approver-role', '2026-09-05T00:14:30.000Z')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.t4r1-corn-runtime-v1.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(approver, 'qualification-policy', '2026-09-05T00:14:40.000Z')
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
  audit: serviceAudit('iam-engine', 'qualification-auth', '2026-09-05T00:14:50.000Z')
});
const qualificationService = new ScientificQualificationService({ ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: EXPECTED_PRECONDITIONS,
  limitations: [{
    code: EXPECTED_LIMITATION_CODE,
    statement: 'The stated recommended range does not assert the historical planting population of the KBS T4/R1 target.'
  }],
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit(approver, 'qualification', '2026-09-05T00:15:00.000Z')
});
const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-blue-river-43-96p-population-recommendation-v1.28k-36k',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit(approver, 'qualified-knowledge', '2026-09-05T00:15:10.000Z')
});
const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions
  .map((entry) => entry.value)
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(
  frozenPreconditions,
  [...EXPECTED_PRECONDITIONS].sort((a, b) => a.semanticId.localeCompare(b.semanticId))
);
assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);
assert.equal(knowledge.semanticPayload.limitations.length, 1);
assert.equal(knowledge.semanticPayload.limitations[0].value.code, EXPECTED_LIMITATION_CODE);

const releaseManager = createPrincipal({
  principalId: 't4r1-corn-runtime-v1-release-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const releaseRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 't4r1-corn-runtime-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role', '2026-09-05T00:15:20.000Z')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.t4r1-corn-runtime-v1.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(knowledge.ref),
  ownership: knowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: audit(releaseManager, 'release-policy', '2026-09-05T00:15:30.000Z')
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
  audit: serviceAudit('iam-engine', 'release-auth', '2026-09-05T00:15:40.000Z')
});
const release = new KnowledgeReleaseService({ ledger }).publishRelease({
  logicalId: 'release.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: knowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuth.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publish', '2026-09-05T00:15:50.000Z')
}).release;

const profileManager = createPrincipal({
  principalId: 't4r1-corn-runtime-v1-profile-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const profileRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 't4r1-corn-runtime-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role', '2026-09-05T00:16:00.000Z')
});
const profileLogicalId = 'runtime-profile.real-blue-river-43-96p-population-recommendation-v1';
const profileDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE', resourceId: profileLogicalId }
});
assert.equal(profileDecision.allowed, true);
const profileAuth = recordAuthorizationDecision({
  ledger,
  decision: profileDecision,
  audit: serviceAudit('iam-engine', 'profile-auth', '2026-09-05T00:16:10.000Z')
});
const requiredSemanticIds = ['crop.code', 'planting.hybrid'];
const profile = publishRuntimeProfile({
  ledger,
  logicalId: profileLogicalId,
  version: '1',
  profile: {
    contractVersion: RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
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
    },
    robustnessRequirement: {
      comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
      sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION']
    }
  },
  principal: profileManager,
  authorizationDecisionAuditRef: profileAuth.ref,
  audit: audit(profileManager, 'profile-publish', '2026-09-05T00:16:20.000Z')
});
validateRuntimeProfileAuthority({ ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 't4r1-corn-runtime-v1-deployment-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-role', '2026-09-05T00:16:30.000Z')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    ...RELEASE_TARGET,
    regions: ['MICHIGAN'],
    crops: ['CORN'],
    decisionTypes: [CORN_DECISION_TYPE]
  },
  authorizedUse: {
    usePurposes: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: { start: '2026-09-05T00:00:00.000Z', end: '2026-09-06T00:00:00.000Z' },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.real-blue-river-43-96p-population-recommendation-v1';
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
  audit: serviceAudit('iam-engine', 'deployment-auth', '2026-09-05T00:16:40.000Z')
});
const deployment = publishDeployment({
  ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuth.ref,
  audit: audit(deploymentManager, 'deployment-publish', '2026-09-05T00:16:50.000Z')
});
validateDeploymentAuthority({ ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 't4r1-corn-runtime-v1-runtime-service',
  type: 'SERVICE_ACCOUNT',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-runtime-v1.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role', '2026-09-05T00:17:00.000Z')
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
  audit: serviceAudit('iam-engine', 'runtime-auth', '2026-09-05T00:17:10.000Z')
});

const retrieval = executeKnowledgeRetrieval({
  ledger,
  logicalId: 'retrieval.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish', '2026-09-05T00:17:20.000Z')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: retrieval.ref });
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs, [knowledge.ref]);

const applicability = assessKnowledgeApplicability({
  ledger,
  logicalId: 'applicability.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: knowledge.ref,
  contextManifestRef: manifest.ref,
  snapshotStore,
  audit: audit(runtimePrincipal, 'applicability-publish', '2026-09-05T00:17:30.000Z')
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
assert.equal(validatedApplicability.semanticPayload.limitations.length, 1);
assert.equal(validatedApplicability.semanticPayload.limitations[0].code, EXPECTED_LIMITATION_CODE);
for (const expected of EXPECTED_PRECONDITIONS) {
  const condition = validatedApplicability.semanticPayload.conditionResults.find(
    (item) => item.source === 'SEMANTIC_PRECONDITION' && item.semanticId === expected.semanticId
  );
  assert.ok(condition, `missing A08 condition result for ${expected.semanticId}`);
  assert.equal(condition.status, 'MATCH');
  assert.equal(condition.disposition, 'MATCH');
}

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
  logicalId: 'runtime-eligibility.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  runtimePlan: plan,
  snapshotStore,
  audit: audit(runtimePrincipal, 'runtime-eligibility-publish', '2026-09-05T00:17:40.000Z')
});
const validatedEligibility = validateRuntimeEligibility({
  ledger,
  runtimeEligibilityRef: eligibility.ref,
  snapshotStore
});
assert.equal(plan.openRequirements.length, 0);
assert.equal(validatedEligibility.semanticPayload.runtimeEligibility, 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS');
assert.deepEqual(validatedEligibility.semanticPayload.informationRequirements, []);
assert.deepEqual(validatedEligibility.semanticPayload.reasonCodes, ['LEGAL_RUNTIME_ONLY_WITH_LIMITATIONS']);
assert.equal(validatedEligibility.semanticPayload.limitations.length, 1);
assert.equal(validatedEligibility.semanticPayload.limitations[0].detail.code, EXPECTED_LIMITATION_CODE);
const limitedLegalPaths = validatedEligibility.semanticPayload.alternativeEvaluations.filter(
  (item) => item.disposition === 'LEGAL_WITH_LIMITATIONS'
);
assert.equal(limitedLegalPaths.length, 1);
assert.equal(limitedLegalPaths[0].limitations[0].detail.code, EXPECTED_LIMITATION_CODE);

const binding = publishRuntimeBinding({
  ledger,
  logicalId: 'runtime-binding.real-blue-river-43-96p-population-recommendation-v1',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  selectedAlternativePathId: limitedLegalPaths[0].pathId,
  snapshotStore,
  audit: audit(runtimePrincipal, 'runtime-binding-publish', '2026-09-05T00:17:50.000Z')
});
const validatedBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: binding.ref });
assert.equal(validatedBinding.semanticPayload.contextManifestRef.semanticHash, manifest.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.decisionProblemRef.semanticHash, decision.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.knowledgeReleaseRef.semanticHash, release.ref.semanticHash);
assert.equal(validatedBinding.semanticPayload.logicalTime, new Date(CORN_LOGICAL_TIME).toISOString());
assert.deepEqual(validatedBinding.semanticPayload.knowledgeBindings, [{
  knowledgeRef: knowledge.ref,
  applicabilityAssessmentRef: applicability.ref
}]);
assert.equal(validatedBinding.semanticPayload.limitations[0].detail.code, EXPECTED_LIMITATION_CODE);

export const cornRuntimeWorld = Object.freeze({
  ledger,
  snapshotStore,
  correspondenceWorld,
  correspondenceProfile,
  decision,
  manifest,
  validatedManifest,
  validatedDatums,
  knowledge,
  release,
  profile,
  deployment,
  runtimePrincipal,
  eligibility,
  validatedEligibility,
  limitedLegalPaths,
  binding,
  validatedBinding,
  requiredSemanticIds,
  expectedLimitationCode: EXPECTED_LIMITATION_CODE,
  sourceArtifactHash: EXPECTED_SOURCE_HASH
});

const records = ledger.exportSnapshot().records;
const forbiddenKinds = new Set([
  'RuntimeResult', 'RuntimeDatum', 'RuntimeAlternativeSet', 'DecisionRobustness',
  'DecisionResult', 'ExecutionReceipt', 'Outcome', 'OutcomeEvaluation'
]);
assert.equal(records.filter((record) => forbiddenKinds.has(record.ref.kind)).length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'GEOX_T4R1_SAME_TARGET_CORN_DECISION_A08_R01_R03_D01',
  classification: 'SAME_TARGET_REAL_SOURCE_DECISION_RESULT_SHADOW_QUALIFICATION_ONLY',
  sameTarget: {
    correspondenceRelation: correspondenceProfile.relation,
    correspondenceDecisionProblemRef: correspondenceWorld.decision.ref,
    agronomicDecisionProblemRef: decision.ref,
    correspondenceContextManifestRef: correspondenceWorld.manifest.ref,
    agronomicContextManifestRef: manifest.ref,
    sameTargetRef: true,
    sameDatumRefs: true,
    sameResolvedReceiptRefs: true,
    providerTarget: correspondenceWorld.providerTarget,
    geoxTarget: correspondenceProfile.geox,
    adrFarmFieldOrZonePromoted: false
  },
  knowledgeWorld: {
    source: 'BLUE_RIVER_43_96P_OFFICIAL_TECH_SHEET',
    sourceArtifactHash: EXPECTED_SOURCE_HASH,
    sourceAssertion: SOURCE_ASSERTION,
    recommendationRangeSeedsPerAcre: { min: '28000', max: '36000' },
    qualifiedKnowledgeRef: knowledge.ref,
    knowledgeReleaseRef: release.ref,
    semanticPreconditions: frozenPreconditions,
    limitationCode: EXPECTED_LIMITATION_CODE
  },
  applicability: {
    assessmentRef: applicability.ref,
    scientificUseStatus: validatedApplicability.semanticPayload.scientificUseStatus,
    transportStatus: validatedApplicability.semanticPayload.transportStatus,
    runtimeUse: validatedApplicability.semanticPayload.runtimeUse,
    missingContextSemanticIds: validatedApplicability.semanticPayload.missingContextSemanticIds
  },
  runtimeEligibility: {
    runtimeEligibilityRef: eligibility.ref,
    disposition: validatedEligibility.semanticPayload.runtimeEligibility,
    reasonCodes: validatedEligibility.semanticPayload.reasonCodes,
    informationRequirements: validatedEligibility.semanticPayload.informationRequirements
  },
  runtimeBinding: {
    runtimeBindingRef: binding.ref,
    limitationCodes: validatedBinding.semanticPayload.limitations.map((item) => item.detail.code)
  },
  targetSideRecommendedPopulationPresent: false,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  newArchitectureDecisionRequired: false
}, null, 2));
