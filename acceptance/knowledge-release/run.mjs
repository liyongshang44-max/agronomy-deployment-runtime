import { strict as assert } from 'node:assert';
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
  DerivedKnowledgeService,
  derivationMethodResourceId,
  synthesisResourceId
} from '../../packages/synthesis-engine/src/index.mjs';
import {
  KnowledgeConflictService,
  conflictAssessmentResourceId,
  conflictResolutionResourceId
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

const RELEASE_TARGET = { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-a' };

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function makeReleaseManager(env, {
  principalId = 'release-manager',
  permissions = [PERMISSIONS.KNOWLEDGE_RELEASE],
  scope = RELEASE_TARGET,
  organizationId = 'org-a',
  tenantId = 'tenant-a'
} = {}) {
  const principal = createPrincipal({
    principalId,
    type: 'USER',
    organizationId,
    tenantId,
    programIds: ['pilot-a']
  });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.${principalId}`,
    version: '1',
    principal,
    role: 'KNOWLEDGE_RELEASE_MANAGER',
    roleDefinitionVersion: 'k06-v1',
    permissions,
    scope,
    audit: audit(`evt-role-${principalId}`, 'iam-admin')
  });
  return { principal, role };
}

function memberEntitlement(env, manager, knowledge, {
  label,
  target = RELEASE_TARGET,
  deploymentScope = [target]
}) {
  const ownership = knowledge.semanticPayload.ownership;
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.release-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership,
    visibilityPolicy: [{ principalId: manager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope,
    audit: audit(`evt-policy-release-member-${label}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({
    principal: manager.principal,
    policy,
    roleAssignments: [manager.role],
    releaseTarget: target
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-release-member-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { knowledgeRef: knowledge.ref, policyRef: policy.ref, authorizationDecisionAuditRef: authAudit.ref, decision };
}

function releaseControlEntitlement(env, manager, release, label, target = RELEASE_TARGET) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.release-control.${label}`,
    version: '1',
    resourceId: releaseControlResourceId(release.ref),
    ownership: {
      organizationId: manager.principal.organizationId,
      ...(manager.principal.tenantId ? { tenantId: manager.principal.tenantId } : {})
    },
    visibilityPolicy: [{ principalId: manager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [target],
    audit: audit(`evt-policy-release-control-${label}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({ principal: manager.principal, policy, roleAssignments: [manager.role], releaseTarget: target });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-release-control-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { policy, authAudit, decision };
}

function publishRelease(env, manager, members, label, options = {}) {
  const entitlements = members.map((knowledge, index) => memberEntitlement(env, manager, knowledge, { label: `${label}-${index}` }));
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.${label}`,
    version: options.version ?? '1',
    memberEntitlements: entitlements,
    publisherPrincipal: manager.principal,
    releaseTarget: options.releaseTarget ?? RELEASE_TARGET,
    ...(options.supersedesReleaseRef ? { supersedesReleaseRef: options.supersedesReleaseRef } : {}),
    ...(options.supersessionControl ? {
      supersessionAuthorizationDecisionAuditRef: options.supersessionControl.authAudit.ref,
      supersessionPolicyRef: options.supersessionControl.policy.ref
    } : {}),
    audit: audit(`evt-release-${label}`, manager.principal.principalId)
  });
}

function makeDerived(env, a, b, label = 'derived-release-member') {
  const methodLogicalId = `method.${label}`;
  const methodApproval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(methodLogicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: `${label}-method-approval`
  });
  const service = new DerivedKnowledgeService({ ledger: env.ledger });
  const method = service.publishDerivationMethod({
    logicalId: methodLogicalId,
    version: '1',
    methodType: 'GOVERNED_SYNTHESIS',
    semanticRole: 'corn.irrigation.depletion_threshold',
    minimumInputs: 2,
    contextPolicy: 'PRESERVE_ALL_ORIGINS',
    methodSpec: { estimator: 'GOVERNED_CONSENSUS' },
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: methodApproval.authAudit.ref,
    audit: audit(`evt-method-${label}`, env.approver.principalId)
  });
  const synthesisApproval = authorizeForResource(env, {
    resourceId: synthesisResourceId(method.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: `${label}-synthesis`
  });
  return service.derive({
    derivedKnowledgeLogicalId: `derived.${label}`,
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: `derived-context.${label}`,
    derivedContextVersion: '1',
    derivationMethodRef: method.ref,
    inputBindings: [
      { qualifiedKnowledgeRef: a.knowledge.ref, useTarget: USE_APPLICABILITY },
      { qualifiedKnowledgeRef: b.knowledge.ref, useTarget: USE_APPLICABILITY }
    ],
    semanticRole: 'corn.irrigation.depletion_threshold',
    assertion: 'Governed derived threshold knowledge.',
    derivedValue: { lower: '0.42', upper: '0.48' },
    unresolvedContextHeterogeneity: [{ dimension: 'soil.texture', status: 'UNRESOLVED_HETEROGENEITY' }],
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: synthesisApproval.authAudit.ref,
    audit: audit(`evt-derived-${label}`, env.approver.principalId)
  });
}

function createConflict(env, a, b, label) {
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: `${label}-conflict-assessment`
  });
  const service = new KnowledgeConflictService({ ledger: env.ledger });
  const conflict = service.createConflict({
    logicalId: `conflict.${label}`,
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING' },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-${label}`, env.approver.principalId)
  });
  return { service, conflict };
}

