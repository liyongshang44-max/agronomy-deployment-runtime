import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  agronomicRecordedOperationOccurrenceHash,
  normalizeAgronomicRecordedOperationOccurrence,
  normalizeAgronomicRecordedOperationOccurrenceCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

function occurrence(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
    occurrenceId: 'occurrence.sustainable-corn.serf.2011-05-03.plant-corn',
    sourceRef: ref('Source', 'source.sustainable-corn-cap', 'a'),
    sourceArtifactRef: ref('SourceArtifact', 'artifact.sustainable-corn-cap.xlsx', 'b'),
    sourceArtifactContentHash: `sha256:${'c'.repeat(64)}`,
    sourceLocator: {
      kind: 'DOCUMENT_COORDINATE',
      scheme: 'XLSX_WORKSHEET_ROW_V1',
      coordinates: {
        worksheetName: 'Field Operations',
        rowNumber: 42,
        cells: [
          { role: 'SOURCE_NATIVE_SUBJECT', cellRef: 'A42' },
          { role: 'SOURCE_OPERATION_CODE', cellRef: 'B42' },
          { role: 'TEMPORAL_SUPPORT', cellRef: 'C42' }
        ]
      },
      evidenceHash: `sha256:${'d'.repeat(64)}`
    },
    recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    occurrenceSemantics: {
      occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE',
      sourceOperationCode: 'plant_corn',
      normalizedOperation: {
        actionCode: 'PLANT',
        subject: {
          kind: 'CROP',
          code: 'CORN'
        }
      },
      sourceNativeSubject: {
        identifiers: [
          { name: 'siteId', value: 'SERF' }
        ]
      },
      temporalSupport: {
        kind: 'CALENDAR_DATE',
        date: '2011-05-03',
        precision: 'DAY'
      }
    },
    transformationRationale:
      'Preserve the positive source-recorded operation without inventing ADR execution, target identity or timestamp precision.',
    ...overrides
  };
}

function compilation(value = occurrence(), status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
    sourceArtifactRefs: [value.sourceArtifactRef],
    sourceRoleAuthorityRefs: [],
    occurrence: value,
    occurrenceHash: agronomicRecordedOperationOccurrenceHash(value),
    semanticReviewRef: ref(
      'AgronomicRecordedOperationOccurrenceReviewDecision',
      'review.recorded-occurrence',
      'e'
    ),
    losslessCoverage: {
      status,
      coveredElements: [
        'SOURCE',
        'SOURCE_ARTIFACT',
        'SOURCE_LOCATOR',
        'SOURCE_OPERATION_CODE',
        'SOURCE_NATIVE_SUBJECT',
        'TEMPORAL_SUPPORT'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_LOCAL_OCCURRENCE_ELEMENT']
    },
    limitations: [
      'RECORDED_OCCURRENCE_NOT_ADR_EXECUTION',
      'RECORDED_OCCURRENCE_NOT_OUTCOME',
      'SOURCE_NOT_ASSERTED_COMPLETE'
    ]
  };
}

test('normalizes a positive source-recorded operation occurrence without target synthesis', () => {
  const normalized = normalizeAgronomicRecordedOperationOccurrence(occurrence());
  assert.equal(normalized.recordSemanticRole, 'ACTUAL_FIELD_OPERATION_RECORD');
  assert.equal(
    normalized.occurrenceSemantics.occurrenceClass,
    'SOURCE_RECORDED_OPERATION_OCCURRENCE'
  );
  assert.equal(normalized.occurrenceSemantics.sourceOperationCode, 'plant_corn');
  assert.equal(normalized.occurrenceSemantics.sourceNativeSubject.identifiers[0].value, 'SERF');
  assert.deepEqual(normalized.occurrenceSemantics.temporalSupport, {
    kind: 'CALENDAR_DATE',
    date: '2011-05-03',
    precision: 'DAY'
  });
  assert.equal(normalized.occurrenceSemantics.normalizedOperation.actionCode, 'PLANT');
  assert.equal(normalized.sourceLocator.coordinates.worksheetName, 'Field Operations');
});

