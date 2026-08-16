import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision,
  authorizeDeploymentControl
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { publishModel } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementation } from '../../packages/implementation-registry/src/index.mjs';
import { publishImplementationConformance } from '../../packages/implementation-conformance/src/index.mjs';
import { publishDeploymentControlDecision } from '../../packages/deployment/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import {
  ImplementationExecutorRegistry,
  RuntimeExecutionBroker,
  RuntimeExecutionIdempotencyStore
} from '../../packages/implementation-broker/src/index.mjs';
import { modelSpec } from '../specification/fixture.mjs';
import { implementationSpec } from '../implementation-registry/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';
import {
  transportEligibilityWorld,
  publishEligibility
} from '../runtime-eligibility/fixture.mjs';
import { legalPath, audit as bindingAudit } from '../runtime-binding/fixture.mjs';

let seq = 0;
export function audit(principal, suffix = 'd02') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:15:00.000Z',
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'implementation-broker' }
  };
}
function serviceAudit(suffix = 'auth') {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function principal(id) {
  return createPrincipal({ principalId: id, type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
}

export function createExecutableWorld(label = 'base', {
  providerType = 'INTERNAL',
  runtimeEnvironments = ['STAGING'],
  requiredCapabilities = ['DETERMINISTIC_DECIMAL_V1'],
  validityInterval = { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
  implementationOverrides = {},
  modelOverrides = {}
} = {}) {
  const world = transportEligibilityWorld(`d02-${label}`, []);
  const eligibility = publishEligibility(world, `d02-${label}`);
  const ledger = world.env.ledger;

  const specManager = principal(`d02-spec-${label}`);
  const implementationManager = principal(`d02-impl-${label}`);
  const qualifier = principal(`d02-qualifier-${label}`);

  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d02.spec.${label}`,
    version: '1',
    principal: specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const implementationAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d02.impl.${label}`,
    version: '1',
    principal: implementationManager,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const qualifierAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d02.qualifier.${label}`,
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });

  const modelId = `model.d02.${label}`;
  const modelDecision = authorizeSpecificationManage({
    principal: specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'MODEL', resourceId: modelId }
  });
  const modelAuth = recordAuthorizationDecision({ ledger, decision: modelDecision, audit: serviceAudit('model-auth') });
  const model = publishModel({
    ledger,
    logicalId: modelId,
    version: '1',
    specification: modelSpec({
      parameterSlots: [],
      calibrationRequirements: [],
      ...modelOverrides
    }),
    principal: specManager,
    authorizationDecisionAuditRef: modelAuth.ref,
    audit: audit(specManager, 'model-publish')
  });

  const implementationId = `implementation.d02.${label}`;
  const implementationDecision = authorizeImplementationManage({
    principal: implementationManager,
    roleAssignments: [implementationAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: implementationId }
  });
  const implementationAuth = recordAuthorizationDecision({ ledger, decision: implementationDecision, audit: serviceAudit('implementation-auth') });
  const implementation = publishImplementation({
    ledger,
    logicalId: implementationId,
    version: '1',
    implementation: implementationSpec({ providerType, ...implementationOverrides }),
    principal: implementationManager,
    authorizationDecisionAuditRef: implementationAuth.ref,
    audit: audit(implementationManager, 'implementation-publish')
  });

  const conformanceId = `conformance.d02.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: qualifier,
    roleAssignments: [qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId }
  });
  const conformanceAuth = recordAuthorizationDecision({ ledger, decision: conformanceDecision, audit: serviceAudit('conformance-auth') });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: '1',
    specificationRef: model.ref,
    implementationRef: implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod(),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments,
    requiredCapabilities,
    knownLimitations: [],
    validityInterval,
    principal: qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(qualifier, 'conformance-publish')
  });

  const selected = legalPath({ ...world, eligibility });
  const binding = publishRuntimeBinding({
    ledger,
    logicalId: `runtime-binding.d02.${label}`,
    version: '1',
    runtimeEligibilityRef: eligibility.ref,
    selectedAlternativePathId: selected.pathId,
    specificationExecutionBinding: {
      specificationRef: model.ref,
      implementationRef: implementation.ref,
      implementationConformanceRef: conformance.ref,
      availableCapabilities: requiredCapabilities
    },
    audit: bindingAudit(world.env.runtimePrincipal, `d02-${label}`)
  });
  const soilRef = world.manifest.semanticPayload.datumRefs.find((ref) =>
    ledger.resolve(ref).semanticPayload.semanticId === 'soil.volumetric_water_content');
  if (!soilRef) throw new Error('D02 fixture failed to publish soil input ContextDatum');

  return {
    ...world,
    eligibility,
    selected,
    model,
    implementation,
    conformance,
    binding,
    soilRef,
    specManager,
    implementationManager,
    qualifier,
    qualifierAssignment
  };
}

export function createBroker(world, execute, {
  dispatchClass,
  timeoutMs = 100,
  clockValues = ['2026-08-20T10:15:00.000Z']
} = {}) {
  const registry = new ImplementationExecutorRegistry();
  registry.register({
    implementationRef: world.implementation.ref,
    dispatchClass: dispatchClass ?? (['INTERNAL', 'WASM'].includes(world.implementation.semanticPayload.providerType) ? 'INTERNAL' : 'EXTERNAL'),
    execute
  });
  const idempotencyStore = new RuntimeExecutionIdempotencyStore();
  let index = 0;
  const clock = () => clockValues[Math.min(index++, clockValues.length - 1)];
  const broker = new RuntimeExecutionBroker({ executorRegistry: registry, idempotencyStore, clock, timeoutMs });
  return { broker, registry, idempotencyStore };
}

export async function executeWorld(world, execute, options = {}) {
  const runtime = createBroker(world, execute, options);
  const envelope = await runtime.broker.execute({
    ledger: world.env.ledger,
    runtimeBindingRef: world.binding.ref,
    inputDatumRefs: [world.soilRef]
  });
  return { ...runtime, envelope };
}

export function suspendDeployment(world) {
  const decision = authorizeDeploymentControl({
    principal: world.env.deploymentManager,
    roleAssignments: [world.env.deploymentManagerRole],
    authorizationScope: {
      organizationId: world.deployment.semanticPayload.deploymentScope.organizationId,
      tenantId: world.deployment.semanticPayload.deploymentScope.tenantId,
      programId: world.deployment.semanticPayload.deploymentScope.programId,
      resourceType: 'DEPLOYMENT',
      resourceId: world.deployment.ref.logicalId
    },
    action: 'SUSPEND',
    production: false
  });
  const auth = recordAuthorizationDecision({ ledger: world.env.ledger, decision, audit: serviceAudit('deployment-control-auth') });
  return publishDeploymentControlDecision({
    ledger: world.env.ledger,
    deploymentRef: world.deployment.ref,
    version: '1',
    action: 'SUSPEND',
    principal: world.env.deploymentManager,
    authorizationDecisionAuditRef: auth.ref,
    reasonCodes: ['D02_TEST_SUSPEND'],
    audit: audit(world.env.deploymentManager, 'deployment-suspend')
  });
}
