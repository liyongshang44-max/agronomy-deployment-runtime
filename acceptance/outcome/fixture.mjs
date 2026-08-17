import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  authorizeOutcomeWrite,
  publishBuiltinRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  outcomePublicationIdentity,
  publishOutcome
} from '../../packages/outcome/src/index.mjs';
import {
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from '../decision-result/fixture.mjs';

let seq = 0;
export function audit(principal, suffix = 'e01', occurredAt = '2026-08-20T13:06:00.000Z') {
  seq += 1;
  return {
    eventId: `e01-${suffix}-${seq}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'outcome-ingress' }
  };
}

export function ingressPrincipal(label = 'base', tenantId = 'tenant-a') {
  return {
    principalId: `outcome-ingress-${label}`,
    type: 'SERVICE_ACCOUNT',
    organizationId: 'org-a',
    tenantId,
    programIds: []
  };
}

export function targetRef() {
  return {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    farmId: 'farm-1',
    fieldId: 'field-1',
    seasonId: 'season-2026'
  };
}

export function source(label = 'sensor') {
  const seed = label.length.toString(16).slice(-1);
  return {
    providerId: `provider-${label}`,
    sourceRef: `source-${label}-001`,
    contentHash: `sha256:${seed.repeat(64)}`
  };
}

export function externalRef(label, occurredAt) {
  const seed = (label.length + 1).toString(16).slice(-1);
  return {
    providerId: `external-${label}`,
    sourceRef: `${label}-record-001`,
    contentHash: `sha256:${seed.repeat(64)}`,
    occurredAt
  };
}

export function observationOutcome(label = 'soil-response', overrides = {}) {
  return {
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.31' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'SENSOR',
    effectiveInterval: {
      start: '2026-08-20T12:00:00.000Z',
      end: '2026-08-20T13:00:00.000Z'
    },
    availableAt: '2026-08-20T13:05:00.000Z',
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    verticalSupport: { fromMm: '0', toMm: '300' },
    temporalSupport: { type: 'INTERVAL' },
    uncertainty: { type: 'INTERVAL', lowerDecimal: '0.3', upperDecimal: '0.32' },
    source: source(label),
    ...overrides
  };
}

export function assertedOutcome(label = 'human', overrides = {}) {
  return observationOutcome(label, {
    semanticId: 'execution.operator_disposition',
    value: { type: 'CATEGORY', category: 'COMPLETED_AS_REPORTED' },
    unit: '1',
    epistemicClass: 'ASSERTION',
    provenanceClass: 'AGRONOMIST',
    verticalSupport: null,
    uncertainty: { type: 'NONE' },
    ...overrides
  });
}

export function derivedOutcome(label = 'commercial', overrides = {}) {
  return observationOutcome(label, {
    semanticId: 'commercial.gross_margin_delta',
    value: { type: 'DECIMAL', decimal: '42.5' },
    unit: 'GBP_per_ha',
    epistemicClass: 'DERIVED',
    provenanceClass: 'PLATFORM',
    verticalSupport: null,
    uncertainty: { type: 'INTERVAL', lowerDecimal: '30', upperDecimal: '55' },
    ...overrides
  });
}

export function adrWorld(label = 'adr') {
  const world = policyDecisionWorld(`e01-${label}`, { decisionAuthorityMode: 'ADR_POLICY' });
  const robustness = publishRobustness(world, { label: `e01-${label}` });
  const decisionResult = publishResult(world, robustness, `e01-${label}`, '2026-08-20T10:45:00.000Z');
  return { ...world, robustness, decisionResult };
}

export function adrAssociation(world, { includeRuntimeBinding = true, includeExternalExecution = true } = {}) {
  return {
    mode: 'ADR_BOUND',
    decisionProblemRef: world.decision.ref,
    decisionResultRef: world.decisionResult.ref,
    runtimeBindingRef: includeRuntimeBinding ? world.binding.ref : null,
    externalDecisionRef: null,
    externalExecutionRef: includeExternalExecution
      ? externalRef('machine-execution', '2026-08-20T11:15:00.000Z')
      : null
  };
}

export function externalAssociation(label = 'external') {
  return {
    mode: 'EXTERNAL_BOUND',
    decisionProblemRef: null,
    decisionResultRef: null,
    runtimeBindingRef: null,
    externalDecisionRef: externalRef(`${label}-decision`, '2026-08-20T10:40:00.000Z'),
    externalExecutionRef: externalRef(`${label}-execution`, '2026-08-20T11:20:00.000Z')
  };
}

export function authorizeIngress({ ledger, principal, target, outcome, association, role = 'OUTCOME_INGRESS_SERVICE', roleScope } = {}) {
  const identity = outcomePublicationIdentity({ targetRef: target, outcome, association });
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.${principal.principalId}.${identity.outcomeId}`,
    version: '1',
    principal,
    role,
    scope: roleScope ?? {
      organizationId: target.organizationId,
      ...(target.tenantId ? { tenantId: target.tenantId } : {}),
      resourceType: 'OUTCOME'
    },
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'role', '2026-08-20T13:05:10.000Z')
  });
  const decision = authorizeOutcomeWrite({
    principal,
    roleAssignments: [assignment],
    authorizationScope: identity.authorizationScope
  });
  const authorization = recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit(principal, 'authorization', '2026-08-20T13:05:20.000Z')
  });
  return { identity, assignment, decision, authorization };
}

export function publishAuthorizedOutcome({
  ledger,
  principal,
  target,
  outcome,
  association,
  authorization
}) {
  return publishOutcome({
    ledger,
    targetRef: target,
    outcome,
    association,
    principal,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit(principal, 'publish', '2026-08-20T13:06:00.000Z')
  });
}

export function externalWorld(label = 'external') {
  const ledger = new AuthorityLedger();
  return {
    ledger,
    principal: ingressPrincipal(label),
    target: targetRef(),
    association: externalAssociation(label)
  };
}
