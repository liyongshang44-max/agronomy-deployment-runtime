import assert from 'node:assert/strict';

import {
  AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicPolicyConstraintCompilationError,
  agronomicPolicyConstraintHash,
  publishAgronomicPolicyConstraintCompilation,
  validateAgronomicPolicyConstraintCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import { createPrincipal, publishBuiltinRoleAssignment } from '../../packages/authorization/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { validateSpecificationAuthority } from '../../packages/specification-registry/src/index.mjs';
import { makeQualifiedKnowledge } from '../derived-knowledge/fixture.mjs';
import {
  audit,
  makeEnv,
  policyActionSemantics,
  policySpec,
  publish
} from '../specification/fixture.mjs';

function expectError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof AgronomicPolicyConstraintCompilationError);
  assert.equal(caught.code, code);
}

function boolPort(semanticId) {
  return {
    semanticId,
    valueType: 'BOOLEAN',
    unit: '1',
    epistemicClasses: ['CONFIGURATION']
  };
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});
env.approver = createPrincipal({
  principalId: 'constraint-scientific-approver',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
env.approverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.constraint.scientific-approver',
  version: '1',
  principal: env.approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'constraint-science-role')
});

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.constraint.fixture',
  version: '1',
  sourceType: 'PROTOCOL',
  title: 'Agronomic prohibition protocol fixture',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'constraint-source')
});
const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.constraint.fixture',
  version: '1',
  sourceRef: source.ref,
  bytes: Buffer.from(
    'Do not perform the sensitive operation in the governed context except in the explicitly exempt area.',
    'utf8'
  ),
  mediaType: 'text/plain',
  materializationIdentity: 'constraint-authority-fixture',
  acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-27T03:30:00.000Z' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'constraint-artifact')
});

function qualified(label, assertion, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, {
    label: `constraint-${label}`,
    assertion,
    useTarget
  });
}

const prohibitionKnowledge = qualified(
  'prohibition',
  'The sensitive operation is prohibited in the governed context.'
).knowledge;
const conditionKnowledge = qualified(
  'condition',
  'The prohibition applies when the governed context flag is true.'
).knowledge;
const exceptionKnowledge = qualified(
  'exception',
  'The explicitly exempt area releases the prohibition.'
).knowledge;

const policy = publish(env, 'Policy', 'policy.constraint.operation-control', '1', policySpec({
  decisionType: 'OPERATION_CONTROL',
  actionSpace: ['SENSITIVE_OPERATION', 'WAIT'],
  actionSemantics: policyActionSemantics(['SENSITIVE_OPERATION', 'WAIT']),
  requiredInputs: [
    boolPort('context.prohibition_applies'),
    boolPort('context.exempt_area')
  ],
  requiredRuntimeOutputs: [],
  decisionLogic: {
    methodId: 'operation-control-policy-v1',
    definitionHash: `sha256:${'f'.repeat(64)}`
  },
  thresholdAuthority: { mode: 'SPEC_DEFINED', authorityRefs: [] },
  operationalConstraints: [],
  jurisdictionConstraints: [],
  humanGate: { mode: 'NONE' },
  fallback: { disposition: 'WAIT' },
  abstentionConditions: [],
  limitations: ['CONSTRAINT_ACCEPTANCE_FIXTURE']
}));
const policyAuthority = validateSpecificationAuthority({
  ledger: env.ledger,
  specificationRef: policy.ref
});

const constraint = {
  contractVersion: AGRONOMIC_POLICY_CONSTRAINT_CONTRACT_VERSION,
  constraintId: 'prohibit-sensitive-operation',
  decisionType: 'OPERATION_CONTROL',
  effect: 'PROHIBIT',
  actionCode: 'SENSITIVE_OPERATION',
  when: {
    logic: 'ALL',
    predicates: [{
      semanticId: 'context.prohibition_applies',
      comparator: 'EQ',
      value: { type: 'BOOLEAN', boolean: true },
      authorityBindings: [{
        role: 'PROHIBITION_CONDITION',
        authorityRef: conditionKnowledge.ref,
        rationale: 'The governed source qualifies when the prohibition applies.'
      }]
    }]
  },
  exceptions: [{
    logic: 'ALL',
    predicates: [{
      semanticId: 'context.exempt_area',
      comparator: 'EQ',
      value: { type: 'BOOLEAN', boolean: true },
      authorityBindings: [{
        role: 'PROHIBITION_EXCEPTION',
        authorityRef: exceptionKnowledge.ref,
        rationale: 'The governed source explicitly preserves an exempt area.'
      }]
    }]
  }],
  authorityBindings: [{
    role: 'PROHIBITED_ACTION',
    authorityRef: prohibitionKnowledge.ref,
    rationale: 'The governed source explicitly prohibits the action.'
  }]
};
const constraintHash = agronomicPolicyConstraintHash(constraint);

