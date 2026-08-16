import assert from 'node:assert/strict';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import {
  publishModel,
  validateSpecificationAuthority
} from '../../packages/specification-registry/src/index.mjs';
import {
  audit,
  controlScope,
  makeEnv,
  modelSpec,
  publish
} from './fixture.mjs';

const env = makeEnv();
const original = publish(env, 'Model', 'model-retry-governance', '1', modelSpec());
const originalAudit = env.ledger.auditFor(original.ref).filter((event) =>
  sameAuthorityRef(event.objectRef, original.ref) && event.action === 'PUBLISH_SPECIFICATION');
assert.equal(originalAudit.length, 1);

const secondManager = createPrincipal({
  principalId: 'spec-manager-2',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const secondAssignment = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.specification.second-manager',
  version: '1',
  principal: secondManager,
  role: 'SPECIFICATION_MANAGER',
  roleDefinitionVersion: 's01-v1',
  permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
  scope: controlScope(),
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
});
const decision = authorizeSpecificationManage({
  principal: secondManager,
  roleAssignments: [secondAssignment],
  authorizationScope: {
    ...controlScope(),
    resourceType: 'MODEL',
    resourceId: original.ref.logicalId
  }
});
assert.equal(decision.allowed, true);
const secondAuthorization = recordAuthorizationDecision({
  ledger: env.ledger,
  decision,
  audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth')
});
const retry = publishModel({
  ledger: env.ledger,
  logicalId: original.ref.logicalId,
  version: original.ref.version,
  specification: modelSpec(),
  principal: secondManager,
  authorizationDecisionAuditRef: secondAuthorization.ref,
  audit: audit({ type: secondManager.type, id: secondManager.principalId }, 'publish-retry')
});
assert.deepEqual(retry.ref, original.ref);

const after = env.ledger.auditFor(original.ref).filter((event) =>
  sameAuthorityRef(event.objectRef, original.ref) && event.action === 'PUBLISH_SPECIFICATION');
assert.equal(after.length, 1);
assert.equal(after[0].actor.id, 'spec-manager');

const validated = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: original.ref });
assert.equal(validated.managementAuthorization.semanticPayload.principal.principalId, 'spec-manager');
console.log('PASS exact semantic retry by another authorized manager cannot rebind original specification governance');
console.log('S01 specification retry-governance acceptance: 1 passed');
