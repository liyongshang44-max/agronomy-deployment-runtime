import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  CONTEXT_DATUM_CONTRACT_VERSION,
  normalizeContextDatum
} from '../../context-contract/src/index.mjs';

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION =
  'adr.agronomic-context-datum-assembly.v1';
export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION =
  'adr.agronomic-context-datum-assembly-compilation.v1';

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_SOURCE_REF =
  'blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33';
export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_CONTENT_HASH =
  'sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f';

const PREDECESSOR_KIND_BY_KEY = deepFreeze({
  contextSemanticMappingCompilationRef:
    'AgronomicRecordedOperationContextSemanticMappingCompilation',
  epistemicClassificationCompilationRef:
    'AgronomicRecordedOperationContextEpistemicClassificationCompilation',
  provenanceClassificationCompilationRef:
    'AgronomicRecordedOperationContextProvenanceClassificationCompilation',
  sourceReferenceHashProjectionCompilationRef:
    'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation',
  temporalSupportClassificationCompilationRef:
    'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation',
  spatialSupportClassificationCompilationRef:
    'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation',
  unitRepresentationCompilationRef:
    'AgronomicContextNonQuantitativeUnitRepresentationCompilation',
  verticalSupportNonApplicabilityCompilationRef:
    'AgronomicContextVerticalSupportNonApplicabilityCompilation',
  uncertaintyUnknownRepresentationCompilationRef:
    'AgronomicContextUncertaintyUnknownRepresentationCompilation',
  sourceAcquisitionAvailabilityProjectionCompilationRef:
    'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation',
  historicalTimezoneBoundaryResolutionCompilationRef:
    'AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation'
});

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PREDECESSOR_KEYS =
  deepFreeze(Object.keys(PREDECESSOR_KIND_BY_KEY).sort());

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE = deepFreeze({
  contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
  semanticId: 'crop.planting_date',
  value: deepFreeze({ type: 'DATE', date: '2011-05-03' }),
  unit: 'NOT_APPLICABLE',
  epistemicClass: 'ASSERTION',
  provenanceClass: 'EXTERNAL_PROVIDER',
  effectiveInterval: deepFreeze({
    start: '2011-05-03T05:00:00.000Z',
    end: '2011-05-04T05:00:00.000Z'
  }),
  availableAt: '2026-08-30T13:00:00.000Z',
  spatialSupport: deepFreeze({ type: 'FARM' }),
  verticalSupport: null,
  temporalSupport: deepFreeze({ type: 'INTERVAL' }),
  uncertainty: deepFreeze({
    type: 'UNKNOWN',
    reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
  }),
  source: deepFreeze({
    providerId: 'github.com/isudatateam/datateam',
    sourceRef: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_SOURCE_REF,
    contentHash: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_CONTENT_HASH
  })
});

export class AgronomicContextDatumAssemblyCompilationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextDatumAssemblyCompilationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INPUT',
      name + ' must be a non-empty string'
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INPUT',
      name + ' must be an object'
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextDatumAssemblyCompilationError(
        'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIELD',
        name + '.' + key + ' is not part of the DEC-0031 contract'
      );
    }
  }
}

function authorityRef(value, name, kind) {
  let ref;
  try {
    ref = assertAuthorityRef(value);
  } catch (error) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AUTHORITY_REF',
      name + ' must be an exact authority ref'
    );
  }
  if (ref.kind !== kind) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AUTHORITY_REF',
      name + ' must reference ' + kind
    );
  }
  return ref;
}

function normalizePredecessorRefs(value) {
  exactObject(
    value,
    'predecessorRefs',
    new Set(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PREDECESSOR_KEYS)
  );
  const out = {};
  for (const key of AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PREDECESSOR_KEYS) {
    out[key] = authorityRef(
      value[key],
      'predecessorRefs.' + key,
      PREDECESSOR_KIND_BY_KEY[key]
    );
  }
  return deepFreeze(out);
}

