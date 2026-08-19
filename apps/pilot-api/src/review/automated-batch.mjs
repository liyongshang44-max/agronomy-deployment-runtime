import { sameAuthorityRef } from '../../../../packages/contracts/src/authority.mjs';
import {
  AutomatedSourceFaithfulReviewError,
  adjudicateAutomatedSourceFaithfulReviewProposal
} from '../../../../packages/knowledge-registry/src/automated-source-faithful.mjs';
import { listRecoverableCompilations } from '../recovery/compilation-recovery.mjs';

export const PILOT_AUTOMATED_REVIEW_BATCH_VERSION = 'adr.pilot.automated-source-faithful-batch.v1';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function matchingAutomatedProposals(ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef) {
  return ledger.exportSnapshot().records
    .filter((record) => record.ref.kind === 'AutomatedSourceFaithfulReviewProposal')
    .filter((record) => sameAuthorityRef(record.semanticPayload?.compilationResultRef, compilationResultRef)
      && sameAuthorityRef(record.semanticPayload?.claimCandidateRef, claimCandidateRef)
      && sameAuthorityRef(record.semanticPayload?.sourceContextCandidateRef, sourceContextCandidateRef))
    .sort((left, right) => String(left.ref.version).localeCompare(String(right.ref.version)));
}

function latestAutomatedState(ledger, compilationResultRef, candidate) {
  const proposals = matchingAutomatedProposals(
    ledger,
    compilationResultRef,
    candidate.claimCandidateRef,
    candidate.sourceContextCandidateRef
  );
  if (proposals.length === 0) return null;
  const proposal = proposals.at(-1);
  const adjudication = adjudicateAutomatedSourceFaithfulReviewProposal({ ledger, proposalRef: proposal.ref });
  return { proposalRef: proposal.ref, adjudication };
}

export class PilotAutomatedSourceFaithfulBatchService {
  #ledger;
  #sourceRegistry;
  #adapter;

  constructor({ ledger, sourceRegistry, adapter }) {
    if (!ledger || typeof ledger.exportSnapshot !== 'function' || typeof ledger.resolve !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('INVALID_LEDGER', 'automated review batch requires AuthorityLedger');
    }
    if (!sourceRegistry || typeof sourceRegistry.resolveArtifact !== 'function' || typeof sourceRegistry.readArtifactStream !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('INVALID_SOURCE_REGISTRY', 'automated review batch requires streaming SourceRegistry');
    }
    if (!adapter || typeof adapter.blindPacket !== 'function' || typeof adapter.review !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_ADAPTER', 'automated review batch requires PilotAutomatedSourceFaithfulReviewAdapter');
    }
    this.#ledger = ledger;
    this.#sourceRegistry = sourceRegistry;
    this.#adapter = adapter;
  }

