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

const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const DECIMAL_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

function timestamp(value, name) {
  const input = text(value, name);
  const match = RFC3339_RE.exec(input);
  if (!match) {
    throw new GeoxAdapterError('INVALID_GEOX_TIME', `${name} must be RFC3339 with explicit timezone and <= millisecond precision`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) || hour > 23 || minute > 59 || second > 59) {
    throw new GeoxAdapterError('INVALID_GEOX_TIME', `${name} contains an impossible calendar date or clock time`);
  }
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new GeoxAdapterError('INVALID_GEOX_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) throw new GeoxAdapterError('INVALID_GEOX_TIME', `${name} must be a valid RFC3339 timestamp`);
  return parsed.toISOString();
}

function decimal(value, name) {
  const input = typeof value === 'number' ? String(value) : text(value, name);
  if (!DECIMAL_RE.test(input)) throw new GeoxAdapterError('INVALID_GEOX_DECIMAL', `${name} must be a base-10 decimal without exponent notation`);
  const negative = input.startsWith('-');
  const unsigned = negative ? input.slice(1) : input;
  const [integer, rawFraction = ''] = unsigned.split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  if (/^0(?:\.0*)?$/.test(normalized)) return '0';
  return negative ? `-${normalized}` : normalized;
}

function compareDecimal(left, right) {
  const parse = (input) => {
    const normalized = decimal(input, 'decimal');
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [integer, fraction = ''] = unsigned.split('.');
    return { negative, integer, fraction };
  };
  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.fraction.length, b.fraction.length);
  const ai = BigInt(`${a.negative ? '-' : ''}${a.integer}${a.fraction.padEnd(scale, '0')}`);
  const bi = BigInt(`${b.negative ? '-' : ''}${b.integer}${b.fraction.padEnd(scale, '0')}`);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
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

function validateCropScope(payload, scope) {
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
  validateCropScope(payload, scope);
  if (text(payload.status, 'crop_context.payload.status') !== 'PLANTED_CONFIRMED') {
    throw new GeoxAdapterError(
      'GEOX_CROP_CONTEXT_NOT_CONFIRMED',
      'v0.3 first-party adapter only exposes crop.code from PLANTED_CONFIRMED crop context'
    );
  }
  const cropCode = text(payload.crop_code, 'crop_context.payload.crop_code');
  const source = text(payload.source, 'crop_context.payload.source');
  const sourceTranslation = CROP_SOURCE_TRANSLATION[source];
  if (!sourceTranslation) throw new GeoxAdapterError('UNSUPPORTED_GEOX_CROP_SOURCE', `unsupported crop context source ${source}`);
  const occurredAt = timestamp(fact.occurred_at, 'cropContextFact.occurred_at');
  const retrievedAt = timestamp(fact.retrieved_at, 'cropContextFact.retrieved_at');
  if (retrievedAt < occurredAt) {
    throw new GeoxAdapterError('INVALID_GEOX_CHRONOLOGY', 'cropContextFact.retrieved_at cannot precede occurred_at');
  }
  const sourceSnapshot = {
    fact_id: text(fact.fact_id, 'cropContextFact.fact_id'),
    occurred_at: occurredAt,
    source: text(fact.source, 'cropContextFact.source'),
    record_json: clone(record)
  };
  return Object.freeze({
    factId: sourceSnapshot.fact_id,
    occurredAt,
    retrievedAt,
    record: clone(record),
    payload: clone(payload),
    cropCode,
    source,
    sourceTranslation,
    sourceSnapshotHash: sha256(sourceSnapshot)
  });
}

function cropTranslationAudit({ normalized, scope }) {
  const auditPayload = {
    contract_version: GEOX_FIRST_PARTY_ADAPTER_VERSION,
    source_system: 'GEOX',
    source_contract: GEOX_CROP_CONTEXT_CONTRACT,
    source_contract_repository_baseline: GEOX_COMPATIBILITY_BASELINE,
    source_ref: `geox:facts/${normalized.factId}`,
    source_snapshot_hash: normalized.sourceSnapshotHash,
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
      { source: 'adapter.retrieved_at', target: 'available_at', mode: 'ACTUAL_RETRIEVAL_TIME' },
      { source: 'record_json.payload.field_id', target: 'spatial_support.geometry_ref', mode: 'EXPLICIT_IDENTITY_MAPPING', mapped_value: scope.adrGeometryRef }
    ],
    deliberately_not_mapped: [
      'record_json.payload.confidence -> ADR uncertainty/scientific qualification',
      'record_json.payload.allowed_actions -> ADR runtime/decision authority',
      'record_json.payload.variety_code -> crop.code',
      'record_json.payload.crop_stage -> crop.code'
    ],
    source_chronology_note: 'GEOX facts has no ingested_at column; retrieved_at is supplied by the adapter read boundary and preserved as actual ADR available_at',
    authority_claim: 'NONE_TRANSLATION_AUDIT_ONLY'
  };
  return Object.freeze({ ...auditPayload, audit_hash: sha256(auditPayload) });
}

