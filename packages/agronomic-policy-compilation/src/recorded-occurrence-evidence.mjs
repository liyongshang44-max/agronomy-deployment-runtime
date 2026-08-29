import { inflateRawSync } from 'node:zlib';

import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeAgronomicRecordedOperationOccurrence } from './recorded-occurrence-contract.mjs';

export const AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-evidence.v1';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 0xffff + 22;
const CELL_REF_RE = /^[A-Z]+[1-9][0-9]*$/;

export class AgronomicRecordedOperationEvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicRecordedOperationEvidenceError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_RECORDED_OPERATION_EVIDENCE_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new AgronomicRecordedOperationEvidenceError(
    'EXACT_RECORDED_OPERATION_ARTIFACT_BYTES_REQUIRED',
    'XLSX replay requires exact Buffer/Uint8Array SourceArtifact bytes'
  );
}

function readUInt16(bytes, offset, name) {
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `${name} exceeds XLSX byte bounds`
    );
  }
  return bytes.readUInt16LE(offset);
}

function readUInt32(bytes, offset, name) {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `${name} exceeds XLSX byte bounds`
    );
  }
  return bytes.readUInt32LE(offset);
}

function locateEndOfCentralDirectory(bytes) {
  const start = Math.max(0, bytes.length - MAX_EOCD_SEARCH);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (readUInt32(bytes, offset, 'EOCD signature') === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new AgronomicRecordedOperationEvidenceError(
    'INVALID_XLSX_ZIP',
    'XLSX ZIP end-of-central-directory record was not found'
  );
}

function normalizeZipPath(value) {
  const path = requiredText(value, 'ZIP entry name').replaceAll('\\', '/');
  if (path.startsWith('/') || path.split('/').some((part) => part === '..')) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP_PATH',
      `unsafe XLSX ZIP entry path ${path}`
    );
  }
  return path.replace(/^\.\//, '');
}

function parseZipDirectory(input) {
  const bytes = exactBytes(input);
  const eocd = locateEndOfCentralDirectory(bytes);
  const diskNumber = readUInt16(bytes, eocd + 4, 'EOCD disk number');
  const centralDisk = readUInt16(bytes, eocd + 6, 'EOCD central disk');
  const entriesOnDisk = readUInt16(bytes, eocd + 8, 'EOCD entries on disk');
  const entryCount = readUInt16(bytes, eocd + 10, 'EOCD entry count');
  const centralSize = readUInt32(bytes, eocd + 12, 'EOCD central size');
  const centralOffset = readUInt32(bytes, eocd + 16, 'EOCD central offset');

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new AgronomicRecordedOperationEvidenceError(
      'UNSUPPORTED_XLSX_ZIP',
      'multi-disk XLSX ZIP archives are not supported'
    );
  }
  if (centralOffset + centralSize > bytes.length) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      'XLSX central directory exceeds byte bounds'
    );
  }

  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(bytes, offset, 'central entry signature') !== CENTRAL_SIGNATURE) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_ZIP',
        `invalid central-directory signature at entry ${index}`
      );
    }
    const flags = readUInt16(bytes, offset + 8, 'central flags');
    const method = readUInt16(bytes, offset + 10, 'central compression method');
    const compressedSize = readUInt32(bytes, offset + 20, 'central compressed size');
    const uncompressedSize = readUInt32(bytes, offset + 24, 'central uncompressed size');
    const fileNameLength = readUInt16(bytes, offset + 28, 'central filename length');
    const extraLength = readUInt16(bytes, offset + 30, 'central extra length');
    const commentLength = readUInt16(bytes, offset + 32, 'central comment length');
    const localOffset = readUInt32(bytes, offset + 42, 'central local header offset');
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > bytes.length) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_ZIP',
        'XLSX ZIP filename exceeds byte bounds'
      );
    }
    const name = normalizeZipPath(bytes.subarray(nameStart, nameEnd).toString('utf8'));
    if ((flags & 0x1) !== 0) {
      throw new AgronomicRecordedOperationEvidenceError(
        'UNSUPPORTED_XLSX_ZIP',
        `encrypted XLSX ZIP entry is not supported: ${name}`
      );
    }
    if (entries.has(name)) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_ZIP',
        `duplicate XLSX ZIP entry ${name}`
      );
    }
    entries.set(name, {
      name,
      method,
      compressedSize,
      uncompressedSize,
      localOffset
    });
    offset = nameEnd + extraLength + commentLength;
  }

  if (offset !== centralOffset + centralSize) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      'XLSX ZIP central-directory size does not match parsed entries'
    );
  }
  return { bytes, entries };
}

