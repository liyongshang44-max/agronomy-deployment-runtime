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
import { evaluatePlantingPopulation } from './planting-policy-executor.mjs';
import { plantingRuntimeWorld } from './run-runtime-composition-v1.mjs';
import {
  PLANTING_DECISION_TYPE,
  PLANTING_TARGET_OWNERSHIP
} from './target-world.mjs';

const OWNERSHIP = PLANTING_TARGET_OWNERSHIP;
const EXPECTED_IMPLEMENTATION_HASH = 'sha256:3548def1e3786b47303ae067bd5f9225e90ced5a527e341361d959f6a8bef796';
const EXPECTED_LIMITATION_CODE = 'RECOMMENDATION_NOT_HISTORICAL_OPERATION_TRUTH';
const ACTION_CODE = 'SET_SOYBEAN_SEEDING_RATE';
const ACTION_PARAMETER_SEMANTIC_ID = 'planting.population_seeds_per_acre';
const ACTION_PARAMETER_VALUE = '150000';
const CAPABILITY = 'PLANTING_POLICY_V1';

const {
  ledger,
  snapshotStore,
  decision,
  manifest,
  validatedDatums,
  knowledge,
  profile,
  eligibility,
  runtimePrincipal,
  limitedLegalPaths
} = plantingRuntimeWorld;

assert.equal(limitedLegalPaths.length, 1);
assert.equal(profile.semanticPayload.contractVersion, 'adr.runtime-profile.v2');
assert.deepEqual(profile.semanticPayload.robustnessRequirement, {
  comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
  sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION']
});

