import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { normalizeScientificUseTarget } from '../../knowledge-registry/src/qualification.mjs';

export class DerivedAuthorityValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DerivedAuthorityValidationError';
    this.code = code;
  }
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new DerivedAuthorityValidationError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function canonicalEqual(left, right) {
  return semanticHash('ADR-K05-DERIVED-AUTHORITY-VALIDATION', left) === semanticHash('ADR-K05-DERIVED-AUTHORITY-VALIDATION', right);
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function derivationMethodResourceId(logicalId) {
  return `derivation-method:${logicalId}`;
}

function synthesisResourceId(methodRef) {
  return `derived-knowledge-synthesis:${methodRef.kind}/${methodRef.logicalId}@${methodRef.version}#${methodRef.semanticHash}`;
}

function assertApproval({ ledger, authAuditRef, principal, policyRef, resourceId, target, ownership }) {
  const authAudit = resolveKind(ledger, authAuditRef, 'AuthorizationDecisionAudit', 'DERIVED_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_QUALIFY' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, principal)) {
    throw new DerivedAuthorityValidationError('DERIVED_AUTHORIZATION_INVALID', 'stored scientific authorization is invalid');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'DERIVED_POLICY_REQUIRED');
  if (!sameAuthorityRef(policy.ref, policyRef) || policy.semanticPayload.resourceId !== resourceId) {
    throw new DerivedAuthorityValidationError('DERIVED_AUTHORIZATION_INVALID', 'scientific authorization policy does not bind exact governed resource');
  }
  if (!sameOwnership(policy.semanticPayload.ownership, ownership)) {
    throw new DerivedAuthorityValidationError('DERIVED_AUTHORIZATION_INVALID', 'scientific authorization ownership differs from derived authority ownership');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'DERIVED_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeQualification({
    principal,
    policy,
    roleAssignments: assignments,
    qualificationTarget: target,
    authorizationScope: stored.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new DerivedAuthorityValidationError('DERIVED_AUTHORIZATION_INVALID', 'scientific authorization cannot be reproduced');
  }
  return { authAudit, policy };
}

function hasLineage(ledger, from, to, lineageRole) {
  return ledger.lineageFor(from).some((edge) =>
    edge.relation === 'derived_from'
      && sameAuthorityRef(edge.from, from)
      && sameAuthorityRef(edge.to, to)
      && edge.details?.lineageRole === lineageRole);
}

function assertDirectMethodAudit(ledger, method, approval) {
  const principal = method.semanticPayload.approverPrincipal;
  const valid = ledger.auditFor(method.ref).some((event) =>
    sameAuthorityRef(event.objectRef, method.ref)
      && event.actor?.id === principal.principalId
      && event.actor?.type === principal.type
      && exactRefIn(event.inputRefs, approval.authAudit.ref)
      && exactRefIn(event.inputRefs, approval.policy.ref));
  if (!valid) {
    throw new DerivedAuthorityValidationError('DERIVATION_METHOD_AUDIT_INVALID', 'DerivationMethod lacks direct approver audit over exact authorization/policy');
  }
}

