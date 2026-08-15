import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';

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
    throw new SourceFaithfulReviewError(
      'COMPILATION_PROVENANCE_MISMATCH',
      'SourceArtifact content hash differs between completed compilation result and selected candidate'
    );
  }
}

function stripExtractionConfidenceFromContext(contextFamilies) {
  const normalized = {};
  for (const [family, familyValue] of Object.entries(contextFamilies ?? {})) {
    normalized[family] = {
      status: familyValue.status,
      dimensions: (familyValue.dimensions ?? []).map((dimension) => {
        const { confidence: _extractionConfidence, ...sourceFaithfulDimension } = dimension;
        return cloneCanonicalValue(sourceFaithfulDimension);
      })
    };
  }
  return deepFreeze(normalized);
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

export class SourceFaithfulReviewService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.addLineage !== 'function') {
      throw new SourceFaithfulReviewError('INVALID_LEDGER', 'SourceFaithfulReviewService requires the shared AuthorityLedger');
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
    const sourceContextCandidate = resolveKind(
      this.#ledger,
      sourceContextCandidateRef,
      'SourceContextCandidate',
      'SOURCE_CONTEXT_CANDIDATE_REQUIRED'
    );

    assertCandidatePair({ result, claimCandidate, sourceContextCandidate });

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
        sourceRef: claimCandidate.semanticPayload.sourceRef,
        sourceArtifactRef: claimCandidate.semanticPayload.sourceArtifactRef,
        sourceArtifactContentHash: claimCandidate.semanticPayload.sourceArtifactContentHash,
        compilerDefinitionRef: claimCandidate.semanticPayload.compilerDefinitionRef,
        disposition: normalizedDisposition,
        reasonCodes: normalizedReasons,
        ...(rationale ? { rationale: requiredText(rationale, 'rationale') } : {}),
        authorityClass: 'SOURCE_FAITHFUL_REVIEW'
      },
      audit: auditEvent(audit, 'review', [result.ref, claimCandidate.ref, sourceContextCandidate.ref])
    });

    if (normalizedDisposition === 'REJECT_SOURCE_FAITHFUL') {
      return deepFreeze({ review, claim: null, sourceContext: null });
    }

    const claim = this.#ledger.publish({
      kind: 'Claim',
      logicalId: requiredText(claimLogicalId, 'claimLogicalId'),
      version: requiredText(claimVersion, 'claimVersion'),
      semanticPayload: {
        claimType: claimCandidate.semanticPayload.claimType,
        assertion: claimCandidate.semanticPayload.assertion,
        ...(claimCandidate.semanticPayload.structured !== undefined
          ? { structured: cloneCanonicalValue(claimCandidate.semanticPayload.structured) }
          : {}),
        sourceRef: claimCandidate.semanticPayload.sourceRef,
        sourceArtifactRef: claimCandidate.semanticPayload.sourceArtifactRef,
        sourceArtifactContentHash: claimCandidate.semanticPayload.sourceArtifactContentHash,
        sourceLocator: cloneCanonicalValue(claimCandidate.semanticPayload.sourceLocator),
        claimCandidateRef: claimCandidate.ref,
        compilationResultRef: result.ref,
        sourceFaithfulReviewRef: review.ref,
        authorityClass: 'SOURCE_ASSERTION'
      },
      audit: auditEvent(audit, 'claim', [review.ref, result.ref, claimCandidate.ref])
    });

    const sourceContext = this.#ledger.publish({
      kind: 'SourceContext',
      logicalId: requiredText(sourceContextLogicalId, 'sourceContextLogicalId'),
      version: requiredText(sourceContextVersion, 'sourceContextVersion'),
      semanticPayload: {
        claimRef: claim.ref,
        sourceRef: sourceContextCandidate.semanticPayload.sourceRef,
        sourceArtifactRef: sourceContextCandidate.semanticPayload.sourceArtifactRef,
        sourceArtifactContentHash: sourceContextCandidate.semanticPayload.sourceArtifactContentHash,
        contextFamilies: stripExtractionConfidenceFromContext(sourceContextCandidate.semanticPayload.contextFamilies),
        sourceContextCandidateRef: sourceContextCandidate.ref,
        compilationResultRef: result.ref,
        sourceFaithfulReviewRef: review.ref,
        authorityClass: 'SOURCE_CONTEXT'
      },
      audit: auditEvent(audit, 'source-context', [review.ref, result.ref, sourceContextCandidate.ref, claim.ref])
    });

    this.#ledger.addLineage({
      relation: 'derived_from',
      from: claim.ref,
      to: claimCandidate.ref,
      details: { authorityTransition: 'CANDIDATE_TO_SOURCE_ASSERTION' },
      audit: auditEvent(audit, 'claim-lineage', [review.ref])
    });
    this.#ledger.addLineage({
      relation: 'derived_from',
      from: sourceContext.ref,
      to: sourceContextCandidate.ref,
      details: { authorityTransition: 'CANDIDATE_TO_SOURCE_CONTEXT' },
      audit: auditEvent(audit, 'context-lineage', [review.ref])
    });

    return deepFreeze({ review, claim, sourceContext });
  }
}
