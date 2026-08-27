import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
  agronomicConditionalActionRealizationHash,
  normalizeAgronomicConditionalActionRealization,
  normalizeAgronomicConditionalActionRealizationCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const knowledge = ref('QualifiedKnowledge', 'knowledge.conditional-realization', 'a');

function value(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_CONTRACT_VERSION,
    conditionalRealizationId: 'source-proven-conditional-tillage',
    sourceExpression:
      'Plots can be chisel plowed and soil finished if more aggressive tillage is needed.',
    parentRegimenCompilationRef:
      ref('AgronomicActionRegimenCompilation', 'regimen.parent', 'b'),
    parentActionRealizationCompilationRef:
      ref('AgronomicActionRealizationCompilation', 'realization.parent', 'c'),
    targetActionCode: 'TILL',
    compoundRealization: {
      composition: 'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
      components: [
        {
          kind: 'SOURCE_NAMED_METHOD',
          methodCode: 'CHISEL_PLOWING',
          sourceExpression: 'chisel plowed'
        },
        {
          kind: 'EXISTING_SOURCE_METHOD',
          methodCode: 'SOIL_FINISHING',
          sourceExpression: 'soil finished'
        }
      ]
    },
    modalityCompilationRef:
      ref('AgronomicNormativeModalityCompilation', 'modality.if-needed', 'd'),
    sourceCondition: {
      expression: 'more aggressive tillage is needed',
      objectExpression: 'more aggressive tillage'
    },
    authorityBindings: [{
      role: 'SOURCE_CONDITIONAL_ACTION_REALIZATION',
      authorityRef: knowledge,
      rationale: 'Exact source-qualified knowledge establishes the conditional compound realization.'
    }],
    transformationRationale:
      'Preserve source conjunction and condition text without order, runtime predicate, ranking, permission or execution semantics.',
    ...overrides
  };
}

function compilation(conditionalRealization = value(), status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'e')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'f')],
    knowledgeRefs: [knowledge],
    conditionalRealization,
    conditionalRealizationHash:
      agronomicConditionalActionRealizationHash(conditionalRealization),
    semanticReviewRef:
      ref('AgronomicConditionalActionRealizationReviewDecision', 'review.conditional', '1'),
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_TILL',
        'CHISEL_PLOWING',
        'SOIL_FINISHING',
        'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED',
        'IF_NEEDED',
        'SOURCE_CONDITION'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_CONDITIONAL_ELEMENT']
    },
    limitations: ['SOURCE_CONDITION_NOT_RUNTIME_PREDICATE']
  };
}

test('normalizes the source-proven conditional compound realization', () => {
  const normalized = normalizeAgronomicConditionalActionRealization(value());
  assert.equal(normalized.targetActionCode, 'TILL');
  assert.equal(
    normalized.compoundRealization.composition,
    'SOURCE_CONJUNCTION_NO_ORDER_ASSERTED'
  );
  assert.deepEqual(
    normalized.compoundRealization.components.map((item) => item.methodCode).sort(),
    ['CHISEL_PLOWING', 'SOIL_FINISHING']
  );
  assert.deepEqual(normalized.sourceCondition, {
    expression: 'more aggressive tillage is needed',
    objectExpression: 'more aggressive tillage'
  });
});

test('rejects ordered or workflow-like composition', () => {
  for (const composition of [
    'ORDERED_SEQUENCE',
    'BEFORE_AFTER',
    'CHISEL_THEN_FINISH',
    'PARALLEL'
  ]) {
    const candidate = value();
    candidate.compoundRealization.composition = composition;
    assert.throws(
      () => normalizeAgronomicConditionalActionRealization(candidate),
      /SOURCE_CONJUNCTION_NO_ORDER_ASSERTED/
    );
  }
});

