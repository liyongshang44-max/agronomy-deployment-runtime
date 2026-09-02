import { createHash } from 'node:crypto';

import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY,
  AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError,
  agronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthorityRefs,
  agronomicContextHistoricalTimezoneBoundaryResolutionHash,
  normalizeAgronomicContextHistoricalTimezoneBoundaryResolution,
  normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation
} from './context-historical-timezone-boundary-resolution-contract.mjs';
import {
  validateAgronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthority
} from './context-calendar-date-local-civil-frame-binding-authority.mjs';

export const AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    'REJECT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION'
  ]);

export const AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_LOCAL_CIVIL_FRAME_AUTHORITY_VERIFIED',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_LOCAL_CIVIL_DAY_VERIFIED',
    'EXACT_ZONE_ID_AMERICA_CHICAGO_VERIFIED',
    'IANA_TZDB_PROVIDER_VERIFIED',
    'IANA_RELEASE_2026C_VERIFIED',
    'IANA_TZDATA_2026C_ARTIFACT_VERIFIED',
    'IANA_TZDATA_2026C_SHA512_VERIFIED',
    'EXACT_NORTHAMERICA_RULE_EVIDENCE_VERIFIED',
    'AMERICA_CHICAGO_BASE_OFFSET_RULE_VERIFIED',
    'US_2007_PLUS_SPRING_RULE_VERIFIED',
    'US_2007_PLUS_FALL_RULE_VERIFIED',
    '2011_SPRING_TRANSITION_DATE_VERIFIED',
    '2011_FALL_TRANSITION_DATE_VERIFIED',
    'LOCAL_DAY_WITHIN_DAYLIGHT_PERIOD_VERIFIED',
    'BASE_OFFSET_MINUS_06_VERIFIED',
    'DAYLIGHT_SAVE_PLUS_01_VERIFIED',
    'EFFECTIVE_OFFSET_MINUS_05_VERIFIED',
    'DST_STATE_DAYLIGHT_VERIFIED',
    'LOCAL_BOUNDARIES_VERIFIED',
    'CANONICAL_UTC_EFFECTIVE_INTERVAL_VERIFIED',
    'NO_HOST_TIMEZONE_DATABASE_AUTHORITY',
    'NO_MUTABLE_LATEST_RULE_AUTHORITY',
    'NO_GENERIC_TIMEZONE_RESOLUTION_RULE',
    'NO_INTERVAL_CLOSURE_SEMANTICS_INVENTED',
    'NO_AVAILABLE_AT_MUTATION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS);

const REQUIRED_NORTHAMERICA_RULE_LINES = deepFreeze([
  'Rule\tUS\t2007\tmax\t-\tMar\tSun>=8\t2:00\t1:00\tD',
  'Rule\tUS\t2007\tmax\t-\tNov\tSun>=1\t2:00\t0\tS',
  'Zone America/Chicago\t-5:50:36 -\tLMT\t1883 Nov 18 18:00u',
  '\t\t\t-6:00\tUS\tC%sT\t1920',
  '\t\t\t-6:00\tUS\tC%sT'
]);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LEDGER_REQUIRED',
      'historical timezone boundary resolution authority requires AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value;
}

function sameSemanticValue(a, b) {
  return canonicalizeSemanticJson(a) === canonicalizeSemanticJson(b);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function uniqueRefs(refs) {
  const map = new Map();
  for (const ref of refs) map.set(refKey(ref), ref);
  return [...map.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)));
}

