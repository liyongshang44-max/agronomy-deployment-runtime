import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-occurrence.v1';
export const AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-recorded-operation-occurrence-compilation.v1';

export const AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CLASSES = deepFreeze([
  'SOURCE_RECORDED_OPERATION_OCCURRENCE'
]);
export const AGRONOMIC_RECORDED_OPERATION_RECORD_ROLES = deepFreeze([
  'ACTUAL_FIELD_OPERATION_RECORD'
]);
export const AGRONOMIC_RECORDED_OPERATION_TEMPORAL_KINDS = deepFreeze([
  'CALENDAR_DATE'
]);
export const AGRONOMIC_RECORDED_OPERATION_TEMPORAL_PRECISIONS = deepFreeze([
  'DAY'
]);
export const AGRONOMIC_RECORDED_OPERATION_LOCATOR_KINDS = deepFreeze([
  'DOCUMENT_COORDINATE'
]);
export const AGRONOMIC_RECORDED_OPERATION_LOCATOR_SCHEMES = deepFreeze([
  'XLSX_WORKSHEET_ROW_V1',
  'JUPYTER_OUTPUT_TABLE_ROW_V1'
]);
export const AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CELL_ROLES = deepFreeze([
  'SOURCE_RECORD_ID',
  'SOURCE_OPERATION_CODE',
  'SOURCE_NATIVE_SUBJECT',
  'SOURCE_NATIVE_PLOT',
  'TEMPORAL_SUPPORT'
]);

const OCCURRENCE_CLASSES = new Set(AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CLASSES);
const RECORD_ROLES = new Set(AGRONOMIC_RECORDED_OPERATION_RECORD_ROLES);
const TEMPORAL_KINDS = new Set(AGRONOMIC_RECORDED_OPERATION_TEMPORAL_KINDS);
const TEMPORAL_PRECISIONS = new Set(AGRONOMIC_RECORDED_OPERATION_TEMPORAL_PRECISIONS);
const LOCATOR_KINDS = new Set(AGRONOMIC_RECORDED_OPERATION_LOCATOR_KINDS);
const LOCATOR_SCHEMES = new Set(AGRONOMIC_RECORDED_OPERATION_LOCATOR_SCHEMES);
const EVIDENCE_CELL_ROLES = new Set(AGRONOMIC_RECORDED_OPERATION_EVIDENCE_CELL_ROLES);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const CELL_REF_RE = /^[A-Z]+[1-9][0-9]*$/;
const TOKEN_RE = /^[A-Z][A-Z0-9_]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AgronomicRecordedOperationOccurrenceCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicRecordedOperationOccurrenceCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INPUT',
      `${name} must be an object`
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_FIELD',
        `${name}.${key} is not part of the recorded-operation-occurrence contract`
      );
    }
  }
}

function enumValue(value, name, values, code) {
  const normalized = requiredText(value, name);
  if (!values.has(normalized)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      code,
      `${name} has unsupported value ${normalized}`
    );
  }
  return normalized;
}

function hashValue(value, name) {
  const normalized = requiredText(value, name);
  if (!HASH_RE.test(normalized)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_HASH',
      `${name} must be a sha256 semantic/content hash`
    );
  }
  return normalized;
}

function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      `${name} must be a positive safe integer`
    );
  }
  return value;
}

function authorityRef(value, name, kinds) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_AUTHORITY_REF',
      `${name} must be an exact authority ref: ${error?.message ?? 'invalid ref'}`
    );
  }
  if (!kinds.has(ref.kind)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_AUTHORITY_REF',
      `${name} must reference one of: ${[...kinds].join(', ')}`
    );
  }
  return ref;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function refList(values, name, kinds, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_AUTHORITY_REF',
      `${name} must be ${nonEmpty ? 'a non-empty ' : ''}array`
    );
  }
  const normalized = values.map((value, index) =>
    authorityRef(value, `${name}[${index}]`, kinds)
  );
  const keys = normalized.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_AUTHORITY_REF',
      `${name} cannot contain duplicate exact refs`
    );
  }
  return deepFreeze([...normalized].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INPUT',
      `${name} must be an array`
    );
  }
  const normalized = values.map((value, index) => requiredText(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_VALUE',
      `${name} cannot contain duplicates`
    );
  }
  return deepFreeze([...normalized].sort());
}

function calendarDate(value, name) {
  const normalized = requiredText(value, name);
  if (!DATE_RE.test(normalized)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_DATE',
      `${name} must use YYYY-MM-DD without fabricating a timestamp`
    );
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_DATE',
      `${name} must be a real calendar date`
    );
  }
  return normalized;
}

