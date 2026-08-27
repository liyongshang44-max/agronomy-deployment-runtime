import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  agronomicPolicyObligationHash,
  normalizeAgronomicPolicyObligation,
  normalizeAgronomicPolicyObligationCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

function knowledgeRef(logicalId, char = 'a') {
  return ref('QualifiedKnowledge', logicalId, char);
}

function binding(role, logicalId, char = 'a') {
  return {
    role,
    authorityRef: knowledgeRef(logicalId, char),
    rationale: 'Source-governed hard obligation authority.'
  };
}

function exactObligation() {
  return {
    contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
    obligationId: 'required-operation-three-times',
    decisionType: 'OPERATION_CONTROL',
    effect: 'REQUIRE',
    actionCode: 'REQUIRED_OPERATION',
    occurrence: {
      mode: 'EXACT_COUNT',
      exactCount: 3,
      period: {
        kind: 'FIXED_CALENDAR_YEAR',
        year: 2015,
        authorityBindings: [binding('COUNTING_PERIOD', 'knowledge.obligation')]
      },
      authorityBindings: [binding('OCCURRENCE_CARDINALITY', 'knowledge.obligation')]
    },
    authorityBindings: [binding('REQUIRED_ACTION', 'knowledge.obligation')]
  };
}

function compilation(obligation = exactObligation(), status = 'COMPLETE') {
  return {
    contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
    authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
    sourceProtocolRefs: [ref('Source', 'source.protocol', 'b')],
    sourceProtocolArtifactRefs: [ref('SourceArtifact', 'artifact.protocol', 'c')],
    knowledgeRefs: [knowledgeRef('knowledge.obligation')],
    policyRef: ref('Policy', 'policy.operation-control', 'd'),
    obligation,
    obligationHash: agronomicPolicyObligationHash(obligation),
    transformationRationale: 'Preserve source-explicit hard action occurrence cardinality without inventing a schedule.',
    losslessCoverage: {
      status,
      coveredElements: ['ACTION', 'CARDINALITY', 'COUNTING_PERIOD', 'REQUIRE_MODALITY'],
      unrepresentedElements: status === 'COMPLETE' ? [] : ['NORMATIVE_MODALITY_AS_NEEDED']
    },
    approverPrincipal: {
      principalId: 'spec-manager',
      type: 'USER',
      organizationId: 'org-a',
      tenantId: 'tenant-a'
    },
    approvalRef: ref('AuthorizationDecisionAudit', 'auth.policy', 'e'),
    limitations: ['OBLIGATION_AUTHORITY_NOT_EXECUTION_EVIDENCE']
  };
}

