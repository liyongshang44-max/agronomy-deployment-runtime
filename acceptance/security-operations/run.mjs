import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  PERMISSIONS,
  authorizeAuditExport,
  authorizeRetentionManage,
  authorizeSecretManage,
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
const securityPrincipal = {
  principalId: 'security-operator-a',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
const auditor = {
  principalId: 'auditor-a',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
function audit(actor = securityPrincipal, suffix = 'p07') {
  seq += 1;
  return {
    eventId: `p07-${suffix}-${seq}`,
    occurredAt: '2026-08-17T15:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}
function scope(tenantId = 'tenant-a') {
  return { organizationId: 'org-a', tenantId };
}
function publishSecurityRole(ledger, principal = securityPrincipal, tenantId = 'tenant-a') {
  return publishRoleAssignment({
    ledger,
    logicalId: `role.security.${principal.principalId}`,
    version: '1',
    principal,
    role: 'SECURITY_OPERATOR',
    roleDefinitionVersion: 'p07-pilot-v1',
    permissions: [PERMISSIONS.SECRET_MANAGE, PERMISSIONS.SECRET_USE, PERMISSIONS.RETENTION_MANAGE],
    scope: { organizationId: 'org-a', tenantId },
    audit: audit(principal, 'security-role')
  });
}
function recordSecretDecision({ ledger, assignment, principal = securityPrincipal, operation, secretId, tenantId = 'tenant-a' }) {
  const authorizer = operation === 'SECRET_MANAGE' ? authorizeSecretManage : authorizeSecretUse;
  const decision = authorizer({
    principal,
    roleAssignments: [assignment],
    authorizationScope: { organizationId: 'org-a', tenantId, resourceType: 'SECRET', resourceId: secretId }
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(principal, `auth-${operation}`) });
}
function recordRetentionDecision({ ledger, assignment, artifactRef, principal = securityPrincipal, tenantId = 'tenant-a' }) {
  const decision = authorizeRetentionManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: {
      organizationId: 'org-a', tenantId, resourceType: 'RETENTION_POLICY', resourceId: artifactRef.logicalId
    },
    artifactRef
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'auth-retention') });
}
function createSourceArtifact({ ledger, artifactStore, suffix, rightsSnapshot = { licenseId: 'customer-terms-1' } }) {
  const registry = new SourceRegistry({ ledger, artifactStore });
  const source = registry.registerSource({
    logicalId: `source-${suffix}`,
    version: '1',
    sourceType: 'PROTOCOL',
    title: `Private agronomy ${suffix}`,
    ownership: scope(),
    rights: { classification: 'CUSTOMER_PROPRIETARY' },
    audit: audit(securityPrincipal, `source-${suffix}`)
  });
  const bytes = Buffer.from(`private-source-bytes-${suffix}`);
  const artifact = registry.materializeArtifact({
    logicalId: `artifact-${suffix}`,
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'text/plain',
    materializationIdentity: `materialization-${suffix}`,
    acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-17T14:00:00Z' },
    rightsSnapshot,
    audit: audit(securityPrincipal, `artifact-${suffix}`)
  });
  return { registry, source, artifact, bytes };
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

await test('secret values are tenant-isolated, independently authorized and absent from metadata/security events', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const roleA = publishSecurityRole(ledger);
  const manageA = recordSecretDecision({ ledger, assignment: roleA, operation: 'SECRET_MANAGE', secretId: 'weather-api-key' });
  const useA = recordSecretDecision({ ledger, assignment: roleA, operation: 'SECRET_USE', secretId: 'weather-api-key' });
  const vault = new PilotSecretVault({ ledger, securityEvents: events });

  const metadata1 = vault.put({
    ...scope(),
    secretId: 'weather-api-key',
    value: 'TOP-SECRET-A',
    principal: securityPrincipal,
    authorizationDecisionAuditRef: manageA.ref,
    occurredAt: '2026-08-17T15:10:00Z'
  });
  assert.equal(metadata1.revision, 1);
  const metadata2 = vault.put({
    ...scope(),
    secretId: 'weather-api-key',
    value: 'ROTATED-SECRET-A',
    principal: securityPrincipal,
    authorizationDecisionAuditRef: manageA.ref,
    occurredAt: '2026-08-17T15:11:00Z'
  });
  assert.equal(metadata2.revision, 2);
  const value = vault.read({
    ...scope(),
    secretId: 'weather-api-key',
    principal: securityPrincipal,
    authorizationDecisionAuditRef: useA.ref,
    occurredAt: '2026-08-17T15:12:00Z'
  });
  assert.equal(value.toString('utf8'), 'ROTATED-SECRET-A');
  assert.equal(JSON.stringify(vault.metadataSnapshot(scope())).includes('ROTATED-SECRET-A'), false);
  assert.equal(JSON.stringify(events.list(scope())).includes('ROTATED-SECRET-A'), false);

  const principalB = { ...securityPrincipal, principalId: 'security-operator-b', tenantId: 'tenant-b' };
  const roleB = publishSecurityRole(ledger, principalB, 'tenant-b');
  const manageB = recordSecretDecision({
    ledger, assignment: roleB, principal: principalB, operation: 'SECRET_MANAGE', secretId: 'weather-api-key', tenantId: 'tenant-b'
  });
  const useB = recordSecretDecision({
    ledger, assignment: roleB, principal: principalB, operation: 'SECRET_USE', secretId: 'weather-api-key', tenantId: 'tenant-b'
  });
  vault.put({
    ...scope('tenant-b'), secretId: 'weather-api-key', value: 'TOP-SECRET-B', principal: principalB,
    authorizationDecisionAuditRef: manageB.ref, occurredAt: '2026-08-17T15:13:00Z'
  });
  const valueB = vault.read({
    ...scope('tenant-b'), secretId: 'weather-api-key', principal: principalB,
    authorizationDecisionAuditRef: useB.ref, occurredAt: '2026-08-17T15:14:00Z'
  });
  assert.equal(valueB.toString('utf8'), 'TOP-SECRET-B');
  assert.throws(
    () => vault.read({
      ...scope(), secretId: 'weather-api-key', principal: principalB,
      authorizationDecisionAuditRef: useB.ref, occurredAt: '2026-08-17T15:15:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'SECURITY_AUTHORIZATION_REPLAY_MISMATCH'
  );
});

await test('legal hold and exact replay protection block retention deletion without mutating SourceArtifact authority', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const store = new PilotSecureArtifactStore();
  const role = publishSecurityRole(ledger);
  const { registry, artifact, bytes } = createSourceArtifact({ ledger, artifactStore: store, suffix: 'retention' });
  const auth = recordRetentionDecision({ ledger, assignment: role, artifactRef: artifact.ref });
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store, securityEvents: events });

  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'DELETE_AFTER',
    retainUntil: '2026-08-17T15:00:00Z',
    legalHold: true,
    auditExportAllowed: true,
    preserveExactReplay: false,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: auth.ref,
    occurredAt: '2026-08-17T15:20:00Z'
  });
  assert.throws(
    () => retention.deleteArtifact({
      artifactRef: artifact.ref, principal: securityPrincipal, authorizationDecisionAuditRef: auth.ref,
      occurredAt: '2026-08-17T15:21:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'LEGAL_HOLD_ACTIVE'
  );
  assert.equal(registry.readArtifactBytes(artifact.ref).equals(bytes), true);

  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'DELETE_AFTER',
    retainUntil: '2026-08-17T15:00:00Z',
    legalHold: false,
    auditExportAllowed: true,
    preserveExactReplay: true,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: auth.ref,
    occurredAt: '2026-08-17T15:22:00Z'
  });
  assert.throws(
    () => retention.deleteArtifact({
      artifactRef: artifact.ref, principal: securityPrincipal, authorizationDecisionAuditRef: auth.ref,
      occurredAt: '2026-08-17T15:23:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'EXACT_REPLAY_PROTECTED'
  );
  assert.equal(retention.statusFor(artifact.ref).availability, 'EXACT_MATERIAL_AVAILABLE');

  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'DELETE_AFTER',
    retainUntil: '2026-08-17T15:00:00Z',
    legalHold: false,
    auditExportAllowed: true,
    preserveExactReplay: false,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: auth.ref,
    occurredAt: '2026-08-17T15:24:00Z'
  });
  const deletion = retention.deleteArtifact({
    artifactRef: artifact.ref, principal: securityPrincipal, authorizationDecisionAuditRef: auth.ref,
    occurredAt: '2026-08-17T15:25:00Z'
  });
  assert.equal(deletion.availability, 'EXACT_MATERIAL_UNAVAILABLE');
  assert.equal(deletion.declaredAuthorityReplaySemanticsMutated, false);
  assert.deepEqual(ledger.resolve(artifact.ref), artifact);
  assert.throws(() => registry.readArtifactBytes(artifact.ref), /not retained/);
  const securityEvents = events.list(scope());
  assert.ok(securityEvents.some((event) => event.eventType === 'ARTIFACT_DELETE' && event.outcome === 'DENY' && event.reasonCode === 'LEGAL_HOLD_ACTIVE'));
  assert.ok(securityEvents.some((event) => event.eventType === 'ARTIFACT_DELETE' && event.outcome === 'DENY' && event.reasonCode === 'EXACT_REPLAY_PROTECTED'));
  assert.ok(securityEvents.some((event) => event.eventType === 'ARTIFACT_DELETE' && event.outcome === 'ALLOW'));
});

