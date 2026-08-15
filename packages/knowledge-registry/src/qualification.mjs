import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeSourceFaithfulDimension } from '../../contracts/src/context-semantic.mjs';
import {
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';

export const SCIENTIFIC_QUALIFICATION_DISPOSITIONS = deepFreeze([
  'QUALIFY_USE',
  'PROHIBIT_USE'
]);

const DISPOSITION_SET = new Set(SCIENTIFIC_QUALIFICATION_DISPOSITIONS);

export class ScientificQualificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScientificQualificationError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function canonicalObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_INPUT', `${name} must be an object`);
  }
  const normalized = cloneCanonicalValue(value);
  if (Object.keys(normalized).length === 0) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_INPUT', `${name} cannot be empty`);
  }
  return deepFreeze(normalized);
}

function canonicalObjectList(values, name) {
  if (!Array.isArray(values)) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_INPUT', `${name} must be an array`);
  }
  return deepFreeze(values.map((value, index) => canonicalObject(value, `${name}[${index}]`)));
}

function normalizeReasonCodes(values, { required = false } = {}) {
  if (values === undefined || values === null) values = [];
  if (!Array.isArray(values)) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_REASON', 'reasonCodes must be an array');
  }
  const normalized = [...new Set(values.map((value) => requiredText(value, 'reasonCode')))].sort();
  if (required && normalized.length === 0) {
    throw new ScientificQualificationError('QUALIFICATION_REASON_REQUIRED', 'prohibited/revoked scientific use requires a reason code');
  }
  return deepFreeze(normalized);
}

function resolveKind(ledger, ref, expectedKind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== expectedKind) {
    throw new ScientificQualificationError(code, `expected ${expectedKind}, received ${record.ref.kind}`);
  }
  return record;
}

function canonicalEqual(left, right) {
  return semanticHash('ADR-K04-CANONICAL-COMPARE', left) === semanticHash('ADR-K04-CANONICAL-COMPARE', right);
}

function targetKey(target) {
  return semanticHash('ADR-ScientificUseTarget', canonicalObject(target, 'qualificationTarget'));
}