function normalizeReviewerPrincipal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEWER_REQUIRED',
      'reviewerPrincipal must be an object'
    );
  }
  return deepFreeze({
    principalId: text(value.principalId, 'reviewerPrincipal.principalId'),
    type: text(value.type, 'reviewerPrincipal.type'),
    organizationId: text(value.organizationId, 'reviewerPrincipal.organizationId'),
    ...(value.tenantId ? {tenantId: text(value.tenantId, 'reviewerPrincipal.tenantId')} : {})
  });
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const checks = values.map((value, index) => text(value, `confirmedChecks[${index}]`));
  if (new Set(checks).size !== checks.length) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const check of checks) {
    if (!REQUIRED_CHECKS.has(check)) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_CHECKS_INVALID',
        `unsupported historical timezone review check ${check}`
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION') {
    for (const required of REQUIRED_CHECKS) {
      if (!checks.includes(required)) {
        throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
          'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_INCOMPLETE',
          `accepted historical timezone review must confirm ${required}`
        );
      }
    }
  }
  return deepFreeze([...checks].sort());
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor || audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_ACTOR_MISMATCH',
      'audit actor must match exact reviewer'
    );
  }
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function exactEvidenceObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_REQUIRED',
      'timezoneRuleEvidence must be an object'
    );
  }
  const keys = new Set(['releaseEvidenceText', 'northamericaRuleText', 'transitionDerivationText']);
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_INVALID',
        `timezoneRuleEvidence.${key} is not accepted retained evidence`
      );
    }
  }
  for (const key of keys) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_REQUIRED',
        `timezoneRuleEvidence.${key} must contain retained bytes`
      );
    }
  }
  return value;
}

function gregorianWeekday(year, month, day) {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let adjustedYear = year;
  if (month < 3) adjustedYear -= 1;
  return (
    adjustedYear
    + Math.floor(adjustedYear / 4)
    - Math.floor(adjustedYear / 100)
    + Math.floor(adjustedYear / 400)
    + offsets[month - 1]
    + day
  ) % 7;
}

function firstSundayOnOrAfter(year, month, day) {
  const weekday = gregorianWeekday(year, month, day);
  return day + ((7 - weekday) % 7);
}

function verifyTimezoneRuleEvidence(timezoneRuleEvidence) {
  const evidence = exactEvidenceObject(timezoneRuleEvidence);
  const hashes = deepFreeze({
    releaseEvidenceSha256: sha256Text(evidence.releaseEvidenceText),
    northamericaRuleEvidenceSha256: sha256Text(evidence.northamericaRuleText),
    transitionDerivationSha256: sha256Text(evidence.transitionDerivationText)
  });
  const expected = AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY.retainedEvidence;
  if (
    hashes.releaseEvidenceSha256 !== expected.releaseEvidenceSha256
    || hashes.northamericaRuleEvidenceSha256 !== expected.northamericaRuleEvidenceSha256
    || hashes.transitionDerivationSha256 !== expected.transitionDerivationSha256
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_HASH_MISMATCH',
      'retained IANA 2026c rule evidence bytes do not match the accepted evidence hashes'
    );
  }
  for (const line of REQUIRED_NORTHAMERICA_RULE_LINES) {
    if (!evidence.northamericaRuleText.includes(line)) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_INVALID',
        `retained northamerica evidence is missing required rule line: ${line}`
      );
    }
  }
  const springDay = firstSundayOnOrAfter(2011, 3, 8);
  const fallDay = firstSundayOnOrAfter(2011, 11, 1);
  if (springDay !== 13 || fallDay !== 6) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_TRANSITION_DERIVATION_INVALID',
      'Gregorian transition derivation did not reproduce 2011-03-13 / 2011-11-06'
    );
  }
  const derived = deepFreeze({
    historicalResolution: deepFreeze({
      springTransitionDate: '2011-03-13',
      fallTransitionDate: '2011-11-06',
      baseOffset: '-06:00',
      daylightSave: '+01:00',
      effectiveOffset: '-05:00',
      dstState: 'DAYLIGHT'
    }),
    localBoundaryProjection: deepFreeze({
      start: '2011-05-03T00:00:00-05:00',
      end: '2011-05-04T00:00:00-05:00'
    }),
    effectiveInterval: deepFreeze({
      start: '2011-05-03T05:00:00.000Z',
      end: '2011-05-04T05:00:00.000Z'
    })
  });
  return deepFreeze({hashes, derived});
}

