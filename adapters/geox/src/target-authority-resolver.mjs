import { createHash } from 'node:crypto';

export const GEOX_TARGET_AUTHORITY_EXPORT_VERSION = 'adr.geox-target-authority-export.v1';
export const GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION = 'adr.geox-target-authority-resolution-receipt.v1';
export const GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS = 'REPLAYABLE_CONSUMER_AUTHORITY_RESOLUTION';
export const GEOX_TARGET_AUTHORITY_REPOSITORY = 'liyongshang44-max/GEOX';

export const GEOX_TARGET_AUTHORITY_PATHS = Object.freeze([
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V3.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-20-T4R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json',
  'apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts'
]);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class GeoxTargetAuthorityResolverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxTargetAuthorityResolverError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxTargetAuthorityResolverError(code, message);
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_GEOX_TARGET_AUTHORITY_RESOLUTION_INPUT', `${name} must be non-empty text`);
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_GEOX_TARGET_AUTHORITY_RESOLUTION_INPUT', `${name} must be an object`);
  }
  return value;
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function canonicalJsonHash(value) {
  return sha256(Buffer.from(JSON.stringify(value), 'utf8'));
}

function requireGitSha(value, name) {
  const normalized = text(value, name);
  if (!GIT_SHA_RE.test(normalized)) {
    fail('GEOX_TARGET_AUTHORITY_GIT_SHA_INVALID', `${name} must be a lowercase 40-hex Git SHA`);
  }
  return normalized;
}

function requireTimestamp(value, name) {
  const normalized = text(value, name);
  if (!RFC3339_RE.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    fail('GEOX_TARGET_AUTHORITY_RESOLUTION_TIME_INVALID', `${name} must be RFC3339 UTC time`);
  }
  return new Date(normalized).toISOString();
}

function decodeUtf8(bytes, name) {
  if (!Buffer.isBuffer(bytes)) {
    fail('GEOX_TARGET_AUTHORITY_BYTES_REQUIRED', `${name} must be Buffer bytes`);
  }
  return bytes.toString('utf8');
}

function parseJsonBytes(bytes, name) {
  try {
    return JSON.parse(decodeUtf8(bytes, name));
  } catch {
    fail('GEOX_TARGET_AUTHORITY_SOURCE_PARSE_FAILED', `${name} must contain valid JSON`);
  }
}

function requiredMarker(body, marker, name) {
  if (!body.includes(marker)) {
    fail('GEOX_TARGET_AUTHORITY_SOURCE_MARKER_MISSING', `${name} is missing required marker ${marker}`);
  }
}

function requiredRegex(body, pattern, name) {
  if (!pattern.test(body)) {
    fail('GEOX_TARGET_AUTHORITY_SOURCE_MARKER_MISSING', `${name} is missing required structured marker ${pattern}`);
  }
}

export class GeoxTargetAuthoritySnapshotStore {
  #snapshots = new Map();

  retain(bytes) {
    if (!Buffer.isBuffer(bytes)) {
      fail('GEOX_TARGET_AUTHORITY_BYTES_REQUIRED', 'snapshot bytes must be Buffer');
    }
    const hash = sha256(bytes);
    const existing = this.#snapshots.get(hash);
    if (existing && !existing.equals(bytes)) {
      fail('GEOX_TARGET_AUTHORITY_SNAPSHOT_HASH_COLLISION', `snapshot ${hash} changed bytes`);
    }
    if (!existing) this.#snapshots.set(hash, Buffer.from(bytes));
    return hash;
  }

  get(contentHash) {
    const normalized = text(contentHash, 'contentHash');
    const bytes = this.#snapshots.get(normalized);
    if (!bytes) fail('GEOX_TARGET_AUTHORITY_SNAPSHOT_MISSING', `snapshot ${normalized} is unavailable`);
    return Buffer.from(bytes);
  }

  has(contentHash) {
    return this.#snapshots.has(contentHash);
  }

  count() {
    return this.#snapshots.size;
  }
}

