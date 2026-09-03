import assert from 'node:assert/strict';

import {
  PERMISSIONS,
  authorizeDeploymentControl,
  authorizeDeploymentRuntimeRead,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeRuntimeProfileManage } from '../../packages/authorization/src/runtime-profile-control.mjs';
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
import {
  publishRuntimeBinding,
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import {
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';
import {
  env,
  decisionWorld,
  manifest,
  validatedManifest,
  deterministicDecisionIntent,
  evidenceCutoff,
  exactTargetId
} from '../gold-recorded-operation-context-manifest-governed-world-sustainable-corn/run.mjs';

const RELEASE_TARGET = Object.freeze({
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programId: 'pilot-a'
});
const FIXTURE_USE = Object.freeze({ use: 'MACHINE_ACCEPTANCE_FIXTURE' });
const NORMALIZED_DECISION_LOGICAL_TIME =
  new Date(deterministicDecisionIntent.logicalTime).toISOString();

let seq = 0;
function runtimeAudit(principal, suffix, occurredAt = '2026-08-31T01:00:00.000Z') {
  seq += 1;
  return {
    eventId: `evt-real-source-runtime-composition-${seq}-${suffix}`,
    occurredAt,
    actor: {
      type: principal.type ?? 'USER',
      id: principal.principalId
    },
    details: {
      suite: 'real-source-runtime-composition-sustainable-corn',
      classification: 'RETROSPECTIVE_MACHINE_ACCEPTANCE_TEST_ONLY'
    }
  };
}

function serviceAudit(id, suffix) {
  return runtimeAudit(
    { principalId: id, type: 'SERVICE_ACCOUNT' },
    suffix
  );
}

assert.equal(
  validatedManifest.classification,
  'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD'
);
assert.equal(
  validatedManifest.manifest.record.ref.semanticHash,
  manifest.ref.semanticHash
);
assert.equal(
  validatedManifest.manifest.semanticPayload.targetRef.farmId,
  exactTargetId
);
assert.equal(
  validatedManifest.manifest.semanticPayload.evidenceCutoff,
  evidenceCutoff
);
assert.equal(
  validatedManifest.manifest.semanticPayload.logicalTime,
  NORMALIZED_DECISION_LOGICAL_TIME
);
assert.deepEqual(
  validatedManifest.manifest.semanticPayload.datumRefs,
  [validatedManifest.contextDatum.ref]
);

// Machine-acceptance Knowledge only. It is deliberately synthetic and proves
// composition mechanics, not agronomic correctness or production usefulness.
const baseKnowledge = makeQualifiedKnowledge(env, {
  label: 'real-source-runtime-composition',
  assertion:
    'Machine acceptance fixture knowledge is eligible only for the exact retained planting-date context used by this composition proof.',
  useTarget: FIXTURE_USE
});

const plantingDateQualification =
  baseKnowledge.qualification.recordQualificationDecision({
    decisionLogicalId:
      'qualification.real-source-runtime-composition.planting-date',
    decisionVersion: '2',
    claimRef: baseKnowledge.reviewed.claim.ref,
    sourceContextRef: baseKnowledge.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: FIXTURE_USE,
    semanticPreconditions: [{
      semanticId: 'crop.planting_date',
      operator: 'EQUALS',
      value: { type: 'DATE', date: '2011-05-03' }
    }],
    approverPrincipal: baseKnowledge.approver,
    authorizationDecisionAuditRef:
      baseKnowledge.decision.semanticPayload.authorizationDecisionAuditRef,
    supersedesDecisionRef: baseKnowledge.decision.ref,
    audit: runtimeAudit(
      baseKnowledge.approver,
      'qualification-planting-date'
    )
  });

const qualifiedKnowledge =
  baseKnowledge.qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId:
      'knowledge.real-source-runtime-composition.planting-date',
    qualifiedKnowledgeVersion: '2',
    qualificationDecisionRefs: [plantingDateQualification.ref],
    supersedesQualifiedKnowledgeRef: baseKnowledge.knowledge.ref,
    audit: runtimeAudit(
      baseKnowledge.approver,
      'qualified-knowledge-planting-date'
    )
  });