function soilTranslationAudit({ row, scope, metadata, observedAt, retrievedAt, valueDecimal, fromMm, toMm }) {
  const payload = {
    contract_version: GEOX_FIRST_PARTY_ADAPTER_VERSION,
    source_system: 'GEOX',
    source_contract: GEOX_DEVICE_OBSERVATION_CONTRACT,
    source_contract_repository_baseline: GEOX_COMPATIBILITY_BASELINE,
    source_ref: `geox:device-observation/${text(row.fact_id, 'observation.fact_id')}`,
    source_snapshot_hash: sha256(row),
    source_scope: {
      tenant_id: scope.tenantId,
      project_id: scope.projectId,
      group_id: scope.groupId,
      field_id: scope.geoxFieldId,
      device_id: text(row.device_id, 'observation.device_id')
    },
    target_semantic_id: 'soil.volumetric_water_content',
    mappings: [
      { source: 'value_num', target: 'value.decimal', mode: 'EXACT_NUMERIC_REPRESENTATION', mapped_value: valueDecimal },
      { source: 'observed_at', target: 'effective_interval', mode: 'EXACT_INSTANT', mapped_value: observedAt },
      { source: 'adapter.retrieved_at', target: 'available_at', mode: 'ACTUAL_RETRIEVAL_TIME', mapped_value: retrievedAt },
      { source: 'installation.depth_mm', target: 'vertical_support', mode: 'EXPLICIT_INSTALLATION_METADATA', mapped_value: { from_mm: fromMm, to_mm: toMm } },
      { source: 'installation.semantic_id/unit', target: 'semantic_id/unit', mode: 'EXPLICIT_MEASUREMENT_SEMANTICS', mapped_value: { semantic_id: metadata.semanticId, unit: metadata.unit } },
      { source: 'field_id', target: 'spatial_support.geometry_ref', mode: 'EXPLICIT_IDENTITY_MAPPING', mapped_value: scope.adrGeometryRef }
    ],
    deliberately_not_mapped: [
      'confidence -> ADR uncertainty/scientific qualification',
      'soil_moisture -> root-zone state',
      'nullable GEOX unit -> inferred VWC unit'
    ],
    authority_claim: 'NONE_TRANSLATION_AUDIT_ONLY'
  };
  return Object.freeze({ ...payload, audit_hash: sha256(payload) });
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
        available_at: normalized.retrievedAt,
        spatial_support: { type: 'FIELD', geometry_ref: scope.adrGeometryRef },
        vertical_support: null,
        temporal_support: { type: 'INSTANT' },
        uncertainty: { type: 'UNKNOWN', reason_code: 'GEOX_CONFIDENCE_NOT_ADR_UNCERTAINTY' },
        source: {
          provider_id: 'GEOX',
          source_ref: `geox:facts/${normalized.factId}`,
          content_hash: normalized.sourceSnapshotHash
        }
      }
    });
    return Object.freeze({ message, translationAudit: cropTranslationAudit({ normalized, scope }) });
  }

  function deviceObservationToMessage({ observation, installation }) {
    const translated = translateGeoxDeviceObservationV1({ observation, targetScope: scope, installation });
    return Object.freeze({
      message: createIntegrationMessage({
        role: 'CONTEXT_PROVIDER',
        messageType: 'CONTEXT_DATUM_AVAILABLE',
        messageId: `geox-device-observation:${text(observation.fact_id, 'observation.fact_id')}`,
        authorityRefs: [],
        payload: translated.resource
      }),
      translationAudit: translated.translationAudit
    });
  }

  return Object.freeze({
    adapterVersion: GEOX_FIRST_PARTY_ADAPTER_VERSION,
    compatibilityBaseline: GEOX_COMPATIBILITY_BASELINE,
    targetScope: scope,
    cropContextToMessage,
    deviceObservationToMessage
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
  const metadataInput = object(installation, 'installation');
  const metadata = Object.freeze({
    fromMm: decimal(metadataInput.fromMm, 'installation.fromMm'),
    toMm: decimal(metadataInput.toMm, 'installation.toMm'),
    unit: text(metadataInput.unit, 'installation.unit'),
    semanticId: text(metadataInput.semanticId, 'installation.semanticId'),
    retrievedAt: timestamp(metadataInput.retrievedAt, 'installation.retrievedAt')
  });
  if (compareDecimal(metadata.fromMm, metadata.toMm) > 0) {
    throw new GeoxAdapterError('INVALID_GEOX_SOIL_DEPTH', 'installation.fromMm cannot exceed installation.toMm');
  }
  if (metadata.semanticId !== 'soil.volumetric_water_content' || metadata.unit !== 'm3_per_m3') {
    throw new GeoxAdapterError(
      'GEOX_SOIL_MEASUREMENT_SEMANTICS_REQUIRED',
      'soil_moisture cannot be silently interpreted as ADR VWC; explicit VWC semantic/unit metadata is required'
    );
  }
  if (row.unit !== undefined && row.unit !== null && text(row.unit, 'observation.unit') !== metadata.unit) {
    throw new GeoxAdapterError('GEOX_SOIL_UNIT_CONFLICT', 'GEOX observation unit conflicts with explicit installation measurement semantics');
  }
  const observedAt = timestamp(row.observed_at, 'observation.observed_at');
  if (metadata.retrievedAt < observedAt) {
    throw new GeoxAdapterError('INVALID_GEOX_CHRONOLOGY', 'installation.retrievedAt cannot precede observation.observed_at');
  }
  if (typeof row.value_num !== 'number' || !Number.isFinite(row.value_num)) {
    throw new GeoxAdapterError('INVALID_GEOX_DEVICE_VALUE', 'observation.value_num must be a finite number');
  }
  const valueDecimal = decimal(row.value_num, 'observation.value_num');
  const resource = Object.freeze({
    contract_version: 'adr.context-datum.v1',
    datum_id: `geox:${text(row.fact_id, 'observation.fact_id')}:soil-vwc`,
    semantic_id: metadata.semanticId,
    value: { type: 'DECIMAL', decimal: valueDecimal },
    unit: metadata.unit,
    epistemic_class: 'OBSERVATION',
    provenance_class: 'SENSOR',
    effective_interval: { start: observedAt, end: observedAt },
    available_at: metadata.retrievedAt,
    spatial_support: { type: 'FIELD', geometry_ref: scope.adrGeometryRef },
    vertical_support: { from_mm: metadata.fromMm, to_mm: metadata.toMm },
    temporal_support: { type: 'INSTANT' },
    uncertainty: { type: 'UNKNOWN', reason_code: 'GEOX_CONFIDENCE_NOT_ADR_UNCERTAINTY' },
    source: {
      provider_id: 'GEOX',
      source_ref: `geox:device-observation/${text(row.fact_id, 'observation.fact_id')}`,
      content_hash: sha256(row)
    }
  });
  return Object.freeze({
    resource,
    translationAudit: soilTranslationAudit({
      row,
      scope,
      metadata,
      observedAt,
      retrievedAt: metadata.retrievedAt,
      valueDecimal,
      fromMm: metadata.fromMm,
      toMm: metadata.toMm
    })
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
