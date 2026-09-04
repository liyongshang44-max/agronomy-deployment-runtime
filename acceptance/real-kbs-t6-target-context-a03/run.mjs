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

const OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
const PROVIDER_ID = 'kbs-public-context-adapter-v1';
const ADAPTER_LOCATOR = 'urn:adr:acceptance:kbs-public-context-adapter:v1:mcse-t6-2015';
const EXPECTED_PROVIDER_HASH = 'sha256:3821a5620b99d0892995fa3ab67241515bba776d80f188641f79ea83e634bc2d';
const AVAILABLE_AT = '2026-09-04T07:00:00.000Z';
const RESOLVED_AT = '2026-09-04T07:10:00.000Z';
const EVIDENCE_CUTOFF = '2026-09-04T07:20:00.000Z';
const LOGICAL_TIME = '2026-09-04T07:30:00.000Z';
const DEADLINE = '2026-09-04T08:30:00.000Z';

const providerBytes = readFileSync(new URL('./kbs-t6-2015-context-adapter-response.json', import.meta.url));
const providerHash = providerResponseContentHash(providerBytes);
assert.equal(providerHash, EXPECTED_PROVIDER_HASH);
const adapterResponse = JSON.parse(providerBytes.toString('utf8'));
assert.equal(adapterResponse.adapter_contract, 'adr.acceptance.kbs-public-context-adapter.v1');
assert.equal(adapterResponse.retrieved_at, AVAILABLE_AT);
assert.deepEqual(adapterResponse.normalized_context, {
  'treatment.name': { type: 'STRING', string: 'Main Site Treatment 6' },
  'crop.code': { type: 'CATEGORY', category: 'alfalfa' },
  'site.name': { type: 'STRING', string: 'Kellogg Biological Station' }
});
assert.equal(adapterResponse.source_evidence[0].locator, 'https://aglog.kbs.msu.edu/observations/3138');
assert.equal(adapterResponse.source_evidence[0].observation_date, '2015-04-15');
assert.equal(adapterResponse.source_evidence[0].area_code, 'T6');
assert.equal(adapterResponse.source_evidence[0].crop_label, 'Alfalfa');
assert.equal(adapterResponse.source_evidence[1].treatment_code, 'T6');
assert.equal(adapterResponse.source_evidence[1].treatment_label, 'Alfalfa');
assert.equal(adapterResponse.source_evidence[2].history['2019'], 'T6_PLANTED_TO_SWITCHGRASS');

const ledger = new AuthorityLedger();
const snapshotStore = new ExactContextSnapshotStore();
const principal = Object.freeze({
  principalId: 'kbs-t6-context-gateway',
  type: 'SERVICE_ACCOUNT',
  organizationId: OWNERSHIP.organizationId,
  tenantId: OWNERSHIP.tenantId,
  programIds: []
});

let seq = 0;
function audit(suffix, occurredAt, inputRefs = []) {
  seq += 1;
  return {
    eventId: `evt-kbs-t6-target-a03-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    inputRefs,
    details: {
      suite: 'real-kbs-t6-target-context-a03',
      classification: 'REAL_SOURCE_TARGET_CONTEXT_INGESTION_TEST_ONLY'
    }
  };
}

function publishContextWriteAuthorization(logicalId, resourceType, occurredAt) {
  const role = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-t6-a03.${resourceType.toLowerCase()}.${logicalId}`,
    version: '1',
    principal,
    role: 'KBS_T6_CONTEXT_GATEWAY',
    roleDefinitionVersion: 'kbs-t6-a03-v1',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: {
      ...OWNERSHIP,
      resourceType
    },
    audit: audit(`role-${resourceType}-${logicalId}`, occurredAt)
  });
  const decision = authorizeContextWrite({
    principal,
    roleAssignments: [role],
    authorizationScope: {
      ...OWNERSHIP,
      resourceType,
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit(`auth-${resourceType}-${logicalId}`, occurredAt)
  });
}

