import { semanticHash } from '../../../../packages/canonicalization/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../../../packages/authorization/src/index.mjs';
import {
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  AutomatedSourceFaithfulReviewError,
  DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY,
  adjudicateAutomatedSourceFaithfulReviewProposal,
  buildAutomatedSourceFaithfulBlindPacket,
  materializeAutomatedSourceFaithfulReviewProposal
} from '../../../../packages/knowledge-registry/src/automated-source-faithful.mjs';

export const PILOT_AUTOMATED_REVIEW_AUTHORITY = 'AUTOMATED_SOURCE_FAITHFUL_REVIEW';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function reviewerPrincipalId(metadata) {
  const hash = semanticHash('ADR-AutomatedReviewerIdentity-v1', {
    provider: metadata.provider,
    model: metadata.model,
    promptVersion: metadata.promptVersion,
    schemaVersion: metadata.schemaVersion
  }).replace(/^sha256:/, '').slice(0, 20);
  return `automated-source-reviewer-${hash}`;
}

export class PilotAutomatedSourceFaithfulReviewAdapter {
  #ledger;
  #reviewService;
  #authorizationByIdentityAndSource = new Map();

  constructor({ ledger }) {
    if (!ledger || typeof ledger.resolve !== 'function') {
      throw new AutomatedSourceFaithfulReviewError('INVALID_LEDGER', 'shared AuthorityLedger is required');
    }
    this.#ledger = ledger;
    this.#reviewService = new SourceFaithfulReviewService({ ledger });
  }

  blindPacket({ compilationResultRef, claimCandidateRef, sourceContextCandidateRef }) {
    return buildAutomatedSourceFaithfulBlindPacket({
      ledger: this.#ledger,
      compilationResultRef,
      claimCandidateRef,
      sourceContextCandidateRef
    });
  }

