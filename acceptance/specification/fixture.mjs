import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import {
  publishQualifiedTransformation,
  publishModel,
  publishPolicy
} from '../../packages/specification-registry/src/index.mjs';

let seq = 0;
export function audit(actor = { type: 'USER', id: 'spec-manager' }, suite = 's01') {
  seq += 1;
  return {
    eventId: `${suite}-${seq}`,
    occurredAt: '2026-08-16T13:45:00.000Z',
    actor,
    details: { suite }
  };
}

export const manager = createPrincipal({
  principalId: 'spec-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});

export function controlScope() {
  return { organizationId: 'org-a', tenantId: 'tenant-a' };
}

export function makeEnv({ principal = manager, roleScope = { organizationId: 'org-a', tenantId: 'tenant-a' } } = {}) {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: `role.specification.${principal.principalId}`,
    version: '1',
    principal,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: roleScope,
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  return { ledger, manager: principal, assignment };
}

function hash(char) { return `sha256:${char.repeat(64)}`; }
function port(semanticId, epistemicClasses, unit = '1', valueType = 'DECIMAL', measurementConvention) {
  return {
    semanticId,
    valueType,
    unit,
    epistemicClasses,
    ...(measurementConvention ? { measurementConvention } : {})
  };
}

export function transformationSpec(overrides = {}) {
  return {
    contractVersion: 'adr.qualified-transformation.v1',
    controlScope: controlScope(),
    inputContract: port('soil.volumetric_water_content', ['OBSERVATION'], 'm3_per_m3', 'DECIMAL', 'VWC_FRACTION'),
    outputContract: port('soil.volumetric_water_content_percent', ['OBSERVATION'], 'percent', 'DECIMAL', 'VWC_PERCENT'),
    method: { methodId: 'unit.vwc_fraction_to_percent', definitionHash: hash('a') },
    applicabilityDomain: { requiredSemanticIds: ['soil.volumetric_water_content'] },
    uncertaintyConsequence: { mode: 'PRESERVE' },
    limitations: ['NO_SPATIAL_RESAMPLING'],
    epistemicRule: 'PRESERVE',
    ...overrides
  };
}

export function modelSpec(overrides = {}) {
  return {
    contractVersion: 'adr.model.v1',
    controlScope: controlScope(),
    purpose: 'ESTIMATE_ROOT_ZONE_WATER_STORAGE',
    inputs: [port('soil.volumetric_water_content', ['OBSERVATION'], 'm3_per_m3', 'DECIMAL', 'VWC_FRACTION')],
    outputs: [port('soil.root_zone_water_storage', ['STATE_ESTIMATE'], 'mm', 'DECIMAL')],
    evidenceStateRequirements: ['soil.volumetric_water_content'],
    parameterSlots: [{ name: 'root_depth_mm', semanticId: 'crop.root_depth', valueType: 'DECIMAL', unit: 'mm', required: true }],
    acceptedKnowledgeAuthorityKinds: ['QualifiedKnowledge', 'DerivedKnowledge'],
    measurementConventions: ['VWC_FRACTION'],
    applicabilityDomain: { requiredSemanticIds: ['soil.volumetric_water_content'] },
    calibrationRequirements: [{ parameterSlot: 'root_depth_mm', mode: 'OPTIONAL' }],
    limitations: ['VALID_ONLY_WITH_DECLARED_ROOT_DEPTH'],
    computation: { methodId: 'root-zone-water-storage-v1', definitionHash: hash('b') },
    ...overrides
  };
}

function irrigationParameters() {
  return [
    {
      name: 'amount',
      semanticId: 'action.irrigation.amount',
      valueType: 'DECIMAL',
      unit: 'mm',
      required: true,
      material: true
    },
    {
      name: 'start_time',
      semanticId: 'action.irrigation.start_time',
      valueType: 'TIMESTAMP',
      unit: 'iso8601',
      required: true,
      material: true
    },
    {
      name: 'note',
      semanticId: 'action.note',
      valueType: 'STRING',
      unit: '1',
      required: false,
      material: false
    }
  ];
}

export function policyActionSemantics(actionSpace = ['WAIT', 'IRRIGATE_NOW']) {
  return {
    equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
    actions: actionSpace.map((actionCode) => ({
      actionCode,
      parameters: actionCode.startsWith('IRRIGATE') ? irrigationParameters() : []
    }))
  };
}

export function policySpec(overrides = {}) {
  const contractVersion = overrides.contractVersion ?? 'adr.policy.v2';
  const actionSpace = overrides.actionSpace ?? ['WAIT', 'IRRIGATE_NOW'];
  const actionSemantics = overrides.actionSemantics
    ?? (['adr.policy.v2', 'adr.policy.v3'].includes(contractVersion) ? policyActionSemantics(actionSpace) : undefined);
  return {
    contractVersion,
    controlScope: controlScope(),
    decisionType: 'IRRIGATION_TIMING',
    actionSpace,
    ...(actionSemantics ? { actionSemantics } : {}),
    requiredInputs: [port('operation.irrigation_capacity', ['CONFIGURATION'], 'mm_per_day')],
    requiredRuntimeOutputs: [port('soil.root_zone_water_storage', ['STATE_ESTIMATE'], 'mm')],
    decisionLogic: { methodId: 'irrigation-threshold-policy-v1', definitionHash: hash('c') },
    thresholdAuthority: { mode: 'SPEC_DEFINED', authorityRefs: [] },
    operationalConstraints: ['RESPECT_IRRIGATION_CAPACITY'],
    jurisdictionConstraints: [],
    humanGate: { mode: 'REQUIRED' },
    fallback: { disposition: 'ABSTAIN' },
    abstentionConditions: ['MISSING_REQUIRED_RUNTIME_OUTPUT'],
    limitations: ['ADVISORY_ONLY'],
    ...overrides
  };
}

export function resourceType(kind) {
  return ({ QualifiedTransformation: 'QUALIFIED_TRANSFORMATION', Model: 'MODEL', Policy: 'POLICY' })[kind];
}

export function authorize(env, kind, logicalId, { assignment = env.assignment, principal = env.manager } = {}) {
  const authorizationScope = {
    ...controlScope(),
    resourceType: resourceType(kind),
    resourceId: logicalId
  };
  const decision = authorizeSpecificationManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope
  });
  const authorizationRecord = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth')
  });
  return { decision, authorizationRecord };
}

export function publish(env, kind, logicalId, version = '1', specification) {
  const spec = specification ?? (kind === 'QualifiedTransformation'
    ? transformationSpec()
    : kind === 'Model'
      ? modelSpec()
      : policySpec());
  const { authorizationRecord } = authorize(env, kind, logicalId);
  const args = {
    ledger: env.ledger,
    logicalId,
    version,
    specification: spec,
    principal: env.manager,
    authorizationDecisionAuditRef: authorizationRecord.ref,
    audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish')
  };
  if (kind === 'QualifiedTransformation') return publishQualifiedTransformation(args);
  if (kind === 'Model') return publishModel(args);
  if (kind === 'Policy') return publishPolicy(args);
  throw new Error(`unsupported test kind ${kind}`);
}