function includesExactRef(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function assertFinalContextMatchesCandidate(candidateFamilies, finalFamilies) {
  if (!candidateFamilies || !finalFamilies || typeof candidateFamilies !== 'object' || typeof finalFamilies !== 'object') {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', 'SourceContext families are required');
  }

  const candidateNames = Object.keys(candidateFamilies).sort();
  const finalNames = Object.keys(finalFamilies).sort();
  if (!canonicalEqual(candidateNames, finalNames)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', 'final SourceContext families differ from reviewed candidate families');
  }

  for (const family of candidateNames) {
    const candidateFamily = candidateFamilies[family];
    const finalFamily = finalFamilies[family];
    if (candidateFamily.status !== finalFamily.status) {
      throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', `${family} reporting status differs from candidate`);
    }
    if (candidateFamily.status === 'NOT_REPORTED') {
      if ((candidateFamily.dimensions ?? []).length !== 0 || (finalFamily.dimensions ?? []).length !== 0) {
        throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', `${family} NOT_REPORTED cannot contain dimensions`);
      }
      continue;
    }
    const candidateDimensions = candidateFamily.dimensions ?? [];
    const finalDimensions = finalFamily.dimensions ?? [];
    if (candidateDimensions.length !== finalDimensions.length) {
      throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', `${family} final dimension count differs from candidate`);
    }
    for (let index = 0; index < candidateDimensions.length; index += 1) {
      const finalDimension = finalDimensions[index];
      const adjudication = {
        semanticId: finalDimension.semanticId,
        valueType: finalDimension.value?.type,
        ...(finalDimension.unit ? { unit: finalDimension.unit } : {})
      };
      let reconstructed;
      try {
        reconstructed = normalizeSourceFaithfulDimension({
          candidate: candidateDimensions[index],
          adjudication
        });
      } catch (error) {
        throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', `cannot reconstruct ${family}[${index}] from source-faithful candidate: ${error.message}`);
      }
      if (!canonicalEqual(reconstructed, finalDimension)) {
        throw new ScientificQualificationError('SOURCE_FAITHFUL_CONTEXT_INVALID', `${family}[${index}] is not source-faithful to the reviewed candidate`);
      }
    }
  }
}

function assertSourceFaithfulAuthorityPair({ ledger, claimRef, sourceContextRef }) {
  const claim = resolveKind(ledger, claimRef, 'Claim', 'CLAIM_AUTHORITY_REQUIRED');
  const sourceContext = resolveKind(ledger, sourceContextRef, 'SourceContext', 'SOURCE_CONTEXT_AUTHORITY_REQUIRED');

  if (claim.semanticPayload.authorityClass !== 'SOURCE_ASSERTION') {
    throw new ScientificQualificationError('INVALID_SOURCE_ASSERTION_AUTHORITY', 'Claim must be SOURCE_ASSERTION authority');
  }
  if (sourceContext.semanticPayload.authorityClass !== 'SOURCE_CONTEXT') {
    throw new ScientificQualificationError('INVALID_SOURCE_CONTEXT_AUTHORITY', 'SourceContext must be SOURCE_CONTEXT authority');
  }
  if (!sameAuthorityRef(sourceContext.semanticPayload.claimRef, claim.ref)) {
    throw new ScientificQualificationError('CLAIM_SOURCE_CONTEXT_MISMATCH', 'SourceContext does not bind the exact Claim');
  }

  const sharedBindings = ['sourceRef', 'sourceArtifactRef', 'compilationResultRef', 'sourceFaithfulReviewRef'];
  for (const name of sharedBindings) {
    if (!sameAuthorityRef(claim.semanticPayload[name], sourceContext.semanticPayload[name])) {
      throw new ScientificQualificationError('CLAIM_SOURCE_CONTEXT_MISMATCH', `${name} differs between Claim and SourceContext`);
    }
  }
  if (claim.semanticPayload.sourceArtifactContentHash !== sourceContext.semanticPayload.sourceArtifactContentHash) {
    throw new ScientificQualificationError('CLAIM_SOURCE_CONTEXT_MISMATCH', 'SourceArtifact content hash differs between Claim and SourceContext');
  }

  const review = resolveKind(ledger, claim.semanticPayload.sourceFaithfulReviewRef, 'SourceFaithfulReviewDecision', 'SOURCE_FAITHFUL_REVIEW_REQUIRED');
  if (review.semanticPayload.disposition !== 'ACCEPT_SOURCE_FAITHFUL') {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_REVIEW_NOT_ACCEPTED', 'Claim qualification requires ACCEPT_SOURCE_FAITHFUL review authority');
  }

  const result = resolveKind(ledger, claim.semanticPayload.compilationResultRef, 'ScientificCompilationResult', 'COMPILATION_RESULT_REQUIRED');
  const claimCandidate = resolveKind(ledger, review.semanticPayload.claimCandidateRef, 'ClaimCandidate', 'CLAIM_CANDIDATE_REQUIRED');
  const sourceContextCandidate = resolveKind(ledger, review.semanticPayload.sourceContextCandidateRef, 'SourceContextCandidate', 'SOURCE_CONTEXT_CANDIDATE_REQUIRED');
  const source = resolveKind(ledger, claim.semanticPayload.sourceRef, 'Source', 'SOURCE_AUTHORITY_REQUIRED');
  const artifact = resolveKind(ledger, claim.semanticPayload.sourceArtifactRef, 'SourceArtifact', 'SOURCE_ARTIFACT_AUTHORITY_REQUIRED');
  const compilerDefinition = resolveKind(ledger, review.semanticPayload.compilerDefinitionRef, 'ScientificCompilerDefinition', 'COMPILER_DEFINITION_AUTHORITY_REQUIRED');

  if (result.semanticPayload.outputAuthority !== 'PROPOSAL_ONLY' || compilerDefinition.semanticPayload.outputAuthority !== 'CANDIDATE_ONLY') {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'compiler/result authority must remain proposal-only/candidate-only');
  }
  if (!includesExactRef(result.semanticPayload.claimCandidateRefs, claimCandidate.ref)
    || !includesExactRef(result.semanticPayload.sourceContextCandidateRefs, sourceContextCandidate.ref)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'review candidates are not members of the exact compilation result');
  }
  if (!sameAuthorityRef(sourceContextCandidate.semanticPayload.claimCandidateRef, claimCandidate.ref)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'SourceContextCandidate does not belong to exact ClaimCandidate');
  }
  if (!sameAuthorityRef(artifact.semanticPayload.sourceRef, source.ref)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'SourceArtifact does not bind exact Source');
  }
  if (artifact.semanticPayload.contentHash !== claim.semanticPayload.sourceArtifactContentHash
    || artifact.semanticPayload.contentHash !== result.semanticPayload.sourceArtifactContentHash) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'SourceArtifact content hash does not close through Claim/CompilationResult');
  }
  if (!sameAuthorityRef(result.semanticPayload.sourceRef, source.ref)
    || !sameAuthorityRef(result.semanticPayload.sourceArtifactRef, artifact.ref)
    || !sameAuthorityRef(result.semanticPayload.compilerDefinitionRef, compilerDefinition.ref)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'CompilationResult does not close to exact Source/Artifact/CompilerDefinition');
  }
  if (!sameAuthorityRef(review.semanticPayload.sourceRef, source.ref)
    || !sameAuthorityRef(review.semanticPayload.sourceArtifactRef, artifact.ref)
    || !sameAuthorityRef(review.semanticPayload.compilationResultRef, result.ref)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_UPSTREAM_INVALID', 'SourceFaithfulReviewDecision does not close to exact source chain');
  }
  if (claim.semanticPayload.assertion !== claimCandidate.semanticPayload.assertion
    || !canonicalEqual(claim.semanticPayload.sourceLocator, claimCandidate.semanticPayload.sourceLocator)) {
    throw new ScientificQualificationError('SOURCE_FAITHFUL_CLAIM_INVALID', 'final Claim is not source-faithful to exact ClaimCandidate');
  }

  assertFinalContextMatchesCandidate(
    sourceContextCandidate.semanticPayload.contextFamilies,
    sourceContext.semanticPayload.contextFamilies
  );

  return deepFreeze({ claim, sourceContext, review, result, source, artifact, compilerDefinition });
}

