import assert from 'node:assert/strict';
import {
  OUTCOME_CAUSAL_EFFECT_AUTHORITY,
  OUTCOME_UPSTREAM_AUTHORITY_MUTATION,
  validateOutcomeAuthority
} from '../../packages/outcome/src/index.mjs';
import {
  adrAssociation,
  adrWorld,
  assertedOutcome,
  authorizeIngress,
  derivedOutcome,
  externalWorld,
  ingressPrincipal,
  observationOutcome,
  publishAuthorizedOutcome,
  targetRef
} from './fixture.mjs';
import { policyDecisionWorld } from '../decision-result/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function sameRef(left, right) {
  return JSON.stringify([left.kind, left.logicalId, left.version, left.semanticHash])
    === JSON.stringify([right.kind, right.logicalId, right.version, right.semanticHash]);
}

test('ADR-bound sensor Outcome preserves epistemic/provenance semantics and keeps external machine execution distinct from ADR runtime', () => {
  const world = adrWorld('sensor');
  const principal = ingressPrincipal('sensor');
  const target = world.decision.semanticPayload.targetRef;
  const outcome = observationOutcome('sensor');
  const association = adrAssociation(world);
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target, outcome, association });
  assert.equal(auth.decision.allowed, true);
  const record = publishAuthorizedOutcome({
    ledger: world.env.ledger,
    principal,
    target,
    outcome,
    association,
    authorization: auth.authorization
  });
  const validated = validateOutcomeAuthority({ ledger: world.env.ledger, outcomeRef: record.ref });
  const payload = validated.semanticPayload;

  assert.equal(payload.epistemicClass, 'OBSERVATION');
  assert.equal(payload.provenanceClass, 'SENSOR');
  assert.ok(sameRef(payload.association.decisionProblemRef, world.decision.ref));
  assert.ok(sameRef(payload.association.decisionResultRef, world.decisionResult.ref));
  assert.ok(sameRef(payload.association.runtimeBindingRef, world.binding.ref));
  assert.equal(payload.association.externalExecutionRef.providerId, 'external-machine-execution');
  assert.equal(validated.replayMode, 'ADR_EXACT_AUTHORITY_REPLAY_WITH_CONTENT_ADDRESSED_EXTERNAL_EXECUTION_IF_PRESENT');
  assert.equal(payload.causalEffectAuthority, OUTCOME_CAUSAL_EFFECT_AUTHORITY);
  assert.equal(payload.upstreamAuthorityMutation, OUTCOME_UPSTREAM_AUTHORITY_MUTATION);
});

test('fully external Outcome preserves retained decision/execution evidence identity without fabricating ADR refs', () => {
  const world = externalWorld('external');
  const outcome = assertedOutcome('external-human');
  const auth = authorizeIngress({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association
  });
  const record = publishAuthorizedOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association,
    authorization: auth.authorization
  });
  const validated = validateOutcomeAuthority({ ledger: world.ledger, outcomeRef: record.ref });
  assert.equal(validated.semanticPayload.association.mode, 'EXTERNAL_BOUND');
  assert.equal(validated.semanticPayload.association.decisionProblemRef, null);
  assert.equal(validated.semanticPayload.association.decisionResultRef, null);
  assert.equal(validated.semanticPayload.association.runtimeBindingRef, null);
  assert.equal(validated.semanticPayload.epistemicClass, 'ASSERTION');
  assert.equal(validated.semanticPayload.provenanceClass, 'AGRONOMIST');
  assert.equal(validated.replayMode, 'EXTERNAL_CONTENT_ADDRESSED_ASSOCIATION_REPLAY');
});

test('derived commercial Outcome remains DERIVED/PLATFORM and gains no causal or upstream authority', () => {
  const world = externalWorld('derived');
  const outcome = derivedOutcome('derived-commercial');
  const auth = authorizeIngress({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association
  });
  const record = publishAuthorizedOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association,
    authorization: auth.authorization
  });
  const validated = validateOutcomeAuthority({ ledger: world.ledger, outcomeRef: record.ref });
  assert.equal(validated.semanticPayload.epistemicClass, 'DERIVED');
  assert.equal(validated.semanticPayload.provenanceClass, 'PLATFORM');
  assert.equal(validated.causalEffectAuthority, OUTCOME_CAUSAL_EFFECT_AUTHORITY);
  assert.equal(validated.upstreamAuthorityMutation, OUTCOME_UPSTREAM_AUTHORITY_MUTATION);
});

