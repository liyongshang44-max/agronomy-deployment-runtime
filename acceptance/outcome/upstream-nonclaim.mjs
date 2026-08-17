import assert from 'node:assert/strict';
import {
  OUTCOME_CONTRACT_VERSION,
  validateOutcomeAuthority
} from '../../packages/outcome/src/index.mjs';
import {
  adrAssociation,
  adrWorld,
  authorizeIngress,
  ingressPrincipal,
  observationOutcome,
  publishAuthorizedOutcome
} from './fixture.mjs';

function authorityCounts(ledger, kinds) {
  const counts = Object.fromEntries(kinds.map((kind) => [kind, 0]));
  for (const record of ledger.exportSnapshot().records) {
    if (record.ref.kind in counts) counts[record.ref.kind] += 1;
  }
  return counts;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('favorable observed Outcome does not auto-publish or mutate Knowledge/Policy authority', () => {
  const world = adrWorld('favorable-nonclaim');
  const principal = ingressPrincipal('favorable-nonclaim');
  const target = world.decision.semanticPayload.targetRef;
  const outcome = observationOutcome('favorable-nonclaim', {
    semanticId: 'yield.harvested_mass_per_area',
    value: { type: 'DECIMAL', decimal: '12.5' },
    unit: 't_per_ha',
    effectiveInterval: {
      start: '2026-09-20T00:00:00.000Z',
      end: '2026-09-20T23:59:59.000Z'
    },
    availableAt: '2026-09-21T08:00:00.000Z',
    verticalSupport: null,
    uncertainty: { type: 'INTERVAL', lowerDecimal: '12', upperDecimal: '13' }
  });
  const association = adrAssociation(world, { includeExternalExecution: true });
  const upstreamKinds = [
    'QualifiedKnowledge', 'DerivedKnowledge', 'Policy', 'Model',
    'Implementation', 'ImplementationConformance', 'Deployment', 'RuntimeProfile'
  ];
  const before = authorityCounts(world.env.ledger, upstreamKinds);
  const auth = authorizeIngress({ ledger: world.env.ledger, principal, target, outcome, association });
  const record = publishAuthorizedOutcome({
    ledger: world.env.ledger,
    principal,
    target,
    outcome,
    association,
    authorization: auth.authorization
  });
  const after = authorityCounts(world.env.ledger, upstreamKinds);
  assert.deepEqual(after, before);
  const validated = validateOutcomeAuthority({ ledger: world.env.ledger, outcomeRef: record.ref });
  assert.equal(validated.record.ref.kind, 'Outcome');
});

test('Outcome remains structurally distinct from ContextDatum and RuntimeDatum', () => {
  const world = adrWorld('structural-distinction');
  const principal = ingressPrincipal('structural-distinction');
  const target = world.decision.semanticPayload.targetRef;
  const outcome = observationOutcome('structural-distinction');
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
  assert.equal(record.ref.kind, 'Outcome');
  assert.equal(record.semanticPayload.contractVersion, OUTCOME_CONTRACT_VERSION);
  assert.equal('runtimeDatumId' in record.semanticPayload, false);
  assert.equal('availableAt' in record.semanticPayload, true);
  assert.equal('source' in record.semanticPayload, true);
  assert.equal('association' in record.semanticPayload, true);
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
console.log(`E01 upstream nonclaim acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
