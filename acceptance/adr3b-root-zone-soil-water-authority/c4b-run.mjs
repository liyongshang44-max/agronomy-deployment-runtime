import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

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


const CORN_DECISION_TYPE = 'RETROSPECTIVE_IRRIGATION_SCIENTIFIC_APPLICABILITY';
const C4_EVIDENCE_CUTOFF = '2026-11-25T11:18:21.175Z';
const EVALUATION_AT = new Date().toISOString();
assert.ok(EVALUATION_AT > C4_EVIDENCE_CUTOFF);
const CORN_LOGICAL_TIME = EVALUATION_AT;
const CORN_DEADLINE = new Date(Date.parse(EVALUATION_AT)+3600000).toISOString();
const OWNERSHIP = KBS_T4R1_TARGET_OWNERSHIP;
const RELEASE_TARGET = Object.freeze({...OWNERSHIP,programId:'lp07-c4b-retrospective-only'});
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
    eventId: `evt-lp07-c4b-${seq}-${suffix}`,
    occurredAt: EVALUATION_AT,
    actor: { type: principal.type ?? 'USER', id: principal.principalId ?? principal.id },
    details: {
      suite: 'real-kbs-t4r1-corn-hybrid-population-decision-v1',
      classification: 'RETROSPECTIVE_SCIENTIFIC_APPLICABILITY_EVALUATION'
    }
  };
}
function serviceAudit(id, suffix, occurredAt) {
  return audit({ principalId: id, type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}
const decisionLogicalId = 'decision-problem.kbs-t4r1-2026.retrospective-irrigation-science';
const decisionRole = publishRoleAssignment({
  ledger,
  logicalId: `role.kbs-lp07-c4b.decision.${decisionLogicalId}`,
  version: '1',
  principal: targetPrincipal,
  role: 'KBS_T4R1_C4B_DECISION_CREATOR',
  roleDefinitionVersion: 'kbs-lp07-c4b-decision-v1',
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
    objective: { code: 'RETROSPECTIVE_SCIENTIFIC_APPLICABILITY_EVALUATION' },
    actionSpace: ['ABSTAIN'],
    constraints: [{
      type: 'RETROSPECTIVE_EVALUATION_SLICE',
      start: '2026-08-25T04:00:00.000Z',
      end: '2026-08-25T10:00:00.000Z',
      targetContextSelector: {
        semanticId: 'replicate.code',
        operator: 'EQUALS',
        value: 'R1'
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
    logicalId: `role.kbs-lp07-c4b.manifest.${logicalId}`,
    version: '1',
    principal: targetPrincipal,
    role: 'KBS_T4R1_C4B_CONTEXT_GATEWAY',
    roleDefinitionVersion: 'kbs-lp07-c4b-decision-v1',
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

const manifestLogicalId = 'context-manifest.kbs-t4r1-2026.retrospective-irrigation-science';
const manifestAuth = publishManifestAuthorization(manifestLogicalId);
const manifest = publishContextManifest({
  ledger,
  logicalId: manifestLogicalId,
  version: '1',
  decisionProblemRef: decision.ref,
  evidenceCutoff: C4_EVIDENCE_CUTOFF,
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
assert.ok(new Date(C4_EVIDENCE_CUTOFF) < new Date(CORN_LOGICAL_TIME));


/* Replay original native programs with only ledger injection and export, in disposable
 * sibling copies. Original tracked bytes remain untouched. Exact C4 ref hashes below
 * are from the retained 2026-11-25 C4 receipt, not from this replay. */
const originalSpecs = [
 ['mad','adr3b-irrigation-scientific-authority',
  '[{source,artifact,claim:reviewed.claim,sourceContext:reviewed.sourceContext,qualificationDecision,knowledge}]'],
 ['root','adr3b-root-zone-soil-water-authority','[csu,fao]']
];
const ledgerKey=Symbol.for('lp07-c4b.isolated-native-ledger');
assert.equal(globalThis[ledgerKey],undefined);
globalThis[ledgerKey]=ledger;
const originals=[];
try {
  for (const [tag,dir,expression] of originalSpecs) {
    const originalUrl=new URL('../'+dir+'/run.mjs',import.meta.url);
    const tempUrl=new URL('../'+dir+'/.c4b-replay-'+randomUUID()+'.mjs',import.meta.url);
    const original=readFileSync(originalUrl,'utf8');
    const needle='const ledger = new AuthorityLedger();';
    assert.equal(original.split(needle).length,2);
    const replay=original.replace(needle,"const ledger = globalThis[Symbol.for('lp07-c4b.isolated-native-ledger')];")+
      '\nexport const c4bOriginals = '+expression+';\n';
    writeFileSync(tempUrl,replay,{flag:'wx'});
    try { originals.push(...(await import(tempUrl.href)).c4bOriginals); }
    finally { unlinkSync(tempUrl); assert.equal(readFileSync(originalUrl,'utf8'),original); }
  }
} finally { delete globalThis[ledgerKey]; }
const fields=['source','artifact','claim','sourceContext','qualificationDecision','knowledge'];
const expected=[
 ['b1c4ab8e4d040d90b23af3f7111bdd29e30eace0faf9592a787161cd0f718e82','f054aaa9e7d3904c06eb61246f9d54139e9371b111f10e36ceae3899980dd25f','93eece2055d5883869374297d9379e8170405a8a890f0148e1dd7e6909c415aa','4eef943b885dd96544e44bd7f13cacf3fcefa5fc6aabc0ab086124c95f941cad','e997501b9cc6d592e128b6f58f5f77acdbae5e61cbb06e7b77222dfb5d5d955f','0148aebbebcfb6c58a59ff8a9017baa93c42f3752133ad6e9d5c3a52fd6789b4'],
 ['465a7102fe04516debe5f3b4eb544f3987eefa2adae03ca1f3aabd055dffce82','ba739b14f7ce20d1d6deee96bc8b3884b5a3c6184263cd0ab06e2c9b6f9f4307','b6592baeb1f98803fb90318887d1b4b310e2c006599b5cb611e494072a5de4e8','ae226f57e3ff604c8d1ad93b3d09d4524a87184da3a4a7bf8f7e7ee56d087b42','db2583fb6d51f37ef9c2d02fe2708c08e1f8c4d00031586ac03e84191dcfbfb1','ff62ddcf09932d1d67abce030bc23ece9b8ba5daee38e5f46f4532102352d302'],
 ['119822abe8865c4d9db4c8fe454130d74d2d92fdbb48ea4cb3beacdc2aa23c14','fbbd2cff3268b56675c776703dee4787c5933ba69aeb4c5d616a6227f228ecc6','3660603e0c4317e2e612320448cc8aafd03878e61f4f2c0dbf4bc6318f36443c','69b7a6b8434a447ec492e45f3d9ef3ff0ff44307be02b88fab2809442984bb9f','16f3e7479c06f1234165fa0bb71f6b1b3455e41321f84f8bddeaa691d01cad16','26bc487875a34e7fb16f7623c0610b5ac9af9f79e4e0d8f26ea0fa8d3776e521']
];
assert.equal(originals.length,3);
originals.forEach((item,i)=>fields.forEach((key,j)=>assert.equal(item[key].ref.semanticHash,'sha256:'+expected[i][j],key)));
const originalsBefore=JSON.stringify(originals);
const eq=(semanticId,value)=>({semanticId,operator:'EQUALS',value});
const interval=(semanticId)=>({semanticId,operator:'CONTEXT_DATUM_SUPPORT_MATCH',supportDimension:'VERTICAL_INTERVAL',requiredRelation:'EXACT_INTERVAL_MATCH',expectedSupportBasis:{kind:'CONTEXT_SEMANTIC_INTERVAL',semanticId:'soil_water.effective_root_interval',unit:'mm'}});
const common=[
 eq('soil_water.field_calibration_status','FIELD_CALIBRATED'),
 eq('soil_water.spatial_representativeness','TARGET_FIELD_VALIDATED'),
 eq('soil_water.effective_root_depth_authority','TARGET_FIELD_VALIDATED')
];
const rootConditions=[...common,interval('soil_water.root_zone_state')];
const tawConditions=[...common,interval('soil_water.field_capacity'),interval('soil_water.permanent_wilting_point')];
const service=new ScientificQualificationService({ledger});
const successors=originals.map((original,i)=>{
  const prev=original.qualificationDecision.semanticPayload;
  const approver=prev.approverPrincipal;
  const priorAuth=ledger.resolve(prev.authorizationDecisionAuditRef).semanticPayload;
  const policy=ledger.resolve(prev.qualificationPolicyRef);
  const roleAssignments=priorAuth.assignmentRefs.map(ref=>ledger.resolve(ref));
  const auth=recordAuthorizationDecision({ledger,decision:authorizeKnowledgeQualification({
    principal:approver,policy,roleAssignments,qualificationTarget:prev.qualificationTarget,
    authorizationScope:original.knowledge.semanticPayload.ownership
  }),audit:serviceAudit('lp07-c4b-iam','qualification-auth-'+i,EVALUATION_AT)});
  assert.equal(auth.semanticPayload.allowed,true);
  const conditions=[...prev.semanticPreconditions,...(i===2?tawConditions:rootConditions)];
  if(i===0)conditions.push(eq('soil_water.mad_parameter_authority','TARGET_CROP_STAGE_VALIDATED'));
  if(i===1)conditions.push(eq('soil_water.temporal_support','current day'));
  const qualification=service.recordQualificationDecision({
    decisionLogicalId:original.qualificationDecision.ref.logicalId,decisionVersion:'2',
    claimRef:original.claim.ref,sourceContextRef:original.sourceContext.ref,
    disposition:'QUALIFY_USE',qualificationTarget:prev.qualificationTarget,
    semanticPreconditions:conditions,
    limitations:[...prev.limitations,{code:'RETROSPECTIVE_ONLY_NO_ACTION_AUTHORITY'}],
    effectModifiers:prev.effectModifiers,
    transportConstraints:[...prev.transportConstraints.map(c=>({type:'CALIBRATION_REQUIRED',code:c.code})),
      {type:'CALIBRATION_REQUIRED',code:'TARGET_FIELD_CALIBRATION_NOT_ESTABLISHED'}],
    rationale:'Retrospective bounded scientific applicability evaluation; original source semantics retained; field measurement and calibration remain absent.',
    supersedesDecisionRef:original.qualificationDecision.ref,
    approverPrincipal:approver,authorizationDecisionAuditRef:auth.ref,
    audit:audit(approver,'qualification-v2-'+i,EVALUATION_AT)
  });
  const knowledge=service.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId:original.knowledge.ref.logicalId,qualifiedKnowledgeVersion:'2',
    qualificationDecisionRefs:[qualification.ref],supersedesQualifiedKnowledgeRef:original.knowledge.ref,
    audit:audit(approver,'qualified-knowledge-v2-'+i,EVALUATION_AT)
  });
  assert.deepEqual(knowledge.semanticPayload.claimRef,original.claim.ref);
  assert.deepEqual(knowledge.semanticPayload.sourceContextRef,original.sourceContext.ref);
  assert.deepEqual(knowledge.semanticPayload.supersedesQualifiedKnowledgeRef,original.knowledge.ref);
  return {qualification,knowledge};
});
assert.equal(JSON.stringify(originals),originalsBefore);
const releaseManager = createPrincipal({
  principalId: 'lp07-c4b-release-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const releaseRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.lp07-c4b.release-manager',
  version: '1',
  principal: releaseManager,
  role: 'KNOWLEDGE_RELEASE_MANAGER',
  roleDefinitionVersion: 'lp07-c4b',
  permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope: RELEASE_TARGET,
  audit: audit(releaseManager, 'release-role', '2026-09-05T00:15:20.000Z')
});

const memberEntitlements=[];
for(const {knowledge} of successors){
const releasePolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: `policy.lp07-c4b.release-member.${knowledge.ref.logicalId}`,
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

memberEntitlements.push({knowledgeRef:knowledge.ref,policyRef:releasePolicy.ref,authorizationDecisionAuditRef:releaseAuth.ref});
}
const release=new KnowledgeReleaseService({ledger}).publishRelease({
 logicalId:'release.lp07-c4b-retrospective-only',version:'1',memberEntitlements,
 publisherPrincipal:releaseManager,releaseTarget:RELEASE_TARGET,
 audit:audit(releaseManager,'release-publish',EVALUATION_AT)
}).release;
const profileManager = createPrincipal({
  principalId: 'lp07-c4b-profile-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const profileRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.lp07-c4b.profile-manager',
  version: '1',
  principal: profileManager,
  role: 'RUNTIME_PROFILE_MANAGER',
  roleDefinitionVersion: 'lp07-c4b',
  permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
  scope: { ...OWNERSHIP, resourceType: 'RUNTIME_PROFILE' },
  audit: audit(profileManager, 'profile-role', '2026-09-05T00:16:00.000Z')
});
const profileLogicalId = 'runtime-profile.lp07-c4b-retrospective';
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
const requiredSemanticIds = ['crop.code', 'replicate.code', 'treatment.code'];
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
  principalId: 'lp07-c4b-deployment-manager',
  type: 'USER',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const deploymentRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.lp07-c4b.deployment-manager',
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
  effectiveInterval: { start: C4_EVIDENCE_CUTOFF, end: CORN_DEADLINE },
  runtimeEnvironment: 'STAGING',
  rolloutStage: 'SHADOW'
};
assert.equal(deploymentNeedsProductionAuthority(deploymentPayload), false);
const deploymentLogicalId = 'deployment.lp07-c4b-retrospective';
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
  principalId: 'lp07-c4b-runtime-service',
  type: 'SERVICE_ACCOUNT',
  ...OWNERSHIP,
  programIds: [RELEASE_TARGET.programId]
});
const runtimeRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.lp07-c4b.runtime-service',
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
  logicalId: 'retrieval.lp07-c4b-retrospective',
  version: '1',
  decisionProblemRef: decision.ref,
  deploymentRef: deployment.ref,
  principal: runtimePrincipal,
  runtimeAuthorizationDecisionAuditRef: runtimeAuth.ref,
  config: {},
  audit: audit(runtimePrincipal, 'retrieval-publish', '2026-09-05T00:17:20.000Z')
});
const validatedRetrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: retrieval.ref });
assert.deepEqual(validatedRetrieval.semanticPayload.candidateRefs.map(x=>x.semanticHash).sort(), successors.map(x=>x.knowledge.ref.semanticHash).sort());


