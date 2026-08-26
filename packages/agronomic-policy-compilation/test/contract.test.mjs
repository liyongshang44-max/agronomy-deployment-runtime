import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RULE_CONTRACT_VERSION,
  AGRONOMIC_RULE_CONTRACT_VERSION_V2,
  declarativeAgronomicRuleHash,
  normalizeDeclarativeAgronomicRule,
  publishAgronomicPolicyCompilation,
  validateAgronomicPolicyCompilationAuthority
} from '../src/index.mjs';

function knowledgeRef(logicalId) {
  return {
    kind: 'QualifiedKnowledge',
    logicalId,
    version: '1',
    semanticHash: `sha256:${'a'.repeat(64)}`
  };
}

function binding(role, logicalId, rationale = 'Source-governed agronomic protocol authority.') {
  return {
    role,
    authorityRef: knowledgeRef(logicalId),
    rationale
  };
}

function protocolRule() {
  return {
    contractVersion: AGRONOMIC_RULE_CONTRACT_VERSION,
    ruleId: 'protocol.soybean.irrigation.2015',
    decisionType: 'IRRIGATION_SCHEDULING',
    inputs: [
      'net_plant_available_water_mm',
      'plant_available_water_mm',
      'previous_day_plant_available_water_deficit_mm',
      'rainfall_mm'
    ],
    evaluationCadence: 'P1D',
    trigger: {
      logic: 'ALL',
      predicates: [{
        semanticId: 'plant_available_water_mm',
        comparator: 'LT',
        value: { type: 'DECIMAL', decimal: '0', unit: 'mm' },
        temporal: { mode: 'CONSECUTIVE', count: 2, period: 'P1D' },
        authorityBindings: [{
          role: 'TRIGGER_THRESHOLD',
          authorityRef: knowledgeRef('knowledge.protocol.paw-negative'),
          rationale: 'Protocol requires two consecutive negative plant-available-water days.'
        }]
      }]
    },
    exceptions: [{
      logic: 'ALL',
      predicates: [{
        semanticId: 'net_plant_available_water_mm',
        comparator: 'GT',
        value: { type: 'DECIMAL', decimal: '0', unit: 'mm' },
        temporal: { mode: 'INSTANT' },
        authorityBindings: [{
          role: 'RAINFALL_OVERRIDE',
          authorityRef: knowledgeRef('knowledge.protocol.rainfall-override'),
          rationale: 'Protocol cancels irrigation when rainfall restores net plant-available water.'
        }]
      }]
    }],
    action: {
      actionCode: 'IRRIGATE',
      timing: { mode: 'OFFSET', offset: 'P1D' },
      parameters: {
        irrigation_depth_mm: {
          type: 'ABS',
          sourceSemanticId: 'previous_day_plant_available_water_deficit_mm',
          authorityBindings: [{
            role: 'ACTION_AMOUNT',
            authorityRef: knowledgeRef('knowledge.protocol.irrigation-amount'),
            rationale: 'Protocol bases irrigation amount on the prior-day deficit.'
          }]
        }
      },
      authorityBindings: []
    },
    coordination: { mode: 'NONE' },
    fallback: { disposition: 'WAIT' },
    humanGate: { required: false },
    limitations: ['SITE_AND_PROTOCOL_SPECIFIC']
  };
}

function protocolRuleV2() {
  const rule = protocolRule();
  rule.contractVersion = AGRONOMIC_RULE_CONTRACT_VERSION_V2;
  rule.temporalConstraints = [{
    target: 'RULE_EVALUATION',
    relation: 'ON_OR_AFTER_DATE',
    date: '2015-05-01',
    authorityBindings: [binding(
      'EVALUATION_START_DATE',
      'knowledge.protocol.evaluation-start',
      'The protocol starts daily rainfall and irrigation recording on the stated calendar date.'
    )]
  }];
  rule.coordination = {
    mode: 'NOTIFY',
    channel: 'EMAIL',
    participants: ['KEY_INVESTIGATORS', 'FIELD_STAFF'],
    coordinator: {
      sourceLabel: 'Named protocol coordinator',
      authorityBindings: [binding(
        'COMMUNICATION_COORDINATOR',
        'knowledge.protocol.coordinator',
        'The source explicitly names a communication coordinator.'
      )]
    },
    authorityBindings: []
  };
  return rule;
}

