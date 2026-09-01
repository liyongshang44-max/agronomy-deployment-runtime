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
  AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError,
  agronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthorityRefs,
  agronomicRecordedOperationContextTemporalSupportClassificationHash,
  normalizeAgronomicRecordedOperationContextTemporalSupportClassification,
  normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation
} from './recorded-operation-context-temporal-support-classification-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority
} from './recorded-operation-context-source-reference-hash-projection-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
    'REJECT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'SOURCE_REFERENCE_HASH_PROJECTION_AUTHORITY_VERIFIED',
    'EXACT_PARENT_OCCURRENCE_VERIFIED',
    'EXACT_SOURCE_TEMPORAL_KIND_CALENDAR_DATE',
    'EXACT_SOURCE_DATE_2011_05_03',
    'EXACT_SOURCE_PRECISION_DAY',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_CONTEXT_VALUE_VERIFIED',
    'TARGET_TEMPORAL_SUPPORT_INTERVAL_VERIFIED',
    'NO_INSTANT_PRECISION_INFERENCE',
    'NO_TIMEZONE_OFFSET_DST_INFERENCE',
    'NO_EFFECTIVE_INTERVAL_CONSTRUCTION',
    'NO_AVAILABLE_AT_CONSTRUCTION',
    'NO_VALUE_TYPE_MUTATION',
    'NO_UNIT_OR_UNCERTAINTY_INFERENCE',
    'NO_TARGET_SPATIAL_VERTICAL_PROJECTION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_DECISION_PROBLEM_POLICY_RUNTIME_EXECUTION_OUTCOME',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_LEDGER_REQUIRED',
      'temporal-support classification authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function sameSemanticValue(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) => text(value, `confirmedChecks[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_INVALID',
        `unsupported temporal-support review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_INCOMPLETE',
          `accepted temporal-support review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires exactly one AuthorizationDecisionAudit for the exact value Source'
    );
  }
  const ref = values[0];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs[0] must reference AuthorizationDecisionAudit'
    );
  }
  return ref;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact temporal-support reviewer'
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
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
      'review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(requiredSource.ref)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
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
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
      'review authorization cannot be reproduced from exact role/policy authority'
    );
  }
  return record;
}

function validateClassificationWorld({ ledger, sourceRegistry, classification }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassification(classification);
  const predecessor =
    validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.sourceReferenceHashProjectionCompilationRef
    });

  const occurrence = predecessor.parentOccurrence.semanticPayload.occurrence;
  if (!sameSemanticValue(
    normalized.sourceTemporalSupport,
    occurrence.occurrenceSemantics.temporalSupport
  )) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_SOURCE_MISMATCH',
      'classification sourceTemporalSupport must equal exact DEC-0013 parent temporal support'
    );
  }
  if (!sameSemanticValue(
    normalized.targetContextSemantic,
    predecessor.semanticPayload.projection.targetContextSemantic
  )) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TARGET_MISMATCH',
      'classification targetContextSemantic must preserve exact DEC-0020 predecessor semantic/value'
    );
  }

  return deepFreeze({
    normalized,
    predecessor,
    parentOccurrence: predecessor.parentOccurrence,
    valueSource: predecessor.parentOccurrence.source
  });
}

export function publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  classification,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITION',
      'unsupported temporal-support review disposition'
    );
  }
  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateClassificationWorld({ ledger, sourceRegistry, classification });
  const authorization = resolveAuthorization({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.valueSource
  });
  assertAuditActor(audit, reviewer);

  const classificationHash =
    agronomicRecordedOperationContextTemporalSupportClassificationHash(world.normalized);
  const predecessorBindings = deepFreeze({
    sourceReferenceHashProjectionCompilationRef:
      world.normalized.sourceReferenceHashProjectionCompilationRef,
    sourceTemporalSupport: cloneCanonicalValue(world.normalized.sourceTemporalSupport),
    targetContextSemantic: cloneCanonicalValue(world.normalized.targetContextSemantic)
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORITY',
      classification: cloneCanonicalValue(world.normalized),
      classificationHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [authorization.ref],
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
      inputRefs: [
        world.normalized.sourceReferenceHashProjectionCompilationRef,
        world.valueSource.ref,
        authorization.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        classificationHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        temporalSupport: cloneCanonicalValue(world.normalized.temporalSupport)
      }
    }
  });
}

function validateReview({ ledger, sourceRegistry, reviewRef, normalizedCompilation }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind
      !== 'AgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_REQUIRED',
      'publication requires temporal-support classification review decision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_INVALID',
      'temporal-support review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_REJECTED',
      'only accepted temporal-support review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const classification = normalizedCompilation.classification;
  const classificationHash =
    agronomicRecordedOperationContextTemporalSupportClassificationHash(classification);
  if (payload.classificationHash !== classificationHash
      || !sameSemanticValue(payload.classification, classification)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_MISMATCH',
      'review must bind exact normalized temporal-support classification'
    );
  }

  const world = validateClassificationWorld({ ledger, sourceRegistry, classification });
  const expectedBindings = {
    sourceReferenceHashProjectionCompilationRef:
      classification.sourceReferenceHashProjectionCompilationRef,
    sourceTemporalSupport: cloneCanonicalValue(classification.sourceTemporalSupport),
    targetContextSemantic: cloneCanonicalValue(classification.targetContextSemantic)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match exact replayed temporal-support world'
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
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          classification.sourceReferenceHashProjectionCompilationRef
        )
        && exactRefIn(event.inputRefs, world.valueSource.ref)
        && exactRefIn(event.inputRefs, authorization.ref)
        && event.details?.classificationHash === classificationHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
        && sameSemanticValue(event.details?.temporalSupport, classification.temporalSupport)
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over exact temporal-support classification'
    );
  }
  return deepFreeze({ review, reviewer, authorization, world });
}

export function publishAgronomicRecordedOperationContextTemporalSupportClassificationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 temporal-support classification requires COMPLETE targeted coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.temporalSupportReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
        classificationHash: normalized.classificationHash,
        temporalSupportReviewRef: review.review.ref,
        sourceReferenceHashProjectionCompilationRef:
          normalized.classification.sourceReferenceHashProjectionCompilationRef,
        sourceTemporalSupport:
          cloneCanonicalValue(normalized.classification.sourceTemporalSupport),
        temporalSupport: cloneCanonicalValue(normalized.classification.temporalSupport)
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextTemporalSupportClassificationCompilation') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextTemporalSupportClassificationCompilation, received ${record.ref.kind}`
    );
  }
  const normalized =
    normalizeAgronomicRecordedOperationContextTemporalSupportClassificationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 temporal-support classification must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.temporalSupportReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthorityRefs(
      normalized
    );
  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.classificationHash === normalized.classificationHash
        && event.details?.temporalSupportReviewRef
        && sameAuthorityRef(event.details.temporalSupportReviewRef, review.review.ref)
        && event.details?.sourceReferenceHashProjectionCompilationRef
        && sameAuthorityRef(
          event.details.sourceReferenceHashProjectionCompilationRef,
          normalized.classification.sourceReferenceHashProjectionCompilationRef
        )
        && sameSemanticValue(
          event.details?.sourceTemporalSupport,
          normalized.classification.sourceTemporalSupport
        )
        && sameSemanticValue(
          event.details?.temporalSupport,
          normalized.classification.temporalSupport
        )
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_AUDIT_INVALID',
      'temporal-support classification compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    temporalSupportReview: review.review,
    sourceReferenceHashProjection: review.world.predecessor,
    parentOccurrence: review.world.parentOccurrence
  });
}
