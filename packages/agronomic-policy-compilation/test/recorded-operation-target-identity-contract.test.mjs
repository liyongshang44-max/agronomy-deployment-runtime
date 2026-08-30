import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
  agronomicRecordedOperationTargetIdentityBindingHash,
  deriveAgronomicRecordedOperationSourceBackedTargetId,
  normalizeAgronomicRecordedOperationTargetIdentityBinding,
  normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

const namespaceRef = ref('Source', 'source.sustainable-corn.operations', 'a');

function evidence(role) {
  return {
    evidenceRole: role,
    sourceRef: ref('Source', 'source.sustainable-corn.sites', 'b'),
    sourceArtifactRef: ref(
      'SourceArtifact',
      'artifact.sustainable-corn.sites',
      'c'
    ),
    sourceArtifactContentHash: `sha256:${'d'.repeat(64)}`,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: 2692,
      endExclusive: 2900,
      evidenceHash: `sha256:${'e'.repeat(64)}`
    }
  };
}

function binding(overrides = {}) {
  const sourceNativeSubject = { name: 'siteid', value: 'SERF' };
  const targetId = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef,
    identifierName: sourceNativeSubject.name,
    identifierValue: sourceNativeSubject.value,
    granularity: 'FARM'
  });
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.sustainable-corn.serf.farm',
    parentOccurrenceCompilationRef: ref(
      'AgronomicRecordedOperationOccurrenceCompilation',
      'occurrence.sustainable-corn.serf.2011-05-03.plant-corn',
      'f'
    ),
    sourceNativeSubject,
    sourceBackedTargetIdentity: {
      namespaceRef,
      granularity: 'FARM',
      targetId
    },
    identityEvidence: [
      evidence('SOURCE_NATIVE_IDENTIFIER_CONTEXT'),
      evidence('TARGET_GRANULARITY_MEANING')
    ],
    applicability: {
      appliesToOccurrenceSourceRef: namespaceRef,
      appliesToSourceNativeIdentifier: sourceNativeSubject
    },
    transformationRationale:
      'Bind only source-native siteid SERF to a source-backed FARM identity without field, geometry, timezone, ContextDatum or DecisionProblem inference.',
    ...overrides
  };
}

function compilation(value = binding(), status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding: value,
    bindingHash: agronomicRecordedOperationTargetIdentityBindingHash(value),
    identityReviewRef: ref(
      'AgronomicRecordedOperationTargetIdentityBindingReviewDecision',
      'review.target-identity.serf',
      '1'
    ),
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SOURCE_NATIVE_IDENTIFIER',
        'SOURCE_NAMESPACE',
        'TARGET_GRANULARITY',
        'EXACT_IDENTITY_EVIDENCE'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_TARGETED_IDENTITY_ELEMENT']
    },
    limitations: [
      'SOURCE_BACKED_IDENTITY_NOT_GLOBAL_CANONICAL_IDENTITY',
      'FARM_IDENTITY_NOT_FIELD_IDENTITY',
      'IDENTITY_NOT_GEOMETRY',
      'IDENTITY_NOT_TIMEZONE',
      'IDENTITY_NOT_CONTEXT_DATUM',
      'IDENTITY_NOT_DECISION_PROBLEM'
    ]
  };
}

test('normalizes source-backed SERF identity only at FARM granularity', () => {
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBinding(binding());
  assert.deepEqual(normalized.sourceNativeSubject, {
    name: 'siteid',
    value: 'SERF'
  });
  assert.equal(
    normalized.sourceBackedTargetIdentity.granularity,
    'FARM'
  );
  assert.match(
    normalized.sourceBackedTargetIdentity.targetId,
    /^target_src_[0-9a-f]{64}$/
  );
});

test('target id is deterministic and source namespace is material', () => {
  const first = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef,
    identifierName: 'siteid',
    identifierValue: 'SERF',
    granularity: 'FARM'
  });
  const second = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef,
    identifierName: 'siteid',
    identifierValue: 'SERF',
    granularity: 'FARM'
  });
  const changedNamespace = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef: ref('Source', 'source.other-provider.operations', '2'),
    identifierName: 'siteid',
    identifierValue: 'SERF',
    granularity: 'FARM'
  });
  const changedIdentifier = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef,
    identifierName: 'siteid',
    identifierValue: 'NWREC',
    granularity: 'FARM'
  });
  assert.equal(first, second);
  assert.notEqual(first, changedNamespace);
  assert.notEqual(first, changedIdentifier);
});

