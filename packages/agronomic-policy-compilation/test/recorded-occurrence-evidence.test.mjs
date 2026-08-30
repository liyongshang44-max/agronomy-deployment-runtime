import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CONTRACT_VERSION,
  AgronomicRecordedOperationEvidenceError,
  agronomicRecordedOperationEvidenceHash,
  extractAgronomicRecordedOperationXlsxRowEvidence,
  extractAgronomicRecordedOperationJupyterTableRowEvidence
} from '../src/index.mjs';

const XLSX_FIXTURE = Buffer.from(
  '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',
  'base64'
);

const COORDINATES = {
  worksheetName: 'Field Operations',
  rowNumber: 42,
  cells: [
    { role: 'SOURCE_NATIVE_SUBJECT', cellRef: 'A42' },
    { role: 'SOURCE_OPERATION_CODE', cellRef: 'B42' },
    { role: 'TEMPORAL_SUPPORT', cellRef: 'C42' }
  ]
};

test('replays exact OOXML worksheet cells without semantic inference', () => {
  const evidence = extractAgronomicRecordedOperationXlsxRowEvidence({
    bytes: XLSX_FIXTURE,
    coordinates: COORDINATES
  });

  assert.equal(
    evidence.contractVersion,
    AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CONTRACT_VERSION
  );
  assert.equal(evidence.scheme, 'XLSX_WORKSHEET_ROW_V1');
  assert.equal(evidence.worksheetName, 'Field Operations');
  assert.equal(evidence.rowNumber, 42);
  assert.deepEqual(
    evidence.cells.map((cell) => [cell.role, cell.cellRef, cell.resolvedText]),
    [
      ['SOURCE_NATIVE_SUBJECT', 'A42', 'SERF'],
      ['SOURCE_OPERATION_CODE', 'B42', 'plant_corn'],
      ['TEMPORAL_SUPPORT', 'C42', '2011-05-03']
    ]
  );
  assert.ok(
    evidence.cells.every((cell) =>
      cell.cellType === 'INLINE_STRING'
        && cell.rawValue === cell.resolvedText
    )
  );
});

test('row evidence hashing is deterministic over exact extracted evidence', () => {
  const first = extractAgronomicRecordedOperationXlsxRowEvidence({
    bytes: XLSX_FIXTURE,
    coordinates: COORDINATES
  });
  const second = extractAgronomicRecordedOperationXlsxRowEvidence({
    bytes: Buffer.from(XLSX_FIXTURE),
    coordinates: structuredClone(COORDINATES)
  });

  assert.equal(
    agronomicRecordedOperationEvidenceHash(first),
    agronomicRecordedOperationEvidenceHash(second)
  );

  const semanticDrift = structuredClone(first);
  semanticDrift.cells[1].resolvedText = 'harvest_corn';
  assert.notEqual(
    agronomicRecordedOperationEvidenceHash(first),
    agronomicRecordedOperationEvidenceHash(semanticDrift)
  );
});

