import {
  GENERIC_INTEGRATION_MESSAGE_VERSION,
  INTEGRATION_ROLES
} from '../../../sdks/typescript/src/index.mjs';

export const GEOX_TARGET_IDENTITY_TOKEN_VERSION = 'adr.geox-target-identity-token.v1';
export const GEOX_TARGET_IDENTITY_MESSAGE_TYPE = 'ADR_SOURCE_BACKED_FARM_TARGET_PUBLISHED';
export const GEOX_TARGET_IDENTITY_MAPPING_STATUS = 'UNRESOLVED_GEOX_FIELD_MAPPING';
export const GEOX_TARGET_IDENTITY_AUTHORITY_CLAIM =
  'NONE_ADR_FARM_TOKEN_IS_NOT_GEOX_FIELD_IDENTITY';

const EXPECTED_AUTHORITY_KINDS = Object.freeze([
  'DecisionProblem',
  'AgronomicDecisionProblemFarmTargetBindingCompilation',
  'AgronomicContextTargetRefFarmInstanceProjectionCompilation'
]);
const TARGET_ID_RE = /^target_src_[0-9a-f]{64}$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export class GeoxTargetIdentityTokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxTargetIdentityTokenError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GeoxTargetIdentityTokenError(
      'INVALID_GEOX_TARGET_IDENTITY_INPUT',
      `${name} must be a non-empty string`
    );
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GeoxTargetIdentityTokenError(
      'INVALID_GEOX_TARGET_IDENTITY_INPUT',
      `${name} must be an object`
    );
  }
  return value;
}

function exactKeys(value, name, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new GeoxTargetIdentityTokenError(
        'GEOX_TARGET_IDENTITY_FIELD_FORBIDDEN',
        `${name}.${key} is not part of the GEOX target identity token contract`
      );
    }
  }
}

function normalizeConsumerScope(value) {
  const scope = object(value, 'consumerScope');
  exactKeys(scope, 'consumerScope', new Set(['tenantId', 'projectId', 'groupId']));
  return Object.freeze({
    tenant_id: requiredText(scope.tenantId, 'consumerScope.tenantId'),
    project_id: requiredText(scope.projectId, 'consumerScope.projectId'),
    group_id: requiredText(scope.groupId, 'consumerScope.groupId')
  });
}

function normalizeWireRef(value, name) {
  const ref = object(value, name);
  exactKeys(ref, name, new Set(['kind', 'logical_id', 'version', 'semantic_hash']));
  const normalized = Object.freeze({
    kind: requiredText(ref.kind, `${name}.kind`),
    logical_id: requiredText(ref.logical_id, `${name}.logical_id`),
    version: requiredText(ref.version, `${name}.version`),
    semantic_hash: requiredText(ref.semantic_hash, `${name}.semantic_hash`)
  });
  if (!HASH_RE.test(normalized.semantic_hash)) {
    throw new GeoxTargetIdentityTokenError(
      'INVALID_GEOX_TARGET_IDENTITY_AUTHORITY_REF',
      `${name}.semantic_hash must be canonical sha256:<64 lowercase hex>`
    );
  }
  return normalized;
}

function normalizeAuthorityChain(values) {
  if (!Array.isArray(values)) {
    throw new GeoxTargetIdentityTokenError(
      'GEOX_TARGET_IDENTITY_AUTHORITY_CHAIN_REQUIRED',
      'message.authority_refs must be an array'
    );
  }
  const refs = values.map((value, index) =>
    normalizeWireRef(value, `message.authority_refs[${index}]`));
  if (refs.length !== EXPECTED_AUTHORITY_KINDS.length) {
    throw new GeoxTargetIdentityTokenError(
      'GEOX_TARGET_IDENTITY_AUTHORITY_CHAIN_REQUIRED',
      'GEOX target identity token requires DecisionProblem + DEC-0032 binding + DEC-0027 projection refs'
    );
  }
  const byKind = new Map();
  for (const ref of refs) {
    if (!EXPECTED_AUTHORITY_KINDS.includes(ref.kind) || byKind.has(ref.kind)) {
      throw new GeoxTargetIdentityTokenError(
        'GEOX_TARGET_IDENTITY_AUTHORITY_CHAIN_REQUIRED',
        'authority chain must contain exactly one ref of each required kind'
      );
    }
    byKind.set(ref.kind, ref);
  }
  return Object.freeze(Object.fromEntries(
    EXPECTED_AUTHORITY_KINDS.map((kind) => [kind, byKind.get(kind)])
  ));
}

