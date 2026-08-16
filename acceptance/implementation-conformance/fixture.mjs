import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import {
  authorizeImplementationConformanceQualification,
  authorizeImplementationConformanceControl
} from '../../packages/authorization/src/implementation-conformance-control.mjs';
import {
  publishQualifiedTransformation,
  publishModel,
  publishPolicy
} from '../../packages/specification-registry/src/index.mjs';
import { publishImplementation } from '../../packages/implementation-registry/src/index.mjs';
import {
  publishImplementationConformance,
  publishImplementationConformanceControlDecision
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  transformationSpec,
  modelSpec,
  policySpec
} from '../specification/fixture.mjs';
import { implementationSpec } from '../implementation-registry/fixture.mjs';

let seq = 0;
export function audit(actor, suite = 's03') {
  seq += 1;
  return {
    eventId: `${suite}-${seq}`,
    occurredAt: '2026-08-16T14:30:00.000Z',
    actor: actor ?? { type: 'USER', id: 'conformance-qualifier' },
    details: { suite }
  };
}

export const specManager = createPrincipal({
  principalId: 'spec-manager-s03', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
export const implementationManager = createPrincipal({
  principalId: 'implementation-manager-s03', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
export const qualifier = createPrincipal({
  principalId: 'conformance-qualifier', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});

export function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function actor(principal) { return { type: principal.type, id: principal.principalId }; }

export function makeEnv() {
  const ledger = new AuthorityLedger();
  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.s03.spec-manager',
    version: '1',
    principal: specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  const implementationAssignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.s03.implementation-manager',
    version: '1',
    principal: implementationManager,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
    scope: controlScope(),
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  const qualifierAssignment = publishRoleAssignment({
    ledger,
    logicalId: 'role.s03.conformance-qualifier',
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ type: 'USER', id: 'iam-admin' }, 'iam')
  });
  return { ledger, specAssignment, implementationAssignment, qualifierAssignment, specManager, implementationManager, qualifier };
}

export function publishSpec(env, kind = 'Model', logicalId = `s03-${kind.toLowerCase()}`, version = '1', specification) {
  const resourceType = { QualifiedTransformation: 'QUALIFIED_TRANSFORMATION', Model: 'MODEL', Policy: 'POLICY' }[kind];
  const decision = authorizeSpecificationManage({
    principal: env.specManager,
    roleAssignments: [env.specAssignment],
    authorizationScope: { ...controlScope(), resourceType, resourceId: logicalId }
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'spec-auth')
  });
  const args = {
    ledger: env.ledger,
    logicalId,
    version,
    specification: specification ?? (kind === 'QualifiedTransformation' ? transformationSpec() : kind === 'Policy' ? policySpec() : modelSpec()),
    principal: env.specManager,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(actor(env.specManager), 'spec-publish')
  };
  if (kind === 'QualifiedTransformation') return publishQualifiedTransformation(args);
  if (kind === 'Policy') return publishPolicy(args);
  return publishModel(args);
}

export function publishImpl(env, logicalId = 's03-implementation', version = '1', implementation = implementationSpec()) {
  const decision = authorizeImplementationManage({
    principal: env.implementationManager,
    roleAssignments: [env.implementationAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: logicalId }
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'impl-auth')
  });
  return publishImplementation({
    ledger: env.ledger,
    logicalId,
    version,
    implementation,
    principal: env.implementationManager,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(actor(env.implementationManager), 'impl-publish')
  });
}

function h(char) { return `sha256:${char.repeat(64)}`; }
export function qualificationMethod(char = 'c') {
  return { methodId: 'adr.conformance.compatibility-suite.v1', definitionHash: h(char) };
}
export function compatibilityTests({ outcome = 'PASS', omit = null } = {}) {
  const all = [
    ['INPUT_CONTRACT_COMPATIBILITY', 'input-contract', '1', '4'],
    ['OUTPUT_CONTRACT_COMPATIBILITY', 'output-contract', '2', '5'],
    ['EXECUTION_FIXTURE', 'execution-fixture', '3', '6']
  ].filter(([type]) => type !== omit);
  return all.map(([testType, testId, definition, result]) => ({
    testType,
    testId,
    definitionHash: h(definition),
    resultHash: h(result),
    outcome
  }));
}

export function authorizeQualification(env, logicalId, { principal = env.qualifier, assignment = env.qualifierAssignment } = {}) {
  const decision = authorizeImplementationConformanceQualification({
    principal,
    roleAssignments: [assignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: logicalId }
  });
  const record = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'conformance-auth')
  });
  return { decision, record };
}

export function publishConformance(env, {
  logicalId = 's03-conformance',
  version = '1',
  specificationRef,
  implementationRef,
  method = qualificationMethod(),
  tests = compatibilityTests(),
  runtimeEnvironments = ['DEVELOPMENT', 'STAGING'],
  requiredCapabilities = ['DETERMINISTIC_DECIMAL_V1'],
  knownLimitations = ['NO_PRODUCTION_QUALIFICATION'],
  validityInterval = { start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' },
  principal = env.qualifier,
  assignment = env.qualifierAssignment
} = {}) {
  const { record: auth } = authorizeQualification(env, logicalId, { principal, assignment });
  return publishImplementationConformance({
    ledger: env.ledger,
    logicalId,
    version,
    specificationRef,
    implementationRef,
    controlScope: controlScope(),
    qualificationMethod: method,
    compatibilityTests: tests,
    runtimeEnvironments,
    requiredCapabilities,
    knownLimitations,
    validityInterval,
    principal,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(actor(principal), 'conformance-publish')
  });
}

export function currentExecutionContext(implementation, runtimeEnvironment = 'STAGING', capabilities = ['DETERMINISTIC_DECIMAL_V1']) {
  return {
    ...implementation.semanticPayload.runtimeMetadata,
    runtimeEnvironment,
    capabilities
  };
}

export function authorizeControl(env, conformance, action, { principal = env.qualifier, assignment = env.qualifierAssignment } = {}) {
  const decision = authorizeImplementationConformanceControl({
    action,
    principal,
    roleAssignments: [assignment],
    authorizationScope: {
      ...conformance.semanticPayload.controlScope,
      resourceType: 'IMPLEMENTATION_CONFORMANCE',
      resourceId: conformance.ref.logicalId
    }
  });
  const record = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit({ type: 'SERVICE_ACCOUNT', id: 'iam-engine' }, 'control-auth')
  });
  return { decision, record };
}

export function control(env, conformance, action, {
  version = '1', successorRef = null, controlledAt = '2026-08-16T15:00:00.000Z', reasonCodes = ['S03_TEST_CONTROL']
} = {}) {
  const { record: auth } = authorizeControl(env, conformance, action);
  return publishImplementationConformanceControlDecision({
    ledger: env.ledger,
    conformanceRef: conformance.ref,
    version,
    action,
    successorRef,
    controlledAt,
    reasonCodes,
    principal: env.qualifier,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(actor(env.qualifier), 'control-publish')
  });
}
