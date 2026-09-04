import { createHash } from 'node:crypto';

import {
  GENERIC_INTEGRATION_MESSAGE_VERSION,
  INTEGRATION_ROLES
} from '../../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_AUTHORITY_EXPORT_VERSION,
  GEOX_TARGET_AUTHORITY_PATHS,
  GEOX_TARGET_AUTHORITY_REPOSITORY,
  GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
  GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION
} from './target-authority-resolver.mjs';

export const GEOX_TARGET_CORRESPONDENCE_VERSION = 'adr.geox-target-correspondence.v1';
export const GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE = 'ADR_PROVIDER_TARGET_CORRESPONDENCE_CANDIDATE';
export const GEOX_TARGET_CORRESPONDENCE_RELATION = 'CORRESPONDS_TO_SAME_KBS_MCSE_T4_R1_TARGET';
export const GEOX_TARGET_CORRESPONDENCE_STATUS = 'QUALIFIED_CORRESPONDENCE';
export const GEOX_TARGET_CORRESPONDENCE_AUTHORITY_CLAIM =
  'CORRESPONDENCE_ONLY_NOT_IDENTITY_ACTION_APPROVAL_OR_EXECUTION_AUTHORITY';

const LEGACY_GEOX_TARGET_AUTHORITY_EXPORT_VERSION = 'adr.acceptance.geox-target-authority-export.v1';
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const EXPECTED_GEOX_AUTHORITY_PATHS = GEOX_TARGET_AUTHORITY_PATHS;

export class GeoxTargetCorrespondenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxTargetCorrespondenceError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxTargetCorrespondenceError(code, message);
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_GEOX_TARGET_CORRESPONDENCE_INPUT', `${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_GEOX_TARGET_CORRESPONDENCE_INPUT', `${name} must be non-empty text`);
  }
  return value.trim();
}

function exactKeys(value, name, keys) {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) fail('GEOX_TARGET_CORRESPONDENCE_FIELD_FORBIDDEN', `${name}.${key} is forbidden`);
  }
}

function canonicalJsonHash(value) {
  return `sha256:${createHash('sha256').update(Buffer.from(JSON.stringify(value), 'utf8')).digest('hex')}`;
}

function normalizeWireRef(value, name) {
  const ref = object(value, name);
  exactKeys(ref, name, new Set(['kind', 'logical_id', 'version', 'semantic_hash']));
  const semanticHash = text(ref.semantic_hash, `${name}.semantic_hash`);
  if (!HASH_RE.test(semanticHash)) fail('GEOX_TARGET_CORRESPONDENCE_AUTHORITY_REF_INVALID', `${name} requires canonical sha256 semantic hash`);
  return Object.freeze({
    kind: text(ref.kind, `${name}.kind`),
    logical_id: text(ref.logical_id, `${name}.logical_id`),
    version: text(ref.version, `${name}.version`),
    semantic_hash: semanticHash
  });
}

function normalizeAdrAuthorityRefs(values) {
  if (!Array.isArray(values)) fail('GEOX_TARGET_CORRESPONDENCE_ADR_AUTHORITY_REQUIRED', 'message.authority_refs must be an array');
  const refs = values.map((value, index) => normalizeWireRef(value, `message.authority_refs[${index}]`));
  const decision = refs.filter((ref) => ref.kind === 'DecisionProblem');
  const manifest = refs.filter((ref) => ref.kind === 'ContextManifest');
  const datums = refs.filter((ref) => ref.kind === 'ContextDatum');
  if (decision.length !== 1 || manifest.length !== 1 || datums.length !== 7 || refs.length !== 9) {
    fail(
      'GEOX_TARGET_CORRESPONDENCE_ADR_AUTHORITY_REQUIRED',
      'exact DecisionProblem + ContextManifest + seven ContextDatum authority refs are required'
    );
  }
  return Object.freeze({
    decision_problem_ref: decision[0],
    context_manifest_ref: manifest[0],
    context_datum_refs: Object.freeze(datums)
  });
}