test('RUNTIME_ONLY ADR world can ingest Outcome through exact RuntimeBinding without inventing DecisionResult authority', () => {
  const world = policyDecisionWorld('e01-runtime-only', { decisionAuthorityMode: 'RUNTIME_ONLY' });
  const principal = ingressPrincipal('runtime-only');
  const target = world.decision.semanticPayload.targetRef;
  const outcome = observationOutcome('runtime-only');
  const association = {
    mode: 'ADR_BOUND',
    decisionProblemRef: world.decision.ref,
    decisionResultRef: null,
    runtimeBindingRef: world.binding.ref,
    externalDecisionRef: null,
    externalExecutionRef: null
  };
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target, outcome, association });
  const record = publishAuthorizedOutcome({
    ledger: world.env.ledger,
    principal,
    target,
    outcome,
    association,
    authorization: auth.authorization
  });
  const validated = validateOutcomeAuthority({ ledger: world.env.ledger, outcomeRef: record.ref });
  assert.equal(validated.semanticPayload.association.decisionResultRef, null);
  assert.ok(sameRef(validated.semanticPayload.association.runtimeBindingRef, world.binding.ref));
  assert.equal(validated.decisionResult, null);
});

test('duplicate exact Outcome delivery is idempotent and resolves to one deterministic immutable authority', () => {
  const world = externalWorld('idempotent');
  const outcome = observationOutcome('idempotent');
  const auth = authorizeIngress({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association
  });
  const first = publishAuthorizedOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association,
    authorization: auth.authorization
  });
  const second = publishAuthorizedOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association,
    authorization: auth.authorization
  });
  assert.ok(sameRef(first.ref, second.ref));
  assert.equal(world.ledger.listVersions('Outcome', first.ref.logicalId).length, 1);
});

test('same exact source/target/association identity cannot silently change value on retry', () => {
  const world = externalWorld('mutation');
  const outcome = observationOutcome('mutation');
  const auth = authorizeIngress({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association
  });
  publishAuthorizedOutcome({
    ledger: world.ledger,
    principal: world.principal,
    target: world.target,
    outcome,
    association: world.association,
    authorization: auth.authorization
  });
  const changed = observationOutcome('mutation', { value: { type: 'DECIMAL', decimal: '0.35' } });
  assert.throws(
    () => publishAuthorizedOutcome({
      ledger: world.ledger,
      principal: world.principal,
      target: world.target,
      outcome: changed,
      association: world.association,
      authorization: auth.authorization
    }),
    (error) => error?.code === 'SEMANTIC_MUTATION_FORBIDDEN'
  );
});

test('Outcome exact replay retains target, time/support/uncertainty and authorization principal', () => {
  const world = adrWorld('replay');
  const principal = ingressPrincipal('replay');
  const target = targetRef();
  const outcome = observationOutcome('replay');
  const association = adrAssociation(world, { includeExternalExecution: false });
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target, outcome, association });
  const record = publishAuthorizedOutcome({
    ledger: world.env.ledger,
    principal,
    target,
    outcome,
    association,
    authorization: auth.authorization
  });
  const replay = validateOutcomeAuthority({ ledger: world.env.ledger, outcomeRef: record.ref });
  assert.deepEqual(replay.semanticPayload.targetRef, target);
  assert.deepEqual(replay.semanticPayload.effectiveInterval, outcome.effectiveInterval);
  assert.deepEqual(replay.semanticPayload.spatialSupport, outcome.spatialSupport);
  assert.deepEqual(replay.semanticPayload.uncertainty, outcome.uncertainty);
  assert.equal(replay.outcomeIngressPrincipal.principalId, principal.principalId);
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
console.log(`E01 Outcome ingress acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
