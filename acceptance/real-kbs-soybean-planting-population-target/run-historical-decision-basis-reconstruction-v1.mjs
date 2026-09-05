import assert from 'node:assert/strict';

import {
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  publishContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import { validateApplicabilityAssessment } from '../../packages/applicability/src/index.mjs';
import { validateDecisionResult } from '../../packages/decision-result/src/index.mjs';
import { validateDeploymentAuthority } from '../../packages/deployment/src/index.mjs';
import { validateImplementationConformanceHistorical } from '../../packages/implementation-conformance/src/index.mjs';
import { validateRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { validateRuntimeEligibility } from '../../packages/runtime-eligibility/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../packages/runtime-profile/src/index.mjs';
import { plantingRuntimeWorld } from './run-runtime-composition-v1.mjs';

// Run the already-qualified World P D02-D04-D05-D06 construction unchanged.
// ESM module caching guarantees that it reuses the same plantingRuntimeWorld ledger.
await import('./run-decision-result-v1.mjs');

const {
  ledger,
  snapshotStore
} = plantingRuntimeWorld;

const decisionResultRecords = ledger.exportSnapshot().records
  .filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResultRecords.length, 1, 'World P must expose exactly one historical DecisionResult authority');
const historicalDecisionResultRef = decisionResultRecords[0].ref;

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function uniqueByRef(values) {
  const map = new Map();
  for (const value of values) map.set(refKey(value.ref), value);
  return [...map.values()].sort((left, right) => refKey(left.ref).localeCompare(refKey(right.ref)));
}

function assertSameRef(actual, expected, message) {
  assert.equal(sameAuthorityRef(actual, expected), true, message);
}

function reconstructHistoricalDecisionBasis({ decisionResultRef }) {
  // Product entry condition under test: the caller supplies only an exact historical
  // DecisionResult ref plus the governed immutable ledger/snapshot stores.
  const decisionResult = validateDecisionResult({ ledger, decisionResultRef });
  const resultPayload = decisionResult.semanticPayload;
  const robustness = decisionResult.decisionRobustness;
  const alternativeSet = robustness.runtimeAlternativeSet;

  assertSameRef(
    robustness.record.ref,
    resultPayload.decisionRobustnessRef,
    'D06 must reconstruct the exact frozen D05 authority'
  );
  assertSameRef(
    alternativeSet.record.ref,
    resultPayload.runtimeAlternativeSetRef,
    'D06/D05 must reconstruct the exact frozen D04 authority'
  );

  const runtimeWorlds = resultPayload.runtimeBindingRefs.map((runtimeBindingRef) => {
    const binding = validateRuntimeBinding({ ledger, runtimeBindingRef });
    const eligibility = validateRuntimeEligibility({
      ledger,
      runtimeEligibilityRef: binding.semanticPayload.runtimeEligibilityRef,
      snapshotStore
    });
    const deployment = validateDeploymentAuthority({
      ledger,
      deploymentRef: binding.semanticPayload.deploymentRef,
      allowHistorical: true
    });
    const profile = validateRuntimeProfileAuthority({
      ledger,
      runtimeProfileRef: binding.semanticPayload.runtimeProfileRef,
      allowHistorical: true
    });

    assertSameRef(
      eligibility.record.ref,
      binding.semanticPayload.runtimeEligibilityRef,
      'D01 must retain the exact frozen R03 authority'
    );
    assertSameRef(
      eligibility.semanticPayload.decisionProblemRef,
      resultPayload.decisionProblemRef,
      'R03 and D06 must bind the same exact DecisionProblem'
    );
    assertSameRef(
      deployment.record.ref,
      binding.semanticPayload.deploymentRef,
      'D01 must retain the exact historical Deployment authority'
    );
    assertSameRef(
      profile.record.ref,
      binding.semanticPayload.runtimeProfileRef,
      'D01 must retain the exact historical RuntimeProfile authority'
    );

    const applicabilityWorlds = binding.semanticPayload.knowledgeBindings.map((knowledgeBinding) => {
      const applicability = validateApplicabilityAssessment({
        ledger,
        applicabilityAssessmentRef: knowledgeBinding.applicabilityAssessmentRef,
        snapshotStore,
        allowHistorical: true
      });
      assertSameRef(
        applicability.record.ref,
        knowledgeBinding.applicabilityAssessmentRef,
        'D01 knowledge binding must resolve exact A08 authority'
      );
      assertSameRef(
        applicability.knowledgeAuthority.ref,
        knowledgeBinding.knowledgeRef,
        'A08 historical replay must resolve exact knowledge authority'
      );
      assertSameRef(
        applicability.contextManifestAuthority.record.ref,
        binding.semanticPayload.contextManifestRef,
        'A08 historical replay must retain the exact ContextManifest'
      );
      assertSameRef(
        applicability.retrievalAuthority.record.ref,
        eligibility.semanticPayload.knowledgeRetrievalResultRef,
        'A08 and R03 must retain the same exact KnowledgeRetrievalResult'
      );
      assertSameRef(
        applicability.retrievalAuthority.decisionAuthority.record.ref,
        resultPayload.decisionProblemRef,
        'retrieval/applicability and D06 must retain the same exact DecisionProblem'
      );

      return {
        ref: applicability.record.ref,
        knowledgeRef: applicability.knowledgeAuthority.ref,
        knowledgeKind: applicability.knowledgeAuthority.ref.kind,
        retrievalRef: applicability.retrievalAuthority.record.ref,
        knowledgeReleaseRef: applicability.retrievalAuthority.semanticPayload.knowledgeReleaseRef,
        contextManifestRef: applicability.contextManifestAuthority.record.ref,
        contextReplayClass: applicability.contextManifestAuthority.semanticPayload.replayClass,
        evidenceCutoff: applicability.contextManifestAuthority.semanticPayload.evidenceCutoff,
        logicalTime: applicability.contextManifestAuthority.semanticPayload.logicalTime,
        scientificUseStatus: applicability.semanticPayload.scientificUseStatus,
        transportStatus: applicability.semanticPayload.transportStatus,
        runtimeUse: applicability.semanticPayload.runtimeUse
      };
    });

    const executionWorlds = binding.semanticPayload.implementationBindings.map((executionBinding) => {
      const conformance = validateImplementationConformanceHistorical({
        ledger,
        conformanceRef: executionBinding.implementationConformanceRef
      });
      assertSameRef(
        conformance.semanticPayload.specificationRef,
        executionBinding.specificationRef,
        'historical conformance must retain exact Specification authority'
      );
      assertSameRef(
        conformance.semanticPayload.implementationRef,
        executionBinding.implementationRef,
        'historical conformance must retain exact Implementation authority'
      );
      return {
        specificationRef: conformance.semanticPayload.specificationRef,
        implementationRef: conformance.semanticPayload.implementationRef,
        implementationConformanceRef: conformance.record.ref,
        replayMode: conformance.replayMode,
        artifactContentHash: conformance.semanticPayload.artifactContentHash,
        implementationDigest: conformance.semanticPayload.implementationDigest,
        executionContext: executionBinding.executionContext
      };
    });

    return {
      ref: binding.record.ref,
      runtimeBindingReplayMode: binding.replayMode,
      runtimeEligibilityRef: eligibility.record.ref,
      runtimePlanRef: eligibility.semanticPayload.planRef,
      runtimeEligibility: eligibility.semanticPayload.runtimeEligibility,
      selectedAlternativePathId: binding.semanticPayload.selectedAlternativePathId,
      decisionProblemRef: binding.semanticPayload.decisionProblemRef,
      deploymentRef: deployment.record.ref,
      runtimeProfileRef: profile.record.ref,
      contextManifestRef: binding.semanticPayload.contextManifestRef,
      knowledgeReleaseRef: binding.semanticPayload.knowledgeReleaseRef,
      evidenceCutoff: binding.semanticPayload.evidenceCutoff,
      logicalTime: binding.semanticPayload.logicalTime,
      applicabilityWorlds,
      executionWorlds
    };
  });

  const applicabilityWorlds = uniqueByRef(runtimeWorlds.flatMap((world) => world.applicabilityWorlds));
  const contextManifestRefs = [...new Map(applicabilityWorlds.map((world) => [
    refKey(world.contextManifestRef),
    world.contextManifestRef
  ])).values()].sort((left, right) => refKey(left).localeCompare(refKey(right)));
  const knowledgeRefs = [...new Map(applicabilityWorlds.map((world) => [
    refKey(world.knowledgeRef),
    world.knowledgeRef
  ])).values()].sort((left, right) => refKey(left).localeCompare(refKey(right)));

  const basis = {
    readModelVersion: 'adr.historical-decision-basis.read-model.v1',
    authorityClass: 'NONE_NON_AUTHORITY_RECONSTRUCTION_READ_MODEL',
    decisionResultRef: decisionResult.record.ref,
    decisionProblemRef: resultPayload.decisionProblemRef,
    decisionRobustnessRef: robustness.record.ref,
    runtimeAlternativeSetRef: alternativeSet.record.ref,
    decisionAuthority: resultPayload.decisionAuthority,
    decisionDisposition: resultPayload.decisionDisposition,
    structuredAction: resultPayload.structuredAction,
    decidedAt: resultPayload.decidedAt,
    humanApprovalAuthority: resultPayload.humanApprovalAuthority,
    machineExecutionAuthority: resultPayload.machineExecutionAuthority,
    runtimeBindingRefs: runtimeWorlds.map((world) => world.ref),
    runtimeWorlds,
    knowledgeRefs,
    applicabilityAssessmentRefs: applicabilityWorlds.map((world) => world.ref),
    contextManifestRefs,
    replayModes: {
      decisionResult: decisionResult.replayMode,
      decisionRobustness: robustness.replayMode,
      runtimeAlternativeSet: alternativeSet.replayMode,
      runtimeBindings: runtimeWorlds.map((world) => world.runtimeBindingReplayMode),
      implementationConformance: runtimeWorlds.flatMap((world) => world.executionWorlds.map((item) => item.replayMode))
    },
    nonclaims: {
      humanApprovalAuthority: false,
      dispatchAuthority: false,
      machineExecutionAuthority: false,
      executionReceiptAuthority: false,
      outcomeAuthority: false,
      causalAttributionAuthority: false
    }
  };

  return Object.freeze({
    ...basis,
    basisDigest: semanticHash('HistoricalDecisionBasisReadModel', basis),
    basisDigestAuthority: 'NONE_DIGEST_IS_REPRODUCIBILITY_EVIDENCE_NOT_AUTHORITY_REF'
  });
}

const beforeLaterEvidence = reconstructHistoricalDecisionBasis({
  decisionResultRef: historicalDecisionResultRef
});

assert.equal(beforeLaterEvidence.authorityClass, 'NONE_NON_AUTHORITY_RECONSTRUCTION_READ_MODEL');
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
assert.equal(beforeLaterEvidence.runtimeWorlds[0].applicabilityWorlds[0].scientificUseStatus, 'QUALIFIED');
assert.equal(beforeLaterEvidence.runtimeWorlds[0].applicabilityWorlds[0].transportStatus, 'DIRECTLY_APPLICABLE');
assert.equal(beforeLaterEvidence.runtimeWorlds[0].applicabilityWorlds[0].runtimeUse, 'ALLOWED');
assert.equal(beforeLaterEvidence.runtimeWorlds[0].applicabilityWorlds[0].contextReplayClass, 'EXACT');
assert.equal(beforeLaterEvidence.humanApprovalAuthority, 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY');
assert.equal(beforeLaterEvidence.machineExecutionAuthority, 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY');

// Publish a fully valid later ContextDatum version after the historical evidence cutoff.
// The original ContextManifest remains immutable and continues to point at its exact v1 datum.
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

const historicalDatumPayload = historicalDatum.semanticPayload;
const lateAvailableAt = '2026-09-04T12:30:00.000Z';
assert.ok(
  new Date(lateAvailableAt) > new Date(historicalManifest.semanticPayload.evidenceCutoff),
  'late ContextDatum must become available strictly after historical evidence cutoff'
);
const lateDatum = publishContextDatum({
  ledger,
  logicalId: historicalDatum.ref.logicalId,
  version: '2-late-after-historical-decision',
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
    eventId: 'evt-blueprint-historical-basis-late-context-v2',
    occurredAt: '2026-09-04T12:31:00.000Z',
    actor: {
      id: historicalDatumAudit.details.creationPrincipal.principalId,
      type: historicalDatumAudit.details.creationPrincipal.type
    },
    details: {
      suite: 'blueprint-historical-decision-basis-reconstruction-v1',
      classification: 'VALID_LATER_EVIDENCE_NO_LOOKAHEAD_TRIPWIRE'
    }
  }
});
const validatedLateDatum = validateContextDatumAuthority({ ledger, contextDatumRef: lateDatum.ref });
assert.equal(validatedLateDatum.semanticPayload.availableAt, lateAvailableAt);
assert.equal(lateDatum.ref.logicalId, historicalDatum.ref.logicalId);
assert.notEqual(lateDatum.ref.version, historicalDatum.ref.version);
assert.equal(
  historicalManifest.semanticPayload.datumRefs.some((ref) => sameAuthorityRef(ref, lateDatum.ref)),
  false,
  'historical ContextManifest must not acquire later evidence'
);

// Add later-version tripwires for several material authority kinds. These are deliberately
// invalid domain payloads but valid ledger records. Any accidental latest/listVersions lookup
// during historical reconstruction will resolve a tripwire rather than the frozen exact ref.
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
    version: '999-latest-tripwire',
    semanticPayload: {
      antiLatestTripwire: true,
      originalRef: original.ref,
      message: 'HISTORICAL_RECONSTRUCTION_MUST_NOT_SELECT_THIS_LATER_VERSION'
    },
    audit: {
      eventId: `evt-blueprint-historical-basis-tripwire-${kind.toLowerCase()}`,
      occurredAt: '2026-09-04T12:40:00.000Z',
      actor: { type: 'SERVICE_ACCOUNT', id: 'blueprint-historical-basis-tripwire' },
      details: {
        suite: 'blueprint-historical-decision-basis-reconstruction-v1',
        classification: 'ANTI_LATEST_LOOKUP_TRIPWIRE_NOT_DOMAIN_AUTHORITY'
      }
    }
  });
  assert.ok(ledger.listVersions(kind, original.ref.logicalId).length >= 2);
}

