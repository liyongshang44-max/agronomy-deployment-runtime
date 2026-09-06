import assert from 'node:assert/strict';
import {
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeKnowledgeRelease } from '../../packages/knowledge-registry/src/release-authorization.mjs';
import { KnowledgeReleaseService, releaseMemberResourceId } from '../../packages/knowledge-release/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import { planInformationRequirements } from '../../packages/information-requirement/src/index.mjs';
import {
  RELEASE_TARGET,
  baseProfile,
  publishAuthorizedProfile
} from '../runtime-profile/fixture.mjs';
import {
  baseDeployment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  createRetrievalEnvironment,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from '../knowledge-retrieval/fixture.mjs';
import {
  datumInput,
  publishDatum,
  publishManifest
} from '../context-manifest/fixtures.mjs';
import { USE_APPLICABILITY, audit as scientificAudit } from '../derived-knowledge/fixture.mjs';
import { assess, audit as applicabilityAudit } from '../applicability/fixture.mjs';

const TARGET_SEMANTIC = 'soil.root_zone_deficit';
const BASIS_SEMANTIC = 'measurement.root_zone_vertical_interval';
const SUPPORT_OPERATOR = 'CONTEXT_DATUM_SUPPORT_MATCH';

function supportPrecondition({
  basisKind = 'EXACT_INTERVAL',
  supportDimension = 'VERTICAL_INTERVAL',
  requiredRelation = 'EXACT_INTERVAL_MATCH',
  basisUnit = 'mm'
} = {}) {
  return {
    semanticId: TARGET_SEMANTIC,
    operator: SUPPORT_OPERATOR,
    supportDimension,
    requiredRelation,
    expectedSupportBasis: basisKind === 'EXACT_INTERVAL'
      ? { kind: 'EXACT_INTERVAL', fromMm: '0', toMm: '600' }
      : { kind: 'CONTEXT_SEMANTIC_INTERVAL', semanticId: BASIS_SEMANTIC, unit: basisUnit }
  };
}

function publishReleaseForKnowledge(env, knowledge, label) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.dec0034.release-member.${label}`,
    version: '1',
    resourceId: releaseMemberResourceId(knowledge.ref),
    ownership: knowledge.semanticPayload.ownership,
    visibilityPolicy: [{ principalId: env.releaseManager.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [RELEASE_TARGET],
    audit: applicabilityAudit(env.releaseManager, 'dec0034-release-policy')
  });
  const releaseDecision = authorizeKnowledgeRelease({
    principal: env.releaseManager,
    policy,
    roleAssignments: [env.releaseManagerRole],
    releaseTarget: RELEASE_TARGET
  });
  assert.equal(releaseDecision.allowed, true);
  const releaseAuth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: releaseDecision,
    audit: applicabilityAudit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, 'dec0034-release-auth')
  });
  return new KnowledgeReleaseService({ ledger: env.ledger }).publishRelease({
    logicalId: `release.dec0034.${label}`,
    version: '2',
    memberEntitlements: [{
      knowledgeRef: knowledge.ref,
      policyRef: policy.ref,
      authorizationDecisionAuditRef: releaseAuth.ref
    }],
    publisherPrincipal: env.releaseManager,
    releaseTarget: RELEASE_TARGET,
    audit: applicabilityAudit(env.releaseManager, 'dec0034-release')
  }).release;
}

function publishTargetState(env, label, verticalSupport) {
  return publishDatum(env.ledger, `datum.dec0034.${label}.target`, datumInput({
    semanticId: TARGET_SEMANTIC,
    value: { type: 'DECIMAL', decimal: '45' },
    unit: 'mm',
    epistemicClass: 'STATE_ESTIMATE',
    provenanceClass: 'MODEL',
    verticalSupport,
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:55:00Z',
    source: {
      providerId: 'dec0034-state-provider',
      sourceRef: `root-zone-deficit-${label}`,
      contentHash: `sha256:dec0034-target-${label}`
    }
  }));
}

function publishBasisDatum(env, label, { unit = 'mm', lower = '0', upper = '600', suffix = 'basis' } = {}) {
  return publishDatum(env.ledger, `datum.dec0034.${label}.${suffix}`, datumInput({
    semanticId: BASIS_SEMANTIC,
    value: {
      type: 'INTERVAL',
      lower: { type: 'DECIMAL', decimal: lower },
      upper: { type: 'DECIMAL', decimal: upper }
    },
    unit,
    epistemicClass: 'CONFIGURATION',
    provenanceClass: 'CUSTOMER_SYSTEM',
    verticalSupport: null,
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:54:00Z',
    source: {
      providerId: 'dec0034-config-provider',
      sourceRef: `root-zone-interval-${label}-${suffix}`,
      contentHash: `sha256:dec0034-basis-${label}-${suffix}`
    }
  }));
}

function createSupportWorld(label, {
  precondition = supportPrecondition(),
  targetSupport = { fromMm: '0', toMm: '600' },
  includeBasis = false,
  basisUnit = 'mm',
  basisLower = '0',
  basisUpper = '600',
  duplicateTarget = false,
  duplicateBasis = false
} = {}) {
  const env = createRetrievalEnvironment(`dec0034-${label}`);
  const old = env.qualified;
  const decision2 = old.qualification.recordQualificationDecision({
    decisionLogicalId: `qualification.dec0034.${label}.2`,
    decisionVersion: '2',
    claimRef: old.reviewed.claim.ref,
    sourceContextRef: old.reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: USE_APPLICABILITY,
    semanticPreconditions: [precondition],
    transportConstraints: [],
    approverPrincipal: old.approver,
    authorizationDecisionAuditRef: old.decision.semanticPayload.authorizationDecisionAuditRef,
    supersedesDecisionRef: old.decision.ref,
    audit: scientificAudit(`evt-dec0034-qualification-${label}`, old.approver.principalId)
  });
  const knowledge = old.qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.dec0034.${label}.2`,
    qualifiedKnowledgeVersion: '2',
    qualificationDecisionRefs: [decision2.ref],
    supersedesQualifiedKnowledgeRef: old.knowledge.ref,
    audit: scientificAudit(`evt-dec0034-qualified-${label}`, old.approver.principalId)
  });
  const release = publishReleaseForKnowledge(env, knowledge, label);
  const profile = publishAuthorizedProfile(env, {
    logicalId: `runtime-profile.dec0034.${label}.2`,
    version: '2',
    profile: baseProfile(env, {
      knowledgeReleaseRef: release.ref,
      contextRequirements: {
        requiredSemanticIds: [TARGET_SEMANTIC],
        epistemicConstraints: { [TARGET_SEMANTIC]: ['STATE_ESTIMATE'] }
      }
    })
  });
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.dec0034.${label}.2`,
    version: '2',
    deployment: baseDeployment(env, { runtimeProfileRef: profile.ref })
  });
  const decision = publishDecision(env, { logicalId: `decision.dec0034.${label}.2` });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.dec0034.${label}.2`,
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  assert.deepEqual(retrieval.semanticPayload.candidateRefs, [knowledge.ref]);

  const datums = [publishTargetState(env, label, targetSupport)];
  if (duplicateTarget) datums.push(publishTargetState(env, `${label}-duplicate-target`, targetSupport));
  if (includeBasis) datums.push(publishBasisDatum(env, label, { unit: basisUnit, lower: basisLower, upper: basisUpper }));
  if (duplicateBasis) datums.push(publishBasisDatum(env, label, { unit: basisUnit, lower: basisLower, upper: basisUpper, suffix: 'basis-duplicate' }));
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.dec0034.${label}.2`,
    decisionProblem: decision,
    datumRefs: datums.map((datum) => datum.ref),
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const world = { env: { ...env, profile }, decision, deployment, retrieval, manifest, knowledge, qualificationDecision: decision2 };
  const assessment = assess(world, {
    logicalId: `applicability.dec0034.${label}.2`,
    knowledgeRef: knowledge.ref,
    manifest
  });
  return { ...world, assessment };
}

function compile(world) {
  return compileRuntimePlan({
    ledger: world.env.ledger,
    decisionProblemRef: world.decision.ref,
    deploymentRef: world.deployment.ref,
    runtimeProfileRef: world.env.profile.ref,
    contextManifestRef: world.manifest.ref,
    knowledgeRetrievalResultRef: world.retrieval.ref,
    applicabilityAssessmentRefs: [world.assessment.ref]
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('K04 exact vertical interval support precondition yields A08 MATCH and structurally complete R01 only for exact support', () => {
  const world = createSupportWorld('exact-match');
  assert.equal(world.knowledge.semanticPayload.semanticPreconditions.length, 1);
  assert.deepEqual(world.knowledge.semanticPayload.semanticPreconditions[0].qualificationDecisionRef, world.qualificationDecision.ref);
  assert.deepEqual(world.knowledge.semanticPayload.semanticPreconditions[0].value, supportPrecondition());
  assert.equal(world.assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(world.assessment.semanticPayload.runtimeUse, 'ALLOWED');
  const condition = world.assessment.semanticPayload.conditionResults[0];
  assert.equal(condition.operator, SUPPORT_OPERATOR);
  assert.equal(condition.status, 'MATCH');
  assert.deepEqual(condition.expected.resolvedSupport, { fromMm: '0', toMm: '600' });
  assert.deepEqual(condition.target.verticalSupport, { fromMm: '0', toMm: '600' });
  const plan = compile(world);
  assert.equal(plan.openRequirements.length, 0);
  assert.equal(plan.alternativePaths[0].compilerState, 'STRUCTURALLY_COMPLETE');
  assert.equal(world.env.ledger.exportSnapshot().records.some((record) => record.ref.kind === 'QualifiedTransformation'), false);
});

test('same target semantic/value/unit with wrong vertical support is A08 CONFLICT and cannot become structurally complete', () => {
  const world = createSupportWorld('wrong-support', { targetSupport: { fromMm: '0', toMm: '300' } });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert.equal(world.assessment.semanticPayload.runtimeUse, 'BLOCKED');
  assert(world.assessment.semanticPayload.conflicts.some((item) => item.code === 'MEASUREMENT_SUPPORT_MISMATCH'));
  const plan = compile(world);
  assert.notEqual(plan.alternativePaths[0].compilerState, 'STRUCTURALLY_COMPLETE');
  assert(plan.openRequirements.some((item) => item.requirementType === 'APPLICABILITY_CONFLICT'));
});

test('root-zone semantic naming cannot launder null vertical support', () => {
  const world = createSupportWorld('null-support', { targetSupport: null });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert.equal(world.assessment.semanticPayload.conditionResults[0].status, 'MISMATCH');
  assert(world.assessment.semanticPayload.conflicts.some((item) => item.code === 'MEASUREMENT_SUPPORT_MISMATCH'));
});

test('context-semantic interval basis resolves from exact same ContextManifest and supports exact match', () => {
  const world = createSupportWorld('context-basis-match', {
    precondition: supportPrecondition({ basisKind: 'CONTEXT_SEMANTIC_INTERVAL' }),
    includeBasis: true
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  const condition = world.assessment.semanticPayload.conditionResults[0];
  assert.equal(condition.status, 'MATCH');
  assert.equal(condition.expected.expectedSupportBasis.semanticId, BASIS_SEMANTIC);
  assert.deepEqual(condition.expected.resolvedSupport, { fromMm: '0', toMm: '600' });
  assert.equal(compile(world).openRequirements.length, 0);
});

test('missing context-semantic support basis remains UNRESOLVED and becomes an OPEN R02 InformationRequirement', () => {
  const world = createSupportWorld('missing-basis', {
    precondition: supportPrecondition({ basisKind: 'CONTEXT_SEMANTIC_INTERVAL' }),
    includeBasis: false
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.deepEqual(world.assessment.semanticPayload.missingContextSemanticIds, [BASIS_SEMANTIC]);
  const plan = compile(world);
  assert(plan.openRequirements.some((item) => item.requirementType === 'MISSING_CONTEXT' && item.semanticId === BASIS_SEMANTIC));
  const information = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  const requirement = information.informationRequirements.find((item) => item.semanticId === BASIS_SEMANTIC);
  assert.ok(requirement);
  assert.equal(requirement.status, 'OPEN');
});

test('wrong support-basis unit fails closed as measurement-support conflict', () => {
  const world = createSupportWorld('basis-unit', {
    precondition: supportPrecondition({ basisKind: 'CONTEXT_SEMANTIC_INTERVAL' }),
    includeBasis: true,
    basisUnit: 'cm'
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'CONFLICT');
  assert(world.assessment.semanticPayload.conflicts.some((item) => item.code === 'MEASUREMENT_SUPPORT_BASIS_UNIT_MISMATCH'));
});

test('ambiguous support-basis semantic remains UNRESOLVED rather than choosing a convenient interval', () => {
  const world = createSupportWorld('basis-ambiguous', {
    precondition: supportPrecondition({ basisKind: 'CONTEXT_SEMANTIC_INTERVAL' }),
    includeBasis: true,
    duplicateBasis: true
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert(world.assessment.semanticPayload.unsupportedConstraintCodes.includes('MEASUREMENT_SUPPORT_BASIS_AMBIGUOUS'));
});

test('ambiguous target semantic remains UNRESOLVED rather than choosing a convenient support-bearing datum', () => {
  const world = createSupportWorld('target-ambiguous', { duplicateTarget: true });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert(world.assessment.semanticPayload.unsupportedConstraintCodes.includes('MEASUREMENT_SUPPORT_TARGET_AMBIGUOUS'));
});

test('unsupported support dimension fails conservatively without creating transformation authority', () => {
  const world = createSupportWorld('unsupported-dimension', {
    precondition: supportPrecondition({ supportDimension: 'HORIZONTAL_GEOMETRY' })
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.deepEqual(world.assessment.semanticPayload.unsupportedConstraintCodes, ['SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_DIMENSION']);
  assert.equal(world.env.ledger.exportSnapshot().records.some((record) => record.ref.kind === 'QualifiedTransformation'), false);
});

test('unsupported support relation fails conservatively instead of inventing overlap/containment semantics', () => {
  const world = createSupportWorld('unsupported-relation', {
    precondition: supportPrecondition({ requiredRelation: 'OVERLAPS' })
  });
  assert.equal(world.assessment.semanticPayload.transportStatus, 'UNRESOLVED');
  assert.deepEqual(world.assessment.semanticPayload.unsupportedConstraintCodes, ['SEMANTIC_PRECONDITION_UNSUPPORTED_SUPPORT_RELATION']);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`DEC-0034 measurement-support acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;