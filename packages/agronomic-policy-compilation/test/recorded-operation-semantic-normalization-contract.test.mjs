import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
  agronomicRecordedOperationSemanticNormalizationHash,
  normalizeAgronomicRecordedOperationSemanticNormalization,
  normalizeAgronomicRecordedOperationSemanticNormalizationCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

function evidence(role, char, start, endExclusive) {
  return {
    evidenceRole: role,
    sourceRef: ref('Source', 'source.semantic.sustainable-corn', char),
    sourceArtifactRef: ref(
      'SourceArtifact',
      'artifact.semantic.sustainable-corn.mantable',
      char === 'a' ? 'b' : 'c'
    ),
    sourceArtifactContentHash: `sha256:${(char === 'a' ? 'd' : 'e').repeat(64)}`,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start,
      endExclusive,
      evidenceHash: `sha256:${(char === 'a' ? 'f' : '1').repeat(64)}`
    }
  };
}

function normalization(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
    normalizationId: 'normalization.sustainable-corn.plant-corn',
    parentOccurrenceCompilationRef: ref(
      'AgronomicRecordedOperationOccurrenceCompilation',
      'occurrence.sustainable-corn.serf.2011-05-03.plant-corn',
      '2'
    ),
    sourceCode: {
      sourceOperationCode: 'plant_corn'
    },
    normalizedOperation: {
      family: 'PLANT',
      subject: {
        kind: 'CROP',
        code: 'CORN'
      }
    },
    semanticEvidence: [
      evidence('SOURCE_CODE_NAMESPACE_CONTEXT', 'a', 100, 220),
      evidence('NORMALIZED_OPERATION_MEANING', '3', 500, 880)
    ],
    applicability: {
      appliesToOccurrenceSourceRef: ref(
        'Source',
        'source.sustainable-corn.operations',
        '4'
      ),
      appliesToSourceOperationCode: 'plant_corn'
    },
    transformationRationale:
      'Normalize only the reviewed source-scoped meaning of plant_corn without Policy, runtime, execution, Outcome or target-identity inference.',
    ...overrides
  };
}

function compilation(value = normalization(), status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY',
    normalization: value,
    normalizationHash:
      agronomicRecordedOperationSemanticNormalizationHash(value),
    semanticReviewRef: ref(
      'AgronomicRecordedOperationSemanticNormalizationReviewDecision',
      'review.semantic-normalization.plant-corn',
      '5'
    ),
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SOURCE_OPERATION_CODE',
        'SOURCE_CODE_NAMESPACE_CONTEXT',
        'NORMALIZED_OPERATION_FAMILY',
        'NORMALIZED_OPERATION_SUBJECT_KIND',
        'NORMALIZED_OPERATION_SUBJECT_CODE',
        'SOURCE_CODE_NAMESPACE_APPLICABILITY'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_TARGETED_SEMANTIC_ELEMENT']
    },
    limitations: [
      'NORMALIZATION_NOT_POLICY_ACTION',
      'NORMALIZATION_NOT_RUNTIME_ACTION',
      'NORMALIZATION_NOT_EXECUTION',
      'NORMALIZATION_NOT_OUTCOME',
      'NORMALIZATION_NOT_CONTEXT_STATE',
      'SOURCE_VOCABULARY_NOT_ASSERTED_COMPLETE'
    ]
  };
}

test('normalizes a source-scoped recorded-operation semantic mapping', () => {
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalization(normalization());
  assert.equal(normalized.sourceCode.sourceOperationCode, 'plant_corn');
  assert.deepEqual(normalized.normalizedOperation, {
    family: 'PLANT',
    subject: { kind: 'CROP', code: 'CORN' }
  });
  assert.equal(normalized.semanticEvidence.length, 2);
  assert.deepEqual(
    normalized.semanticEvidence.map((item) => item.evidenceRole),
    ['NORMALIZED_OPERATION_MEANING', 'SOURCE_CODE_NAMESPACE_CONTEXT']
  );
  assert.equal(
    normalized.applicability.appliesToSourceOperationCode,
    'plant_corn'
  );
});

