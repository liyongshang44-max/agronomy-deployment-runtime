import {
  PERMISSIONS,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { publishQualifiedTransformation } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementationConformance } from '../../packages/implementation-conformance/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { collectRuntimeResult } from '../../packages/runtime-results/src/index.mjs';
import {
  createExecutableWorld,
  createBroker,
  executeWorld,
  suspendDeployment
} from '../implementation-broker/fixture.mjs';
import { transformationSpec } from '../specification/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';
import { audit as bindingAudit } from '../runtime-binding/fixture.mjs';

let seq = 0;
function audit(principal, suffix = 'd03') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:15:00.000Z',
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'runtime-results' }
  };
}
function serviceAudit(suffix) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }

export function decimalValue(decimal = '42.5') {
  return { type: 'DECIMAL', decimal };
}

export function semanticOutput({
  semanticId = 'soil.root_zone_water_storage',
  value = decimalValue('42.5'),
  effectiveInterval = { start: '2026-08-20T10:00:00.000Z', end: '2026-08-20T10:15:00.000Z' },
  forecast = null,
  spatialSupport = { type: 'FIELD', geometryRef: 'field-a' },
  verticalSupport = { fromMm: '0', toMm: '600' },
  temporalSupport = { type: 'INTERVAL' },
  uncertainty = { type: 'INTERVAL', lowerDecimal: '40', upperDecimal: '45' },
  extra = {}
} = {}) {
  return {
    contractVersion: 'adr.runtime-semantic-output.v1',
    outputs: [{
      semanticId,
      value,
      effectiveInterval,
      forecast,
      spatialSupport,
      verticalSupport,
      temporalSupport,
      uncertainty,
      ...extra
    }]
  };
}

export function multiSemanticOutput(outputs) {
  return { contractVersion: 'adr.runtime-semantic-output.v1', outputs };
}

export function modelWorld(label = 'base', options = {}) {
  return createExecutableWorld(`d03-${label}`, options);
}

export async function executeModel(world, rawOutput, options = {}) {
  return executeWorld(world, async () => rawOutput, options);
}

export function collect(world, envelope) {
  return collectRuntimeResult({
    ledger: world.env.ledger,
    executionEnvelope: envelope,
    inputDatumRefs: [world.soilRef]
  });
}

export async function executeAndCollect(world, rawOutput, options = {}) {
  const execution = await executeModel(world, rawOutput, options);
  return { ...execution, result: collect(world, execution.envelope) };
}

export function inputDatum(world) {
  return world.env.ledger.resolve(world.soilRef).semanticPayload;
}

export function transformationOutputFromInput(world, overrides = {}) {
  const input = inputDatum(world);
  return semanticOutput({
    semanticId: 'soil.volumetric_water_content_percent',
    value: decimalValue('32'),
    effectiveInterval: input.effectiveInterval,
    forecast: null,
    spatialSupport: input.spatialSupport,
    verticalSupport: input.verticalSupport,
    temporalSupport: input.temporalSupport,
    uncertainty: input.uncertainty,
    ...overrides
  });
}

export function transformationWorld(label = 'transform') {
  const base = createExecutableWorld(`d03-transform-${label}`);
  const { ledger } = base.env;
  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d03.transform.spec.${label}`,
    version: '1',
    principal: base.specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const transformationId = `transformation.d03.${label}`;
  const specDecision = authorizeSpecificationManage({
    principal: base.specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'QUALIFIED_TRANSFORMATION', resourceId: transformationId }
  });
  const specAuth = recordAuthorizationDecision({ ledger, decision: specDecision, audit: serviceAudit('transform-auth') });
  const transformation = publishQualifiedTransformation({
    ledger,
    logicalId: transformationId,
    version: '1',
    specification: transformationSpec(),
    principal: base.specManager,
    authorizationDecisionAuditRef: specAuth.ref,
    audit: audit(base.specManager, 'transform-publish')
  });

  const conformanceId = `conformance.d03.transform.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: base.qualifier,
    roleAssignments: [base.qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId }
  });
  const conformanceAuth = recordAuthorizationDecision({ ledger, decision: conformanceDecision, audit: serviceAudit('transform-conformance-auth') });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: '1',
    specificationRef: transformation.ref,
    implementationRef: base.implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod('d'),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments: ['STAGING'],
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'],
    knownLimitations: [],
    validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
    principal: base.qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(base.qualifier, 'transform-conformance-publish')
  });
  const binding = publishRuntimeBinding({
    ledger,
    logicalId: `runtime-binding.d03.transform.${label}`,
    version: '1',
    runtimeEligibilityRef: base.eligibility.ref,
    selectedAlternativePathId: base.selected.pathId,
    specificationExecutionBinding: {
      specificationRef: transformation.ref,
      implementationRef: base.implementation.ref,
      implementationConformanceRef: conformance.ref,
      availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
    },
    audit: bindingAudit(base.env.runtimePrincipal, `d03-transform-${label}`)
  });
  return { ...base, transformation, conformance, binding };
}

export { createBroker, suspendDeployment };
