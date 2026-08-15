import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeDecisionProblemCreation,
  createPrincipal,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';

export const DECISION_PROBLEM_CONTRACT_VERSION = 'adr.decision-problem.v1';
export const DECISION_AUTHORITY_MODES = deepFreeze(['ADR_POLICY', 'EXTERNAL_POLICY', 'RUNTIME_ONLY']);

const AUTHORITY_MODE_SET = new Set(DECISION_AUTHORITY_MODES);
const TARGET_KEYS = new Set(['organizationId', 'tenantId', 'farmId', 'fieldId', 'seasonId', 'zoneId']);
const PROBLEM_KEYS = new Set([
  'contractVersion',
  'decisionType',
  'targetRef',
  'logicalTime',
  'decisionHorizon',
  'objective',
  'actionSpace',
  'constraints',
  'usePurpose',
  'useClass',
  'decisionAuthorityMode',
  'decisionDeadline'
]);
const FORBIDDEN_CONCLUSION_KEYS = new Set([
  'recommendedaction',
  'selectedaction',
  'chosenaction',
  'finalaction',
  'recommendation',
  'decisionresult',
  'runtimeresult',
  'decisionrobustness',
  'applicabilityassessment',
  'agronomicconclusion'
]);
const ISO_DURATION_RE = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export class DecisionProblemError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecisionProblemError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeTimestamp(value, name) {
  const text = requiredText(value, name);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function exactObject(value, name, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new DecisionProblemError('INVALID_DECISION_PROBLEM_FIELD', `${name}.${key} is not part of ${DECISION_PROBLEM_CONTRACT_VERSION}`);
    }
  }
}

function canonicalObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_INPUT', `${name} must be an object`);
  }
  const normalized = cloneCanonicalValue(value);
  if (Object.keys(normalized).length === 0) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_INPUT', `${name} cannot be empty`);
  }
  return deepFreeze(normalized);
}

function semanticKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function assertNoConclusionCarrier(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoConclusionCarrier(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_CONCLUSION_KEYS.has(semanticKey(key))) {
      throw new DecisionProblemError(
        'DECISION_PROBLEM_CONCLUSION_LAUNDERING_FORBIDDEN',
        `${path}.${key} would embed downstream agronomic/applicability/runtime/decision authority inside DecisionProblem`
      );
    }
    assertNoConclusionCarrier(nested, `${path}.${key}`);
  }
}

function normalizeTargetRef(value) {
  exactObject(value, 'targetRef', TARGET_KEYS);
  return deepFreeze({
    organizationId: requiredText(value.organizationId, 'targetRef.organizationId'),
    ...(value.tenantId ? { tenantId: requiredText(value.tenantId, 'targetRef.tenantId') } : {}),
    ...(value.farmId ? { farmId: requiredText(value.farmId, 'targetRef.farmId') } : {}),
    ...(value.fieldId ? { fieldId: requiredText(value.fieldId, 'targetRef.fieldId') } : {}),
    ...(value.seasonId ? { seasonId: requiredText(value.seasonId, 'targetRef.seasonId') } : {}),
    ...(value.zoneId ? { zoneId: requiredText(value.zoneId, 'targetRef.zoneId') } : {})
  });
}

function normalizeHorizon(value) {
  exactObject(value, 'decisionHorizon', new Set(['duration']));
  const duration = requiredText(value.duration, 'decisionHorizon.duration');
  const match = ISO_DURATION_RE.exec(duration);
  if (!match) {
    throw new DecisionProblemError('INVALID_DECISION_HORIZON', 'decisionHorizon.duration must use ISO-8601 duration syntax');
  }
  const components = match.slice(1);
  if (!components.some((component) => component !== undefined)) {
    throw new DecisionProblemError('INVALID_DECISION_HORIZON', 'decisionHorizon.duration must contain at least one duration component');
  }
  const hasWeek = match[3] !== undefined;
  const hasOtherDateComponent = match[1] !== undefined || match[2] !== undefined || match[4] !== undefined;
  const hasTimeComponent = match[5] !== undefined || match[6] !== undefined || match[7] !== undefined;
  if (hasWeek && (hasOtherDateComponent || hasTimeComponent)) {
    throw new DecisionProblemError('INVALID_DECISION_HORIZON', 'ISO-8601 week duration cannot be mixed with other duration components');
  }
  if (duration.includes('T') && !hasTimeComponent) {
    throw new DecisionProblemError('INVALID_DECISION_HORIZON', 'ISO-8601 time designator T requires at least one time component');
  }
  return deepFreeze({ duration });
}

