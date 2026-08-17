import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import {
  assertAuthorityRef,
  authorityRefKey,
  sameAuthorityRef
} from '../../contracts/src/authority.mjs';
import { createAuditEvent } from '../../audit/src/index.mjs';
import { AuthorityLedger, LINEAGE_RELATIONS } from '../../provenance/src/index.mjs';
import {
  OperationalJobJournal,
  projectOperationalTrace,
  summarizeOperationalTraces
} from '../../operations/src/index.mjs';
import { validateDecisionResult } from '../../decision-result/src/index.mjs';
import { currentDeploymentState } from '../../deployment/src/index.mjs';

export const RECOVERY_OPERATIONS_NON_AUTHORITY = 'NONE_RECOVERY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY';
export const RECOVERY_CHECKPOINT_CONTRACT_VERSION = 'adr.recovery-checkpoint.v1';
export const INCIDENT_CONTRACT_VERSION = 'adr.pilot-incident.v1';
export const ROLLBACK_RECORD_CONTRACT_VERSION = 'adr.pilot-rollback-record.v1';
export const PILOT_SLO_CONTRACT_VERSION = 'adr.pilot-slo-report.v1';

const INCIDENT_CLASSES = new Set([
  'PROVIDER_OUTAGE',
  'RUNTIME_FAILURE',
  'PLATFORM_FAILURE',
  'GOVERNED_BLOCK',
  'DECISION_ABSTAIN'
]);
const LINEAGE_RELATION_SET = new Set(LINEAGE_RELATIONS);

export class RecoveryOperationsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RecoveryOperationsError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function integer(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_INTEGER', `${name} must be a safe integer in [${min}, ${max}]`);
  }
  return value;
}

function timestamp(value, name) {
  const raw = requiredText(value, name);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_TIME', `${name} must be an offset-aware timestamp`);
  }
  return new Date(raw).toISOString();
}

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_OBJECT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_OBJECT', `${name} must be a plain object`);
  }
  return value;
}

function exactKeys(value, name, keys) {
  plainObject(value, name);
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RecoveryOperationsError('RECOVERY_PAYLOAD_WIDENING_FORBIDDEN', `${name} keys must be exactly ${expected.join(',')}`);
  }
}

function strictRef(value, name) {
  exactKeys(value, name, ['kind', 'logicalId', 'version', 'semanticHash']);
  return assertAuthorityRef(value);
}

function refKey(ref) {
  return authorityRefKey(strictRef(ref, 'AuthorityRef'));
}

function sameCanonical(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function sameTenantScope(left, right) {
  return left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function canonicalRefs(values, name, { allowEmpty = true } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_REFS', `${name} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`);
  }
  const map = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const ref = strictRef(values[index], `${name}[${index}]`);
    const key = JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
    if (map.has(key)) throw new RecoveryOperationsError('DUPLICATE_RECOVERY_REF', `${name} contains duplicate exact authority ref`);
    map.set(key, ref);
  }
  return deepFreeze([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref));
}

function cloneFrozen(value) {
  return deepFreeze(cloneCanonicalValue(value));
}

function validateSnapshotRecord(record, index) {
  exactKeys(record, `snapshot.records[${index}]`, ['ref', 'semanticPayload', 'operationalMetadata']);
  const ref = strictRef(record.ref, `snapshot.records[${index}].ref`);
  const expectedHash = semanticHash(ref.kind, record.semanticPayload);
  if (expectedHash !== ref.semanticHash) {
    throw new RecoveryOperationsError('RECOVERY_RECORD_HASH_MISMATCH', `snapshot record ${ref.kind}/${ref.logicalId}@${ref.version} semantic hash is not reproducible`);
  }
  return cloneFrozen({ ref, semanticPayload: record.semanticPayload, operationalMetadata: record.operationalMetadata });
}

