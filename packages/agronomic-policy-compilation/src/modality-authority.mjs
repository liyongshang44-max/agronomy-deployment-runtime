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
  AgronomicNormativeModalityCompilationError,
  agronomicNormativeModalityCompilationAuthorityRefs,
  agronomicNormativeModalityHash,
  normalizeAgronomicNormativeModality,
  normalizeAgronomicNormativeModalityCompilation
} from './modality-contract.mjs';

export const AGRONOMIC_NORMATIVE_MODALITY_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_MODALITY',
  'REJECT_MODALITY'
]);

const REVIEW_DISPOSITIONS = new Set(AGRONOMIC_NORMATIVE_MODALITY_REVIEW_DISPOSITIONS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function'
    || typeof ledger.exportSnapshot !== 'function') {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_LEDGER',
      'AgronomicNormativeModality authority requires a replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_INPUT',
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

function samePrincipal(left, right) {
  return samePrincipalIdentity(left, right);
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
        validated,
        sources: [validated.source.ref],
        artifacts: [validated.claim.semanticPayload.sourceArtifactRef]
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
        validated,
        sources: validated.validatedInputs.map((input) => input.source.ref),
        artifacts: validated.validatedInputs.map((input) => input.claim.semanticPayload.sourceArtifactRef)
      };
    }
    throw new Error(`unsupported knowledge kind ${knowledgeRef.kind}`);
  } catch (error) {
    const cause = error?.code ?? error?.message ?? 'UNKNOWN_KNOWLEDGE_AUTHORITY_FAILURE';
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for AGRONOMIC_POLICY_INPUT: ${cause}`
    );
  }
}

function validateKnowledgeWorld({ ledger, knowledgeRefs }) {
  const validations = knowledgeRefs.map((knowledgeRef) => validateKnowledge({ ledger, knowledgeRef }));
  return {
    validations,
    sources: uniqueRefs(validations.flatMap((item) => item.sources)),
    artifacts: uniqueRefs(validations.flatMap((item) => item.artifacts))
  };
}

function assertProtocolWorld({ ledger, sourceRefs, artifactRefs, expectedSources, expectedArtifacts }) {
  for (const sourceRef of sourceRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.ref.kind !== 'Source' || source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }
  for (const artifactRef of artifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    if (!sourceRefs.some((sourceRef) => sameAuthorityRef(sourceRef, artifact.semanticPayload?.sourceRef))) {
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every protocol SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
  }
  if (!sameRefSet(sourceRefs, expectedSources) || !sameRefSet(artifactRefs, expectedArtifacts)) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_SCIENTIFIC_PREDECESSOR_MISMATCH',
      'protocol Source/SourceArtifact sets must exactly equal the active scientific predecessors of knowledgeRefs'
    );
  }
}

function assertKnowledgeBindings(modality, knowledgeRefs) {
  const declared = new Set(knowledgeRefs.map(refKey));
  for (const binding of modality.authorityBindings) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_NOT_DECLARED',
        `modality authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function resolveAuthorizationForSource({ ledger, authRef, reviewerPrincipal, source }) {
  const auth = ledger.resolve(authRef);
  if (auth.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_REQUIRED',
      'semantic modality review requires AuthorizationDecisionAudit authority'
    );
  }
  const decision = auth.semanticPayload ?? {};
  if (decision.allowed !== true || decision.operation !== 'KNOWLEDGE_INSPECT'
    || !samePrincipal(decision.principal, reviewerPrincipal)) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_INVALID',
      'semantic modality review requires an allowed KNOWLEDGE_INSPECT decision for the exact reviewer'
    );
  }
  const policy = ledger.resolve(decision.policyRef);
  if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
    || policy.semanticPayload?.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_INVALID',
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
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_INVALID',
      'semantic review authorization cannot be reproduced'
    );
  }
  const hasGrant = assignments.some((assignment) =>
    assignment.ref.kind === 'RoleAssignment'
      && samePrincipal(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
  );
  if (!hasGrant) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEWER_PERMISSION_DENIED',
      'semantic reviewer lacks SOURCE_READ + KNOWLEDGE_INSPECT authority'
    );
  }
  return auth;
}

function validateReviewAuthorizationSet({ ledger, authorizationDecisionAuditRefs, reviewerPrincipal, sourceRefs }) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length !== sourceRefs.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_SET_INVALID',
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
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_SET_INVALID',
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
  if (new Set(audits.map((audit) => refKey(audit.ref))).size !== audits.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_AUTHORIZATION_SET_INVALID',
      'semantic review authorization set contains duplicates'
    );
  }
  return audits;
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor || audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_ACTOR_MISMATCH',
      'audit actor must match the exact semantic review principal'
    );
  }
}