test('normalizes fixed-year exact-count hard obligation without scheduler semantics', () => {
  const normalized = normalizeAgronomicPolicyObligation(exactObligation());
  assert.equal(normalized.effect, 'REQUIRE');
  assert.equal(normalized.occurrence.mode, 'EXACT_COUNT');
  assert.equal(normalized.occurrence.exactCount, 3);
  assert.equal(normalized.occurrence.period.kind, 'FIXED_CALENDAR_YEAR');
  assert.equal(normalized.occurrence.period.year, 2015);
  assert.equal(Object.hasOwn(normalized, 'trigger'), false);
  assert.equal(Object.hasOwn(normalized, 'schedule'), false);
  assert.equal(Object.hasOwn(normalized, 'fallback'), false);
  assert.match(agronomicPolicyObligationHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('normalizes exact annual cardinality without inventing a date', () => {
  const value = exactObligation();
  value.occurrence.exactCount = 1;
  value.occurrence.period = {
    kind: 'EACH_CALENDAR_YEAR',
    authorityBindings: [binding('COUNTING_PERIOD', 'knowledge.obligation')]
  };
  const normalized = normalizeAgronomicPolicyObligation(value);
  assert.equal(normalized.occurrence.period.kind, 'EACH_CALENDAR_YEAR');
  assert.equal(Object.hasOwn(normalized.occurrence.period, 'year'), false);
});

test('normalizes bounded annual cardinality as grammar only', () => {
  const value = exactObligation();
  value.occurrence = {
    mode: 'BOUNDED_COUNT',
    minCount: 2,
    maxCount: 6,
    period: {
      kind: 'EACH_CALENDAR_YEAR',
      authorityBindings: [binding('COUNTING_PERIOD', 'knowledge.obligation')]
    },
    authorityBindings: [binding('OCCURRENCE_CARDINALITY', 'knowledge.obligation')]
  };
  const normalized = normalizeAgronomicPolicyObligation(value);
  assert.equal(normalized.occurrence.minCount, 2);
  assert.equal(normalized.occurrence.maxCount, 6);
});

test('rejects invalid occurrence cardinality shapes', () => {
  const exactWithBounds = exactObligation();
  exactWithBounds.occurrence.minCount = 1;
  assert.throws(() => normalizeAgronomicPolicyObligation(exactWithBounds), /forbids minCount\/maxCount/);

  const boundedWithExact = exactObligation();
  boundedWithExact.occurrence = {
    mode: 'BOUNDED_COUNT',
    exactCount: 3,
    minCount: 2,
    maxCount: 6,
    period: {
      kind: 'EACH_CALENDAR_YEAR',
      authorityBindings: [binding('COUNTING_PERIOD', 'knowledge.obligation')]
    },
    authorityBindings: [binding('OCCURRENCE_CARDINALITY', 'knowledge.obligation')]
  };
  assert.throws(() => normalizeAgronomicPolicyObligation(boundedWithExact), /forbids exactCount/);

  const reversed = exactObligation();
  reversed.occurrence = {
    mode: 'BOUNDED_COUNT',
    minCount: 6,
    maxCount: 2,
    period: {
      kind: 'EACH_CALENDAR_YEAR',
      authorityBindings: [binding('COUNTING_PERIOD', 'knowledge.obligation')]
    },
    authorityBindings: [binding('OCCURRENCE_CARDINALITY', 'knowledge.obligation')]
  };
  assert.throws(() => normalizeAgronomicPolicyObligation(reversed), /minCount <= maxCount/);
});

test('rejects period-shape drift', () => {
  const missingYear = exactObligation();
  delete missingYear.occurrence.period.year;
  assert.throws(() => normalizeAgronomicPolicyObligation(missingYear), /requires a four-digit integer year/);

  const recurringWithYear = exactObligation();
  recurringWithYear.occurrence.period.kind = 'EACH_CALENDAR_YEAR';
  assert.throws(() => normalizeAgronomicPolicyObligation(recurringWithYear), /forbids a fixed year/);
});

test('requires source authority for action, cardinality and counting period', () => {
  const missingAction = exactObligation();
  missingAction.authorityBindings = [];
  assert.throws(() => normalizeAgronomicPolicyObligation(missingAction), /non-empty/);

  const missingCount = exactObligation();
  missingCount.occurrence.authorityBindings = [];
  assert.throws(() => normalizeAgronomicPolicyObligation(missingCount), /non-empty/);

  const missingPeriod = exactObligation();
  missingPeriod.occurrence.period.authorityBindings = [];
  assert.throws(() => normalizeAgronomicPolicyObligation(missingPeriod), /non-empty/);
});

test('compilation hash fails closed on occurrence drift', () => {
  const input = compilation();
  const normalized = normalizeAgronomicPolicyObligationCompilation(input);
  assert.equal(normalized.obligationHash, input.obligationHash);

  const drifted = structuredClone(input);
  drifted.obligation.occurrence.exactCount = 4;
  assert.throws(() => normalizeAgronomicPolicyObligationCompilation(drifted), /obligationHash/);
});

test('INCOMPLETE candidate may be normalized but cannot masquerade as COMPLETE coverage', () => {
  const incomplete = normalizeAgronomicPolicyObligationCompilation(compilation(exactObligation(), 'INCOMPLETE'));
  assert.equal(incomplete.losslessCoverage.status, 'INCOMPLETE');
  assert.deepEqual(incomplete.losslessCoverage.unrepresentedElements, ['NORMATIVE_MODALITY_AS_NEEDED']);

  const invalidComplete = compilation();
  invalidComplete.losslessCoverage.unrepresentedElements = ['NORMATIVE_MODALITY_AS_NEEDED'];
  assert.throws(() => normalizeAgronomicPolicyObligationCompilation(invalidComplete), /COMPLETE coverage/);
});