function validateSnapshotLineage(record, index, recordsByKey) {
  exactKeys(record, `snapshot.lineage[${index}]`, ['relation', 'from', 'to', 'details', 'lineageHash']);
  const relation = requiredText(record.relation, `snapshot.lineage[${index}].relation`);
  if (!LINEAGE_RELATION_SET.has(relation)) {
    throw new RecoveryOperationsError('RECOVERY_LINEAGE_RELATION_INVALID', `unsupported lineage relation ${relation}`);
  }
  const from = strictRef(record.from, `snapshot.lineage[${index}].from`);
  const to = strictRef(record.to, `snapshot.lineage[${index}].to`);
  if (!recordsByKey.has(refKey(from)) || !recordsByKey.has(refKey(to))) {
    throw new RecoveryOperationsError('RECOVERY_LINEAGE_AUTHORITY_MISSING', 'lineage endpoints must both exist in the recovery snapshot');
  }
  const lineageHash = requiredText(record.lineageHash, `snapshot.lineage[${index}].lineageHash`);
  const expectedHash = semanticHash('AuthorityLineage', { relation, from, to });
  if (lineageHash !== expectedHash) {
    throw new RecoveryOperationsError('RECOVERY_LINEAGE_HASH_MISMATCH', 'lineage hash is not reproducible from exact endpoints/relation');
  }
  return cloneFrozen({ relation, from, to, details: record.details, lineageHash });
}

function validateSnapshotAudit(event, index, recordsByKey) {
  exactKeys(event, `snapshot.audit[${index}]`, [
    'eventId', 'occurredAt', 'actor', 'action', 'objectRef', 'inputRefs', 'details', 'eventHash'
  ]);
  exactKeys(event.actor, `snapshot.audit[${index}].actor`, ['type', 'id']);
  const objectRef = strictRef(event.objectRef, `snapshot.audit[${index}].objectRef`);
  if (!recordsByKey.has(refKey(objectRef))) {
    throw new RecoveryOperationsError('RECOVERY_AUDIT_OBJECT_MISSING', 'audit objectRef must exist in the recovery snapshot');
  }
  if (!Array.isArray(event.inputRefs)) {
    throw new RecoveryOperationsError('RECOVERY_AUDIT_INPUTS_INVALID', 'audit inputRefs must be an array');
  }
  const inputRefs = event.inputRefs.map((ref, inputIndex) => {
    const normalized = strictRef(ref, `snapshot.audit[${index}].inputRefs[${inputIndex}]`);
    if (!recordsByKey.has(refKey(normalized))) {
      throw new RecoveryOperationsError('RECOVERY_AUDIT_INPUT_AUTHORITY_MISSING', 'audit input authority must exist in the recovery snapshot');
    }
    return normalized;
  });
  const rebuilt = createAuditEvent({
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actor: event.actor,
    action: event.action,
    objectRef,
    inputRefs,
    details: event.details
  });
  if (!sameCanonical(rebuilt, event)) {
    throw new RecoveryOperationsError('RECOVERY_AUDIT_HASH_MISMATCH', 'audit event is not exactly reproducible');
  }
  return rebuilt;
}

function lineageAuditMatch(event, lineage) {
  return sameAuthorityRef(event.objectRef, lineage.from)
    && event.inputRefs.length > 0
    && sameAuthorityRef(event.inputRefs[0], lineage.to)
    && event.details?.lineageHash === lineage.lineageHash
    && event.details?.relation === lineage.relation;
}

