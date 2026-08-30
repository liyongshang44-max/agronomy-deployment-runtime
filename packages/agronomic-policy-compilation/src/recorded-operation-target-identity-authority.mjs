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
  AgronomicRecordedOperationTargetIdentityBindingCompilationError,
  agronomicRecordedOperationTargetIdentityBindingCompilationAuthorityRefs,
  agronomicRecordedOperationTargetIdentityBindingHash,
  normalizeAgronomicRecordedOperationTargetIdentityBinding,
  normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation
} from './recorded-operation-target-identity-contract.mjs';
import {
  replayAgronomicRecordedOperationTargetIdentityEvidence
} from './recorded-operation-target-identity-evidence.mjs';
import {
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority
} from './recorded-occurrence-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    'REJECT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_OCCURRENCE_AUTHORITY_VERIFIED',
    'SOURCE_NATIVE_IDENTIFIER_VERIFIED',
    'EXACT_IDENTITY_EVIDENCE_VERIFIED',
    'SOURCE_IDENTITY_NAMESPACE_APPLICABILITY_VERIFIED',
    'TARGET_GRANULARITY_SUPPORTED',
    'SOURCE_BACKED_NAMESPACE_PRESERVED',
    'NO_FIELD_OR_PLOT_GRANULARITY_INFERENCE',
    'NO_GEOMETRY_INFERENCE',
    'NO_TEMPORAL_OR_TIMEZONE_INFERENCE',
    'NO_DECISION_PROBLEM_INFERENCE',
    'NO_CONTEXT_DATUM_INFERENCE',
    'NO_CROSS_SOURCE_CANONICAL_IDENTITY_INFERENCE',
    'NO_RUNTIME_OR_EXECUTION_INFERENCE',
    'NO_OUTCOME_INFERENCE',
    'NO_COMPLETENESS_OR_INVERSE_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_LEDGER_REQUIRED',
      'target identity authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function refKey(ref) {
  return JSON.stringify([
    ref.kind,
    ref.logicalId,
    ref.version,
    ref.semanticHash
  ]);
}

function sameSemanticValue(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
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
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEWER_REQUIRED',
      'reviewerPrincipal must be an object'
    );
  }
  return deepFreeze({
    principalId: text(value.principalId, 'reviewerPrincipal.principalId'),
    type: text(value.type, 'reviewerPrincipal.type'),
    organizationId: text(
      value.organizationId,
      'reviewerPrincipal.organizationId'
    ),
    ...(value.tenantId
      ? { tenantId: text(value.tenantId, 'reviewerPrincipal.tenantId') }
      : {})
  });
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_CHECKS_INVALID',
        `unsupported target-identity review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_INCOMPLETE',
          `accepted target-identity review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
      || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact target-identity reviewer'
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
    if (record.ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUTHORIZATION_INVALID',
        'review authorization ref must resolve to AuthorizationDecisionAudit'
      );
    }
    const decision = record.semanticPayload ?? {};
    if (decision.allowed !== true
      || decision.operation !== 'KNOWLEDGE_INSPECT'
      || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUTHORIZATION_INVALID',
        'every target-identity authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUTHORIZATION_COVERAGE_INVALID',
        `exactly one reproducible reviewer authorization must cover source resource ${resourceId}`
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the reviewed source world'
    );
  }

  return deepFreeze(
    [...selected].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)))
  );
}

function sameIdentifier(left, right) {
  return left?.name === right?.name && left?.value === right?.value;
}