export function createGitHubPublicAuthorityTransport({ fetchImpl = globalThis.fetch, apiBase = 'https://api.github.com' } = {}) {
  if (typeof fetchImpl !== 'function') {
    fail('GEOX_TARGET_AUTHORITY_TRANSPORT_INVALID', 'fetch implementation is required');
  }
  const base = text(apiBase, 'apiBase').replace(/\/$/, '');

  async function getJson(url) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'agronomy-deployment-runtime-geox-authority-resolver'
        }
      });
    } catch (error) {
      fail('GEOX_TARGET_AUTHORITY_TRANSPORT_FAILED', `GitHub transport failed: ${error?.message ?? error}`);
    }
    if (!response?.ok) {
      fail('GEOX_TARGET_AUTHORITY_TRANSPORT_FAILED', `GitHub transport returned HTTP ${response?.status ?? 'UNKNOWN'}`);
    }
    try {
      return await response.json();
    } catch {
      fail('GEOX_TARGET_AUTHORITY_TRANSPORT_FAILED', 'GitHub transport returned non-JSON response');
    }
  }

  function repositoryUrl(repository) {
    const [owner, repo] = text(repository, 'repository').split('/');
    if (!owner || !repo || repository.split('/').length !== 2) {
      fail('GEOX_TARGET_AUTHORITY_REPOSITORY_INVALID', 'repository must be owner/name');
    }
    return `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }

  return Object.freeze({
    transportClass: 'GITHUB_PUBLIC_REPOSITORY',
    async resolveRef({ repository, ref }) {
      const data = object(
        await getJson(`${repositoryUrl(repository)}/commits/${encodeURIComponent(text(ref, 'ref'))}`),
        'GitHub commit response'
      );
      return Object.freeze({ commitSha: requireGitSha(data.sha, 'GitHub commit sha') });
    },
    async readFile({ repository, path, commitSha }) {
      const encodedPath = text(path, 'path').split('/').map(encodeURIComponent).join('/');
      const data = object(
        await getJson(`${repositoryUrl(repository)}/contents/${encodedPath}?ref=${encodeURIComponent(requireGitSha(commitSha, 'commitSha'))}`),
        'GitHub content response'
      );
      if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') {
        fail('GEOX_TARGET_AUTHORITY_TRANSPORT_FILE_INVALID', `${path} must resolve to one base64 file`);
      }
      const bytes = Buffer.from(data.content.replace(/\s+/g, ''), 'base64');
      const blobSha = requireGitSha(data.sha, `${path} blob sha`);
      if (gitBlobSha(bytes) !== blobSha) {
        fail('GEOX_TARGET_AUTHORITY_BLOB_HASH_MISMATCH', `${path} bytes do not reproduce Git blob SHA`);
      }
      return Object.freeze({ bytes, blobSha });
    }
  });
}

function compileAuthorityExport({ repository, commitSha, sources }) {
  const byPath = new Map(sources.map((source) => [source.path, source]));
  if (byPath.size !== GEOX_TARGET_AUTHORITY_PATHS.length
    || !GEOX_TARGET_AUTHORITY_PATHS.every((path) => byPath.has(path))) {
    fail('GEOX_TARGET_AUTHORITY_SOURCE_SET_INVALID', 'exact GEOX target authority source set is required');
  }

  const siteSource = byPath.get(GEOX_TARGET_AUTHORITY_PATHS[0]);
  const amendmentSource = byPath.get(GEOX_TARGET_AUTHORITY_PATHS[1]);
  const geometrySource = byPath.get(GEOX_TARGET_AUTHORITY_PATHS[2]);
  const runtimeSource = byPath.get(GEOX_TARGET_AUTHORITY_PATHS[3]);

  const site = parseJsonBytes(siteSource.bytes, siteSource.path);
  const geometry = parseJsonBytes(geometrySource.bytes, geometrySource.path);
  const amendment = decodeUtf8(amendmentSource.bytes, amendmentSource.path);
  const runtime = decodeUtf8(runtimeSource.bytes, runtimeSource.path);

  if (site.schema_version !== 'geox_mcft_cap09_s6_formal_site_authority_v3'
    || site.record_status !== 'T4R1_FORMAL_SUCCESSOR_SITE_AUTHORITY_CANDIDATE') {
    fail('GEOX_TARGET_AUTHORITY_SITE_INVALID', 'formal site authority is not the expected T4R1 successor candidate');
  }
  const siteIdentity = object(site.site, 'formal site.site');
  const formalScope = object(site.formal_scope_identity, 'formal site.formal_scope_identity');
  const siteGeometry = object(site.geometry_authority, 'formal site.geometry_authority');
  if (siteIdentity.qualified_formal_site_id !== 'KBS_MCSE_T4R1'
    || siteIdentity.provider_site !== 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT'
    || siteIdentity.provider_treatment_code !== 'T4'
    || siteIdentity.replicate !== 'R1'
    || siteIdentity.current_season !== '2026'
    || siteIdentity.crop !== 'corn'
    || siteIdentity.hybrid_product_code !== '43-96P'
    || siteIdentity.field_validity_proven !== false
    || siteIdentity.production_site_claimed !== false) {
    fail('GEOX_TARGET_AUTHORITY_SITE_INVALID', 'formal site identity or limitations changed');
  }
  if (formalScope.tenant_id !== 'tenant_mcft_external'
    || formalScope.project_id !== 'project_mcft_cap09'
    || formalScope.group_id !== 'group_public_research'
    || formalScope.field_id !== 'field_kbs_mcse_t4r1'
    || formalScope.season_id !== 'season_2026_corn'
    || formalScope.zone_id !== 'zone_kbs_mcse_t4r1_crop_formal_v1') {
    fail('GEOX_TARGET_AUTHORITY_SCOPE_INVALID', 'formal scope identity changed');
  }
  if (siteGeometry.path !== GEOX_TARGET_AUTHORITY_PATHS[2]
    || siteGeometry.blob_sha !== geometrySource.blobSha
    || siteGeometry.whole_t4r1_plot_assumed_crop_only !== false
    || siteGeometry.prairie_strip_excluded !== true
    || siteGeometry.prairie_strip_wkt_invented !== false) {
    fail('GEOX_TARGET_AUTHORITY_GEOMETRY_LINK_INVALID', 'formal site no longer binds exact crop-only geometry authority');
  }

  if (geometry.schema_version !== 'geox_mcft_cap09_t4r1_crop_only_geometry_authority_v1'
    || geometry.record_status !== 'T4R1_CROP_ONLY_GEOMETRY_AUTHORITY_CANDIDATE') {
    fail('GEOX_TARGET_AUTHORITY_GEOMETRY_INVALID', 'geometry authority is not the expected T4R1 crop-only candidate');
  }
  const candidateScope = object(geometry.candidate_scope, 'geometry.candidate_scope');
  const providerSources = object(geometry.provider_sources, 'geometry.provider_sources');
  const mcseSource = object(providerSources.mcse_structure, 'geometry.provider_sources.mcse_structure');
  const selector = object(geometry.provider_geometry_selector, 'geometry.provider_geometry_selector');
  const stripGuard = object(geometry.prairie_strip_guard, 'geometry.prairie_strip_guard');
  const resolutionPolicy = object(geometry.resolution_policy, 'geometry.resolution_policy');
  if (candidateScope.provider_site !== siteIdentity.provider_site
    || candidateScope.treatment !== 'T4'
    || candidateScope.replicate !== 'R1'
    || candidateScope.prospective_field_id !== formalScope.field_id
    || candidateScope.prospective_zone_id !== formalScope.zone_id
    || selector.treatment !== 'T4'
    || selector.replicate !== 'R1'
    || selector.subplot !== 'main'
    || stripGuard.position !== 'CENTER_OF_T3_T4_PLOT'
    || stripGuard.strip_geometry_may_not_be_invented !== true
    || resolutionPolicy.formal_rebind_authorized_by_this_probe !== false
    || resolutionPolicy.ea5e2_authorized_by_this_probe !== false) {
    fail('GEOX_TARGET_AUTHORITY_GEOMETRY_INVALID', 'geometry provider selector or authority ceiling changed');
  }
  const experimentLocator = text(mcseSource.url, 'geometry provider MCSE URL');

  const requiredAmendmentMarkers = [
    'site: `KBS_MCSE_T4R1`',
    'provider treatment: `T4` / Biologically Based',
    'replicate: `R1`',
    'field: `field_kbs_mcse_t4r1`',
    'season: `season_2026_corn`',
    'zone: `zone_kbs_mcse_t4r1_crop_formal_v1`',
    'crop: corn',
    'hybrid: Blue River `43-96P`',
    'planting observation: KBS AgLog `6974`',
    'planting local date: `2026-05-27` in `America/Detroit`',
    `crop-only geometry semantic hash: \`${siteGeometry.semantic_hash}\``,
    'The whole T4R1 plot is not crop-only.',
    'Its central prairie strip remains excluded.'
  ];
  for (const marker of requiredAmendmentMarkers) requiredMarker(amendment, marker, amendmentSource.path);

  requiredRegex(runtime, /MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1\s*=\s*"EXTERNAL_PUBLIC_RESEARCH_SCOPE"\s+as const;/, runtimeSource.path);
  for (const [key, value] of Object.entries({
    tenant_id: formalScope.tenant_id,
    project_id: formalScope.project_id,
    group_id: formalScope.group_id,
    field_id: formalScope.field_id,
    season_id: formalScope.season_id,
    zone_id: formalScope.zone_id
  })) {
    requiredRegex(runtime, new RegExp(`${key}:\\s*"${value}"`), runtimeSource.path);
  }

  const authoritySources = GEOX_TARGET_AUTHORITY_PATHS.map((path) => {
    const source = byPath.get(path);
    return Object.freeze({ path, blob_sha: source.blobSha });
  });

  return Object.freeze({
    contract_version: GEOX_TARGET_AUTHORITY_EXPORT_VERSION,
    source_repository: repository,
    source_main_sha: commitSha,
    authority_sources: Object.freeze(authoritySources),
    provider_target: Object.freeze({
      experiment_locator: experimentLocator,
      provider_site: siteIdentity.provider_site,
      treatment_code: siteIdentity.provider_treatment_code,
      replicate_code: siteIdentity.replicate,
      crop_code: siteIdentity.crop,
      hybrid_code: siteIdentity.hybrid_product_code,
      planting_observation_id: '6974'
    }),
    geox_target: Object.freeze({
      field_id: formalScope.field_id,
      season_id: formalScope.season_id,
      zone_id: formalScope.zone_id,
      authority_scope_class: 'EXTERNAL_PUBLIC_RESEARCH_SCOPE',
      field_validity_proven: false,
      production_site_claimed: false
    }),
    geometry_boundary: Object.freeze({
      provider_selector: Object.freeze({ treatment: 'T4', replicate: 'R1', subplot: 'main' }),
      whole_plot_assumed_crop_only: false,
      prairie_strip_excluded: true,
      raw_provider_geometry_republished: false,
      geox_zone_geometry_equal_to_provider_plot_claimed: false
    }),
    authority_boundary: Object.freeze({
      adr_geox_identity_equality_claimed: false,
      field_actionability_authorized: false,
      dispatch_authorized: false,
      production_correspondence_claimed: false
    })
  });
}

