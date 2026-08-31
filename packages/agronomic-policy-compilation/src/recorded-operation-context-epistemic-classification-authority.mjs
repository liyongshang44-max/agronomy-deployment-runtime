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
  AgronomicRecordedOperationContextEpistemicClassificationCompilationError,
  agronomicRecordedOperationContextEpistemicClassificationCompilationAuthorityRefs,
  agronomicRecordedOperationContextEpistemicClassificationHash,
  normalizeAgronomicRecordedOperationContextEpistemicClassification,
  normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation
} from './recorded-operation-context-epistemic-classification-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority
} from './recorded-operation-context-semantic-mapping-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
    'REJECT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED',
    'EXACT_PARENT_OCCURRENCE_CLOSURE_VERIFIED',
    'EXACT_RECORD_SEMANTIC_ROLE_VERIFIED',
    'EXACT_OCCURRENCE_CLASS_VERIFIED',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_CONTEXT_VALUE_VERIFIED',
    'ASSERTION_CLASS_SUPPORTED',
    'NO_DIRECT_MEASUREMENT_AUTHORITY_ESTABLISHED',
    'NO_TELEMETRY_AUTHORITY_ESTABLISHED',
    'NO_OBSERVATION_UPGRADE',
    'NO_PROVENANCE_CLASS_INFERENCE',
    'NO_SOURCE_REPUTATION_UPGRADE',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE',
    'NO_TARGET_OR_SPATIAL_PROJECTION',
    'NO_UNIT_OR_UNCERTAINTY_INFERENCE',
    'NO_CURRENT_STATE_OR_SEASON_INFERENCE',
    'NO_DECISION_PROBLEM_OR_POLICY_INFERENCE',
    'NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_LEDGER_REQUIRED',
      'context-epistemic classification authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INPUT',
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

function uniqueRefs(refs) {
  const map = new Map(refs.map((ref) => [refKey(ref), ref]));
  return deepFreeze([...map.values()].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_CHECKS_INVALID',
        `unsupported context-epistemic classification review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_INCOMPLETE',
          `accepted epistemic classification review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact epistemic reviewer'
    );
  }
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
      throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
        'every epistemic review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      const assignments = (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
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
      if (recomputed.allowed
        && recomputed.decisionHash === decision.decisionHash
        && hasGrant) {
        matches.push(record);
      }
    }
    if (matches.length !== 1) {
      throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per required predecessor source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the predecessor source world'
    );
  }
  return deepFreeze([...selected].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref))));
}

function validateClassificationWorld({ ledger, sourceRegistry, classification }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassification(classification);

  const mapping =
    validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.contextSemanticMappingCompilationRef
    });

  const parentOccurrence = mapping.parentOccurrence.semanticPayload.occurrence;
  const predecessorOccurrenceSemantics = {
    recordSemanticRole: parentOccurrence.recordSemanticRole,
    occurrenceClass: parentOccurrence.occurrenceSemantics.occurrenceClass
  };
  if (!sameSemanticValue(
    predecessorOccurrenceSemantics,
    normalized.predecessorOccurrenceSemantics
  )) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_PARENT_SEMANTICS_MISMATCH',
      'classification predecessorOccurrenceSemantics must equal the exact DEC-0016 parent occurrence semantics'
    );
  }

  const targetContextSemantic =
    mapping.semanticPayload.mapping.targetContextSemantic;
  if (!sameSemanticValue(targetContextSemantic, normalized.targetContextSemantic)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_TARGET_MISMATCH',
      'classification targetContextSemantic must equal the exact DEC-0016 mapped semantic/value'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    mapping.parentOccurrence.source.ref,
    ...mapping.semanticNormalization.replayedEvidence.map((evidence) => evidence.source.ref)
  ]);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    mapping,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
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
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_DISPOSITION',
      'unsupported context-epistemic classification review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateClassificationWorld({ ledger, sourceRegistry, classification });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const classificationHash =
    agronomicRecordedOperationContextEpistemicClassificationHash(world.normalized);
  const predecessorBindings = deepFreeze({
    contextSemanticMappingCompilationRef:
      world.normalized.contextSemanticMappingCompilationRef,
    parentOccurrenceCompilationRef:
      world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextEpistemicClassificationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORITY',
      classification: cloneCanonicalValue(world.normalized),
      classificationHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: authorizations.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
      inputRefs: [
        world.normalized.contextSemanticMappingCompilationRef,
        world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
        ...world.requiredSources.map((source) => source.ref),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        classificationHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings
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
      !== 'AgronomicRecordedOperationContextEpistemicClassificationReviewDecision') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationContextEpistemicClassificationReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_INVALID',
      'context-epistemic review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_REJECTED',
      'only accepted epistemic review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const classification = normalizedCompilation.classification;
  const classificationHash =
    agronomicRecordedOperationContextEpistemicClassificationHash(classification);
  if (payload.classificationHash !== classificationHash
      || !sameSemanticValue(payload.classification, classification)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_MISMATCH',
      'epistemic review must bind the exact normalized classification'
    );
  }

  const world = validateClassificationWorld({ ledger, sourceRegistry, classification });
  const expectedBindings = {
    contextSemanticMappingCompilationRef:
      classification.contextSemanticMappingCompilationRef,
    parentOccurrenceCompilationRef:
      world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_PREDECESSOR_MISMATCH',
      'epistemic review predecessorBindings must match exact replayed predecessor world'
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
      event.action === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(event.inputRefs, classification.contextSemanticMappingCompilationRef)
        && exactRefIn(
          event.inputRefs,
          world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef
        )
        && world.requiredSources.every((source) => exactRefIn(event.inputRefs, source.ref))
        && authorizations.every((record) => exactRefIn(event.inputRefs, record.ref))
        && event.details?.classificationHash === classificationHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUDIT_INVALID',
      'epistemic review lacks direct reviewer audit over exact predecessor world'
    );
  }

  return deepFreeze({ review, reviewer, authorizations, world });
}

export function publishAgronomicRecordedOperationContextEpistemicClassificationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 epistemic classification authority requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.epistemicReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextEpistemicClassificationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextEpistemicClassificationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY',
        classificationHash: normalized.classificationHash,
        epistemicReviewRef: review.review.ref,
        contextSemanticMappingCompilationRef:
          normalized.classification.contextSemanticMappingCompilationRef,
        epistemicClass: normalized.classification.epistemicClass
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextEpistemicClassificationCompilation') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextEpistemicClassificationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextEpistemicClassificationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 epistemic classification authority must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.epistemicReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextEpistemicClassificationCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.classificationHash === normalized.classificationHash
        && event.details?.epistemicReviewRef
        && sameAuthorityRef(event.details.epistemicReviewRef, review.review.ref)
        && event.details?.contextSemanticMappingCompilationRef
        && sameAuthorityRef(
          event.details.contextSemanticMappingCompilationRef,
          normalized.classification.contextSemanticMappingCompilationRef
        )
        && event.details?.epistemicClass === normalized.classification.epistemicClass
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextEpistemicClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_AUDIT_INVALID',
      'epistemic classification compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    epistemicReview: review.review,
    contextSemanticMapping: review.world.mapping,
    parentOccurrence: review.world.mapping.parentOccurrence
  });
}
