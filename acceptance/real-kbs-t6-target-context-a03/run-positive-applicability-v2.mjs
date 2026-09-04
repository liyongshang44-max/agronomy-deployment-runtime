import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
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
import {
  KBS_T6_DECISION_TYPE,
  KBS_T6_LOGICAL_TIME,
  KBS_T6_TARGET_OWNERSHIP,
  buildKbsT6TargetWorld
} from './target-world.mjs';

const OWNERSHIP = KBS_T6_TARGET_OWNERSHIP;
const RELEASE_TARGET = Object.freeze({ ...OWNERSHIP, programId: 'pilot-a' });
const EXPECTED_EXCERPT_HASH = 'sha256:55bc293d56f16f7d804c1dd1530937bd9e6b6d3cfbef0e177beb1b971857e196';
const SOURCE_LOCATOR = 'current_agronomic_protocol.pdf#page=10';
const T6 = Object.freeze({
  key: 't6-no-nitrogen',
  page: 10,
  treatment: 'Main Site Treatment 6',
  crop: 'alfalfa',
  site: 'Kellogg Biological Station',
  decisionDomain: 'nitrogen input control',
  assertion: 'For Main Site Treatment 6 in the 2015 KBS LTER agronomic protocol, nitrogen must not be added.',
  evidenceText: 'Do not add any nitrogen to treatment 6.'
});
const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'alfalfa' },
  { semanticId: 'site.name', operator: 'EQUALS', value: 'Kellogg Biological Station' },
  { semanticId: 'treatment.name', operator: 'EQUALS', value: 'Main Site Treatment 6' }
]);

const world = buildKbsT6TargetWorld();
const { ledger, snapshotStore, decision, manifest, validatedDatums } = world;
const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });

let seq = 0;
function audit(principal, suffix, occurredAt = '2026-09-04T07:16:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-kbs-t6-positive-v2-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type ?? 'USER', id: principal.principalId ?? principal.id },
    details: {
      suite: 'real-kbs-t6-positive-applicability-v2',
      classification: 'REAL_SOURCE_POSITIVE_APPLICABILITY_TEST_ONLY'
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
    coordinates: { page: T6.page, evidenceText }
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
      valueCandidate: T6.crop,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(T6.evidenceText)
    }]
  };
  families.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'site.identity',
      valueCandidate: T6.site,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: {
          page: T6.page,
          evidenceText: '2015 LTER Agronomic Protocol Kellogg Biological Station'
        }
      }
    }]
  };
  families.MANAGEMENT = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'treatment.identity',
      valueCandidate: T6.treatment,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(T6.evidenceText)
    }]
  };
  families.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: T6.decisionDomain,
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: locator(T6.evidenceText)
    }]
  };
  return families;
}
const contextAdjudication = Object.freeze({
  BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
  ENVIRONMENTAL: [{ semanticId: 'site.name', valueType: 'STRING' }],
  MANAGEMENT: [{ semanticId: 'treatment.name', valueType: 'STRING' }],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [],
  JURISDICTION_ECONOMIC: []
});

const excerptBytes = readFileSync(new URL('../gold-protocol-kbs-2015/kbs-2015-prohibition-excerpts.txt', import.meta.url));
assert.equal(sourceContentHash(excerptBytes), EXPECTED_EXCERPT_HASH);
const source = sourceRegistry.registerSource({
  logicalId: 'source.real-kbs-t6-positive-v2.protocol',
  version: '1',
  sourceType: 'PROTOCOL',
  title: '2015 LTER Agronomic Protocol — Treatment 6 nitrogen prohibition',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Kellogg Biological Station, Michigan State University',
    program: 'Long-Term Ecological Research (LTER) in Row-Crop Agriculture',
    date: '2015-01-01'
  },
  sourceVersionLabel: '2015',
  originLocator: SOURCE_LOCATOR,
  metadata: { originalPdfPage: 10, benchmarkClass: 'REAL_SOURCE_POSITIVE_T6' },
  audit: audit({ type: 'USER', id: 'kbs-t6-source-curator' }, 'source', '2026-09-04T07:01:00.000Z')
});
const artifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.real-kbs-t6-positive-v2.prohibition-excerpts',
  version: '1',
  sourceRef: source.ref,
  bytes: excerptBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'kbs-2015-prohibition-curated-excerpts',
  acquisition: {
    method: 'CURATED_PAGE_TRANSCRIPTION',
    acquiredAt: '2026-08-27T03:45:00.000Z',
    locator: SOURCE_LOCATOR,
    metadata: { sourcePage: 10, transcriptionPolicy: 'WHITESPACE_NORMALIZED_NO_SEMANTIC_EDIT' }
  },
  metadata: { originalPdfBytesRetainedByThisBenchmark: false, exactExcerptBytesRetained: true },
  audit: audit({ type: 'USER', id: 'kbs-t6-source-curator' }, 'artifact', '2026-09-04T07:02:00.000Z')
});
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.real-kbs-t6-positive-v2',
  version: '1',
  compilerId: 'adr.real-kbs-t6-positive-v2.curated',
  implementationVersion: '1',
  configuration: { sourcePolicy: 'CURATED_SOURCE_FAITHFUL_GOLD_FIXTURE', locatorScheme: 'PDF_PAGE_TEXT_V1' },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'kbs-t6-compiler' }, 'compiler', '2026-09-04T07:03:00.000Z')
});
const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
  compilationLogicalId: 'compilation.real-kbs-t6-positive-v2.no-nitrogen',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: T6.key,
      claimType: 'BOUNDARY_CONSTRAINT',
      assertion: T6.assertion,
      sourceLocator: locator(T6.evidenceText),
      sourceContext: contextFamilies()
    }],
    runMetadata: { benchmark: 'REAL_KBS_T6_POSITIVE_APPLICABILITY_V2' }
  },
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'kbs-t6-compiler' }, 'compilation', '2026-09-04T07:04:00.000Z')
});

