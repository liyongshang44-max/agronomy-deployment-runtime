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
  AgronomicContextVerticalSupportNonApplicabilityCompilationError,
  agronomicContextVerticalSupportNonApplicabilityCompilationAuthorityRefs,
  agronomicContextVerticalSupportNonApplicabilityHash,
  normalizeAgronomicContextVerticalSupportNonApplicability,
  normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation
} from './context-vertical-support-non-applicability-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority
} from './recorded-operation-context-semantic-mapping-authority.mjs';

export const AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY',
    'REJECT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY'
  ]);

export const AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_TARGET_VALUE_VERIFIED',
    'VERTICAL_SUPPORT_NON_APPLICABILITY_VERIFIED',
    'EXPLICIT_NULL_WIRE_REPRESENTATION_VERIFIED',
    'NO_ZERO_DEPTH_SUBSTITUTION',
    'NO_ARBITRARY_DEPTH_RANGE_INFERENCE',
    'NO_PLANTING_DEPTH_INFERENCE',
    'NO_ROOT_ZONE_OR_SOIL_PROFILE_INFERENCE',
    'NO_OMITTED_VERTICAL_SUPPORT',
    'NO_GENERIC_TYPE_ONLY_INFERENCE',
    'NO_MISSING_DATA_SUBSTITUTION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_UNCERTAINTY_INFERENCE',
    'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE',
    'NO_TEMPORAL_OR_TIMEZONE_MUTATION',
    'NO_SPATIAL_SUPPORT_TARGET_OR_GEOMETRY_MUTATION',
    'NO_UNIT_MUTATION',
    'NO_EPISTEMIC_PROVENANCE_OR_SOURCE_MUTATION',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_LEDGER_REQUIRED',
      'vertical-support non-applicability authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INPUT',
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
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEWER_REQUIRED',
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
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_CHECKS_INVALID',
        `unsupported vertical-support non-applicability review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
          'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_INCOMPLETE',
          `accepted vertical-support non-applicability review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires AuthorizationDecisionAudit refs for every exact predecessor source'
    );
  }
  const keys = new Set();
  return values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    const key = refKey(ref);
    if (keys.has(key)) {
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORIZATION_INVALID',
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
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORIZATION_INVALID',
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
      throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per predecessor source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_AUTHORIZATION_SCOPE_EXCESS',
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
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact vertical-support non-applicability reviewer'
    );
  }
}

function validateRepresentationWorld({ ledger, sourceRegistry, representation }) {
  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicability(representation);

  const mapping =
    validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.parentContextSemanticMappingCompilationRef
    });

  const targetContextSemantic =
    mapping.semanticPayload.mapping.targetContextSemantic;
  if (!sameSemanticValue(targetContextSemantic, normalized.targetContextSemantic)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_TARGET_MISMATCH',
      'targetContextSemantic must equal the exact revalidated DEC-0016 semantic/value'
    );
  }

  if (targetContextSemantic.semanticId !== 'crop.planting_date'
      || targetContextSemantic.value?.type !== 'DATE'
      || targetContextSemantic.value?.date !== '2011-05-03') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_PREDECESSOR_DRIFT',
      'DEC-0024 v1 requires exact DEC-0016 crop.planting_date = DATE 2011-05-03'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    mapping.parentOccurrence.source.ref,
    ...mapping.semanticNormalization.replayedEvidence.map(
      (evidence) => evidence.source.ref
    )
  ]);
  const requiredSources =
    requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    mapping,
    requiredSources
  });
}

