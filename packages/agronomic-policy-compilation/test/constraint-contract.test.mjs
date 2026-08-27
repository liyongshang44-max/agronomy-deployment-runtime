import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
  agronomicPolicyConstraintHash,
  normalizeAgronomicPolicyConstraint,
  normalizeAgronomicPolicyConstraintCompilation
} from '../src/index.mjs';

function knowledgeRef(logicalId, char = 'a') {
  return {
    kind: 'QualifiedKnowledge',
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

function binding(role, logicalId, char = 'a') {
  return {
    role,
    authorityRef: knowledgeRef(logicalId, char),
    rationale: 'Source-governed agronomic prohibition authority.'
  };
}

function unconditionalConstraint() {
  return {
    contractVersion: AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
    constraintId: 'no-sensitive-operation',
    decisionType: 'OPERATION_CONTROL',
    effect: 'PROHIBIT',
    actionCode: 'SENSITIVE_OPERATION',
    exceptions: [],
    authorityBindings: [binding('PROHIBITED_ACTION', 'knowledge.prohibit')]
  };
}

function compilation(constraint = unconditionalConstraint()) {
  return {
    contractVersion: AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'b')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'c')],
    knowledgeRefs: [knowledgeRef('knowledge.prohibit')],
    policyRef: ref('Policy', 'policy.operation-control', 'd'),
    constraint,
    constraintHash: agronomicPolicyConstraintHash(constraint),
    transformationRationale: 'Preserve source-explicit negative authority as an auditable Policy constraint.',
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: ['ACTION_TARGET', 'PROHIBITION'],
      unrepresentedElements: []
    },
    approverPrincipal: {
      principalId: 'spec-manager',
      type: 'USER',
      organizationId: 'org-a',
      tenantId: 'tenant-a'
    },
    approvalRef: ref('AuthorizationDecisionAudit', 'auth.policy', 'e'),
    limitations: ['PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE']
  };
}

test('normalizes unconditional prohibition without inventing trigger, positive action, or cadence', () => {
  const normalized = normalizeAgronomicPolicyConstraint(unconditionalConstraint());
  assert.equal(normalized.effect, 'PROHIBIT');
  assert.equal(normalized.actionCode, 'SENSITIVE_OPERATION');
  assert.equal(normalized.when, undefined);
  assert.deepEqual(normalized.exceptions, []);
  assert.match(agronomicPolicyConstraintHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('normalizes source-bound conditional prohibition', () => {
  const value = unconditionalConstraint();
  value.when = {
    logic: 'ALL',
    predicates: [{
      semanticId: 'derived.days_before_reference_operation',
      comparator: 'LT',
      value: { type: 'DECIMAL', decimal: '7', unit: 'd' },
      authorityBindings: [binding('PROHIBITION_CONDITION', 'knowledge.prohibit')]
    }]
  };
  const normalized = normalizeAgronomicPolicyConstraint(value);
  assert.equal(normalized.when.predicates[0].semanticId, 'derived.days_before_reference_operation');
  assert.equal(normalized.when.predicates[0].comparator, 'LT');
  assert.equal(normalized.when.predicates[0].value.decimal, '7');
});

test('preserves explicit prohibition exception as first-class condition', () => {
  const value = unconditionalConstraint();
  value.exceptions = [{
    logic: 'ALL',
    predicates: [{
      semanticId: 'field.area_role',
      comparator: 'EQ',
      value: { type: 'CATEGORY', category: 'EXEMPT_AREA' },
      authorityBindings: [binding('PROHIBITION_EXCEPTION', 'knowledge.prohibit')]
    }]
  }];
  const normalized = normalizeAgronomicPolicyConstraint(value);
  assert.equal(normalized.exceptions.length, 1);
  assert.equal(normalized.exceptions[0].predicates[0].value.category, 'EXEMPT_AREA');
});

test('prohibition and all condition/exception predicates require source authority', () => {
  const missingMain = unconditionalConstraint();
  missingMain.authorityBindings = [];
  assert.throws(() => normalizeAgronomicPolicyConstraint(missingMain), /non-empty/);

  const missingCondition = unconditionalConstraint();
  missingCondition.when = {
    logic: 'ALL',
    predicates: [{
      semanticId: 'context.flag',
      comparator: 'EQ',
      value: { type: 'BOOLEAN', boolean: true },
      authorityBindings: []
    }]
  };
  assert.throws(() => normalizeAgronomicPolicyConstraint(missingCondition), /non-empty/);

  const missingException = unconditionalConstraint();
  missingException.exceptions = [{
    logic: 'ALL',
    predicates: [{
      semanticId: 'context.exempt',
      comparator: 'EQ',
      value: { type: 'BOOLEAN', boolean: true },
      authorityBindings: []
    }]
  }];
  assert.throws(() => normalizeAgronomicPolicyConstraint(missingException), /non-empty/);
});

test('constraint compilation binds exact constraint hash and rejects drift', () => {
  const input = compilation();
  const normalized = normalizeAgronomicPolicyConstraintCompilation(input);
  assert.equal(normalized.constraintHash, input.constraintHash);

  const drifted = structuredClone(input);
  drifted.constraint.actionCode = 'OTHER_ACTION';
  assert.throws(() => normalizeAgronomicPolicyConstraintCompilation(drifted), /constraintHash/);
});

test('COMPLETE constraint coverage cannot hide unrepresented elements', () => {
  const input = compilation();
  input.losslessCoverage.unrepresentedElements = ['SOURCE_EXCEPTION'];
  assert.throws(() => normalizeAgronomicPolicyConstraintCompilation(input), /COMPLETE coverage/);
});
