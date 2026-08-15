import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { DECISION_PROBLEM_CONTRACT_VERSION, publishDecisionProblem } from '../../packages/decision-problem/src/index.mjs';
import { CONTEXT_DATUM_CONTRACT_VERSION, publishContextDatum } from '../../packages/context-contract/src/index.mjs';
import {
  AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
  ExactContextSnapshotStore,
  providerResponseContentHash,
  publishAuthorizedContextReference,
  publishResolvedContextDatumReceipt
} from '../../packages/reference-resolution/src/index.mjs';
import { publishContextManifest } from '../../packages/context-manifest/src/index.mjs';

let seq = 0;
export const principal = {
  principalId: 'context-resolver-a',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
export const targetRef = {
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  farmId: 'farm-1',
  fieldId: 'field-1',
  seasonId: 'season-2026',
  zoneId: 'zone-1'
};

export function audit(actor = principal, suffix = 'a04', occurredAt = '2026-08-16T02:06:00Z') {
  seq += 1;
  return {
    eventId: `a04-${suffix}-${seq}`,
    occurredAt,
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'context-manifest' }
  };
}

export function writeAuthorization(ledger, logicalId, resourceType, actor = principal, options = {}) {
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: options.assignmentLogicalId ?? `role-${resourceType.toLowerCase()}-${logicalId}`,
    version: '1',
    principal: actor,
    role: options.role ?? 'A04_CONTEXT_WRITER',
    roleDefinitionVersion: 'adr-a04-v1',
    permissions: options.permissions ?? [PERMISSIONS.CONTEXT_WRITE],
    scope: options.scope ?? {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType
    },
    audit: audit(actor, 'role', '2026-08-16T01:50:00Z')
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
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(actor, `auth-${resourceType}`, '2026-08-16T01:51:00Z') });
  return { assignment, decision, recorded };
}

export function problemInput(overrides = {}) {
  return {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: 'IRRIGATION_TIMING',
    targetRef,
    logicalTime: '2026-08-16T02:00:00Z',
    decisionHorizon: { duration: 'PT72H' },
    objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' },
    actionSpace: ['WAIT', 'IRRIGATE_NOW'],
    constraints: [],
    usePurpose: 'DECISION_SUPPORT',
    useClass: 'ADVISORY',
    decisionAuthorityMode: 'ADR_POLICY',
    decisionDeadline: '2026-08-16T04:00:00Z',
    ...overrides
  };
}

export function publishProblem(ledger, logicalId = 'dp-a04', input = problemInput(), actor = principal, version = '1') {
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: `role-dp-create-${logicalId}`,
    version: '1',
    principal: actor,
    role: 'A04_DP_CREATOR',
    roleDefinitionVersion: 'adr-a04-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM'
    },
    audit: audit(actor, 'dp-role', '2026-08-16T01:45:00Z')
  });
  const decision = authorizeDecisionProblemCreation({
    principal: actor,
    roleAssignments: [assignment],
    authorizationScope: {
      organizationId: actor.organizationId,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      resourceType: 'DECISION_PROBLEM',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  const recorded = recordAuthorizationDecision({ ledger, decision, audit: audit(actor, 'dp-auth', '2026-08-16T01:46:00Z') });
  return publishDecisionProblem({
    ledger,
    logicalId,
    version,
    problem: input,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'dp-publish', '2026-08-16T01:47:00Z')
  });
}

export function datumInput({
  semanticId = 'soil.volumetric_water_content',
  value = { type: 'DECIMAL', decimal: '0.32' },
  unit = 'm3_per_m3',
  provenanceClass = 'SENSOR',
  availableAt = '2026-08-16T02:01:00Z',
  source = { providerId: 'sensor-a', sourceRef: 'obs-1', contentHash: 'sha256:datum-inline-1' },
  ...overrides
} = {}) {
  return {
    contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
    semanticId,
    value,
    unit,
    epistemicClass: 'OBSERVATION',
    provenanceClass,
    effectiveInterval: { start: '2026-08-16T01:00:00Z', end: '2026-08-16T02:00:00Z' },
    availableAt,
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    verticalSupport: { fromMm: '80', toMm: '120' },
    temporalSupport: { type: 'INTERVAL' },
    uncertainty: { type: 'NONE' },
    source,
    ...overrides
  };
}

export function publishDatum(ledger, logicalId = 'cd-inline-1', input = datumInput(), actor = principal, version = '1') {
  const { recorded } = writeAuthorization(ledger, logicalId, 'CONTEXT_DATUM', actor);
  return publishContextDatum({
    ledger,
    logicalId,
    version,
    target: { organizationId: actor.organizationId, ...(actor.tenantId ? { tenantId: actor.tenantId } : {}) },
    datum: input,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'datum', '2026-08-16T02:02:00Z')
  });
}

