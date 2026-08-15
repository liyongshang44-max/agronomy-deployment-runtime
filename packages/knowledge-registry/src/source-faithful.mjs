import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeSourceFaithfulDimension, ContextSemanticError } from '../../contracts/src/context-semantic.mjs';
import { PERMISSIONS } from '../../authorization/src/engine.mjs';
import { samePrincipalIdentity } from '../../authorization/src/index.mjs';

export const SOURCE_FAITHFUL_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_SOURCE_FAITHFUL',
  'REJECT_SOURCE_FAITHFUL'
]);

const DISPOSITION_SET = new Set(SOURCE_FAITHFUL_REVIEW_DISPOSITIONS);

export class SourceFaithfulReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SourceFaithfulReviewError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SourceFaithfulReviewError('INVALID_REVIEW_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeReasonCodes(values, { required = false } = {}) {
  if (values === undefined || values === null) {
    if (required) throw new SourceFaithfulReviewError('REJECTION_REASON_REQUIRED', 'rejected source-faithful review requires at least one reason code');
    return [];
  }
  if (!Array.isArray(values)) {
    throw new SourceFaithfulReviewError('INVALID_REVIEW_REASON', 'reasonCodes must be an array');
  }
  const normalized = [...new Set(values.map((value) => requiredText(value, 'reasonCode')))].sort();
  if (required && normalized.length === 0) {
    throw new SourceFaithfulReviewError('REJECTION_REASON_REQUIRED', 'rejected source-faithful review requires at least one reason code');
  }
  return normalized;
}

function resolveKind(ledger, ref, expectedKind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== expectedKind) {
    throw new SourceFaithfulReviewError(code, `expected ${expectedKind}, received ${record.ref.kind}`);
  }
  return record;
}

