import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
  agronomicSourceAuthorityRoutingHash,
  normalizeAgronomicSourceAuthorityRouting,
  normalizeAgronomicSourceAuthorityRoutingCompilation
} from '../src/index.mjs';

function ref(kind, logicalId, char) {
  return { kind, logicalId, version: '1', semanticHash: `sha256:${char.repeat(64)}` };
}

const planningKnowledge = ref('QualifiedKnowledge', 'knowledge.planning', 'a');
const actualKnowledge = ref('QualifiedKnowledge', 'knowledge.actual-record', 'b');

function routing(overrides = {}) {
  return {
    contractVersion: AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
    routingId: 'source-proven-planning-actual-routing',
    sourceExpression:
      'This working protocol is used for planning purposes; refer to the field record for actual field operations during 2015.',
    actualOperationRecordSourceExpression:
      'A narrative log of agronomic activities or observations made on field treatments.',
    planningSourceRef: ref('Source', 'source.planning', 'c'),
    actualOperationRecordSourceRef: ref('Source', 'source.actual-record', 'd'),
    subjectScope: 'FIELD_OPERATION_OCCURRENCE',
    planningRole: 'PLANNED_MANAGEMENT_GUIDANCE',
    actualOperationRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    routingRelation: 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE',
    temporalScope: { kind: 'CALENDAR_YEAR', year: 2015 },
    authorityBindings: [
      {
        role: 'PLANNING_ROUTING_ASSERTION',
        authorityRef: planningKnowledge,
        rationale: 'Exact source-qualified evidence establishes scoped planning-to-record routing.'
      },
      {
        role: 'ACTUAL_OPERATION_RECORD_SOURCE_IDENTITY',
        authorityRef: actualKnowledge,
        rationale: 'Exact source-qualified evidence establishes the actual-operation record source identity.'
      }
    ],
    transformationRationale:
      'Preserve scoped source roles without global precedence, event synthesis or runtime authority.',
    ...overrides
  };
}

function compilation(value = routing(), status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
    planningSourceArtifactRefs: [
      ref('SourceArtifact', 'artifact.planning', 'e')
    ],
    actualOperationRecordSourceArtifactRefs: [
      ref('SourceArtifact', 'artifact.actual-record', 'f')
    ],
    planningKnowledgeRefs: [planningKnowledge],
    actualOperationRecordKnowledgeRefs: [actualKnowledge],
    routing: value,
    routingHash: agronomicSourceAuthorityRoutingHash(value),
    semanticReviewRef:
      ref('AgronomicSourceAuthorityRoutingReviewDecision', 'review.routing', '1'),
    losslessCoverage: {
      status,
      coveredElements: [
        'PLANNING_SOURCE',
        'ACTUAL_OPERATION_RECORD_SOURCE',
        'SUBJECT_SCOPE',
        'SCOPED_ROUTING',
        'CALENDAR_YEAR'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_ROUTING_ELEMENT']
    },
    limitations: ['SOURCE_ROUTING_NOT_EXECUTION_EVENT']
  };
}

test('normalizes scoped planning-to-actual-record routing', () => {
  const normalized = normalizeAgronomicSourceAuthorityRouting(routing());
  assert.equal(normalized.subjectScope, 'FIELD_OPERATION_OCCURRENCE');
  assert.equal(normalized.planningRole, 'PLANNED_MANAGEMENT_GUIDANCE');
  assert.equal(normalized.actualOperationRole, 'ACTUAL_FIELD_OPERATION_RECORD');
  assert.equal(
    normalized.routingRelation,
    'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE'
  );
  assert.deepEqual(normalized.temporalScope, {
    kind: 'CALENDAR_YEAR',
    year: 2015
  });
});

test('planning and actual-operation record Sources must remain distinct', () => {
  const candidate = routing();
  candidate.actualOperationRecordSourceRef = candidate.planningSourceRef;
  assert.throws(
    () => normalizeAgronomicSourceAuthorityRouting(candidate),
    /must remain distinct exact Source authorities/
  );
});

