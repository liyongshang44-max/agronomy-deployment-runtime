import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  AgronomicRecordedOperationOccurrenceCompilationError,
  agronomicRecordedOperationOccurrenceCompilationAuthorityRefs,
  agronomicRecordedOperationOccurrenceHash,
  normalizeAgronomicRecordedOperationOccurrence,
  normalizeAgronomicRecordedOperationOccurrenceCompilation
} from './recorded-occurrence-contract.mjs';
import {
  AgronomicRecordedOperationEvidenceError,
  replayAgronomicRecordedOperationEvidence
} from './recorded-occurrence-evidence.mjs';
import { validateAgronomicSourceAuthorityRoutingCompilationAuthority } from './source-routing-authority.mjs';

export const AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
  'REJECT_RECORDED_OPERATION_OCCURRENCE'
]);

export const AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS = deepFreeze([
  'EXACT_EVENT_LEVEL_EVIDENCE_VERIFIED',
  'ACTUAL_OPERATION_RECORD_SEMANTICS_VERIFIED',
  'SOURCE_OPERATION_CODE_PRESERVED',
  'SOURCE_NATIVE_SUBJECT_PRESERVED',
  'TEMPORAL_PRECISION_PRESERVED',
  'NORMALIZATION_NOT_OVERSTATED',
  'NO_NORMATIVE_FORCE_INFERENCE',
  'NO_ADR_EXECUTION_IDENTITY_INFERENCE',
  'NO_NONOCCURRENCE_INFERENCE',
  'NO_OUTCOME_OR_CAUSAL_AUTHORITY',
  'STRUCTURED_ROW_REPLAY_VERIFIED',
  'RIGHTS_SNAPSHOT_REVIEWED'
]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_LEDGER_REQUIRED',
      'recorded-operation occurrence authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INPUT',
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
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  const a = [...left].map(refKey).sort();
  const b = [...right].map(refKey).sort();
  return a.every((value, index) => value === b[index]);
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEWER_REQUIRED',
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
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const normalized = values.map((value, index) =>
    text(value, `confirmedChecks[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const value of normalized) {
    if (!REQUIRED_CHECKS.has(value)) {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_CHECKS_INVALID',
        `unsupported recorded-occurrence review check ${value}`
      );
    }
  }
  if (disposition === 'ACCEPT_RECORDED_OPERATION_OCCURRENCE') {
    for (const required of REQUIRED_CHECKS) {
      if (!normalized.includes(required)) {
        throw new AgronomicRecordedOperationOccurrenceCompilationError(
          'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_INCOMPLETE',
          `accepted semantic review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...normalized].sort());
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact recorded-occurrence reviewer'
    );
  }
}

function resolveAuthorizationForSource({
  ledger,
  authorizationDecisionAuditRef,
  reviewerPrincipal,
  source
}) {
  const auth = ledger.resolve(authorizationDecisionAuditRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_AUTHORIZATION_REQUIRED',
      'recorded-occurrence review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true
    || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_AUTHORIZATION_INVALID',
      'recorded-occurrence review requires allowed KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }

  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_AUTHORIZATION_INVALID',
      'review policy must bind the exact Source review resource'
    );
  }

  const assignments = (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
  const recomputed = authorizeKnowledgeInspection({
    principal: reviewerPrincipal,
    policy,
    roleAssignments: assignments,
    authorizationScope: decision.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== decision.decisionHash) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_AUTHORIZATION_INVALID',
      'recorded-occurrence review authorization cannot be reproduced'
    );
  }

  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEWER_PERMISSION_DENIED',
      'reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT authority'
    );
  }
  return auth;
}

function validateSourceWorld({ ledger, sourceRegistry, occurrence }) {
  const normalized = normalizeAgronomicRecordedOperationOccurrence(occurrence);
  const source = ledger.resolve(normalized.sourceRef);
  if (source.ref.kind !== 'Source' || !sameAuthorityRef(source.ref, normalized.sourceRef)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SOURCE_INVALID',
      'occurrence sourceRef must resolve to the exact Source authority'
    );
  }

  let replay;
  try {
    replay = replayAgronomicRecordedOperationEvidence({
      sourceRegistry,
      occurrence: normalized
    });
  } catch (error) {
    if (error instanceof AgronomicRecordedOperationEvidenceError) {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_EVIDENCE_INVALID',
        error.message
      );
    }
    throw error;
  }

  if (!sameAuthorityRef(replay.source.ref, source.ref)
    || !sameAuthorityRef(replay.artifact.ref, normalized.sourceArtifactRef)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SOURCE_WORLD_MISMATCH',
      'replayed Source/SourceArtifact world does not match the exact occurrence'
    );
  }

  if (replay.artifact.semanticPayload?.rightsSnapshot === undefined) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_RIGHTS_SNAPSHOT_REQUIRED',
      'recorded-occurrence publication requires an exact SourceArtifact rightsSnapshot'
    );
  }

  return { normalized, source, ...replay };
}