function assertRequiredEvidenceRoles(roles, label) {
  for (const requiredRole of [
    'SOURCE_OPERATION_CODE',
    'SOURCE_NATIVE_SUBJECT',
    'TEMPORAL_SUPPORT'
  ]) {
    if (!roles.includes(requiredRole)) {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'MISSING_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_EVIDENCE_ROLE',
        `${label} must include ${requiredRole}`
      );
    }
  }
}

function normalizeEvidenceCell(value, index, rowNumber) {
  const name = `sourceLocator.coordinates.cells[${index}]`;
  exactObject(value, name, new Set(['role', 'cellRef']));
  const role = enumValue(
    value.role,
    `${name}.role`,
    EVIDENCE_CELL_ROLES,
    'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_EVIDENCE_ROLE'
  );
  const cellRef = requiredText(value.cellRef, `${name}.cellRef`);
  if (!CELL_REF_RE.test(cellRef)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      `${name}.cellRef must be an uppercase A1 cell reference`
    );
  }
  const cellRow = Number(cellRef.match(/[1-9][0-9]*$/)[0]);
  if (cellRow !== rowNumber) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      `${name}.cellRef must point to declared rowNumber ${rowNumber}`
    );
  }
  return deepFreeze({ role, cellRef });
}

function normalizeXlsxCoordinates(value) {
  exactObject(value, 'sourceLocator.coordinates', new Set([
    'worksheetName', 'rowNumber', 'cells'
  ]));
  const worksheetName = requiredText(
    value.worksheetName,
    'sourceLocator.coordinates.worksheetName'
  );
  const rowNumber = positiveSafeInteger(
    value.rowNumber,
    'sourceLocator.coordinates.rowNumber'
  );
  if (!Array.isArray(value.cells) || value.cells.length < 3) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'sourceLocator.coordinates.cells must include at least subject, operation and temporal evidence'
    );
  }
  const cells = value.cells.map((cell, index) =>
    normalizeEvidenceCell(cell, index, rowNumber)
  );
  const roles = cells.map((cell) => cell.role);
  const refs = cells.map((cell) => cell.cellRef);
  if (new Set(roles).size !== roles.length || new Set(refs).size !== refs.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'sourceLocator evidence cell roles and cell refs must be unique'
    );
  }
  assertRequiredEvidenceRoles(
    roles,
    'sourceLocator.coordinates.cells'
  );
  return deepFreeze({
    worksheetName,
    rowNumber,
    cells: deepFreeze([...cells].sort((a, b) => a.role.localeCompare(b.role)))
  });
}

function normalizeNotebookColumn(value, index) {
  const name = `sourceLocator.coordinates.columns[${index}]`;
  exactObject(value, name, new Set(['role', 'name']));
  return deepFreeze({
    role: enumValue(
      value.role,
      `${name}.role`,
      EVIDENCE_CELL_ROLES,
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_EVIDENCE_ROLE'
    ),
    name: requiredText(value.name, `${name}.name`)
  });
}

function normalizeJupyterCoordinates(value) {
  exactObject(value, 'sourceLocator.coordinates', new Set([
    'cellIndex',
    'outputIndex',
    'mimeType',
    'rowIndex',
    'columns'
  ]));
  if (!Number.isSafeInteger(value.cellIndex) || value.cellIndex < 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'sourceLocator.coordinates.cellIndex must be a non-negative safe integer'
    );
  }
  if (!Number.isSafeInteger(value.outputIndex) || value.outputIndex < 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'sourceLocator.coordinates.outputIndex must be a non-negative safe integer'
    );
  }
  const mimeType = requiredText(
    value.mimeType,
    'sourceLocator.coordinates.mimeType'
  );
  if (mimeType !== 'text/plain') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'JUPYTER_OUTPUT_TABLE_ROW_V1 v1 supports only text/plain persisted output'
    );
  }
  const rowIndex = requiredText(
    value.rowIndex,
    'sourceLocator.coordinates.rowIndex'
  );
  if (!Array.isArray(value.columns) || value.columns.length < 3) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'sourceLocator.coordinates.columns must include at least subject, operation and temporal evidence'
    );
  }
  const columns = value.columns.map(normalizeNotebookColumn);
  const roles = columns.map((column) => column.role);
  const names = columns.map((column) => column.name);
  if (new Set(roles).size !== roles.length || new Set(names).size !== names.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COORDINATE',
      'notebook evidence roles and source column names must be unique'
    );
  }
  assertRequiredEvidenceRoles(
    roles,
    'sourceLocator.coordinates.columns'
  );
  return deepFreeze({
    cellIndex: value.cellIndex,
    outputIndex: value.outputIndex,
    mimeType,
    rowIndex,
    columns: deepFreeze([...columns].sort((a, b) => a.role.localeCompare(b.role)))
  });
}