export function validateDerivedKnowledgeAuthority({ ledger, derivedKnowledgeRef, requiredUseTarget = null }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function' || typeof ledger.lineageFor !== 'function') {
    throw new DerivedAuthorityValidationError('INVALID_LEDGER', 'replayable AuthorityLedger is required');
  }
  const knowledge = resolveKind(ledger, derivedKnowledgeRef, 'DerivedKnowledge', 'DERIVED_KNOWLEDGE_REQUIRED');
  const payload = knowledge.semanticPayload;
  if (payload.authorityClass !== 'DERIVATION_AUTHORITY') {
    throw new DerivedAuthorityValidationError('DERIVED_KNOWLEDGE_INVALID', 'DerivedKnowledge authorityClass is invalid');
  }
  if (payload.derivationEvidenceClass !== 'SCIENTIFIC_ADJUDICATION_RECORD') {
    throw new DerivedAuthorityValidationError(
      'DERIVATION_EVIDENCE_CLASS_INVALID',
      'K05 DerivedKnowledge records governed scientific adjudication; it must not imply executed model/computation proof'
    );
  }
  if ('calibrationArtifactRef' in payload || 'calibrationBindings' in payload) {
    throw new DerivedAuthorityValidationError('CALIBRATION_LAUNDERING_FORBIDDEN', 'CalibrationArtifact semantics cannot be embedded in DerivedKnowledge');
  }
  const useTarget = normalizeScientificUseTarget(payload.scientificUseTarget);
  if (requiredUseTarget && normalizeScientificUseTarget(requiredUseTarget).use !== useTarget.use) {
    throw new DerivedAuthorityValidationError('DERIVED_USE_MISMATCH', 'DerivedKnowledge scientific use differs from required use');
  }

  const context = resolveKind(ledger, payload.derivedKnowledgeContextRef, 'DerivedKnowledgeContext', 'DERIVED_CONTEXT_REQUIRED');
  if (context.semanticPayload.authorityClass !== 'DERIVED_KNOWLEDGE_CONTEXT') {
    throw new DerivedAuthorityValidationError('DERIVED_CONTEXT_INVALID', 'DerivedKnowledgeContext authorityClass is invalid');
  }
  if (!sameAuthorityRef(context.semanticPayload.derivationMethodRef, payload.derivationMethodRef)) {
    throw new DerivedAuthorityValidationError('DERIVED_CONTEXT_INVALID', 'DerivedKnowledge and DerivedKnowledgeContext bind different derivation methods');
  }
  if (!canonicalEqual(context.semanticPayload.inputQualifiedKnowledgeRefs, payload.inputQualifiedKnowledgeRefs)) {
    throw new DerivedAuthorityValidationError('DERIVED_CONTEXT_INVALID', 'DerivedKnowledgeContext input set differs from DerivedKnowledge input set');
  }
  if (!Array.isArray(context.semanticPayload.originContexts)
    || context.semanticPayload.originContexts.length !== payload.inputQualifiedKnowledgeRefs.length) {
    throw new DerivedAuthorityValidationError('DERIVED_CONTEXT_INVALID', 'DerivedKnowledgeContext must retain every input origin context');
  }

  const method = resolveKind(ledger, payload.derivationMethodRef, 'DerivationMethod', 'DERIVATION_METHOD_REQUIRED');
  if (method.semanticPayload.authorityClass !== 'DERIVATION_METHOD_AUTHORITY'
    || method.semanticPayload.semanticRole !== payload.semanticRole) {
    throw new DerivedAuthorityValidationError('DERIVATION_METHOD_INVALID', 'DerivedKnowledge does not conform to exact DerivationMethod semantic role');
  }
  for (const required of ['NEWEST_WINS', 'LLM_PREFERENCE', 'SIMPLE_AVERAGE', 'LOCAL_CALIBRATION_AS_KNOWLEDGE']) {
    if (!(method.semanticPayload.prohibitedShortcuts ?? []).includes(required)) {
      throw new DerivedAuthorityValidationError('DERIVATION_METHOD_INVALID', `DerivationMethod does not preserve required prohibition ${required}`);
    }
  }
  const methodApproval = assertApproval({
    ledger,
    authAuditRef: method.semanticPayload.authorizationDecisionAuditRef,
    principal: method.semanticPayload.approverPrincipal,
    policyRef: method.semanticPayload.approvalPolicyRef,
    resourceId: derivationMethodResourceId(method.ref.logicalId),
    target: { use: 'DERIVATION_METHOD_APPROVAL' },
    ownership: method.semanticPayload.ownership
  });
  assertDirectMethodAudit(ledger, method, methodApproval);

  const validatedInputs = payload.inputQualifiedKnowledgeRefs.map((ref) => validateQualifiedKnowledgeAuthority({
    ledger,
    qualifiedKnowledgeRef: ref,
    requiredUseTarget: useTarget
  }));
  const ownership = validatedInputs[0]?.knowledge.semanticPayload.ownership;
  if (!ownership || !validatedInputs.every((input) => sameOwnership(input.knowledge.semanticPayload.ownership, ownership))) {
    throw new DerivedAuthorityValidationError('DERIVED_INPUT_OWNERSHIP_INVALID', 'DerivedKnowledge inputs cross ownership boundaries');
  }
  if (!sameOwnership(payload.ownership, ownership) || !sameOwnership(method.semanticPayload.ownership, ownership)) {
    throw new DerivedAuthorityValidationError('DERIVED_INPUT_OWNERSHIP_INVALID', 'DerivedKnowledge/method ownership differs from input knowledge');
  }

  for (const input of validatedInputs) {
    const origin = context.semanticPayload.originContexts.find((item) => sameAuthorityRef(item.qualifiedKnowledgeRef, input.knowledge.ref));
    if (!origin || !sameAuthorityRef(origin.sourceContextRef, input.sourceContext.ref)) {
      throw new DerivedAuthorityValidationError('DERIVED_CONTEXT_INVALID', 'DerivedKnowledgeContext omits or substitutes an input SourceContext');
    }
  }

  const synthesisApproval = assertApproval({
    ledger,
    authAuditRef: payload.authorizationDecisionAuditRef,
    principal: payload.approverPrincipal,
    policyRef: payload.synthesisPolicyRef,
    resourceId: synthesisResourceId(method.ref),
    target: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    ownership
  });
  const directAudit = ledger.auditFor(knowledge.ref).some((event) =>
    sameAuthorityRef(event.objectRef, knowledge.ref)
      && event.actor?.id === payload.approverPrincipal.principalId
      && event.actor?.type === payload.approverPrincipal.type
      && exactRefIn(event.inputRefs, context.ref)
      && exactRefIn(event.inputRefs, method.ref)
      && exactRefIn(event.inputRefs, synthesisApproval.authAudit.ref)
      && exactRefIn(event.inputRefs, synthesisApproval.policy.ref)
      && payload.inputQualifiedKnowledgeRefs.every((ref) => exactRefIn(event.inputRefs, ref)));
  if (!directAudit) {
    throw new DerivedAuthorityValidationError('DERIVED_AUDIT_INVALID', 'DerivedKnowledge lacks direct synthesis audit over exact method/context/auth/policy/input authority');
  }

  for (const input of validatedInputs) {
    const knowledgeLineage = hasLineage(ledger, knowledge.ref, input.knowledge.ref, 'QUALIFIED_KNOWLEDGE_INPUT');
    const contextLineage = hasLineage(ledger, context.ref, input.sourceContext.ref, 'ORIGIN_SOURCE_CONTEXT');
    if (!knowledgeLineage || !contextLineage) {
      throw new DerivedAuthorityValidationError('DERIVED_LINEAGE_INCOMPLETE', 'DerivedKnowledge must retain complete input knowledge and origin-context lineage');
    }
  }
  if (!hasLineage(ledger, knowledge.ref, method.ref, 'DERIVATION_METHOD')) {
    throw new DerivedAuthorityValidationError('DERIVED_LINEAGE_INCOMPLETE', 'DerivedKnowledge lacks exact derivation-method lineage');
  }

  return deepFreeze({ knowledge, context, method, validatedInputs, methodApproval, synthesisApproval, useTarget });
}