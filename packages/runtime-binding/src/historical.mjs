import { semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateImplementationConformanceHistorical } from '../../implementation-conformance/src/index.mjs';
import { RuntimeBindingError } from './contract.mjs';

function resolveExact(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) {
    throw new RuntimeBindingError(code, `expected exact ${kind}, received ${record.ref.kind}`);
  }
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new RuntimeBindingError(code, `${kind} frozen payload does not reproduce its exact semantic hash`);
  }
  return record;
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function validateHistoricalExecutionBinding({ ledger, payload }) {
  if (payload.implementationBindings.length === 0) return null;
  const binding = payload.implementationBindings[0];
  const conformance = validateImplementationConformanceHistorical({
    ledger,
    conformanceRef: binding.implementationConformanceRef
  });
  if (!sameAuthorityRef(conformance.semanticPayload.specificationRef, binding.specificationRef)
    || !sameAuthorityRef(conformance.semanticPayload.implementationRef, binding.implementationRef)
    || !sameAuthorityRef(conformance.specification.record.ref, binding.specificationRef)
    || !sameAuthorityRef(conformance.implementation.record.ref, binding.implementationRef)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_CONFORMANCE_RELATION_MISMATCH',
      'frozen S03 execution binding must close exact Specification + Implementation + ImplementationConformance refs'
    );
  }
  const qualified = conformance.semanticPayload.qualifiedExecutionEnvironment;
  const execution = binding.executionContext;
  for (const key of ['runtime', 'runtimeVersion', 'platform', 'architecture']) {
    if (execution[key] !== qualified[key]) {
      throw new RuntimeBindingError(
        'RUNTIME_BINDING_HISTORICAL_EXECUTION_ENVIRONMENT_MISMATCH',
        `frozen executionContext.${key} is outside exact conformance qualification`
      );
    }
  }
  if (!qualified.runtimeEnvironments.includes(execution.runtimeEnvironment)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_HISTORICAL_RUNTIME_ENVIRONMENT_MISMATCH',
      'frozen runtimeEnvironment was not covered by exact ImplementationConformance'
    );
  }
  const capabilities = new Set(execution.capabilities);
  for (const required of qualified.requiredCapabilities) {
    if (!capabilities.has(required)) {
      throw new RuntimeBindingError(
        'RUNTIME_BINDING_HISTORICAL_CAPABILITY_MISMATCH',
        `frozen RuntimeBinding lacks required conformance capability ${required}`
      );
    }
  }
  return {
    specification: conformance.specification.record,
    implementation: conformance.implementation.record,
    conformance: conformance.record,
    executionContext: binding.executionContext
  };
}

