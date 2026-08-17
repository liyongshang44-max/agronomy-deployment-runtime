import assert from 'node:assert/strict';
import * as publicApi from '../../packages/outcome/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  authorizeOutcomeWrite,
  publishBuiltinRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  OUTCOME_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_UPSTREAM_AUTHORITY_MUTATION,
  normalizeOutcome,
  outcomePublicationIdentity,
  publishOutcome,
  validateOutcomeAuthority
} from '../../packages/outcome/src/index.mjs';
import { createOutcomePayload } from '../../packages/outcome/src/contract.mjs';
import {
  adrAssociation,
  adrWorld,
  audit,
  authorizeIngress,
  externalAssociation,
  externalWorld,
  ingressPrincipal,
  observationOutcome,
  publishAuthorizedOutcome,
  targetRef
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('public E01 API does not expose unchecked Outcome payload creator or exact-ref collector', () => {
  assert.equal('createOutcomePayload' in publicApi, false);
  assert.equal('outcomeExactRefs' in publicApi, false);
  assert.equal(typeof publicApi.publishOutcome, 'function');
  assert.equal(typeof publicApi.validateOutcomeAuthority, 'function');
});

test('context.write IntegrationService cannot authorize Outcome publication', () => {
  const world = externalWorld('context-write-denied');
  const outcome = observationOutcome('context-write-denied');
  const identity = outcomePublicationIdentity({ targetRef: world.target, outcome, association: world.association });
  const assignment = publishBuiltinRoleAssignment({
    ledger: world.ledger,
    logicalId: 'role.e01.context-write-denied',
    version: '1',
    principal: world.principal,
    role: 'INTEGRATION_SERVICE',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'OUTCOME' },
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'wrong-role')
  });
  const decision = authorizeOutcomeWrite({
    principal: world.principal,
    roleAssignments: [assignment],
    authorizationScope: identity.authorizationScope
  });
  assert.equal(decision.allowed, false);
  const denied = recordAuthorizationDecision({ ledger: world.ledger, decision, audit: audit(world.principal, 'denied-auth') });
  assert.throws(
    () => publishOutcome({
      ledger: world.ledger,
      targetRef: world.target,
      outcome,
      association: world.association,
      principal: world.principal,
      authorizationDecisionAuditRef: denied.ref,
      audit: audit(world.principal, 'denied-publish')
    }),
    (error) => error?.code === 'OUTCOME_WRITE_AUTHORIZATION_INVALID'
  );
});

test('FORECAST cannot be laundered into Outcome evidence', () => {
  const world = externalWorld('forecast');
  const outcome = observationOutcome('forecast', {
    epistemicClass: 'FORECAST',
    provenanceClass: 'EXTERNAL_PROVIDER'
  });
  assert.throws(
    () => outcomePublicationIdentity({ targetRef: world.target, outcome, association: world.association }),
    (error) => error?.code === 'INVALID_OUTCOME_EPISTEMIC_CLASS'
  );
});

test('MODEL provenance cannot be relabeled OBSERVATION Outcome', () => {
  const world = externalWorld('model-observation');
  const outcome = observationOutcome('model-observation', {
    epistemicClass: 'OBSERVATION',
    provenanceClass: 'MODEL'
  });
  assert.throws(
    () => outcomePublicationIdentity({ targetRef: world.target, outcome, association: world.association }),
    (error) => error?.code === 'OUTCOME_MODEL_EPISTEMIC_LAUNDERING'
  );
});

test('ADR Outcome cannot bind a target that differs from exact DecisionProblem', () => {
  const world = adrWorld('target-mismatch');
  const principal = ingressPrincipal('target-mismatch');
  const outcome = observationOutcome('target-mismatch');
  const association = adrAssociation(world);
  const wrongTarget = { ...world.decision.semanticPayload.targetRef, fieldId: 'field-other' };
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target: wrongTarget, outcome, association });
  assert.throws(
    () => publishAuthorizedOutcome({
      ledger: world.env.ledger,
      principal,
      target: wrongTarget,
      outcome,
      association,
      authorization: auth.authorization
    }),
    (error) => error?.code === 'OUTCOME_DECISION_TARGET_MISMATCH'
  );
});

test('DecisionResult from another DecisionProblem cannot be spliced into ADR Outcome', () => {
  const a = adrWorld('splice-a');
  const b = adrWorld('splice-b');
  // Authority ledgers are isolated; import the foreign ref is already unreplayable and must fail closed.
  const principal = ingressPrincipal('splice');
  const outcome = observationOutcome('splice');
  const association = {
    ...adrAssociation(a),
    decisionResultRef: b.decisionResult.ref
  };
  const auth = authorizeIngress({
    ledger: a.env.ledger,
    principal,
    target: a.decision.semanticPayload.targetRef,
    outcome,
    association
  });
  assert.throws(
    () => publishAuthorizedOutcome({
      ledger: a.env.ledger,
      principal,
      target: a.decision.semanticPayload.targetRef,
      outcome,
      association,
      authorization: auth.authorization
    }),
    (error) => ['AUTHORITY_NOT_FOUND', 'AUTHORITY_HASH_MISMATCH', 'OUTCOME_DECISION_RESULT_WORLD_MISMATCH'].includes(error?.code)
  );
});

