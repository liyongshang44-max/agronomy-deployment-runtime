import assert from 'node:assert/strict';
import {
  buildRuntimeCandidates,
  compileRuntimePlan
} from '../../packages/runtime-plan/src/index.mjs';
import {
  multiCandidatePlanWorld,
  planCompilerInput
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('two exact retrieval candidates compile into two coexisting alternative paths', () => {
  const world = multiCandidatePlanWorld('two-paths');
  const candidates = buildRuntimeCandidates(planCompilerInput(world));
  const plan = compileRuntimePlan(planCompilerInput(world));
  assert.equal(candidates.candidates.length, 2);
  assert.equal(plan.alternativePaths.length, 2);
  assert.deepEqual(
    plan.alternativePaths.map((path) => path.knowledgeRef),
    candidates.candidates.map((candidate) => candidate.knowledgeRef)
  );
  assert.equal(plan.alternativePaths.every((path) => path.compilerState === 'STRUCTURALLY_COMPLETE'), true);
  assert.equal(plan.alternativePaths.every((path) => path.executionAuthority === 'NOT_EVALUATED_BY_RUNTIME_PLAN'), true);
});

test('applicability assessment input order cannot perturb RuntimeCandidates or RuntimePlan identity', () => {
  const world = multiCandidatePlanWorld('order');
  const forward = planCompilerInput(world);
  const reversed = planCompilerInput(world, {
    applicabilityAssessmentRefs: [...forward.applicabilityAssessmentRefs].reverse()
  });
  const candidatesForward = buildRuntimeCandidates(forward);
  const candidatesReverse = buildRuntimeCandidates(reversed);
  const planForward = compileRuntimePlan(forward);
  const planReverse = compileRuntimePlan(reversed);
  assert.deepEqual(candidatesForward, candidatesReverse);
  assert.equal(planForward.planHash, planReverse.planHash);
  assert.equal(planForward.planId, planReverse.planId);
  assert.deepEqual(planForward.nodes, planReverse.nodes);
  assert.deepEqual(planForward.alternativePaths, planReverse.alternativePaths);
});

test('each alternative path binds a different exact knowledge and applicability pair', () => {
  const world = multiCandidatePlanWorld('exact-pairs');
  const plan = compileRuntimePlan(planCompilerInput(world));
  const knowledgeKeys = new Set(plan.alternativePaths.map((path) => JSON.stringify(path.knowledgeRef)));
  const assessmentKeys = new Set(plan.alternativePaths.map((path) => JSON.stringify(path.applicabilityAssessmentRef)));
  assert.equal(knowledgeKeys.size, 2);
  assert.equal(assessmentKeys.size, 2);
  for (const path of plan.alternativePaths) {
    const applicabilityNode = plan.nodes.find((node) =>
      node.nodeType === 'APPLICABILITY'
      && node.authorityRefs.some((ref) => ref.semanticHash === path.applicabilityAssessmentRef.semanticHash));
    assert.ok(applicabilityNode);
    assert.ok(applicabilityNode.authorityRefs.some((ref) => ref.semanticHash === path.knowledgeRef.semanticHash));
  }
});

test('alternative paths are graph structure, not ranking or recommendation', () => {
  const world = multiCandidatePlanWorld('non-ranking');
  const plan = compileRuntimePlan(planCompilerInput(world));
  const serialized = JSON.stringify(plan).toLowerCase();
  for (const forbidden of ['ranking_score', 'relevance_score', 'recommended_candidate', 'best_candidate', 'decisionresult']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(new Set(plan.alternativePaths.map((path) => path.pathId)).size, 2);
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
console.log(`R01 RuntimePlan alternatives acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
