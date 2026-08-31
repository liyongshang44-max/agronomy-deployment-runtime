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
  AgronomicRecordedOperationContextProvenanceClassificationCompilationError,
  agronomicRecordedOperationContextProvenanceClassificationCompilationAuthorityRefs,
  agronomicRecordedOperationContextProvenanceClassificationHash,
  normalizeAgronomicRecordedOperationContextProvenanceClassification,
  normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation
} from './recorded-operation-context-provenance-classification-contract.mjs';
import {
  validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority
} from './recorded-operation-context-epistemic-classification-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
    'REJECT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORITY_VERIFIED',
    'EXACT_PARENT_OCCURRENCE_CLOSURE_VERIFIED',
    'EXACT_VALUE_SOURCE_VERIFIED',
    'EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED',
    'EXACT_VALUE_SOURCE_CONTENT_HASH_VERIFIED',
    'VALUE_SOURCE_NOT_SEMANTIC_INTERPRETATION_SOURCE',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_CONTEXT_VALUE_VERIFIED',
    'EPISTEMIC_CLASS_PRESERVED',
    'EXTERNAL_PROVIDER_CHANNEL_VERIFIED',
    'NO_SOURCE_TYPE_TO_PROVENANCE_INFERENCE',
    'NO_ORIGIN_LOCATOR_LEXICAL_INFERENCE',
    'NO_ACQUISITION_METHOD_GLOBAL_INFERENCE',
    'NO_CUSTOMER_SYSTEM_INFERENCE',
    'NO_MACHINERY_OR_SENSOR_INFERENCE',
    'NO_PLATFORM_ORIGIN_INFERENCE',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_CONTEXT_SOURCE_WIRE_PROJECTION',
    'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE',
    'NO_TARGET_OR_SPATIAL_PROJECTION',
    'NO_UNIT_OR_UNCERTAINTY_INFERENCE',
    'NO_CURRENT_STATE_OR_SEASON_INFERENCE',
    'NO_DECISION_PROBLEM_OR_POLICY_INFERENCE',
    'NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_LEDGER_REQUIRED',
      'context-provenance classification authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INPUT',
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
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_CHECKS_INVALID',
        `unsupported context-provenance classification review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_INCOMPLETE',
          `accepted provenance classification review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact provenance reviewer'
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
      throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
        'every provenance review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per required predecessor source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the predecessor source world'
    );
  }

  return deepFreeze([...selected].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref))));
}

