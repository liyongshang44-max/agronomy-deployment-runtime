import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from './hardened-authority.mjs';
import {
  AgronomicSourceAuthorityRoutingCompilationError,
  agronomicSourceAuthorityRoutingCompilationAuthorityRefs,
  agronomicSourceAuthorityRoutingHash,
  normalizeAgronomicSourceAuthorityRouting,
  normalizeAgronomicSourceAuthorityRoutingCompilation
} from './source-routing-contract.mjs';

export const AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_SOURCE_AUTHORITY_ROUTING',
  'REJECT_SOURCE_AUTHORITY_ROUTING'
]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_DISPOSITIONS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.lineageFor !== 'function'
    || typeof ledger.exportSnapshot !== 'function') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_LEDGER',
      'AgronomicSourceAuthorityRouting authority requires a replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].map(refKey).sort();
  const b = [...right].map(refKey).sort();
  return a.every((value, index) => value === b[index]);
}

function uniqueRefs(refs) {
  const seen = new Map();
  for (const ref of refs) seen.set(refKey(ref), ref);
  return [...seen.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)));
}

function validateKnowledge({ ledger, knowledgeRef }) {
  try {
    if (knowledgeRef.kind === 'QualifiedKnowledge') {
      const validated = validateQualifiedKnowledgeAuthority({
        ledger,
        qualifiedKnowledgeRef: knowledgeRef,
        requiredUseTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
        allowHistorical: false
      });
      return {
        sources: [validated.source.ref],
        artifacts: [validated.claim.semanticPayload.sourceArtifactRef],
        claims: [validated.claim]
      };
    }
    if (knowledgeRef.kind === 'DerivedKnowledge') {
      const validated = validateDerivedKnowledgeAuthority({
        ledger,
        derivedKnowledgeRef: knowledgeRef,
        requiredUseTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
        allowHistorical: false
      });
      return {
        sources: validated.validatedInputs.map((input) => input.source.ref),
        artifacts: validated.validatedInputs.map((input) =>
          input.claim.semanticPayload.sourceArtifactRef),
        claims: validated.validatedInputs.map((input) => input.claim)
      };
    }
    throw new Error(`unsupported knowledge kind ${knowledgeRef.kind}`);
  } catch (error) {
    const cause = error?.code ?? error?.message ?? 'UNKNOWN_KNOWLEDGE_AUTHORITY_FAILURE';
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for AGRONOMIC_POLICY_INPUT: ${cause}`
    );
  }
}

function validateKnowledgeWorld({ ledger, knowledgeRefs }) {
  const validated = knowledgeRefs.map((knowledgeRef) =>
    validateKnowledge({ ledger, knowledgeRef }));
  return {
    sources: uniqueRefs(validated.flatMap((item) => item.sources)),
    artifacts: uniqueRefs(validated.flatMap((item) => item.artifacts)),
    claims: validated.flatMap((item) => item.claims)
  };
}

function assertArtifactWorld({ ledger, sourceRef, artifactRefs, world, role }) {
  if (world.sources.length !== 1 || !sameAuthorityRef(world.sources[0], sourceRef)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SOURCE_WORLD_MISMATCH',
      `${role} knowledge must close to exactly the declared Source authority`
    );
  }
  if (!sameRefSet(artifactRefs, world.artifacts)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_ARTIFACT_WORLD_MISMATCH',
      `${role} SourceArtifact refs must exactly equal active scientific predecessor artifacts`
    );
  }
  for (const artifactRef of artifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact'
      || !sameAuthorityRef(artifact.semanticPayload?.sourceRef, sourceRef)) {
      throw new AgronomicSourceAuthorityRoutingCompilationError(
        'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SOURCE_ARTIFACT_MISMATCH',
        `every ${role} SourceArtifact must bind the exact declared Source`
      );
    }
  }
}

function assertExpressionEvidence(claims, expression, role) {
  if (!claims.some((claim) =>
    typeof claim.semanticPayload?.assertion === 'string'
    && claim.semanticPayload.assertion.includes(expression))) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SOURCE_EXPRESSION_MISMATCH',
      `${role} source expression must occur in exact source-qualified Claim evidence`
    );
  }
}

function bindingFor(routing, role) {
  return routing.authorityBindings.find((binding) => binding.role === role);
}

function assertBindingClosure({
  routing,
  planningKnowledgeRefs,
  actualOperationRecordKnowledgeRefs
}) {
  const planning = bindingFor(routing, 'PLANNING_ROUTING_ASSERTION');
  const actual = bindingFor(routing, 'ACTUAL_OPERATION_RECORD_SOURCE_IDENTITY');
  if (!planningKnowledgeRefs.some((ref) => sameAuthorityRef(ref, planning.authorityRef))) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_PLANNING_BINDING_MISMATCH',
      'planning routing binding must reference one declared planning knowledge authority'
    );
  }
  if (!actualOperationRecordKnowledgeRefs.some((ref) =>
    sameAuthorityRef(ref, actual.authorityRef))) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_ACTUAL_BINDING_MISMATCH',
      'actual-operation record binding must reference one declared actual-record knowledge authority'
    );
  }
}

function assertNoWholeSourceSupersession({ ledger, planningSourceRef, actualSourceRef }) {
  const relevant = uniqueRefs([planningSourceRef, actualSourceRef])
    .flatMap((ref) => ledger.lineageFor(ref))
    .filter((lineage) => lineage.relation === 'supersedes')
    .filter((lineage) =>
      (sameAuthorityRef(lineage.from, planningSourceRef)
        && sameAuthorityRef(lineage.to, actualSourceRef))
      || (sameAuthorityRef(lineage.from, actualSourceRef)
        && sameAuthorityRef(lineage.to, planningSourceRef)));

  if (relevant.length !== 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_WHOLE_SOURCE_SUPERSESSION_FORBIDDEN',
      'scoped source-authority routing cannot rely on whole-source supersedes lineage'
    );
  }
}

function validateRoutingWorld({
  ledger,
  planningKnowledgeRefs,
  actualOperationRecordKnowledgeRefs,
  planningSourceArtifactRefs,
  actualOperationRecordSourceArtifactRefs,
  routing
}) {
  const planningSource = ledger.resolve(routing.planningSourceRef);
  const actualSource = ledger.resolve(routing.actualOperationRecordSourceRef);
  if (planningSource.ref.kind !== 'Source'
    || planningSource.semanticPayload?.sourceType !== 'PROTOCOL') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_PROTOCOL_SOURCE_REQUIRED',
      'planningSourceRef must resolve to a Source authority with sourceType PROTOCOL'
    );
  }
  if (actualSource.ref.kind !== 'Source') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_ACTUAL_SOURCE_REQUIRED',
      'actualOperationRecordSourceRef must resolve to Source authority'
    );
  }

  const planningWorld = validateKnowledgeWorld({
    ledger,
    knowledgeRefs: planningKnowledgeRefs
  });
  const actualWorld = validateKnowledgeWorld({
    ledger,
    knowledgeRefs: actualOperationRecordKnowledgeRefs
  });

  assertArtifactWorld({
    ledger,
    sourceRef: routing.planningSourceRef,
    artifactRefs: planningSourceArtifactRefs,
    world: planningWorld,
    role: 'planning'
  });
  assertArtifactWorld({
    ledger,
    sourceRef: routing.actualOperationRecordSourceRef,
    artifactRefs: actualOperationRecordSourceArtifactRefs,
    world: actualWorld,
    role: 'actual-operation record'
  });

  assertExpressionEvidence(
    planningWorld.claims,
    routing.sourceExpression,
    'planning routing'
  );
  assertExpressionEvidence(
    actualWorld.claims,
    routing.actualOperationRecordSourceExpression,
    'actual-operation record identity'
  );

  if (!routing.sourceExpression.includes(String(routing.temporalScope.year))) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_TEMPORAL_SOURCE_MISMATCH',
      'calendar-year routing scope must be explicitly present in the planning routing source expression'
    );
  }

  assertBindingClosure({
    routing,
    planningKnowledgeRefs,
    actualOperationRecordKnowledgeRefs
  });

  assertNoWholeSourceSupersession({
    ledger,
    planningSourceRef: routing.planningSourceRef,
    actualSourceRef: routing.actualOperationRecordSourceRef
  });

  return { planningSource, actualSource, planningWorld, actualWorld };
}

function resolveAuthorizationForSource({ ledger, authRef, reviewerPrincipal, source }) {
  const auth = ledger.resolve(authRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_REQUIRED',
      'semantic source-authority-routing review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true
    || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_INVALID',
      'semantic review requires allowed KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_INVALID',
      'semantic review policy must bind the exact Source review resource'
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
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_INVALID',
      'semantic source-authority-routing review authorization cannot be reproduced'
    );
  }
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEWER_PERMISSION_DENIED',
      'semantic reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT authority'
    );
  }
  return auth;
}

function validateAuthorizationSet({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  sourceRefs
}) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length !== sourceRefs.length) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review requires exactly one source-scoped authorization per exact Source'
    );
  }

  const audits = [];
  for (const sourceRef of sourceRefs) {
    const source = ledger.resolve(sourceRef);
    const match = authorizationDecisionAuditRefs
      .map((ref) => ledger.resolve(ref))
      .find((record) => {
        if (record.ref.kind !== 'AuthorizationDecisionAudit') return false;
        const policy = ledger.resolve(record.semanticPayload?.policyRef);
        return policy.ref.kind === 'KnowledgeGovernancePolicy'
          && policy.semanticPayload?.resourceId === sourceReviewResourceId(source.ref);
      });
    if (!match) {
      throw new AgronomicSourceAuthorityRoutingCompilationError(
        'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_SET_INVALID',
        'semantic review is missing exact Source-scoped authorization'
      );
    }
    audits.push(resolveAuthorizationForSource({
      ledger,
      authRef: match.ref,
      reviewerPrincipal,
      source
    }));
  }

  if (new Set(audits.map((item) => refKey(item.ref))).size !== audits.length) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review authorization set contains duplicate exact decisions'
    );
  }
  return audits;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic review principal'
    );
  }
}

export function publishAgronomicSourceAuthorityRoutingReviewDecision({
  ledger,
  logicalId,
  version,
  planningKnowledgeRefs,
  actualOperationRecordKnowledgeRefs,
  planningSourceArtifactRefs,
  actualOperationRecordSourceArtifactRefs,
  routing,
  disposition,
  reasonCodes = [],
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  rationale,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicSourceAuthorityRouting(routing);
  const normalizedDisposition = text(disposition, 'disposition');
  if (!REVIEW_DISPOSITIONS.has(normalizedDisposition)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_DISPOSITION',
      `unsupported semantic review disposition ${normalizedDisposition}`
    );
  }

  const world = validateRoutingWorld({
    ledger,
    planningKnowledgeRefs,
    actualOperationRecordKnowledgeRefs,
    planningSourceArtifactRefs,
    actualOperationRecordSourceArtifactRefs,
    routing: normalized
  });

  const sourceRefs = [normalized.planningSourceRef, normalized.actualOperationRecordSourceRef];
  const authAudits = validateAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal,
    sourceRefs
  });
  assertAuditActor(audit, reviewerPrincipal);

  if (!Array.isArray(reasonCodes)) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'INVALID_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_REASON',
      'reasonCodes must be an array'
    );
  }
  const normalizedReasons = [...new Set(reasonCodes.map((value) =>
    text(value, 'reasonCode')))].sort();
  if (normalizedDisposition === 'REJECT_SOURCE_AUTHORITY_ROUTING'
    && normalizedReasons.length === 0) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REJECTION_REASON_REQUIRED',
      'rejected source-authority-routing review requires at least one reason code'
    );
  }

  const routingHash = agronomicSourceAuthorityRoutingHash(normalized);

  return ledger.publish({
    kind: 'AgronomicSourceAuthorityRoutingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SEMANTIC_REVIEW',
      planningKnowledgeRefs: [...planningKnowledgeRefs],
      actualOperationRecordKnowledgeRefs: [...actualOperationRecordKnowledgeRefs],
      planningSourceArtifactRefs: [...planningSourceArtifactRefs],
      actualOperationRecordSourceArtifactRefs: [...actualOperationRecordSourceArtifactRefs],
      planningSourceRef: world.planningSource.ref,
      actualOperationRecordSourceRef: world.actualSource.ref,
      routing: cloneCanonicalValue(normalized),
      routingHash,
      disposition: normalizedDisposition,
      reasonCodes: normalizedReasons,
      reviewerPrincipal: cloneCanonicalValue(reviewerPrincipal),
      authorizationDecisionAuditRefs: authAudits.map((item) => item.ref),
      ...(rationale ? { rationale: text(rationale, 'rationale') } : {})
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_SOURCE_AUTHORITY_ROUTING',
      inputRefs: [
        ...planningKnowledgeRefs,
        ...actualOperationRecordKnowledgeRefs,
        ...planningSourceArtifactRefs,
        ...actualOperationRecordSourceArtifactRefs,
        ...sourceRefs,
        ...authAudits.map((item) => item.ref),
        ...(audit.inputRefs ?? [])
      ],
      details: {
        ...(audit.details ?? {}),
        disposition: normalizedDisposition,
        routingHash,
        subjectScope: normalized.subjectScope,
        temporalScope: normalized.temporalScope
      }
    }
  });
}

function validateReview({ ledger, reviewRef, normalized }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicSourceAuthorityRoutingReviewDecision'
    || review.semanticPayload?.authorityClass
      !== 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SEMANTIC_REVIEW') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SEMANTIC_REVIEW_REQUIRED',
      'compilation requires exact AgronomicSourceAuthorityRoutingReviewDecision authority'
    );
  }

  const payload = review.semanticPayload;
  if (payload.disposition !== 'ACCEPT_SOURCE_AUTHORITY_ROUTING') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_REJECTED',
      'only ACCEPT_SOURCE_AUTHORITY_ROUTING semantic review can authorize publication'
    );
  }

  if (payload.routingHash !== normalized.routingHash
    || agronomicSourceAuthorityRoutingHash(payload.routing) !== normalized.routingHash
    || !sameRefSet(payload.planningKnowledgeRefs, normalized.planningKnowledgeRefs)
    || !sameRefSet(
      payload.actualOperationRecordKnowledgeRefs,
      normalized.actualOperationRecordKnowledgeRefs
    )
    || !sameRefSet(payload.planningSourceArtifactRefs, normalized.planningSourceArtifactRefs)
    || !sameRefSet(
      payload.actualOperationRecordSourceArtifactRefs,
      normalized.actualOperationRecordSourceArtifactRefs
    )
    || !sameAuthorityRef(payload.planningSourceRef, normalized.routing.planningSourceRef)
    || !sameAuthorityRef(
      payload.actualOperationRecordSourceRef,
      normalized.routing.actualOperationRecordSourceRef
    )) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_MISMATCH',
      'semantic review must bind the exact routing and both exact source worlds'
    );
  }

  const authAudits = validateAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: payload.reviewerPrincipal,
    sourceRefs: [payload.planningSourceRef, payload.actualOperationRecordSourceRef]
  });

  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action === 'REVIEW_AGRONOMIC_SOURCE_AUTHORITY_ROUTING'
        && event.actor?.id === payload.reviewerPrincipal?.principalId
        && event.actor?.type === payload.reviewerPrincipal?.type
        && payload.planningKnowledgeRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.actualOperationRecordKnowledgeRefs.every((ref) =>
          exactRefIn(event.inputRefs, ref))
        && payload.planningSourceArtifactRefs.every((ref) =>
          exactRefIn(event.inputRefs, ref))
        && payload.actualOperationRecordSourceArtifactRefs.every((ref) =>
          exactRefIn(event.inputRefs, ref))
        && exactRefIn(event.inputRefs, payload.planningSourceRef)
        && exactRefIn(event.inputRefs, payload.actualOperationRecordSourceRef)
        && authAudits.every((item) => exactRefIn(event.inputRefs, item.ref)));

  if (!directAudit) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_AUDIT_INVALID',
      'source-authority-routing review lacks direct reviewer audit over exact source worlds'
    );
  }

  return review;
}

function validateCompilationWorld(ledger, normalized) {
  for (const ref of agronomicSourceAuthorityRoutingCompilationAuthorityRefs(normalized)) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicSourceAuthorityRoutingCompilationError(
        'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REF_MISMATCH',
        'every source-authority-routing predecessor must resolve to its exact authority ref'
      );
    }
  }

  const world = validateRoutingWorld({
    ledger,
    planningKnowledgeRefs: normalized.planningKnowledgeRefs,
    actualOperationRecordKnowledgeRefs: normalized.actualOperationRecordKnowledgeRefs,
    planningSourceArtifactRefs: normalized.planningSourceArtifactRefs,
    actualOperationRecordSourceArtifactRefs:
      normalized.actualOperationRecordSourceArtifactRefs,
    routing: normalized.routing
  });

  const review = validateReview({
    ledger,
    reviewRef: normalized.semanticReviewRef,
    normalized
  });

  return { ...world, review };
}

export function publishAgronomicSourceAuthorityRoutingCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicSourceAuthorityRoutingCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 source-authority-routing authority may be published only with COMPLETE local coverage'
    );
  }

  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  assertAuditActor(audit, reviewer);
  const refs = agronomicSourceAuthorityRoutingCompilationAuthorityRefs(normalized);

  return ledger.publish({
    kind: 'AgronomicSourceAuthorityRoutingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION',
      inputRefs: [...refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass: 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
        routingHash: normalized.routingHash,
        semanticReviewRef: world.review.ref,
        planningSourceRef: world.planningSource.ref,
        actualOperationRecordSourceRef: world.actualSource.ref,
        subjectScope: normalized.routing.subjectScope,
        temporalScope: normalized.routing.temporalScope
      }
    }
  });
}

export function validateAgronomicSourceAuthorityRoutingCompilationAuthority({
  ledger,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicSourceAuthorityRoutingCompilation') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_REQUIRED',
      `expected AgronomicSourceAuthorityRoutingCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicSourceAuthorityRoutingCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 source-authority-routing authority must have COMPLETE local coverage'
    );
  }

  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  const refs = agronomicSourceAuthorityRoutingCompilationAuthorityRefs(normalized);

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, world.review.ref)
        && event.details?.planningSourceRef
        && sameAuthorityRef(event.details.planningSourceRef, world.planningSource.ref)
        && event.details?.actualOperationRecordSourceRef
        && sameAuthorityRef(
          event.details.actualOperationRecordSourceRef,
          world.actualSource.ref
        ));

  if (!directAudit) {
    throw new AgronomicSourceAuthorityRoutingCompilationError(
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_AUDIT_INVALID',
      'source-authority-routing compilation lacks direct reviewer audit over exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review,
    planningSource: world.planningSource,
    actualOperationRecordSource: world.actualSource
  });
}
