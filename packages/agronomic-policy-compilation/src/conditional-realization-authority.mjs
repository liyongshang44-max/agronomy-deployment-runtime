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
import { validateAgronomicActionRegimenCompilationAuthority } from './regimen-authority.mjs';
import { validateAgronomicActionRealizationCompilationAuthority } from './realization-authority.mjs';
import { validateAgronomicNormativeModalityCompilationAuthority } from './modality-authority.mjs';
import {
  AgronomicConditionalActionRealizationCompilationError,
  agronomicConditionalActionRealizationCompilationAuthorityRefs,
  agronomicConditionalActionRealizationHash,
  normalizeAgronomicConditionalActionRealization,
  normalizeAgronomicConditionalActionRealizationCompilation
} from './conditional-realization-contract.mjs';

export const AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_CONDITIONAL_ACTION_REALIZATION',
  'REJECT_CONDITIONAL_ACTION_REALIZATION'
]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_DISPOSITIONS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.exportSnapshot !== 'function') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_LEDGER',
      'AgronomicConditionalActionRealization authority requires a replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INPUT',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_KNOWLEDGE_AUTHORITY_INVALID',
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

function assertProtocolWorld({ ledger, sourceRefs, artifactRefs, world }) {
  for (const sourceRef of sourceRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.ref.kind !== 'Source' || source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }
  for (const artifactRef of artifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    if (!sourceRefs.some((sourceRef) =>
      sameAuthorityRef(sourceRef, artifact.semanticPayload?.sourceRef))) {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
  }
  if (!sameRefSet(sourceRefs, world.sources)
    || !sameRefSet(artifactRefs, world.artifacts)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SCIENTIFIC_PREDECESSOR_MISMATCH',
      'Source/SourceArtifact sets must exactly equal active conditional scientific predecessors'
    );
  }
}

