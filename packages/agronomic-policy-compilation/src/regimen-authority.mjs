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
import { validateAgronomicNormativeModalityCompilationAuthority } from './modality-authority.mjs';
import { validateAgronomicGoalConditionCompilationAuthority } from './goal-authority.mjs';
import {
  AgronomicActionRegimenCompilationError,
  agronomicActionRegimenCompilationAuthorityRefs,
  agronomicActionRegimenHash,
  normalizeAgronomicActionRegimen,
  normalizeAgronomicActionRegimenCompilation
} from './regimen-contract.mjs';

export const AGRONOMIC_ACTION_REGIMEN_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_ACTION_REGIMEN',
  'REJECT_ACTION_REGIMEN'
]);

const REVIEW_DISPOSITIONS = new Set(AGRONOMIC_ACTION_REGIMEN_REVIEW_DISPOSITIONS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.exportSnapshot !== 'function') {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_LEDGER',
      'AgronomicActionRegimen authority requires a replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_INPUT',
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
        artifacts: validated.validatedInputs.map((input) => input.claim.semanticPayload.sourceArtifactRef),
        claims: validated.validatedInputs.map((input) => input.claim)
      };
    }
    throw new Error(`unsupported knowledge kind ${knowledgeRef.kind}`);
  } catch (error) {
    const cause = error?.code ?? error?.message ?? 'UNKNOWN_KNOWLEDGE_AUTHORITY_FAILURE';
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for AGRONOMIC_POLICY_INPUT: ${cause}`
    );
  }
}

function validateKnowledgeWorld({ ledger, knowledgeRefs }) {
  const validated = knowledgeRefs.map((knowledgeRef) => validateKnowledge({ ledger, knowledgeRef }));
  return {
    sources: uniqueRefs(validated.flatMap((item) => item.sources)),
    artifacts: uniqueRefs(validated.flatMap((item) => item.artifacts)),
    claims: validated.flatMap((item) => item.claims)
  };
}

function assertProtocolWorld({ ledger, sourceRefs, artifactRefs, world }) {
  for (const sourceRef of sourceRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.ref.kind !== 'Source' || source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }
  for (const artifactRef of artifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    if (!sourceRefs.some((sourceRef) => sameAuthorityRef(sourceRef, artifact.semanticPayload?.sourceRef))) {
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
  }
  if (!sameRefSet(sourceRefs, world.sources) || !sameRefSet(artifactRefs, world.artifacts)) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_SCIENTIFIC_PREDECESSOR_MISMATCH',
      'Source/SourceArtifact sets must exactly equal active scientific predecessors of knowledgeRefs'
    );
  }
}

function assertKnowledgeBindings(regimen, knowledgeRefs) {
  const declared = new Set(knowledgeRefs.map(refKey));
  for (const binding of regimen.authorityBindings) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_AUTHORITY_NOT_DECLARED',
        `action-regimen authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertSourceExpressionEvidence(regimen, world) {
  const matching = world.claims.some((claim) => {
    const assertion = claim.semanticPayload?.assertion;
    return typeof assertion === 'string' && assertion.includes(regimen.sourceExpression);
  });
  if (!matching) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_SOURCE_EXPRESSION_MISMATCH',
      'sourceExpression must occur in at least one exact source-qualified Claim predecessor'
    );
  }
}

function assertChildAuthorityClosure({ regimen, knowledgeRefs, world, modalityAuthority, goalAuthority }) {
  const modalityPayload = modalityAuthority.semanticPayload;
  const goalPayload = goalAuthority.semanticPayload;

  if (!sameRefSet(modalityPayload.sourceProtocolRefs, world.sources)
    || !sameRefSet(goalPayload.sourceProtocolRefs, world.sources)
    || !sameRefSet(modalityPayload.sourceProtocolArtifactRefs, world.artifacts)
    || !sameRefSet(goalPayload.sourceProtocolArtifactRefs, world.artifacts)
    || !sameRefSet(modalityPayload.knowledgeRefs, knowledgeRefs)
    || !sameRefSet(goalPayload.knowledgeRefs, knowledgeRefs)) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_CROSS_PROPOSITION_PREDECESSOR_MISMATCH',
      'modality, goal and regimen must close to the same exact scientific predecessor sets'
    );
  }

  const modality = modalityPayload.modality;
  const goal = goalPayload.goalCondition;

  if (modality.sourceExpression !== regimen.sourceExpression
    || goal.sourceExpression !== regimen.sourceExpression) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_CROSS_PROPOSITION_SOURCE_MISMATCH',
      'regimen, modality and goal must bind the exact same source expression'
    );
  }

  if (Object.hasOwn(modality, 'force')
    || modality.targetScope !== 'OCCURRENCE'
    || modality.qualifiers.length !== 1
    || modality.qualifiers[0] !== 'AS_NEEDED') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_MODALITY_SHAPE_INVALID',
      'DEC-0009 v1 requires qualifier-only AS_NEEDED modality with OCCURRENCE target scope and no normative force'
    );
  }

  if (goal.targetScope !== 'ACTION' || goal.relation !== 'PREVENT') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_GOAL_SHAPE_INVALID',
      'DEC-0009 v1 requires PREVENT goal condition with ACTION target scope'
    );
  }
}