export function qualificationResourceId(claimRef, sourceContextRef) {
  const claim = assertAuthorityRef(claimRef);
  const sourceContext = assertAuthorityRef(sourceContextRef);
  return `scientific-qualification:${claim.kind}/${claim.logicalId}@${claim.version}#${claim.semanticHash}|${sourceContext.kind}/${sourceContext.logicalId}@${sourceContext.version}#${sourceContext.semanticHash}`;
}

function assertQualificationAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  approverPrincipal,
  qualificationTarget,
  pair,
  audit
}) {
  if (!approverPrincipal || typeof approverPrincipal !== 'object' || Array.isArray(approverPrincipal)) {
    throw new ScientificQualificationError('QUALIFICATION_PRINCIPAL_REQUIRED', 'exact approverPrincipal is required');
  }
  if (!audit?.actor || audit.actor.id !== approverPrincipal.principalId || audit.actor.type !== approverPrincipal.type) {
    throw new ScientificQualificationError('QUALIFICATION_ACTOR_MISMATCH', 'audit.actor must match exact scientific approver principal');
  }

  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'QUALIFICATION_AUTHORIZATION_REQUIRED');
  const storedDecision = authAudit.semanticPayload;
  if (storedDecision.operation !== 'KNOWLEDGE_QUALIFY' || storedDecision.allowed !== true) {
    throw new ScientificQualificationError('QUALIFICATION_AUTHORIZATION_DENIED', 'scientific qualification requires allowed KNOWLEDGE_QUALIFY authorization');
  }
  if (!samePrincipalIdentity(storedDecision.principal, approverPrincipal)) {
    throw new ScientificQualificationError('QUALIFICATION_PRINCIPAL_MISMATCH', 'authorization principal differs from approverPrincipal');
  }

  const policy = resolveKind(ledger, storedDecision.policyRef, 'KnowledgeGovernancePolicy', 'QUALIFICATION_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== qualificationResourceId(pair.claim.ref, pair.sourceContext.ref)) {
    throw new ScientificQualificationError('QUALIFICATION_POLICY_RESOURCE_MISMATCH', 'qualification policy is not bound to exact Claim + SourceContext authority');
  }
  const sourceOwnership = pair.source.semanticPayload.ownership;
  const policyOwnership = policy.semanticPayload.ownership;
  if (sourceOwnership.organizationId !== policyOwnership.organizationId
    || (sourceOwnership.tenantId ?? null) !== (policyOwnership.tenantId ?? null)) {
    throw new ScientificQualificationError('QUALIFICATION_POLICY_OWNERSHIP_MISMATCH', 'qualification policy ownership differs from Source ownership');
  }

  const assignments = (storedDecision.assignmentRefs ?? []).map((ref) => resolveKind(
    ledger,
    ref,
    'RoleAssignment',
    'QUALIFICATION_ROLE_ASSIGNMENT_REQUIRED'
  ));
  const recomputed = authorizeKnowledgeQualification({
    principal: approverPrincipal,
    policy,
    roleAssignments: assignments,
    qualificationTarget,
    authorizationScope: storedDecision.request?.authorizationScope
  });
  if (recomputed.allowed !== true || recomputed.decisionHash !== storedDecision.decisionHash) {
    throw new ScientificQualificationError(
      'QUALIFICATION_AUTHORIZATION_MISMATCH',
      'stored authorization decision cannot be reproduced for exact principal/policy/assignments/qualificationTarget'
    );
  }

  return deepFreeze({ authAudit, policy, authorizationDecision: storedDecision });
}