function includesExactRef(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function assertCompletedCompilation(result) {
  if (result.semanticPayload?.outputAuthority !== 'PROPOSAL_ONLY') {
    throw new SourceFaithfulReviewError('INVALID_COMPILATION_RESULT', 'ScientificCompilationResult must remain PROPOSAL_ONLY');
  }
  if (!Array.isArray(result.semanticPayload.claimCandidateRefs) || !Array.isArray(result.semanticPayload.sourceContextCandidateRefs)) {
    throw new SourceFaithfulReviewError('INVALID_COMPILATION_RESULT', 'ScientificCompilationResult must freeze candidate/context references');
  }
}

function assertCandidatePair({ result, claimCandidate, sourceContextCandidate }) {
  assertCompletedCompilation(result);

  if (!includesExactRef(result.semanticPayload.claimCandidateRefs, claimCandidate.ref)) {
    throw new SourceFaithfulReviewError('CLAIM_CANDIDATE_NOT_IN_COMPILATION', 'ClaimCandidate is not a member of the exact completed ScientificCompilationResult');
  }
  if (!includesExactRef(result.semanticPayload.sourceContextCandidateRefs, sourceContextCandidate.ref)) {
    throw new SourceFaithfulReviewError('SOURCE_CONTEXT_CANDIDATE_NOT_IN_COMPILATION', 'SourceContextCandidate is not a member of the exact completed ScientificCompilationResult');
  }
  if (!sameAuthorityRef(sourceContextCandidate.semanticPayload.claimCandidateRef, claimCandidate.ref)) {
    throw new SourceFaithfulReviewError('CANDIDATE_PAIR_MISMATCH', 'SourceContextCandidate does not belong to the selected ClaimCandidate');
  }

  const candidateBindings = [
    ['sourceRef', claimCandidate.semanticPayload.sourceRef, sourceContextCandidate.semanticPayload.sourceRef],
    ['sourceArtifactRef', claimCandidate.semanticPayload.sourceArtifactRef, sourceContextCandidate.semanticPayload.sourceArtifactRef],
    ['compilerDefinitionRef', claimCandidate.semanticPayload.compilerDefinitionRef, sourceContextCandidate.semanticPayload.compilerDefinitionRef]
  ];
  for (const [name, left, right] of candidateBindings) {
    if (!sameAuthorityRef(left, right)) {
      throw new SourceFaithfulReviewError('CANDIDATE_PROVENANCE_MISMATCH', `${name} differs between ClaimCandidate and SourceContextCandidate`);
    }
  }
  if (claimCandidate.semanticPayload.sourceArtifactContentHash !== sourceContextCandidate.semanticPayload.sourceArtifactContentHash) {
    throw new SourceFaithfulReviewError('CANDIDATE_PROVENANCE_MISMATCH', 'SourceArtifact content hash differs between candidate pair');
  }

  const resultBindings = [
    ['sourceRef', result.semanticPayload.sourceRef, claimCandidate.semanticPayload.sourceRef],
    ['sourceArtifactRef', result.semanticPayload.sourceArtifactRef, claimCandidate.semanticPayload.sourceArtifactRef],
    ['compilerDefinitionRef', result.semanticPayload.compilerDefinitionRef, claimCandidate.semanticPayload.compilerDefinitionRef]
  ];
  for (const [name, left, right] of resultBindings) {
    if (!sameAuthorityRef(left, right)) {
      throw new SourceFaithfulReviewError('COMPILATION_PROVENANCE_MISMATCH', `${name} differs between completed compilation result and selected candidate`);
    }
  }
  if (result.semanticPayload.sourceArtifactContentHash !== claimCandidate.semanticPayload.sourceArtifactContentHash) {
    throw new SourceFaithfulReviewError('COMPILATION_PROVENANCE_MISMATCH', 'SourceArtifact content hash differs between completed compilation result and selected candidate');
  }
}

function assertUpstreamAuthorityClosure({ ledger, result, claimCandidate, sourceContextCandidate }) {
  const source = resolveKind(ledger, claimCandidate.semanticPayload.sourceRef, 'Source', 'SOURCE_AUTHORITY_REQUIRED');
  const artifact = resolveKind(ledger, claimCandidate.semanticPayload.sourceArtifactRef, 'SourceArtifact', 'SOURCE_ARTIFACT_AUTHORITY_REQUIRED');
  const compilerDefinition = resolveKind(
    ledger,
    claimCandidate.semanticPayload.compilerDefinitionRef,
    'ScientificCompilerDefinition',
    'COMPILER_DEFINITION_AUTHORITY_REQUIRED'
  );

  if (!sameAuthorityRef(artifact.semanticPayload.sourceRef, source.ref)) {
    throw new SourceFaithfulReviewError('UPSTREAM_PROVENANCE_INVALID', 'SourceArtifact does not bind the exact Source referenced by the candidates');
  }
  if (artifact.semanticPayload.contentHash !== claimCandidate.semanticPayload.sourceArtifactContentHash
    || artifact.semanticPayload.contentHash !== result.semanticPayload.sourceArtifactContentHash) {
    throw new SourceFaithfulReviewError('UPSTREAM_PROVENANCE_INVALID', 'candidate/result content hash does not equal exact SourceArtifact contentHash');
  }
  if (compilerDefinition.semanticPayload.outputAuthority !== 'CANDIDATE_ONLY') {
    throw new SourceFaithfulReviewError('UPSTREAM_PROVENANCE_INVALID', 'ScientificCompilerDefinition must remain CANDIDATE_ONLY');
  }

  for (const candidate of [claimCandidate, sourceContextCandidate]) {
    if (!sameAuthorityRef(candidate.semanticPayload.sourceRef, source.ref)
      || !sameAuthorityRef(candidate.semanticPayload.sourceArtifactRef, artifact.ref)
      || !sameAuthorityRef(candidate.semanticPayload.compilerDefinitionRef, compilerDefinition.ref)) {
      throw new SourceFaithfulReviewError('UPSTREAM_PROVENANCE_INVALID', 'candidate does not close to the exact Source/SourceArtifact/CompilerDefinition chain');
    }
  }

  return { source, artifact, compilerDefinition };
}

export function sourceReviewResourceId(sourceRef) {
  const ref = assertAuthorityRef(sourceRef);
  return `source-review:${ref.kind}/${ref.logicalId}@${ref.version}#${ref.semanticHash}`;
}

function scopeContains(grantScope, targetScope) {
  if (grantScope?.platform === true) return true;
  if (!grantScope || typeof grantScope !== 'object') return false;
  for (const [key, expected] of Object.entries(grantScope)) {
    if (targetScope[key] !== expected) return false;
  }
  return true;
}

function assertReviewAuthorization({ ledger, authorizationDecisionAuditRef, reviewPrincipal, source, audit }) {
  if (!reviewPrincipal || typeof reviewPrincipal !== 'object' || Array.isArray(reviewPrincipal)) {
    throw new SourceFaithfulReviewError('REVIEW_PRINCIPAL_REQUIRED', 'exact reviewPrincipal is required');
  }
  if (!audit?.actor || audit.actor.id !== reviewPrincipal.principalId || audit.actor.type !== reviewPrincipal.type) {
    throw new SourceFaithfulReviewError('REVIEW_ACTOR_MISMATCH', 'audit.actor must match the exact authorized review principal');
  }

  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'REVIEW_AUTHORIZATION_REQUIRED');
  const decision = authAudit.semanticPayload;
  if (decision.allowed !== true || decision.operation !== 'KNOWLEDGE_INSPECT') {
    throw new SourceFaithfulReviewError('REVIEW_AUTHORIZATION_DENIED', 'source-faithful review requires an allowed KNOWLEDGE_INSPECT authorization decision');
  }
  if (!samePrincipalIdentity(decision.principal, reviewPrincipal)) {
    throw new SourceFaithfulReviewError('REVIEW_AUTHORIZATION_PRINCIPAL_MISMATCH', 'authorization principal does not match reviewPrincipal');
  }

  const policy = resolveKind(ledger, decision.policyRef, 'KnowledgeGovernancePolicy', 'REVIEW_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== sourceReviewResourceId(source.ref)) {
    throw new SourceFaithfulReviewError('REVIEW_POLICY_SCOPE_MISMATCH', 'authorization policy is not bound to the exact Source review resource');
  }
  const sourceOwnership = source.semanticPayload.ownership;
  const policyOwnership = policy.semanticPayload.ownership;
  if (sourceOwnership.organizationId !== policyOwnership.organizationId
    || (sourceOwnership.tenantId ?? null) !== (policyOwnership.tenantId ?? null)) {
    throw new SourceFaithfulReviewError('REVIEW_POLICY_OWNERSHIP_MISMATCH', 'review policy ownership does not match exact Source ownership');
  }

  const expectedScope = {
    organizationId: sourceOwnership.organizationId,
    ...(sourceOwnership.tenantId ? { tenantId: sourceOwnership.tenantId } : {})
  };
  const requestScope = decision.request?.authorizationScope;
  if (!requestScope || Object.entries(expectedScope).some(([key, value]) => requestScope[key] !== value)) {
    throw new SourceFaithfulReviewError('REVIEW_AUTHORIZATION_SCOPE_MISMATCH', 'authorization decision scope does not cover exact Source ownership scope');
  }

  let reviewerGrantFound = false;
  for (const assignmentRef of decision.assignmentRefs ?? []) {
    const assignment = resolveKind(ledger, assignmentRef, 'RoleAssignment', 'REVIEW_ROLE_ASSIGNMENT_REQUIRED');
    if (!samePrincipalIdentity(assignment.semanticPayload.principal, reviewPrincipal)) continue;
    if (!assignment.semanticPayload.permissions.includes(PERMISSIONS.KNOWLEDGE_INSPECT)) continue;
    if (!assignment.semanticPayload.permissions.includes(PERMISSIONS.SOURCE_READ)) continue;
    if (!scopeContains(assignment.semanticPayload.scope, expectedScope)) continue;
    reviewerGrantFound = true;
    break;
  }
  if (!reviewerGrantFound) {
    throw new SourceFaithfulReviewError(
      'REVIEWER_PERMISSION_DENIED',
      'source-faithful review requires exact RoleAssignment authority granting SOURCE_READ and KNOWLEDGE_INSPECT on the Source scope'
    );
  }

  return authAudit;
}