test('wrong worksheet, row or missing evidence cell fails closed', () => {
  assert.throws(
    () => extractAgronomicRecordedOperationXlsxRowEvidence({
      bytes: XLSX_FIXTURE,
      coordinates: { ...COORDINATES, worksheetName: 'Agronomic' }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'XLSX_WORKSHEET_NOT_FOUND'
  );

  assert.throws(
    () => extractAgronomicRecordedOperationXlsxRowEvidence({
      bytes: XLSX_FIXTURE,
      coordinates: {
        ...COORDINATES,
        rowNumber: 41,
        cells: COORDINATES.cells.map((cell) => ({
          ...cell,
          cellRef: cell.cellRef.replace('42', '41')
        }))
      }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'XLSX_EVIDENCE_CELL_NOT_FOUND'
  );

  assert.throws(
    () => extractAgronomicRecordedOperationXlsxRowEvidence({
      bytes: XLSX_FIXTURE,
      coordinates: {
        ...COORDINATES,
        cells: [
          ...COORDINATES.cells.slice(0, 2),
          { role: 'TEMPORAL_SUPPORT', cellRef: 'D42' }
        ]
      }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'XLSX_EVIDENCE_CELL_NOT_FOUND'
  );
});

test('same-row coordinate consistency fails before ZIP replay', () => {
  assert.throws(
    () => extractAgronomicRecordedOperationXlsxRowEvidence({
      bytes: XLSX_FIXTURE,
      coordinates: {
        ...COORDINATES,
        cells: [
          { role: 'SOURCE_NATIVE_SUBJECT', cellRef: 'A41' },
          ...COORDINATES.cells.slice(1)
        ]
      }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES'
  );
});

test('structurally truncated workbook bytes cannot be replayed as trusted row evidence', () => {
  const truncated = XLSX_FIXTURE.subarray(0, XLSX_FIXTURE.length - 22);

  assert.throws(
    () => extractAgronomicRecordedOperationXlsxRowEvidence({
      bytes: truncated,
      coordinates: COORDINATES
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'INVALID_XLSX_ZIP'
  );
});


const NOTEBOOK_FIXTURE = Buffer.from(JSON.stringify({
  cells: [
    { cell_type: 'markdown', source: ['fixture'] },
    { cell_type: 'code', outputs: [] },
    { cell_type: 'code', outputs: [] },
    {
      cell_type: 'code',
      source: ["df2[['date', 'operation', 'siteid', 'year']]"],
      outputs: [{
        output_type: 'execute_result',
        execution_count: 93,
        data: {
          'text/plain': [
            '           date   operation         siteid  year\n',
            '32   2011-05-03  plant_corn          NWREC  2011\n',
            '33   2011-05-03  plant_corn           SERF  2011\n'
          ]
        },
        metadata: {}
      }]
    }
  ]
}), 'utf8');

const NOTEBOOK_COORDINATES = {
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
};

test('replays an exact persisted notebook table row without global string search', () => {
  const evidence = extractAgronomicRecordedOperationJupyterTableRowEvidence({
    bytes: NOTEBOOK_FIXTURE,
    coordinates: NOTEBOOK_COORDINATES
  });
  assert.equal(evidence.scheme, 'JUPYTER_OUTPUT_TABLE_ROW_V1');
  assert.equal(evidence.cellIndex, 3);
  assert.equal(evidence.outputIndex, 0);
  assert.equal(evidence.headerLineIndex, 0);
  assert.equal(evidence.rowIndex, '33');
  assert.deepEqual(
    evidence.cells.map((cell) => [cell.role, cell.sourceColumn, cell.resolvedText]),
    [
      ['SOURCE_NATIVE_SUBJECT', 'siteid', 'SERF'],
      ['SOURCE_OPERATION_CODE', 'operation', 'plant_corn'],
      ['TEMPORAL_SUPPORT', 'date', '2011-05-03']
    ]
  );
});

test('notebook row replay fails closed on wrong row identity, source column or output coordinate', () => {
  assert.throws(
    () => extractAgronomicRecordedOperationJupyterTableRowEvidence({
      bytes: NOTEBOOK_FIXTURE,
      coordinates: { ...NOTEBOOK_COORDINATES, rowIndex: '999' }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'JUPYTER_ROW_IDENTITY_INVALID'
  );

  assert.throws(
    () => extractAgronomicRecordedOperationJupyterTableRowEvidence({
      bytes: NOTEBOOK_FIXTURE,
      coordinates: {
        ...NOTEBOOK_COORDINATES,
        columns: NOTEBOOK_COORDINATES.columns.map((column) =>
          column.role === 'SOURCE_NATIVE_SUBJECT'
            ? { ...column, name: 'missing_site' }
            : column
        )
      }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'JUPYTER_SOURCE_COLUMN_NOT_FOUND'
  );

  assert.throws(
    () => extractAgronomicRecordedOperationJupyterTableRowEvidence({
      bytes: NOTEBOOK_FIXTURE,
      coordinates: { ...NOTEBOOK_COORDINATES, outputIndex: 1 }
    }),
    (error) =>
      error instanceof AgronomicRecordedOperationEvidenceError
        && error.code === 'JUPYTER_OUTPUT_NOT_FOUND'
  );
});
