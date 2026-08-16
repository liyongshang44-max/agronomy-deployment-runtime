import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { projectApplicabilityEscalation } from './escalation.mjs';
import { validateWorkbenchInspectionAuthorization, WorkbenchAccessError } from './access.mjs';

export const AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION = 'adr.agronomist-workbench-case.v1';

export class AgronomistWorkbenchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomistWorkbenchError';
    this.code = code;
  }
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new AgronomistWorkbenchError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function sameTargetAccess(principal, targetRef, deploymentScope) {
  return principal.organizationId === targetRef.organizationId
    && (principal.tenantId ?? null) === (targetRef.tenantId ?? null)
    && principal.organizationId === deploymentScope.organizationId
    && (principal.tenantId ?? null) === (deploymentScope.tenantId ?? null)
    && (principal.programIds ?? []).includes(deploymentScope.programId);
}

function accessRefFor(inspectionAuthorizations, knowledgeRef) {
  if (!Array.isArray(inspectionAuthorizations)) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_REQUIRED', 'inspectionAuthorizations must be an array');
  }
  const matches = inspectionAuthorizations.filter((candidate) =>
    candidate?.knowledgeRef && sameAuthorityRef(candidate.knowledgeRef, knowledgeRef));
  if (matches.length !== 1 || !matches[0]?.authorizationDecisionAuditRef) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_REQUIRED', `one exact workbench inspection authorization is required for ${refKey(knowledgeRef)}`);
  }
  const authRef = assertAuthorityRef(matches[0].authorizationDecisionAuditRef);
  if (authRef.kind !== 'AuthorizationDecisionAudit') {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_REQUIRED', 'inspection authorization must be an exact AuthorizationDecisionAudit ref');
  }
  return authRef;
}

function sourcePreview({ sourceRegistry, artifact, locator, maxPreviewBytes }) {
  const base = {
    locator: cloneCanonicalValue(locator),
    sourceArtifactRef: artifact.ref,
    contentHash: artifact.semanticPayload.contentHash,
    mediaType: artifact.semanticPayload.mediaType,
    retainedBytesVerified: false,
    previewAvailable: false
  };
  if (!sourceRegistry) return deepFreeze(base);
  if (typeof sourceRegistry.readArtifactBytes !== 'function') {
    throw new AgronomistWorkbenchError('INVALID_SOURCE_REGISTRY', 'sourceRegistry must provide readArtifactBytes');
  }
  const bytes = sourceRegistry.readArtifactBytes(artifact.ref);
  let selected = null;
  if (locator.kind === 'WHOLE_ARTIFACT') selected = bytes;
  else if (locator.kind === 'BYTE_RANGE') selected = bytes.subarray(locator.start, locator.endExclusive);
  const textMedia = artifact.semanticPayload.mediaType.startsWith('text/')
    || artifact.semanticPayload.mediaType === 'application/json';
  if (!selected || !textMedia) return deepFreeze({ ...base, retainedBytesVerified: true });
  const limit = Math.min(selected.byteLength, maxPreviewBytes);
  return deepFreeze({
    ...base,
    retainedBytesVerified: true,
    previewAvailable: true,
    previewText: selected.subarray(0, limit).toString('utf8'),
    previewByteLength: limit,
    exactSpanByteLength: selected.byteLength,
    previewTruncated: limit < selected.byteLength
  });
}

