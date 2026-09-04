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

export const PLANTING_TARGET_OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
export const PLANTING_PROVIDER_ID = 'kbs-public-context-adapter-v1';
export const PLANTING_PROVIDER_HASH = 'sha256:5ff980da7a9479bafad43eb47bbb6df71cc6a4a7d00b2eb814f05073a931d5f6';
export const PLANTING_ADAPTER_LOCATOR = `urn:adr:acceptance:kbs-public-context-adapter:v1:soybean-15in-2015:${PLANTING_PROVIDER_HASH}`;
export const PLANTING_AVAILABLE_AT = '2026-09-04T10:30:00.000Z';
export const PLANTING_RESOLVED_AT = '2026-09-04T10:35:00.000Z';
export const PLANTING_EVIDENCE_CUTOFF = '2026-09-04T10:45:00.000Z';
export const PLANTING_LOGICAL_TIME = '2026-09-04T10:50:00.000Z';
export const PLANTING_DEADLINE = '2026-09-04T11:50:00.000Z';
export const PLANTING_DECISION_TYPE = 'SOYBEAN_PLANTING_POPULATION_ADVISORY';

export function buildPlantingTargetWorld() {
  const OWNERSHIP = PLANTING_TARGET_OWNERSHIP;
  const providerBytes = readFileSync(new URL('./kbs-soybean-15in-2015-context-adapter-response.json', import.meta.url));
  const providerHash = providerResponseContentHash(providerBytes);
  assert.equal(providerHash, PLANTING_PROVIDER_HASH);

  const adapterResponse = JSON.parse(providerBytes.toString('utf8'));
  assert.equal(adapterResponse.adapter_contract, 'adr.acceptance.kbs-public-context-adapter.v1');
  assert.equal(adapterResponse.world, 'KBS_SOYBEAN_15IN_2015_RETROSPECTIVE_PLANTING_TARGET');
  assert.equal(adapterResponse.retained_at, PLANTING_AVAILABLE_AT);
  assert.deepEqual(adapterResponse.normalized_context, {
    'crop.code': { type: 'CATEGORY', category: 'soybean' },
    'jurisdiction.region': { type: 'CATEGORY', category: 'michigan' },
    'planting.row_spacing_in': { type: 'DECIMAL', decimal: '15' }
  });
  assert.equal(adapterResponse.source_evidence[0].locator, 'https://aglog.kbs.msu.edu/observations/3187');
  assert.equal(adapterResponse.source_evidence[0].observation_date, '2015-05-21');
  assert.equal(adapterResponse.source_evidence[0].crop_label, 'soybeans');
  assert.equal(adapterResponse.source_evidence[0].row_spacing_in, '15');
  assert.equal(adapterResponse.source_evidence[0].historical_operation_planting_population_seeds_per_acre, '180000');
  assert.equal(adapterResponse.source_evidence[0].authority_use, 'TARGET_IDENTITY_AND_ROW_SPACING_ONLY');
  assert.equal(
    adapterResponse.source_evidence[1].locator,
    'https://lter.kbs.msu.edu/research/site-description-and-maps/general-description/'
  );
  assert.equal(adapterResponse.source_evidence[1].region_label, 'southwest Michigan');
  assert.ok(adapterResponse.nonclaims.includes('NO_TARGET_AUTHORITY_FOR_RECOMMENDED_PLANTING_POPULATION'));
  assert.ok(adapterResponse.nonclaims.includes('HISTORICAL_OPERATION_180000_IS_NOT_RECOMMENDATION_AUTHORITY'));

  const ledger = new AuthorityLedger();
  const snapshotStore = new ExactContextSnapshotStore();
  const principal = Object.freeze({
    principalId: 'kbs-planting-context-gateway',
    type: 'SERVICE_ACCOUNT',
    organizationId: OWNERSHIP.organizationId,
    tenantId: OWNERSHIP.tenantId,
    programIds: []
  });

  let seq = 0;
  function audit(suffix, occurredAt, inputRefs = []) {
    seq += 1;
    return {
      eventId: `evt-kbs-planting-target-${seq}-${suffix}`,
      occurredAt,
      actor: { type: principal.type, id: principal.principalId },
      inputRefs,
      details: {
        suite: 'real-kbs-soybean-planting-population-target',
        classification: 'RETROSPECTIVE_REAL_TARGET_CONTEXT_TEST_ONLY'
      }
    };
  }

  function publishContextWriteAuthorization(logicalId, resourceType, occurredAt) {
    const role = publishRoleAssignment({
      ledger,
      logicalId: `role.kbs-planting.${resourceType.toLowerCase()}.${logicalId}`,
      version: '1',
      principal,
      role: 'KBS_PLANTING_CONTEXT_GATEWAY',
      roleDefinitionVersion: 'kbs-planting-target-v1',
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
    const referenceId = `context-reference.kbs-planting-2015.${safe}`;
    const datumId = `context-datum.kbs-planting-2015.${safe}`;
    const receiptId = `context-receipt.kbs-planting-2015.${safe}`;
    const referenceAuth = publishContextWriteAuthorization(referenceId, 'AUTHORIZED_CONTEXT_REFERENCE', '2026-09-04T10:31:00.000Z');
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
          providerId: PLANTING_PROVIDER_ID,
          locator: PLANTING_ADAPTER_LOCATOR,
          addressingMode: 'CONTENT_ADDRESSED',
          expectedContentHash: providerHash
        },
        authorizationContext: {
          connectionId: PLANTING_PROVIDER_ID,
          principalScope: {
            ...OWNERSHIP,
            subjectId: 'KBS_SOYBEAN_15IN_2015',
            resourceIds: ['kbs:aglog:3187'],
            semanticIds: [semanticId]
          }
        }
      },
      principal,
      authorizationDecisionAuditRef: referenceAuth.ref,
      audit: audit(`reference-${safe}`, '2026-09-04T10:32:00.000Z')
    });
    validateAuthorizedContextReferenceAuthority({ ledger, referenceRef: reference.ref });

    const datumAuth = publishContextWriteAuthorization(datumId, 'CONTEXT_DATUM', '2026-09-04T10:33:00.000Z');
    const datum = publishContextDatum({
      ledger,
      logicalId: datumId,
      version: '1',
      target: OWNERSHIP,
      datum: {
        contractVersion: CONTEXT_DATUM_CONTRACT_VERSION,
        semanticId,
        value,
        unit: semanticId === 'planting.row_spacing_in' ? 'inch' : 'NOT_APPLICABLE',
        epistemicClass: 'ASSERTION',
        provenanceClass: 'EXTERNAL_PROVIDER',
        effectiveInterval: {
          start: adapterResponse.evaluation_slice.start,
          end: adapterResponse.evaluation_slice.end
        },
        availableAt: PLANTING_AVAILABLE_AT,
        spatialSupport: { type: 'EXPERIMENT' },
        verticalSupport: null,
        temporalSupport: { type: adapterResponse.evaluation_slice.kind },
        uncertainty: { type: 'NONE' },
        source: {
          providerId: PLANTING_PROVIDER_ID,
          sourceRef: `${PLANTING_ADAPTER_LOCATOR}#${semanticId}`,
          contentHash: providerHash
        }
      },
      principal,
      authorizationDecisionAuditRef: datumAuth.ref,
      audit: audit(`datum-${safe}`, '2026-09-04T10:34:00.000Z')
    });
    const validatedDatum = validateContextDatumAuthority({ ledger, contextDatumRef: datum.ref });
    assert.equal(validatedDatum.semanticPayload.semanticId, semanticId);
    assert.deepEqual(validatedDatum.semanticPayload.value, value);
    assert.equal(validatedDatum.semanticPayload.source.contentHash, providerHash);
    assert.equal(validatedDatum.semanticPayload.spatialSupport.type, 'EXPERIMENT');
    assert.equal('geometryRef' in validatedDatum.semanticPayload.spatialSupport, false);

    const receiptAuth = publishContextWriteAuthorization(receiptId, 'RESOLVED_CONTEXT_DATUM_RECEIPT', '2026-09-04T10:34:30.000Z');
    const receipt = publishResolvedContextDatumReceipt({
      ledger,
      logicalId: receiptId,
      version: '1',
      referenceRef: reference.ref,
      normalizedContextDatumRef: datum.ref,
      providerResponseBytes: providerBytes,
      resolution: {
        resolvedAt: PLANTING_RESOLVED_AT,
        effectiveAt: adapterResponse.evaluation_slice.representative_effective_at,
        availableAt: PLANTING_AVAILABLE_AT
      },
      retainSnapshot: true,
      snapshotStore,
      principal,
      authorizationDecisionAuditRef: receiptAuth.ref,
      audit: audit(`receipt-${safe}`, PLANTING_RESOLVED_AT)
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

  const decisionLogicalId = 'decision-problem.kbs-soybean-15in-2015.planting-population-advisory';
  const decisionRole = publishRoleAssignment({
    ledger,
    logicalId: `role.kbs-planting.decision.${decisionLogicalId}`,
    version: '1',
    principal,
    role: 'KBS_PLANTING_DECISION_CREATOR',
    roleDefinitionVersion: 'kbs-planting-target-v1',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: { ...OWNERSHIP, resourceType: 'DECISION_PROBLEM' },
    audit: audit('decision-role', '2026-09-04T10:37:00.000Z')
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
    audit: audit('decision-auth', '2026-09-04T10:38:00.000Z')
  });
  const decision = publishDecisionProblem({
    ledger,
    logicalId: decisionLogicalId,
    version: '1',
    problem: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      decisionType: PLANTING_DECISION_TYPE,
      targetRef: OWNERSHIP,
      logicalTime: PLANTING_LOGICAL_TIME,
      decisionHorizon: { duration: 'PT24H' },
      objective: { code: 'RETROSPECTIVELY_EVALUATE_SOYBEAN_PLANTING_POPULATION_GUIDANCE' },
      actionSpace: ['SET_SOYBEAN_SEEDING_RATE', 'ABSTAIN'],
      constraints: [{
        type: 'RETROSPECTIVE_EVALUATION_SLICE',
        start: adapterResponse.evaluation_slice.start,
        end: adapterResponse.evaluation_slice.end,
        targetContextSelector: {
          semanticId: 'planting.row_spacing_in',
          operator: 'EQUALS',
          value: '15'
        }
      }],
      usePurpose: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use,
      useClass: 'TEST_ONLY',
      decisionAuthorityMode: 'ADR_POLICY',
      decisionDeadline: PLANTING_DEADLINE
    },
    principal,
    authorizationDecisionAuditRef: decisionAuth.ref,
    audit: audit('decision-publish', '2026-09-04T10:40:00.000Z')
  });
  const validatedDecision = validateDecisionProblemAuthority({ ledger, decisionProblemRef: decision.ref });
  assert.deepEqual(validatedDecision.semanticPayload.targetRef, OWNERSHIP);
  assert.equal(validatedDecision.semanticPayload.decisionType, PLANTING_DECISION_TYPE);
  assert.equal(validatedDecision.semanticPayload.decisionAuthorityMode, 'ADR_POLICY');
  assert.equal('farmId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('fieldId' in validatedDecision.semanticPayload.targetRef, false);
  assert.equal('zoneId' in validatedDecision.semanticPayload.targetRef, false);

  const manifestLogicalId = 'context-manifest.kbs-soybean-15in-2015.planting-population-advisory';
  const manifestAuth = publishContextWriteAuthorization(manifestLogicalId, 'CONTEXT_MANIFEST', '2026-09-04T10:43:00.000Z');
  const manifest = publishContextManifest({
    ledger,
    logicalId: manifestLogicalId,
    version: '1',
    decisionProblemRef: decision.ref,
    evidenceCutoff: PLANTING_EVIDENCE_CUTOFF,
    datumRefs,
    resolvedReferenceReceiptRefs: receiptRefs,
    snapshotStore,
    principal,
    authorizationDecisionAuditRef: manifestAuth.ref,
    audit: audit('manifest-publish', '2026-09-04T10:46:00.000Z')
  });
  const validatedManifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef: manifest.ref,
    snapshotStore
  });
  assert.equal(validatedManifest.semanticPayload.replayClass, 'EXACT');
  assert.equal(validatedManifest.semanticPayload.datumRefs.length, 3);
  assert.equal(validatedManifest.semanticPayload.resolvedReferenceReceiptRefs.length, 3);
  assert.ok(new Date(PLANTING_AVAILABLE_AT) <= new Date(PLANTING_RESOLVED_AT));
  assert.ok(new Date(PLANTING_RESOLVED_AT) <= new Date(PLANTING_EVIDENCE_CUTOFF));
  assert.ok(new Date(PLANTING_EVIDENCE_CUTOFF) < new Date(PLANTING_LOGICAL_TIME));

  const snapshot = targetContextSnapshot({ ledger, contextManifestRef: manifest.ref, snapshotStore });
  assert.equal(snapshot.replayClass, 'EXACT');
  const index = Object.fromEntries(validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload]));
  assert.deepEqual(index['crop.code'].value, { type: 'CATEGORY', category: 'soybean' });
  assert.deepEqual(index['jurisdiction.region'].value, { type: 'CATEGORY', category: 'michigan' });
  assert.deepEqual(index['planting.row_spacing_in'].value, { type: 'DECIMAL', decimal: '15' });
  assert.equal(index['planting.row_spacing_in'].unit, 'inch');
  assert.equal('planting.population_seeds_per_acre' in index, false);

  return Object.freeze({
    ledger,
    snapshotStore,
    providerBytes,
    providerHash,
    adapterResponse,
    decision,
    manifest,
    validatedDecision,
    validatedManifest,
    validatedDatums,
    targetSnapshot: snapshot
  });
}