function normalizeProviderTarget(value, name) {
  const target = object(value, name);
  exactKeys(target, name, new Set([
    'experiment_locator', 'treatment_code', 'replicate_code', 'crop_code',
    'hybrid_code', 'planting_observation_id'
  ]));
  return Object.freeze({
    experiment_locator: text(target.experiment_locator, `${name}.experiment_locator`),
    treatment_code: text(target.treatment_code, `${name}.treatment_code`),
    replicate_code: text(target.replicate_code, `${name}.replicate_code`),
    crop_code: text(target.crop_code, `${name}.crop_code`),
    hybrid_code: text(target.hybrid_code, `${name}.hybrid_code`),
    planting_observation_id: text(target.planting_observation_id, `${name}.planting_observation_id`)
  });
}

function normalizeGeoxAuthorityExport(value) {
  const authority = object(value, 'geoxTargetAuthority');
  exactKeys(authority, 'geoxTargetAuthority', new Set([
    'contract_version', 'source_repository', 'source_main_sha', 'authority_sources',
    'provider_target', 'geox_target', 'geometry_boundary', 'authority_boundary'
  ]));
  if (![LEGACY_GEOX_TARGET_AUTHORITY_EXPORT_VERSION, GEOX_TARGET_AUTHORITY_EXPORT_VERSION].includes(authority.contract_version)
    || authority.source_repository !== GEOX_TARGET_AUTHORITY_REPOSITORY
    || !GIT_SHA_RE.test(text(authority.source_main_sha, 'geoxTargetAuthority.source_main_sha'))) {
    fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', 'pinned or resolver-produced GEOX authority export is required');
  }

  if (!Array.isArray(authority.authority_sources) || authority.authority_sources.length !== EXPECTED_GEOX_AUTHORITY_PATHS.length) {
    fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', 'exact GEOX authority source set is required');
  }
  const sourceByPath = new Map();
  for (const [index, item] of authority.authority_sources.entries()) {
    const source = object(item, `geoxTargetAuthority.authority_sources[${index}]`);
    exactKeys(source, `geoxTargetAuthority.authority_sources[${index}]`, new Set(['path', 'blob_sha']));
    const path = text(source.path, `authority_sources[${index}].path`);
    const blobSha = text(source.blob_sha, `authority_sources[${index}].blob_sha`);
    if (!GIT_SHA_RE.test(blobSha) || sourceByPath.has(path)) {
      fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', 'authority sources require unique pinned Git blobs');
    }
    sourceByPath.set(path, blobSha);
  }
  if (!EXPECTED_GEOX_AUTHORITY_PATHS.every((path) => sourceByPath.has(path))) {
    fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_AUTHORITY_INVALID', 'required GEOX authority path is missing');
  }

  const provider = object(authority.provider_target, 'geoxTargetAuthority.provider_target');
  exactKeys(provider, 'geoxTargetAuthority.provider_target', new Set([
    'experiment_locator', 'provider_site', 'treatment_code', 'replicate_code',
    'crop_code', 'hybrid_code', 'planting_observation_id'
  ]));
  if (provider.provider_site !== 'KBS_LTER_MAIN_CROPPING_SYSTEM_EXPERIMENT') {
    fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_TARGET_INVALID', 'GEOX provider site must remain exact KBS MCSE authority');
  }
  const providerTarget = normalizeProviderTarget({
    experiment_locator: provider.experiment_locator,
    treatment_code: provider.treatment_code,
    replicate_code: provider.replicate_code,
    crop_code: provider.crop_code,
    hybrid_code: provider.hybrid_code,
    planting_observation_id: provider.planting_observation_id
  }, 'geoxTargetAuthority.provider_target');

  const geoxTarget = object(authority.geox_target, 'geoxTargetAuthority.geox_target');
  exactKeys(geoxTarget, 'geoxTargetAuthority.geox_target', new Set([
    'field_id', 'season_id', 'zone_id', 'authority_scope_class',
    'field_validity_proven', 'production_site_claimed'
  ]));
  if (geoxTarget.authority_scope_class !== 'EXTERNAL_PUBLIC_RESEARCH_SCOPE'
    || geoxTarget.field_validity_proven !== false
    || geoxTarget.production_site_claimed !== false) {
    fail('GEOX_TARGET_CORRESPONDENCE_CONSUMER_TARGET_INVALID', 'GEOX target must preserve formal research-scope limitations');
  }

  const geometry = object(authority.geometry_boundary, 'geoxTargetAuthority.geometry_boundary');
  const selector = object(geometry.provider_selector, 'geoxTargetAuthority.geometry_boundary.provider_selector');
  if (selector.treatment !== providerTarget.treatment_code
    || selector.replicate !== providerTarget.replicate_code
    || selector.subplot !== 'main'
    || geometry.whole_plot_assumed_crop_only !== false
    || geometry.prairie_strip_excluded !== true
    || geometry.raw_provider_geometry_republished !== false
    || geometry.geox_zone_geometry_equal_to_provider_plot_claimed !== false) {
    fail('GEOX_TARGET_CORRESPONDENCE_GEOMETRY_BOUNDARY_REQUIRED', 'GEOX crop-only geometry limitations must remain intact');
  }

  const boundary = object(authority.authority_boundary, 'geoxTargetAuthority.authority_boundary');
  if (boundary.adr_geox_identity_equality_claimed !== false
    || boundary.field_actionability_authorized !== false
    || boundary.dispatch_authorized !== false
    || boundary.production_correspondence_claimed !== false) {
    fail('GEOX_TARGET_CORRESPONDENCE_AUTHORITY_PROMOTION_FORBIDDEN', 'consumer authority export may not promote correspondence into identity/action/execution authority');
  }

  return Object.freeze({
    contract_version: authority.contract_version,
    source_repository: authority.source_repository,
    source_main_sha: authority.source_main_sha,
    authority_sources: Object.freeze(Object.fromEntries(sourceByPath)),
    provider_target: providerTarget,
    geox_target: Object.freeze({
      field_id: text(geoxTarget.field_id, 'geoxTargetAuthority.geox_target.field_id'),
      season_id: text(geoxTarget.season_id, 'geoxTargetAuthority.geox_target.season_id'),
      zone_id: text(geoxTarget.zone_id, 'geoxTargetAuthority.geox_target.zone_id'),
      authority_scope_class: geoxTarget.authority_scope_class,
      field_validity_proven: false,
      production_site_claimed: false
    })
  });
}

