import assert from 'node:assert/strict';

import { canonicalizeSemanticJson } from '../../packages/canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  publishContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import {
  HISTORICAL_DECISION_BASIS_AUTHORITY_CLASS,
  HISTORICAL_DECISION_BASIS_DIGEST_AUTHORITY,
  HISTORICAL_DECISION_BASIS_READ_MODEL_VERSION,
  reconstructHistoricalDecisionBasis
} from '../../packages/historical-decision-basis/src/index.mjs';
import { plantingRuntimeWorld } from './run-runtime-composition-v1.mjs';

// Build the already-qualified World P D02-D04-D05-D06 authority graph unchanged.
await import('./run-decision-result-v1.mjs');

const { ledger, snapshotStore } = plantingRuntimeWorld;
const decisionResultRecords = ledger.exportSnapshot().records
  .filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResultRecords.length, 1, 'World P must expose exactly one DecisionResult authority');
const historicalDecisionResultRef = decisionResultRecords[0].ref;

const recordCountBeforeRead = ledger.exportSnapshot().records.length;
const beforeLaterEvidence = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResultRef
});
assert.equal(
  ledger.exportSnapshot().records.length,
  recordCountBeforeRead,
  'historical basis reconstruction must not publish or mutate authority records'
);

assert.equal(beforeLaterEvidence.readModelVersion, HISTORICAL_DECISION_BASIS_READ_MODEL_VERSION);
assert.equal(beforeLaterEvidence.authorityClass, HISTORICAL_DECISION_BASIS_AUTHORITY_CLASS);
assert.equal(beforeLaterEvidence.basisDigestAuthority, HISTORICAL_DECISION_BASIS_DIGEST_AUTHORITY);
assert.equal(beforeLaterEvidence.decisionDisposition, 'ACT');
assert.equal(beforeLaterEvidence.decisionAuthority.mode, 'ADR_POLICY');
assert.equal(beforeLaterEvidence.structuredAction.actionCode, 'SET_SOYBEAN_SEEDING_RATE');
assert.deepEqual(beforeLaterEvidence.structuredAction.materialParameters, [{
  name: 'population',
  semanticId: 'planting.population_seeds_per_acre',
  valueType: 'DECIMAL',
  unit: 'seed/acre',
  value: { type: 'DECIMAL', decimal: '150000' }
}]);
assert.equal(beforeLaterEvidence.runtimeWorlds.length, 1);
assert.equal(beforeLaterEvidence.knowledgeRefs.length, 1);
assert.equal(beforeLaterEvidence.applicabilityAssessmentRefs.length, 1);
assert.equal(beforeLaterEvidence.contextManifestRefs.length, 1);
assert.deepEqual(beforeLaterEvidence.nonclaims, {
  humanApprovalAuthority: false,
  dispatchAuthority: false,
  machineExecutionAuthority: false,
  executionReceiptAuthority: false,
  outcomeAuthority: false,
  causalAttributionAuthority: false
});
assert.equal(Object.isFrozen(beforeLaterEvidence), true);
assert.equal(Object.isFrozen(beforeLaterEvidence.runtimeWorlds), true);

// Exact identity is mandatory. A forged semantic hash cannot fall back to another version.
assert.throws(() => reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: {
    ...historicalDecisionResultRef,
    semanticHash: `sha256:${'0'.repeat(64)}`
  }
}));

// Publish a fully valid later ContextDatum after the historical evidence cutoff.
const historicalManifest = ledger.resolve(beforeLaterEvidence.contextManifestRefs[0]);
const historicalDatumRef = historicalManifest.semanticPayload.datumRefs[0];
const historicalDatum = ledger.resolve(historicalDatumRef);
const historicalDatumAudit = ledger.auditFor(historicalDatum.ref).find((event) =>
  sameAuthorityRef(event.objectRef, historicalDatum.ref)
    && event.action === 'PUBLISH_CONTEXT_DATUM'
    && event.details?.creationPrincipal
    && event.details?.targetScope
    && event.details?.authorizationDecisionAuditRef);
assert.ok(historicalDatumAudit, 'historical ContextDatum must expose replayable publication authority');