await test('tenant audit export is exact dependency closure without semantic payloads/raw artifact bytes and obeys rights directive', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const store = new PilotSecureArtifactStore();
  const securityRole = publishSecurityRole(ledger);
  const { source, artifact, bytes } = createSourceArtifact({
    ledger,
    artifactStore: store,
    suffix: 'audit-export',
    rightsSnapshot: { licenseId: 'CUSTOMER-LICENSE-SECRET', auditClass: 'CONTROLLED' }
  });
  const retentionAuth = recordRetentionDecision({ ledger, assignment: securityRole, artifactRef: artifact.ref });
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store, securityEvents: events });
  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'RETAIN',
    legalHold: false,
    auditExportAllowed: true,
    preserveExactReplay: true,
    principal: securityPrincipal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T15:30:00Z'
  });

  const auditorRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.auditor-a',
    version: '1',
    principal: auditor,
    role: 'AUDITOR',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(auditor, 'auditor-role')
  });
  const roots = [artifact.ref];
  const exportRequestId = semanticHash('PilotAuditExportRequest', { scope: scope(), rootRefs: roots });
  const decision = authorizeAuditExport({
    principal: auditor,
    roleAssignments: [auditorRole],
    authorizationScope: { ...scope(), resourceType: 'AUDIT_EXPORT', resourceId: exportRequestId },
    rootRefs: roots
  });
  assert.equal(decision.allowed, true);
  const authorization = recordAuthorizationDecision({ ledger, decision, audit: audit(auditor, 'audit-export-auth') });
  const exported = createTenantAuditExport({
    ledger,
    rootRefs: roots,
    ...scope(),
    principal: auditor,
    authorizationDecisionAuditRef: authorization.ref,
    retentionController: retention,
    occurredAt: '2026-08-17T15:31:00Z',
    securityEvents: events
  });
  assert.deepEqual(exported.rootRefs, roots);
  assert.ok(exported.authorityRefs.some((ref) => ref.semanticHash === artifact.ref.semanticHash));
  assert.ok(exported.authorityRefs.some((ref) => ref.semanticHash === source.ref.semanticHash));
  assert.equal(exported.semanticPayloadIncluded, false);
  assert.equal(exported.rawSourceArtifactBytesIncluded, false);
  const serialized = JSON.stringify(exported);
  assert.equal(serialized.includes('Private agronomy audit-export'), false);
  assert.equal(serialized.includes('CUSTOMER-LICENSE-SECRET'), false);
  assert.equal(serialized.includes(bytes.toString('utf8')), false);
  assert.ok(events.list(scope()).some((event) => event.eventType === 'AUDIT_EXPORT' && event.outcome === 'ALLOW'));
});

