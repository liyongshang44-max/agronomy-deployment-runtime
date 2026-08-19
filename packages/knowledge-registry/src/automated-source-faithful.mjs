import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';

export const AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT = 'adr.automated-source-faithful-review.v1';
export const AUTOMATED_SOURCE_FAITHFUL_REVIEW_AUTHORITY = 'AUTOMATED_SOURCE_FAITHFUL_REVIEW_PROPOSAL_ONLY';
export const AUTOMATED_SOURCE_FAITHFUL_REVIEW_PROMOTION = 'DETERMINISTIC_POLICY_PROMOTION_V1';

export const AUTOMATED_SOURCE_FAITHFUL_PROPOSED_DISPOSITIONS = deepFreeze([
  'ACCEPT_SOURCE_FAITHFUL',
  'REJECT_SOURCE_FAITHFUL',
  'ESCALATE_TO_HUMAN'
]);

export const AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS = deepFreeze([
  'ASSERTION_SUPPORT',
  'CONTEXT_COMPLETENESS',
  'EVIDENCE_COVERAGE',
  'CAUSALITY_FIDELITY',
  'TEMPORAL_FIDELITY',
  'POPULATION_FIDELITY',
  'GEOGRAPHY_FIDELITY',
  'MANAGEMENT_FIDELITY',
  'MEASUREMENT_FIDELITY',
  'CLAIM_ATOMICITY',
  'UNSUPPORTED_INFERENCE'
]);

const DISPOSITION_SET = new Set(AUTOMATED_SOURCE_FAITHFUL_PROPOSED_DISPOSITIONS);

export const DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY = deepFreeze({
  contractVersion: AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT,
  minAutoAcceptConfidence: 0.95,
  minAutoRejectConfidence: 0.90,
  requireIndependentReviewer: true,
  requireBlindPacket: true,
  acceptRequiresAllChecksPass: true,
  rejectRequiresAtLeastOneFailedCheck: true,
  uncertainOutcome: 'ESCALATE_TO_HUMAN'
});

export class AutomatedSourceFaithfulReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AutomatedSourceFaithfulReviewError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_CONFIDENCE', 'reviewConfidence must be between 0 and 1');
  }
  return value;
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new AutomatedSourceFaithfulReviewError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function includesExactRef(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function normalizeReasonCodes(values) {
  if (!Array.isArray(values)) throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_REASON', 'reasonCodes must be an array');
  return deepFreeze([...new Set(values.map((value) => requiredText(value, 'reasonCode')))].sort());
}

function normalizeChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_CHECKS', 'checks must be an object');
  }
  const actual = Object.keys(value).sort();
  const expected = [...AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_CHECK_SET_INCOMPLETE', `checks must contain exactly: ${expected.join(', ')}`);
  }
  const output = {};
  for (const key of AUTOMATED_SOURCE_FAITHFUL_REVIEW_CHECKS) {
    const status = requiredText(value[key], `checks.${key}`);
    if (!['PASS', 'FAIL'].includes(status)) {
      throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_CHECK', `checks.${key} must be PASS or FAIL`);
    }
    output[key] = status;
  }
  return deepFreeze(output);
}

function normalizeReviewerMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEWER_METADATA_REQUIRED', 'reviewerMetadata is required');
  }
  return deepFreeze({
    provider: requiredText(value.provider, 'reviewerMetadata.provider'),
    model: requiredText(value.model, 'reviewerMetadata.model'),
    promptVersion: requiredText(value.promptVersion, 'reviewerMetadata.promptVersion'),
    schemaVersion: requiredText(value.schemaVersion, 'reviewerMetadata.schemaVersion'),
    reviewMode: requiredText(value.reviewMode, 'reviewerMetadata.reviewMode')
  });
}

