import { createHash } from 'node:crypto';

import {
  GENERIC_RESULT_EVENT_VERSION,
  createResultSinkEvent
} from '../../../sdks/typescript/src/index.mjs';

export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_SINK_VERSION = 'adr.geox-historical-decision-basis-projection-sink.v1';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION = 'adr.geox-historical-decision-basis-projection.v1';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE = 'HISTORICAL_DECISION_BASIS_PROJECTED';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION = 'HISTORICAL_AUDIT_DISPLAY_ONLY_NON_ACTIONABLE';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM = 'NONE_HISTORICAL_DECISION_BASIS_IS_NON_AUTHORITY_REPRODUCIBILITY_PROJECTION';

const EXPECTED_READ_MODEL_VERSION = 'adr.historical-decision-basis.read-model.v1';
const EXPECTED_READ_MODEL_AUTHORITY_CLASS = 'NONE_NON_AUTHORITY_RECONSTRUCTION_READ_MODEL';
const EXPECTED_BASIS_DIGEST_AUTHORITY = 'NONE_DIGEST_IS_REPRODUCIBILITY_EVIDENCE_NOT_AUTHORITY_REF';
const EXPECTED_GRAPH_CLASS = 'NONE_NON_AUTHORITY_EXACT_REF_GRAPH_PROJECTION';
const EXPECTED_DECISION_SEMANTICS_CLASS = 'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_SEMANTICS_PROJECTION';
const EXPECTED_DECISION_RESULT_CONTRACT_VERSION = 'adr.decision-result.v1';
const EXPECTED_DECISION_RESULT_AUTHORITY_CLASS = 'STRUCTURED_DECISION_AUTHORITY';
const EXPECTED_DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY';
const EXPECTED_DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY';
const EXPECTED_DECISION_RESULT_KEYS = Object.freeze([
  'contractVersion',
  'authorityClass',
  'decisionProblemRef',
  'decisionAuthority',
  'decisionDisposition',
  'structuredAction',
  'waitSemantics',
  'informationRequirementRefs',
  'abstentionReasonAuthority',
  'humanGate',
  'policyResultRefs',
  'decisionRobustnessRef',
  'runtimeAlternativeSetRef',
  'runtimeBindingRefs',
  'decidedAt',
  'humanApprovalAuthority',
  'machineExecutionAuthority'
]);
const EXPECTED_NONCLAIMS = Object.freeze([
  'humanApprovalAuthority',
  'dispatchAuthority',
  'machineExecutionAuthority',
  'executionReceiptAuthority',
  'outcomeAuthority',
  'causalAttributionAuthority'
]);

export class GeoxHistoricalDecisionBasisProjectionSinkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxHistoricalDecisionBasisProjectionSinkError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxHistoricalDecisionBasisProjectionSinkError(code, message);
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_INPUT', `${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, name, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('GEOX_HISTORICAL_BASIS_FIELD_FORBIDDEN', `${name}.${key} is not part of the v1 projection transport contract`);
    }
  }
}

