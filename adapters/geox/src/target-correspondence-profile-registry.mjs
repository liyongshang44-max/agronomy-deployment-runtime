import { GEOX_TARGET_AUTHORITY_PATHS } from './target-authority-resolver.mjs';

export const GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION =
  'adr.geox-target-correspondence-profile-registry.v1';

export const GEOX_TARGET_CORRESPONDENCE_RELATION =
  'CORRESPONDS_TO_SAME_KBS_MCSE_T4_R1_TARGET';
export const GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION =
  'CORRESPONDS_TO_SAME_KBS_MCSE_T3_R1_TARGET';
export const GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION =
  'CORRESPONDS_TO_SAME_KBS_MCSE_T1_R1_TARGET';

export const GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY =
  'CROP_ONLY_DERIVED_PROVIDER_GEOMETRY';
export const GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED =
  'PROVIDER_GEOMETRY_REFERENCED_RESTRICTED_NOT_REPUBLISHED';

const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const OFFICIAL_MCSE_LOCATOR =
  'https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/';

const T3R1_AUTHORITY_PATHS = Object.freeze([
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V2.json'
]);

const T1R1_AUTHORITY_PATHS = Object.freeze([
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-CURRENT-CROP-AUTHORITY-REQUALIFICATION-RESULT-V1.json'
]);

function frozenPinnedAuthority(sourceMainSha, entries) {
  return Object.freeze({
    sourceMainSha,
    blobShas: Object.freeze(Object.fromEntries(entries))
  });
}

const T3R1_PINNED_AUTHORITY = frozenPinnedAuthority(
  '5050f1c08d2528048c56d56add4cbb068b956925',
  [
    [T3R1_AUTHORITY_PATHS[0], 'be02ea8a6fe54affed1e0abedb1f1d6e407c661a'],
    [T3R1_AUTHORITY_PATHS[1], 'f9d664a0f58c6024f3090edbd5aee26d8d1b680a'],
    [T3R1_AUTHORITY_PATHS[2], '87b1c8fa37939085be68abb66bfa8e0918f65e95'],
    [T3R1_AUTHORITY_PATHS[3], 'deb6c15ef7848a8c1ab00bce0847324aaa68ba24']
  ]
);

const T1R1_PINNED_AUTHORITY = frozenPinnedAuthority(
  '0bd2300c9c8a58025df9212d7c14e640606add83',
  [
    [T1R1_AUTHORITY_PATHS[0], 'eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8'],
    [T1R1_AUTHORITY_PATHS[1], 'dedc8db6e2e3c902066ed94b0d3322a69775b7b6'],
    [T1R1_AUTHORITY_PATHS[2], 'b5de9d29189cb654444b3f57d00df290eefe16d3'],
    [T1R1_AUTHORITY_PATHS[3], 'a9196e16ab6402fcfe2d59b738a395ef52d7c236']
  ]
);

function profile({
  relation,
  authorityPaths,
  replayableResolverSupported,
  pinnedAuthority,
  geometryBoundaryClass,
  provider,
  geox
}) {
  return Object.freeze({
    relation,
    authorityPaths,
    replayableResolverSupported,
    pinnedAuthority,
    geometryBoundaryClass,
    provider: Object.freeze(provider),
    geox: Object.freeze(geox)
  });
}

const PROFILE_REGISTRY = new Map([
  [
    GEOX_TARGET_CORRESPONDENCE_RELATION,
    profile({
      relation: GEOX_TARGET_CORRESPONDENCE_RELATION,
      authorityPaths: GEOX_TARGET_AUTHORITY_PATHS,
      replayableResolverSupported: true,
      pinnedAuthority: null,
      geometryBoundaryClass: GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY,
      provider: {
        treatment_code: 'T4',
        replicate_code: 'R1',
        crop_code: 'corn',
        hybrid_code: '43-96P',
        planting_observation_id: '6974'
      },
      geox: {
        field_id: 'field_kbs_mcse_t4r1',
        season_id: 'season_2026_corn',
        zone_id: 'zone_kbs_mcse_t4r1_crop_formal_v1'
      }
    })
  ],
  [
    GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
    profile({
      relation: GEOX_TARGET_CORRESPONDENCE_T3R1_RELATION,
      authorityPaths: T3R1_AUTHORITY_PATHS,
      replayableResolverSupported: false,
      pinnedAuthority: T3R1_PINNED_AUTHORITY,
      geometryBoundaryClass: GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY,
      provider: {
        experiment_locator: OFFICIAL_MCSE_LOCATOR,
        treatment_code: 'T3',
        replicate_code: 'R1',
        crop_code: 'corn',
        hybrid_code: 'P0306Q',
        planting_observation_id: '6966'
      },
      geox: {
        field_id: 'field_kbs_mcse_t3r1',
        season_id: 'season_2026_corn',
        zone_id: 'zone_kbs_mcse_t3r1_crop_formal_v1'
      }
    })
  ],
  [
    GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
    profile({
      relation: GEOX_TARGET_CORRESPONDENCE_T1R1_RELATION,
      authorityPaths: T1R1_AUTHORITY_PATHS,
      replayableResolverSupported: false,
      pinnedAuthority: T1R1_PINNED_AUTHORITY,
      geometryBoundaryClass: GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED,
      provider: {
        experiment_locator: OFFICIAL_MCSE_LOCATOR,
        treatment_code: 'T1',
        replicate_code: 'R1',
        crop_code: 'corn',
        hybrid_code: 'P0306Q',
        planting_observation_id: '6931'
      },
      geox: {
        field_id: 'field_kbs_mcse_t1r1',
        season_id: 'season_2026_corn',
        zone_id: 'zone_kbs_mcse_t1r1_formal_v1'
      }
    })
  ]
]);

