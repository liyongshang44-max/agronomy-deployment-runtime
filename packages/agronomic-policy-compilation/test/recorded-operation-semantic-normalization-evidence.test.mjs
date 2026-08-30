import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
  AgronomicRecordedOperationSemanticNormalizationCompilationError,
  replayAgronomicRecordedOperationSemanticNormalizationEvidence
} from '../src/index.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';

function ref(kind, logicalId, char) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

const BYTES = Buffer.from(
  [
    'header\n',
    'for op in ["plant_corn", "plant_soy"]:\n',
    '    table4 += source_value(op)\n',
    'other\n',
    '<h3>Cash Crop Planting</h3>\n',
    '<th>Corn</th><th>Soybean</th>\n',
    'tail\n'
  ].join(''),
  'utf8'
);

const SOURCE = {
  ref: ref('Source', 'source.semantic.fixture', 'a'),
  semanticPayload: {}
};

const ARTIFACT = {
  ref: ref('SourceArtifact', 'artifact.semantic.fixture', 'b'),
  semanticPayload: {
    sourceRef: SOURCE.ref,
    contentHash: sourceContentHash(BYTES),
    rightsSnapshot: {
      publicAccess: true,
      license: 'MIT'
    }
  }
};

function rangeOf(text) {
  const start = BYTES.indexOf(Buffer.from(text, 'utf8'));
  assert.ok(start >= 0);
  const endExclusive = start + Buffer.byteLength(text, 'utf8');
  return {
    kind: 'BYTE_RANGE',
    start,
    endExclusive,
    evidenceHash: sourceContentHash(BYTES.subarray(start, endExclusive))
  };
}

function normalization() {
  const codeText = 'for op in ["plant_corn", "plant_soy"]:\n';
  const meaningText =
    '<h3>Cash Crop Planting</h3>\n<th>Corn</th><th>Soybean</th>\n';
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
    normalizationId: 'normalization.fixture.plant-corn',
    parentOccurrenceCompilationRef: ref(
      'AgronomicRecordedOperationOccurrenceCompilation',
      'occurrence.fixture',
      'c'
    ),
    sourceCode: {
      sourceOperationCode: 'plant_corn'
    },
    normalizedOperation: {
      family: 'PLANT',
      subject: { kind: 'CROP', code: 'CORN' }
    },
    semanticEvidence: [
      {
        evidenceRole: 'SOURCE_CODE_NAMESPACE_CONTEXT',
        sourceRef: SOURCE.ref,
        sourceArtifactRef: ARTIFACT.ref,
        sourceArtifactContentHash: ARTIFACT.semanticPayload.contentHash,
        sourceLocator: rangeOf(codeText)
      },
      {
        evidenceRole: 'NORMALIZED_OPERATION_MEANING',
        sourceRef: SOURCE.ref,
        sourceArtifactRef: ARTIFACT.ref,
        sourceArtifactContentHash: ARTIFACT.semanticPayload.contentHash,
        sourceLocator: rangeOf(meaningText)
      }
    ],
    applicability: {
      appliesToOccurrenceSourceRef: ref(
        'Source',
        'source.occurrence.fixture',
        'd'
      ),
      appliesToSourceOperationCode: 'plant_corn'
    },
    transformationRationale:
      'Replay exact semantic evidence only; no interpretation in evidence adapter.'
  };
}

function registry({
  source = SOURCE,
  artifact = ARTIFACT,
  bytes = BYTES
} = {}) {
  return {
    resolveSource(refValue) {
      assert.deepEqual(refValue, source.ref);
      return source;
    },
    resolveArtifact(refValue) {
      assert.deepEqual(refValue, artifact.ref);
      return artifact;
    },
    readArtifactBytes(refValue) {
      assert.deepEqual(refValue, artifact.ref);
      return Buffer.from(bytes);
    }
  };
}

function expectCode(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof
        AgronomicRecordedOperationSemanticNormalizationCompilationError
        && error.code === code
  );
}

