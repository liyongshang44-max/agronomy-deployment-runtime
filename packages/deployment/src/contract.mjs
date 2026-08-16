import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { RUNTIME_ENVIRONMENTS, ROLLOUT_STAGES } from '../../runtime-profile/src/index.mjs';

export const DEPLOYMENT_CONTRACT_VERSION = 'adr.deployment.v1';
export const DEPLOYMENT_AUTHORITY_CLASS = 'DEPLOYMENT_CONTROL';
export const ACTIVE_ROLLOUT_STAGES = deepFreeze(
  ROLLOUT_STAGES.filter((stage) => !['SUSPENDED', 'DEPRECATED'].includes(stage))
);

const RUNTIME_ENVIRONMENT_SET = new Set(RUNTIME_ENVIRONMENTS);
const ACTIVE_ROLLOUT_STAGE_SET = new Set(ACTIVE_ROLLOUT_STAGES);
const DEPLOYMENT_KEYS = new Set([
  'contractVersion', 'authorityClass', 'runtimeProfileRef', 'deploymentScope',
  'authorizedUse', 'effectiveInterval', 'runtimeEnvironment', 'rolloutStage'
]);
const SCOPE_KEYS = new Set([
  'organizationId', 'tenantId', 'programId', 'regions', 'crops', 'decisionTypes'
]);
const USE_KEYS = new Set(['usePurposes', 'useClasses']);
const INTERVAL_KEYS = new Set(['start', 'end']);
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class DeploymentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeploymentError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INPUT', `${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new DeploymentError('INVALID_DEPLOYMENT_FIELD', `${name}.${key} is not part of ${DEPLOYMENT_CONTRACT_VERSION}`);
    }
  }
}

function canonicalSet(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new DeploymentError('INVALID_DEPLOYMENT_SCOPE', `${name} must be a non-empty array`);
  }
  const normalized = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new DeploymentError('DUPLICATE_DEPLOYMENT_SCOPE_VALUE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...normalized].sort());
}

function timestamp(value, name) {
  const raw = text(value, name);
  if (!RFC3339_RE.test(raw)) {
    throw new DeploymentError('INVALID_DEPLOYMENT_TIME', `${name} must be explicit RFC3339 with timezone and <= millisecond precision`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new DeploymentError('INVALID_DEPLOYMENT_TIME', `${name} must be a valid timestamp`);
  }
  return parsed.toISOString();
}

function normalizeScope(value) {
  exactObject(value, 'deploymentScope', SCOPE_KEYS);
  return deepFreeze({
    organizationId: text(value.organizationId, 'deploymentScope.organizationId'),
    ...(value.tenantId ? { tenantId: text(value.tenantId, 'deploymentScope.tenantId') } : {}),
    programId: text(value.programId, 'deploymentScope.programId'),
    regions: canonicalSet(value.regions, 'deploymentScope.regions'),
    crops: canonicalSet(value.crops, 'deploymentScope.crops'),
    decisionTypes: canonicalSet(value.decisionTypes, 'deploymentScope.decisionTypes')
  });
}

function normalizeAuthorizedUse(value) {
  exactObject(value, 'authorizedUse', USE_KEYS);
  return deepFreeze({
    usePurposes: canonicalSet(value.usePurposes, 'authorizedUse.usePurposes'),
    useClasses: canonicalSet(value.useClasses, 'authorizedUse.useClasses')
  });
}

function normalizeEffectiveInterval(value) {
  exactObject(value, 'effectiveInterval', INTERVAL_KEYS);
  const start = timestamp(value.start, 'effectiveInterval.start');
  const end = timestamp(value.end, 'effectiveInterval.end');
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INTERVAL', 'effectiveInterval.end must be after start');
  }
  return deepFreeze({ start, end });
}

export function normalizeDeployment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DeploymentError('INVALID_DEPLOYMENT_INPUT', 'deployment must be an object');
  }
  for (const key of Object.keys(value)) {
    if (!DEPLOYMENT_KEYS.has(key)) {
      throw new DeploymentError(
        'INVALID_DEPLOYMENT_FIELD',
        `${key} is not part of ${DEPLOYMENT_CONTRACT_VERSION}; legacy environment aliases and embedded runtime/scientific authority are forbidden`
      );
    }
  }
  const contractVersion = text(value.contractVersion, 'contractVersion');
  if (contractVersion !== DEPLOYMENT_CONTRACT_VERSION) {
    throw new DeploymentError('UNSUPPORTED_DEPLOYMENT_CONTRACT', `unsupported contractVersion ${contractVersion}`);
  }
  if (value.authorityClass !== undefined && value.authorityClass !== DEPLOYMENT_AUTHORITY_CLASS) {
    throw new DeploymentError('INVALID_DEPLOYMENT_AUTHORITY_CLASS', `authorityClass must be ${DEPLOYMENT_AUTHORITY_CLASS}`);
  }
  const runtimeProfileRef = assertAuthorityRef(value.runtimeProfileRef);
  if (runtimeProfileRef.kind !== 'RuntimeProfile') {
    throw new DeploymentError('RUNTIME_PROFILE_REQUIRED', 'Deployment must bind one exact RuntimeProfile ref');
  }
  const runtimeEnvironment = text(value.runtimeEnvironment, 'runtimeEnvironment');
  if (!RUNTIME_ENVIRONMENT_SET.has(runtimeEnvironment)) {
    throw new DeploymentError('INVALID_RUNTIME_ENVIRONMENT', `unsupported runtimeEnvironment ${runtimeEnvironment}`);
  }
  const rolloutStage = text(value.rolloutStage, 'rolloutStage');
  if (!ACTIVE_ROLLOUT_STAGE_SET.has(rolloutStage)) {
    if (['SUSPENDED', 'DEPRECATED'].includes(rolloutStage)) {
      throw new DeploymentError(
        'DEPLOYMENT_TERMINAL_STAGE_REQUIRES_CONTROL_DECISION',
        `${rolloutStage} is a lifecycle state and cannot be used as an initial Deployment rolloutStage`
      );
    }
    throw new DeploymentError('INVALID_ROLLOUT_STAGE', `unsupported rolloutStage ${rolloutStage}`);
  }
  return deepFreeze({
    contractVersion,
    authorityClass: DEPLOYMENT_AUTHORITY_CLASS,
    runtimeProfileRef,
    deploymentScope: normalizeScope(value.deploymentScope),
    authorizedUse: normalizeAuthorizedUse(value.authorizedUse),
    effectiveInterval: normalizeEffectiveInterval(value.effectiveInterval),
    runtimeEnvironment,
    rolloutStage
  });
}

export function normalizeDeploymentTimestamp(value, name = 'timestamp') {
  return timestamp(value, name);
}