const approverPrincipal = {
  principalId: env.manager.principalId,
  type: env.manager.type,
  organizationId: env.manager.organizationId,
  tenantId: env.manager.tenantId
};

const baseCompilation = {
  contractVersion: AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_CONTRACT_VERSION,
  authorityClass: 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
  sourceProtocolRefs: [source.ref],
  sourceProtocolArtifactRefs: [artifact.ref],
  knowledgeRefs: [
    prohibitionKnowledge.ref,
    conditionKnowledge.ref,
    exceptionKnowledge.ref
  ],
  policyRef: policy.ref,
  constraint,
  constraintHash,
  transformationRationale: 'Preserve source-explicit negative authority as a first-class Policy constraint with condition and exception semantics.',
  losslessCoverage: {
    status: 'COMPLETE',
    coveredElements: ['ACTION_TARGET', 'CONDITION', 'EXCEPTION', 'PROHIBITION', 'SOURCE_ARTIFACT'],
    unrepresentedElements: []
  },
  approverPrincipal,
  approvalRef: policyAuthority.managementAuthorization.ref,
  limitations: ['PLANNING_AUTHORITY_NOT_EXECUTION_EVIDENCE']
};

const published = publishAgronomicPolicyConstraintCompilation({
  ledger: env.ledger,
  logicalId: 'constraint-compilation.fixture.operation-control',
  version: '1',
  compilation: baseCompilation,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'constraint-publication')
});
const validated = validateAgronomicPolicyConstraintCompilationAuthority({
  ledger: env.ledger,
  compilationRef: published.ref
});

assert.equal(validated.record.ref.kind, 'AgronomicPolicyConstraintCompilation');
assert.equal(validated.semanticPayload.constraint.effect, 'PROHIBIT');
assert.equal(validated.semanticPayload.constraint.actionCode, 'SENSITIVE_OPERATION');
assert.equal(validated.semanticPayload.losslessCoverage.status, 'COMPLETE');

const missingKnowledge = structuredClone(baseCompilation);
missingKnowledge.knowledgeRefs = missingKnowledge.knowledgeRefs
  .filter((ref) => ref.semanticHash !== exceptionKnowledge.ref.semanticHash);
expectError(() => publishAgronomicPolicyConstraintCompilation({
  ledger: env.ledger,
  logicalId: 'constraint-compilation.fixture.missing-knowledge',
  version: '1',
  compilation: missingKnowledge,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'constraint-missing-knowledge')
}), 'AGRONOMIC_POLICY_CONSTRAINT_AUTHORITY_NOT_DECLARED');

const actionMismatch = structuredClone(baseCompilation);
actionMismatch.constraint.actionCode = 'ACTION_NOT_IN_POLICY';
actionMismatch.constraintHash = agronomicPolicyConstraintHash(actionMismatch.constraint);
expectError(() => publishAgronomicPolicyConstraintCompilation({
  ledger: env.ledger,
  logicalId: 'constraint-compilation.fixture.action-mismatch',
  version: '1',
  compilation: actionMismatch,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'constraint-action-mismatch')
}), 'AGRONOMIC_POLICY_CONSTRAINT_ACTION_NOT_IN_POLICY');

const semanticGap = structuredClone(baseCompilation);
semanticGap.constraint.when.predicates[0].semanticId = 'context.undeclared';
semanticGap.constraintHash = agronomicPolicyConstraintHash(semanticGap.constraint);
expectError(() => publishAgronomicPolicyConstraintCompilation({
  ledger: env.ledger,
  logicalId: 'constraint-compilation.fixture.semantic-gap',
  version: '1',
  compilation: semanticGap,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'constraint-semantic-gap')
}), 'AGRONOMIC_POLICY_CONSTRAINT_POLICY_SEMANTIC_GAP');

const wrongUse = qualified(
  'wrong-use',
  'This knowledge is real but deliberately qualified for a different scientific use.',
  { use: 'OTHER_SCIENTIFIC_USE' }
).knowledge;
const wrongUseCompilation = structuredClone(baseCompilation);
wrongUseCompilation.knowledgeRefs.push(wrongUse.ref);
expectError(() => publishAgronomicPolicyConstraintCompilation({
  ledger: env.ledger,
  logicalId: 'constraint-compilation.fixture.wrong-use',
  version: '1',
  compilation: wrongUseCompilation,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'constraint-wrong-use')
}), 'AGRONOMIC_POLICY_CONSTRAINT_KNOWLEDGE_AUTHORITY_INVALID');

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicPolicyConstraintCompilation',
  validConstraint: validated.record.ref,
  negativeCases: [
    'AUTHORITY_NOT_DECLARED',
    'ACTION_NOT_IN_POLICY',
    'POLICY_SEMANTIC_GAP',
    'KNOWLEDGE_WRONG_USE'
  ]
}, null, 2));
