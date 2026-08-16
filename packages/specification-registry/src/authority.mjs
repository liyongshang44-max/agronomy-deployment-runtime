import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import {
  authorizeSpecificationManage,
  SPECIFICATION_RESOURCE_TYPES
} from '../../authorization/src/specification-control.mjs';
import {
  SpecificationError,
  normalizeSpecification,
  specificationAuthorityRefs,
  text
} from './contract.mjs';

const KIND_RESOURCE_TYPE = deepFreeze({
  QualifiedTransformation: 'QUALIFIED_TRANSFORMATION',
  Model: 'MODEL',
  Policy: 'POLICY'
});
const RESOURCE_TYPES = new Set(SPECIFICATION_RESOURCE_TYPES);

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
}
function canonicalRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    map.set(refKey(ref), ref);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}
function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function samePrincipal(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId && a.type === b.type
    && a.organizationId === b.organizationId && (a.tenantId ?? null) === (b.tenantId ?? null);
}
function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new SpecificationError(code, `expected ${kind}, received ${record.ref.kind}`);
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new SpecificationError(`${code}_HASH_MISMATCH`, `${kind} stored payload does not reproduce exact semantic hash`);
  }
  return record;
}
function scope(controlScope, kind, logicalId) {
  const resourceType = KIND_RESOURCE_TYPE[kind];
  if (!resourceType || !RESOURCE_TYPES.has(resourceType)) {
    throw new SpecificationError('UNSUPPORTED_SPECIFICATION_KIND', `unsupported specification kind ${kind}`);
  }
  return deepFreeze({
    organizationId: controlScope.organizationId,
    ...(controlScope.tenantId ? { tenantId: controlScope.tenantId } : {}),
    resourceType,
    resourceId: text(logicalId, 'logicalId')
  });
}

function validateAuthorization({ ledger, ref, principal, controlScope, kind, logicalId }) {
  const record = resolveKind(ledger, ref, 'AuthorizationDecisionAudit', 'SPECIFICATION_AUTHORIZATION_REQUIRED');
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_HASH_MISMATCH', 'stored authorization hash is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedScope = scope(controlScope, kind, logicalId);
  if (stored.operation !== 'SPECIFICATION_MANAGE' || stored.allowed !== true || stored.policyRef !== undefined
    || !samePrincipal(stored.principal, actor)
    || semanticHash('ADR-S01-SPECIFICATION-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-S01-SPECIFICATION-SCOPE', expectedScope)) {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_MISMATCH', 'authorization does not bind exact manager/control scope/specification id');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new SpecificationError('SPECIFICATION_ROLE_ASSIGNMENT_REQUIRED', 'specification management requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((assignmentRef) =>
    resolveKind(ledger, assignmentRef, 'RoleAssignment', 'SPECIFICATION_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeSpecificationManage({
    principal: actor,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_REPLAY_MISMATCH', 'specification authorization cannot be replayed from exact RoleAssignments');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_SPECIFICATION_MANAGE_ALLOW'
    && sameSet(event.inputRefs, stored.assignmentRefs))) {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_AUDIT_INVALID', 'authorization audit must bind exactly the RoleAssignment authority inputs');
  }
  return record;
}

function resolveEmbeddedAuthorityRefs(ledger, kind, payload) {
  const refs = specificationAuthorityRefs(kind, payload);
  for (const ref of refs) {
    const record = ledger.resolve(ref);
    if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
      throw new SpecificationError('SPECIFICATION_EMBEDDED_AUTHORITY_HASH_MISMATCH', 'embedded authority ref does not reproduce exact stored semantics');
    }
  }
  return refs;
}

function expectedInputs(kind, payload, authorizationRef) {
  return canonicalRefs([authorizationRef, ...specificationAuthorityRefs(kind, payload)]);
}

function publicationAudit({ ledger, record, kind, payload, authorization, principal }) {
  const expected = expectedInputs(kind, payload, authorization.ref);
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'PUBLISH_SPECIFICATION'
    && event.actor?.id === principal.principalId && event.actor?.type === principal.type
    && event.details?.specificationKind === kind
    && event.details?.managementPrincipal
    && samePrincipal(event.details.managementPrincipal, principal)
    && event.details?.authorizationDecisionAuditRef
    && sameAuthorityRef(event.details.authorizationDecisionAuditRef, authorization.ref)
    && sameSet(event.inputRefs, expected))) {
    throw new SpecificationError('SPECIFICATION_PUBLICATION_AUDIT_INVALID', 'specification publication lacks exact management authorization/input closure');
  }
}

