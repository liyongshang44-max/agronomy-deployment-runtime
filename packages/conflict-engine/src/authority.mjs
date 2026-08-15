import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { normalizeScientificUseTarget } from '../../knowledge-registry/src/qualification.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';

export class ConflictAuthorityValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ConflictAuthorityValidationError';
    this.code = code;
  }
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new ConflictAuthorityValidationError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function conflictAssessmentResourceId(semanticRole) {
  return `knowledge-conflict-assessment:${semanticRole}`;
}

function conflictResolutionResourceId(conflictRef) {
  return `knowledge-conflict-resolution:${conflictRef.kind}/${conflictRef.logicalId}@${conflictRef.version}#${conflictRef.semanticHash}`;
}

function assertApproval({ ledger, authAuditRef, principal, resourceId, target, ownership, directObjectRef, requiredInputRefs }) {
  const authAudit = resolveKind(ledger, authAuditRef, 'AuthorizationDecisionAudit', 'CONFLICT_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_QUALIFY' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, principal)) {
    throw new ConflictAuthorityValidationError('CONFLICT_AUTHORIZATION_INVALID', 'scientific conflict authorization is invalid');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'CONFLICT_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== resourceId || !sameOwnership(policy.semanticPayload.ownership, ownership)) {
    throw new ConflictAuthorityValidationError('CONFLICT_AUTHORIZATION_INVALID', 'conflict policy does not bind exact resource/ownership');
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
    throw new ConflictAuthorityValidationError('CONFLICT_AUTHORIZATION_INVALID', 'conflict authorization cannot be reproduced');
  }

  const auditValid = ledger.auditFor(directObjectRef).some((event) =>
    sameAuthorityRef(event.objectRef, directObjectRef)
      && event.actor?.id === principal.principalId
      && event.actor?.type === principal.type
      && exactRefIn(event.inputRefs, authAudit.ref)
      && exactRefIn(event.inputRefs, policy.ref)
      && requiredInputRefs.every((ref) => exactRefIn(event.inputRefs, ref)));
  if (!auditValid) {
    throw new ConflictAuthorityValidationError('CONFLICT_DIRECT_AUDIT_INVALID', 'conflict authority lacks direct approver audit over exact inputs');
  }
  return { authAudit, policy };
}

function validateMember({ ledger, binding, useTarget, semanticRole }) {
  if (binding.knowledgeKind === 'QualifiedKnowledge') {
    const validated = validateQualifiedKnowledgeAuthority({
      ledger,
      qualifiedKnowledgeRef: binding.knowledgeRef,
      requiredUseTarget: useTarget
    });
    if (!sameAuthorityRef(binding.originContextRef, validated.sourceContext.ref)) {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_INVALID', 'QualifiedKnowledge conflict member origin context is substituted');
    }
    if (binding.semanticRoleAuthority !== 'CONFLICT_ASSESSMENT') {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_ROLE_INVALID', 'QualifiedKnowledge semantic role must be explicit conflict-assessment authority');
    }
    const assertionHash = semanticHash('ADR-K05-CONFLICT-ASSERTION', validated.claim.semanticPayload.assertion);
    if (binding.assertionHash !== assertionHash) {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_INVALID', 'QualifiedKnowledge conflict assertion hash differs from exact Claim');
    }
    return { record: validated.knowledge, ownership: validated.knowledge.semanticPayload.ownership, validated };
  }
  if (binding.knowledgeKind === 'DerivedKnowledge') {
    const validated = validateDerivedKnowledgeAuthority({
      ledger,
      derivedKnowledgeRef: binding.knowledgeRef,
      requiredUseTarget: useTarget
    });
    if (validated.knowledge.semanticPayload.semanticRole !== semanticRole) {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_ROLE_INVALID', 'DerivedKnowledge semantic role differs from conflict role');
    }
    if (!sameAuthorityRef(binding.originContextRef, validated.context.ref)) {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_INVALID', 'DerivedKnowledge conflict member origin context is substituted');
    }
    const assertionHash = semanticHash('ADR-K05-CONFLICT-ASSERTION', validated.knowledge.semanticPayload.assertion);
    if (binding.assertionHash !== assertionHash) {
      throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_INVALID', 'DerivedKnowledge conflict assertion hash differs from exact authority');
    }
    return { record: validated.knowledge, ownership: validated.knowledge.semanticPayload.ownership, validated };
  }
  throw new ConflictAuthorityValidationError('CONFLICT_MEMBER_INVALID', `unsupported conflict member kind ${binding.knowledgeKind}`);
}

