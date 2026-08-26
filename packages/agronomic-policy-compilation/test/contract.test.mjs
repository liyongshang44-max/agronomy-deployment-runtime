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
  rule.evaluationStart = {
    date: '2015-05-01',
    authorityBindings: [{
      role: 'EVALUATION_START_DATE',
      authorityRef: knowledgeRef('knowledge.protocol.evaluation-start'),
      rationale: 'The 2015 protocol starts daily rainfall and irrigation recording on May 1.'
    }]
  };
  rule.coordination = {
    mode: 'NOTIFY',
    channel: 'EMAIL',
    participants: ['KEY_INVESTIGATORS', 'LTER_STAFF'],
    coordinator: {
      sourceLabel: 'Joe Simmons',
      authorityBindings: [{
        role: 'COMMUNICATION_COORDINATOR',
        authorityRef: knowledgeRef('knowledge.protocol.coordinator'),
        rationale: 'The source explicitly names Joe Simmons as coordinator.'
      }]
    },
    authorityBindings: []
  };
  return rule;
}

test('public module loads contract and authority entry points', () => {
  assert.equal(typeof publishAgronomicPolicyCompilation, 'function');
  assert.equal(typeof validateAgronomicPolicyCompilationAuthority, 'function');
});

test('v1 real irrigation protocol semantics remain representable without dropping cadence, trigger, persistence, exception, action timing or amount', () => {
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

test('v2 adds source-bound evaluation start and named coordination coordinator without changing v1 semantics', () => {
  const normalized = normalizeDeclarativeAgronomicRule(protocolRuleV2());
  assert.equal(normalized.contractVersion, AGRONOMIC_RULE_CONTRACT_VERSION_V2);
  assert.equal(normalized.evaluationCadence, 'P1D');
  assert.equal(normalized.evaluationStart.date, '2015-05-01');
  assert.equal(normalized.evaluationStart.authorityBindings[0].role, 'EVALUATION_START_DATE');
  assert.equal(normalized.coordination.mode, 'NOTIFY');
  assert.equal(normalized.coordination.coordinator.sourceLabel, 'Joe Simmons');
  assert.equal(normalized.coordination.coordinator.authorityBindings[0].role, 'COMMUNICATION_COORDINATOR');
  assert.match(declarativeAgronomicRuleHash(normalized), /^sha256:[0-9a-f]{64}$/);
});

test('v1 fails closed when v2-only temporal or coordinator fields are supplied', () => {
  const temporal = protocolRule();
  temporal.evaluationStart = { date: '2015-05-01', authorityBindings: [] };
  assert.throws(() => normalizeDeclarativeAgronomicRule(temporal), /not part of/);

  const coordinator = protocolRule();
  coordinator.coordination = {
    mode: 'NOTIFY',
    participants: ['LTER_STAFF'],
    coordinator: { sourceLabel: 'Joe Simmons', authorityBindings: [] }
  };
  assert.throws(() => normalizeDeclarativeAgronomicRule(coordinator), /not part of/);
});

test('v2 evaluation start requires a valid calendar date and source authority binding', () => {
  const invalidDate = protocolRuleV2();
  invalidDate.evaluationStart.date = '2015-02-30';
  assert.throws(() => normalizeDeclarativeAgronomicRule(invalidDate), /evaluationStart.date/);

  const missingAuthority = protocolRuleV2();
  missingAuthority.evaluationStart.authorityBindings = [];
  assert.throws(() => normalizeDeclarativeAgronomicRule(missingAuthority), /non-empty/);
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