await test('cross-tenant audit export fails closed even when foreign tenant has its own valid AUDITOR authority', async () => {
  const ledger = new AuthorityLedger();
  const events = new SecurityEventJournal();
  const store = new PilotSecureArtifactStore();
  const securityRole = publishSecurityRole(ledger);
  const { artifact } = createSourceArtifact({ ledger, artifactStore: store, suffix: 'cross-tenant-export' });
  const retentionAuth = recordRetentionDecision({ ledger, assignment: securityRole, artifactRef: artifact.ref });
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store, securityEvents: events });
  retention.setDirective({
    artifactRef: artifact.ref, ...scope(), retentionMode: 'RETAIN', legalHold: false, auditExportAllowed: true,
    preserveExactReplay: true, principal: securityPrincipal, authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T15:40:00Z'
  });

  const auditorB = { ...auditor, principalId: 'auditor-b', tenantId: 'tenant-b' };
  const roleB = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.auditor-b', version: '1', principal: auditorB, role: 'AUDITOR',
    scope: { organizationId: 'org-a', tenantId: 'tenant-b' }, audit: audit(auditorB, 'auditor-b-role')
  });
  const roots = [artifact.ref];
  const requestScopeB = scope('tenant-b');
  const exportRequestId = semanticHash('PilotAuditExportRequest', { scope: requestScopeB, rootRefs: roots });
  const decisionB = authorizeAuditExport({
    principal: auditorB,
    roleAssignments: [roleB],
    authorizationScope: { ...requestScopeB, resourceType: 'AUDIT_EXPORT', resourceId: exportRequestId },
    rootRefs: roots
  });
  assert.equal(decisionB.allowed, true);
  const authB = recordAuthorizationDecision({ ledger, decision: decisionB, audit: audit(auditorB, 'export-b-auth') });
  assert.throws(
    () => createTenantAuditExport({
      ledger, rootRefs: roots, ...requestScopeB, principal: auditorB,
      authorizationDecisionAuditRef: authB.ref, retentionController: retention,
      occurredAt: '2026-08-17T15:41:00Z', securityEvents: events
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'CROSS_TENANT_AUDIT_EXPORT_DENIED'
  );
  assert.ok(events.list(requestScopeB).some((event) => event.eventType === 'AUDIT_EXPORT'
    && event.outcome === 'DENY' && event.reasonCode === 'CROSS_TENANT_AUDIT_EXPORT_DENIED'));
});