test('replays each semantic evidence item from exact retained bytes', () => {
  const replayed =
    replayAgronomicRecordedOperationSemanticNormalizationEvidence({
      sourceRegistry: registry(),
      normalization: normalization()
    });

  assert.deepEqual(
    replayed.map((item) => [item.evidenceRole, item.text]),
    [
      [
        'NORMALIZED_OPERATION_MEANING',
        '<h3>Cash Crop Planting</h3>\n<th>Corn</th><th>Soybean</th>\n'
      ],
      [
        'SOURCE_CODE_NAMESPACE_CONTEXT',
        'for op in ["plant_corn", "plant_soy"]:\n'
      ]
    ]
  );
  assert.ok(replayed.every((item) => item.byteLength > 0));
});

test('caller-supplied evidence hash cannot override exact replay', () => {
  const value = normalization();
  value.semanticEvidence[0].sourceLocator.evidenceHash =
    `sha256:${'f'.repeat(64)}`;

  expectCode(
    () =>
      replayAgronomicRecordedOperationSemanticNormalizationEvidence({
        sourceRegistry: registry(),
        normalization: value
      }),
    'SEMANTIC_NORMALIZATION_EVIDENCE_HASH_MISMATCH'
  );
});

test('SourceArtifact content hash drift fails before semantic interpretation', () => {
  const value = normalization();
  value.semanticEvidence[0].sourceArtifactContentHash =
    `sha256:${'1'.repeat(64)}`;

  expectCode(
    () =>
      replayAgronomicRecordedOperationSemanticNormalizationEvidence({
        sourceRegistry: registry(),
        normalization: value
      }),
    'SEMANTIC_NORMALIZATION_ARTIFACT_CONTENT_HASH_MISMATCH'
  );
});

test('Source and SourceArtifact must close to the same exact source world', () => {
  const otherSource = {
    ref: ref('Source', 'source.other', 'e'),
    semanticPayload: {}
  };
  const artifact = structuredClone(ARTIFACT);
  artifact.semanticPayload.sourceRef = otherSource.ref;

  expectCode(
    () =>
      replayAgronomicRecordedOperationSemanticNormalizationEvidence({
        sourceRegistry: registry({ artifact }),
        normalization: normalization()
      }),
    'SEMANTIC_NORMALIZATION_SOURCE_ARTIFACT_WORLD_MISMATCH'
  );
});

test('range bounds are revalidated against retained bytes', () => {
  const value = normalization();
  value.semanticEvidence[0].sourceLocator.endExclusive = BYTES.length + 1;
  value.semanticEvidence[0].sourceLocator.evidenceHash =
    `sha256:${'2'.repeat(64)}`;

  expectCode(
    () =>
      replayAgronomicRecordedOperationSemanticNormalizationEvidence({
        sourceRegistry: registry(),
        normalization: value
      }),
    'SEMANTIC_NORMALIZATION_BYTE_RANGE_OUT_OF_BOUNDS'
  );
});

test('v1 semantic evidence must be valid UTF-8 text', () => {
  const bytes = Buffer.from(BYTES);
  const value = normalization();
  const item = value.semanticEvidence[0];
  const start = item.sourceLocator.start;
  bytes[start] = 0xff;
  const changedArtifactHash = sourceContentHash(bytes);
  for (const evidenceItem of value.semanticEvidence) {
    evidenceItem.sourceArtifactContentHash = changedArtifactHash;
  }
  item.sourceLocator.evidenceHash = sourceContentHash(
    bytes.subarray(item.sourceLocator.start, item.sourceLocator.endExclusive)
  );
  const artifact = structuredClone(ARTIFACT);
  artifact.semanticPayload.contentHash = changedArtifactHash;

  expectCode(
    () =>
      replayAgronomicRecordedOperationSemanticNormalizationEvidence({
        sourceRegistry: registry({ artifact, bytes }),
        normalization: value
      }),
    'SEMANTIC_NORMALIZATION_EVIDENCE_NOT_UTF8'
  );
});
