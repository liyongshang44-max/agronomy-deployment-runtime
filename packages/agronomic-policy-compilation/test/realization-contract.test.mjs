import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
  agronomicActionRealizationHash,
  normalizeAgronomicActionRealization,
  normalizeAgronomicActionRealizationCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const knowledge = ref('QualifiedKnowledge', 'knowledge.realization', 'a');

function realization(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_CONTRACT_VERSION,
    realizationId: 'b21-tillage-realizations',
    sourceExpression: 'Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.',
    parentRegimenCompilationRef: ref('AgronomicActionRegimenCompilation', 'regimen.b21', 'b'),
    targetActionCode: 'TILL',
    realizationSet: {
      closure: 'OPEN_SOURCE_DEFINED',
      alternatives: [
        { kind: 'NAMED_METHOD', methodCode: 'SOIL_FINISHING', sourceExpression: 'soil finishing' },
        { kind: 'NAMED_METHOD', methodCode: 'ROTOTILLING', sourceExpression: 'rototilling' },
        {
          kind: 'SOURCE_DEFINED_OPEN_CLASS',
          classExpression: 'any tillage that keeps plant growth from becoming established',
          membershipCriterionExpression: 'keeps plant growth from becoming established'
        }
      ]
    },
    authorityBindings: [{
      role: 'SOURCE_ACTION_REALIZATION',
      authorityRef: knowledge,
      rationale: 'Exact source-qualified knowledge establishes the action-realization proposition.'
    }],
    transformationRationale: 'Preserve source-open realization semantics without normative force, exclusivity, equivalence, runtime eligibility or causal efficacy.',
    ...overrides
  };
}

function compilation(value = realization(), status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'c')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'd')],
    knowledgeRefs: [knowledge],
    realization: value,
    realizationHash: agronomicActionRealizationHash(value),
    semanticReviewRef: ref('AgronomicActionRealizationReviewDecision', 'review.realization', 'e'),
    losslessCoverage: {
      status,
      coveredElements: ['PARENT_ACTION', 'NAMED_METHODS', 'SOURCE_DEFINED_OPEN_CLASS', 'OPEN_CLOSURE'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_REALIZATION_ELEMENT']
    },
    limitations: ['SOURCE_REALIZATION_NOT_RUNTIME_ALTERNATIVE_SET']
  };
}

test('normalizes source-open source-proven realization set', () => {
  const normalized = normalizeAgronomicActionRealization(realization());
  assert.equal(normalized.targetActionCode, 'TILL');
  assert.equal(normalized.realizationSet.closure, 'OPEN_SOURCE_DEFINED');
  assert.equal(normalized.realizationSet.alternatives.length, 3);
  const named = normalized.realizationSet.alternatives
    .filter((item) => item.kind === 'NAMED_METHOD')
    .map((item) => item.methodCode)
    .sort();
  assert.deepEqual(named, ['ROTOTILLING', 'SOIL_FINISHING']);
  assert.equal(
    normalized.realizationSet.alternatives.filter((item) => item.kind === 'SOURCE_DEFINED_OPEN_CLASS').length,
    1
  );
});

test('rejects CLOSED or incomplete realization universes', () => {
  const closed = realization();
  closed.realizationSet.closure = 'CLOSED';
  assert.throws(() => normalizeAgronomicActionRealization(closed), /OPEN_SOURCE_DEFINED/);

  const missingOpen = realization();
  missingOpen.realizationSet.alternatives = missingOpen.realizationSet.alternatives
    .filter((item) => item.kind !== 'SOURCE_DEFINED_OPEN_CLASS');
  assert.throws(() => normalizeAgronomicActionRealization(missingOpen), /requires exactly SOIL_FINISHING/);
});

test('rejects neighboring CHISEL_PLOW and unaccepted named methods', () => {
  const candidate = realization();
  candidate.realizationSet.alternatives.push({
    kind: 'NAMED_METHOD',
    methodCode: 'CHISEL_PLOW',
    sourceExpression: 'chisel plowed'
  });
  assert.throws(() => normalizeAgronomicActionRealization(candidate), /does not admit named method CHISEL_PLOW/);
});

test('rejects source-expression drift inside named and open-class alternatives', () => {
  const named = realization();
  named.realizationSet.alternatives[0].sourceExpression = 'soil finisher';
  assert.throws(() => normalizeAgronomicActionRealization(named), /exact accepted source expression/);

  const open = realization();
  const target = open.realizationSet.alternatives.find((item) => item.kind === 'SOURCE_DEFINED_OPEN_CLASS');
  target.membershipCriterionExpression = 'prevents plant establishment';
  assert.throws(() => normalizeAgronomicActionRealization(open), /exact accepted source-defined open class/);
});

test('rejects normative, exclusivity, runtime, ranking, equivalence and causal laundering fields', () => {
  const fields = [
    ['force', 'PERMITTED'],
    ['effect', 'PERMITTED'],
    ['exclusive', true],
    ['disjoint', true],
    ['runtimeEligibility', 'ELIGIBLE'],
    ['availability', 'AVAILABLE'],
    ['ranking', 1],
    ['equivalence', 'MATERIAL_EQUIVALENT'],
    ['causalEffect', 'PREVENTS_PLANT_ESTABLISHMENT'],
    ['implementationId', 'implement-1'],
    ['outcome', 'PLANT_ESTABLISHMENT_PREVENTED']
  ];
  for (const [field, value] of fields) {
    const candidate = realization();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicActionRealization(candidate),
      /not part of the action-realization contract/
    );
  }
});

test('hash fails closed on parent, set closure or source realization drift', () => {
  const input = compilation();
  normalizeAgronomicActionRealizationCompilation(input);
  const mutations = [
    (value) => { value.realization.sourceExpression = 'different realization sentence'; },
    (value) => { value.realization.parentRegimenCompilationRef.logicalId = 'different.parent'; },
    (value) => { value.realization.realizationSet.alternatives[0].sourceExpression = 'different'; }
  ];
  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () => normalizeAgronomicActionRealizationCompilation(drifted),
      /realizationHash|exact accepted source expression/
    );
  }
});

test('COMPLETE remains local to the targeted realization sentence', () => {
  const normalized = normalizeAgronomicActionRealizationCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['CONDITIONAL_CHISEL_PLOW_SENTENCE'];
  assert.throws(
    () => normalizeAgronomicActionRealizationCompilation(invalid),
    /COMPLETE action-realization coverage/
  );
});
