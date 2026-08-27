import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
  agronomicNormativeModalityHash,
  normalizeAgronomicNormativeModality,
  normalizeAgronomicNormativeModalityCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const knowledge = ref('QualifiedKnowledge', 'knowledge.modality', 'a');

function binding() {
  return {
    role: 'SOURCE_MODALITY',
    authorityRef: knowledge,
    rationale: 'Exact source-qualified knowledge establishes the target modality.'
  };
}

function modality(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_CONTRACT_VERSION,
    modalityId: 'modality.fixture',
    sourceExpression: 'If needed an insecticide application can be used to control aphids.',
    targetScope: 'ACTION',
    force: 'PERMITTED',
    qualifiers: ['IF_NEEDED'],
    authorityBindings: [binding()],
    transformationRationale: 'Preserve source permission and need qualifier as separate non-runtime semantics.',
    ...overrides
  };
}

function compilation(value = modality(), status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'b')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'c')],
    knowledgeRefs: [knowledge],
    modality: value,
    modalityHash: agronomicNormativeModalityHash(value),
    semanticReviewRef: ref('AgronomicNormativeModalityReviewDecision', 'review.modality', 'd'),
    losslessCoverage: {
      status,
      coveredElements: ['FORCE', 'QUALIFIER', 'TARGET_SCOPE'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['UNRESOLVED_MODALITY_ELEMENT']
    },
    limitations: ['SOURCE_MODALITY_NOT_RUNTIME_ELIGIBILITY']
  };
}

test('force and qualifier normalize as independent dimensions', () => {
  const normalized = normalizeAgronomicNormativeModality(modality());
  assert.equal(normalized.force, 'PERMITTED');
  assert.deepEqual(normalized.qualifiers, ['IF_NEEDED']);
  assert.equal(normalized.targetScope, 'ACTION');
  assert.equal(Object.hasOwn(normalized, 'strength'), false);
  assert.equal(Object.hasOwn(normalized, 'runtimeCondition'), false);
  assert.match(agronomicNormativeModalityHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('qualifier-only and force-only source modalities are valid', () => {
  const qualifierOnly = modality({ force: undefined, qualifiers: ['IF_POSSIBLE'], targetScope: 'TIMING_RELATION' });
  const forceOnly = modality({ force: 'SHOULD', qualifiers: [], targetScope: 'PARAMETER_VALUE' });
  assert.equal(Object.hasOwn(normalizeAgronomicNormativeModality(qualifierOnly), 'force'), false);
  assert.deepEqual(normalizeAgronomicNormativeModality(qualifierOnly).qualifiers, ['IF_POSSIBLE']);
  assert.equal(normalizeAgronomicNormativeModality(forceOnly).force, 'SHOULD');
  assert.deepEqual(normalizeAgronomicNormativeModality(forceOnly).qualifiers, []);
});

test('rejects empty, hard, numeric and unknown modality semantics', () => {
  assert.throws(
    () => normalizeAgronomicNormativeModality(modality({ force: undefined, qualifiers: [] })),
    /requires a force/
  );
  assert.throws(
    () => normalizeAgronomicNormativeModality(modality({ force: 'HARD_REQUIRE' })),
    /unsupported normative force/
  );
  assert.throws(
    () => normalizeAgronomicNormativeModality(modality({ force: '5' })),
    /unsupported normative force/
  );
  assert.throws(
    () => normalizeAgronomicNormativeModality(modality({ qualifiers: ['IF_CONVENIENT'] })),
    /unsupported normative qualifier/
  );
  assert.throws(
    () => normalizeAgronomicNormativeModality({ ...modality(), strength: 4 }),
    /not part of the normative modality contract/
  );
});

test('target scope vocabulary remains finite', () => {
  for (const targetScope of ['ACTION', 'TIMING_RELATION', 'PARAMETER_VALUE', 'OCCURRENCE']) {
    assert.equal(normalizeAgronomicNormativeModality(modality({ targetScope })).targetScope, targetScope);
  }
  assert.throws(
    () => normalizeAgronomicNormativeModality(modality({ targetScope: 'WHOLE_POLICY' })),
    /unsupported modality targetScope/
  );
});

test('compilation hash fails closed on semantic drift', () => {
  const input = compilation();
  const normalized = normalizeAgronomicNormativeModalityCompilation(input);
  assert.equal(normalized.modalityHash, input.modalityHash);

  const drifted = structuredClone(input);
  drifted.modality.force = 'SHOULD';
  assert.throws(
    () => normalizeAgronomicNormativeModalityCompilation(drifted),
    /modalityHash/
  );
});

test('coverage is local to the modality authority', () => {
  const incomplete = normalizeAgronomicNormativeModalityCompilation(compilation(modality(), 'INCOMPLETE'));
  assert.equal(incomplete.losslessCoverage.status, 'INCOMPLETE');
  assert.deepEqual(incomplete.losslessCoverage.unrepresentedElements, ['UNRESOLVED_MODALITY_ELEMENT']);

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['WHOLE_STATEMENT_GOAL_CONDITION'];
  assert.throws(
    () => normalizeAgronomicNormativeModalityCompilation(invalid),
    /COMPLETE modality coverage/
  );
});