test('rejects global precedence or alternative subject semantics', () => {
  for (const [field, value] of [
    ['subjectScope', 'ALL_SOURCE_SEMANTICS'],
    ['planningRole', 'GLOBAL_SOURCE_AUTHORITY'],
    ['actualOperationRole', 'GLOBAL_TRUTH_SOURCE'],
    ['routingRelation', 'GLOBAL_SUPERSEDES']
  ]) {
    const candidate = routing();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicSourceAuthorityRouting(candidate),
      /v1/
    );
  }
});

test('rejects invalid calendar-year routing scope', () => {
  const wrongKind = routing();
  wrongKind.temporalScope.kind = 'ALL_TIME';
  assert.throws(
    () => normalizeAgronomicSourceAuthorityRouting(wrongKind),
    /CALENDAR_YEAR/
  );

  const badYear = routing();
  badYear.temporalScope.year = '2015';
  assert.throws(
    () => normalizeAgronomicSourceAuthorityRouting(badYear),
    /must be an integer/
  );
});

test('requires distinct planning and actual-record knowledge bindings', () => {
  const candidate = routing();
  candidate.authorityBindings[1].authorityRef = planningKnowledge;
  assert.throws(
    () => normalizeAgronomicSourceAuthorityRouting(candidate),
    /distinct exact knowledge authorities/
  );
});

test('rejects execution, absence, supersession, runtime and Outcome laundering fields', () => {
  const fields = [
    ['globalPrecedence', 'ACTUAL_OVER_PLANNED'],
    ['supersedes', true],
    ['recordComplete', true],
    ['absenceMeansNonExecution', true],
    ['operationOccurred', true],
    ['operationId', 'op-1'],
    ['executionStatus', 'EXECUTED'],
    ['executionReceiptRef', ref('ExecutionReceipt', 'receipt.1', '2')],
    ['decisionResultRef', ref('DecisionResult', 'decision.1', '3')],
    ['runtimeBindingRef', ref('RuntimeBinding', 'binding.1', '4')],
    ['runtimeAlternativeSetRef', ref('RuntimeAlternativeSet', 'alts.1', '5')],
    ['policyRef', ref('Policy', 'policy.1', '6')],
    ['outcomeRef', ref('Outcome', 'outcome.1', '7')]
  ];
  for (const [field, value] of fields) {
    const candidate = routing();
    candidate[field] = value;
    assert.throws(
      () => normalizeAgronomicSourceAuthorityRouting(candidate),
      /not part of the source-authority-routing contract/
    );
  }
});

test('hash fails closed on source, scope, year or expression drift', () => {
  const input = compilation();
  normalizeAgronomicSourceAuthorityRoutingCompilation(input);
  const mutations = [
    (x) => { x.routing.sourceExpression = 'different planning routing expression 2015'; },
    (x) => { x.routing.actualOperationRecordSourceExpression = 'different record source expression'; },
    (x) => { x.routing.planningSourceRef.logicalId = 'different.planning'; },
    (x) => { x.routing.actualOperationRecordSourceRef.logicalId = 'different.actual'; },
    (x) => { x.routing.temporalScope.year = 2016; }
  ];
  for (const mutate of mutations) {
    const drifted = structuredClone(input);
    mutate(drifted);
    assert.throws(
      () => normalizeAgronomicSourceAuthorityRoutingCompilation(drifted),
      /routingHash/
    );
  }
});

test('COMPLETE remains local to source-authority routing semantics', () => {
  const normalized =
    normalizeAgronomicSourceAuthorityRoutingCompilation(compilation());
  assert.equal(normalized.losslessCoverage.status, 'COMPLETE');

  const invalid = compilation();
  invalid.losslessCoverage.unrepresentedElements = ['EVENT_LEVEL_FIELD_LOG_INGESTION'];
  assert.throws(
    () => normalizeAgronomicSourceAuthorityRoutingCompilation(invalid),
    /COMPLETE routing coverage/
  );
});
