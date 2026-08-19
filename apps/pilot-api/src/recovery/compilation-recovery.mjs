import { sameAuthorityRef } from '../../../../packages/contracts/src/authority.mjs';
import { AuthorityLedgerError } from '../../../../packages/provenance/src/index.mjs';
import { adjudicateAutomatedSourceFaithfulReviewProposal } from '../../../../packages/knowledge-registry/src/automated-source-faithful.mjs';

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

function authorityForReview(records, kind, reviewRef) {
  const matches = records.filter((record) => record.ref.kind === kind
    && record.semanticPayload?.sourceFaithfulReviewRef
    && sameAuthorityRef(record.semanticPayload.sourceFaithfulReviewRef, reviewRef));
  if (matches.length > 1) {
    throw new PilotCompilationRecoveryError(
      'RECOVERED_REVIEW_AUTHORITY_AMBIGUOUS',
      `review ${reviewRef.logicalId}@${reviewRef.version} resolves to multiple ${kind} authorities`
    );
  }
  return matches[0] ?? null;
}

function latestAutomatedProposal(proposalRecords, compilationRef, claimRef, contextRef) {
  const matches = proposalRecords.filter((record) => {
    const payload = record.semanticPayload;
    return sameAuthorityRef(payload.compilationResultRef, compilationRef)
      && sameAuthorityRef(payload.claimCandidateRef, claimRef)
      && sameAuthorityRef(payload.sourceContextCandidateRef, contextRef);
  });
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => String(a.ref.version).localeCompare(String(b.ref.version))).at(-1);
}

function automatedPayload(ledger, proposal, review) {
  if (!proposal) return null;
  const adjudication = adjudicateAutomatedSourceFaithfulReviewProposal({ ledger, proposalRef: proposal.ref });
  const effectiveDisposition = adjudication.effectiveDisposition;
  let status;
  if (review) status = 'TERMINAL_REVIEW_MATERIALIZED';
  else if (effectiveDisposition === 'ESCALATE_TO_HUMAN') status = 'ESCALATED_PENDING_HUMAN';
  else status = 'PROMOTION_INCOMPLETE';
  return {
    proposalRef: proposal.ref,
    proposedDisposition: proposal.semanticPayload.proposedDisposition,
    effectiveDisposition,
    status,
    reasonCodes: proposal.semanticPayload.reasonCodes ?? [],
    rationale: proposal.semanticPayload.rationale ?? null,
    reviewConfidence: proposal.semanticPayload.reviewConfidence ?? null,
    reviewerMetadata: proposal.semanticPayload.reviewerMetadata ?? null,
    promotionReasons: adjudication.promotionReasons
  };
}

function candidatePayload(ledger, claimRecord, contextRecord, review, automatedProposal, records) {
  let reviewPayload = null;
  if (review) {
    const claim = authorityForReview(records, 'Claim', review.ref);
    const sourceContext = authorityForReview(records, 'SourceContext', review.ref);
    const disposition = review.semanticPayload.disposition;
    if (disposition === 'ACCEPT_SOURCE_FAITHFUL' && (!claim || !sourceContext)) {
      throw new PilotCompilationRecoveryError(
        'RECOVERED_ACCEPT_AUTHORITY_INCOMPLETE',
        'accepted source-faithful review must recover exact Claim and SourceContext authority'
      );
    }
    if (disposition === 'REJECT_SOURCE_FAITHFUL' && (claim || sourceContext)) {
      throw new PilotCompilationRecoveryError(
        'RECOVERED_REJECT_AUTHORITY_FORBIDDEN',
        'rejected source-faithful review must not recover Claim or SourceContext authority'
      );
    }
    reviewPayload = {
      reviewRef: review.ref,
      disposition,
      reasonCodes: review.semanticPayload.reasonCodes ?? [],
      rationale: review.semanticPayload.rationale ?? null,
      claimRef: claim?.ref ?? null,
      sourceContextRef: sourceContext?.ref ?? null
    };
  }
  return {
    claimCandidateRef: claimRecord.ref,
    sourceContextCandidateRef: contextRecord.ref,
    claimType: claimRecord.semanticPayload.claimType,
    assertion: claimRecord.semanticPayload.assertion,
    sourceLocator: claimRecord.semanticPayload.sourceLocator,
    extractionConfidence: claimRecord.semanticPayload.extractionConfidence ?? null,
    contextFamilies: contextRecord.semanticPayload.contextFamilies,
    automatedReview: automatedPayload(ledger, automatedProposal, review),
    review: reviewPayload
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

function materializeRecoveredCompilation({ ledger, result, records, reviewRecords, automatedProposalRecords }) {
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
    const automatedProposal = latestAutomatedProposal(automatedProposalRecords, result.ref, claim.ref, context.ref);
    return candidatePayload(ledger, claim, context, review, automatedProposal, records);
  });

  const runMetadata = result.semanticPayload.runMetadata ?? {};
  return {
    compilationResultRef: result.ref,
    logicalId: result.ref.logicalId,
    version: result.ref.version,
    runMetadata,
    candidateCount: candidates.length,
    reviewedCount: candidates.filter((candidate) => candidate.review).length,
    acceptedCount: candidates.filter((candidate) => candidate.review?.disposition === 'ACCEPT_SOURCE_FAITHFUL').length,
    rejectedCount: candidates.filter((candidate) => candidate.review?.disposition === 'REJECT_SOURCE_FAITHFUL').length,
    escalatedPendingHumanCount: candidates.filter((candidate) => candidate.automatedReview?.status === 'ESCALATED_PENDING_HUMAN').length,
    promotionIncompleteCount: candidates.filter((candidate) => candidate.automatedReview?.status === 'PROMOTION_INCOMPLETE').length,
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
  const records = snapshot.records;
  const reviews = records.filter((record) => record.ref.kind === 'SourceFaithfulReviewDecision');
  const automatedProposals = records.filter((record) => record.ref.kind === 'AutomatedSourceFaithfulReviewProposal');
  const results = records
    .filter((record) => record.ref.kind === 'ScientificCompilationResult')
    .filter((record) => sameAuthorityRef(record.semanticPayload.sourceArtifactRef, artifact.ref))
    .map((result) => materializeRecoveredCompilation({
      ledger,
      result,
      records,
      reviewRecords: reviews,
      automatedProposalRecords: automatedProposals
    }))
    .sort((a, b) => String(b.version).localeCompare(String(a.version)));

  return {
    sourceArtifactRef: artifact.ref,
    compilationCount: results.length,
    compilations: results
  };
}
