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
  AgronomicRecordedOperationContextSemanticMappingCompilationError,
  agronomicRecordedOperationContextSemanticMappingCompilationAuthorityRefs,
  agronomicRecordedOperationContextSemanticMappingHash,
  normalizeAgronomicRecordedOperationContextSemanticMapping,
  normalizeAgronomicRecordedOperationContextSemanticMappingCompilation
} from './recorded-operation-context-semantic-mapping-contract.mjs';
import {
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority
} from './recorded-occurrence-authority.mjs';
import {
  validateAgronomicRecordedOperationSemanticNormalizationCompilationAuthority
} from './recorded-operation-semantic-normalization-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
    'REJECT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_OCCURRENCE_AUTHORITY_VERIFIED',
    'SEMANTIC_NORMALIZATION_AUTHORITY_VERIFIED',
    'NORMALIZATION_PARENT_CLOSURE_VERIFIED',
    'EXACT_SOURCE_OPERATION_SEMANTIC_VERIFIED',
    'EXACT_SOURCE_DATE_VERIFIED',
    'TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'TARGET_VALUE_TYPE_DATE_VERIFIED',
    'SOURCE_DATE_PRESERVED_EXACTLY',
    'NO_LEXICAL_ONLY_MAPPING',
    'NO_TIMESTAMP_OR_TIMEZONE_INFERENCE',
    'NO_EFFECTIVE_INTERVAL_INFERENCE',
    'NO_AVAILABLE_AT_INFERENCE',
    'NO_TARGET_IDENTITY_OR_GEOMETRY_PROJECTION',
    'NO_EPISTEMIC_OR_PROVENANCE_INFERENCE',
    'NO_UNIT_OR_UNCERTAINTY_INFERENCE',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_DECISION_PROBLEM_INFERENCE',
    'NO_CURRENT_STATE_OR_SEASON_INFERENCE',
    'NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE',
    'NO_INVERSE_OR_COMPLETENESS_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_LEDGER_REQUIRED',
      'context-semantic mapping authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INPUT',
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
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_CHECKS_INVALID',
        `unsupported context-semantic mapping review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_INCOMPLETE',
          `accepted mapping review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact mapping reviewer'
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
      throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORIZATION_INVALID',
        'every mapping authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
          && samePrincipalIdentity(
            assignment.semanticPayload?.principal,
            reviewerPrincipal
          )
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
      throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible KNOWLEDGE_INSPECT authorization per required source'
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the predecessor source world'
    );
  }

  return deepFreeze([...selected].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref))));
}

function validateMappingWorld({ ledger, sourceRegistry, mapping }) {
  const normalized = normalizeAgronomicRecordedOperationContextSemanticMapping(mapping);

  const parent = validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
    ledger,
    sourceRegistry,
    compilationRef: normalized.parentOccurrenceCompilationRef
  });
  const semantic =
    validateAgronomicRecordedOperationSemanticNormalizationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.semanticNormalizationCompilationRef
    });

  const normalization = semantic.semanticPayload.normalization;
  if (!sameAuthorityRef(
    normalization.parentOccurrenceCompilationRef,
    normalized.parentOccurrenceCompilationRef
  )) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_PARENT_CLOSURE_MISMATCH',
      'semantic normalization must close to the exact mapped parent occurrence'
    );
  }

  if (!sameSemanticValue(
    normalization.normalizedOperation,
    normalized.sourceOperationSemantic
  )) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_SEMANTIC_MISMATCH',
      'mapping sourceOperationSemantic must equal the exact accepted semantic normalization'
    );
  }

  const parentTemporal =
    parent.semanticPayload.occurrence.occurrenceSemantics.temporalSupport;
  if (!sameSemanticValue(parentTemporal, normalized.sourceTemporalSupport)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_TEMPORAL_MISMATCH',
      'mapping sourceTemporalSupport must equal the exact accepted parent occurrence temporal support'
    );
  }
  if (normalized.targetContextSemantic.value.date !== parentTemporal.date) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE_MISMATCH',
      'target context DATE must equal the exact parent occurrence date'
    );
  }

  const requiredSourceRefs = uniqueRefs([
    parent.source.ref,
    ...semantic.replayedEvidence.map((evidence) => evidence.source.ref)
  ]);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));

  return deepFreeze({
    normalized,
    parent,
    semantic,
    requiredSources
  });
}