export function validateKnowledgeConflictAuthority({ ledger, knowledgeConflictRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ConflictAuthorityValidationError('INVALID_LEDGER', 'replayable AuthorityLedger is required');
  }
  const conflict = resolveKind(ledger, knowledgeConflictRef, 'KnowledgeConflict', 'KNOWLEDGE_CONFLICT_REQUIRED');
  const payload = conflict.semanticPayload;
  if (payload.authorityClass !== 'KNOWLEDGE_CONFLICT_AUTHORITY' || payload.status !== 'UNRESOLVED') {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'KnowledgeConflict authority class/status is invalid');
  }
  if (payload.assessmentSemantics !== 'DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY') {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'overlap/incompatibility assessments must remain declarative scientific judgments in K05');
  }
  if (typeof payload.semanticRole !== 'string' || payload.semanticRole.length === 0) {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'semanticRole is required');
  }
  const useTarget = normalizeScientificUseTarget(payload.scientificUseTarget);
  if (!Array.isArray(payload.memberBindings) || payload.memberBindings.length < 2) {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'KnowledgeConflict requires at least two member bindings');
  }
  if (!payload.overlapAssessment || typeof payload.overlapAssessment !== 'object'
    || !payload.incompatibilityAssessment || typeof payload.incompatibilityAssessment !== 'object') {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'explicit overlap and incompatibility assessments are required');
  }
  const unique = new Set(payload.memberBindings.map((binding) => exactRefKey(binding.knowledgeRef)));
  if (unique.size !== payload.memberBindings.length) {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'duplicate exact conflict members are forbidden');
  }
  const members = payload.memberBindings.map((binding) => validateMember({
    ledger,
    binding,
    useTarget,
    semanticRole: payload.semanticRole
  }));
  const ownership = members[0].ownership;
  if (!members.every((member) => sameOwnership(member.ownership, ownership)) || !sameOwnership(payload.ownership, ownership)) {
    throw new ConflictAuthorityValidationError('CONFLICT_OWNERSHIP_INVALID', 'K05 conflict crosses ownership boundary');
  }

  const approval = assertApproval({
    ledger,
    authAuditRef: payload.authorizationDecisionAuditRef,
    principal: payload.approverPrincipal,
    resourceId: conflictAssessmentResourceId(payload.semanticRole),
    target: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    ownership,
    directObjectRef: conflict.ref,
    requiredInputRefs: [
      ...payload.memberBindings.map((binding) => binding.knowledgeRef),
      ...payload.memberBindings.map((binding) => binding.originContextRef)
    ]
  });
  if (!sameAuthorityRef(payload.assessmentPolicyRef, approval.policy.ref)) {
    throw new ConflictAuthorityValidationError('KNOWLEDGE_CONFLICT_INVALID', 'assessmentPolicyRef differs from exact authorization policy');
  }
  return deepFreeze({ conflict, useTarget, members, approval });
}

