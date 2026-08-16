import { canonicalizeSemanticJson, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import {
  authorizeImplementationManage,
  IMPLEMENTATION_RESOURCE_TYPE
} from '../../authorization/src/implementation-control.mjs';
import {
  ImplementationError,
  normalizeImplementation,
  text
} from './contract.mjs';

function refKey(ref) {
  const normalized = assertAuthorityRef(ref);
  return canonicalizeSemanticJson(normalized);
}

function canonicalRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    map.set(refKey(ref), ref);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function samePrincipal(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) {
    throw new ImplementationError(code, `expected ${kind}, received ${record.ref.kind}`);
  }
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new ImplementationError(`${code}_HASH_MISMATCH`, `${kind} stored payload does not reproduce exact semantic hash`);
  }
  return record;
}

function managementScope(payload, logicalId) {
  return deepFreeze({
    organizationId: payload.controlScope.organizationId,
    ...(payload.controlScope.tenantId ? { tenantId: payload.controlScope.tenantId } : {}),
    resourceType: IMPLEMENTATION_RESOURCE_TYPE,
    resourceId: text(logicalId, 'logicalId')
  });
}

function validateManagementAuthorization({ ledger, ref, principal, payload, logicalId }) {
  const record = resolveKind(
    ledger,
    ref,
    'AuthorizationDecisionAudit',
    'IMPLEMENTATION_AUTHORIZATION_REQUIRED'
  );
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new ImplementationError(
      'IMPLEMENTATION_AUTHORIZATION_INVALID',
      'content-addressed AuthorizationDecision is required'
    );
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new ImplementationError(
      'IMPLEMENTATION_AUTHORIZATION_HASH_MISMATCH',
      'stored authorization hash is not reproducible'
    );
  }

  const manager = createPrincipal(principal);
  const expectedScope = managementScope(payload, logicalId);
  if (stored.operation !== 'IMPLEMENTATION_MANAGE'
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || !samePrincipal(stored.principal, manager)
    || canonicalizeSemanticJson(stored.request?.authorizationScope) !== canonicalizeSemanticJson(expectedScope)) {
    throw new ImplementationError(
      'IMPLEMENTATION_AUTHORIZATION_MISMATCH',
      'authorization does not bind exact implementation manager/control scope/logical id'
    );
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new ImplementationError(
      'IMPLEMENTATION_ROLE_ASSIGNMENT_REQUIRED',
      'implementation management requires exact RoleAssignment refs'
    );
  }

  const assignments = stored.assignmentRefs.map((assignmentRef) =>
    resolveKind(ledger, assignmentRef, 'RoleAssignment', 'IMPLEMENTATION_ROLE_ASSIGNMENT_REQUIRED'));
  const replayed = authorizeImplementationManage({
    principal: manager,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!replayed.allowed || replayed.decisionHash !== stored.decisionHash) {
    throw new ImplementationError(
      'IMPLEMENTATION_AUTHORIZATION_REPLAY_MISMATCH',
      'implementation management authorization cannot be replayed from exact RoleAssignments'
    );
  }

  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) =>
    event.action === 'AUTHORIZATION_IMPLEMENTATION_MANAGE_ALLOW'
      && sameRefSet(event.inputRefs, stored.assignmentRefs))) {
    throw new ImplementationError(
      'IMPLEMENTATION_AUTHORIZATION_AUDIT_INVALID',
      'implementation authorization audit must bind exactly its RoleAssignment authority inputs'
    );
  }
  return record;
}

function expectedPublicationInputs(authorizationRef) {
  return canonicalRefs([authorizationRef]);
}

