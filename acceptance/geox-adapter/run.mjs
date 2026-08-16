import assert from 'node:assert/strict';
import {
  createAdrPilotClient,
  createResultSinkEvent
} from '../../sdks/typescript/src/index.mjs';
import { publishContextDatum } from '../../packages/context-contract/src/index.mjs';
import {
  GEOX_COMPATIBILITY_BASELINE,
  consumeAdrApplicabilityForGeox,
  createGeoxTargetContextProvider
} from '../../adapters/geox/src/index.mjs';
import {
  audit,
  publishManifest,
  writeAuthorization
} from '../context-manifest/fixtures.mjs';
import {
  assess,
  createApplicabilityWorld
} from '../applicability/fixture.mjs';
import {
  createInspectionAuthorization,
  createWorkbenchPrincipal,
  projectCase
} from '../workbench/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const targetScope = Object.freeze({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  groupId: 'group-a',
  geoxFieldId: 'geox-field-17',
  adrGeometryRef: 'field-1',
  seasonId: 'season-2026'
});

function geoxCropFact(overrides = {}) {
  const payloadOverrides = overrides.payload ?? {};
  return {
    fact_id: overrides.fact_id ?? 'cropctx-geox-17',
    occurred_at: overrides.occurred_at ?? '2026-08-20T09:30:00Z',
    retrieved_at: overrides.retrieved_at ?? '2026-08-20T09:55:00Z',
    source: overrides.source ?? 'crop_context_service',
    record_json: {
      type: overrides.type ?? 'crop_context_v1',
      schema_version: overrides.schema_version ?? '1',
      payload: {
        tenant_id: targetScope.tenantId,
        project_id: targetScope.projectId,
        group_id: targetScope.groupId,
        field_id: targetScope.geoxFieldId,
        season_id: targetScope.seasonId,
        status: 'PLANTED_CONFIRMED',
        crop_code: 'maize',
        crop_stage: 'V8',
        variety_code: 'P0306Q',
        planting_date: '2026-07-05',
        confidence: 0.97,
        source: 'USER_DECLARED',
        allowed_actions: {
          allow_crop_specific_diagnosis: true,
          allow_crop_specific_prescription: true,
          allow_crop_planning: false
        },
        ...payloadOverrides
      }
    }
  };
}

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

function coreValueFromWire(value) {
  switch (value.type) {
    case 'CATEGORY': return { type: value.type, category: value.category };
    case 'DECIMAL': return { type: value.type, decimal: value.decimal };
    case 'INTEGER': return { type: value.type, integer: value.integer };
    case 'STRING': return { type: value.type, string: value.string };
    default: throw new Error(`unsupported P04 GEOX value type ${value.type}`);
  }
}

function coreUncertaintyFromWire(value) {
  if (value.type === 'NONE') return { type: 'NONE' };
  if (value.type === 'UNKNOWN') return { type: 'UNKNOWN', reasonCode: value.reason_code };
  throw new Error(`unsupported P04 GEOX uncertainty ${value.type}`);
}

function coreDatumFromWire(resource) {
  return {
    contractVersion: resource.contract_version,
    semanticId: resource.semantic_id,
    value: coreValueFromWire(resource.value),
    unit: resource.unit,
    epistemicClass: resource.epistemic_class,
    provenanceClass: resource.provenance_class,
    effectiveInterval: {
      start: resource.effective_interval.start,
      end: resource.effective_interval.end
    },
    availableAt: resource.available_at,
    spatialSupport: {
      type: resource.spatial_support.type,
      geometryRef: resource.spatial_support.geometry_ref
    },
    verticalSupport: resource.vertical_support === null ? null : {
      fromMm: resource.vertical_support.from_mm,
      toMm: resource.vertical_support.to_mm
    },
    temporalSupport: { type: resource.temporal_support.type },
    uncertainty: coreUncertaintyFromWire(resource.uncertainty),
    source: {
      providerId: resource.source.provider_id,
      sourceRef: resource.source.source_ref,
      contentHash: resource.source.content_hash
    }
  };
}