function validateRegimenWorld({ ledger, knowledgeRefs, regimen, sourceRefs = null, artifactRefs = null }) {
  const world = validateKnowledgeWorld({ ledger, knowledgeRefs });
  assertKnowledgeBindings(regimen, knowledgeRefs);
  assertSourceExpressionEvidence(regimen, world);

  if (sourceRefs && artifactRefs) {
    assertProtocolWorld({ ledger, sourceRefs, artifactRefs, world });
  } else {
    assertProtocolWorld({ ledger, sourceRefs: world.sources, artifactRefs: world.artifacts, world });
  }

  const modalityAuthority = validateAgronomicNormativeModalityCompilationAuthority({
    ledger,
    compilationRef: regimen.modalityCompilationRef
  });
  const goalAuthority = validateAgronomicGoalConditionCompilationAuthority({
    ledger,
    compilationRef: regimen.goalConditionCompilationRef
  });

  assertChildAuthorityClosure({
    regimen,
    knowledgeRefs,
    world,
    modalityAuthority,
    goalAuthority
  });

  return { world, modalityAuthority, goalAuthority };
}

function resolveAuthorizationForSource({ ledger, authRef, reviewerPrincipal, source }) {
  const auth = ledger.resolve(authRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_REQUIRED',
      'semantic action-regimen review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_INVALID',
      'semantic action-regimen review requires allowed KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_INVALID',
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
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_INVALID',
      'semantic action-regimen review authorization cannot be reproduced'
    );
  }
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEWER_PERMISSION_DENIED',
      'semantic reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT authority'
    );
  }
  return auth;
}

function validateAuthorizationSet({ ledger, authorizationDecisionAuditRefs, reviewerPrincipal, sourceRefs }) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length !== sourceRefs.length) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_SET_INVALID',
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
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_SET_INVALID',
        'semantic review is missing exact Source-scoped authorization'
      );
    }
    audits.push(resolveAuthorizationForSource({ ledger, authRef: match.ref, reviewerPrincipal, source }));
  }
  if (new Set(audits.map((item) => refKey(item.ref))).size !== audits.length) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review authorization set contains duplicates'
    );
  }
  return audits;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor || audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic review principal'
    );
  }
}

export function publishAgronomicActionRegimenReviewDecision({
  ledger,
  logicalId,
  version,
  knowledgeRefs,
  regimen,
  disposition,
  reasonCodes = [],
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  rationale,
  audit
}) {
  requireLedger(ledger);
  const normalizedRegimen = normalizeAgronomicActionRegimen(regimen);
  const normalizedDisposition = text(disposition, 'disposition');
  if (!REVIEW_DISPOSITIONS.has(normalizedDisposition)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_REVIEW_DISPOSITION',
      `unsupported semantic review disposition ${normalizedDisposition}`
    );
  }
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_KNOWLEDGE_REQUIRED',
      'semantic review requires non-empty knowledgeRefs'
    );
  }
  const normalizedKnowledgeRefs = uniqueRefs(knowledgeRefs);
  if (normalizedKnowledgeRefs.length !== knowledgeRefs.length) {
    throw new AgronomicActionRegimenCompilationError(
      'DUPLICATE_AGRONOMIC_ACTION_REGIMEN_AUTHORITY_REF',
      'semantic review knowledgeRefs cannot contain duplicate exact refs'
    );
  }

  const validated = validateRegimenWorld({
    ledger,
    knowledgeRefs: normalizedKnowledgeRefs,
    regimen: normalizedRegimen
  });
  const authAudits = validateAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal,
    sourceRefs: validated.world.sources
  });
  assertAuditActor(audit, reviewerPrincipal);

  if (!Array.isArray(reasonCodes)) {
    throw new AgronomicActionRegimenCompilationError(
      'INVALID_AGRONOMIC_ACTION_REGIMEN_REVIEW_REASON',
      'reasonCodes must be an array'
    );
  }
  const normalizedReasons = [...new Set(reasonCodes.map((value) => text(value, 'reasonCode')))].sort();
  if (normalizedDisposition === 'REJECT_ACTION_REGIMEN' && normalizedReasons.length === 0) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REJECTION_REASON_REQUIRED',
      'rejected action-regimen review requires at least one reason code'
    );
  }

  const regimenHash = agronomicActionRegimenHash(normalizedRegimen);
  return ledger.publish({
    kind: 'AgronomicActionRegimenReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_ACTION_REGIMEN_SEMANTIC_REVIEW',
      knowledgeRefs: normalizedKnowledgeRefs,
      sourceRefs: validated.world.sources,
      sourceArtifactRefs: validated.world.artifacts,
      regimen: cloneCanonicalValue(normalizedRegimen),
      regimenHash,
      disposition: normalizedDisposition,
      reasonCodes: normalizedReasons,
      reviewerPrincipal: cloneCanonicalValue(reviewerPrincipal),
      authorizationDecisionAuditRefs: authAudits.map((item) => item.ref),
      ...(rationale ? { rationale: text(rationale, 'rationale') } : {})
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_ACTION_REGIMEN',
      inputRefs: [
        ...normalizedKnowledgeRefs,
        ...validated.world.sources,
        ...validated.world.artifacts,
        normalizedRegimen.modalityCompilationRef,
        normalizedRegimen.goalConditionCompilationRef,
        ...authAudits.map((item) => item.ref),
        ...(audit.inputRefs ?? [])
      ],
      details: {
        ...(audit.details ?? {}),
        disposition: normalizedDisposition,
        regimenHash
      }
    }
  });
}