function assertCandidatePair({ ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef }) {
  const result = resolveKind(ledger, compilationResultRef, 'ScientificCompilationResult', 'COMPILATION_RESULT_REQUIRED');
  const claimCandidate = resolveKind(ledger, claimCandidateRef, 'ClaimCandidate', 'CLAIM_CANDIDATE_REQUIRED');
  const sourceContextCandidate = resolveKind(ledger, sourceContextCandidateRef, 'SourceContextCandidate', 'SOURCE_CONTEXT_CANDIDATE_REQUIRED');
  if (result.semanticPayload?.outputAuthority !== 'PROPOSAL_ONLY') {
    throw new AutomatedSourceFaithfulReviewError('INVALID_COMPILATION_RESULT', 'ScientificCompilationResult must remain PROPOSAL_ONLY');
  }
  if (!includesExactRef(result.semanticPayload.claimCandidateRefs, claimCandidate.ref)
    || !includesExactRef(result.semanticPayload.sourceContextCandidateRefs, sourceContextCandidate.ref)) {
    throw new AutomatedSourceFaithfulReviewError('CANDIDATE_NOT_IN_COMPILATION', 'candidate pair must belong to exact ScientificCompilationResult');
  }
  if (!sameAuthorityRef(sourceContextCandidate.semanticPayload.claimCandidateRef, claimCandidate.ref)) {
    throw new AutomatedSourceFaithfulReviewError('CANDIDATE_PAIR_MISMATCH', 'SourceContextCandidate does not belong to ClaimCandidate');
  }
  for (const name of ['sourceRef', 'sourceArtifactRef', 'compilerDefinitionRef']) {
    if (!sameAuthorityRef(claimCandidate.semanticPayload[name], sourceContextCandidate.semanticPayload[name])
      || !sameAuthorityRef(result.semanticPayload[name], claimCandidate.semanticPayload[name])) {
      throw new AutomatedSourceFaithfulReviewError('CANDIDATE_PROVENANCE_MISMATCH', `${name} differs across compilation/candidate pair`);
    }
  }
  if (claimCandidate.semanticPayload.sourceArtifactContentHash !== sourceContextCandidate.semanticPayload.sourceArtifactContentHash
    || result.semanticPayload.sourceArtifactContentHash !== claimCandidate.semanticPayload.sourceArtifactContentHash) {
    throw new AutomatedSourceFaithfulReviewError('CANDIDATE_PROVENANCE_MISMATCH', 'SourceArtifact content hash differs across compilation/candidate pair');
  }
  const artifact = resolveKind(ledger, claimCandidate.semanticPayload.sourceArtifactRef, 'SourceArtifact', 'SOURCE_ARTIFACT_REQUIRED');
  if (artifact.semanticPayload.contentHash !== claimCandidate.semanticPayload.sourceArtifactContentHash) {
    throw new AutomatedSourceFaithfulReviewError('SOURCE_ARTIFACT_HASH_MISMATCH', 'candidate content hash does not equal exact SourceArtifact contentHash');
  }
  return { result, claimCandidate, sourceContextCandidate, artifact };
}

function blindContextFamilies(contextFamilies) {
  const output = {};
  for (const [family, candidateFamily] of Object.entries(contextFamilies ?? {})) {
    if (candidateFamily.status === 'NOT_REPORTED') {
      output[family] = { status: 'NOT_REPORTED', dimensions: [] };
      continue;
    }
    output[family] = {
      status: 'REPORTED',
      dimensions: (candidateFamily.dimensions ?? []).map((dimension) => ({
        semanticHint: dimension.semanticHint,
        valueCandidate: cloneCanonicalValue(dimension.valueCandidate),
        ...(dimension.unitCandidate !== undefined ? { unitCandidate: dimension.unitCandidate } : {}),
        supportClass: dimension.supportClass,
        sourceLocator: cloneCanonicalValue(dimension.sourceLocator)
      }))
    };
  }
  return deepFreeze(output);
}

export function buildAutomatedSourceFaithfulBlindPacket({ ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef }) {
  const pair = assertCandidatePair({ ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef });
  const packet = {
    contractVersion: AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT,
    claimCandidateRef: pair.claimCandidate.ref,
    sourceContextCandidateRef: pair.sourceContextCandidate.ref,
    sourceArtifactRef: pair.artifact.ref,
    sourceArtifactContentHash: pair.artifact.semanticPayload.contentHash,
    claim: {
      claimType: pair.claimCandidate.semanticPayload.claimType,
      assertion: pair.claimCandidate.semanticPayload.assertion,
      sourceLocator: cloneCanonicalValue(pair.claimCandidate.semanticPayload.sourceLocator)
    },
    sourceContext: blindContextFamilies(pair.sourceContextCandidate.semanticPayload.contextFamilies),
    blindness: {
      extractorProviderHidden: true,
      extractorModelHidden: true,
      extractorConfidenceHidden: true,
      extractorRationaleHidden: true,
      contextDimensionConfidenceHidden: true
    }
  };
  return deepFreeze({ packet, blindInputHash: semanticHash('ADR-AutomatedSourceFaithfulBlindPacket-v1', packet) });
}

function extractorIdentity(result) {
  const metadata = result.semanticPayload?.runMetadata ?? {};
  const provider = typeof metadata.provider === 'string' && metadata.provider.trim() ? metadata.provider.trim() : null;
  const model = typeof metadata.model === 'string' && metadata.model.trim() ? metadata.model.trim() : null;
  return deepFreeze({ provider, model, verifiable: Boolean(provider && model) });
}

