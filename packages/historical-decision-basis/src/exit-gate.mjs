import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';
import { validateDecisionResult } from '../../decision-result/src/index.mjs';
import { validateImplementationConformanceHistorical } from '../../implementation-conformance/src/index.mjs';
import { validateKnowledgeReleaseAuthority } from '../../knowledge-release/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateKnowledgeRetrievalResult } from '../../knowledge-retrieval/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import {
  reconstructHistoricalDecisionBasisWithPublicationAudit
} from './publication-audit.mjs';

export const HISTORICAL_DECISION_BASIS_EXIT_GATE_CLASS =
  'NONE_NON_AUTHORITY_ADR2_EXIT_GATE_INSPECTION_PROJECTION';

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function uniqueRefs(values) {
  const map = new Map();
  for (const value of values.filter(Boolean)) map.set(refKey(value), value);
  return [...map.values()].sort((left, right) => refKey(left).localeCompare(refKey(right)));
}

function isAuthorityRef(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.kind === 'string'
    && typeof value.logicalId === 'string'
    && typeof value.version === 'string'
    && typeof value.semanticHash === 'string';
}

function collectAuthorityRefs(value, output = []) {
  if (isAuthorityRef(value)) {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAuthorityRefs(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAuthorityRefs(item, output);
  }
  return output;
}

function qualifiedKnowledgeWorld(validated) {
  return {
    knowledgeRef: validated.knowledge.ref,
    knowledgeKind: 'QualifiedKnowledge',
    semanticPayload: cloneCanonicalValue(validated.knowledge.semanticPayload),
    claimRef: validated.claim.ref,
    claimSemanticPayload: cloneCanonicalValue(validated.claim.semanticPayload),
    sourceContextRef: validated.sourceContext.ref,
    sourceContextSemanticPayload: cloneCanonicalValue(validated.sourceContext.semanticPayload),
    sourceRef: validated.source.ref,
    sourceSemanticPayload: cloneCanonicalValue(validated.source.semanticPayload),
    sourceFaithfulReviewRef: validated.review.ref,
    sourceFaithfulReviewSemanticPayload: cloneCanonicalValue(validated.review.semanticPayload),
    scientificQualificationDecisionRefs: validated.decisions.map((decision) => decision.ref),
    scientificQualificationDecisionWorlds: validated.decisions.map((decision) => ({
      ref: decision.ref,
      semanticPayload: cloneCanonicalValue(decision.semanticPayload)
    }))
  };
}

function derivedKnowledgeWorld(validated) {
  return {
    knowledgeRef: validated.knowledge.ref,
    knowledgeKind: 'DerivedKnowledge',
    semanticPayload: cloneCanonicalValue(validated.knowledge.semanticPayload),
    derivedKnowledgeContextRef: validated.context.ref,
    derivedKnowledgeContextSemanticPayload: cloneCanonicalValue(validated.context.semanticPayload),
    derivationMethodRef: validated.method.ref,
    derivationMethodSemanticPayload: cloneCanonicalValue(validated.method.semanticPayload),
    inputQualifiedKnowledgeRefs: validated.validatedInputs.map((input) => input.knowledge.ref),
    inputQualifiedKnowledgeWorlds: validated.validatedInputs.map(qualifiedKnowledgeWorld),
    originContextRefs: validated.context.semanticPayload.originContexts.map((item) => item.sourceContextRef)
  };
}

function validateKnowledgeWorld({ ledger, knowledgeRef }) {
  const record = ledger.resolve(knowledgeRef);
  if (record.ref.kind === 'QualifiedKnowledge') {
    return qualifiedKnowledgeWorld(validateQualifiedKnowledgeAuthority({
      ledger,
      qualifiedKnowledgeRef: record.ref,
      allowHistorical: true
    }));
  }
  if (record.ref.kind === 'DerivedKnowledge') {
    return derivedKnowledgeWorld(validateDerivedKnowledgeAuthority({
      ledger,
      derivedKnowledgeRef: record.ref,
      allowHistorical: true
    }));
  }
  throw new Error(`ADR-2 exit gate expected QualifiedKnowledge or DerivedKnowledge, received ${record.ref.kind}`);
}

function contextEvidenceWorld({ ledger, snapshotStore, contextManifestRef }) {
  const validated = validateContextManifestAuthority({
    ledger,
    contextManifestRef,
    snapshotStore
  });
  return {
    contextManifestRef: validated.record.ref,
    semanticPayload: cloneCanonicalValue(validated.semanticPayload),
    createdAt: validated.createdAt,
    datumWorlds: validated.datums.map((datum) => ({
      contextDatumRef: datum.record.ref,
      semanticPayload: cloneCanonicalValue(datum.semanticPayload)
    })),
    receiptWorlds: validated.receipts.map((resolved) => ({
      resolvedReferenceReceiptRef: resolved.receipt.ref,
      receiptSemanticPayload: cloneCanonicalValue(resolved.receipt.semanticPayload),
      authorizedContextReferenceRef: resolved.reference.record.ref,
      authorizedContextReferenceSemanticPayload: cloneCanonicalValue(resolved.reference.semanticPayload),
      resolvedContextDatumRef: resolved.contextDatum.record.ref,
      resolvedContextDatumSemanticPayload: cloneCanonicalValue(resolved.contextDatum.semanticPayload)
    }))
  };
}

function executionArtifactWorlds({ ledger, runtimeBindingWorlds }) {
  const conformanceRefs = uniqueRefs(runtimeBindingWorlds.flatMap((world) =>
    world.semanticPayload.implementationBindings.map((binding) => binding.implementationConformanceRef)));
  return conformanceRefs.map((implementationConformanceRef) => {
    const validated = validateImplementationConformanceHistorical({
      ledger,
      conformanceRef: implementationConformanceRef
    });
    return {
      implementationConformanceRef: validated.record.ref,
      implementationConformanceSemanticPayload: cloneCanonicalValue(validated.semanticPayload),
      specificationRef: validated.specification.record.ref,
      specificationSemanticPayload: cloneCanonicalValue(validated.specification.semanticPayload),
      implementationRef: validated.implementation.record.ref,
      implementationSemanticPayload: cloneCanonicalValue(validated.implementation.semanticPayload),
      replayMode: validated.replayMode
    };
  });
}

export function reconstructHistoricalDecisionBasisExitGate(input = {}) {
  const basis = reconstructHistoricalDecisionBasisWithPublicationAudit(input);
  const decisionResult = validateDecisionResult({
    ledger: input.ledger,
    decisionResultRef: input.decisionResultRef
  });

  const applicabilityRefs = uniqueRefs(
    basis.authorityGraph.applicabilityWorlds.map((world) => world.applicabilityAssessmentRef)
  );
  const validatedApplicability = applicabilityRefs.map((applicabilityAssessmentRef) =>
    validateApplicabilityAssessment({
      ledger: input.ledger,
      applicabilityAssessmentRef,
      snapshotStore: input.snapshotStore,
      allowHistorical: true
    }));

  const retrievalRefs = uniqueRefs(
    validatedApplicability.map((validated) => validated.retrievalAuthority.record.ref)
  );
  const retrievalWorlds = retrievalRefs.map((knowledgeRetrievalResultRef) => {
    const validated = validateKnowledgeRetrievalResult({
      ledger: input.ledger,
      knowledgeRetrievalResultRef,
      allowHistorical: true
    });
    return {
      knowledgeRetrievalResultRef: validated.record.ref,
      semanticPayload: cloneCanonicalValue(validated.semanticPayload),
      decisionProblemRef: validated.decisionAuthority.record.ref,
      deploymentRef: validated.deploymentAuthority.record.ref,
      deploymentSemanticPayload: cloneCanonicalValue(validated.deploymentAuthority.semanticPayload),
      runtimeAuthorizationDecisionAuditRef: validated.runtimeAuthorization.ref,
      runtimeAuthorizationDecisionSemanticPayload: cloneCanonicalValue(validated.runtimeAuthorization.semanticPayload)
    };
  });

  const releaseRefs = uniqueRefs(retrievalWorlds.map((world) => world.semanticPayload.knowledgeReleaseRef));
  const knowledgeReleaseWorlds = releaseRefs.map((knowledgeReleaseRef) => {
    const validated = validateKnowledgeReleaseAuthority({
      ledger: input.ledger,
      knowledgeReleaseRef,
      allowHistorical: true
    });
    return {
      knowledgeReleaseRef: validated.release.ref,
      semanticPayload: cloneCanonicalValue(validated.release.semanticPayload),
      publicationDecisionRef: validated.publicationDecision.ref,
      publicationDecisionSemanticPayload: cloneCanonicalValue(validated.publicationDecision.semanticPayload),
      memberRefs: validated.members.map((member) => member.record.ref),
      lifecycle: cloneCanonicalValue(validated.lifecycle)
    };
  });

  const knowledgeRefs = uniqueRefs([
    ...knowledgeReleaseWorlds.flatMap((release) => release.memberRefs),
    ...basis.runtimeAlternativeProvenance.pathWorlds.map((path) => path.knowledgeRef),
    ...basis.runtimeWorlds.flatMap((world) => world.applicabilityWorlds.map((item) => item.knowledgeRef))
  ]);
  const knowledgeWorlds = knowledgeRefs.map((knowledgeRef) => validateKnowledgeWorld({
    ledger: input.ledger,
    knowledgeRef
  }));

  const runtimeBindingWorlds = basis.runtimeBindingRefs.map((runtimeBindingRef) => {
    const validated = validateRuntimeBinding({ ledger: input.ledger, runtimeBindingRef });
    return {
      runtimeBindingRef: validated.record.ref,
      semanticPayload: cloneCanonicalValue(validated.semanticPayload),
      replayMode: validated.replayMode,
      runtimeAuthorizationDecisionAuditRef: validated.runtimeAuthorizationDecisionAuditRef
    };
  });
  const exactExecutionArtifactWorlds = executionArtifactWorlds({
    ledger: input.ledger,
    runtimeBindingWorlds
  });

  const contextManifestRefs = uniqueRefs(
    basis.authorityGraph.contextWorlds.map((world) => world.contextManifestRef)
  );
  const contextEvidenceWorlds = contextManifestRefs.map((contextManifestRef) => contextEvidenceWorld({
    ledger: input.ledger,
    snapshotStore: input.snapshotStore,
    contextManifestRef
  }));

  const policyWorld = decisionResult.policy
    ? {
        policyRef: decisionResult.policy.record.ref,
        semanticPayload: cloneCanonicalValue(decisionResult.policy.semanticPayload)
      }
    : null;
  const runtimeProfileWorld = {
    runtimeProfileRef: decisionResult.decisionRobustness.runtimeProfile.record.ref,
    semanticPayload: cloneCanonicalValue(decisionResult.decisionRobustness.runtimeProfile.semanticPayload)
  };

  const exitGateClosure = {
    projectionClass: HISTORICAL_DECISION_BASIS_EXIT_GATE_CLASS,
    decisionProblemWorld: {
      decisionProblemRef: decisionResult.decisionProblem.record.ref,
      semanticPayload: cloneCanonicalValue(decisionResult.decisionProblem.semanticPayload),
      creationAuthorizationDecisionAuditRef: decisionResult.decisionProblem.creationAuthorization.ref,
      creationAuthorizationDecisionSemanticPayload: cloneCanonicalValue(
        decisionResult.decisionProblem.creationAuthorization.semanticPayload
      )
    },
    contextEvidenceWorlds,
    knowledgeReleaseWorlds,
    knowledgeRetrievalWorlds: retrievalWorlds,
    knowledgeWorlds,
    applicabilityAssessmentWorlds: validatedApplicability.map((validated) => ({
      applicabilityAssessmentRef: validated.record.ref,
      semanticPayload: cloneCanonicalValue(validated.semanticPayload)
    })),
    runtimeProfileWorld,
    runtimeBindingWorlds,
    executionArtifactWorlds: exactExecutionArtifactWorlds,
    decisionRobustnessWorld: {
      decisionRobustnessRef: decisionResult.decisionRobustness.record.ref,
      semanticPayload: cloneCanonicalValue(decisionResult.decisionRobustness.semanticPayload),
      replayMode: decisionResult.decisionRobustness.replayMode,
      decisionRobustnessPrincipal: cloneCanonicalValue(decisionResult.decisionRobustness.decisionRobustnessPrincipal)
    },
    policyWorld,
    reconstructionClassification:
      'EXACT_FROZEN_AUTHORITY_WORLD_WITH_CONTEXT_REPLAY_CLASS_PRESERVED_NO_LATEST_LOOKUP',
    authorityClaim: 'NONE_EXIT_GATE_PROJECTION_IS_INSPECTION_EVIDENCE_NOT_AUTHORITY'
  };
  const exitGateAuthorityRefs = uniqueRefs(collectAuthorityRefs(exitGateClosure));
  const authorityGraph = {
    ...cloneCanonicalValue(basis.authorityGraph),
    allAuthorityRefs: uniqueRefs([
      ...basis.authorityGraph.allAuthorityRefs,
      ...exitGateAuthorityRefs
    ])
  };

  return deepFreeze({
    ...cloneCanonicalValue(basis),
    authorityGraph: cloneCanonicalValue(authorityGraph),
    exitGateClosure: cloneCanonicalValue(exitGateClosure)
  });
}
