import assert from 'node:assert/strict';
import { assertRuntimeInputWorldAlignment } from '../../packages/runtime-results/src/policy-execution.mjs';

function h(char) { return `sha256:${char.repeat(64)}`; }
function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: h(char) };
}
function binding(overrides = {}) {
  return {
    semanticPayload: {
      runtimeEligibilityRef: ref('RuntimeEligibility', 'eligibility-a', 'a'),
      runtimePlanRef: { planId: 'plan:a', planHash: h('b'), compilerVersion: 'ADR_RUNTIME_PLAN_COMPILER@1' },
      selectedAlternativePathId: 'path:a',
      decisionProblemRef: ref('DecisionProblem', 'decision-a', 'c'),
      deploymentRef: ref('Deployment', 'deployment-a', 'd'),
      runtimeProfileRef: ref('RuntimeProfile', 'profile-a', 'e'),
      knowledgeReleaseRef: ref('KnowledgeRelease', 'release-a', 'f'),
      contextManifestRef: ref('ContextManifest', 'manifest-a', '1'),
      logicalTime: '2026-08-20T10:00:00.000Z',
      evidenceCutoff: '2026-08-20T10:00:00.000Z',
      ...overrides
    }
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('upstream RuntimeDatum binding may feed Policy only when exact runtime world/path lineage matches', () => {
  assert.equal(assertRuntimeInputWorldAlignment(binding(), binding()), true);
});

test('different selected RuntimePlan path is rejected even when semantic output shape could match', () => {
  assert.throws(
    () => assertRuntimeInputWorldAlignment(binding(), binding({ selectedAlternativePathId: 'path:b' })),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_WORLD_MISMATCH'
  );
});

test('different DecisionProblem/ContextManifest world is rejected instead of cross-world RuntimeDatum splicing', () => {
  assert.throws(
    () => assertRuntimeInputWorldAlignment(binding(), binding({
      decisionProblemRef: ref('DecisionProblem', 'decision-b', '2'),
      contextManifestRef: ref('ContextManifest', 'manifest-b', '3')
    })),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_WORLD_MISMATCH'
  );
});

test('different RuntimeEligibility/RuntimePlan identity is rejected even under same Deployment', () => {
  assert.throws(
    () => assertRuntimeInputWorldAlignment(binding(), binding({
      runtimeEligibilityRef: ref('RuntimeEligibility', 'eligibility-b', '4'),
      runtimePlanRef: { planId: 'plan:b', planHash: h('5'), compilerVersion: 'ADR_RUNTIME_PLAN_COMPILER@1' }
    })),
    (error) => error?.code === 'RUNTIME_EXECUTION_RUNTIME_INPUT_WORLD_MISMATCH'
  );
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`D02 post-D03 Policy same-world lineage acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