function resolveAuthorizationCoverage({ledger, authorizationDecisionAuditRefs, reviewerPrincipal, requiredSources}) {
  if (!Array.isArray(authorizationDecisionAuditRefs) || authorizationDecisionAuditRefs.length !== requiredSources.length) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORIZATION_REQUIRED',
      'review requires one exact source-inspection authorization per predecessor source'
    );
  }
  const records = authorizationDecisionAuditRefs.map((ref) => ledger.resolve(ref));
  for (const source of requiredSources) {
    const resourceId = sourceReviewResourceId(source.ref);
    const matches = records.filter((record) => {
      const decision = record.semanticPayload ?? {};
      if (
        record.ref.kind !== 'AuthorizationDecisionAudit'
        || decision.allowed !== true
        || decision.operation !== 'KNOWLEDGE_INSPECT'
        || !samePrincipalIdentity(decision.principal, reviewerPrincipal)
      ) return false;
      const policy = ledger.resolve(decision.policyRef);
      return policy.ref.kind === 'KnowledgeGovernancePolicy'
        && policy.semanticPayload?.resourceId === resourceId;
    });
    if (matches.length !== 1) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORIZATION_INVALID',
        'review authorization must cover each exact predecessor source exactly once'
      );
    }
    const decision = matches[0].semanticPayload;
    const policy = ledger.resolve(decision.policyRef);
    const assignments = (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
    const recomputed = authorizeKnowledgeInspection({
      principal: reviewerPrincipal,
      policy,
      roleAssignments: assignments,
      authorizationScope: decision.request?.authorizationScope
    });
    const hasGrant = assignments.some((assignment) =>
      assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
    );
    if (!recomputed.allowed || recomputed.decisionHash !== decision.decisionHash || !hasGrant) {
      throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
        'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORIZATION_INVALID',
        'review authorization cannot be reproduced'
      );
    }
  }
  return deepFreeze(records);
}

function requiredPredecessorSources(parent) {
  const timezone = parent.sourceNativeTimezoneIdentityBinding;
  const refs = uniqueRefs([
    timezone.parentOccurrence.source.ref,
    ...timezone.replayedEvidence.map((entry) => entry.source.ref),
    ...timezone.targetIdentityBinding.replayedEvidence.map((entry) => entry.source.ref)
  ]);
  return refs.map((ref) => parent.record ? ref : ref);
}

function validateResolutionWorld({ledger, sourceRegistry, resolution, timezoneRuleEvidence}) {
  const normalized = normalizeAgronomicContextHistoricalTimezoneBoundaryResolution(resolution);
  const parent = validateAgronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthority({
    ledger,
    sourceRegistry,
    compilationRef: normalized.parentCalendarDateLocalCivilFrameBindingCompilationRef
  });
  if (!sameSemanticValue(normalized.targetContextSemantic, parent.semanticPayload.binding.targetContextSemantic)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_TARGET_MISMATCH',
      'target semantic/value must equal exact DEC-0029 predecessor'
    );
  }
  if (!sameSemanticValue(normalized.localCivilFrame, parent.semanticPayload.binding.temporalFrame)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_LOCAL_CIVIL_FRAME_MISMATCH',
      'localCivilFrame must equal exact DEC-0029 LOCAL_CIVIL_DAY frame'
    );
  }
  const evidence = verifyTimezoneRuleEvidence(timezoneRuleEvidence);
  if (!sameSemanticValue(normalized.timezoneRuleAuthority.retainedEvidence, evidence.hashes)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_MISMATCH',
      'resolution must bind exact retained evidence hashes'
    );
  }
  if (
    !sameSemanticValue(normalized.historicalResolution, evidence.derived.historicalResolution)
    || !sameSemanticValue(normalized.localBoundaryProjection, evidence.derived.localBoundaryProjection)
    || !sameSemanticValue(normalized.effectiveInterval, evidence.derived.effectiveInterval)
  ) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_DERIVATION_MISMATCH',
      'resolved offset, DST state and boundaries must be replayed from accepted retained rule bytes'
    );
  }
  const requiredSourceRefs = requiredPredecessorSources(parent);
  const requiredSources = requiredSourceRefs.map((ref) => ledger.resolve(ref));
  return deepFreeze({normalized, parent, evidence, requiredSources});
}