test('normalized operation is optional and source-native operation remains mandatory', () => {
  const value = occurrence();
  delete value.occurrenceSemantics.normalizedOperation;
  const normalized = normalizeAgronomicRecordedOperationOccurrence(value);
  assert.equal(normalized.occurrenceSemantics.sourceOperationCode, 'plant_corn');
  assert.equal(normalized.occurrenceSemantics.normalizedOperation, undefined);

  const missing = occurrence();
  delete missing.occurrenceSemantics.sourceOperationCode;
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(missing),
    /sourceOperationCode must be a non-empty string/
  );
});

test('day precision remains a calendar date and rejects fabricated or invalid timestamps', () => {
  for (const invalidDate of [
    '2011-05-03T00:00:00.000Z',
    '2011-02-29',
    '2011-13-01',
    'May 3 2011'
  ]) {
    const value = occurrence();
    value.occurrenceSemantics.temporalSupport.date = invalidDate;
    assert.throws(
      () => normalizeAgronomicRecordedOperationOccurrence(value),
      /calendar date|YYYY-MM-DD/
    );
  }

  const timestampField = occurrence();
  timestampField.occurrenceSemantics.temporalSupport.timestamp =
    '2011-05-03T00:00:00.000Z';
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(timestampField),
    /timestamp is not part of the recorded-operation-occurrence contract/
  );
});

test('source-native identifiers do not become ADR target identity', () => {
  const normalized = normalizeAgronomicRecordedOperationOccurrence(occurrence());
  assert.deepEqual(normalized.occurrenceSemantics.sourceNativeSubject.identifiers, [
    { name: 'siteId', value: 'SERF' }
  ]);

  for (const [field, value] of [
    ['targetRef', ref('Target', 'field.serf', 'f')],
    ['fieldId', 'field-serf'],
    ['tenantId', 'tenant-a'],
    ['contextDatumRef', ref('ContextDatum', 'context.planting', '1')]
  ]) {
    const candidate = occurrence();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicRecordedOperationOccurrence(candidate),
      /not part of the recorded-operation-occurrence contract/
    );
  }
});

test('rejects normative, runtime, execution, Outcome and negative-occurrence laundering fields', () => {
  const fields = [
    ['normativeForce', 'REQUIRE'],
    ['policyRef', ref('Policy', 'policy.plant', '2')],
    ['runtimeBindingRef', ref('RuntimeBinding', 'binding.plant', '3')],
    ['decisionResultRef', ref('DecisionResult', 'decision.plant', '4')],
    ['executionReceiptRef', ref('ExecutionReceipt', 'execution.plant', '5')],
    ['outcomeRef', ref('Outcome', 'outcome.plant', '6')],
    ['nonOccurrence', true],
    ['absenceMeansNonOccurrence', true],
    ['recordComplete', true],
    ['planAdherence', 'LATE']
  ];
  for (const [field, value] of fields) {
    const candidate = occurrence();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicRecordedOperationOccurrence(candidate),
      /not part of the recorded-operation-occurrence contract/
    );
  }
});

test('XLSX locator requires same-row subject, operation and temporal evidence cells', () => {
  const wrongRow = occurrence();
  wrongRow.sourceLocator.coordinates.cells[0].cellRef = 'A41';
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(wrongRow),
    /declared rowNumber 42/
  );

  const missingRole = occurrence();
  missingRole.sourceLocator.coordinates.cells =
    missingRole.sourceLocator.coordinates.cells.filter(
      (cell) => cell.role !== 'TEMPORAL_SUPPORT'
    );
  missingRole.sourceLocator.coordinates.cells.push({
    role: 'SOURCE_RECORD_ID',
    cellRef: 'D42'
  });
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(missingRole),
    /must include TEMPORAL_SUPPORT/
  );

  const duplicateRef = occurrence();
  duplicateRef.sourceLocator.coordinates.cells[2].cellRef = 'B42';
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(duplicateRef),
    /cell roles and cell refs must be unique/
  );
});