function readZipEntry(zip, name) {
  const normalizedName = normalizeZipPath(name);
  const entry = zip.entries.get(normalizedName);
  if (!entry) {
    throw new AgronomicRecordedOperationEvidenceError(
      'XLSX_PART_NOT_FOUND',
      `required XLSX part ${normalizedName} was not found`
    );
  }
  const { bytes } = zip;
  const offset = entry.localOffset;
  if (readUInt32(bytes, offset, 'local header signature') !== LOCAL_SIGNATURE) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `invalid local header for ${normalizedName}`
    );
  }
  const localMethod = readUInt16(bytes, offset + 8, 'local compression method');
  const fileNameLength = readUInt16(bytes, offset + 26, 'local filename length');
  const extraLength = readUInt16(bytes, offset + 28, 'local extra length');
  if (localMethod !== entry.method) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `compression method mismatch for ${normalizedName}`
    );
  }
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `compressed data exceeds XLSX byte bounds for ${normalizedName}`
    );
  }
  const compressed = bytes.subarray(dataStart, dataEnd);
  let output;
  if (entry.method === 0) {
    output = Buffer.from(compressed);
  } else if (entry.method === 8) {
    try {
      output = inflateRawSync(compressed);
    } catch (error) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_ZIP',
        `DEFLATE replay failed for ${normalizedName}: ${error?.message ?? 'inflate failure'}`
      );
    }
  } else {
    throw new AgronomicRecordedOperationEvidenceError(
      'UNSUPPORTED_XLSX_ZIP',
      `unsupported XLSX ZIP compression method ${entry.method} for ${normalizedName}`
    );
  }
  if (output.length !== entry.uncompressedSize) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_ZIP',
      `uncompressed size mismatch for ${normalizedName}`
    );
  }
  return output;
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^$()|[\]{}]/g, '\\$&');
}

function xmlAttribute(tag, name) {
  const escaped = escapeRegexLiteral(name);
  const match = tag.match(new RegExp(`(?:^|\\s)${escaped}=(["'])(.*?)\\1`));
  return match ? decodeXml(match[2]) : undefined;
}

function xmlTextValues(xml, tagName) {
  const escaped = escapeRegexLiteral(tagName);
  return [...xml.matchAll(
    new RegExp(
      `<(?:[A-Za-z0-9_]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${escaped}>`,
      'g'
    )
  )].map((match) => decodeXml(match[1].replace(/<[^>]+>/g, '')));
}

function workbookSheetTarget(zip, worksheetName) {
  const workbook = readZipEntry(zip, 'xl/workbook.xml').toString('utf8');
  const sheetTags = [...workbook.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b[^>]*>/g)]
    .map((match) => match[0]);
  const sheet = sheetTags.find((tag) => xmlAttribute(tag, 'name') === worksheetName);
  if (!sheet) {
    throw new AgronomicRecordedOperationEvidenceError(
      'XLSX_WORKSHEET_NOT_FOUND',
      `worksheet ${worksheetName} was not found in exact workbook bytes`
    );
  }
  const relationshipId = xmlAttribute(sheet, 'r:id');
  if (!relationshipId) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_WORKBOOK',
      `worksheet ${worksheetName} has no relationship id`
    );
  }

  const rels = readZipEntry(zip, 'xl/_rels/workbook.xml.rels').toString('utf8');
  const relationTags = [...rels.matchAll(
    /<(?:[A-Za-z0-9_]+:)?Relationship\b[^>]*\/?\s*>/g
  )].map((match) => match[0]);
  const relation = relationTags.find((tag) => xmlAttribute(tag, 'Id') === relationshipId);
  if (!relation) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_XLSX_WORKBOOK',
      `worksheet relationship ${relationshipId} was not found`
    );
  }
  const target = requiredText(
    xmlAttribute(relation, 'Target'),
    'worksheet relationship Target'
  );
  if (/^[a-z]+:/i.test(target)) {
    throw new AgronomicRecordedOperationEvidenceError(
      'UNSUPPORTED_XLSX_EXTERNAL_RELATIONSHIP',
      'external worksheet relationships are not accepted for occurrence evidence'
    );
  }
  if (target.startsWith('/')) return normalizeZipPath(target.slice(1));
  return normalizeZipPath(`xl/${target}`);
}

function sharedStrings(zip) {
  if (!zip.entries.has('xl/sharedStrings.xml')) return [];
  const xml = readZipEntry(zip, 'xl/sharedStrings.xml').toString('utf8');
  const values = [];
  for (const match of xml.matchAll(
    /<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g
  )) {
    values.push(xmlTextValues(match[1], 't').join(''));
  }
  return values;
}

