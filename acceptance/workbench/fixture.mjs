import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  authorizeWorkbenchKnowledgeInspection,
  projectAgronomistWorkbenchCase,
  workbenchKnowledgeInspectionResourceId
} from '../../packages/workbench/src/index.mjs';
import { assess, audit, createApplicabilityWorld } from '../applicability/fixture.mjs';

let seq = 0;
export function workbenchAudit(actor, suffix = 'a11') {
  seq += 1;
  return {
    eventId: `a11-${suffix}-${seq}`,
    occurredAt: '2026-08-22T10:00:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'agronomist-workbench' }
  };
}

export function createWorkbenchPrincipal(world, {
  principalId = 'agronomist-workbench',
  organizationId = 'org-a',
  tenantId = 'tenant-a',
  builtInRole = 'AGRONOMY_REVIEWER',
  permissions
} = {}) {
  const principal = createPrincipal({
    principalId,
    type: 'USER',
    organizationId,
    tenantId,
    programIds: ['pilot-a']
  });
  const scope = { organizationId, tenantId };
  const role = permissions
    ? publishRoleAssignment({
        ledger: world.env.ledger,
        logicalId: `role.a11.${principalId}`,
        version: '1',
        principal,
        role: 'A11_CUSTOM_WORKBENCH_ROLE',
        roleDefinitionVersion: 'a11-v1',
        permissions,
        scope,
        audit: workbenchAudit({ principalId: 'iam-admin', type: 'USER' }, 'role')
      })
    : publishBuiltinRoleAssignment({
        ledger: world.env.ledger,
        logicalId: `role.a11.${principalId}`,
        version: '1',
        principal,
        role: builtInRole,
        scope,
        audit: workbenchAudit({ principalId: 'iam-admin', type: 'USER' }, 'role')
      });
  return { principal, role };
}

export function createInspectionAuthorization(world, {
  knowledgeRef = world.assessment.semanticPayload.knowledgeRef,
  principal = world.workbenchPrincipal,
  roleAssignments = [world.workbenchRole],
  policyResourceId,
  ownership,
  visibilityPrincipalId
} = {}) {
  const knowledge = world.env.ledger.resolve(knowledgeRef);
  const targetOwnership = ownership ?? knowledge.semanticPayload.ownership;
  const policy = publishKnowledgeGovernancePolicy({
    ledger: world.env.ledger,
    logicalId: `policy.a11.inspect.${knowledgeRef.logicalId}.${seq + 1}`,
    version: '1',
    resourceId: policyResourceId ?? workbenchKnowledgeInspectionResourceId(knowledgeRef),
    ownership: targetOwnership,
    visibilityPolicy: [{ principalId: visibilityPrincipalId ?? principal.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: targetOwnership.organizationId }],
    audit: workbenchAudit({ principalId: 'iam-admin', type: 'USER' }, 'policy')
  });
  const decision = authorizeWorkbenchKnowledgeInspection({
    principal,
    policy,
    roleAssignments,
    knowledgeRef,
    knowledgeOwnership: targetOwnership,
    authorizationScope: {
      organizationId: targetOwnership.organizationId,
      ...(targetOwnership.tenantId ? { tenantId: targetOwnership.tenantId } : {})
    }
  });
  const recorded = recordAuthorizationDecision({
    ledger: world.env.ledger,
    decision,
    audit: workbenchAudit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, 'inspect-auth')
  });
  return { policy, decision, recorded };
}

export function createWorkbenchWorld(label = 'base', applicabilityOptions = {}, principalOptions = {}) {
  const base = createApplicabilityWorld(`a11-${label}`, applicabilityOptions);
  const assessment = assess(base, { logicalId: `applicability.a11.${label}` });
  const world = { ...base, assessment };
  const { principal, role } = createWorkbenchPrincipal(world, principalOptions);
  world.workbenchPrincipal = principal;
  world.workbenchRole = role;
  const inspection = createInspectionAuthorization(world);
  world.inspection = inspection;
  world.inspectionAuthorizations = [{
    knowledgeRef: assessment.semanticPayload.knowledgeRef,
    authorizationDecisionAuditRef: inspection.recorded.ref
  }];
  world.workbenchCase = projectAgronomistWorkbenchCase({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: assessment.ref,
    workbenchPrincipal: principal,
    inspectionAuthorizations: world.inspectionAuthorizations,
    sourceRegistry: world.env.sourceRegistry
  });
  return world;
}

export function projectCase(world, overrides = {}) {
  return projectAgronomistWorkbenchCase({
    ledger: world.env.ledger,
    applicabilityAssessmentRef: overrides.applicabilityAssessmentRef ?? world.assessment.ref,
    workbenchPrincipal: overrides.workbenchPrincipal ?? world.workbenchPrincipal,
    inspectionAuthorizations: overrides.inspectionAuthorizations ?? world.inspectionAuthorizations,
    sourceRegistry: overrides.sourceRegistry === undefined ? world.env.sourceRegistry : overrides.sourceRegistry,
    allowHistorical: overrides.allowHistorical ?? false
  });
}

export { PERMISSIONS, authorizeKnowledgeInspection, recordAuthorizationDecision };