const reviewer = createPrincipal({ principalId: 'kbs-t6-positive-v2-reviewer', type: 'USER', ...OWNERSHIP });
const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit(reviewer, 'reviewer-role', '2026-09-04T07:05:00.000Z')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-t6-positive-v2.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(reviewer, 'review-policy', '2026-09-04T07:06:00.000Z')
});
const reviewAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: serviceAudit('iam-engine', 'review-auth', '2026-09-04T07:07:00.000Z')
});
const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
  reviewLogicalId: 'review.real-kbs-t6-positive-v2.no-nitrogen',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.real-kbs-t6-positive-v2.no-nitrogen',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.real-kbs-t6-positive-v2.no-nitrogen',
  sourceContextVersion: '1',
  audit: audit(reviewer, 'source-faithful-review', '2026-09-04T07:08:00.000Z')
});

const approver = createPrincipal({ principalId: 'kbs-t6-positive-v2-scientific-approver', type: 'USER', ...OWNERSHIP });
const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit(approver, 'approver-role', '2026-09-04T07:09:00.000Z')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-t6-positive-v2.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit(approver, 'qualification-policy', '2026-09-04T07:10:00.000Z')
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
  audit: serviceAudit('iam-engine', 'qualification-auth', '2026-09-04T07:11:00.000Z')
});
const qualificationService = new ScientificQualificationService({ ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.real-kbs-t6-positive-v2.no-nitrogen',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: EXPECTED_PRECONDITIONS,
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit(approver, 'qualification', '2026-09-04T07:12:00.000Z')
});
const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.real-kbs-t6-positive-v2.no-nitrogen',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit(approver, 'qualified-knowledge', '2026-09-04T07:13:00.000Z')
});
const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions
  .map((entry) => entry.value)
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(frozenPreconditions, [...EXPECTED_PRECONDITIONS].sort((a, b) => a.semanticId.localeCompare(b.semanticId)));
assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);

const releaseManager = createPrincipal({
  principalId: 'kbs-t6-positive-v2-release-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const releaseRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'kbs-t6-positive-v2-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role', '2026-09-04T07:14:00.000Z')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.kbs-t6-positive-v2.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(knowledge.ref),
  ownership: knowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: audit(releaseManager, 'release-policy', '2026-09-04T07:15:00.000Z')
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
  audit: serviceAudit('iam-engine', 'release-auth', '2026-09-04T07:16:00.000Z')
});
const release = new KnowledgeReleaseService({ ledger }).publishRelease({
  logicalId: 'release.real-kbs-t6-positive-v2',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: knowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuth.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-publish', '2026-09-04T07:17:00.000Z')
}).release;

const profileManager = createPrincipal({
  principalId: 'kbs-t6-positive-v2-profile-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const profileRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'kbs-t6-positive-v2-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role', '2026-09-04T07:18:00.000Z')
});
const profileLogicalId = 'runtime-profile.real-kbs-t6-positive-v2';
const profileDecision = authorizeRuntimeProfileManage({
  principal: profileManager,
  roleAssignments: [profileRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE', resourceId: profileLogicalId }
});
assert.equal(profileDecision.allowed, true);
const profileAuth = recordAuthorizationDecision({
  ledger,
  decision: profileDecision,
  audit: serviceAudit('iam-engine', 'profile-auth', '2026-09-04T07:18:30.000Z')
});
const requiredSemanticIds = ['crop.code', 'site.name', 'treatment.name'];
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
  audit: audit(profileManager, 'profile-publish', '2026-09-04T07:19:00.000Z')
});
validateRuntimeProfileAuthority({ ledger, runtimeProfileRef: profile.ref });