export function validateAuthorityRecoverySnapshot(snapshot) {
  exactKeys(snapshot, 'snapshot', ['records', 'lineage', 'audit']);
  if (!Array.isArray(snapshot.records) || !Array.isArray(snapshot.lineage) || !Array.isArray(snapshot.audit)) {
    throw new RecoveryOperationsError('INVALID_RECOVERY_SNAPSHOT', 'snapshot records/lineage/audit must be arrays');
  }
  const records = snapshot.records.map(validateSnapshotRecord);
  const recordsByKey = new Map();
  for (const record of records) {
    const key = refKey(record.ref);
    if (recordsByKey.has(key)) throw new RecoveryOperationsError('RECOVERY_DUPLICATE_RECORD', `duplicate authority identity ${key}`);
    recordsByKey.set(key, record);
  }
  const lineage = snapshot.lineage.map((record, index) => validateSnapshotLineage(record, index, recordsByKey));
  const lineageHashes = new Set();
  for (const record of lineage) {
    if (lineageHashes.has(record.lineageHash)) throw new RecoveryOperationsError('RECOVERY_DUPLICATE_LINEAGE', `duplicate lineage ${record.lineageHash}`);
    lineageHashes.add(record.lineageHash);
  }
  const audit = snapshot.audit.map((event, index) => validateSnapshotAudit(event, index, recordsByKey));
  const auditHashes = new Set();
  for (const event of audit) {
    if (auditHashes.has(event.eventHash)) throw new RecoveryOperationsError('RECOVERY_DUPLICATE_AUDIT', `duplicate audit event ${event.eventHash}`);
    auditHashes.add(event.eventHash);
  }
  if (audit.length !== records.length + lineage.length) {
    throw new RecoveryOperationsError('RECOVERY_AUDIT_CARDINALITY_MISMATCH', 'AuthorityLedger snapshot must retain exactly one publication audit per record and one audit per lineage edge');
  }

  const lineageAuditIndexes = new Set();
  const lineageAuditByHash = new Map();
  for (const edge of lineage) {
    const matches = [];
    audit.forEach((event, index) => {
      if (lineageAuditMatch(event, edge)) matches.push(index);
    });
    if (matches.length !== 1 || lineageAuditIndexes.has(matches[0])) {
      throw new RecoveryOperationsError('RECOVERY_LINEAGE_AUDIT_INVALID', `lineage ${edge.lineageHash} must have one unambiguous exact audit event`);
    }
    lineageAuditIndexes.add(matches[0]);
    lineageAuditByHash.set(edge.lineageHash, audit[matches[0]]);
  }

  const publicationAuditByRef = new Map();
  audit.forEach((event, index) => {
    if (lineageAuditIndexes.has(index)) return;
    const key = refKey(event.objectRef);
    if (publicationAuditByRef.has(key)) {
      throw new RecoveryOperationsError('RECOVERY_PUBLICATION_AUDIT_AMBIGUOUS', `authority ${key} has multiple non-lineage publication audit candidates`);
    }
    publicationAuditByRef.set(key, event);
  });
  for (const record of records) {
    if (!publicationAuditByRef.has(refKey(record.ref))) {
      throw new RecoveryOperationsError('RECOVERY_PUBLICATION_AUDIT_MISSING', `authority ${refKey(record.ref)} lacks exact publication audit evidence`);
    }
  }

  const normalized = cloneFrozen({ records, lineage, audit });
  return deepFreeze({ normalized, recordsByKey, publicationAuditByRef, lineageAuditByHash });
}

function auditInputFromEvent(event) {
  return {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actor: event.actor,
    action: event.action,
    inputRefs: event.inputRefs,
    details: event.details
  };
}

function auditHashSet(snapshot) {
  return [...snapshot.audit.map((event) => event.eventHash)].sort();
}

function recoveryStateBasis(snapshot) {
  return {
    records: snapshot.records,
    lineage: snapshot.lineage,
    auditEventHashes: auditHashSet(snapshot)
  };
}

export function replayAuthorityRecoverySnapshot(snapshot) {
  const validated = validateAuthorityRecoverySnapshot(snapshot);
  const ledger = new AuthorityLedger();
  for (const record of validated.normalized.records) {
    const auditEvent = validated.publicationAuditByRef.get(refKey(record.ref));
    ledger.publish({
      kind: record.ref.kind,
      logicalId: record.ref.logicalId,
      version: record.ref.version,
      semanticPayload: record.semanticPayload,
      operationalMetadata: record.operationalMetadata,
      audit: auditInputFromEvent(auditEvent)
    });
  }
  for (const edge of validated.normalized.lineage) {
    const auditEvent = validated.lineageAuditByHash.get(edge.lineageHash);
    ledger.addLineage({
      relation: edge.relation,
      from: edge.from,
      to: edge.to,
      details: edge.details,
      audit: {
        eventId: auditEvent.eventId,
        occurredAt: auditEvent.occurredAt,
        actor: auditEvent.actor,
        action: auditEvent.action,
        inputRefs: auditEvent.inputRefs.slice(1),
        details: auditEvent.details
      }
    });
  }
  const restored = ledger.exportSnapshot();
  if (!sameCanonical(restored.records, validated.normalized.records)
    || !sameCanonical(restored.lineage, validated.normalized.lineage)
    || !sameCanonical(auditHashSet(restored), auditHashSet(validated.normalized))) {
    throw new RecoveryOperationsError('RECOVERY_REPLAY_MISMATCH', 'restored ledger does not preserve exact records, lineage and audit event identities');
  }
  return deepFreeze({
    ledger,
    report: deepFreeze({
      recordCount: restored.records.length,
      lineageCount: restored.lineage.length,
      auditEventCount: restored.audit.length,
      semanticStateHash: semanticHash('AuthorityLedgerRecoveryState', recoveryStateBasis(restored)),
      authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
    })
  });
}