export function publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  resolution,
  timezoneRuleEvidence,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_DISPOSITION',
      'unsupported historical timezone boundary resolution review disposition'
    );
  }
  const reviewer = normalizeReviewerPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateResolutionWorld({ledger, sourceRegistry, resolution, timezoneRuleEvidence});
  const auths = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);
  const resolutionHash = agronomicContextHistoricalTimezoneBoundaryResolutionHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentCalendarDateLocalCivilFrameBindingCompilationRef:
      world.normalized.parentCalendarDateLocalCivilFrameBindingCompilationRef,
    targetContextSemantic: cloneCanonicalValue(world.normalized.targetContextSemantic),
    localCivilFrame: cloneCanonicalValue(world.normalized.localCivilFrame),
    timezoneRuleAuthority: cloneCanonicalValue(world.normalized.timezoneRuleAuthority),
    ruleEvidenceHashes: cloneCanonicalValue(world.evidence.hashes),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  });
  return ledger.publish({
    kind: 'AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORITY',
      resolution: cloneCanonicalValue(world.normalized),
      resolutionHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: auths.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
      inputRefs: [
        world.normalized.parentCalendarDateLocalCivilFrameBindingCompilationRef,
        ...world.requiredSources.map((source) => source.ref),
        ...auths.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        resolutionHash,
        disposition,
        predecessorBindings,
        ruleEvidenceHashes: cloneCanonicalValue(world.evidence.hashes),
        historicalResolution: cloneCanonicalValue(world.normalized.historicalResolution),
        effectiveInterval: cloneCanonicalValue(world.normalized.effectiveInterval)
      }
    }
  });
}

function validateReview({ledger, sourceRegistry, reviewRef, normalizedCompilation, timezoneRuleEvidence}) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_REQUIRED',
      'publication requires historical timezone boundary resolution review'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass !== 'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORITY') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_INVALID',
      'invalid review authorityClass'
    );
  }
  if (payload.disposition !== 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_REJECTED',
      'only accepted review can authorize publication'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);
  const resolution = normalizedCompilation.resolution;
  const resolutionHash = agronomicContextHistoricalTimezoneBoundaryResolutionHash(resolution);
  if (payload.resolutionHash !== resolutionHash || !sameSemanticValue(payload.resolution, resolution)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_MISMATCH',
      'review must bind exact normalized resolution'
    );
  }
  const world = validateResolutionWorld({ledger, sourceRegistry, resolution, timezoneRuleEvidence});
  const expected = {
    parentCalendarDateLocalCivilFrameBindingCompilationRef:
      resolution.parentCalendarDateLocalCivilFrameBindingCompilationRef,
    targetContextSemantic: cloneCanonicalValue(resolution.targetContextSemantic),
    localCivilFrame: cloneCanonicalValue(resolution.localCivilFrame),
    timezoneRuleAuthority: cloneCanonicalValue(resolution.timezoneRuleAuthority),
    ruleEvidenceHashes: cloneCanonicalValue(world.evidence.hashes),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemanticValue(payload.predecessorBindings, expected)) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessor bindings must match exact DEC-0029 + retained IANA rule world'
    );
  }
  const reviewer = normalizeReviewerPrincipal(payload.reviewerPrincipal);
  const auths = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  const direct = ledger.auditFor(review.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, review.ref))
    .some((entry) =>
      entry.action === 'REVIEW_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION'
      && entry.actor?.id === reviewer.principalId
      && entry.actor?.type === reviewer.type
      && exactRefIn(entry.inputRefs, resolution.parentCalendarDateLocalCivilFrameBindingCompilationRef)
      && world.requiredSources.every((source) => exactRefIn(entry.inputRefs, source.ref))
      && auths.every((auth) => exactRefIn(entry.inputRefs, auth.ref))
      && entry.details?.resolutionHash === resolutionHash
      && sameSemanticValue(entry.details?.predecessorBindings, expected)
      && sameSemanticValue(entry.details?.ruleEvidenceHashes, world.evidence.hashes)
      && sameSemanticValue(entry.details?.historicalResolution, resolution.historicalResolution)
      && sameSemanticValue(entry.details?.effectiveInterval, resolution.effectiveInterval)
    );
  if (!direct) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUDIT_INVALID',
      'review lacks direct audit'
    );
  }
  return deepFreeze({review, reviewer, auths, world});
}

