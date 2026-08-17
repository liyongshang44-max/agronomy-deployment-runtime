import {
  authorizeOutcomeEvaluation,
  publishBuiltinRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  OUTCOME_EVALUATION_DIMENSIONS,
  outcomeEvaluationPublicationIdentity,
  publishOutcomeEvaluation
} from '../../packages/outcome-evaluation/src/index.mjs';
import {
  adrAssociation,
  adrWorld,
  authorizeIngress,
  externalWorld,
  ingressPrincipal,
  observationOutcome,
  publishAuthorizedOutcome
} from '../outcome/fixture.mjs';

let seq = 0;
export function audit(principal, suffix = 'e02', occurredAt = '2026-09-21T09:10:00.000Z') {
  seq += 1;
  return {
    eventId: `e02-${suffix}-${seq}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'outcome-evaluation' }
  };
}

export function evaluatorPrincipal(label = 'base', tenantId = 'tenant-a') {
  return {
    principalId: `outcome-evaluator-${label}`,
    type: 'SERVICE_ACCOUNT',
    organizationId: 'org-a',
    tenantId,
    programIds: []
  };
}

export function notEvaluated(dimension) {
  return {
    dimension,
    disposition: 'NOT_EVALUATED',
    evidenceWeightClass: 'NONE',
    interpretationClass: 'NONE',
    diagnosticCodes: [`${dimension}_EVIDENCE_NOT_EVALUATED`],
    evidenceOutcomeRefs: [],
    limitationCodes: []
  };
}

export function finding(dimension, {
  disposition,
  weight = 'LIMITED',
  interpretation = 'DESCRIPTIVE',
  diagnosticCode,
  evidenceOutcomeRefs,
  limitationCodes = []
}) {
  return {
    dimension,
    disposition,
    evidenceWeightClass: weight,
    interpretationClass: interpretation,
    diagnosticCodes: [diagnosticCode],
    evidenceOutcomeRefs,
    limitationCodes
  };
}

export function findingsWith(overrides = {}) {
  return OUTCOME_EVALUATION_DIMENSIONS.map((dimension) => overrides[dimension] ?? notEvaluated(dimension));
}

function publishOneOutcome({ ledger, principal, target, outcome, association }) {
  const auth = authorizeIngress({ ledger, principal, target, outcome, association });
  if (!auth.decision.allowed) throw new Error(`fixture Outcome ingress denied: ${auth.decision.reasons.join(',')}`);
  return publishAuthorizedOutcome({
    ledger,
    principal,
    target,
    outcome,
    association,
    authorization: auth.authorization
  });
}

export function adrEvaluationWorld(label = 'adr', {
  outcomes = [observationOutcome(`e02-${label}`)]
} = {}) {
  const world = adrWorld(`e02-${label}`);
  const target = world.decision.semanticPayload.targetRef;
  const association = adrAssociation(world);
  const ingress = ingressPrincipal(`e02-${label}`);
  const outcomeRecords = outcomes.map((outcome) => publishOneOutcome({
    ledger: world.env.ledger,
    principal: ingress,
    target,
    outcome,
    association
  }));
  return {
    ledger: world.env.ledger,
    world,
    target,
    association,
    ingress,
    outcomes: outcomeRecords
  };
}

export function externalEvaluationWorld(label = 'external', {
  outcomes = [observationOutcome(`e02-${label}`)]
} = {}) {
  const world = externalWorld(`e02-${label}`);
  const outcomeRecords = outcomes.map((outcome) => publishOneOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association
  }));
  return {
    ledger: world.ledger,
    world,
    target: world.target,
    association: world.association,
    ingress: world.principal,
    outcomes: outcomeRecords
  };
}

export function authorizeEvaluation({ ledger, evaluator, outcomeRefs, findings }) {
  const identity = outcomeEvaluationPublicationIdentity({
    ledger,
    outcomeRefs,
    principal: evaluator,
    findings
  });
  const assignment = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.${evaluator.principalId}.${identity.evaluationId}`,
    version: '1',
    principal: evaluator,
    role: 'OUTCOME_EVALUATION_SERVICE',
    scope: {
      organizationId: identity.authorizationScope.organizationId,
      ...(identity.authorizationScope.tenantId ? { tenantId: identity.authorizationScope.tenantId } : {}),
      resourceType: 'OUTCOME_EVALUATION'
    },
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'role', '2026-09-21T09:08:00.000Z')
  });
  const decision = authorizeOutcomeEvaluation({
    principal: evaluator,
    roleAssignments: [assignment],
    authorizationScope: identity.authorizationScope
  });
  const authorization = recordAuthorizationDecision({
    ledger,
    decision,
    audit: audit(evaluator, 'authorization', '2026-09-21T09:09:00.000Z')
  });
  return { identity, assignment, decision, authorization };
}

export function publishAuthorizedEvaluation({ ledger, evaluator, outcomeRefs, findings, authorization }) {
  return publishOutcomeEvaluation({
    ledger,
    outcomeRefs,
    findings,
    principal: evaluator,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit(evaluator, 'publish', '2026-09-21T09:10:00.000Z')
  });
}
