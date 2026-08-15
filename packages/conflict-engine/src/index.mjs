import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { normalizeScientificUseTarget } from '../../knowledge-registry/src/qualification.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import {
  validateConflictResolutionAuthority,
  validateKnowledgeConflictAuthority
} from './authority.mjs';

export const KNOWLEDGE_CONFLICT_RESOLUTIONS = deepFreeze([
  'PRESERVE_ALTERNATIVES',
  'DERIVED_SYNTHESIS',
  'EXPLICIT_PRECEDENCE',
  'CALIBRATION_REQUIRED'
]);

const RESOLUTION_TYPES = new Set(KNOWLEDGE_CONFLICT_RESOLUTIONS);

export class KnowledgeConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KnowledgeConflictError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeConflictError('INVALID_CONFLICT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function requiredObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new KnowledgeConflictError('INVALID_CONFLICT_INPUT', `${name} must be a non-empty object`);
  }
  return deepFreeze(cloneCanonicalValue(value));
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new KnowledgeConflictError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') throw new KnowledgeConflictError('AUDIT_REQUIRED', 'explicit audit metadata is required');
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

export function conflictAssessmentResourceId(semanticRole) {
  return `knowledge-conflict-assessment:${requiredText(semanticRole, 'semanticRole')}`;
}

export function conflictResolutionResourceId(conflictRef) {
  return `knowledge-conflict-resolution:${conflictRef.kind}/${conflictRef.logicalId}@${conflictRef.version}#${conflictRef.semanticHash}`;
}

function assertScientificApproval({ ledger, authAuditRef, principal, resourceId, target, ownership, audit }) {
  if (!principal || typeof principal !== 'object' || Array.isArray(principal)) {
    throw new KnowledgeConflictError('SCIENTIFIC_APPROVER_REQUIRED', 'exact scientific approver principal is required');
  }
  if (!audit?.actor || audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new KnowledgeConflictError('SCIENTIFIC_APPROVER_ACTOR_MISMATCH', 'audit actor must match exact scientific approver');
  }
  const authAudit = resolveKind(ledger, authAuditRef, 'AuthorizationDecisionAudit', 'CONFLICT_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_QUALIFY' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, principal)) {
    throw new KnowledgeConflictError('CONFLICT_AUTHORIZATION_DENIED', 'conflict authority requires allowed KNOWLEDGE_QUALIFY authorization');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'CONFLICT_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== resourceId || !sameOwnership(policy.semanticPayload.ownership, ownership)) {
    throw new KnowledgeConflictError('CONFLICT_POLICY_MISMATCH', 'conflict policy does not bind exact resource/ownership');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'CONFLICT_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeQualification({
    principal,
    policy,
    roleAssignments: assignments,
    qualificationTarget: target,
    authorizationScope: stored.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new KnowledgeConflictError('CONFLICT_AUTHORIZATION_MISMATCH', 'stored conflict authorization cannot be reproduced');
  }
  return deepFreeze({ authAudit, policy });
}

function validateKnowledgeMember({ ledger, knowledgeRef, useTarget, semanticRole }) {
  if (!knowledgeRef || typeof knowledgeRef !== 'object') throw new KnowledgeConflictError('KNOWLEDGE_MEMBER_REQUIRED', 'knowledgeRef is required');
  if (knowledgeRef.kind === 'QualifiedKnowledge') {
    const validated = validateQualifiedKnowledgeAuthority({ ledger, qualifiedKnowledgeRef: knowledgeRef, requiredUseTarget: useTarget });
    return deepFreeze({
      kind: 'QualifiedKnowledge',
      record: validated.knowledge,
      ownership: validated.knowledge.semanticPayload.ownership,
      originContextRef: validated.sourceContext.ref,
      assertion: validated.claim.semanticPayload.assertion,
      semanticRoleAuthority: 'CONFLICT_ASSESSMENT',
      semanticRole
    });
  }
  if (knowledgeRef.kind === 'DerivedKnowledge') {
    const validated = validateDerivedKnowledgeAuthority({ ledger, derivedKnowledgeRef: knowledgeRef, requiredUseTarget: useTarget });
    if (validated.knowledge.semanticPayload.semanticRole !== semanticRole) {
      throw new KnowledgeConflictError('CONFLICT_ROLE_MISMATCH', 'DerivedKnowledge semantic role differs from conflict role');
    }
    return deepFreeze({
      kind: 'DerivedKnowledge',
      record: validated.knowledge,
      ownership: validated.knowledge.semanticPayload.ownership,
      originContextRef: validated.context.ref,
      assertion: validated.knowledge.semanticPayload.assertion,
      semanticRoleAuthority: 'DERIVED_KNOWLEDGE_AUTHORITY',
      semanticRole
    });
  }
  throw new KnowledgeConflictError('UNSUPPORTED_KNOWLEDGE_MEMBER', `unsupported conflict member kind ${knowledgeRef.kind}`);
}