export function publishResolvedPair(ledger, {
  suffix = 'ref-1',
  addressingMode = 'MUTABLE_LOCATOR',
  versionToken,
  retainSnapshot = false,
  bytes = Buffer.from(`{"suffix":"${suffix}","vwc":"0.33"}`, 'utf8'),
  snapshotStore = new ExactContextSnapshotStore(),
  resolvedAt = '2026-08-16T02:03:00Z',
  referenceVersion = '1',
  datumVersion = '1',
  receiptVersion = '1'
} = {}) {
  const contentHash = providerResponseContentHash(bytes);
  const referenceId = `cr-${suffix}`;
  const datumId = `cd-${suffix}`;
  const receiptId = `rcr-${suffix}`;
  const expectedContentHash = addressingMode === 'CONTENT_ADDRESSED' ? contentHash : undefined;
  const locator = addressingMode === 'CONTENT_ADDRESSED'
    ? `/content/${contentHash}`
    : `/field/1/state/vwc/${suffix}`;
  const { recorded: referenceAuth } = writeAuthorization(ledger, referenceId, 'AUTHORIZED_CONTEXT_REFERENCE');
  const reference = publishAuthorizedContextReference({
    ledger,
    logicalId: referenceId,
    version: referenceVersion,
    target: { organizationId: 'org-a', tenantId: 'tenant-a' },
    reference: {
      contractVersion: AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
      semanticId: 'soil.volumetric_water_content',
      valueMode: 'AUTHORIZED_REFERENCE',
      reference: {
        providerId: 'customer-context-api',
        locator,
        addressingMode,
        ...(versionToken ? { versionToken } : {}),
        ...(expectedContentHash ? { expectedContentHash } : {})
      },
      authorizationContext: {
        connectionId: 'conn-a04',
        principalScope: { organizationId: 'org-a', tenantId: 'tenant-a', fieldIds: ['field-1'] }
      }
    },
    principal,
    authorizationDecisionAuditRef: referenceAuth.ref,
    audit: audit(principal, 'reference', '2026-08-16T01:55:00Z')
  });
  const datum = publishDatum(ledger, datumId, datumInput({
    value: { type: 'DECIMAL', decimal: '0.33' },
    provenanceClass: 'EXTERNAL_PROVIDER',
    source: { providerId: 'customer-context-api', sourceRef: locator, contentHash }
  }), principal, datumVersion);
  const { recorded: receiptAuth } = writeAuthorization(ledger, receiptId, 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  const receipt = publishResolvedContextDatumReceipt({
    ledger,
    logicalId: receiptId,
    version: receiptVersion,
    referenceRef: reference.ref,
    normalizedContextDatumRef: datum.ref,
    providerResponseBytes: bytes,
    resolution: {
      resolvedAt,
      effectiveAt: '2026-08-16T02:00:00Z',
      availableAt: '2026-08-16T02:01:00Z'
    },
    retainSnapshot,
    snapshotStore,
    principal,
    authorizationDecisionAuditRef: receiptAuth.ref,
    audit: audit(principal, 'receipt', resolvedAt)
  });
  return { reference, datum, receipt, snapshotStore, bytes, contentHash };
}

export function publishManifest(ledger, {
  logicalId = 'cm-a04',
  version = '1',
  decisionProblem,
  datumRefs,
  receiptRefs = [],
  evidenceCutoff = '2026-08-16T02:05:00Z',
  snapshotStore,
  actor = principal,
  auditOccurredAt = '2026-08-16T02:06:00Z'
} = {}) {
  const problem = decisionProblem ?? publishProblem(ledger);
  const datums = datumRefs ?? [publishDatum(ledger).ref];
  const { recorded } = writeAuthorization(ledger, logicalId, 'CONTEXT_MANIFEST', actor);
  return publishContextManifest({
    ledger,
    logicalId,
    version,
    decisionProblemRef: problem.ref,
    evidenceCutoff,
    datumRefs: datums,
    resolvedReferenceReceiptRefs: receiptRefs,
    snapshotStore,
    principal: actor,
    authorizationDecisionAuditRef: recorded.ref,
    audit: audit(actor, 'manifest', auditOccurredAt)
  });
}

export function freshLedger() {
  return new AuthorityLedger();
}
