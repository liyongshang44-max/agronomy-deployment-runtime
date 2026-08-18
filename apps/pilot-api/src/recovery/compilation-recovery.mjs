import { sameAuthorityRef } from '../../../../packages/contracts/src/authority.mjs';
import { AuthorityLedgerError } from '../../../../packages/provenance/src/index.mjs';

export class PilotCompilationRecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PilotCompilationRecoveryError';
    this.code = code;
  }
}

function assertLedger(ledger) {
  if (!ledger || typeof ledger.exportSnapshot !== 'function' || typeof ledger.resolve !== 'function') {
    throw new PilotCompilationRecoveryError('INVALID_LEDGER', 'compilation recovery requires AuthorityLedger exportSnapshot/resolve');
  }
}

function candidatePayload(claimRecord, contextRecord, review) {
  return {
    claimCandidateRef: claimRecord.ref,
    sourceContextCandidateRef: contextRecord.ref,
    claimType: claimRecord.semanticPayload.claimType,
    assertion: claimRecord.semanticPayload.assertion,
    sourceLocator: claimRecord.semanticPayload.sourceLocator,
    extractionConfidence: claimRecord.semanticPayload.extractionConfidence ?? null,
    contextFamilies: contextRecord.semanticPayload.contextFamilies,
    review: review ? {
      reviewRef: review.ref,
      disposition: review.semanticPayload.disposition,
      reasonCodes: review.semanticPayload.reasonCodes ?? [],
      rationale: review.semanticPayload.rationale ?? null
    } : null
  };
}

function matchingReview(reviewRecords, compilationRef, claimRef, contextRef) {
  const matches = reviewRecords.filter((record) => {
    const payload = record.semanticPayload;
    return sameAuthorityRef(payload.compilationResultRef, compilationRef)
      && sameAuthorityRef(payload.claimCandidateRef, claimRef)
      && sameAuthorityRef(payload.sourceContextCandidateRef, contextRef);
  });
  if (matches.length <= 1) return matches[0] ?? null;
  return [...matches].sort((a, b) => String(a.ref.version).localeCompare(String(b.ref.version))).at(-1);
}

function materializeRecoveredCompilation({ ledger, result, reviewRecords }) {
  const claimRefs = result.semanticPayload.claimCandidateRefs;
  const contextRefs = result.semanticPayload.sourceContextCandidateRefs;
  if (!Array.isArray(claimRefs) || !Array.isArray(contextRefs) || claimRefs.length !== contextRefs.length) {
    throw new PilotCompilationRecoveryError(
      'COMPILATION_CANDIDATE_PAIR_INVALID',
      `ScientificCompilationResult ${result.ref.logicalId}@${result.ref.version} has invalid candidate/context pairing`
    );
  }

  const candidates = claimRefs.map((claimRef, index) => {
    const contextRef = contextRefs[index];
    const claim = ledger.resolve(claimRef);
    const context = ledger.resolve(contextRef);
    if (claim.ref.kind !== 'ClaimCandidate' || context.ref.kind !== 'SourceContextCandidate') {
      throw new PilotCompilationRecoveryError('COMPILATION_CANDIDATE_KIND_INVALID', 'recovered compilation refs do not resolve to candidate kinds');
    }
    if (!sameAuthorityRef(context.semanticPayload.claimCandidateRef, claim.ref)) {
      throw new PilotCompilationRecoveryError('COMPILATION_CANDIDATE_PAIR_MISMATCH', 'recovered SourceContextCandidate does not bind the paired ClaimCandidate');
    }
    const review = matchingReview(reviewRecords, result.ref, claim.ref, context.ref);
    return candidatePayload(claim, context, review);
  });

  const runMetadata = result.semanticPayload.runMetadata ?? {};
  return {
    compilationResultRef: result.ref,
    logicalId: result.ref.logicalId,
    version: result.ref.version,
    runMetadata,
    candidateCount: candidates.length,
    reviewedCount: candidates.filter((candidate) => candidate.review).length,
    candidates,
    authorityClaim: 'PROPOSAL_ONLY'
  };
}

export function listRecoverableCompilations({ ledger, sourceArtifactRef }) {
  assertLedger(ledger);
  let artifact;
  try {
    artifact = ledger.resolve(sourceArtifactRef);
  } catch (error) {
    if (error instanceof AuthorityLedgerError) {
      throw new PilotCompilationRecoveryError('SOURCE_ARTIFACT_AUTHORITY_REQUIRED', error.message);
    }
    throw error;
  }
  if (artifact.ref.kind !== 'SourceArtifact') {
    throw new PilotCompilationRecoveryError('SOURCE_ARTIFACT_AUTHORITY_REQUIRED', 'recovery requires an exact SourceArtifact ref');
  }

  const snapshot = ledger.exportSnapshot();
  const reviews = snapshot.records.filter((record) => record.ref.kind === 'SourceFaithfulReviewDecision');
  const results = snapshot.records
    .filter((record) => record.ref.kind === 'ScientificCompilationResult')
    .filter((record) => sameAuthorityRef(record.semanticPayload.sourceArtifactRef, artifact.ref))
    .map((result) => materializeRecoveredCompilation({ ledger, result, reviewRecords: reviews }))
    .sort((a, b) => String(b.version).localeCompare(String(a.version)));

  return {
    sourceArtifactRef: artifact.ref,
    compilationCount: results.length,
    compilations: results
  };
}