function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') {
    throw new ScientificQualificationError('AUDIT_REQUIRED', 'scientific qualification requires explicit audit metadata');
  }
  return {
    ...base,
    eventId: `${requiredText(base.eventId, 'audit.eventId')}:${suffix}`,
    inputRefs: [...inputRefs, ...(base.inputRefs ?? [])]
  };
}

function normalizeDecisionPayload(record) {
  if (record.semanticPayload.authorityClass !== 'SCIENTIFIC_QUALIFICATION_DECISION') {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_DECISION', 'ScientificQualificationDecision authorityClass is invalid');
  }
  const disposition = requiredText(record.semanticPayload.disposition, 'disposition');
  if (!DISPOSITION_SET.has(disposition)) {
    throw new ScientificQualificationError('INVALID_QUALIFICATION_DECISION', `unsupported disposition ${disposition}`);
  }
  normalizeReasonCodes(record.semanticPayload.reasonCodes ?? [], { required: disposition === 'PROHIBIT_USE' });
  return deepFreeze({
    qualificationTarget: canonicalObject(record.semanticPayload.qualificationTarget, 'qualificationTarget'),
    disposition,
    limitations: canonicalObjectList(record.semanticPayload.limitations ?? [], 'limitations'),
    effectModifiers: canonicalObjectList(record.semanticPayload.effectModifiers ?? [], 'effectModifiers'),
    semanticPreconditions: canonicalObjectList(record.semanticPayload.semanticPreconditions ?? [], 'semanticPreconditions'),
    transportConstraints: canonicalObjectList(record.semanticPayload.transportConstraints ?? [], 'transportConstraints')
  });
}

function sortedDecisionRefs(records) {
  return deepFreeze([...records]
    .sort((left, right) => targetKey(left.semanticPayload.qualificationTarget).localeCompare(targetKey(right.semanticPayload.qualificationTarget)))
    .map((record) => record.ref));
}

