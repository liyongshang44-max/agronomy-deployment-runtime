import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment
} from '../../packages/authorization/src/index.mjs';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import {
  publishRuntimeProfile,
  validateRuntimeProfileAuthority
} from '../../packages/runtime-profile/src/index.mjs';
import {
  USE_APPLICABILITY,
  authorizeForResource
} from '../derived-knowledge/fixture.mjs';
import {
  audit,
  baseProfile,
  createProfileAuthorization,
  createRuntimeProfileEnvironment
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('later KnowledgeRelease member revocation blocks current RuntimeProfile use but preserves historical replay', () => {
  const env = createRuntimeProfileEnvironment('release-lifecycle');
  const logicalId = 'rp-release-lifecycle';
  const auth = createProfileAuthorization(env, logicalId);
  const profile = publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile: baseProfile(env),
    principal: env.profileManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(env.profileManager.principalId)
  });

  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(
      env.qualified.reviewed.claim.ref,
      env.qualified.reviewed.sourceContext.ref
    ),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'a05-release-lifecycle-revoke'
  });
  env.qualified.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a05.release-lifecycle',
    revocationVersion: '1',
    qualifiedKnowledgeRef: env.qualified.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_REVOCATION'],
    audit: audit(env.approver.principalId)
  });

  assert.throws(() => validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: profile.ref
  }));
  const historical = validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: profile.ref,
    allowHistorical: true
  });
  assert.equal(historical.record.ref.semanticHash, profile.ref.semanticHash);
  assert.equal(
    historical.knowledgeReleaseAuthority.release.ref.semanticHash,
    env.release.ref.semanticHash
  );
});

test('exact semantic retry by another authorized manager does not rebind original publication governance', () => {
  const env = createRuntimeProfileEnvironment('retry-governance');
  const logicalId = 'rp-retry-governance';
  const firstAuth = createProfileAuthorization(env, logicalId);
  const first = publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile: baseProfile(env),
    principal: env.profileManager,
    authorizationDecisionAuditRef: firstAuth.recorded.ref,
    audit: audit(env.profileManager.principalId)
  });

  const secondManager = createPrincipal({
    principalId: 'profile-manager-retry-second',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const secondRole = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.profile-manager.retry-second',
    version: '1',
    principal: secondManager,
    role: 'RUNTIME_PROFILE_MANAGER',
    roleDefinitionVersion: 'a05-v1',
    permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'RUNTIME_PROFILE' },
    audit: audit('iam-admin')
  });
  const secondAuth = createProfileAuthorization(env, logicalId, {
    principal: secondManager,
    roleAssignments: [secondRole]
  });
  assert.equal(secondAuth.decision.allowed, true);

  const retried = publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile: baseProfile(env),
    principal: secondManager,
    authorizationDecisionAuditRef: secondAuth.recorded.ref,
    audit: audit(secondManager.principalId)
  });
  assert.equal(retried.ref.semanticHash, first.ref.semanticHash);

  const directPublicationAudits = env.ledger.auditFor(first.ref)
    .filter((event) => event.action === 'PUBLISH_RUNTIME_PROFILE');
  assert.equal(directPublicationAudits.length, 1);
  const validated = validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: first.ref
  });
  assert.equal(
    validated.managementAuthorization.ref.semanticHash,
    firstAuth.recorded.ref.semanticHash
  );
  assert.notEqual(
    validated.managementAuthorization.ref.semanticHash,
    secondAuth.recorded.ref.semanticHash
  );
});

console.log('RuntimeProfile lifecycle/retry acceptance: 2 passed');
