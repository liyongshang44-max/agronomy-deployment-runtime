import assert from 'node:assert/strict';

import { buildApplicabilityAssessment } from '../../packages/applicability/src/index.mjs';
import { buildKbsRgeIrrigationTargetWorld } from './target-world.mjs';

const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
  { semanticId: 'experiment.name', operator: 'EQUALS', value: 'Resource Gradient Experiment (N-rate Study)' }
]);

const world = buildKbsRgeIrrigationTargetWorld();
const { decision, manifest, validatedDecision, validatedDatums } = world;

function ref(kind, logicalId, fill) {
  return Object.freeze({
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${fill.repeat(64)}`
  });
}

// These refs are synthetic placeholders because this file exercises only the frozen
// A08 pure predicate engine. The separate runtime-composition lane proves authority
// replay with real QualifiedKnowledge and exact A03 target snapshots.
const retrievalRef = ref('KnowledgeRetrievalResult', 'retrieval.kbs-rge-mutation-control', '0');
const knowledgeRef = ref('QualifiedKnowledge', 'knowledge.kbs-rge-mutation-control', '1');
const sourceContextRef = ref('SourceContext', 'source-context.kbs-rge-mutation-control', '2');

const mutations = Object.freeze([
  {
    name: 'CROP_DRIFT',
    semanticId: 'crop.code',
    replacement: { type: 'CATEGORY', category: 'corn' }
  },
  {
    name: 'EXPERIMENT_DRIFT',
    semanticId: 'experiment.name',
    replacement: { type: 'STRING', string: 'Other Experiment' }
  }
]);

const results = [];
for (const mutation of mutations) {
  const datums = validatedDatums.map((validated) => ({
    semanticPayload: {
      ...validated.semanticPayload,
      value: validated.semanticPayload.semanticId === mutation.semanticId
        ? mutation.replacement
        : validated.semanticPayload.value
    }
  }));

  const assessment = buildApplicabilityAssessment({
    knowledgeRetrievalResultRef: retrievalRef,
    knowledgeRef,
    knowledgeOriginContextRefs: [sourceContextRef],
    contextManifestRef: manifest.ref,
    decisionProblemRef: decision.ref,
    decisionProblem: validatedDecision.semanticPayload,
    manifestAuthority: { datums },
    scientificUseStatus: 'QUALIFIED',
    semanticPreconditions: EXPECTED_PRECONDITIONS,
    effectModifiers: [],
    transportConstraints: [],
    limitations: [],
    unresolvedContextHeterogeneity: []
  });

  assert.equal(assessment.transportStatus, 'CONFLICT');
  assert.equal(assessment.runtimeUse, 'BLOCKED');
  assert.deepEqual(assessment.missingContextSemanticIds, []);
  assert.equal(assessment.conflicts.length, 1);
  assert.equal(assessment.conflicts[0].code, 'SEMANTIC_PRECONDITION_MISMATCH');
  assert.equal(assessment.conflicts[0].semanticId, mutation.semanticId);

  const mutatedCondition = assessment.conditionResults.find(
    (condition) => condition.semanticId === mutation.semanticId
  );
  assert.ok(mutatedCondition);
  assert.equal(mutatedCondition.status, 'MISMATCH');
  assert.equal(mutatedCondition.disposition, 'CONFLICT');

  const otherConditions = assessment.conditionResults.filter(
    (condition) => condition.semanticId !== mutation.semanticId
  );
  assert.equal(otherConditions.length, 1);
  assert.equal(otherConditions[0].status, 'MATCH');
  assert.equal(otherConditions[0].disposition, 'MATCH');

  results.push({
    mutation: mutation.name,
    semanticId: mutation.semanticId,
    transportStatus: assessment.transportStatus,
    runtimeUse: assessment.runtimeUse,
    conflictCode: assessment.conflicts[0].code
  });
}

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_IRRIGATION_A08_MUTATION_CONTROLS',
  classification: 'PURE_A08_ENGINE_NEGATIVE_CONTROL_ONLY',
  authorityPublicationClaim: false,
  positiveAuthorityProofProvidedBy: 'run-runtime-composition-v1.mjs',
  mutationCount: results.length,
  mutations: results,
  expectedFailClosedDisposition: {
    transportStatus: 'CONFLICT',
    runtimeUse: 'BLOCKED'
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0
}, null, 2));
