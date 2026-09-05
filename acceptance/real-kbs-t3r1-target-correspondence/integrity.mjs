import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
  GeoxTargetCorrespondenceError,
  consumeAdrTargetCorrespondenceForGeox
} from '../../adapters/geox/src/target-correspondence.mjs';
import { buildKbsT3R1TargetWorld } from './target-world.mjs';

function toWireRef(ref) {
  return {
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const workflowSource = readFileSync(
  new URL('../../.github/workflows/productization-kbs-t3r1-target-correspondence.yml', import.meta.url),
  'utf8'
);
assert.ok(
  workflowSource.includes("  push:\n    branches:\n      - 'main'\n      - 'test/productization-kbs-t3r1-target-correspondence-*'"),
  'dedicated T3R1 workflow must retain authoritative-main push qualification'
);
console.log('PASS authoritative-main T3R1 push qualification trigger is frozen');

const world = buildKbsT3R1TargetWorld();
const geoxAuthority = JSON.parse(readFileSync(
  new URL('./geox-kbs-t3r1-authority-export.json', import.meta.url), 'utf8'
));
const consumerScope = {
  tenantId: 'tenant_mcft_external',
  projectId: 'project_mcft_cap09',
  groupId: 'group_public_research'
};

const baseMessage = createIntegrationMessage({
  role: 'RESULT_SINK',
  messageType: GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  messageId: 'geox-kbs-t3r1-correspondence-integrity',
  authorityRefs: [
    toWireRef(world.decision.ref),
    toWireRef(world.manifest.ref),
    ...world.validatedDatums.map((datum) => toWireRef(datum.record.ref))
  ],
  payload: {
    provider_target: {
      experiment_locator: world.adapterResponse.source_evidence[0].locator,
      treatment_code: 'T3',
      replicate_code: 'R1',
      crop_code: 'corn',
      hybrid_code: 'P0306Q',
      planting_observation_id: '6966'
    },
    relation_candidate: GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
    authority_nonclaims: world.adapterResponse.nonclaims
  }
});

function project(message = baseMessage, authority = geoxAuthority) {
  return consumeAdrTargetCorrespondenceForGeox({
    message,
    consumerScope,
    geoxTargetAuthority: authority
  });
}

function expectCode(label, expectedCode, fn) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof GeoxTargetCorrespondenceError, `${label}: expected GeoxTargetCorrespondenceError`);
    assert.equal(error.code, expectedCode, `${label}: wrong error code`);
    return true;
  });
  console.log(`PASS ${label}`);
}

expectCode('identity equality relation is forbidden', 'GEOX_TARGET_CORRESPONDENCE_RELATION_INVALID', () => {
  const message = clone(baseMessage);
  message.payload.relation_candidate = 'IDENTITY_EQUALS';
  project(message);
});

expectCode('missing ContextDatum authority fails closed', 'GEOX_TARGET_CORRESPONDENCE_ADR_AUTHORITY_REQUIRED', () => {
  const message = clone(baseMessage);
  message.authority_refs.pop();
  project(message);
});

for (const [label, key, value] of [
  ['treatment mismatch', 'treatment_code', 'T4'],
  ['replicate mismatch', 'replicate_code', 'R2'],
  ['crop mismatch', 'crop_code', 'soybean'],
  ['hybrid mismatch', 'hybrid_code', 'OTHER'],
  ['planting observation mismatch', 'planting_observation_id', '9999']
]) {
  expectCode(`${label} blocks correspondence`, 'GEOX_TARGET_CORRESPONDENCE_PROVIDER_TARGET_MISMATCH', () => {
    const message = clone(baseMessage);
    message.payload.provider_target[key] = value;
    project(message);
  });
}

expectCode('T4 authority source set cannot stand in for T3', 'GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', () => {
  const authority = clone(geoxAuthority);
  authority.authority_sources[0].path =
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V3.json';
  project(baseMessage, authority);
});

expectCode('GEOX T3 field identity cannot drift', 'GEOX_TARGET_CORRESPONDENCE_CONSUMER_TARGET_INVALID', () => {
  const authority = clone(geoxAuthority);
  authority.geox_target.field_id = 'field_kbs_mcse_t4r1';
  project(baseMessage, authority);
});

expectCode('GEOX field validity cannot be silently upgraded', 'GEOX_TARGET_CORRESPONDENCE_CONSUMER_TARGET_INVALID', () => {
  const authority = clone(geoxAuthority);
  authority.geox_target.field_validity_proven = true;
  project(baseMessage, authority);
});

expectCode('GEOX production-site status cannot be silently upgraded', 'GEOX_TARGET_CORRESPONDENCE_CONSUMER_TARGET_INVALID', () => {
  const authority = clone(geoxAuthority);
  authority.geox_target.production_site_claimed = true;
  project(baseMessage, authority);
});

expectCode('provider plot cannot be relabelled equal to GEOX crop-only zone', 'GEOX_TARGET_CORRESPONDENCE_GEOMETRY_BOUNDARY_REQUIRED', () => {
  const authority = clone(geoxAuthority);
  authority.geometry_boundary.geox_zone_geometry_equal_to_provider_plot_claimed = true;
  project(baseMessage, authority);
});

expectCode('correspondence cannot grant field actionability', 'GEOX_TARGET_CORRESPONDENCE_AUTHORITY_PROMOTION_FORBIDDEN', () => {
  const authority = clone(geoxAuthority);
  authority.authority_boundary.field_actionability_authorized = true;
  project(baseMessage, authority);
});

expectCode('correspondence cannot grant dispatch authority', 'GEOX_TARGET_CORRESPONDENCE_AUTHORITY_PROMOTION_FORBIDDEN', () => {
  const authority = clone(geoxAuthority);
  authority.authority_boundary.dispatch_authorized = true;
  project(baseMessage, authority);
});

expectCode('invalid GEOX main pin fails closed', 'GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', () => {
  const authority = clone(geoxAuthority);
  authority.source_main_sha = 'main';
  project(baseMessage, authority);
});

const safe = project();
assert.equal(safe.status, 'QUALIFIED_CORRESPONDENCE');
assert.equal(safe.relation, GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION);
assert.equal(safe.geox_target.field_id, 'field_kbs_mcse_t3r1');
assert.equal(safe.identity_equality_claimed, false);
assert.equal(safe.geometry_equality_claimed, false);
assert.equal(safe.zone_correspondence_claimed, false);
assert.equal(safe.field_actionable, false);
assert.equal(safe.dispatch_authorized, false);
assert.equal(safe.human_approval_authority, 'NONE');
assert.equal(safe.machine_execution_authority, 'NONE');
console.log('PASS safe T3R1 correspondence remains non-equality, non-actionable and non-dispatchable');

console.log('KBS T3R1 target correspondence integrity: 17/17 passed');