function normalizeObjective(value) {
  exactObject(value, 'objective', new Set(['code']));
  return deepFreeze({ code: requiredText(value.code, 'objective.code') });
}

function normalizeActionSpace(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DecisionProblemError('INVALID_DECISION_ACTION_SPACE', 'actionSpace must be a non-empty array of action codes');
  }
  const actions = value.map((item, index) => requiredText(item, `actionSpace[${index}]`));
  const unique = [...new Set(actions)];
  if (unique.length !== actions.length) {
    throw new DecisionProblemError('DUPLICATE_DECISION_ACTION', 'actionSpace cannot contain duplicate action codes');
  }
  return deepFreeze(unique.sort());
}

function normalizeConstraints(value = []) {
  if (!Array.isArray(value)) {
    throw new DecisionProblemError('INVALID_DECISION_CONSTRAINTS', 'constraints must be an array');
  }
  const keyed = value.map((constraint, index) => {
    const normalized = canonicalObject(constraint, `constraints[${index}]`);
    assertNoConclusionCarrier(normalized, `constraints[${index}]`);
    return [semanticHash('DecisionProblemConstraint', normalized), normalized];
  });
  const hashes = keyed.map(([hash]) => hash);
  if (new Set(hashes).size !== hashes.length) {
    throw new DecisionProblemError('DUPLICATE_DECISION_CONSTRAINT', 'constraints cannot contain duplicate canonical constraints');
  }
  keyed.sort(([left], [right]) => left.localeCompare(right));
  return deepFreeze(keyed.map(([, constraint]) => constraint));
}

function assertNoUnknownProblemFields(problem) {
  if (!problem || typeof problem !== 'object' || Array.isArray(problem)) {
    throw new DecisionProblemError('INVALID_DECISION_PROBLEM_INPUT', 'problem must be an object');
  }
  for (const key of Object.keys(problem)) {
    if (!PROBLEM_KEYS.has(key)) {
      throw new DecisionProblemError(
        'INVALID_DECISION_PROBLEM_FIELD',
        `${key} is not part of ${DECISION_PROBLEM_CONTRACT_VERSION}; DecisionProblem cannot carry agronomic conclusions or runtime results`
      );
    }
  }
}

