import assert from 'node:assert/strict';
import {
  DeploymentError,
  normalizeDeployment,
  publishDeployment,
  validateDeploymentAuthority,
  validateDeploymentProfileCompatibility
} from '../../packages/deployment/src/index.mjs';
import { baseProfile, publishAuthorizedProfile } from '../runtime-profile/fixture.mjs';
import {
  audit,
  baseDeployment,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  publishAuthorizedDeployment
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DeploymentError && error.code === code);
}

test('minimal Deployment publishes exact RuntimeProfile and exact deployment scope', () => {
  const env = createDeploymentEnvironment('minimal');
  const deployment = publishAuthorizedDeployment(env);
  const validated = validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref });
  assert.equal(validated.semanticPayload.runtimeProfileRef.semanticHash, env.profile.ref.semanticHash);
  assert.equal(validated.semanticPayload.deploymentScope.programId, 'pilot-a');
});

test('runtime environment and rollout stage remain orthogonal deployment semantics', () => {
  const env = createDeploymentEnvironment('orthogonal');
  const normalized = normalizeDeployment(baseDeployment(env));
  assert.equal(normalized.runtimeEnvironment, 'STAGING');
  assert.equal(normalized.rolloutStage, 'SHADOW');
  assert.notEqual(normalized.runtimeEnvironment, normalized.rolloutStage);
});

test('legacy environment:PILOT contract is superseded and rejected', () => {
  const env = createDeploymentEnvironment('legacy-environment');
  expectCode(() => normalizeDeployment({
    ...baseDeployment(env),
    environment: 'PILOT'
  }), 'INVALID_DEPLOYMENT_FIELD');
});

test('Deployment runtime environment must be allowed by exact RuntimeProfile', () => {
  const env = createDeploymentEnvironment('env-subset');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, { runtimeEnvironment: 'PRODUCTION' })
  }), 'DEPLOYMENT_RUNTIME_ENVIRONMENT_NOT_ALLOWED');
});

test('Deployment rollout stage must be allowed by exact RuntimeProfile', () => {
  const env = createDeploymentEnvironment('stage-subset');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, { rolloutStage: 'PILOT' })
  }), 'DEPLOYMENT_ROLLOUT_STAGE_NOT_ALLOWED');
});

test('Deployment use purpose must be a RuntimeProfile subset', () => {
  const env = createDeploymentEnvironment('use-purpose');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, {
      authorizedUse: { usePurposes: ['UNAUTHORIZED_USE'], useClasses: ['ADVISORY'] }
    })
  }), 'DEPLOYMENT_USE_PURPOSE_NOT_ALLOWED');
});

test('Deployment use class must be a RuntimeProfile subset', () => {
  const env = createDeploymentEnvironment('use-class');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, {
      authorizedUse: { usePurposes: ['CORN_IRRIGATION_APPLICABILITY'], useClasses: ['AUTONOMOUS_CONTROL'] }
    })
  }), 'DEPLOYMENT_USE_CLASS_NOT_ALLOWED');
});

test('Deployment organization and tenant must close on RuntimeProfile control scope', () => {
  const env = createDeploymentEnvironment('profile-scope');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, {
      deploymentScope: {
        ...baseDeployment(env).deploymentScope,
        organizationId: 'org-b',
        tenantId: 'tenant-b'
      }
    })
  }), 'DEPLOYMENT_PROFILE_SCOPE_MISMATCH');
});

test('Deployment program must equal exact KnowledgeRelease entitlement target', () => {
  const env = createDeploymentEnvironment('release-program');
  expectCode(() => validateDeploymentProfileCompatibility({
    ledger: env.ledger,
    deployment: baseDeployment(env, {
      deploymentScope: { ...baseDeployment(env).deploymentScope, programId: 'pilot-b' }
    })
  }), 'DEPLOYMENT_RELEASE_ENTITLEMENT_SCOPE_MISMATCH');
});

test('material region/crop/decision scope change changes Deployment semantic identity', () => {
  const env = createDeploymentEnvironment('scope-identity');
  const a = publishAuthorizedDeployment(env, { logicalId: 'deployment.scope-a' });
  const b = publishAuthorizedDeployment(env, {
    logicalId: 'deployment.scope-b',
    deployment: baseDeployment(env, {
      deploymentScope: {
        ...baseDeployment(env).deploymentScope,
        regions: ['region-west'],
        crops: ['wheat'],
        decisionTypes: ['IRRIGATION_TIMING', 'IRRIGATION_AMOUNT']
      }
    })
  });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('material effective interval change changes Deployment semantic identity', () => {
  const env = createDeploymentEnvironment('time-identity');
  const a = publishAuthorizedDeployment(env, { logicalId: 'deployment.time-a' });
  const b = publishAuthorizedDeployment(env, {
    logicalId: 'deployment.time-b',
    deployment: baseDeployment(env, {
      effectiveInterval: {
        start: '2026-08-20T00:00:00Z',
        end: '2026-09-20T00:00:00Z'
      }
    })
  });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('later RuntimeProfile version does not rewrite an old exact Deployment profile ref', () => {
  const env = createDeploymentEnvironment('profile-history');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.profile-history' });
  publishAuthorizedProfile(env, {
    logicalId: env.profile.ref.logicalId,
    version: '2',
    profile: baseProfile(env, { replayRequirement: { minimum: 'PROVIDER_DEPENDENT' } })
  });
  const validated = validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref });
  assert.equal(validated.semanticPayload.runtimeProfileRef.semanticHash, env.profile.ref.semanticHash);
});

test('Deployment cannot embed KnowledgeRelease Model Policy or RuntimeBinding mutation fields', () => {
  const env = createDeploymentEnvironment('no-smuggle');
  for (const [key, value] of [
    ['knowledgeReleaseRef', env.release.ref],
    ['modelRef', 'model@1'],
    ['policyRef', 'policy@1'],
    ['runtimeBindingRef', 'binding@1']
  ]) {
    expectCode(() => normalizeDeployment({ ...baseDeployment(env), [key]: value }), 'INVALID_DEPLOYMENT_FIELD');
  }
});

test('production Deployment succeeds only when profile permits it and production authority is present', () => {
  const env = createDeploymentEnvironment('production', {
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['PRODUCTION'],
      rolloutStages: ['PRODUCTION']
    }
  });
  const deployment = baseDeployment(env, {
    runtimeEnvironment: 'PRODUCTION',
    rolloutStage: 'PRODUCTION'
  });
  const published = publishAuthorizedDeployment(env, {
    logicalId: 'deployment.production',
    deployment
  });
  assert.equal(published.semanticPayload.runtimeEnvironment, 'PRODUCTION');
  assert.equal(published.semanticPayload.rolloutStage, 'PRODUCTION');
});

test('same Deployment logical/version cannot be semantically rewritten', () => {
  const env = createDeploymentEnvironment('immutability');
  publishAuthorizedDeployment(env, { logicalId: 'deployment.immutable', version: '1' });
  const changed = baseDeployment(env, {
    effectiveInterval: { start: '2026-08-17T00:00:00Z', end: '2026-09-17T00:00:00Z' }
  });
  const auth = createDeploymentAuthorization(env, 'deployment.immutable', { deployment: changed });
  assert.throws(() => publishDeployment({
    ledger: env.ledger,
    logicalId: 'deployment.immutable',
    version: '1',
    deployment: changed,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    audit: audit(env.deploymentManager.principalId)
  }));
});

console.log('Deployment acceptance: 15 passed');