function activeResolutions(ledger, conflictRef) {
  const records = ledger.exportSnapshot().records.filter((record) =>
    record.ref.kind === 'KnowledgeConflictResolutionDecision'
      && sameAuthorityRef(record.semanticPayload?.knowledgeConflictRef, conflictRef));
  for (const record of records) {
    validateConflictResolutionAuthority({ ledger, conflictResolutionRef: record.ref });
  }
  const superseded = new Set();
  for (const record of records) {
    const predecessor = record.semanticPayload.supersedesResolutionRef;
    if (predecessor) superseded.add(exactRefKey(predecessor));
  }
  return records.filter((record) => !superseded.has(exactRefKey(record.ref)));
}

export class KnowledgeConflictService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function'
      || typeof ledger.exportSnapshot !== 'function' || typeof ledger.publishBatchWithLineage !== 'function') {
      throw new KnowledgeConflictError('INVALID_LEDGER', 'KnowledgeConflictService requires shared replayable AuthorityLedger with atomic authority+lineage publication');
    }
    this.#ledger = ledger;
  }

  createConflict({
    logicalId,
    version,
    semanticRole,
    scientificUseTarget,
    memberKnowledgeRefs,
    overlapAssessment,
    incompatibilityAssessment,
    limitations = [],
    approverPrincipal,
    authorizationDecisionAuditRef,
    audit
  }) {
    const role = requiredText(semanticRole, 'semanticRole');
    const useTarget = normalizeScientificUseTarget(scientificUseTarget);
    if (!Array.isArray(memberKnowledgeRefs) || memberKnowledgeRefs.length < 2) {
      throw new KnowledgeConflictError('CONFLICT_MEMBERS_REQUIRED', 'KnowledgeConflict requires at least two exact knowledge members');
    }
    const unique = new Map(memberKnowledgeRefs.map((ref) => [exactRefKey(ref), ref]));
    if (unique.size !== memberKnowledgeRefs.length) {
      throw new KnowledgeConflictError('DUPLICATE_CONFLICT_MEMBER', 'KnowledgeConflict cannot duplicate the same exact knowledge member');
    }
    const members = [...unique.values()].map((ref) => validateKnowledgeMember({ ledger: this.#ledger, knowledgeRef: ref, useTarget, semanticRole: role }));
    const ownership = members[0].ownership;
    if (!members.every((member) => sameOwnership(member.ownership, ownership))) {
      throw new KnowledgeConflictError('CROSS_OWNER_CONFLICT_NOT_AUTHORIZED', 'K05 v1 does not adjudicate cross-owner scientific conflicts');
    }
    const approval = assertScientificApproval({
      ledger: this.#ledger,
      authAuditRef: authorizationDecisionAuditRef,
      principal: approverPrincipal,
      resourceId: conflictAssessmentResourceId(role),
      target: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
      ownership,
      audit
    });

    const memberBindings = deepFreeze(members.map((member) => ({
      knowledgeRef: member.record.ref,
      knowledgeKind: member.kind,
      originContextRef: member.originContextRef,
      semanticRoleAuthority: member.semanticRoleAuthority,
      assertionHash: semanticHash('ADR-K05-CONFLICT-ASSERTION', member.assertion)
    })).sort((a, b) => exactRefKey(a.knowledgeRef).localeCompare(exactRefKey(b.knowledgeRef))));

    return this.#ledger.publish({
      kind: 'KnowledgeConflict',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        semanticRole: role,
        scientificUseTarget: useTarget,
        memberBindings,
        overlapAssessment: requiredObject(overlapAssessment, 'overlapAssessment'),
        incompatibilityAssessment: requiredObject(incompatibilityAssessment, 'incompatibilityAssessment'),
        assessmentSemantics: 'DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY',
        limitations: Array.isArray(limitations) ? deepFreeze(limitations.map((item, index) => requiredObject(item, `limitations[${index}]`))) : (() => { throw new KnowledgeConflictError('INVALID_CONFLICT_INPUT', 'limitations must be an array'); })(),
        ownership: cloneCanonicalValue(ownership),
        status: 'UNRESOLVED',
        approverPrincipal: cloneCanonicalValue(approverPrincipal),
        authorizationDecisionAuditRef: approval.authAudit.ref,
        assessmentPolicyRef: approval.policy.ref,
        authorityClass: 'KNOWLEDGE_CONFLICT_AUTHORITY'
      },
      audit: auditEvent(audit, 'knowledge-conflict', [approval.authAudit.ref, approval.policy.ref, ...memberBindings.map((item) => item.knowledgeRef), ...memberBindings.map((item) => item.originContextRef)])
    });
  }

  resolveConflict({
    logicalId,
    version,
    knowledgeConflictRef,
    resolutionType,
    selectedKnowledgeRef,
    derivedKnowledgeRef,
    precedenceAuthority,
    rationale,
    approverPrincipal,
    authorizationDecisionAuditRef,
    supersedesResolutionRef,
    audit
  }) {
    const conflictValidation = validateKnowledgeConflictAuthority({ ledger: this.#ledger, knowledgeConflictRef });
    const conflict = conflictValidation.conflict;
    const type = requiredText(resolutionType, 'resolutionType');
    if (!RESOLUTION_TYPES.has(type)) throw new KnowledgeConflictError('INVALID_CONFLICT_RESOLUTION', `unsupported resolutionType ${type}`);
    const ownership = conflict.semanticPayload.ownership;
    const approval = assertScientificApproval({
      ledger: this.#ledger,
      authAuditRef: authorizationDecisionAuditRef,
      principal: approverPrincipal,
      resourceId: conflictResolutionResourceId(conflict.ref),
      target: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
      ownership,
      audit
    });

    const active = activeResolutions(this.#ledger, conflict.ref);
    let predecessor;
    if (active.length > 1) {
      throw new KnowledgeConflictError('UNRESOLVED_RESOLUTION_BRANCHES', 'multiple active conflict-resolution branches require explicit convergence before another resolution');
    }
    if (active.length === 1) {
      if (!supersedesResolutionRef || !sameAuthorityRef(supersedesResolutionRef, active[0].ref)) {
        throw new KnowledgeConflictError('ACTIVE_CONFLICT_RESOLUTION_EXISTS', 'new conflict resolution must explicitly supersede current active resolution');
      }
      predecessor = active[0];
    } else if (supersedesResolutionRef) {
      throw new KnowledgeConflictError('INVALID_CONFLICT_RESOLUTION_SUPERSESSION', 'no active conflict resolution exists to supersede');
    }

    const memberRefs = conflict.semanticPayload.memberBindings.map((item) => item.knowledgeRef);
    const payload = {
      knowledgeConflictRef: conflict.ref,
      resolutionType: type,
      approverPrincipal: cloneCanonicalValue(approverPrincipal),
      authorizationDecisionAuditRef: approval.authAudit.ref,
      resolutionPolicyRef: approval.policy.ref,
      rationale: requiredText(rationale, 'rationale'),
      ...(predecessor ? { supersedesResolutionRef: predecessor.ref } : {}),
      authorityClass: 'KNOWLEDGE_CONFLICT_RESOLUTION'
    };

    if (type === 'EXPLICIT_PRECEDENCE') {
      if (!selectedKnowledgeRef || !memberRefs.some((ref) => sameAuthorityRef(ref, selectedKnowledgeRef))) {
        throw new KnowledgeConflictError('PRECEDENCE_MEMBER_REQUIRED', 'explicit precedence must select one exact conflict member');
      }
      const basis = requiredObject(precedenceAuthority, 'precedenceAuthority');
      if (basis.type === 'NEWEST_WINS' || basis.type === 'LLM_PREFERENCE') {
        throw new KnowledgeConflictError('FORBIDDEN_CONFLICT_SHORTCUT', `${basis.type} cannot resolve KnowledgeConflict`);
      }
      payload.selectedKnowledgeRef = selectedKnowledgeRef;
      payload.precedenceAuthority = basis;
    } else if (selectedKnowledgeRef) {
      throw new KnowledgeConflictError('INVALID_CONFLICT_RESOLUTION', 'selectedKnowledgeRef is legal only for EXPLICIT_PRECEDENCE');
    }

    if (type === 'DERIVED_SYNTHESIS') {
      if (!derivedKnowledgeRef) throw new KnowledgeConflictError('DERIVED_RESOLUTION_REQUIRED', 'DERIVED_SYNTHESIS requires exact DerivedKnowledge');
      const derived = validateDerivedKnowledgeAuthority({
        ledger: this.#ledger,
        derivedKnowledgeRef,
        requiredUseTarget: conflict.semanticPayload.scientificUseTarget
      });
      if (derived.knowledge.semanticPayload.semanticRole !== conflict.semanticPayload.semanticRole) {
        throw new KnowledgeConflictError('DERIVED_RESOLUTION_ROLE_MISMATCH', 'DerivedKnowledge resolution semantic role differs from conflict role');
      }
      const qualifiedMembers = conflict.semanticPayload.memberBindings
        .filter((item) => item.knowledgeKind === 'QualifiedKnowledge')
        .map((item) => item.knowledgeRef);
      if (qualifiedMembers.length !== memberRefs.length
        || !qualifiedMembers.every((ref) => exactRefIn(derived.knowledge.semanticPayload.inputQualifiedKnowledgeRefs, ref))) {
        throw new KnowledgeConflictError('DERIVED_RESOLUTION_INPUT_INCOMPLETE', 'DerivedKnowledge must synthesize every conflict member; K05 v1 derived resolution supports all-QualifiedKnowledge conflicts');
      }
      payload.derivedKnowledgeRef = derived.knowledge.ref;
    } else if (derivedKnowledgeRef) {
      throw new KnowledgeConflictError('INVALID_CONFLICT_RESOLUTION', 'derivedKnowledgeRef is legal only for DERIVED_SYNTHESIS');
    }

    if (type === 'CALIBRATION_REQUIRED') payload.calibrationDisposition = 'REQUIRE_SEPARATE_CALIBRATION_ARTIFACT';
    if (type === 'PRESERVE_ALTERNATIVES') payload.preservedKnowledgeRefs = deepFreeze([...memberRefs]);

    const resolutionRef = predictedRef('KnowledgeConflictResolutionDecision', logicalId, version, payload);
    const lineages = [{
      relation: 'derived_from',
      from: resolutionRef,
      to: conflict.ref,
      details: { lineageRole: 'KNOWLEDGE_CONFLICT_RESOLUTION', resolutionType: type },
      audit: auditEvent(audit, 'resolution-lineage', [approval.authAudit.ref])
    }];
    if (predecessor) {
      lineages.push({
        relation: 'supersedes',
        from: resolutionRef,
        to: predecessor.ref,
        details: { authorityTransition: 'CONFLICT_RESOLUTION_REVISION' },
        audit: auditEvent(audit, 'resolution-supersession', [approval.authAudit.ref])
      });
    }

    const publication = this.#ledger.publishBatchWithLineage({
      entries: [{
        kind: 'KnowledgeConflictResolutionDecision',
        logicalId: requiredText(logicalId, 'logicalId'),
        version: requiredText(version, 'version'),
        semanticPayload: payload,
        audit: auditEvent(audit, 'conflict-resolution', [conflict.ref, approval.authAudit.ref, approval.policy.ref, ...(payload.selectedKnowledgeRef ? [payload.selectedKnowledgeRef] : []), ...(payload.derivedKnowledgeRef ? [payload.derivedKnowledgeRef] : []), ...(predecessor ? [predecessor.ref] : [])])
      }],
      lineages
    });
    return publication.records[0];
  }

  currentResolution({ knowledgeConflictRef }) {
    const conflictValidation = validateKnowledgeConflictAuthority({ ledger: this.#ledger, knowledgeConflictRef });
    const active = activeResolutions(this.#ledger, conflictValidation.conflict.ref);
    if (active.length === 0) return deepFreeze({ status: 'UNRESOLVED', resolution: null });
    if (active.length > 1) return deepFreeze({ status: 'UNRESOLVED_BRANCHES', resolution: null, activeResolutionRefs: active.map((item) => item.ref) });
    return deepFreeze({ status: 'RESOLVED', resolution: active[0] });
  }
}