export function normalizeDecisionProblem(problem) {
  assertNoUnknownProblemFields(problem);
  const contractVersion = requiredText(problem.contractVersion, 'contractVersion');
  if (contractVersion !== DECISION_PROBLEM_CONTRACT_VERSION) {
    throw new DecisionProblemError('UNSUPPORTED_DECISION_PROBLEM_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  }
  const logicalTime = normalizeTimestamp(problem.logicalTime, 'logicalTime');
  const decisionDeadline = normalizeTimestamp(problem.decisionDeadline, 'decisionDeadline');
  if (new Date(decisionDeadline).getTime() < new Date(logicalTime).getTime()) {
    throw new DecisionProblemError('DECISION_DEADLINE_BEFORE_LOGICAL_TIME', 'decisionDeadline cannot precede logicalTime');
  }
  const mode = requiredText(problem.decisionAuthorityMode, 'decisionAuthorityMode');
  if (!AUTHORITY_MODE_SET.has(mode)) {
    throw new DecisionProblemError('INVALID_DECISION_AUTHORITY_MODE', `unsupported decisionAuthorityMode ${mode}`);
  }
  return deepFreeze({
    contractVersion,
    authorityClass: 'DECISION_SCOPE',
    decisionType: requiredText(problem.decisionType, 'decisionType'),
    targetRef: normalizeTargetRef(problem.targetRef),
    logicalTime,
    decisionHorizon: normalizeHorizon(problem.decisionHorizon),
    objective: normalizeObjective(problem.objective),
    actionSpace: normalizeActionSpace(problem.actionSpace),
    constraints: normalizeConstraints(problem.constraints),
    usePurpose: requiredText(problem.usePurpose, 'usePurpose'),
    useClass: requiredText(problem.useClass, 'useClass'),
    decisionAuthorityMode: mode,
    decisionDeadline
  });
}

function principalOwnsTargetScope(principal, targetRef) {
  return principal.organizationId === targetRef.organizationId
    && (principal.tenantId ?? null) === (targetRef.tenantId ?? null);
}

function decisionProblemAuthorizationScope(targetRef, logicalId) {
  return deepFreeze({
    organizationId: targetRef.organizationId,
    ...(targetRef.tenantId ? { tenantId: targetRef.tenantId } : {}),
    resourceType: 'DECISION_PROBLEM',
    resourceId: requiredText(logicalId, 'logicalId')
  });
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function resolveKind(ledger, ref, kind, code) {
  const normalizedRef = assertAuthorityRef(ref);
  const record = ledger.resolve(normalizedRef);
  if (record.ref.kind !== kind) {
    throw new DecisionProblemError(code, `expected ${kind}, received ${record.ref.kind}`);
  }
  return record;
}

function assertAuthorizationDecisionHash(decision) {
  if (!decision || typeof decision !== 'object' || typeof decision.decisionHash !== 'string') {
    throw new DecisionProblemError('DECISION_PROBLEM_AUTHORIZATION_INVALID', 'DecisionProblem creation requires a content-addressed AuthorizationDecision');
  }
  const { decisionHash, ...basis } = decision;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new DecisionProblemError('DECISION_PROBLEM_AUTHORIZATION_HASH_MISMATCH', 'stored DecisionProblem creation decisionHash is not reproducible');
  }
}

function validateCreationAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  targetRef,
  logicalId
}) {
  const authRecord = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'DECISION_PROBLEM_AUTHORIZATION_REQUIRED'
  );
  const stored = authRecord.semanticPayload;
  assertAuthorizationDecisionHash(stored);
  const normalizedPrincipal = createPrincipal(principal);
  const expectedScope = decisionProblemAuthorizationScope(targetRef, logicalId);

  if (stored.operation !== 'DECISION_PROBLEM_CREATE'
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || !samePrincipalIdentity(stored.principal, normalizedPrincipal)
    || semanticHash('ADR-A01-CREATION-SCOPE', stored.request?.authorizationScope)
      !== semanticHash('ADR-A01-CREATION-SCOPE', expectedScope)) {
    throw new DecisionProblemError(
      'DECISION_PROBLEM_AUTHORIZATION_MISMATCH',
      'stored authorization does not bind the exact creator, target scope and DecisionProblem logical identity'
    );
  }

  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new DecisionProblemError('DECISION_PROBLEM_AUTHORIZATION_ASSIGNMENT_REQUIRED', 'DecisionProblem creation authorization requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'DECISION_PROBLEM_AUTHORIZATION_ASSIGNMENT_REQUIRED'));

  const recomputed = authorizeDecisionProblemCreation({
    principal: normalizedPrincipal,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new DecisionProblemError(
      'DECISION_PROBLEM_AUTHORIZATION_REPLAY_MISMATCH',
      'stored DecisionProblem creation authorization cannot be reproduced from exact RoleAssignment authority'
    );
  }

  const directAudits = ledger.auditFor(authRecord.ref).filter((event) => sameAuthorityRef(event.objectRef, authRecord.ref));
  const auditValid = directAudits.some((event) =>
    event.action === 'AUTHORIZATION_DECISION_PROBLEM_CREATE_ALLOW'
      && stored.assignmentRefs.every((ref) => exactRefIn(event.inputRefs, ref)));
  if (!auditValid) {
    throw new DecisionProblemError(
      'DECISION_PROBLEM_AUTHORIZATION_AUDIT_INVALID',
      'DecisionProblem creation AuthorizationDecisionAudit lacks direct exact RoleAssignment audit inputs'
    );
  }
  return authRecord;
}

function assertAuditActor(audit, principal) {
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new DecisionProblemError('DECISION_PROBLEM_AUDIT_REQUIRED', 'DecisionProblem publication requires explicit audit metadata');
  }
  if (audit.actor.id !== principal.principalId || audit.actor.type !== principal.type) {
    throw new DecisionProblemError('DECISION_PROBLEM_AUDIT_ACTOR_MISMATCH', 'audit actor must be the exact DecisionProblem creator principal');
  }
}

export function publishDecisionProblem({
  ledger,
  logicalId,
  version,
  problem,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionProblemError('INVALID_LEDGER', 'publishDecisionProblem requires a replayable AuthorityLedger');
  }
  const normalizedLogicalId = requiredText(logicalId, 'logicalId');
  const normalizedPrincipal = createPrincipal(principal);
  const semanticPayload = normalizeDecisionProblem(problem);
  if (!principalOwnsTargetScope(normalizedPrincipal, semanticPayload.targetRef)) {
    throw new DecisionProblemError(
      'DECISION_PROBLEM_TARGET_SCOPE_DENIED',
      'DecisionProblem creator organization/tenant must exactly match the target organization/tenant under A01'
    );
  }
  const authorization = validateCreationAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: normalizedPrincipal,
    targetRef: semanticPayload.targetRef,
    logicalId: normalizedLogicalId
  });
  assertAuditActor(audit, normalizedPrincipal);

  return ledger.publish({
    kind: 'DecisionProblem',
    logicalId: normalizedLogicalId,
    version: requiredText(version, 'version'),
    semanticPayload,
    audit: {
      ...audit,
      action: 'PUBLISH_DECISION_PROBLEM',
      inputRefs: [authorization.ref, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        creationPrincipal: normalizedPrincipal,
        targetScope: semanticPayload.targetRef,
        authorizationDecisionAuditRef: authorization.ref,
        authorityClass: 'DECISION_SCOPE'
      }
    }
  });
}

