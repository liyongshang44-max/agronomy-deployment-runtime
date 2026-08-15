import { strict as assert } from 'node:assert';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { makeAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeConflictService,
  conflictAssessmentResourceId
} from '../../packages/conflict-engine/src/index.mjs';
import {
  KnowledgeReleaseError,
  KnowledgeReleaseService,
  releaseControlResourceId,
  releaseMemberResourceId,
  validateKnowledgeReleaseAuthority
} from '../../packages/knowledge-release/src/index.mjs';
import {
  USE_APPLICABILITY,
  audit,
  authorizeForResource,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

const TARGET = { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' };

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function manager(env, principalId = 'release-integrity-manager') {
  const principal = createPrincipal({
    principalId,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.${principalId}`,
    version: '1',
    principal,
    role: 'KNOWLEDGE_RELEASE_MANAGER',
    roleDefinitionVersion: 'k06-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
    scope: TARGET,
    audit: audit(`evt-role-${principalId}`, 'iam-admin')
  });
  return { principal, role };
}

function memberAuthorization(env, releaseManager, knowledge, label, target = TARGET) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.integrity.release-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: releaseManager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [target],
    audit: audit(`evt-policy-release-member-${label}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({
    principal: releaseManager.principal,
    policy,
    roleAssignments: [releaseManager.role],
    releaseTarget: target
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-release-member-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { knowledgeRef: knowledge.ref, policyRef: policy.ref, authorizationDecisionAuditRef: authAudit.ref, policy, authAudit };
}

function publishOne(env, releaseManager, knowledge, label) {
  const entitlement = memberAuthorization(env, releaseManager, knowledge, label);
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.integrity.${label}`,
    version: '1',
    memberEntitlements: [entitlement],
    publisherPrincipal: releaseManager.principal,
    releaseTarget: TARGET,
    audit: audit(`evt-release-${label}`, releaseManager.principal.principalId)
  });
}

function releaseControl(env, releaseManager, release, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.integrity.release-control.${label}`,
    version: '1',
    resourceId: releaseControlResourceId(release.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: releaseManager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [TARGET],
    audit: audit(`evt-policy-release-control-${label}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({
    principal: releaseManager.principal,
    policy,
    roleAssignments: [releaseManager.role],
    releaseTarget: TARGET
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-release-control-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { policy, authAudit };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('generic-ledger forged lifecycle decision cannot poison release status', () => {
  const env = createEnvironment();
  const releaseManager = manager(env);
  const knowledge = makeQualifiedKnowledge(env, { label: 'forged-lifecycle', assertion: 'A.' });
  const published = publishOne(env, releaseManager, knowledge.knowledge, 'forged-lifecycle');
  const control = releaseControl(env, releaseManager, published.release, 'forged-lifecycle');

  env.ledger.publish({
    kind: 'KnowledgeReleaseLifecycleDecision',
    logicalId: 'release-lifecycle.integrity.forged',
    version: '1',
    semanticPayload: {
      knowledgeReleaseRef: published.release.ref,
      status: 'REVOKED',
      reasonCodes: ['FORGED'],
      managerPrincipal: releaseManager.principal,
      releaseTarget: TARGET,
      authorizationDecisionAuditRef: control.authAudit.ref,
      policyRef: control.policy.ref,
      authorityClass: 'KNOWLEDGE_RELEASE_LIFECYCLE_AUTHORITY'
    },
    audit: {
      ...audit('evt-forged-lifecycle', 'forger'),
      inputRefs: [published.release.ref, control.authAudit.ref, control.policy.ref]
    }
  });

  expectError(
    () => new KnowledgeReleaseService({ ledger: env.ledger }).status({ knowledgeReleaseRef: published.release.ref }),
    KnowledgeReleaseError,
    'RELEASE_LIFECYCLE_AUDIT_INVALID'
  );
});

test('generic supersedes lineage cannot poison old release status without valid successor publication authority', () => {
  const env = createEnvironment();
  const releaseManager = manager(env);
  const knowledge = makeQualifiedKnowledge(env, { label: 'forged-successor', assertion: 'A.' });
  const published = publishOne(env, releaseManager, knowledge.knowledge, 'forged-successor');

  const forgedSuccessor = env.ledger.publish({
    kind: 'KnowledgeRelease',
    logicalId: 'release.integrity.forged-successor-object',
    version: '1',
    semanticPayload: { memberRefs: [knowledge.knowledge.ref] },
    audit: audit('evt-forged-successor-object', 'forger')
  });
  env.ledger.addLineage({
    relation: 'supersedes',
    from: forgedSuccessor.ref,
    to: published.release.ref,
    details: { authorityTransition: 'FORGED' },
    audit: audit('evt-forged-successor-lineage', 'forger')
  });

  expectError(
    () => new KnowledgeReleaseService({ ledger: env.ledger }).status({ knowledgeReleaseRef: published.release.ref }),
    KnowledgeReleaseError,
    'RELEASE_PUBLICATION_AUTHORITY_REQUIRED'
  );
});

test('publication authority must be directly audited by the exact publisher over exact entitlement inputs', () => {
  const env = createEnvironment();
  const releaseManager = manager(env);
  const knowledge = makeQualifiedKnowledge(env, { label: 'forged-publication', assertion: 'A.' });
  const entitlement = memberAuthorization(env, releaseManager, knowledge.knowledge, 'forged-publication');
  const releasePayload = { memberRefs: [knowledge.knowledge.ref] };
  const releaseRef = makeAuthorityRef({
    kind: 'KnowledgeRelease',
    logicalId: 'release.integrity.forged-publication',
    version: '1',
    semanticHash: semanticHash('KnowledgeRelease', releasePayload)
  });
  const publicationPayload = {
    releaseRef,
    publisherPrincipal: releaseManager.principal,
    releaseTarget: TARGET,
    memberEntitlements: [{
      knowledgeRef: knowledge.knowledge.ref,
      authorizationDecisionAuditRef: entitlement.authAudit.ref,
      policyRef: entitlement.policy.ref
    }],
    detectedConflictRefs: [],
    activeConflictResolutionRefs: [],
    authorityClass: 'KNOWLEDGE_RELEASE_PUBLICATION_AUTHORITY'
  };
  const publicationRef = makeAuthorityRef({
    kind: 'KnowledgeReleasePublicationDecision',
    logicalId: 'release.integrity.forged-publication.publication',
    version: '1',
    semanticHash: semanticHash('KnowledgeReleasePublicationDecision', publicationPayload)
  });

  env.ledger.publish({
    kind: 'KnowledgeReleasePublicationDecision',
    logicalId: publicationRef.logicalId,
    version: publicationRef.version,
    semanticPayload: publicationPayload,
    audit: {
      ...audit('evt-forged-publication-decision', 'forger'),
      inputRefs: [knowledge.knowledge.ref, entitlement.authAudit.ref, entitlement.policy.ref]
    }
  });
  const release = env.ledger.publish({
    kind: 'KnowledgeRelease',
    logicalId: releaseRef.logicalId,
    version: releaseRef.version,
    semanticPayload: releasePayload,
    audit: {
      ...audit('evt-forged-publication-release', releaseManager.principal.principalId),
      inputRefs: [publicationRef, knowledge.knowledge.ref]
    }
  });

  expectError(
    () => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: release.ref }),
    KnowledgeReleaseError,
    'RELEASE_PUBLICATION_AUDIT_INVALID'
  );
});

test('historical release replay with a frozen conflict survives later member revocation', () => {
  const env = createEnvironment();
  const releaseManager = manager(env);
  const a = makeQualifiedKnowledge(env, { label: 'historical-conflict-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'historical-conflict-b', assertion: 'Threshold B.' });
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const conflictApproval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: 'historical-conflict-assessment'
  });
  new KnowledgeConflictService({ ledger: env.ledger }).createConflict({
    logicalId: 'conflict.integrity.historical',
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING' },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: conflictApproval.authAudit.ref,
    audit: audit('evt-historical-conflict', env.approver.principalId)
  });
  const entitlements = [
    memberAuthorization(env, releaseManager, a.knowledge, 'historical-conflict-a'),
    memberAuthorization(env, releaseManager, b.knowledge, 'historical-conflict-b')
  ];
  const published = new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: 'release.integrity.historical-conflict',
    version: '1',
    memberEntitlements: entitlements,
    publisherPrincipal: releaseManager.principal,
    releaseTarget: TARGET,
    audit: audit('evt-release-historical-conflict', releaseManager.principal.principalId)
  });

  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'historical-conflict-revoke'
  });
  a.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.integrity.historical-conflict',
    revocationVersion: '1',
    qualifiedKnowledgeRef: a.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_REVOCATION'],
    audit: audit('evt-historical-conflict-revoke', env.approver.principalId)
  });

  const historical = validateKnowledgeReleaseAuthority({
    ledger: env.ledger,
    knowledgeReleaseRef: published.release.ref,
    allowHistorical: true
  });
  assert.equal(historical.release.ref.semanticHash, published.release.ref.semanticHash);
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