function sheetCellMap(xml) {
  const map = new Map();
  const cellPattern =
    /<(?:[A-Za-z0-9_]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>/g;
  for (const match of xml.matchAll(cellPattern)) {
    const tag = `c ${match[1]}`;
    const cellRef = xmlAttribute(tag, 'r');
    if (!cellRef || !CELL_REF_RE.test(cellRef)) continue;
    if (map.has(cellRef)) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_WORKSHEET',
        `duplicate cell ${cellRef} in worksheet XML`
      );
    }
    map.set(cellRef, {
      type: xmlAttribute(tag, 't') ?? 'n',
      body: match[2]
    });
  }
  return map;
}

function resolveCell(cell, strings, cellRef) {
  const formula = xmlTextValues(cell.body, 'f')[0];
  const rawValue = xmlTextValues(cell.body, 'v')[0];
  const inlineText = xmlTextValues(cell.body, 't').join('');

  if (cell.type === 'inlineStr') {
    if (inlineText.length === 0) {
      throw new AgronomicRecordedOperationEvidenceError(
        'XLSX_EVIDENCE_CELL_EMPTY',
        `evidence cell ${cellRef} is empty`
      );
    }
    return {
      cellType: formula ? 'FORMULA_INLINE_STRING' : 'INLINE_STRING',
      rawValue: inlineText,
      resolvedText: inlineText
    };
  }

  if (cell.type === 's') {
    if (rawValue === undefined || !/^[0-9]+$/.test(rawValue)) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_SHARED_STRING',
        `evidence cell ${cellRef} has invalid shared-string index`
      );
    }
    const index = Number(rawValue);
    if (!Number.isSafeInteger(index) || index < 0 || index >= strings.length) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_SHARED_STRING',
        `evidence cell ${cellRef} shared-string index is out of bounds`
      );
    }
    return {
      cellType: formula ? 'FORMULA_SHARED_STRING' : 'SHARED_STRING',
      rawValue,
      resolvedText: strings[index]
    };
  }

  if (cell.type === 'str') {
    if (rawValue === undefined) {
      throw new AgronomicRecordedOperationEvidenceError(
        'XLSX_EVIDENCE_CELL_EMPTY',
        `evidence cell ${cellRef} is empty`
      );
    }
    return {
      cellType: formula ? 'FORMULA_STRING' : 'STRING',
      rawValue,
      resolvedText: rawValue
    };
  }

  if (cell.type === 'b') {
    if (!['0', '1'].includes(rawValue)) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_XLSX_BOOLEAN',
        `evidence cell ${cellRef} has invalid boolean value`
      );
    }
    return {
      cellType: formula ? 'FORMULA_BOOLEAN' : 'BOOLEAN',
      rawValue,
      resolvedText: rawValue === '1' ? 'TRUE' : 'FALSE'
    };
  }

  if (cell.type === 'e') {
    throw new AgronomicRecordedOperationEvidenceError(
      'XLSX_EVIDENCE_CELL_ERROR',
      `evidence cell ${cellRef} contains spreadsheet error ${rawValue ?? 'UNKNOWN'}`
    );
  }

  if (rawValue === undefined || rawValue.length === 0) {
    throw new AgronomicRecordedOperationEvidenceError(
      'XLSX_EVIDENCE_CELL_EMPTY',
      `evidence cell ${cellRef} is empty`
    );
  }

  return {
    cellType: formula ? 'FORMULA_CACHED_SCALAR' : 'SCALAR',
    rawValue,
    resolvedText: rawValue
  };
}

function normalizeCoordinates(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
      'XLSX coordinates must be an object'
    );
  }
  const worksheetName = requiredText(value.worksheetName, 'coordinates.worksheetName');
  if (!Number.isSafeInteger(value.rowNumber) || value.rowNumber <= 0) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
      'coordinates.rowNumber must be a positive safe integer'
    );
  }
  if (!Array.isArray(value.cells) || value.cells.length === 0) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
      'coordinates.cells must be a non-empty array'
    );
  }
  const cells = value.cells.map((cell, index) => {
    const role = requiredText(cell?.role, `coordinates.cells[${index}].role`);
    const cellRef = requiredText(cell?.cellRef, `coordinates.cells[${index}].cellRef`);
    if (!CELL_REF_RE.test(cellRef)) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
        `coordinates.cells[${index}].cellRef must be an uppercase A1 reference`
      );
    }
    const row = Number(cellRef.match(/[1-9][0-9]*$/)[0]);
    if (row !== value.rowNumber) {
      throw new AgronomicRecordedOperationEvidenceError(
        'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
        `${cellRef} is not on declared row ${value.rowNumber}`
      );
    }
    return { role, cellRef };
  });
  if (new Set(cells.map((cell) => cell.role)).size !== cells.length
    || new Set(cells.map((cell) => cell.cellRef)).size !== cells.length) {
    throw new AgronomicRecordedOperationEvidenceError(
      'INVALID_RECORDED_OPERATION_EVIDENCE_COORDINATES',
      'XLSX evidence roles and cell refs must be unique'
    );
  }
  return deepFreeze({
    worksheetName,
    rowNumber: value.rowNumber,
    cells: deepFreeze([...cells].sort((a, b) => a.role.localeCompare(b.role)))
  });
}