function publishDecisionAuthorization(logicalId) {
  const role = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-t6-a03.decision.${logicalId}`,
    version: '1',
    principal,
    role: 'KBS_T6_DECISION_PROBLEM_CREATOR',
    roleDefinitionVersion: 'kbs-t6-a03-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: {
      ...OWNERSHIP,
      resourceType: 'DECISION_PROBLEM'
    },
    audit: audit('decision-role', '2026-09-04T07:12:00.000Z')
  });
  const decision = authorizeDecisionProblemCreation({
    principal,
    roleAssignments: [role],
    authorizationScope: {
      ...OWNERSHIP,
      resourceType: 'DECISION_PROBLEM',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit('decision-auth', '2026-09-04T07:13:00.000Z')
  });
}

const semanticEntries = Object.entries(adapterResponse.normalized_context)
  .sort(([left], [right]) => left.localeCompare(right));
const datumRefs = [];
const receiptRefs = [];
const validatedDatums = [];

for (const [semanticId, value] of semanticEntries) {
  const safe = semanticId.replaceAll('.', '-');
  const referenceId = `context-reference.kbs-t6-2015.${safe}`;
  const datumId = `context-datum.kbs-t6-2015.${safe}`;
  const receiptId = `context-receipt.kbs-t6-2015.${safe}`;

  const referenceAuth = publishContextWriteAuthorization(
    referenceId,
    'AUTHORIZED_CONTEXT_REFERENCE',
    '2026-09-04T07:01:00.000Z'
  );
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
        providerId: PROVIDER_ID,
        locator: ADAPTER_LOCATOR,
        addressingMode: 'CONTENT_ADDRESSED',
        expectedContentHash: providerHash
      },
      authorizationContext: {
        connectionId: PROVIDER_ID,
        principalScope: {
          ...OWNERSHIP,
          contextWorld: 'KBS_MCSE_T6_2015',
          sourceClass: 'PUBLIC_KBS_CONTEXT_ADAPTER'
        }
      }
    },
    principal,
    authorizationDecisionAuditRef: referenceAuth.ref,
    audit: audit(`reference-${safe}`, '2026-09-04T07:02:00.000Z')
  });
  validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: reference.ref });

  const datumAuth = publishContextWriteAuthorization(
    datumId,
    'CONTEXT_DATUM',
    '2026-09-04T07:03:00.000Z'
  );
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
      availableAt: AVAILABLE_AT,
      spatialSupport: {
        type: 'EXPERIMENTAL_TREATMENT',
        geometryRef: 'kbs:mcse:t6'
      },
      verticalSupport: null,
      temporalSupport: { type: adapterResponse.evaluation_slice.kind },
      uncertainty: { type: 'NONE' },
      source: {
        providerId: PROVIDER_ID,
        sourceRef: `${ADAPTER_LOCATOR}#${semanticId}`,
        contentHash: providerHash
      }
    },
    principal,
    authorizationDecisionAuditRef: datumAuth.ref,
    audit: audit(`datum-${safe}`, '2026-09-04T07:04:00.000Z')
  });
  const validatedDatum = validateContextDatumAuthority({ ledger, contextDatumRef: datum.ref });
  assert.equal(validatedDatum.semanticPayload.semanticId, semanticId);
  assert.deepEqual(validatedDatum.semanticPayload.value, value);
  assert.equal(validatedDatum.semanticPayload.source.contentHash, providerHash);
  assert.equal(validatedDatum.semanticPayload.spatialSupport.type, 'EXPERIMENTAL_TREATMENT');
  assert.deepEqual(validatedDatum.semanticPayload.effectiveInterval, {
    start: '2015-01-01T00:00:00.000Z',
    end: '2016-01-01T00:00:00.000Z'
  });

  const receiptAuth = publishContextWriteAuthorization(
    receiptId,
    'RESOLVED_CONTEXT_DATUM_RECEIPT',
    '2026-09-04T07:05:00.000Z'
  );
  const receipt = publishResolvedContextDatumReceipt({
    ledger,
    logicalId: receiptId,
    version: '1',
    referenceRef: reference.ref,
    normalizedContextDatumRef: datum.ref,
    providerResponseBytes: providerBytes,
    resolution: {
      resolvedAt: RESOLVED_AT,
      effectiveAt: adapterResponse.evaluation_slice.representative_effective_at,
      availableAt: AVAILABLE_AT
    },
    retainSnapshot: true,
    snapshotStore,
    principal,
    authorizationDecisionAuditRef: receiptAuth.ref,
    audit: audit(`receipt-${safe}`, RESOLVED_AT)
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
assert.deepEqual(
  validatedDatums.map((item) => item.semanticPayload.semanticId).sort(),
  ['crop.code', 'site.name', 'treatment.name']
);

const decisionLogicalId = 'decision-problem.kbs-t6-2015.nitrogen-policy-evaluation';
const decisionAuth = publishDecisionAuthorization(decisionLogicalId);
const decision = publishDecisionProblem({
  ledger,
  logicalId: decisionLogicalId,
  version: '1',
  problem: {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    decisionType: 'NITROGEN_ADDITION_POLICY_EVALUATION',
    targetRef: OWNERSHIP,
    logicalTime: LOGICAL_TIME,
    decisionHorizon: { duration: 'PT1H' },
    objective: { code: 'EVALUATE_NITROGEN_ADDITION_PROHIBITION' },
    actionSpace: ['APPLY_NITROGEN', 'DO_NOT_APPLY_NITROGEN'],
    constraints: [{
      type: 'RETROSPECTIVE_EVALUATION_SLICE',
      start: adapterResponse.evaluation_slice.start,
      end: adapterResponse.evaluation_slice.end,
      targetContextSelector: {
        semanticId: 'treatment.name',
        operator: 'EQUALS',
        value: 'Main Site Treatment 6'
      }
    }],
    usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
    useClass: 'TEST_ONLY',
    decisionAuthorityMode: 'RUNTIME_ONLY',
    decisionDeadline: DEADLINE
  },
  principal,
  authorizationDecisionAuditRef: decisionAuth.ref,
  audit: audit('decision-publish', '2026-09-04T07:15:00.000Z')
});
const validatedDecision = validateDecisionProblemAuthority({ ledger, decisionProblemRef: decision.ref });
assert.deepEqual(validatedDecision.semanticPayload.targetRef, OWNERSHIP);
assert.equal('farmId' in validatedDecision.semanticPayload.targetRef, false);
assert.equal('fieldId' in validatedDecision.semanticPayload.targetRef, false);
assert.equal(validatedDecision.semanticPayload.logicalTime, LOGICAL_TIME);

const manifestLogicalId = 'context-manifest.kbs-t6-2015.nitrogen-policy-evaluation';
const manifestAuth = publishContextWriteAuthorization(
  manifestLogicalId,
  'CONTEXT_MANIFEST',
  '2026-09-04T07:18:00.000Z'
);
const manifest = publishContextManifest({
  ledger,
  logicalId: manifestLogicalId,
  version: '1',
  decisionProblemRef: decision.ref,
  evidenceCutoff: EVIDENCE_CUTOFF,
  datumRefs,
  resolvedReferenceReceiptRefs: receiptRefs,
  snapshotStore,
  principal,
  authorizationDecisionAuditRef: manifestAuth.ref,
  audit: audit('manifest-publish', '2026-09-04T07:25:00.000Z')
});
const validatedManifest = validateContextManifestAuthority({
  ledger,
  contextManifestRef: manifest.ref,
  snapshotStore
});
assert.equal(validatedManifest.semanticPayload.replayClass, 'EXACT');
assert.equal(validatedManifest.semanticPayload.evidenceCutoff, EVIDENCE_CUTOFF);
assert.equal(validatedManifest.semanticPayload.logicalTime, LOGICAL_TIME);
assert.deepEqual(validatedManifest.semanticPayload.targetRef, OWNERSHIP);
assert.equal(validatedManifest.semanticPayload.datumRefs.length, 3);
assert.equal(validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length, 3);
assert.ok(new Date(AVAILABLE_AT) <= new Date(EVIDENCE_CUTOFF));
assert.ok(new Date(RESOLVED_AT) <= new Date(EVIDENCE_CUTOFF));
assert.ok(new Date(EVIDENCE_CUTOFF) < new Date(LOGICAL_TIME));

const snapshot = targetContextSnapshot({
  ledger,
  contextManifestRef: manifest.ref,
  snapshotStore
});
assert.equal(snapshot.datumRefs.length, 3);
assert.equal(snapshot.resolvedReferenceReceiptRefs.length, 3);

const records = ledger.exportSnapshot().records;
assert.equal(records.some((record) => record.ref.kind === 'AgronomicContextDatumAssemblyCompilation'), false);
assert.equal(records.some((record) => record.ref.kind === 'AgronomicDecisionProblemFarmTargetBindingCompilation'), false);
assert.equal(records.some((record) => record.ref.kind === 'AgronomicContextManifestConvergenceCompilation'), false);

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_NITROGEN_TARGET_INGESTION_A03',
  classification: 'REAL_SOURCE_TARGET_CONTEXT_INGESTION_TEST_ONLY',
  provider: {
    adapterContract: adapterResponse.adapter_contract,
    providerId: PROVIDER_ID,
    providerResponseHash: providerHash,
    retainedSnapshotCount: snapshotStore.count(),
    sourceEvidenceLocators: adapterResponse.source_evidence.map((item) => item.locator)
  },
  targetContext: {
    semanticIds: validatedDatums.map((item) => item.semanticPayload.semanticId).sort(),
    treatmentName: adapterResponse.normalized_context['treatment.name'].string,
    cropCode: adapterResponse.normalized_context['crop.code'].category,
    siteName: adapterResponse.normalized_context['site.name'].string,
    spatialSupportType: 'EXPERIMENTAL_TREATMENT',
    evaluationSlice: adapterResponse.evaluation_slice,
    targetRefIntentionallyNotPromotedToFarmOrField: true
  },
  temporalControl: {
    availableAt: AVAILABLE_AT,
    resolvedAt: RESOLVED_AT,
    evidenceCutoff: EVIDENCE_CUTOFF,
    logicalTime: LOGICAL_TIME,
    noLookaheadForMachineEvaluation: true,
    retrospectiveSliceIsNotClaimedAsOperationTimestamp: true
  },
  manifest: {
    contextManifestRef: manifest.ref,
    datumCount: validatedManifest.semanticPayload.datumRefs.length,
    receiptCount: validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length,
    replayClass: validatedManifest.semanticPayload.replayClass
  },
  genericCoreContractsModified: false,
  dec0034RequiredForTargetIngestion: false,
  runtimeApplicabilityExecuted: false,
  runtimeBindingCreated: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));
