import assert from 'node:assert/strict';
import {
  createAdrPilotClient,
  createResultSinkEvent
} from '../../sdks/typescript/src/index.mjs';
import { publishContextDatum } from '../../packages/context-contract/src/index.mjs';
import {
  REFERENCE_FIELD_PLATFORM_ID,
  consumeReferenceApplicabilityResult,
  createReferenceFieldPlatformContextProvider
} from '../../adapters/reference-field-platform/src/index.mjs';
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

const customerRecord = Object.freeze({
  plot_key: 'north-plot-774',
  reading_key: 'reading-00017',
  metric_code: 'CUSTOMER_CROP_LABEL_V2',
  raw_value: 'maize',
  observed_from: '2026-08-20T09:00:00Z',
  observed_to: '2026-08-20T10:00:00Z',
  released_at: '2026-08-20T09:55:00Z',
  content_hash: 'sha256:customer-reading-00017'
});

const cropMapping = Object.freeze({
  sourcePlotKey: 'north-plot-774',
  sourceMetricCode: 'CUSTOMER_CROP_LABEL_V2',
  semanticId: 'crop.code',
  unit: '1',
  valueType: 'CATEGORY',
  geometryRef: 'field-1',
  epistemicClass: 'OBSERVATION',
  provenanceClass: 'EXTERNAL_PROVIDER'
});

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

function referenceProviderMessage() {
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: cropMapping });
  return provider.toContextMessage(customerRecord);
}

function coreValueFromWire(value) {
  switch (value.type) {
    case 'CATEGORY': return { type: value.type, category: value.category };
    case 'DECIMAL': return { type: value.type, decimal: value.decimal };
    case 'INTEGER': return { type: value.type, integer: value.integer };
    case 'STRING': return { type: value.type, string: value.string };
    default: throw new Error(`unsupported P03 reference value type ${value.type}`);
  }
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
    uncertainty: { type: resource.uncertainty.type },
    source: {
      providerId: resource.source.provider_id,
      sourceRef: resource.source.source_ref,
      contentHash: resource.source.content_hash
    }
  };
}

async function publishReferenceContextThroughSdk(label) {
  const base = createApplicabilityWorld(`p03-${label}`, { includeCrop: false });
  const message = referenceProviderMessage();
  const logicalId = `context-datum.reference.${label}.reading-00017`;
  const providerPrincipal = {
    principalId: `reference-context-provider-${label}`,
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
    { assignmentLogicalId: `role-p03-reference-context-${label}` }
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
    getAccessToken: () => 'reference-provider-test-token',
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
        audit: audit(providerPrincipal, `p03-reference-publish-${label}`, '2026-08-20T09:56:00Z')
      });
      return {
        ref: toWireRef(publishedDatum.ref),
        resource: value.body.resource
      };
    }
  });
  const response = await client.createContextDatum({
    logicalId,
    version: '1',
    authorizationDecisionRef: toWireRef(contextWrite.recorded.ref),
    resource: message.payload,
    idempotencyKey: `reference-reading-00017-${label}`
  });
  assert.deepEqual(response.ref, toWireRef(publishedDatum.ref));
  return { base, message, request, response, publishedDatum, contextWrite, providerPrincipal };
}

