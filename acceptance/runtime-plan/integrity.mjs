import assert from 'node:assert/strict';
import {
  buildRuntimeCandidates,
  compileRuntimePlan
} from '../../packages/runtime-plan/src/index.mjs';
import {
  directPlanWorld,
  multiCandidatePlanWorld,
  planCompilerInput
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('compiler rejects a DecisionProblem different from the exact retrieval world', () => {
  const world = directPlanWorld('wrong-decision');
  const foreign = directPlanWorld('foreign-decision');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    decisionProblemRef: foreign.decision.ref
  })), (error) => error?.code === 'RUNTIME_PLAN_DECISION_MISMATCH');
});

test('compiler rejects Deployment or RuntimeProfile drift from exact retrieval evidence', () => {
  const world = directPlanWorld('wrong-deployment');
  const foreign = directPlanWorld('foreign-deployment');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    deploymentRef: foreign.deployment.ref
  })), (error) => error?.code === 'RUNTIME_PLAN_DEPLOYMENT_MISMATCH');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    runtimeProfileRef: foreign.env.profile.ref
  })), (error) => error?.code === 'RUNTIME_PLAN_PROFILE_MISMATCH');
});

test('compiler rejects ContextManifest drift even when another manifest is individually valid elsewhere', () => {
  const world = directPlanWorld('wrong-context');
  const foreign = directPlanWorld('foreign-context');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    contextManifestRef: foreign.manifest.ref
  })));
});

test('compiler rejects an ApplicabilityAssessment from another retrieval/context world', () => {
  const world = directPlanWorld('wrong-assessment');
  const foreign = directPlanWorld('foreign-assessment');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    applicabilityAssessmentRefs: [foreign.assessments[0].ref]
  })));
});

test('retrieval candidates cannot be silently omitted from applicability coverage', () => {
  const world = multiCandidatePlanWorld('coverage');
  assert.equal(world.retrieval.semanticPayload.candidateRefs.length, 2);
  assert.throws(() => buildRuntimeCandidates(planCompilerInput(world, {
    applicabilityAssessmentRefs: [world.assessments[0].ref]
  })), (error) => error?.code === 'RUNTIME_PLAN_INCOMPLETE_APPLICABILITY_COVERAGE');
});

test('duplicate exact applicability refs fail closed', () => {
  const world = directPlanWorld('duplicate-assessment');
  assert.throws(() => compileRuntimePlan(planCompilerInput(world, {
    applicabilityAssessmentRefs: [world.assessments[0].ref, world.assessments[0].ref]
  })), (error) => error?.code === 'DUPLICATE_RUNTIME_PLAN_REF');
});

test('missing context remains a structured open requirement and explicit information node', () => {
  const world = directPlanWorld('missing-context', { includeCrop: false });
  const candidates = buildRuntimeCandidates(planCompilerInput(world));
  const plan = compileRuntimePlan(planCompilerInput(world));
  assert.equal(candidates.candidates[0].compilerState, 'BLOCKED_BY_APPLICABILITY');
  assert.ok(plan.openRequirements.some((requirement) =>
    requirement.requirementType === 'MISSING_CONTEXT' && requirement.semanticId === 'crop.code'));
  assert.ok(plan.nodes.some((node) => node.nodeType === 'INFORMATION' && node.semanticInputs.includes('crop.code')));
  assert.equal(JSON.stringify(plan.openRequirements).includes('crop.code'), true);
});

test('blocked applicability is represented as compiler state, never silently dropped or called executable', () => {
  const world = directPlanWorld('blocked', { includeCrop: false });
  const plan = compileRuntimePlan(planCompilerInput(world));
  assert.equal(plan.alternativePaths.length, 1);
  assert.equal(plan.alternativePaths[0].compilerState, 'BLOCKED_BY_APPLICABILITY');
  assert.equal(plan.alternativePaths[0].executionAuthority, 'NOT_EVALUATED_BY_RUNTIME_PLAN');
  assert.equal(JSON.stringify(plan).includes('EXECUTABLE'), false);
});

test('current RuntimeBinding is not a required compiler input and cannot affect plan identity', () => {
  const world = directPlanWorld('no-binding');
  const input = planCompilerInput(world);
  const base = compileRuntimePlan(input);
  const withIrrelevantCurrentBinding = compileRuntimePlan({
    ...input,
    currentRuntimeBindingRef: {
      kind: 'RuntimeBinding',
      logicalId: 'binding-that-must-not-be-a-predecessor',
      version: '1',
      semanticHash: 'sha256:not-an-input'
    }
  });
  assert.equal(base.planHash, withIrrelevantCurrentBinding.planHash);
  assert.deepEqual(base.nodes, withIrrelevantCurrentBinding.nodes);
});

test('RuntimePlan compilation is read-only over the AuthorityLedger', () => {
  const world = directPlanWorld('read-only');
  const before = world.env.ledger.exportSnapshot();
  compileRuntimePlan(planCompilerInput(world));
  const after = world.env.ledger.exportSnapshot();
  assert.deepEqual(after, before);
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
console.log(`R01 RuntimePlan integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