const releaseManager = createPrincipal({
  principalId: 'real-source-runtime-release-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const releaseManagerRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-source-runtime.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'real-source-runtime-composition-v1',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: runtimeAudit(releaseManager, 'release-manager-role')
});
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger: env.ledger,
  logicalId: 'policy.real-source-runtime.release-member',
  version: '1',
  resourceId: releaseMemberResourceId(qualifiedKnowledge.ref),
  ownership: qualifiedKnowledge.semanticPayload.ownership,
  visibilityPolicy: [{ principalId: releaseManager.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [RELEASE_TARGET],
  audit: runtimeAudit(releaseManager, 'release-member-policy')
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
const release = new KnowledgeReleaseService({
  ledger: env.ledger
}).publishRelease({
  logicalId: 'release.real-source-runtime-composition',
  version: '1',
  memberEntitlements: [{
    knowledgeRef: qualifiedKnowledge.ref,
    policyRef: releasePolicy.ref,
    authorizationDecisionAuditRef: releaseAuthorization.ref
  }],
  publisherPrincipal: releaseManager,
  releaseTarget: RELEASE_TARGET,
  audit: runtimeAudit(releaseManager, 'release-publication')
}).release;

const profileManager = createPrincipal({
  principalId: 'real-source-runtime-profile-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const profileManagerRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-source-runtime.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'real-source-runtime-composition-v1',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'RUNTIME_PROFILE'
  },
  audit: runtimeAudit(profileManager, 'profile-manager-role')
});

const profileLogicalId = 'runtime-profile.real-source-runtime-composition';
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
    controlScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a'
    },
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
      usePurposes: ['MACHINE_ACCEPTANCE_FIXTURE'],
      useClasses: ['TEST_ONLY'],
      runtimeEnvironments: ['STAGING'],
      rolloutStages: ['SHADOW']
    }
  },
  principal: profileManager,
  authorizationDecisionAuditRef: profileAuthorization.ref,
  audit: runtimeAudit(profileManager, 'profile-publication')
});
validateRuntimeProfileAuthority({
  ledger: env.ledger,
  runtimeProfileRef: profile.ref
});

const deploymentManager = createPrincipal({
  principalId: 'real-source-runtime-deployment-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const deploymentManagerRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-source-runtime.deployment-manager',
  version: '1',
  principal: deploymentManager,
  role: 'DEPLOYMENT_MANAGER',
  scope: RELEASE_TARGET,
  audit: runtimeAudit(deploymentManager, 'deployment-manager-role')
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
    decisionTypes: ['MACHINE_ACCEPTANCE_FIXTURE_DECISION']
  },
  authorizedUse: {
    usePurposes: ['MACHINE_ACCEPTANCE_FIXTURE'],
    useClasses: ['TEST_ONLY']
  },
  effectiveInterval: {
    start: '2026-08-01T00:00:00.000Z',
    end: '2026-09-30T00:00:00.000Z'
  },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);

const deploymentLogicalId = 'deployment.real-source-runtime-composition';
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
  audit: runtimeAudit(deploymentManager, 'deployment-publication')
});
validateDeploymentAuthority({
  ledger: env.ledger,
  deploymentRef: deployment.ref
});