function requireRegistryInvariant(condition, message) {
  if (!condition) {
    throw new Error(`Invalid GEOX target correspondence profile registry: ${message}`);
  }
}

function validateRegistry() {
  const profiles = [...PROFILE_REGISTRY.values()];
  requireRegistryInvariant(profiles.length === 3, 'v1 registry must contain exactly three qualified profiles');
  requireRegistryInvariant(new Set(profiles.map((item) => item.relation)).size === profiles.length, 'relations must be unique');

  const allowedGeometryClasses = new Set([
    GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_CROP_ONLY,
    GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED
  ]);

  for (const item of profiles) {
    requireRegistryInvariant(PROFILE_REGISTRY.get(item.relation) === item, `${item.relation} registry key must equal profile relation`);
    requireRegistryInvariant(Object.isFrozen(item), `${item.relation} profile must be frozen`);
    requireRegistryInvariant(Object.isFrozen(item.authorityPaths), `${item.relation} authority paths must be frozen`);
    requireRegistryInvariant(Object.isFrozen(item.provider), `${item.relation} provider target must be frozen`);
    requireRegistryInvariant(Object.isFrozen(item.geox), `${item.relation} GEOX target must be frozen`);
    requireRegistryInvariant(item.authorityPaths.length === 4, `${item.relation} must bind exactly four authority sources`);
    requireRegistryInvariant(new Set(item.authorityPaths).size === 4, `${item.relation} authority paths must be unique`);
    requireRegistryInvariant(allowedGeometryClasses.has(item.geometryBoundaryClass), `${item.relation} geometry class is not closed-world qualified`);
    requireRegistryInvariant(item.provider.replicate_code === 'R1', `${item.relation} replicate must remain R1`);
    requireRegistryInvariant(item.provider.crop_code === 'corn', `${item.relation} crop must remain corn`);
    requireRegistryInvariant(typeof item.provider.hybrid_code === 'string' && item.provider.hybrid_code.length > 0, `${item.relation} hybrid must be explicit`);
    requireRegistryInvariant(typeof item.provider.planting_observation_id === 'string' && item.provider.planting_observation_id.length > 0, `${item.relation} planting observation must be explicit`);
    requireRegistryInvariant(item.geox.season_id === 'season_2026_corn', `${item.relation} season must remain exact 2026 corn`);

    if (item.replayableResolverSupported) {
      requireRegistryInvariant(item.pinnedAuthority === null, `${item.relation} replayable profile may not also carry a legacy exact pin`);
    } else {
      requireRegistryInvariant(item.pinnedAuthority !== null, `${item.relation} non-replayable profile requires an exact consumer authority pin`);
      requireRegistryInvariant(Object.isFrozen(item.pinnedAuthority), `${item.relation} pinned authority must be frozen`);
      requireRegistryInvariant(Object.isFrozen(item.pinnedAuthority.blobShas), `${item.relation} pinned blob map must be frozen`);
      requireRegistryInvariant(GIT_SHA_RE.test(item.pinnedAuthority.sourceMainSha), `${item.relation} pinned main must be a Git SHA`);
      requireRegistryInvariant(
        Object.keys(item.pinnedAuthority.blobShas).length === item.authorityPaths.length,
        `${item.relation} pinned blob set must match authority paths`
      );
      for (const path of item.authorityPaths) {
        requireRegistryInvariant(GIT_SHA_RE.test(item.pinnedAuthority.blobShas[path] ?? ''), `${item.relation} missing exact blob pin for ${path}`);
      }
    }
  }

  requireRegistryInvariant(
    profiles.filter((item) => item.replayableResolverSupported).length === 1,
    'v1 registry must expose exactly one replayable resolver profile'
  );
  requireRegistryInvariant(
    profiles.filter((item) => item.geometryBoundaryClass === GEOX_TARGET_CORRESPONDENCE_GEOMETRY_CLASS_REFERENCED_RESTRICTED).length === 1,
    'v1 registry must preserve exactly one referenced/restricted geometry profile'
  );
}

validateRegistry();

export function getGeoxTargetCorrespondenceProfile(relation) {
  return PROFILE_REGISTRY.get(relation) ?? null;
}

export function listGeoxTargetCorrespondenceProfiles() {
  return Object.freeze([...PROFILE_REGISTRY.values()]);
}
