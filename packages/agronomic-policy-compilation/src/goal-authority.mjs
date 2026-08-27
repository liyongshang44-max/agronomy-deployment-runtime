import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
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
  AgronomicGoalConditionCompilationError,
  agronomicGoalConditionCompilationAuthorityRefs,
  agronomicGoalConditionHash,
  normalizeAgronomicGoalCondition,
  normalizeAgronomicGoalConditionCompilation
} from './goal-contract.mjs';

export const AGRONOMIC_GOAL_CONDITION_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_GOAL_CONDITION',
  'REJECT_GOAL_CONDITION'
]);

const REVIEW_DISPOSITIONS = new Set(AGRONOMIC_GOAL_CONDITION_REVIEW_DISPOSITIONS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.exportSnapshot !== 'function') {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_LEDGER',
      'AgronomicGoalCondition authority requires a replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_INPUT', `${name} must be a non-empty string`);
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
        kind: 'QUALIFIED',
        validated,
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
        kind: 'DERIVED',
        validated,
        sources: validated.validatedInputs.map((input) => input.source.ref),
        artifacts: validated.validatedInputs.map((input) => input.claim.semanticPayload.sourceArtifactRef),
        claims: validated.validatedInputs.map((input) => input.claim)
      };
    }
    throw new Error(`unsupported knowledge kind ${knowledgeRef.kind}`);
  } catch (error) {
    const cause = error?.code ?? error?.message ?? 'UNKNOWN_KNOWLEDGE_AUTHORITY_FAILURE';
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for AGRONOMIC_POLICY_INPUT: ${cause}`
    );
  }
}

function validateKnowledgeWorld({ ledger, knowledgeRefs }) {
  const validations = knowledgeRefs.map((knowledgeRef) => validateKnowledge({ ledger, knowledgeRef }));
  return {
    validations,
    sources: uniqueRefs(validations.flatMap((item) => item.sources)),
    artifacts: uniqueRefs(validations.flatMap((item) => item.artifacts)),
    claims: validations.flatMap((item) => item.claims)
  };
}

function assertProtocolWorld({ ledger, sourceRefs, artifactRefs, expectedSources, expectedArtifacts }) {
  for (const sourceRef of sourceRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.ref.kind !== 'Source' || source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }
  for (const artifactRef of artifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    if (!sourceRefs.some((sourceRef) => sameAuthorityRef(sourceRef, artifact.semanticPayload?.sourceRef))) {
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
  }
  if (!sameRefSet(sourceRefs, expectedSources) || !sameRefSet(artifactRefs, expectedArtifacts)) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_SCIENTIFIC_PREDECESSOR_MISMATCH',
      'Source/SourceArtifact sets must exactly equal the active scientific predecessors of knowledgeRefs'
    );
  }
}

function assertKnowledgeBindings(goalCondition, knowledgeRefs) {
  const declared = new Set(knowledgeRefs.map(refKey));
  for (const binding of goalCondition.authorityBindings) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_AUTHORITY_NOT_DECLARED',
        `goal-condition authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertSourceExpressionEvidence(goalCondition, world) {
  const supportingClaims = world.claims.filter((claim) => {
    const assertion = claim.semanticPayload?.assertion;
    if (typeof assertion !== 'string') return false;
    return assertion.includes(goalCondition.sourceExpression)
      && assertion.includes(goalCondition.goalObjectExpression);
  });
  if (supportingClaims.length === 0) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_SOURCE_EXPRESSION_MISMATCH',
      'sourceExpression and goalObjectExpression must occur in at least one exact source-qualified Claim predecessor'
    );
  }
}

function resolveAuthorizationForSource({ ledger, authRef, reviewerPrincipal, source }) {
  const auth = ledger.resolve(authRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_REQUIRED',
      'semantic goal-condition review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_INVALID',
      'semantic goal-condition review requires an allowed KNOWLEDGE_INSPECT decision for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_INVALID',
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
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_INVALID',
      'semantic goal-condition review authorization cannot be reproduced'
    );
  }
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEWER_PERMISSION_DENIED',
      'semantic reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT authority'
    );
  }
  return auth;
}