function projectQualifiedEvidence({
  ledger,
  qualifiedKnowledgeRef,
  usePurpose,
  allowHistorical,
  sourceRegistry,
  maxPreviewBytes
}) {
  const validated = validateQualifiedKnowledgeAuthority({
    ledger,
    qualifiedKnowledgeRef,
    requiredUseTarget: { use: usePurpose },
    allowHistorical
  });
  const claim = validated.claim;
  const artifact = resolveKind(ledger, claim.semanticPayload.sourceArtifactRef, 'SourceArtifact', 'WORKBENCH_SOURCE_ARTIFACT_REQUIRED');
  if (claim.semanticPayload.sourceArtifactContentHash !== artifact.semanticPayload.contentHash
    || validated.sourceContext.semanticPayload.sourceArtifactContentHash !== artifact.semanticPayload.contentHash) {
    throw new AgronomistWorkbenchError('WORKBENCH_SOURCE_ARTIFACT_MISMATCH', 'Claim/SourceContext content hash differs from exact SourceArtifact');
  }
  return deepFreeze({
    knowledgeKind: 'QualifiedKnowledge',
    knowledgeRef: validated.knowledge.ref,
    source: {
      sourceRef: validated.source.ref,
      sourceType: validated.source.semanticPayload.sourceType,
      title: validated.source.semanticPayload.title,
      ...(validated.source.semanticPayload.originLocator ? { originLocator: validated.source.semanticPayload.originLocator } : {}),
      sourceArtifactRef: artifact.ref,
      contentHash: artifact.semanticPayload.contentHash,
      mediaType: artifact.semanticPayload.mediaType,
      acquisition: cloneCanonicalValue(artifact.semanticPayload.acquisition)
    },
    sourceSpan: sourcePreview({ sourceRegistry, artifact, locator: claim.semanticPayload.sourceLocator, maxPreviewBytes }),
    claim: {
      claimRef: claim.ref,
      claimType: claim.semanticPayload.claimType,
      assertion: claim.semanticPayload.assertion,
      sourceLocator: cloneCanonicalValue(claim.semanticPayload.sourceLocator)
    },
    originContext: {
      originContextRef: validated.sourceContext.ref,
      contextFamilies: cloneCanonicalValue(validated.sourceContext.semanticPayload.contextFamilies)
    },
    sourceFaithfulReview: {
      reviewRef: validated.review.ref,
      disposition: validated.review.semanticPayload.disposition,
      reviewPrincipal: cloneCanonicalValue(validated.review.semanticPayload.reviewPrincipal),
      reasonCodes: cloneCanonicalValue(validated.review.semanticPayload.reasonCodes ?? [])
    },
    qualification: {
      decisionRefs: validated.decisions.map((decision) => decision.ref),
      decisions: validated.decisions.map((decision) => ({
        decisionRef: decision.ref,
        disposition: decision.semanticPayload.disposition,
        qualificationTarget: cloneCanonicalValue(decision.semanticPayload.qualificationTarget),
        limitations: cloneCanonicalValue(decision.semanticPayload.limitations ?? []),
        effectModifiers: cloneCanonicalValue(decision.semanticPayload.effectModifiers ?? []),
        semanticPreconditions: cloneCanonicalValue(decision.semanticPayload.semanticPreconditions ?? []),
        transportConstraints: cloneCanonicalValue(decision.semanticPayload.transportConstraints ?? []),
        reasonCodes: cloneCanonicalValue(decision.semanticPayload.reasonCodes ?? []),
        approverPrincipal: cloneCanonicalValue(decision.semanticPayload.approverPrincipal)
      }))
    }
  });
}

function validateEvidenceAccess({ ledger, principal, inspectionAuthorizations, knowledge, ownership, programId }) {
  return validateWorkbenchInspectionAuthorization({
    ledger,
    authorizationDecisionAuditRef: accessRefFor(inspectionAuthorizations, knowledge.ref),
    principal,
    knowledgeRef: knowledge.ref,
    knowledgeOwnership: ownership,
    requiredProgramId: programId
  });
}

function projectKnowledgeEvidence({
  ledger,
  knowledgeRef,
  principal,
  inspectionAuthorizations,
  usePurpose,
  programId,
  allowHistorical,
  sourceRegistry,
  maxPreviewBytes
}) {
  const record = ledger.resolve(assertAuthorityRef(knowledgeRef));
  if (record.ref.kind === 'QualifiedKnowledge') {
    validateEvidenceAccess({ ledger, principal, inspectionAuthorizations, knowledge: record, ownership: record.semanticPayload.ownership, programId });
    return projectQualifiedEvidence({ ledger, qualifiedKnowledgeRef: record.ref, usePurpose, allowHistorical, sourceRegistry, maxPreviewBytes });
  }
  if (record.ref.kind === 'DerivedKnowledge') {
    const derived = validateDerivedKnowledgeAuthority({
      ledger,
      derivedKnowledgeRef: record.ref,
      requiredUseTarget: { use: usePurpose },
      allowHistorical
    });
    validateEvidenceAccess({ ledger, principal, inspectionAuthorizations, knowledge: derived.knowledge, ownership: derived.knowledge.semanticPayload.ownership, programId });
    for (const input of derived.validatedInputs) {
      validateEvidenceAccess({ ledger, principal, inspectionAuthorizations, knowledge: input.knowledge, ownership: input.knowledge.semanticPayload.ownership, programId });
    }
    return deepFreeze({
      knowledgeKind: 'DerivedKnowledge',
      knowledgeRef: derived.knowledge.ref,
      semanticRole: derived.knowledge.semanticPayload.semanticRole,
      assertion: derived.knowledge.semanticPayload.assertion,
      derivationMethodRef: derived.method.ref,
      originContext: {
        originContextRef: derived.context.ref,
        originContexts: cloneCanonicalValue(derived.context.semanticPayload.originContexts),
        introducedRestrictions: cloneCanonicalValue(derived.context.semanticPayload.introducedRestrictions ?? []),
        unresolvedContextHeterogeneity: cloneCanonicalValue(derived.context.semanticPayload.unresolvedContextHeterogeneity ?? [])
      },
      inputQualifiedEvidence: derived.validatedInputs.map((input) => projectQualifiedEvidence({
        ledger,
        qualifiedKnowledgeRef: input.knowledge.ref,
        usePurpose,
        allowHistorical,
        sourceRegistry,
        maxPreviewBytes
      }))
    });
  }
  throw new AgronomistWorkbenchError('UNSUPPORTED_WORKBENCH_KNOWLEDGE_KIND', `unsupported knowledge kind ${record.ref.kind}`);
}