export function validateConflictResolutionAuthority({ ledger, conflictResolutionRef }) {
  const resolution = resolveKind(
    ledger,
    conflictResolutionRef,
    'KnowledgeConflictResolutionDecision',
    'CONFLICT_RESOLUTION_REQUIRED'
  );
  const payload = resolution.semanticPayload;
  if (payload.authorityClass !== 'KNOWLEDGE_CONFLICT_RESOLUTION') {
    throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'conflict resolution authorityClass is invalid');
  }
  const conflictValidation = validateKnowledgeConflictAuthority({ ledger, knowledgeConflictRef: payload.knowledgeConflictRef });
  const conflict = conflictValidation.conflict;
  const members = conflict.semanticPayload.memberBindings.map((binding) => binding.knowledgeRef);
  const requiredResolutionInputs = [conflict.ref];
  if (payload.selectedKnowledgeRef) requiredResolutionInputs.push(payload.selectedKnowledgeRef);
  if (payload.derivedKnowledgeRef) requiredResolutionInputs.push(payload.derivedKnowledgeRef);
  if (payload.supersedesResolutionRef) requiredResolutionInputs.push(payload.supersedesResolutionRef);
  const approval = assertApproval({
    ledger,
    authAuditRef: payload.authorizationDecisionAuditRef,
    principal: payload.approverPrincipal,
    resourceId: conflictResolutionResourceId(conflict.ref),
    target: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    ownership: conflict.semanticPayload.ownership,
    directObjectRef: resolution.ref,
    requiredInputRefs: requiredResolutionInputs
  });
  if (!sameAuthorityRef(payload.resolutionPolicyRef, approval.policy.ref)) {
    throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'resolutionPolicyRef differs from exact authorization policy');
  }

  const type = payload.resolutionType;
  if (type === 'PRESERVE_ALTERNATIVES') {
    if (!Array.isArray(payload.preservedKnowledgeRefs)
      || payload.preservedKnowledgeRefs.length !== members.length
      || !members.every((member) => exactRefIn(payload.preservedKnowledgeRefs, member))) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'PRESERVE_ALTERNATIVES must retain every exact conflict member');
    }
    if ('selectedKnowledgeRef' in payload || 'derivedKnowledgeRef' in payload) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'PRESERVE_ALTERNATIVES cannot select a winner');
    }
  } else if (type === 'EXPLICIT_PRECEDENCE') {
    if (!payload.selectedKnowledgeRef || !members.some((member) => sameAuthorityRef(member, payload.selectedKnowledgeRef))) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'EXPLICIT_PRECEDENCE must select one exact member');
    }
    if (!payload.precedenceAuthority || ['NEWEST_WINS', 'LLM_PREFERENCE'].includes(payload.precedenceAuthority.type)) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'explicit scientific precedence authority is required');
    }
  } else if (type === 'DERIVED_SYNTHESIS') {
    const derived = validateDerivedKnowledgeAuthority({
      ledger,
      derivedKnowledgeRef: payload.derivedKnowledgeRef,
      requiredUseTarget: conflict.semanticPayload.scientificUseTarget
    });
    if (derived.knowledge.semanticPayload.semanticRole !== conflict.semanticPayload.semanticRole) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'derived resolution role differs from conflict role');
    }
    const qualifiedMembers = conflict.semanticPayload.memberBindings.filter((binding) => binding.knowledgeKind === 'QualifiedKnowledge');
    if (qualifiedMembers.length !== members.length
      || !members.every((member) => exactRefIn(derived.knowledge.semanticPayload.inputQualifiedKnowledgeRefs, member))) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'derived resolution does not close exact all-QualifiedKnowledge conflict member set');
    }
  } else if (type === 'CALIBRATION_REQUIRED') {
    if (payload.calibrationDisposition !== 'REQUIRE_SEPARATE_CALIBRATION_ARTIFACT'
      || 'calibrationArtifactRef' in payload || 'derivedKnowledgeRef' in payload) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'CALIBRATION_REQUIRED cannot imply calibration/derived authority');
    }
  } else {
    throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', `unsupported resolution type ${type}`);
  }

  if (payload.supersedesResolutionRef) {
    const predecessor = resolveKind(ledger, payload.supersedesResolutionRef, 'KnowledgeConflictResolutionDecision', 'CONFLICT_RESOLUTION_PREDECESSOR_REQUIRED');
    if (!sameAuthorityRef(predecessor.semanticPayload.knowledgeConflictRef, conflict.ref)) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_INVALID', 'resolution supersession crosses KnowledgeConflict boundary');
    }
    const supersessionLineage = ledger.lineageFor(resolution.ref).some((edge) =>
      edge.relation === 'supersedes'
        && sameAuthorityRef(edge.from, resolution.ref)
        && sameAuthorityRef(edge.to, predecessor.ref));
    if (!supersessionLineage) {
      throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_LINEAGE_INVALID', 'resolution predecessor is declared without exact supersession lineage');
    }
  }
  const resolutionLineage = ledger.lineageFor(resolution.ref).some((edge) =>
    edge.relation === 'derived_from'
      && sameAuthorityRef(edge.from, resolution.ref)
      && sameAuthorityRef(edge.to, conflict.ref)
      && edge.details?.lineageRole === 'KNOWLEDGE_CONFLICT_RESOLUTION');
  if (!resolutionLineage) {
    throw new ConflictAuthorityValidationError('CONFLICT_RESOLUTION_LINEAGE_INVALID', 'resolution lacks exact conflict lineage');
  }
  return deepFreeze({ resolution, conflictValidation, approval });
}