function resolveAlternatives(env, conflictBundle, label) {
  const approval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflictBundle.conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: `${label}-conflict-resolution`
  });
  return conflictBundle.service.resolveConflict({
    logicalId: `conflict-resolution.${label}`,
    version: '1',
    knowledgeConflictRef: conflictBundle.conflict.ref,
    resolutionType: 'PRESERVE_ALTERNATIVES',
    rationale: 'Preserve both exact scientific alternatives.',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-resolution-${label}`, env.approver.principalId)
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('KnowledgeRelease semantic identity is exactly a canonical frozen set of Qualified/Derived knowledge refs', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'release-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'release-b', assertion: 'Threshold B.' });
  const derived = makeDerived(env, a, b);
  const published = publishRelease(env, manager, [a.knowledge, derived.derivedKnowledge], 'exact-set');
  assert.deepEqual(Object.keys(published.release.semanticPayload), ['memberRefs']);
  assert.equal(published.release.semanticPayload.memberRefs.length, 2);
  assert.equal(published.publicationDecision.ref.kind, 'KnowledgeReleasePublicationDecision');
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref });
});

test('KnowledgeRelease rejects Model/Policy/Implementation and any non-knowledge member kind', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const fakeModel = env.ledger.publish({ kind: 'Model', logicalId: 'model.not-knowledge', version: '1', semanticPayload: { purpose: 'test' }, audit: audit('evt-model', 'model-admin') });
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: 'policy.model-release',
    version: '1',
    resourceId: releaseMemberResourceId(fakeModel.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: manager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: audit('evt-policy-model-release', 'iam-admin')
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeRelease({ principal: manager.principal, policy, roleAssignments: [manager.role], releaseTarget: RELEASE_TARGET }),
    audit: audit('evt-auth-model-release', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  expectError(() => new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: 'release.invalid-model', version: '1',
    memberEntitlements: [{ knowledgeRef: fakeModel.ref, policyRef: policy.ref, authorizationDecisionAuditRef: auth.ref }],
    publisherPrincipal: manager.principal, releaseTarget: RELEASE_TARGET,
    audit: audit('evt-release-invalid-model', manager.principal.principalId)
  }), KnowledgeReleaseError, 'INVALID_RELEASE_MEMBER_KIND');
});

test('release inclusion requires exact KNOWLEDGE_RELEASE permission and explicit member deployment entitlement', () => {
  const env = createEnvironment();
  const deniedManager = makeReleaseManager(env, { principalId: 'no-release-manager', permissions: [PERMISSIONS.KNOWLEDGE_DEPLOY] });
  const a = makeQualifiedKnowledge(env, { label: 'entitlement-a', assertion: 'A.' });
  const entitlement = memberEntitlement(env, deniedManager, a.knowledge, { label: 'denied' });
  assert.equal(entitlement.decision.allowed, false);
  expectError(() => new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: 'release.denied', version: '1', memberEntitlements: [entitlement],
    publisherPrincipal: deniedManager.principal, releaseTarget: RELEASE_TARGET,
    audit: audit('evt-release-denied', deniedManager.principal.principalId)
  }), KnowledgeReleaseError, 'RELEASE_AUTHORIZATION_DENIED');
});

test('cross-owner knowledge can enter one release only through explicit owner policy entitlement; ownership is not transferred', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const own = makeQualifiedKnowledge(env, { label: 'cross-own', assertion: 'Own knowledge.' });
  const external = makeQualifiedKnowledge(env, {
    label: 'cross-external',
    assertion: 'External licensed knowledge.',
    ownership: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const published = publishRelease(env, manager, [own.knowledge, external.knowledge], 'cross-owner-entitled');
  const validated = validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref });
  const externalMember = validated.members.find((member) => member.record.ref.semanticHash === external.knowledge.ref.semanticHash);
  assert.deepEqual(externalMember.ownership, { organizationId: 'org-b', tenantId: 'tenant-b' });
});

test('revoked QualifiedKnowledge cannot be newly frozen into a KnowledgeRelease', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'revoked-release-a', assertion: 'A.' });
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'revoked-release-member'
  });
  a.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.release-member', revocationVersion: '1',
    qualifiedKnowledgeRef: a.knowledge.ref, qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver, authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['NO_LONGER_ACTIVE'], audit: audit('evt-revoke-release-member', env.approver.principalId)
  });
  const entitlement = memberEntitlement(env, manager, a.knowledge, { label: 'revoked' });
  expectError(() => new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: 'release.revoked-member', version: '1', memberEntitlements: [entitlement],
    publisherPrincipal: manager.principal, releaseTarget: RELEASE_TARGET,
    audit: audit('evt-release-revoked-member', manager.principal.principalId)
  }), KnowledgeReleaseError, 'RELEASE_MEMBER_HAS_NO_ACTIVE_USE');
});

test('known unresolved KnowledgeConflict is frozen in publication governance without being silently resolved', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'conflict-release-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'conflict-release-b', assertion: 'Threshold B.' });
  const conflict = createConflict(env, a, b, 'known-release-conflict');
  const published = publishRelease(env, manager, [a.knowledge, b.knowledge], 'known-conflict');
  assert.ok(published.publicationDecision.semanticPayload.detectedConflictRefs.some((ref) => ref.semanticHash === conflict.conflict.ref.semanticHash));
  assert.equal(published.publicationDecision.semanticPayload.activeConflictResolutionRefs.length, 0);
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref });
});

test('new relevant conflict discovered after publication makes release stale for new use but preserves historical replay', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'late-conflict-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'late-conflict-b', assertion: 'Threshold B.' });
  const published = publishRelease(env, manager, [a.knowledge, b.knowledge], 'late-conflict');
  createConflict(env, a, b, 'late-conflict');
  expectError(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }), KnowledgeReleaseError, 'RELEASE_CONFLICT_GOVERNANCE_STALE');
  const historical = validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref, allowHistorical: true });
  assert.equal(historical.release.ref.semanticHash, published.release.ref.semanticHash);
});

test('active conflict-resolution drift after publication also makes release stale for new use', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'resolution-drift-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'resolution-drift-b', assertion: 'Threshold B.' });
  const conflict = createConflict(env, a, b, 'resolution-drift');
  const published = publishRelease(env, manager, [a.knowledge, b.knowledge], 'resolution-drift');
  resolveAlternatives(env, conflict, 'resolution-drift');
  expectError(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }), KnowledgeReleaseError, 'RELEASE_CONFLICT_GOVERNANCE_STALE');
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref, allowHistorical: true });
});

test('new KnowledgeRelease supersedes old release only with exact predecessor control authorization', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'supersede-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'supersede-b', assertion: 'B.' });
  const first = publishRelease(env, manager, [a.knowledge], 'supersede-v1');
  expectError(() => publishRelease(env, manager, [a.knowledge, b.knowledge], 'supersede-v2-no-auth', { supersedesReleaseRef: first.release.ref }), KnowledgeReleaseError, 'RELEASE_SUPERSESSION_AUTHORIZATION_REQUIRED');
  const control = releaseControlEntitlement(env, manager, first.release, 'supersede-v1');
  const second = publishRelease(env, manager, [a.knowledge, b.knowledge], 'supersede-v2', {
    supersedesReleaseRef: first.release.ref,
    supersessionControl: control
  });
  assert.equal(first.release.semanticPayload.memberRefs.length, 1);
  assert.equal(second.release.semanticPayload.memberRefs.length, 2);
  expectError(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: first.release.ref }), KnowledgeReleaseError, 'KNOWLEDGE_RELEASE_SUPERSEDED');
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: first.release.ref, allowHistorical: true });
});

test('another organization cannot seize release lifecycle control or supersede the release', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const attacker = makeReleaseManager(env, {
    principalId: 'release-attacker',
    organizationId: 'org-b',
    tenantId: 'tenant-b',
    scope: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'pilot-a' }
  });
  const a = makeQualifiedKnowledge(env, { label: 'controller-a', assertion: 'A.' });
  const first = publishRelease(env, manager, [a.knowledge], 'controller');
  const maliciousPolicy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: 'policy.release-control.attacker',
    version: '1',
    resourceId: releaseControlResourceId(first.release.ref),
    ownership: { organizationId: 'org-b', tenantId: 'tenant-b' },
    visibilityPolicy: [{ principalId: attacker.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-b', tenantId: 'tenant-b', programId: 'pilot-a' }],
    audit: audit('evt-policy-release-control-attacker', 'iam-admin')
  });
  const maliciousAuth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeRelease({
      principal: attacker.principal,
      policy: maliciousPolicy,
      roleAssignments: [attacker.role],
      releaseTarget: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'pilot-a' }
    }),
    audit: audit('evt-auth-release-control-attacker', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  expectError(() => new KnowledgeReleaseService({ ledger: env.ledger }).recordLifecycleDecision({
    logicalId: 'release-lifecycle.attacker', version: '1', knowledgeReleaseRef: first.release.ref,
    status: 'REVOKED', reasonCodes: ['ATTACK'], managerPrincipal: attacker.principal,
    releaseTarget: { organizationId: 'org-b', tenantId: 'tenant-b', programId: 'pilot-a' },
    authorizationDecisionAuditRef: maliciousAuth.ref, policyRef: maliciousPolicy.ref,
    audit: audit('evt-release-lifecycle-attacker', attacker.principal.principalId)
  }), KnowledgeReleaseError, 'RELEASE_CONTROLLER_SCOPE_MISMATCH');
});

test('release lifecycle revocation blocks new use without deleting historical release authority', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'lifecycle-a', assertion: 'A.' });
  const published = publishRelease(env, manager, [a.knowledge], 'lifecycle');
  const control = releaseControlEntitlement(env, manager, published.release, 'lifecycle');
  const service = new KnowledgeReleaseService({ ledger: env.ledger });
  const decision = service.recordLifecycleDecision({
    logicalId: 'release-lifecycle.lifecycle-revoke', version: '1',
    knowledgeReleaseRef: published.release.ref, status: 'REVOKED', reasonCodes: ['SCIENTIFIC_GOVERNANCE_REVIEW'],
    managerPrincipal: manager.principal, releaseTarget: RELEASE_TARGET,
    authorizationDecisionAuditRef: control.authAudit.ref, policyRef: control.policy.ref,
    audit: audit('evt-release-lifecycle-revoke', manager.principal.principalId)
  });
  assert.equal(decision.semanticPayload.status, 'REVOKED');
  expectError(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }), KnowledgeReleaseError, 'KNOWLEDGE_RELEASE_REVOKED');
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref, allowHistorical: true });
  assert.equal(env.ledger.resolve(published.release.ref).ref.semanticHash, published.release.ref.semanticHash);
});

test('historical replay survives later QualifiedKnowledge revocation', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'historical-qk-a', assertion: 'A.' });
  const published = publishRelease(env, manager, [a.knowledge], 'historical-qk');
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'historical-qk-revoke'
  });
  a.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.historical-qk', revocationVersion: '1',
    qualifiedKnowledgeRef: a.knowledge.ref, qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver, authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_REVOCATION'], audit: audit('evt-historical-qk-revoke', env.approver.principalId)
  });
  assert.throws(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }));
  const historical = validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref, allowHistorical: true });
  assert.equal(historical.release.ref.semanticHash, published.release.ref.semanticHash);
});

test('historical replay of DerivedKnowledge survives later revocation of one exact input QualifiedKnowledge', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'historical-dk-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'historical-dk-b', assertion: 'B.' });
  const derived = makeDerived(env, a, b, 'historical-dk');
  const published = publishRelease(env, manager, [derived.derivedKnowledge], 'historical-dk');
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'historical-dk-input-revoke'
  });
  a.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.historical-dk-input', revocationVersion: '1',
    qualifiedKnowledgeRef: a.knowledge.ref, qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver, authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_INPUT_REVOCATION'], audit: audit('evt-historical-dk-input-revoke', env.approver.principalId)
  });
  assert.throws(() => validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref }));
  validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref, allowHistorical: true });
});

test('same exact release identity cannot be rebound to different publication target/governance', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'retry-a', assertion: 'A.' });
  const service = new KnowledgeReleaseService({ ledger: env.ledger });
  const entitlement = memberEntitlement(env, manager, a.knowledge, { label: 'retry-first' });
  const first = service.publishRelease({
    logicalId: 'release.retry', version: '1', memberEntitlements: [entitlement],
    publisherPrincipal: manager.principal, releaseTarget: RELEASE_TARGET,
    audit: audit('evt-release-retry-first', manager.principal.principalId)
  });
  const otherTarget = { organizationId: 'org-a', tenantId: 'tenant-a', programId: 'pilot-b' };
  const otherPolicy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: 'policy.release-member.retry-second', version: '1',
    resourceId: releaseMemberResourceId(a.knowledge.ref),
    ownership: a.knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: manager.principal.principalId }],
    qualificationScope: [{ use: '*' }], deploymentScope: [otherTarget],
    audit: audit('evt-policy-release-member-retry-second', 'iam-admin')
  });
  const otherAuth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeRelease({ principal: manager.principal, policy: otherPolicy, roleAssignments: [manager.role], releaseTarget: otherTarget }),
    audit: audit('evt-auth-release-member-retry-second', 'iam-engine', 'SERVICE_ACCOUNT')
  });
  expectError(() => service.publishRelease({
    logicalId: 'release.retry', version: '1',
    memberEntitlements: [{ knowledgeRef: a.knowledge.ref, policyRef: otherPolicy.ref, authorizationDecisionAuditRef: otherAuth.ref }],
    publisherPrincipal: manager.principal, releaseTarget: otherTarget,
    audit: audit('evt-release-retry-second', manager.principal.principalId)
  }), KnowledgeReleaseError, 'RELEASE_PUBLICATION_RETRY_MISMATCH');
  assert.equal(env.ledger.resolve(first.release.ref).ref.semanticHash, first.release.ref.semanticHash);
});

test('exact release set does not follow a later knowledge object by latest-version convention', () => {
  const env = createEnvironment();
  const manager = makeReleaseManager(env);
  const a = makeQualifiedKnowledge(env, { label: 'pin-a', assertion: 'Pinned knowledge.' });
  const published = publishRelease(env, manager, [a.knowledge], 'pin');
  makeQualifiedKnowledge(env, { label: 'pin-new-unrelated', assertion: 'Newer registry knowledge must not drift release.' });
  const validated = validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: published.release.ref });
  assert.equal(validated.release.semanticPayload.memberRefs.length, 1);
  assert.equal(validated.release.semanticPayload.memberRefs[0].semanticHash, a.knowledge.ref.semanticHash);
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