export function publishAgronomicContextVerticalSupportNonApplicabilityReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  representation,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_DISPOSITION',
      'unsupported vertical-support non-applicability review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world =
    validateRepresentationWorld({ ledger, sourceRegistry, representation });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const representationHash =
    agronomicContextVerticalSupportNonApplicabilityHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentContextSemanticMappingCompilationRef:
      world.normalized.parentContextSemanticMappingCompilationRef,
    parentOccurrenceCompilationRef:
      world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
    targetContextSemantic:
      cloneCanonicalValue(world.normalized.targetContextSemantic),
    requiredSourceRefs:
      world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind: 'AgronomicContextVerticalSupportNonApplicabilityReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORITY',
      representation: cloneCanonicalValue(world.normalized),
      representationHash,
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
      action: 'REVIEW_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY',
      inputRefs: [
        world.normalized.parentContextSemanticMappingCompilationRef,
        world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
        ...world.requiredSources.map((source) => source.ref),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        representationHash,
        disposition,
        confirmedChecks: checks,
        predecessorBindings,
        verticalSupportRepresentation:
          cloneCanonicalValue(world.normalized.verticalSupportRepresentation)
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
      !== 'AgronomicContextVerticalSupportNonApplicabilityReviewDecision') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_REQUIRED',
      'publication requires AgronomicContextVerticalSupportNonApplicabilityReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUTHORITY') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_INVALID',
      'vertical-support non-applicability review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_REJECTED',
      'only accepted vertical-support non-applicability review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const representation = normalizedCompilation.representation;
  const representationHash =
    agronomicContextVerticalSupportNonApplicabilityHash(representation);
  if (payload.representationHash !== representationHash
      || !sameSemanticValue(payload.representation, representation)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_MISMATCH',
      'review must bind the exact normalized vertical-support non-applicability'
    );
  }

  const world =
    validateRepresentationWorld({ ledger, sourceRegistry, representation });
  const expectedBindings = {
    parentContextSemanticMappingCompilationRef:
      representation.parentContextSemanticMappingCompilationRef,
    parentOccurrenceCompilationRef:
      world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef,
    targetContextSemantic:
      cloneCanonicalValue(representation.targetContextSemantic),
    requiredSourceRefs:
      world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessorBindings must match the exact revalidated DEC-0016 world'
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
        === 'REVIEW_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          representation.parentContextSemanticMappingCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          world.mapping.semanticPayload.mapping.parentOccurrenceCompilationRef
        )
        && world.requiredSources.every(
          (source) => exactRefIn(event.inputRefs, source.ref)
        )
        && authorizations.every(
          (record) => exactRefIn(event.inputRefs, record.ref)
        )
        && event.details?.representationHash === representationHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(
          event.details?.predecessorBindings,
          expectedBindings
        )
        && sameSemanticValue(
          event.details?.verticalSupportRepresentation,
          representation.verticalSupportRepresentation
        )
    );

  if (!directAudit) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over the exact vertical-support non-applicability'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicContextVerticalSupportNonApplicabilityCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 vertical-support non-applicability requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.verticalSupportRepresentationReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicContextVerticalSupportNonApplicabilityCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicContextVerticalSupportNonApplicabilityCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_AUTHORITY',
        representationHash: normalized.representationHash,
        verticalSupportRepresentationReviewRef: review.review.ref,
        parentContextSemanticMappingCompilationRef:
          normalized.representation.parentContextSemanticMappingCompilationRef,
        targetContextSemantic:
          cloneCanonicalValue(normalized.representation.targetContextSemantic),
        verticalSupportRepresentation:
          cloneCanonicalValue(normalized.representation.verticalSupportRepresentation)
      }
    }
  });
}

export function validateAgronomicContextVerticalSupportNonApplicabilityCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicContextVerticalSupportNonApplicabilityCompilation') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_REQUIRED',
      `expected AgronomicContextVerticalSupportNonApplicabilityCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicContextVerticalSupportNonApplicabilityCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 vertical-support non-applicability must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.verticalSupportRepresentationReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicContextVerticalSupportNonApplicabilityCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.representationHash === normalized.representationHash
        && event.details?.verticalSupportRepresentationReviewRef
        && sameAuthorityRef(
          event.details.verticalSupportRepresentationReviewRef,
          review.review.ref
        )
        && event.details?.parentContextSemanticMappingCompilationRef
        && sameAuthorityRef(
          event.details.parentContextSemanticMappingCompilationRef,
          normalized.representation.parentContextSemanticMappingCompilationRef
        )
        && sameSemanticValue(
          event.details?.targetContextSemantic,
          normalized.representation.targetContextSemantic
        )
        && sameSemanticValue(
          event.details?.verticalSupportRepresentation,
          normalized.representation.verticalSupportRepresentation
        )
    );

  if (!directAudit) {
    throw new AgronomicContextVerticalSupportNonApplicabilityCompilationError(
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_AUDIT_INVALID',
      'vertical-support non-applicability compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    verticalSupportRepresentationReview: review.review,
    contextSemanticMapping: review.world.mapping,
    parentOccurrence: review.world.mapping.parentOccurrence
  });
}
