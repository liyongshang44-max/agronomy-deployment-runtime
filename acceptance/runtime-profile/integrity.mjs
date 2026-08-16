import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { PERMISSIONS, createPrincipal, publishRoleAssignment } from '../../packages/authorization/src/index.mjs';
import {
  RuntimeProfileError,
  normalizeRuntimeProfile,
  publishRuntimeProfile,
  validateRuntimeProfileAuthority
} from '../../packages/runtime-profile/src/index.mjs';
import {
  audit,
  baseProfile,
  createProfileAuthorization,
  createRuntimeProfileEnvironment,
  publishAuthorizedProfile
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof RuntimeProfileError && error.code === code);
}

test('unsupported replay minimum fails closed', () => {
  const env = createRuntimeProfileEnvironment('bad-replay');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    replayRequirement: { minimum: 'BEST_EFFORT' }
  })), 'INVALID_RUNTIME_PROFILE_REPLAY_REQUIREMENT');
});

test('PILOT cannot be used as a technical runtime environment', () => {
  const env = createRuntimeProfileEnvironment('pilot-env');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['PILOT'],
      rolloutStages: ['PILOT']
    }
  })), 'INVALID_RUNTIME_PROFILE_ENUM');
});

test('STAGING cannot be used as a rollout stage', () => {
  const env = createRuntimeProfileEnvironment('staging-stage');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['STAGING'],
      rolloutStages: ['STAGING']
    }
  })), 'INVALID_RUNTIME_PROFILE_ENUM');
});

test('unknown epistemic class in context requirements fails closed', () => {
  const env = createRuntimeProfileEnvironment('bad-epistemic');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    contextRequirements: {
      requiredSemanticIds: ['crop.code'],
      epistemicConstraints: { 'crop.code': ['TRUSTED_SOURCE'] }
    }
  })), 'INVALID_RUNTIME_PROFILE_ENUM');
});

test('duplicate required context semantics are rejected rather than silently deduplicated', () => {
  const env = createRuntimeProfileEnvironment('duplicate-context');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    contextRequirements: {
      requiredSemanticIds: ['crop.code', 'crop.code'],
      epistemicConstraints: {}
    }
  })), 'DUPLICATE_RUNTIME_PROFILE_CONSTRAINT');
});

test('applicability cannot be bypassed by RuntimeProfile governance', () => {
  const env = createRuntimeProfileEnvironment('applicability-bypass');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    runtimeGovernance: {
      allowedDecisionAuthorityModes: ['RUNTIME_ONLY'],
      knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
      contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
      applicabilityMode: 'SKIP_IF_RELEASED'
    }
  })), 'RUNTIME_PROFILE_APPLICABILITY_BYPASS_FORBIDDEN');
});

test('wrong logical-id management authorization cannot publish a RuntimeProfile', () => {
  const env = createRuntimeProfileEnvironment('wrong-id-auth');
  const auth = createProfileAuthorization(env, 'rp-authorized-other');
  expectCode(() => publishRuntimeProfile({
    ledger: env.ledger,
    logicalId: 'rp-target',
    version: '1',
    profile: baseProfile(env),
    principal: env.profileManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(env.profileManager.principalId)
  }), 'RUNTIME_PROFILE_AUTHORIZATION_MISMATCH');
});

test('foreign organization control scope cannot consume another tenant KnowledgeRelease', () => {
  const env = createRuntimeProfileEnvironment('foreign-scope');
  const foreign = createPrincipal({
    principalId: 'foreign-profile-manager',
    type: 'USER',
    organizationId: 'org-b',
    tenantId: 'tenant-b'
  });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.foreign-profile-manager',
    version: '1',
    principal: foreign,
    role: 'RUNTIME_PROFILE_MANAGER',
    roleDefinitionVersion: 'a05-v1',
    permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
    scope: { organizationId: 'org-b', tenantId: 'tenant-b', resourceType: 'RUNTIME_PROFILE' },
    audit: audit('iam-admin')
  });
  const auth = createProfileAuthorization(env, 'rp-foreign', { principal: foreign, roleAssignments: [role] });
  assert.equal(auth.decision.allowed, true);
  expectCode(() => publishRuntimeProfile({
    ledger: env.ledger,
    logicalId: 'rp-foreign',
    version: '1',
    profile: baseProfile(env, {
      controlScope: { organizationId: 'org-b', tenantId: 'tenant-b' }
    }),
    principal: foreign,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(foreign.principalId)
  }), 'RUNTIME_PROFILE_RELEASE_SCOPE_MISMATCH');
});