function validateRoutingAuthorities({ ledger, sourceRoleAuthorityRefs, occurrenceSourceRef }) {
  const validated = [];
  for (const ref of sourceRoleAuthorityRefs) {
    const authority = validateAgronomicSourceAuthorityRoutingCompilationAuthority({
      ledger,
      compilationRef: ref
    });
    if (!sameAuthorityRef(
      authority.semanticPayload.routing.actualOperationRecordSourceRef,
      occurrenceSourceRef
    )) {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SOURCE_ROLE_MISMATCH',
        'source-role authority must designate the exact occurrence Source as actual-operation record source'
      );
    }
    if (authority.semanticPayload.routing.subjectScope !== 'FIELD_OPERATION_OCCURRENCE') {
      throw new AgronomicRecordedOperationOccurrenceCompilationError(
        'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SOURCE_ROLE_MISMATCH',
        'source-role authority must be scoped to FIELD_OPERATION_OCCURRENCE'
      );
    }
    validated.push(authority);
  }
  return validated;
}

export function publishAgronomicRecordedOperationOccurrenceReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  occurrence,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRef,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'INVALID_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_DISPOSITION',
      'unsupported recorded-operation occurrence review disposition'
    );
  }
  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateSourceWorld({ ledger, sourceRegistry, occurrence });
  const authorization = resolveAuthorizationForSource({
    ledger,
    authorizationDecisionAuditRef,
    reviewerPrincipal: reviewer,
    source: world.source
  });
  assertAuditActor(audit, reviewer);

  const occurrenceHash = agronomicRecordedOperationOccurrenceHash(world.normalized);
  return ledger.publish({
    kind: 'AgronomicRecordedOperationOccurrenceReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SEMANTIC_REVIEW_AUTHORITY',
      occurrence: cloneCanonicalValue(world.normalized),
      occurrenceHash,
      sourceRef: world.source.ref,
      sourceArtifactRef: world.artifact.ref,
      evidenceHash: world.evidenceHash,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRef: authorization.ref,
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE',
      inputRefs: [
        world.source.ref,
        world.artifact.ref,
        authorization.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        occurrenceHash,
        evidenceHash: world.evidenceHash,
        disposition,
        confirmedChecks: checks
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
  if (review.ref.kind !== 'AgronomicRecordedOperationOccurrenceReviewDecision') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_REQUIRED',
      'publication requires AgronomicRecordedOperationOccurrenceReviewDecision'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass
      !== 'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SEMANTIC_REVIEW_AUTHORITY') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_INVALID',
      'review record has invalid authorityClass'
    );
  }
  if (payload.disposition !== 'ACCEPT_RECORDED_OPERATION_OCCURRENCE') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_REJECTED',
      'only ACCEPT_RECORDED_OPERATION_OCCURRENCE can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);

  const occurrenceHash =
    agronomicRecordedOperationOccurrenceHash(normalizedCompilation.occurrence);
  if (payload.occurrenceHash !== occurrenceHash
    || payload.evidenceHash !== normalizedCompilation.occurrence.sourceLocator.evidenceHash
    || !sameAuthorityRef(payload.sourceRef, normalizedCompilation.occurrence.sourceRef)
    || !sameAuthorityRef(
      payload.sourceArtifactRef,
      normalizedCompilation.occurrence.sourceArtifactRef
    )) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_MISMATCH',
      'semantic review must bind the exact occurrence, evidence and source world'
    );
  }

  const world = validateSourceWorld({
    ledger,
    sourceRegistry,
    occurrence: normalizedCompilation.occurrence
  });
  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const authorization = resolveAuthorizationForSource({
    ledger,
    authorizationDecisionAuditRef: payload.authorizationDecisionAuditRef,
    reviewerPrincipal: reviewer,
    source: world.source
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action === 'REVIEW_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && exactRefIn(event.inputRefs, world.source.ref)
        && exactRefIn(event.inputRefs, world.artifact.ref)
        && exactRefIn(event.inputRefs, authorization.ref)
        && event.details?.occurrenceHash === occurrenceHash
        && event.details?.evidenceHash === world.evidenceHash
        && event.details?.disposition === payload.disposition
    );
  if (!directAudit) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_AUDIT_INVALID',
      'recorded-occurrence review lacks direct reviewer audit over exact source evidence'
    );
  }

  return { review, reviewer, authorization, world };
}

