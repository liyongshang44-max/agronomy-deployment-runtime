import assert from 'node:assert/strict';
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
import { publishModel } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementation } from '../../packages/implementation-registry/src/index.mjs';
import {
  publishImplementationConformance,
  publishImplementationConformanceControlDecision
} from '../../packages/implementation-conformance/src/index.mjs';
import {
  publishRuntimeBinding,
  validateRuntimeBinding
} from '../../packages/runtime-binding/src/index.mjs';
import { modelSpec } from '../specification/fixture.mjs';
import { implementationSpec } from '../implementation-registry/fixture.mjs';
import { compatibilityTests, qualificationMethod } from './fixture.mjs';
import {
  audit as bindingAudit,
  directBindingWorld,
  legalPath
} from '../runtime-binding/fixture.mjs';

let seq = 0;
function audit(principal, suffix = 's03-binding') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:15:00.000Z',
    actor: { type: principal.type, id: principal.principalId },
    details: { suite: 'implementation-conformance-binding' }
  };
}
function serviceAudit(suffix) {
  return audit({ type: 'SERVICE_ACCOUNT', principalId: 'iam-engine' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function principal(id) {
  return createPrincipal({ principalId: id, type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
}

function installExecutionAuthority(world, label, {
  validityInterval = { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
  runtimeEnvironments = ['STAGING'],
  requiredCapabilities = ['DETERMINISTIC_DECIMAL_V1'],
  conformanceVersion = '1',
  implementationVersion = '1',
  implementationOverrides = {},
  knownLimitations = []
} = {}) {
  const ledger = world.env.ledger;
  const specManager = principal(`s03-spec-${label}`);
  const implManager = principal(`s03-impl-${label}`);
  const qualifier = principal(`s03-qualifier-${label}`);
  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.s03.binding.spec.${label}`,
    version: '1',
    principal: specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v1',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ type: 'USER', principalId: 'iam-admin' }, 'iam')
  });
  const implAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.s03.binding.impl.${label}`,
    version: '1',
    principal: implManager,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
    scope: controlScope(),
    audit: audit({ type: 'USER', principalId: 'iam-admin' }, 'iam')
  });
  const qualifierAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.s03.binding.qualifier.${label}`,
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ type: 'USER', principalId: 'iam-admin' }, 'iam')
  });

  const modelId = `model.s03.binding.${label}`;
  const specDecision = authorizeSpecificationManage({
    principal: specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'MODEL', resourceId: modelId }
  });
  const specAuth = recordAuthorizationDecision({ ledger, decision: specDecision, audit: serviceAudit('spec-auth') });
  const model = publishModel({
    ledger,
    logicalId: modelId,
    version: '1',
    specification: modelSpec(),
    principal: specManager,
    authorizationDecisionAuditRef: specAuth.ref,
    audit: audit(specManager, 'spec-publish')
  });

  const implId = `implementation.s03.binding.${label}`;
  const implDecision = authorizeImplementationManage({
    principal: implManager,
    roleAssignments: [implAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: implId }
  });
  const implAuth = recordAuthorizationDecision({ ledger, decision: implDecision, audit: serviceAudit('impl-auth') });
  const implementation = publishImplementation({
    ledger,
    logicalId: implId,
    version: implementationVersion,
    implementation: implementationSpec({ ...implementationOverrides }),
    principal: implManager,
    authorizationDecisionAuditRef: implAuth.ref,
    audit: audit(implManager, 'impl-publish')
  });

  const conformanceId = `conformance.s03.binding.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: qualifier,
    roleAssignments: [qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId }
  });
  const conformanceAuth = recordAuthorizationDecision({
    ledger,
    decision: conformanceDecision,
    audit: serviceAudit('conformance-auth')
  });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: conformanceVersion,
    specificationRef: model.ref,
    implementationRef: implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod(),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments,
    requiredCapabilities,
    knownLimitations,
    validityInterval,
    principal: qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(qualifier, 'conformance-publish')
  });
  return { model, implementation, conformance, qualifier, qualifierAssignment };
}

function executionInput(authority, capabilities = ['DETERMINISTIC_DECIMAL_V1']) {
  return {
    specificationRef: authority.model.ref,
    implementationRef: authority.implementation.ref,
    implementationConformanceRef: authority.conformance.ref,
    availableCapabilities: capabilities
  };
}

