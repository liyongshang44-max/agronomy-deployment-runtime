import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { authorizeContextWrite } from '../../authorization/src/context-write.mjs';
import { validateDecisionProblemAuthority } from '../../decision-problem/src/index.mjs';
import { validateContextDatumAuthority } from '../../context-contract/src/index.mjs';
import { validateResolvedContextDatumReceiptAuthority } from '../../reference-resolution/src/index.mjs';

export const CONTEXT_MANIFEST_CONTRACT_VERSION = 'adr.context-manifest.v1';
export const CONTEXT_MANIFEST_REPLAY_CLASSES = deepFreeze([
  'EXACT',
  'CONTENT_ADDRESSED_EXTERNAL',
  'PROVIDER_DEPENDENT',
  'NON_REPLAYABLE'
]);

const REPLAY_RANK = new Map([
  ['EXACT', 0],
  ['CONTENT_ADDRESSED_EXTERNAL', 1],
  ['PROVIDER_DEPENDENT', 2],
  ['NON_REPLAYABLE', 3]
]);
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export class ContextManifestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextManifestError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const match = RFC3339_RE.exec(text);
  if (!match) {
    throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_TIME', `${name} must be strict RFC3339 with explicit timezone and seconds`);
  }
  const [, y, mo, d, h, mi, s, , zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_TIME', `${name} contains an impossible date/time`);
  }
  if (zone !== 'Z') {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) {
      throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_TIME', `${name} is not a valid timestamp`);
  }
  return parsed.toISOString();
}

function exactRefKey(ref) {
  const normalized = assertAuthorityRef(ref);
  return JSON.stringify([normalized.kind, normalized.logicalId, normalized.version, normalized.semanticHash]);
}

function canonicalRefs(refs, name, expectedKind, { allowEmpty = true } = {}) {
  if (!Array.isArray(refs) || (!allowEmpty && refs.length === 0)) {
    throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_MEMBERSHIP', `${name} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`);
  }
  const keyed = refs.map((ref) => {
    const normalized = assertAuthorityRef(ref);
    if (normalized.kind !== expectedKind) {
      throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_MEMBER_KIND', `${name} accepts only ${expectedKind} refs`);
    }
    return [exactRefKey(normalized), normalized];
  });
  if (new Set(keyed.map(([key]) => key)).size !== keyed.length) {
    throw new ContextManifestError('DUPLICATE_CONTEXT_MANIFEST_MEMBER', `${name} cannot contain duplicate exact refs`);
  }
  keyed.sort(([a], [b]) => a.localeCompare(b));
  return deepFreeze(keyed.map(([, ref]) => ref));
}

function sameTargetTenant(scope, targetRef) {
  return scope?.organizationId === targetRef.organizationId
    && (scope?.tenantId ?? null) === (targetRef.tenantId ?? null);
}

