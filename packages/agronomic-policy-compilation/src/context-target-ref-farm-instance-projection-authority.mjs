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
  AgronomicContextTargetRefFarmInstanceProjectionCompilationError,
  agronomicContextTargetRefFarmInstanceProjectionCompilationAuthorityRefs,
  agronomicContextTargetRefFarmInstanceProjectionHash,
  normalizeAgronomicContextTargetRefFarmInstanceProjection,
  normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation
} from './context-target-ref-farm-instance-projection-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority
} from './recorded-operation-context-spatial-support-classification-authority.mjs';

export const AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION',
    'REJECT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION'
  ]);

export const AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_CONTEXT_SPATIAL_SUPPORT_AUTHORITY_VERIFIED',
    'UNDERLYING_TARGET_IDENTITY_AUTHORITY_VERIFIED',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_SOURCE_BACKED_TARGET_GRANULARITY_FARM',
    'EXACT_SOURCE_BACKED_TARGET_ID_VERIFIED',
    'TARGET_REF_FIELD_FARM_ID_VERIFIED',
    'PROJECTED_VALUE_EQUALS_EXACT_TARGET_ID',
    'NO_RAW_SERF_IDENTIFIER_SUBSTITUTION',
    'NO_DISPLAY_NAME_SUBSTITUTION',
    'NO_GLOBAL_CANONICAL_TARGET_CLAIM',
    'NO_ORGANIZATION_OR_TENANT_INFERENCE',
    'NO_FIELD_SEASON_OR_ZONE_INFERENCE',
    'NO_GEOMETRY_OR_GEOMETRY_REF_INFERENCE',
    'NO_TARGET_ID_AS_GEOMETRY_SUBSTITUTION',
    'NO_SPATIAL_SUPPORT_MUTATION',
    'NO_WITHIN_FARM_UNIFORMITY_INFERENCE',
    'NO_DECISION_PROBLEM_PUBLICATION',
    'NO_CONTEXT_MANIFEST_PUBLICATION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_INVERSE_OR_WRITE_BACK_AUTHORITY',
    'NO_TEMPORAL_OR_AVAILABLE_AT_INFERENCE',
    'NO_CROSS_PROVIDER_IDENTITY_EQUIVALENCE',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_LEDGER_REQUIRED',
      'target-ref FARM instance projection authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INPUT',
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

function uniqueRefs(refs) {
  const map = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze(
    [...map.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)))
  );
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEWER_REQUIRED',
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
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_CHECKS_INVALID',
        `unsupported target-ref FARM instance projection review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
          'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_INCOMPLETE',
          `accepted target-ref FARM instance projection review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires AuthorizationDecisionAudit refs for every exact predecessor source'
    );
  }
  const keys = new Set();
  return values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    const key = refKey(ref);
    if (keys.has(key)) {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
        'authorizationDecisionAuditRefs cannot contain duplicates'
      );
    }
    keys.add(key);
    return ref;
  });
}

function resolveAuthorizationCoverage({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSources
}) {
  const refs = normalizeAuthorizationRefs(authorizationDecisionAuditRefs);
  const records = refs.map((ref) => ledger.resolve(ref));

  for (const record of records) {
    const decision = record.semanticPayload ?? {};
    if (record.ref.kind !== 'AuthorizationDecisionAudit'
      || decision.allowed !== true
      || decision.operation !== 'KNOWLEDGE_INSPECT'
      || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
        'every review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
      );
    }
  }

  const selected = [];
  for (const source of requiredSources) {
    const resourceId = sourceReviewResourceId(source.ref);
    const matches = [];
    for (const record of records) {
      const decision = record.semanticPayload;
      const policy = ledger.resolve(decision.policyRef);
      if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
        || policy.semanticPayload?.resourceId !== resourceId) {
        continue;
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
      if (recomputed.allowed
        && recomputed.decisionHash === decision.decisionHash
        && hasGrant) {
        matches.push(record);
      }
    }
    if (matches.length !== 1) {
      throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per predecessor source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the DEC-0016 predecessor world'
    );
  }

  return deepFreeze(
    [...selected].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)))
  );
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact target-ref FARM instance projection reviewer'
    );
  }
}