let seq = 0;
function audit(principal, suffix, occurredAt) {
  seq += 1;
  return {
    eventId: `evt-planting-decision-v1-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: {
      suite: 'real-kbs-soybean-planting-population-decision-result-v1',
      classification: 'RETROSPECTIVE_REAL_SOURCE_DECISION_RESULT_TEST_ONLY'
    }
  };
}
function serviceAudit(suffix, occurredAt) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}
function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const executorBytes = readFileSync(new URL('./planting-policy-executor.mjs', import.meta.url));
const executorHash = `sha256:${createHash('sha256').update(executorBytes).digest('hex')}`;
assert.equal(executorHash, EXPECTED_IMPLEMENTATION_HASH);

const specManager = createPrincipal({
  principalId: 'planting-policy-v1-spec-manager',
  type: 'USER',
  ...OWNERSHIP
});
const specRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.planting-policy-v1.spec-manager',
  version: '1',
  principal: specManager,
  role: 'SPECIFICATION_MANAGER',
  roleDefinitionVersion: 's01-v1',
  permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
  scope: OWNERSHIP,
  audit: audit(specManager, 'spec-role', '2026-09-04T10:15:00.000Z')
});
const policyLogicalId = 'policy.real-msu-soybean-planting-population-v1';
const specDecision = authorizeSpecificationManage({
  principal: specManager,
  roleAssignments: [specRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'POLICY', resourceId: policyLogicalId }
});
assert.equal(specDecision.allowed, true);
const specAuth = recordAuthorizationDecision({
  ledger,
  decision: specDecision,
  audit: serviceAudit('spec-auth', '2026-09-04T10:15:10.000Z')
});

const policy = publishPolicy({
  ledger,
  logicalId: policyLogicalId,
  version: '1',
  specification: {
    contractVersion: POLICY_CONTRACT_VERSION_V3,
    controlScope: OWNERSHIP,
    decisionType: PLANTING_DECISION_TYPE,
    actionSpace: [ACTION_CODE, 'ABSTAIN'],
    actionSemantics: {
      equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
      actions: [
        {
          actionCode: ACTION_CODE,
          parameters: [{
            name: 'population',
            semanticId: ACTION_PARAMETER_SEMANTIC_ID,
            valueType: 'DECIMAL',
            unit: 'seed/acre',
            required: true,
            material: true
          }]
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
        semanticId: 'jurisdiction.region',
        valueType: 'CATEGORY',
        unit: 'NOT_APPLICABLE',
        epistemicClasses: ['ASSERTION']
      },
      {
        semanticId: 'planting.row_spacing_in',
        valueType: 'DECIMAL',
        unit: 'inch',
        epistemicClasses: ['ASSERTION']
      }
    ],
    requiredRuntimeOutputs: [],
    decisionLogic: {
      methodId: 'adr.acceptance.real-msu-soybean-planting-population-v1',
      definitionHash: executorHash
    },
    thresholdAuthority: {
      mode: 'EXTERNAL_AUTHORITY',
      authorityRefs: [knowledge.ref]
    },
    operationalConstraints: [
      'EXACT_CONTEXT_ONLY',
      'NO_HISTORICAL_OPERATION_POPULATION_AS_DECISION_INPUT'
    ],
    jurisdictionConstraints: ['MICHIGAN'],
    humanGate: { mode: 'NONE' },
    fallback: { disposition: 'ABSTAIN' },
    abstentionConditions: ['CONTEXT_MISMATCH'],
    limitations: [EXPECTED_LIMITATION_CODE]
  },
  principal: specManager,
  authorizationDecisionAuditRef: specAuth.ref,
  audit: audit(specManager, 'policy-publish', '2026-09-04T10:15:20.000Z')
});
const validatedPolicy = validateSpecificationAuthority({ ledger, specificationRef: policy.ref });
assert.equal(validatedPolicy.semanticPayload.contractVersion, POLICY_CONTRACT_VERSION_V3);
assert.equal(validatedPolicy.semanticPayload.thresholdAuthority.mode, 'EXTERNAL_AUTHORITY');
assert.deepEqual(validatedPolicy.semanticPayload.thresholdAuthority.authorityRefs, [knowledge.ref]);
assert.equal(validatedPolicy.semanticPayload.requiredRuntimeOutputs.length, 0);

const implementationManager = createPrincipal({
  principalId: 'planting-policy-v1-implementation-manager',
  type: 'USER',
  ...OWNERSHIP
});
const implementationRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.planting-policy-v1.implementation-manager',
  version: '1',
  principal: implementationManager,
  role: 'IMPLEMENTATION_MANAGER',
  roleDefinitionVersion: 's02-v1',
  permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
  scope: OWNERSHIP,
  audit: audit(implementationManager, 'implementation-role', '2026-09-04T10:16:00.000Z')
});
const implementationLogicalId = 'implementation.real-msu-soybean-planting-population-v1';
const implementationDecision = authorizeImplementationManage({
  principal: implementationManager,
  roleAssignments: [implementationRole],
  authorizationScope: { ...OWNERSHIP, resourceType: 'IMPLEMENTATION', resourceId: implementationLogicalId }
});
assert.equal(implementationDecision.allowed, true);
const implementationAuth = recordAuthorizationDecision({
  ledger,
  decision: implementationDecision,
  audit: serviceAudit('implementation-auth', '2026-09-04T10:16:10.000Z')
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
      value: 'adr.acceptance.plantingPolicyExecutorV1'
    },
    artifact: {
      artifactId: 'artifact:acceptance:planting-policy-executor-v1',
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
  audit: audit(implementationManager, 'implementation-publish', '2026-09-04T10:16:20.000Z')
});
const validatedImplementation = validateImplementationAuthority({ ledger, implementationRef: implementation.ref });
assert.equal(validatedImplementation.semanticPayload.artifact.contentHash, EXPECTED_IMPLEMENTATION_HASH);

const qualifier = createPrincipal({
  principalId: 'planting-policy-v1-conformance-qualifier',
  type: 'USER',
  ...OWNERSHIP
});
const qualifierRole = publishRoleAssignment({
  ledger,
  logicalId: 'role.planting-policy-v1.conformance-qualifier',
  version: '1',
  principal: qualifier,
  role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
  roleDefinitionVersion: 's03-v1',
  permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
  scope: OWNERSHIP,
  audit: audit(qualifier, 'conformance-role', '2026-09-04T10:17:00.000Z')
});
const conformanceLogicalId = 'conformance.real-msu-soybean-planting-population-v1';
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
  audit: serviceAudit('conformance-auth', '2026-09-04T10:17:10.000Z')
});
const conformance = publishImplementationConformance({
  ledger,
  logicalId: conformanceLogicalId,
  version: '1',
  specificationRef: policy.ref,
  implementationRef: implementation.ref,
  controlScope: OWNERSHIP,
  qualificationMethod: {
    methodId: 'adr.acceptance.real-planting-policy-conformance-v1',
    definitionHash: sha256Text('real planting policy conformance v1')
  },
  compatibilityTests: [
    {
      testType: 'INPUT_CONTRACT_COMPATIBILITY',
      testId: 'planting-context-input-contract',
      definitionHash: sha256Text('planting context input contract'),
      resultHash: sha256Text('PASS planting context input contract'),
      outcome: 'PASS'
    },
    {
      testType: 'OUTPUT_CONTRACT_COMPATIBILITY',
      testId: 'planting-action-output-contract',
      definitionHash: sha256Text('planting action output contract'),
      resultHash: sha256Text('PASS planting action output contract'),
      outcome: 'PASS'
    },
    {
      testType: 'EXECUTION_FIXTURE',
      testId: 'planting-executor-exact-context-fixture',
      definitionHash: executorHash,
      resultHash: sha256Text(JSON.stringify(evaluatePlantingPopulation({
        inputEntries: validatedDatums.map((datum) => ({
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
    start: '2026-09-04T10:00:00.000Z',
    end: '2026-09-05T00:00:00.000Z'
  },
  principal: qualifier,
  authorizationDecisionAuditRef: conformanceAuth.ref,
  audit: audit(qualifier, 'conformance-publish', '2026-09-04T10:17:20.000Z')
});
const validatedConformance = validateImplementationConformance({
  ledger,
  conformanceRef: conformance.ref,
  atTime: '2026-09-04T10:50:00.000Z',
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
  logicalId: 'runtime-binding.real-msu-soybean-planting-population-v1.execution',
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
  audit: audit(runtimePrincipal, 'execution-binding-publish', '2026-09-04T10:18:00.000Z')
});
const validatedExecutionBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: executionBinding.ref });
assert.deepEqual(validatedExecutionBinding.semanticPayload.policyBindings, [policy.ref]);
assert.equal(validatedExecutionBinding.semanticPayload.implementationBindings.length, 1);
assert.equal(validatedExecutionBinding.semanticPayload.limitations[0].detail.code, EXPECTED_LIMITATION_CODE);

const executorRegistry = new ImplementationExecutorRegistry();
executorRegistry.register({
  implementationRef: implementation.ref,
  dispatchClass: 'INTERNAL',
  execute: evaluatePlantingPopulation
});
const idempotencyStore = new RuntimeExecutionIdempotencyStore();
const clockValues = ['2026-09-04T11:00:00.000Z', '2026-09-04T11:00:01.000Z'];
let clockIndex = 0;
const broker = new RuntimeExecutionBroker({
  executorRegistry,
  idempotencyStore,
  clock: () => clockValues[Math.min(clockIndex++, clockValues.length - 1)],
  timeoutMs: 100
});
const inputDatumRefs = validatedDatums.map((datum) => datum.record.ref);
const executionEnvelope = await broker.execute({
  ledger,
  runtimeBindingRef: executionBinding.ref,
  inputDatumRefs
});
assert.equal(executionEnvelope.status, 'SUCCEEDED');
assert.equal(executionEnvelope.rawOutput.actionCode, ACTION_CODE);
assert.deepEqual(executionEnvelope.rawOutput.parameters, [{
  name: 'population',
  value: { type: 'DECIMAL', decimal: ACTION_PARAMETER_VALUE }
}]);
assert.equal(executionEnvelope.semanticValidation, 'NOT_PERFORMED_D03_REQUIRED');

const alternativeSet = publishRuntimeAlternativeSet({
  ledger,
  logicalId: 'runtime-alternative-set.real-msu-soybean-planting-population-v1',
  version: '1',
  runtimeEligibilityRef: eligibility.ref,
  includedRuntimeBindingRefs: [executionBinding.ref],
  audit: audit(runtimePrincipal, 'alternative-set-publish', '2026-09-04T11:02:00.000Z')
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
  logicalId: 'decision-robustness.real-msu-soybean-planting-population-v1',
  version: '1',
  runtimeAlternativeSetRef: alternativeSet.ref,
  policyExecutions: [{
    runtimeBindingRef: executionBinding.ref,
    executionEnvelope
  }],
  audit: audit(runtimePrincipal, 'robustness-publish', '2026-09-04T11:04:00.000Z')
});
const validatedRobustness = validateDecisionRobustness({ ledger, decisionRobustnessRef: robustness.ref });
assert.equal(validatedRobustness.semanticPayload.robustnessClass, 'ROBUST');
assert.deepEqual(validatedRobustness.semanticPayload.unresolvedReasonCodes, []);
assert.equal(validatedRobustness.semanticPayload.signatureGroups.length, 1);
assert.equal(validatedRobustness.semanticPayload.actionEvaluations.length, 1);
assert.equal(validatedRobustness.semanticPayload.actionEvaluations[0].status, 'ACTION_AVAILABLE');
const actionSignature = validatedRobustness.semanticPayload.actionEvaluations[0].materialActionSignature;
assert.equal(actionSignature.actionCode, ACTION_CODE);
assert.deepEqual(actionSignature.materialParameters, [{
  name: 'population',
  semanticId: ACTION_PARAMETER_SEMANTIC_ID,
  valueType: 'DECIMAL',
  unit: 'seed/acre',
  value: { type: 'DECIMAL', decimal: ACTION_PARAMETER_VALUE }
}]);

const result = publishDecisionResult({
  ledger,
  logicalId: 'decision-result.real-msu-soybean-planting-population-v1',
  version: '1',
  decisionRobustnessRef: robustness.ref,
  decidedAt: '2026-09-04T11:10:00.000Z',
  audit: audit(runtimePrincipal, 'decision-result-publish', '2026-09-04T11:10:00.000Z')
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

const records = ledger.exportSnapshot().records;
assert.equal(records.filter((record) => record.ref.kind === 'ExecutionReceipt').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'Outcome').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'OutcomeEvaluation').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'RuntimeDatum').length, 0);
assert.equal(records.filter((record) => record.ref.kind === 'DecisionResult').length, 1);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_PLANTING_D02_D04_D05_D06_STRICT_POSITIVE',
  classification: 'RETROSPECTIVE_REAL_SOURCE_DECISION_RESULT_TEST_ONLY',
  frozenWorld: {
    decisionProblemRef: decision.ref,
    contextManifestRef: manifest.ref,
    qualifiedKnowledgeRef: knowledge.ref,
    runtimeProfileRef: profile.ref,
    runtimeEligibilityRef: eligibility.ref,
    recommendationPopulationSeedsPerAcre: ACTION_PARAMETER_VALUE,
    historicalKbsOperationPopulationSeedsPerAcre: '180000',
    historicalOperationPopulationPromotedToDecisionInput: false
  },
  policy: {
    policyRef: policy.ref,
    contractVersion: validatedPolicy.semanticPayload.contractVersion,
    thresholdAuthorityMode: validatedPolicy.semanticPayload.thresholdAuthority.mode,
    thresholdAuthorityRefs: validatedPolicy.semanticPayload.thresholdAuthority.authorityRefs,
    requiredRuntimeOutputCount: validatedPolicy.semanticPayload.requiredRuntimeOutputs.length,
    actionCode: ACTION_CODE,
    materialParameterSemanticId: ACTION_PARAMETER_SEMANTIC_ID
  },
  implementation: {
    implementationRef: implementation.ref,
    artifactHash: validatedImplementation.semanticPayload.artifact.contentHash,
    conformanceRef: conformance.ref,
    capability: CAPABILITY
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
    historicalKbsOperationIsRecommendationAuthority: false,
    decisionResultIsHumanApprovalAuthority: false,
    decisionResultIsMachineExecutionAuthority: false,
    executionReceiptCreated: false,
    outcomeCreated: false
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0
}, null, 2));
