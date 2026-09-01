import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError,
  agronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthorityRefs,
  agronomicRecordedOperationContextSourceReferenceHashProjectionHash,
  normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection,
  normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation
} from './recorded-operation-context-source-reference-hash-projection-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthority
} from './recorded-operation-context-source-provider-identity-binding-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
    'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORITY_VERIFIED',
    'EXACT_PROVIDER_ID_PRESERVED',
    'EXACT_VALUE_SOURCE_VERIFIED',
    'EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED',
    'EXACT_VALUE_SOURCE_ARTIFACT_HASH_VERIFIED',
    'EXACT_OCCURRENCE_SOURCE_LOCATOR_VERIFIED',
    'EXACT_OCCURRENCE_EVIDENCE_HASH_VERIFIED',
    'FACT_LEVEL_SOURCE_REFERENCE_GRANULARITY_VERIFIED',
    'EXACT_GIT_BLOB_IDENTITY_VERIFIED',
    'EXACT_SOURCE_PATH_VERIFIED',
    'EXACT_JUPYTER_CELL_INDEX_VERIFIED',
    'EXACT_JUPYTER_OUTPUT_INDEX_VERIFIED',
    'EXACT_JUPYTER_MIME_TYPE_VERIFIED',
    'EXACT_JUPYTER_HEADER_LINE_INDEX_VERIFIED',
    'EXACT_JUPYTER_ROW_INDEX_VERIFIED',
    'PUBLIC_SOURCE_REF_EXACTLY_VERIFIED',
    'PUBLIC_CONTENT_HASH_EQUALS_EVIDENCE_HASH',
    'SOURCE_ARTIFACT_HASH_NOT_SUBSTITUTED_AS_PUBLIC_CONTENT_HASH',
    'OCCURRENCE_HASH_NOT_SUBSTITUTED_AS_PUBLIC_CONTENT_HASH',
    'ADR_AUTHORITY_REF_NOT_PUBLISHED_AS_SOURCE_REF',
    'NO_GENERIC_LOCATOR_FORMATTER',
    'NO_GENERIC_EVIDENCE_HASH_PROJECTION_RULE',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_CONTEXT_VALUE_VERIFIED',
    'EPISTEMIC_CLASS_ASSERTION_PRESERVED',
    'PROVENANCE_CLASS_EXTERNAL_PROVIDER_PRESERVED',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_INFERENCE',
    'NO_TARGET_OR_SPATIAL_PROJECTION',
    'NO_UNIT_UNCERTAINTY_OR_TEMPORAL_SUPPORT_INFERENCE',
    'NO_DECISION_PROBLEM_OR_POLICY_INFERENCE',
    'NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_LEDGER_REQUIRED',
      'source-reference/hash projection authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function sameSemanticValue(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEWER_REQUIRED',
      'reviewerPrincipal must be an object'
    );
  }
  return deepFreeze({
    principalId: text(value.principalId, 'reviewerPrincipal.principalId'),
    type: text(value.type, 'reviewerPrincipal.type'),
    organizationId: text(value.organizationId, 'reviewerPrincipal.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'reviewerPrincipal.tenantId') } : {})
  });
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) => text(value, `confirmedChecks[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_CHECKS_INVALID',
        `unsupported source-reference/hash review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_INCOMPLETE',
          `accepted source-reference/hash review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires exactly one AuthorizationDecisionAudit for the exact value Source'
    );
  }
  const ref = values[0];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs[0] must reference AuthorizationDecisionAudit'
    );
  }
  return ref;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact source-reference reviewer'
    );
  }
}

function resolveAuthorization({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSource
}) {
  const ref = normalizeAuthorizationRefs(authorizationDecisionAuditRefs);
  const record = ledger.resolve(ref);
  const decision = record.semanticPayload ?? {};
  if (record.ref.kind !== 'AuthorizationDecisionAudit'
    || decision.allowed !== true
    || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }

  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(requiredSource.ref)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'review authorization must target the exact value Source'
    );
  }

  const assignments = (decision.assignmentRefs ?? []).map((assignmentRef) =>
    ledger.resolve(assignmentRef)
  );
  const recomputed = authorizeKnowledgeInspection({
    principal: reviewerPrincipal,
    policy,
    roleAssignments: assignments,
    authorizationScope: decision.request?.authorizationScope
  });
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!recomputed.allowed || recomputed.decisionHash !== decision.decisionHash || !hasGrant) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'review authorization cannot be reproduced for the exact value Source'
    );
  }
  return record;
}

function validateProjectionWorld({ ledger, sourceRegistry, projection }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjection(projection);

  const provider =
    validateAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.sourceProviderIdentityBindingCompilationRef
    });

  if (normalized.providerId !== provider.semanticPayload.binding.providerId) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_PROVIDER_MISMATCH',
      'projection providerId must preserve exact DEC-0019 providerId'
    );
  }

  if (!sameSemanticValue(normalized.valueSource, provider.semanticPayload.binding.valueSource)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_VALUE_SOURCE_MISMATCH',
      'projection valueSource must equal exact DEC-0019 value source'
    );
  }

  const provenance = provider.contextProvenanceClassification;
  const parentOccurrence = provenance.parentOccurrence;
  const occurrence = parentOccurrence.semanticPayload.occurrence;
  if (!sameSemanticValue(normalized.sourceLocator, occurrence.sourceLocator)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_LOCATOR_MISMATCH',
      'projection sourceLocator must equal exact DEC-0013 occurrence sourceLocator'
    );
  }
  if (normalized.projectedSource.contentHash !== occurrence.sourceLocator.evidenceHash) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_EVIDENCE_HASH_MISMATCH',
      'public contentHash must equal exact DEC-0013 occurrence evidenceHash'
    );
  }

  const provenanceClassification = provenance.semanticPayload.classification;
  if (!sameSemanticValue(
    normalized.targetContextSemantic,
    provenanceClassification.targetContextSemantic
  )) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_TARGET_MISMATCH',
      'targetContextSemantic must preserve exact predecessor semantic/value'
    );
  }
  if (normalized.epistemicClass !== provenanceClassification.epistemicClass) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_EPISTEMIC_MISMATCH',
      'epistemicClass must preserve exact predecessor epistemic class'
    );
  }
  if (normalized.provenanceClass !== provenanceClassification.provenanceClass) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_PROVENANCE_MISMATCH',
      'provenanceClass must preserve exact predecessor provenance class'
    );
  }

  return deepFreeze({
    normalized,
    provider,
    provenance,
    parentOccurrence,
    valueSource: parentOccurrence.source
  });
}

export function publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  projection,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_DISPOSITION',
      'unsupported source-reference/hash review disposition'
    );
  }
  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const authorization = resolveAuthorization({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.valueSource
  });
  assertAuditActor(audit, reviewer);

  const projectionHash =
    agronomicRecordedOperationContextSourceReferenceHashProjectionHash(world.normalized);
  const predecessorBindings = deepFreeze({
    sourceProviderIdentityBindingCompilationRef:
      world.normalized.sourceProviderIdentityBindingCompilationRef,
    providerId: world.normalized.providerId,
    valueSource: cloneCanonicalValue(world.normalized.valueSource),
    sourceLocator: cloneCanonicalValue(world.normalized.sourceLocator)
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORITY',
      projection: cloneCanonicalValue(world.normalized),
      projectionHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [authorization.ref],
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action:
        'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      inputRefs: [
        world.normalized.sourceProviderIdentityBindingCompilationRef,
        world.normalized.valueSource.sourceRef,
        world.normalized.valueSource.sourceArtifactRef,
        authorization.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        projectionHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        projectedSource: cloneCanonicalValue(world.normalized.projectedSource)
      }
    }
  });
}

function validateReview({ ledger, sourceRegistry, reviewRef, normalizedCompilation }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind
      !== 'AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_INVALID',
      'source-reference/hash review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_REJECTED',
      'only accepted source-reference/hash review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const projection = normalizedCompilation.projection;
  const projectionHash =
    agronomicRecordedOperationContextSourceReferenceHashProjectionHash(projection);
  if (payload.projectionHash !== projectionHash
      || !sameSemanticValue(payload.projection, projection)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_MISMATCH',
      'review must bind the exact normalized source-reference/hash projection'
    );
  }

  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const expectedBindings = {
    sourceProviderIdentityBindingCompilationRef:
      projection.sourceProviderIdentityBindingCompilationRef,
    providerId: projection.providerId,
    valueSource: cloneCanonicalValue(projection.valueSource),
    sourceLocator: cloneCanonicalValue(projection.sourceLocator)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match exact replayed source world'
    );
  }

  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorization = resolveAuthorization({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.valueSource
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          projection.sourceProviderIdentityBindingCompilationRef
        )
        && exactRefIn(event.inputRefs, projection.valueSource.sourceRef)
        && exactRefIn(event.inputRefs, projection.valueSource.sourceArtifactRef)
        && exactRefIn(event.inputRefs, authorization.ref)
        && event.details?.projectionHash === projectionHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
        && sameSemanticValue(event.details?.projectedSource, projection.projectedSource)
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over exact source-reference/hash projection'
    );
  }
  return deepFreeze({ review, reviewer, authorization, world });
}

export function publishAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 source-reference/hash projection requires COMPLETE targeted coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.sourceReferenceReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_AUTHORITY',
        projectionHash: normalized.projectionHash,
        sourceReferenceReviewRef: review.review.ref,
        sourceProviderIdentityBindingCompilationRef:
          normalized.projection.sourceProviderIdentityBindingCompilationRef,
        projectedSource: cloneCanonicalValue(normalized.projection.projectedSource)
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation, received ${record.ref.kind}`
    );
  }
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 source-reference/hash projection must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.sourceReferenceReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthorityRefs(
      normalized
    );
  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.projectionHash === normalized.projectionHash
        && event.details?.sourceReferenceReviewRef
        && sameAuthorityRef(
          event.details.sourceReferenceReviewRef,
          review.review.ref
        )
        && event.details?.sourceProviderIdentityBindingCompilationRef
        && sameAuthorityRef(
          event.details.sourceProviderIdentityBindingCompilationRef,
          normalized.projection.sourceProviderIdentityBindingCompilationRef
        )
        && sameSemanticValue(
          event.details?.projectedSource,
          normalized.projection.projectedSource
        )
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_AUDIT_INVALID',
      'source-reference/hash projection compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    sourceReferenceReview: review.review,
    sourceProviderIdentityBinding: review.world.provider,
    parentOccurrence: review.world.parentOccurrence
  });
}