function samePrincipalIdentity(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function resolveKind(ledger, ref, kind, code) {
  const normalized = assertAuthorityRef(ref);
  const record = ledger.resolve(normalized);
  if (record.ref.kind !== kind) {
    throw new ContextManifestError(code, `expected ${kind}, received ${record.ref.kind}`);
  }
  return record;
}

function manifestWriteScope(targetRef, logicalId) {
  return deepFreeze({
    organizationId: targetRef.organizationId,
    ...(targetRef.tenantId ? { tenantId: targetRef.tenantId } : {}),
    resourceType: 'CONTEXT_MANIFEST',
    resourceId: requiredText(logicalId, 'logicalId')
  });
}

function validateWriteAuthorization({ ledger, authorizationDecisionAuditRef, principal, targetRef, logicalId }) {
  const record = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'CONTEXT_MANIFEST_WRITE_AUTHORIZATION_REQUIRED'
  );
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new ContextManifestError('CONTEXT_MANIFEST_WRITE_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new ContextManifestError('CONTEXT_MANIFEST_WRITE_AUTHORIZATION_HASH_MISMATCH', 'stored context.write decision hash is not reproducible');
  }
  const normalizedPrincipal = createPrincipal(principal);
  const expectedScope = manifestWriteScope(targetRef, logicalId);
  if (stored.operation !== 'CONTEXT_WRITE' || stored.allowed !== true || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, normalizedPrincipal)
    || semanticHash('ADR-A04-WRITE-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A04-WRITE-SCOPE', expectedScope)) {
    throw new ContextManifestError('CONTEXT_MANIFEST_WRITE_AUTHORIZATION_MISMATCH', 'stored authorization does not bind exact manifest creator/scope/logical id');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new ContextManifestError('CONTEXT_MANIFEST_ROLE_ASSIGNMENT_REQUIRED', 'ContextManifest write requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'CONTEXT_MANIFEST_ROLE_ASSIGNMENT_REQUIRED'));
  const recomputed = authorizeContextWrite({
    principal: normalizedPrincipal,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new ContextManifestError('CONTEXT_MANIFEST_WRITE_AUTHORIZATION_REPLAY_MISMATCH', 'manifest write authorization cannot be reproduced from exact RoleAssignment authority');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === 'AUTHORIZATION_CONTEXT_WRITE_ALLOW'
    && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)))) {
    throw new ContextManifestError('CONTEXT_MANIFEST_WRITE_AUTHORIZATION_AUDIT_INVALID', 'manifest write authorization lacks direct RoleAssignment audit inputs');
  }
  return record;
}

function validateDatumMembers({ ledger, refs, targetRef, evidenceCutoff }) {
  const members = [];
  for (const ref of refs) {
    const validated = validateContextDatumAuthority({ ledger, contextDatumRef: ref });
    const scope = validated.writeAuthorization.semanticPayload.request.authorizationScope;
    if (!sameTargetTenant(scope, targetRef)) {
      throw new ContextManifestError('CONTEXT_MANIFEST_DATUM_TARGET_MISMATCH', 'ContextDatum organization/tenant must equal DecisionProblem target organization/tenant');
    }
    if (validated.semanticPayload.availableAt > evidenceCutoff) {
      throw new ContextManifestError('CONTEXT_MANIFEST_EVIDENCE_AFTER_CUTOFF', 'ContextDatum availableAt exceeds manifest evidenceCutoff');
    }
    members.push(validated);
  }
  return members;
}

function validateReceiptMembers({ ledger, refs, targetRef, evidenceCutoff, snapshotStore }) {
  const members = [];
  for (const ref of refs) {
    const validated = validateResolvedContextDatumReceiptAuthority({
      ledger,
      receiptRef: ref,
      snapshotStore
    });
    if (!sameTargetTenant(validated.reference.targetScope, targetRef)) {
      throw new ContextManifestError('CONTEXT_MANIFEST_RECEIPT_TARGET_MISMATCH', 'receipt organization/tenant must equal DecisionProblem target organization/tenant');
    }
    if (validated.receipt.semanticPayload.resolvedAt > evidenceCutoff) {
      throw new ContextManifestError('CONTEXT_MANIFEST_EVIDENCE_AFTER_CUTOFF', 'receipt resolvedAt exceeds manifest evidenceCutoff');
    }
    members.push(validated);
  }
  return members;
}

function deriveManifestReplayClass(receipts) {
  let rank = 0;
  for (const receipt of receipts) {
    const replayClass = receipt.receipt.semanticPayload.replayClass;
    const candidate = REPLAY_RANK.get(replayClass);
    if (candidate === undefined) {
      throw new ContextManifestError('INVALID_CONTEXT_MANIFEST_REPLAY_CLASS', `unsupported receipt replayClass ${replayClass}`);
    }
    rank = Math.max(rank, candidate);
  }
  return CONTEXT_MANIFEST_REPLAY_CLASSES[rank];
}