test('public module loads contract and authority entry points', () => {
  assert.equal(typeof publishAgronomicPolicyCompilation, 'function');
  assert.equal(typeof validateAgronomicPolicyCompilationAuthority, 'function');
});

test('v1 irrigation protocol semantics remain representable without dropping cadence, trigger, persistence, exception, action timing or amount', () => {
  const normalized = normalizeDeclarativeAgronomicRule(protocolRule());
  assert.equal(normalized.contractVersion, AGRONOMIC_RULE_CONTRACT_VERSION);
  assert.equal(normalized.evaluationCadence, 'P1D');
  assert.equal(normalized.trigger.predicates[0].temporal.mode, 'CONSECUTIVE');
  assert.equal(normalized.trigger.predicates[0].temporal.count, 2);
  assert.equal(normalized.exceptions.length, 1);
  assert.equal(normalized.action.timing.offset, 'P1D');
  assert.equal(normalized.action.parameters.irrigation_depth_mm.type, 'ABS');
  assert.equal(normalized.coordination.mode, 'NONE');
  assert.match(declarativeAgronomicRuleHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('v2 adds source-bound temporal constraints and named coordination coordinator without changing v1 semantics', () => {
  const normalized = normalizeDeclarativeAgronomicRule(protocolRuleV2());
  assert.equal(normalized.contractVersion, AGRONOMIC_RULE_CONTRACT_VERSION_V2);
  assert.equal(normalized.evaluationCadence, 'P1D');
  assert.equal(normalized.temporalConstraints.length, 1);
  assert.equal(normalized.temporalConstraints[0].target, 'RULE_EVALUATION');
  assert.equal(normalized.temporalConstraints[0].relation, 'ON_OR_AFTER_DATE');
  assert.equal(normalized.temporalConstraints[0].date, '2015-05-01');
  assert.equal(normalized.temporalConstraints[0].authorityBindings[0].role, 'EVALUATION_START_DATE');
  assert.equal(normalized.coordination.mode, 'NOTIFY');
  assert.equal(normalized.coordination.coordinator.sourceLabel, 'Named protocol coordinator');
  assert.equal(normalized.coordination.coordinator.authorityBindings[0].role, 'COMMUNICATION_COORDINATOR');
  assert.match(declarativeAgronomicRuleHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('v2 preserves inclusive versus exclusive calendar boundaries', () => {
  const inclusive = protocolRuleV2();
  inclusive.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'ON_OR_AFTER_DATE',
    date: '2015-05-05',
    authorityBindings: [binding('ACTION_ON_OR_AFTER_DATE', 'knowledge.protocol.action-on-or-after-date')]
  }];
  const inclusiveNormalized = normalizeDeclarativeAgronomicRule(inclusive);
  assert.equal(inclusiveNormalized.temporalConstraints[0].relation, 'ON_OR_AFTER_DATE');

  const exclusive = protocolRuleV2();
  exclusive.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'AFTER_DATE',
    date: '2015-05-05',
    authorityBindings: [binding('ACTION_AFTER_DATE', 'knowledge.protocol.action-after-date')]
  }];
  const exclusiveNormalized = normalizeDeclarativeAgronomicRule(exclusive);
  assert.equal(exclusiveNormalized.temporalConstraints[0].relation, 'AFTER_DATE');
  assert.notEqual(
    declarativeAgronomicRuleHash(inclusiveNormalized),
    declarativeAgronomicRuleHash(exclusiveNormalized)
  );
});

test('v2 represents an event-relative minimum offset before an operation', () => {
  const rule = protocolRuleV2();
  rule.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'MIN_OFFSET_BEFORE_EVENT',
    eventSemanticId: 'operation.planting',
    duration: 'P7D',
    authorityBindings: [binding('ACTION_MIN_OFFSET_BEFORE_EVENT', 'knowledge.protocol.minimum-offset-before-event')]
  }];
  const normalized = normalizeDeclarativeAgronomicRule(rule);
  assert.equal(normalized.temporalConstraints[0].relation, 'MIN_OFFSET_BEFORE_EVENT');
  assert.equal(normalized.temporalConstraints[0].eventSemanticId, 'operation.planting');
  assert.equal(normalized.temporalConstraints[0].duration, 'P7D');
});