export function createAuthorityRecoveryCheckpoint({ ledger, capturedAt }) {
  if (!ledger || typeof ledger.exportSnapshot !== 'function') {
    throw new RecoveryOperationsError('INVALID_RECOVERY_LEDGER', 'checkpoint requires AuthorityLedger exportSnapshot');
  }
  const snapshot = ledger.exportSnapshot();
  validateAuthorityRecoverySnapshot(snapshot);
  const basis = {
    contractVersion: RECOVERY_CHECKPOINT_CONTRACT_VERSION,
    capturedAt: timestamp(capturedAt, 'capturedAt'),
    snapshot,
    snapshotHash: semanticHash('AuthorityLedgerRecoverySnapshot', snapshot),
    semanticStateHash: semanticHash('AuthorityLedgerRecoveryState', recoveryStateBasis(snapshot)),
    authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
  };
  return deepFreeze({ ...basis, checkpointHash: semanticHash('AuthorityRecoveryCheckpoint', basis) });
}

export function restoreAuthorityRecoveryCheckpoint(checkpoint) {
  exactKeys(checkpoint, 'checkpoint', [
    'contractVersion', 'capturedAt', 'snapshot', 'snapshotHash', 'semanticStateHash', 'authorityClaim', 'checkpointHash'
  ]);
  if (checkpoint.contractVersion !== RECOVERY_CHECKPOINT_CONTRACT_VERSION
    || checkpoint.authorityClaim !== RECOVERY_OPERATIONS_NON_AUTHORITY) {
    throw new RecoveryOperationsError('RECOVERY_CHECKPOINT_CONTRACT_MISMATCH', 'unsupported recovery checkpoint contract');
  }
  const { checkpointHash, ...basis } = checkpoint;
  if (semanticHash('AuthorityRecoveryCheckpoint', basis) !== checkpointHash) {
    throw new RecoveryOperationsError('RECOVERY_CHECKPOINT_HASH_MISMATCH', 'checkpoint hash is not reproducible');
  }
  if (semanticHash('AuthorityLedgerRecoverySnapshot', checkpoint.snapshot) !== checkpoint.snapshotHash) {
    throw new RecoveryOperationsError('RECOVERY_SNAPSHOT_HASH_MISMATCH', 'checkpoint snapshot hash is not reproducible');
  }
  if (semanticHash('AuthorityLedgerRecoveryState', recoveryStateBasis(checkpoint.snapshot)) !== checkpoint.semanticStateHash) {
    throw new RecoveryOperationsError('RECOVERY_STATE_HASH_MISMATCH', 'checkpoint semantic state hash is not reproducible');
  }
  const restored = replayAuthorityRecoverySnapshot(checkpoint.snapshot);
  if (restored.report.semanticStateHash !== checkpoint.semanticStateHash) {
    throw new RecoveryOperationsError('RECOVERY_RESTORED_STATE_MISMATCH', 'restored authority state differs from checkpoint state');
  }
  return restored;
}

function validateOperationalTraceEvidence(evidence) {
  exactKeys(evidence, 'operationalTraceEvidence', ['trace', 'journalSnapshot']);
  const journal = new OperationalJobJournal(evidence.journalSnapshot);
  const jobId = requiredText(evidence.trace?.jobId, 'operationalTraceEvidence.trace.jobId');
  const reproduced = projectOperationalTrace({ journal, jobId });
  if (!sameCanonical(reproduced, evidence.trace)) {
    throw new RecoveryOperationsError(
      'OPERATIONAL_TRACE_REPLAY_MISMATCH',
      'operational trace must reproduce exactly from the retained P06 journal snapshot'
    );
  }
  summarizeOperationalTraces([reproduced]);
  for (const entry of evidence.journalSnapshot.jobs) {
    if (entry.job.organizationId !== reproduced.organizationId || entry.job.tenantId !== reproduced.tenantId) {
      throw new RecoveryOperationsError(
        'CROSS_TENANT_OPERATIONAL_EVIDENCE_FORBIDDEN',
        'one incident/SLO evidence snapshot cannot mix another organization/tenant job'
      );
    }
  }
  return deepFreeze({
    trace: reproduced,
    journalSnapshot: cloneFrozen(evidence.journalSnapshot),
    journalSnapshotHash: requiredText(evidence.journalSnapshot.snapshotHash, 'journalSnapshot.snapshotHash'),
    evidenceHash: semanticHash('PilotOperationalEvidence', {
      traceHash: reproduced.traceHash,
      journalSnapshotHash: evidence.journalSnapshot.snapshotHash
    })
  });
}