export function extractAgronomicRecordedOperationXlsxRowEvidence({
  bytes,
  coordinates
}) {
  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const zip = parseZipDirectory(bytes);
  const worksheetPart = workbookSheetTarget(
    zip,
    normalizedCoordinates.worksheetName
  );
  const worksheetXml = readZipEntry(zip, worksheetPart).toString('utf8');
  const cells = sheetCellMap(worksheetXml);
  const strings = sharedStrings(zip);

  const evidenceCells = normalizedCoordinates.cells.map(({ role, cellRef }) => {
    const cell = cells.get(cellRef);
    if (!cell) {
      throw new AgronomicRecordedOperationEvidenceError(
        'XLSX_EVIDENCE_CELL_NOT_FOUND',
        `required evidence cell ${cellRef} was not found in ${normalizedCoordinates.worksheetName}`
      );
    }
    return deepFreeze({
      role,
      cellRef,
      ...resolveCell(cell, strings, cellRef)
    });
  });

  return deepFreeze({
    contractVersion: AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CONTRACT_VERSION,
    scheme: 'XLSX_WORKSHEET_ROW_V1',
    worksheetName: normalizedCoordinates.worksheetName,
    rowNumber: normalizedCoordinates.rowNumber,
    cells: deepFreeze(evidenceCells)
  });
}

export function agronomicRecordedOperationEvidenceHash(evidence) {
  return semanticHash('AgronomicRecordedOperationEvidence', evidence);
}

export function replayAgronomicRecordedOperationEvidence({
  sourceRegistry,
  occurrence
}) {
  if (!sourceRegistry
    || typeof sourceRegistry.resolveArtifact !== 'function'
    || typeof sourceRegistry.resolveSource !== 'function'
    || typeof sourceRegistry.readArtifactBytes !== 'function') {
    throw new AgronomicRecordedOperationEvidenceError(
      'SOURCE_REGISTRY_REQUIRED_FOR_RECORDED_OPERATION_REPLAY',
      'recorded-operation evidence replay requires SourceRegistry exact-artifact access'
    );
  }

  const normalized = normalizeAgronomicRecordedOperationOccurrence(occurrence);
  const artifact = sourceRegistry.resolveArtifact(normalized.sourceArtifactRef);
  const source = sourceRegistry.resolveSource(normalized.sourceRef);

  if (artifact.semanticPayload?.contentHash !== normalized.sourceArtifactContentHash) {
    throw new AgronomicRecordedOperationEvidenceError(
      'RECORDED_OPERATION_SOURCE_ARTIFACT_HASH_MISMATCH',
      'occurrence sourceArtifactContentHash does not match exact SourceArtifact authority'
    );
  }
  const artifactSourceRef = artifact.semanticPayload?.sourceRef;
  if (!artifactSourceRef || !sameAuthorityRef(artifactSourceRef, source.ref)) {
    throw new AgronomicRecordedOperationEvidenceError(
      'RECORDED_OPERATION_SOURCE_ARTIFACT_WORLD_MISMATCH',
      'occurrence SourceArtifact does not belong to the exact occurrence Source'
    );
  }

  const bytes = sourceRegistry.readArtifactBytes(artifact.ref);
  const evidence = extractAgronomicRecordedOperationXlsxRowEvidence({
    bytes,
    coordinates: normalized.sourceLocator.coordinates
  });
  const evidenceHash = agronomicRecordedOperationEvidenceHash(evidence);
  if (evidenceHash !== normalized.sourceLocator.evidenceHash) {
    throw new AgronomicRecordedOperationEvidenceError(
      'RECORDED_OPERATION_EVIDENCE_HASH_MISMATCH',
      'replayed exact XLSX row evidence does not match sourceLocator.evidenceHash'
    );
  }

  return deepFreeze({
    source,
    artifact,
    evidence,
    evidenceHash
  });
}