export function publishAgronomicNormativeModalityReviewDecision({
  ledger,
  logicalId,
  version,
  knowledgeRefs,
  modality,
  disposition,
  reasonCodes = [],
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  rationale,
  audit
}) {
  requireLedger(ledger);
  const normalizedModality = normalizeAgronomicNormativeModality(modality);
  const normalizedDisposition = text(disposition, 'disposition');
  if (!REVIEW_DISPOSITIONS.has(normalizedDisposition)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_REVIEW_DISPOSITION',
      `unsupported semantic review disposition ${normalizedDisposition}`
    );
  }
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_KNOWLEDGE_REQUIRED',
      'semantic review requires non-empty knowledgeRefs'
    );
  }
  const normalizedKnowledgeRefs = uniqueRefs(knowledgeRefs);
  if (normalizedKnowledgeRefs.length !== knowledgeRefs.length) {
    throw new AgronomicNormativeModalityCompilationError(
      'DUPLICATE_AGRONOMIC_NORMATIVE_MODALITY_AUTHORITY_REF',
      'semantic review knowledgeRefs cannot contain duplicate exact refs'
    );
  }
  const world = validateKnowledgeWorld({ ledger, knowledgeRefs: normalizedKnowledgeRefs });
  assertKnowledgeBindings(normalizedModality, normalizedKnowledgeRefs);
  const authAudits = validateReviewAuthorizationSet({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal,
    sourceRefs: world.sources
  });
  assertAuditActor(audit, reviewerPrincipal);

  if (!Array.isArray(reasonCodes)) {
    throw new AgronomicNormativeModalityCompilationError(
      'INVALID_AGRONOMIC_NORMATIVE_MODALITY_REVIEW_REASON',
      'reasonCodes must be an array'
    );
  }
  const normalizedReasons = [...new Set(reasonCodes.map((value) => text(value, 'reasonCode')))].sort();
  if (normalizedDisposition === 'REJECT_MODALITY' && normalizedReasons.length === 0) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REJECTION_REASON_REQUIRED',
      'rejected modality review requires at least one reason code'
    );
  }

  const modalityHash = agronomicNormativeModalityHash(normalizedModality);
  return ledger.publish({
    kind: 'AgronomicNormativeModalityReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_SEMANTIC_REVIEW',
      knowledgeRefs: normalizedKnowledgeRefs,
      sourceRefs: world.sources,
      sourceArtifactRefs: world.artifacts,
      modality: cloneCanonicalValue(normalizedModality),
      modalityHash,
      disposition: normalizedDisposition,
      reasonCodes: normalizedReasons,
      reviewerPrincipal: cloneCanonicalValue(reviewerPrincipal),
      authorizationDecisionAuditRefs: authAudits.map((item) => item.ref),
      ...(rationale ? { rationale: text(rationale, 'rationale') } : {})
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_NORMATIVE_MODALITY',
      inputRefs: [
        ...normalizedKnowledgeRefs,
        ...world.sources,
        ...world.artifacts,
        ...authAudits.map((item) => item.ref),
        ...(audit.inputRefs ?? [])
      ],
      details: {
        ...(audit.details ?? {}),
        disposition: normalizedDisposition,
        modalityHash
      }
    }
  });
}

function validateReview({ ledger, reviewRef, normalized }) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicNormativeModalityReviewDecision'
    || review.semanticPayload?.authorityClass !== 'AGRONOMIC_NORMATIVE_MODALITY_SEMANTIC_REVIEW') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_SEMANTIC_REVIEW_REQUIRED',
      'compilation requires exact AgronomicNormativeModalityReviewDecision authority'
    );
  }
  const payload = review.semanticPayload;
  if (payload.disposition !== 'ACCEPT_MODALITY') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_REJECTED',
      'only ACCEPT_MODALITY semantic review can authorize modality publication'
    );
  }
  if (payload.modalityHash !== normalized.modalityHash
    || semanticHash('AgronomicNormativeModality', payload.modality) !== normalized.modalityHash
    || !sameRefSet(payload.knowledgeRefs, normalized.knowledgeRefs)
    || !sameRefSet(payload.sourceRefs, normalized.sourceProtocolRefs)
    || !sameRefSet(payload.sourceArtifactRefs, normalized.sourceProtocolArtifactRefs)) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_REVIEW_MISMATCH',
      'semantic review must bind the exact modality and scientific predecessor closure'
    );
  }
  return review;
}

function validateCompilationWorld(ledger, normalized) {
  for (const ref of agronomicNormativeModalityCompilationAuthorityRefs(normalized)) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicNormativeModalityCompilationError(
        'AGRONOMIC_NORMATIVE_MODALITY_REF_MISMATCH',
        'every normative modality predecessor must resolve to its exact authority ref'
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
  assertKnowledgeBindings(normalized.modality, normalized.knowledgeRefs);
  const review = validateReview({ ledger, reviewRef: normalized.semanticReviewRef, normalized });
  return { world, review };
}

export function publishAgronomicNormativeModalityCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicNormativeModalityCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 normative modality authority may be published only with COMPLETE modality coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  assertAuditActor(audit, reviewer);

  const refs = agronomicNormativeModalityCompilationAuthorityRefs(normalized);
  return ledger.publish({
    kind: 'AgronomicNormativeModalityCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_NORMATIVE_MODALITY_COMPILATION',
      inputRefs: [...refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass: 'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_AUTHORITY',
        modalityHash: normalized.modalityHash,
        semanticReviewRef: world.review.ref,
        losslessCoverageStatus: normalized.losslessCoverage.status
      }
    }
  });
}

export function validateAgronomicNormativeModalityCompilationAuthority({
  ledger,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicNormativeModalityCompilation') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_COMPILATION_REQUIRED',
      `expected AgronomicNormativeModalityCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicNormativeModalityCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 normative modality authority must have COMPLETE modality coverage'
    );
  }
  const world = validateCompilationWorld(ledger, normalized);
  const refs = agronomicNormativeModalityCompilationAuthorityRefs(normalized);
  const reviewer = world.review.semanticPayload.reviewerPrincipal;
  const directAudit = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref))
    .some((event) =>
      event.action === 'PUBLISH_AGRONOMIC_NORMATIVE_MODALITY_COMPILATION'
        && event.actor?.id === reviewer.principalId
        && event.actor?.type === reviewer.type
        && refs.every((ref) => exactRefIn(event.inputRefs, ref))
        && event.details?.semanticReviewRef
        && sameAuthorityRef(event.details.semanticReviewRef, world.review.ref)
    );
  if (!directAudit) {
    throw new AgronomicNormativeModalityCompilationError(
      'AGRONOMIC_NORMATIVE_MODALITY_AUDIT_INVALID',
      'normative modality compilation lacks direct reviewer audit over all exact predecessors'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    semanticReview: world.review
  });
}
