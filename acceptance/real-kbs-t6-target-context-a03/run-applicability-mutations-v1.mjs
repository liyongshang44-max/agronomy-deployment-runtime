import assert from 'node:assert/strict';

import { buildApplicabilityAssessment } from '../../packages/applicability/src/index.mjs';
import { buildKbsT6TargetWorld } from './target-world.mjs';

const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'alfalfa' },
  { semanticId: 'site.name', operator: 'EQUALS', value: 'Kellogg Biological Station' },
  { semanticId: 'treatment.name', operator: 'EQUALS', value: 'Main Site Treatment 6' }
]);

const world = buildKbsT6TargetWorld();
const { decision, manifest, validatedDecision, validatedDatums } = world;

function ref(kind, logicalId, fill) {
  return Object.freeze({
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${fill.repeat(64)}`
  });
}

// These refs are deliberately synthetic placeholders because this file exercises only
// the frozen A08 pure predicate engine. The separately qualified positive lane proves
// A05/A08 authority replay with real QualifiedKnowledge and exact A03 snapshots.
const retrievalRef = ref('KnowledgeRetrievalResult', 'retrieval.kbs-t6-mutation-control', '0');
const knowledgeRef = ref('QualifiedKnowledge', 'knowledge.kbs-t6-mutation-control', '1');
const sourceContextRef = ref('SourceContext', 'source-context.kbs-t6-mutation-control', '2');

const mutations = Object.freeze([
  {
    name: 'CROP_DRIFT',
    semanticId: 'crop.code',
    replacement: { type: 'CATEGORY', category: 'switchgrass' }
  },
  {
    name: 'SITE_DRIFT',
    semanticId: 'site.name',
    replacement: { type: 'STRING', string: 'Other Research Site' }
  },
  {
    name: 'TREATMENT_DRIFT',
    semanticId: 'treatment.name',
    replacement: { type: 'STRING', string: 'Main Site Treatment 7' }
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
  assert.equal(otherConditions.length, 2);
  assert.ok(otherConditions.every((condition) => condition.status === 'MATCH'));

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
  milestone: 'REAL_WORLD_HETEROGENEITY_NITROGEN_A08_MUTATION_CONTROLS',
  classification: 'PURE_A08_ENGINE_NEGATIVE_CONTROL_ONLY',
  authorityPublicationClaim: false,
  positiveAuthorityProofProvidedBy: 'run-positive-applicability-v2.mjs',
  mutationCount: results.length,
  mutations: results,
  expectedFailClosedDisposition: {
    transportStatus: 'CONFLICT',
    runtimeUse: 'BLOCKED'
  },
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0
}, null, 2));