function terminalAttempt(trace) {
  return trace.attempts.at(-1) ?? null;
}

function classifyOperationalTrace(trace) {
  const terminal = terminalAttempt(trace);
  if (!terminal || terminal.status === 'RUNNING' || terminal.status === 'SUCCEEDED') return null;
  if (terminal.failure?.failureClass === 'PROVIDER_FAILURE') return 'PROVIDER_OUTAGE';
  if (terminal.status === 'BLOCKED') return 'GOVERNED_BLOCK';
  if (terminal.status === 'FAILED'
    && trace.inputAuthorityRefs.some((ref) => ref.kind === 'RuntimeBinding')) return 'RUNTIME_FAILURE';
  if (terminal.status === 'FAILED') return 'PLATFORM_FAILURE';
  return null;
}

function incidentTransport(classification) {
  return classification === 'DECISION_ABSTAIN'
    ? deepFreeze({ class: 'DOMAIN_DISPOSITION', genericServerError: false })
    : deepFreeze({ class: 'OPERATIONAL_INCIDENT', genericServerError: false });
}

function incidentRefsForTrace(ledger, trace) {
  const refs = canonicalRefs(trace.inputAuthorityRefs, 'operationalTrace.inputAuthorityRefs', { allowEmpty: false });
  for (const ref of refs) ledger.resolve(ref);
  return refs;
}

export function createPilotIncident(input) {
  exactKeys(input, 'incidentInput', [
    'ledger', 'incidentId', 'occurredAt', 'operationalTraceEvidence', 'decisionResultRef'
  ]);
  const { ledger, incidentId, occurredAt, operationalTraceEvidence = null, decisionResultRef = null } = input;
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new RecoveryOperationsError('INVALID_RECOVERY_LEDGER', 'incident requires replayable AuthorityLedger');
  }
  if (Boolean(operationalTraceEvidence) === Boolean(decisionResultRef)) {
    throw new RecoveryOperationsError('INCIDENT_EVIDENCE_EXACTLY_ONE_REQUIRED', 'incident requires exactly one operational trace evidence package or DecisionResult ref');
  }
  let classification;
  let organizationId;
  let tenantId = null;
  let evidenceKind;
  let evidenceHash;
  let exactAuthorityRefs;
  let frozenOperationalEvidence = null;
  let frozenDecisionRef = null;

  if (operationalTraceEvidence) {
    const evidence = validateOperationalTraceEvidence(operationalTraceEvidence);
    classification = classifyOperationalTrace(evidence.trace);
    if (!classification) throw new RecoveryOperationsError('NO_INCIDENT_EVIDENCE', 'successful/running trace is not an incident');
    organizationId = requiredText(evidence.trace.organizationId, 'operationalTrace.organizationId');
    tenantId = evidence.trace.tenantId ?? null;
    evidenceKind = 'OPERATIONAL_TRACE';
    evidenceHash = evidence.evidenceHash;
    exactAuthorityRefs = incidentRefsForTrace(ledger, evidence.trace);
    frozenOperationalEvidence = cloneFrozen({ trace: evidence.trace, journalSnapshot: evidence.journalSnapshot });
  } else {
    const decision = validateDecisionResult({ ledger, decisionResultRef });
    if (decision.semanticPayload.decisionDisposition !== 'ABSTAIN') {
      throw new RecoveryOperationsError('NO_INCIDENT_EVIDENCE', 'only governed ABSTAIN DecisionResult is an incident classification input');
    }
    classification = 'DECISION_ABSTAIN';
    organizationId = requiredText(decision.decisionProblem.semanticPayload.targetRef.organizationId, 'DecisionProblem.targetRef.organizationId');
    tenantId = decision.decisionProblem.semanticPayload.targetRef.tenantId ?? null;
    evidenceKind = 'DECISION_RESULT';
    evidenceHash = decision.record.ref.semanticHash;
    frozenDecisionRef = decision.record.ref;
    exactAuthorityRefs = canonicalRefs([decision.record.ref], 'decisionResultRef', { allowEmpty: false });
  }
  if (!INCIDENT_CLASSES.has(classification)) throw new RecoveryOperationsError('INCIDENT_CLASSIFICATION_INVALID', `unsupported incident class ${classification}`);
  const body = {
    contractVersion: INCIDENT_CONTRACT_VERSION,
    incidentId: requiredText(incidentId, 'incidentId'),
    occurredAt: timestamp(occurredAt, 'occurredAt'),
    scope: deepFreeze({ organizationId, ...(tenantId ? { tenantId } : {}) }),
    classification,
    evidenceKind,
    evidenceHash,
    exactAuthorityRefs,
    operationalTraceEvidence: frozenOperationalEvidence,
    decisionResultRef: frozenDecisionRef,
    transportDisposition: incidentTransport(classification),
    authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
  };
  return deepFreeze({ ...body, incidentHash: semanticHash('PilotIncidentRecord', body) });
}

