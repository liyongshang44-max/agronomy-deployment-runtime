import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { publishModel } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementationConformance } from '../../packages/implementation-conformance/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { collectRuntimeResult, executePolicyWithRuntimeResults } from '../../packages/runtime-results/src/index.mjs';
import { publishDecisionRobustness } from '../../packages/decision-robustness/src/index.mjs';
import { publishDecisionResult } from '../../packages/decision-result/src/index.mjs';
import { modelSpec } from '../specification/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';
import { createBroker } from '../implementation-broker/fixture.mjs';
import { semanticOutput } from '../runtime-results/fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';
import { policyDecisionWorld } from '../decision-result/fixture.mjs';

const TIMES = Object.freeze({
  authority: '2026-08-20T10:46:00.000Z',
  modelStart: '2026-08-20T10:50:00.000Z',
  modelEnd: '2026-08-20T10:50:01.000Z',
  policyStart: '2026-08-20T10:52:00.000Z',
  policyEnd: '2026-08-20T10:52:01.000Z',
  robustness: '2026-08-20T10:53:00.000Z',
  decidedAt: '2026-08-20T10:54:00.000Z',
  decisionAudit: '2026-08-20T10:55:00.000Z'
});

let seq = 0;
export function audit(principal, suffix = 'gate-d', occurredAt = TIMES.authority) {
  seq += 1;
  return {
    eventId: `gate-d-${suffix}-${seq}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'gate-d' }
  };
}

function serviceAudit(suffix) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}

function controlScope() {
  return { organizationId: 'org-a', tenantId: 'tenant-a' };
}

function principal(id) {
  return createPrincipal({
    principalId: id,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
}

export function soilPort() {
  return {
    semanticId: 'soil.volumetric_water_content',
    valueType: 'DECIMAL',
    unit: 'm3_per_m3',
    epistemicClasses: ['OBSERVATION'],
    measurementConvention: 'VWC_FRACTION'
  };
}

export function rootZonePort() {
  return {
    semanticId: 'soil.root_zone_water_storage',
    valueType: 'DECIMAL',
    unit: 'mm',
    epistemicClasses: ['STATE_ESTIMATE']
  };
}

function exactSoilRef(world) {
  const ref = world.manifest.semanticPayload.datumRefs.find((candidate) =>
    world.env.ledger.resolve(candidate).semanticPayload.semanticId === 'soil.volumetric_water_content');
  if (!ref) throw new Error('Gate D fixture requires exact soil.volumetric_water_content ContextDatum');
  return ref;
}

function legalPath(world) {
  const path = world.eligibility.semanticPayload.alternativeEvaluations.find((candidate) =>
    candidate.disposition === 'LEGAL' || candidate.disposition === 'LEGAL_WITH_LIMITATIONS');
  if (!path) throw new Error('Gate D fixture requires one legal RuntimeEligibility path');
  return path;
}

function publishModelExecutionAuthority(world, label) {
  const { ledger } = world.env;
  const specManager = principal(`gate-d-model-spec-${label}`);
  const qualifier = principal(`gate-d-model-qualifier-${label}`);

  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.gate-d.model.spec.${label}`,
    version: '1',
    principal: specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const qualifierAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.gate-d.model.qualifier.${label}`,
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });

  const modelId = `model.gate-d.${label}`;
  const modelDecision = authorizeSpecificationManage({
    principal: specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'MODEL', resourceId: modelId }
  });
  const modelAuth = recordAuthorizationDecision({
    ledger,
    decision: modelDecision,
    audit: serviceAudit('model-auth')
  });
  const model = publishModel({
    ledger,
    logicalId: modelId,
    version: '1',
    specification: modelSpec({
      parameterSlots: [],
      calibrationRequirements: []
    }),
    principal: specManager,
    authorizationDecisionAuditRef: modelAuth.ref,
    audit: audit(specManager, 'model-publish')
  });

  const conformanceId = `conformance.gate-d.model.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: qualifier,
    roleAssignments: [qualifierAssignment],
    authorizationScope: {
      ...controlScope(),
      resourceType: 'IMPLEMENTATION_CONFORMANCE',
      resourceId: conformanceId
    }
  });
  const conformanceAuth = recordAuthorizationDecision({
    ledger,
    decision: conformanceDecision,
    audit: serviceAudit('model-conformance-auth')
  });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: '1',
    specificationRef: model.ref,
    implementationRef: world.implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod('a'),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments: ['STAGING'],
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'],
    knownLimitations: [],
    validityInterval: {
      start: '2026-08-01T00:00:00Z',
      end: '2026-09-01T00:00:00Z'
    },
    principal: qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(qualifier, 'model-conformance-publish')
  });

  const binding = publishRuntimeBinding({
    ledger,
    logicalId: `runtime-binding.gate-d.model.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    selectedAlternativePathId: legalPath(world).pathId,
    specificationExecutionBinding: {
      specificationRef: model.ref,
      implementationRef: world.implementation.ref,
      implementationConformanceRef: conformance.ref,
      availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
    },
    audit: audit(world.env.runtimePrincipal, 'model-binding')
  });

  return { model, conformance, binding };
}

export async function createGateDWorld(label = 'continuous') {
  const world = policyDecisionWorld(`gate-d-${label}`, {
    decisionAuthorityMode: 'ADR_POLICY',
    policyOverrides: {
      requiredInputs: [soilPort()],
      requiredRuntimeOutputs: [rootZonePort()]
    }
  });
  const { ledger } = world.env;
  const soilRef = exactSoilRef(world);
  const soilDatum = ledger.resolve(soilRef).semanticPayload;
  const modelAuthority = publishModelExecutionAuthority(world, label);

  const modelWorld = {
    ...world,
    model: modelAuthority.model,
    conformance: modelAuthority.conformance,
    binding: modelAuthority.binding
  };
  const modelRuntime = createBroker(modelWorld, async () => semanticOutput({
    spatialSupport: soilDatum.spatialSupport
  }), {
    clockValues: [TIMES.modelStart, TIMES.modelEnd]
  });
  const modelEnvelope = await modelRuntime.broker.execute({
    ledger,
    runtimeBindingRef: modelAuthority.binding.ref,
    inputDatumRefs: [soilRef]
  });
  const runtimeResult = collectRuntimeResult({
    ledger,
    executionEnvelope: modelEnvelope,
    inputDatumRefs: [soilRef]
  });

  let capturedPolicyRequest = null;
  const policyRuntime = createBroker(world, async (request) => {
    capturedPolicyRequest = request;
    return makePolicyActionOutput({
      amount: '10',
      startTime: '2026-08-20T11:00:00Z'
    });
  }, {
    clockValues: [TIMES.policyStart, TIMES.policyEnd]
  });
  const policyEnvelope = await executePolicyWithRuntimeResults({
    broker: policyRuntime.broker,
    ledger,
    runtimeBindingRef: world.binding.ref,
    contextDatumRefs: [soilRef],
    runtimeResultInputs: [{
      runtimeResult,
      executionEnvelope: modelEnvelope,
      inputDatumRefs: [soilRef]
    }]
  });

  const robustness = publishDecisionRobustness({
    ledger,
    logicalId: `decision-robustness.gate-d.${label}`,
    version: '1',
    runtimeAlternativeSetRef: world.alternativeSet.ref,
    policyExecutions: [{
      runtimeBindingRef: world.binding.ref,
      executionEnvelope: policyEnvelope
    }],
    audit: audit(world.env.runtimePrincipal, 'robustness', TIMES.robustness)
  });
  const decisionResult = publishDecisionResult({
    ledger,
    logicalId: `decision-result.gate-d.${label}`,
    version: '1',
    decisionRobustnessRef: robustness.ref,
    decidedAt: TIMES.decidedAt,
    audit: audit(world.env.runtimePrincipal, 'decision-result', TIMES.decisionAudit)
  });

  return {
    ...world,
    soilRef,
    modelAuthority,
    modelEnvelope,
    runtimeResult,
    capturedPolicyRequest,
    policyEnvelope,
    robustness,
    decisionResult
  };
}
