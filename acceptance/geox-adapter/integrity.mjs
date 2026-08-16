import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResultSinkEvent
} from '../../sdks/typescript/src/index.mjs';
import {
  consumeAdrApplicabilityForGeox,
  createGeoxTargetContextProvider,
  translateGeoxDeviceObservationV1
} from '../../adapters/geox/src/index.mjs';

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

const SOIL_RETRIEVED_AT = '2026-08-20T09:41:00Z';

function cropFact(overrides = {}) {
  const payload = overrides.payload ?? {};
  return {
    fact_id: overrides.fact_id ?? 'cropctx-geox-integrity',
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
        confidence: 0.99,
        source: 'USER_DECLARED',
        allowed_actions: {
          allow_crop_specific_diagnosis: true,
          allow_crop_specific_prescription: true,
          allow_crop_planning: false
        },
        ...payload
      }
    }
  };
}

function soilObservation(overrides = {}) {
  return {
    tenant_id: targetScope.tenantId,
    project_id: targetScope.projectId,
    group_id: targetScope.groupId,
    field_id: targetScope.geoxFieldId,
    device_id: 'sensor-geox-integrity',
    metric: 'soil_moisture',
    observed_at: '2026-08-20T09:40:00Z',
    observed_at_ts_ms: 1787218800000,
    value_num: 0.314,
    unit: null,
    confidence: 0.96,
    fact_id: 'obs-geox-integrity',
    ...overrides
  };
}

function installation(overrides = {}) {
  return {
    fromMm: '100',
    toMm: '100',
    semanticId: 'soil.volumetric_water_content',
    unit: 'm3_per_m3',
    ...overrides
  };
}

function translateSoil({ observation = soilObservation(), install = installation(), retrievedAt = SOIL_RETRIEVED_AT } = {}) {
  return translateGeoxDeviceObservationV1({
    observation,
    targetScope,
    installation: install,
    retrievedAt
  });
}

function applicabilityRef(kind = 'ApplicabilityAssessment') {
  return {
    kind,
    logical_id: 'assessment-geox-integrity',
    version: '1',
    semantic_hash: 'sha256:assessment-geox-integrity'
  };
}

async function walkFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(path));
    else if (['.mjs', '.js', '.ts', '.json'].includes(extname(entry.name))) output.push(path);
  }
  return output;
}