export function replayPilotIncident({ ledger, incident }) {
  exactKeys(incident, 'incident', [
    'contractVersion', 'incidentId', 'occurredAt', 'scope', 'classification', 'evidenceKind', 'evidenceHash',
    'exactAuthorityRefs', 'operationalTraceEvidence', 'decisionResultRef', 'transportDisposition', 'authorityClaim', 'incidentHash'
  ]);
  const { incidentHash, ...body } = incident;
  if (incident.contractVersion !== INCIDENT_CONTRACT_VERSION
    || incident.authorityClaim !== RECOVERY_OPERATIONS_NON_AUTHORITY
    || semanticHash('PilotIncidentRecord', body) !== incidentHash) {
    throw new RecoveryOperationsError('INCIDENT_HASH_MISMATCH', 'incident contract/hash is not reproducible');
  }
  let reproduced;
  if (incident.evidenceKind === 'OPERATIONAL_TRACE') {
    reproduced = createPilotIncident({
      ledger,
      incidentId: incident.incidentId,
      occurredAt: incident.occurredAt,
      operationalTraceEvidence: incident.operationalTraceEvidence,
      decisionResultRef: null
    });
  } else if (incident.evidenceKind === 'DECISION_RESULT') {
    reproduced = createPilotIncident({
      ledger,
      incidentId: incident.incidentId,
      occurredAt: incident.occurredAt,
      operationalTraceEvidence: null,
      decisionResultRef: incident.decisionResultRef
    });
  } else {
    throw new RecoveryOperationsError('INCIDENT_EVIDENCE_KIND_INVALID', `unsupported incident evidence ${incident.evidenceKind}`);
  }
  if (!sameCanonical(reproduced, incident)) {
    throw new RecoveryOperationsError('INCIDENT_REPLAY_MISMATCH', 'incident cannot be reproduced from exact evidence');
  }
  return reproduced;
}

const ROLLBACK_INPUT_KEYS = new Set([
  'ledger', 'deploymentRef', 'suspendControlRef', 'incident', 'preservedAuthorityRefs', 'occurredAt'
]);

export function createDeploymentRollbackRecord(input) {
  plainObject(input, 'rollbackInput');
  for (const key of Object.keys(input)) {
    if (!ROLLBACK_INPUT_KEYS.has(key)) {
      throw new RecoveryOperationsError('RECOVERY_SEMANTIC_OVERRIDE_FORBIDDEN', `rollback input ${key} is not operational recovery authority; semantic changes require new Model/Policy/Knowledge authority`);
    }
  }
  const { ledger, deploymentRef, suspendControlRef, incident, preservedAuthorityRefs, occurredAt } = input;
  const replayedIncident = replayPilotIncident({ ledger, incident });
  const state = currentDeploymentState({ ledger, deploymentRef, allowHistorical: true });
  const deploymentScope = state.deploymentAuthority.semanticPayload.deploymentScope;
  if (!sameTenantScope(replayedIncident.scope, deploymentScope)) {
    throw new RecoveryOperationsError('ROLLBACK_INCIDENT_SCOPE_MISMATCH', 'rollback incident organization/tenant must match exact Deployment scope');
  }
  const controlRef = strictRef(suspendControlRef, 'suspendControlRef');
  if (state.rolloutStage !== 'SUSPENDED' || !state.controlTipRef || !sameAuthorityRef(state.controlTipRef, controlRef)) {
    throw new RecoveryOperationsError('ROLLBACK_REQUIRES_EXACT_SUSPEND_CONTROL', 'pilot rollback requires exact current Deployment SUSPEND control authority');
  }
  const control = ledger.resolve(controlRef);
  if (control.ref.kind !== 'DeploymentControlDecision' || control.semanticPayload.action !== 'SUSPEND') {
    throw new RecoveryOperationsError('ROLLBACK_REQUIRES_EXACT_SUSPEND_CONTROL', 'rollback control must be an exact validated SUSPEND decision');
  }
  const preserved = canonicalRefs(preservedAuthorityRefs, 'preservedAuthorityRefs', { allowEmpty: false });
  for (const ref of preserved) ledger.resolve(ref);
  const body = {
    contractVersion: ROLLBACK_RECORD_CONTRACT_VERSION,
    occurredAt: timestamp(occurredAt, 'occurredAt'),
    deploymentRef: state.deploymentAuthority.record.ref,
    suspendControlRef: controlRef,
    incidentHash: replayedIncident.incidentHash,
    preservedAuthorityRefs: preserved,
    rollbackMode: 'FORWARD_SUSPEND_NO_DATABASE_REWIND',
    semanticMutationAllowed: false,
    authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
  };
  return deepFreeze({ ...body, rollbackHash: semanticHash('PilotRollbackRecord', body) });
}

