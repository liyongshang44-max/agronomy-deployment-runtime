import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_AUTHORITY_PATHS,
  GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
  GeoxTargetAuthorityResolverError,
  GeoxTargetAuthoritySnapshotStore,
  replayGeoxTargetAuthorityResolution,
  resolveGeoxTargetAuthority
} from '../../adapters/geox/src/target-authority-resolver.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  GeoxTargetCorrespondenceError,
  consumeAdrTargetCorrespondenceForGeox
} from '../../adapters/geox/src/target-correspondence.mjs';

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureSources() {
  const geometry = Buffer.from(JSON.stringify({
    schema_version: 'geox_mcft_cap09_t4r1_crop_only_geometry_authority_v1',
    record_status: 'T4R1_CROP_ONLY_GEOMETRY_AUTHORITY_CANDIDATE',
    candidate_scope: {
      provider_site: 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT',
      treatment: 'T4',
      replicate: 'R1',
      prospective_field_id: 'field_kbs_mcse_t4r1',
      prospective_zone_id: 'zone_kbs_mcse_t4r1_crop_formal_v1'
    },
    provider_sources: {
      mcse_structure: {
        url: 'https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/'
      }
    },
    provider_geometry_selector: { treatment: 'T4', replicate: 'R1', subplot: 'main' },
    prairie_strip_guard: {
      position: 'CENTER_OF_T3_T4_PLOT',
      strip_geometry_may_not_be_invented: true
    },
    resolution_policy: {
      formal_rebind_authorized_by_this_probe: false,
      ea5e2_authorized_by_this_probe: false
    }
  }, null, 2), 'utf8');
  const geometryBlob = gitBlobSha(geometry);
  const geometrySemanticHash = `sha256:${'1'.repeat(64)}`;

  const site = Buffer.from(JSON.stringify({
    schema_version: 'geox_mcft_cap09_s6_formal_site_authority_v3',
    record_status: 'T4R1_FORMAL_SUCCESSOR_SITE_AUTHORITY_CANDIDATE',
    site: {
      qualified_formal_site_id: 'KBS_MCSE_T4R1',
      provider_site: 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT',
      provider_treatment_code: 'T4',
      replicate: 'R1',
      current_season: '2026',
      crop: 'corn',
      hybrid_product_code: '43-96P',
      field_validity_proven: false,
      production_site_claimed: false
    },
    formal_scope_identity: {
      tenant_id: 'tenant_mcft_external',
      project_id: 'project_mcft_cap09',
      group_id: 'group_public_research',
      field_id: 'field_kbs_mcse_t4r1',
      season_id: 'season_2026_corn',
      zone_id: 'zone_kbs_mcse_t4r1_crop_formal_v1'
    },
    geometry_authority: {
      path: GEOX_TARGET_AUTHORITY_PATHS[2],
      blob_sha: geometryBlob,
      semantic_hash: geometrySemanticHash,
      whole_t4r1_plot_assumed_crop_only: false,
      prairie_strip_excluded: true,
      prairie_strip_wkt_invented: false
    }
  }, null, 2), 'utf8');

  const amendment = Buffer.from([
    '# fixture',
    '- site: `KBS_MCSE_T4R1`;',
    '- provider treatment: `T4` / Biologically Based;',
    '- replicate: `R1`;',
    '- field: `field_kbs_mcse_t4r1`;',
    '- season: `season_2026_corn`;',
    '- zone: `zone_kbs_mcse_t4r1_crop_formal_v1`;',
    '- crop: corn;',
    '- hybrid: Blue River `43-96P`;',
    '- planting observation: KBS AgLog `6974`;',
    '- planting local date: `2026-05-27` in `America/Detroit`;',
    `- crop-only geometry semantic hash: \`${geometrySemanticHash}\`.`,
    'The whole T4R1 plot is not crop-only.',
    'Its central prairie strip remains excluded.'
  ].join('\n'), 'utf8');

  const runtime = Buffer.from([
    'export const MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1 =',
    '  "EXTERNAL_PUBLIC_RESEARCH_SCOPE" as const;',
    'export const MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 = Object.freeze({',
    '  tenant_id: "tenant_mcft_external",',
    '  project_id: "project_mcft_cap09",',
    '  group_id: "group_public_research",',
    '  field_id: "field_kbs_mcse_t4r1",',
    '  season_id: "season_2026_corn",',
    '  zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",',
    '});'
  ].join('\n'), 'utf8');

  return new Map([
    [GEOX_TARGET_AUTHORITY_PATHS[0], site],
    [GEOX_TARGET_AUTHORITY_PATHS[1], amendment],
    [GEOX_TARGET_AUTHORITY_PATHS[2], geometry],
    [GEOX_TARGET_AUTHORITY_PATHS[3], runtime]
  ]);
}

