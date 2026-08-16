import assert from 'node:assert/strict';
import {
  RUNTIME_CANDIDATES_CONTRACT_VERSION,
  RUNTIME_PLAN_AUTHORITY_CLASS,
  RUNTIME_PLAN_COMPILER_VERSION,
  RUNTIME_PLAN_CONTRACT_VERSION,
  buildRuntimeCandidates,
  compileRuntimePlan
} from '../../packages/runtime-plan/src/index.mjs';
import {
  directPlanWorld,
  planCompilerInput
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('direct Gate-A candidate compiles into a deterministic non-authority RuntimePlan DAG', () => {
  const world = directPlanWorld('direct');
  const input = planCompilerInput(world);
  const candidates = buildRuntimeCandidates(input);
  const plan = compileRuntimePlan(input);
  assert.equal(candidates.contractVersion, RUNTIME_CANDIDATES_CONTRACT_VERSION);
  assert.equal(candidates.authorityClass, RUNTIME_PLAN_AUTHORITY_CLASS);
  assert.equal(candidates.candidates.length, 1);
  assert.equal(candidates.candidates[0].compilerState, 'STRUCTURALLY_COMPLETE');
  assert.equal(candidates.candidates[0].openRequirements.length, 0);

  assert.equal(plan.contractVersion, RUNTIME_PLAN_CONTRACT_VERSION);
  assert.equal(plan.authorityClass, RUNTIME_PLAN_AUTHORITY_CLASS);
  assert.equal(plan.compilerVersion, RUNTIME_PLAN_COMPILER_VERSION);
  assert.equal(plan.executionAuthority, 'NONE_RUNTIME_PLAN_IS_NOT_ELIGIBILITY_OR_BINDING');
  assert.equal(plan.alternativePaths.length, 1);
  assert.equal(plan.alternativePaths[0].executionAuthority, 'NOT_EVALUATED_BY_RUNTIME_PLAN');
  assert.equal(plan.openRequirements.length, 0);
  assert.ok(plan.nodes.some((node) => node.nodeType === 'CONTEXT'));
  assert.ok(plan.nodes.some((node) => node.nodeType === 'APPLICABILITY'));
  assert.ok(plan.nodes.some((node) => node.nodeType === 'RESULT'));
  assert.equal(plan.nodes.some((node) => ['MODEL', 'POLICY', 'TRANSFORMATION'].includes(node.nodeType)), false);
  assert.match(plan.planId, /^plan:[0-9a-f]{16}$/);
  assert.match(plan.planHash, /^sha256:[0-9a-f]{64}$/);
});

test('same exact planning world produces byte-equivalent graph identity', () => {
  const world = directPlanWorld('deterministic');
  const input = planCompilerInput(world);
  const first = compileRuntimePlan(input);
  const second = compileRuntimePlan(input);
  assert.equal(first.planId, second.planId);
  assert.equal(first.planHash, second.planHash);
  assert.deepEqual(first.nodes, second.nodes);
  assert.deepEqual(first.openRequirements, second.openRequirements);
  assert.deepEqual(first.alternativePaths, second.alternativePaths);
});

test('RuntimePlan freezes exact Decision/Deployment/Profile/Context/Retrieval/Applicability evidence', () => {
  const world = directPlanWorld('exact-world');
  const plan = compileRuntimePlan(planCompilerInput(world));
  assert.deepEqual(plan.decisionProblemRef, world.decision.ref);
  assert.deepEqual(plan.deploymentRef, world.deployment.ref);
  assert.deepEqual(plan.runtimeProfileRef, world.env.profile.ref);
  assert.deepEqual(plan.contextManifestRef, world.manifest.ref);
  assert.deepEqual(plan.knowledgeRetrievalResultRef, world.retrieval.ref);
  assert.deepEqual(plan.applicabilityAssessmentRefs, [world.assessments[0].ref]);
});

test('Context node exposes exact manifest semantic IDs instead of an opaque source blob', () => {
  const world = directPlanWorld('semantic-io');
  const plan = compileRuntimePlan(planCompilerInput(world));
  const context = plan.nodes.find((node) => node.nodeType === 'CONTEXT');
  assert.ok(context);
  assert.ok(context.semanticOutputs.includes('crop.code'));
  assert.ok(context.semanticOutputs.includes('soil.volumetric_water_content'));
  assert.equal(context.semanticOutputs.length >= 2, true);
});

test('direct path has explicit dependency chain context -> applicability -> result', () => {
  const world = directPlanWorld('dag');
  const plan = compileRuntimePlan(planCompilerInput(world));
  const context = plan.nodes.find((node) => node.nodeType === 'CONTEXT');
  const applicability = plan.nodes.find((node) => node.nodeType === 'APPLICABILITY');
  const result = plan.nodes.find((node) => node.nodeType === 'RESULT');
  assert.deepEqual(applicability.dependencyNodes, [context.nodeId]);
  assert.ok(result.dependencyNodes.includes(applicability.nodeId));
  assert.deepEqual(applicability.authorityRefs, [
    world.assessments[0].semanticPayload.knowledgeRef,
    world.assessments[0].ref
  ].sort((a, b) => JSON.stringify([a.kind, a.logicalId, a.version, a.semanticHash]).localeCompare(JSON.stringify([b.kind, b.logicalId, b.version, b.semanticHash]))));
});

test('RuntimePlan does not publish or imply RuntimeEligibility RuntimeBinding or Decision authority', () => {
  const world = directPlanWorld('nonclaim');
  const beforeKinds = new Set(world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind));
  const beforeCount = world.env.ledger.exportSnapshot().records.length;
  const plan = compileRuntimePlan(planCompilerInput(world));
  const afterCount = world.env.ledger.exportSnapshot().records.length;
  assert.equal(afterCount, beforeCount);
  assert.equal(beforeKinds.has('RuntimePlan'), false);
  const serialized = JSON.stringify(plan);
  assert.equal(serialized.includes('RuntimeEligibility'), false);
  assert.equal(serialized.includes('RuntimeBinding'), false);
  assert.equal(serialized.includes('DecisionResult'), false);
  assert.equal(plan.executionAuthority, 'NONE_RUNTIME_PLAN_IS_NOT_ELIGIBILITY_OR_BINDING');
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
console.log(`R01 RuntimePlan positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