function requiredEvidenceKnowledgeRefs(evidence) {
  if (evidence.knowledgeKind === 'QualifiedKnowledge') return [evidence.knowledgeRef];
  if (evidence.knowledgeKind === 'DerivedKnowledge') {
    return [evidence.knowledgeRef, ...evidence.inputQualifiedEvidence.map((item) => item.knowledgeRef)];
  }
  throw new AgronomistWorkbenchError('UNSUPPORTED_WORKBENCH_KNOWLEDGE_KIND', `unsupported evidence kind ${evidence.knowledgeKind}`);
}

function bindInspectionAuthorizations(inspectionAuthorizations, evidence) {
  const requiredRefs = requiredEvidenceKnowledgeRefs(evidence);
  if (!Array.isArray(inspectionAuthorizations) || inspectionAuthorizations.length !== requiredRefs.length) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_SET_MISMATCH', 'A11 case must bind exactly one inspection authorization per displayed Knowledge authority');
  }
  const entries = requiredRefs.map((knowledgeRef) => ({
    knowledgeRef,
    authorizationDecisionAuditRef: accessRefFor(inspectionAuthorizations, knowledgeRef)
  }));
  entries.sort((a, b) => refKey(a.knowledgeRef).localeCompare(refKey(b.knowledgeRef)));
  return deepFreeze(entries);
}

function targetContextProjection(validatedApplicability, deploymentScope) {
  const manifest = validatedApplicability.contextManifestAuthority;
  const decision = validatedApplicability.retrievalAuthority.decisionAuthority;
  return deepFreeze({
    decisionProblemRef: decision.record.ref,
    decisionType: decision.semanticPayload.decisionType,
    targetRef: cloneCanonicalValue(decision.semanticPayload.targetRef),
    programId: deploymentScope.programId,
    logicalTime: decision.semanticPayload.logicalTime,
    decisionHorizon: cloneCanonicalValue(decision.semanticPayload.decisionHorizon),
    usePurpose: decision.semanticPayload.usePurpose,
    useClass: decision.semanticPayload.useClass,
    contextManifestRef: manifest.record.ref,
    evidenceCutoff: manifest.semanticPayload.evidenceCutoff,
    replayClass: manifest.semanticPayload.replayClass,
    datums: manifest.datums.map((validated) => ({
      contextDatumRef: validated.record.ref,
      semanticId: validated.semanticPayload.semanticId,
      value: cloneCanonicalValue(validated.semanticPayload.value),
      unit: validated.semanticPayload.unit,
      epistemicClass: validated.semanticPayload.epistemicClass,
      provenanceClass: validated.semanticPayload.provenanceClass,
      effectiveInterval: cloneCanonicalValue(validated.semanticPayload.effectiveInterval),
      availableAt: validated.semanticPayload.availableAt,
      spatialSupport: cloneCanonicalValue(validated.semanticPayload.spatialSupport),
      verticalSupport: cloneCanonicalValue(validated.semanticPayload.verticalSupport),
      temporalSupport: cloneCanonicalValue(validated.semanticPayload.temporalSupport)
    })),
    resolvedReferenceReceiptRefs: cloneCanonicalValue(manifest.semanticPayload.resolvedReferenceReceiptRefs)
  });
}