function validateProjectionWorld({ ledger, sourceRegistry, projection }) {
  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjection(projection);

  const spatial =
    validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef:
        normalized.parentContextSpatialSupportClassificationCompilationRef
    });

  const classification = spatial.semanticPayload.classification;
  if (!sameSemanticValue(
    classification.targetContextSemantic,
    normalized.targetContextSemantic
  )) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET_MISMATCH',
      'targetContextSemantic must equal the exact revalidated DEC-0023 semantic/value'
    );
  }
  if (classification.spatialSupport?.type !== 'FARM') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_SPATIAL_SUPPORT_DRIFT',
      'DEC-0027 v1 requires exact DEC-0023 spatialSupport.type = FARM'
    );
  }

  const classificationTarget = classification.sourceBackedTargetIdentity;
  const targetBinding =
    spatial.targetIdentityBinding.semanticPayload.binding.sourceBackedTargetIdentity;
  if (
    classificationTarget?.granularity !== 'FARM'
    || targetBinding?.granularity !== 'FARM'
    || classificationTarget?.targetId !== normalized.sourceBackedTargetIdentity.targetId
    || targetBinding?.targetId !== normalized.sourceBackedTargetIdentity.targetId
    || !sameAuthorityRef(
      targetBinding?.namespaceRef,
      normalized.sourceBackedTargetIdentity.namespaceRef
    )
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_TARGET_IDENTITY_MISMATCH',
      'projection must preserve the exact DEC-0015 source namespace, FARM granularity and targetId revalidated through DEC-0023'
    );
  }

  if (
    normalized.targetRefProjection.field !== 'farmId'
    || normalized.targetRefProjection.value !== targetBinding.targetId
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_VALUE_MISMATCH',
      'targetRef.farmId must equal the exact revalidated DEC-0015 targetId'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    spatial.contextSemanticMapping.parentOccurrence.source.ref,
    ...spatial.contextSemanticMapping.semanticNormalization.replayedEvidence.map(
      (evidence) => evidence.source.ref
    ),
    ...spatial.targetIdentityBinding.replayedEvidence.map(
      (evidence) => evidence.source.ref
    )
  ]);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    spatial,
    classification,
    targetBinding,
    requiredSources
  });
}