function assertReceiptDatumsIncluded(receipts, datumRefs) {
  for (const receipt of receipts) {
    const resolvedRef = receipt.receipt.semanticPayload.resolvedContextDatumRef;
    if (!datumRefs.some((ref) => sameAuthorityRef(ref, resolvedRef))) {
      throw new ContextManifestError(
        'CONTEXT_MANIFEST_RECEIPT_DATUM_MISSING',
        'every resolved receipt ContextDatum must be an exact datum member of the same ContextManifest'
      );
    }
  }
}

function buildSemanticPayload({ decisionProblem, evidenceCutoff, datumRefs, receiptRefs, replayClass }) {
  return deepFreeze({
    contractVersion: CONTEXT_MANIFEST_CONTRACT_VERSION,
    authorityClass: 'TARGET_CONTEXT_SNAPSHOT',
    decisionProblemRef: decisionProblem.record.ref,
    targetRef: cloneCanonicalValue(decisionProblem.semanticPayload.targetRef),
    logicalTime: decisionProblem.semanticPayload.logicalTime,
    evidenceCutoff,
    datumRefs,
    resolvedReferenceReceiptRefs: receiptRefs,
    replayClass
  });
}

function expectedAuditRefs(payload, authorizationRef) {
  const refs = [
    payload.decisionProblemRef,
    ...payload.datumRefs,
    ...payload.resolvedReferenceReceiptRefs,
    authorizationRef
  ];
  return [...new Map(refs.map((ref) => [exactRefKey(ref), ref])).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ref]) => ref);
}

function sameExactRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = left.map(exactRefKey).sort();
  const b = right.map(exactRefKey).sort();
  return a.every((value, index) => value === b[index]);
}

function normalizeAuditTime(audit, evidenceCutoff) {
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new ContextManifestError('CONTEXT_MANIFEST_AUDIT_REQUIRED', 'ContextManifest publication requires explicit audit metadata');
  }
  const createdAt = normalizeTimestamp(audit.occurredAt, 'audit.occurredAt');
  if (createdAt < evidenceCutoff) {
    throw new ContextManifestError('CONTEXT_MANIFEST_CREATED_BEFORE_CUTOFF', 'manifest publication time cannot precede its evidenceCutoff');
  }
  return createdAt;
}

export function publishContextManifest({
  ledger,
  logicalId,
  version,
  decisionProblemRef,
  evidenceCutoff,
  datumRefs,
  resolvedReferenceReceiptRefs = [],
  snapshotStore,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ContextManifestError('INVALID_LEDGER', 'ContextManifest publication requires a replayable AuthorityLedger');
  }
  const normalizedLogicalId = requiredText(logicalId, 'logicalId');
  const normalizedPrincipal = createPrincipal(principal);
  const decisionProblem = validateDecisionProblemAuthority({ ledger, decisionProblemRef });
  const targetRef = decisionProblem.semanticPayload.targetRef;
  if (normalizedPrincipal.organizationId !== targetRef.organizationId
    || (normalizedPrincipal.tenantId ?? null) !== (targetRef.tenantId ?? null)) {
    throw new ContextManifestError('CONTEXT_MANIFEST_TARGET_SCOPE_DENIED', 'manifest publisher must match DecisionProblem organization/tenant');
  }
  const cutoff = normalizeTimestamp(evidenceCutoff, 'evidenceCutoff');
  const canonicalDatumRefs = canonicalRefs(datumRefs, 'datumRefs', 'ContextDatum', { allowEmpty: false });
  const canonicalReceiptRefs = canonicalRefs(
    resolvedReferenceReceiptRefs,
    'resolvedReferenceReceiptRefs',
    'ResolvedContextDatumReceipt',
    { allowEmpty: true }
  );
  const datums = validateDatumMembers({ ledger, refs: canonicalDatumRefs, targetRef, evidenceCutoff: cutoff });
  const receipts = validateReceiptMembers({
    ledger,
    refs: canonicalReceiptRefs,
    targetRef,
    evidenceCutoff: cutoff,
    snapshotStore
  });
  assertReceiptDatumsIncluded(receipts, canonicalDatumRefs);
  const replayClass = deriveManifestReplayClass(receipts);
  const semanticPayload = buildSemanticPayload({
    decisionProblem,
    evidenceCutoff: cutoff,
    datumRefs: canonicalDatumRefs,
    receiptRefs: canonicalReceiptRefs,
    replayClass
  });
  const authorization = validateWriteAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    targetRef,
    logicalId: normalizedLogicalId
  });
  const createdAt = normalizeAuditTime(audit, cutoff);
  if (audit.actor.id !== normalizedPrincipal.principalId || audit.actor.type !== normalizedPrincipal.type) {
    throw new ContextManifestError('CONTEXT_MANIFEST_AUDIT_ACTOR_MISMATCH', 'audit actor must equal exact manifest publisher');
  }
  const inputRefs = expectedAuditRefs(semanticPayload, authorization.ref);
  return ledger.publish({
    kind: 'ContextManifest',
    logicalId: normalizedLogicalId,
    version: requiredText(version, 'version'),
    semanticPayload,
    audit: {
      ...audit,
      occurredAt: createdAt,
      action: 'PUBLISH_CONTEXT_MANIFEST',
      inputRefs,
      details: {
        ...(audit.details ?? {}),
        creationPrincipal: normalizedPrincipal,
        targetScope: cloneCanonicalValue(targetRef),
        authorizationDecisionAuditRef: authorization.ref,
        replayClass
      }
    }
  });
}

