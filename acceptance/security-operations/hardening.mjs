import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  PERMISSIONS,
  authorizeAuditExport,
  authorizeRetentionManage,
  authorizeSecretUse,
  publishBuiltinRoleAssignment,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  ArtifactRetentionController,
  PilotSecretVault,
  PilotSecureArtifactStore,
  SecurityEventJournal,
  SecurityOperationsError,
  createTenantAuditExport
} from '../../packages/security-operations/src/index.mjs';

let seq = 0;
const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
const securityPrincipal = {
  principalId: 'security-hardening-a',
  type: 'SERVICE_ACCOUNT',
  ...scope,
  programIds: []
};
const auditor = {
  principalId: 'auditor-hardening-a',
  type: 'USER',
  ...scope,
  programIds: []
};

function audit(actor = securityPrincipal, suffix = 'hardening', inputRefs = []) {
  seq += 1;
  return {
    eventId: `p07-hardening-${suffix}-${seq}`,
    occurredAt: '2026-08-17T17:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    inputRefs
  };
}

function securityRole(ledger) {
  return publishRoleAssignment({
    ledger,
    logicalId: 'role.security.hardening',
    version: '1',
    principal: securityPrincipal,
    role: 'SECURITY_OPERATOR',
    roleDefinitionVersion: 'p07-pilot-v1',
    permissions: [PERMISSIONS.SECRET_USE, PERMISSIONS.RETENTION_MANAGE],
    scope,
    audit: audit()
  });
}

function sourceArtifactWorld(ledger, store, suffix) {
  const registry = new SourceRegistry({ ledger, artifactStore: store });
  const source = registry.registerSource({
    logicalId: `source-hardening-${suffix}`,
    version: '1',
    sourceType: 'PROTOCOL',
    title: `Private protocol ${suffix}`,
    ownership: scope,
    rights: { classification: 'CUSTOMER_PROPRIETARY' },
    audit: audit(securityPrincipal, `source-${suffix}`)
  });
  const artifact = registry.materializeArtifact({
    logicalId: `artifact-hardening-${suffix}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(`private-${suffix}`),
    mediaType: 'text/plain',
    materializationIdentity: `hardening-${suffix}`,
    acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-17T16:00:00Z' },
    rightsSnapshot: { exportClass: 'CONTROLLED' },
    audit: audit(securityPrincipal, `artifact-${suffix}`)
  });
  return { source, artifact };
}

function retentionAuthorization(ledger, role, artifactRef) {
  const decision = authorizeRetentionManage({
    principal: securityPrincipal,
    roleAssignments: [role],
    authorizationScope: { ...scope, resourceType: 'RETENTION_POLICY', resourceId: artifactRef.logicalId },
    artifactRef
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(securityPrincipal, 'retention-auth') });
}

function auditExportAuthorization(ledger, roots) {
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.auditor.hardening.${seq}`,
    version: '1',
    principal: auditor,
    role: 'AUDITOR',
    scope,
    audit: audit(auditor, 'auditor-role')
  });
  const resourceId = semanticHash('PilotAuditExportRequest', { scope, rootRefs: roots });
  const decision = authorizeAuditExport({
    principal: auditor,
    roleAssignments: [role],
    authorizationScope: { ...scope, resourceType: 'AUDIT_EXPORT', resourceId },
    rootRefs: roots
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(auditor, 'audit-export-auth') });
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await test('rights-based audit export denial emits tenant-scoped DENY security event', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const events = new SecurityEventJournal();
  const role = securityRole(ledger);
  const { artifact } = sourceArtifactWorld(ledger, store, 'rights-deny-event');
  const retentionAuth = retentionAuthorization(ledger, role, artifact.ref);
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store, securityEvents: events });
  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope,
    retentionMode: 'RETAIN',
    auditExportAllowed: false,
    preserveExactReplay: true,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T17:10:00Z'
  });
  const exportAuth = auditExportAuthorization(ledger, [artifact.ref]);
  assert.throws(
    () => createTenantAuditExport({
      ledger,
      rootRefs: [artifact.ref],
      ...scope,
      principal: auditor,
      authorizationDecisionAuditRef: exportAuth.ref,
      retentionController: retention,
      occurredAt: '2026-08-17T17:11:00Z',
      securityEvents: events
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'ARTIFACT_AUDIT_EXPORT_DENIED'
  );
  assert.ok(events.list(scope).some((event) =>
    event.eventType === 'AUDIT_EXPORT'
    && event.outcome === 'DENY'
    && event.reasonCode === 'ARTIFACT_AUDIT_EXPORT_DENIED'));
});