export function verifyDeploymentRollbackRecord({ ledger, incident, rollbackRecord }) {
  exactKeys(rollbackRecord, 'rollbackRecord', [
    'contractVersion', 'occurredAt', 'deploymentRef', 'suspendControlRef', 'incidentHash', 'preservedAuthorityRefs',
    'rollbackMode', 'semanticMutationAllowed', 'authorityClaim', 'rollbackHash'
  ]);
  const { rollbackHash, ...body } = rollbackRecord;
  if (rollbackRecord.contractVersion !== ROLLBACK_RECORD_CONTRACT_VERSION
    || rollbackRecord.rollbackMode !== 'FORWARD_SUSPEND_NO_DATABASE_REWIND'
    || rollbackRecord.semanticMutationAllowed !== false
    || rollbackRecord.authorityClaim !== RECOVERY_OPERATIONS_NON_AUTHORITY
    || semanticHash('PilotRollbackRecord', body) !== rollbackHash) {
    throw new RecoveryOperationsError('ROLLBACK_RECORD_INVALID', 'rollback record contract/hash is not reproducible');
  }
  const replayedIncident = replayPilotIncident({ ledger, incident });
  if (replayedIncident.incidentHash !== rollbackRecord.incidentHash) {
    throw new RecoveryOperationsError('ROLLBACK_INCIDENT_MISMATCH', 'rollback record references another incident');
  }
  const state = currentDeploymentState({ ledger, deploymentRef: rollbackRecord.deploymentRef, allowHistorical: true });
  if (!sameTenantScope(replayedIncident.scope, state.deploymentAuthority.semanticPayload.deploymentScope)) {
    throw new RecoveryOperationsError('ROLLBACK_INCIDENT_SCOPE_MISMATCH', 'rollback incident organization/tenant no longer matches exact Deployment scope');
  }
  if (state.rolloutStage !== 'SUSPENDED' || !state.controlTipRef
    || !sameAuthorityRef(state.controlTipRef, rollbackRecord.suspendControlRef)) {
    throw new RecoveryOperationsError('ROLLBACK_SUSPEND_STATE_LOST', 'Deployment suspend authority no longer reproduces rollback state');
  }
  for (const ref of rollbackRecord.preservedAuthorityRefs) ledger.resolve(ref);
  return deepFreeze({
    rollbackHash,
    deploymentStillSuspended: true,
    preservedAuthorityCount: rollbackRecord.preservedAuthorityRefs.length,
    historicalAuthorityPreserved: true,
    authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
  });
}

function nearestRankP95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function sloObservationTime(trace) {
  const terminal = terminalAttempt(trace);
  if (!terminal) {
    throw new RecoveryOperationsError('SLO_TRACE_OBSERVATION_TIME_REQUIRED', 'SLO evidence requires at least one observed attempt');
  }
  return terminal.status === 'RUNNING'
    ? timestamp(terminal.startedAt, 'attempt.startedAt')
    : timestamp(terminal.completedAt, 'attempt.completedAt');
}