function validateBindingWorld({ ledger, sourceRegistry, binding }) {
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBinding(binding);

  const parent =
    validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.parentOccurrenceCompilationRef
    });

  const parentOccurrence = parent.semanticPayload.occurrence;
  const parentSourceRef = parentOccurrence.sourceRef;
  const parentIdentifiers =
    parentOccurrence.occurrenceSemantics.sourceNativeSubject.identifiers ?? [];

  if (!parentIdentifiers.some((identifier) =>
    sameIdentifier(identifier, normalized.sourceNativeSubject))) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_PARENT_IDENTIFIER_MISMATCH',
      'sourceNativeSubject must exist exactly in the parent recorded occurrence'
    );
  }

  if (!sameIdentifier(
    normalized.applicability.appliesToSourceNativeIdentifier,
    normalized.sourceNativeSubject
  )) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_APPLICABILITY_IDENTIFIER_MISMATCH',
      'applicability source-native identifier must exactly match the bound identifier'
    );
  }

  if (!sameAuthorityRef(
    normalized.applicability.appliesToOccurrenceSourceRef,
    parentSourceRef
  )) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_PARENT_SOURCE_MISMATCH',
      'applicability must bind the exact parent recorded-occurrence Source'
    );
  }

  if (!sameAuthorityRef(
    normalized.sourceBackedTargetIdentity.namespaceRef,
    parentSourceRef
  )) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_NAMESPACE_MISMATCH',
      'v1 source-backed namespace must be the exact parent recorded-occurrence Source'
    );
  }

  const replayed = replayAgronomicRecordedOperationTargetIdentityEvidence({
    sourceRegistry,
    binding: normalized
  });

  for (const evidence of replayed) {
    if (evidence.artifact.semanticPayload?.rightsSnapshot === undefined) {
      throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_RIGHTS_SNAPSHOT_REQUIRED',
        'every target-identity evidence SourceArtifact requires an exact rightsSnapshot'
      );
    }
  }

  const requiredSources = uniqueRefs([
    parent.source.ref,
    ...replayed.map((evidence) => evidence.source.ref)
  ]).map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    parent,
    replayed,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
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
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_DISPOSITION',
      'unsupported target-identity review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateBindingWorld({ ledger, sourceRegistry, binding });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const bindingHash =
    agronomicRecordedOperationTargetIdentityBindingHash(world.normalized);
  const evidenceBindings = deepFreeze(
    world.replayed.map((evidence) => deepFreeze({
      evidenceRole: evidence.evidenceRole,
      sourceRef: evidence.source.ref,
      sourceArtifactRef: evidence.artifact.ref,
      locator: evidence.locator,
      evidenceHash: evidence.evidenceHash
    }))
  );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationTargetIdentityBindingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_REVIEW_AUTHORITY',
      binding: cloneCanonicalValue(world.normalized),
      bindingHash,
      parentOccurrenceCompilationRef:
        world.normalized.parentOccurrenceCompilationRef,
      evidenceBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: authorizations.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      inputRefs: [
        world.normalized.parentOccurrenceCompilationRef,
        world.parent.source.ref,
        ...world.replayed.flatMap((evidence) => [
          evidence.source.ref,
          evidence.artifact.ref
        ]),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        bindingHash,
        disposition,
        confirmedChecks: checks,
        evidenceBindings
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
      !== 'AgronomicRecordedOperationTargetIdentityBindingReviewDecision') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationTargetIdentityBindingReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_INVALID',
      'target-identity review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_REJECTED',
      'only ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const binding = normalizedCompilation.binding;
  const bindingHash =
    agronomicRecordedOperationTargetIdentityBindingHash(binding);
  if (payload.bindingHash !== bindingHash
    || !sameAuthorityRef(
      payload.parentOccurrenceCompilationRef,
      binding.parentOccurrenceCompilationRef
    )) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_MISMATCH',
      'identity review must bind the exact target identity binding and parent occurrence'
    );
  }

  const world = validateBindingWorld({
    ledger,
    sourceRegistry,
    binding
  });

  const expectedBindings = world.replayed.map((evidence) => ({
    evidenceRole: evidence.evidenceRole,
    sourceRef: evidence.source.ref,
    sourceArtifactRef: evidence.artifact.ref,
    locator: evidence.locator,
    evidenceHash: evidence.evidenceHash
  }));
  if (!sameSemanticValue(payload.evidenceBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_EVIDENCE_MISMATCH',
      'identity review evidenceBindings must match exact replayed evidence'
    );
  }

  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs:
      payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          binding.parentOccurrenceCompilationRef
        )
        && world.replayed.every((evidence) =>
          exactRefIn(event.inputRefs, evidence.source.ref)
            && exactRefIn(event.inputRefs, evidence.artifact.ref)
        )
        && authorizations.every((record) =>
          exactRefIn(event.inputRefs, record.ref)
        )
        && event.details?.bindingHash === bindingHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(
          event.details?.evidenceBindings,
          expectedBindings
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUDIT_INVALID',
      'target-identity review lacks direct reviewer audit over exact parent and evidence set'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 target-identity authority may be published only with COMPLETE targeted identity coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.identityReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationTargetIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationTargetIdentityBindingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY',
        bindingHash: normalized.bindingHash,
        identityReviewRef: review.review.ref,
        parentOccurrenceCompilationRef:
          normalized.binding.parentOccurrenceCompilationRef,
        targetId:
          normalized.binding.sourceBackedTargetIdentity.targetId,
        evidenceBindings: review.review.semanticPayload.evidenceBindings
      }
    }
  });
}

export function validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationTargetIdentityBindingCompilation') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationTargetIdentityBindingCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 target-identity authority must have COMPLETE targeted identity coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.identityReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationTargetIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.bindingHash === normalized.bindingHash
        && event.details?.identityReviewRef
        && sameAuthorityRef(
          event.details.identityReviewRef,
          review.review.ref
        )
        && event.details?.parentOccurrenceCompilationRef
        && sameAuthorityRef(
          event.details.parentOccurrenceCompilationRef,
          normalized.binding.parentOccurrenceCompilationRef
        )
        && event.details?.targetId
          === normalized.binding.sourceBackedTargetIdentity.targetId
        && sameSemanticValue(
          event.details?.evidenceBindings,
          review.review.semanticPayload.evidenceBindings
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_AUDIT_INVALID',
      'target-identity compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    identityReview: review.review,
    parentOccurrence: review.world.parent,
    replayedEvidence: review.world.replayed
  });
}