test('v1 fails closed when v2-only temporalConstraints or coordinator fields are supplied', () => {
  const temporal = protocolRule();
  temporal.temporalConstraints = [{
    target: 'RULE_EVALUATION',
    relation: 'ON_OR_AFTER_DATE',
    date: '2015-05-01',
    authorityBindings: []
  }];
  assert.throws(() => normalizeDeclarativeAgronomicRule(temporal), /not part of/);

  const coordinator = protocolRule();
  coordinator.coordination = {
    mode: 'NOTIFY',
    participants: ['FIELD_STAFF'],
    coordinator: { sourceLabel: 'Named protocol coordinator', authorityBindings: [] }
  };
  assert.throws(() => normalizeDeclarativeAgronomicRule(coordinator), /not part of/);
});

test('v2 calendar temporal constraint requires a valid calendar date and source authority binding', () => {
  const invalidDate = protocolRuleV2();
  invalidDate.temporalConstraints[0].date = '2015-02-30';
  assert.throws(() => normalizeDeclarativeAgronomicRule(invalidDate), /valid YYYY-MM-DD/);

  const missingAuthority = protocolRuleV2();
  missingAuthority.temporalConstraints[0].authorityBindings = [];
  assert.throws(() => normalizeDeclarativeAgronomicRule(missingAuthority), /non-empty/);
});

test('v2 calendar relation rejects event or duration fields', () => {
  const rule = protocolRuleV2();
  rule.temporalConstraints[0].eventSemanticId = 'operation.planting';
  assert.throws(() => normalizeDeclarativeAgronomicRule(rule), /accepts date only/);
});

test('v2 event-offset relation requires eventSemanticId and a non-zero duration', () => {
  const missingEvent = protocolRuleV2();
  missingEvent.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'MIN_OFFSET_BEFORE_EVENT',
    duration: 'P7D',
    authorityBindings: [binding('ACTION_OFFSET', 'knowledge.protocol.offset')]
  }];
  assert.throws(() => normalizeDeclarativeAgronomicRule(missingEvent), /eventSemanticId/);

  const missingDuration = protocolRuleV2();
  missingDuration.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'MIN_OFFSET_BEFORE_EVENT',
    eventSemanticId: 'operation.planting',
    authorityBindings: [binding('ACTION_OFFSET', 'knowledge.protocol.offset')]
  }];
  assert.throws(() => normalizeDeclarativeAgronomicRule(missingDuration), /duration/);

  const zeroDuration = protocolRuleV2();
  zeroDuration.temporalConstraints = [{
    target: 'RULE_ACTION',
    relation: 'MIN_OFFSET_BEFORE_EVENT',
    eventSemanticId: 'operation.planting',
    duration: 'P0D',
    authorityBindings: [binding('ACTION_OFFSET', 'knowledge.protocol.offset')]
  }];
  assert.throws(() => normalizeDeclarativeAgronomicRule(zeroDuration), /non-zero ISO-8601 duration/);
});

test('v2 coordinator is distinct from notification recipients and cannot exist under NONE coordination', () => {
  const rule = protocolRuleV2();
  rule.coordination.mode = 'NONE';
  rule.coordination.participants = [];
  delete rule.coordination.channel;
  assert.throws(() => normalizeDeclarativeAgronomicRule(rule), /cannot carry a coordinator/);
});

test('consecutive trigger requires count and period', () => {
  const rule = protocolRule();
  delete rule.trigger.predicates[0].temporal.period;
  assert.throws(() => normalizeDeclarativeAgronomicRule(rule), /period/);
});

test('unknown declarative fields fail closed', () => {
  const rule = protocolRule();
  rule.trigger.predicates[0].silentInference = true;
  assert.throws(() => normalizeDeclarativeAgronomicRule(rule), /not part of/);
});

test('approval-required coordination cannot bypass the human gate', () => {
  const rule = protocolRule();
  rule.coordination = { mode: 'APPROVAL_REQUIRED', participants: ['AGRONOMIST'] };
  assert.throws(() => normalizeDeclarativeAgronomicRule(rule), /humanGate/);
});
