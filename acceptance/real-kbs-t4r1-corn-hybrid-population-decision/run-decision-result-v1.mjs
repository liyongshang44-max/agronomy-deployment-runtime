import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import {
  POLICY_CONTRACT_VERSION_V3,
  publishPolicy,
  validateSpecificationAuthority
} from '../../packages/specification-registry/src/index.mjs';
import {
  IMPLEMENTATION_CONTRACT_VERSION,
  publishImplementation,
  validateImplementationAuthority
} from '../../packages/implementation-registry/src/index.mjs';
import {
  publishImplementationConformance,
  validateImplementationConformance
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  ImplementationExecutorRegistry,
  RuntimeExecutionBroker,
  RuntimeExecutionIdempotencyStore
} from '../../packages/implementation-broker/src/index.mjs';
import {
  publishRuntimeBinding,
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import {
  publishRuntimeAlternativeSet,
  validateRuntimeAlternativeSet
} from '../../packages/runtime-alternative-set/src/index.mjs';
import {
  publishDecisionRobustness,
  validateDecisionRobustness
} from '../../packages/decision-robustness/src/index.mjs';
import {
  publishDecisionResult,
  validateDecisionResult
} from '../../packages/decision-result/src/index.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '../../adapters/geox/src/target-correspondence-profile-registry.mjs';
import { evaluateCornSeedingRateRange } from './corn-policy-executor.mjs';
import {
  CORN_DECISION_TYPE,
  CORN_TARGET_OWNERSHIP,
  cornRuntimeWorld
} from './run-runtime-composition-v1.mjs';

const OWNERSHIP = CORN_TARGET_OWNERSHIP;
const EXPECTED_IMPLEMENTATION_HASH = 'sha256:c506d294fe1daf630b0a0ed640af34085f404ba77e18f800d13a4b22c5301083';
const EXPECTED_LIMITATION_CODE = 'RECOMMENDED_RANGE_NOT_HISTORICAL_OPERATION_TRUTH';
const ACTION_CODE = 'SET_CORN_SEEDING_RATE_RANGE';
const MIN_PARAMETER = Object.freeze({
  name: 'minimum_population',
  semanticId: 'planting.population_recommended_min_seeds_per_acre',
  valueType: 'DECIMAL',
  unit: 'seed/acre',
  required: true,
  material: true
});
const MAX_PARAMETER = Object.freeze({
  name: 'maximum_population',
  semanticId: 'planting.population_recommended_max_seeds_per_acre',
  valueType: 'DECIMAL',
  unit: 'seed/acre',
  required: true,
  material: true
});
const CAPABILITY = 'CORN_HYBRID_POPULATION_RANGE_POLICY_V1';

const {
  ledger,
  snapshotStore,
  correspondenceWorld,
  correspondenceProfile,
  decision,
  manifest,
  validatedDatums,
  knowledge,
  profile,
  eligibility,
  runtimePrincipal,
  limitedLegalPaths
} = cornRuntimeWorld;

assert.equal(limitedLegalPaths.length, 1);
assert.equal(profile.semanticPayload.contractVersion, 'adr.runtime-profile.v2');
assert.deepEqual(profile.semanticPayload.robustnessRequirement, {
  comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
  sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION']
});
assert.equal(correspondenceProfile.relation, GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.deepEqual(decision.semanticPayload.targetRef, correspondenceWorld.decision.semanticPayload.targetRef);

let seq = 0;
function audit(principal, suffix, occurredAt) {
  seq += 1;
  return {
    eventId: `evt-t4r1-corn-decision-result-v1-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: {
      suite: 'real-kbs-t4r1-corn-hybrid-population-decision-result-v1',
      classification: 'SAME_TARGET_REAL_SOURCE_DECISION_RESULT_SHADOW_QUALIFICATION_ONLY'
    }
  };
}
function serviceAudit(suffix, occurredAt) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}
function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const executorBytes = readFileSync(new URL('./corn-policy-executor.mjs', import.meta.url));
const executorHash = `sha256:${createHash('sha256').update(executorBytes).digest('hex')}`;
assert.equal(executorHash, EXPECTED_IMPLEMENTATION_HASH);

const specManager = createPrincipal({
  principalId: 't4r1-corn-policy-v1-spec-manager',
  type: 'USER',
  ...OWNERSHIP
});
const specRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-policy-v1.spec-manager',
  version: '1',
  principal: specManager,
  role: 'SPECIFICATION_MANAGER',
  roleDefinitionVersion: 't4r1-corn-s01-v1',
  permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
  scope: OWNERSHIP,
  audit: audit(specManager, 'spec-role', '2026-09-05T00:30:00.000Z')
});
const policyLogicalId = 'policy.real-blue-river-43-96p-population-range-v1';
const specDecision = authorizeSpecificationManage({
  principal: specManager,
  roleAssignments: [specRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'POLICY', resourceId: policyLogicalId }
});
assert.equal(specDecision.allowed, true);
const specAuth = recordAuthorizationDecision({
  ledger,
  decision: specDecision,
  audit: serviceAudit('spec-auth', '2026-09-05T00:30:10.000Z')
});

const policy = publishPolicy({
  ledger,
  logicalId: policyLogicalId,
  version: '1',
  specification: {
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    controlScope: OWNERSHIP,
    decisionType: CORN_DECISION_TYPE,
    actionSpace: [ACTION_CODE, 'ABSTAIN'],
    actionSemantics: {
      equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
      actions: [
        {
          actionCode: ACTION_CODE,
          parameters: [MIN_PARAMETER, MAX_PARAMETER]
        },
        { actionCode: 'ABSTAIN', parameters: [] }
      ]
    },
    requiredInputs: [
      {
        semanticId: 'crop.code',
        valueType: 'CATEGORY',
        unit: 'NOT_APPLICABLE',
        epistemicClasses: ['ASSERTION']
      },
      {
        semanticId: 'planting.hybrid',
        valueType: 'STRING',
        unit: 'NOT_APPLICABLE',
        epistemicClasses: ['ASSERTION']
      }
    ],
    requiredRuntimeOutputs: [],
    decisionLogic: {
      methodId: 'adr.acceptance.real-blue-river-43-96p-population-range-v1',
      definitionHash: executorHash
    },
    thresholdAuthority: {
      mode: 'EXTERNAL_AUTHORITY',
      authorityRefs: [knowledge.ref]
    },
    operationalConstraints: [
      'EXACT_CONTEXT_ONLY',
      'NO_TARGET_SIDE_PLANTING_POPULATION_AS_DECISION_INPUT',
      'RETURN_RECOMMENDED_RANGE_WITHOUT_SYNTHETIC_POINT_ESTIMATE'
    ],
    jurisdictionConstraints: [],
    humanGate: { mode: 'NONE' },
    fallback: { disposition: 'ABSTAIN' },
    abstentionConditions: ['CONTEXT_MISMATCH'],
    limitations: [EXPECTED_LIMITATION_CODE]
  },
  principal: specManager,
  authorizationDecisionAuditRef: specAuth.ref,
  audit: audit(specManager, 'policy-publish', '2026-09-05T00:30:20.000Z')
});
const validatedPolicy = validateSpecificationAuthority({ ledger, specificationRef: policy.ref });
assert.equal(validatedPolicy.semanticPayload.contractVersion, POLICY_CONTRACT_VERSION_V3);
assert.equal(validatedPolicy.semanticPayload.thresholdAuthority.mode, 'EXTERNAL_AUTHORITY');
assert.deepEqual(validatedPolicy.semanticPayload.thresholdAuthority.authorityRefs, [knowledge.ref]);
assert.equal(validatedPolicy.semanticPayload.requiredRuntimeOutputs.length, 0);
const requiredInputSemanticIds = validatedPolicy.semanticPayload.requiredInputs
  .map((item) => item.semanticId)
  .sort();
assert.deepEqual(requiredInputSemanticIds, ['crop.code', 'planting.hybrid']);
const requiredInputSemanticIdSet = new Set(requiredInputSemanticIds);
const exactInputDatums = validatedDatums.filter((datum) =>
  requiredInputSemanticIdSet.has(datum.semanticPayload.semanticId)
);
assert.deepEqual(
  exactInputDatums.map((datum) => datum.semanticPayload.semanticId).sort(),
  requiredInputSemanticIds
);

const implementationManager = createPrincipal({
  principalId: 't4r1-corn-policy-v1-implementation-manager',
  type: 'USER',
  ...OWNERSHIP
});
const implementationRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-policy-v1.implementation-manager',
  version: '1',
  principal: implementationManager,
  role: 'IMPLEMENTATION_MANAGER',
  roleDefinitionVersion: 't4r1-corn-s02-v1',
  permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
  scope: OWNERSHIP,
  audit: audit(implementationManager, 'implementation-role', '2026-09-05T00:31:00.000Z')
});
const implementationLogicalId = 'implementation.real-blue-river-43-96p-population-range-v1';
const implementationDecision = authorizeImplementationManage({
  principal: implementationManager,
  roleAssignments: [implementationRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'IMPLEMENTATION', resourceId: implementationLogicalId }
});
assert.equal(implementationDecision.allowed, true);
const implementationAuth = recordAuthorizationDecision({
  ledger,
  decision: implementationDecision,
  audit: serviceAudit('implementation-auth', '2026-09-05T00:31:10.000Z')
});
const implementation = publishImplementation({
  ledger,
  logicalId: implementationLogicalId,
  version: '1',
  implementation: {
    contractVersion: IMPLEMENTATION_CONTRACT_VERSION,
    controlScope: OWNERSHIP,
    providerType: 'INTERNAL',
    implementationDigest: executorHash,
    executionLocator: {
      kind: 'INTERNAL_FUNCTION',
      value: 'adr.acceptance.evaluateCornSeedingRateRangeV1'
    },
    artifact: {
      artifactId: 'artifact:acceptance:corn-seeding-rate-range-executor-v1',
      contentHash: executorHash
    },
    runtimeMetadata: {
      runtime: 'node',
      runtimeVersion: '24',
      platform: 'linux',
      architecture: 'x64'
    },
    operationalConstraints: ['NO_DYNAMIC_CODE_LOADING', 'DETERMINISTIC_CONTEXT_ONLY'],
    conformanceClaim: 'NONE_REGISTRATION_ONLY'
  },
  principal: implementationManager,
  authorizationDecisionAuditRef: implementationAuth.ref,
  audit: audit(implementationManager, 'implementation-publish', '2026-09-05T00:31:20.000Z')
});
const validatedImplementation = validateImplementationAuthority({ ledger, implementationRef: implementation.ref });
assert.equal(validatedImplementation.semanticPayload.artifact.contentHash, EXPECTED_IMPLEMENTATION_HASH);

const qualifier = createPrincipal({
  principalId: 't4r1-corn-policy-v1-conformance-qualifier',
  type: 'USER',
  ...OWNERSHIP
});
const qualifierRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.t4r1-corn-policy-v1.conformance-qualifier',
  version: '1',
  principal: qualifier,
  role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
  roleDefinitionVersion: 't4r1-corn-s03-v1',
  permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
  scope: OWNERSHIP,
  audit: audit(qualifier, 'conformance-role', '2026-09-05T00:32:00.000Z')
});
const conformanceLogicalId = 'conformance.real-blue-river-43-96p-population-range-v1';
const conformanceDecision = authorizeImplementationConformanceQualification({
  principal: qualifier,
  roleAssignments: [qualifierRole],
  authorizationScope: {
    ...OWNERSHIP,
    resourceType: 'IMPLEMENTATION_CONFORMANCE',
    resourceId: conformanceLogicalId
  }
});
assert.equal(conformanceDecision.allowed, true);
const conformanceAuth = recordAuthorizationDecision({
  ledger,
  decision: conformanceDecision,
  audit: serviceAudit('conformance-auth', '2026-09-05T00:32:10.000Z')
});
const conformance = publishImplementationConformance({
  ledger,
  logicalId: conformanceLogicalId,
  version: '1',
  specificationRef: policy.ref,
  implementationRef: implementation.ref,
  controlScope: OWNERSHIP,
  qualificationMethod: {
    methodId: 'adr.acceptance.real-t4r1-corn-policy-conformance-v1',
    definitionHash: sha256Text('real t4r1 corn hybrid population range policy conformance v1')
  },
  compatibilityTests: [
    {
      testType: 'INPUT_CONTRACT_COMPATIBILITY',
      testId: 't4r1-corn-context-input-contract',
      definitionHash: sha256Text('t4r1 corn context input contract'),
      resultHash: sha256Text('PASS t4r1 corn context input contract'),
      outcome: 'PASS'
    },
    {
      testType: 'OUTPUT_CONTRACT_COMPATIBILITY',
      testId: 't4r1-corn-range-action-output-contract',
      definitionHash: sha256Text('t4r1 corn range action output contract'),
      resultHash: sha256Text('PASS t4r1 corn range action output contract'),
      outcome: 'PASS'
    },
    {
      testType: 'EXECUTION_FIXTURE',
      testId: 't4r1-corn-executor-exact-context-fixture',
      definitionHash: executorHash,
      resultHash: sha256Text(JSON.stringify(evaluateCornSeedingRateRange({
        inputEntries: exactInputDatums.map((datum) => ({
          semanticId: datum.semanticPayload.semanticId,
          payload: datum.semanticPayload
        }))
      }))),
      outcome: 'PASS'
    }
  ],
  runtimeEnvironments: ['STAGING'],
  requiredCapabilities: [CAPABILITY],
  knownLimitations: [EXPECTED_LIMITATION_CODE],
  validityInterval: {
    start: '2026-09-05T00:00:00.000Z',
    end: '2026-09-05T02:00:00.000Z'
  },
  principal: qualifier,
  authorizationDecisionAuditRef: conformanceAuth.ref,
  audit: audit(qualifier, 'conformance-publish', '2026-09-05T00:32:20.000Z')
});
const validatedConformance = validateImplementationConformance({
  ledger,
  conformanceRef: conformance.ref,
  atTime: '2026-09-05T00:35:00.000Z',
  executionContext: {
    ...validatedImplementation.semanticPayload.runtimeMetadata,
    runtimeEnvironment: 'STAGING',
    capabilities: [CAPABILITY]
  }
});
assert.equal(validatedConformance.semanticPayload.specificationRef.semanticHash, policy.ref.semanticHash);
assert.equal(validatedConformance.semanticPayload.implementationRef.semanticHash, implementation.ref.semanticHash);

const executionBinding = publishRuntimeBinding({
  ledger,
  logicalId: 'runtime-binding.real-blue-river-43-96p-population-range-v1.execution',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  selectedAlternativePathId: limitedLegalPaths[0].pathId,
  snapshotStore,
  specificationExecutionBinding: {
    specificationRef: policy.ref,
    implementationRef: implementation.ref,
    implementationConformanceRef: conformance.ref,
    availableCapabilities: [CAPABILITY]
  },
  audit: audit(runtimePrincipal, 'execution-binding-publish', '2026-09-05T00:36:00.000Z')
});
const validatedExecutionBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: executionBinding.ref });
assert.deepEqual(validatedExecutionBinding.semanticPayload.policyBindings, [policy.ref]);
assert.equal(validatedExecutionBinding.semanticPayload.implementationBindings.length, 1);
assert.equal(validatedExecutionBinding.semanticPayload.limitations[0].detail.code, EXPECTED_LIMITATION_CODE);

const executorRegistry = new ImplementationExecutorRegistry();
executorRegistry.register({
  implementationRef: implementation.ref,
  dispatchClass: 'INTERNAL',
  execute: evaluateCornSeedingRateRange
});
const idempotencyStore = new RuntimeExecutionIdempotencyStore();
const clockValues = ['2026-09-05T00:40:00.000Z', '2026-09-05T00:40:01.000Z'];
let clockIndex = 0;
const broker = new RuntimeExecutionBroker({
  executorRegistry,
  idempotencyStore,
  clock: () => clockValues[Math.min(clockIndex++, clockValues.length - 1)],
  timeoutMs: 100
});
const inputDatumRefs = exactInputDatums.map((datum) => datum.record.ref);
assert.equal(inputDatumRefs.length, requiredInputSemanticIds.length);
const executionEnvelope = await broker.execute({
  ledger,
  runtimeBindingRef: executionBinding.ref,
  inputDatumRefs
});
assert.equal(executionEnvelope.status, 'SUCCEEDED');
assert.equal(executionEnvelope.rawOutput.actionCode, ACTION_CODE);
assert.deepEqual(executionEnvelope.rawOutput.parameters, [
  { name: 'minimum_population', value: { type: 'DECIMAL', decimal: '28000' } },
  { name: 'maximum_population', value: { type: 'DECIMAL', decimal: '36000' } }
]);
assert.equal(executionEnvelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');

const alternativeSet = publishRuntimeAlternativeSet({
  ledger,
  logicalId: 'runtime-alternative-set.real-blue-river-43-96p-population-range-v1',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  includedRuntimeBindingRefs: [executionBinding.ref],
  audit: audit(runtimePrincipal, 'alternative-set-publish', '2026-09-05T00:42:00.000Z')
});
const validatedAlternativeSet = validateRuntimeAlternativeSet({
  ledger,
  runtimeAlternativeSetRef: alternativeSet.ref
});
assert.equal(validatedAlternativeSet.semanticPayload.completenessClass, 'EXHAUSTIVE_ENUMERATION');
assert.deepEqual(validatedAlternativeSet.semanticPayload.coverage.uncoveredLegalPathIds, []);
assert.deepEqual(validatedAlternativeSet.semanticPayload.coverage.includedPathIds, [limitedLegalPaths[0].pathId]);

const robustness = publishDecisionRobustness({
  ledger,
  logicalId: 'decision-robustness.real-blue-river-43-96p-population-range-v1',
  version: '1',
  runtimeAlternativeSetRef: alternativeSet.ref,
  policyExecutions: [{
    runtimeBindingRef: executionBinding.ref,
    executionEnvelope
  }],
  audit: audit(runtimePrincipal, 'robustness-publish', '2026-09-05T00:44:00.000Z')
});
const validatedRobustness = validateDecisionRobustness({ ledger, decisionRobustnessRef: robustness.ref });
assert.equal(validatedRobustness.semanticPayload.robustnessClass, 'ROBUST');
assert.deepEqual(validatedRobustness.semanticPayload.unresolvedReasonCodes, []);
assert.equal(validatedRobustness.semanticPayload.signatureGroups.length, 1);
assert.equal(validatedRobustness.semanticPayload.actionEvaluations.length, 1);
assert.equal(validatedRobustness.semanticPayload.actionEvaluations[0].status, 'ACTION_AVAILABLE');
const actionSignature = validatedRobustness.semanticPayload.actionEvaluations[0].materialActionSignature;
assert.equal(actionSignature.actionCode, ACTION_CODE);
// DecisionRobustness canonicalizes material parameters by semantic identity.
assert.deepEqual(actionSignature.materialParameters, [
  {
    name: MAX_PARAMETER.name,
    semanticId: MAX_PARAMETER.semanticId,
    valueType: MAX_PARAMETER.valueType,
    unit: MAX_PARAMETER.unit,
    value: { type: 'DECIMAL', decimal: '36000' }
  },
  {
    name: MIN_PARAMETER.name,
    semanticId: MIN_PARAMETER.semanticId,
    valueType: MIN_PARAMETER.valueType,
    unit: MIN_PARAMETER.unit,
    value: { type: 'DECIMAL', decimal: '28000' }
  }
]);

const result = publishDecisionResult({
  ledger,
  logicalId: 'decision-result.real-blue-river-43-96p-population-range-v1',
  version: '1',
  decisionRobustnessRef: robustness.ref,
  decidedAt: '2026-09-05T00:50:00.000Z',
  audit: audit(runtimePrincipal, 'decision-result-publish', '2026-09-05T00:50:00.000Z')
});
const validatedResult = validateDecisionResult({ ledger, decisionResultRef: result.ref });
assert.equal(validatedResult.semanticPayload.decisionDisposition, 'ACT');
assert.equal(validatedResult.semanticPayload.decisionAuthority.mode, 'ADR_POLICY');
assert.equal(validatedResult.semanticPayload.decisionAuthority.authorityRef.semanticHash, policy.ref.semanticHash);
assert.equal(validatedResult.semanticPayload.structuredAction.actionCode, ACTION_CODE);
assert.deepEqual(validatedResult.semanticPayload.structuredAction.materialParameters, actionSignature.materialParameters);
assert.equal(validatedResult.semanticPayload.humanGate.mode, 'NONE');
assert.equal(
  validatedResult.semanticPayload.humanApprovalAuthority,
  'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY'
);
assert.equal(
  validatedResult.semanticPayload.machineExecutionAuthority,
  'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY'
);
assert.equal(validatedResult.semanticPayload.informationRequirementRefs.length, 0);

const geoxProfile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(geoxProfile);
assert.equal(geoxProfile.provider.treatment_code, 'T4');
assert.equal(geoxProfile.provider.replicate_code, 'R1');
assert.equal(geoxProfile.provider.crop_code, 'corn');
assert.equal(geoxProfile.provider.hybrid_code, '43-96P');
assert.equal(geoxProfile.provider.planting_observation_id, '6974');
assert.equal(geoxProfile.geox.field_id, 'field_kbs_mcse_t4r1');
assert.equal(geoxProfile.geox.season_id, 'season_2026_corn');
assert.deepEqual(decision.semanticPayload.targetRef, correspondenceWorld.decision.semanticPayload.targetRef);
assert.deepEqual(manifest.semanticPayload.datumRefs, correspondenceWorld.manifest.semanticPayload.datumRefs);
assert.deepEqual(
  manifest.semanticPayload.resolvedReferenceReceiptRefs,
  correspondenceWorld.manifest.semanticPayload.resolvedReferenceReceiptRefs
);

const records = ledger.exportSnapshot().records;
assert.equal(records.filter((record) => record.ref.kind === 'ExecutionReceipt').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'Outcome').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'OutcomeEvaluation').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'RuntimeDatum').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'DecisionResult').length, 1);

console.log(JSON.stringify({
  ok: true,
  milestone: 'GEOX_T4R1_SAME_TARGET_CORN_DECISION_D02_D04_D05_D06',
  classification: 'SAME_TARGET_REAL_SOURCE_DECISION_RESULT_SHADOW_QUALIFICATION_ONLY',
  sameTargetConvergence: {
    correspondenceRelation: geoxProfile.relation,
    providerTarget: correspondenceWorld.providerTarget,
    geoxTarget: geoxProfile.geox,
    correspondenceDecisionProblemRef: correspondenceWorld.decision.ref,
    agronomicDecisionProblemRef: decision.ref,
    agronomicContextManifestRef: manifest.ref,
    sameTargetRef: true,
    sameDatumRefs: true,
    sameResolvedReceiptRefs: true
  },
  knowledge: {
    qualifiedKnowledgeRef: knowledge.ref,
    sourceArtifactHash: cornRuntimeWorld.sourceArtifactHash,
    recommendationRangeSeedsPerAcre: { min: '28000', max: '36000' },
    historicalTargetPopulationUsedAsRecommendationAuthority: false
  },
  policy: {
    policyRef: policy.ref,
    thresholdAuthorityMode: validatedPolicy.semanticPayload.thresholdAuthority.mode,
    thresholdAuthorityRefs: validatedPolicy.semanticPayload.thresholdAuthority.authorityRefs,
    actionCode: ACTION_CODE,
    materialParameterSemanticIds: [MIN_PARAMETER.semanticId, MAX_PARAMETER.semanticId]
  },
  runtimeExecution: {
    runtimeBindingRef: executionBinding.ref,
    status: executionEnvelope.status,
    rawOutput: executionEnvelope.rawOutput,
    semanticValidation: executionEnvelope.semanticValidation
  },
  alternativeCoverage: {
    runtimeAlternativeSetRef: alternativeSet.ref,
    completenessClass: validatedAlternativeSet.semanticPayload.completenessClass,
    uncoveredLegalPathIds: validatedAlternativeSet.semanticPayload.coverage.uncoveredLegalPathIds
  },
  decisionRobustness: {
    decisionRobustnessRef: robustness.ref,
    robustnessClass: validatedRobustness.semanticPayload.robustnessClass,
    signatureGroupCount: validatedRobustness.semanticPayload.signatureGroups.length,
    materialActionSignature: actionSignature
  },
  decisionResult: {
    decisionResultRef: result.ref,
    disposition: validatedResult.semanticPayload.decisionDisposition,
    structuredAction: validatedResult.semanticPayload.structuredAction,
    humanApprovalAuthority: validatedResult.semanticPayload.humanApprovalAuthority,
    machineExecutionAuthority: validatedResult.semanticPayload.machineExecutionAuthority
  },
  nonclaims: {
    correspondenceIsIdentityEquality: false,
    geoxFieldActionabilityGranted: false,
    decisionResultIsHumanApprovalAuthority: false,
    decisionResultIsMachineExecutionAuthority: false,
    executionReceiptCreated: false,
    outcomeCreated: false
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  newArchitectureDecisionRequired: false
}, null, 2));
