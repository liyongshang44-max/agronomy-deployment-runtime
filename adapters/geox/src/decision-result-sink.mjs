import { GENERIC_RESULT_EVENT_VERSION } from '../../../sdks/typescript/src/index.mjs';

export const GEOX_DECISION_RESULT_SINK_VERSION = 'adr.geox-decision-result-sink.v1';
export const GEOX_DECISION_RESULT_TARGET_BINDING_MODE = 'ADR_TARGET_UNBOUND_TO_GEOX_FIELD';
export const GEOX_DECISION_RESULT_CONSUMER_DISPOSITION = 'DISPLAY_ONLY_ADVISORY_CANDIDATE';
export const GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY = Object.freeze({
  humanApprovalAuthority: 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY',
  machineExecutionAuthority: 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY'
});

export class GeoxDecisionResultSinkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxDecisionResultSinkError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GeoxDecisionResultSinkError('INVALID_GEOX_DECISION_RESULT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GeoxDecisionResultSinkError('INVALID_GEOX_DECISION_RESULT_INPUT', `${name} must be an object`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, name, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new GeoxDecisionResultSinkError(
        'GEOX_DECISION_RESULT_PAYLOAD_FIELD_FORBIDDEN',
        `${name}.${key} is not part of the frozen GEOX DecisionResult sink contract`
      );
    }
  }
}

function exactWireAuthorityRef(value, name = 'authority_ref') {
  const ref = object(value, name);
  exactKeys(ref, name, new Set(['kind', 'logical_id', 'version', 'semantic_hash']));
  const output = Object.freeze({
    kind: text(ref.kind, `${name}.kind`),
    logical_id: text(ref.logical_id, `${name}.logical_id`),
    version: text(ref.version, `${name}.version`),
    semantic_hash: text(ref.semantic_hash, `${name}.semantic_hash`)
  });
  if (!/^sha256:[a-f0-9]{64}$/.test(output.semantic_hash)) {
    throw new GeoxDecisionResultSinkError(
      'INVALID_GEOX_DECISION_RESULT_AUTHORITY_REF',
      `${name}.semantic_hash must be canonical sha256:<64 lowercase hex>`
    );
  }
  return output;
}

function normalizeConsumerScope(value) {
  const scope = object(value, 'consumerScope');
  exactKeys(scope, 'consumerScope', new Set(['tenantId', 'projectId', 'groupId']));
  return Object.freeze({
    tenant_id: text(scope.tenantId, 'consumerScope.tenantId'),
    project_id: text(scope.projectId, 'consumerScope.projectId'),
    group_id: text(scope.groupId, 'consumerScope.groupId')
  });
}

function normalizeTargetBinding(value) {
  const binding = object(value, 'event.payload.target_binding');
  exactKeys(binding, 'event.payload.target_binding', new Set(['mode', 'reason_code']));
  const mode = text(binding.mode, 'event.payload.target_binding.mode');
  if (mode !== GEOX_DECISION_RESULT_TARGET_BINDING_MODE) {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_TARGET_BINDING_REQUIRED',
      'v1 sink accepts only DecisionResults that remain explicitly unbound to a GEOX field'
    );
  }
  return Object.freeze({
    mode,
    reason_code: text(binding.reason_code, 'event.payload.target_binding.reason_code')
  });
}

function normalizeStructuredAction(value, disposition) {
  if (disposition === 'ABSTAIN') {
    if (value !== null && value !== undefined) {
      throw new GeoxDecisionResultSinkError(
        'GEOX_DECISION_RESULT_ACTION_MISMATCH',
        'ABSTAIN DecisionResult cannot carry a structured action into the GEOX sink'
      );
    }
    return null;
  }
  const action = object(value, 'event.payload.structured_action');
  if (text(action.contractVersion, 'event.payload.structured_action.contractVersion') !== 'adr.material-action-signature.v1') {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_ACTION_CONTRACT_REQUIRED',
      'ACT DecisionResult requires adr.material-action-signature.v1 structured action'
    );
  }
  text(action.actionCode, 'event.payload.structured_action.actionCode');
  if (!Array.isArray(action.materialParameters)) {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_ACTION_CONTRACT_REQUIRED',
      'structured_action.materialParameters must be an array'
    );
  }
  return Object.freeze(clone(action));
}

export function consumeAdrDecisionResultForGeox({ event, consumerScope }) {
  const input = object(event, 'event');
  const routingScope = normalizeConsumerScope(consumerScope);
  if (input.contract_version !== GENERIC_RESULT_EVENT_VERSION || input.event_type !== 'DECISION_RESULT_PUBLISHED') {
    throw new GeoxDecisionResultSinkError(
      'INVALID_GEOX_DECISION_RESULT_EVENT',
      'expected adr.result-sink-event.v1 DECISION_RESULT_PUBLISHED'
    );
  }
  if (input.projection_hash !== undefined || input.authority_ref === undefined) {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_AUTHORITY_REF_REQUIRED',
      'GEOX DecisionResult sink requires exact DecisionResult authority identity'
    );
  }
  const ref = exactWireAuthorityRef(input.authority_ref);
  if (ref.kind !== 'DecisionResult') {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_AUTHORITY_REF_REQUIRED',
      'authority_ref must be DecisionResult'
    );
  }

  const payload = object(input.payload, 'event.payload');
  exactKeys(payload, 'event.payload', new Set([
    'decision_disposition',
    'structured_action',
    'human_approval_authority',
    'machine_execution_authority',
    'target_binding'
  ]));

  const disposition = text(payload.decision_disposition, 'event.payload.decision_disposition');
  if (!['ACT', 'ABSTAIN'].includes(disposition)) {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_DISPOSITION_UNSUPPORTED',
      `unsupported DecisionResult disposition ${disposition}`
    );
  }

  const humanApprovalAuthority = text(
    payload.human_approval_authority,
    'event.payload.human_approval_authority'
  );
  const machineExecutionAuthority = text(
    payload.machine_execution_authority,
    'event.payload.machine_execution_authority'
  );
  if (humanApprovalAuthority !== GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority
    || machineExecutionAuthority !== GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority) {
    throw new GeoxDecisionResultSinkError(
      'GEOX_DECISION_RESULT_AUTHORITY_ESCALATION_FORBIDDEN',
      'GEOX sink refuses DecisionResult payloads that claim human approval or machine execution authority'
    );
  }

  const targetBinding = normalizeTargetBinding(payload.target_binding);
  const structuredAction = normalizeStructuredAction(payload.structured_action, disposition);

  return Object.freeze({
    contract_version: GEOX_DECISION_RESULT_SINK_VERSION,
    routing_scope: routingScope,
    adr_decision_result_ref: ref,
    decision_disposition: disposition,
    adr_structured_action: structuredAction,
    target_binding: Object.freeze({
      status: 'UNRESOLVED',
      source_mode: targetBinding.mode,
      reason_code: targetBinding.reason_code
    }),
    consumer_disposition: GEOX_DECISION_RESULT_CONSUMER_DISPOSITION,
    dispatch_authorized: false,
    field_actionable: false,
    upstream_authority_boundary: Object.freeze({
      human_approval_authority: humanApprovalAuthority,
      machine_execution_authority: machineExecutionAuthority
    }),
    authority_claim: 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY'
  });
}
