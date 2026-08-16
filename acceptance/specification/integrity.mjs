import assert from 'node:assert/strict';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import {
  normalizeQualifiedTransformation,
  normalizeModel,
  normalizePolicy,
  publishModel,
  validateSpecificationAuthority
} from '../../packages/specification-registry/src/index.mjs';
import {
  audit,
  authorize,
  controlScope,
  makeEnv,
  manager,
  modelSpec,
  policySpec,
  publish,
  transformationSpec
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('specification contracts reject endpoint and mutable implementation availability fields', () => {
  assert.throws(() => normalizeModel({ ...modelSpec(), endpoint: 'https://executor.invalid' }), (error) => error?.code === 'INVALID_SPECIFICATION_FIELD');
  assert.throws(() => normalizeModel({ ...modelSpec(), availableImplementations: ['impl-a'] }), (error) => error?.code === 'INVALID_SPECIFICATION_FIELD');
  assert.throws(() => normalizePolicy({ ...policySpec(), implementationRefs: [] }), (error) => error?.code === 'INVALID_SPECIFICATION_FIELD');
});

test('Model output can never be laundered into OBSERVATION epistemic authority', () => {
  assert.throws(
    () => normalizeModel(modelSpec({ outputs: [{ semanticId: 'soil.root_zone_water_storage', valueType: 'DECIMAL', unit: 'mm', epistemicClasses: ['OBSERVATION'] }] })),
    (error) => error?.code === 'MODEL_OUTPUT_EPISTEMIC_INVALID'
  );
});

test('QualifiedTransformation cannot silently upgrade epistemic class', () => {
  assert.throws(
    () => normalizeQualifiedTransformation(transformationSpec({
      outputContract: { semanticId: 'soil.volumetric_water_content_percent', valueType: 'DECIMAL', unit: 'percent', epistemicClasses: ['STATE_ESTIMATE'] }
    })),
    (error) => error?.code === 'TRANSFORMATION_EPISTEMIC_UPGRADE_FORBIDDEN'
  );
});

test('unknown semantic value type and epistemic vocabulary fail closed', () => {
  assert.throws(
    () => normalizeModel(modelSpec({ inputs: [{ semanticId: 'x', valueType: 'FLOAT', unit: '1', epistemicClasses: ['OBSERVATION'] }] })),
    (error) => error?.code === 'INVALID_SPECIFICATION_VALUE_TYPE'
  );
  assert.throws(
    () => normalizeModel(modelSpec({ inputs: [{ semanticId: 'x', valueType: 'DECIMAL', unit: '1', epistemicClasses: ['TRUST_ME'] }] })),
    (error) => error?.code === 'INVALID_SPECIFICATION_ENUM'
  );
});

test('duplicate semantic ports and parameter slots are rejected rather than silently deduplicated', () => {
  const input = modelSpec().inputs[0];
  assert.throws(() => normalizeModel(modelSpec({ inputs: [input, input] })), (error) => error?.code === 'DUPLICATE_SPECIFICATION_PORT');
  const slot = modelSpec().parameterSlots[0];
  assert.throws(() => normalizeModel(modelSpec({ parameterSlots: [slot, slot], calibrationRequirements: [] })), (error) => error?.code === 'DUPLICATE_PARAMETER_SLOT');
});

test('Policy cannot hide KnowledgeRelease or recommendation-result authority fields', () => {
  for (const [key, value] of [['knowledgeReleaseRef', { kind: 'KnowledgeRelease' }], ['decisionResultRef', { kind: 'DecisionResult' }], ['selectedAction', 'IRRIGATE_NOW']]) {
    assert.throws(() => normalizePolicy({ ...policySpec(), [key]: value }), (error) => error?.code === 'INVALID_SPECIFICATION_FIELD', key);
  }
});

test('wrong permission cannot publish a Model even with copied authorization vocabulary', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.wrong-spec',
    version: '1',
    principal: manager,
    role: 'NOT_SPEC_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.RUNTIME_PROFILE_MANAGE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  const decision = authorizeSpecificationManage({
    principal: manager,
    roleAssignments: [assignment],
    authorizationScope: { ...controlScope(), resourceType: 'MODEL', resourceId: 'model-wrong-permission' }
  });
  assert.equal(decision.allowed, false);
  const auth = recordAuthorizationDecision({ ledger, decision, audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth') });
  assert.throws(
    () => publishModel({
      ledger,
      logicalId: 'model-wrong-permission',
      version: '1',
      specification: modelSpec(),
      principal: manager,
      authorizationDecisionAuditRef: auth.ref,
      audit: audit({ type: manager.type, id: manager.principalId }, 'publish')
    }),
    (error) => error?.code === 'SPECIFICATION_AUTHORIZATION_MISMATCH'
  );
});