function normalizeFinalContextFamilies(candidateFamilies, contextAdjudication) {
  if (!contextAdjudication || typeof contextAdjudication !== 'object' || Array.isArray(contextAdjudication)) {
    throw new SourceFaithfulReviewError('CONTEXT_SEMANTIC_ADJUDICATION_REQUIRED', 'accepted source-faithful review requires contextAdjudication');
  }

  const output = {};
  for (const [family, candidateFamily] of Object.entries(candidateFamilies)) {
    const adjudications = contextAdjudication[family] ?? [];
    if (!Array.isArray(adjudications)) {
      throw new SourceFaithfulReviewError('INVALID_CONTEXT_SEMANTIC_ADJUDICATION', `${family} adjudication must be an array`);
    }
    if (candidateFamily.status === 'NOT_REPORTED') {
      if (adjudications.length !== 0) {
        throw new SourceFaithfulReviewError('NOT_REPORTED_SEMANTIC_OVERRIDE', `${family} is NOT_REPORTED and cannot receive final semantic dimensions`);
      }
      output[family] = { status: 'NOT_REPORTED', dimensions: [] };
      continue;
    }
    if (adjudications.length !== candidateFamily.dimensions.length) {
      throw new SourceFaithfulReviewError('CONTEXT_SEMANTIC_ADJUDICATION_INCOMPLETE', `${family} requires one semantic adjudication per reported dimension`);
    }
    try {
      output[family] = {
        status: 'REPORTED',
        dimensions: candidateFamily.dimensions.map((candidate, index) => normalizeSourceFaithfulDimension({
          candidate,
          adjudication: adjudications[index]
        }))
      };
    } catch (error) {
      if (error instanceof ContextSemanticError) throw new SourceFaithfulReviewError(error.code, error.message);
      throw error;
    }
  }
  return deepFreeze(output);
}