export function validateContextManifestAuthority({ ledger, contextManifestRef, snapshotStore }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ContextManifestError('INVALID_LEDGER', 'ContextManifest validation requires a replayable AuthorityLedger');
  }
  const record = resolveKind(ledger, contextManifestRef, 'ContextManifest', 'CONTEXT_MANIFEST_REQUIRED');
  const payload = record.semanticPayload;
  if (payload.contractVersion !== CONTEXT_MANIFEST_CONTRACT_VERSION
    || payload.authorityClass !== 'TARGET_CONTEXT_SNAPSHOT') {
    throw new ContextManifestError('CONTEXT_MANIFEST_CONTRACT_INVALID', 'stored manifest contract/authority class is invalid');
  }
  const decisionProblem = validateDecisionProblemAuthority({ ledger, decisionProblemRef: payload.decisionProblemRef });
  const targetRef = decisionProblem.semanticPayload.targetRef;
  const cutoff = normalizeTimestamp(payload.evidenceCutoff, 'evidenceCutoff');
  if (semanticHash('A04TargetRef', payload.targetRef) !== semanticHash('A04TargetRef', targetRef)
    || payload.logicalTime !== decisionProblem.semanticPayload.logicalTime) {
    throw new ContextManifestError('CONTEXT_MANIFEST_DECISION_BINDING_INVALID', 'manifest target/logical time must derive exactly from DecisionProblem');
  }
  const datumRefs = canonicalRefs(payload.datumRefs, 'datumRefs', 'ContextDatum', { allowEmpty: false });
  const receiptRefs = canonicalRefs(
    payload.resolvedReferenceReceiptRefs,
    'resolvedReferenceReceiptRefs',
    'ResolvedContextDatumReceipt',
    { allowEmpty: true }
  );
  const datums = validateDatumMembers({ ledger, refs: datumRefs, targetRef, evidenceCutoff: cutoff });
  const receipts = validateReceiptMembers({ ledger, refs: receiptRefs, targetRef, evidenceCutoff: cutoff, snapshotStore });
  assertReceiptDatumsIncluded(receipts, datumRefs);
  const replayClass = deriveManifestReplayClass(receipts);
  if (payload.replayClass !== replayClass) {
    throw new ContextManifestError('CONTEXT_MANIFEST_REPLAY_CLASS_INVALID', 'manifest replayClass must be conservatively derived from exact receipt evidence');
  }
  const normalizedPayload = buildSemanticPayload({
    decisionProblem,
    evidenceCutoff: cutoff,
    datumRefs,
    receiptRefs,
    replayClass
  });
  if (semanticHash('ContextManifest', normalizedPayload) !== record.ref.semanticHash) {
    throw new ContextManifestError('CONTEXT_MANIFEST_SEMANTICS_INVALID', 'stored manifest does not match frozen A04 semantic identity');
  }

  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let publication = null;
  for (const event of direct) {
    if (event.action !== 'PUBLISH_CONTEXT_MANIFEST'
      || !event.details?.creationPrincipal
      || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const creator = createPrincipal(event.details.creationPrincipal);
      if (event.actor?.id !== creator.principalId || event.actor?.type !== creator.type
        || !sameTargetTenant(event.details.targetScope, targetRef)) continue;
      const authorization = validateWriteAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: creator,
        targetRef,
        logicalId: record.ref.logicalId
      });
      const expectedRefs = expectedAuditRefs(normalizedPayload, authorization.ref);
      if (!sameExactRefSet(event.inputRefs, expectedRefs)) continue;
      const createdAt = normalizeTimestamp(event.occurredAt, 'audit.occurredAt');
      if (createdAt < cutoff) continue;
      publication = { event, authorization, createdAt };
      break;
    } catch {
      publication = null;
    }
  }
  if (!publication) {
    throw new ContextManifestError('CONTEXT_MANIFEST_AUDIT_INVALID', 'manifest lacks direct replayable exact publication authority/input set');
  }

  return deepFreeze({
    record,
    semanticPayload: normalizedPayload,
    decisionProblem,
    datums,
    receipts,
    writeAuthorization: publication.authorization,
    createdAt: publication.createdAt
  });
}

