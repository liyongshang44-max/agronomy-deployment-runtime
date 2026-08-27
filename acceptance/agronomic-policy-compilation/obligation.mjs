import assert from 'node:assert/strict';

import {
  AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AgronomicPolicyObligationCompilationError,
  agronomicPolicyObligationHash,
  publishAgronomicPolicyObligationCompilation,
  validateAgronomicPolicyObligationCompilationAuthority
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
  assert.ok(caught instanceof AgronomicPolicyObligationCompilationError);
  assert.equal(caught.code, code);
}

const env = makeEnv();
env.sourceRegistry = new SourceRegistry({
  ledger: env.ledger,
  artifactStore: new ExactArtifactStore()
});
env.approver = createPrincipal({
  principalId: 'obligation-scientific-approver',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
env.approverRole = publishBuiltinRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.obligation.scientific-approver',
  version: '1',
  principal: env.approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'iam-admin' }, 'obligation-science-role')
});

const source = env.sourceRegistry.registerSource({
  logicalId: 'source.protocol.obligation.fixture',
  version: '1',
  sourceType: 'PROTOCOL',
  title: 'Agronomic obligation protocol fixture',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'obligation-source')
});
const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.protocol.obligation.fixture',
  version: '1',
  sourceRef: source.ref,
  bytes: Buffer.from('Perform the governed operation three times in 2015.', 'utf8'),
  mediaType: 'text/plain',
  materializationIdentity: 'obligation-authority-fixture',
  acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-27T10:00:00.000Z' },
  audit: audit({ type: 'USER', id: 'source-curator' }, 'obligation-artifact')
});

function qualified(label, assertion, useTarget = AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE) {
  return makeQualifiedKnowledge(env, {
    label: `obligation-${label}`,
    assertion,
    useTarget
  });
}

const knowledge = qualified(
  'require-three',
  'The governed operation is required three times in the stated fixed calendar year.'
).knowledge;

const policy = publish(env, 'Policy', 'policy.obligation.operation-control', '1', policySpec({
  contractVersion: 'adr.policy.v3',
  decisionType: 'OPERATION_CONTROL',
  actionSpace: ['REQUIRED_OPERATION', 'WAIT'],
  actionSemantics: policyActionSemantics(['REQUIRED_OPERATION', 'WAIT']),
  requiredInputs: [{
    semanticId: 'context.protocol_scope',
    valueType: 'BOOLEAN',
    unit: '1',
    epistemicClasses: ['CONFIGURATION']
  }],
  requiredRuntimeOutputs: [],
  decisionLogic: {
    methodId: 'obligation-operation-control-v1',
    definitionHash: `sha256:${'f'.repeat(64)}`
  },
  thresholdAuthority: { mode: 'SPEC_DEFINED', authorityRefs: [] },
  operationalConstraints: [],
  jurisdictionConstraints: [],
  humanGate: { mode: 'NONE' },
  fallback: { disposition: 'WAIT' },
  abstentionConditions: [],
  limitations: ['OBLIGATION_ACCEPTANCE_FIXTURE']
}));
const policyAuthority = validateSpecificationAuthority({
  ledger: env.ledger,
  specificationRef: policy.ref
});

function binding(role) {
  return {
    role,
    authorityRef: knowledge.ref,
    rationale: 'The source-qualified knowledge establishes the hard obligation, count, and counting period.'
  };
}

const obligation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_CONTRACT_VERSION,
  obligationId: 'required-operation-three-times-2015',
  decisionType: 'OPERATION_CONTROL',
  effect: 'REQUIRE',
  actionCode: 'REQUIRED_OPERATION',
  occurrence: {
    mode: 'EXACT_COUNT',
    exactCount: 3,
    period: {
      kind: 'FIXED_CALENDAR_YEAR',
      year: 2015,
      authorityBindings: [binding('COUNTING_PERIOD')]
    },
    authorityBindings: [binding('OCCURRENCE_CARDINALITY')]
  },
  authorityBindings: [binding('REQUIRED_ACTION')]
};
const obligationHash = agronomicPolicyObligationHash(obligation);

const approverPrincipal = {
  principalId: env.manager.principalId,
  type: env.manager.type,
  organizationId: env.manager.organizationId,
  tenantId: env.manager.tenantId
};