function assertKnowledgeBindings(conditionalRealization, knowledgeRefs) {
  const declared = new Set(knowledgeRefs.map(refKey));
  for (const binding of conditionalRealization.authorityBindings) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUTHORITY_NOT_DECLARED',
        `conditional action-realization authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertSinglePropositionEvidence(conditionalRealization, world) {
  const matchingClaims = world.claims.filter((claim) => {
    const assertion = claim.semanticPayload?.assertion;
    return typeof assertion === 'string'
      && assertion.includes(conditionalRealization.sourceExpression);
  });

  if (matchingClaims.length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SOURCE_EXPRESSION_MISMATCH',
      'sourceExpression must occur in exact source-qualified conditional Claim evidence'
    );
  }

  const expressions = [
    ...conditionalRealization.compoundRealization.components.map((item) =>
      item.sourceExpression),
    conditionalRealization.sourceCondition.expression,
    conditionalRealization.sourceCondition.objectExpression
  ];

  const sameClaim = matchingClaims.some((claim) => {
    const assertion = claim.semanticPayload.assertion;
    return expressions.every((expression) => assertion.includes(expression));
  });

  if (!sameClaim) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PROPOSITION_CLOSURE_MISMATCH',
      'compound components and source condition must occur in the same exact conditional source proposition'
    );
  }
}

function validateParentsAndModality({ ledger, conditionalRealization, knowledgeRefs, world }) {
  const parentRegimen = validateAgronomicActionRegimenCompilationAuthority({
    ledger,
    compilationRef: conditionalRealization.parentRegimenCompilationRef
  });
  const parentRealization = validateAgronomicActionRealizationCompilationAuthority({
    ledger,
    compilationRef: conditionalRealization.parentActionRealizationCompilationRef
  });
  const modalityAuthority = validateAgronomicNormativeModalityCompilationAuthority({
    ledger,
    compilationRef: conditionalRealization.modalityCompilationRef
  });

  const regimenPayload = parentRegimen.semanticPayload;
  const realizationPayload = parentRealization.semanticPayload;
  const modalityPayload = modalityAuthority.semanticPayload;

  if (regimenPayload.regimen.actionCode !== 'TILL'
    || conditionalRealization.targetActionCode !== 'TILL') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PARENT_ACTION_MISMATCH',
      'DEC-0011 v1 requires exact parent Regimen actionCode TILL'
    );
  }

  if (realizationPayload.realization.targetActionCode !== 'TILL'
    || !sameAuthorityRef(
      realizationPayload.realization.parentRegimenCompilationRef,
      parentRegimen.record.ref
    )) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PARENT_REALIZATION_MISMATCH',
      'parent Action Realization must refine the exact parent TILL Regimen'
    );
  }

  const parentSoilFinishing = realizationPayload.realization.realizationSet.alternatives
    .some((item) =>
      item.kind === 'NAMED_METHOD'
      && item.methodCode === 'SOIL_FINISHING'
      && item.sourceExpression === 'soil finishing');

  if (!parentSoilFinishing) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_EXISTING_METHOD_MISSING',
      'parent Action Realization must establish exact source-local SOIL_FINISHING method identity'
    );
  }

  for (const parentPayload of [regimenPayload, realizationPayload]) {
    if (!sameRefSet(parentPayload.sourceProtocolRefs, world.sources)
      || !sameRefSet(parentPayload.sourceProtocolArtifactRefs, world.artifacts)) {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_PARENT_SOURCE_MISMATCH',
        'parent Regimen and Action Realization must close to the same exact Source/SourceArtifact world'
      );
    }
  }

  if (!sameRefSet(modalityPayload.sourceProtocolRefs, world.sources)
    || !sameRefSet(modalityPayload.sourceProtocolArtifactRefs, world.artifacts)
    || !sameRefSet(modalityPayload.knowledgeRefs, knowledgeRefs)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_MODALITY_PREDECESSOR_MISMATCH',
      'conditional modality must close to the same exact conditional scientific predecessor world'
    );
  }

  const modality = modalityPayload.modality;
  if (modality.sourceExpression !== conditionalRealization.sourceExpression
    || modality.targetScope !== 'ACTION'
    || modality.qualifiers.length !== 1
    || modality.qualifiers[0] !== 'IF_NEEDED'
    || Object.hasOwn(modality, 'force')) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_MODALITY_SHAPE_INVALID',
      'DEC-0011 v1 requires qualifier-only IF_NEEDED modality with ACTION target scope and no normative force'
    );
  }

  return { parentRegimen, parentRealization, modalityAuthority };
}

function validateConditionalWorld({
  ledger,
  knowledgeRefs,
  conditionalRealization,
  sourceRefs = null,
  artifactRefs = null
}) {
  const world = validateKnowledgeWorld({ ledger, knowledgeRefs });
  assertKnowledgeBindings(conditionalRealization, knowledgeRefs);
  assertSinglePropositionEvidence(conditionalRealization, world);
  assertProtocolWorld({
    ledger,
    sourceRefs: sourceRefs ?? world.sources,
    artifactRefs: artifactRefs ?? world.artifacts,
    world
  });
  const parents = validateParentsAndModality({
    ledger,
    conditionalRealization,
    knowledgeRefs,
    world
  });
  return { world, ...parents };
}

function resolveAuthorizationForSource({ ledger, authRef, reviewerPrincipal, source }) {
  const auth = ledger.resolve(authRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_REQUIRED',
      'semantic conditional-action-realization review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true
    || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_INVALID',
      'semantic review requires allowed KNOWLEDGE_INSPECT for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_INVALID',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_INVALID',
      'semantic review authorization cannot be reproduced'
    );
  }
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEWER_PERMISSION_DENIED',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_SET_INVALID',
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
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_SET_INVALID',
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
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review authorization set contains duplicates'
    );
  }
  return audits;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic review principal'
    );
  }
}

export function publishAgronomicConditionalActionRealizationReviewDecision({
  ledger,
  logicalId,
  version,
  knowledgeRefs,
  conditionalRealization,
  disposition,
  reasonCodes = [],
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  rationale,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicConditionalActionRealization(
    conditionalRealization
  );
  const normalizedDisposition = text(disposition, 'disposition');
  if (!REVIEW_DISPOSITIONS.has(normalizedDisposition)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_DISPOSITION',
      `unsupported semantic review disposition ${normalizedDisposition}`
    );
  }
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_KNOWLEDGE_REQUIRED',
      'semantic review requires non-empty knowledgeRefs'
    );
  }
  const normalizedKnowledgeRefs = uniqueRefs(knowledgeRefs);
  if (normalizedKnowledgeRefs.length !== knowledgeRefs.length) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'DUPLICATE_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUTHORITY_REF',
      'semantic review knowledgeRefs cannot contain duplicate exact refs'
    );
  }

  const validated = validateConditionalWorld({
    ledger,
    knowledgeRefs: normalizedKnowledgeRefs,
    conditionalRealization: normalized
  });

  const authAudits = validateAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal,
    sourceRefs: validated.world.sources
  });
  assertAuditActor(audit, reviewerPrincipal);

  if (!Array.isArray(reasonCodes)) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'INVALID_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_REASON',
      'reasonCodes must be an array'
    );
  }
  const normalizedReasons = [...new Set(reasonCodes.map((value) =>
    text(value, 'reasonCode')))].sort();
  if (normalizedDisposition === 'REJECT_CONDITIONAL_ACTION_REALIZATION'
    && normalizedReasons.length === 0) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REJECTION_REASON_REQUIRED',
      'rejected conditional-action-realization review requires at least one reason code'
    );
  }

  const conditionalRealizationHash =
    agronomicConditionalActionRealizationHash(normalized);

  return ledger.publish({
    kind: 'AgronomicConditionalActionRealizationReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SEMANTIC_REVIEW',
      knowledgeRefs: normalizedKnowledgeRefs,
      sourceRefs: validated.world.sources,
      sourceArtifactRefs: validated.world.artifacts,
      parentRegimenCompilationRef: validated.parentRegimen.record.ref,
      parentActionRealizationCompilationRef: validated.parentRealization.record.ref,
      modalityCompilationRef: validated.modalityAuthority.record.ref,
      conditionalRealization: cloneCanonicalValue(normalized),
      conditionalRealizationHash,
      disposition: normalizedDisposition,
      reasonCodes: normalizedReasons,
      reviewerPrincipal: cloneCanonicalValue(reviewerPrincipal),
      authorizationDecisionAuditRefs: authAudits.map((item) => item.ref),
      ...(rationale ? { rationale: text(rationale, 'rationale') } : {})
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION',
      inputRefs: [
        ...normalizedKnowledgeRefs,
        ...validated.world.sources,
        ...validated.world.artifacts,
        validated.parentRegimen.record.ref,
        validated.parentRealization.record.ref,
        validated.modalityAuthority.record.ref,
        ...authAudits.map((item) => item.ref),
        ...(audit.inputRefs ?? [])
      ],
      details: {
        ...(audit.details ?? {}),
        disposition: normalizedDisposition,
        conditionalRealizationHash,
        parentRegimenCompilationRef: validated.parentRegimen.record.ref,
        parentActionRealizationCompilationRef: validated.parentRealization.record.ref,
        modalityCompilationRef: validated.modalityAuthority.record.ref
      }
    }
  });
}

function validateReview({ ledger, reviewRef, normalized }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicConditionalActionRealizationReviewDecision'
    || review.semanticPayload?.authorityClass
      !== 'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SEMANTIC_REVIEW') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_SEMANTIC_REVIEW_REQUIRED',
      'compilation requires exact AgronomicConditionalActionRealizationReviewDecision authority'
    );
  }

  const payload = review.semanticPayload;
  if (payload.disposition !== 'ACCEPT_CONDITIONAL_ACTION_REALIZATION') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_REJECTED',
      'only ACCEPT_CONDITIONAL_ACTION_REALIZATION semantic review can authorize publication'
    );
  }

  if (payload.conditionalRealizationHash !== normalized.conditionalRealizationHash
    || agronomicConditionalActionRealizationHash(payload.conditionalRealization)
      !== normalized.conditionalRealizationHash
    || !sameRefSet(payload.knowledgeRefs, normalized.knowledgeRefs)
    || !sameRefSet(payload.sourceRefs, normalized.sourceProtocolRefs)
    || !sameRefSet(payload.sourceArtifactRefs, normalized.sourceProtocolArtifactRefs)
    || !sameAuthorityRef(
      payload.parentRegimenCompilationRef,
      normalized.conditionalRealization.parentRegimenCompilationRef
    )
    || !sameAuthorityRef(
      payload.parentActionRealizationCompilationRef,
      normalized.conditionalRealization.parentActionRealizationCompilationRef
    )
    || !sameAuthorityRef(
      payload.modalityCompilationRef,
      normalized.conditionalRealization.modalityCompilationRef
    )) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_MISMATCH',
      'semantic review must bind the exact conditional realization and all exact predecessor authorities'
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
      event.action === 'REVIEW_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION'
        && event.actor?.id === payload.reviewerPrincipal?.principalId
        && event.actor?.type === payload.reviewerPrincipal?.type
        && payload.knowledgeRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && payload.sourceArtifactRefs.every((ref) => exactRefIn(event.inputRefs, ref))
        && exactRefIn(
          event.inputRefs,
          normalized.conditionalRealization.parentRegimenCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          normalized.conditionalRealization.parentActionRealizationCompilationRef
        )
        && exactRefIn(
          event.inputRefs,
          normalized.conditionalRealization.modalityCompilationRef
        )
        && authAudits.every((item) => exactRefIn(event.inputRefs, item.ref))
    );

  if (!directAudit) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REVIEW_AUDIT_INVALID',
      'semantic conditional-action-realization review lacks direct reviewer audit over all exact predecessors'
    );
  }

  return review;
}

function validateCompilationWorld(ledger, normalized) {
  for (const ref of agronomicConditionalActionRealizationCompilationAuthorityRefs(
    normalized
  )) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicConditionalActionRealizationCompilationError(
        'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_REF_MISMATCH',
        'every conditional-action-realization predecessor must resolve to its exact authority ref'
      );
    }
  }

  const validated = validateConditionalWorld({
    ledger,
    knowledgeRefs: normalized.knowledgeRefs,
    conditionalRealization: normalized.conditionalRealization,
    sourceRefs: normalized.sourceProtocolRefs,
    artifactRefs: normalized.sourceProtocolArtifactRefs
  });

  const review = validateReview({
    ledger,
    reviewRef: normalized.semanticReviewRef,
    normalized
  });

  return { ...validated, review };
}

export function publishAgronomicConditionalActionRealizationCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicConditionalActionRealizationCompilation(compilation);

  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 conditional action-realization authority may be published only with COMPLETE local coverage'
    );
  }

  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  assertAuditActor(audit, reviewer);

  const refs = agronomicConditionalActionRealizationCompilationAuthorityRefs(
    normalized
  );

  return ledger.publish({
    kind: 'AgronomicConditionalActionRealizationCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION',
      inputRefs: [...refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass:
          'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_AUTHORITY',
        conditionalRealizationHash: normalized.conditionalRealizationHash,
        semanticReviewRef: world.review.ref,
        parentRegimenCompilationRef: world.parentRegimen.record.ref,
        parentActionRealizationCompilationRef: world.parentRealization.record.ref,
        modalityCompilationRef: world.modalityAuthority.record.ref,
        losslessCoverageStatus: normalized.losslessCoverage.status
      }
    }
  });
}

export function validateAgronomicConditionalActionRealizationCompilationAuthority({
  ledger,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicConditionalActionRealizationCompilation') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION_REQUIRED',
      `expected AgronomicConditionalActionRealizationCompilation, received ${record.ref.kind}`
    );
  }

  const normalized =
    normalizeAgronomicConditionalActionRealizationCompilation(record.semanticPayload);

  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 conditional action-realization authority must have COMPLETE local coverage'
    );
  }

  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  const refs = agronomicConditionalActionRealizationCompilationAuthorityRefs(
    normalized
  );

  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, world.review.ref)
        && event.details?.parentRegimenCompilationRef
        && sameAuthorityRef(
          event.details.parentRegimenCompilationRef,
          world.parentRegimen.record.ref
        )
        && event.details?.parentActionRealizationCompilationRef
        && sameAuthorityRef(
          event.details.parentActionRealizationCompilationRef,
          world.parentRealization.record.ref
        )
        && event.details?.modalityCompilationRef
        && sameAuthorityRef(
          event.details.modalityCompilationRef,
          world.modalityAuthority.record.ref
        )
    );

  if (!directAudit) {
    throw new AgronomicConditionalActionRealizationCompilationError(
      'AGRONOMIC_CONDITIONAL_ACTION_REALIZATION_AUDIT_INVALID',
      'conditional action-realization compilation lacks direct reviewer audit over all exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review,
    parentRegimenAuthority: world.parentRegimen,
    parentActionRealizationAuthority: world.parentRealization,
    modalityAuthority: world.modalityAuthority
  });
}