function exactFieldSet(value, name, expected) {
  const allowed = new Set(expected);
  exactKeys(value, name, allowed);
  for (const key of expected) {
    if (!(key in value)) {
      fail('GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_INVALID', `${name}.${key} is required by the frozen D06 semantic payload`);
    }
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function sameCanonical(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(Buffer.from(canonicalJson(value), 'utf8')).digest('hex')}`;
}

function adrSemanticHash(kind, value) {
  const preimage = `adr-semantic-hash-v1\nkind:${kind}\n${canonicalJson(value)}`;
  return `sha256:${createHash('sha256').update(preimage, 'utf8').digest('hex')}`;
}

function canonicalSha256(value, name) {
  const hash = text(value, name);
  if (!/^sha256:[a-f0-9]{64}$/.test(hash)) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_HASH', `${name} must be canonical sha256:<64 lowercase hex>`);
  }
  return hash;
}

function nativeAuthorityRef(value, name) {
  const ref = object(value, name);
  exactKeys(ref, name, new Set(['kind', 'logicalId', 'version', 'semanticHash']));
  const output = Object.freeze({
    kind: text(ref.kind, `${name}.kind`),
    logicalId: text(ref.logicalId, `${name}.logicalId`),
    version: text(ref.version, `${name}.version`),
    semanticHash: canonicalSha256(ref.semanticHash, `${name}.semanticHash`)
  });
  return output;
}

function sameNativeRef(left, right) {
  return left.kind === right.kind
    && left.logicalId === right.logicalId
    && left.version === right.version
    && left.semanticHash === right.semanticHash;
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

function normalizeDecisionSemantics(basis, decisionResultRef) {
  const decisionSemantics = object(basis.decisionSemantics, 'historicalBasis.decisionSemantics');
  exactFieldSet(
    decisionSemantics,
    'historicalBasis.decisionSemantics',
    ['projectionClass', 'decisionResultRef', 'semanticPayload']
  );
  if (decisionSemantics.projectionClass !== EXPECTED_DECISION_SEMANTICS_CLASS) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_CLASS_REQUIRED',
      'decisionSemantics must remain a non-authority exact DecisionResult semantics projection'
    );
  }
  const semanticRef = nativeAuthorityRef(
    decisionSemantics.decisionResultRef,
    'historicalBasis.decisionSemantics.decisionResultRef'
  );
  if (!sameNativeRef(semanticRef, decisionResultRef)) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_REF_MISMATCH',
      'decisionSemantics must bind the same exact DecisionResult entry ref'
    );
  }

  const semanticPayload = object(
    decisionSemantics.semanticPayload,
    'historicalBasis.decisionSemantics.semanticPayload'
  );
  exactFieldSet(
    semanticPayload,
    'historicalBasis.decisionSemantics.semanticPayload',
    EXPECTED_DECISION_RESULT_KEYS
  );
  if (semanticPayload.contractVersion !== EXPECTED_DECISION_RESULT_CONTRACT_VERSION
    || semanticPayload.authorityClass !== EXPECTED_DECISION_RESULT_AUTHORITY_CLASS) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_INVALID',
      'decisionSemantics must carry the exact frozen D06 DecisionResult contract and authority class'
    );
  }
  if (semanticPayload.humanApprovalAuthority !== EXPECTED_DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY
    || semanticPayload.machineExecutionAuthority !== EXPECTED_DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY) {
    fail(
      'GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN',
      'DecisionResult semantics may not create human approval or machine execution authority'
    );
  }
  if (adrSemanticHash('DecisionResult', semanticPayload) !== decisionResultRef.semanticHash) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTIC_HASH_MISMATCH',
      'exact DecisionResult ref semanticHash does not bind the transported D06 semantic payload'
    );
  }

  const semanticDecisionProblemRef = nativeAuthorityRef(
    semanticPayload.decisionProblemRef,
    'historicalBasis.decisionSemantics.semanticPayload.decisionProblemRef'
  );
  const basisDecisionProblemRef = nativeAuthorityRef(
    basis.decisionProblemRef,
    'historicalBasis.decisionProblemRef'
  );
  if (!sameNativeRef(semanticDecisionProblemRef, basisDecisionProblemRef)
    || !sameCanonical(semanticPayload.decisionAuthority, basis.decisionAuthority)
    || semanticPayload.decisionDisposition !== basis.decisionDisposition
    || !sameCanonical(semanticPayload.structuredAction, basis.structuredAction)
    || semanticPayload.decidedAt !== basis.decidedAt
    || semanticPayload.humanApprovalAuthority !== basis.humanApprovalAuthority
    || semanticPayload.machineExecutionAuthority !== basis.machineExecutionAuthority) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_MISMATCH',
      'transported exact D06 semantics conflict with the legacy v1 historical basis summary fields'
    );
  }

  return Object.freeze(clone(decisionSemantics));
}

function normalizeHistoricalBasis(value) {
  const basis = object(value, 'historicalBasis');
  if (basis.readModelVersion !== EXPECTED_READ_MODEL_VERSION) {
    fail('GEOX_HISTORICAL_BASIS_VERSION_UNSUPPORTED', `expected ${EXPECTED_READ_MODEL_VERSION}`);
  }
  if (basis.authorityClass !== EXPECTED_READ_MODEL_AUTHORITY_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'historical basis must remain a non-authority reconstruction read model');
  }
  canonicalSha256(basis.basisDigest, 'historicalBasis.basisDigest');
  if (basis.basisDigestAuthority !== EXPECTED_BASIS_DIGEST_AUTHORITY) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'basisDigest may be used only as reproducibility evidence, never as an AuthorityRef');
  }

  const decisionResultRef = nativeAuthorityRef(basis.decisionResultRef, 'historicalBasis.decisionResultRef');
  if (decisionResultRef.kind !== 'DecisionResult') {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_REQUIRED', 'historical basis entry ref must be DecisionResult');
  }
  normalizeDecisionSemantics(basis, decisionResultRef);

  const nonclaims = object(basis.nonclaims, 'historicalBasis.nonclaims');
  exactKeys(nonclaims, 'historicalBasis.nonclaims', new Set(EXPECTED_NONCLAIMS));
  for (const name of EXPECTED_NONCLAIMS) {
    if (nonclaims[name] !== false) {
      fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', `historicalBasis.nonclaims.${name} must remain false`);
    }
  }

  const graph = object(basis.authorityGraph, 'historicalBasis.authorityGraph');
  if (graph.projectionClass !== EXPECTED_GRAPH_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_GRAPH_CLASS_REQUIRED', 'authorityGraph must remain a non-authority exact-ref inspection projection');
  }
  const graphEntryRef = nativeAuthorityRef(graph.entryRef, 'historicalBasis.authorityGraph.entryRef');
  if (!sameNativeRef(graphEntryRef, decisionResultRef)) {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_MISMATCH', 'authorityGraph entryRef must equal historicalBasis decisionResultRef');
  }
  if (!Array.isArray(graph.allAuthorityRefs) || graph.allAuthorityRefs.length === 0) {
    fail('GEOX_HISTORICAL_BASIS_GRAPH_REQUIRED', 'authorityGraph.allAuthorityRefs must be non-empty');
  }
  const graphRefs = graph.allAuthorityRefs.map((ref, index) => nativeAuthorityRef(
    ref,
    `historicalBasis.authorityGraph.allAuthorityRefs[${index}]`
  ));
  if (!graphRefs.some((ref) => sameNativeRef(ref, decisionResultRef))) {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_MISMATCH', 'authorityGraph must retain the exact DecisionResult entry ref');
  }

  return Object.freeze(clone(basis));
}

function projectionPayload(historicalBasis) {
  return Object.freeze({
    projection_version: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION,
    historical_basis: normalizeHistoricalBasis(historicalBasis),
    authority_claim: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM
  });
}

export function createAdrHistoricalDecisionBasisProjectionEventForGeox({ eventId, historicalBasis }) {
  const payload = projectionPayload(historicalBasis);
  return createResultSinkEvent({
    eventId,
    eventType: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE,
    projectionHash: sha256Json(payload),
    payload
  });
}

export function consumeAdrHistoricalDecisionBasisProjectionForGeox({ event, consumerScope }) {
  const input = object(event, 'event');
  exactKeys(input, 'event', new Set(['contract_version', 'event_id', 'event_type', 'projection_hash', 'payload']));
  if (input.contract_version !== GENERIC_RESULT_EVENT_VERSION
    || input.event_type !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE) {
    fail(
      'INVALID_GEOX_HISTORICAL_BASIS_EVENT',
      `expected ${GENERIC_RESULT_EVENT_VERSION} ${GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE}`
    );
  }
  text(input.event_id, 'event.event_id');
  const projectionHash = canonicalSha256(input.projection_hash, 'event.projection_hash');

  const payload = object(input.payload, 'event.payload');
  exactKeys(payload, 'event.payload', new Set(['projection_version', 'historical_basis', 'authority_claim']));
  if (payload.projection_version !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION) {
    fail('GEOX_HISTORICAL_BASIS_PROJECTION_VERSION_UNSUPPORTED', `expected ${GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION}`);
  }
  if (payload.authority_claim !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'projection payload may not claim ADR, GEOX, approval, dispatch, execution, outcome, or causal authority');
  }
  const historicalBasis = normalizeHistoricalBasis(payload.historical_basis);
  const expectedProjectionHash = sha256Json({
    projection_version: payload.projection_version,
    historical_basis: historicalBasis,
    authority_claim: payload.authority_claim
  });
  if (projectionHash !== expectedProjectionHash) {
    fail('GEOX_HISTORICAL_BASIS_PROJECTION_HASH_MISMATCH', 'projection_hash does not match the canonical historical basis projection payload');
  }

  return Object.freeze({
    contract_version: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_SINK_VERSION,
    routing_scope: normalizeConsumerScope(consumerScope),
    projection_hash: projectionHash,
    historical_basis: historicalBasis,
    entry_decision_result_ref: nativeAuthorityRef(historicalBasis.decisionResultRef, 'historicalBasis.decisionResultRef'),
    basis_digest: historicalBasis.basisDigest,
    consumer_disposition: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION,
    field_actionable: false,
    dispatch_authorized: false,
    decision_result_semantic_hash_verified: true,
    transport_verification: 'PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED',
    authority_claim: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM
  });
}
