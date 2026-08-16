import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createResultSinkEvent
} from '../../sdks/typescript/src/index.mjs';
import {
  consumeReferenceApplicabilityResult,
  createReferenceFieldPlatformContextProvider
} from '../../adapters/reference-field-platform/src/index.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const mapping = {
  sourcePlotKey: 'plot-independent-1',
  sourceMetricCode: 'CUSTOMER_CROP_LABEL',
  semanticId: 'crop.code',
  unit: '1',
  valueType: 'CATEGORY',
  geometryRef: 'field-1'
};

const record = {
  plot_key: 'plot-independent-1',
  reading_key: 'reading-independent-1',
  metric_code: 'CUSTOMER_CROP_LABEL',
  raw_value: 'maize',
  observed_from: '2026-08-20T09:00:00Z',
  observed_to: '2026-08-20T10:00:00Z',
  released_at: '2026-08-20T09:55:00Z',
  content_hash: 'sha256:reference-independent-1'
};

function exactRef(kind = 'ApplicabilityAssessment') {
  return {
    kind,
    logical_id: 'assessment.reference-1',
    version: '1',
    semantic_hash: 'sha256:assessment-reference-1'
  };
}

test('reference adapter depends on the public SDK integration layer and no ADR internal authority package', async () => {
  const source = await readFile(new URL('../../adapters/reference-field-platform/src/index.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes("../../../sdks/typescript/src/index.mjs"), true);
  assert.equal(/from\s*['"][^'"]*packages\//.test(source), false);
  assert.equal(/from\s*['"]@adr\/(?!contracts)/.test(source), false);
  assert.equal(/from\s*['"]@agronomy-runtime\/(?!contracts)/.test(source), false);
  assert.equal(/from\s*['"]@agronomy-deployment-runtime\/(?!contracts)/.test(source), false);
});

test('reference adapter contains no first-party runtime/schema coupling tokens', async () => {
  const source = (await readFile(new URL('../../adapters/reference-field-platform/src/index.mjs', import.meta.url), 'utf8')).toLowerCase();
  for (const token of ['geox', 'mcft', 'kbs', 't3r1']) assert.equal(source.includes(token), false, token);
  assert.equal(/\bcap[-_ ]?\d{1,3}\b/i.test(source), false);
});

test('root reference-integration test path is not coupled to a first-party adapter directory', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  const script = String(manifest.scripts?.['test:reference-integration'] ?? '');
  assert.notEqual(script.length, 0);
  assert.equal(script.includes('acceptance/reference-integration'), true);
  assert.equal(script.toLowerCase().includes('adapters/geox'), false);
  assert.equal(String(manifest.scripts?.test ?? '').toLowerCase().includes('adapters/geox'), false);
});

test('reference ContextProvider rejects missing source data rather than defaulting it', () => {
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: mapping });
  const missing = { ...record };
  delete missing.raw_value;
  assert.throws(() => provider.toContextMessage(missing), (error) => error?.code === 'INVALID_REFERENCE_INPUT');
});

test('reference ContextProvider rejects a record from another configured plot scope', () => {
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: mapping });
  assert.throws(() => provider.toContextMessage({ ...record, plot_key: 'plot-other-9' }),
    (error) => error?.code === 'REFERENCE_SOURCE_SCOPE_MISMATCH');
});

test('reference ContextProvider rejects a different source metric from the same plot', () => {
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: mapping });
  assert.throws(() => provider.toContextMessage({ ...record, metric_code: 'CUSTOMER_SOIL_MOISTURE' }),
    (error) => error?.code === 'REFERENCE_SOURCE_METRIC_MISMATCH');
});

test('reference ContextProvider rejects ungoverned value-type reinterpretation', () => {
  assert.throws(() => createReferenceFieldPlatformContextProvider({
    contextMapping: { ...mapping, valueType: 'AUTO_INFER' }
  }), (error) => error?.code === 'UNSUPPORTED_REFERENCE_VALUE_TYPE');
});

test('reference source content must carry explicit content identity', () => {
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: mapping });
  assert.throws(() => provider.toContextMessage({ ...record, content_hash: 'mutable-locator-only' }),
    (error) => error?.code === 'INVALID_REFERENCE_CONTENT_HASH');
});

test('applicability consumer rejects non-authority projection events', () => {
  const event = createResultSinkEvent({
    eventId: 'projection-1',
    eventType: 'APPLICABILITY_PUBLISHED',
    projectionHash: 'sha256:projection-only',
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  assert.throws(() => consumeReferenceApplicabilityResult(event),
    (error) => error?.code === 'APPLICABILITY_AUTHORITY_REF_REQUIRED');
});

test('applicability consumer rejects another authority kind masquerading as applicability', () => {
  const event = createResultSinkEvent({
    eventId: 'wrong-kind-1',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: exactRef('ContextDatum'),
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  assert.throws(() => consumeReferenceApplicabilityResult(event),
    (error) => error?.code === 'APPLICABILITY_AUTHORITY_REF_REQUIRED');
});

test('reference consumer output does not claim recommendation runtime legality or decision authority', () => {
  const event = createResultSinkEvent({
    eventId: 'assessment-1',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: exactRef(),
    payload: { transport_status: 'DIRECTLY_APPLICABLE', workbench_classification: 'NO_REVIEW_CANDIDATE' }
  });
  const output = consumeReferenceApplicabilityResult(event);
  const serialized = JSON.stringify(output);
  assert.equal(output.authorityClaim, 'NONE_TRANSPORT_CONSUMER_ONLY');
  for (const forbidden of ['RuntimeEligibility', 'RuntimeBinding', 'DecisionResult', 'recommendation']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
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
console.log(`P03 reference integration integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