test('forged AuthorizationDecisionAudit without exact RoleAssignment authority cannot mint RuntimeProfile', () => {
  const env = createRuntimeProfileEnvironment('forged-auth');
  const logicalId = 'rp-forged-auth';
  const basis = {
    operation: 'RUNTIME_PROFILE_MANAGE',
    principal: env.profileManager,
    assignmentRefs: [],
    request: {
      authorizationScope: {
        organizationId: 'org-a',
        tenantId: 'tenant-a',
        resourceType: 'RUNTIME_PROFILE',
        resourceId: logicalId
      }
    },
    allowed: true,
    reasons: []
  };
  const forged = env.ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: semanticHash('AuthorizationDecision', basis),
    version: '1',
    semanticPayload: {
      ...basis,
      decisionHash: semanticHash('AuthorizationDecision', basis)
    },
    audit: {
      ...audit('iam-engine', 'SERVICE_ACCOUNT'),
      action: 'AUTHORIZATION_RUNTIME_PROFILE_MANAGE_ALLOW',
      inputRefs: []
    }
  });
  expectCode(() => publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile: baseProfile(env),
    principal: env.profileManager,
    authorizationDecisionAuditRef: forged.ref,
    audit: audit(env.profileManager.principalId)
  }), 'RUNTIME_PROFILE_ROLE_ASSIGNMENT_REQUIRED');
});

test('knowledge.deploy authorization vocabulary cannot be copied into profile management', () => {
  const env = createRuntimeProfileEnvironment('wrong-operation');
  const logicalId = 'rp-wrong-operation';
  const basis = {
    operation: 'KNOWLEDGE_DEPLOY',
    principal: env.profileManager,
    assignmentRefs: [env.profileManagerRole.ref],
    request: {
      authorizationScope: {
        organizationId: 'org-a',
        tenantId: 'tenant-a',
        resourceType: 'RUNTIME_PROFILE',
        resourceId: logicalId
      }
    },
    allowed: true,
    reasons: []
  };
  const forged = env.ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: semanticHash('AuthorizationDecision', basis),
    version: '1',
    semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) },
    audit: {
      ...audit('iam-engine', 'SERVICE_ACCOUNT'),
      action: 'AUTHORIZATION_KNOWLEDGE_DEPLOY_ALLOW',
      inputRefs: [env.profileManagerRole.ref]
    }
  });
  expectCode(() => publishRuntimeProfile({
    ledger: env.ledger,
    logicalId,
    version: '1',
    profile: baseProfile(env),
    principal: env.profileManager,
    authorizationDecisionAuditRef: forged.ref,
    audit: audit(env.profileManager.principalId)
  }), 'RUNTIME_PROFILE_AUTHORIZATION_MISMATCH');
});

test('generic RuntimeProfile with hidden authority input fails validation', () => {
  const env = createRuntimeProfileEnvironment('hidden-input');
  const logicalId = 'rp-hidden-input';
  const auth = createProfileAuthorization(env, logicalId);
  const payload = normalizeRuntimeProfile(baseProfile(env));
  const forged = env.ledger.publish({
    kind: 'RuntimeProfile',
    logicalId,
    version: '1',
    semanticPayload: payload,
    audit: {
      ...audit(env.profileManager.principalId),
      action: 'PUBLISH_RUNTIME_PROFILE',
      inputRefs: [env.release.ref, auth.recorded.ref, env.profileManagerRole.ref],
      details: {
        managementPrincipal: env.profileManager,
        controlScope: payload.controlScope,
        authorizationDecisionAuditRef: auth.recorded.ref
      }
    }
  });
  expectCode(() => validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: forged.ref
  }), 'RUNTIME_PROFILE_PUBLICATION_AUDIT_INVALID');
});

test('profile semantic payload cannot smuggle Deployment or RuntimeBinding authority', () => {
  const env = createRuntimeProfileEnvironment('smuggle');
  for (const [key, value] of [
    ['deploymentRef', 'deployment-1'],
    ['runtimeBindingRef', 'binding-1'],
    ['currentTargetContext', { fieldId: 'field-1' }]
  ]) {
    expectCode(() => normalizeRuntimeProfile({
      ...baseProfile(env),
      [key]: value
    }), 'INVALID_RUNTIME_PROFILE_FIELD');
  }
});

test('same RuntimeProfile logical/version cannot be semantically rewritten', () => {
  const env = createRuntimeProfileEnvironment('immutability');
  publishAuthorizedProfile(env, { logicalId: 'rp-immutable', version: '1' });
  assert.throws(() => publishAuthorizedProfile(env, {
    logicalId: 'rp-immutable',
    version: '1',
    profile: baseProfile(env, { replayRequirement: { minimum: 'PROVIDER_DEPENDENT' } })
  }));
});

console.log('RuntimeProfile integrity acceptance: 13 passed');