  async run({
    sourceArtifactRef,
    compilationResultRef,
    filename,
    reviewer,
    retryEscalated = false,
    versionPrefix = `auto-${new Date().toISOString()}`,
    onCandidateComplete = null
  }) {
    if (typeof reviewer !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_PROVIDER_REQUIRED', 'reviewer callback is required');
    }
    if (onCandidateComplete !== null && typeof onCandidateComplete !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_PROGRESS_HANDLER', 'onCandidateComplete must be a function');
    }
    const safeFilename = requiredText(filename, 'filename');
    const safePrefix = requiredText(versionPrefix, 'versionPrefix');
    const artifact = this.#sourceRegistry.resolveArtifact(sourceArtifactRef);
    const recovered = listRecoverableCompilations({ ledger: this.#ledger, sourceArtifactRef: artifact.ref });
    const compilation = recovered.compilations.find((item) => sameAuthorityRef(item.compilationResultRef, compilationResultRef));
    if (!compilation) {
      throw new AutomatedSourceFaithfulReviewError('COMPILATION_NOT_BOUND_TO_SOURCE_ARTIFACT', 'requested compilation does not belong to exact SourceArtifact');
    }

    const results = [];
    for (let index = 0; index < compilation.candidates.length; index += 1) {
      const candidate = compilation.candidates[index];
      if (candidate.review) {
        results.push({
          index,
          claimCandidateRef: candidate.claimCandidateRef,
          status: 'SKIPPED_ALREADY_REVIEWED',
          reviewRef: candidate.review.reviewRef,
          disposition: candidate.review.disposition
        });
        continue;
      }

      const priorAutomated = latestAutomatedState(this.#ledger, compilation.compilationResultRef, candidate);
      if (priorAutomated && priorAutomated.adjudication.effectiveDisposition === 'ESCALATE_TO_HUMAN' && retryEscalated !== true) {
        results.push({
          index,
          claimCandidateRef: candidate.claimCandidateRef,
          status: 'ESCALATED_PENDING_HUMAN',
          automatedReviewProposalRef: priorAutomated.proposalRef,
          promotionReasons: priorAutomated.adjudication.promotionReasons
        });
        continue;
      }
      if (priorAutomated && priorAutomated.adjudication.effectiveDisposition !== 'ESCALATE_TO_HUMAN') {
        throw new AutomatedSourceFaithfulReviewError(
          'AUTOMATED_REVIEW_PROMOTION_INCOMPLETE',
          'non-escalated automated proposal exists without terminal SourceFaithfulReviewDecision; explicit recovery is required'
        );
      }

      const blind = this.#adapter.blindPacket({
        compilationResultRef: compilation.compilationResultRef,
        claimCandidateRef: candidate.claimCandidateRef,
        sourceContextCandidateRef: candidate.sourceContextCandidateRef
      });
      const readable = this.#sourceRegistry.readArtifactStream(artifact.ref);
      const provider = await reviewer({
        readable,
        byteLength: artifact.semanticPayload.byteLength,
        filename: safeFilename,
        blindPacket: blind.packet,
        candidateIndex: index
      });
      if (!provider || typeof provider !== 'object' || !provider.reviewerMetadata || !provider.output) {
        throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_PROVIDER_OUTPUT_INVALID', 'reviewer callback must return reviewerMetadata and output');
      }
      const version = `${safePrefix}-${String(index + 1).padStart(4, '0')}`;
      const reviewed = this.#adapter.review({
        compilationResultRef: compilation.compilationResultRef,
        claimCandidateRef: candidate.claimCandidateRef,
        sourceContextCandidateRef: candidate.sourceContextCandidateRef,
        reviewerMetadata: provider.reviewerMetadata,
        output: provider.output,
        version
      });
      const status = reviewed.adjudication.effectiveDisposition === 'ACCEPT_SOURCE_FAITHFUL'
        ? 'AUTO_ACCEPTED'
        : reviewed.adjudication.effectiveDisposition === 'REJECT_SOURCE_FAITHFUL'
          ? 'AUTO_REJECTED'
          : 'ESCALATED_TO_HUMAN';
      const item = {
        index,
        claimCandidateRef: candidate.claimCandidateRef,
        status,
        effectiveDisposition: reviewed.adjudication.effectiveDisposition,
        automatedReviewProposalRef: reviewed.proposal.ref,
        reviewRef: reviewed.review?.ref ?? null,
        claimRef: reviewed.claim?.ref ?? null,
        sourceContextRef: reviewed.sourceContext?.ref ?? null,
        promotionReasons: reviewed.adjudication.promotionReasons,
        providerTrace: provider.providerTrace ?? null
      };
      results.push(item);
      if (onCandidateComplete) await onCandidateComplete(item);
    }

    const count = (status) => results.filter((item) => item.status === status).length;
    return {
      version: PILOT_AUTOMATED_REVIEW_BATCH_VERSION,
      sourceArtifactRef: artifact.ref,
      compilationResultRef: compilation.compilationResultRef,
      candidateCount: compilation.candidateCount,
      autoAcceptedCount: count('AUTO_ACCEPTED'),
      autoRejectedCount: count('AUTO_REJECTED'),
      escalatedCount: count('ESCALATED_TO_HUMAN') + count('ESCALATED_PENDING_HUMAN'),
      skippedReviewedCount: count('SKIPPED_ALREADY_REVIEWED'),
      results,
      authorityClaim: 'AUTOMATED_REVIEW_BATCH_IS_NOT_SCIENTIFIC_QUALIFICATION'
    };
  }
}