export function createPilotSloReport({ traceEvidence, windowStart, windowEnd, objectives }) {
  if (!Array.isArray(traceEvidence)) throw new RecoveryOperationsError('INVALID_SLO_EVIDENCE', 'traceEvidence must be an array');
  plainObject(objectives, 'objectives');
  exactKeys(objectives, 'objectives', ['successTargetBasisPoints', 'maxP95DurationMs', 'maxProviderOutageCount']);
  const start = timestamp(windowStart, 'windowStart');
  const end = timestamp(windowEnd, 'windowEnd');
  if (end <= start) throw new RecoveryOperationsError('INVALID_SLO_WINDOW', 'windowEnd must be after windowStart');
  const evidence = traceEvidence.map(validateOperationalTraceEvidence);
  const traces = evidence.map((item) => item.trace);
  const seenJobs = new Set();
  for (const trace of traces) {
    if (seenJobs.has(trace.jobId)) {
      throw new RecoveryOperationsError('DUPLICATE_SLO_JOB_EVIDENCE', `SLO report cannot count job ${trace.jobId} more than once`);
    }
    seenJobs.add(trace.jobId);
    const observedAt = sloObservationTime(trace);
    if (observedAt < start || observedAt >= end) {
      throw new RecoveryOperationsError('SLO_TRACE_OUTSIDE_WINDOW', 'trace observation must fall inside declared [windowStart, windowEnd)');
    }
  }
  const summary = summarizeOperationalTraces(traces);
  const successTargetBasisPoints = integer(objectives.successTargetBasisPoints, 'successTargetBasisPoints', { min: 0, max: 10000 });
  const maxP95DurationMs = integer(objectives.maxP95DurationMs, 'maxP95DurationMs');
  const maxProviderOutageCount = integer(objectives.maxProviderOutageCount, 'maxProviderOutageCount');

  let succeeded = 0;
  let failed = 0;
  let blocked = 0;
  let running = 0;
  const providerOutageCount = summary.failedAttemptCountByClass?.PROVIDER_FAILURE ?? 0;
  const terminalDurations = [];
  for (const trace of traces) {
    const terminal = terminalAttempt(trace);
    if (!terminal || terminal.status === 'RUNNING') {
      running += 1;
      continue;
    }
    if (terminal.status === 'SUCCEEDED') succeeded += 1;
    else if (terminal.status === 'BLOCKED') blocked += 1;
    else if (terminal.status === 'FAILED') failed += 1;
    if (terminal.status !== 'BLOCKED') terminalDurations.push(integer(terminal.durationMs, 'attempt.durationMs'));
  }
  const serviceEligibleJobs = succeeded + failed;
  const successBasisPoints = serviceEligibleJobs === 0 ? null : Math.floor((succeeded * 10000) / serviceEligibleJobs);
  const p95DurationMs = nearestRankP95(terminalDurations);
  const successObjectiveMet = serviceEligibleJobs > 0 && succeeded * 10000 >= successTargetBasisPoints * serviceEligibleJobs;
  const latencyObjectiveMet = p95DurationMs !== null && p95DurationMs <= maxP95DurationMs;
  const providerObjectiveMet = providerOutageCount <= maxProviderOutageCount;
  const evaluation = serviceEligibleJobs === 0
    ? 'INSUFFICIENT_DATA'
    : (successObjectiveMet && latencyObjectiveMet && providerObjectiveMet ? 'PASS' : 'FAIL');
  const body = {
    contractVersion: PILOT_SLO_CONTRACT_VERSION,
    window: { start, end },
    scope: {
      organizationId: summary.organizationId,
      ...(summary.tenantId ? { tenantId: summary.tenantId } : {})
    },
    objectives: { successTargetBasisPoints, maxP95DurationMs, maxProviderOutageCount },
    measurements: {
      totalJobs: traces.length,
      serviceEligibleJobs,
      succeededJobs: succeeded,
      failedJobs: failed,
      governedBlockedJobs: blocked,
      incompleteJobs: running,
      providerOutageCount,
      successBasisPoints,
      p95DurationMs
    },
    evaluation,
    successObjectiveMet,
    latencyObjectiveMet,
    providerObjectiveMet,
    evidenceHashes: evidence.map((item) => item.evidenceHash).sort(),
    traceHashes: traces.map((trace) => trace.traceHash).sort(),
    blockedCountsAreNotServiceErrors: true,
    authorityClaim: RECOVERY_OPERATIONS_NON_AUTHORITY
  };
  return deepFreeze({ ...body, sloReportHash: semanticHash('PilotSloReport', body) });
}
