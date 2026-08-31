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
  AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError,
  agronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthorityRefs,
  agronomicRecordedOperationContextSourceProviderIdentityBindingHash,
  normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding,
  normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation
} from './recorded-operation-context-source-provider-identity-binding-contract.mjs';
import {
  validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority
} from './recorded-operation-context-provenance-classification-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
    'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORITY_VERIFIED',
    'EXACT_VALUE_SOURCE_VERIFIED',
    'EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED',
    'EXACT_VALUE_SOURCE_CONTENT_HASH_VERIFIED',
    'EXACT_SOURCE_ORIGIN_LOCATOR_VERIFIED',
    'REPOSITORY_PROVIDER_NAMESPACE_VERIFIED',
    'PROVIDER_ID_EXACTLY_GITHUB_COM_ISUDATATEAM_DATATEAM',
    'PROVENANCE_CLASS_EXTERNAL_PROVIDER_PRESERVED',
    'EPISTEMIC_CLASS_ASSERTION_PRESERVED',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_CONTEXT_VALUE_VERIFIED',
    'NO_INSTITUTIONAL_ENTITY_RESOLUTION',
    'NO_HOST_ONLY_PROVIDER_ID_COLLAPSE',
    'NO_ADR_OWNERSHIP_TO_PROVIDER_INFERENCE',
    'NO_SOURCE_LOGICAL_ID_TO_PROVIDER_INFERENCE',
    'NO_GENERIC_URL_TO_PROVIDER_RULE',
    'NO_SOURCE_REF_WIRE_PROJECTION',
    'NO_CONTENT_HASH_WIRE_PROJECTION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_INFERENCE',
    'NO_TARGET_OR_SPATIAL_PROJECTION',
    'NO_UNIT_OR_UNCERTAINTY_INFERENCE',
    'NO_DECISION_PROBLEM_OR_POLICY_INFERENCE',
    'NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_LEDGER_REQUIRED',
      'provider-identity binding authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INPUT',
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
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_CHECKS_INVALID',
        `unsupported provider-identity review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_INCOMPLETE',
          `accepted provider-identity review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact provider-identity reviewer'
    );
  }
}

function resolveAuthorizationCoverage({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSource
}) {
  const refs = normalizeAuthorizationRefs(authorizationDecisionAuditRefs);
  const records = refs.map((ref) => ledger.resolve(ref));
  const resourceId = sourceReviewResourceId(requiredSource.ref);
  const matches = [];

  for (const record of records) {
    const decision = record.semanticPayload ?? {};
    if (record.ref.kind !== 'AuthorizationDecisionAudit'
      || decision.allowed !== true
      || decision.operation !== 'KNOWLEDGE_INSPECT'
      || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
      throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID',
        'every provider-identity review authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
      );
    }

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

  if (matches.length !== 1 || refs.length !== 1) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID',
      'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization for the exact value Source'
    );
  }

  return matches[0];
}

function validateBindingWorld({ ledger, sourceRegistry, binding }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(binding);

  const provenance =
    validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.contextProvenanceClassificationCompilationRef
    });

  const expectedValueSource =
    provenance.semanticPayload.classification.valueSource;
  if (!sameSemanticValue(expectedValueSource, normalized.valueSource)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_VALUE_SOURCE_MISMATCH',
      'provider binding valueSource must equal the exact DEC-0018 value source'
    );
  }

  const targetContextSemantic =
    provenance.semanticPayload.classification.targetContextSemantic;
  if (!sameSemanticValue(targetContextSemantic, normalized.targetContextSemantic)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_TARGET_MISMATCH',
      'provider binding targetContextSemantic must equal the exact DEC-0018 target semantic/value'
    );
  }

  if (normalized.epistemicClass
      !== provenance.semanticPayload.classification.epistemicClass) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_EPISTEMIC_MISMATCH',
      'provider binding epistemicClass must preserve exact DEC-0018 epistemic class'
    );
  }

  if (normalized.provenanceClass
      !== provenance.semanticPayload.classification.provenanceClass) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_PROVENANCE_MISMATCH',
      'provider binding provenanceClass must preserve exact DEC-0018 provenance class'
    );
  }

  const valueSource = provenance.parentOccurrence.source;
  const exactOriginLocator = valueSource.semanticPayload?.originLocator;
  if (normalized.sourceNamespaceEvidence.exactOriginLocator !== exactOriginLocator) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_ORIGIN_MISMATCH',
      'provider binding exactOriginLocator must equal the exact replayed value Source origin locator'
    );
  }

  return deepFreeze({
    normalized,
    provenance,
    valueSource
  });
}

