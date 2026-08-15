import { strict as assert } from 'node:assert';
import {
  PERMISSIONS,
  createPrincipal,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  authorizeKnowledgeRelease,
  authorizeKnowledgeReleaseEntitlementControl
} from '../../packages/knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeReleaseError,
  KnowledgeReleaseService,
  releaseMemberResourceId,
  validateKnowledgeReleaseAuthority
} from '../../packages/knowledge-release/src/index.mjs';
import { audit, createEnvironment, makeQualifiedKnowledge } from '../derived-knowledge/fixture.mjs';

const TARGET = { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' };

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function role(env, { principalId, organizationId, tenantId, scope }) {
  const principal = createPrincipal({ principalId, type: 'USER', organizationId, tenantId });
  const assignment = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.${principalId}`,
    version: '1',
    principal,
    role: 'KNOWLEDGE_RELEASE_MANAGER',
    roleDefinitionVersion: 'k06-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
    scope,
    audit: audit(`evt-role-${principalId}`, 'iam-admin')
  });
  return { principal, assignment };
}

function publicationEntitlement(env, publisher, knowledge) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: 'policy.owner-entitlement.external-member',
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: publisher.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [TARGET],
    audit: audit('evt-policy-owner-entitlement', 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({
    principal: publisher.principal,
    policy,
    roleAssignments: [publisher.assignment],
    releaseTarget: TARGET
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit('evt-auth-owner-entitlement', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { policy, authAudit };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('cross-owner member owner can revoke future release entitlement without destroying historical replay', () => {
  const env = createEnvironment();
  const publisher = role(env, {
    principalId: 'publisher-org-a',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    scope: TARGET
  });
  const external = makeQualifiedKnowledge(env, {
    label: 'owner-revocable-external',
    assertion: 'Externally owned proprietary agronomy.',
    ownership: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const entitlement = publicationEntitlement(env, publisher, external.knowledge);
  const service = new KnowledgeReleaseService({ ledger: env.ledger });
  const published = service.publishRelease({
    logicalId: 'release.owner-revocable',
    version: '1',
    memberEntitlements: [{
      knowledgeRef: external.knowledge.ref,
      policyRef: entitlement.policy.ref,
      authorizationDecisionAuditRef: entitlement.authAudit.ref
    }],
    publisherPrincipal: publisher.principal,
    releaseTarget: TARGET,
    audit: audit('evt-release-owner-revocable', publisher.principal.principalId)
  });
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref });

  const owner = role(env, {
    principalId: 'owner-controller-org-b',
    organizationId: 'org-b',
    tenantId: 'tenant-b',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const controlDecision = authorizeKnowledgeReleaseEntitlementControl({
    principal: owner.principal,
    policy: entitlement.policy,
    roleAssignments: [owner.assignment]
  });
  assert.equal(controlDecision.allowed, true);
  const controlAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: controlDecision,
    audit: audit('evt-owner-control-auth', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  service.revokeMemberEntitlement({
    logicalId: 'release-member-entitlement-revocation.owner-b',
    version: '1',
    knowledgeReleaseRef: published.release.ref,
    knowledgeRef: external.knowledge.ref,
    ownerPrincipal: owner.principal,
    controlAuthorizationDecisionAuditRef: controlAudit.ref,
    reasonCodes: ['LICENSE_WITHDRAWN_FOR_FUTURE_USE'],
    audit: audit('evt-owner-entitlement-revoke', owner.principal.principalId)
  });

  expectError(
    () => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }),
    KnowledgeReleaseError,
    'RELEASE_MEMBER_ENTITLEMENT_REVOKED'
  );
  const historical = validateKnowledgeReleaseAuthority({
    ledger: env.ledger,
    knowledgeReleaseRef: published.release.ref,
    allowHistorical: true
  });
  assert.equal(historical.release.ref.semanticHash, published.release.ref.semanticHash);
});

test('release publisher cannot revoke an external owner entitlement merely because it controls the target program', () => {
  const env = createEnvironment();
  const publisher = role(env, {
    principalId: 'publisher-no-owner-control',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    scope: TARGET
  });
  const external = makeQualifiedKnowledge(env, {
    label: 'publisher-no-owner-control-external',
    assertion: 'Externally owned knowledge.',
    ownership: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const entitlement = publicationEntitlement(env, publisher, external.knowledge);
  const service = new KnowledgeReleaseService({ ledger: env.ledger });
  const published = service.publishRelease({
    logicalId: 'release.publisher-no-owner-control', version: '1',
    memberEntitlements: [{ knowledgeRef: external.knowledge.ref, policyRef: entitlement.policy.ref, authorizationDecisionAuditRef: entitlement.authAudit.ref }],
    publisherPrincipal: publisher.principal, releaseTarget: TARGET,
    audit: audit('evt-release-publisher-no-owner-control', publisher.principal.principalId)
  });

  const denied = authorizeKnowledgeReleaseEntitlementControl({
    principal: publisher.principal,
    policy: entitlement.policy,
    roleAssignments: [publisher.assignment]
  });
  assert.equal(denied.allowed, false);
  const deniedAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: denied,
    audit: audit('evt-denied-owner-control-auth', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  expectError(() => service.revokeMemberEntitlement({
    logicalId: 'release-member-entitlement-revocation.denied', version: '1',
    knowledgeReleaseRef: published.release.ref,
    knowledgeRef: external.knowledge.ref,
    ownerPrincipal: publisher.principal,
    controlAuthorizationDecisionAuditRef: deniedAudit.ref,
    reasonCodes: ['INVALID_ATTEMPT'],
    audit: audit('evt-denied-owner-entitlement-revoke', publisher.principal.principalId)
  }), KnowledgeReleaseError, 'RELEASE_ENTITLEMENT_CONTROL_AUTHORIZATION_DENIED');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
