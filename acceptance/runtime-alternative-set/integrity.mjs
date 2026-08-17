import assert from 'node:assert/strict';
import {
  normalizeRuntimeAlternativeSet,
  publishRuntimeAlternativeSet,
  validateRuntimeAlternativeSet
} from '../../packages/runtime-alternative-set/src/index.mjs';
import { suspendDeployment } from '../implementation-broker/fixture.mjs';
import {
  audit,
  legalAlternatives,
  multiAlternativeWorld,
  publishAllLegalBindings,
  publishAlternativeSet,
  publishBindingsForPaths
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

test('publisher refuses caller-authored completeness or coverage claims', () => {
  const world = multiAlternativeWorld('caller-completeness');
  const legal = legalAlternatives(world);
  const bindings = publishBindingsForPaths(world, [legal[0]], 'caller-completeness');
  expectCode(() => publishRuntimeAlternativeSet({
    ledger: world.env.ledger,
    logicalId: 'runtime-alternative-set.d04.caller-completeness',
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    includedRuntimeBindingRefs: bindings.map((item) => item.ref),
    completenessClass: 'EXHAUSTIVE_ENUMERATION',
    audit: audit(world.env.runtimePrincipal, 'caller-completeness')
  }), 'INVALID_RUNTIME_ALTERNATIVE_SET_PUBLICATION_FIELD');
});

test('convenient subset cannot be relabeled exhaustive after publication', () => {
  const world = multiAlternativeWorld('subset-laundering');
  const legal = legalAlternatives(world);
  const bindings = publishBindingsForPaths(world, [legal[0]], 'subset-laundering');
  const set = publishAlternativeSet(world, bindings, 'subset-laundering');
  assert.equal(set.semanticPayload.completenessClass, 'INCOMPLETE');
  expectCode(
    () => normalizeRuntimeAlternativeSet({
      ...set.semanticPayload,
      completenessClass: 'EXHAUSTIVE_ENUMERATION'
    }),
    'RUNTIME_ALTERNATIVE_SET_COMPLETENESS_LAUNDERING'
  );
});

test('BOUNDED_ENVELOPE and GOVERNED_COVERAGE fail closed until an upstream qualified coverage method exists', () => {
  const world = multiAlternativeWorld('future-coverage-method');
  const bindings = publishAllLegalBindings(world, 'future-coverage-method');
  const set = publishAlternativeSet(world, bindings, 'future-coverage-method');
  for (const completenessClass of ['BOUNDED_ENVELOPE', 'GOVERNED_COVERAGE']) {
    expectCode(
      () => normalizeRuntimeAlternativeSet({ ...set.semanticPayload, completenessClass }),
      'D04_GOVERNED_COVERAGE_AUTHORITY_NOT_IMPLEMENTED'
    );
  }
});

test('probability score cannot hide uncovered alternatives or enter D04 coverage authority', () => {
  const world = multiAlternativeWorld('probability');
  const bindings = publishAllLegalBindings(world, 'probability');
  const set = publishAlternativeSet(world, bindings, 'probability');
  expectCode(
    () => normalizeRuntimeAlternativeSet({ ...set.semanticPayload, probabilityScore: 0.99 }),
    'INVALID_RUNTIME_ALTERNATIVE_SET_FIELD'
  );
});

test('RuntimeAlternativeSet cannot self-declare ROBUST decision status', () => {
  const world = multiAlternativeWorld('robustness-laundering');
  const bindings = publishAllLegalBindings(world, 'robustness-laundering');
  const set = publishAlternativeSet(world, bindings, 'robustness-laundering');
  expectCode(
    () => normalizeRuntimeAlternativeSet({ ...set.semanticPayload, decisionRobustness: 'ROBUST' }),
    'INVALID_RUNTIME_ALTERNATIVE_SET_FIELD'
  );
});

test('binding from another RuntimeEligibility universe cannot be spliced into coverage', () => {
  const worldA = multiAlternativeWorld('foreign-a');
  const worldB = multiAlternativeWorld('foreign-b');
  const [foreign] = publishBindingsForPaths(worldB, [legalAlternatives(worldB)[0]], 'foreign-b');
  expectCode(() => publishRuntimeAlternativeSet({
    ledger: worldA.env.ledger,
    logicalId: 'runtime-alternative-set.d04.foreign',
    version: '1',
    runtimeEligibilityRef: worldA.eligibility.ref,
    includedRuntimeBindingRefs: [foreign.ref],
    audit: audit(worldA.env.runtimePrincipal, 'foreign')
  }), 'AUTHORITY_NOT_FOUND');
});

test('two bindings for one semantic RuntimePlan path are rejected instead of silently redefining the D04 v1 universe', () => {
  const world = multiAlternativeWorld('duplicate-path');
  const path = legalAlternatives(world)[0];
  const [first] = publishBindingsForPaths(world, [path], 'duplicate-path-a');
  const [second] = publishBindingsForPaths(world, [path], 'duplicate-path-b');
  expectCode(() => publishRuntimeAlternativeSet({
    ledger: world.env.ledger,
    logicalId: 'runtime-alternative-set.d04.duplicate-path',
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    includedRuntimeBindingRefs: [first.ref, second.ref],
    audit: audit(world.env.runtimePrincipal, 'duplicate-path')
  }), 'DUPLICATE_RUNTIME_ALTERNATIVE_PATH_BINDING');
});

test('generic ledger record with copied D04 payload does not become coverage authority', () => {
  const world = multiAlternativeWorld('forged-authority');
  const bindings = publishAllLegalBindings(world, 'forged-authority');
  const set = publishAlternativeSet(world, bindings, 'forged-authority');
  const forged = world.env.ledger.publish({
    kind: 'RuntimeAlternativeSet',
    logicalId: 'runtime-alternative-set.d04.forged-authority-copy',
    version: '1',
    semanticPayload: set.semanticPayload,
    audit: audit(world.env.runtimePrincipal, 'forged-authority-copy')
  });
  expectCode(
    () => validateRuntimeAlternativeSet({ ledger: world.env.ledger, runtimeAlternativeSetRef: forged.ref }),
    'RUNTIME_ALTERNATIVE_SET_PUBLICATION_AUTHORITY_INVALID'
  );
});

test('multi-path coverage cannot erase the material RuntimePlan alternative dimension during replay', () => {
  const world = multiAlternativeWorld('dimension-erasure');
  const bindings = publishAllLegalBindings(world, 'dimension-erasure');
  const set = publishAlternativeSet(world, bindings, 'dimension-erasure');
  assert.ok(set.semanticPayload.materialUncertaintyDimensions.some((item) =>
    item.dimensionType === 'RUNTIME_PLAN_ALTERNATIVE'));
  const forgedPayload = {
    ...set.semanticPayload,
    materialUncertaintyDimensions: []
  };
  const forged = world.env.ledger.publish({
    kind: 'RuntimeAlternativeSet',
    logicalId: 'runtime-alternative-set.d04.dimension-erasure-forged',
    version: '1',
    semanticPayload: forgedPayload,
    audit: audit(world.env.runtimePrincipal, 'dimension-erasure-forged')
  });
  expectCode(
    () => validateRuntimeAlternativeSet({ ledger: world.env.ledger, runtimeAlternativeSetRef: forged.ref }),
    'RUNTIME_ALTERNATIVE_SET_REPLAY_MISMATCH'
  );
});

test('caller cannot redefine implementation variance as already covered by D04 v1', () => {
  const world = multiAlternativeWorld('implementation-variance');
  const bindings = publishAllLegalBindings(world, 'implementation-variance');
  const set = publishAlternativeSet(world, bindings, 'implementation-variance');
  expectCode(
    () => normalizeRuntimeAlternativeSet({
      ...set.semanticPayload,
      generationMethod: {
        ...set.semanticPayload.generationMethod,
        implementationVarianceSemantics: 'ALL_IMPLEMENTATIONS_ASSUMED_EQUIVALENT'
      }
    }),
    'RUNTIME_ALTERNATIVE_SET_UNGOVERNED_GENERATION_METHOD'
  );
});

test('historical coverage replay survives later Deployment suspension without re-authorizing execution', () => {
  const world = multiAlternativeWorld('historical-suspension');
  const bindings = publishAllLegalBindings(world, 'historical-suspension');
  const set = publishAlternativeSet(world, bindings, 'historical-suspension');
  suspendDeployment(world);
  const validated = validateRuntimeAlternativeSet({
    ledger: world.env.ledger,
    runtimeAlternativeSetRef: set.ref
  });
  assert.deepEqual(validated.semanticPayload, set.semanticPayload);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`D04 RuntimeAlternativeSet integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