const lateAvailableAt = '2026-09-04T12:30:00.000Z';
assert.ok(
  new Date(lateAvailableAt) > new Date(historicalManifest.semanticPayload.evidenceCutoff),
  'later evidence must become available strictly after the historical evidence cutoff'
);
const historicalDatumPayload = historicalDatum.semanticPayload;
const lateDatum = publishContextDatum({
  ledger,
  logicalId: historicalDatum.ref.logicalId,
  version: '3-product-read-model-late-evidence',
  target: historicalDatumAudit.details.targetScope,
  datum: {
    contractVersion: historicalDatumPayload.contractVersion,
    semanticId: historicalDatumPayload.semanticId,
    value: historicalDatumPayload.value,
    unit: historicalDatumPayload.unit,
    epistemicClass: historicalDatumPayload.epistemicClass,
    provenanceClass: historicalDatumPayload.provenanceClass,
    effectiveInterval: historicalDatumPayload.effectiveInterval,
    availableAt: lateAvailableAt,
    spatialSupport: historicalDatumPayload.spatialSupport,
    verticalSupport: historicalDatumPayload.verticalSupport,
    temporalSupport: historicalDatumPayload.temporalSupport,
    uncertainty: historicalDatumPayload.uncertainty,
    source: historicalDatumPayload.source
  },
  principal: historicalDatumAudit.details.creationPrincipal,
  authorizationDecisionAuditRef: historicalDatumAudit.details.authorizationDecisionAuditRef,
  audit: {
    eventId: 'evt-blueprint-adr2-product-read-model-late-context',
    occurredAt: '2026-09-04T12:31:00.000Z',
    actor: {
      id: historicalDatumAudit.details.creationPrincipal.principalId,
      type: historicalDatumAudit.details.creationPrincipal.type
    },
    details: {
      suite: 'blueprint-adr2-historical-decision-basis-product-interface-v1',
      classification: 'VALID_LATER_EVIDENCE_NO_LOOKAHEAD_TRIPWIRE'
    }
  }
});
const validatedLateDatum = validateContextDatumAuthority({ ledger, contextDatumRef: lateDatum.ref });
assert.equal(validatedLateDatum.semanticPayload.availableAt, lateAvailableAt);
assert.equal(
  historicalManifest.semanticPayload.datumRefs.some((ref) => sameAuthorityRef(ref, lateDatum.ref)),
  false,
  'historical ContextManifest must not acquire later evidence'
);

// Add latest-version tripwires across material authority kinds. Historical reconstruction
// must continue to follow exact frozen refs and never perform latest-lineage selection.
const tripwireKinds = [
  'DecisionProblem',
  'Policy',
  'ApplicabilityAssessment',
  'RuntimeEligibility',
  'RuntimeBinding'
];
for (const kind of tripwireKinds) {
  const original = ledger.exportSnapshot().records.find((record) => record.ref.kind === kind);
  assert.ok(original, `missing ${kind} authority needed for anti-latest tripwire`);
  ledger.publish({
    kind,
    logicalId: original.ref.logicalId,
    version: '998-product-read-model-tripwire',
    semanticPayload: {
      antiLatestTripwire: true,
      originalRef: original.ref,
      message: 'ADR2_PRODUCT_READ_MODEL_MUST_NOT_SELECT_THIS_LATER_VERSION'
    },
    audit: {
      eventId: `evt-blueprint-adr2-product-read-model-tripwire-${kind.toLowerCase()}`,
      occurredAt: '2026-09-04T12:40:00.000Z',
      actor: { type: 'SERVICE_ACCOUNT', id: 'blueprint-adr2-product-read-model-tripwire' },
      details: {
        suite: 'blueprint-adr2-historical-decision-basis-product-interface-v1',
        classification: 'ANTI_LATEST_LOOKUP_TRIPWIRE_NOT_DOMAIN_AUTHORITY'
      }
    }
  });
}

const beforeSecondReadRecordCount = ledger.exportSnapshot().records.length;
const afterLaterEvidence = reconstructHistoricalDecisionBasis({
  ledger,
  snapshotStore,
  decisionResultRef: historicalDecisionResultRef
});
assert.equal(
  ledger.exportSnapshot().records.length,
  beforeSecondReadRecordCount,
  'repeat reconstruction must remain read-only'
);
assert.equal(
  canonicalizeSemanticJson(afterLaterEvidence),
  canonicalizeSemanticJson(beforeLaterEvidence),
  'later valid evidence and later versions must not rewrite the historical basis'
);
assert.equal(afterLaterEvidence.basisDigest, beforeLaterEvidence.basisDigest);

const finalRecords = ledger.exportSnapshot().records;
assert.equal(finalRecords.filter((record) => record.ref.kind === 'ExecutionReceipt').length, 0);
assert.equal(finalRecords.filter((record) => record.ref.kind === 'Outcome').length, 0);
assert.equal(finalRecords.filter((record) => record.ref.kind === 'OutcomeEvaluation').length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_HISTORICAL_DECISION_BASIS_PRODUCT_READ_MODEL_V1',
  classification: HISTORICAL_DECISION_BASIS_AUTHORITY_CLASS,
  entrypoint: {
    callerSuppliedAuthorityRefs: 1,
    decisionResultRef: historicalDecisionResultRef,
    predecessorRefsRequired: 0,
    latestLookupRequired: false
  },
  productReadModel: {
    version: afterLaterEvidence.readModelVersion,
    basisDigest: afterLaterEvidence.basisDigest,
    basisDigestAuthority: afterLaterEvidence.basisDigestAuthority,
    deterministicAfterLaterEvidence: true,
    authorityRecordsWrittenByReconstruction: 0
  },
  nonclaims: afterLaterEvidence.nonclaims
}, null, 2));