test('v1 fails closed on FIELD, ZONE and PLOT granularity', () => {
  for (const granularity of ['FIELD', 'ZONE', 'PLOT']) {
    assert.throws(
      () => deriveAgronomicRecordedOperationSourceBackedTargetId({
        namespaceRef,
        identifierName: 'siteid',
        identifierValue: 'SERF',
        granularity
      }),
      /target granularity/
    );
  }
});

test('caller cannot forge a different source-backed target id', () => {
  const value = binding();
  value.sourceBackedTargetIdentity.targetId =
    `target_src_${'0'.repeat(64)}`;
  assert.throws(
    () => normalizeAgronomicRecordedOperationTargetIdentityBinding(value),
    /targetId must be derived only/
  );
});

test('requires both exact identity evidence roles', () => {
  const value = binding();
  value.identityEvidence = value.identityEvidence.filter(
    (item) => item.evidenceRole !== 'TARGET_GRANULARITY_MEANING'
  );
  assert.throws(
    () => normalizeAgronomicRecordedOperationTargetIdentityBinding(value),
    /must include TARGET_GRANULARITY_MEANING/
  );
});

test('same exact byte range may support two independently reviewed evidence roles', () => {
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBinding(binding());
  assert.equal(normalized.identityEvidence.length, 2);
  assert.deepEqual(
    normalized.identityEvidence.map((item) => item.evidenceRole),
    ['SOURCE_NATIVE_IDENTIFIER_CONTEXT', 'TARGET_GRANULARITY_MEANING']
  );
  assert.equal(
    normalized.identityEvidence[0].sourceLocator.start,
    normalized.identityEvidence[1].sourceLocator.start
  );
  assert.equal(
    normalized.identityEvidence[0].sourceLocator.endExclusive,
    normalized.identityEvidence[1].sourceLocator.endExclusive
  );
});

test('forbidden downstream authority fields cannot be laundered into identity', () => {
  const fields = [
    ['fieldId', 'SERF'],
    ['zoneId', 'SERF'],
    ['plotId', 'SERF'],
    ['seasonId', '2011'],
    ['geometryRef', 'SERF'],
    ['timezone', 'America/Chicago'],
    ['contextDatumRef', ref('ContextDatum', 'context.serf', '3')],
    ['decisionProblemRef', ref('DecisionProblem', 'decision.serf', '4')],
    ['policyRef', ref('Policy', 'policy.serf', '5')],
    ['executionReceiptRef', ref('ExecutionReceipt', 'execution.serf', '6')],
    ['outcomeRef', ref('Outcome', 'outcome.serf', '7')],
    ['inverseSourceIdentifier', 'SERF'],
    ['sourceIdentityComplete', true]
  ];

  for (const [field, value] of fields) {
    const candidate = binding();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicRecordedOperationTargetIdentityBinding(candidate),
      /not part of the target-identity contract/
    );
  }
});

test('compilation hash and COMPLETE local coverage are enforced', () => {
  const value = compilation();
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(value);
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  const drift = structuredClone(value);
  drift.binding.sourceNativeSubject.value = 'NWREC';
  drift.binding.applicability.appliesToSourceNativeIdentifier.value = 'NWREC';
  drift.binding.sourceBackedTargetIdentity.targetId =
    deriveAgronomicRecordedOperationSourceBackedTargetId({
      namespaceRef: drift.binding.sourceBackedTargetIdentity.namespaceRef,
      identifierName: 'siteid',
      identifierValue: 'NWREC',
      granularity: 'FARM'
    });
  assert.throws(
    () => normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(drift),
    /bindingHash must exactly match/
  );

  const invalidCoverage = compilation(binding(), 'COMPLETE');
  invalidCoverage.losslessCoverage.unrepresentedElements = ['FIELD_IDENTITY'];
  assert.throws(
    () => normalizeAgronomicRecordedOperationTargetIdentityBindingCompilation(
      invalidCoverage
    ),
    /COMPLETE targeted identity coverage/
  );
});