export function validateDecisionProblemAuthority({ ledger, decisionProblemRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new DecisionProblemError('INVALID_LEDGER', 'validateDecisionProblemAuthority requires a replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(decisionProblemRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'DecisionProblem') {
    throw new DecisionProblemError('DECISION_PROBLEM_REQUIRED', `expected DecisionProblem, received ${record.ref.kind}`);
  }
  const normalized = normalizeDecisionProblem({
    contractVersion: record.semanticPayload.contractVersion,
    decisionType: record.semanticPayload.decisionType,
    targetRef: record.semanticPayload.targetRef,
    logicalTime: record.semanticPayload.logicalTime,
    decisionHorizon: record.semanticPayload.decisionHorizon,
    objective: record.semanticPayload.objective,
    actionSpace: record.semanticPayload.actionSpace,
    constraints: record.semanticPayload.constraints,
    usePurpose: record.semanticPayload.usePurpose,
    useClass: record.semanticPayload.useClass,
    decisionAuthorityMode: record.semanticPayload.decisionAuthorityMode,
    decisionDeadline: record.semanticPayload.decisionDeadline
  });
  if (record.semanticPayload.authorityClass !== 'DECISION_SCOPE'
    || semanticHash('DecisionProblem', normalized) !== record.ref.semanticHash) {
    throw new DecisionProblemError('DECISION_PROBLEM_SEMANTICS_INVALID', 'stored DecisionProblem does not match the frozen A01 semantic contract');
  }

  const directAudits = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let creationAuthorization = null;
  for (const event of directAudits) {
    if (event.action !== 'PUBLISH_DECISION_PROBLEM' || !event.details?.creationPrincipal || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const creator = createPrincipal(event.details.creationPrincipal);
      if (event.actor?.id !== creator.principalId
        || event.actor?.type !== creator.type
        || !principalOwnsTargetScope(creator, normalized.targetRef)
        || semanticHash('ADR-A01-TARGET-AUDIT', event.details.targetScope)
          !== semanticHash('ADR-A01-TARGET-AUDIT', normalized.targetRef)
        || !exactRefIn(event.inputRefs, event.details.authorizationDecisionAuditRef)) {
        continue;
      }
      creationAuthorization = validateCreationAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: creator,
        targetRef: normalized.targetRef,
        logicalId: record.ref.logicalId
      });
      break;
    } catch {
      creationAuthorization = null;
    }
  }
  if (!creationAuthorization) {
    throw new DecisionProblemError(
      'DECISION_PROBLEM_AUDIT_INVALID',
      'DecisionProblem lacks direct replayable creator/target/creation-authorization authority'
    );
  }

  return deepFreeze({ record, semanticPayload: normalized, creationAuthorization });
}

export function assertDecisionResultAuthority({ ledger, decisionProblemRef, authorityMode }) {
  const { record, semanticPayload } = validateDecisionProblemAuthority({ ledger, decisionProblemRef });
  const requested = requiredText(authorityMode, 'authorityMode');
  if (!['ADR_POLICY', 'EXTERNAL_POLICY'].includes(requested)) {
    throw new DecisionProblemError('INVALID_DECISION_RESULT_AUTHORITY', 'final decision authority must be ADR_POLICY or EXTERNAL_POLICY');
  }
  if (semanticPayload.decisionAuthorityMode === 'RUNTIME_ONLY') {
    throw new DecisionProblemError(
      'DECISION_RESULT_FORBIDDEN_RUNTIME_ONLY',
      'RUNTIME_ONLY permits ADR to construct a legal runtime world but forbids DecisionResult authority'
    );
  }
  if (semanticPayload.decisionAuthorityMode !== requested) {
    throw new DecisionProblemError(
      'DECISION_RESULT_AUTHORITY_MISMATCH',
      `DecisionProblem requires ${semanticPayload.decisionAuthorityMode}, received ${requested}`
    );
  }
  return deepFreeze({
    allowed: true,
    decisionProblemRef: record.ref,
    decisionAuthorityMode: requested
  });
}