function sameReviewerIdentity(extractor, reviewer) {
  return extractor.verifiable && extractor.provider === reviewer.provider && extractor.model === reviewer.model;
}

export function materializeAutomatedSourceFaithfulReviewProposal({
  ledger,
  logicalId,
  version,
  compilationResultRef,
  claimCandidateRef,
  sourceContextCandidateRef,
  blindInputHash,
  reviewerMetadata,
  proposedDisposition,
  reasonCodes = [],
  rationale,
  reviewConfidence,
  checks,
  contextAdjudication = null,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
    throw new AutomatedSourceFaithfulReviewError('INVALID_LEDGER', 'shared AuthorityLedger is required');
  }
  const pair = assertCandidatePair({ ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef });
  const blind = buildAutomatedSourceFaithfulBlindPacket({ ledger, compilationResultRef, claimCandidateRef, sourceContextCandidateRef });
  if (requiredText(blindInputHash, 'blindInputHash') !== blind.blindInputHash) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_BLIND_INPUT_MISMATCH', 'review proposal does not bind the canonical blind review packet');
  }
  const disposition = requiredText(proposedDisposition, 'proposedDisposition');
  if (!DISPOSITION_SET.has(disposition)) {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_DISPOSITION', `unsupported proposedDisposition ${disposition}`);
  }
  const normalizedReviewer = normalizeReviewerMetadata(reviewerMetadata);
  if (normalizedReviewer.reviewMode !== 'BLIND_FALSIFICATION') {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_NOT_BLIND_FALSIFICATION', 'reviewMode must be BLIND_FALSIFICATION');
  }
  const normalizedChecks = normalizeChecks(checks);
  const normalizedReasons = normalizeReasonCodes(reasonCodes);
  const normalizedConfidence = normalizeConfidence(reviewConfidence);
  if (disposition === 'REJECT_SOURCE_FAITHFUL' && normalizedReasons.length === 0) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REJECTION_REASON_REQUIRED', 'automated rejection proposal requires reasonCodes');
  }
  if (disposition === 'ACCEPT_SOURCE_FAITHFUL' && normalizedReasons.length !== 0) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_ACCEPT_REASON_FORBIDDEN', 'automated acceptance proposal cannot contain defect reasonCodes');
  }
  if (disposition === 'ACCEPT_SOURCE_FAITHFUL' && (!contextAdjudication || typeof contextAdjudication !== 'object' || Array.isArray(contextAdjudication))) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_ACCEPT_CONTEXT_ADJUDICATION_REQUIRED', 'automated acceptance proposal requires contextAdjudication');
  }
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_AUDIT_REQUIRED', 'audit is required');
  }
  return ledger.publish({
    kind: 'AutomatedSourceFaithfulReviewProposal',
    logicalId: requiredText(logicalId, 'logicalId'),
    version: requiredText(version, 'version'),
    semanticPayload: {
      contractVersion: AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT,
      authorityClass: AUTOMATED_SOURCE_FAITHFUL_REVIEW_AUTHORITY,
      compilationResultRef: pair.result.ref,
      claimCandidateRef: pair.claimCandidate.ref,
      sourceContextCandidateRef: pair.sourceContextCandidate.ref,
      sourceArtifactRef: pair.artifact.ref,
      sourceArtifactContentHash: pair.artifact.semanticPayload.contentHash,
      blindInputHash: blind.blindInputHash,
      reviewerMetadata: normalizedReviewer,
      proposedDisposition: disposition,
      reasonCodes: normalizedReasons,
      rationale: requiredText(rationale, 'rationale'),
      reviewConfidence: normalizedConfidence,
      checks: normalizedChecks,
      ...(contextAdjudication ? { contextAdjudication: cloneCanonicalValue(contextAdjudication) } : {}),
      outputAuthority: 'PROPOSAL_ONLY'
    },
    audit: {
      ...audit,
      action: 'MATERIALIZE_AUTOMATED_SOURCE_FAITHFUL_REVIEW_PROPOSAL',
      inputRefs: [pair.result.ref, pair.claimCandidate.ref, pair.sourceContextCandidate.ref, pair.artifact.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        automatedReviewContract: AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT,
        reviewerProvider: normalizedReviewer.provider,
        reviewerModel: normalizedReviewer.model,
        blindInputHash: blind.blindInputHash,
        outputAuthority: 'PROPOSAL_ONLY'
      }
    }
  });
}