export function publishAgronomicContextTargetRefFarmInstanceProjectionReviewDecision({
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
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_DISPOSITION',
      'unsupported target-ref FARM instance projection review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const projectionHash =
    agronomicContextTargetRefFarmInstanceProjectionHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentContextSpatialSupportClassificationCompilationRef:
      world.normalized.parentContextSpatialSupportClassificationCompilationRef,
    contextSemanticMappingCompilationRef:
      world.classification.contextSemanticMappingCompilationRef,
    targetIdentityBindingCompilationRef:
      world.classification.targetIdentityBindingCompilationRef,
    parentOccurrenceCompilationRef: world.spatial.parentOccurrence.record.ref,
    targetContextSemantic:
      cloneCanonicalValue(world.normalized.targetContextSemantic),
    sourceBackedTargetIdentity:
      cloneCanonicalValue(world.normalized.sourceBackedTargetIdentity),
    targetRefProjection:
      cloneCanonicalValue(world.normalized.targetRefProjection),
    requiredSourceRefs:
      world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind: 'AgronomicContextTargetRefFarmInstanceProjectionReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORITY',
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
      action: 'REVIEW_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION',
      inputRefs: [
        world.normalized.parentContextSpatialSupportClassificationCompilationRef,
        world.classification.contextSemanticMappingCompilationRef,
        world.classification.targetIdentityBindingCompilationRef,
        world.spatial.parentOccurrence.record.ref,
        ...world.requiredSources.map((source) => source.ref),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        projectionHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        sourceBackedTargetIdentity:
          cloneCanonicalValue(world.normalized.sourceBackedTargetIdentity),
        targetRefProjection:
          cloneCanonicalValue(world.normalized.targetRefProjection)
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
  if (review.ref.kind !== 'AgronomicContextTargetRefFarmInstanceProjectionReviewDecision') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_REQUIRED',
      'publication requires AgronomicContextTargetRefFarmInstanceProjectionReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (
    payload.authorityClass
      !== 'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUTHORITY'
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_INVALID',
      'target-ref FARM instance projection review has invalid authorityClass'
    );
  }
  if (payload.disposition !== 'ACCEPT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_REJECTED',
      'only accepted target-ref FARM instance projection review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const projection = normalizedCompilation.projection;
  const projectionHash =
    agronomicContextTargetRefFarmInstanceProjectionHash(projection);
  if (
    payload.projectionHash !== projectionHash
    || !sameSemanticValue(payload.projection, projection)
  ) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_MISMATCH',
      'review must bind the exact normalized target-ref FARM instance projection'
    );
  }

  const world = validateProjectionWorld({ ledger, sourceRegistry, projection });
  const expectedBindings = {
    parentContextSpatialSupportClassificationCompilationRef:
      projection.parentContextSpatialSupportClassificationCompilationRef,
    contextSemanticMappingCompilationRef:
      world.classification.contextSemanticMappingCompilationRef,
    targetIdentityBindingCompilationRef:
      world.classification.targetIdentityBindingCompilationRef,
    parentOccurrenceCompilationRef: world.spatial.parentOccurrence.record.ref,
    targetContextSemantic: cloneCanonicalValue(projection.targetContextSemantic),
    sourceBackedTargetIdentity:
      cloneCanonicalValue(projection.sourceBackedTargetIdentity),
    targetRefProjection: cloneCanonicalValue(projection.targetRefProjection),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match the exact revalidated DEC-0023/DEC-0015 world'
    );
  }

  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action === 'REVIEW_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION'
      && event.actor?.id === reviewer.principalId
      && event.actor?.type === reviewer.type
      && exactRefIn(
        event.inputRefs,
        projection.parentContextSpatialSupportClassificationCompilationRef
      )
      && exactRefIn(
        event.inputRefs,
        world.classification.targetIdentityBindingCompilationRef
      )
      && exactRefIn(event.inputRefs, world.spatial.parentOccurrence.record.ref)
      && world.requiredSources.every(
        (source) => exactRefIn(event.inputRefs, source.ref)
      )
      && authorizations.every(
        (record) => exactRefIn(event.inputRefs, record.ref)
      )
      && event.details?.projectionHash === projectionHash
      && event.details?.disposition === payload.disposition
      && sameSemanticValue(
        event.details?.predecessorBindings,
        expectedBindings
      )
      && sameSemanticValue(
        event.details?.sourceBackedTargetIdentity,
        projection.sourceBackedTargetIdentity
      )
      && sameSemanticValue(
        event.details?.targetRefProjection,
        projection.targetRefProjection
      )
    );

  if (!directAudit) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over the exact target-ref FARM instance projection'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicContextTargetRefFarmInstanceProjectionCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 target-ref FARM instance projection requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.targetRefProjectionReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicContextTargetRefFarmInstanceProjectionCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicContextTargetRefFarmInstanceProjectionCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_AUTHORITY',
        projectionHash: normalized.projectionHash,
        targetRefProjectionReviewRef: review.review.ref,
        parentContextSpatialSupportClassificationCompilationRef:
          normalized.projection.parentContextSpatialSupportClassificationCompilationRef,
        targetContextSemantic:
          cloneCanonicalValue(normalized.projection.targetContextSemantic),
        sourceBackedTargetIdentity:
          cloneCanonicalValue(normalized.projection.sourceBackedTargetIdentity),
        targetRefProjection:
          cloneCanonicalValue(normalized.projection.targetRefProjection)
      }
    }
  });
}

export function validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicContextTargetRefFarmInstanceProjectionCompilation') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_REQUIRED',
      `expected AgronomicContextTargetRefFarmInstanceProjectionCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicContextTargetRefFarmInstanceProjectionCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 target-ref FARM instance projection must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.targetRefProjectionReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicContextTargetRefFarmInstanceProjectionCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION'
      && event.actor?.id === review.reviewer.principalId
      && event.actor?.type === review.reviewer.type
      && refs.every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.projectionHash === normalized.projectionHash
      && event.details?.targetRefProjectionReviewRef
      && sameAuthorityRef(
        event.details.targetRefProjectionReviewRef,
        review.review.ref
      )
      && event.details?.parentContextSpatialSupportClassificationCompilationRef
      && sameAuthorityRef(
        event.details.parentContextSpatialSupportClassificationCompilationRef,
        normalized.projection.parentContextSpatialSupportClassificationCompilationRef
      )
      && sameSemanticValue(
        event.details?.targetContextSemantic,
        normalized.projection.targetContextSemantic
      )
      && sameSemanticValue(
        event.details?.sourceBackedTargetIdentity,
        normalized.projection.sourceBackedTargetIdentity
      )
      && sameSemanticValue(
        event.details?.targetRefProjection,
        normalized.projection.targetRefProjection
      )
    );

  if (!directAudit) {
    throw new AgronomicContextTargetRefFarmInstanceProjectionCompilationError(
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_AUDIT_INVALID',
      'target-ref FARM instance projection compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    targetRefProjectionReview: review.review,
    contextSpatialSupportClassification: review.world.spatial,
    targetIdentityBinding: review.world.spatial.targetIdentityBinding,
    parentOccurrence: review.world.spatial.parentOccurrence
  });
}