const runtimePrincipal = createPrincipal({
  principalId: 'real-source-runtime-service',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.real-source-runtime.service',
  version: '1',
  principal: runtimePrincipal,
  role: 'RUNTIME_SERVICE',
  scope: RELEASE_TARGET,
  audit: runtimeAudit(runtimePrincipal, 'runtime-service-role')
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

const retrieval = executeKnowledgeRetrieval({
  ledger: env.ledger,
  logicalId: 'retrieval.real-source-runtime-composition',
  version: '1',
  decisionProblemRef: decisionWorld.published.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuthorization.ref,
  config: {},
  audit: runtimeAudit(runtimePrincipal, 'retrieval-publication')
});
const retrievalValidated = validateKnowledgeRetrievalResult({
  ledger: env.ledger,
  knowledgeRetrievalResultRef: retrieval.ref
});
assert.deepEqual(retrievalValidated.semanticPayload.candidateRefs, [
  qualifiedKnowledge.ref
]);
assert.equal(
  retrievalValidated.semanticPayload.decisionProblemRef.semanticHash,
  decisionWorld.published.ref.semanticHash
);

const applicability = assessKnowledgeApplicability({
  ledger: env.ledger,
  logicalId: 'applicability.real-source-runtime-composition',
  version: '1',
  knowledgeRetrievalResultRef: retrieval.ref,
  knowledgeRef: qualifiedKnowledge.ref,
  contextManifestRef: manifest.ref,
  audit: runtimeAudit(runtimePrincipal, 'applicability-publication')
});
const applicabilityValidated = validateApplicabilityAssessment({
  ledger: env.ledger,
  applicabilityAssessmentRef: applicability.ref
});

assert.equal(
  applicabilityValidated.semanticPayload.transportStatus,
  'DIRECTLY_APPLICABLE'
);
assert.equal(
  applicabilityValidated.semanticPayload.runtimeUse,
  'ALLOWED'
);
assert.deepEqual(
  applicabilityValidated.semanticPayload.missingContextSemanticIds,
  []
);
const plantingDateCondition =
  applicabilityValidated.semanticPayload.conditionResults.find(
    (condition) =>
      condition.semanticId === 'crop.planting_date'
      && condition.source === 'SEMANTIC_PRECONDITION'
  );
assert.ok(plantingDateCondition);
assert.equal(plantingDateCondition.status, 'MATCH');
assert.deepEqual(
  plantingDateCondition.target,
  { type: 'DATE', date: '2011-05-03' }
);

const plan = compileRuntimePlan({
  ledger: env.ledger,
  decisionProblemRef: decisionWorld.published.ref,
  deploymentRef: deployment.ref,
  runtimeProfileRef: profile.ref,
  contextManifestRef: manifest.ref,
  knowledgeRetrievalResultRef: retrieval.ref,
  applicabilityAssessmentRefs: [applicability.ref]
});
assert.equal(plan.openRequirements.length, 0);
assert.equal(plan.alternativePaths.length, 1);
assert.equal(plan.alternativePaths[0].compilerState, 'STRUCTURALLY_COMPLETE');

const eligibility = publishRuntimeEligibility({
  ledger: env.ledger,
  logicalId: 'runtime-eligibility.real-source-runtime-composition',
  version: '1',
  runtimePlan: plan,
  audit: runtimeAudit(runtimePrincipal, 'runtime-eligibility-publication')
});
const eligibilityValidated = validateRuntimeEligibility({
  ledger: env.ledger,
  runtimeEligibilityRef: eligibility.ref
});
assert.equal(
  eligibilityValidated.semanticPayload.runtimeEligibility,
  'RUNTIME_ELIGIBLE'
);
const legalPath =
  eligibilityValidated.semanticPayload.alternativeEvaluations.find(
    (item) => item.disposition === 'LEGAL'
  );
assert.ok(legalPath);

const binding = publishRuntimeBinding({
  ledger: env.ledger,
  logicalId: 'runtime-binding.real-source-runtime-composition',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  selectedAlternativePathId: legalPath.pathId,
  audit: runtimeAudit(runtimePrincipal, 'runtime-binding-publication')
});
const bindingValidated = validateRuntimeBinding({
  ledger: env.ledger,
  runtimeBindingRef: binding.ref
});

assert.equal(
  bindingValidated.semanticPayload.contextManifestRef.semanticHash,
  manifest.ref.semanticHash
);
assert.equal(
  bindingValidated.semanticPayload.decisionProblemRef.semanticHash,
  decisionWorld.published.ref.semanticHash
);
assert.equal(
  bindingValidated.semanticPayload.knowledgeReleaseRef.semanticHash,
  release.ref.semanticHash
);
assert.equal(
  bindingValidated.semanticPayload.logicalTime,
  NORMALIZED_DECISION_LOGICAL_TIME
);
assert.equal(
  bindingValidated.semanticPayload.evidenceCutoff,
  evidenceCutoff
);
assert.deepEqual(
  bindingValidated.semanticPayload.knowledgeBindings,
  [{
    knowledgeRef: qualifiedKnowledge.ref,
    applicabilityAssessmentRef: applicability.ref
  }]
);
assert.equal(
  bindingValidated.semanticPayload.correctnessClaim,
  'NONE_RUNTIME_BINDING_IS_COMPOSITION_NOT_CORRECTNESS'
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
const forbiddenRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'FIRST_REAL_SOURCE_RUNTIME_COMPOSITION_PROOF',
  classification: 'RETROSPECTIVE_MACHINE_ACCEPTANCE_TEST_ONLY',
  contextWorld: {
    decisionProblemRef: decisionWorld.published.ref,
    contextManifestRef: manifest.ref,
    sourceBackedFarmId: exactTargetId,
    logicalTime: NORMALIZED_DECISION_LOGICAL_TIME,
    evidenceCutoff,
    replayClass: validatedManifest.manifest.semanticPayload.replayClass
  },
  knowledgeWorld: {
    classification: 'SYNTHETIC_MACHINE_ACCEPTANCE_KNOWLEDGE_NOT_REAL_AGRONOMIC_KNOWLEDGE',
    qualifiedKnowledgeRef: qualifiedKnowledge.ref,
    knowledgeReleaseRef: release.ref,
    materialPrecondition: {
      semanticId: 'crop.planting_date',
      operator: 'EQUALS',
      expected: { type: 'DATE', date: '2011-05-03' }
    }
  },
  composition: {
    runtimeProfileRef: profile.ref,
    deploymentRef: deployment.ref,
    retrievalRef: retrieval.ref,
    applicabilityAssessmentRef: applicability.ref,
    applicabilityConditionStatus: plantingDateCondition.status,
    runtimePlanId: plan.planId,
    runtimePlanHash: plan.planHash,
    runtimeEligibilityRef: eligibility.ref,
    runtimeEligibility: eligibilityValidated.semanticPayload.runtimeEligibility,
    runtimeBindingRef: binding.ref
  },
  genericRuntimeContractsModified: false,
  realSourceDatumMateriallyConsumed: true,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false,
  noLookaheadClaim: false,
  agronomicCorrectnessClaim: false,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
