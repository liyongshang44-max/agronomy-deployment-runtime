import { createHash } from 'node:crypto';
import {
  createIntegrationMessage,
  GENERIC_RESULT_EVENT_VERSION
} from '../../../sdks/typescript/src/index.mjs';

export const GEOX_FIRST_PARTY_ADAPTER_VERSION = 'adr.geox-adapter.v1';
export const GEOX_RESULT_SINK_VERSION = 'adr.geox-result-sink.v1';
export const GEOX_COMPATIBILITY_BASELINE = '6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9';
export const GEOX_CROP_CONTEXT_CONTRACT = 'crop_context_v1@1';
export const GEOX_DEVICE_OBSERVATION_CONTRACT = 'device_observation_index_v1';

export class GeoxAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxAdapterError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GeoxAdapterError('INVALID_GEOX_ADAPTER_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GeoxAdapterError('INVALID_GEOX_ADAPTER_INPUT', `${name} must be an object`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex')}`;
}

function timestamp(value, name) {
  const input = text(value, name);
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) throw new GeoxAdapterError('INVALID_GEOX_TIME', `${name} must be a valid timestamp`);
  return parsed.toISOString();
}

function exactWireAuthorityRef(value, name = 'authority_ref') {
  const ref = object(value, name);
  const output = {
    kind: text(ref.kind, `${name}.kind`),
    logical_id: text(ref.logical_id, `${name}.logical_id`),
    version: text(ref.version, `${name}.version`),
    semantic_hash: text(ref.semantic_hash, `${name}.semantic_hash`)
  };
  if (!output.semantic_hash.startsWith('sha256:')) {
    throw new GeoxAdapterError('INVALID_GEOX_AUTHORITY_REF', `${name}.semantic_hash must be a sha256 identity`);
  }
  return Object.freeze(output);
}

const CROP_SOURCE_TRANSLATION = Object.freeze({
  USER_DECLARED: Object.freeze({ epistemicClass: 'ASSERTION', provenanceClass: 'USER' }),
  SENSOR_INFERRED: Object.freeze({ epistemicClass: 'DERIVED', provenanceClass: 'SENSOR' }),
  REMOTE_SENSING: Object.freeze({ epistemicClass: 'DERIVED', provenanceClass: 'REMOTE_SENSING' }),
  MACHINERY_RECORD: Object.freeze({ epistemicClass: 'ASSERTION', provenanceClass: 'MACHINERY' }),
  MANUAL_VERIFIED: Object.freeze({ epistemicClass: 'ASSERTION', provenanceClass: 'CUSTOMER_SYSTEM' })
});

function normalizeTargetScope(value) {
  const input = object(value, 'targetScope');
  return Object.freeze({
    tenantId: text(input.tenantId, 'targetScope.tenantId'),
    projectId: text(input.projectId, 'targetScope.projectId'),
    groupId: text(input.groupId, 'targetScope.groupId'),
    geoxFieldId: text(input.geoxFieldId, 'targetScope.geoxFieldId'),
    adrGeometryRef: text(input.adrGeometryRef, 'targetScope.adrGeometryRef'),
    ...(input.seasonId === undefined || input.seasonId === null
      ? {}
      : { seasonId: text(input.seasonId, 'targetScope.seasonId') })
  });
}

function validateScope(payload, scope) {
  const checks = [
    ['tenant_id', scope.tenantId],
    ['project_id', scope.projectId],
    ['group_id', scope.groupId],
    ['field_id', scope.geoxFieldId]
  ];
  if (scope.seasonId !== undefined) checks.push(['season_id', scope.seasonId]);
  for (const [field, expected] of checks) {
    if (text(payload[field], `crop_context.payload.${field}`) !== expected) {
      throw new GeoxAdapterError('GEOX_TARGET_SCOPE_MISMATCH', `crop_context.payload.${field} does not match configured target scope`);
    }
  }
}

function normalizeCropContextFact(factInput, scope) {
  const fact = object(factInput, 'cropContextFact');
  const record = object(fact.record_json, 'cropContextFact.record_json');
  if (record.type !== 'crop_context_v1' || String(record.schema_version) !== '1') {
    throw new GeoxAdapterError('UNSUPPORTED_GEOX_CROP_CONTEXT_CONTRACT', 'expected crop_context_v1 schema_version 1');
  }
  const payload = object(record.payload, 'cropContextFact.record_json.payload');
  validateScope(payload, scope);
  if (text(payload.status, 'crop_context.payload.status') !== 'PLANTED_CONFIRMED') {
    throw new GeoxAdapterError(
      'GEOX_CROP_CONTEXT_NOT_CONFIRMED',
      'v0.3 first-party adapter only exposes crop.code from PLANTED_CONFIRMED crop context'
    );
  }
  const cropCode = text(payload.crop_code, 'crop_context.payload.crop_code');
  const source = text(payload.source, 'crop_context.payload.source');
  const sourceTranslation = CROP_SOURCE_TRANSLATION[source];
  if (!sourceTranslation) {
    throw new GeoxAdapterError('UNSUPPORTED_GEOX_CROP_SOURCE', `unsupported crop context source ${source}`);
  }
  const occurredAt = timestamp(fact.occurred_at, 'cropContextFact.occurred_at');
  const ingestedAt = timestamp(fact.ingested_at, 'cropContextFact.ingested_at');
  if (ingestedAt < occurredAt) {
    throw new GeoxAdapterError('INVALID_GEOX_CHRONOLOGY', 'cropContextFact.ingested_at cannot precede occurred_at');
  }
  return Object.freeze({
    factId: text(fact.fact_id, 'cropContextFact.fact_id'),
    occurredAt,
    ingestedAt,
    record: clone(record),
    payload: clone(payload),
    cropCode,
    source,
    sourceTranslation,
    snapshotHash: sha256(record)
  });
}

function translationAudit({ normalized, scope }) {
  const auditPayload = {
    contract_version: GEOX_FIRST_PARTY_ADAPTER_VERSION,
    source_system: 'GEOX',
    source_contract: GEOX_CROP_CONTEXT_CONTRACT,
    source_contract_repository_baseline: GEOX_COMPATIBILITY_BASELINE,
    source_ref: `geox:facts/${normalized.factId}`,
    source_snapshot_hash: normalized.snapshotHash,
    source_scope: {
      tenant_id: scope.tenantId,
      project_id: scope.projectId,
      group_id: scope.groupId,
      field_id: scope.geoxFieldId,
      ...(scope.seasonId ? { season_id: scope.seasonId } : {})
    },
    target_semantic_id: 'crop.code',
    mappings: [
      { source: 'record_json.payload.crop_code', target: 'value.category', mode: 'EXACT_COPY' },
      { source: 'record_json.payload.source', target: 'epistemic_class/provenance_class', mode: 'EXPLICIT_ENUM_TRANSLATION' },
      { source: 'occurred_at', target: 'effective_interval', mode: 'EXACT_INSTANT' },
      { source: 'ingested_at', target: 'available_at', mode: 'EXACT_COPY' },
      { source: 'field_id', target: 'spatial_support.geometry_ref', mode: 'EXPLICIT_IDENTITY_MAPPING', mapped_value: scope.adrGeometryRef }
    ],
    deliberately_not_mapped: [
      'record_json.payload.confidence -> ADR uncertainty/scientific qualification',
      'record_json.payload.allowed_actions -> ADR runtime/decision authority',
      'record_json.payload.variety_code -> crop.code',
      'record_json.payload.crop_stage -> crop.code'
    ],
    authority_claim: 'NONE_TRANSLATION_AUDIT_ONLY'
  };
  return Object.freeze({
    ...auditPayload,
    audit_hash: sha256(auditPayload)
  });
}

export function createGeoxTargetContextProvider({ targetScope }) {
  const scope = normalizeTargetScope(targetScope);

  function cropContextToMessage(factInput) {
    const normalized = normalizeCropContextFact(factInput, scope);
    const message = createIntegrationMessage({
      role: 'CONTEXT_PROVIDER',
      messageType: 'CONTEXT_DATUM_AVAILABLE',
      messageId: `geox-crop-context:${normalized.factId}`,
      authorityRefs: [],
      payload: {
        contract_version: 'adr.context-datum.v1',
        datum_id: `geox:${normalized.factId}:crop.code`,
        semantic_id: 'crop.code',
        value: { type: 'CATEGORY', category: normalized.cropCode },
        unit: '1',
        epistemic_class: normalized.sourceTranslation.epistemicClass,
        provenance_class: normalized.sourceTranslation.provenanceClass,
        effective_interval: { start: normalized.occurredAt, end: normalized.occurredAt },
        available_at: normalized.ingestedAt,
        spatial_support: { type: 'FIELD', geometry_ref: scope.adrGeometryRef },
        vertical_support: null,
        temporal_support: { type: 'INSTANT' },
        uncertainty: { type: 'UNKNOWN', reason_code: 'GEOX_CONFIDENCE_NOT_ADR_UNCERTAINTY' },
        source: {
          provider_id: 'GEOX',
          source_ref: `geox:facts/${normalized.factId}`,
          content_hash: normalized.snapshotHash
        }
      }
    });
    return Object.freeze({ message, translationAudit: translationAudit({ normalized, scope }) });
  }

  return Object.freeze({
    adapterVersion: GEOX_FIRST_PARTY_ADAPTER_VERSION,
    compatibilityBaseline: GEOX_COMPATIBILITY_BASELINE,
    targetScope: scope,
    cropContextToMessage
  });
}

export function translateGeoxDeviceObservationV1({ observation, targetScope, installation }) {
  const row = object(observation, 'observation');
  const scope = normalizeTargetScope(targetScope);
  if (text(row.tenant_id, 'observation.tenant_id') !== scope.tenantId
    || text(row.project_id, 'observation.project_id') !== scope.projectId
    || text(row.group_id, 'observation.group_id') !== scope.groupId
    || text(row.field_id, 'observation.field_id') !== scope.geoxFieldId) {
    throw new GeoxAdapterError('GEOX_TARGET_SCOPE_MISMATCH', 'device observation does not match configured target scope');
  }
  if (text(row.metric, 'observation.metric') !== 'soil_moisture') {
    throw new GeoxAdapterError('UNSUPPORTED_GEOX_DEVICE_METRIC', 'v0.3 safety probe only addresses GEOX soil_moisture observations');
  }
  if (!installation) {
    throw new GeoxAdapterError(
      'GEOX_SOIL_DEPTH_REQUIRED',
      'GEOX device_observation_index_v1 does not carry soil depth; explicit installation metadata is required'
    );
  }
  const metadata = object(installation, 'installation');
  const fromMm = text(metadata.fromMm, 'installation.fromMm');
  const toMm = text(metadata.toMm, 'installation.toMm');
  const unit = text(metadata.unit, 'installation.unit');
  const semanticId = text(metadata.semanticId, 'installation.semanticId');
  if (semanticId !== 'soil.volumetric_water_content' || unit !== 'm3_per_m3') {
    throw new GeoxAdapterError(
      'GEOX_SOIL_MEASUREMENT_SEMANTICS_REQUIRED',
      'soil_moisture cannot be silently interpreted as ADR VWC; explicit VWC semantic/unit metadata is required'
    );
  }
  return Object.freeze({
    contract_version: 'adr.context-datum.v1',
    datum_id: `geox:${text(row.fact_id, 'observation.fact_id')}:soil-vwc`,
    semantic_id: semanticId,
    value: { type: 'DECIMAL', decimal: String(row.value_num) },
    unit,
    epistemic_class: 'OBSERVATION',
    provenance_class: 'SENSOR',
    effective_interval: {
      start: timestamp(row.observed_at, 'observation.observed_at'),
      end: timestamp(row.observed_at, 'observation.observed_at')
    },
    available_at: timestamp(metadata.retrievedAt, 'installation.retrievedAt'),
    spatial_support: { type: 'FIELD', geometry_ref: scope.adrGeometryRef },
    vertical_support: { from_mm: fromMm, to_mm: toMm },
    temporal_support: { type: 'INSTANT' },
    uncertainty: { type: 'UNKNOWN', reason_code: 'GEOX_CONFIDENCE_NOT_ADR_UNCERTAINTY' },
    source: {
      provider_id: 'GEOX',
      source_ref: `geox:device-observation/${text(row.fact_id, 'observation.fact_id')}`,
      content_hash: sha256(row)
    }
  });
}

export function consumeAdrApplicabilityForGeox({ event, targetScope }) {
  const input = object(event, 'event');
  const scope = normalizeTargetScope(targetScope);
  if (input.contract_version !== GENERIC_RESULT_EVENT_VERSION || input.event_type !== 'APPLICABILITY_PUBLISHED') {
    throw new GeoxAdapterError('INVALID_GEOX_RESULT_EVENT', 'expected adr.result-sink-event.v1 APPLICABILITY_PUBLISHED');
  }
  if (input.projection_hash !== undefined || input.authority_ref === undefined) {
    throw new GeoxAdapterError('GEOX_APPLICABILITY_AUTHORITY_REF_REQUIRED', 'GEOX result sink requires exact ApplicabilityAssessment authority identity');
  }
  const ref = exactWireAuthorityRef(input.authority_ref);
  if (ref.kind !== 'ApplicabilityAssessment') {
    throw new GeoxAdapterError('GEOX_APPLICABILITY_AUTHORITY_REF_REQUIRED', 'authority_ref must be ApplicabilityAssessment');
  }
  const payload = object(input.payload, 'event.payload');
  return Object.freeze({
    contract_version: GEOX_RESULT_SINK_VERSION,
    target: Object.freeze({
      tenant_id: scope.tenantId,
      project_id: scope.projectId,
      group_id: scope.groupId,
      field_id: scope.geoxFieldId,
      ...(scope.seasonId ? { season_id: scope.seasonId } : {})
    }),
    adr_applicability_ref: ref,
    transport_status: text(payload.transport_status, 'event.payload.transport_status'),
    workbench_classification: text(payload.workbench_classification, 'event.payload.workbench_classification'),
    authority_claim: 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY'
  });
}