const assessments=[];
for(const {knowledge} of successors){
const applicability = assessKnowledgeApplicability({
  ledger,
  logicalId: `applicability.lp07-c4b.${knowledge.ref.logicalId}`,
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

const p=validatedApplicability.semanticPayload;
assert.notEqual(p.transportStatus,'DIRECTLY_APPLICABLE');
assert.notEqual(p.runtimeUse,'ALLOWED');
assert.deepEqual(p.knowledgeRef,knowledge.ref);
assert.deepEqual(p.contextManifestRef,manifest.ref);
assert.deepEqual(p.decisionProblemRef,decision.ref);
assert.deepEqual(p.knowledgeRetrievalResultRef,retrieval.ref);
assert.equal(p.unsupportedConstraintCodes.length,0);
assessments.push(validatedApplicability);
}
const snapshot=ledger.exportSnapshot();
assert.equal(snapshot.records.filter(r=>['DecisionResult','RuntimeResult','ExecutionReceipt','Outcome','OutcomeEvaluation'].includes(r.ref.kind)).length,0);
const receipt={
 work_package:'LP07-C4B-NATIVE-APPLICABILITY',
 classification:'RETROSPECTIVE_SCIENTIFIC_APPLICABILITY_EVALUATION',
 observed_at_utc:EVALUATION_AT, historical_subject:{from:'2026-08-25T04:00:00.000Z',through:'2026-08-25T10:00:00.000Z'},
 original_c4_receipt_observed_at:'2026-11-25T11:18:21.1745539Z',
 original_source_refs:originals.map(o=>Object.fromEntries(fields.map(k=>[k,o[k].ref]))),
 successor_qualifications:successors.map(o=>o.qualification),successor_knowledge:successors.map(o=>o.knowledge),
 provider_target:correspondenceWorld.providerTarget,geox_target:correspondenceProfile.geox,
 provider_hash:correspondenceWorld.providerHash,
 context_datums:validatedDatums.map(d=>({ref:d.ref,semanticPayload:d.semanticPayload})),
 context_manifest:validatedManifest,decision_problem:validatedDecision,
 knowledge_release:release,deployment,knowledge_retrieval:validatedRetrieval,applicability_assessments:assessments,
 field_calibration:'NOT_ESTABLISHED',actionable_irrigation:'HOLD',decision_result_not_authorized:true,automatic_execution:'HOLD',
 metric_boundary:'MCFT_STORAGE_DEFICIT_NOT_FAO56_AVAILABLE_WATER_DEPLETION_NOT_IRRIGATION_REQUIREMENT',
 product_read_contract:'NOT_DELIVERED_REQUIRES_EXISTING_READ_PROJECTION',
 authority_effect:'ISOLATED_TEST_ONLY_NO_PRODUCTION_AUTHORITY'
};
const output=process.env.LP07_C4B_RECEIPT;
if(output)writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log('LP07_C4B_NATIVE_RECEIPT='+JSON.stringify(receipt));