function normalizeResolutionReceipt(value, geoxAuthority, rawAuthority) {
  if (value === undefined || value === null) {
    if (geoxAuthority.contract_version === GEOX_TARGET_AUTHORITY_EXPORT_VERSION) {
      fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_REQUIRED', 'resolver-produced authority export requires its exact replay receipt');
    }
    return Object.freeze({
      classification: 'PINNED_CONSUMER_AUTHORITY_EXPORT_QUALIFICATION_ONLY',
      receipt: null
    });
  }
  if (geoxAuthority.contract_version !== GEOX_TARGET_AUTHORITY_EXPORT_VERSION) {
    fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_INVALID', 'replay receipt requires resolver-produced authority export');
  }
  const receipt = object(value, 'geoxTargetAuthorityResolutionReceipt');
  exactKeys(receipt, 'geoxTargetAuthorityResolutionReceipt', new Set([
    'contract_version', 'resolution_class', 'transport_class', 'source_repository',
    'requested_ref', 'resolved_commit_sha', 'resolved_at', 'replay_class',
    'authority_sources', 'snapshot_manifest_hash', 'authority_export_hash',
    'field_actionability_authorized', 'dispatch_authorized',
    'human_approval_authority', 'machine_execution_authority'
  ]));
  if (receipt.contract_version !== GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION
    || receipt.resolution_class !== GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS
    || receipt.transport_class !== 'GITHUB_PUBLIC_REPOSITORY'
    || receipt.source_repository !== geoxAuthority.source_repository
    || receipt.resolved_commit_sha !== geoxAuthority.source_main_sha
    || receipt.replay_class !== 'EXACT'
    || receipt.field_actionability_authorized !== false
    || receipt.dispatch_authorized !== false
    || receipt.human_approval_authority !== 'NONE'
    || receipt.machine_execution_authority !== 'NONE') {
    fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_INVALID', 'replay receipt contract, source pin, or authority ceiling changed');
  }
  if (!HASH_RE.test(text(receipt.snapshot_manifest_hash, 'receipt.snapshot_manifest_hash'))
    || !HASH_RE.test(text(receipt.authority_export_hash, 'receipt.authority_export_hash'))
    || canonicalJsonHash(rawAuthority) !== receipt.authority_export_hash) {
    fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_HASH_MISMATCH', 'replay receipt does not bind exact GEOX authority export');
  }
  if (!Array.isArray(receipt.authority_sources) || receipt.authority_sources.length !== EXPECTED_GEOX_AUTHORITY_PATHS.length) {
    fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_INVALID', 'replay receipt requires exact GEOX source set');
  }
  const receiptByPath = new Map();
  for (const [index, item] of receipt.authority_sources.entries()) {
    const source = object(item, `geoxTargetAuthorityResolutionReceipt.authority_sources[${index}]`);
    exactKeys(source, `geoxTargetAuthorityResolutionReceipt.authority_sources[${index}]`, new Set(['path', 'blob_sha', 'content_hash']));
    const path = text(source.path, `receipt.authority_sources[${index}].path`);
    const blobSha = text(source.blob_sha, `receipt.authority_sources[${index}].blob_sha`);
    const contentHash = text(source.content_hash, `receipt.authority_sources[${index}].content_hash`);
    if (!EXPECTED_GEOX_AUTHORITY_PATHS.includes(path)
      || receiptByPath.has(path)
      || !GIT_SHA_RE.test(blobSha)
      || !HASH_RE.test(contentHash)
      || geoxAuthority.authority_sources[path] !== blobSha) {
      fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_INVALID', 'replay receipt source does not bind exact authority blob');
    }
    receiptByPath.set(path, Object.freeze({ path, blob_sha: blobSha, content_hash: contentHash }));
  }
  const canonicalSources = EXPECTED_GEOX_AUTHORITY_PATHS.map((path) => receiptByPath.get(path));
  if (canonicalSources.some((source) => !source)
    || canonicalJsonHash(canonicalSources) !== receipt.snapshot_manifest_hash) {
    fail('GEOX_TARGET_CORRESPONDENCE_RESOLUTION_RECEIPT_HASH_MISMATCH', 'replay receipt source manifest is not reproducible');
  }
  return Object.freeze({
    classification: GEOX_TARGET_AUTHORITY_RESOLUTION_CLASS,
    receipt: Object.freeze({
      contract_version: receipt.contract_version,
      requested_ref: text(receipt.requested_ref, 'receipt.requested_ref'),
      resolved_commit_sha: receipt.resolved_commit_sha,
      resolved_at: text(receipt.resolved_at, 'receipt.resolved_at'),
      replay_class: receipt.replay_class,
      snapshot_manifest_hash: receipt.snapshot_manifest_hash,
      authority_export_hash: receipt.authority_export_hash,
      authority_sources: Object.freeze(canonicalSources)
    })
  });
}