function aggregateConstraint(records, field) {
  const entries = [];
  for (const record of records) {
    if (record.semanticPayload.disposition !== 'QUALIFY_USE') continue;
    for (const value of record.semanticPayload[field] ?? []) {
      entries.push({ qualificationDecisionRef: record.ref, value: cloneCanonicalValue(value) });
    }
  }
  return deepFreeze(entries.sort((left, right) => semanticHash('ADR-K04-Constraint', left).localeCompare(semanticHash('ADR-K04-Constraint', right))));
}

export class ScientificQualificationService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function'
      || typeof ledger.addLineage !== 'function' || typeof ledger.lineageFor !== 'function') {
      throw new ScientificQualificationError('INVALID_LEDGER', 'ScientificQualificationService requires shared AuthorityLedger');
    }
    this.#ledger = ledger;
  }

  recordQualificationDecision({
    decisionLogicalId,
    decisionVersion,
    claimRef,
    sourceContextRef,
    disposition,
    qualificationTarget,
    limitations = [],
    effectModifiers = [],
    semanticPreconditions = [],
    transportConstraints = [],
    reasonCodes = [],
    rationale,
    approverPrincipal,
    authorizationDecisionAuditRef,
    supersedesDecisionRef,
    audit
  }) {
    const normalizedDisposition = requiredText(disposition, 'disposition');
    if (!DISPOSITION_SET.has(normalizedDisposition)) {
      throw new ScientificQualificationError('INVALID_QUALIFICATION_DISPOSITION', `unsupported disposition ${normalizedDisposition}`);
    }
    const target = canonicalObject(qualificationTarget, 'qualificationTarget');
    const pair = assertSourceFaithfulAuthorityPair({ ledger: this.#ledger, claimRef, sourceContextRef });
    const authorization = assertQualificationAuthorization({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      approverPrincipal,
      qualificationTarget: target,
      pair,
      audit
    });
    const normalizedReasons = normalizeReasonCodes(reasonCodes, { required: normalizedDisposition === 'PROHIBIT_USE' });
    let supersededDecision;
    if (supersedesDecisionRef) {
      supersededDecision = resolveKind(this.#ledger, supersedesDecisionRef, 'ScientificQualificationDecision', 'SUPERSEDED_QUALIFICATION_DECISION_REQUIRED');
      const previous = normalizeDecisionPayload(supersededDecision);
      if (!sameAuthorityRef(supersededDecision.semanticPayload.claimRef, pair.claim.ref)
        || !sameAuthorityRef(supersededDecision.semanticPayload.sourceContextRef, pair.sourceContext.ref)
        || targetKey(previous.qualificationTarget) !== targetKey(target)) {
        throw new ScientificQualificationError('INVALID_QUALIFICATION_SUPERSESSION', 'superseded decision must concern the same Claim, SourceContext and qualification target');
      }
    }

    const decision = this.#ledger.publish({
      kind: 'ScientificQualificationDecision',
      logicalId: requiredText(decisionLogicalId, 'decisionLogicalId'),
      version: requiredText(decisionVersion, 'decisionVersion'),
      semanticPayload: {
        claimRef: pair.claim.ref,
        sourceContextRef: pair.sourceContext.ref,
        sourceRef: pair.source.ref,
        sourceFaithfulReviewRef: pair.review.ref,
        qualificationTarget: target,
        disposition: normalizedDisposition,
        limitations: canonicalObjectList(limitations, 'limitations'),
        effectModifiers: canonicalObjectList(effectModifiers, 'effectModifiers'),
        semanticPreconditions: canonicalObjectList(semanticPreconditions, 'semanticPreconditions'),
        transportConstraints: canonicalObjectList(transportConstraints, 'transportConstraints'),
        reasonCodes: normalizedReasons,
        ...(rationale ? { rationale: requiredText(rationale, 'rationale') } : {}),
        approverPrincipal: cloneCanonicalValue(approverPrincipal),
        authorizationDecisionAuditRef: authorization.authAudit.ref,
        qualificationPolicyRef: authorization.policy.ref,
        ...(supersededDecision ? { supersedesDecisionRef: supersededDecision.ref } : {}),
        authorityClass: 'SCIENTIFIC_QUALIFICATION_DECISION'
      },
      audit: auditEvent(audit, 'qualification-decision', [
        pair.claim.ref,
        pair.sourceContext.ref,
        pair.review.ref,
        pair.source.ref,
        authorization.authAudit.ref,
        authorization.policy.ref,
        ...(supersededDecision ? [supersededDecision.ref] : [])
      ])
    });

    if (supersededDecision) {
      this.#ledger.addLineage({
        relation: 'supersedes',
        from: decision.ref,
        to: supersededDecision.ref,
        details: { authorityTransition: 'SCIENTIFIC_USE_REQUALIFICATION' },
        audit: auditEvent(audit, 'decision-supersession', [authorization.authAudit.ref])
      });
    }

    return decision;
  }

  publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId,
    qualifiedKnowledgeVersion,
    qualificationDecisionRefs,
    supersedesQualifiedKnowledgeRef,
    audit
  }) {
    if (!Array.isArray(qualificationDecisionRefs) || qualificationDecisionRefs.length === 0) {
      throw new ScientificQualificationError('QUALIFICATION_DECISIONS_REQUIRED', 'QualifiedKnowledge requires at least one ScientificQualificationDecision');
    }

    const decisions = qualificationDecisionRefs.map((ref) => resolveKind(
      this.#ledger,
      ref,
      'ScientificQualificationDecision',
      'QUALIFICATION_DECISION_REQUIRED'
    ));
    const first = decisions[0];
    const pair = assertSourceFaithfulAuthorityPair({
      ledger: this.#ledger,
      claimRef: first.semanticPayload.claimRef,
      sourceContextRef: first.semanticPayload.sourceContextRef
    });

    const seenTargets = new Map();
    const allowedUses = [];
    const forbiddenUses = [];
    for (const decision of decisions) {
      const normalized = normalizeDecisionPayload(decision);
      if (!sameAuthorityRef(decision.semanticPayload.claimRef, pair.claim.ref)
        || !sameAuthorityRef(decision.semanticPayload.sourceContextRef, pair.sourceContext.ref)) {
        throw new ScientificQualificationError('QUALIFICATION_DECISION_BUNDLE_MISMATCH', 'all qualification decisions must bind the same exact Claim + SourceContext');
      }
      if (!sameAuthorityRef(decision.semanticPayload.sourceRef, pair.source.ref)
        || !sameAuthorityRef(decision.semanticPayload.sourceFaithfulReviewRef, pair.review.ref)) {
        throw new ScientificQualificationError('INVALID_QUALIFICATION_DECISION', 'qualification decision does not bind the exact source-faithful authority chain');
      }
      const target = normalized.qualificationTarget;
      const key = targetKey(target);
      if (seenTargets.has(key)) {
        throw new ScientificQualificationError('CONFLICTING_QUALIFICATION_DECISIONS', 'a QualifiedKnowledge publication cannot contain multiple decisions for the same use target');
      }
      seenTargets.set(key, decision.ref);

      const decisionPrincipal = decision.semanticPayload.approverPrincipal;
      const authorization = assertQualificationAuthorization({
        ledger: this.#ledger,
        authorizationDecisionAuditRef: decision.semanticPayload.authorizationDecisionAuditRef,
        approverPrincipal: decisionPrincipal,
        qualificationTarget: target,
        pair,
        audit: {
          eventId: 'k04-validation',
          occurredAt: '1970-01-01T00:00:00.000Z',
          actor: { type: decisionPrincipal.type, id: decisionPrincipal.principalId }
        }
      });
      if (!sameAuthorityRef(authorization.policy.ref, decision.semanticPayload.qualificationPolicyRef)) {
        throw new ScientificQualificationError('INVALID_QUALIFICATION_DECISION', 'decision qualificationPolicyRef differs from exact authorization policy');
      }

      if (normalized.disposition === 'QUALIFY_USE') allowedUses.push(target);
      else forbiddenUses.push(target);
    }

    if (allowedUses.length === 0) {
      throw new ScientificQualificationError('QUALIFIED_USE_REQUIRED', 'QualifiedKnowledge requires at least one QUALIFY_USE decision');
    }

    const sortedAllowed = deepFreeze([...allowedUses].sort((a, b) => targetKey(a).localeCompare(targetKey(b))));
    const sortedForbidden = deepFreeze([...forbiddenUses].sort((a, b) => targetKey(a).localeCompare(targetKey(b))));

    let superseded;
    if (supersedesQualifiedKnowledgeRef) {
      superseded = resolveKind(this.#ledger, supersedesQualifiedKnowledgeRef, 'QualifiedKnowledge', 'SUPERSEDED_QUALIFIED_KNOWLEDGE_REQUIRED');
      if (!sameAuthorityRef(superseded.semanticPayload.claimRef, pair.claim.ref)
        || !sameAuthorityRef(superseded.semanticPayload.sourceContextRef, pair.sourceContext.ref)) {
        throw new ScientificQualificationError('INVALID_QUALIFIED_KNOWLEDGE_SUPERSESSION', 'requalification must preserve exact Claim + SourceContext identity');
      }
    }

    const qualifiedKnowledge = this.#ledger.publish({
      kind: 'QualifiedKnowledge',
      logicalId: requiredText(qualifiedKnowledgeLogicalId, 'qualifiedKnowledgeLogicalId'),
      version: requiredText(qualifiedKnowledgeVersion, 'qualifiedKnowledgeVersion'),
      semanticPayload: {
        claimRef: pair.claim.ref,
        sourceContextRef: pair.sourceContext.ref,
        sourceRef: pair.source.ref,
        qualificationDecisionRefs: sortedDecisionRefs(decisions),
        allowedUses: sortedAllowed,
        forbiddenUses: sortedForbidden,
        qualificationScope: {
          allowedUseTargets: sortedAllowed,
          forbiddenUseTargets: sortedForbidden
        },
        limitations: aggregateConstraint(decisions, 'limitations'),
        effectModifiers: aggregateConstraint(decisions, 'effectModifiers'),
        semanticPreconditions: aggregateConstraint(decisions, 'semanticPreconditions'),
        transportConstraints: aggregateConstraint(decisions, 'transportConstraints'),
        ownership: cloneCanonicalValue(pair.source.semanticPayload.ownership),
        ...(superseded ? { supersedesQualifiedKnowledgeRef: superseded.ref } : {}),
        authorityClass: 'SCIENTIFIC_USE_AUTHORITY'
      },
      audit: auditEvent(audit, 'qualified-knowledge', [
        pair.claim.ref,
        pair.sourceContext.ref,
        pair.source.ref,
        ...decisions.map((decision) => decision.ref),
        ...(superseded ? [superseded.ref] : [])
      ])
    });

    this.#ledger.addLineage({
      relation: 'derived_from',
      from: qualifiedKnowledge.ref,
      to: pair.claim.ref,
      details: { authorityTransition: 'SOURCE_ASSERTION_TO_SCIENTIFIC_USE_AUTHORITY' },
      audit: auditEvent(audit, 'claim-qualification-lineage', decisions.map((decision) => decision.ref))
    });
    if (superseded) {
      this.#ledger.addLineage({
        relation: 'requalifies',
        from: qualifiedKnowledge.ref,
        to: superseded.ref,
        details: { authorityTransition: 'QUALIFIED_KNOWLEDGE_REQUALIFICATION' },
        audit: auditEvent(audit, 'qualified-knowledge-requalification', decisions.map((decision) => decision.ref))
      });
    }

    return qualifiedKnowledge;
  }

  revokeQualifiedKnowledgeUse({
    revocationLogicalId,
    revocationVersion,
    qualifiedKnowledgeRef,
    qualificationTarget,
    approverPrincipal,
    authorizationDecisionAuditRef,
    reasonCodes,
    rationale,
    audit
  }) {
    const qualifiedKnowledge = resolveKind(this.#ledger, qualifiedKnowledgeRef, 'QualifiedKnowledge', 'QUALIFIED_KNOWLEDGE_REQUIRED');
    const target = canonicalObject(qualificationTarget, 'qualificationTarget');
    if (!(qualifiedKnowledge.semanticPayload.allowedUses ?? []).some((allowed) => targetKey(allowed) === targetKey(target))) {
      throw new ScientificQualificationError('QUALIFIED_USE_NOT_FOUND', 'revocation target is not an allowed use of exact QualifiedKnowledge');
    }
    const pair = assertSourceFaithfulAuthorityPair({
      ledger: this.#ledger,
      claimRef: qualifiedKnowledge.semanticPayload.claimRef,
      sourceContextRef: qualifiedKnowledge.semanticPayload.sourceContextRef
    });
    const authorization = assertQualificationAuthorization({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      approverPrincipal,
      qualificationTarget: target,
      pair,
      audit
    });
    const normalizedReasons = normalizeReasonCodes(reasonCodes, { required: true });

    const revocation = this.#ledger.publish({
      kind: 'ScientificQualificationRevocation',
      logicalId: requiredText(revocationLogicalId, 'revocationLogicalId'),
      version: requiredText(revocationVersion, 'revocationVersion'),
      semanticPayload: {
        qualifiedKnowledgeRef: qualifiedKnowledge.ref,
        claimRef: pair.claim.ref,
        sourceContextRef: pair.sourceContext.ref,
        qualificationTarget: target,
        reasonCodes: normalizedReasons,
        ...(rationale ? { rationale: requiredText(rationale, 'rationale') } : {}),
        approverPrincipal: cloneCanonicalValue(approverPrincipal),
        authorizationDecisionAuditRef: authorization.authAudit.ref,
        qualificationPolicyRef: authorization.policy.ref,
        authorityClass: 'SCIENTIFIC_USE_REVOCATION'
      },
      audit: auditEvent(audit, 'qualification-revocation', [
        qualifiedKnowledge.ref,
        pair.claim.ref,
        pair.sourceContext.ref,
        authorization.authAudit.ref,
        authorization.policy.ref
      ])
    });

    this.#ledger.addLineage({
      relation: 'revokes',
      from: revocation.ref,
      to: qualifiedKnowledge.ref,
      details: { qualificationTarget: target },
      audit: auditEvent(audit, 'qualification-revocation-lineage', [authorization.authAudit.ref])
    });

    return revocation;
  }

  qualifiedUseStatus({ qualifiedKnowledgeRef, qualificationTarget }) {
    const qualifiedKnowledge = resolveKind(this.#ledger, qualifiedKnowledgeRef, 'QualifiedKnowledge', 'QUALIFIED_KNOWLEDGE_REQUIRED');
    const target = canonicalObject(qualificationTarget, 'qualificationTarget');
    const key = targetKey(target);
    if ((qualifiedKnowledge.semanticPayload.forbiddenUses ?? []).some((item) => targetKey(item) === key)) return 'PROHIBITED';
    if (!(qualifiedKnowledge.semanticPayload.allowedUses ?? []).some((item) => targetKey(item) === key)) return 'UNQUALIFIED';

    for (const lineage of this.#ledger.lineageFor(qualifiedKnowledge.ref)) {
      if (lineage.relation !== 'revokes' || !sameAuthorityRef(lineage.to, qualifiedKnowledge.ref)) continue;
      const revocation = resolveKind(this.#ledger, lineage.from, 'ScientificQualificationRevocation', 'QUALIFICATION_REVOCATION_REQUIRED');
      if (targetKey(revocation.semanticPayload.qualificationTarget) === key) return 'REVOKED';
    }
    return 'QUALIFIED';
  }
}
