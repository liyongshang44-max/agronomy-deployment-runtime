import {
  AuthorizationError,
  createPrincipal,
  authorizeKnowledgeInspection as engineAuthorizeKnowledgeInspection,
  authorizeKnowledgeQualification as engineAuthorizeKnowledgeQualification,
  authorizeKnowledgeDeployment as engineAuthorizeKnowledgeDeployment,
  authorizeKnowledgeRuntimeUse as engineAuthorizeKnowledgeRuntimeUse,
  filterInspectableKnowledge as engineFilterInspectableKnowledge,
  filterRuntimeDeployableKnowledge as engineFilterRuntimeDeployableKnowledge
} from './engine.mjs';

export * from './engine.mjs';

// Principal identity is the stable actor identity and organizational tenancy assertion.
// Program memberships are contextual claims and are deliberately not part of identity equality.
export function samePrincipalIdentity(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function exactPrincipalAssignments(principal, roleAssignments) {
  if (!Array.isArray(roleAssignments)) {
    throw new AuthorizationError('INVALID_ROLE_ASSIGNMENTS', 'roleAssignments must be an array');
  }
  const normalizedPrincipal = createPrincipal(principal);
  return roleAssignments.filter((record) => {
    const storedPrincipal = record?.semanticPayload?.principal;
    if (!storedPrincipal) return true; // Engine validation will reject malformed role records.
    return samePrincipalIdentity(normalizedPrincipal, storedPrincipal);
  });
}

export function authorizeKnowledgeInspection(args) {
  return engineAuthorizeKnowledgeInspection({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function authorizeKnowledgeQualification(args) {
  return engineAuthorizeKnowledgeQualification({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function authorizeKnowledgeDeployment(args) {
  return engineAuthorizeKnowledgeDeployment({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function authorizeKnowledgeRuntimeUse(args) {
  return engineAuthorizeKnowledgeRuntimeUse({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function filterInspectableKnowledge(args) {
  return engineFilterInspectableKnowledge({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function filterRuntimeDeployableKnowledge(args) {
  return engineFilterRuntimeDeployableKnowledge({
    ...args,
    roleAssignments: exactPrincipalAssignments(args.principal, args.roleAssignments)
  });
}

export function recordAuthorizationDecision({ ledger, decision, audit }) {
  if (!ledger || typeof ledger.publish !== 'function') {
    throw new AuthorizationError('INVALID_LEDGER', 'ledger.publish is required');
  }
  if (!decision || typeof decision !== 'object' || typeof decision.decisionHash !== 'string') {
    throw new AuthorizationError('INVALID_AUTHORIZATION_DECISION', 'a content-addressed AuthorizationDecision is required');
  }
  if (!audit || typeof audit !== 'object') {
    throw new AuthorizationError('AUDIT_REQUIRED', 'authorization decision audit metadata is required');
  }
  const inputRefs = [decision.policyRef, ...(decision.assignmentRefs ?? [])];
  return ledger.publish({
    kind: 'AuthorizationDecisionAudit',
    logicalId: decision.decisionHash,
    version: '1',
    semanticPayload: decision,
    audit: {
      ...audit,
      action: audit.action ?? `AUTHORIZATION_${decision.operation}_${decision.allowed ? 'ALLOW' : 'DENY'}`,
      inputRefs: [...inputRefs, ...(audit.inputRefs ?? [])],
      details: {
        authorizationDecisionHash: decision.decisionHash,
        allowed: decision.allowed,
        reasons: decision.reasons,
        ...(audit.details ?? {})
      }
    }
  });
}