test('both source components are mandatory for local completeness', () => {
  for (const methodCode of ['CHISEL_PLOWING', 'SOIL_FINISHING']) {
    const candidate = value();
    candidate.compoundRealization.components =
      candidate.compoundRealization.components.filter(
        (item) => item.methodCode !== methodCode
      );
    assert.throws(
      () => normalizeAgronomicConditionalActionRealization(candidate),
      /requires exactly CHISEL_PLOWING and SOIL_FINISHING/
    );
  }
});

test('rejects component identity or source-expression drift', () => {
  const chisel = value();
  chisel.compoundRealization.components[0].sourceExpression = 'chisel plowing';
  assert.throws(
    () => normalizeAgronomicConditionalActionRealization(chisel),
    /exact accepted component kind and source expression/
  );

  const soil = value();
  soil.compoundRealization.components[1].kind = 'SOURCE_NAMED_METHOD';
  assert.throws(
    () => normalizeAgronomicConditionalActionRealization(soil),
    /exact accepted component kind and source expression/
  );
});

test('rejects condition paraphrase or condition-object drift', () => {
  const condition = value();
  condition.sourceCondition.expression = 'aggressive tillage is necessary';
  assert.throws(
    () => normalizeAgronomicConditionalActionRealization(condition),
    /exact accepted condition and condition-object expressions/
  );

  const object = value();
  object.sourceCondition.objectExpression = 'aggressiveness';
  assert.throws(
    () => normalizeAgronomicConditionalActionRealization(object),
    /exact accepted condition and condition-object expressions/
  );
});

test('rejects permission, runtime predicate, order, ranking and open-class laundering fields', () => {
  const fields = [
    ['force', 'PERMITTED'],
    ['effect', 'PERMITTED'],
    ['semanticId', 'tillage.aggressiveness_need'],
    ['comparator', 'EQUALS'],
    ['value', true],
    ['currentNeed', true],
    ['needThreshold', 0.5],
    ['aggressivenessScore', 3],
    ['aggressivenessRank', 1],
    ['baselineAggressiveness', 2],
    ['before', 'SOIL_FINISHING'],
    ['after', 'CHISEL_PLOWING'],
    ['sequence', ['CHISEL_PLOWING', 'SOIL_FINISHING']],
    ['memberOfParentOpenClass', true],
    ['runtimeEligibility', 'ELIGIBLE'],
    ['availability', 'AVAILABLE'],
    ['equivalence', 'MATERIAL_EQUIVALENT'],
    ['causalEffect', 'PREVENTS_PLANT_ESTABLISHMENT'],
    ['implementationId', 'implement-1'],
    ['outcome', 'PLANT_ESTABLISHMENT_PREVENTED']
  ];
  for (const [field, fieldValue] of fields) {
    const candidate = value();
    candidate[field] = fieldValue;
    assert.throws(
      () => normalizeAgronomicConditionalActionRealization(candidate),
      /not part of the conditional action-realization contract/
    );
  }
});

test('hash fails closed on any decision-material predecessor or source drift', () => {
  const input = compilation();
  normalizeAgronomicConditionalActionRealizationCompilation(input);

  const mutations = [
    (x) => { x.conditionalRealization.sourceExpression = 'different source proposition'; },
    (x) => {
      x.conditionalRealization.parentRegimenCompilationRef.logicalId =
        'different.regimen';
    },
    (x) => {
      x.conditionalRealization.parentActionRealizationCompilationRef.logicalId =
        'different.realization';
    },
    (x) => {
      x.conditionalRealization.modalityCompilationRef.logicalId =
        'different.modality';
    },
    (x) => {
      x.conditionalRealization.sourceCondition.objectExpression =
        'different object';
    }
  ];

  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () => normalizeAgronomicConditionalActionRealizationCompilation(drifted),
      /conditionalRealizationHash|exact accepted condition/
    );
  }
});

test('COMPLETE remains local to the targeted conditional sentence', () => {
  const normalized =
    normalizeAgronomicConditionalActionRealizationCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['RUNTIME_NEED_PREDICATE'];
  assert.throws(
    () => normalizeAgronomicConditionalActionRealizationCompilation(invalid),
    /COMPLETE conditional action-realization coverage/
  );
});