function validatePublicationAudit({ ledger, record, payload, manager, authorization }) {
  const expected = expectedPublicationInputs(authorization.ref);
  const valid = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_IMPLEMENTATION'
      && event.actor?.id === manager.principalId
      && event.actor?.type === manager.type
      && event.details?.managementPrincipal
      && samePrincipal(event.details.managementPrincipal, manager)
      && event.details?.authorizationDecisionAuditRef
      && sameAuthorityRef(event.details.authorizationDecisionAuditRef, authorization.ref)
      && event.details?.conformanceClaim === payload.conformanceClaim
      && sameRefSet(event.inputRefs, expected));
  if (!valid) {
    throw new ImplementationError(
      'IMPLEMENTATION_PUBLICATION_AUDIT_INVALID',
      'Implementation publication lacks exact management authorization/input closure'
    );
  }
}

export function publishImplementation({
  ledger,
  logicalId,
  version,
  implementation,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ImplementationError('INVALID_LEDGER', 'Implementation publication requires a replayable AuthorityLedger');
  }
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new ImplementationError('IMPLEMENTATION_AUDIT_REQUIRED', 'Implementation publication requires explicit audit metadata');
  }
  const id = text(logicalId, 'logicalId');
  const manager = createPrincipal(principal);
  const payload = normalizeImplementation(implementation);
  if (manager.organizationId !== payload.controlScope.organizationId
    || (manager.tenantId ?? null) !== (payload.controlScope.tenantId ?? null)) {
    throw new ImplementationError(
      'IMPLEMENTATION_CONTROL_SCOPE_DENIED',
      'Implementation manager must match implementation control organization/tenant'
    );
  }
  const authorization = validateManagementAuthorization({
    ledger,
    ref: authorizationDecisionAuditRef,
    principal: manager,
    payload,
    logicalId: id
  });
  if (audit.actor.id !== manager.principalId || audit.actor.type !== manager.type) {
    throw new ImplementationError(
      'IMPLEMENTATION_AUDIT_ACTOR_MISMATCH',
      'publication audit actor must equal exact Implementation manager'
    );
  }

  return ledger.publish({
    kind: 'Implementation',
    logicalId: id,
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_IMPLEMENTATION',
      inputRefs: expectedPublicationInputs(authorization.ref),
      details: {
        ...(audit.details ?? {}),
        managementPrincipal: manager,
        authorizationDecisionAuditRef: authorization.ref,
        conformanceClaim: payload.conformanceClaim
      }
    }
  });
}

export function validateImplementationAuthority({ ledger, implementationRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ImplementationError('INVALID_LEDGER', 'Implementation validation requires a replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(implementationRef);
  const record = resolveKind(ledger, ref, 'Implementation', 'IMPLEMENTATION_REQUIRED');
  const payload = normalizeImplementation(record.semanticPayload);
  if (semanticHash('Implementation', payload) !== record.ref.semanticHash) {
    throw new ImplementationError(
      'IMPLEMENTATION_SEMANTIC_HASH_MISMATCH',
      'stored Implementation payload does not reproduce authority identity'
    );
  }

  const publicationEvents = ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref) && event.action === 'PUBLISH_IMPLEMENTATION');
  const principals = publicationEvents.map((event) => event.details?.managementPrincipal).filter(Boolean);
  const authorizationRefs = publicationEvents
    .map((event) => event.details?.authorizationDecisionAuditRef)
    .filter(Boolean);
  if (principals.length === 0 || authorizationRefs.length === 0) {
    throw new ImplementationError(
      'IMPLEMENTATION_PUBLICATION_AUDIT_INVALID',
      'Implementation lacks original management publication audit'
    );
  }
  const manager = createPrincipal(principals[0]);
  const authorization = validateManagementAuthorization({
    ledger,
    ref: authorizationRefs[0],
    principal: manager,
    payload,
    logicalId: record.ref.logicalId
  });
  validatePublicationAudit({ ledger, record, payload, manager, authorization });
  return deepFreeze({
    record,
    semanticPayload: payload,
    managementPrincipal: manager,
    managementAuthorization: authorization,
    conformanceStatus: 'NOT_ESTABLISHED_BY_IMPLEMENTATION_REGISTRATION'
  });
}
