import assert from 'node:assert/strict';
import {
  normalizeQualifiedTransformation,
  normalizeModel,
  normalizePolicy,
  validateSpecificationAuthority
} from '../../packages/specification-registry/src/index.mjs';
import {
  makeEnv,
  modelSpec,
  policySpec,
  publish,
  transformationSpec
} from './fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('S01 publishes exact QualifiedTransformation Model and Policy specification authorities', () => {
  const env = makeEnv();
  const transformation = publish(env, 'QualifiedTransformation', 'transform-vwc');
  const model = publish(env, 'Model', 'model-root-zone-water');
  const policy = publish(env, 'Policy', 'policy-irrigation-timing');
  assert.equal(transformation.ref.kind, 'QualifiedTransformation');
  assert.equal(model.ref.kind, 'Model');
  assert.equal(policy.ref.kind, 'Policy');
  assert.equal(transformation.semanticPayload.contractVersion, 'adr.qualified-transformation.v1');
  assert.equal(model.semanticPayload.contractVersion, 'adr.model.v1');
  assert.equal(policy.semanticPayload.contractVersion, 'adr.policy.v1');
});

test('QualifiedTransformation freezes semantic conversion method domain uncertainty and limitations while preserving epistemic class', () => {
  const normalized = normalizeQualifiedTransformation(transformationSpec());
  assert.equal(normalized.epistemicRule, 'PRESERVE');
  assert.deepEqual(normalized.inputContract.epistemicClasses, ['OBSERVATION']);
  assert.deepEqual(normalized.outputContract.epistemicClasses, ['OBSERVATION']);
  assert.equal(normalized.method.methodId, 'unit.vwc_fraction_to_percent');
  assert.equal(normalized.uncertaintyConsequence.mode, 'PRESERVE');
  assert.deepEqual(normalized.applicabilityDomain.requiredSemanticIds, ['soil.volumetric_water_content']);
});

test('Model freezes computational semantic contract independently from any executor identity', () => {
  const normalized = normalizeModel(modelSpec());
  assert.equal(normalized.purpose, 'ESTIMATE_ROOT_ZONE_WATER_STORAGE');
  assert.equal(normalized.outputs[0].epistemicClasses[0], 'STATE_ESTIMATE');
  assert.equal(normalized.parameterSlots[0].name, 'root_depth_mm');
  assert.equal(normalized.calibrationRequirements[0].mode, 'OPTIONAL');
  assert.equal(normalized.computation.methodId, 'root-zone-water-storage-v1');
  assert.equal(JSON.stringify(normalized).includes('endpoint'), false);
  assert.equal(JSON.stringify(normalized).includes('implementation'), false);
});

test('Policy freezes decision logic action space human gate fallback and abstention semantics without becoming Knowledge', () => {
  const normalized = normalizePolicy(policySpec());
  assert.equal(normalized.decisionType, 'IRRIGATION_TIMING');
  assert.deepEqual(normalized.actionSpace, ['IRRIGATE_NOW', 'WAIT']);
  assert.equal(normalized.humanGate.mode, 'REQUIRED');
  assert.equal(normalized.fallback.disposition, 'ABSTAIN');
  assert.deepEqual(normalized.abstentionConditions, ['MISSING_REQUIRED_RUNTIME_OUTPUT']);
  assert.equal(JSON.stringify(normalized).includes('knowledgeReleaseRef'), false);
  assert.equal(JSON.stringify(normalized).includes('qualifiedKnowledgeRef'), false);
});

test('canonical set ordering does not perturb specification semantic identity', () => {
  const left = makeEnv();
  const right = makeEnv();
  const a = publish(left, 'Model', 'model-canonical', '1', modelSpec({
    acceptedKnowledgeAuthorityKinds: ['DerivedKnowledge', 'QualifiedKnowledge'],
    limitations: ['Z_LIMIT', 'A_LIMIT']
  }));
  const b = publish(right, 'Model', 'model-canonical', '1', modelSpec({
    acceptedKnowledgeAuthorityKinds: ['QualifiedKnowledge', 'DerivedKnowledge'],
    limitations: ['A_LIMIT', 'Z_LIMIT']
  }));
  assert.equal(a.ref.semanticHash, b.ref.semanticHash);
});

test('material computation change versions Model semantics without involving Implementation', () => {
  const a = normalizeModel(modelSpec());
  const b = normalizeModel(modelSpec({ computation: { methodId: 'root-zone-water-storage-v2', definitionHash: `sha256:${'d'.repeat(64)}` } }));
  assert.notDeepEqual(a.computation, b.computation);
  const env = makeEnv();
  const first = publish(env, 'Model', 'model-versioned', '1', a);
  const second = publish(env, 'Model', 'model-versioned', '2', b);
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('material Policy action-space change creates distinct semantic identity', () => {
  const env = makeEnv();
  const first = publish(env, 'Policy', 'policy-versioned', '1', policySpec());
  const second = publish(env, 'Policy', 'policy-versioned', '2', policySpec({ actionSpace: ['WAIT', 'IRRIGATE_NOW', 'IRRIGATE_WITHIN_48H'] }));
  assert.notEqual(first.ref.semanticHash, second.ref.semanticHash);
});

test('historical exact specification refs remain replayable after newer versions exist', () => {
  const env = makeEnv();
  const oldModel = publish(env, 'Model', 'model-history', '1', modelSpec());
  publish(env, 'Model', 'model-history', '2', modelSpec({ computation: { methodId: 'root-zone-water-storage-v2', definitionHash: `sha256:${'e'.repeat(64)}` } }));
  const validated = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: oldModel.ref });
  assert.deepEqual(validated.record.ref, oldModel.ref);
  assert.equal(validated.semanticPayload.computation.methodId, 'root-zone-water-storage-v1');
});

test('all three published specification kinds replay exact management authorization', () => {
  const env = makeEnv();
  for (const [kind, id] of [['QualifiedTransformation', 't-replay'], ['Model', 'm-replay'], ['Policy', 'p-replay']]) {
    const record = publish(env, kind, id);
    const validated = validateSpecificationAuthority({ ledger: env.ledger, specificationRef: record.ref });
    assert.equal(validated.managementAuthorization.semanticPayload.operation, 'SPECIFICATION_MANAGE');
    assert.equal(validated.managementAuthorization.semanticPayload.policyRef, undefined);
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S01 specification positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