test('GEOX adapter imports only the public SDK layer and no ADR authority package', async () => {
  const source = await readFile(new URL('../../adapters/geox/src/index.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes("../../../sdks/typescript/src/index.mjs"), true);
  assert.equal(/from\s*['"][^'"]*packages\//.test(source), false);
  assert.equal(/from\s*['"]@adr\/(?!contracts)/.test(source), false);
  assert.equal(source.includes('PERMISSIONS.'), false);
  assert.equal(source.includes('authorize'), false);
});

test('ADR core and public SDK remain free of GEOX MCFT CAP KBS T3R1 semantics', async () => {
  const roots = [
    fileURLToPath(new URL('../../packages/', import.meta.url)),
    fileURLToPath(new URL('../../sdks/typescript/src/', import.meta.url))
  ];
  const forbidden = ['geox', 'mcft', 'kbs', 't3r1'];
  for (const root of roots) {
    for (const file of await walkFiles(root)) {
      const source = (await readFile(file, 'utf8')).toLowerCase();
      for (const token of forbidden) assert.equal(source.includes(token), false, `${file} contains ${token}`);
      assert.equal(/\bcap[-_ ]?\d{1,3}\b/i.test(source), false, `${file} contains CAP-specific semantics`);
    }
  }
});

test('non-GEOX P03 reference integration has no actual import or script dependency on GEOX adapter', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  const referenceRun = await readFile(new URL('../reference-integration/run.mjs', import.meta.url), 'utf8');
  const referenceIntegrity = await readFile(new URL('../reference-integration/integrity.mjs', import.meta.url), 'utf8');
  const referenceAdapter = await readFile(new URL('../../adapters/reference-field-platform/src/index.mjs', import.meta.url), 'utf8');
  const script = String(packageJson.scripts?.['test:reference-integration'] ?? '');
  assert.equal(script.includes('acceptance/reference-integration'), true);
  assert.equal(script.toLowerCase().includes('geox'), false);
  const geoxImport = /(?:from\s*['"][^'"]*adapters\/geox|import\s*['"][^'"]*adapters\/geox)/i;
  for (const source of [referenceRun, referenceIntegrity, referenceAdapter]) {
    assert.equal(geoxImport.test(source), false);
  }
});

test('unsupported crop_context schema version or type fails closed', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  assert.throws(() => provider.cropContextToMessage(cropFact({ schema_version: '2' })),
    (error) => error?.code === 'UNSUPPORTED_GEOX_CROP_CONTEXT_CONTRACT');
  assert.throws(() => provider.cropContextToMessage(cropFact({ type: 'field_program_state_v1' })),
    (error) => error?.code === 'UNSUPPORTED_GEOX_CROP_CONTEXT_CONTRACT');
});

test('unconfirmed GEOX crop context cannot become ADR crop.code authority input', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  for (const status of ['UNKNOWN', 'PLANTED_UNCONFIRMED', 'PRE_PLANT', 'HARVESTED']) {
    assert.throws(() => provider.cropContextToMessage(cropFact({ payload: { status } })),
      (error) => error?.code === 'GEOX_CROP_CONTEXT_NOT_CONFIRMED');
  }
});

test('unknown GEOX crop source cannot silently acquire epistemic or provenance meaning', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  assert.throws(() => provider.cropContextToMessage(cropFact({ payload: { source: 'MAGIC_CONFIDENCE_ENGINE' } })),
    (error) => error?.code === 'UNSUPPORTED_GEOX_CROP_SOURCE');
});

test('GEOX crop target scope is exact across tenant project group field and season', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  for (const payload of [
    { tenant_id: 'tenant-other' },
    { project_id: 'project-other' },
    { group_id: 'group-other' },
    { field_id: 'geox-field-other' },
    { season_id: 'season-other' }
  ]) {
    assert.throws(() => provider.cropContextToMessage(cropFact({ payload })),
      (error) => error?.code === 'GEOX_TARGET_SCOPE_MISMATCH');
  }
});

test('GEOX crop chronology uses actual adapter retrieval time and rejects impossible or future-backwards time', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  assert.throws(() => provider.cropContextToMessage(cropFact({ occurred_at: '2026-02-30T09:00:00Z' })),
    (error) => error?.code === 'INVALID_GEOX_TIME');
  assert.throws(() => provider.cropContextToMessage(cropFact({ retrieved_at: '2026-08-20T09:00:00Z' })),
    (error) => error?.code === 'INVALID_GEOX_CHRONOLOGY');
  assert.throws(() => provider.cropContextToMessage(cropFact({ retrieved_at: '2026-08-20T09:55:00+14:01' })),
    (error) => error?.code === 'INVALID_GEOX_TIME');
});

test('source snapshot hash binds exact GEOX row values before timestamp interpretation', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const utc = provider.cropContextToMessage(cropFact({
    fact_id: 'cropctx-snapshot-same-id',
    occurred_at: '2026-08-20T09:30:00Z'
  }));
  const offset = provider.cropContextToMessage(cropFact({
    fact_id: 'cropctx-snapshot-same-id',
    occurred_at: '2026-08-20T10:30:00+01:00'
  }));
  assert.deepEqual(utc.message.payload.effective_interval, offset.message.payload.effective_interval);
  assert.notEqual(utc.translationAudit.source_snapshot_hash, offset.translationAudit.source_snapshot_hash);
  assert.equal(utc.translationAudit.source_chronology.source_occurred_at, '2026-08-20T09:30:00Z');
  assert.equal(offset.translationAudit.source_chronology.source_occurred_at, '2026-08-20T10:30:00+01:00');
  assert.equal(utc.translationAudit.source_chronology.interpreted_occurred_at, offset.translationAudit.source_chronology.interpreted_occurred_at);
});

test('GEOX confidence and allowed_actions cannot leak into ADR uncertainty runtime legality or decision authority', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const first = provider.cropContextToMessage(cropFact({ payload: { confidence: 0.01 } })).message.payload;
  const second = provider.cropContextToMessage(cropFact({ payload: {
    confidence: 0.999,
    allowed_actions: {
      allow_crop_specific_diagnosis: false,
      allow_crop_specific_prescription: false,
      allow_crop_planning: true
    }
  } })).message.payload;
  assert.deepEqual(first.uncertainty, second.uncertainty);
  assert.equal(first.epistemic_class, second.epistemic_class);
  assert.equal(first.provenance_class, second.provenance_class);
  const serialized = JSON.stringify(second);
  assert.equal(serialized.includes('allowed_actions'), false);
  assert.equal(serialized.includes('RuntimeEligibility'), false);
  assert.equal(serialized.includes('DecisionResult'), false);
});