async function createReferenceGateAWorld(label = 'reference-direct') {
  const sdk = await publishReferenceContextThroughSdk(label);
  const { base, publishedDatum } = sdk;
  const manifest = publishManifest(base.env.ledger, {
    logicalId: `manifest.p03.${label}`,
    decisionProblem: base.decision,
    datumRefs: [publishedDatum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const assessment = assess(base, {
    logicalId: `applicability.p03.${label}`,
    manifest
  });
  const world = { ...base, manifest, assessment };
  const { principal, role } = createWorkbenchPrincipal(world, {
    principalId: `agronomist-p03-${label}`
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
  return { world, sdk, providerDatum: publishedDatum, manifest, assessment, workbenchCase };
}

test('reference ContextProvider maps a customer-like schema only through explicit representation rules', () => {
  const message = referenceProviderMessage();
  assert.equal(message.role, 'CONTEXT_PROVIDER');
  assert.equal(message.message_type, 'CONTEXT_DATUM_AVAILABLE');
  assert.equal(message.payload.contract_version, 'adr.context-datum.v1');
  assert.equal(message.payload.semantic_id, 'crop.code');
  assert.deepEqual(message.payload.value, { type: 'CATEGORY', category: 'maize' });
  assert.equal(message.payload.unit, '1');
  assert.equal(message.payload.source.provider_id, REFERENCE_FIELD_PLATFORM_ID);
  assert.equal(message.payload.source.source_ref, 'reading-00017');
  assert.equal(JSON.stringify(message).includes('CUSTOMER_CROP_LABEL_V2'), false);
});

test('customer metric names cannot infer ADR semantic identity', () => {
  const first = referenceProviderMessage();
  const second = createReferenceFieldPlatformContextProvider({
    contextMapping: { ...cropMapping, semanticId: 'customer.experimental.label' }
  }).toContextMessage(customerRecord);
  assert.equal(first.payload.semantic_id, 'crop.code');
  assert.equal(second.payload.semantic_id, 'customer.experimental.label');
  assert.equal(first.payload.source.source_ref, second.payload.source.source_ref);
  assert.equal(first.payload.value.category, second.payload.value.category);
});

test('reference ContextProvider traverses P02 and publishes the exact ContextDatum authority used downstream', async () => {
  const result = await publishReferenceContextThroughSdk('sdk-roundtrip');
  assert.equal(result.request.path, '/v1/context-data');
  assert.equal(result.request.headers.Authorization, 'Bearer reference-provider-test-token');
  assert.equal(result.request.body.principal.principal_id, result.providerPrincipal.principalId);
  assert.deepEqual(result.request.body.resource, result.message.payload);
  assert.deepEqual(result.response.resource, result.message.payload);
  assert.deepEqual(result.response.ref, toWireRef(result.publishedDatum.ref));
  assert.equal(result.publishedDatum.semanticPayload.source.providerId, REFERENCE_FIELD_PLATFORM_ID);
});

test('a non-GEOX reference provider closes the existing Gate-A applicability/workbench path', async () => {
  const result = await createReferenceGateAWorld('direct');
  assert.equal(result.providerDatum.semanticPayload.source.providerId, REFERENCE_FIELD_PLATFORM_ID);
  assert.equal(result.assessment.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(result.assessment.semanticPayload.scientificUseStatus, 'QUALIFIED');
  assert.equal(result.assessment.semanticPayload.decisionRelevance, 'MATERIAL');
  assert.equal(result.workbenchCase.classification, 'NO_REVIEW_CANDIDATE');
  assert.equal(result.workbenchCase.reviewRequired, false);
  assert.equal(result.workbenchCase.targetContext.contextManifestRef.semanticHash, result.manifest.ref.semanticHash);
});

test('the reference consumer receives exact ApplicabilityAssessment identity without becoming authority', async () => {
  const result = await createReferenceGateAWorld('result-sink');
  const before = result.world.env.ledger.exportSnapshot().records.length;
  const event = createResultSinkEvent({
    eventId: 'reference-applicability-result-1',
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: toWireRef(result.assessment.ref),
    payload: {
      transport_status: result.assessment.semanticPayload.transportStatus,
      workbench_classification: result.workbenchCase.classification
    }
  });
  const consumed = consumeReferenceApplicabilityResult(event);
  const after = result.world.env.ledger.exportSnapshot().records.length;
  assert.deepEqual(consumed.applicabilityAssessmentRef, toWireRef(result.assessment.ref));
  assert.equal(consumed.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(consumed.workbenchClassification, 'NO_REVIEW_CANDIDATE');
  assert.equal(consumed.authorityClaim, 'NONE_TRANSPORT_CONSUMER_ONLY');
  assert.equal(after, before);
});

test('reference integration success does not fabricate runtime legality or decision authority', async () => {
  const result = await createReferenceGateAWorld('nonclaim');
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
console.log(`P03 non-GEOX reference integration acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