await test('audit dependency closure fails closed when exact audit input authority is missing', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const missingRef = {
    kind: 'ContextDatum',
    logicalId: 'missing-context-authority',
    version: '1',
    semanticHash: `sha256:${'f'.repeat(64)}`
  };
  const root = ledger.publish({
    kind: 'ScopedOperationalThing',
    logicalId: 'scoped-with-missing-input',
    version: '1',
    semanticPayload: { ...scope, marker: 'safe' },
    audit: audit(securityPrincipal, 'missing-input-root', [missingRef])
  });
  const exportAuth = auditExportAuthorization(ledger, [root.ref]);
  assert.throws(
    () => createTenantAuditExport({
      ledger,
      rootRefs: [root.ref],
      ...scope,
      principal: auditor,
      authorizationDecisionAuditRef: exportAuth.ref,
      occurredAt: '2026-08-17T17:20:00Z',
      securityEvents: events
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'AUDIT_EXPORT_INPUT_AUTHORITY_MISSING'
  );
  assert.ok(events.list(scope).some((event) =>
    event.eventType === 'AUDIT_EXPORT'
    && event.outcome === 'DENY'
    && event.reasonCode === 'AUDIT_EXPORT_INPUT_AUTHORITY_MISSING'));
});

await test('retention directive revisions preserve immutable operational control history', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const role = securityRole(ledger);
  const { artifact } = sourceArtifactWorld(ledger, store, 'history');
  const retentionAuth = retentionAuthorization(ledger, role, artifact.ref);
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store });
  const first = retention.setDirective({
    artifactRef: artifact.ref,
    ...scope,
    retentionMode: 'RETAIN',
    legalHold: true,
    auditExportAllowed: false,
    preserveExactReplay: true,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T17:30:00Z'
  });
  const second = retention.setDirective({
    artifactRef: artifact.ref,
    ...scope,
    retentionMode: 'DELETE_AFTER',
    retainUntil: '2026-09-17T00:00:00Z',
    legalHold: false,
    auditExportAllowed: true,
    preserveExactReplay: true,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T17:31:00Z'
  });
  const history = retention.directiveHistoryFor(artifact.ref);
  assert.equal(history.length, 2);
  assert.equal(history[0].directiveHash, first.directiveHash);
  assert.equal(history[0].legalHold, true);
  assert.equal(history[1].directiveHash, second.directiveHash);
  assert.equal(history[1].legalHold, false);
  assert.equal(retention.directiveFor(artifact.ref).directiveHash, second.directiveHash);
});

await test('rejected secret operation is logged without secret value or exception message', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const role = securityRole(ledger);
  const useDecision = authorizeSecretUse({
    principal: securityPrincipal,
    roleAssignments: [role],
    authorizationScope: { ...scope, resourceType: 'SECRET', resourceId: 'provider-key' }
  });
  assert.equal(useDecision.allowed, true);
  const useAuth = recordAuthorizationDecision({ ledger, decision: useDecision, audit: audit(securityPrincipal, 'secret-use-auth') });
  const vault = new PilotSecretVault({ ledger, securityEvents: events });
  assert.throws(
    () => vault.put({
      ...scope,
      secretId: 'provider-key',
      value: 'MUST-NEVER-LOG-THIS',
      principal: securityPrincipal,
      authorizationDecisionAuditRef: useAuth.ref,
      occurredAt: '2026-08-17T17:40:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'SECURITY_AUTHORIZATION_MISMATCH'
  );
  const serialized = JSON.stringify(events.list(scope));
  assert.equal(serialized.includes('MUST-NEVER-LOG-THIS'), false);
  assert.equal(serialized.includes('stored authorization does not bind'), false);
  assert.ok(events.list(scope).some((event) =>
    event.eventType === 'SECRET_STORE'
    && event.outcome === 'DENY'
    && event.reasonCode === 'SECURITY_AUTHORIZATION_MISMATCH'));
});

console.log(`P07 security hardening acceptance: ${passed} passed`);