const deploymentManager = createPrincipal({
  principalId: 'kbs-t6-positive-v2-deployment-manager', type: 'USER', ...OWNERSHIP, programIds: ['pilot-a']
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: audit(deploymentManager, 'deployment-role', '2026-09-04T07:19:10.000Z')
});
const deploymentPayload = {
  contractVersion: DEPLOYMENT_CONTRACT_VERSION,
  runtimeProfileRef: profile.ref,
  deploymentScope: {
    ...RELEASE_TARGET,
    regions: ['KBS_MAIN_SITE'],
    crops: ['ALFALFA'],
    decisionTypes: [KBS_T6_DECISION_TYPE]
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
const deploymentLogicalId = 'deployment.real-kbs-t6-positive-v2';
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
  audit: serviceAudit('iam-engine', 'deployment-auth', '2026-09-04T07:19:20.000Z')
});
const deployment = publishDeployment({
  ledger,
  logicalId: deploymentLogicalId,
  version: '1',
  deployment: deploymentPayload,
  principal: deploymentManager,
  authorizationDecisionAuditRef: deploymentAuth.ref,
  audit: audit(deploymentManager, 'deployment-publish', '2026-09-04T07:19:30.000Z')
});
validateDeploymentAuthority({ ledger, deploymentRef: deployment.ref });

const runtimePrincipal = createPrincipal({
  principalId: 'kbs-t6-positive-v2-runtime-service', type: 'SERVICE_ACCOUNT', ...OWNERSHIP, programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.kbs-t6-positive-v2.runtime-service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: audit(runtimePrincipal, 'runtime-role', '2026-09-04T07:19:40.000Z')
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
  audit: serviceAudit('iam-engine', 'runtime-auth', '2026-09-04T07:19:50.000Z')
});

const retrieval = executeKnowledgeRetrieval({
  ledger,
  logicalId: 'retrieval.real-kbs-t6-positive-v2',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish', '2026-09-04T07:20:00.000Z')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: retrieval.ref });
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs, [knowledge.ref]);

const applicability = assessKnowledgeApplicability({
  ledger,
  logicalId: 'applicability.real-kbs-t6-positive-v2',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: knowledge.ref,
  contextManifestRef: manifest.ref,
  snapshotStore,
  audit: audit(runtimePrincipal, 'applicability-publish', '2026-09-04T07:21:00.000Z')
});
const validatedApplicability = validateApplicabilityAssessment({ ledger, applicabilityAssessmentRef: applicability.ref });
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

const targetIndex = Object.fromEntries(validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload.value]));
assert.deepEqual(targetIndex['crop.code'], { type: 'CATEGORY', category: 'alfalfa' });
assert.deepEqual(targetIndex['site.name'], { type: 'STRING', string: 'Kellogg Biological Station' });
assert.deepEqual(targetIndex['treatment.name'], { type: 'STRING', string: 'Main Site Treatment 6' });
assert.ok(new Date(KBS_T6_LOGICAL_TIME) > new Date(world.validatedManifest.semanticPayload.evidenceCutoff));

const records = ledger.exportSnapshot().records;
const forbiddenKinds = new Set([
  'RuntimeBinding', 'RuntimeResult', 'RuntimeDatum', 'RuntimeAlternativeSet',
  'DecisionRobustness', 'DecisionResult', 'ExecutionReceipt', 'Outcome', 'OutcomeEvaluation'
]);
assert.equal(records.filter((record) => forbiddenKinds.has(record.ref.kind)).length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_NITROGEN_POSITIVE_A08',
  classification: 'REAL_SOURCE_POSITIVE_APPLICABILITY_TEST_ONLY',
  targetWorld: {
    source: 'KBS_PUBLIC_TARGET_CONTEXT_ADAPTER',
    contextManifestRef: manifest.ref,
    contextSemanticIds: requiredSemanticIds,
    replayClass: world.validatedManifest.semanticPayload.replayClass,
    targetRefPromotedToFarmOrField: false
  },
  knowledgeWorld: {
    source: 'KBS_2015_LTER_PROTOCOL_T6',
    sourceArtifactHash: EXPECTED_EXCERPT_HASH,
    qualifiedKnowledgeRef: knowledge.ref,
    semanticPreconditions: frozenPreconditions
  },
  applicability: {
    assessmentRef: applicability.ref,
    scientificUseStatus: validatedApplicability.semanticPayload.scientificUseStatus,
    transportStatus: validatedApplicability.semanticPayload.transportStatus,
    runtimeUse: validatedApplicability.semanticPayload.runtimeUse,
    conditionResults: validatedApplicability.semanticPayload.conditionResults,
    missingContextSemanticIds: validatedApplicability.semanticPayload.missingContextSemanticIds
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  dec0034RequiredForPositiveA08: false,
  runtimePlanCompiled: false,
  runtimeBindingCreated: false,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));
