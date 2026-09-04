import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  publishDecisionProblem,
  validateDecisionProblemAuthority
} from '../../packages/decision-problem/src/index.mjs';
import {
  CONTEXT_DATUM_CONTRACT_VERSION,
  publishContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import {
  AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
  ExactContextSnapshotStore,
  providerResponseContentHash,
  publishAuthorizedContextReference,
  publishResolvedContextDatumReceipt,
  validateAuthorizedContextReferenceAuthority,
  validateResolvedContextDatumReceiptAuthority
} from '../../packages/reference-resolution/src/index.mjs';
import {
  publishContextManifest,
  targetContextSnapshot,
  validateContextManifestAuthority
} from '../../packages/context-manifest/src/index.mjs';
import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from '../../packages/agronomic-policy-compilation/src/index.mjs';

export const KBS_RGE_TARGET_OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
export const KBS_RGE_PROVIDER_ID = 'kbs-public-context-adapter-v1';
export const KBS_RGE_PROVIDER_HASH = 'sha256:d2d440c88e5f44ce04f1c89533aa480ca6084e899a8e23d4a6f0e30ceaaecdac';
export const KBS_RGE_ADAPTER_LOCATOR = `urn:adr:acceptance:kbs-public-context-adapter:v1:rge-irrigation-2015:${KBS_RGE_PROVIDER_HASH}`;
export const KBS_RGE_AVAILABLE_AT = '2026-09-04T08:35:00.000Z';
export const KBS_RGE_RESOLVED_AT = '2026-09-04T08:40:00.000Z';
export const KBS_RGE_EVIDENCE_CUTOFF = '2026-09-04T08:50:00.000Z';
export const KBS_RGE_LOGICAL_TIME = '2026-09-04T08:55:00.000Z';
export const KBS_RGE_DEADLINE = '2026-09-04T09:55:00.000Z';
export const KBS_RGE_DECISION_TYPE = 'IRRIGATION_SCHEDULING_POLICY_EVALUATION';

export function buildKbsRgeIrrigationTargetWorld() {
  const OWNERSHIP = KBS_RGE_TARGET_OWNERSHIP;
  const providerBytes = readFileSync(new URL('./kbs-rge-irrigation-2015-context-adapter-response.json', import.meta.url));
  const providerHash = providerResponseContentHash(providerBytes);
  assert.equal(providerHash, KBS_RGE_PROVIDER_HASH);

  const adapterResponse = JSON.parse(providerBytes.toString('utf8'));
  assert.equal(adapterResponse.adapter_contract, 'adr.acceptance.kbs-public-context-adapter.v1');
  assert.equal(adapterResponse.world, 'KBS_RESOURCE_GRADIENT_IRRIGATED_2015');
  assert.equal(adapterResponse.retained_at, KBS_RGE_AVAILABLE_AT);
  assert.deepEqual(adapterResponse.normalized_context, {
    'crop.code': { type: 'CATEGORY', category: 'soybean' },
    'experiment.name': { type: 'STRING', string: 'Resource Gradient Experiment (N-rate Study)' }
  });
  assert.equal(adapterResponse.source_evidence[0].locator, 'https://aglog.kbs.msu.edu/observations/3187');
  assert.equal(adapterResponse.source_evidence[0].observation_date, '2015-05-21');
  assert.equal(adapterResponse.source_evidence[0].crop_label, 'soybeans');
  assert.ok(adapterResponse.source_evidence[0].areas.includes('Resource_Gradient-Irrigated'));
  assert.equal(adapterResponse.source_evidence[1].locator, 'https://aglog.kbs.msu.edu/observations/3320');
  assert.ok(adapterResponse.source_evidence[1].source_labels.includes('Resource Gradient Experiment'));
  assert.ok(adapterResponse.source_evidence[1].source_labels.includes('LTER N-rate Study'));
  assert.equal(
    adapterResponse.source_evidence[2].locator,
    'https://lter.kbs.msu.edu/research/long-term-experiments/resource-gradient/'
  );
  assert.ok(adapterResponse.source_evidence[2].management_classes.includes('irrigated'));
  assert.ok(adapterResponse.nonclaims.includes('NO_SOIL_WATER_BALANCE_STATE'));
  assert.ok(adapterResponse.nonclaims.includes('NO_TWO_DAY_TRIGGER_STATE'));
  assert.ok(adapterResponse.nonclaims.includes('NO_SOURCE_BACKED_GEOMETRY'));

  const ledger = new AuthorityLedger();
  const snapshotStore = new ExactContextSnapshotStore();
  const principal = Object.freeze({
    principalId: 'kbs-rge-context-gateway',
    type: 'SERVICE_ACCOUNT',
    organizationId: OWNERSHIP.organizationId,
    tenantId: OWNERSHIP.tenantId,
    programIds: []
  });

  let seq = 0;
  function audit(suffix, occurredAt, inputRefs = []) {
    seq += 1;
    return {
      eventId: `evt-kbs-rge-target-a03-${seq}-${suffix}`,
      occurredAt,
      actor: { type: principal.type, id: principal.principalId },
      inputRefs,
      details: {
        suite: 'real-kbs-rge-irrigation-target-context-a03',
        classification: 'REAL_SOURCE_TARGET_CONTEXT_INGESTION_TEST_ONLY'
      }
    };
  }

  function publishContextWriteAuthorization(logicalId, resourceType, occurredAt) {
    const role = publishRoleAssignment({
      ledger,
      logicalId: `role.kbs-rge-a03.${resourceType.toLowerCase()}.${logicalId}`,
      version: '1',
      principal,
      role: 'KBS_RGE_CONTEXT_GATEWAY',
      roleDefinitionVersion: 'kbs-rge-a03-v1',
      permissions: [PERMISSIONS.CONTEXT_WRITE],
      scope: { ...OWNERSHIP, resourceType },
      audit: audit(`role-${resourceType}-${logicalId}`, occurredAt)
    });
    const decision = authorizeContextWrite({
      principal,
      roleAssignments: [role],
      authorizationScope: { ...OWNERSHIP, resourceType, resourceId: logicalId }
    });
    assert.equal(decision.allowed, true);
    return recordAuthorizationDecision({
      ledger,
      decision,
      audit: audit(`auth-${resourceType}-${logicalId}`, occurredAt)
    });
  }

  const semanticEntries = Object.entries(adapterResponse.normalized_context)
    .sort(([left], [right]) => left.localeCompare(right));
  const datumRefs = [];
  const receiptRefs = [];
  const validatedDatums = [];

  for (const [semanticId, value] of semanticEntries) {
    const safe = semanticId.replaceAll('.', '-');
    const referenceId = `context-reference.kbs-rge-2015.${safe}`;
    const datumId = `context-datum.kbs-rge-2015.${safe}`;
    const receiptId = `context-receipt.kbs-rge-2015.${safe}`;

    const referenceAuth = publishContextWriteAuthorization(referenceId, 'AUTHORIZED_CONTEXT_REFERENCE', '2026-09-04T08:36:00.000Z');
    const reference = publishAuthorizedContextReference({
      ledger,
      logicalId: referenceId,
      version: '1',
      target: OWNERSHIP,
      reference: {
        contractVersion: AUTHORIZED_CONTEXT_REFERENCE_CONTRACT_VERSION,
        semanticId,
        valueMode: 'AUTHORIZED_REFERENCE',
        reference: {
          providerId: KBS_RGE_PROVIDER_ID,
          locator: KBS_RGE_ADAPTER_LOCATOR,
          addressingMode: 'CONTENT_ADDRESSED',
          expectedContentHash: providerHash
        },
        authorizationContext: {
          connectionId: KBS_RGE_PROVIDER_ID,
          principalScope: {
            ...OWNERSHIP,
            subjectId: 'KBS_RGE_2015',
            resourceIds: ['kbs:rge:2015'],
            semanticIds: [semanticId]
          }
        }
      },
      principal,
      authorizationDecisionAuditRef: referenceAuth.ref,
      audit: audit(`reference-${safe}`, '2026-09-04T08:37:00.000Z')
    });
    validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: reference.ref });

    const datumAuth = publishContextWriteAuthorization(datumId, 'CONTEXT_DATUM', '2026-09-04T08:38:00.000Z');
    const datum = publishContextDatum({
      ledger,
      logicalId: datumId,
      version: '1',
      target: OWNERSHIP,
      datum: {
        contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
        semanticId,
        value,
        unit: 'NOT_APPLICABLE',
        epistemicClass: 'ASSERTION',
        provenanceClass: 'EXTERNAL_PROVIDER',
        effectiveInterval: {
          start: adapterResponse.evaluation_slice.start,
          end: adapterResponse.evaluation_slice.end
        },
        availableAt: KBS_RGE_AVAILABLE_AT,
        spatialSupport: { type: 'EXPERIMENT' },
        verticalSupport: null,
        temporalSupport: { type: adapterResponse.evaluation_slice.kind },
        uncertainty: { type: 'NONE' },
        source: {
          providerId: KBS_RGE_PROVIDER_ID,
          sourceRef: `${KBS_RGE_ADAPTER_LOCATOR}#${semanticId}`,
          contentHash: providerHash
        }
      },
      principal,
      authorizationDecisionAuditRef: datumAuth.ref,
      audit: audit(`datum-${safe}`, '2026-09-04T08:39:00.000Z')
    });
    const validatedDatum = validateContextDatumAuthority({ ledger, contextDatumRef: datum.ref });
    assert.equal(validatedDatum.semanticPayload.semanticId, semanticId);
    assert.deepEqual(validatedDatum.semanticPayload.value, value);
    assert.equal(validatedDatum.semanticPayload.source.contentHash, providerHash);
    assert.equal(validatedDatum.semanticPayload.spatialSupport.type, 'EXPERIMENT');
    assert.equal('geometryRef' in validatedDatum.semanticPayload.spatialSupport, false);

    const receiptAuth = publishContextWriteAuthorization(receiptId, 'RESOLVED_CONTEXT_DATUM_RECEIPT', '2026-09-04T08:39:30.000Z');
    const receipt = publishResolvedContextDatumReceipt({
      ledger,
      logicalId: receiptId,
      version: '1',
      referenceRef: reference.ref,
      normalizedContextDatumRef: datum.ref,
      providerResponseBytes: providerBytes,
      resolution: {
        resolvedAt: KBS_RGE_RESOLVED_AT,
        effectiveAt: adapterResponse.evaluation_slice.representative_effective_at,
        availableAt: KBS_RGE_AVAILABLE_AT
      },
      retainSnapshot: true,
      snapshotStore,
      principal,
      authorizationDecisionAuditRef: receiptAuth.ref,
      audit: audit(`receipt-${safe}`, KBS_RGE_RESOLVED_AT)
    });
    const validatedReceipt = validateResolvedContextDatumReceiptAuthority({
      ledger,
      receiptRef: receipt.ref,
      snapshotStore
    });
    assert.equal(validatedReceipt.receipt.semanticPayload.replayClass, 'EXACT');
    assert.equal(validatedReceipt.receipt.semanticPayload.providerResponseHash, providerHash);
    assert.deepEqual(validatedReceipt.contextDatum.record.ref, datum.ref);

    datumRefs.push(datum.ref);
    receiptRefs.push(receipt.ref);
    validatedDatums.push(validatedDatum);
  }

  assert.equal(snapshotStore.count(), 1);
  assert.deepEqual(snapshotStore.get(providerHash), providerBytes);

  const decisionLogicalId = 'decision-problem.kbs-rge-2015.irrigation-policy-evaluation';
  const decisionRole = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-rge-a03.decision.${decisionLogicalId}`,
    version: '1',
    principal,
    role: 'KBS_RGE_DECISION_PROBLEM_CREATOR',
    roleDefinitionVersion: 'kbs-rge-a03-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM' },
    audit: audit('decision-role', '2026-09-04T08:42:00.000Z')
  });
  const decisionAuthorization = authorizeDecisionProblemCreation({
    principal,
    roleAssignments: [decisionRole],
    authorizationScope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM', resourceId: decisionLogicalId }
  });
  assert.equal(decisionAuthorization.allowed, true);
  const decisionAuth = recordAuthorizationDecision({
    ledger,
    decision: decisionAuthorization,
    audit: audit('decision-auth', '2026-09-04T08:43:00.000Z')
  });
  const decision = publishDecisionProblem({
    ledger,
    logicalId: decisionLogicalId,
    version: '1',
    problem: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      decisionType: KBS_RGE_DECISION_TYPE,
      targetRef: OWNERSHIP,
      logicalTime: KBS_RGE_LOGICAL_TIME,
      decisionHorizon: { duration: 'PT24H' },
      objective: { code: 'EVALUATE_RGE_IRRIGATION_SCHEDULING_TRIGGER' },
      actionSpace: ['SCHEDULE_IRRIGATION_NEXT_DAY', 'DO_NOT_SCHEDULE_IRRIGATION_NEXT_DAY'],
      constraints: [{
        type: 'RETROSPECTIVE_EVALUATION_SLICE',
        start: adapterResponse.evaluation_slice.start,
        end: adapterResponse.evaluation_slice.end,
        targetContextSelector: {
          semanticId: 'experiment.name',
          operator: 'EQUALS',
          value: 'Resource Gradient Experiment (N-rate Study)'
        }
      }],
      usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
      useClass: 'TEST_ONLY',
      decisionAuthorityMode: 'RUNTIME_ONLY',
      decisionDeadline: KBS_RGE_DEADLINE
    },
    principal,
    authorizationDecisionAuditRef: decisionAuth.ref,
    audit: audit('decision-publish', '2026-09-04T08:45:00.000Z')
  });
  const validatedDecision = validateDecisionProblemAuthority({ ledger, decisionProblemRef: decision.ref });
  assert.deepEqual(validatedDecision.semanticPayload.targetRef, OWNERSHIP);
  assert.equal(validatedDecision.semanticPayload.decisionType, KBS_RGE_DECISION_TYPE);
  assert.equal('farmId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('fieldId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('zoneId' in validatedDecision.semanticPayload.targetRef, false);

  const manifestLogicalId = 'context-manifest.kbs-rge-2015.irrigation-policy-evaluation';
  const manifestAuth = publishContextWriteAuthorization(manifestLogicalId, 'CONTEXT_MANIFEST', '2026-09-04T08:48:00.000Z');
  const manifest = publishContextManifest({
    ledger,
    logicalId: manifestLogicalId,
    version: '1',
    decisionProblemRef: decision.ref,
    evidenceCutoff: KBS_RGE_EVIDENCE_CUTOFF,
    datumRefs,
    resolvedReferenceReceiptRefs: receiptRefs,
    snapshotStore,
    principal,
    authorizationDecisionAuditRef: manifestAuth.ref,
    audit: audit('manifest-publish', '2026-09-04T08:52:00.000Z')
  });
  const validatedManifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef: manifest.ref,
    snapshotStore
  });
  assert.equal(validatedManifest.semanticPayload.replayClass, 'EXACT');
  assert.equal(validatedManifest.semanticPayload.datumRefs.length, 2);
  assert.equal(validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length, 2);
  assert.ok(new Date(KBS_RGE_AVAILABLE_AT) <= new Date(KBS_RGE_RESOLVED_AT));
  assert.ok(new Date(KBS_RGE_RESOLVED_AT) <= new Date(KBS_RGE_EVIDENCE_CUTOFF));
  assert.ok(new Date(KBS_RGE_EVIDENCE_CUTOFF) < new Date(KBS_RGE_LOGICAL_TIME));

  const snapshot = targetContextSnapshot({ ledger, contextManifestRef: manifest.ref, snapshotStore });
  assert.equal(snapshot.datumRefs.length, 2);
  assert.equal(snapshot.resolvedReferenceReceiptRefs.length, 2);

  const records = ledger.exportSnapshot().records;
  assert.equal(records.some((record) => record.ref.kind === 'AgronomicContextDatumAssemblyCompilation'), false);
  assert.equal(records.some((record) => record.ref.kind === 'AgronomicDecisionProblemFarmTargetBindingCompilation'), false);
  assert.equal(records.some((record) => record.ref.kind === 'AgronomicContextManifestConvergenceCompilation'), false);

  return Object.freeze({
    ledger,
    snapshotStore,
    principal,
    providerBytes,
    providerHash,
    adapterResponse,
    datumRefs: Object.freeze([...datumRefs]),
    receiptRefs: Object.freeze([...receiptRefs]),
    validatedDatums: Object.freeze([...validatedDatums]),
    decision,
    validatedDecision,
    manifest,
    validatedManifest
  });
}