export function validateFrozenBindingWorldRelations({ ledger, payload, eligibilityPayload }) {
  const decision = resolveExact(
    ledger,
    payload.decisionProblemRef,
    'DecisionProblem',
    'RUNTIME_BINDING_DECISION_PROBLEM_RELATION_INVALID'
  );
  const deployment = resolveExact(
    ledger,
    payload.deploymentRef,
    'Deployment',
    'RUNTIME_BINDING_DEPLOYMENT_RELATION_INVALID'
  );
  const profile = resolveExact(
    ledger,
    payload.runtimeProfileRef,
    'RuntimeProfile',
    'RUNTIME_BINDING_PROFILE_RELATION_INVALID'
  );
  const release = resolveExact(
    ledger,
    payload.knowledgeReleaseRef,
    'KnowledgeRelease',
    'RUNTIME_BINDING_RELEASE_RELATION_INVALID'
  );
  const manifest = resolveExact(
    ledger,
    payload.contextManifestRef,
    'ContextManifest',
    'RUNTIME_BINDING_MANIFEST_RELATION_INVALID'
  );
  const retrieval = resolveExact(
    ledger,
    eligibilityPayload.knowledgeRetrievalResultRef,
    'KnowledgeRetrievalResult',
    'RUNTIME_BINDING_RETRIEVAL_RELATION_INVALID'
  );
  const knowledgeBinding = payload.knowledgeBindings[0];
  const knowledge = ledger.resolve(knowledgeBinding.knowledgeRef);
  if (!['QualifiedKnowledge', 'DerivedKnowledge'].includes(knowledge.ref.kind)
    || semanticHash(knowledge.ref.kind, knowledge.semanticPayload) !== knowledge.ref.semanticHash) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_KNOWLEDGE_RELATION_INVALID',
      'selected Knowledge binding must resolve to exact QualifiedKnowledge or DerivedKnowledge authority'
    );
  }
  const applicability = resolveExact(
    ledger,
    knowledgeBinding.applicabilityAssessmentRef,
    'ApplicabilityAssessment',
    'RUNTIME_BINDING_APPLICABILITY_RELATION_INVALID'
  );

  if (!sameAuthorityRef(deployment.semanticPayload.runtimeProfileRef, profile.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_DEPLOYMENT_PROFILE_RELATION_MISMATCH',
      'frozen Deployment must reference the exact frozen RuntimeProfile'
    );
  }
  if (!sameAuthorityRef(profile.semanticPayload.knowledgeReleaseRef, release.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_PROFILE_RELEASE_RELATION_MISMATCH',
      'frozen RuntimeProfile must reference the exact frozen KnowledgeRelease'
    );
  }
  if (!sameAuthorityRef(manifest.semanticPayload.decisionProblemRef, decision.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_MANIFEST_DECISION_RELATION_MISMATCH',
      'frozen ContextManifest must reference the exact frozen DecisionProblem'
    );
  }
  if (!sameAuthorityRef(retrieval.semanticPayload.decisionProblemRef, decision.ref)
    || !sameAuthorityRef(retrieval.semanticPayload.deploymentRef, deployment.ref)
    || !sameAuthorityRef(retrieval.semanticPayload.runtimeProfileRef, profile.ref)
    || !sameAuthorityRef(retrieval.semanticPayload.knowledgeReleaseRef, release.ref)
    || !exactRefIn(retrieval.semanticPayload.candidateRefs, knowledge.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_RETRIEVAL_WORLD_RELATION_MISMATCH',
      'frozen KnowledgeRetrievalResult must close the exact Decision/Deployment/Profile/Release world and contain selected Knowledge'
    );
  }
  if (!sameAuthorityRef(applicability.semanticPayload.knowledgeRetrievalResultRef, retrieval.ref)
    || !sameAuthorityRef(applicability.semanticPayload.knowledgeRef, knowledge.ref)
    || !sameAuthorityRef(applicability.semanticPayload.contextManifestRef, manifest.ref)
    || !sameAuthorityRef(applicability.semanticPayload.decisionProblemRef, decision.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_APPLICABILITY_WORLD_RELATION_MISMATCH',
      'frozen ApplicabilityAssessment must close the exact Retrieval/Knowledge/Manifest/Decision world'
    );
  }

  if (!sameAuthorityRef(eligibilityPayload.decisionProblemRef, decision.ref)
    || !sameAuthorityRef(eligibilityPayload.deploymentRef, deployment.ref)
    || !sameAuthorityRef(eligibilityPayload.runtimeProfileRef, profile.ref)
    || !sameAuthorityRef(eligibilityPayload.contextManifestRef, manifest.ref)
    || !sameAuthorityRef(eligibilityPayload.knowledgeRetrievalResultRef, retrieval.ref)
    || !exactRefIn(eligibilityPayload.applicabilityAssessmentRefs, applicability.ref)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_ELIGIBILITY_WORLD_RELATION_MISMATCH',
      'frozen RuntimeEligibility must close the same exact historical binding world'
    );
  }

  const specificationExecution = validateHistoricalExecutionBinding({ ledger, payload });

  return {
    decision,
    deployment,
    profile,
    release,
    manifest,
    retrieval,
    knowledge,
    applicability,
    specificationExecution
  };
}
