import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION,
  AgronomicDecisionProblemFarmTargetBindingCompilationError,
  agronomicDecisionProblemFarmTargetBindingHash,
  normalizeAgronomicDecisionProblemFarmTargetBinding,
  normalizeAgronomicDecisionProblemFarmTargetBindingCompilation
} from '../src/index.mjs';

function ref(kind, seed) {
  return {
    kind,
    logicalId: 'test.' + seed,
    version: '1',
    semanticHash: 'sha256:' + seed.repeat(64).slice(0, 64)
  };
}

const targetId = 'target_src_' + 'a'.repeat(64);
const parentRef =
  ref('AgronomicContextTargetRefFarmInstanceProjectionCompilation', '1');
const reviewRef =
  ref('AgronomicDecisionProblemFarmTargetBindingReviewDecision', '2');

function binding(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.test.dec0032',
    parentTargetRefFarmInstanceProjectionCompilationRef: parentRef,
    sourceBackedTargetComponent: {
      field: 'farmId',
      value: targetId
    },
    deploymentOwnedTargetFields: {
      required: ['organizationId'],
      optional: ['tenantId']
    },
    forbiddenUnestablishedTargetFields: {
      fields: ['fieldId', 'seasonId', 'zoneId']
    },
    decisionIntentAuthority: 'A01_AUTHORIZED_CREATOR',
    targetBindingRule: 'INJECT_EXACT_PARENT_FARM_ID',
    rationale: 'Exact FARM target component comes only from DEC-0027.',
    ...overrides
  };
}

function compilation(value = binding(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY',
    binding: value,
    bindingHash: agronomicDecisionProblemFarmTargetBindingHash(value),
    bindingReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['FARM_TARGET_COMPONENT', 'OWNERSHIP_SEPARATION'],
      unrepresentedElements: []
    },
    limitations: ['NO_CONTEXT_MANIFEST'],
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicDecisionProblemFarmTargetBindingCompilationError
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('normalizes exact DEC-0032 ownership split', () => {
  const normalized =
    normalizeAgronomicDecisionProblemFarmTargetBinding(binding());
  assert.deepEqual(normalized.sourceBackedTargetComponent, {
    field: 'farmId',
    value: targetId
  });
  assert.deepEqual(normalized.deploymentOwnedTargetFields, {
    required: ['organizationId'],
    optional: ['tenantId']
  });
  assert.deepEqual(
    normalized.forbiddenUnestablishedTargetFields.fields,
    ['fieldId', 'seasonId', 'zoneId']
  );
  assert.equal(
    normalized.decisionIntentAuthority,
    'A01_AUTHORIZED_CREATOR'
  );
});

test('binding hash is deterministic and exact parent ref is material', () => {
  const first = binding();
  assert.equal(
    agronomicDecisionProblemFarmTargetBindingHash(first),
    agronomicDecisionProblemFarmTargetBindingHash(structuredClone(first))
  );
  const drift = structuredClone(first);
  drift.parentTargetRefFarmInstanceProjectionCompilationRef.semanticHash =
    'sha256:' + 'f'.repeat(64);
  assert.notEqual(
    agronomicDecisionProblemFarmTargetBindingHash(first),
    agronomicDecisionProblemFarmTargetBindingHash(drift)
  );
});

test('rejects wrong predecessor kind', () => {
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBinding(
      binding({
        parentTargetRefFarmInstanceProjectionCompilationRef:
          ref('AgronomicContextDatumAssemblyCompilation', '3')
      })
    ),
    'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_AUTHORITY_REF'
  );
});

test('rejects raw SERF, display name and arbitrary farm ids', () => {
  for (const value of [
    'SERF',
    'Southeast Research and Demonstration Farm',
    'farm-1'
  ]) {
    expectCode(
      () => normalizeAgronomicDecisionProblemFarmTargetBinding(
        binding({
          sourceBackedTargetComponent: {
            field: 'farmId',
            value
          }
        })
      ),
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_FARM_ID'
    );
  }
});

test('rejects target component widening', () => {
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBinding(
      binding({
        sourceBackedTargetComponent: {
          field: 'fieldId',
          value: targetId
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPONENT'
  );
});

test('rejects ownership mutation for organization tenant field season zone', () => {
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBinding(
      binding({
        deploymentOwnedTargetFields: {
          required: ['organizationId', 'farmId'],
          optional: ['tenantId']
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_OWNERSHIP'
  );
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBinding(
      binding({
        forbiddenUnestablishedTargetFields: {
          fields: ['fieldId', 'seasonId']
        }
      })
    ),
    'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_OWNERSHIP'
  );
});

test('rejects source authority takeover of A01 decision intent', () => {
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBinding(
      binding({ decisionIntentAuthority: 'SOURCE_EVIDENCE' })
    ),
    'UNSUPPORTED_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INTENT_AUTHORITY'
  );
});

test('normalizes COMPLETE compilation and detects hash mismatch', () => {
  assert.equal(
    normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(compilation())
      .losslessCoverage.status,
    'COMPLETE'
  );
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(
      compilation(binding(), {
        bindingHash: 'sha256:' + '0'.repeat(64)
      })
    ),
    'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_HASH_MISMATCH'
  );
});

test('INCOMPLETE compilation must name unresolved targeted elements', () => {
  expectCode(
    () => normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(
      compilation(binding(), {
        losslessCoverage: {
          status: 'INCOMPLETE',
          coveredElements: [],
          unrepresentedElements: []
        }
      })
    ),
    'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COVERAGE'
  );
});