function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') {
    throw new SourceFaithfulReviewError('AUDIT_REQUIRED', 'source-faithful review requires explicit audit metadata');
  }
  return {
    ...base,
    eventId: `${requiredText(base.eventId, 'audit.eventId')}:${suffix}`,
    inputRefs: [...inputRefs, ...(base.inputRefs ?? [])]
  };
}

function predictedRef(kind, logicalId, version, semanticPayload) {
  return makeAuthorityRef({
    kind,
    logicalId: requiredText(logicalId, `${kind}.logicalId`),
    version: requiredText(version, `${kind}.version`),
    semanticHash: semanticHash(kind, semanticPayload)
  });
}

export class SourceFaithfulReviewService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.publishBatch !== 'function'
      || typeof ledger.resolve !== 'function' || typeof ledger.addLineage !== 'function') {
      throw new SourceFaithfulReviewError('INVALID_LEDGER', 'SourceFaithfulReviewService requires shared AuthorityLedger with atomic publishBatch');
    }
    this.#ledger = ledger;
  }

  reviewCandidate({
    reviewLogicalId,
    reviewVersion,
    compilationResultRef,
    claimCandidateRef,
    sourceContextCandidateRef,
    disposition,
    reasonCodes = [],
    rationale,
    contextAdjudication,
    reviewPrincipal,
    authorizationDecisionAuditRef,
    claimLogicalId,
    claimVersion,
    sourceContextLogicalId,
    sourceContextVersion,
    audit
  }) {
    const normalizedDisposition = requiredText(disposition, 'disposition');
    if (!DISPOSITION_SET.has(normalizedDisposition)) {
      throw new SourceFaithfulReviewError('INVALID_REVIEW_DISPOSITION', `unsupported review disposition ${normalizedDisposition}`);
    }

    const result = resolveKind(this.#ledger, compilationResultRef, 'ScientificCompilationResult', 'COMPILATION_RESULT_REQUIRED');
    const claimCandidate = resolveKind(this.#ledger, claimCandidateRef, 'ClaimCandidate', 'CLAIM_CANDIDATE_REQUIRED');
    const sourceContextCandidate = resolveKind(this.#ledger, sourceContextCandidateRef, 'SourceContextCandidate', 'SOURCE_CONTEXT_CANDIDATE_REQUIRED');

    assertCandidatePair({ result, claimCandidate, sourceContextCandidate });
    const upstream = assertUpstreamAuthorityClosure({ ledger: this.#ledger, result, claimCandidate, sourceContextCandidate });
    const authAudit = assertReviewAuthorization({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      reviewPrincipal,
      source: upstream.source,
      audit
    });

    const normalizedReasons = normalizeReasonCodes(reasonCodes, {
      required: normalizedDisposition === 'REJECT_SOURCE_FAITHFUL'
    });

    const review = this.#ledger.publish({
      kind: 'SourceFaithfulReviewDecision',
      logicalId: requiredText(reviewLogicalId, 'reviewLogicalId'),
      version: requiredText(reviewVersion, 'reviewVersion'),
      semanticPayload: {
        compilationResultRef: result.ref,
        claimCandidateRef: claimCandidate.ref,
        sourceContextCandidateRef: sourceContextCandidate.ref,
        sourceRef: upstream.source.ref,
        sourceArtifactRef: upstream.artifact.ref,
        sourceArtifactContentHash: upstream.artifact.semanticPayload.contentHash,
        compilerDefinitionRef: upstream.compilerDefinition.ref,
        authorizationDecisionAuditRef: authAudit.ref,
        reviewPrincipal: cloneCanonicalValue(reviewPrincipal),
        disposition: normalizedDisposition,
        reasonCodes: normalizedReasons,
        ...(rationale ? { rationale: requiredText(rationale, 'rationale') } : {}),
        authorityClass: 'SOURCE_FAITHFUL_REVIEW'
      },
      audit: auditEvent(audit, 'review', [authAudit.ref, result.ref, claimCandidate.ref, sourceContextCandidate.ref, upstream.source.ref, upstream.artifact.ref, upstream.compilerDefinition.ref])
    });

    if (normalizedDisposition === 'REJECT_SOURCE_FAITHFUL') {
      return deepFreeze({ review, claim: null, sourceContext: null });
    }

    const finalContextFamilies = normalizeFinalContextFamilies(sourceContextCandidate.semanticPayload.contextFamilies, contextAdjudication);

    const claimPayload = {
      claimType: claimCandidate.semanticPayload.claimType,
      assertion: claimCandidate.semanticPayload.assertion,
      sourceRef: upstream.source.ref,
      sourceArtifactRef: upstream.artifact.ref,
      sourceArtifactContentHash: upstream.artifact.semanticPayload.contentHash,
      sourceLocator: cloneCanonicalValue(claimCandidate.semanticPayload.sourceLocator),
      claimCandidateRef: claimCandidate.ref,
      compilationResultRef: result.ref,
      sourceFaithfulReviewRef: review.ref,
      authorityClass: 'SOURCE_ASSERTION'
    };
    const claimRef = predictedRef('Claim', claimLogicalId, claimVersion, claimPayload);

    const sourceContextPayload = {
      claimRef,
      sourceRef: upstream.source.ref,
      sourceArtifactRef: upstream.artifact.ref,
      sourceArtifactContentHash: upstream.artifact.semanticPayload.contentHash,
      contextFamilies: finalContextFamilies,
      sourceContextCandidateRef: sourceContextCandidate.ref,
      compilationResultRef: result.ref,
      sourceFaithfulReviewRef: review.ref,
      authorityClass: 'SOURCE_CONTEXT'
    };

    const [claim, sourceContext] = this.#ledger.publishBatch([
      {
        kind: 'Claim',
        logicalId: requiredText(claimLogicalId, 'claimLogicalId'),
        version: requiredText(claimVersion, 'claimVersion'),
        semanticPayload: claimPayload,
        audit: auditEvent(audit, 'claim', [review.ref, authAudit.ref, result.ref, claimCandidate.ref])
      },
      {
        kind: 'SourceContext',
        logicalId: requiredText(sourceContextLogicalId, 'sourceContextLogicalId'),
        version: requiredText(sourceContextVersion, 'sourceContextVersion'),
        semanticPayload: sourceContextPayload,
        audit: auditEvent(audit, 'source-context', [review.ref, authAudit.ref, result.ref, sourceContextCandidate.ref, claimRef])
      }
    ]);

    this.#ledger.addLineage({
      relation: 'derived_from',
      from: claim.ref,
      to: claimCandidate.ref,
      details: { authorityTransition: 'CANDIDATE_TO_SOURCE_ASSERTION' },
      audit: auditEvent(audit, 'claim-lineage', [review.ref, authAudit.ref])
    });
    this.#ledger.addLineage({
      relation: 'derived_from',
      from: sourceContext.ref,
      to: sourceContextCandidate.ref,
      details: { authorityTransition: 'CANDIDATE_TO_SOURCE_CONTEXT' },
      audit: auditEvent(audit, 'context-lineage', [review.ref, authAudit.ref])
    });

    return deepFreeze({ review, claim, sourceContext });
  }
}