function fixtureTransport({ mutatePath = null, mutateBytes = null, wrongBlobPath = null } = {}) {
  const sources = fixtureSources();
  return Object.freeze({
    async resolveRef() {
      return { commitSha: 'a'.repeat(40) };
    },
    async readFile({ path }) {
      let bytes = Buffer.from(sources.get(path));
      if (path === mutatePath) bytes = Buffer.from(mutateBytes, 'utf8');
      const blobSha = path === wrongBlobPath ? 'b'.repeat(40) : gitBlobSha(bytes);
      return { bytes, blobSha };
    }
  });
}

function expectResolverCode(label, code, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => assert.fail(`${label}: expected ${code}`))
    .catch((error) => {
      assert.ok(error instanceof GeoxTargetAuthorityResolverError, `${label}: expected resolver error`);
      assert.equal(error.code, code, `${label}: wrong error code`);
      console.log(`PASS ${label}`);
    });
}

function expectCorrespondenceCode(label, code, fn) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof GeoxTargetCorrespondenceError, `${label}: expected correspondence error`);
    assert.equal(error.code, code, `${label}: wrong error code`);
    return true;
  });
  console.log(`PASS ${label}`);
}

const resolverSource = readFileSync(new URL('../../adapters/geox/src/target-authority-resolver.mjs', import.meta.url), 'utf8');
assert.equal(resolverSource.includes("packages/"), false);
assert.equal(resolverSource.includes("../../packages"), false);
assert.equal(resolverSource.includes('liyongshang44-max/GEOX'), true);
console.log('PASS resolver remains adapter-local and targets only the explicit GEOX repository');

