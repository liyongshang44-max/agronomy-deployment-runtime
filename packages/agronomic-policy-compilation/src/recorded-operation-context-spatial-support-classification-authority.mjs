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
  AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError,
  agronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthorityRefs,
  agronomicRecordedOperationContextSpatialSupportClassificationHash,
  normalizeAgronomicRecordedOperationContextSpatialSupportClassification,
  normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation
} from './recorded-operation-context-spatial-support-classification-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority
} from './recorded-operation-context-semantic-mapping-authority.mjs';
import {
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority
} from './recorded-operation-target-identity-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION',
    'REJECT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED',
    'TARGET_IDENTITY_BINDING_AUTHORITY_VERIFIED',
    'CO_PREDECESSOR_PARENT_OCCURRENCE_REF_EQUAL',
    'CO_PREDECESSOR_SOURCE_NATIVE_SUBJECT_EQUAL',
    'EXACT_CONTEXT_SEMANTIC_CROP_PLANTING_DATE',
    'EXACT_CONTEXT_VALUE_DATE_2011_05_03',
    'EXACT_SOURCE_NATIVE_SUBJECT_SERF',
    'EXACT_SOURCE_BACKED_TARGET_GRANULARITY_FARM',
    'EXACT_SOURCE_BACKED_TARGET_ID_VERIFIED',
    'SPATIAL_SUPPORT_TYPE_FARM_VERIFIED',
    'NO_GEOMETRY_REF',
    'NO_GEOMETRY_INFERENCE',
    'NO_FIELD_PLOT_ZONE_INFERENCE',
    'NO_UNIFORM_WITHIN_FARM_COVERAGE_INFERENCE',
    'NO_TARGET_ID_AS_GEOMETRY_SUBSTITUTION',
    'NO_GENERIC_FARM_SPATIAL_SUPPORT_RULE',
    'SUPPORT_TYPE_NOT_TARGET_INSTANCE_IDENTITY',
    'EXACT_TARGET_IDENTITY_LINEAGE_PRESERVED',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_DECISION_PROBLEM_TARGET_REF_PROJECTION',
    'NO_TEMPORAL_FRAME_OFFSET_DST_TZDB_EFFECTIVE_TIME_INFERENCE',
    'NO_UNIT_UNCERTAINTY_VERTICAL_SUPPORT_INFERENCE',
    'NO_POLICY_RUNTIME_EXECUTION_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS = new Set(
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITIONS
);
const REQUIRED_CHECKS = new Set(
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS
);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_LEDGER_REQUIRED',
      'spatial-support classification authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INPUT',
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_CHECKS_INVALID',
        `unsupported spatial-support review check ${value}`
      );
    }
  }
  if (disposition
      === 'ACCEPT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_INCOMPLETE',
          `accepted spatial-support review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must cover every exact predecessor source'
    );
  }
  const keys = new Set();
  return values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    const key = refKey(ref);
    if (keys.has(key)) {
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
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
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
        'every predecessor-source authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUTHORIZATION_COVERAGE_INVALID',
        `exactly one reproducible reviewer authorization must cover source resource ${resourceId}`
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations required by predecessor sources'
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match exact spatial-support reviewer'
    );
  }
}

function occurrenceSubject(parent) {
  const identifiers =
    parent.semanticPayload?.occurrence?.occurrenceSemantics
      ?.sourceNativeSubject?.identifiers ?? [];
  const siteIds = identifiers.filter((identifier) => identifier?.name === 'siteid');
  if (siteIds.length !== 1) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_PARENT_SUBJECT_INVALID',
      'exact parent occurrence must contain exactly one siteid identifier'
    );
  }
  return deepFreeze({ name: siteIds[0].name, value: siteIds[0].value });
}

function validateClassificationWorld({ ledger, sourceRegistry, classification }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassification(
      classification
    );
  const context =
    validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.contextSemanticMappingCompilationRef
    });
  const target =
    validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.targetIdentityBindingCompilationRef
    });

  if (!sameAuthorityRef(context.parentOccurrence.record.ref, target.parentOccurrence.record.ref)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CO_PREDECESSOR_PARENT_MISMATCH',
      'DEC-0016 and DEC-0015 must converge on the same exact DEC-0013 occurrence compilation'
    );
  }

  const contextSubject = occurrenceSubject(context.parentOccurrence);
  const targetSubject = target.semanticPayload.binding.sourceNativeSubject;
  if (!sameSemanticValue(contextSubject, targetSubject)
      || !sameSemanticValue(targetSubject, normalized.sourceNativeSubject)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CO_PREDECESSOR_SUBJECT_MISMATCH',
      'DEC-0016 parent, DEC-0015 binding and DEC-0023 subject must equal siteid = SERF'
    );
  }

  if (!sameSemanticValue(
    context.semanticPayload.mapping.targetContextSemantic,
    normalized.targetContextSemantic
  )) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTEXT_SEMANTIC_MISMATCH',
      'classification targetContextSemantic must exactly equal DEC-0016'
    );
  }

  const targetIdentity = target.semanticPayload.binding.sourceBackedTargetIdentity;
  if (targetIdentity.granularity !== normalized.sourceBackedTargetIdentity.granularity
      || targetIdentity.targetId !== normalized.sourceBackedTargetIdentity.targetId) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_TARGET_IDENTITY_MISMATCH',
      'classification target identity must exactly preserve DEC-0015 FARM granularity and targetId'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    context.parentOccurrence.source.ref,
    ...context.semanticNormalization.replayedEvidence.map(
      (evidence) => evidence.source.ref
    ),
    ...target.replayedEvidence.map((evidence) => evidence.source.ref)
  ]);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    context,
    target,
    parentOccurrence: context.parentOccurrence,
    sourceNativeSubject: contextSubject,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision({
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
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_DISPOSITION',
      'unsupported spatial-support review disposition'
    );
  }
  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateClassificationWorld({
    ledger,
    sourceRegistry,
    classification
  });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const classificationHash =
    agronomicRecordedOperationContextSpatialSupportClassificationHash(
      world.normalized
    );
  const predecessorBindings = deepFreeze({
    contextSemanticMappingCompilationRef:
      world.normalized.contextSemanticMappingCompilationRef,
    targetIdentityBindingCompilationRef:
      world.normalized.targetIdentityBindingCompilationRef,
    sharedParentOccurrenceCompilationRef: world.parentOccurrence.record.ref,
    sourceNativeSubject: cloneCanonicalValue(world.sourceNativeSubject),
    targetContextSemantic:
      cloneCanonicalValue(world.normalized.targetContextSemantic),
    sourceBackedTargetIdentity:
      cloneCanonicalValue(world.normalized.sourceBackedTargetIdentity),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind:
      'AgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORITY',
      classification: cloneCanonicalValue(world.normalized),
      classificationHash,
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
      action:
        'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION',
      inputRefs: [
        world.normalized.contextSemanticMappingCompilationRef,
        world.normalized.targetIdentityBindingCompilationRef,
        world.parentOccurrence.record.ref,
        ...world.requiredSources.map((source) => source.ref),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        classificationHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        spatialSupport: cloneCanonicalValue(world.normalized.spatialSupport)
      }
    }
  });
}

function validateReview({ ledger, sourceRegistry, reviewRef, normalizedCompilation }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind
      !== 'AgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_REQUIRED',
      'publication requires spatial-support classification review decision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_INVALID',
      'spatial-support review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_REJECTED',
      'only accepted spatial-support review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const classification = normalizedCompilation.classification;
  const classificationHash =
    agronomicRecordedOperationContextSpatialSupportClassificationHash(classification);
  if (payload.classificationHash !== classificationHash
      || !sameSemanticValue(payload.classification, classification)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_MISMATCH',
      'review must bind exact normalized spatial-support classification'
    );
  }

  const world = validateClassificationWorld({
    ledger,
    sourceRegistry,
    classification
  });
  const expectedBindings = {
    contextSemanticMappingCompilationRef:
      classification.contextSemanticMappingCompilationRef,
    targetIdentityBindingCompilationRef:
      classification.targetIdentityBindingCompilationRef,
    sharedParentOccurrenceCompilationRef: world.parentOccurrence.record.ref,
    sourceNativeSubject: cloneCanonicalValue(world.sourceNativeSubject),
    targetContextSemantic: cloneCanonicalValue(classification.targetContextSemantic),
    sourceBackedTargetIdentity:
      cloneCanonicalValue(classification.sourceBackedTargetIdentity),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match exact replayed spatial-support world'
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
      event.action
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          classification.contextSemanticMappingCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          classification.targetIdentityBindingCompilationRef
        )
        && exactRefIn(event.inputRefs, world.parentOccurrence.record.ref)
        && world.requiredSources.every(
          (source) => exactRefIn(event.inputRefs, source.ref)
        )
        && authorizations.every(
          (record) => exactRefIn(event.inputRefs, record.ref)
        )
        && event.details?.classificationHash === classificationHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(
          event.details?.predecessorBindings,
          expectedBindings
        )
        && sameSemanticValue(
          event.details?.spatialSupport,
          classification.spatialSupport
        )
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over exact spatial-support classification'
    );
  }
  return deepFreeze({ review, reviewer, authorizations, world });
}

export function publishAgronomicRecordedOperationContextSpatialSupportClassificationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 spatial-support classification requires COMPLETE targeted coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.spatialSupportReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind:
      'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
        classificationHash: normalized.classificationHash,
        spatialSupportReviewRef: review.review.ref,
        contextSemanticMappingCompilationRef:
          normalized.classification.contextSemanticMappingCompilationRef,
        targetIdentityBindingCompilationRef:
          normalized.classification.targetIdentityBindingCompilationRef,
        sharedParentOccurrenceCompilationRef:
          review.world.parentOccurrence.record.ref,
        sourceBackedTargetIdentity:
          cloneCanonicalValue(normalized.classification.sourceBackedTargetIdentity),
        spatialSupport:
          cloneCanonicalValue(normalized.classification.spatialSupport)
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextSpatialSupportClassificationCompilation') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextSpatialSupportClassificationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextSpatialSupportClassificationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 spatial-support classification must have COMPLETE targeted coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.spatialSupportReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.classificationHash === normalized.classificationHash
        && event.details?.spatialSupportReviewRef
        && sameAuthorityRef(
          event.details.spatialSupportReviewRef,
          review.review.ref
        )
        && event.details?.contextSemanticMappingCompilationRef
        && sameAuthorityRef(
          event.details.contextSemanticMappingCompilationRef,
          normalized.classification.contextSemanticMappingCompilationRef
        )
        && event.details?.targetIdentityBindingCompilationRef
        && sameAuthorityRef(
          event.details.targetIdentityBindingCompilationRef,
          normalized.classification.targetIdentityBindingCompilationRef
        )
        && event.details?.sharedParentOccurrenceCompilationRef
        && sameAuthorityRef(
          event.details.sharedParentOccurrenceCompilationRef,
          review.world.parentOccurrence.record.ref
        )
        && sameSemanticValue(
          event.details?.sourceBackedTargetIdentity,
          normalized.classification.sourceBackedTargetIdentity
        )
        && sameSemanticValue(
          event.details?.spatialSupport,
          normalized.classification.spatialSupport
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSpatialSupportClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_AUDIT_INVALID',
      'spatial-support classification compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    spatialSupportReview: review.review,
    contextSemanticMapping: review.world.context,
    targetIdentityBinding: review.world.target,
    parentOccurrence: review.world.parentOccurrence
  });
}
