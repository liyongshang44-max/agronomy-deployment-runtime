import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { PERMISSIONS, publishRoleAssignment } from '../../packages/authorization/src/index.mjs';
import { CONTEXT_WRITE_RESOURCE_TYPES, authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';

let seq = 0;
const principal = { principalId: 'integration-a03', type: 'SERVICE_ACCOUNT', organizationId: 'org-a', tenantId: 'tenant-a', programIds: [] };
function audit(suffix = 'a03') {
  seq += 1;
  return { eventId: `f03-context-a03-${suffix}-${seq}`, occurredAt: '2026-08-16T02:30:00Z', actor: { type: principal.type, id: principal.principalId } };
}
function assignment(ledger, resourceType, logicalId = `role-${resourceType.toLowerCase()}`) {
  return publishRoleAssignment({
    ledger,
    logicalId,
    version: '1',
    principal,
    role: 'A03_CONTEXT_WRITER',
    roleDefinitionVersion: 'adr-a03-v1',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType },
    audit: audit('role')
  });
}
function request(resourceType, resourceId) {
  return { organizationId: 'org-a', tenantId: 'tenant-a', resourceType, resourceId };
}
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('context.write current resource vocabulary preserves A02/A03 kinds and adds A04 ContextManifest', () => {
  assert.deepEqual(CONTEXT_WRITE_RESOURCE_TYPES, [
    'CONTEXT_DATUM',
    'AUTHORIZED_CONTEXT_REFERENCE',
    'RESOLVED_CONTEXT_DATUM_RECEIPT',
    'CONTEXT_MANIFEST'
  ]);
});

test('context.write authorizes exact AuthorizedContextReference id', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, 'AUTHORIZED_CONTEXT_REFERENCE');
  const result = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('AUTHORIZED_CONTEXT_REFERENCE', 'cr-1') });
  assert.equal(result.allowed, true);
  assert.equal(result.request.authorizationScope.resourceType, 'AUTHORIZED_CONTEXT_REFERENCE');
  assert.equal(result.request.authorizationScope.resourceId, 'cr-1');
});

test('context.write authorizes exact ResolvedContextDatumReceipt id', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  const result = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('RESOLVED_CONTEXT_DATUM_RECEIPT', 'rcr-1') });
  assert.equal(result.allowed, true);
  assert.equal(result.request.authorizationScope.resourceType, 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  assert.equal(result.request.authorizationScope.resourceId, 'rcr-1');
});

test('resource type isolation prevents reference grant from authorizing receipt', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, 'AUTHORIZED_CONTEXT_REFERENCE');
  const result = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('RESOLVED_CONTEXT_DATUM_RECEIPT', 'rcr-1') });
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('resource type isolation prevents receipt grant from authorizing ContextDatum', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, 'RESOLVED_CONTEXT_DATUM_RECEIPT');
  const result = authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('CONTEXT_DATUM', 'cd-1') });
  assert.equal(result.allowed, false);
  assert(result.reasons.includes('CONTEXT_WRITE_PERMISSION_DENIED'));
});

test('unrecognized future context.write resource type still fails closed', () => {
  const ledger = new AuthorityLedger();
  const grant = assignment(ledger, 'CONTEXT_DATUM');
  assert.throws(
    () => authorizeContextWrite({ principal, roleAssignments: [grant], authorizationScope: request('RUNTIME_BINDING', 'rb-1') }),
    (error) => error?.code === 'INVALID_CONTEXT_WRITE_RESOURCE_TYPE'
  );
});

console.log('Context write A03 resource acceptance: 6 passed');
