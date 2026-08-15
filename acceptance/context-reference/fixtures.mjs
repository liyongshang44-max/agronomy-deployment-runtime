import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { PERMISSIONS, publishRoleAssignment, recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { CONTEXT_DATUM_CONTRACT_VERSION, publishContextDatum } from '../../packages/context-contract/src/index.mjs';
import {
  AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
  ExactContextSnapshotStore,
  providerResponseContentHash,
  publishAuthorizedContextReference,
  publishResolvedContextDatumReceipt
} from '../../packages/reference-resolution/src/index.mjs';

let seq = 0;
export const principal = {
  principalId: 'context-gateway-a',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
export const target = { organizationId: 'org-a', tenantId: 'tenant-a' };
export const providerBytes = Buffer.from('{"vwc":"0.32","available_at":"2026-08-16T02:01:00Z"}', 'utf8');
export const providerHash = providerResponseContentHash(providerBytes);

export function audit(actor = principal, suffix = 'a03') {
  seq += 1;
  return {
    eventId: `a03-${suffix}-${seq}`,
    occurredAt: '2026-08-16T02:05:00Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'reference-resolution' }
  };
}

export function writeAuthorization(ledger, logicalId, resourceType, actor = principal, options = {}) {
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: options.assignmentLogicalId ?? `role-${resourceType.toLowerCase()}-${logicalId}`,
    version: '1',
    principal: actor,
    role: 'A03_CONTEXT_WRITER',
    roleDefinitionVersion: 'adr-a03-v1',
    permissions: options.permissions ?? [PERMISSIONS.CONTEXT_WRITE],
    scope: options.scope ?? {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType
    },
    audit: audit(actor, 'role')
  });
  const decision = authorizeContextWrite({
    principal: actor,
    roleAssignments: [assignment],
    authorizationScope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType,
      resourceId: logicalId
    }
  });
  if (options.expectAllowed !== false) assert.equal(decision.allowed, true);
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(actor, 'auth') });
  return { assignment, decision, recorded };
}

export function datumInput(overrides = {}) {
  return {
    contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.32' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'EXTERNAL_PROVIDER',
    effectiveInterval: { start: '2026-08-16T01:00:00Z', end: '2026-08-16T02:00:00Z' },
    availableAt: '2026-08-16T02:01:00Z',
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    verticalSupport: { fromMm: '80', toMm: '120' },
    temporalSupport: { type: 'INTERVAL' },
    uncertainty: { type: 'NONE' },
    source: { providerId: 'customer-context-api', sourceRef: 'field/1/vwc', contentHash: providerHash },
    ...overrides
  };
}

export function publishDatum(ledger, logicalId = 'cd-ref-1', input = datumInput(), actor = principal) {
  const { recorded } = writeAuthorization(ledger, logicalId, 'CONTEXT_DATUM', actor);
  return publishContextDatum({
    ledger,
    logicalId,
    version: '1',
    target: { organizationId: actor.organizationId, ...(actor.tenantId ? { tenantId: actor.tenantId } : {}) },
    datum: input,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'datum')
  });
}

export function referenceInput({ addressingMode = 'MUTABLE_LOCATOR', expectedContentHash, versionToken, ...overrides } = {}) {
  const contentHash = expectedContentHash ?? (addressingMode === 'CONTENT_ADDRESSED' ? providerHash : undefined);
  const defaultLocator = addressingMode === 'CONTENT_ADDRESSED'
    ? `/content/${contentHash}`
    : '/field/1/state/vwc';
  return {
    contractVersion: AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
    semanticId: 'soil.volumetric_water_content',
    valueMode: 'AUTHORIZED_REFERENCE',
    reference: {
      providerId: 'customer-context-api',
      locator: defaultLocator,
      addressingMode,
      ...(versionToken ? { versionToken } : {}),
      ...(contentHash ? { expectedContentHash: contentHash } : {}),
      ...(overrides.reference ?? {})
    },
    authorizationContext: {
      connectionId: 'conn-customer-a',
      principalScope: { organizationId: 'org-a', tenantId: 'tenant-a', fieldIds: ['field-1'] },
      ...(overrides.authorizationContext ?? {})
    },
    ...(overrides.semanticId ? { semanticId: overrides.semanticId } : {})
  };
}

export function publishReference(ledger, logicalId = 'cr-1', input = referenceInput(), actor = principal, version = '1') {
  const { recorded } = writeAuthorization(ledger, logicalId, 'AUTHORIZED_CONTEXT_REFERENCE', actor);
  return publishAuthorizedContextReference({
    ledger,
    logicalId,
    version,
    target: { organizationId: actor.organizationId, ...(actor.tenantId ? { tenantId: actor.tenantId } : {}) },
    reference: input,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'reference')
  });
}

export function resolutionTimes(overrides = {}) {
  return {
    resolvedAt: '2026-08-16T02:03:00Z',
    effectiveAt: '2026-08-16T02:00:00Z',
    availableAt: '2026-08-16T02:01:00Z',
    ...overrides
  };
}

export function publishReceipt(ledger, {
  receiptId = 'rcr-1',
  reference,
  datum,
  bytes = providerBytes,
  retainSnapshot = false,
  snapshotStore = new ExactContextSnapshotStore(),
  actor = principal,
  resolution = resolutionTimes(),
  version = '1'
} = {}) {
  const actualReference = reference ?? publishReference(ledger);
  const actualDatum = datum ?? publishDatum(ledger);
  const { recorded } = writeAuthorization(ledger, receiptId, 'RESOLVED_CONTEXT_DATUM_RECEIPT', actor);
  const receipt = publishResolvedContextDatumReceipt({
    ledger,
    logicalId: receiptId,
    version,
    referenceRef: actualReference.ref,
    normalizedContextDatumRef: actualDatum.ref,
    providerResponseBytes: bytes,
    resolution,
    retainSnapshot,
    snapshotStore,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'receipt')
  });
  return { receipt, reference: actualReference, datum: actualDatum, snapshotStore };
}

export function freshLedger() {
  return new AuthorityLedger();
}