function buildReceipt({ repository, requestedRef, commitSha, resolvedAt, sources, authorityExport }) {
  const sourceReceipts = GEOX_TARGET_AUTHORITY_PATHS.map((path) => {
    const source = sources.find((item) => item.path === path);
    return Object.freeze({
      path,
      blob_sha: source.blobSha,
      content_hash: source.contentHash
    });
  });
  const sourceManifest = Object.freeze(sourceReceipts.map((source) => Object.freeze({ ...source })));
  return Object.freeze({
    contract_version: GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION,
    resolution_class: GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
    transport_class: 'GITHUB_PUBLIC_REPOSITORY',
    source_repository: repository,
    requested_ref: requestedRef,
    resolved_commit_sha: commitSha,
    resolved_at: resolvedAt,
    replay_class: 'EXACT',
    authority_sources: sourceManifest,
    snapshot_manifest_hash: canonicalJsonHash(sourceManifest),
    authority_export_hash: canonicalJsonHash(authorityExport),
    field_actionability_authorized: false,
    dispatch_authorized: false,
    human_approval_authority: 'NONE',
    machine_execution_authority: 'NONE'
  });
}

export async function resolveGeoxTargetAuthority({
  ref = 'main',
  resolvedAt,
  repository = GEOX_TARGET_AUTHORITY_REPOSITORY,
  transport = createGitHubPublicAuthorityTransport(),
  snapshotStore = new GeoxTargetAuthoritySnapshotStore()
} = {}) {
  if (repository !== GEOX_TARGET_AUTHORITY_REPOSITORY) {
    fail('GEOX_TARGET_AUTHORITY_REPOSITORY_FORBIDDEN', `resolver v1 only permits ${GEOX_TARGET_AUTHORITY_REPOSITORY}`);
  }
  if (!transport || typeof transport.resolveRef !== 'function' || typeof transport.readFile !== 'function') {
    fail('GEOX_TARGET_AUTHORITY_TRANSPORT_INVALID', 'transport requires resolveRef and readFile');
  }
  if (!snapshotStore || typeof snapshotStore.retain !== 'function' || typeof snapshotStore.get !== 'function') {
    fail('GEOX_TARGET_AUTHORITY_SNAPSHOT_STORE_INVALID', 'exact snapshot store is required');
  }
  const requestedRef = text(ref, 'ref');
  const normalizedResolvedAt = requireTimestamp(resolvedAt, 'resolvedAt');
  const { commitSha } = object(await transport.resolveRef({ repository, ref: requestedRef }), 'resolved ref');
  const resolvedCommitSha = requireGitSha(commitSha, 'resolved commit sha');

  const sources = [];
  for (const path of GEOX_TARGET_AUTHORITY_PATHS) {
    const resolved = object(await transport.readFile({ repository, path, commitSha: resolvedCommitSha }), `resolved ${path}`);
    if (!Buffer.isBuffer(resolved.bytes)) {
      fail('GEOX_TARGET_AUTHORITY_BYTES_REQUIRED', `${path} transport bytes must be Buffer`);
    }
    const blobSha = requireGitSha(resolved.blobSha, `${path} blob sha`);
    if (gitBlobSha(resolved.bytes) !== blobSha) {
      fail('GEOX_TARGET_AUTHORITY_BLOB_HASH_MISMATCH', `${path} does not reproduce its Git blob SHA`);
    }
    const contentHash = snapshotStore.retain(resolved.bytes);
    sources.push(Object.freeze({ path, blobSha, contentHash, bytes: Buffer.from(resolved.bytes) }));
  }

  const authorityExport = compileAuthorityExport({ repository, commitSha: resolvedCommitSha, sources });
  const receipt = buildReceipt({
    repository,
    requestedRef,
    commitSha: resolvedCommitSha,
    resolvedAt: normalizedResolvedAt,
    sources,
    authorityExport
  });
  return Object.freeze({ authorityExport, receipt, snapshotStore });
}