test('occurrence hash closes source, artifact, locator and semantic drift', () => {
  const input = compilation();
  normalizeAgronomicRecordedOperationOccurrenceCompilation(input);

  const mutations = [
    (x) => { x.occurrence.sourceArtifactContentHash = `sha256:${'9'.repeat(64)}`; },
    (x) => {
      x.occurrence.sourceLocator.coordinates.rowNumber = 43;
      x.occurrence.sourceLocator.coordinates.cells =
        x.occurrence.sourceLocator.coordinates.cells.map((cell) => ({
          ...cell,
          cellRef: cell.cellRef.replace('42', '43')
        }));
    },
    (x) => { x.occurrence.occurrenceSemantics.sourceOperationCode = 'harvest_corn'; },
    (x) => {
      x.occurrence.occurrenceSemantics.sourceNativeSubject.identifiers[0].value = 'KELLOGG';
    },
    (x) => { x.occurrence.occurrenceSemantics.temporalSupport.date = '2011-05-04'; }
  ];

  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () => normalizeAgronomicRecordedOperationOccurrenceCompilation(drifted),
      /occurrenceHash/
    );
  }
});

test('compilation must declare the exact occurrence SourceArtifact', () => {
  const input = compilation();
  input.sourceArtifactRefs = [
    ref('SourceArtifact', 'artifact.other.xlsx', '9')
  ];
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrenceCompilation(input),
    /must contain the exact occurrence SourceArtifact/
  );
});

test('COMPLETE remains local to one recorded occurrence, not source completeness', () => {
  const normalized =
    normalizeAgronomicRecordedOperationOccurrenceCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');
  assert.ok(normalized.limitations.includes('SOURCE_NOT_ASSERTED_COMPLETE'));

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['UNKNOWN_OTHER_FIELD_OPERATIONS'];
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrenceCompilation(invalid),
    /COMPLETE occurrence coverage/
  );
});


test('normalizes exact persisted notebook table-row coordinates', () => {
  const value = occurrence();
  value.sourceLocator = {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
    coordinates: {
      cellIndex: 3,
      outputIndex: 0,
      mimeType: 'text/plain',
      headerLineIndex: 0,
      rowIndex: '33',
      columns: [
        { role: 'SOURCE_NATIVE_SUBJECT', name: 'siteid' },
        { role: 'SOURCE_OPERATION_CODE', name: 'operation' },
        { role: 'TEMPORAL_SUPPORT', name: 'date' }
      ]
    },
    evidenceHash: `sha256:${'d'.repeat(64)}`
  };
  const normalized = normalizeAgronomicRecordedOperationOccurrence(value);
  assert.equal(normalized.sourceLocator.scheme, 'JUPYTER_OUTPUT_TABLE_ROW_V1');
  assert.equal(normalized.sourceLocator.coordinates.cellIndex, 3);
  assert.equal(normalized.sourceLocator.coordinates.outputIndex, 0);
  assert.equal(normalized.sourceLocator.coordinates.headerLineIndex, 0);
  assert.equal(normalized.sourceLocator.coordinates.rowIndex, '33');
  assert.deepEqual(
    normalized.sourceLocator.coordinates.columns.map((column) => [column.role, column.name]),
    [
      ['SOURCE_NATIVE_SUBJECT', 'siteid'],
      ['SOURCE_OPERATION_CODE', 'operation'],
      ['TEMPORAL_SUPPORT', 'date']
    ]
  );
});

test('notebook locator fails closed on implicit header, unsupported MIME or duplicate columns', () => {
  const base = occurrence();
  base.sourceLocator = {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
    coordinates: {
      cellIndex: 3,
      outputIndex: 0,
      mimeType: 'text/plain',
      headerLineIndex: 0,
      rowIndex: '33',
      columns: [
        { role: 'SOURCE_NATIVE_SUBJECT', name: 'siteid' },
        { role: 'SOURCE_OPERATION_CODE', name: 'operation' },
        { role: 'TEMPORAL_SUPPORT', name: 'date' }
      ]
    },
    evidenceHash: `sha256:${'d'.repeat(64)}`
  };

  const missingHeader = structuredClone(base);
  delete missingHeader.sourceLocator.coordinates.headerLineIndex;
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(missingHeader),
    /headerLineIndex must be a non-negative safe integer/
  );

  const html = structuredClone(base);
  html.sourceLocator.coordinates.mimeType = 'text/html';
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(html),
    /supports only text\/plain/
  );

  const duplicate = structuredClone(base);
  duplicate.sourceLocator.coordinates.columns[2].name = 'operation';
  assert.throws(
    () => normalizeAgronomicRecordedOperationOccurrence(duplicate),
    /roles and source column names must be unique/
  );
});