test('GEOX soil_moisture without explicit installation depth fails instead of becoming root-zone state', () => {
  assert.throws(() => translateGeoxDeviceObservationV1({
    observation: soilObservation(), targetScope, retrievedAt: SOIL_RETRIEVED_AT
  }), (error) => error?.code === 'GEOX_SOIL_DEPTH_REQUIRED');
});

test('GEOX soil measurement requires explicit VWC semantic and unit authority', () => {
  assert.throws(() => translateSoil({ install: installation({ semanticId: 'soil.root_zone_water_status' }) }),
    (error) => error?.code === 'GEOX_SOIL_MEASUREMENT_SEMANTICS_REQUIRED');
  assert.throws(() => translateSoil({ install: installation({ unit: 'percent' }) }),
    (error) => error?.code === 'GEOX_SOIL_MEASUREMENT_SEMANTICS_REQUIRED');
});

test('GEOX nullable/declared observation unit cannot conflict with explicit installation semantics', () => {
  assert.throws(() => translateSoil({ observation: soilObservation({ unit: 'percent' }) }),
    (error) => error?.code === 'GEOX_SOIL_UNIT_CONFLICT');
});

test('GEOX soil depth interval is non-negative ordered and base-10 exact', () => {
  assert.throws(() => translateSoil({ install: installation({ fromMm: '-1', toMm: '100' }) }),
    (error) => error?.code === 'INVALID_GEOX_SOIL_DEPTH');
  assert.throws(() => translateSoil({ install: installation({ fromMm: '100', toMm: '-1' }) }),
    (error) => error?.code === 'INVALID_GEOX_SOIL_DEPTH');
  assert.throws(() => translateSoil({ install: installation({ fromMm: '200', toMm: '100' }) }),
    (error) => error?.code === 'INVALID_GEOX_SOIL_DEPTH');
  assert.throws(() => translateSoil({ install: installation({ fromMm: '1e2' }) }),
    (error) => error?.code === 'INVALID_GEOX_DECIMAL');
});

test('GEOX observation retrieval chronology is separate from installation metadata and must follow observation time', () => {
  assert.equal('retrievedAt' in installation(), false);
  assert.throws(() => translateSoil({ retrievedAt: '2026-08-20T09:39:00Z' }),
    (error) => error?.code === 'INVALID_GEOX_CHRONOLOGY');
  assert.throws(() => translateSoil({ retrievedAt: '2026-02-30T09:41:00Z' }),
    (error) => error?.code === 'INVALID_GEOX_TIME');
  const translated = translateSoil();
  assert.equal(translated.resource.available_at, '2026-08-20T09:41:00.000Z');
  assert.equal(translated.translationAudit.source_chronology.retrieved_at, translated.resource.available_at);
});

test('GEOX soil observation must carry a finite numeric value', () => {
  for (const value of [NaN, Infinity, -Infinity, null, '0.31']) {
    assert.throws(() => translateSoil({ observation: soilObservation({ value_num: value }) }),
      (error) => error?.code === 'INVALID_GEOX_DEVICE_VALUE');
  }
});

test('GEOX ResultSink rejects projection-only or wrong-kind events', () => {
  const projection = createResultSinkEvent({
    eventId: 'geox-projection-only',
    eventType: 'APPLICABILITY_PUBLISHED',
    projectionHash: 'sha256:projection-only',
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  assert.throws(() => consumeAdrApplicabilityForGeox({ event: projection, targetScope }),
    (error) => error?.code === 'GEOX_APPLICABILITY_AUTHORITY_REF_REQUIRED');

  const wrongKind = createResultSinkEvent({
    eventId: 'geox-wrong-kind',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: applicabilityRef('ContextDatum'),
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  assert.throws(() => consumeAdrApplicabilityForGeox({ event: wrongKind, targetScope }),
    (error) => error?.code === 'GEOX_APPLICABILITY_AUTHORITY_REF_REQUIRED');
});

test('first-party GEOX adapter output carries no special scientific/runtime authority claim', () => {
  const provider = createGeoxTargetContextProvider({ targetScope });
  const translated = provider.cropContextToMessage(cropFact());
  assert.equal(translated.translationAudit.authority_claim, 'NONE_TRANSLATION_AUDIT_ONLY');
  const event = createResultSinkEvent({
    eventId: 'geox-result-authority-boundary',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: applicabilityRef(),
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  const output = consumeAdrApplicabilityForGeox({ event, targetScope });
  assert.equal(output.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');
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
console.log(`P04 GEOX adapter integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
