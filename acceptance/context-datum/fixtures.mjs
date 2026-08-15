import assert from 'node:assert/strict';
import { PERMISSIONS, publishRoleAssignment, recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { CONTEXT_DATUM_CONTRACT_VERSION, publishContextDatum } from '../../packages/context-contract/src/index.mjs';

let seq = 0;
export const principal = { principalId: 'integration-a', type: 'SERVICE_ACCOUNT', organizationId: 'org-a', tenantId: 'tenant-a', programIds: [] };
export function audit(actor = principal, suffix = 'ctx') {
  seq += 1;
  return { eventId: `a02-${suffix}-${seq}`, occurredAt: '2026-08-16T02:00:00Z', actor: { type: actor.type, id: actor.principalId }, details: { suite: 'context-datum' } };
}

export function baseDatum(overrides = {}) {
  return {
    contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.32' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'SENSOR',
    effectiveInterval: { start: '2026-08-16T01:00:00Z', end: '2026-08-16T02:00:00Z' },
    availableAt: '2026-08-16T02:01:00Z',
    spatialSupport: { type: 'POINT', geometryRef: 'sensor-point-1' },
    verticalSupport: { fromMm: '80', toMm: '120' },
    temporalSupport: { type: 'INTERVAL' },
    uncertainty: { type: 'INTERVAL', lowerDecimal: '0.30', upperDecimal: '0.34' },
    source: { providerId: 'sensor-platform-a', sourceRef: 'obs-20260816-0200', contentHash: 'sha256:obs-1' },
    ...overrides
  };
}

export function createWriteAuthorization(ledger, logicalId, actor = principal, options = {}) {
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: options.assignmentLogicalId ?? `role-context-${actor.organizationId}-${actor.tenantId ?? 'none'}-${logicalId}`,
    version: '1',
    principal: actor,
    role: options.role ?? 'CONTEXT_WRITER',
    roleDefinitionVersion: 'adr-a02-v1',
    permissions: options.permissions ?? [PERMISSIONS.CONTEXT_WRITE],
    scope: options.scope ?? {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'CONTEXT_DATUM'
    },
    audit: audit(actor, 'role')
  });
  const decision = authorizeContextWrite({
    principal: actor,
    roleAssignments: [assignment],
    authorizationScope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'CONTEXT_DATUM',
      resourceId: logicalId
    }
  });
  if (options.expectAllowed !== false) assert.equal(decision.allowed, true);
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(actor, `auth-${logicalId}`) });
  return { assignment, decision, recorded };
}

export function publishAuthorized(ledger, logicalId, version, datum = baseDatum(), actor = principal, suffix = 'publish') {
  const { recorded } = createWriteAuthorization(ledger, logicalId, actor);
  return publishContextDatum({
    ledger,
    logicalId,
    version,
    target: { organizationId: actor.organizationId, ...(actor.tenantId ? { tenantId: actor.tenantId } : {}) },
    datum,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, suffix)
  });
}
