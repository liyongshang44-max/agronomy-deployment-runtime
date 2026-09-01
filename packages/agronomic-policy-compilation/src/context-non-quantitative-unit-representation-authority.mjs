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
  AgronomicContextNonQuantitativeUnitRepresentationCompilationError,
  agronomicContextNonQuantitativeUnitRepresentationCompilationAuthorityRefs,
  agronomicContextNonQuantitativeUnitRepresentationHash,
  normalizeAgronomicContextNonQuantitativeUnitRepresentation,
  normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation
} from './context-non-quantitative-unit-representation-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority
} from './recorded-operation-context-semantic-mapping-authority.mjs';

export const AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION',
    'REJECT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION'
  ]);

export const AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_TARGET_VALUE_TYPE_VERIFIED',
    'NON_QUANTITATIVE_UNIT_INAPPLICABILITY_VERIFIED',
    'CANONICAL_NOT_APPLICABLE_TOKEN_VERIFIED',
    'NO_DAY_DURATION_SEMANTIC_SUBSTITUTION',
    'NO_DIMENSIONLESS_QUANTITATIVE_SEMANTIC_SUBSTITUTION',
    'NO_EMPTY_NULL_OR_OMITTED_UNIT',
    'NO_GENERIC_TYPE_ONLY_INFERENCE',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_UNCERTAINTY_INFERENCE',
    'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE',
    'NO_TEMPORAL_TIMEZONE_OR_SPATIAL_MUTATION',
    'NO_TARGET_INSTANCE_OR_GEOMETRY_INFERENCE',
    'NO_EPISTEMIC_PROVENANCE_OR_SOURCE_MUTATION',
    'NO_GENERAL_UNIT_REGISTRY_OR_CONVERSION_CLAIM',
    'NO_MISSING_DATA_SUBSTITUTION'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_LEDGER_REQUIRED',
      'non-quantitative unit representation authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INPUT',
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEWER_REQUIRED',
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_CHECKS_INVALID',
        `unsupported non-quantitative unit representation review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
          'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_INCOMPLETE',
          `accepted unit-representation review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires AuthorizationDecisionAudit refs for every exact predecessor source'
    );
  }
  const keys = new Set();
  return values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    const key = refKey(ref);
    if (keys.has(key)) {
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORIZATION_INVALID',
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
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORIZATION_INVALID',
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
      throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per predecessor source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_AUTHORIZATION_SCOPE_EXCESS',
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact unit-representation reviewer'
    );
  }
}

function validateRepresentationWorld({ ledger, sourceRegistry, representation }) {
  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentation(representation);

  const mapping =
    validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.parentContextSemanticMappingCompilationRef
    });

  const targetContextSemantic =
    mapping.semanticPayload.mapping.targetContextSemantic;
  if (!sameSemanticValue(targetContextSemantic, normalized.targetContextSemantic)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_TARGET_MISMATCH',
      'targetContextSemantic must equal the exact revalidated DEC-0016 semantic/value'
    );
  }

  if (targetContextSemantic.semanticId !== 'crop.planting_date'
      || targetContextSemantic.value?.type !== 'DATE'
      || targetContextSemantic.value?.date !== '2011-05-03') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_PREDECESSOR_DRIFT',
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

export function publishAgronomicContextNonQuantitativeUnitRepresentationReviewDecision({
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_DISPOSITION',
      'unsupported non-quantitative unit representation review disposition'
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
    agronomicContextNonQuantitativeUnitRepresentationHash(world.normalized);
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
    kind: 'AgronomicContextNonQuantitativeUnitRepresentationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORITY',
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
      action: 'REVIEW_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION',
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
        unitRepresentation:
          cloneCanonicalValue(world.normalized.unitRepresentation)
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
      !== 'AgronomicContextNonQuantitativeUnitRepresentationReviewDecision') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_REQUIRED',
      'publication requires AgronomicContextNonQuantitativeUnitRepresentationReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUTHORITY') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_INVALID',
      'unit representation review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_REJECTED',
      'only accepted unit-representation review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const representation = normalizedCompilation.representation;
  const representationHash =
    agronomicContextNonQuantitativeUnitRepresentationHash(representation);
  if (payload.representationHash !== representationHash
      || !sameSemanticValue(payload.representation, representation)) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_MISMATCH',
      'review must bind the exact normalized non-quantitative unit representation'
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
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_PREDECESSOR_MISMATCH',
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
        === 'REVIEW_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION'
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
          event.details?.unitRepresentation,
          representation.unitRepresentation
        )
    );

  if (!directAudit) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REVIEW_AUDIT_INVALID',
      'review lacks direct reviewer audit over the exact unit representation'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicContextNonQuantitativeUnitRepresentationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 non-quantitative unit representation requires COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.unitRepresentationReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicContextNonQuantitativeUnitRepresentationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicContextNonQuantitativeUnitRepresentationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_AUTHORITY',
        representationHash: normalized.representationHash,
        unitRepresentationReviewRef: review.review.ref,
        parentContextSemanticMappingCompilationRef:
          normalized.representation.parentContextSemanticMappingCompilationRef,
        targetContextSemantic:
          cloneCanonicalValue(normalized.representation.targetContextSemantic),
        unitRepresentation:
          cloneCanonicalValue(normalized.representation.unitRepresentation)
      }
    }
  });
}

export function validateAgronomicContextNonQuantitativeUnitRepresentationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicContextNonQuantitativeUnitRepresentationCompilation') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_REQUIRED',
      `expected AgronomicContextNonQuantitativeUnitRepresentationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicContextNonQuantitativeUnitRepresentationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 non-quantitative unit representation must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.unitRepresentationReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicContextNonQuantitativeUnitRepresentationCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.representationHash === normalized.representationHash
        && event.details?.unitRepresentationReviewRef
        && sameAuthorityRef(
          event.details.unitRepresentationReviewRef,
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
          event.details?.unitRepresentation,
          normalized.representation.unitRepresentation
        )
    );

  if (!directAudit) {
    throw new AgronomicContextNonQuantitativeUnitRepresentationCompilationError(
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_AUDIT_INVALID',
      'unit representation compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    unitRepresentationReview: review.review,
    contextSemanticMapping: review.world.mapping,
    parentOccurrence: review.world.mapping.parentOccurrence
  });
}
