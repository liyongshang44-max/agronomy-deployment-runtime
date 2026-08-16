import assert from 'node:assert/strict';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import {
  publishImplementation,
  validateImplementationAuthority
} from '../../packages/implementation-registry/src/index.mjs';
import {
  audit,
  controlScope,
  implementationSpec,
  makeEnv,
  publish
} from './fixture.mjs';

const env = makeEnv();
const original = publish(env, 'impl-retry-governance', '1', implementationSpec());
const before = env.ledger.auditFor(original.ref).filter((event) =>
  sameAuthorityRef(event.objectRef, original.ref) && event.action === 'PUBLISH_IMPLEMENTATION');
assert.equal(before.length, 1);
assert.equal(before[0].actor.id, 'implementation-manager');

const secondManager = createPrincipal({
  principalId: 'implementation-manager-2',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const secondAssignment = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.implementation.second-manager',
  version: '1',
  principal: secondManager,
  role: 'IMPLEMENTATION_MANAGER',
  roleDefinitionVersion: 's02-v1',
  permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
  scope: controlScope(),
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
});
const decision = authorizeImplementationManage({
  principal: secondManager,
  roleAssignments: [secondAssignment],
  authorizationScope: {
    ...controlScope(),
    resourceType: 'IMPLEMENTATION',
    resourceId: original.ref.logicalId
  }
});
assert.equal(decision.allowed, true);
const auth = recordAuthorizationDecision({
  ledger: env.ledger,
  decision,
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth')
});
const retry = publishImplementation({
  ledger: env.ledger,
  logicalId: original.ref.logicalId,
  version: original.ref.version,
  implementation: implementationSpec(),
  principal: secondManager,
  authorizationDecisionAuditRef: auth.ref,
  audit: audit({ type: secondManager.type, id: secondManager.principalId }, 'publish-retry')
});
assert.deepEqual(retry.ref, original.ref);

const after = env.ledger.auditFor(original.ref).filter((event) =>
  sameAuthorityRef(event.objectRef, original.ref) && event.action === 'PUBLISH_IMPLEMENTATION');
assert.equal(after.length, 1);
assert.equal(after[0].actor.id, 'implementation-manager');

const validated = validateImplementationAuthority({ ledger: env.ledger, implementationRef: original.ref });
assert.equal(validated.managementPrincipal.principalId, 'implementation-manager');
console.log('PASS exact semantic retry by another authorized manager cannot rebind original Implementation governance');
console.log('S02 Implementation Registry retry-governance acceptance: 1 passed');