export function publishSpecification({
  ledger,
  kind,
  logicalId,
  version,
  specification,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new SpecificationError('INVALID_LEDGER', 'specification publication requires a replayable AuthorityLedger');
  }
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new SpecificationError('SPECIFICATION_AUDIT_REQUIRED', 'specification publication requires explicit audit metadata');
  }
  const id = text(logicalId, 'logicalId');
  const manager = createPrincipal(principal);
  const payload = normalizeSpecification(kind, specification);
  if (manager.organizationId !== payload.controlScope.organizationId
    || (manager.tenantId ?? null) !== (payload.controlScope.tenantId ?? null)) {
    throw new SpecificationError('SPECIFICATION_CONTROL_SCOPE_DENIED', 'specification manager must match control organization/tenant');
  }
  const authorization = validateAuthorization({
    ledger,
    ref: authorizationDecisionAuditRef,
    principal: manager,
    controlScope: payload.controlScope,
    kind,
    logicalId: id
  });
  resolveEmbeddedAuthorityRefs(ledger, kind, payload);
  if (audit.actor.id !== manager.principalId || audit.actor.type !== manager.type) {
    throw new SpecificationError('SPECIFICATION_AUDIT_ACTOR_MISMATCH', 'audit actor must equal exact specification manager');
  }
  return ledger.publish({
    kind,
    logicalId: id,
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_SPECIFICATION',
      inputRefs: expectedInputs(kind, payload, authorization.ref),
      details: {
        ...(audit.details ?? {}),
        specificationKind: kind,
        managementPrincipal: manager,
        authorizationDecisionAuditRef: authorization.ref
      }
    }
  });
}

export function publishQualifiedTransformation(args) {
  return publishSpecification({ ...args, kind: 'QualifiedTransformation' });
}
export function publishModel(args) {
  return publishSpecification({ ...args, kind: 'Model' });
}
export function publishPolicy(args) {
  return publishSpecification({ ...args, kind: 'Policy' });
}

export function validateSpecificationAuthority({ ledger, specificationRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new SpecificationError('INVALID_LEDGER', 'specification validation requires a replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(specificationRef);
  if (!KIND_RESOURCE_TYPE[ref.kind]) throw new SpecificationError('SPECIFICATION_REQUIRED', 'expected QualifiedTransformation, Model or Policy authority ref');
  const record = resolveKind(ledger, ref, ref.kind, 'SPECIFICATION_REQUIRED');
  const payload = normalizeSpecification(record.ref.kind, record.semanticPayload);
  if (semanticHash(record.ref.kind, payload) !== record.ref.semanticHash) {
    throw new SpecificationError('SPECIFICATION_SEMANTIC_HASH_MISMATCH', 'specification payload does not reproduce authority ref');
  }
  resolveEmbeddedAuthorityRefs(ledger, record.ref.kind, payload);
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const authRefs = [...new Map(direct.flatMap((event) => (event.inputRefs ?? [])
    .filter((item) => item.kind === 'AuthorizationDecisionAudit'))
    .map((item) => [refKey(item), item])).values()];
  if (authRefs.length !== 1) {
    throw new SpecificationError('SPECIFICATION_AUTHORIZATION_REQUIRED', 'specification must bind exactly one management authorization');
  }
  const principal = direct.map((event) => event.details?.managementPrincipal).find(Boolean);
  if (!principal) throw new SpecificationError('SPECIFICATION_PUBLICATION_AUDIT_INVALID', 'publication audit lacks management principal');
  const authorization = validateAuthorization({
    ledger,
    ref: authRefs[0],
    principal,
    controlScope: payload.controlScope,
    kind: record.ref.kind,
    logicalId: record.ref.logicalId
  });
  publicationAudit({
    ledger,
    record,
    kind: record.ref.kind,
    payload,
    authorization,
    principal: createPrincipal(principal)
  });
  return deepFreeze({ record, semanticPayload: payload, managementAuthorization: authorization });
}
