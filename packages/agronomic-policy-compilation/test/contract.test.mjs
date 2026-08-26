import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RULE_CONTRACT_VERSION,
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
    inputs: ['plant_available_water_mm', 'rainfall_mm'],
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
    fallback: { disposition: 'WAIT' },
    humanGate: { required: true },
    limitations: ['SITE_AND_PROTOCOL_SPECIFIC']
  };
}

test('public module loads contract and authority entry points', () => {
  assert.equal(typeof publishAgronomicPolicyCompilation, 'function');
  assert.equal(typeof validateAgronomicPolicyCompilationAuthority, 'function');
});

test('real irrigation protocol semantics are representable without dropping trigger, persistence, exception, action timing or amount', () => {
  const normalized = normalizeDeclarativeAgronomicRule(protocolRule());
  assert.equal(normalized.trigger.predicates[0].temporal.mode, 'CONSECUTIVE');
  assert.equal(normalized.trigger.predicates[0].temporal.count, 2);
  assert.equal(normalized.exceptions.length, 1);
  assert.equal(normalized.action.timing.offset, 'P1D');
  assert.equal(normalized.action.parameters.irrigation_depth_mm.type, 'ABS');
  assert.match(declarativeAgronomicRuleHash(normalized), /^sha256:[0-9a-f]{64}$/);
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
