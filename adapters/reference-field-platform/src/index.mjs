import {
  applyExplicitAdapterMapping,
  createIntegrationMessage,
  GENERIC_RESULT_EVENT_VERSION
} from '../../../sdks/typescript/src/index.mjs';

export const REFERENCE_FIELD_PLATFORM_ID = 'reference-field-platform';
export const REFERENCE_CONTEXT_MESSAGE_TYPE = 'CONTEXT_DATUM_AVAILABLE';
export const REFERENCE_APPLICABILITY_EVENT_TYPE = 'APPLICABILITY_PUBLISHED';

export class ReferenceIntegrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReferenceIntegrationError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_INPUT', `${name} must be an object`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactWireAuthorityRef(value, name = 'authority_ref') {
  const ref = plainObject(value, name);
  const output = {
    kind: text(ref.kind, `${name}.kind`),
    logical_id: text(ref.logical_id, `${name}.logical_id`),
    version: text(ref.version, `${name}.version`),
    semantic_hash: text(ref.semantic_hash, `${name}.semantic_hash`)
  };
  if (!output.semantic_hash.startsWith('sha256:')) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_AUTHORITY_REF', `${name}.semantic_hash must be a sha256 identity`);
  }
  return Object.freeze(output);
}

function normalizeContextMapping(mapping) {
  const value = plainObject(mapping, 'contextMapping');
  const output = {
    sourcePlotKey: text(value.sourcePlotKey, 'contextMapping.sourcePlotKey'),
    sourceMetricCode: text(value.sourceMetricCode, 'contextMapping.sourceMetricCode'),
    semanticId: text(value.semanticId, 'contextMapping.semanticId'),
    unit: text(value.unit, 'contextMapping.unit'),
    valueType: text(value.valueType, 'contextMapping.valueType'),
    geometryRef: text(value.geometryRef, 'contextMapping.geometryRef'),
    epistemicClass: text(value.epistemicClass ?? 'OBSERVATION', 'contextMapping.epistemicClass'),
    provenanceClass: text(value.provenanceClass ?? 'EXTERNAL_PROVIDER', 'contextMapping.provenanceClass')
  };
  if (!['CATEGORY', 'DECIMAL', 'INTEGER', 'STRING'].includes(output.valueType)) {
    throw new ReferenceIntegrationError('UNSUPPORTED_REFERENCE_VALUE_TYPE', `unsupported value type ${output.valueType}`);
  }
  return Object.freeze(output);
}

function valueTarget(valueType) {
  return {
    CATEGORY: 'value.category',
    DECIMAL: 'value.decimal',
    INTEGER: 'value.integer',
    STRING: 'value.string'
  }[valueType];
}

function validateCustomerObservation(record, mapping) {
  const value = plainObject(record, 'record');
  const required = [
    'plot_key',
    'reading_key',
    'metric_code',
    'raw_value',
    'observed_from',
    'observed_to',
    'released_at',
    'content_hash'
  ];
  for (const field of required) text(value[field], `record.${field}`);
  if (value.plot_key !== mapping.sourcePlotKey) {
    throw new ReferenceIntegrationError(
      'REFERENCE_SOURCE_SCOPE_MISMATCH',
      `record.plot_key ${value.plot_key} does not match configured source plot ${mapping.sourcePlotKey}`
    );
  }
  if (value.metric_code !== mapping.sourceMetricCode) {
    throw new ReferenceIntegrationError(
      'REFERENCE_SOURCE_METRIC_MISMATCH',
      `record.metric_code ${value.metric_code} does not match configured source metric ${mapping.sourceMetricCode}`
    );
  }
  if (!value.content_hash.startsWith('sha256:')) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_CONTENT_HASH', 'record.content_hash must be a sha256 identity');
  }
  return value;
}

