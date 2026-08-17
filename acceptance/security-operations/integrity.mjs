import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  PERMISSIONS,
  authorizeAuditExport,
  authorizeRetentionManage,
  authorizeSecretManage,
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
const principal = {
  principalId: 'security-integrity-a',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
};
const auditor = { ...principal, principalId: 'auditor-integrity-a', type: 'USER' };
function audit(actor = principal, suffix = 'integrity') {
  seq += 1;
  return {
    eventId: `p07-integrity-${suffix}-${seq}`,
    occurredAt: '2026-08-17T16:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId }
  };
}
function scope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function securityRole(ledger) {
  return publishRoleAssignment({
    ledger,
    logicalId: 'role.security.integrity',
    version: '1',
    principal,
    role: 'SECURITY_OPERATOR',
    roleDefinitionVersion: 'p07-pilot-v1',
    permissions: [PERMISSIONS.SECRET_MANAGE, PERMISSIONS.RETENTION_MANAGE],
    scope: scope(),
    audit: audit()
  });
}
function sourceArtifactWorld(ledger, store, suffix) {
  const registry = new SourceRegistry({ ledger, artifactStore: store });
  const source = registry.registerSource({
    logicalId: `source-integrity-${suffix}`,
    version: '1',
    sourceType: 'PROTOCOL',
    title: `PRIVATE-TITLE-${suffix}`,
    ownership: scope(),
    rights: { privateMarker: `PRIVATE-RIGHTS-${suffix}` },
    audit: audit(principal, `source-${suffix}`)
  });
  const artifact = registry.materializeArtifact({
    logicalId: `artifact-integrity-${suffix}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(`PRIVATE-BYTES-${suffix}`),
    mediaType: 'text/plain',
    materializationIdentity: `integrity-${suffix}`,
    acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-17T15:00:00Z' },
    rightsSnapshot: { exportClass: 'CONTROLLED', privateMarker: `PRIVATE-SNAPSHOT-${suffix}` },
    audit: audit(principal, `artifact-${suffix}`)
  });
  return { registry, source, artifact };
}
function retentionAuthorization(ledger, role, artifactRef) {
  const decision = authorizeRetentionManage({
    principal,
    roleAssignments: [role],
    authorizationScope: { ...scope(), resourceType: 'RETENTION_POLICY', resourceId: artifactRef.logicalId },
    artifactRef
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'retention-auth') });
}
function auditorAuthorization(ledger, rootRefs) {
  const role = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.auditor.integrity.${seq}`,
    version: '1',
    principal: auditor,
    role: 'AUDITOR',
    scope: scope(),
    audit: audit(auditor, 'auditor-role')
  });
  const requestId = semanticHash('PilotAuditExportRequest', { scope: scope(), rootRefs });
  const decision = authorizeAuditExport({
    principal: auditor,
    roleAssignments: [role],
    authorizationScope: { ...scope(), resourceType: 'AUDIT_EXPORT', resourceId: requestId },
    rootRefs
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({ ledger, decision, audit: audit(auditor, 'export-auth') });
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

function forbiddenExactKeyPaths(value, forbiddenKeys, path = '$', hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenExactKeyPaths(item, forbiddenKeys, `${path}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) hits.push(`${path}.${key}`);
    forbiddenExactKeyPaths(child, forbiddenKeys, `${path}.${key}`, hits);
  }
  return hits;
}

await test('secure artifact store exposes no public deletion or unscoped read/write bypass', async () => {
  const store = new PilotSecureArtifactStore();
  store.putForScope(scope(), Buffer.from('retained'));
  assert.equal(typeof store.put, 'undefined');
  assert.equal(typeof store.get, 'undefined');
  assert.equal(typeof store.has, 'undefined');
  assert.equal(typeof store.delete, 'undefined');
  assert.equal(typeof store.remove, 'undefined');
  assert.equal(store.count(), 1);
});

await test('rights-aware retention directive can deny audit export even to authorized tenant auditor', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const role = securityRole(ledger);
  const { artifact } = sourceArtifactWorld(ledger, store, 'rights-deny');
  const retentionAuth = retentionAuthorization(ledger, role, artifact.ref);
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store });
  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'RETAIN',
    auditExportAllowed: false,
    preserveExactReplay: true,
    principal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T16:10:00Z'
  });
  const exportAuth = auditorAuthorization(ledger, [artifact.ref]);
  assert.throws(
    () => createTenantAuditExport({
      ledger,
      rootRefs: [artifact.ref],
      ...scope(),
      principal: auditor,
      authorizationDecisionAuditRef: exportAuth.ref,
      retentionController: retention,
      occurredAt: '2026-08-17T16:11:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'ARTIFACT_AUDIT_EXPORT_DENIED'
  );
});

await test('self-consistent AuthorizationDecisionAudit without direct authorization audit action cannot authorize secret storage', async () => {
  const ledger = new AuthorityLedger();
  const role = securityRole(ledger);
  const decision = authorizeSecretManage({
    principal,
    roleAssignments: [role],
    authorizationScope: { ...scope(), resourceType: 'SECRET', resourceId: 'forged-secret' }
  });
  assert.equal(decision.allowed, true);
  const forged = ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: decision.decisionHash,
    version: '1',
    semanticPayload: decision,
    audit: {
      ...audit(principal, 'forged-auth'),
      action: 'PUBLISH_AUTHORITY',
      inputRefs: [role.ref]
    }
  });
  const vault = new PilotSecretVault({ ledger });
  assert.throws(
    () => vault.put({
      ...scope(), secretId: 'forged-secret', value: 'MUST-NOT-STORE', principal,
      authorizationDecisionAuditRef: forged.ref, occurredAt: '2026-08-17T16:20:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'SECURITY_AUTHORIZATION_AUDIT_INVALID'
  );
  assert.deepEqual(vault.metadataSnapshot(scope()), []);
});

await test('audit export fails closed for an authority root whose tenant scope cannot be proven', async () => {
  const ledger = new AuthorityLedger();
  const root = ledger.publish({
    kind: 'OpaqueOperationalThing',
    logicalId: 'opaque-1',
    version: '1',
    semanticPayload: { opaque: true },
    audit: audit(principal, 'opaque')
  });
  const exportAuth = auditorAuthorization(ledger, [root.ref]);
  assert.throws(
    () => createTenantAuditExport({
      ledger,
      rootRefs: [root.ref],
      ...scope(),
      principal: auditor,
      authorizationDecisionAuditRef: exportAuth.ref,
      occurredAt: '2026-08-17T16:30:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'AUDIT_SCOPE_UNPROVEN'
  );
});

await test('sanitized audit export contains no authority semantic payload, raw bytes or audit details', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const role = securityRole(ledger);
  const { artifact } = sourceArtifactWorld(ledger, store, 'sanitize');
  const retentionAuth = retentionAuthorization(ledger, role, artifact.ref);
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store });
  retention.setDirective({
    artifactRef: artifact.ref,
    ...scope(),
    retentionMode: 'RETAIN',
    auditExportAllowed: true,
    preserveExactReplay: true,
    principal,
    authorizationDecisionAuditRef: retentionAuth.ref,
    occurredAt: '2026-08-17T16:40:00Z'
  });
  const exportAuth = auditorAuthorization(ledger, [artifact.ref]);
  const exported = createTenantAuditExport({
    ledger,
    rootRefs: [artifact.ref],
    ...scope(),
    principal: auditor,
    authorizationDecisionAuditRef: exportAuth.ref,
    retentionController: retention,
    occurredAt: '2026-08-17T16:41:00Z'
  });
  assert.equal(exported.semanticPayloadIncluded, false);
  assert.equal(exported.rawSourceArtifactBytesIncluded, false);
  assert.deepEqual(
    forbiddenExactKeyPaths(exported, new Set(['semanticPayload', 'details', 'bytes', 'rawBytes'])),
    []
  );
  const serialized = JSON.stringify(exported);
  for (const forbidden of ['PRIVATE-TITLE-sanitize', 'PRIVATE-BYTES-sanitize', 'PRIVATE-RIGHTS-sanitize', 'PRIVATE-SNAPSHOT-sanitize']) {
    assert.equal(serialized.includes(forbidden), false, `audit export leaked ${forbidden}`);
  }
  assert.ok(exported.auditEvents.every((event) => !('details' in event) && typeof event.detailsHash === 'string'));
});

await test('retention controller rejects foreign-tenant scope before control publication', async () => {
  const ledger = new AuthorityLedger();
  const store = new PilotSecureArtifactStore();
  const role = securityRole(ledger);
  const { artifact } = sourceArtifactWorld(ledger, store, 'scope-mismatch');
  const auth = retentionAuthorization(ledger, role, artifact.ref);
  const retention = new ArtifactRetentionController({ ledger, artifactStore: store });
  assert.throws(
    () => retention.setDirective({
      artifactRef: artifact.ref,
      organizationId: 'org-a',
      tenantId: 'tenant-b',
      retentionMode: 'RETAIN',
      auditExportAllowed: true,
      principal,
      authorizationDecisionAuditRef: auth.ref,
      occurredAt: '2026-08-17T16:50:00Z'
    }),
    (error) => error instanceof SecurityOperationsError && error.code === 'RETENTION_SCOPE_MISMATCH'
  );
});

await test('security event journal is tenant-filtered and remains non-authority metadata', async () => {
  const events = new SecurityEventJournal();
  const principalB = { ...principal, principalId: 'security-integrity-b', tenantId: 'tenant-b' };
  events.record({
    occurredAt: '2026-08-17T17:00:00Z', principal, eventType: 'TEST_SECURITY_EVENT',
    resourceType: 'SECRET', resourceId: 'a', outcome: 'ALLOW', reasonCode: 'TEST'
  });
  events.record({
    occurredAt: '2026-08-17T17:00:01Z', principal: principalB, eventType: 'TEST_SECURITY_EVENT',
    resourceType: 'SECRET', resourceId: 'b', outcome: 'DENY', reasonCode: 'TEST'
  });
  const a = events.list(scope());
  assert.equal(a.length, 1);
  assert.equal(a[0].resourceId, 'a');
  assert.equal(a[0].authorityClaim, 'NONE_SECURITY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY');
  assert.equal('ref' in a[0], false);
});

console.log(`P07 security integrity acceptance: ${passed} passed`);