async function publishGeoxCropThroughSdk(label, fact = geoxCropFact()) {
  const base = createApplicabilityWorld(`p04-${label}`, { includeCrop: false });
  const provider = createGeoxTargetContextProvider({ targetScope });
  const translated = provider.cropContextToMessage(fact);
  const logicalId = `context-datum.geox.${label}.crop`;
  const providerPrincipal = {
    principalId: `geox-context-provider-${label}`,
    type: 'SERVICE_ACCOUNT',
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    programIds: ['pilot-a']
  };
  const contextWrite = writeAuthorization(
    base.env.ledger,
    logicalId,
    'CONTEXT_DATUM',
    providerPrincipal,
    { assignmentLogicalId: `role-p04-geox-context-${label}` }
  );
  let request;
  let publishedDatum;
  const client = createAdrPilotClient({
    principal: {
      principal_id: providerPrincipal.principalId,
      type: providerPrincipal.type,
      organization_id: providerPrincipal.organizationId,
      tenant_id: providerPrincipal.tenantId,
      program_ids: providerPrincipal.programIds
    },
    getAccessToken: () => 'geox-first-party-test-token',
    transport: async (value) => {
      request = value;
      assert.deepEqual(value.body.authorization_decision_ref, toWireRef(contextWrite.recorded.ref));
      publishedDatum = publishContextDatum({
        ledger: base.env.ledger,
        logicalId: value.body.logical_id,
        version: value.body.version,
        target: {
          organizationId: providerPrincipal.organizationId,
          tenantId: providerPrincipal.tenantId
        },
        datum: coreDatumFromWire(value.body.resource),
        principal: providerPrincipal,
        authorizationDecisionAuditRef: contextWrite.recorded.ref,
        audit: audit(providerPrincipal, `p04-geox-publish-${label}`, '2026-08-20T09:56:00Z')
      });
      return { ref: toWireRef(publishedDatum.ref), resource: value.body.resource };
    }
  });
  const response = await client.createContextDatum({
    logicalId,
    version: '1',
    authorizationDecisionRef: toWireRef(contextWrite.recorded.ref),
    resource: translated.message.payload,
    idempotencyKey: `geox-crop-${label}`
  });
  assert.deepEqual(response.ref, toWireRef(publishedDatum.ref));
  return { base, provider, translated, request, response, publishedDatum, contextWrite };
}

async function createGeoxGateAWorld(label) {
  const sdk = await publishGeoxCropThroughSdk(label);
  const manifest = publishManifest(sdk.base.env.ledger, {
    logicalId: `manifest.p04.${label}`,
    decisionProblem: sdk.base.decision,
    datumRefs: [sdk.publishedDatum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const assessment = assess(sdk.base, {
    logicalId: `applicability.p04.${label}`,
    manifest
  });
  const world = { ...sdk.base, manifest, assessment };
  const { principal, role } = createWorkbenchPrincipal(world, {
    principalId: `agronomist-p04-${label}`
  });
  world.workbenchPrincipal = principal;
  world.workbenchRole = role;
  const inspection = createInspectionAuthorization(world);
  world.inspection = inspection;
  world.inspectionAuthorizations = [{
    knowledgeRef: assessment.semanticPayload.knowledgeRef,
    authorizationDecisionAuditRef: inspection.recorded.ref
  }];
  const workbenchCase = projectCase(world);
  world.workbenchCase = workbenchCase;
  return { world, sdk, manifest, assessment, workbenchCase };
}

test('GEOX first-party crop adapter is pinned to the verified upstream repository baseline and exact crop contract', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const translated = provider.cropContextToMessage(geoxCropFact());
  assert.equal(provider.compatibilityBaseline, GEOX_COMPATIBILITY_BASELINE);
  assert.equal(translated.translationAudit.source_contract, 'crop_context_v1@1');
  assert.equal(translated.translationAudit.source_contract_repository_baseline, GEOX_COMPATIBILITY_BASELINE);
});

test('confirmed GEOX crop_context_v1 maps to crop.code without promoting GEOX confidence or allowed_actions', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const { message, translationAudit } = provider.cropContextToMessage(geoxCropFact());
  assert.equal(message.role, 'CONTEXT_PROVIDER');
  assert.equal(message.payload.semantic_id, 'crop.code');
  assert.deepEqual(message.payload.value, { type: 'CATEGORY', category: 'maize' });
  assert.equal(message.payload.epistemic_class, 'ASSERTION');
  assert.equal(message.payload.provenance_class, 'USER');
  assert.deepEqual(message.payload.uncertainty, { type: 'UNKNOWN', reason_code: 'GEOX_CONFIDENCE_NOT_ADR_UNCERTAINTY' });
  assert.equal(message.payload.available_at, '2026-08-20T09:55:00.000Z');
  const semanticWire = JSON.stringify(message.payload);
  assert.equal(semanticWire.includes('0.97'), false);
  assert.equal(semanticWire.includes('allowed_actions'), false);
  assert.ok(translationAudit.deliberately_not_mapped.some((entry) => entry.includes('confidence')));
  assert.ok(translationAudit.deliberately_not_mapped.some((entry) => entry.includes('allowed_actions')));
  assert.equal(translationAudit.authority_claim, 'NONE_TRANSLATION_AUDIT_ONLY');
});

test('GEOX source class changes provenance/epistemic class explicitly and never upgrades inferred crop to observation', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const declared = provider.cropContextToMessage(geoxCropFact()).message.payload;
  const inferred = provider.cropContextToMessage(geoxCropFact({ payload: { source: 'SENSOR_INFERRED' } })).message.payload;
  assert.equal(declared.epistemic_class, 'ASSERTION');
  assert.equal(declared.provenance_class, 'USER');
  assert.equal(inferred.epistemic_class, 'DERIVED');
  assert.equal(inferred.provenance_class, 'SENSOR');
  assert.notEqual(inferred.epistemic_class, 'OBSERVATION');
});

