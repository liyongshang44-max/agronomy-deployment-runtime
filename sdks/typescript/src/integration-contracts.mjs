export const INTEGRATION_ROLES = Object.freeze({
  CONTEXT_PROVIDER: Object.freeze({ status: 'ACTIVE_PILOT', direction: 'INBOUND' }),
  RESULT_SINK: Object.freeze({ status: 'ACTIVE_PILOT', direction: 'OUTBOUND' }),
  MODEL_EXECUTOR: Object.freeze({ status: 'RESERVED_NOT_EXERCISED_V0_3', direction: 'BIDIRECTIONAL' }),
  OUTCOME_PROVIDER: Object.freeze({ status: 'RESERVED_NOT_EXERCISED_V0_3', direction: 'INBOUND' })
});

export const GENERIC_INTEGRATION_MESSAGE_VERSION = 'adr.integration-message.v1';
export const GENERIC_BATCH_VERSION = 'adr.integration-batch.v1';
export const GENERIC_RESULT_EVENT_VERSION = 'adr.result-sink-event.v1';

export class IntegrationContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IntegrationContractError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new IntegrationContractError('INVALID_INTEGRATION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IntegrationContractError('INVALID_INTEGRATION_INPUT', `${name} must be an object`);
  }
  return value;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function exactAuthorityRef(value, name = 'authorityRef') {
  const input = object(value, name);
  const ref = {
    kind: text(input.kind, `${name}.kind`),
    logical_id: text(input.logical_id, `${name}.logical_id`),
    version: text(input.version, `${name}.version`),
    semantic_hash: text(input.semantic_hash, `${name}.semantic_hash`)
  };
  if (!ref.semantic_hash.startsWith('sha256:')) {
    throw new IntegrationContractError('INVALID_AUTHORITY_REF', `${name}.semantic_hash must be sha256 identity`);
  }
  return Object.freeze(ref);
}

export function createIntegrationMessage({ role, messageType, messageId, authorityRefs = [], payload }) {
  const roleName = text(role, 'role');
  if (!INTEGRATION_ROLES[roleName]) throw new IntegrationContractError('UNKNOWN_INTEGRATION_ROLE', `unknown role ${roleName}`);
  const refs = authorityRefs.map((ref, index) => exactAuthorityRef(ref, `authorityRefs[${index}]`));
  const keys = refs.map((ref) => JSON.stringify(ref));
  if (new Set(keys).size !== keys.length) throw new IntegrationContractError('DUPLICATE_AUTHORITY_REF', 'authorityRefs cannot contain duplicates');
  return Object.freeze({
    contract_version: GENERIC_INTEGRATION_MESSAGE_VERSION,
    role: roleName,
    message_type: text(messageType, 'messageType'),
    message_id: text(messageId, 'messageId'),
    authority_refs: Object.freeze(refs),
    payload: Object.freeze(clone(object(payload, 'payload')))
  });
}

export function createIntegrationBatch({ batchId, messages }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new IntegrationContractError('INVALID_INTEGRATION_BATCH', 'messages must be a non-empty array');
  }
  const normalized = messages.map((message, index) => {
    const value = object(message, `messages[${index}]`);
    if (value.contract_version !== GENERIC_INTEGRATION_MESSAGE_VERSION) {
      throw new IntegrationContractError('INVALID_INTEGRATION_BATCH', `messages[${index}] is not an ADR integration message`);
    }
    return clone(value);
  });
  const ids = normalized.map((message) => message.message_id);
  if (new Set(ids).size !== ids.length) throw new IntegrationContractError('DUPLICATE_INTEGRATION_MESSAGE', 'batch message ids must be unique');
  return Object.freeze({
    contract_version: GENERIC_BATCH_VERSION,
    batch_id: text(batchId, 'batchId'),
    messages: Object.freeze(normalized.map(Object.freeze))
  });
}

