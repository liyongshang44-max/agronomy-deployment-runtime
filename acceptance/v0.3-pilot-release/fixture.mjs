import { deepFreeze, semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { ADR_PILOT_OPENAPI, PUBLIC_API_OPERATIONS } from '../../packages/public-api/src/index.mjs';
import { createAdrPilotClient, createResultSinkEvent } from '../../sdks/typescript/src/index.mjs';
import { publishContextDatum } from '../../packages/context-contract/src/index.mjs';
import {
  REFERENCE_FIELD_PLATFORM_ID,
  consumeReferenceApplicabilityResult,
  createReferenceFieldPlatformContextProvider
} from '../../adapters/reference-field-platform/src/index.mjs';
import { audit, publishManifest, writeAuthorization } from '../context-manifest/fixtures.mjs';
import { assess, createApplicabilityWorld } from '../applicability/fixture.mjs';
import {
  createInspectionAuthorization,
  createWorkbenchPrincipal,
  createWorkbenchWorld,
  projectCase
} from '../workbench/fixture.mjs';
import {
  completeWorkbenchReviewMeasurement,
  startWorkbenchReviewMeasurement,
  summarizeWorkbenchReviewMeasurements
} from '../../packages/workbench/src/index.mjs';
import {
  OPERATIONAL_NON_AUTHORITY_CLAIM,
  OperationalJobJournal,
  executeOperationalJob,
  projectOperationalTrace
} from '../../packages/operations/src/index.mjs';
import {
  PilotSecureArtifactStore,
  SECURITY_OPERATIONS_NON_AUTHORITY
} from '../../packages/security-operations/src/index.mjs';
import {
  RECOVERY_OPERATIONS_NON_AUTHORITY,
  createAuthorityRecoveryCheckpoint,
  createPilotSloReport,
  restoreAuthorityRecoveryCheckpoint
} from '../../packages/recovery-operations/src/index.mjs';

export const V03_RELEASE_STATUS = 'PAID_DESIGN_PARTNER_PILOT_CANDIDATE';
export const V03_COMMERCIAL_VALIDATION = 'NOT_ESTABLISHED';
export const V03_RELEASE_NON_AUTHORITY = 'NONE_RELEASE_ACCEPTANCE_IS_NOT_DOMAIN_AUTHORITY';

const customerRecord = Object.freeze({
  plot_key: 'design-partner-plot-774',
  reading_key: 'pilot-reading-00017',
  metric_code: 'CUSTOMER_CROP_LABEL_V2',
  raw_value: 'maize',
  observed_from: '2026-08-20T09:00:00Z',
  observed_to: '2026-08-20T10:00:00Z',
  released_at: '2026-08-20T09:55:00Z',
  content_hash: 'sha256:design-partner-reading-00017'
});

const cropMapping = Object.freeze({
  sourcePlotKey: 'design-partner-plot-774',
  sourceMetricCode: 'CUSTOMER_CROP_LABEL_V2',
  semanticId: 'crop.code',
  unit: '1',
  valueType: 'CATEGORY',
  geometryRef: 'field-1',
  epistemicClass: 'OBSERVATION',
  provenanceClass: 'EXTERNAL_PROVIDER'
});

export function toWireRef(ref) {
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
    default: throw new Error(`unsupported v0.3 release value type ${value.type}`);
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

export async function createNonGeoxPilotWorld(label = 'integrated') {
  const base = createApplicabilityWorld(`v03-${label}`, { includeCrop: false });
  const provider = createReferenceFieldPlatformContextProvider({ contextMapping: cropMapping });
  const message = provider.toContextMessage(customerRecord);
  const logicalId = `context-datum.v03.${label}.pilot-reading-00017`;
  const providerPrincipal = {
    principalId: `design-partner-context-provider-${label}`,
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
    { assignmentLogicalId: `role-v03-reference-context-${label}` }
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
    getAccessToken: () => 'design-partner-pilot-token',
    transport: async (value) => {
      request = value;
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
        audit: audit(providerPrincipal, `v03-reference-publish-${label}`, '2026-08-20T09:56:00Z')
      });
      return { ref: toWireRef(publishedDatum.ref), resource: value.body.resource };
    }
  });

  const response = await client.createContextDatum({
    logicalId,
    version: '1',
    authorizationDecisionRef: toWireRef(contextWrite.recorded.ref),
    resource: message.payload,
    idempotencyKey: `v03-reference-reading-${label}`
  });

  const manifest = publishManifest(base.env.ledger, {
    logicalId: `manifest.v03.${label}`,
    decisionProblem: base.decision,
    datumRefs: [publishedDatum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const assessment = assess(base, { logicalId: `applicability.v03.${label}`, manifest });
  const world = { ...base, manifest, assessment };
  const { principal, role } = createWorkbenchPrincipal(world, {
    principalId: `agronomist-v03-${label}`
  });
  world.workbenchPrincipal = principal;
  world.workbenchRole = role;
  const inspection = createInspectionAuthorization(world);
  world.inspection = inspection;
  world.inspectionAuthorizations = [{
    knowledgeRef: assessment.semanticPayload.knowledgeRef,
    authorizationDecisionAuditRef: inspection.recorded.ref
  }];
  world.workbenchCase = projectCase(world);

  return { world, providerDatum: publishedDatum, providerMessage: message, request, response };
}

export async function createOperationalPilotEvidence(world, label = 'integrated') {
  const journal = new OperationalJobJournal();
  let executorCalls = 0;
  const job = {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    operation: 'V03_PILOT_APPLICABILITY_WORKFLOW',
    idempotencyKey: `v03-pilot-case-${label}`,
    inputAuthorityRefs: [
      world.env.release.ref,
      world.decision.ref,
      world.manifest.ref,
      world.assessment.ref
    ]
  };
  const result = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-23T10:00:00.000Z',
    completedAt: '2026-08-23T10:00:00.250Z',
    executor: async () => {
      executorCalls += 1;
      return { outputAuthorityRefs: [world.assessment.ref] };
    }
  });
  const replay = await executeOperationalJob({
    journal,
    job,
    startedAt: '2026-08-23T10:01:00.000Z',
    completedAt: '2026-08-23T10:01:00.010Z',
    executor: async () => {
      executorCalls += 1;
      throw new Error('idempotent pilot success must not redispatch');
    }
  });
  const trace = projectOperationalTrace({ journal, jobId: result.job.jobId });
  return { journal, job, result, replay, trace, executorCalls };
}