  #audit(eventId, principal, inputRefs = [], details = {}) {
    return {
      eventId,
      occurredAt: new Date().toISOString(),
      actor: { type: principal.type, id: principal.principalId },
      inputRefs,
      details: {
        channel: 'pilot-api-automated-source-faithful-review',
        reviewAuthority: PILOT_AUTOMATED_REVIEW_AUTHORITY,
        ...details
      }
    };
  }

  #authorizationFor(source, reviewerMetadata) {
    const identityKey = semanticHash('ADR-AutomatedReviewerAuthorizationKey-v1', {
      sourceRef: source.ref,
      reviewerMetadata
    });
    const existing = this.#authorizationByIdentityAndSource.get(identityKey);
    if (existing) return existing;

    const ownership = source.semanticPayload.ownership;
    const reviewer = createPrincipal({
      principalId: reviewerPrincipalId(reviewerMetadata),
      type: 'SERVICE_ACCOUNT',
      organizationId: ownership.organizationId,
      ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
    });
    const scope = {
      organizationId: ownership.organizationId,
      ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
    };
    const suffix = identityKey.replace(/^sha256:/, '').slice(0, 16);
    const roleAssignment = publishBuiltinRoleAssignment({
      ledger: this.#ledger,
      logicalId: `role.automated-source-review.${suffix}`,
      version: '1',
      principal: reviewer,
      role: 'AGRONOMY_REVIEWER',
      scope,
      audit: this.#audit(`evt-auto-review-role:${suffix}`, reviewer, [], { reviewerMetadata })
    });
    const policy = publishKnowledgeGovernancePolicy({
      ledger: this.#ledger,
      logicalId: `policy.automated-source-review.${suffix}`,
      version: '1',
      resourceId: sourceReviewResourceId(source.ref),
      ownership,
      visibilityPolicy: [{ principalId: reviewer.principalId }],
      qualificationScope: [{ use: '*' }],
      deploymentScope: [{ organizationId: ownership.organizationId }],
      audit: this.#audit(`evt-auto-review-policy:${suffix}`, reviewer, [roleAssignment.ref], { reviewerMetadata })
    });
    const decision = authorizeKnowledgeInspection({
      principal: reviewer,
      policy,
      roleAssignments: [roleAssignment],
      authorizationScope: scope
    });
    const authorizationAudit = recordAuthorizationDecision({
      ledger: this.#ledger,
      decision,
      audit: this.#audit(`evt-auto-review-auth:${suffix}`, reviewer, [policy.ref, roleAssignment.ref], { reviewerMetadata })
    });
    const prepared = { reviewer, authorizationAudit };
    this.#authorizationByIdentityAndSource.set(identityKey, prepared);
    return prepared;
  }

  review({
    compilationResultRef,
    claimCandidateRef,
    sourceContextCandidateRef,
    reviewerMetadata,
    output,
    policy = DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY,
    version = `auto-review-${new Date().toISOString()}`
  }) {
    const blind = this.blindPacket({ compilationResultRef, claimCandidateRef, sourceContextCandidateRef });
    const proposalVersion = requiredText(version, 'version');
    const proposal = materializeAutomatedSourceFaithfulReviewProposal({
      ledger: this.#ledger,
      logicalId: `automated-review-proposal.${claimCandidateRef.logicalId}`,
      version: proposalVersion,
      compilationResultRef,
      claimCandidateRef,
      sourceContextCandidateRef,
      blindInputHash: blind.blindInputHash,
      reviewerMetadata,
      proposedDisposition: output.disposition,
      reasonCodes: output.reasonCodes ?? [],
      rationale: output.rationale,
      reviewConfidence: output.reviewConfidence,
      checks: output.checks,
      contextAdjudication: output.contextAdjudication ?? null,
      audit: {
        eventId: `evt-auto-review-proposal:${claimCandidateRef.semanticHash}:${proposalVersion}`,
        occurredAt: new Date().toISOString(),
        actor: { type: 'SERVICE_ACCOUNT', id: reviewerPrincipalId(reviewerMetadata) },
        details: {
          channel: 'pilot-api-automated-source-faithful-review-proposal',
          reviewAuthority: 'PROPOSAL_ONLY'
        }
      }
    });

    const adjudication = adjudicateAutomatedSourceFaithfulReviewProposal({
      ledger: this.#ledger,
      proposalRef: proposal.ref,
      policy
    });

    if (adjudication.effectiveDisposition === 'ESCALATE_TO_HUMAN') {
      return {
        proposal,
        adjudication,
        review: null,
        claim: null,
        sourceContext: null,
        authorityClaim: 'ESCALATION_ONLY_NO_SOURCE_ASSERTION'
      };
    }

    const claimCandidate = this.#ledger.resolve(claimCandidateRef);
    const source = this.#ledger.resolve(claimCandidate.semanticPayload.sourceRef);
    const auth = this.#authorizationFor(source, reviewerMetadata);
    const suffix = claimCandidate.ref.semanticHash.replace(/^sha256:/, '').slice(0, 16);
    const automatedReview = this.#reviewService.reviewCandidate({
      reviewLogicalId: `review.pilot.${claimCandidate.ref.logicalId}`,
      reviewVersion: proposalVersion,
      compilationResultRef,
      claimCandidateRef,
      sourceContextCandidateRef,
      disposition: adjudication.effectiveDisposition,
      reasonCodes: output.reasonCodes ?? [],
      rationale: output.rationale,
      ...(adjudication.effectiveDisposition === 'ACCEPT_SOURCE_FAITHFUL'
        ? { contextAdjudication: output.contextAdjudication }
        : {}),
      reviewPrincipal: auth.reviewer,
      authorizationDecisionAuditRef: auth.authorizationAudit.ref,
      claimLogicalId: `claim.pilot.${suffix}`,
      claimVersion: '1',
      sourceContextLogicalId: `source-context.pilot.${suffix}`,
      sourceContextVersion: '1',
      audit: this.#audit(
        `evt-auto-review-promote:${suffix}:${proposalVersion}`,
        auth.reviewer,
        [proposal.ref],
        {
          reviewerMetadata,
          automatedReviewProposalRef: proposal.ref,
          deterministicPromotion: adjudication.promotionAuthority
        }
      )
    });

    return {
      proposal,
      adjudication,
      review: automatedReview.review,
      claim: automatedReview.claim,
      sourceContext: automatedReview.sourceContext,
      authorityClaim: automatedReview.claim ? 'SOURCE_ASSERTION' : 'AUTOMATED_REVIEW_DECISION_ONLY'
    };
  }
}
