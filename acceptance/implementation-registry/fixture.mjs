import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import { publishImplementation } from '../../packages/implementation-registry/src/index.mjs';

let seq = 0;
export function audit(actor = { type: 'USER', id: 'implementation-manager' }, suite = 's02') {
  seq += 1;
  return {
    eventId: `${suite}-${seq}`,
    occurredAt: '2026-08-16T14:00:00.000Z',
    actor,
    details: { suite }
  };
}

export const manager = createPrincipal({
  principalId: 'implementation-manager',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});

export function controlScope() {
  return { organizationId: 'org-a', tenantId: 'tenant-a' };
}

export function makeEnv({ principal = manager, roleScope = controlScope() } = {}) {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: `role.implementation.${principal.principalId}`,
    version: '1',
    principal,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
    scope: roleScope,
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  return { ledger, manager: principal, assignment };
}

function hash(char) { return `sha256:${char.repeat(64)}`; }

export function implementationSpec({ providerType = 'INTERNAL', digestChar = 'a', artifactChar = 'b', ...overrides } = {}) {
  const locator = {
    INTERNAL: { kind: 'INTERNAL_FUNCTION', value: 'adr.runtime.rootZoneWaterV1' },
    HTTP: { kind: 'HTTPS_ENDPOINT', value: 'https://model.example.test/v1/execute' },
    CUSTOMER: { kind: 'CUSTOMER_RUNTIME', value: 'customer-runtime:model-service-v1' },
    FIRST_PARTY: { kind: 'FIRST_PARTY_RUNTIME', value: 'first-party-runtime:model-service-v1' },
    WASM: { kind: 'WASM_MODULE', value: 'wasm:sha256-model-module-v1' },
    BATCH: { kind: 'BATCH_JOB', value: 'batch:root-zone-water-v1' }
  }[providerType];
  return {
    contractVersion: 'adr.implementation.v1',
    controlScope: controlScope(),
    providerType,
    implementationDigest: hash(digestChar),
    executionLocator: locator,
    artifact: {
      artifactId: `artifact:${providerType.toLowerCase()}:root-zone-water-v1`,
      contentHash: hash(artifactChar)
    },
    runtimeMetadata: {
      runtime: providerType === 'WASM' ? 'wasm' : providerType === 'HTTP' ? 'container' : 'node',
      runtimeVersion: providerType === 'WASM' ? 'wasm32-wasi-v1' : providerType === 'HTTP' ? 'oci-v1' : '24',
      platform: 'linux',
      architecture: providerType === 'WASM' ? 'wasm32' : 'x64'
    },
    operationalConstraints: providerType === 'HTTP' ? ['NETWORK_REQUIRED'] : ['NO_DYNAMIC_CODE_LOADING'],
    conformanceClaim: 'NONE_REGISTRATION_ONLY',
    ...overrides
  };
}

export function authorize(env, logicalId, { principal = env.manager, assignment = env.assignment } = {}) {
  const decision = authorizeImplementationManage({
    principal,
    roleAssignments: [assignment],
    authorizationScope: {
      ...controlScope(),
      resourceType: 'IMPLEMENTATION',
      resourceId: logicalId
    }
  });
  const authorizationRecord = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'auth')
  });
  return { decision, authorizationRecord };
}

export function publish(env, logicalId, version = '1', implementation = implementationSpec()) {
  const { authorizationRecord } = authorize(env, logicalId);
  return publishImplementation({
    ledger: env.ledger,
    logicalId,
    version,
    implementation,
    principal: env.manager,
    authorizationDecisionAuditRef: authorizationRecord.ref,
    audit: audit({ type: env.manager.type, id: env.manager.principalId }, 'publish')
  });
}