export function createTenantStorageEvidence(providerMessage) {
  const store = new PilotSecureArtifactStore();
  const bytes = Buffer.from(JSON.stringify(providerMessage.payload), 'utf8');
  const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
  const retained = store.putForScope(scope, bytes);
  return { store, scope, bytes, retained };
}

export function createRecoveryAndSloEvidence(world, operational) {
  const checkpoint = createAuthorityRecoveryCheckpoint({
    ledger: world.env.ledger,
    capturedAt: '2026-08-23T10:05:00Z'
  });
  const restored = restoreAuthorityRecoveryCheckpoint(checkpoint);
  const slo = createPilotSloReport({
    traceEvidence: [{ trace: operational.trace, journalSnapshot: operational.journal.exportSnapshot() }],
    windowStart: '2026-08-23T10:00:00Z',
    windowEnd: '2026-08-23T11:00:00Z',
    objectives: {
      successTargetBasisPoints: 10000,
      maxP95DurationMs: 1000,
      maxProviderOutageCount: 0
    }
  });
  return { checkpoint, restored, slo };
}

export function createReviewMeasurementEvidence() {
  const conflict = createWorkbenchWorld('v03-release-review', { crop: 'wheat' });
  const session = startWorkbenchReviewMeasurement({
    ledger: conflict.env.ledger,
    workbenchCase: conflict.workbenchCase,
    reviewerId: 'design-partner-agronomist-1',
    startedAt: '2026-08-23T11:00:00Z',
    sourceRegistry: conflict.env.sourceRegistry
  });
  const measurement = completeWorkbenchReviewMeasurement({
    session,
    completedAt: '2026-08-23T11:02:00Z',
    outcome: 'CONFIRMED_CLASSIFICATION',
    reasonCodes: ['KNOWLEDGE_CONFLICT_CONFIRMED']
  });
  const summary = summarizeWorkbenchReviewMeasurements([measurement]);
  return { conflict, measurement, summary };
}

export async function createV03IntegratedReleaseEvidence(label = 'integrated') {
  const nonGeox = await createNonGeoxPilotWorld(label);
  const operational = await createOperationalPilotEvidence(nonGeox.world, label);
  const storage = createTenantStorageEvidence(nonGeox.providerMessage);
  const recovery = createRecoveryAndSloEvidence(nonGeox.world, operational);
  const review = createReviewMeasurementEvidence();

  const resultEvent = createResultSinkEvent({
    eventId: `v03-applicability-result-${label}`,
    eventType: 'APPLICABILITY_PUBLISHED',
    authorityRef: toWireRef(nonGeox.world.assessment.ref),
    payload: {
      transport_status: nonGeox.world.assessment.semanticPayload.transportStatus,
      workbench_classification: nonGeox.world.workbenchCase.classification
    }
  });
  const consumed = consumeReferenceApplicabilityResult(resultEvent);

  const basis = {
    status: V03_RELEASE_STATUS,
    commercialValidation: V03_COMMERCIAL_VALIDATION,
    requiredClosure: [
      'GATE_A', 'MTL-A11', 'MTL-P01', 'MTL-P02', 'MTL-P03',
      'MTL-P06', 'MTL-P07', 'MTL-P08_PILOT_SUBSET'
    ],
    publicApiVersion: ADR_PILOT_OPENAPI.info.version,
    publicOperationIds: PUBLIC_API_OPERATIONS.map((operation) => operation.operationId).sort(),
    providerId: REFERENCE_FIELD_PLATFORM_ID,
    contextDatumRef: nonGeox.providerDatum.ref,
    decisionProblemRef: nonGeox.world.decision.ref,
    contextManifestRef: nonGeox.world.manifest.ref,
    applicabilityAssessmentRef: nonGeox.world.assessment.ref,
    workbenchCaseProjectionHash: nonGeox.world.workbenchCase.caseProjectionHash,
    workbenchClassification: nonGeox.world.workbenchCase.classification,
    operationalTraceHash: operational.trace.traceHash,
    artifactRetentionId: storage.retained.retentionId,
    recoveryCheckpointHash: recovery.checkpoint.checkpointHash,
    pilotSloReportHash: recovery.slo.sloReportHash,
    reviewMeasurementHash: review.measurement.completionHash,
    authorityClaim: V03_RELEASE_NON_AUTHORITY
  };

  return Object.freeze({
    ...basis,
    releaseEvidenceHash: semanticHash('V03PaidPilotReleaseEvidence', basis),
    nonGeox,
    operational,
    storage,
    recovery,
    review,
    resultEvent,
    consumed
  });
}

export function releaseOperationalNonclaims() {
  return deepFreeze({
    release: V03_RELEASE_NON_AUTHORITY,
    operations: OPERATIONAL_NON_AUTHORITY_CLAIM,
    security: SECURITY_OPERATIONS_NON_AUTHORITY,
    recovery: RECOVERY_OPERATIONS_NON_AUTHORITY
  });
}