await test('customer SourceArtifact has no P07 path to cross-tenant training or inference', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const role = publishSecurityRole(ledger);
  const { artifact } = createSourceArtifact({ ledger, artifactStore: store, suffix: 'training' });
  const auth = recordRetentionDecision({ ledger, assignment: role, artifactRef: artifact.ref });
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store });
  retention.setDirective({
    artifactRef: artifact.ref, ...scope(), retentionMode: 'RETAIN', auditExportAllowed: false,
    preserveExactReplay: true, principal: securityPrincipal, authorizationDecisionAuditRef: auth.ref,
    occurredAt: '2026-08-17T15:50:00Z'
  });
  const crossTenant = retention.trainingUseDecision({
    artifactRef: artifact.ref, targetOrganizationId: 'org-a', targetTenantId: 'tenant-b'
  });
  assert.equal(crossTenant.allowed, false);
  assert.equal(crossTenant.reason, 'CROSS_TENANT_TRAINING_DENIED_BY_DEFAULT');
  const sameTenant = retention.trainingUseDecision({
    artifactRef: artifact.ref, targetOrganizationId: 'org-a', targetTenantId: 'tenant-a'
  });
  assert.equal(sameTenant.allowed, false);
  assert.equal(sameTenant.reason, 'TRAINING_NOT_AUTHORIZED_BY_P07');
});

console.log(`P07 pilot security operations acceptance: ${passed} passed`);
