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
  AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError,
  agronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthorityRefs,
  agronomicContextSourceAcquisitionAvailabilityProjectionHash,
  normalizeAgronomicContextSourceAcquisitionAvailabilityProjection,
  normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation
} from './context-source-acquisition-availability-projection-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority
} from './recorded-operation-context-source-reference-hash-projection-authority.mjs';

export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
    'REJECT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION'
  ]);

export const AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_SOURCE_REFERENCE_HASH_AUTHORITY_VERIFIED',
    'VALUE_SOURCE_ARTIFACT_AUTHORITY_VERIFIED',
    'VALUE_SOURCE_ARTIFACT_REF_EXACT',
    'VALUE_SOURCE_ARTIFACT_CONTENT_HASH_EXACT',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_SOURCE_ARTIFACT_ACQUISITION_TIMESTAMP_VERIFIED',
    'AVAILABLE_AT_EQUALS_VALUE_SOURCE_ACQUIRED_AT',
    'AVAILABILITY_BASIS_VALUE_SOURCE_ARTIFACT_ACQUISITION',
    'NO_OCCURRENCE_DATE_AS_AVAILABILITY',
    'NO_EFFECTIVE_TIME_AS_AVAILABILITY',
    'NO_UPSTREAM_FIRST_PUBLICATION_TIME_CLAIM',
    'NO_GIT_COMMIT_TIME_INFERENCE',
    'NO_REVIEW_OR_PUBLICATION_TIME_SUBSTITUTION',
    'NO_CURRENT_WALL_CLOCK_SUBSTITUTION',
    'NO_SEMANTIC_ARTIFACT_TIME_SUBSTITUTION',
    'NO_MAX_DEPENDENCY_TIME_INFERENCE',
    'NO_GENERIC_SOURCE_ARTIFACT_AVAILABILITY_RULE',
    'NO_EFFECTIVE_INTERVAL_INFERENCE',
    'NO_TIMEZONE_OFFSET_DST_TZDB_INFERENCE',
    'NO_SOURCE_PROJECTION_MUTATION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_LEDGER_REQUIRED',
      'source-acquisition availability projection authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function sameSemanticValue(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs)
    && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEWER_REQUIRED',
      'reviewerPrincipal must be an object'
    );
  }
  return deepFreeze({
    principalId: text(value.principalId, 'reviewerPrincipal.principalId'),
    type: text(value.type, 'reviewerPrincipal.type'),
    organizationId: text(value.organizationId, 'reviewerPrincipal.organizationId'),
    ...(value.tenantId
      ? { tenantId: text(value.tenantId, 'reviewerPrincipal.tenantId') }
      : {})
  });
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
        'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_CHECKS_INVALID',
        `unsupported availability review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
          'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_INCOMPLETE',
          `accepted availability review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires exactly one AuthorizationDecisionAudit for the exact value source'
    );
  }
  const ref = values[0];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs[0] must reference AuthorizationDecisionAudit'
    );
  }
  return [ref];
}

function resolveAuthorizationCoverage({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSource
}) {
  const refs = normalizeAuthorizationRefs(authorizationDecisionAuditRefs);
  const record = ledger.resolve(refs[0]);
  const decision = record.semanticPayload ?? {};
  if (record.ref.kind !== 'AuthorizationDecisionAudit'
    || decision.allowed !== true
    || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }

  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
      || policy.semanticPayload?.resourceId !== sourceReviewResourceId(requiredSource.ref)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'authorization must cover the exact value-source resource'
    );
  }

  const assignments =
    (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
  const recomputed = authorizeKnowledgeInspection({
    principal: reviewerPrincipal,
    policy,
    roleAssignments: assignments,
    authorizationScope: decision.request?.authorizationScope
  });
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(
        assignment.semanticPayload?.principal,
        reviewerPrincipal
      )
      && (assignment.semanticPayload?.permissions ?? [])
        .includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? [])
        .includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!recomputed.allowed
      || recomputed.decisionHash !== decision.decisionHash
      || !hasGrant) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
      'authorization cannot be reproduced for exact value source'
    );
  }

  return deepFreeze([record]);
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match exact availability reviewer'
    );
  }
}