test('EXTERNAL_BOUND association cannot smuggle ADR authority refs', () => {
  const world = adrWorld('external-smuggle');
  const association = {
    ...externalAssociation('external-smuggle'),
    decisionProblemRef: world.decision.ref
  };
  assert.throws(
    () => outcomePublicationIdentity({
      targetRef: targetRef(),
      outcome: observationOutcome('external-smuggle'),
      association
    }),
    (error) => error?.code === 'OUTCOME_ASSOCIATION_LAUNDERING'
  );
});

test('ADR_BOUND association cannot replace exact DecisionProblem with external decision identity', () => {
  const world = adrWorld('adr-external-decision');
  const association = {
    ...adrAssociation(world),
    externalDecisionRef: externalAssociation('adr-external-decision').externalDecisionRef
  };
  assert.throws(
    () => outcomePublicationIdentity({
      targetRef: world.decision.semanticPayload.targetRef,
      outcome: observationOutcome('adr-external-decision'),
      association
    }),
    (error) => error?.code === 'OUTCOME_ASSOCIATION_LAUNDERING'
  );
});

test('external execution cannot predate retained external decision', () => {
  const association = externalAssociation('time-order');
  association.externalExecutionRef = {
    ...association.externalExecutionRef,
    occurredAt: '2026-08-20T09:00:00.000Z'
  };
  assert.throws(
    () => outcomePublicationIdentity({ targetRef: targetRef(), outcome: observationOutcome('time-order'), association }),
    (error) => error?.code === 'OUTCOME_EXTERNAL_EXECUTION_TIME_INVALID'
  );
});

test('Outcome cannot claim availability before its evidence interval ends', () => {
  const world = externalWorld('availability');
  const outcome = observationOutcome('availability', { availableAt: '2026-08-20T12:30:00.000Z' });
  assert.throws(
    () => outcomePublicationIdentity({ targetRef: world.target, outcome, association: world.association }),
    (error) => error?.code === 'OUTCOME_AVAILABLE_BEFORE_EVIDENCE_END'
  );
});

test('ADR Outcome cannot repackage evidence whose effective interval ended before the decision association anchor', () => {
  const world = adrWorld('predecision');
  const principal = ingressPrincipal('predecision');
  const outcome = observationOutcome('predecision', {
    effectiveInterval: {
      start: '2026-08-20T09:00:00.000Z',
      end: '2026-08-20T10:30:00.000Z'
    },
    availableAt: '2026-08-20T13:05:00.000Z'
  });
  const association = adrAssociation(world, { includeExternalExecution: false });
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target: world.decision.semanticPayload.targetRef, outcome, association });
  assert.throws(
    () => publishAuthorizedOutcome({
      ledger: world.env.ledger,
      principal,
      target: world.decision.semanticPayload.targetRef,
      outcome,
      association,
      authorization: auth.authorization
    }),
    (error) => error?.code === 'OUTCOME_PREDECISION_EVIDENCE_FORBIDDEN'
  );
});

test('caller cannot add causal-effect or upstream-authority fields to Outcome draft', () => {
  const world = externalWorld('forbidden-fields');
  for (const extra of [
    { causalEffectAuthority: 'CAUSAL' },
    { upstreamAuthorityMutation: 'QUALIFY_KNOWLEDGE' },
    { confidence: 0.99 }
  ]) {
    assert.throws(
      () => outcomePublicationIdentity({
        targetRef: world.target,
        outcome: { ...observationOutcome('forbidden-fields'), ...extra },
        association: world.association
      }),
      (error) => error?.code === 'INVALID_OUTCOME_FIELD'
    );
  }
});

test('structurally self-consistent forged Outcome without outcome.write audit closure fails exact validator', () => {
  const ledger = new AuthorityLedger();
  const target = targetRef();
  const association = externalAssociation('forged');
  const payload = createOutcomePayload({ targetRef: target, outcome: observationOutcome('forged'), association });
  const forged = ledger.publish({
    kind: 'Outcome',
    logicalId: payload.outcomeId,
    version: '1',
    semanticPayload: payload,
    audit: audit({ principalId: 'forger', type: 'SERVICE_ACCOUNT' }, 'forged')
  });
  assert.throws(
    () => validateOutcomeAuthority({ ledger, outcomeRef: forged.ref }),
    (error) => error?.code === 'OUTCOME_PUBLICATION_AUTHORITY_INVALID'
  );
});

test('Outcome normalization permanently rejects causal/upstream authority laundering', () => {
  const world = externalWorld('nonclaim-tamper');
  const payload = createOutcomePayload({
    targetRef: world.target,
    outcome: observationOutcome('nonclaim-tamper'),
    association: world.association
  });
  for (const [field, value, code] of [
    ['causalEffectAuthority', 'CAUSAL_EFFECT_PROVEN', 'OUTCOME_CAUSAL_EFFECT_LAUNDERING'],
    ['upstreamAuthorityMutation', 'MUTATE_POLICY', 'OUTCOME_UPSTREAM_AUTHORITY_LAUNDERING']
  ]) {
    const forged = clone(payload);
    forged[field] = value;
    assert.throws(() => normalizeOutcome(forged), (error) => error?.code === code);
  }
  assert.equal(payload.causalEffectAuthority, OUTCOME_CAUSAL_EFFECT_AUTHORITY);
  assert.equal(payload.upstreamAuthorityMutation, OUTCOME_UPSTREAM_AUTHORITY_MUTATION);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`::error title=${name.replaceAll(',', ' ')}::${String(error?.stack ?? error).replaceAll('\n', '%0A')}`);
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`E01 Outcome integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
