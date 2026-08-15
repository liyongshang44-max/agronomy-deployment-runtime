import { strict as assert } from 'node:assert';
import {
  PERMISSIONS,
  createPrincipal,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import {
  KnowledgeConflictService,
  conflictAssessmentResourceId
} from '../../packages/conflict-engine/src/index.mjs';
import {
  KnowledgeReleaseError,
  KnowledgeReleaseService,
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

function setupReleaseManager(env) {
  const principal = createPrincipal({
    principalId: 'conflict-coverage-release-manager',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.conflict-coverage-release-manager',
    version: '1',
    principal,
    role: 'KNOWLEDGE_RELEASE_MANAGER',
    roleDefinitionVersion: 'k06-v1',
    permissions: [PERMISSIONS.KNOWLEDGE_RELEASE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-role-conflict-coverage-release-manager', 'iam-admin')
  });
  return { principal, role };
}

function entitlement(env, manager, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.conflict-coverage.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: manager.principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [TARGET],
    audit: audit(`evt-policy-conflict-coverage-${label}`, 'iam-admin')
  });
  const decision = authorizeKnowledgeRelease({
    principal: manager.principal,
    policy,
    roleAssignments: [manager.role],
    releaseTarget: TARGET
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(`evt-auth-conflict-coverage-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { knowledgeRef: knowledge.ref, policyRef: policy.ref, authorizationDecisionAuditRef: authAudit.ref };
}

function createConflict(env, a, b, label) {
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: `conflict-coverage-${label}`
  });
  return new KnowledgeConflictService({ ledger: env.ledger }).createConflict({
    logicalId: `conflict.coverage.${label}`,
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING' },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-coverage-${label}`, env.approver.principalId)
  });
}

const env = createEnvironment();
const manager = setupReleaseManager(env);
const selected = makeQualifiedKnowledge(env, { label: 'coverage-selected', assertion: 'Use threshold 0.42.' });
const omitted = makeQualifiedKnowledge(env, { label: 'coverage-omitted', assertion: 'Use threshold 0.58.' });
const conflict = createConflict(env, selected, omitted, 'known-before-release');

const service = new KnowledgeReleaseService({ ledger: env.ledger });
const release = service.publishRelease({
  logicalId: 'release.conflict-coverage',
  version: '1',
  memberEntitlements: [entitlement(env, manager, selected.knowledge, 'selected-only')],
  publisherPrincipal: manager.principal,
  releaseTarget: TARGET,
  audit: audit('evt-release-conflict-coverage', manager.principal.principalId)
});

assert.equal(release.release.semanticPayload.memberRefs.length, 1);
assert.equal(release.release.semanticPayload.memberRefs[0].semanticHash, selected.knowledge.ref.semanticHash);
assert.ok(
  release.publicationDecision.semanticPayload.detectedConflictRefs.some((ref) => ref.semanticHash === conflict.ref.semanticHash),
  'known conflict touching a selected member must remain visible even when the competing member is omitted from the release'
);
validateKnowledgeReleaseAuthority({ ledger: env.ledger, knowledgeReleaseRef: release.release.ref });

const envLate = createEnvironment();
const managerLate = setupReleaseManager(envLate);
const selectedLate = makeQualifiedKnowledge(envLate, { label: 'coverage-late-selected', assertion: 'Use threshold 0.42.' });
const omittedLate = makeQualifiedKnowledge(envLate, { label: 'coverage-late-omitted', assertion: 'Use threshold 0.58.' });
const serviceLate = new KnowledgeReleaseService({ ledger: envLate.ledger });
const releaseLate = serviceLate.publishRelease({
  logicalId: 'release.conflict-coverage-late',
  version: '1',
  memberEntitlements: [entitlement(envLate, managerLate, selectedLate.knowledge, 'late-selected-only')],
  publisherPrincipal: managerLate.principal,
  releaseTarget: TARGET,
  audit: audit('evt-release-conflict-coverage-late', managerLate.principal.principalId)
});
createConflict(envLate, selectedLate, omittedLate, 'created-after-release');

let caught;
try {
  validateKnowledgeReleaseAuthority({ ledger: envLate.ledger, knowledgeReleaseRef: releaseLate.release.ref });
} catch (error) {
  caught = error;
}
assert.ok(caught instanceof KnowledgeReleaseError);
assert.equal(caught.code, 'RELEASE_CONFLICT_GOVERNANCE_STALE');
validateKnowledgeReleaseAuthority({
  ledger: envLate.ledger,
  knowledgeReleaseRef: releaseLate.release.ref,
  allowHistorical: true
});

console.log('PASS known conflicts cannot be hidden by omitting a competing member from KnowledgeRelease');
console.log('PASS later conflict touching one selected member stales current release but preserves historical replay');
console.log(JSON.stringify({ total: 2, passed: 2, failed: 0 }, null, 2));
