import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import { DeploymentError } from './contract.mjs';
import { validateDeploymentAuthority } from './publication.mjs';
import { validateDeploymentControlAuthorization } from './validation.mjs';

const CONTROL_ACTIONS = new Set(['SUSPEND', 'RESUME', 'DEPRECATE']);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}
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
    throw new DeploymentError('DEPLOYMENT_CONTROL_REASON_REQUIRED', 'reasonCodes must be a non-empty array');
  }
  const normalized = values.map((value, index) => text(value, `reasonCodes[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new DeploymentError('DUPLICATE_DEPLOYMENT_CONTROL_REASON', 'reasonCodes cannot contain duplicates');
  }
  return deepFreeze([...normalized].sort());
}

export function deploymentControlLogicalId(deploymentRef) {
  const ref = assertAuthorityRef(deploymentRef);
  if (ref.kind !== 'Deployment') throw new DeploymentError('DEPLOYMENT_REQUIRED', 'control target must be Deployment');
  return `deployment-control:${ref.logicalId}:${ref.version}:${ref.semanticHash}`;
}

function normalizeControlPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_INPUT', 'control decision must be an object');
  }
  const allowed = new Set(['deploymentRef', 'action', 'predecessorControlRef', 'reasonCodes']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_FIELD', `unsupported control field ${key}`);
  }
  const deploymentRef = assertAuthorityRef(value.deploymentRef);
  if (deploymentRef.kind !== 'Deployment') throw new DeploymentError('DEPLOYMENT_REQUIRED', 'control decision must target Deployment');
  const action = text(value.action, 'action');
  if (!CONTROL_ACTIONS.has(action)) throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_ACTION', `unsupported control action ${action}`);
  let predecessorControlRef = null;
  if (value.predecessorControlRef !== null && value.predecessorControlRef !== undefined) {
    predecessorControlRef = assertAuthorityRef(value.predecessorControlRef);
    if (predecessorControlRef.kind !== 'DeploymentControlDecision') {
      throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_PREDECESSOR', 'predecessorControlRef must be DeploymentControlDecision');
    }
  }
  return deepFreeze({
    deploymentRef,
    action,
    predecessorControlRef,
    reasonCodes: reasonCodes(value.reasonCodes)
  });
}

function validateControlRecord({ ledger, record, deploymentAuthority }) {
  const payload = normalizeControlPayload(record.semanticPayload);
  if (!sameAuthorityRef(payload.deploymentRef, deploymentAuthority.record.ref)) {
    throw new DeploymentError('DEPLOYMENT_CONTROL_TARGET_MISMATCH', 'control decision targets another Deployment');
  }
  if (record.ref.logicalId !== deploymentControlLogicalId(deploymentAuthority.record.ref)
    || semanticHash('DeploymentControlDecision', payload) !== record.ref.semanticHash) {
    throw new DeploymentError('DEPLOYMENT_CONTROL_SEMANTICS_INVALID', 'control record does not match A06 identity contract');
  }
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  let valid = null;
  for (const event of direct) {
    if (event.action !== `DEPLOYMENT_${payload.action}`
      || !event.details?.controlPrincipal
      || !event.details?.authorizationDecisionAuditRef) continue;
    try {
      const principal = createPrincipal(event.details.controlPrincipal);
      if (event.actor?.id !== principal.principalId || event.actor?.type !== principal.type) continue;
      const authorization = validateDeploymentControlAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal,
        deployment: deploymentAuthority.semanticPayload,
        logicalId: deploymentAuthority.record.ref.logicalId,
        action: payload.action
      });
      const expectedInputs = [
        deploymentAuthority.record.ref,
        authorization.ref,
        ...(payload.predecessorControlRef ? [payload.predecessorControlRef] : [])
      ];
      if (!sameRefSet(event.inputRefs, expectedInputs)) continue;
      valid = { record, semanticPayload: payload, principal, authorization };
      break;
    } catch {
      valid = null;
    }
  }
  if (!valid) throw new DeploymentError('DEPLOYMENT_CONTROL_AUTHORITY_INVALID', 'control decision lacks replayable control authority');
  return deepFreeze(valid);
}

function applyAction(stage, baseStage, action) {
  if (action === 'SUSPEND') {
    if (stage === 'SUSPENDED' || stage === 'DEPRECATED') {
      throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_TRANSITION', `cannot SUSPEND from ${stage}`);
    }
    return 'SUSPENDED';
  }
  if (action === 'RESUME') {
    if (stage !== 'SUSPENDED') throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_TRANSITION', `cannot RESUME from ${stage}`);
    return baseStage;
  }
  if (action === 'DEPRECATE') {
    if (stage === 'DEPRECATED') throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_TRANSITION', 'Deployment is already DEPRECATED');
    return 'DEPRECATED';
  }
  throw new DeploymentError('INVALID_DEPLOYMENT_CONTROL_ACTION', `unsupported control action ${action}`);
}

export function currentDeploymentState({ ledger, deploymentRef, allowHistorical = false }) {
  const deploymentAuthority = validateDeploymentAuthority({ ledger, deploymentRef, allowHistorical });
  const controlId = deploymentControlLogicalId(deploymentAuthority.record.ref);
  const candidates = ledger.listVersions('DeploymentControlDecision', controlId)
    .map((ref) => ledger.resolve(ref));
  const valid = [];
  for (const candidate of candidates) {
    try { valid.push(validateControlRecord({ ledger, record: candidate, deploymentAuthority })); }
    catch { /* Generic/forged control records do not gain lifecycle authority. */ }
  }
  if (valid.length === 0) {
    return deepFreeze({
      deploymentAuthority,
      rolloutStage: deploymentAuthority.semanticPayload.rolloutStage,
      baseRolloutStage: deploymentAuthority.semanticPayload.rolloutStage,
      controlTipRef: null,
      controls: []
    });
  }
  const byKey = new Map(valid.map((item) => [refKey(item.record.ref), item]));
  const roots = valid.filter((item) => item.semanticPayload.predecessorControlRef === null);
  if (roots.length !== 1) throw new DeploymentError('DEPLOYMENT_CONTROL_CONFLICT', 'valid Deployment control history must have exactly one root');
  const successors = new Map();
  for (const item of valid) {
    const predecessor = item.semanticPayload.predecessorControlRef;
    if (!predecessor) continue;
    const key = refKey(predecessor);
    if (!byKey.has(key)) throw new DeploymentError('DEPLOYMENT_CONTROL_CONFLICT', 'valid control references a missing predecessor');
    const list = successors.get(key) ?? [];
    list.push(item);
    successors.set(key, list);
  }
  let current = roots[0];
  let stage = deploymentAuthority.semanticPayload.rolloutStage;
  const ordered = [];
  const seen = new Set();
  while (current) {
    const key = refKey(current.record.ref);
    if (seen.has(key)) throw new DeploymentError('DEPLOYMENT_CONTROL_CONFLICT', 'control history contains a cycle');
    seen.add(key);
    stage = applyAction(stage, deploymentAuthority.semanticPayload.rolloutStage, current.semanticPayload.action);
    ordered.push(current);
    const next = successors.get(key) ?? [];
    if (next.length > 1) throw new DeploymentError('DEPLOYMENT_CONTROL_CONFLICT', 'control history contains competing successors');
    current = next[0] ?? null;
  }
  if (seen.size !== valid.length) throw new DeploymentError('DEPLOYMENT_CONTROL_CONFLICT', 'control history contains an orphan/competing branch');
  return deepFreeze({
    deploymentAuthority,
    rolloutStage: stage,
    baseRolloutStage: deploymentAuthority.semanticPayload.rolloutStage,
    controlTipRef: ordered.at(-1)?.record.ref ?? null,
    controls: ordered.map((item) => item.record.ref)
  });
}

export function publishDeploymentControlDecision({
  ledger,
  deploymentRef,
  version,
  action,
  principal,
  authorizationDecisionAuditRef,
  reasonCodes: reasons,
  audit
}) {
  const state = currentDeploymentState({ ledger, deploymentRef, allowHistorical: false });
  const normalizedAction = text(action, 'action');
  const nextStage = applyAction(state.rolloutStage, state.baseRolloutStage, normalizedAction);
  const actor = createPrincipal(principal);
  const authorization = validateDeploymentControlAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: actor,
    deployment: state.deploymentAuthority.semanticPayload,
    logicalId: state.deploymentAuthority.record.ref.logicalId,
    action: normalizedAction
  });
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new DeploymentError('DEPLOYMENT_CONTROL_AUDIT_ACTOR_MISMATCH', 'control audit actor must equal exact controller principal');
  }
  const payload = normalizeControlPayload({
    deploymentRef: state.deploymentAuthority.record.ref,
    action: normalizedAction,
    predecessorControlRef: state.controlTipRef,
    reasonCodes: reasons
  });
  const record = ledger.publish({
    kind: 'DeploymentControlDecision',
    logicalId: deploymentControlLogicalId(state.deploymentAuthority.record.ref),
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: `DEPLOYMENT_${normalizedAction}`,
      inputRefs: [
        state.deploymentAuthority.record.ref,
        authorization.ref,
        ...(state.controlTipRef ? [state.controlTipRef] : [])
      ],
      details: {
        ...(audit.details ?? {}),
        controlPrincipal: actor,
        authorizationDecisionAuditRef: authorization.ref,
        resultingRolloutStage: nextStage
      }
    }
  });
  validateControlRecord({ ledger, record, deploymentAuthority: state.deploymentAuthority });
  return record;
}