export function publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  mapping,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_DISPOSITION',
      'unsupported context-semantic mapping review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateMappingWorld({ ledger, sourceRegistry, mapping });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const mappingHash =
    agronomicRecordedOperationContextSemanticMappingHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentOccurrenceCompilationRef: world.normalized.parentOccurrenceCompilationRef,
    semanticNormalizationCompilationRef:
      world.normalized.semanticNormalizationCompilationRef,
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSemanticMappingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORITY',
      mapping: cloneCanonicalValue(world.normalized),
      mappingHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: authorizations.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      inputRefs: [
        world.normalized.parentOccurrenceCompilationRef,
        world.normalized.semanticNormalizationCompilationRef,
        ...world.requiredSources.map((source) => source.ref),
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        mappingHash,
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
      !== 'AgronomicRecordedOperationContextSemanticMappingReviewDecision') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationContextSemanticMappingReviewDecision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_INVALID',
      'context-semantic mapping review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_REJECTED',
      'only accepted mapping review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const mapping = normalizedCompilation.mapping;
  const mappingHash = agronomicRecordedOperationContextSemanticMappingHash(mapping);
  if (payload.mappingHash !== mappingHash
      || !sameSemanticValue(payload.mapping, mapping)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_MISMATCH',
      'mapping review must bind the exact normalized mapping'
    );
  }

  const world = validateMappingWorld({ ledger, sourceRegistry, mapping });
  const expectedBindings = {
    parentOccurrenceCompilationRef: mapping.parentOccurrenceCompilationRef,
    semanticNormalizationCompilationRef: mapping.semanticNormalizationCompilationRef,
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_PREDECESSOR_MISMATCH',
      'mapping review predecessorBindings must match exact replayed predecessor world'
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
      event.action === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(event.inputRefs, mapping.parentOccurrenceCompilationRef)
        && exactRefIn(event.inputRefs, mapping.semanticNormalizationCompilationRef)
        && world.requiredSources.every((source) => exactRefIn(event.inputRefs, source.ref))
        && authorizations.every((record) => exactRefIn(event.inputRefs, record.ref))
        && event.details?.mappingHash === mappingHash
        && event.details?.disposition === payload.disposition
        && sameSemanticValue(event.details?.predecessorBindings, expectedBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUDIT_INVALID',
      'mapping review lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({ review, reviewer, authorizations, world });
}

export function publishAgronomicRecordedOperationContextSemanticMappingCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 context-semantic mapping authority requires COMPLETE targeted mapping coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.semanticReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(audit, review.reviewer);
  const refs =
    agronomicRecordedOperationContextSemanticMappingCompilationAuthorityRefs(normalized);

  return ledger.publish({
    kind: 'AgronomicRecordedOperationContextSemanticMappingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY',
        mappingHash: normalized.mappingHash,
        semanticReviewRef: review.review.ref,
        parentOccurrenceCompilationRef:
          normalized.mapping.parentOccurrenceCompilationRef,
        semanticNormalizationCompilationRef:
          normalized.mapping.semanticNormalizationCompilationRef
      }
    }
  });
}

export function validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationContextSemanticMappingCompilation') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationContextSemanticMappingCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationContextSemanticMappingCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 context-semantic mapping authority must have COMPLETE targeted coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.semanticReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationContextSemanticMappingCompilationAuthorityRefs(normalized);

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.mappingHash === normalized.mappingHash
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, review.review.ref)
        && event.details?.parentOccurrenceCompilationRef
        && sameAuthorityRef(
          event.details.parentOccurrenceCompilationRef,
          normalized.mapping.parentOccurrenceCompilationRef
        )
        && event.details?.semanticNormalizationCompilationRef
        && sameAuthorityRef(
          event.details.semanticNormalizationCompilationRef,
          normalized.mapping.semanticNormalizationCompilationRef
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationContextSemanticMappingCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_AUDIT_INVALID',
      'context-semantic mapping compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: review.review,
    parentOccurrence: review.world.parent,
    semanticNormalization: review.world.semantic
  });
}
