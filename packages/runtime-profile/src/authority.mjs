import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { authorizeRuntimeProfileManage, RUNTIME_PROFILE_RESOURCE_TYPE } from '../../authorization/src/runtime-profile-control.mjs';
import { validateKnowledgeReleaseAuthority } from '../../knowledge-release/src/index.mjs';
import { normalizeRuntimeProfile, RuntimeProfileError } from './contract.mjs';

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeProfileError('INVALID_RUNTIME_PROFILE_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}
function contains(refs, expected) { return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected)); }
function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = left.map(refKey).sort();
  const b = right.map(refKey).sort();
  return a.every((value, index) => value === b[index]);
}
function samePrincipal(left, right) {
  const a = createPrincipal(left); const b = createPrincipal(right);
  return a.principalId === b.principalId && a.type === b.type
    && a.organizationId === b.organizationId && (a.tenantId ?? null) === (b.tenantId ?? null);
}
function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new RuntimeProfileError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}
function manageScope(controlScope, logicalId) {
  return deepFreeze({
    organizationId: controlScope.organizationId,
    ...(controlScope.tenantId ? { tenantId: controlScope.tenantId } : {}),
    resourceType: RUNTIME_PROFILE_RESOURCE_TYPE,
    resourceId: text(logicalId, 'logicalId')
  });
}

function validateAuthorization({ ledger, ref, principal, controlScope, logicalId }) {
  const record = resolveKind(ledger, ref, 'AuthorizationDecisionAudit', 'RUNTIME_PROFILE_AUTHORIZATION_REQUIRED');
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_HASH_MISMATCH', 'stored authorization hash is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedScope = manageScope(controlScope, logicalId);
  if (stored.operation !== 'RUNTIME_PROFILE_MANAGE' || stored.allowed !== true || stored.policyRef !== undefined
    || !samePrincipal(stored.principal, actor)
    || semanticHash('ADR-A05-RUNTIME-PROFILE-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A05-RUNTIME-PROFILE-SCOPE', expectedScope)) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_MISMATCH', 'authorization does not bind exact manager/control scope/profile id');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_ROLE_ASSIGNMENT_REQUIRED', 'RuntimeProfile management requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((assignmentRef) =>
    resolveKind(ledger, assignmentRef, 'RoleAssignment', 'RUNTIME_PROFILE_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeRuntimeProfileManage({ principal: actor, roleAssignments: assignments, authorizationScope: expectedScope });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_REPLAY_MISMATCH', 'RuntimeProfile authorization cannot be replayed from exact RoleAssignments');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_RUNTIME_PROFILE_MANAGE_ALLOW'
    && stored.assignmentRefs.every((assignmentRef) => contains(event.inputRefs, assignmentRef)))) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_AUDIT_INVALID', 'authorization lacks direct RoleAssignment audit inputs');
  }
  return record;
}

function validateRelease({ ledger, profile, allowHistorical }) {
  const authority = validateKnowledgeReleaseAuthority({
    ledger,
    knowledgeReleaseRef: profile.knowledgeReleaseRef,
    allowHistorical
  });
  const target = authority.publicationDecision.semanticPayload.releaseTarget;
  if (target.organizationId !== profile.controlScope.organizationId
    || (target.tenantId ?? null) !== (profile.controlScope.tenantId ?? null)) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_RELEASE_SCOPE_MISMATCH', 'profile control organization/tenant must equal KnowledgeRelease publication target');
  }
  return authority;
}

function expectedInputs(profile, authorizationRef) { return [profile.knowledgeReleaseRef, authorizationRef]; }
function validatePublicationAudit({ ledger, record, profile, authorization, principal }) {
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'PUBLISH_RUNTIME_PROFILE'
    && event.actor?.id === principal.principalId && event.actor?.type === principal.type
    && sameSet(event.inputRefs, expectedInputs(profile, authorization.ref))
    && sameAuthorityRef(event.details?.authorizationDecisionAuditRef, authorization.ref))) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_PUBLICATION_AUDIT_INVALID', 'publication must bind exactly KnowledgeRelease + management authorization');
  }
}

export function publishRuntimeProfile({ ledger, logicalId, version, profile, principal, authorizationDecisionAuditRef, audit }) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeProfileError('INVALID_LEDGER', 'RuntimeProfile publication requires a replayable AuthorityLedger');
  }
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUDIT_REQUIRED', 'RuntimeProfile publication requires explicit audit metadata');
  }
  const id = text(logicalId, 'logicalId');
  const manager = createPrincipal(principal);
  const payload = normalizeRuntimeProfile(profile);
  if (manager.organizationId !== payload.controlScope.organizationId
    || (manager.tenantId ?? null) !== (payload.controlScope.tenantId ?? null)) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_CONTROL_SCOPE_DENIED', 'profile manager must match control organization/tenant');
  }
  validateRelease({ ledger, profile: payload, allowHistorical: false });
  const authorization = validateAuthorization({
    ledger, ref: authorizationDecisionAuditRef, principal: manager,
    controlScope: payload.controlScope, logicalId: id
  });
  if (audit.actor.id !== manager.principalId || audit.actor.type !== manager.type) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_AUDIT_ACTOR_MISMATCH', 'audit actor must equal exact RuntimeProfile manager');
  }
  return ledger.publish({
    kind: 'RuntimeProfile', logicalId: id, version: text(version, 'version'), semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_RUNTIME_PROFILE',
      inputRefs: expectedInputs(payload, authorization.ref),
      details: {
        ...(audit.details ?? {}), managementPrincipal: manager,
        controlScope: cloneCanonicalValue(payload.controlScope), authorizationDecisionAuditRef: authorization.ref
      }
    }
  });
}

export function validateRuntimeProfileAuthority({ ledger, runtimeProfileRef, allowHistorical = false }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeProfileError('INVALID_LEDGER', 'RuntimeProfile validation requires a replayable AuthorityLedger');
  }
  const record = resolveKind(ledger, runtimeProfileRef, 'RuntimeProfile', 'RUNTIME_PROFILE_REQUIRED');
  const profile = normalizeRuntimeProfile(record.semanticPayload);
  if (semanticHash('RuntimeProfile', profile) !== record.ref.semanticHash) {
    throw new RuntimeProfileError('RUNTIME_PROFILE_SEMANTIC_HASH_MISMATCH', 'RuntimeProfile semantic payload does not reproduce authority ref');
  }
  const releaseAuthority = validateRelease({ ledger, profile, allowHistorical });
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const authRefs = [...new Map(direct.flatMap((event) => (event.inputRefs ?? []).filter((ref) => ref.kind === 'AuthorizationDecisionAudit')).map((ref) => [refKey(ref), ref])).values()];
  if (authRefs.length !== 1) throw new RuntimeProfileError('RUNTIME_PROFILE_AUTHORIZATION_REQUIRED', 'RuntimeProfile must bind exactly one management authorization');
  const principal = direct.map((event) => event.details?.managementPrincipal).find(Boolean);
  if (!principal) throw new RuntimeProfileError('RUNTIME_PROFILE_PUBLICATION_AUDIT_INVALID', 'publication audit lacks management principal');
  const authorization = validateAuthorization({ ledger, ref: authRefs[0], principal, controlScope: profile.controlScope, logicalId: record.ref.logicalId });
  validatePublicationAudit({ ledger, record, profile, authorization, principal: createPrincipal(principal) });
  return deepFreeze({ record, semanticPayload: profile, knowledgeReleaseAuthority: releaseAuthority, managementAuthorization: authorization });
}