function sameProviderTarget(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

export function consumeAdrTargetCorrespondenceForGeox({
  message,
  consumerScope,
  geoxTargetAuthority,
  geoxTargetAuthorityResolutionReceipt
}) {
  const input = object(message, 'message');
  if (input.contract_version !== GENERIC_INTEGRATION_MESSAGE_VERSION
    || input.role !== 'RESULT_SINK'
    || INTEGRATION_ROLES.RESULT_SINK.status !== 'ACTIVE_PILOT'
    || input.message_type !== GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE) {
    fail('INVALID_GEOX_TARGET_CORRESPONDENCE_MESSAGE', `expected active RESULT_SINK ${GEOX_TARGET_CORRESPONDENCE_MESSAGE_TYPE} message`);
  }

  const scope = object(consumerScope, 'consumerScope');
  exactKeys(scope, 'consumerScope', new Set(['tenantId', 'projectId', 'groupId']));
  const routingScope = Object.freeze({
    tenant_id: text(scope.tenantId, 'consumerScope.tenantId'),
    project_id: text(scope.projectId, 'consumerScope.projectId'),
    group_id: text(scope.groupId, 'consumerScope.groupId')
  });

  const adrAuthority = normalizeAdrAuthorityRefs(input.authority_refs);
  const payload = object(input.payload, 'message.payload');
  exactKeys(payload, 'message.payload', new Set(['provider_target', 'relation_candidate', 'authority_nonclaims']));
  const adrProviderTarget = normalizeProviderTarget(payload.provider_target, 'message.payload.provider_target');
  if (payload.relation_candidate !== GEOX_TARGET_CORRESPONDENCE_RELATION) {
    fail('GEOX_TARGET_CORRESPONDENCE_RELATION_INVALID', 'only the exact T4/R1 correspondence relation is qualified by v1');
  }
  if (!Array.isArray(payload.authority_nonclaims)
    || !payload.authority_nonclaims.includes('NO_ADR_FIELD_ID_CREATED')
    || !payload.authority_nonclaims.includes('NO_GEOMETRY_REPUBLISHED')
    || !payload.authority_nonclaims.includes('NO_FIELD_ACTIONABILITY_AUTHORITY')
    || !payload.authority_nonclaims.includes('NO_DISPATCH_AUTHORITY')) {
    fail('GEOX_TARGET_CORRESPONDENCE_NONCLAIMS_REQUIRED', 'ADR provider target nonclaims are required');
  }

  const geoxAuthority = normalizeGeoxAuthorityExport(geoxTargetAuthority);
  const resolution = normalizeResolutionReceipt(
    geoxTargetAuthorityResolutionReceipt,
    geoxAuthority,
    geoxTargetAuthority
  );
  if (!sameProviderTarget(adrProviderTarget, geoxAuthority.provider_target)) {
    fail('GEOX_TARGET_CORRESPONDENCE_PROVIDER_TARGET_MISMATCH', 'ADR and GEOX do not independently resolve to the same provider target components');
  }

  return Object.freeze({
    contract_version: GEOX_TARGET_CORRESPONDENCE_VERSION,
    status: GEOX_TARGET_CORRESPONDENCE_STATUS,
    relation: GEOX_TARGET_CORRESPONDENCE_RELATION,
    routing_scope: routingScope,
    adr_target_authority: adrAuthority,
    provider_target: adrProviderTarget,
    geox_target: geoxAuthority.geox_target,
    consumer_authority_pin: Object.freeze({
      source_repository: geoxAuthority.source_repository,
      source_main_sha: geoxAuthority.source_main_sha,
      authority_sources: geoxAuthority.authority_sources,
      classification: resolution.classification,
      ...(resolution.receipt ? { resolution_receipt: resolution.receipt } : {})
    }),
    identity_equality_claimed: false,
    geometry_equality_claimed: false,
    zone_correspondence_claimed: false,
    field_actionable: false,
    dispatch_authorized: false,
    human_approval_authority: 'NONE',
    machine_execution_authority: 'NONE',
    authority_claim: GEOX_TARGET_CORRESPONDENCE_AUTHORITY_CLAIM
  });
}
