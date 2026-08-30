import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  AgronomicRecordedOperationSemanticNormalizationCompilationError,
  agronomicRecordedOperationSemanticNormalizationCompilationAuthorityRefs,
  agronomicRecordedOperationSemanticNormalizationHash,
  normalizeAgronomicRecordedOperationSemanticNormalization,
  normalizeAgronomicRecordedOperationSemanticNormalizationCompilation
} from './recorded-operation-semantic-normalization-contract.mjs';
import {
  replayAgronomicRecordedOperationSemanticNormalizationEvidence
} from './recorded-operation-semantic-normalization-evidence.mjs';
import {
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority
} from './recorded-occurrence-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
    'REJECT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION'
  ]);

export const AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_OCCURRENCE_AUTHORITY_VERIFIED',
    'EXACT_SOURCE_OPERATION_CODE_VERIFIED',
    'EXACT_SEMANTIC_EVIDENCE_VERIFIED',
    'SOURCE_CODE_NAMESPACE_APPLICABILITY_VERIFIED',
    'NORMALIZED_OPERATION_FAMILY_SUPPORTED',
    'NORMALIZED_OPERATION_SUBJECT_KIND_SUPPORTED',
    'NORMALIZED_OPERATION_SUBJECT_CODE_SUPPORTED',
    'NO_LEXICAL_ONLY_INFERENCE',
    'NO_POLICY_ACTION_INFERENCE',
    'NO_NORMATIVE_FORCE_INFERENCE',
    'NO_RUNTIME_OR_EXECUTION_INFERENCE',
    'NO_OUTCOME_INFERENCE',
    'NO_TARGET_IDENTITY_INFERENCE',
    'NO_CURRENT_STATE_INFERENCE',
    'NO_COMPLETENESS_OR_INVERSE_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_LEDGER_REQUIRED',
      'semantic normalization authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INPUT',
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
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_CHECKS_INVALID',
        `unsupported semantic-normalization review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_INCOMPLETE',
          `accepted semantic-normalization review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function normalizeAuthorizationRefs(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_REQUIRED',
      'authorizationDecisionAuditRefs must be a non-empty array'
    );
  }
  const refs = values.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must be an exact authority ref`
      );
    }
    if (ref.kind !== 'AuthorizationDecisionAudit') {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_REQUIRED',
        `authorizationDecisionAuditRefs[${index}] must reference AuthorizationDecisionAudit`
      );
    }
    return ref;
  });
  if (new Set(refs.map(refKey)).size !== refs.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'DUPLICATE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUTHORIZATION',
      'authorizationDecisionAuditRefs cannot contain duplicates'
    );
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic-normalization reviewer'
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
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_INVALID',
        'review authorization ref must resolve to AuthorizationDecisionAudit'
      );
    }
    const decision = record.semanticPayload ?? {};
    if (decision.allowed !== true
      || decision.operation !== 'KNOWLEDGE_INSPECT'
      || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_INVALID',
        'every semantic-normalization authorization must allow KNOWLEDGE_INSPECT for the exact reviewer'
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
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUTHORIZATION_COVERAGE_INVALID',
        `exactly one reproducible reviewer authorization must cover source resource ${resourceId}`
      );
    }
    selected.push(matches[0]);
  }

  const selectedKeys = new Set(selected.map((record) => refKey(record.ref)));
  if (selectedKeys.size !== refs.length) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUTHORIZATION_SCOPE_EXCESS',
      'authorizationDecisionAuditRefs must contain exactly the authorizations needed by the reviewed source world'
    );
  }

  return deepFreeze(
    [...selected]
      .sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)))
  );
}

function validateNormalizationWorld({ ledger, sourceRegistry, normalization }) {
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalization(normalization);

  const parent =
    validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: normalized.parentOccurrenceCompilationRef
    });

  const parentOccurrence = parent.semanticPayload.occurrence;
  const parentCode =
    parentOccurrence.occurrenceSemantics.sourceOperationCode;
  const parentSourceRef = parentOccurrence.sourceRef;

  if (normalized.sourceCode.sourceOperationCode !== parentCode
    || normalized.applicability.appliesToSourceOperationCode !== parentCode) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_PARENT_CODE_MISMATCH',
      'sourceCode and applicability must exactly match the parent recorded occurrence sourceOperationCode'
    );
  }

  if (!sameAuthorityRef(
    normalized.applicability.appliesToOccurrenceSourceRef,
    parentSourceRef
  )) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_PARENT_SOURCE_MISMATCH',
      'applicability must bind the exact parent recorded-occurrence Source'
    );
  }

  const replayed =
    replayAgronomicRecordedOperationSemanticNormalizationEvidence({
      sourceRegistry,
      normalization: normalized
    });

  for (const evidence of replayed) {
    if (evidence.artifact.semanticPayload?.rightsSnapshot === undefined) {
      throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_RIGHTS_SNAPSHOT_REQUIRED',
        'every semantic-normalization evidence SourceArtifact requires an exact rightsSnapshot'
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

export function publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  normalization,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_DISPOSITION',
      'unsupported semantic-normalization review disposition'
    );
  }

  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateNormalizationWorld({
    ledger,
    sourceRegistry,
    normalization
  });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);

  const normalizationHash =
    agronomicRecordedOperationSemanticNormalizationHash(world.normalized);
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
    kind: 'AgronomicRecordedOperationSemanticNormalizationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORITY',
      normalization: cloneCanonicalValue(world.normalized),
      normalizationHash,
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
      action:
        'REVIEW_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
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
        normalizationHash,
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
      !== 'AgronomicRecordedOperationSemanticNormalizationReviewDecision') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationSemanticNormalizationReviewDecision'
    );
  }

  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_INVALID',
      'semantic-normalization review has invalid authorityClass'
    );
  }
  if (payload.disposition
      !== 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_REJECTED',
      'only ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const normalization = normalizedCompilation.normalization;
  const normalizationHash =
    agronomicRecordedOperationSemanticNormalizationHash(normalization);
  if (payload.normalizationHash !== normalizationHash
    || !sameAuthorityRef(
      payload.parentOccurrenceCompilationRef,
      normalization.parentOccurrenceCompilationRef
    )) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_MISMATCH',
      'semantic review must bind the exact normalization and parent occurrence'
    );
  }

  const world = validateNormalizationWorld({
    ledger,
    sourceRegistry,
    normalization
  });

  const expectedBindings = world.replayed.map((evidence) => ({
    evidenceRole: evidence.evidenceRole,
    sourceRef: evidence.source.ref,
    sourceArtifactRef: evidence.artifact.ref,
    locator: evidence.locator,
    evidenceHash: evidence.evidenceHash
  }));
  if (JSON.stringify(payload.evidenceBindings)
      !== JSON.stringify(expectedBindings)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_EVIDENCE_MISMATCH',
      'semantic review evidenceBindings must match exact replayed evidence'
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
        === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(
          event.inputRefs,
          normalization.parentOccurrenceCompilationRef
        )
        && world.replayed.every((evidence) =>
          exactRefIn(event.inputRefs, evidence.source.ref)
            && exactRefIn(event.inputRefs, evidence.artifact.ref)
        )
        && authorizations.every((record) =>
          exactRefIn(event.inputRefs, record.ref)
        )
        && event.details?.normalizationHash === normalizationHash
        && event.details?.disposition === payload.disposition
        && JSON.stringify(event.details?.evidenceBindings)
          === JSON.stringify(expectedBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUDIT_INVALID',
      'semantic-normalization review lacks direct reviewer audit over exact parent and evidence set'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicRecordedOperationSemanticNormalizationCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
      compilation
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 semantic-normalization authority may be published only with COMPLETE targeted semantic coverage'
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
    agronomicRecordedOperationSemanticNormalizationCompilationAuthorityRefs(
      normalized
    );

  return ledger.publish({
    kind: 'AgronomicRecordedOperationSemanticNormalizationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action:
        'PUBLISH_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY',
        normalizationHash: normalized.normalizationHash,
        semanticReviewRef: review.review.ref,
        parentOccurrenceCompilationRef:
          normalized.normalization.parentOccurrenceCompilationRef,
        evidenceBindings: review.review.semanticPayload.evidenceBindings
      }
    }
  });
}

export function validateAgronomicRecordedOperationSemanticNormalizationCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind
      !== 'AgronomicRecordedOperationSemanticNormalizationCompilation') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationSemanticNormalizationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalizationCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 semantic-normalization authority must have COMPLETE targeted semantic coverage'
    );
  }

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.semanticReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicRecordedOperationSemanticNormalizationCompilationAuthorityRefs(
      normalized
    );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action
        === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION'
        && event.actor?.id === review.reviewer.principalId
        && event.actor?.type === review.reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.normalizationHash === normalized.normalizationHash
        && event.details?.semanticReviewRef
        && sameAuthorityRef(
          event.details.semanticReviewRef,
          review.review.ref
        )
        && event.details?.parentOccurrenceCompilationRef
        && sameAuthorityRef(
          event.details.parentOccurrenceCompilationRef,
          normalized.normalization.parentOccurrenceCompilationRef
        )
        && JSON.stringify(event.details?.evidenceBindings)
          === JSON.stringify(review.review.semanticPayload.evidenceBindings)
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_AUDIT_INVALID',
      'semantic-normalization compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: review.review,
    parentOccurrence: review.world.parent,
    replayedEvidence: review.world.replayed
  });
}