function normalizeDatumTemplate(value) {
  const normalized = normalizeContextDatum(value, {
    datumId: '__DEC_0031_ASSEMBLY_TEMPLATE__'
  });
  return deepFreeze({
    contractVersion: normalized.contractVersion,
    semanticId: normalized.semanticId,
    value: normalized.value,
    unit: normalized.unit,
    epistemicClass: normalized.epistemicClass,
    provenanceClass: normalized.provenanceClass,
    effectiveInterval: normalized.effectiveInterval,
    availableAt: normalized.availableAt,
    spatialSupport: normalized.spatialSupport,
    verticalSupport: normalized.verticalSupport,
    temporalSupport: normalized.temporalSupport,
    uncertainty: normalized.uncertainty,
    source: normalized.source
  });
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stringList(values, name) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INPUT',
      name + ' must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    requiredText(value, name + '[' + index + ']')
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'DUPLICATE_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_VALUE',
      name + ' cannot contain duplicates'
    );
  }
  return deepFreeze([...normalized].sort());
}

export function normalizeAgronomicContextDatumAssembly(value) {
  exactObject(
    value,
    'AgronomicContextDatumAssembly',
    new Set([
      'contractVersion',
      'assemblyId',
      'predecessorRefs',
      'datumTemplate',
      'rationale'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION
  ) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT',
      'unsupported ContextDatum assembly contractVersion'
    );
  }
  const datumTemplate = normalizeDatumTemplate(value.datumTemplate);
  if (!sameJson(datumTemplate, AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TEMPLATE',
      'v1 supports only the exact first Sustainable Corn planting-date datum template'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION,
    assemblyId: requiredText(value.assemblyId, 'assemblyId'),
    predecessorRefs: normalizePredecessorRefs(value.predecessorRefs),
    datumTemplate,
    rationale: requiredText(value.rationale, 'rationale')
  });
}

export function agronomicContextDatumAssemblyHash(value) {
  return semanticHash(
    'AgronomicContextDatumAssembly',
    normalizeAgronomicContextDatumAssembly(value)
  );
}

export function normalizeAgronomicContextDatumAssemblyCompilation(value) {
  exactObject(
    value,
    'AgronomicContextDatumAssemblyCompilation',
    new Set([
      'contractVersion',
      'authorityClass',
      'assembly',
      'assemblyHash',
      'assemblyReviewRef',
      'losslessCoverage',
      'limitations'
    ])
  );
  if (
    requiredText(value.contractVersion, 'contractVersion')
    !== AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION
  ) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'UNSUPPORTED_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT',
      'unsupported ContextDatum assembly compilation contractVersion'
    );
  }
  if (value.authorityClass !== 'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_AUTHORITY') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AUTHORITY',
      'invalid assembly authorityClass'
    );
  }
  const assembly = normalizeAgronomicContextDatumAssembly(value.assembly);
  const assemblyHash = requiredText(value.assemblyHash, 'assemblyHash');
  if (assemblyHash !== agronomicContextDatumAssemblyHash(assembly)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_HASH_MISMATCH',
      'assemblyHash must match exact normalized assembly'
    );
  }
  const assemblyReviewRef = authorityRef(
    value.assemblyReviewRef,
    'assemblyReviewRef',
    'AgronomicContextDatumAssemblyReviewDecision'
  );
  exactObject(
    value.losslessCoverage,
    'losslessCoverage',
    new Set(['status', 'coveredElements', 'unrepresentedElements'])
  );
  const status = requiredText(value.losslessCoverage.status, 'losslessCoverage.status');
  if (!['COMPLETE', 'INCOMPLETE'].includes(status)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COVERAGE',
      'coverage status must be COMPLETE or INCOMPLETE'
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
  if (status === 'COMPLETE' && unrepresentedElements.length > 0) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COVERAGE',
      'COMPLETE cannot declare unrepresented targeted elements'
    );
  }
  if (status === 'INCOMPLETE' && unrepresentedElements.length === 0) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COVERAGE',
      'INCOMPLETE must name unresolved targeted elements'
    );
  }
  return deepFreeze({
    contractVersion: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_AUTHORITY',
    assembly,
    assemblyHash,
    assemblyReviewRef,
    losslessCoverage: deepFreeze({ status, coveredElements, unrepresentedElements }),
    limitations: stringList(value.limitations ?? [], 'limitations')
  });
}

export function agronomicContextDatumAssemblyCompilationAuthorityRefs(value) {
  const normalized = normalizeAgronomicContextDatumAssemblyCompilation(value);
  return deepFreeze([
    ...Object.values(normalized.assembly.predecessorRefs),
    normalized.assemblyReviewRef
  ]);
}
