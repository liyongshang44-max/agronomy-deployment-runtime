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
  AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError,
  agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthorityRefs,
  agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash,
  normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding,
  normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation
} from './recorded-operation-context-source-native-timezone-identity-binding-contract.mjs';
import {
  replayAgronomicRecordedOperationContextSourceNativeTimezoneIdentityEvidence
} from './recorded-operation-context-source-native-timezone-identity-binding-evidence.mjs';
import {
  validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority
} from './recorded-operation-context-temporal-support-classification-authority.mjs';
import {
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority
} from './recorded-operation-target-identity-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
    'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'TEMPORAL_SUPPORT_CLASSIFICATION_AUTHORITY_VERIFIED',
    'TARGET_IDENTITY_BINDING_AUTHORITY_VERIFIED',
    'CO_PREDECESSOR_PARENT_OCCURRENCE_REF_EQUAL',
    'CO_PREDECESSOR_SOURCE_NATIVE_SUBJECT_EQUAL',
    'EXACT_PARENT_OCCURRENCE_VERIFIED',
    'EXACT_SOURCE_NATIVE_SUBJECT_SERF',
    'EXACT_DECAGON_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED',
    'EXACT_DECAGON_TIMEZONE_EVIDENCE_BLOB_VERIFIED',
    'EXACT_WATERTABLE_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED',
    'EXACT_WATERTABLE_TIMEZONE_EVIDENCE_BLOB_VERIFIED',
    'SOURCE_NATIVE_SERF_TIMEZONE_IDENTITY_VERIFIED',
    'TIMEZONE_SCHEME_IANA_VERIFIED',
    'TIMEZONE_ZONE_ID_AMERICA_CHICAGO_VERIFIED',
    'NO_OFFSET_INFERENCE',
    'NO_DST_RESOLUTION',
    'NO_TZDB_VERSION_AUTHORITY',
    'NO_CALENDAR_DATE_LOCAL_FRAME_BINDING',
    'NO_EFFECTIVE_INTERVAL_CONSTRUCTION',
    'NO_AVAILABLE_AT_CONSTRUCTION',
    'NO_GEOGRAPHIC_TIMEZONE_INFERENCE',
    'NO_GENERIC_SITE_TIMEZONE_RULE',
    'NO_UPSTREAM_CODE_EXECUTION_AS_AUTHORITY',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_UNIT_UNCERTAINTY_SPATIAL_VERTICAL_PROJECTION',
    'NO_DECISION_PROBLEM_POLICY_RUNTIME_EXECUTION_OUTCOME',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_LEDGER_REQUIRED',
      'source-native timezone identity binding requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INPUT',
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
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_CHECKS_INVALID',
        `unsupported timezone identity review check ${value}`
      );
    }
  }
  if (disposition
      === 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_INCOMPLETE',
          `accepted timezone identity review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const keys = new Set();
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    const key = refKey(ref);
    if (keys.has(key)) {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID',
        'authorizationDecisionAuditRefs cannot contain duplicates'
      );
    }
    keys.add(key);
    return ref;
  });
  return refs;
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
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID',
        'every timezone evidence authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_AUTHORIZATION_COVERAGE_INVALID',
        `exactly one reproducible reviewer authorization must cover source resource ${resourceId}`
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations required by timezone evidence'
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
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_ACTOR_MISMATCH',
      'audit actor must match exact timezone identity reviewer'
    );
  }
}

function occurrenceSubject(parent) {
  const identifiers =
    parent?.semanticPayload?.occurrence?.occurrenceSemantics
      ?.sourceNativeSubject?.identifiers ?? [];
  const siteIds = identifiers.filter((identifier) => identifier?.name === 'siteid');
  if (siteIds.length !== 1) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_PARENT_SUBJECT_INVALID',
      'exact parent occurrence must contain exactly one siteid identifier'
    );
  }
  return deepFreeze({
    name: siteIds[0].name,
    value: siteIds[0].value
  });
}

function validateBindingWorld({ ledger, sourceRegistry, binding }) {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
      binding
    );

  const temporal =
    validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef:
        normalized.temporalSupportClassificationCompilationRef
    });
  const targetIdentity =
    validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.targetIdentityBindingCompilationRef
    });

  const temporalParent = temporal.parentOccurrence;
  const identityParent = targetIdentity.parentOccurrence;

  if (!sameAuthorityRef(temporalParent.record.ref, identityParent.record.ref)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_CO_PREDECESSOR_PARENT_MISMATCH',
      'DEC-0021 and DEC-0015 co-predecessors must converge on the same exact DEC-0013 occurrence compilation'
    );
  }

  const temporalSubject = occurrenceSubject(temporalParent);
  const identitySubject = targetIdentity.semanticPayload.binding.sourceNativeSubject;
  if (!sameSemanticValue(temporalSubject, identitySubject)
      || !sameSemanticValue(identitySubject, normalized.sourceNativeSubject)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_CO_PREDECESSOR_SUBJECT_MISMATCH',
      'DEC-0021 parent, DEC-0015 binding and DEC-0022 sourceNativeSubject must equal siteid = SERF'
    );
  }

  if (targetIdentity.semanticPayload.binding
      .sourceBackedTargetIdentity.granularity !== 'FARM') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_TARGET_GRANULARITY_MISMATCH',
      'DEC-0022 v1 requires exact DEC-0015 FARM identity predecessor'
    );
  }

  const replayed =
    replayAgronomicRecordedOperationContextSourceNativeTimezoneIdentityEvidence({
      sourceRegistry,
      binding: normalized
    });

  for (const evidence of replayed) {
    if (evidence.artifact.semanticPayload?.rightsSnapshot === undefined) {
      throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_RIGHTS_SNAPSHOT_REQUIRED',
        'every timezone evidence SourceArtifact requires exact rightsSnapshot'
      );
    }
  }

  const requiredSources = uniqueRefs(
    replayed.map((evidence) => evidence.source.ref)
  ).map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    temporal,
    targetIdentity,
    parentOccurrence: temporalParent,
    sourceNativeSubject: temporalSubject,
    replayed,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
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
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_DISPOSITION',
      'unsupported source-native timezone identity review disposition'
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
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
      world.normalized
    );
  const evidenceBindings = deepFreeze(
    world.replayed.map((evidence) => deepFreeze({
      evidenceRole: evidence.evidenceRole,
      sourceRef: evidence.source.ref,
      sourceArtifactRef: evidence.artifact.ref,
      locator: evidence.locator,
      evidenceHash: evidence.evidenceHash
    }))
  );
  const predecessorBindings = deepFreeze({
    temporalSupportClassificationCompilationRef:
      world.normalized.temporalSupportClassificationCompilationRef,
    targetIdentityBindingCompilationRef:
      world.normalized.targetIdentityBindingCompilationRef,
    sharedParentOccurrenceCompilationRef: world.parentOccurrence.record.ref,
    sourceNativeSubject: cloneCanonicalValue(world.sourceNativeSubject),
    targetGranularity:
      world.targetIdentity.semanticPayload.binding
        .sourceBackedTargetIdentity.granularity
  });

  return ledger.publish({
    kind:
      'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORITY',
      binding: cloneCanonicalValue(world.normalized),
      bindingHash,
      predecessorBindings,
      evidenceBindings,
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
        'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      inputRefs: [
        world.normalized.temporalSupportClassificationCompilationRef,
        world.normalized.targetIdentityBindingCompilationRef,
        world.parentOccurrence.record.ref,
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
        predecessorBindings,
        evidenceBindings,
        sourceTimezone: cloneCanonicalValue(world.normalized.sourceTimezone)
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
      !== 'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_REQUIRED',
      'publication requires source-native timezone identity review decision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_INVALID',
      'source-native timezone identity review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_REJECTED',
      'only accepted source-native timezone identity review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const binding = normalizedCompilation.binding;
  const bindingHash =
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
      binding
    );
  if (payload.bindingHash !== bindingHash
      || !sameSemanticValue(payload.binding, binding)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_MISMATCH',
      'review must bind exact normalized source-native timezone identity binding'
    );
  }

  const world = validateBindingWorld({ ledger, sourceRegistry, binding });
  const expectedPredecessors = {
    temporalSupportClassificationCompilationRef:
      binding.temporalSupportClassificationCompilationRef,
    targetIdentityBindingCompilationRef:
      binding.targetIdentityBindingCompilationRef,
    sharedParentOccurrenceCompilationRef: world.parentOccurrence.record.ref,
    sourceNativeSubject: cloneCanonicalValue(world.sourceNativeSubject),
    targetGranularity:
      world.targetIdentity.semanticPayload.binding
        .sourceBackedTargetIdentity.granularity
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedPredecessors)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match exact replayed co-predecessor world'
    );
  }

  const expectedEvidence = world.replayed.map((evidence) => ({
    evidenceRole: evidence.evidenceRole,
    sourceRef: evidence.source.ref,
    sourceArtifactRef: evidence.artifact.ref,
    locator: evidence.locator,
    evidenceHash: evidence.evidenceHash
  }));
  if (!sameSemanticValue(payload.evidenceBindings, expectedEvidence)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_EVIDENCE_MISMATCH',
      'review evidenceBindings must match exact replayed timezone evidence'
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
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          binding.temporalSupportClassificationCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          binding.targetIdentityBindingCompilationRef
        )
        && exactRefIn(event.inputRefs, world.parentOccurrence.record.ref)
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
          event.details?.predecessorBindings,
          expectedPredecessors
        )
        && sameSemanticValue(
          event.details?.evidenceBindings,
          expectedEvidence
        )
        && sameSemanticValue(
          event.details?.sourceTimezone,
          binding.sourceTimezone
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUDIT_INVALID',
      'timezone identity review lacks direct reviewer audit over exact co-predecessors and evidence'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 source-native timezone identity binding requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.timezoneReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind:
      'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY',
        bindingHash: normalized.bindingHash,
        timezoneReviewRef: review.review.ref,
        temporalSupportClassificationCompilationRef:
          normalized.binding.temporalSupportClassificationCompilationRef,
        targetIdentityBindingCompilationRef:
          normalized.binding.targetIdentityBindingCompilationRef,
        sharedParentOccurrenceCompilationRef:
          review.world.parentOccurrence.record.ref,
        sourceNativeSubject:
          cloneCanonicalValue(normalized.binding.sourceNativeSubject),
        sourceTimezone:
          cloneCanonicalValue(normalized.binding.sourceTimezone),
        evidenceBindings:
          review.review.semanticPayload.evidenceBindings
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 source-native timezone identity binding must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.timezoneReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.bindingHash === normalized.bindingHash
        && event.details?.timezoneReviewRef
        && sameAuthorityRef(
          event.details.timezoneReviewRef,
          review.review.ref
        )
        && event.details?.temporalSupportClassificationCompilationRef
        && sameAuthorityRef(
          event.details.temporalSupportClassificationCompilationRef,
          normalized.binding.temporalSupportClassificationCompilationRef
        )
        && event.details?.targetIdentityBindingCompilationRef
        && sameAuthorityRef(
          event.details.targetIdentityBindingCompilationRef,
          normalized.binding.targetIdentityBindingCompilationRef
        )
        && event.details?.sharedParentOccurrenceCompilationRef
        && sameAuthorityRef(
          event.details.sharedParentOccurrenceCompilationRef,
          review.world.parentOccurrence.record.ref
        )
        && sameSemanticValue(
          event.details?.sourceNativeSubject,
          normalized.binding.sourceNativeSubject
        )
        && sameSemanticValue(
          event.details?.sourceTimezone,
          normalized.binding.sourceTimezone
        )
        && sameSemanticValue(
          event.details?.evidenceBindings,
          review.review.semanticPayload.evidenceBindings
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_AUDIT_INVALID',
      'source-native timezone identity binding compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    timezoneReview: review.review,
    temporalSupportClassification: review.world.temporal,
    targetIdentityBinding: review.world.targetIdentity,
    parentOccurrence: review.world.parentOccurrence,
    replayedEvidence: review.world.replayed
  });
}
