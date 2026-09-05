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

export const KBS_T3R1_TARGET_OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
export const KBS_T3R1_PROVIDER_ID = 'kbs-public-context-adapter-v1';
export const KBS_T3R1_PROVIDER_HASH = 'sha256:e21b6d9412cfe62600bb92a93a9359a9c08f7595451f62a4a505af43d27a58c5';
export const KBS_T3R1_ADAPTER_LOCATOR =
  `urn:adr:acceptance:kbs-public-context-adapter:v1:mcse-t3r1-2026:${KBS_T3R1_PROVIDER_HASH}`;
export const KBS_T3R1_AVAILABLE_AT = '2026-09-05T02:00:00.000Z';
export const KBS_T3R1_RESOLVED_AT = '2026-09-05T02:05:00.000Z';
export const KBS_T3R1_EVIDENCE_CUTOFF = '2026-09-05T02:10:00.000Z';
export const KBS_T3R1_LOGICAL_TIME = '2026-09-05T02:15:00.000Z';
export const KBS_T3R1_DEADLINE = '2026-09-05T03:15:00.000Z';
export const KBS_T3R1_DECISION_TYPE = 'TARGET_CORRESPONDENCE_QUALIFICATION';

export function buildKbsT3R1TargetWorld() {
  const OWNERSHIP = KBS_T3R1_TARGET_OWNERSHIP;
  const providerBytes = readFileSync(new URL('./kbs-t3r1-2026-context-adapter-response.json', import.meta.url));
  const providerHash = providerResponseContentHash(providerBytes);
  assert.equal(providerHash, KBS_T3R1_PROVIDER_HASH);

  const adapterResponse = JSON.parse(providerBytes.toString('utf8'));
  assert.equal(adapterResponse.adapter_contract, 'adr.acceptance.kbs-public-context-adapter.v1');
  assert.equal(adapterResponse.world, 'KBS_MCSE_T3R1_2026_TARGET_CORRESPONDENCE');
  assert.equal(adapterResponse.retained_at, KBS_T3R1_AVAILABLE_AT);
  assert.deepEqual(adapterResponse.correspondence_basis.provider_target_components, [
    'Main Cropping System Experiment (MCSE)', 'T3', 'R1'
  ]);
  assert.equal(adapterResponse.source_evidence[0].treatment_code, 'T3');
  assert.equal(adapterResponse.source_evidence[0].replicate_structure, 'SIX_REPLICATE_BLOCKS');
  assert.equal(adapterResponse.source_evidence[1].observation_id, '6966');
  assert.ok(adapterResponse.source_evidence[1].replicate_order.includes('R1'));
  assert.equal(adapterResponse.source_evidence[1].crop_label, 'corn');
  assert.equal(adapterResponse.source_evidence[1].hybrid_label, 'Pioneer P0306Q');
  assert.ok(adapterResponse.source_evidence[2].replicate_blocks.includes('R1'));
  assert.equal(adapterResponse.source_evidence[2].treatment_code, 'T3');
  assert.equal(adapterResponse.correspondence_basis.identity_equality_claimed, false);
  assert.equal(adapterResponse.correspondence_basis.geometry_equality_claimed, false);

  const ledger = new AuthorityLedger();
  const snapshotStore = new ExactContextSnapshotStore();
  const principal = Object.freeze({
    principalId: 'kbs-t3r1-context-gateway',
    type: 'SERVICE_ACCOUNT',
    organizationId: OWNERSHIP.organizationId,
    tenantId: OWNERSHIP.tenantId,
    programIds: []
  });

  let seq = 0;
  function audit(suffix, occurredAt, inputRefs = []) {
    seq += 1;
    return {
      eventId: `evt-kbs-t3r1-target-${seq}-${suffix}`,
      occurredAt,
      actor: { type: principal.type, id: principal.principalId },
      inputRefs,
      details: {
        suite: 'real-kbs-t3r1-target-correspondence',
        classification: 'REAL_PROVIDER_TARGET_CORRESPONDENCE_QUALIFICATION_TEST_ONLY'
      }
    };
  }

  function publishContextWriteAuthorization(logicalId, resourceType, occurredAt) {
    const role = publishRoleAssignment({
      ledger,
      logicalId: `role.kbs-t3r1.${resourceType.toLowerCase()}.${logicalId}`,
      version: '1',
      principal,
      role: 'KBS_T3R1_CONTEXT_GATEWAY',
      roleDefinitionVersion: 'kbs-t3r1-target-v1',
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
  assert.equal(semanticEntries.length, 7);

  const datumRefs = [];
  const receiptRefs = [];
  const validatedDatums = [];

  for (const [semanticId, value] of semanticEntries) {
    const safe = semanticId.replaceAll('.', '-');
    const referenceId = `context-reference.kbs-t3r1-2026.${safe}`;
    const datumId = `context-datum.kbs-t3r1-2026.${safe}`;
    const receiptId = `context-receipt.kbs-t3r1-2026.${safe}`;

    const referenceAuth = publishContextWriteAuthorization(
      referenceId, 'AUTHORIZED_CONTEXT_REFERENCE', '2026-09-05T02:01:00.000Z'
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
          providerId: KBS_T3R1_PROVIDER_ID,
          locator: KBS_T3R1_ADAPTER_LOCATOR,
          addressingMode: 'CONTENT_ADDRESSED',
          expectedContentHash: providerHash
        },
        authorizationContext: {
          connectionId: KBS_T3R1_PROVIDER_ID,
          principalScope: {
            ...OWNERSHIP,
            subjectId: 'KBS_MCSE_T3_R1_2026',
            resourceIds: adapterResponse.source_evidence.map((entry) => entry.locator),
            semanticIds: [semanticId]
          }
        }
      },
      principal,
      authorizationDecisionAuditRef: referenceAuth.ref,
      audit: audit(`reference-${safe}`, '2026-09-05T02:02:00.000Z')
    });
    validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: reference.ref });

    const datumAuth = publishContextWriteAuthorization(
      datumId, 'CONTEXT_DATUM', '2026-09-05T02:03:00.000Z'
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
        availableAt: KBS_T3R1_AVAILABLE_AT,
        spatialSupport: { type: 'EXPERIMENTAL_TREATMENT' },
        verticalSupport: null,
        temporalSupport: { type: adapterResponse.evaluation_slice.kind },
        uncertainty: { type: 'NONE' },
        source: {
          providerId: KBS_T3R1_PROVIDER_ID,
          sourceRef: `${KBS_T3R1_ADAPTER_LOCATOR}#${semanticId}`,
          contentHash: providerHash
        }
      },
      principal,
      authorizationDecisionAuditRef: datumAuth.ref,
      audit: audit(`datum-${safe}`, '2026-09-05T02:04:00.000Z')
    });
    const validatedDatum = validateContextDatumAuthority({ ledger, contextDatumRef: datum.ref });
    assert.equal(validatedDatum.semanticPayload.semanticId, semanticId);
    assert.deepEqual(validatedDatum.semanticPayload.value, value);
    assert.equal(validatedDatum.semanticPayload.source.contentHash, providerHash);
    assert.equal(validatedDatum.semanticPayload.spatialSupport.type, 'EXPERIMENTAL_TREATMENT');
    assert.equal('geometryRef' in validatedDatum.semanticPayload.spatialSupport, false);

    const receiptAuth = publishContextWriteAuthorization(
      receiptId, 'RESOLVED_CONTEXT_DATUM_RECEIPT', '2026-09-05T02:04:30.000Z'
    );
    const receipt = publishResolvedContextDatumReceipt({
      ledger,
      logicalId: receiptId,
      version: '1',
      referenceRef: reference.ref,
      normalizedContextDatumRef: datum.ref,
      providerResponseBytes: providerBytes,
      resolution: {
        resolvedAt: KBS_T3R1_RESOLVED_AT,
        effectiveAt: adapterResponse.evaluation_slice.representative_effective_at,
        availableAt: KBS_T3R1_AVAILABLE_AT
      },
      retainSnapshot: true,
      snapshotStore,
      principal,
      authorizationDecisionAuditRef: receiptAuth.ref,
      audit: audit(`receipt-${safe}`, KBS_T3R1_RESOLVED_AT)
    });
    const validatedReceipt = validateResolvedContextDatumReceiptAuthority({
      ledger,
      receiptRef: receipt.ref,
      snapshotStore
    });
    assert.equal(validatedReceipt.receipt.semanticPayload.replayClass, 'EXACT');
    assert.equal(validatedReceipt.receipt.semanticPayload.providerResponseHash, providerHash);

    datumRefs.push(datum.ref);
    receiptRefs.push(receipt.ref);
    validatedDatums.push(validatedDatum);
  }

  assert.equal(snapshotStore.count(), 1);
  assert.deepEqual(snapshotStore.get(providerHash), providerBytes);

  const decisionLogicalId = 'decision-problem.kbs-t3r1-2026.target-correspondence-qualification';
  const decisionRole = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-t3r1.decision.${decisionLogicalId}`,
    version: '1',
    principal,
    role: 'KBS_T3R1_DECISION_CREATOR',
    roleDefinitionVersion: 'kbs-t3r1-target-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM' },
    audit: audit('decision-role', '2026-09-05T02:06:00.000Z')
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
    audit: audit('decision-auth', '2026-09-05T02:07:00.000Z')
  });
  const decision = publishDecisionProblem({
    ledger,
    logicalId: decisionLogicalId,
    version: '1',
    problem: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      decisionType: KBS_T3R1_DECISION_TYPE,
      targetRef: OWNERSHIP,
      logicalTime: KBS_T3R1_LOGICAL_TIME,
      decisionHorizon: { duration: 'PT1H' },
      objective: { code: 'QUALIFY_CROSS_NAMESPACE_TARGET_CORRESPONDENCE' },
      actionSpace: ['ABSTAIN'],
      constraints: [{
        type: 'RETROSPECTIVE_EVALUATION_SLICE',
        start: adapterResponse.evaluation_slice.start,
        end: adapterResponse.evaluation_slice.end,
        targetContextSelector: {
          semanticId: 'treatment.code',
          operator: 'EQUALS',
          value: 'T3'
        }
      }],
      usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
      useClass: 'TEST_ONLY',
      decisionAuthorityMode: 'RUNTIME_ONLY',
      decisionDeadline: KBS_T3R1_DEADLINE
    },
    principal,
    authorizationDecisionAuditRef: decisionAuth.ref,
    audit: audit('decision-publish', '2026-09-05T02:08:00.000Z')
  });
  const validatedDecision = validateDecisionProblemAuthority({
    ledger,
    decisionProblemRef: decision.ref
  });
  assert.deepEqual(validatedDecision.semanticPayload.targetRef, OWNERSHIP);
  assert.equal(validatedDecision.semanticPayload.decisionType, KBS_T3R1_DECISION_TYPE);
  assert.equal('farmId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('fieldId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('zoneId' in validatedDecision.semanticPayload.targetRef, false);

  const manifestLogicalId = 'context-manifest.kbs-t3r1-2026.target-correspondence-qualification';
  const manifestAuth = publishContextWriteAuthorization(
    manifestLogicalId, 'CONTEXT_MANIFEST', '2026-09-05T02:09:00.000Z'
  );
  const manifest = publishContextManifest({
    ledger,
    logicalId: manifestLogicalId,
    version: '1',
    decisionProblemRef: decision.ref,
    evidenceCutoff: KBS_T3R1_EVIDENCE_CUTOFF,
    datumRefs,
    resolvedReferenceReceiptRefs: receiptRefs,
    snapshotStore,
    principal,
    authorizationDecisionAuditRef: manifestAuth.ref,
    audit: audit('manifest-publish', '2026-09-05T02:11:00.000Z')
  });
  const validatedManifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef: manifest.ref,
    snapshotStore
  });
  assert.equal(validatedManifest.semanticPayload.replayClass, 'EXACT');
  assert.equal(validatedManifest.semanticPayload.datumRefs.length, semanticEntries.length);
  assert.equal(validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length, semanticEntries.length);

  const snapshot = targetContextSnapshot({ ledger, contextManifestRef: manifest.ref, snapshotStore });
  assert.equal(snapshot.datumRefs.length, semanticEntries.length);

  const contextBySemanticId = Object.freeze(Object.fromEntries(
    validatedDatums.map((record) => [record.semanticPayload.semanticId, record.semanticPayload.value])
  ));
  assert.deepEqual(contextBySemanticId['experiment.name'], {
    type: 'STRING', string: 'Main Cropping System Experiment (MCSE)'
  });
  assert.deepEqual(contextBySemanticId['treatment.code'], { type: 'CATEGORY', category: 'T3' });
  assert.deepEqual(contextBySemanticId['replicate.code'], { type: 'CATEGORY', category: 'R1' });
  assert.deepEqual(contextBySemanticId['crop.code'], { type: 'CATEGORY', category: 'corn' });
  assert.deepEqual(contextBySemanticId['planting.hybrid'], { type: 'STRING', string: 'P0306Q' });
  assert.deepEqual(contextBySemanticId['planting.observation_id'], { type: 'STRING', string: '6966' });

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
    contextBySemanticId,
    decision,
    manifest,
    providerTarget: Object.freeze({
      experiment: 'Main Cropping System Experiment (MCSE)',
      treatment: 'T3',
      replicate: 'R1',
      crop: 'corn',
      plantingObservationId: '6966',
      hybrid: 'P0306Q'
    })
  });
}