function normalizeSourceLocator(value) {
  exactObject(value, 'sourceLocator', new Set([
    'kind', 'scheme', 'coordinates', 'evidenceHash'
  ]));
  const kind = enumValue(
    value.kind,
    'sourceLocator.kind',
    LOCATOR_KINDS,
    'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_LOCATOR'
  );
  const scheme = enumValue(
    value.scheme,
    'sourceLocator.scheme',
    LOCATOR_SCHEMES,
    'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_LOCATOR'
  );

  const coordinates =
    scheme === 'XLSX_WORKSHEET_ROW_V1'
      ? normalizeXlsxCoordinates(value.coordinates)
      : normalizeJupyterCoordinates(value.coordinates);

  return deepFreeze({
    kind,
    scheme,
    coordinates,
    evidenceHash: hashValue(value.evidenceHash, 'sourceLocator.evidenceHash')
  });
}

function normalizeSourceNativeSubject(value) {
  exactObject(value, 'occurrenceSemantics.sourceNativeSubject', new Set(['identifiers']));
  if (!Array.isArray(value.identifiers) || value.identifiers.length === 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SUBJECT',
      'sourceNativeSubject.identifiers must be a non-empty array'
    );
  }
  const identifiers = value.identifiers.map((identifier, index) => {
    const name = `occurrenceSemantics.sourceNativeSubject.identifiers[${index}]`;
    exactObject(identifier, name, new Set(['name', 'value']));
    return deepFreeze({
      name: requiredText(identifier.name, `${name}.name`),
      value: requiredText(identifier.value, `${name}.value`)
    });
  });
  const keys = identifiers.map((identifier) =>
    JSON.stringify([identifier.name, identifier.value])
  );
  if (new Set(keys).size !== keys.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SUBJECT',
      'sourceNativeSubject identifiers cannot contain duplicate name/value pairs'
    );
  }
  return deepFreeze({
    identifiers: deepFreeze([...identifiers].sort((a, b) =>
      JSON.stringify([a.name, a.value]).localeCompare(JSON.stringify([b.name, b.value]))
    ))
  });
}

function normalizeNormalizedOperation(value) {
  exactObject(value, 'occurrenceSemantics.normalizedOperation', new Set([
    'actionCode', 'subject'
  ]));
  const actionCode = requiredText(
    value.actionCode,
    'occurrenceSemantics.normalizedOperation.actionCode'
  );
  if (!TOKEN_RE.test(actionCode)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_NORMALIZATION',
      'normalizedOperation.actionCode must be an uppercase semantic token'
    );
  }
  exactObject(value.subject, 'occurrenceSemantics.normalizedOperation.subject', new Set([
    'kind', 'code'
  ]));
  return deepFreeze({
    actionCode,
    subject: deepFreeze({
      kind: requiredText(value.subject.kind, 'occurrenceSemantics.normalizedOperation.subject.kind'),
      code: requiredText(value.subject.code, 'occurrenceSemantics.normalizedOperation.subject.code')
    })
  });
}

function normalizeTemporalSupport(value) {
  exactObject(value, 'occurrenceSemantics.temporalSupport', new Set([
    'kind', 'date', 'precision'
  ]));
  return deepFreeze({
    kind: enumValue(
      value.kind,
      'occurrenceSemantics.temporalSupport.kind',
      TEMPORAL_KINDS,
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_TEMPORAL_KIND'
    ),
    date: calendarDate(value.date, 'occurrenceSemantics.temporalSupport.date'),
    precision: enumValue(
      value.precision,
      'occurrenceSemantics.temporalSupport.precision',
      TEMPORAL_PRECISIONS,
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_TEMPORAL_PRECISION'
    )
  });
}

function normalizeOccurrenceSemantics(value) {
  exactObject(value, 'occurrenceSemantics', new Set([
    'occurrenceClass',
    'sourceOperationCode',
    'normalizedOperation',
    'sourceNativeSubject',
    'temporalSupport'
  ]));
  return deepFreeze({
    occurrenceClass: enumValue(
      value.occurrenceClass,
      'occurrenceSemantics.occurrenceClass',
      OCCURRENCE_CLASSES,
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CLASS'
    ),
    sourceOperationCode: requiredText(
      value.sourceOperationCode,
      'occurrenceSemantics.sourceOperationCode'
    ),
    ...(value.normalizedOperation !== undefined
      ? { normalizedOperation: normalizeNormalizedOperation(value.normalizedOperation) }
      : {}),
    sourceNativeSubject: normalizeSourceNativeSubject(value.sourceNativeSubject),
    temporalSupport: normalizeTemporalSupport(value.temporalSupport)
  });
}