function normalizeReplayReceipt(receipt) {
  const input = object(receipt, 'receipt');
  if (input.contract_version !== GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION
    || input.resolution_class !== GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS
    || input.transport_class !== 'GITHUB_PUBLIC_REPOSITORY'
    || input.source_repository !== GEOX_TARGET_AUTHORITY_REPOSITORY
    || input.replay_class !== 'EXACT'
    || input.field_actionability_authorized !== false
    || input.dispatch_authorized !== false
    || input.human_approval_authority !== 'NONE'
    || input.machine_execution_authority !== 'NONE') {
    fail('GEOX_TARGET_AUTHORITY_RECEIPT_INVALID', 'receipt authority boundary or contract changed');
  }
  const commitSha = requireGitSha(input.resolved_commit_sha, 'receipt.resolved_commit_sha');
  requireTimestamp(input.resolved_at, 'receipt.resolved_at');
  if (!Array.isArray(input.authority_sources) || input.authority_sources.length !== GEOX_TARGET_AUTHORITY_PATHS.length) {
    fail('GEOX_TARGET_AUTHORITY_RECEIPT_INVALID', 'receipt requires exact authority source set');
  }
  const sourceByPath = new Map();
  for (const source of input.authority_sources) {
    const normalized = object(source, 'receipt.authority_sources[]');
    if (!GEOX_TARGET_AUTHORITY_PATHS.includes(normalized.path)
      || sourceByPath.has(normalized.path)
      || !GIT_SHA_RE.test(normalized.blob_sha)
      || !HASH_RE.test(normalized.content_hash)) {
      fail('GEOX_TARGET_AUTHORITY_RECEIPT_INVALID', 'receipt source pin is invalid');
    }
    sourceByPath.set(normalized.path, Object.freeze({
      path: normalized.path,
      blobSha: normalized.blob_sha,
      contentHash: normalized.content_hash
    }));
  }
  if (!GEOX_TARGET_AUTHORITY_PATHS.every((path) => sourceByPath.has(path))) {
    fail('GEOX_TARGET_AUTHORITY_RECEIPT_INVALID', 'receipt source path is missing');
  }
  const canonicalSources = GEOX_TARGET_AUTHORITY_PATHS.map((path) => {
    const source = sourceByPath.get(path);
    return { path, blob_sha: source.blobSha, content_hash: source.contentHash };
  });
  if (canonicalJsonHash(canonicalSources) !== input.snapshot_manifest_hash) {
    fail('GEOX_TARGET_AUTHORITY_RECEIPT_HASH_MISMATCH', 'receipt snapshot manifest hash is not reproducible');
  }
  return Object.freeze({
    repository: input.source_repository,
    requestedRef: text(input.requested_ref, 'receipt.requested_ref'),
    commitSha,
    authorityExportHash: text(input.authority_export_hash, 'receipt.authority_export_hash'),
    sources: Object.freeze(GEOX_TARGET_AUTHORITY_PATHS.map((path) => sourceByPath.get(path)))
  });
}

