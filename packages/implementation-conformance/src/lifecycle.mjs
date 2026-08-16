import { canonicalizeSemanticJson, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { authorizeImplementationConformanceControl } from '../../authorization/src/implementation-conformance-control.mjs';
import {
  ImplementationConformanceError,
  normalizeConformanceTimestamp,
  text
} from './contract.mjs';
import {
  validateConformanceAuthorization,
  validateImplementationConformanceHistorical
} from './authority.mjs';

const ACTIONS = new Set(['REVOKE', 'SUPERSEDE']);

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = left.map(refKey).sort();
  const b = right.map(refKey).sort();
  return a.every((value, index) => value === b[index]);
}

function reasonCodes(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_REASON_REQUIRED', 'reasonCodes must be a non-empty array');
  }
  const normalized = values.map((value, index) => text(value, `reasonCodes[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new ImplementationConformanceError('DUPLICATE_CONFORMANCE_CONTROL_REASON', 'reasonCodes cannot contain duplicates');
  }
  return deepFreeze([...normalized].sort());
}

export function conformanceControlLogicalId(conformanceRef) {
  const ref = assertAuthorityRef(conformanceRef);
  if (ref.kind !== 'ImplementationConformance') {
    throw new ImplementationConformanceError('IMPLEMENTATION_CONFORMANCE_REQUIRED', 'control target must be ImplementationConformance');
  }
  return `implementation-conformance-control:${ref.logicalId}:${ref.version}:${ref.semanticHash}`;
}

function normalizeControlPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_CONTROL_INPUT', 'control decision must be an object');
  }
  const allowed = new Set(['conformanceRef', 'action', 'successorRef', 'reasonCodes', 'controlledAt']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_CONTROL_FIELD', `unsupported control field ${key}`);
  }
  const conformanceRef = assertAuthorityRef(value.conformanceRef);
  if (conformanceRef.kind !== 'ImplementationConformance') throw new ImplementationConformanceError('IMPLEMENTATION_CONFORMANCE_REQUIRED', 'control must target ImplementationConformance');
  const action = text(value.action, 'action');
  if (!ACTIONS.has(action)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_CONTROL_ACTION', `unsupported action ${action}`);
  let successorRef = null;
  if (value.successorRef !== undefined && value.successorRef !== null) {
    successorRef = assertAuthorityRef(value.successorRef);
    if (successorRef.kind !== 'ImplementationConformance') throw new ImplementationConformanceError('INVALID_CONFORMANCE_SUCCESSOR', 'successorRef must be ImplementationConformance');
  }
  if (action === 'SUPERSEDE' && !successorRef) {
    throw new ImplementationConformanceError('CONFORMANCE_SUCCESSOR_REQUIRED', 'SUPERSEDE requires exact successorRef');
  }
  if (action === 'REVOKE' && successorRef) {
    throw new ImplementationConformanceError('CONFORMANCE_SUCCESSOR_FORBIDDEN', 'REVOKE cannot carry successorRef');
  }
  return deepFreeze({
    conformanceRef,
    action,
    successorRef,
    reasonCodes: reasonCodes(value.reasonCodes),
    controlledAt: normalizeConformanceTimestamp(value.controlledAt, 'controlledAt')
  });
}

function managementScope(payload, logicalId) {
  return {
    organizationId: payload.controlScope.organizationId,
    ...(payload.controlScope.tenantId ? { tenantId: payload.controlScope.tenantId } : {}),
    resourceType: 'IMPLEMENTATION_CONFORMANCE',
    resourceId: logicalId
  };
}

function validateControlAuthorization({ ledger, ref, principal, conformance, action }) {
  const authRecord = ledger.resolve(assertAuthorityRef(ref));
  if (authRecord.ref.kind !== 'AuthorizationDecisionAudit') {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORIZATION_REQUIRED', 'control requires AuthorizationDecisionAudit');
  }
  const stored = authRecord.semanticPayload;
  const { decisionHash, ...basis } = stored ?? {};
  if (typeof decisionHash !== 'string' || semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORIZATION_INVALID', 'control authorization decision is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedOperation = `IMPLEMENTATION_CONFORMANCE_${action}`;
  const expectedScope = managementScope(conformance.semanticPayload, conformance.record.ref.logicalId);
  if (stored.operation !== expectedOperation
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || stored.principal?.principalId !== actor.principalId
    || stored.principal?.type !== actor.type
    || stored.principal?.organizationId !== actor.organizationId
    || (stored.principal?.tenantId ?? null) !== (actor.tenantId ?? null)
    || canonicalizeSemanticJson(stored.request?.authorizationScope) !== canonicalizeSemanticJson(expectedScope)) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORIZATION_MISMATCH', 'control authorization does not bind exact operation/principal/scope');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_ROLE_ASSIGNMENT_REQUIRED', 'control requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((assignmentRef) => {
    const record = ledger.resolve(assignmentRef);
    if (record.ref.kind !== 'RoleAssignment') throw new ImplementationConformanceError('CONFORMANCE_CONTROL_ROLE_ASSIGNMENT_REQUIRED', 'control assignment ref must resolve RoleAssignment');
    return record;
  });
  const replayed = authorizeImplementationConformanceControl({
    action,
    principal: actor,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!replayed.allowed || replayed.decisionHash !== stored.decisionHash) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORIZATION_REPLAY_MISMATCH', 'control authorization cannot be replayed');
  }
  const direct = ledger.auditFor(authRecord.ref).filter((event) => sameAuthorityRef(event.objectRef, authRecord.ref));
  if (!direct.some((event) => event.action === `AUTHORIZATION_${expectedOperation}_ALLOW`
    && sameRefSet(event.inputRefs, stored.assignmentRefs))) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORIZATION_AUDIT_INVALID', 'control authorization audit must bind exact assignments');
  }
  return authRecord;
}

function validateControlRecord({ ledger, record, target }) {
  const payload = normalizeControlPayload(record.semanticPayload);
  if (!sameAuthorityRef(payload.conformanceRef, target.record.ref)
    || record.ref.logicalId !== conformanceControlLogicalId(target.record.ref)
    || semanticHash('ImplementationConformanceControlDecision', payload) !== record.ref.semanticHash) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_SEMANTICS_INVALID', 'control record does not match exact target identity');
  }
  if (payload.successorRef) {
    const successor = validateImplementationConformanceHistorical({ ledger, conformanceRef: payload.successorRef });
    if (successor.record.ref.logicalId !== target.record.ref.logicalId
      || sameAuthorityRef(successor.record.ref, target.record.ref)
      || !sameAuthorityRef(successor.semanticPayload.specificationRef, target.semanticPayload.specificationRef)
      || !sameAuthorityRef(successor.semanticPayload.implementationRef, target.semanticPayload.implementationRef)) {
      throw new ImplementationConformanceError('INVALID_CONFORMANCE_SUCCESSOR', 'successor must be a distinct version of same exact spec↔implementation relation');
    }
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  for (const event of direct) {
    if (event.action !== `IMPLEMENTATION_CONFORMANCE_${payload.action}`
      || !event.details?.controlPrincipal
      || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const principal = createPrincipal(event.details.controlPrincipal);
      if (event.actor?.id !== principal.principalId || event.actor?.type !== principal.type) continue;
      const authorization = validateControlAuthorization({
        ledger,
        ref: event.details.authorizationDecisionAuditRef,
        principal,
        conformance: target,
        action: payload.action
      });
      const expectedInputs = [target.record.ref, authorization.ref, ...(payload.successorRef ? [payload.successorRef] : [])];
      if (!sameRefSet(event.inputRefs, expectedInputs)) continue;
      return deepFreeze({ record, semanticPayload: payload, principal, authorization });
    } catch {
      // forged/nonreplayable control never gains authority
    }
  }
  throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUTHORITY_INVALID', 'control decision lacks replayable authority');
}

export function currentConformanceControl({ ledger, conformanceRef }) {
  const target = validateImplementationConformanceHistorical({ ledger, conformanceRef });
  const candidates = ledger.listVersions('ImplementationConformanceControlDecision', conformanceControlLogicalId(target.record.ref))
    .map((ref) => ledger.resolve(ref));
  const valid = [];
  for (const candidate of candidates) {
    try { valid.push(validateControlRecord({ ledger, record: candidate, target })); }
    catch { /* generic forged controls do not poison state */ }
  }
  if (valid.length > 1) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_CONFLICT', 'one exact conformance version may have at most one valid terminal control');
  }
  return deepFreeze({ target, control: valid[0] ?? null });
}

function assertExecutionContext(payload, executionContext) {
  if (!executionContext || typeof executionContext !== 'object' || Array.isArray(executionContext)) {
    throw new ImplementationConformanceError('CONFORMANCE_EXECUTION_CONTEXT_REQUIRED', 'current conformance validation requires exact executionContext');
  }
  const allowed = new Set(['runtime', 'runtimeVersion', 'platform', 'architecture', 'runtimeEnvironment', 'capabilities']);
  for (const key of Object.keys(executionContext)) {
    if (!allowed.has(key)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_EXECUTION_CONTEXT', `unsupported executionContext field ${key}`);
  }
  const qualified = payload.qualifiedExecutionEnvironment;
  for (const key of ['runtime', 'runtimeVersion', 'platform', 'architecture']) {
    if (text(executionContext[key], `executionContext.${key}`) !== qualified[key]) {
      throw new ImplementationConformanceError('CONFORMANCE_EXECUTION_ENVIRONMENT_MISMATCH', `executionContext.${key} is outside qualified environment`);
    }
  }
  const environment = text(executionContext.runtimeEnvironment, 'executionContext.runtimeEnvironment');
  if (!qualified.runtimeEnvironments.includes(environment)) {
    throw new ImplementationConformanceError('CONFORMANCE_RUNTIME_ENVIRONMENT_OUT_OF_SCOPE', `${environment} is not qualified`);
  }
  if (!Array.isArray(executionContext.capabilities)) {
    throw new ImplementationConformanceError('INVALID_CONFORMANCE_EXECUTION_CONTEXT', 'executionContext.capabilities must be an array');
  }
  const capabilities = new Set(executionContext.capabilities.map((value, index) => text(value, `executionContext.capabilities[${index}]`)));
  for (const required of qualified.requiredCapabilities) {
    if (!capabilities.has(required)) {
      throw new ImplementationConformanceError('CONFORMANCE_CAPABILITY_MISSING', `required capability ${required} is missing`);
    }
  }
}

export function validateImplementationConformance({
  ledger,
  conformanceRef,
  allowHistorical = false,
  atTime,
  executionContext
}) {
  const historical = validateImplementationConformanceHistorical({ ledger, conformanceRef });
  if (allowHistorical) return historical;
  const now = normalizeConformanceTimestamp(atTime, 'atTime');
  const start = new Date(historical.semanticPayload.validityInterval.start).getTime();
  const end = new Date(historical.semanticPayload.validityInterval.end).getTime();
  const current = new Date(now).getTime();
  if (current < start || current >= end) {
    throw new ImplementationConformanceError('CONFORMANCE_EXPIRED_OR_NOT_YET_VALID', 'conformance is outside its validity interval for new runtime use');
  }
  const state = currentConformanceControl({ ledger, conformanceRef });
  if (state.control) {
    throw new ImplementationConformanceError(
      state.control.semanticPayload.action === 'REVOKE' ? 'CONFORMANCE_REVOKED' : 'CONFORMANCE_SUPERSEDED',
      `conformance is ${state.control.semanticPayload.action} for new runtime use`
    );
  }
  assertExecutionContext(historical.semanticPayload, executionContext);
  return deepFreeze({
    ...historical,
    currentAt: now,
    currentStatus: 'QUALIFIED_CURRENT',
    executionContextValidated: true
  });
}

export function publishImplementationConformanceControlDecision({
  ledger,
  conformanceRef,
  version,
  action,
  successorRef = null,
  controlledAt,
  reasonCodes: reasons,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  const target = validateImplementationConformanceHistorical({ ledger, conformanceRef });
  const existing = currentConformanceControl({ ledger, conformanceRef });
  if (existing.control) {
    throw new ImplementationConformanceError('CONFORMANCE_ALREADY_CONTROLLED', 'exact conformance version already has a valid terminal control');
  }
  const normalizedAction = text(action, 'action');
  if (!ACTIONS.has(normalizedAction)) throw new ImplementationConformanceError('INVALID_CONFORMANCE_CONTROL_ACTION', `unsupported action ${normalizedAction}`);
  const actor = createPrincipal(principal);
  const authorization = validateControlAuthorization({
    ledger,
    ref: authorizationDecisionAuditRef,
    principal: actor,
    conformance: target,
    action: normalizedAction
  });
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_AUDIT_ACTOR_MISMATCH', 'control audit actor must equal exact controller');
  }
  const payload = normalizeControlPayload({
    conformanceRef: target.record.ref,
    action: normalizedAction,
    successorRef,
    reasonCodes: reasons,
    controlledAt
  });
  if (payload.successorRef) {
    const successor = validateImplementationConformanceHistorical({ ledger, conformanceRef: payload.successorRef });
    if (successor.record.ref.logicalId !== target.record.ref.logicalId
      || sameAuthorityRef(successor.record.ref, target.record.ref)
      || !sameAuthorityRef(successor.semanticPayload.specificationRef, target.semanticPayload.specificationRef)
      || !sameAuthorityRef(successor.semanticPayload.implementationRef, target.semanticPayload.implementationRef)) {
      throw new ImplementationConformanceError('INVALID_CONFORMANCE_SUCCESSOR', 'successor must preserve same exact spec↔implementation relation');
    }
  }
  const record = ledger.publish({
    kind: 'ImplementationConformanceControlDecision',
    logicalId: conformanceControlLogicalId(target.record.ref),
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: `IMPLEMENTATION_CONFORMANCE_${normalizedAction}`,
      inputRefs: [target.record.ref, authorization.ref, ...(payload.successorRef ? [payload.successorRef] : [])],
      details: {
        ...(audit.details ?? {}),
        controlPrincipal: actor,
        authorizationDecisionAuditRef: authorization.ref
      }
    }
  });
  validateControlRecord({ ledger, record, target });
  return record;
}