function validateClassificationWorld({ ledger, sourceRegistry, classification }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassification(classification);

  const epistemic =
    validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.contextEpistemicClassificationCompilationRef
    });

  const parentOccurrence = epistemic.parentOccurrence;
  const valueSource = {
    sourceRef: parentOccurrence.source.ref,
    sourceArtifactRef: parentOccurrence.sourceArtifact.ref,
    sourceArtifactContentHash:
      parentOccurrence.sourceArtifact.semanticPayload.contentHash
  };

  if (!sameSemanticValue(valueSource, normalized.valueSource)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_VALUE_SOURCE_MISMATCH',
      'classification valueSource must equal the exact DEC-0013 parent occurrence Source/SourceArtifact/content hash'
    );
  }

  const targetContextSemantic =
    epistemic.semanticPayload.classification.targetContextSemantic;
  if (!sameSemanticValue(targetContextSemantic, normalized.targetContextSemantic)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_TARGET_MISMATCH',
      'classification targetContextSemantic must equal the exact DEC-0017 target semantic/value'
    );
  }

  if (normalized.epistemicClass
      !== epistemic.semanticPayload.classification.epistemicClass) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_EPISTEMIC_MISMATCH',
      'classification epistemicClass must preserve the exact DEC-0017 epistemic class'
    );
  }

  const semanticSources = uniqueRefs(
    epistemic.contextSemanticMapping.semanticNormalization.replayedEvidence
      .map((evidence) => evidence.source.ref)
  );
  if (semanticSources.some((ref) => sameAuthorityRef(ref, normalized.valueSource.sourceRef))) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_VALUE_SOURCE_ROLE_COLLISION',
      'the first value source cannot be substituted with semantic-interpretation source authority'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    parentOccurrence.source.ref,
    ...semanticSources
  ]);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    epistemic,
    parentOccurrence,
    semanticSources,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
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
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_DISPOSITION',
      'unsupported context-provenance classification review disposition'
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
    agronomicRecordedOperationContextProvenanceClassificationHash(world.normalized);
  const predecessorBindings = deepFreeze({
    contextEpistemicClassificationCompilationRef:
      world.normalized.contextEpistemicClassificationCompilationRef,
    parentOccurrenceCompilationRef:
      world.epistemic.contextSemanticMapping.semanticPayload.mapping
        .parentOccurrenceCompilationRef,
    valueSource: cloneCanonicalValue(world.normalized.valueSource),
    semanticInterpretationSourceRefs: world.semanticSources
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextProvenanceClassificationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORITY',
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
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
      inputRefs: [
        world.normalized.contextEpistemicClassificationCompilationRef,
        world.epistemic.contextSemanticMapping.semanticPayload.mapping
          .parentOccurrenceCompilationRef,
        world.normalized.valueSource.sourceRef,
        world.normalized.valueSource.sourceArtifactRef,
        ...world.semanticSources,
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        classificationHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        provenanceClass: world.normalized.provenanceClass
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
      !== 'AgronomicRecordedOperationContextProvenanceClassificationReviewDecision') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationContextProvenanceClassificationReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_INVALID',
      'context-provenance review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_REJECTED',
      'only accepted provenance review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const classification = normalizedCompilation.classification;
  const classificationHash =
    agronomicRecordedOperationContextProvenanceClassificationHash(classification);
  if (payload.classificationHash !== classificationHash
      || !sameSemanticValue(payload.classification, classification)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_MISMATCH',
      'provenance review must bind the exact normalized classification'
    );
  }

  const world = validateClassificationWorld({ ledger, sourceRegistry, classification });
  const expectedBindings = {
    contextEpistemicClassificationCompilationRef:
      classification.contextEpistemicClassificationCompilationRef,
    parentOccurrenceCompilationRef:
      world.epistemic.contextSemanticMapping.semanticPayload.mapping
        .parentOccurrenceCompilationRef,
    valueSource: cloneCanonicalValue(classification.valueSource),
    semanticInterpretationSourceRefs: world.semanticSources
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_PREDECESSOR_MISMATCH',
      'provenance review predecessorBindings must match the exact replayed value-source world'
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
      event.action === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          classification.contextEpistemicClassificationCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          world.epistemic.contextSemanticMapping.semanticPayload.mapping
            .parentOccurrenceCompilationRef
        )
        && exactRefIn(event.inputRefs, classification.valueSource.sourceRef)
        && exactRefIn(event.inputRefs, classification.valueSource.sourceArtifactRef)
        && world.semanticSources.every((ref) => exactRefIn(event.inputRefs, ref))
        && authorizations.every((record) => exactRefIn(event.inputRefs, record.ref))
        && event.details?.classificationHash === classificationHash
        && event.details?.disposition === payload.disposition
        && event.details?.provenanceClass === classification.provenanceClass
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUDIT_INVALID',
      'provenance review lacks direct reviewer audit over exact value-source and semantic-source routing'
    );
  }

  return deepFreeze({ review, reviewer, authorizations, world });
}

export function publishAgronomicRecordedOperationContextProvenanceClassificationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 provenance classification authority requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.provenanceReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextProvenanceClassificationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextProvenanceClassificationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY',
        classificationHash: normalized.classificationHash,
        provenanceReviewRef: review.review.ref,
        contextEpistemicClassificationCompilationRef:
          normalized.classification.contextEpistemicClassificationCompilationRef,
        valueSource: cloneCanonicalValue(normalized.classification.valueSource),
        provenanceClass: normalized.classification.provenanceClass
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextProvenanceClassificationCompilation') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextProvenanceClassificationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextProvenanceClassificationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 provenance classification authority must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.provenanceReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextProvenanceClassificationCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.classificationHash === normalized.classificationHash
        && event.details?.provenanceReviewRef
        && sameAuthorityRef(event.details.provenanceReviewRef, review.review.ref)
        && event.details?.contextEpistemicClassificationCompilationRef
        && sameAuthorityRef(
          event.details.contextEpistemicClassificationCompilationRef,
          normalized.classification.contextEpistemicClassificationCompilationRef
        )
        && sameSemanticValue(
          event.details?.valueSource,
          normalized.classification.valueSource
        )
        && event.details?.provenanceClass === normalized.classification.provenanceClass
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextProvenanceClassificationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_AUDIT_INVALID',
      'provenance classification compilation lacks direct reviewer audit over exact predecessor routing'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    provenanceReview: review.review,
    contextEpistemicClassification: review.world.epistemic,
    parentOccurrence: review.world.parentOccurrence,
    semanticInterpretationSourceRefs: review.world.semanticSources
  });
}