export function targetContextSnapshot({ ledger, contextManifestRef, snapshotStore }) {
  const validated = validateContextManifestAuthority({ ledger, contextManifestRef, snapshotStore });
  const p = validated.semanticPayload;
  return deepFreeze({
    decisionProblemRef: p.decisionProblemRef,
    targetRef: cloneCanonicalValue(p.targetRef),
    logicalTime: p.logicalTime,
    evidenceCutoff: p.evidenceCutoff,
    datumRefs: cloneCanonicalValue(p.datumRefs),
    resolvedReferenceReceiptRefs: cloneCanonicalValue(p.resolvedReferenceReceiptRefs),
    replayClass: p.replayClass
  });
}

export function materializePublicContextManifest({ ledger, contextManifestRef, snapshotStore }) {
  const validated = validateContextManifestAuthority({ ledger, contextManifestRef, snapshotStore });
  const p = validated.semanticPayload;
  const target = p.targetRef;
  return deepFreeze({
    contract_version: p.contractVersion,
    context_manifest_id: validated.record.ref.logicalId,
    decision_problem_ref: cloneCanonicalValue(p.decisionProblemRef),
    target_ref: {
      organization_id: target.organizationId,
      ...(target.tenantId ? { tenant_id: target.tenantId } : {}),
      ...(target.farmId ? { farm_id: target.farmId } : {}),
      ...(target.fieldId ? { field_id: target.fieldId } : {}),
      ...(target.seasonId ? { season_id: target.seasonId } : {}),
      ...(target.zoneId ? { zone_id: target.zoneId } : {})
    },
    logical_time: p.logicalTime,
    evidence_cutoff: p.evidenceCutoff,
    datum_refs: p.datumRefs.map((ref) => ({ datum_id: ref.logicalId, semantic_hash: ref.semanticHash })),
    resolved_reference_receipts: p.resolvedReferenceReceiptRefs.map((ref) => ({ receipt_id: ref.logicalId, semantic_hash: ref.semanticHash })),
    replay_class: p.replayClass,
    created_at: validated.createdAt,
    manifest_semantic_hash: validated.record.ref.semanticHash
  });
}