const snapshotStore = new GeoxTargetAuthoritySnapshotStore();
const baseline = await resolveGeoxTargetAuthority({
  ref: 'main',
  resolvedAt: '2026-09-04T17:20:00.000Z',
  transport: fixtureTransport(),
  snapshotStore
});
assert.equal(snapshotStore.count(), 4);
assert.equal(baseline.receipt.resolution_class, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(baseline.authorityExport.provider_target.treatment_code, 'T4');
assert.deepEqual(
  replayGeoxTargetAuthorityResolution({ receipt: baseline.receipt, snapshotStore }).authorityExport,
  baseline.authorityExport
);
console.log('PASS exact retained bytes replay the same authority export');

await expectResolverCode(
  'wrong transport blob SHA fails closed',
  'GEOX_TARGET_AUTHORITY_BLOB_HASH_MISMATCH',
  () => resolveGeoxTargetAuthority({
    ref: 'main',
    resolvedAt: '2026-09-04T17:20:00.000Z',
    transport: fixtureTransport({ wrongBlobPath: GEOX_TARGET_AUTHORITY_PATHS[3] })
  })
);

const badSite = JSON.parse(fixtureSources().get(GEOX_TARGET_AUTHORITY_PATHS[0]).toString('utf8'));
badSite.site.provider_treatment_code = 'T3';
await expectResolverCode(
  'T4 site identity cannot silently drift to T3',
  'GEOX_TARGET_AUTHORITY_SITE_INVALID',
  () => resolveGeoxTargetAuthority({
    ref: 'main',
    resolvedAt: '2026-09-04T17:20:00.000Z',
    transport: fixtureTransport({
      mutatePath: GEOX_TARGET_AUTHORITY_PATHS[0],
      mutateBytes: JSON.stringify(badSite)
    })
  })
);

const tamperedStore = {
  get(contentHash) {
    const bytes = snapshotStore.get(contentHash);
    if (contentHash === baseline.receipt.authority_sources[0].content_hash) {
      return Buffer.concat([bytes, Buffer.from('\nTAMPERED', 'utf8')]);
    }
    return bytes;
  }
};
assert.throws(
  () => replayGeoxTargetAuthorityResolution({ receipt: baseline.receipt, snapshotStore: tamperedStore }),
  (error) => {
    assert.ok(error instanceof GeoxTargetAuthorityResolverError);
    assert.equal(error.code, 'GEOX_TARGET_AUTHORITY_SNAPSHOT_HASH_MISMATCH');
    return true;
  }
);
console.log('PASS retained snapshot byte mutation fails exact replay');

const authorityRefs = [
  { kind: 'DecisionProblem', logical_id: 'decision.fixture', version: '1', semantic_hash: `sha256:${'a'.repeat(64)}` },
  { kind: 'ContextManifest', logical_id: 'manifest.fixture', version: '1', semantic_hash: `sha256:${'b'.repeat(64)}` },
  ...Array.from({ length: 7 }, (_, index) => ({
    kind: 'ContextDatum',
    logical_id: `datum.fixture.${index + 1}`,
    version: '1',
    semantic_hash: `sha256:${String(index + 1).repeat(64).slice(0, 64)}`
  }))
];
const message = createIntegrationMessage({
  role: 'RESULT_SINK',
  messageType: GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE,
  messageId: 'resolver-integrity-message',
  authorityRefs,
  payload: {
    provider_target: {
      experiment_locator: baseline.authorityExport.provider_target.experiment_locator,
      treatment_code: 'T4',
      replicate_code: 'R1',
      crop_code: 'corn',
      hybrid_code: '43-96P',
      planting_observation_id: '6974'
    },
    relation_candidate: GEOX_TARGET_CORRESPONDENCE_RELATION,
    authority_nonclaims: [
      'NO_ADR_FIELD_ID_CREATED',
      'NO_GEOMETRY_REPUBLISHED',
      'NO_FIELD_ACTIONABILITY_AUTHORITY',
      'NO_DISPATCH_AUTHORITY'
    ]
  }
});
const consumerScope = {
  tenantId: 'tenant_mcft_external',
  projectId: 'project_mcft_cap09',
  groupId: 'group_public_research'
};

expectCorrespondenceCode(
  'resolver export without receipt cannot masquerade as replayable consumer authority',
  'GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_REQUIRED',
  () => consumeAdrTargetCorrespondenceForGeox({
    message,
    consumerScope,
    geoxTargetAuthority: baseline.authorityExport
  })
);

const badReceiptHash = clone(baseline.receipt);
badReceiptHash.authority_export_hash = `sha256:${'f'.repeat(64)}`;
expectCorrespondenceCode(
  'receipt must bind exact authority export hash',
  'GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_HASH_MISMATCH',
  () => consumeAdrTargetCorrespondenceForGeox({
    message,
    consumerScope,
    geoxTargetAuthority: baseline.authorityExport,
    geoxTargetAuthorityResolutionReceipt: badReceiptHash
  })
);

const badReceiptBlob = clone(baseline.receipt);
badReceiptBlob.authority_sources[0].blob_sha = 'c'.repeat(40);
expectCorrespondenceCode(
  'receipt source blob must equal authority export source blob',
  'GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_INVALID',
  () => consumeAdrTargetCorrespondenceForGeox({
    message,
    consumerScope,
    geoxTargetAuthority: baseline.authorityExport,
    geoxTargetAuthorityResolutionReceipt: badReceiptBlob
  })
);

const safe = consumeAdrTargetCorrespondenceForGeox({
  message,
  consumerScope,
  geoxTargetAuthority: baseline.authorityExport,
  geoxTargetAuthorityResolutionReceipt: baseline.receipt
});
assert.equal(safe.consumer_authority_pin.classification, GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS);
assert.equal(safe.consumer_authority_pin.resolution_receipt.replay_class, 'EXACT');
assert.equal(safe.field_actionable, false);
assert.equal(safe.dispatch_authorized, false);
assert.equal(safe.human_approval_authority, 'NONE');
assert.equal(safe.machine_execution_authority, 'NONE');
console.log('PASS replayable consumer authority remains non-actionable and non-dispatchable');

console.log('GEOX live authority resolver integrity: 9/9 passed');
