import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  createPrincipal,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';

export class WorkbenchAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkbenchAccessError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new WorkbenchAccessError('INVALID_WORKBENCH_ACCESS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new WorkbenchAccessError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

export function workbenchKnowledgeInspectionResourceId(knowledgeRef) {
  const ref = assertAuthorityRef(knowledgeRef);
  if (!['QualifiedKnowledge', 'DerivedKnowledge'].includes(ref.kind)) {
    throw new WorkbenchAccessError('INVALID_WORKBENCH_KNOWLEDGE_KIND', `unsupported workbench knowledge kind ${ref.kind}`);
  }
  return `agronomist-workbench-inspection:${ref.kind}/${ref.logicalId}@${ref.version}#${ref.semanticHash}`;
}

function assertInspectionPolicy(policy, knowledgeRef, ownership) {
  if (!policy?.ref || policy.ref.kind !== 'KnowledgeGovernancePolicy') {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_POLICY_REQUIRED', 'exact KnowledgeGovernancePolicy is required');
  }
  if (policy.semanticPayload?.resourceId !== workbenchKnowledgeInspectionResourceId(knowledgeRef)) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_POLICY_MISMATCH', 'inspection policy does not bind exact knowledge authority');
  }
  if (!sameOwnership(policy.semanticPayload?.ownership, ownership)) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_OWNERSHIP_MISMATCH', 'inspection policy ownership differs from exact knowledge ownership');
  }
}

function sourceReadGrantForDecision({ decision, roleAssignments, principal }) {
  const byRef = new Map(roleAssignments.map((record) => [refKey(record.ref), record]));
  return (decision.assignmentRefs ?? []).some((ref) => {
    const record = byRef.get(refKey(ref));
    if (!record?.semanticPayload?.principal || !samePrincipalIdentity(record.semanticPayload.principal, principal)) return false;
    const permissions = record.semanticPayload.permissions ?? [];
    return permissions.includes(PERMISSIONS.KNOWLEDGE_INSPECT) && permissions.includes(PERMISSIONS.SOURCE_READ);
  });
}

export function authorizeWorkbenchKnowledgeInspection({
  principal,
  policy,
  roleAssignments,
  knowledgeRef,
  knowledgeOwnership,
  authorizationScope
}) {
  const actor = createPrincipal(principal);
  if (!Array.isArray(roleAssignments)) {
    throw new WorkbenchAccessError('INVALID_WORKBENCH_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  assertInspectionPolicy(policy, knowledgeRef, knowledgeOwnership);
  const decision = authorizeKnowledgeInspection({
    principal: actor,
    policy,
    roleAssignments,
    authorizationScope
  });
  if (!decision.allowed) return decision;
  if (!sourceReadGrantForDecision({ decision, roleAssignments, principal: actor })) {
    throw new WorkbenchAccessError(
      'WORKBENCH_SOURCE_READ_PERMISSION_DENIED',
      'Agronomist Workbench source/claim evidence requires the exact inspection grant to include SOURCE_READ + KNOWLEDGE_INSPECT'
    );
  }
  return decision;
}

export function validateWorkbenchInspectionAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  knowledgeRef,
  knowledgeOwnership
}) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new WorkbenchAccessError('INVALID_LEDGER', 'Workbench inspection requires a replayable AuthorityLedger');
  }
  const actor = createPrincipal(principal);
  const authAudit = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'WORKBENCH_INSPECTION_AUTHORIZATION_REQUIRED'
  );
  const stored = authAudit.semanticPayload;
  if (stored?.operation !== 'KNOWLEDGE_INSPECT' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, actor)) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_DENIED', 'allowed exact KNOWLEDGE_INSPECT authorization is required');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'WORKBENCH_INSPECTION_POLICY_REQUIRED');
  assertInspectionPolicy(policy, knowledgeRef, knowledgeOwnership);
  const assignments = (stored.assignmentRefs ?? []).map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'WORKBENCH_INSPECTION_ROLE_REQUIRED'));
  const recomputed = authorizeWorkbenchKnowledgeInspection({
    principal: actor,
    policy,
    roleAssignments: assignments,
    knowledgeRef,
    knowledgeOwnership,
    authorizationScope: stored.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_MISMATCH', 'inspection authorization cannot be reproduced from exact policy/role authority');
  }
  const direct = ledger.auditFor(authAudit.ref).filter((event) => sameAuthorityRef(event.objectRef, authAudit.ref));
  const validAudit = direct.some((event) =>
    event.action === 'AUTHORIZATION_KNOWLEDGE_INSPECT_ALLOW'
      && exactRefIn(event.inputRefs, policy.ref)
      && (stored.assignmentRefs ?? []).every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.authorizationDecisionHash === stored.decisionHash);
  if (!validAudit) {
    throw new WorkbenchAccessError('WORKBENCH_INSPECTION_AUTHORIZATION_AUDIT_INVALID', 'inspection authorization audit does not close exact policy/RoleAssignment inputs');
  }
  return deepFreeze({
    authorizationDecisionAudit: authAudit,
    policy,
    assignments,
    principal: actor,
    accessHash: semanticHash('AgronomistWorkbenchInspectionAccess', {
      authorizationDecisionAuditRef: authAudit.ref,
      knowledgeRef: assertAuthorityRef(knowledgeRef),
      principal: actor
    })
  });
}
