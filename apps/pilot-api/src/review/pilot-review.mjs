import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../../../packages/authorization/src/index.mjs';
import {
  SourceFaithfulReviewError,
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../../../packages/knowledge-registry/src/source-faithful.mjs';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SourceFaithfulReviewError('INVALID_PILOT_REVIEW_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactInputRefs(values) {
  if (!Array.isArray(values)) throw new SourceFaithfulReviewError('INVALID_PILOT_REVIEW_INPUT', 'rightsDecisionRefs must be an array');
  return values;
}

export class PilotReviewAdapter {
  #ledger;
  #operatorId;
  #reviewService;
  #authorizationBySource = new Map();

  constructor({ ledger, operatorId }) {
    this.#ledger = ledger;
    this.#operatorId = requiredText(operatorId, 'operatorId');
    this.#reviewService = new SourceFaithfulReviewService({ ledger });
  }

  #audit(eventId, actorType = 'USER', inputRefs = []) {
    return {
      eventId,
      occurredAt: new Date().toISOString(),
      actor: { type: actorType, id: this.#operatorId },
      inputRefs,
      details: { channel: 'pilot-api-source-faithful-review' }
    };
  }

  #authorizationFor(source) {
    const key = source.ref.semanticHash;
    const existing = this.#authorizationBySource.get(key);
    if (existing) return existing;

    const ownership = source.semanticPayload.ownership;
    const reviewer = createPrincipal({
      principalId: this.#operatorId,
      type: 'USER',
      organizationId: ownership.organizationId,
      ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
    });
    const scope = {
      organizationId: ownership.organizationId,
      ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
    };
    const suffix = source.ref.semanticHash.replace(/^sha256:/, '').slice(0, 16);
    const roleAssignment = publishBuiltinRoleAssignment({
      ledger: this.#ledger,
      logicalId: `role.pilot-review.${suffix}`,
      version: '1',
      principal: reviewer,
      role: 'AGRONOMY_REVIEWER',
      scope,
      audit: this.#audit(`evt-pilot-review-role:${suffix}`, 'SERVICE_ACCOUNT')
    });
    const policy = publishKnowledgeGovernancePolicy({
      ledger: this.#ledger,
      logicalId: `policy.pilot-review.${suffix}`,
      version: '1',
      resourceId: sourceReviewResourceId(source.ref),
      ownership,
      visibilityPolicy: [{ principalId: reviewer.principalId }],
      qualificationScope: [{ use: '*' }],
      deploymentScope: [{ organizationId: ownership.organizationId }],
      audit: this.#audit(`evt-pilot-review-policy:${suffix}`, 'SERVICE_ACCOUNT')
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
      audit: this.#audit(`evt-pilot-review-auth:${suffix}`, 'SERVICE_ACCOUNT')
    });
    const prepared = { reviewer, authorizationAudit };
    this.#authorizationBySource.set(key, prepared);
    return prepared;
  }

  review({
    compilationResultRef,
    claimCandidateRef,
    sourceContextCandidateRef,
    disposition,
    reasonCodes = [],
    rationale,
    contextAdjudication,
    rightsDecisionRefs = [],
    version = `review-${new Date().toISOString()}`
  }) {
    const rightsRefs = exactInputRefs(rightsDecisionRefs);
    const claimCandidate = this.#ledger.resolve(claimCandidateRef);
    const source = this.#ledger.resolve(claimCandidate.semanticPayload.sourceRef);
    const auth = this.#authorizationFor(source);
    const suffix = claimCandidate.ref.semanticHash.replace(/^sha256:/, '').slice(0, 16);
    const reviewVersion = requiredText(version, 'version');
    const result = this.#reviewService.reviewCandidate({
      reviewLogicalId: `review.pilot.${claimCandidate.ref.logicalId}`,
      reviewVersion,
      compilationResultRef,
      claimCandidateRef,
      sourceContextCandidateRef,
      disposition,
      reasonCodes,
      ...(rationale ? { rationale } : {}),
      ...(disposition === 'ACCEPT_SOURCE_FAITHFUL' ? { contextAdjudication } : {}),
      reviewPrincipal: auth.reviewer,
      authorizationDecisionAuditRef: auth.authorizationAudit.ref,
      claimLogicalId: `claim.pilot.${suffix}`,
      claimVersion: '1',
      sourceContextLogicalId: `source-context.pilot.${suffix}`,
      sourceContextVersion: '1',
      audit: this.#audit(`evt-pilot-review:${suffix}:${reviewVersion}`, 'USER', rightsRefs)
    });
    return {
      review: result.review,
      claim: result.claim,
      sourceContext: result.sourceContext
    };
  }
}