function validateReviewAuthorizationSet({ ledger, authorizationDecisionAuditRefs, reviewerPrincipal, sourceRefs }) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length !== sourceRefs.length) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_SET_INVALID',
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
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_SET_INVALID',
        'semantic review is missing exact Source-scoped authorization'
      );
    }
    audits.push(resolveAuthorizationForSource({ ledger, authRef: match.ref, reviewerPrincipal, source }));
  }
  if (new Set(audits.map((item) => refKey(item.ref))).size !== audits.length) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review authorization set contains duplicates'
    );
  }
  return audits;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor || audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic review principal'
    );
  }
}

export function publishAgronomicGoalConditionReviewDecision({
  ledger,
  logicalId,
  version,
  knowledgeRefs,
  goalCondition,
  disposition,
  reasonCodes = [],
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  rationale,
  audit
}) {
  requireLedger(ledger);
  const normalizedGoalCondition = normalizeAgronomicGoalCondition(goalCondition);
  const normalizedDisposition = text(disposition, 'disposition');
  if (!REVIEW_DISPOSITIONS.has(normalizedDisposition)) {
    throw new AgronomicGoalConditionCompilationError(
      'INVALID_AGRONOMIC_GOAL_CONDITION_REVIEW_DISPOSITION',
      `unsupported semantic review disposition ${normalizedDisposition}`
    );
  }
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.length === 0) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_KNOWLEDGE_REQUIRED',
      'semantic review requires non-empty knowledgeRefs'
    );
  }
  const normalizedKnowledgeRefs = uniqueRefs(knowledgeRefs);
  if (normalizedKnowledgeRefs.length !== knowledgeRefs.length) {
    throw new AgronomicGoalConditionCompilationError(
      'DUPLICATE_AGRONOMIC_GOAL_CONDITION_AUTHORITY_REF',
      'semantic review knowledgeRefs cannot contain duplicate exact refs'
    );
  }
  const world = validateKnowledgeWorld({ ledger, knowledgeRefs: normalizedKnowledgeRefs });
  assertKnowledgeBindings(normalizedGoalCondition, normalizedKnowledgeRefs);
  assertSourceExpressionEvidence(normalizedGoalCondition, world);
  const authAudits = validateReviewAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal,
    sourceRefs: world.sources
  });
  assertAuditActor(audit, reviewerPrincipal);
  if (!Array.isArray(reasonCodes)) {
    throw new AgronomicGoalConditionCompilationError('INVALID_AGRONOMIC_GOAL_CONDITION_REVIEW_REASON', 'reasonCodes must be an array');
  }
  const normalizedReasons = [...new Set(reasonCodes.map((value) => text(value, 'reasonCode')))].sort();
  if (normalizedDisposition === 'REJECT_GOAL_CONDITION' && normalizedReasons.length === 0) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REJECTION_REASON_REQUIRED',
      'rejected goal-condition review requires at least one reason code'
    );
  }
  const goalConditionHash = agronomicGoalConditionHash(normalizedGoalCondition);
  return ledger.publish({
    kind: 'AgronomicGoalConditionReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_GOAL_CONDITION_SEMANTIC_REVIEW',
      knowledgeRefs: normalizedKnowledgeRefs,
      sourceRefs: world.sources,
      sourceArtifactRefs: world.artifacts,
      goalCondition: cloneCanonicalValue(normalizedGoalCondition),
      goalConditionHash,
      disposition: normalizedDisposition,
      reasonCodes: normalizedReasons,
      reviewerPrincipal: cloneCanonicalValue(reviewerPrincipal),
      authorizationDecisionAuditRefs: authAudits.map((item) => item.ref),
      ...(rationale ? { rationale: text(rationale, 'rationale') } : {})
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_GOAL_CONDITION',
      inputRefs: [
        ...normalizedKnowledgeRefs,
        ...world.sources,
        ...world.artifacts,
        ...authAudits.map((item) => item.ref),
        ...(audit.inputRefs ?? [])
      ],
      details: { ...(audit.details ?? {}), disposition: normalizedDisposition, goalConditionHash }
    }
  });
}

