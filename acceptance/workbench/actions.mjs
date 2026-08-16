import assert from 'node:assert/strict';
import {
  createAgronomistWorkbenchAuthorityActions,
  WORKBENCH_AUTHORITY_ACTIONS
} from '../../packages/workbench/src/index.mjs';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../packages/knowledge-registry/src/qualified-authority.mjs';
import { validateDeploymentAuthority } from '../../packages/deployment/src/index.mjs';
import {
  USE_OTHER,
  audit as scientificAudit,
  authorizeForResource
} from '../derived-knowledge/fixture.mjs';
import {
  baseDeployment,
  createDeploymentAuthorization,
  createDeploymentEnvironment,
  audit as deploymentAudit
} from '../deployment/fixture.mjs';
import { createWorkbenchWorld } from './fixture.mjs';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

function contextAdjudication() {
  return {
    BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
    ENVIRONMENTAL: [{ semanticId: 'soil.texture', valueType: 'CATEGORY' }],
    MANAGEMENT: [],
    OPERATIONAL: [],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

test('A11 authority-action surface is a closed delegation list with no generic override/accept-applicability command', () => {
  assert.deepEqual(WORKBENCH_AUTHORITY_ACTIONS, [
    'REVIEW_SOURCE_FAITHFUL_CANDIDATE',
    'RECORD_SCIENTIFIC_QUALIFICATION_DECISION',
    'PUBLISH_QUALIFIED_KNOWLEDGE',
    'CREATE_KNOWLEDGE_CONFLICT',
    'RESOLVE_KNOWLEDGE_CONFLICT',
    'PUBLISH_DEPLOYMENT',
    'CONTROL_DEPLOYMENT'
  ]);
  assert.equal(WORKBENCH_AUTHORITY_ACTIONS.some((item) => /OVERRIDE|APPLICABILITY|ACCEPT_RECOMMENDATION/.test(item)), false);
});

test('Workbench source-faithful review delegates to K03 and produces the canonical review + Claim + SourceContext authority chain', () => {
  const world = createWorkbenchWorld('action-review');
  const q = world.env.qualified;
  const reviewer = q.reviewed.review.semanticPayload.reviewPrincipal;
  const actions = createAgronomistWorkbenchAuthorityActions({ ledger: world.env.ledger });
  const result = actions.reviewSourceFaithfulCandidate({
    reviewLogicalId: 'review.a11.delegated',
    reviewVersion: '1',
    compilationResultRef: q.bundle.result.ref,
    claimCandidateRef: q.bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: q.bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: q.reviewed.review.semanticPayload.authorizationDecisionAuditRef,
    claimLogicalId: 'claim.a11.delegated',
    claimVersion: '1',
    sourceContextLogicalId: 'source-context.a11.delegated',
    sourceContextVersion: '1',
    audit: scientificAudit('evt-a11-delegated-review', reviewer.principalId)
  });
  assert.equal(result.review.ref.kind, 'SourceFaithfulReviewDecision');
  assert.equal(result.claim.ref.kind, 'Claim');
  assert.equal(result.claim.semanticPayload.authorityClass, 'SOURCE_ASSERTION');
  assert.equal(result.sourceContext.ref.kind, 'SourceContext');
  assert.equal(result.sourceContext.semanticPayload.authorityClass, 'SOURCE_CONTEXT');
});

test('Workbench scientific qualification delegates to K04 and cannot replace exact authorization policy/decision semantics', () => {
  const world = createWorkbenchWorld('action-qualification');
  const q = world.env.qualified;
  const actions = createAgronomistWorkbenchAuthorityActions({ ledger: world.env.ledger });
  const authorization = authorizeForResource(world.env, {
    resourceId: qualificationResourceId(q.reviewed.claim.ref, q.reviewed.sourceContext.ref),
    qualificationTarget: USE_OTHER,
    logicalId: 'a11-other-use-qualification'
  });
  const decision = actions.recordScientificQualificationDecision({
    decisionLogicalId: 'qualification.a11.other-use',
    decisionVersion: '1',
    claimRef: q.reviewed.claim.ref,
    sourceContextRef: q.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_OTHER,
    semanticPreconditions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    approverPrincipal: world.env.approver,
    authorizationDecisionAuditRef: authorization.authAudit.ref,
    audit: scientificAudit('evt-a11-other-use-decision', world.env.approver.principalId)
  });
  const knowledge = actions.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: 'knowledge.a11.two-uses',
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [q.decision.ref, decision.ref],
    audit: scientificAudit('evt-a11-two-use-knowledge', world.env.approver.principalId)
  });
  const validated = validateQualifiedKnowledgeAuthority({
    ledger: world.env.ledger,
    qualifiedKnowledgeRef: knowledge.ref,
    requiredUseTarget: USE_OTHER
  });
  assert.equal(validated.useStatus, 'QUALIFIED');
  assert.equal(validated.decisions.length, 2);
});

test('Workbench deployment publication delegates to A06 and produces a normal validated Deployment authority object', () => {
  const env = createDeploymentEnvironment('a11-action-deployment');
  const actions = createAgronomistWorkbenchAuthorityActions({ ledger: env.ledger });
  const deployment = baseDeployment(env);
  const authorization = createDeploymentAuthorization(env, 'deployment.a11.delegated', { deployment });
  assert.equal(authorization.decision.allowed, true);
  const record = actions.publishDeployment({
    logicalId: 'deployment.a11.delegated',
    version: '1',
    deployment,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: authorization.recorded.ref,
    audit: deploymentAudit(env.deploymentManager.principalId)
  });
  const validated = validateDeploymentAuthority({ ledger: env.ledger, deploymentRef: record.ref });
  assert.equal(validated.record.ref.semanticHash, record.ref.semanticHash);
});

test('Workbench deployment action cannot bypass A06 when authorization input is missing or substituted', () => {
  const env = createDeploymentEnvironment('a11-action-denied');
  const actions = createAgronomistWorkbenchAuthorityActions({ ledger: env.ledger });
  const deployment = baseDeployment(env);
  assert.throws(() => actions.publishDeployment({
    logicalId: 'deployment.a11.denied',
    version: '1',
    deployment,
    principal: env.deploymentManager,
    authorizationDecisionAuditRef: env.profile.ref,
    audit: deploymentAudit(env.deploymentManager.principalId)
  }));
});

console.log(`Agronomist Workbench authority-action acceptance: ${passed} passed`);
