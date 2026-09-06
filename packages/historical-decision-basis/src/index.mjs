import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';
import { validateDecisionResult } from '../../decision-result/src/index.mjs';
import { validateDeploymentAuthority } from '../../deployment/src/index.mjs';
import { validateImplementationConformanceHistorical } from '../../implementation-conformance/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import { validateRuntimeEligibility } from '../../runtime-eligibility/src/index.mjs';
import { validateRuntimeProfileAuthority } from '../../runtime-profile/src/index.mjs';

export const HISTORICAL_DECISION_BASIS_READ_MODEL_VERSION = 'adr.historical-decision-basis.read-model.v1';
export const HISTORICAL_DECISION_BASIS_AUTHORITY_CLASS = 'NONE_NON_AUTHORITY_RECONSTRUCTION_READ_MODEL';
export const HISTORICAL_DECISION_BASIS_DIGEST_AUTHORITY = 'NONE_DIGEST_IS_REPRODUCIBILITY_EVIDENCE_NOT_AUTHORITY_REF';
export const HISTORICAL_DECISION_BASIS_GRAPH_CLASS = 'NONE_NON_AUTHORITY_EXACT_REF_GRAPH_PROJECTION';
export const HISTORICAL_DECISION_BASIS_DECISION_SEMANTICS_CLASS = 'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_SEMANTICS_PROJECTION';