export function createReferenceFieldPlatformContextProvider({ contextMapping }) {
  const mapping = normalizeContextMapping(contextMapping);

  function toContextMessage(recordInput) {
    const record = validateCustomerObservation(recordInput, mapping);
    const resource = applyExplicitAdapterMapping(record, [
      { source_field: 'reading_key', target_field: 'datum_id', mode: 'EXACT_COPY' },
      { source_field: 'raw_value', target_field: valueTarget(mapping.valueType), mode: 'EXACT_COPY' },
      { source_field: 'observed_from', target_field: 'effective_interval.start', mode: 'EXACT_COPY' },
      { source_field: 'observed_to', target_field: 'effective_interval.end', mode: 'EXACT_COPY' },
      { source_field: 'released_at', target_field: 'available_at', mode: 'EXACT_COPY' },
      { source_field: 'reading_key', target_field: 'source.source_ref', mode: 'EXACT_COPY' },
      { source_field: 'content_hash', target_field: 'source.content_hash', mode: 'EXACT_COPY' },
      { target_field: 'contract_version', mode: 'EXPLICIT_CONSTANT', constant: 'adr.context-datum.v1' },
      { target_field: 'semantic_id', mode: 'EXPLICIT_CONSTANT', constant: mapping.semanticId },
      { target_field: 'value.type', mode: 'EXPLICIT_CONSTANT', constant: mapping.valueType },
      { target_field: 'unit', mode: 'EXPLICIT_CONSTANT', constant: mapping.unit },
      { target_field: 'epistemic_class', mode: 'EXPLICIT_CONSTANT', constant: mapping.epistemicClass },
      { target_field: 'provenance_class', mode: 'EXPLICIT_CONSTANT', constant: mapping.provenanceClass },
      { target_field: 'spatial_support.type', mode: 'EXPLICIT_CONSTANT', constant: 'FIELD' },
      { target_field: 'spatial_support.geometry_ref', mode: 'EXPLICIT_CONSTANT', constant: mapping.geometryRef },
      { target_field: 'vertical_support', mode: 'EXPLICIT_CONSTANT', constant: null },
      { target_field: 'temporal_support.type', mode: 'EXPLICIT_CONSTANT', constant: 'INTERVAL' },
      { target_field: 'uncertainty.type', mode: 'EXPLICIT_CONSTANT', constant: 'NONE' },
      { target_field: 'source.provider_id', mode: 'EXPLICIT_CONSTANT', constant: REFERENCE_FIELD_PLATFORM_ID }
    ]);

    return createIntegrationMessage({
      role: 'CONTEXT_PROVIDER',
      messageType: REFERENCE_CONTEXT_MESSAGE_TYPE,
      messageId: `context:${text(record.reading_key, 'record.reading_key')}`,
      authorityRefs: [],
      payload: resource
    });
  }

  return Object.freeze({
    providerId: REFERENCE_FIELD_PLATFORM_ID,
    mapping,
    toContextMessage
  });
}

export function consumeReferenceApplicabilityResult(eventInput) {
  const event = plainObject(eventInput, 'event');
  if (event.contract_version !== GENERIC_RESULT_EVENT_VERSION) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_RESULT_EVENT', `expected ${GENERIC_RESULT_EVENT_VERSION}`);
  }
  if (event.event_type !== REFERENCE_APPLICABILITY_EVENT_TYPE) {
    throw new ReferenceIntegrationError('INVALID_REFERENCE_RESULT_EVENT', `expected ${REFERENCE_APPLICABILITY_EVENT_TYPE}`);
  }
  if (event.projection_hash !== undefined || event.authority_ref === undefined) {
    throw new ReferenceIntegrationError('APPLICABILITY_AUTHORITY_REF_REQUIRED', 'applicability result must carry exactly one authority_ref');
  }
  const authorityRef = exactWireAuthorityRef(event.authority_ref);
  if (authorityRef.kind !== 'ApplicabilityAssessment') {
    throw new ReferenceIntegrationError('APPLICABILITY_AUTHORITY_REF_REQUIRED', 'result authority_ref must be ApplicabilityAssessment');
  }
  const payload = plainObject(event.payload, 'event.payload');
  return Object.freeze({
    consumer: REFERENCE_FIELD_PLATFORM_ID,
    eventId: text(event.event_id, 'event.event_id'),
    applicabilityAssessmentRef: authorityRef,
    transportStatus: text(payload.transport_status, 'event.payload.transport_status'),
    workbenchClassification: text(payload.workbench_classification, 'event.payload.workbench_classification'),
    authorityClaim: 'NONE_TRANSPORT_CONSUMER_ONLY',
    payload: Object.freeze(clone(payload))
  });
}