const baseCompilation = {
  contractVersion: AGRONOMIC_POLICY_OBLIGATION_COMPILATION_CONTRACT_VERSION,
  authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
  sourceProtocolRefs: [source.ref],
  sourceProtocolArtifactRefs: [artifact.ref],
  knowledgeRefs: [knowledge.ref],
  policyRef: policy.ref,
  obligation,
  obligationHash,
  transformationRationale: 'Preserve source-explicit hard action cardinality without inventing trigger, schedule, due-state, fallback, or execution truth.',
  losslessCoverage: {
    status: 'COMPLETE',
    coveredElements: ['ACTION', 'CARDINALITY', 'COUNTING_PERIOD', 'REQUIRE_MODALITY', 'SOURCE_ARTIFACT'],
    unrepresentedElements: []
  },
  approverPrincipal,
  approvalRef: policyAuthority.managementAuthorization.ref,
  limitations: ['OBLIGATION_AUTHORITY_NOT_EXECUTION_EVIDENCE']
};

const published = publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.operation-control',
  version: '1',
  compilation: baseCompilation,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-publication')
});
const validated = validateAgronomicPolicyObligationCompilationAuthority({
  ledger: env.ledger,
  compilationRef: published.ref
});

assert.equal(validated.record.ref.kind, 'AgronomicPolicyObligationCompilation');
assert.equal(validated.semanticPayload.obligation.effect, 'REQUIRE');
assert.equal(validated.semanticPayload.obligation.occurrence.exactCount, 3);
assert.equal(validated.semanticPayload.policyRef.kind, 'Policy');

const incomplete = structuredClone(baseCompilation);
incomplete.losslessCoverage = {
  status: 'INCOMPLETE',
  coveredElements: ['CARDINALITY', 'COUNTING_PERIOD'],
  unrepresentedElements: ['NORMATIVE_MODALITY_AS_NEEDED']
};
expectError(() => publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.incomplete',
  version: '1',
  compilation: incomplete,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-incomplete')
}), 'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_NOT_PUBLISHABLE');

const missingKnowledge = structuredClone(baseCompilation);
missingKnowledge.knowledgeRefs = [];
expectError(() => publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.missing-knowledge',
  version: '1',
  compilation: missingKnowledge,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-missing-knowledge')
}), 'INVALID_AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_REF');

const actionMismatch = structuredClone(baseCompilation);
actionMismatch.obligation.actionCode = 'ACTION_NOT_IN_POLICY';
actionMismatch.obligationHash = agronomicPolicyObligationHash(actionMismatch.obligation);
expectError(() => publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.action-mismatch',
  version: '1',
  compilation: actionMismatch,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-action-mismatch')
}), 'AGRONOMIC_POLICY_OBLIGATION_ACTION_NOT_IN_POLICY');

const undeclared = structuredClone(baseCompilation);
const extraKnowledge = qualified(
  'extra',
  'A separate obligation authority predecessor exists for testing closure.'
).knowledge;
undeclared.obligation.occurrence.period.authorityBindings[0].authorityRef = extraKnowledge.ref;
undeclared.obligationHash = agronomicPolicyObligationHash(undeclared.obligation);
expectError(() => publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.undeclared',
  version: '1',
  compilation: undeclared,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-undeclared')
}), 'AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_NOT_DECLARED');

const wrongUse = qualified(
  'wrong-use',
  'This scientific knowledge is deliberately qualified for another use.',
  { use: 'OTHER_SCIENTIFIC_USE' }
).knowledge;
const wrongUseCompilation = structuredClone(baseCompilation);
wrongUseCompilation.knowledgeRefs.push(wrongUse.ref);
expectError(() => publishAgronomicPolicyObligationCompilation({
  ledger: env.ledger,
  logicalId: 'obligation-compilation.fixture.wrong-use',
  version: '1',
  compilation: wrongUseCompilation,
  audit: audit({ type: approverPrincipal.type, id: approverPrincipal.principalId }, 'obligation-wrong-use')
}), 'AGRONOMIC_POLICY_OBLIGATION_KNOWLEDGE_AUTHORITY_INVALID');

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicPolicyObligationCompilation',
  validObligation: validated.record.ref,
  requiredKnowledgeUse: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'MISSING_KNOWLEDGE',
    'ACTION_NOT_IN_POLICY',
    'AUTHORITY_NOT_DECLARED',
    'KNOWLEDGE_WRONG_USE'
  ]
}, null, 2));