function validateReview({ ledger, reviewRef, normalized }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicActionRegimenReviewDecision'
    || review.semanticPayload?.authorityClass !== 'AGRONOMIC_ACTION_REGIMEN_SEMANTIC_REVIEW') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_SEMANTIC_REVIEW_REQUIRED',
      'compilation requires exact AgronomicActionRegimenReviewDecision authority'
    );
  }
  const payload = review.semanticPayload;
  if (payload.disposition !== 'ACCEPT_ACTION_REGIMEN') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_REJECTED',
      'only ACCEPT_ACTION_REGIMEN semantic review can authorize publication'
    );
  }
  if (payload.regimenHash !== normalized.regimenHash
    || agronomicActionRegimenHash(payload.regimen) !== normalized.regimenHash
    || !sameRefSet(payload.knowledgeRefs, normalized.knowledgeRefs)
    || !sameRefSet(payload.sourceRefs, normalized.sourceProtocolRefs)
    || !sameRefSet(payload.sourceArtifactRefs, normalized.sourceProtocolArtifactRefs)) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_MISMATCH',
      'semantic review must bind the exact regimen and scientific predecessor closure'
    );
  }
  const authAudits = validateAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: payload.reviewerPrincipal,
    sourceRefs: payload.sourceRefs
  });
  const directAudit = ledger.auditFor(review.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, review.ref))
    .some((event) =>
      event.action === 'REVIEW_AGRONOMIC_ACTION_REGIMEN'
        && event.actor?.id === payload.reviewerPrincipal?.principalId
        && event.actor?.type === payload.reviewerPrincipal?.type
        && payload.knowledgeRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceArtifactRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && exactRefIn(event.inputRefs, normalized.regimen.modalityCompilationRef)
        && exactRefIn(event.inputRefs, normalized.regimen.goalConditionCompilationRef)
        && authAudits.every((item) => exactRefIn(event.inputRefs, item.ref))
    );
  if (!directAudit) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_REVIEW_AUDIT_INVALID',
      'semantic action-regimen review lacks direct reviewer audit over all exact predecessors'
    );
  }
  return review;
}

function validateCompilationWorld(ledger, normalized) {
  for (const ref of agronomicActionRegimenCompilationAuthorityRefs(normalized)) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicActionRegimenCompilationError(
        'AGRONOMIC_ACTION_REGIMEN_REF_MISMATCH',
        'every action-regimen predecessor must resolve to its exact authority ref'
      );
    }
  }
  const validated = validateRegimenWorld({
    ledger,
    knowledgeRefs: normalized.knowledgeRefs,
    regimen: normalized.regimen,
    sourceRefs: normalized.sourceProtocolRefs,
    artifactRefs: normalized.sourceProtocolArtifactRefs
  });
  const review = validateReview({ ledger, reviewRef: normalized.semanticReviewRef, normalized });
  return { ...validated, review };
}

export function publishAgronomicActionRegimenCompilation({ ledger, logicalId, version, compilation, audit }) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicActionRegimenCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 action-regimen authority may be published only with COMPLETE local regimen coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  assertAuditActor(audit, reviewer);
  const refs = agronomicActionRegimenCompilationAuthorityRefs(normalized);
  return ledger.publish({
    kind: 'AgronomicActionRegimenCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_ACTION_REGIMEN_COMPILATION',
      inputRefs: [...refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass: 'AGRONOMIC_ACTION_REGIMEN_COMPILATION_AUTHORITY',
        regimenHash: normalized.regimenHash,
        semanticReviewRef: world.review.ref,
        losslessCoverageStatus: normalized.losslessCoverage.status
      }
    }
  });
}

export function validateAgronomicActionRegimenCompilationAuthority({ ledger, compilationRef }) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicActionRegimenCompilation') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_COMPILATION_REQUIRED',
      `expected AgronomicActionRegimenCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicActionRegimenCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 action-regimen authority must have COMPLETE local regimen coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  const refs = agronomicActionRegimenCompilationAuthorityRefs(normalized);
  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_ACTION_REGIMEN_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, world.review.ref)
    );
  if (!directAudit) {
    throw new AgronomicActionRegimenCompilationError(
      'AGRONOMIC_ACTION_REGIMEN_AUDIT_INVALID',
      'action-regimen compilation lacks direct reviewer audit over all exact predecessors'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review,
    modalityAuthority: world.modalityAuthority,
    goalAuthority: world.goalAuthority
  });
}