function validateReview({ ledger, reviewRef, normalized }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicGoalConditionReviewDecision'
    || review.semanticPayload?.authorityClass !== 'AGRONOMIC_GOAL_CONDITION_SEMANTIC_REVIEW') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_SEMANTIC_REVIEW_REQUIRED',
      'compilation requires exact AgronomicGoalConditionReviewDecision authority'
    );
  }
  const payload = review.semanticPayload;
  if (payload.disposition !== 'ACCEPT_GOAL_CONDITION') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_REJECTED',
      'only ACCEPT_GOAL_CONDITION semantic review can authorize publication'
    );
  }
  if (payload.goalConditionHash !== normalized.goalConditionHash
    || semanticHash('AgronomicGoalCondition', payload.goalCondition) !== normalized.goalConditionHash
    || !sameRefSet(payload.knowledgeRefs, normalized.knowledgeRefs)
    || !sameRefSet(payload.sourceRefs, normalized.sourceProtocolRefs)
    || !sameRefSet(payload.sourceArtifactRefs, normalized.sourceProtocolArtifactRefs)) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_MISMATCH',
      'semantic review must bind the exact goal condition and scientific predecessor closure'
    );
  }
  const authAudits = validateReviewAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: payload.reviewerPrincipal,
    sourceRefs: payload.sourceRefs
  });
  const directReviewAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action === 'REVIEW_AGRONOMIC_GOAL_CONDITION'
        && event.actor?.id === payload.reviewerPrincipal?.principalId
        && event.actor?.type === payload.reviewerPrincipal?.type
        && payload.knowledgeRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceArtifactRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && authAudits.every((item) => exactRefIn(event.inputRefs, item.ref))
    );
  if (!directReviewAudit) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_REVIEW_AUDIT_INVALID',
      'semantic goal-condition review lacks direct reviewer audit over exact science and authorization predecessors'
    );
  }
  return review;
}

function validateCompilationWorld(ledger, normalized) {
  for (const ref of agronomicGoalConditionCompilationAuthorityRefs(normalized)) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicGoalConditionCompilationError(
        'AGRONOMIC_GOAL_CONDITION_REF_MISMATCH',
        'every goal-condition predecessor must resolve to its exact authority ref'
      );
    }
  }
  const world = validateKnowledgeWorld({ ledger, knowledgeRefs: normalized.knowledgeRefs });
  assertProtocolWorld({
    ledger,
    sourceRefs: normalized.sourceProtocolRefs,
    artifactRefs: normalized.sourceProtocolArtifactRefs,
    expectedSources: world.sources,
    expectedArtifacts: world.artifacts
  });
  assertKnowledgeBindings(normalized.goalCondition, normalized.knowledgeRefs);
  assertSourceExpressionEvidence(normalized.goalCondition, world);
  const review = validateReview({ ledger, reviewRef: normalized.semanticReviewRef, normalized });
  return { world, review };
}

export function publishAgronomicGoalConditionCompilation({ ledger, logicalId, version, compilation, audit }) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicGoalConditionCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 goal-condition authority may be published only with COMPLETE local goal coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  assertAuditActor(audit, reviewer);
  const refs = agronomicGoalConditionCompilationAuthorityRefs(normalized);
  return ledger.publish({
    kind: 'AgronomicGoalConditionCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_GOAL_CONDITION_COMPILATION',
      inputRefs: [...refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass: 'AGRONOMIC_GOAL_CONDITION_COMPILATION_AUTHORITY',
        goalConditionHash: normalized.goalConditionHash,
        semanticReviewRef: world.review.ref,
        losslessCoverageStatus: normalized.losslessCoverage.status
      }
    }
  });
}

export function validateAgronomicGoalConditionCompilationAuthority({ ledger, compilationRef }) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicGoalConditionCompilation') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_COMPILATION_REQUIRED',
      `expected AgronomicGoalConditionCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicGoalConditionCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 goal-condition authority must have COMPLETE local goal coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  const refs = agronomicGoalConditionCompilationAuthorityRefs(normalized);
  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_GOAL_CONDITION_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, world.review.ref)
    );
  if (!directAudit) {
    throw new AgronomicGoalConditionCompilationError(
      'AGRONOMIC_GOAL_CONDITION_AUDIT_INVALID',
      'goal-condition compilation lacks direct reviewer audit over all exact predecessors'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review
  });
}