test('requires both generic evidence roles and rejects duplicate roles', () => {
  const missing = normalization();
  missing.semanticEvidence = missing.semanticEvidence.filter(
    (item) => item.evidenceRole !== 'NORMALIZED_OPERATION_MEANING'
  );
  assert.throws(
    () => normalizeAgronomicRecordedOperationSemanticNormalization(missing),
    /must include NORMALIZED_OPERATION_MEANING/
  );

  const duplicate = normalization();
  duplicate.semanticEvidence[1].evidenceRole =
    'SOURCE_CODE_NAMESPACE_CONTEXT';
  assert.throws(
    () => normalizeAgronomicRecordedOperationSemanticNormalization(duplicate),
    /each evidence role at most once/
  );
});

test('v1 accepts only exact BYTE_RANGE semantic evidence', () => {
  const wrongKind = normalization();
  wrongKind.semanticEvidence[0].sourceLocator = {
    kind: 'WHOLE_ARTIFACT',
    start: 0,
    endExclusive: 100,
    evidenceHash: `sha256:${'f'.repeat(64)}`
  };
  assert.throws(
    () => normalizeAgronomicRecordedOperationSemanticNormalization(wrongKind),
    /kind must be BYTE_RANGE/
  );

  const invalidRange = normalization();
  invalidRange.semanticEvidence[0].sourceLocator.start = 220;
  invalidRange.semanticEvidence[0].sourceLocator.endExclusive = 220;
  assert.throws(
    () => normalizeAgronomicRecordedOperationSemanticNormalization(invalidRange),
    /endExclusive must be greater than start/
  );
});

test('normalized family and subject are semantic tokens, not arbitrary text', () => {
  for (const mutate of [
    (x) => { x.normalizedOperation.family = 'plant'; },
    (x) => { x.normalizedOperation.subject.kind = 'crop type'; },
    (x) => { x.normalizedOperation.subject.code = 'Corn'; }
  ]) {
    const value = normalization();
    mutate(value);
    assert.throws(
      () => normalizeAgronomicRecordedOperationSemanticNormalization(value),
      /uppercase semantic token/
    );
  }
});

test('forbidden downstream authority fields cannot be laundered into normalization', () => {
  const fields = [
    ['policyRef', ref('Policy', 'policy.plant', '6')],
    ['actionCode', 'PLANT'],
    ['normativeForce', 'REQUIRE'],
    ['runtimeBindingRef', ref('RuntimeBinding', 'runtime.plant', '7')],
    ['decisionResultRef', ref('DecisionResult', 'decision.plant', '8')],
    ['executionReceiptRef', ref('ExecutionReceipt', 'execution.plant', '9')],
    ['outcomeRef', ref('Outcome', 'outcome.plant', 'a')],
    ['contextDatumRef', ref('ContextDatum', 'context.crop', 'b')],
    ['targetRef', ref('Target', 'field.serf', 'c')],
    ['inverseSourceOperationCode', 'plant_corn'],
    ['sourceVocabularyComplete', true]
  ];

  for (const [field, value] of fields) {
    const candidate = normalization();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicRecordedOperationSemanticNormalization(candidate),
      /not part of the semantic-normalization contract/
    );
  }
});

test('semantic evidence identity participates in normalization hash', () => {
  const input = compilation();
  normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(input);

  const mutations = [
    (x) => {
      x.normalization.parentOccurrenceCompilationRef.semanticHash =
        `sha256:${'d'.repeat(64)}`;
    },
    (x) => {
      x.normalization.sourceCode.sourceOperationCode = 'harvest_corn';
    },
    (x) => {
      x.normalization.normalizedOperation.family = 'HARVEST';
    },
    (x) => {
      x.normalization.normalizedOperation.subject.code = 'SOYBEAN';
    },
    (x) => {
      x.normalization.semanticEvidence[0].sourceLocator.start += 1;
    },
    (x) => {
      x.normalization.semanticEvidence[1].sourceLocator.evidenceHash =
        `sha256:${'e'.repeat(64)}`;
    },
    (x) => {
      x.normalization.applicability.appliesToSourceOperationCode =
        'plant_soy';
    }
  ];

  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () =>
        normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
          drifted
        ),
      /normalizationHash/
    );
  }
});

test('COMPLETE remains local to the targeted normalization only', () => {
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
      compilation()
    );
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.ok(
    normalized.limitations.includes(
      'SOURCE_VOCABULARY_NOT_ASSERTED_COMPLETE'
    )
  );

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = [
    'UNKNOWN_PROVIDER_OPERATION_CODES'
  ];
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
        invalid
      ),
    /COMPLETE normalization coverage/
  );
});
