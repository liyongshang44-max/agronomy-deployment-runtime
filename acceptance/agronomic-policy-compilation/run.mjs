import assert from 'node:assert/strict';

import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import {
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicPolicyCompilationError,
  agronomicModelDefinitionHash,
  declarativeAgronomicRuleHash,
  publishAgronomicPolicyCompilation,
  validateAgronomicPolicyCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import { createPrincipal, publishBuiltinRoleAssignment } from '../../packages/authorization/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { validateSpecificationAuthority } from '../../packages/specification-registry/src/index.mjs';
import { makeQualifiedKnowledge } from '../derived-knowledge/fixture.mjs';
import {
  audit,
  makeEnv,
  manager,
  modelSpec,
  policySpec,
  publish
} from '../specification/fixture.mjs';

function expectCompilationError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof AgronomicPolicyCompilationError, `expected AgronomicPolicyCompilationError, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function port(semanticId, epistemicClasses, unit = 'mm') {
  return { semanticId, valueType: 'DECIMAL', unit, epistemicClasses };
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({ ledger: env.ledger, artifactStore: new ExactArtifactStore() });
env.approver = createPrincipal({
  principalId: 'agronomic-policy-scientific-approver',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
env.approverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.agronomic-policy.scientific-approver',
  version: '1',
  principal: env.approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'agronomic-policy-science-role')
});

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.irrigation.fixture',
  version: '1',
  sourceType: 'PROTOCOL',
  title: 'Agronomic irrigation protocol fixture',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'source-fixture')
});
const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.irrigation.fixture',
  version: '1',
  sourceRef: source.ref,
  bytes: Buffer.from([
    'Daily rainfall and irrigation are water-budget credits and ETmax is a debit.',
    'When plant-available water is negative for two consecutive daily evaluations, schedule irrigation the next day.',
    'A restorative rainfall event cancels the pending irrigation schedule.',
    'Irrigation amount is based on the prior-day plant-available-water deficit.',
    'Notify designated staff of the irrigation schedule.'
  ].join(' '), 'utf8'),
  mediaType: 'text/plain',
  materializationIdentity: 'agronomic-protocol-authority-fixture',
  acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-26T12:00:00.000Z' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'artifact-fixture')
});

function qualified(label, assertion, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, {
    label: `agronomic-policy-${label}`,
    assertion,
    useTarget
  });
}

const triggerBundle = qualified(
  'trigger',
  'Negative plant-available water persisting for two consecutive daily evaluations triggers irrigation scheduling.'
);
const exceptionBundle = qualified(
  'rainfall-override',
  'A restorative rainfall event cancels the irrigation trigger when net plant-available water becomes positive.'
);
const amountBundle = qualified(
  'amount',
  'Irrigation amount is based on the prior-day plant-available-water deficit.'
);
const coordinationBundle = qualified(
  'coordination',
  'The irrigation schedule is communicated to designated staff by email.'
);
const balanceBundle = qualified(
  'balance',
  'Rainfall and irrigation are water-budget credits and evapotranspiration is a debit.'
);

const triggerKnowledge = triggerBundle.knowledge;
const exceptionKnowledge = exceptionBundle.knowledge;
const amountKnowledge = amountBundle.knowledge;
const coordinationKnowledge = coordinationBundle.knowledge;
const balanceKnowledge = balanceBundle.knowledge;

const modelDefinition = {
  type: 'DAILY_WATER_BALANCE',
  credits: ['rainfall_mm', 'irrigation_mm'],
  debits: ['etmax_mm'],
  output: 'plant_available_water_mm',
  negativeMeaning: 'WATER_NOT_AVAILABLE_FOR_PLANT_UPTAKE'
};
const modelDefinitionHash = agronomicModelDefinitionHash(modelDefinition);

const model = publish(env, 'Model', 'model-protocol-water-balance', '1', modelSpec({
  purpose: 'DAILY_PLANT_AVAILABLE_WATER_BUDGET',
  inputs: [
    port('rainfall_mm', ['OBSERVATION']),
    port('irrigation_mm', ['OBSERVATION']),
    port('etmax_mm', ['MODEL_PRIOR'])
  ],
  outputs: [
    port('plant_available_water_mm', ['STATE_ESTIMATE']),
    port('net_plant_available_water_mm', ['STATE_ESTIMATE']),
    port('previous_day_plant_available_water_deficit_mm', ['STATE_ESTIMATE'])
  ],
  evidenceStateRequirements: ['rainfall_mm', 'irrigation_mm', 'etmax_mm'],
  parameterSlots: [],
  calibrationRequirements: [],
  measurementConventions: ['DAILY_WATER_BALANCE'],
  applicabilityDomain: { requiredSemanticIds: ['rainfall_mm', 'irrigation_mm', 'etmax_mm'] },
  limitations: ['SOURCE_PROTOCOL_SPECIFIC'],
  computation: {
    methodId: 'daily-plant-available-water-budget-v1',
    definitionHash: modelDefinitionHash
  }
}));

const rule = {
  contractVersion: 'adr.declarative-agronomic-rule.v1',
  ruleId: 'irrigation-negative-paw-two-day-v1',
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
        authorityRef: triggerKnowledge.ref,
        rationale: 'Two consecutive negative daily values are an explicit protocol trigger.'
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
        role: 'RESTORATIVE_RAINFALL_OVERRIDE',
        authorityRef: exceptionKnowledge.ref,
        rationale: 'A restorative rainfall event overrides the pending irrigation schedule.'
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
          authorityRef: amountKnowledge.ref,
          rationale: 'Amount is derived from the prior-day deficit.'
        }]
      }
    },
    authorityBindings: []
  },
  coordination: {
    mode: 'NOTIFY',
    channel: 'EMAIL',
    participants: ['DESIGNATED_RESEARCHER', 'FIELD_STAFF'],
    authorityBindings: [{
      role: 'OPERATION_COORDINATION',
      authorityRef: coordinationKnowledge.ref,
      rationale: 'The source protocol requires schedule communication by email.'
    }]
  },
  fallback: { disposition: 'WAIT' },
  humanGate: { required: false },
  limitations: ['SOURCE_PROTOCOL_SPECIFIC', 'FALLBACK_IS_ADR_GOVERNANCE_NOT_SOURCE_ASSERTION']
};
const ruleHash = declarativeAgronomicRuleHash(rule);

const actionSemantics = {
  equivalenceMode: 'EXACT_MATERIAL_PARAMETERS',
  actions: [
    {
      actionCode: 'IRRIGATE',
      parameters: [{
        name: 'irrigation_depth_mm',
        semanticId: 'action.irrigation.amount',
        valueType: 'DECIMAL',
        unit: 'mm',
        required: true,
        material: true
      }]
    },
    { actionCode: 'WAIT', parameters: [] }
  ]
};

const policy = publish(env, 'Policy', 'policy-protocol-irrigation', '1', policySpec({
  decisionType: 'IRRIGATION_SCHEDULING',
  actionSpace: ['IRRIGATE', 'WAIT'],
  actionSemantics,
  requiredInputs: [port('rainfall_mm', ['OBSERVATION'])],
  requiredRuntimeOutputs: [
    port('plant_available_water_mm', ['STATE_ESTIMATE']),
    port('net_plant_available_water_mm', ['STATE_ESTIMATE']),
    port('previous_day_plant_available_water_deficit_mm', ['STATE_ESTIMATE'])
  ],
  decisionLogic: { methodId: rule.ruleId, definitionHash: ruleHash },
  thresholdAuthority: {
    mode: 'EXTERNAL_AUTHORITY',
    authorityRefs: [triggerKnowledge.ref, exceptionKnowledge.ref, amountKnowledge.ref]
  },
  operationalConstraints: [],
  jurisdictionConstraints: [],
  humanGate: { mode: 'NONE' },
  fallback: { disposition: 'WAIT' },
  abstentionConditions: [],
  limitations: ['SOURCE_PROTOCOL_SPECIFIC']
}));

const policyAuthority = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: policy.ref });
const compilationApprover = {
  principalId: manager.principalId,
  type: manager.type,
  organizationId: manager.organizationId,
  tenantId: manager.tenantId
};

const compilationInput = {
  contractVersion: 'adr.agronomic-policy-compilation.v1',
  authorityClass: 'AGRONOMIC_POLICY_COMPILATION_AUTHORITY',
  sourceProtocolRefs: [source.ref],
  sourceProtocolArtifactRefs: [artifact.ref],
  knowledgeRefs: [
    triggerKnowledge.ref,
    exceptionKnowledge.ref,
    amountKnowledge.ref,
    coordinationKnowledge.ref,
    balanceKnowledge.ref
  ],
  modelRefs: [model.ref],
  modelDefinitions: [{
    modelRef: model.ref,
    semanticRole: 'PLANT_AVAILABLE_WATER_STATE',
    methodId: 'daily-plant-available-water-budget-v1',
    inputSemanticIds: ['rainfall_mm', 'irrigation_mm', 'etmax_mm'],
    outputSemanticIds: [
      'plant_available_water_mm',
      'net_plant_available_water_mm',
      'previous_day_plant_available_water_deficit_mm'
    ],
    definition: modelDefinition,
    definitionHash: modelDefinitionHash,
    authorityBindings: [{
      role: 'WATER_BALANCE_RELATIONSHIP',
      authorityRef: balanceKnowledge.ref,
      rationale: 'The model definition makes the protocol water-budget credit/debit relation inspectable.'
    }]
  }],
  policyRef: policy.ref,
  rule,
  ruleHash,
  transformationRationale: 'Source-faithful operational elements are separated into governed Model and Policy semantics; ADR fallback is explicitly marked as governance rather than source assertion.',
  losslessCoverage: {
    status: 'COMPLETE',
    coveredElements: [
      'ACTION',
      'ACTION_AMOUNT',
      'ACTION_TIMING',
      'COORDINATION',
      'EVALUATION_CADENCE',
      'EXCEPTION',
      'MODEL_CALCULATION',
      'PERSISTENCE',
      'SOURCE_ARTIFACT',
      'TRIGGER'
    ],
    unrepresentedElements: []
  },
  approverPrincipal: compilationApprover,
  approvalRef: policyAuthority.managementAuthorization.ref,
  limitations: ['PROTOCOL_PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE']
};

const compilation = publishAgronomicPolicyCompilation({
  ledger: env.ledger,
  logicalId: 'compilation.protocol.irrigation',
  version: '1',
  compilation: compilationInput,
  audit: audit({ type: compilationApprover.type, id: compilationApprover.principalId }, 'agronomic-compilation')
});

const validated = validateAgronomicPolicyCompilationAuthority({
  ledger: env.ledger,
  compilationRef: compilation.ref
});

assert.equal(validated.record.ref.kind, 'AgronomicPolicyCompilation');
assert.equal(validated.semanticPayload.losslessCoverage.status, 'COMPLETE');
assert.equal(validated.semanticPayload.sourceProtocolArtifactRefs.length, 1);
assert.deepEqual(validated.semanticPayload.sourceProtocolArtifactRefs[0], artifact.ref);
assert.equal(validated.semanticPayload.rule.evaluationCadence, 'P1D');
assert.equal(validated.semanticPayload.rule.coordination.mode, 'NOTIFY');
assert.equal(validated.semanticPayload.rule.trigger.predicates[0].temporal.count, 2);
assert.equal(validated.semanticPayload.rule.action.timing.offset, 'P1D');
assert.equal(validated.semanticPayload.modelDefinitions[0].definitionHash, modelDefinitionHash);
assert.equal(validated.semanticPayload.ruleHash, semanticHash('DeclarativeAgronomicRule', validated.semanticPayload.rule));

const forgedKnowledge = env.ledger.publish({
  kind: 'QualifiedKnowledge',
  logicalId: 'knowledge.zzz-forged-policy-input',
  version: '1',
  semanticPayload: {
    authorityClass: 'SCIENTIFIC_USE_AUTHORITY',
    assertion: 'This record has the right kind tag but no source-faithful or qualification authority chain.',
    allowedUses: [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]
  },
  audit: audit({ type: 'USER', id: 'forger' }, 'forged-knowledge')
});
const forgedInput = structuredClone(compilationInput);
forgedInput.knowledgeRefs = [...forgedInput.knowledgeRefs, forgedKnowledge.ref];
expectCompilationError(() => publishAgronomicPolicyCompilation({
  ledger: env.ledger,
  logicalId: 'compilation.protocol.irrigation.forged-knowledge',
  version: '1',
  compilation: forgedInput,
  audit: audit({ type: compilationApprover.type, id: compilationApprover.principalId }, 'agronomic-compilation-forged')
}), 'AGRONOMIC_POLICY_COMPILATION_KNOWLEDGE_AUTHORITY_INVALID');

const wrongUseKnowledge = qualified(
  'wrong-use',
  'This real QualifiedKnowledge is deliberately qualified for a different scientific use.',
  { use: 'OTHER_SCIENTIFIC_USE' }
).knowledge;
const wrongUseInput = structuredClone(compilationInput);
wrongUseInput.knowledgeRefs = [...wrongUseInput.knowledgeRefs, wrongUseKnowledge.ref];
expectCompilationError(() => publishAgronomicPolicyCompilation({
  ledger: env.ledger,
  logicalId: 'compilation.protocol.irrigation.wrong-use',
  version: '1',
  compilation: wrongUseInput,
  audit: audit({ type: compilationApprover.type, id: compilationApprover.principalId }, 'agronomic-compilation-wrong-use')
}), 'AGRONOMIC_POLICY_COMPILATION_KNOWLEDGE_AUTHORITY_INVALID');

console.log(JSON.stringify({
  ok: true,
  compilationRef: compilation.ref,
  sourceProtocolArtifactRef: artifact.ref,
  requiredKnowledgeUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  knowledgeAuthorityCount: compilationInput.knowledgeRefs.length,
  forgedKindTagDenied: true,
  wrongScientificUseDenied: true,
  ruleHash,
  modelDefinitionHash,
  losslessCoverage: validated.semanticPayload.losslessCoverage,
  coordination: validated.semanticPayload.rule.coordination,
  persistence: validated.semanticPayload.rule.trigger.predicates[0].temporal
}, null, 2));