export function projectAgronomistWorkbenchCase({
  ledger,
  applicabilityAssessmentRef,
  workbenchPrincipal,
  inspectionAuthorizations,
  sourceRegistry,
  snapshotStore,
  allowHistorical = false,
  maxSourcePreviewBytes = 4096
}) {
  if (!Number.isInteger(maxSourcePreviewBytes) || maxSourcePreviewBytes <= 0 || maxSourcePreviewBytes > 65536) {
    throw new AgronomistWorkbenchError('INVALID_SOURCE_PREVIEW_LIMIT', 'maxSourcePreviewBytes must be an integer in 1..65536');
  }
  const principal = createPrincipal(workbenchPrincipal);
  const applicability = validateApplicabilityAssessment({ ledger, applicabilityAssessmentRef, snapshotStore, allowHistorical });
  const decision = applicability.retrievalAuthority.decisionAuthority;
  const deploymentScope = applicability.retrievalAuthority.deploymentAuthority.semanticPayload.deploymentScope;
  if (!sameTargetAccess(principal, decision.semanticPayload.targetRef, deploymentScope)) {
    throw new WorkbenchAccessError(
      'WORKBENCH_TARGET_CONTEXT_ACCESS_DENIED',
      'A11 v0.1 target context requires exact DecisionProblem organization/tenant and exact Deployment program membership'
    );
  }
  const escalation = projectApplicabilityEscalation({ ledger, applicabilityAssessmentRef: applicability.record.ref, snapshotStore, allowHistorical });
  const evidence = projectKnowledgeEvidence({
    ledger,
    knowledgeRef: applicability.semanticPayload.knowledgeRef,
    principal,
    inspectionAuthorizations,
    usePurpose: decision.semanticPayload.usePurpose,
    programId: deploymentScope.programId,
    allowHistorical,
    sourceRegistry,
    maxPreviewBytes: maxSourcePreviewBytes
  });
  const evidenceAccess = deepFreeze({ inspectionAuthorizations: bindInspectionAuthorizations(inspectionAuthorizations, evidence) });
  const targetContext = targetContextProjection(applicability, deploymentScope);
  const projection = {
    contractVersion: AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION,
    projectionKind: 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE',
    workbenchPrincipal: principal,
    evidenceAccess,
    classification: escalation.classification,
    reviewRequired: escalation.reviewRequired,
    reasonCodes: cloneCanonicalValue(escalation.reasonCodes),
    why: cloneCanonicalValue(escalation.why),
    targetContext,
    scientificEvidence: evidence,
    applicability: {
      applicabilityAssessmentRef: applicability.record.ref,
      transportStatus: applicability.semanticPayload.transportStatus,
      scientificUseStatus: applicability.semanticPayload.scientificUseStatus,
      decisionRelevance: applicability.semanticPayload.decisionRelevance,
      runtimeUse: applicability.semanticPayload.runtimeUse,
      conditionResults: cloneCanonicalValue(applicability.semanticPayload.conditionResults),
      limitations: cloneCanonicalValue(applicability.semanticPayload.limitations),
      conflicts: cloneCanonicalValue(applicability.semanticPayload.conflicts),
      missingContextSemanticIds: cloneCanonicalValue(applicability.semanticPayload.missingContextSemanticIds),
      requiredCalibrationCodes: cloneCanonicalValue(applicability.semanticPayload.requiredCalibrationCodes),
      requiredTransformationRefs: cloneCanonicalValue(applicability.semanticPayload.requiredTransformationRefs),
      unsupportedConstraintCodes: cloneCanonicalValue(applicability.semanticPayload.unsupportedConstraintCodes)
    }
  };
  return deepFreeze({ ...projection, caseProjectionHash: semanticHash('AgronomistWorkbenchCaseProjection', projection) });
}

export function validateAgronomistWorkbenchCase({
  ledger,
  workbenchCase,
  sourceRegistry,
  snapshotStore,
  allowHistorical = false
}) {
  if (!workbenchCase || typeof workbenchCase !== 'object' || Array.isArray(workbenchCase)
    || workbenchCase.contractVersion !== AGRONOMIST_WORKBENCH_CASE_CONTRACT_VERSION
    || workbenchCase.projectionKind !== 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE') {
    throw new AgronomistWorkbenchError('INVALID_WORKBENCH_CASE', 'exact A11 workbench case projection is required');
  }
  const { caseProjectionHash, ...basis } = workbenchCase;
  if (typeof caseProjectionHash !== 'string' || semanticHash('AgronomistWorkbenchCaseProjection', basis) !== caseProjectionHash) {
    throw new AgronomistWorkbenchError('WORKBENCH_CASE_HASH_MISMATCH', 'workbench case projection hash is not reproducible');
  }
  const reproduced = projectAgronomistWorkbenchCase({
    ledger,
    applicabilityAssessmentRef: workbenchCase.applicability?.applicabilityAssessmentRef,
    workbenchPrincipal: workbenchCase.workbenchPrincipal,
    inspectionAuthorizations: workbenchCase.evidenceAccess?.inspectionAuthorizations,
    sourceRegistry,
    snapshotStore,
    allowHistorical
  });
  if (reproduced.caseProjectionHash !== caseProjectionHash) {
    throw new AgronomistWorkbenchError('WORKBENCH_CASE_REPLAY_MISMATCH', 'validated authority/access world does not reproduce the supplied workbench case');
  }
  return reproduced;
}
