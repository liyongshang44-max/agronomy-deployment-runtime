import assert from 'node:assert/strict';
import {
  normalizeRuntimeBinding,
  publishRuntimeBinding,
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import {
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  audit,
  directBindingWorld,
  informationBindingWorld,
  legalPath,
  mixedBindingWorld,
  noLegalBindingWorld,
  publishBinding
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('INFORMATION_REQUIRED runtime world cannot produce RuntimeBinding', () => {
  const world = informationBindingWorld('information-required');
  assert.equal(world.eligibility.semanticPayload.runtimeEligibility, 'INFORMATION_REQUIRED');
  assert.throws(
    () => publishRuntimeBinding({
      ledger: world.env.ledger,
      logicalId: 'runtime-binding.d01.information-required',
      version: '1',
      runtimeEligibilityRef: world.eligibility.ref,
      selectedAlternativePathId: world.eligibility.semanticPayload.alternativeEvaluations[0].pathId,
      audit: audit(world.env.runtimePrincipal)
    }),
    (error) => error?.code === 'RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE'
  );
});

test('NO_LEGAL_RUNTIME world cannot produce RuntimeBinding', () => {
  const world = noLegalBindingWorld('no-legal');
  assert.equal(world.eligibility.semanticPayload.runtimeEligibility, 'NO_LEGAL_RUNTIME');
  assert.throws(
    () => publishRuntimeBinding({
      ledger: world.env.ledger,
      logicalId: 'runtime-binding.d01.no-legal',
      version: '1',
      runtimeEligibilityRef: world.eligibility.ref,
      selectedAlternativePathId: world.eligibility.semanticPayload.alternativeEvaluations[0].pathId,
      audit: audit(world.env.runtimePrincipal)
    }),
    (error) => error?.code === 'RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE'
  );
});

test('globally eligible mixed world still rejects selection of its hard-blocked sibling path', () => {
  const world = mixedBindingWorld('blocked-selection');
  const blocked = world.eligibility.semanticPayload.alternativeEvaluations.find((item) => item.disposition === 'NO_LEGAL_RUNTIME');
  assert.ok(blocked);
  assert.throws(
    () => publishRuntimeBinding({
      ledger: world.env.ledger,
      logicalId: 'runtime-binding.d01.blocked-selection',
      version: '1',
      runtimeEligibilityRef: world.eligibility.ref,
      selectedAlternativePathId: blocked.pathId,
      audit: audit(world.env.runtimePrincipal)
    }),
    (error) => error?.code === 'RUNTIME_BINDING_SELECTED_PATH_NOT_LEGAL'
  );
});

test('unknown alternative path cannot be selected', () => {
  const world = directBindingWorld('unknown-path');
  assert.throws(
    () => publishRuntimeBinding({
      ledger: world.env.ledger,
      logicalId: 'runtime-binding.d01.unknown-path',
      version: '1',
      runtimeEligibilityRef: world.eligibility.ref,
      selectedAlternativePathId: 'path:not-real',
      audit: audit(world.env.runtimePrincipal)
    }),
    (error) => error?.code === 'RUNTIME_BINDING_SELECTED_PATH_NOT_FOUND'
  );
});

test('caller cannot override frozen refs, bindings, assumptions or downstream outputs during publication', () => {
  const world = directBindingWorld('closed-publication');
  const selected = legalPath(world);
  for (const [key, value] of [
    ['knowledgeReleaseRef', world.retrieval.semanticPayload.knowledgeReleaseRef],
    ['knowledgeBindings', []],
    ['modelBindings', []],
    ['assumptions', [{ code: 'pretend-evidence' }]],
    ['runtimeBindingRef', { kind: 'RuntimeBinding' }],
    ['selectedAction', 'IRRIGATE_NOW'],
    ['decisionResultRef', { kind: 'DecisionResult' }]
  ]) {
    assert.throws(
      () => publishRuntimeBinding({
        ledger: world.env.ledger,
        logicalId: `runtime-binding.d01.closed.${key}`,
        version: '1',
        runtimeEligibilityRef: world.eligibility.ref,
        selectedAlternativePathId: selected.pathId,
        [key]: value,
        audit: audit(world.env.runtimePrincipal)
      }),
      (error) => error?.code === 'INVALID_RUNTIME_BINDING_PUBLICATION_FIELD',
      key
    );
  }
});

test('minimal RuntimeBinding contract forbids fake spec/calibration bindings and invented assumptions', () => {
  const world = directBindingWorld('contract-boundary');
  const binding = publishBinding(world, 'contract-boundary');
  for (const [field, value, expected] of [
    ['transformationBindings', [{ transformationRef: world.qualified?.knowledge?.ref }], 'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED'],
    ['modelBindings', [{ modelRef: world.decision.ref }], 'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED'],
    ['policyBindings', [{ policyRef: world.decision.ref }], 'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED'],
    ['implementationBindings', [{ implementationRef: world.decision.ref }], 'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED'],
    ['calibrationBindings', [{ calibrationRef: world.decision.ref }], 'D01_CONDITIONAL_SPEC_AUTHORITY_NOT_IMPLEMENTED'],
    ['assumptions', [{ code: 'MISSING_INFORMATION_IS_FINE' }], 'D01_UNAUTHORIZED_ASSUMPTION']
  ]) {
    assert.throws(
      () => normalizeRuntimeBinding({ ...binding.semanticPayload, [field]: value }),
      (error) => error?.code === expected,
      field
    );
  }
});

test('RuntimeBinding contract rejects unresolved alternatives and correctness/decision laundering', () => {
  const world = directBindingWorld('nonclaim');
  const binding = publishBinding(world, 'nonclaim');
  assert.throws(
    () => normalizeRuntimeBinding({ ...binding.semanticPayload, unresolvedAlternativeCount: 1 }),
    (error) => error?.code === 'RUNTIME_BINDING_UNRESOLVED_ALTERNATIVES'
  );
  assert.throws(
    () => normalizeRuntimeBinding({
      ...binding.semanticPayload,
      correctnessClaim: 'SCIENTIFICALLY_CORRECT'
    }),
    (error) => error?.code === 'RUNTIME_BINDING_CORRECTNESS_LAUNDERING'
  );
  assert.throws(
    () => normalizeRuntimeBinding({ ...binding.semanticPayload, selectedAction: 'IRRIGATE_NOW' }),
    (error) => error?.code === 'INVALID_RUNTIME_BINDING_FIELD'
  );
});

test('only exact RuntimeEligibility runtime principal may publish selected RuntimeBinding', () => {
  const world = directBindingWorld('wrong-actor');
  const selected = legalPath(world);
  assert.throws(
    () => publishRuntimeBinding({
      ledger: world.env.ledger,
      logicalId: 'runtime-binding.d01.wrong-actor',
      version: '1',
      runtimeEligibilityRef: world.eligibility.ref,
      selectedAlternativePathId: selected.pathId,
      audit: {
        eventId: 'd01-wrong-actor',
        occurredAt: '2026-08-20T10:20:00.000Z',
        actor: { type: 'USER', id: 'not-runtime-service' },
        details: { suite: 'runtime-binding' }
      }
    }),
    (error) => error?.code === 'RUNTIME_BINDING_AUDIT_ACTOR_MISMATCH'
  );
});

test('historical RuntimeBinding remains exact after a newer version of the bound Deployment logical object exists', () => {
  const world = directBindingWorld('historical-deployment');
  const binding = publishBinding(world, 'historical-deployment');
  const originalDeploymentRef = binding.semanticPayload.deploymentRef;
  const newerPayload = {
    ...world.deployment.semanticPayload,
    effectiveInterval: {
      ...world.deployment.semanticPayload.effectiveInterval,
      end: '2026-09-20T00:00:00.000Z'
    }
  };
  const newer = publishAuthorizedDeployment(world.env, {
    logicalId: world.deployment.ref.logicalId,
    version: '2',
    deployment: newerPayload
  });
  assert.equal(newer.ref.version, '2');
  assert.equal(newer.ref.logicalId, originalDeploymentRef.logicalId);
  assert.notEqual(newer.ref.semanticHash, originalDeploymentRef.semanticHash);
  const validated = validateRuntimeBinding({ ledger: world.env.ledger, runtimeBindingRef: binding.ref });
  assert.deepEqual(validated.semanticPayload.deploymentRef, originalDeploymentRef);
  assert.equal(validated.replayMode, 'EXACT_FROZEN_HISTORICAL_AUTHORITIES_NO_LATEST_LOOKUP');
});

test('RuntimeBinding publication audit is exact and validation rejects wrong-kind refs', () => {
  const world = directBindingWorld('audit');
  const binding = publishBinding(world, 'audit');
  const validated = validateRuntimeBinding({ ledger: world.env.ledger, runtimeBindingRef: binding.ref });
  const events = world.env.ledger.auditFor(binding.ref).filter((event) => event.action === 'PUBLISH_RUNTIME_BINDING');
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.details.selectedAlternativePathId, binding.semanticPayload.selectedAlternativePathId);
  assert.equal(event.details.selectionAuthorityClass, 'RUNTIME_COMPOSITION_SELECTION_NOT_DECISION');
  assert.equal(event.actor.id, validated.runtimeBindingPrincipal.principalId);
  assert.ok(event.inputRefs.some((ref) => ref.kind === 'RuntimeEligibility'));
  assert.ok(event.inputRefs.some((ref) => ref.kind === 'AuthorizationDecisionAudit'));
  assert.throws(
    () => validateRuntimeBinding({ ledger: world.env.ledger, runtimeBindingRef: world.eligibility.ref }),
    (error) => error?.code === 'RUNTIME_BINDING_REQUIRED'
  );
});

test('RuntimeBinding publication does not mutate RuntimeEligibility, ContextManifest or selected Applicability authority', () => {
  const world = directBindingWorld('immutability');
  const selected = legalPath(world);
  const eligibilityBefore = structuredClone(world.env.ledger.resolve(world.eligibility.ref).semanticPayload);
  const manifestBefore = structuredClone(world.env.ledger.resolve(world.manifest.ref).semanticPayload);
  const applicabilityBefore = structuredClone(world.env.ledger.resolve(selected.applicabilityAssessmentRef).semanticPayload);
  publishBinding(world, 'immutability', selected.pathId);
  assert.deepEqual(world.env.ledger.resolve(world.eligibility.ref).semanticPayload, eligibilityBefore);
  assert.deepEqual(world.env.ledger.resolve(world.manifest.ref).semanticPayload, manifestBefore);
  assert.deepEqual(world.env.ledger.resolve(selected.applicabilityAssessmentRef).semanticPayload, applicabilityBefore);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`D01 RuntimeBinding integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