export function replayGeoxTargetAuthorityResolution({ receipt, snapshotStore }) {
  if (!snapshotStore || typeof snapshotStore.get !== 'function') {
    fail('GEOX_TARGET_AUTHORITY_SNAPSHOT_STORE_INVALID', 'replay requires exact snapshot store');
  }
  const normalized = normalizeReplayReceipt(receipt);
  const sources = normalized.sources.map((source) => {
    const bytes = snapshotStore.get(source.contentHash);
    if (sha256(bytes) !== source.contentHash) {
      fail('GEOX_TARGET_AUTHORITY_SNAPSHOT_HASH_MISMATCH', `${source.path} snapshot SHA-256 changed`);
    }
    if (gitBlobSha(bytes) !== source.blobSha) {
      fail('GEOX_TARGET_AUTHORITY_BLOB_HASH_MISMATCH', `${source.path} snapshot Git blob SHA changed`);
    }
    return Object.freeze({ ...source, bytes });
  });
  const authorityExport = compileAuthorityExport({
    repository: normalized.repository,
    commitSha: normalized.commitSha,
    sources
  });
  if (canonicalJsonHash(authorityExport) !== normalized.authorityExportHash) {
    fail('GEOX_TARGET_AUTHORITY_RECEIPT_HASH_MISMATCH', 'replayed authority export differs from online resolution');
  }
  return Object.freeze({ authorityExport, replayClass: 'EXACT' });
}