export function publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  binding,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_DISPOSITION',
      'unsupported provider-identity review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateBindingWorld({ ledger, sourceRegistry, binding });
  const authorization = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.valueSource
  });
  assertAuditActor(audit, reviewer);

  const bindingHash =
    agronomicRecordedOperationContextSourceProviderIdentityBindingHash(world.normalized);
  const predecessorBindings = deepFreeze({
    contextProvenanceClassificationCompilationRef:
      world.normalized.contextProvenanceClassificationCompilationRef,
    valueSource: cloneCanonicalValue(world.normalized.valueSource),
    exactOriginLocator:
      world.normalized.sourceNamespaceEvidence.exactOriginLocator
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORITY',
      binding: cloneCanonicalValue(world.normalized),
      bindingHash,
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
        'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
      inputRefs: [
        world.normalized.contextProvenanceClassificationCompilationRef,
        world.normalized.valueSource.sourceRef,
        world.normalized.valueSource.sourceArtifactRef,
        authorization.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        bindingHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        providerId: world.normalized.providerId
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
      !== 'AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_INVALID',
      'provider-identity review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_REJECTED',
      'only accepted provider-identity review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const binding = normalizedCompilation.binding;
  const bindingHash =
    agronomicRecordedOperationContextSourceProviderIdentityBindingHash(binding);
  if (payload.bindingHash !== bindingHash
      || !sameSemanticValue(payload.binding, binding)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_MISMATCH',
      'provider-identity review must bind the exact normalized binding'
    );
  }

  const world = validateBindingWorld({ ledger, sourceRegistry, binding });
  const expectedBindings = {
    contextProvenanceClassificationCompilationRef:
      binding.contextProvenanceClassificationCompilationRef,
    valueSource: cloneCanonicalValue(binding.valueSource),
    exactOriginLocator: binding.sourceNamespaceEvidence.exactOriginLocator
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_PREDECESSOR_MISMATCH',
      'provider-identity review predecessorBindings must match the exact replayed value-source namespace world'
    );
  }

  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorization = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSource: world.valueSource
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          binding.contextProvenanceClassificationCompilationRef
        )
        && exactRefIn(event.inputRefs, binding.valueSource.sourceRef)
        && exactRefIn(event.inputRefs, binding.valueSource.sourceArtifactRef)
        && exactRefIn(event.inputRefs, authorization.ref)
        && event.details?.bindingHash === bindingHash
        && event.details?.disposition === payload.disposition
        && event.details?.providerId === binding.providerId
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUDIT_INVALID',
      'provider-identity review lacks direct reviewer audit over exact value-source namespace'
    );
  }

  return deepFreeze({ review, reviewer, authorization, world });
}

export function publishAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 provider-identity binding authority requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.providerIdentityReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY',
        bindingHash: normalized.bindingHash,
        providerIdentityReviewRef: review.review.ref,
        contextProvenanceClassificationCompilationRef:
          normalized.binding.contextProvenanceClassificationCompilationRef,
        valueSource: cloneCanonicalValue(normalized.binding.valueSource),
        exactOriginLocator:
          normalized.binding.sourceNamespaceEvidence.exactOriginLocator,
        providerId: normalized.binding.providerId
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 provider-identity binding authority must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.providerIdentityReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.bindingHash === normalized.bindingHash
        && event.details?.providerIdentityReviewRef
        && sameAuthorityRef(
          event.details.providerIdentityReviewRef,
          review.review.ref
        )
        && event.details?.contextProvenanceClassificationCompilationRef
        && sameAuthorityRef(
          event.details.contextProvenanceClassificationCompilationRef,
          normalized.binding.contextProvenanceClassificationCompilationRef
        )
        && sameSemanticValue(
          event.details?.valueSource,
          normalized.binding.valueSource
        )
        && event.details?.exactOriginLocator
          === normalized.binding.sourceNamespaceEvidence.exactOriginLocator
        && event.details?.providerId === normalized.binding.providerId
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_AUDIT_INVALID',
      'provider-identity binding compilation lacks direct reviewer audit over exact predecessor namespace'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    providerIdentityReview: review.review,
    contextProvenanceClassification: review.world.provenance,
    valueSource: review.world.valueSource
  });
}
