import assert from 'node:assert/strict';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import {
  DeploymentError,
  currentDeploymentState,
  deploymentControlLogicalId,
  publishDeploymentControlDecision,
  resolveDeploymentForRuntime,
  validateDeploymentAuthority
} from '../../packages/deployment/src/index.mjs';
import { authorizeForResource, USE_APPLICABILITY } from '../derived-knowledge/fixture.mjs';
import {
  audit,
  baseDeployment,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  createRuntimeReadAuthorization,
  publishAuthorizedDeployment
} from './fixture.mjs';

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DeploymentError && error.code === code);
}
function control(env, deployment, action, version) {
  const auth = createDeploymentAuthorization(env, deployment.ref.logicalId, {
    deployment: deployment.semanticPayload,
    action
  });
  assert.equal(auth.decision.allowed, true);
  return publishDeploymentControlDecision({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    version,
    action,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    reasonCodes: [`A06_${action}`],
    audit: audit(env.deploymentManager.principalId)
  });
}

test('SUSPEND creates immutable lifecycle authority and current state becomes SUSPENDED', () => {
  const env = createDeploymentEnvironment('suspend');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.suspend' });
  const record = control(env, deployment, 'SUSPEND', '1');
  assert.equal(record.ref.kind, 'DeploymentControlDecision');
  assert.equal(record.semanticPayload.action, 'SUSPEND');
  assert.equal(currentDeploymentState({ ledger: env.ledger, deploymentRef: deployment.ref }).rolloutStage, 'SUSPENDED');
});

test('runtime retrieval is denied while Deployment is SUSPENDED', () => {
  const env = createDeploymentEnvironment('suspended-runtime');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.suspended-runtime' });
  control(env, deployment, 'SUSPEND', '1');
  const runtimeAuth = createRuntimeReadAuthorization(env, deployment.ref.logicalId, {
    deployment: deployment.semanticPayload
  });
  assert.equal(runtimeAuth.decision.allowed, true);
  expectCode(() => resolveDeploymentForRuntime({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    principal: env.runtimePrincipal,
    authorizationDecisionAuditRef: runtimeAuth.recorded.ref,
    atTime: '2026-08-20T00:00:00Z'
  }), 'DEPLOYMENT_NOT_RUNTIME_ACTIVE');
});

test('RESUME from SUSPENDED restores the base rollout stage', () => {
  const env = createDeploymentEnvironment('resume');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.resume' });
  control(env, deployment, 'SUSPEND', '1');
  control(env, deployment, 'RESUME', '2');
  const state = currentDeploymentState({ ledger: env.ledger, deploymentRef: deployment.ref });
  assert.equal(state.baseRolloutStage, 'SHADOW');
  assert.equal(state.rolloutStage, 'SHADOW');
  assert.equal(state.controls.length, 2);
});

test('DEPRECATE creates terminal current state and blocks runtime retrieval', () => {
  const env = createDeploymentEnvironment('deprecate');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.deprecate' });
  control(env, deployment, 'DEPRECATE', '1');
  assert.equal(currentDeploymentState({ ledger: env.ledger, deploymentRef: deployment.ref }).rolloutStage, 'DEPRECATED');
  const runtimeAuth = createRuntimeReadAuthorization(env, deployment.ref.logicalId, {
    deployment: deployment.semanticPayload
  });
  expectCode(() => resolveDeploymentForRuntime({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    principal: env.runtimePrincipal,
    authorizationDecisionAuditRef: runtimeAuth.recorded.ref,
    atTime: '2026-08-20T00:00:00Z'
  }), 'DEPLOYMENT_NOT_RUNTIME_ACTIVE');
});

test('RESUME after DEPRECATED is rejected', () => {
  const env = createDeploymentEnvironment('resume-deprecated');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.resume-deprecated' });
  control(env, deployment, 'DEPRECATE', '1');
  const auth = createDeploymentAuthorization(env, deployment.ref.logicalId, {
    deployment: deployment.semanticPayload,
    action: 'RESUME'
  });
  expectCode(() => publishDeploymentControlDecision({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    version: '2',
    action: 'RESUME',
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: auth.recorded.ref,
    reasonCodes: ['INVALID_RESUME'],
    audit: audit(env.deploymentManager.principalId)
  }), 'INVALID_DEPLOYMENT_CONTROL_TRANSITION');
});

test('lifecycle controls never change Deployment RuntimeProfile or KnowledgeRelease semantic hashes', () => {
  const env = createDeploymentEnvironment('semantic-stability');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.semantic-stability' });
  const originalDeploymentHash = deployment.ref.semanticHash;
  const originalProfileHash = deployment.semanticPayload.runtimeProfileRef.semanticHash;
  const originalReleaseHash = env.release.ref.semanticHash;
  control(env, deployment, 'SUSPEND', '1');
  control(env, deployment, 'RESUME', '2');
  const validated = validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref });
  assert.equal(validated.record.ref.semanticHash, originalDeploymentHash);
  assert.equal(validated.semanticPayload.runtimeProfileRef.semanticHash, originalProfileHash);
  assert.equal(validated.profileAuthority.knowledgeReleaseAuthority.release.ref.semanticHash, originalReleaseHash);
});

test('generic forged DeploymentControlDecision cannot poison current lifecycle state', () => {
  const env = createDeploymentEnvironment('forged-control');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.forged-control' });
  env.ledger.publish({
    kind: 'DeploymentControlDecision',
    logicalId: deploymentControlLogicalId(deployment.ref),
    version: 'forged',
    semanticPayload: {
      deploymentRef: deployment.ref,
      action: 'SUSPEND',
      predecessorControlRef: null,
      reasonCodes: ['FORGED_GENERIC_CONTROL']
    },
    audit: audit('attacker')
  });
  const state = currentDeploymentState({ ledger: env.ledger, deploymentRef: deployment.ref });
  assert.equal(state.rolloutStage, 'SHADOW');
  assert.equal(state.controls.length, 0);
});

test('later KnowledgeRelease invalidation blocks current Deployment but preserves historical replay', () => {
  const env = createDeploymentEnvironment('release-lifecycle');
  const deployment = publishAuthorizedDeployment(env, { logicalId: 'deployment.release-lifecycle' });
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(
      env.qualified.reviewed.claim.ref,
      env.qualified.reviewed.sourceContext.ref
    ),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'a06-release-lifecycle-revoke'
  });
  env.qualified.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.a06.release-lifecycle',
    revocationVersion: '1',
    qualifiedKnowledgeRef: env.qualified.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['LATER_REVOCATION'],
    audit: audit(env.approver.principalId)
  });
  assert.throws(() => validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: deployment.ref }));
  const historical = validateDeploymentAuthority({
    ledger: env.ledger,
    deploymentRef: deployment.ref,
    allowHistorical: true
  });
  assert.equal(historical.record.ref.semanticHash, deployment.ref.semanticHash);
  assert.equal(historical.profileAuthority.record.ref.semanticHash, env.profile.ref.semanticHash);
});

console.log('Deployment lifecycle acceptance: 8 passed');