function validateProjectionWorld({ ledger, sourceRegistry, projection }) {
  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjection(projection);

  const parent =
    validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.parentSourceReferenceHashProjectionCompilationRef
    });

  const parentProjection = parent.semanticPayload.projection;
  if (!sameSemanticValue(
    normalized.targetContextSemantic,
    parentProjection.targetContextSemantic
  )) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_TARGET_MISMATCH',
      'targetContextSemantic must equal exact revalidated DEC-0020 semantic/value'
    );
  }
  if (!sameSemanticValue(normalized.valueSource, parentProjection.valueSource)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_VALUE_SOURCE_MISMATCH',
      'valueSource must equal exact revalidated DEC-0020 valueSource'
    );
  }

  const artifact = ledger.resolve(normalized.valueSource.sourceArtifactRef);
  if (artifact.ref.kind !== 'SourceArtifact') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_ARTIFACT_REQUIRED',
      'exact valueSource.sourceArtifactRef must resolve to SourceArtifact'
    );
  }
  if (!parent.parentOccurrence?.sourceArtifact
      || !sameAuthorityRef(parent.parentOccurrence.sourceArtifact.ref, artifact.ref)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_ARTIFACT_REF_MISMATCH',
      'value-source SourceArtifact must equal the exact artifact revalidated through DEC-0020'
    );
  }
  if (artifact.semanticPayload?.contentHash
      !== normalized.valueSource.sourceArtifactContentHash) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_ARTIFACT_HASH_MISMATCH',
      'SourceArtifact contentHash must equal exact DEC-0020 valueSource artifact hash'
    );
  }

  const acquisition = artifact.semanticPayload?.acquisition;
  if (!acquisition
      || acquisition.method !== normalized.sourceArtifactAcquisition.method
      || acquisition.acquiredAt !== normalized.sourceArtifactAcquisition.acquiredAt) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_ACQUISITION_MISMATCH',
      'projection acquisition must equal exact SourceArtifact acquisition metadata'
    );
  }
  if (normalized.availableAtProjection.availableAt !== acquisition.acquiredAt) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_VALUE_MISMATCH',
      'availableAt must equal exact value-source artifact acquiredAt'
    );
  }

  const requiredSource = ledger.resolve(normalized.valueSource.sourceRef);
  if (requiredSource.ref.kind !== 'Source') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_SOURCE_REQUIRED',
      'valueSource.sourceRef must resolve to Source'
    );
  }

  return deepFreeze({
    normalized,
    parent,
    artifact,
    requiredSource
  });
}

export function publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
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
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_DISPOSITION',
      'unsupported source-acquisition availability review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.requiredSource
  });
  assertAuditActor(audit, reviewer);

  const projectionHash =
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentSourceReferenceHashProjectionCompilationRef:
      world.normalized.parentSourceReferenceHashProjectionCompilationRef,
    targetContextSemantic:
      cloneCanonicalValue(world.normalized.targetContextSemantic),
    valueSource: cloneCanonicalValue(world.normalized.valueSource),
    sourceArtifactAcquisition:
      cloneCanonicalValue(world.normalized.sourceArtifactAcquisition),
    availableAtProjection:
      cloneCanonicalValue(world.normalized.availableAtProjection),
    requiredSourceRef: world.requiredSource.ref
  });

  return ledger.publish({
    kind: 'AgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORITY',
      projection: cloneCanonicalValue(world.normalized),
      projectionHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs:
        authorizations.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      inputRefs: [
        world.normalized.parentSourceReferenceHashProjectionCompilationRef,
        world.normalized.valueSource.sourceRef,
        world.normalized.valueSource.sourceArtifactRef,
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        projectionHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        sourceArtifactAcquisition:
          cloneCanonicalValue(world.normalized.sourceArtifactAcquisition),
        availableAtProjection:
          cloneCanonicalValue(world.normalized.availableAtProjection)
      }
    }
  });
}