function bind(world, label, authority, capabilities) {
  return publishRuntimeBinding({
    ledger: world.env.ledger,
    logicalId: `runtime-binding.s03.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    selectedAlternativePathId: legalPath(world).pathId,
    specificationExecutionBinding: executionInput(authority, capabilities),
    audit: bindingAudit(world.env.runtimePrincipal, `s03-${label}`)
  });
}

function control(world, authority, action, { successorRef = null, version = '1' } = {}) {
  const decision = authorizeImplementationConformanceControl({
    action,
    principal: authority.qualifier,
    roleAssignments: [authority.qualifierAssignment],
    authorizationScope: {
      ...controlScope(),
      resourceType: 'IMPLEMENTATION_CONFORMANCE',
      resourceId: authority.conformance.ref.logicalId
    }
  });
  const auth = recordAuthorizationDecision({ ledger: world.env.ledger, decision, audit: serviceAudit('control-auth') });
  return publishImplementationConformanceControlDecision({
    ledger: world.env.ledger,
    conformanceRef: authority.conformance.ref,
    version,
    action,
    successorRef,
    controlledAt: '2026-08-20T10:11:00.000Z',
    reasonCodes: ['S03_BINDING_TEST'],
    principal: authority.qualifier,
    authorizationDecisionAuditRef: auth.ref,
    audit: audit(authority.qualifier, 'control-publish')
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('current qualified conformance enters RuntimeBinding as exact Specification + Implementation + Conformance trio', () => {
  const world = directBindingWorld('s03-valid-binding');
  const authority = installExecutionAuthority(world, 'valid');
  const binding = bind(world, 'valid', authority);
  assert.deepEqual(binding.semanticPayload.modelBindings, [authority.model.ref]);
  assert.equal(binding.semanticPayload.implementationBindings.length, 1);
  const exact = binding.semanticPayload.implementationBindings[0];
  assert.deepEqual(exact.specificationRef, authority.model.ref);
  assert.deepEqual(exact.implementationRef, authority.implementation.ref);
  assert.deepEqual(exact.implementationConformanceRef, authority.conformance.ref);
  const validated = validateRuntimeBinding({ ledger: world.env.ledger, runtimeBindingRef: binding.ref });
  assert.deepEqual(validated.frozenWorldRelations.specificationExecution.specification.ref, authority.model.ref);
  assert.deepEqual(validated.frozenWorldRelations.specificationExecution.implementation.ref, authority.implementation.ref);
  assert.deepEqual(validated.frozenWorldRelations.specificationExecution.conformance.ref, authority.conformance.ref);
});

test('same exact Model may bind two independently conforming implementations in separate RuntimeBindings without Model mutation', () => {
  const world = directBindingWorld('s03-multi-implementation');
  const first = installExecutionAuthority(world, 'multi-a');
  const ledger = world.env.ledger;
  const modelBefore = structuredClone(ledger.resolve(first.model.ref));

  const implManager = principal('s03-impl-multi-b');
  const qualifierB = principal('s03-qualifier-multi-b');
  const implAssignment = publishRoleAssignment({ ledger, logicalId: 'role.s03.impl.multi-b', version: '1', principal: implManager, role: 'IMPLEMENTATION_MANAGER', roleDefinitionVersion: 's02-v1', permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE], scope: controlScope(), audit: audit({ type: 'USER', principalId: 'iam-admin' }, 'iam') });
  const qualifierAssignment = publishRoleAssignment({ ledger, logicalId: 'role.s03.qualifier.multi-b', version: '1', principal: qualifierB, role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER', roleDefinitionVersion: 's03-v1', permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY], scope: controlScope(), audit: audit({ type: 'USER', principalId: 'iam-admin' }, 'iam') });
  const implId = 'implementation.s03.binding.multi-b';
  const implDecision = authorizeImplementationManage({ principal: implManager, roleAssignments: [implAssignment], authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: implId } });
  const implAuth = recordAuthorizationDecision({ ledger, decision: implDecision, audit: serviceAudit('impl-auth-b') });
  const implementation = publishImplementation({ ledger, logicalId: implId, version: '1', implementation: implementationSpec({ providerType: 'HTTP', digestChar: '8', artifactChar: '9' }), principal: implManager, authorizationDecisionAuditRef: implAuth.ref, audit: audit(implManager, 'impl-publish-b') });
  const conformanceId = 'conformance.s03.binding.multi-b';
  const confDecision = authorizeImplementationConformanceQualification({ principal: qualifierB, roleAssignments: [qualifierAssignment], authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId } });
  const confAuth = recordAuthorizationDecision({ ledger, decision: confDecision, audit: serviceAudit('conf-auth-b') });
  const conformance = publishImplementationConformance({ ledger, logicalId: conformanceId, version: '1', specificationRef: first.model.ref, implementationRef: implementation.ref, controlScope: controlScope(), qualificationMethod: qualificationMethod('d'), compatibilityTests: compatibilityTests(), runtimeEnvironments: ['STAGING'], requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'], knownLimitations: [], validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' }, principal: qualifierB, authorizationDecisionAuditRef: confAuth.ref, audit: audit(qualifierB, 'conf-publish-b') });
  const second = { model: first.model, implementation, conformance };

  const bindingA = bind(world, 'multi-a', first);
  const bindingB = bind(world, 'multi-b', second);
  assert.notDeepEqual(bindingA.semanticPayload.implementationBindings[0].implementationRef, bindingB.semanticPayload.implementationBindings[0].implementationRef);
  assert.deepEqual(bindingA.semanticPayload.modelBindings, [first.model.ref]);
  assert.deepEqual(bindingB.semanticPayload.modelBindings, [first.model.ref]);
  assert.deepEqual(ledger.resolve(first.model.ref), modelBefore);
});

test('expired conformance cannot enter a new RuntimeBinding', () => {
  const world = directBindingWorld('s03-expired-binding');
  const authority = installExecutionAuthority(world, 'expired', {
    validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-08-20T10:00:00Z' }
  });
  assert.throws(() => bind(world, 'expired', authority), (error) => error?.code === 'CONFORMANCE_EXPIRED_OR_NOT_YET_VALID');
});

test('revoked conformance cannot enter a new RuntimeBinding', () => {
  const world = directBindingWorld('s03-revoked-binding');
  const authority = installExecutionAuthority(world, 'revoked');
  control(world, authority, 'REVOKE');
  assert.throws(() => bind(world, 'revoked', authority), (error) => error?.code === 'CONFORMANCE_REVOKED');
});

test('superseded conformance cannot enter a new RuntimeBinding while exact successor can', () => {
  const world = directBindingWorld('s03-superseded-binding');
  const old = installExecutionAuthority(world, 'superseded');
  const ledger = world.env.ledger;
  const conformanceId = old.conformance.ref.logicalId;
  const successorDecision = authorizeImplementationConformanceQualification({ principal: old.qualifier, roleAssignments: [old.qualifierAssignment], authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId } });
  const successorAuth = recordAuthorizationDecision({ ledger, decision: successorDecision, audit: serviceAudit('successor-auth') });
  const successor = publishImplementationConformance({ ledger, logicalId: conformanceId, version: '2', specificationRef: old.model.ref, implementationRef: old.implementation.ref, controlScope: controlScope(), qualificationMethod: qualificationMethod('e'), compatibilityTests: compatibilityTests(), runtimeEnvironments: ['STAGING'], requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'], knownLimitations: ['REQUALIFIED'], validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' }, principal: old.qualifier, authorizationDecisionAuditRef: successorAuth.ref, audit: audit(old.qualifier, 'successor-publish') });
  control(world, old, 'SUPERSEDE', { successorRef: successor.ref });
  assert.throws(() => bind(world, 'superseded-old', old), (error) => error?.code === 'CONFORMANCE_SUPERSEDED');
  const next = { ...old, conformance: successor };
  const binding = bind(world, 'superseded-new', next);
  assert.deepEqual(binding.semanticPayload.implementationBindings[0].implementationConformanceRef, successor.ref);
});

test('Deployment runtime environment outside conformance scope cannot enter RuntimeBinding', () => {
  const world = directBindingWorld('s03-env-binding');
  const authority = installExecutionAuthority(world, 'env', { runtimeEnvironments: ['DEVELOPMENT'] });
  assert.throws(() => bind(world, 'env', authority), (error) => error?.code === 'CONFORMANCE_RUNTIME_ENVIRONMENT_OUT_OF_SCOPE');
});

test('missing required execution capability cannot enter RuntimeBinding', () => {
  const world = directBindingWorld('s03-capability-binding');
  const authority = installExecutionAuthority(world, 'capability', { requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'] });
  assert.throws(() => bind(world, 'capability', authority, []), (error) => error?.code === 'CONFORMANCE_CAPABILITY_MISSING');
});

test('historical RuntimeBinding remains replayable after its exact conformance is later revoked', () => {
  const world = directBindingWorld('s03-historical-binding');
  const authority = installExecutionAuthority(world, 'historical');
  const binding = bind(world, 'historical', authority);
  control(world, authority, 'REVOKE');
  const replay = validateRuntimeBinding({ ledger: world.env.ledger, runtimeBindingRef: binding.ref });
  assert.deepEqual(replay.semanticPayload.implementationBindings[0].implementationConformanceRef, authority.conformance.ref);
  assert.deepEqual(replay.frozenWorldRelations.specificationExecution.conformance.ref, authority.conformance.ref);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); }
}
console.log(`S03 RuntimeBinding integration acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