export function publishAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  timezoneRuleEvidence,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 requires COMPLETE targeted coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.boundaryReviewRef,
    normalizedCompilation: normalized,
    timezoneRuleEvidence
  });
  assertAuditActor(audit, review.reviewer);
  const refs = agronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthorityRefs(normalized);
  return ledger.publish({
    kind: 'AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass: 'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_AUTHORITY',
        resolutionHash: normalized.resolutionHash,
        boundaryReviewRef: review.review.ref,
        parentCalendarDateLocalCivilFrameBindingCompilationRef:
          normalized.resolution.parentCalendarDateLocalCivilFrameBindingCompilationRef,
        timezoneRuleAuthority: cloneCanonicalValue(normalized.resolution.timezoneRuleAuthority),
        ruleEvidenceHashes: cloneCanonicalValue(review.world.evidence.hashes),
        historicalResolution: cloneCanonicalValue(normalized.resolution.historicalResolution),
        effectiveInterval: cloneCanonicalValue(normalized.resolution.effectiveInterval)
      }
    }
  });
}

export function validateAgronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef,
  timezoneRuleEvidence
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_REQUIRED',
      `expected historical timezone boundary resolution compilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 resolution must have COMPLETE coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.boundaryReviewRef,
    normalizedCompilation: normalized,
    timezoneRuleEvidence
  });
  const refs = agronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthorityRefs(normalized);
  const direct = ledger.auditFor(record.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, record.ref))
    .some((entry) =>
      entry.action === 'PUBLISH_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION'
      && entry.actor?.id === review.reviewer.principalId
      && entry.actor?.type === review.reviewer.type
      && refs.every((ref) => exactRefIn(entry.inputRefs, ref))
      && entry.details?.resolutionHash === normalized.resolutionHash
      && sameAuthorityRef(entry.details?.boundaryReviewRef, review.review.ref)
      && sameAuthorityRef(
        entry.details?.parentCalendarDateLocalCivilFrameBindingCompilationRef,
        normalized.resolution.parentCalendarDateLocalCivilFrameBindingCompilationRef
      )
      && sameSemanticValue(entry.details?.timezoneRuleAuthority, normalized.resolution.timezoneRuleAuthority)
      && sameSemanticValue(entry.details?.ruleEvidenceHashes, review.world.evidence.hashes)
      && sameSemanticValue(entry.details?.historicalResolution, normalized.resolution.historicalResolution)
      && sameSemanticValue(entry.details?.effectiveInterval, normalized.resolution.effectiveInterval)
    );
  if (!direct) {
    throw new AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError(
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUDIT_INVALID',
      'historical timezone boundary resolution compilation lacks direct reviewer audit'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    boundaryReview: review.review,
    calendarDateLocalCivilFrameBinding: review.world.parent,
    ruleEvidenceHashes: review.world.evidence.hashes
  });
}