export function createResultSinkEvent({ eventId, eventType, authorityRef, projectionHash, payload = {} }) {
  if ((authorityRef ? 1 : 0) + (projectionHash ? 1 : 0) !== 1) {
    throw new IntegrationContractError('RESULT_IDENTITY_REQUIRED', 'result event requires exactly one authorityRef or non-authority projectionHash');
  }
  const event = {
    contract_version: GENERIC_RESULT_EVENT_VERSION,
    event_id: text(eventId, 'eventId'),
    event_type: text(eventType, 'eventType'),
    ...(authorityRef ? { authority_ref: exactAuthorityRef(authorityRef) } : { projection_hash: text(projectionHash, 'projectionHash') }),
    payload: Object.freeze(clone(object(payload, 'payload')))
  };
  if (event.projection_hash && !event.projection_hash.startsWith('sha256:')) {
    throw new IntegrationContractError('INVALID_PROJECTION_HASH', 'projectionHash must be sha256 identity');
  }
  return Object.freeze(event);
}

const ALLOWED_MAPPING_MODES = new Set(['EXACT_COPY', 'EXPLICIT_CONSTANT']);

export function normalizeAdapterMappingRule(rule) {
  const input = object(rule, 'mappingRule');
  const allowedKeys = new Set(['source_field', 'target_field', 'mode', 'constant']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new IntegrationContractError('HIDDEN_ADAPTER_TRANSFORM_FORBIDDEN', `mappingRule.${key} is not allowed`);
  }
  const mode = text(input.mode, 'mappingRule.mode');
  if (!ALLOWED_MAPPING_MODES.has(mode)) {
    throw new IntegrationContractError('HIDDEN_ADAPTER_TRANSFORM_FORBIDDEN', `unsupported mapping mode ${mode}`);
  }
  const target = text(input.target_field, 'mappingRule.target_field');
  if (mode === 'EXACT_COPY') {
    if ('constant' in input) throw new IntegrationContractError('INVALID_MAPPING_RULE', 'EXACT_COPY cannot define constant');
    return Object.freeze({ source_field: text(input.source_field, 'mappingRule.source_field'), target_field: target, mode });
  }
  if ('source_field' in input) throw new IntegrationContractError('INVALID_MAPPING_RULE', 'EXPLICIT_CONSTANT cannot define source_field');
  if (!('constant' in input)) throw new IntegrationContractError('INVALID_MAPPING_RULE', 'EXPLICIT_CONSTANT requires constant');
  return Object.freeze({ target_field: target, mode, constant: clone(input.constant) });
}

function setPath(target, path, value) {
  const parts = path.split('.').map((part) => text(part, 'target path segment'));
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (Object.prototype.hasOwnProperty.call(cursor, part) && (typeof cursor[part] !== 'object' || Array.isArray(cursor[part]))) {
      throw new IntegrationContractError('MAPPING_PATH_CONFLICT', `target path ${path} conflicts at ${part}`);
    }
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  const leaf = parts.at(-1);
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) throw new IntegrationContractError('DUPLICATE_MAPPING_TARGET', `target ${path} is assigned twice`);
  cursor[leaf] = clone(value);
}

export function applyExplicitAdapterMapping(source, rules) {
  const input = object(source, 'source');
  if (!Array.isArray(rules) || rules.length === 0) throw new IntegrationContractError('MAPPING_RULES_REQUIRED', 'rules must be a non-empty array');
  const output = {};
  for (const rawRule of rules) {
    const rule = normalizeAdapterMappingRule(rawRule);
    if (rule.mode === 'EXACT_COPY') {
      if (!Object.prototype.hasOwnProperty.call(input, rule.source_field)) {
        throw new IntegrationContractError('SOURCE_FIELD_MISSING', `source field ${rule.source_field} is missing; adapter cannot invent/default it`);
      }
      setPath(output, rule.target_field, input[rule.source_field]);
    } else {
      setPath(output, rule.target_field, rule.constant);
    }
  }
  return Object.freeze(clone(output));
}

export function assertPilotRoleEnabled(role) {
  const name = text(role, 'role');
  const contract = INTEGRATION_ROLES[name];
  if (!contract) throw new IntegrationContractError('UNKNOWN_INTEGRATION_ROLE', `unknown role ${name}`);
  if (contract.status !== 'ACTIVE_PILOT') {
    throw new IntegrationContractError('INTEGRATION_ROLE_NOT_EXERCISED', `${name} is reserved but not exercised by v0.3 Gate-A pilot`);
  }
  return contract;
}