export class HistoricalDecisionBasisError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HistoricalDecisionBasisError';
    this.code = code;
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
    throw new HistoricalDecisionBasisError('HISTORICAL_BASIS_INPUT_REQUIRED', `${name} is required`);
  }
  return value;
}

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function compareUtf16(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueRefs(values) {
  const map = new Map();
  for (const ref of values.filter(Boolean)) map.set(refKey(ref), ref);
  return [...map.values()].sort((left, right) => compareUtf16(refKey(left), refKey(right)));
}

function uniqueByRef(values) {
  const map = new Map();
  for (const value of values) map.set(refKey(value.ref), value);
  return [...map.values()].sort((left, right) => compareUtf16(refKey(left.ref), refKey(right.ref)));
}

function requireSameRef(actual, expected, message) {
  if (!sameAuthorityRef(actual, expected)) {
    throw new HistoricalDecisionBasisError('HISTORICAL_BASIS_REF_MISMATCH', message);
  }
}

export function reconstructHistoricalDecisionBasis(input = {}) {
  const ledger = requireObject(input.ledger, 'ledger');
  const snapshotStore = requireObject(input.snapshotStore, 'snapshotStore');
  const decisionResultRef = requireObject(input.decisionResultRef, 'decisionResultRef');

  // The sole caller-supplied authority identity is the exact historical DecisionResult ref.
  // Every predecessor is discovered and validated through governed frozen references.
  const decisionResult = validateDecisionResult({ ledger, decisionResultRef });
  const resultPayload = decisionResult.semanticPayload;
  const robustness = decisionResult.decisionRobustness;
  const alternativeSet = robustness.runtimeAlternativeSet;

  requireSameRef(
    robustness.record.ref,
    resultPayload.decisionRobustnessRef,
    'D06 must reconstruct the exact frozen D05 authority'
  );
  requireSameRef(
    alternativeSet.record.ref,
    resultPayload.runtimeAlternativeSetRef,
    'D06/D05 must reconstruct the exact frozen D04 authority'
  );

  // Exact D06 semantics are a derived inspection projection over the already-validated
  // DecisionResult authority. Keep this outside the frozen basisDigest so ADR-2 can expose
  // complete ACT/WAIT/ASK/ABSTAIN semantics without changing the v1 digest identity.
  const decisionSemantics = {
    projectionClass: HISTORICAL_DECISION_BASIS_DECISION_SEMANTICS_CLASS,
    decisionResultRef: decisionResult.record.ref,
    semanticPayload: cloneCanonicalValue(resultPayload)
  };

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

    requireSameRef(
      eligibility.record.ref,
      binding.semanticPayload.runtimeEligibilityRef,
      'D01 must retain the exact frozen R03 authority'
    );
    requireSameRef(
      eligibility.semanticPayload.decisionProblemRef,
      resultPayload.decisionProblemRef,
      'R03 and D06 must bind the same exact DecisionProblem'
    );
    requireSameRef(
      deployment.record.ref,
      binding.semanticPayload.deploymentRef,
      'D01 must retain the exact historical Deployment authority'
    );
    requireSameRef(
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

      requireSameRef(
        applicability.record.ref,
        knowledgeBinding.applicabilityAssessmentRef,
        'D01 knowledge binding must resolve exact A08 authority'
      );
      requireSameRef(
        applicability.knowledgeAuthority.ref,
        knowledgeBinding.knowledgeRef,
        'A08 historical replay must resolve exact knowledge authority'
      );
      requireSameRef(
        applicability.contextManifestAuthority.record.ref,
        binding.semanticPayload.contextManifestRef,
        'A08 historical replay must retain the exact ContextManifest'
      );
      requireSameRef(
        applicability.retrievalAuthority.record.ref,
        eligibility.semanticPayload.knowledgeRetrievalResultRef,
        'A08 and R03 must retain the same exact KnowledgeRetrievalResult'
      );
      requireSameRef(
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
      requireSameRef(
        conformance.semanticPayload.specificationRef,
        executionBinding.specificationRef,
        'historical conformance must retain exact Specification authority'
      );
      requireSameRef(
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
  const contextManifestRefs = uniqueRefs(applicabilityWorlds.map((world) => world.contextManifestRef));
  const knowledgeRefs = uniqueRefs(applicabilityWorlds.map((world) => world.knowledgeRef));

  // Keep the v1 digest basis semantically compatible with the first product slice.
  // authorityGraph and decisionSemantics below are derived inspection projections and
  // are intentionally outside basisDigest.
  const basis = {
    readModelVersion: HISTORICAL_DECISION_BASIS_READ_MODEL_VERSION,
    authorityClass: HISTORICAL_DECISION_BASIS_AUTHORITY_CLASS,
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

  const bindingPayloads = runtimeWorlds.map((world) => ledger.resolve(world.ref).semanticPayload);
  const applicabilityPayloads = applicabilityWorlds.map((world) => ledger.resolve(world.ref).semanticPayload);
  const contextWorlds = contextManifestRefs.map((contextManifestRef) => {
    const validated = validateContextManifestAuthority({ ledger, contextManifestRef, snapshotStore });
    const payload = validated.semanticPayload;
    const referenceResolutionWorlds = validated.receipts.map((resolved) => ({
      resolvedReferenceReceiptRef: resolved.receipt.ref,
      authorizedContextReferenceRef: resolved.reference.record.ref,
      resolvedContextDatumRef: resolved.contextDatum.record.ref,
      replayClass: resolved.receipt.semanticPayload.replayClass,
      retentionMode: resolved.receipt.semanticPayload.retention.mode,
      providerResponseHash: resolved.receipt.semanticPayload.providerResponseHash
    })).sort((left, right) => compareUtf16(
      refKey(left.resolvedReferenceReceiptRef),
      refKey(right.resolvedReferenceReceiptRef)
    ));
    return {
      contextManifestRef,
      targetRef: payload.targetRef,
      logicalTime: payload.logicalTime,
      evidenceCutoff: payload.evidenceCutoff,
      replayClass: payload.replayClass,
      datumRefs: uniqueRefs(payload.datumRefs ?? []),
      resolvedReferenceReceiptRefs: uniqueRefs(payload.resolvedReferenceReceiptRefs ?? []),
      referenceResolutionWorlds
    };
  });
  const applicabilityInspectionWorlds = applicabilityWorlds.map((world, index) => ({
    applicabilityAssessmentRef: world.ref,
    decisionProblemRef: applicabilityPayloads[index].decisionProblemRef,
    knowledgeRetrievalResultRef: applicabilityPayloads[index].knowledgeRetrievalResultRef,
    knowledgeRef: applicabilityPayloads[index].knowledgeRef,
    knowledgeOriginContextRefs: uniqueRefs(applicabilityPayloads[index].knowledgeOriginContextRefs ?? []),
    contextManifestRef: applicabilityPayloads[index].contextManifestRef,
    transportStatus: applicabilityPayloads[index].transportStatus,
    scientificUseStatus: applicabilityPayloads[index].scientificUseStatus,
    decisionRelevance: applicabilityPayloads[index].decisionRelevance,
    runtimeUse: applicabilityPayloads[index].runtimeUse,
    limitations: applicabilityPayloads[index].limitations,
    conflicts: applicabilityPayloads[index].conflicts,
    missingContextSemanticIds: applicabilityPayloads[index].missingContextSemanticIds,
    unsupportedConstraintCodes: applicabilityPayloads[index].unsupportedConstraintCodes
  }));

  const decisionRefs = uniqueRefs([
    decisionResult.record.ref,
    resultPayload.decisionProblemRef,
    robustness.record.ref,
    alternativeSet.record.ref,
    resultPayload.decisionAuthority?.authorityRef
  ]);
  const runtimeRefs = uniqueRefs([
    ...runtimeWorlds.map((world) => world.ref),
    ...runtimeWorlds.map((world) => world.runtimeEligibilityRef),
    ...runtimeWorlds.map((world) => world.deploymentRef),
    ...runtimeWorlds.map((world) => world.runtimeProfileRef)
  ]);
  const resolvedReferenceReceiptRefs = uniqueRefs(
    contextWorlds.flatMap((world) => world.referenceResolutionWorlds.map((item) => item.resolvedReferenceReceiptRef))
  );
  const authorizedContextReferenceRefs = uniqueRefs(
    contextWorlds.flatMap((world) => world.referenceResolutionWorlds.map((item) => item.authorizedContextReferenceRef))
  );
  const contextRefs = uniqueRefs([
    ...contextManifestRefs,
    ...contextWorlds.flatMap((world) => world.datumRefs),
    ...resolvedReferenceReceiptRefs,
    ...authorizedContextReferenceRefs,
    ...contextWorlds.flatMap((world) => world.referenceResolutionWorlds.map((item) => item.resolvedContextDatumRef))
  ]);
  const knowledgeAuthorityRefs = uniqueRefs([
    ...knowledgeRefs,
    ...applicabilityWorlds.map((world) => world.retrievalRef),
    ...applicabilityWorlds.map((world) => world.ref),
    ...applicabilityWorlds.map((world) => world.knowledgeReleaseRef),
    ...applicabilityPayloads.flatMap((payload) => payload.knowledgeOriginContextRefs ?? [])
  ]);
  const specificationRefs = uniqueRefs([
    ...bindingPayloads.flatMap((payload) => payload.transformationBindings ?? []),
    ...bindingPayloads.flatMap((payload) => payload.modelBindings ?? []),
    ...bindingPayloads.flatMap((payload) => payload.policyBindings ?? []),
    ...(resultPayload.policyResultRefs ?? []).map((item) => item.policyRef)
  ]);
  const implementationRefs = uniqueRefs(
    runtimeWorlds.flatMap((world) => world.executionWorlds.flatMap((item) => [
      item.implementationRef,
      item.implementationConformanceRef
    ]))
  );
  const allAuthorityRefs = uniqueRefs([
    ...decisionRefs,
    ...runtimeRefs,
    ...contextRefs,
    ...knowledgeAuthorityRefs,
    ...specificationRefs,
    ...implementationRefs
  ]);

  const authorityGraph = {
    projectionClass: HISTORICAL_DECISION_BASIS_GRAPH_CLASS,
    entryRef: decisionResult.record.ref,
    decisionRefs,
    runtimeRefs,
    contextRefs,
    resolvedReferenceReceiptRefs,
    authorizedContextReferenceRefs,
    knowledgeRefs: knowledgeAuthorityRefs,
    specificationRefs,
    implementationRefs,
    allAuthorityRefs,
    contextWorlds,
    applicabilityWorlds: applicabilityInspectionWorlds
  };

  const output = {
    ...cloneCanonicalValue(basis),
    basisDigest: semanticHash('HistoricalDecisionBasisReadModel', basis),
    basisDigestAuthority: HISTORICAL_DECISION_BASIS_DIGEST_AUTHORITY,
    decisionSemantics: cloneCanonicalValue(decisionSemantics),
    authorityGraph: cloneCanonicalValue(authorityGraph)
  };
  return deepFreeze(output);
}