export function normalizeAgronomicRecordedOperationOccurrence(value) {
  exactObject(value, 'AgronomicRecordedOperationOccurrence', new Set([
    'contractVersion',
    'occurrenceId',
    'sourceRef',
    'sourceArtifactRef',
    'sourceArtifactContentHash',
    'sourceLocator',
    'recordSemanticRole',
    'occurrenceSemantics',
    'transformationRationale'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT',
      'unsupported AgronomicRecordedOperationOccurrence contractVersion'
    );
  }

  return deepFreeze({
    contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
    occurrenceId: requiredText(value.occurrenceId, 'occurrenceId'),
    sourceRef: authorityRef(value.sourceRef, 'sourceRef', new Set(['Source'])),
    sourceArtifactRef: authorityRef(
      value.sourceArtifactRef,
      'sourceArtifactRef',
      new Set(['SourceArtifact'])
    ),
    sourceArtifactContentHash: hashValue(
      value.sourceArtifactContentHash,
      'sourceArtifactContentHash'
    ),
    sourceLocator: normalizeSourceLocator(value.sourceLocator),
    recordSemanticRole: enumValue(
      value.recordSemanticRole,
      'recordSemanticRole',
      RECORD_ROLES,
      'INVALID_AGRONOMIC_RECORDED_OPERATION_RECORD_ROLE'
    ),
    occurrenceSemantics: normalizeOccurrenceSemantics(value.occurrenceSemantics),
    transformationRationale: requiredText(
      value.transformationRationale,
      'transformationRationale'
    )
  });
}

export function agronomicRecordedOperationOccurrenceHash(value) {
  return semanticHash(
    'AgronomicRecordedOperationOccurrence',
    normalizeAgronomicRecordedOperationOccurrence(value)
  );
}

export function normalizeAgronomicRecordedOperationOccurrenceCompilation(value) {
  exactObject(value, 'AgronomicRecordedOperationOccurrenceCompilation', new Set([
    'contractVersion',
    'authorityClass',
    'sourceArtifactRefs',
    'sourceRoleAuthorityRefs',
    'occurrence',
    'occurrenceHash',
    'semanticReviewRef',
    'losslessCoverage',
    'limitations'
  ]));
  if (requiredText(value.contractVersion, 'contractVersion')
      !== AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT',
      'unsupported AgronomicRecordedOperationOccurrenceCompilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
      'authorityClass must be AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY'
    );
  }

  const occurrence = normalizeAgronomicRecordedOperationOccurrence(value.occurrence);
  const occurrenceHash = hashValue(value.occurrenceHash, 'occurrenceHash');
  const expectedHash = agronomicRecordedOperationOccurrenceHash(occurrence);
  if (occurrenceHash !== expectedHash) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_HASH_MISMATCH',
      'occurrenceHash must exactly match the normalized recorded occurrence'
    );
  }

  const sourceArtifactRefs = refList(
    value.sourceArtifactRefs,
    'sourceArtifactRefs',
    new Set(['SourceArtifact']),
    { nonEmpty: true }
  );
  if (!sourceArtifactRefs.some((ref) => refKey(ref) === refKey(occurrence.sourceArtifactRef))) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_ARTIFACT_NOT_DECLARED',
      'sourceArtifactRefs must contain the exact occurrence SourceArtifact'
    );
  }

  exactObject(value.losslessCoverage, 'losslessCoverage', new Set([
    'status', 'coveredElements', 'unrepresentedElements'
  ]));
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COVERAGE',
      'losslessCoverage.status must be COMPLETE or INCOMPLETE'
    );
  }
  const coveredElements = stringList(
    value.losslessCoverage.coveredElements ?? [],
    'losslessCoverage.coveredElements'
  );
  const unrepresentedElements = stringList(
    value.losslessCoverage.unrepresentedElements ?? [],
    'losslessCoverage.unrepresentedElements'
  );
  if (status === 'COMPLETE' && unrepresentedElements.length !== 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COVERAGE',
      'COMPLETE occurrence coverage cannot declare unrepresented local occurrence elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COVERAGE',
      'INCOMPLETE occurrence coverage must name at least one unrepresented local occurrence element'
    );
  }

  return deepFreeze({
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
    sourceArtifactRefs,
    sourceRoleAuthorityRefs: refList(
      value.sourceRoleAuthorityRefs ?? [],
      'sourceRoleAuthorityRefs',
      new Set(['AgronomicSourceAuthorityRoutingCompilation'])
    ),
    occurrence,
    occurrenceHash,
    semanticReviewRef: authorityRef(
      value.semanticReviewRef,
      'semanticReviewRef',
      new Set(['AgronomicRecordedOperationOccurrenceReviewDecision'])
    ),
    losslessCoverage: deepFreeze({
      status,
      coveredElements,
      unrepresentedElements
    }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicRecordedOperationOccurrenceCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicRecordedOperationOccurrenceCompilation(value);
  const refs = [
    normalized.occurrence.sourceRef,
    ...normalized.sourceArtifactRefs,
    ...normalized.sourceRoleAuthorityRefs,
    normalized.semanticReviewRef
  ];
  const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze([...unique.values()].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}