function normalizeAdrTargetRef(value) {
  const target = object(value, 'message.payload.adr_target_ref');
  exactKeys(
    target,
    'message.payload.adr_target_ref',
    new Set(['organization_id', 'tenant_id', 'farm_id'])
  );
  const farmId = requiredText(target.farm_id, 'message.payload.adr_target_ref.farm_id');
  if (!TARGET_ID_RE.test(farmId)) {
    throw new GeoxTargetIdentityTokenError(
      'GEOX_TARGET_IDENTITY_SOURCE_BACKED_FARM_ID_REQUIRED',
      'ADR farm identity must be a source-backed target_src_<64 lowercase hex> token'
    );
  }
  return Object.freeze({
    organization_id: requiredText(
      target.organization_id,
      'message.payload.adr_target_ref.organization_id'
    ),
    ...(target.tenant_id !== undefined
      ? { tenant_id: requiredText(target.tenant_id, 'message.payload.adr_target_ref.tenant_id') }
      : {}),
    farm_id: farmId
  });
}

export function consumeAdrTargetIdentityTokenForGeox({ message, consumerScope }) {
  const input = object(message, 'message');
  const routingScope = normalizeConsumerScope(consumerScope);
  if (input.contract_version !== GENERIC_INTEGRATION_MESSAGE_VERSION
    || input.role !== 'RESULT_SINK'
    || INTEGRATION_ROLES.RESULT_SINK.status !== 'ACTIVE_PILOT'
    || input.message_type !== GEOX_TARGET_IDENTITY_MESSAGE_TYPE) {
    throw new GeoxTargetIdentityTokenError(
      'INVALID_GEOX_TARGET_IDENTITY_MESSAGE',
      `expected active RESULT_SINK ${GEOX_TARGET_IDENTITY_MESSAGE_TYPE} integration message`
    );
  }

  const authorityChain = normalizeAuthorityChain(input.authority_refs);
  const payload = object(input.payload, 'message.payload');
  exactKeys(
    payload,
    'message.payload',
    new Set(['adr_target_ref', 'farm_id_authority_classification'])
  );
  const targetRef = normalizeAdrTargetRef(payload.adr_target_ref);
  const classification = requiredText(
    payload.farm_id_authority_classification,
    'message.payload.farm_id_authority_classification'
  );
  if (classification !== 'EXACT_DEC_0027_SOURCE_BACKED') {
    throw new GeoxTargetIdentityTokenError(
      'GEOX_TARGET_IDENTITY_AUTHORITY_CLASSIFICATION_REQUIRED',
      'GEOX target identity token requires exact DEC-0027 source-backed FARM classification'
    );
  }

  return Object.freeze({
    contract_version: GEOX_TARGET_IDENTITY_TOKEN_VERSION,
    routing_scope: routingScope,
    adr_target_identity: Object.freeze({
      target_ref: targetRef,
      granularity: 'FARM',
      authority_classification: classification,
      authority_chain: authorityChain
    }),
    geox_field_mapping: Object.freeze({
      status: GEOX_TARGET_IDENTITY_MAPPING_STATUS,
      field_id: null,
      mapping_authority_ref: null
    }),
    field_actionable: false,
    dispatch_authorized: false,
    authority_claim: GEOX_TARGET_IDENTITY_AUTHORITY_CLAIM
  });
}