test('authorization for another specification id or resource type cannot be replayed', () => {
  const env = makeEnv();
  const { authorizationRecord } = authorize(env, 'Model', 'model-a');
  assert.throws(
    () => publishModel({
      ledger: env.ledger,
      logicalId: 'model-b',
      version: '1',
      specification: modelSpec(),
      principal: env.manager,
      authorizationDecisionAuditRef: authorizationRecord.ref,
      audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish')
    }),
    (error) => error?.code === 'SPECIFICATION_AUTHORIZATION_MISMATCH'
  );
});

test('foreign-tenant manager cannot publish local specification authority', () => {
  const foreign = createPrincipal({ principalId: 'foreign-spec-manager', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-b' });
  const env = makeEnv({ principal: foreign, roleScope: { organizationId: 'org-a', tenantId: 'tenant-b' } });
  const localSpec = modelSpec();
  const decision = authorizeSpecificationManage({
    principal: foreign,
    roleAssignments: [env.assignment],
    authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-b', resourceType: 'MODEL', resourceId: 'model-foreign' }
  });
  const auth = recordAuthorizationDecision({ ledger: env.ledger, decision, audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth') });
  assert.throws(
    () => publishModel({ ledger: env.ledger, logicalId: 'model-foreign', version: '1', specification: localSpec, principal: foreign, authorizationDecisionAuditRef: auth.ref, audit: audit({ type: foreign.type, id: foreign.principalId }, 'publish') }),
    (error) => error?.code === 'SPECIFICATION_CONTROL_SCOPE_DENIED'
  );
});

test('generic-ledger forged Model with copied semantic shape is not valid specification authority', () => {
  const env = makeEnv();
  const forged = env.ledger.publish({
    kind: 'Model',
    logicalId: 'model-forged',
    version: '1',
    semanticPayload: normalizeModel(modelSpec()),
    audit: audit({ type: 'USER', id: 'attacker' }, 'forged')
  });
  assert.throws(
    () => validateSpecificationAuthority({ ledger: env.ledger, specificationRef: forged.ref }),
    (error) => error?.code === 'SPECIFICATION_AUTHORIZATION_REQUIRED'
  );
});

test('hidden extra AuthorizationDecision audit input invalidates specification authority replay', () => {
  const env = makeEnv();
  const decision = authorizeSpecificationManage({
    principal: env.manager,
    roleAssignments: [env.assignment],
    authorizationScope: { ...controlScope(), resourceType: 'MODEL', resourceId: 'model-hidden-auth' }
  });
  const unrelated = env.ledger.publish({ kind: 'UnrelatedAuthority', logicalId: 'unrelated', version: '1', semanticPayload: { code: 'x' }, audit: audit() });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: { ...audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth'), inputRefs: [unrelated.ref] }
  });
  assert.throws(
    () => publishModel({ ledger: env.ledger, logicalId: 'model-hidden-auth', version: '1', specification: modelSpec(), principal: env.manager, authorizationDecisionAuditRef: auth.ref, audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish') }),
    (error) => error?.code === 'SPECIFICATION_AUTHORIZATION_AUDIT_INVALID'
  );
});

test('publication actor cannot impersonate exact specification manager', () => {
  const env = makeEnv();
  const { authorizationRecord } = authorize(env, 'Model', 'model-actor');
  assert.throws(
    () => publishModel({
      ledger: env.ledger,
      logicalId: 'model-actor',
      version: '1',
      specification: modelSpec(),
      principal: env.manager,
      authorizationDecisionAuditRef: authorizationRecord.ref,
      audit: audit({ type: 'USER', id: 'not-spec-manager' }, 'publish')
    }),
    (error) => error?.code === 'SPECIFICATION_AUDIT_ACTOR_MISMATCH'
  );
});

test('same logical specification version cannot be semantically rewritten', () => {
  const env = makeEnv();
  publish(env, 'Model', 'model-immutable', '1', modelSpec());
  assert.throws(
    () => publish(env, 'Model', 'model-immutable', '1', modelSpec({ computation: { methodId: 'changed', definitionHash: `sha256:${'f'.repeat(64)}` } })),
    /already exists|semantic|immutable/i
  );
});

test('external threshold authority must be an exact resolvable immutable ref', () => {
  const env = makeEnv();
  const authority = env.ledger.publish({ kind: 'ThresholdAuthority', logicalId: 'threshold-a', version: '1', semanticPayload: { code: 'IRRIGATION_THRESHOLD_SET_A' }, audit: audit() });
  const policy = policySpec({ thresholdAuthority: { mode: 'EXTERNAL_AUTHORITY', authorityRefs: [authority.ref] } });
  const record = publish(env, 'Policy', 'policy-external-threshold', '1', policy);
  const validated = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: record.ref });
  assert.deepEqual(validated.semanticPayload.thresholdAuthority.authorityRefs, [authority.ref]);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S01 specification integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