test('P02 SDK publishes the exact GEOX-originated ContextDatum authority used downstream', async () => {
  const result = await publishGeoxCropThroughSdk('sdk-continuity');
  assert.equal(result.request.path, '/v1/context-data');
  assert.equal(result.request.headers.Authorization, 'Bearer geox-first-party-test-token');
  assert.deepEqual(result.response.ref, toWireRef(result.publishedDatum.ref));
  assert.equal(result.publishedDatum.semanticPayload.source.providerId, 'GEOX');
  assert.equal(result.publishedDatum.semanticPayload.epistemicClass, 'ASSERTION');
});

test('GEOX crop ContextProvider closes the existing Gate-A applicability/workbench path without special authority', async () => {
  const result = await createGeoxGateAWorld('gate-a');
  assert.equal(result.manifest.semanticPayload.datumRefs[0].semanticHash, result.sdk.publishedDatum.ref.semanticHash);
  assert.equal(result.assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(result.assessment.semanticPayload.scientificUseStatus, 'QUALIFIED');
  assert.equal(result.assessment.semanticPayload.decisionRelevance, 'MATERIAL');
  assert.equal(result.workbenchCase.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(result.workbenchCase.reviewRequired, false);
});

test('GEOX ResultSink consumes exact ApplicabilityAssessment identity without creating ADR authority', async () => {
  const result = await createGeoxGateAWorld('result-sink');
  const before = result.world.env.ledger.exportSnapshot().records.length;
  const event = createResultSinkEvent({
    eventId: 'geox-applicability-result-1',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: toWireRef(result.assessment.ref),
    payload: {
      transport_status: result.assessment.semanticPayload.transportStatus,
      workbench_classification: result.workbenchCase.classification
    }
  });
  const projected = consumeAdrApplicabilityForGeox({ event, targetScope });
  const after = result.world.env.ledger.exportSnapshot().records.length;
  assert.deepEqual(projected.adr_applicability_ref, toWireRef(result.assessment.ref));
  assert.equal(projected.target.field_id, targetScope.geoxFieldId);
  assert.equal(projected.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');
  assert.equal(after, before);
});

test('explicit shallow GEOX VWC installation stays shallow and cannot become root-zone state', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const translated = provider.deviceObservationToMessage({
    observation: {
      tenant_id: targetScope.tenantId,
      project_id: targetScope.projectId,
      group_id: targetScope.groupId,
      field_id: targetScope.geoxFieldId,
      device_id: 'sensor-geox-9',
      metric: 'soil_moisture',
      observed_at: '2026-08-20T09:40:00Z',
      observed_at_ts_ms: 1787218800000,
      value_num: 0.314,
      unit: 'm3_per_m3',
      confidence: 0.96,
      fact_id: 'obs-geox-9'
    },
    installation: {
      fromMm: '100',
      toMm: '100',
      semanticId: 'soil.volumetric_water_content',
      unit: 'm3_per_m3',
      retrievedAt: '2026-08-20T09:41:00Z'
    }
  });
  assert.equal(translated.message.payload.semantic_id, 'soil.volumetric_water_content');
  assert.deepEqual(translated.message.payload.vertical_support, { from_mm: '100', to_mm: '100' });
  assert.equal(JSON.stringify(translated.message.payload).toLowerCase().includes('root-zone'), false);
  assert.ok(translated.translationAudit.deliberately_not_mapped.some((entry) => entry.includes('root-zone')));
});

test('GEOX adapter success does not fabricate runtime legality or decision authority', async () => {
  const result = await createGeoxGateAWorld('nonclaim');
  const kinds = new Set(result.world.env.ledger.exportSnapshot().records.map((record) => record.ref.kind));
  for (const forbidden of ['RuntimeEligibility', 'RuntimeBinding', 'DecisionRobustness', 'DecisionResult']) {
    assert.equal(kinds.has(forbidden), false, forbidden);
  }
  assert.equal(kinds.has('ApplicabilityAssessment'), true);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`P04 GEOX first-party adapter acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