function validateReview({
  ledger,
  sourceRegistry,
  reviewRef,
  normalizedCompilation
}) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind
      !== 'AgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_REQUIRED',
      'publication requires source-acquisition availability review decision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORITY') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_INVALID',
      'availability review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_REJECTED',
      'only accepted availability review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const projection = normalizedCompilation.projection;
  const projectionHash =
    agronomicContextSourceAcquisitionAvailabilityProjectionHash(projection);
  if (payload.projectionHash !== projectionHash
      || !sameSemanticValue(payload.projection, projection)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_MISMATCH',
      'review must bind exact normalized source-acquisition availability projection'
    );
  }

  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const expectedBindings = {
    parentSourceReferenceHashProjectionCompilationRef:
      projection.parentSourceReferenceHashProjectionCompilationRef,
    targetContextSemantic: cloneCanonicalValue(projection.targetContextSemantic),
    valueSource: cloneCanonicalValue(projection.valueSource),
    sourceArtifactAcquisition:
      cloneCanonicalValue(projection.sourceArtifactAcquisition),
    availableAtProjection:
      cloneCanonicalValue(projection.availableAtProjection),
    requiredSourceRef: world.requiredSource.ref
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match exact revalidated DEC-0020 artifact world'
    );
  }

  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.requiredSource
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action
        === 'REVIEW_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION'
      && event.actor?.id === reviewer.principalId
      && event.actor?.type === reviewer.type
      && exactRefIn(
        event.inputRefs,
        projection.parentSourceReferenceHashProjectionCompilationRef
      )
      && exactRefIn(event.inputRefs, projection.valueSource.sourceRef)
      && exactRefIn(event.inputRefs, projection.valueSource.sourceArtifactRef)
      && authorizations.every((record) => exactRefIn(event.inputRefs, record.ref))
      && event.details?.projectionHash === projectionHash
      && event.details?.disposition === payload.disposition
      && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
      && sameSemanticValue(
        event.details?.sourceArtifactAcquisition,
        projection.sourceArtifactAcquisition
      )
      && sameSemanticValue(
        event.details?.availableAtProjection,
        projection.availableAtProjection
      )
    );

  if (!directAudit) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUDIT_INVALID',
      'availability review lacks direct audit over exact projection'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 availability projection requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.availabilityProjectionReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_AUTHORITY',
        projectionHash: normalized.projectionHash,
        availabilityProjectionReviewRef: review.review.ref,
        parentSourceReferenceHashProjectionCompilationRef:
          normalized.projection.parentSourceReferenceHashProjectionCompilationRef,
        sourceArtifactAcquisition:
          cloneCanonicalValue(normalized.projection.sourceArtifactAcquisition),
        availableAtProjection:
          cloneCanonicalValue(normalized.projection.availableAtProjection)
      }
    }
  });
}

export function validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_REQUIRED',
      `expected AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 availability projection must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.availabilityProjectionReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION'
      && event.actor?.id === review.reviewer.principalId
      && event.actor?.type === review.reviewer.type
      && refs.every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.projectionHash === normalized.projectionHash
      && event.details?.availabilityProjectionReviewRef
      && sameAuthorityRef(
        event.details.availabilityProjectionReviewRef,
        review.review.ref
      )
      && event.details?.parentSourceReferenceHashProjectionCompilationRef
      && sameAuthorityRef(
        event.details.parentSourceReferenceHashProjectionCompilationRef,
        normalized.projection.parentSourceReferenceHashProjectionCompilationRef
      )
      && sameSemanticValue(
        event.details?.sourceArtifactAcquisition,
        normalized.projection.sourceArtifactAcquisition
      )
      && sameSemanticValue(
        event.details?.availableAtProjection,
        normalized.projection.availableAtProjection
      )
    );

  if (!directAudit) {
    throw new AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError(
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUDIT_INVALID',
      'availability projection compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    availabilityProjectionReview: review.review,
    sourceReferenceHashProjection: review.world.parent,
    sourceArtifact: review.world.artifact,
    parentOccurrence: review.world.parent.parentOccurrence
  });
}
