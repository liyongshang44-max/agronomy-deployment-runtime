import assert from 'node:assert/strict';
import { buildKnowledgeRetrievalResult } from '../../packages/knowledge-retrieval/src/index.mjs';

function ref(kind, logicalId, fill) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${fill.repeat(64)}`
  };
}

const decisionProblemRef = ref('DecisionProblem', 'decision.multi-member', '1');
const deploymentRef = ref('Deployment', 'deployment.multi-member', '2');
const runtimeProfileRef = ref('RuntimeProfile', 'profile.multi-member', '3');
const knowledgeReleaseRef = ref('KnowledgeRelease', 'release.multi-member', '4');
const derived = ref('DerivedKnowledge', 'derived-z', '5');
const qualifiedA = ref('QualifiedKnowledge', 'qualified-a', '6');
const qualifiedB = ref('QualifiedKnowledge', 'qualified-b', '7');
const canonicalMembers = [derived, qualifiedA, qualifiedB];
const decisionProblem = {
  decisionType: 'IRRIGATION_TIMING',
  usePurpose: 'CORN_IRRIGATION_APPLICABILITY',
  useClass: 'ADVISORY',
  decisionAuthorityMode: 'RUNTIME_ONLY',
  objective: { code: 'AVOID_MATERIAL_CROP_WATER_STRESS' }
};

function build(memberRefs = canonicalMembers, config = {}) {
  return buildKnowledgeRetrievalResult({
    decisionProblemRef,
    decisionProblem,
    deploymentRef,
    runtimeProfileRef,
    knowledgeReleaseRef,
    releaseMemberRefs: memberRefs,
    config
  });
}

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test('multi-member exact-release scan preserves K06 canonical exact-ref order', () => {
  const result = build();
  assert.deepEqual(result.candidateRefs, canonicalMembers);
});

test('multi-member candidate-kind filtering preserves relative canonical order', () => {
  const result = build(canonicalMembers, {
    strategy: 'ALL_RELEASE_MEMBERS_BY_KIND',
    candidateKinds: ['QualifiedKnowledge'],
    contextSummaryMode: 'NONE'
  });
  assert.deepEqual(result.candidateRefs, [qualifiedA, qualifiedB]);
});

test('noncanonical multi-member release input fails instead of creating order-dependent retrieval evidence', () => {
  assert.throws(
    () => build([qualifiedB, derived, qualifiedA]),
    (error) => error?.code === 'NONCANONICAL_RETRIEVAL_CANDIDATES'
  );
});

console.log('Knowledge retrieval multi-member acceptance: 3 passed');