export function adjudicateAutomatedSourceFaithfulReviewProposal({ ledger, proposalRef, policy = DEFAULT_AUTOMATED_SOURCE_FAITHFUL_POLICY }) {
  const proposal = resolveKind(ledger, proposalRef, 'AutomatedSourceFaithfulReviewProposal', 'AUTOMATED_REVIEW_PROPOSAL_REQUIRED');
  const payload = proposal.semanticPayload;
  if (payload.contractVersion !== AUTOMATED_SOURCE_FAITHFUL_REVIEW_CONTRACT
    || payload.authorityClass !== AUTOMATED_SOURCE_FAITHFUL_REVIEW_AUTHORITY
    || payload.outputAuthority !== 'PROPOSAL_ONLY') {
    throw new AutomatedSourceFaithfulReviewError('INVALID_AUTOMATED_REVIEW_PROPOSAL', 'proposal contract/authority semantics are invalid');
  }
  const pair = assertCandidatePair({
    ledger,
    compilationResultRef: payload.compilationResultRef,
    claimCandidateRef: payload.claimCandidateRef,
    sourceContextCandidateRef: payload.sourceContextCandidateRef
  });
  const blind = buildAutomatedSourceFaithfulBlindPacket({
    ledger,
    compilationResultRef: pair.result.ref,
    claimCandidateRef: pair.claimCandidate.ref,
    sourceContextCandidateRef: pair.sourceContextCandidate.ref
  });
  if (payload.blindInputHash !== blind.blindInputHash) {
    throw new AutomatedSourceFaithfulReviewError('AUTOMATED_REVIEW_BLIND_INPUT_MISMATCH', 'stored proposal no longer matches canonical blind review packet');
  }
  const reviewer = normalizeReviewerMetadata(payload.reviewerMetadata);
  const extractor = extractorIdentity(pair.result);
  const reasons = [];
  const failedChecks = Object.entries(normalizeChecks(payload.checks))
    .filter(([, status]) => status === 'FAIL')
    .map(([name]) => name)
    .sort();

  if (policy.requireBlindPacket === true && reviewer.reviewMode !== 'BLIND_FALSIFICATION') reasons.push('REVIEW_NOT_BLIND');
  if (policy.requireIndependentReviewer === true) {
    if (!extractor.verifiable) reasons.push('EXTRACTOR_IDENTITY_NOT_VERIFIABLE');
    else if (sameReviewerIdentity(extractor, reviewer)) reasons.push('REVIEWER_NOT_INDEPENDENT');
  }

  let effectiveDisposition = 'ESCALATE_TO_HUMAN';
  if (reasons.length === 0 && payload.proposedDisposition === 'ACCEPT_SOURCE_FAITHFUL') {
    if (payload.reviewConfidence < policy.minAutoAcceptConfidence) reasons.push('AUTO_ACCEPT_CONFIDENCE_BELOW_THRESHOLD');
    if (policy.acceptRequiresAllChecksPass === true && failedChecks.length > 0) reasons.push('AUTO_ACCEPT_REVIEW_CHECK_FAILED');
    if ((payload.reasonCodes ?? []).length > 0) reasons.push('AUTO_ACCEPT_HAS_DEFECT_CODES');
    if (!payload.contextAdjudication) reasons.push('AUTO_ACCEPT_CONTEXT_ADJUDICATION_MISSING');
    if (reasons.length === 0) effectiveDisposition = 'ACCEPT_SOURCE_FAITHFUL';
  } else if (reasons.length === 0 && payload.proposedDisposition === 'REJECT_SOURCE_FAITHFUL') {
    if (payload.reviewConfidence < policy.minAutoRejectConfidence) reasons.push('AUTO_REJECT_CONFIDENCE_BELOW_THRESHOLD');
    if ((payload.reasonCodes ?? []).length === 0) reasons.push('AUTO_REJECT_REASON_MISSING');
    if (policy.rejectRequiresAtLeastOneFailedCheck === true && failedChecks.length === 0) reasons.push('AUTO_REJECT_FAILED_CHECK_MISSING');
    if (reasons.length === 0) effectiveDisposition = 'REJECT_SOURCE_FAITHFUL';
  } else if (payload.proposedDisposition === 'ESCALATE_TO_HUMAN') {
    reasons.push('REVIEWER_REQUESTED_HUMAN_ESCALATION');
  }

  return deepFreeze({
    proposalRef: proposal.ref,
    effectiveDisposition,
    promotionAuthority: AUTOMATED_SOURCE_FAITHFUL_REVIEW_PROMOTION,
    promotionReasons: [...new Set(reasons)].sort(),
    failedChecks,
    reviewer,
    extractor,
    policy: cloneCanonicalValue(policy)
  });
}