function validateCompilationWorld({ ledger, sourceRegistry, normalized }) {
  if (normalized.sourceArtifactRefs.length !== 1
      || !sameAuthorityRef(
        normalized.sourceArtifactRefs[0],
        normalized.occurrence.sourceArtifactRef
      )) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_V1_EXACT_ARTIFACT_REQUIRED',
      'v1 occurrence compilation must bind exactly one exact event SourceArtifact'
    );
  }

  const world = validateSourceWorld({
    ledger,
    sourceRegistry,
    occurrence: normalized.occurrence
  });

  const routingAuthorities = validateRoutingAuthorities({
    ledger,
    sourceRoleAuthorityRefs: normalized.sourceRoleAuthorityRefs,
    occurrenceSourceRef: normalized.occurrence.sourceRef
  });

  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.semanticReviewRef,
    normalizedCompilation: normalized
  });

  if (!sameAuthorityRef(review.world.source.ref, world.source.ref)
    || !sameAuthorityRef(review.world.artifact.ref, world.artifact.ref)
    || review.world.evidenceHash !== world.evidenceHash) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_WORLD_MISMATCH',
      'review replay and publication replay must close to the same exact source world'
    );
  }

  return { ...world, routingAuthorities, review };
}

export function publishAgronomicRecordedOperationOccurrenceCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicRecordedOperationOccurrenceCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 occurrence authority may be published only with COMPLETE local occurrence coverage'
    );
  }

  const world = validateCompilationWorld({ ledger, sourceRegistry, normalized });
  assertAuditActor(audit, world.review.reviewer);
  const refs = agronomicRecordedOperationOccurrenceCompilationAuthorityRefs(normalized);

  return ledger.publish({
    kind: 'AgronomicRecordedOperationOccurrenceCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
        occurrenceHash: normalized.occurrenceHash,
        evidenceHash: world.evidenceHash,
        semanticReviewRef: world.review.review.ref,
        sourceRef: world.source.ref,
        sourceArtifactRef: world.artifact.ref,
        sourceRoleAuthorityRefs: normalized.sourceRoleAuthorityRefs
      }
    }
  });
}

export function validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicRecordedOperationOccurrenceCompilation') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_REQUIRED',
      `expected AgronomicRecordedOperationOccurrenceCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicRecordedOperationOccurrenceCompilation(
    record.semanticPayload
  );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 occurrence authority must have COMPLETE local occurrence coverage'
    );
  }

  const world = validateCompilationWorld({ ledger, sourceRegistry, normalized });
  const reviewer = world.review.reviewer;
  const refs = agronomicRecordedOperationOccurrenceCompilationAuthorityRefs(normalized);

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.occurrenceHash === normalized.occurrenceHash
        && event.details?.evidenceHash === world.evidenceHash
        && event.details?.semanticReviewRef
        && sameAuthorityRef(
          event.details.semanticReviewRef,
          world.review.review.ref
        )
        && event.details?.sourceRef
        && sameAuthorityRef(event.details.sourceRef, world.source.ref)
        && event.details?.sourceArtifactRef
        && sameAuthorityRef(event.details.sourceArtifactRef, world.artifact.ref)
        && sameRefSet(
          event.details?.sourceRoleAuthorityRefs ?? [],
          normalized.sourceRoleAuthorityRefs
        )
    );

  if (!directAudit) {
    throw new AgronomicRecordedOperationOccurrenceCompilationError(
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_AUDIT_INVALID',
      'recorded-occurrence compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review.review,
    source: world.source,
    sourceArtifact: world.artifact,
    replayedEvidence: world.evidence,
    sourceRoleAuthorities: world.routingAuthorities
  });
}
