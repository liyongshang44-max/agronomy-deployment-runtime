import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_IDENTITY_MAPPING_STATUS,
  GEOX_TARGET_IDENTITY_MESSAGE_TYPE,
  consumeAdrTargetIdentityTokenForGeox
} from '../../adapters/geox/src/target-identity-token.mjs';

const consumerScope = Object.freeze({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  groupId: 'group-a'
});
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const FARM_ID = `target_src_${'d'.repeat(64)}`;

function wireRef(kind, logicalId, hash) {
  return { kind, logical_id: logicalId, version: '1', semantic_hash: hash };
}

function authorityRefs(overrides = {}) {
  return [
    overrides.decisionProblem ?? wireRef('DecisionProblem', 'dp.identity', HASH_A),
    overrides.binding ?? wireRef(
      'AgronomicDecisionProblemFarmTargetBindingCompilation',
      'binding.identity',
      HASH_B
    ),
    overrides.projection ?? wireRef(
      'AgronomicContextTargetRefFarmInstanceProjectionCompilation',
      'projection.identity',
      HASH_C
    )
  ];
}

function payload(overrides = {}) {
  return {
    adr_target_ref: {
      organization_id: 'org-a',
      tenant_id: 'tenant-a',
      farm_id: FARM_ID
    },
    farm_id_authority_classification: 'EXACT_DEC_0027_SOURCE_BACKED',
    ...overrides
  };
}

function message(overrides = {}) {
  return createIntegrationMessage({
    role: overrides.role ?? 'RESULT_SINK',
    messageType: overrides.messageType ?? GEOX_TARGET_IDENTITY_MESSAGE_TYPE,
    messageId: overrides.messageId ?? 'identity-integrity',
    authorityRefs: overrides.authorityRefs ?? authorityRefs(),
    payload: overrides.payload ?? payload()
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('target identity adapter imports only public SDK and no ADR authority package', async () => {
  const source = await readFile(new URL('../../adapters/geox/src/target-identity-token.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes("../../../sdks/typescript/src/index.mjs"), true);
  assert.equal(/from\s*['"][^'"]*packages\//.test(source), false);
  assert.equal(/\bauthorize[A-Z]\w*\s*\(/.test(source), false);
  assert.equal(source.includes('PERMISSIONS.'), false);
});

test('wrong integration role fails closed', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({ role: 'CONTEXT_PROVIDER' }),
      consumerScope
    }),
    (error) => error?.code === 'INVALID_GEOX_TARGET_IDENTITY_MESSAGE'
  );
});

test('wrong message type fails closed', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({ messageType: 'SOME_OTHER_RESULT' }),
      consumerScope
    }),
    (error) => error?.code === 'INVALID_GEOX_TARGET_IDENTITY_MESSAGE'
  );
});

test('missing DEC-0027 projection authority fails closed', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({ authorityRefs: authorityRefs().slice(0, 2) }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_AUTHORITY_CHAIN_REQUIRED'
  );
});

test('wrong authority kind cannot substitute for DEC-0027 projection', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({
        authorityRefs: authorityRefs({
          projection: wireRef('RuntimeBinding', 'runtime-binding.fake', HASH_C)
        })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_AUTHORITY_CHAIN_REQUIRED'
  );
});

test('raw source-native SERF identifier cannot masquerade as ADR farm identity', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({
        payload: payload({
          adr_target_ref: {
            organization_id: 'org-a',
            tenant_id: 'tenant-a',
            farm_id: 'SERF'
          }
        })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_SOURCE_BACKED_FARM_ID_REQUIRED'
  );
});

test('unestablished field identity cannot be smuggled in target_ref', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({
        payload: payload({
          adr_target_ref: {
            organization_id: 'org-a',
            tenant_id: 'tenant-a',
            farm_id: FARM_ID,
            field_id: 'field-c8-demo'
          }
        })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_FIELD_FORBIDDEN'
  );
});

test('consumer cannot add claimed GEOX field mapping to upstream payload', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({
        payload: payload({ geox_field_id: 'field-c8-demo' })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_FIELD_FORBIDDEN'
  );
});

test('farm authority classification cannot be weakened or invented', () => {
  assert.throws(
    () => consumeAdrTargetIdentityTokenForGeox({
      message: message({
        payload: payload({ farm_id_authority_classification: 'STRING_MATCH' })
      }),
      consumerScope
    }),
    (error) => error?.code === 'GEOX_TARGET_IDENTITY_AUTHORITY_CLASSIFICATION_REQUIRED'
  );
});

test('safe token stays opaque, field-unresolved and non-dispatchable', () => {
  const projection = consumeAdrTargetIdentityTokenForGeox({ message: message(), consumerScope });
  assert.equal(projection.adr_target_identity.target_ref.farm_id, FARM_ID);
  assert.equal(projection.adr_target_identity.granularity, 'FARM');
  assert.equal(projection.geox_field_mapping.status, GEOX_TARGET_IDENTITY_MAPPING_STATUS);
  assert.equal(projection.geox_field_mapping.field_id, null);
  assert.equal(projection.geox_field_mapping.mapping_authority_ref, null);
  assert.equal(projection.field_actionable, false);
  assert.equal(projection.dispatch_authorized, false);
  assert.equal(projection.authority_claim, 'NONE_ADR_FARM_TOKEN_IS_NOT_GEOX_FIELD_IDENTITY');
  assert.equal('field_id' in projection.routing_scope, false);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`GEOX target identity token integrity: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exitCode = 1;