const afterLaterEvidence = reconstructHistoricalDecisionBasis({
  decisionResultRef: historicalDecisionResultRef
});
assert.equal(
  canonicalizeSemanticJson(afterLaterEvidence),
  canonicalizeSemanticJson(beforeLaterEvidence),
  'later valid evidence and later-version tripwires must not rewrite historical decision basis'
);
assert.equal(afterLaterEvidence.basisDigest, beforeLaterEvidence.basisDigest);

const finalRecords = ledger.exportSnapshot().records;
assert.equal(finalRecords.filter((record) => record.ref.kind === 'ExecutionReceipt').length, 0);
assert.equal(finalRecords.filter((record) => record.ref.kind === 'Outcome').length, 0);
assert.equal(finalRecords.filter((record) => record.ref.kind === 'OutcomeEvaluation').length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_PHASE1_HISTORICAL_DECISION_BASIS_EXISTING_GRAPH_SUFFICIENCY_PROOF',
  classification: 'NON_AUTHORITY_HISTORICAL_RECONSTRUCTION_ACCEPTANCE',
  entrypoint: {
    suppliedDecisionResultRef: historicalDecisionResultRef,
    operatorSuppliedPredecessorRefs: 0,
    latestLookupRequired: false
  },
  reconstructed: {
    basisDigest: afterLaterEvidence.basisDigest,
    decisionProblemRef: afterLaterEvidence.decisionProblemRef,
    knowledgeRefs: afterLaterEvidence.knowledgeRefs,
    applicabilityAssessmentRefs: afterLaterEvidence.applicabilityAssessmentRefs,
    contextManifestRefs: afterLaterEvidence.contextManifestRefs,
    runtimeBindingRefs: afterLaterEvidence.runtimeBindingRefs,
    decisionRobustnessRef: afterLaterEvidence.decisionRobustnessRef,
    runtimeAlternativeSetRef: afterLaterEvidence.runtimeAlternativeSetRef,
    disposition: afterLaterEvidence.decisionDisposition,
    structuredAction: afterLaterEvidence.structuredAction,
    replayModes: afterLaterEvidence.replayModes
  },
  noLookahead: {
    validLaterContextDatumRef: lateDatum.ref,
    validLaterContextAvailableAt: validatedLateDatum.semanticPayload.availableAt,
    historicalEvidenceCutoff: historicalManifest.semanticPayload.evidenceCutoff,
    tripwireKinds,
    basisUnchanged: true
  },
  nonclaims: afterLaterEvidence.nonclaims,
  genericAuthorityContractsModified: false,
  newAuthorityObjectsAdded: 0,
  newDecisionAuthorityAdded: false,
  approvalAuthorityAdded: false,
  executionAuthorityAdded: false
}, null, 2));
