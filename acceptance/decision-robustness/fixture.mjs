import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeSpecificationManage } from '../../packages/authorization/src/specification-control.mjs';
import { authorizeImplementationManage } from '../../packages/authorization/src/implementation-control.mjs';
import { authorizeImplementationConformanceQualification } from '../../packages/authorization/src/implementation-conformance-control.mjs';
import { publishPolicy } from '../../packages/specification-registry/src/index.mjs';
import { publishImplementation } from '../../packages/implementation-registry/src/index.mjs';
import { publishImplementationConformance } from '../../packages/implementation-conformance/src/index.mjs';
import { publishRuntimeBinding } from '../../packages/runtime-binding/src/index.mjs';
import { publishRuntimeAlternativeSet } from '../../packages/runtime-alternative-set/src/index.mjs';
import { publishRuntimeEligibility } from '../../packages/runtime-eligibility/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import {
  RUNTIME_EXECUTION_AUTHORITY_CLASS,
  RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
  normalizeRuntimeExecutionEnvelope,
  runtimeExecutionId,
  runtimeExecutionNodeId,
  runtimeExecutionRawOutputHash
} from '../../packages/implementation-broker/src/index.mjs';
import {
  RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION
} from '../../packages/runtime-profile/src/index.mjs';
import {
  multiCandidatePlanWorld,
  planCompilerInput
} from '../runtime-plan/fixture.mjs';
import {
  baseProfile,
  publishAuthorizedProfile
} from '../runtime-profile/fixture.mjs';
import {
  baseDeployment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from '../knowledge-retrieval/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';
import { assess } from '../applicability/fixture.mjs';
import { policySpec } from '../specification/fixture.mjs';
import { implementationSpec } from '../implementation-registry/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';

let seq = 0;
export function audit(actor, suffix = 'd05') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:30:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'decision-robustness' }
  };
}
function serviceAudit(suffix) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function principal(id) {
  return createPrincipal({ principalId: id, type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
}
function hash(char) { return `sha256:${char.repeat(64)}`; }

function robustnessRequirement(sufficientCompletenessClasses = ['EXHAUSTIVE_ENUMERATION']) {
  return {
    comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
    sufficientCompletenessClasses
  };
}

function publishD05Profile(base, label, { legacyProfile = false, sufficientCompletenessClasses } = {}) {
  const profile = baseProfile(base.env, {
    knowledgeReleaseRef: base.release.ref,
    ...(legacyProfile
      ? {}
      : {
        contractVersion: RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
        robustnessRequirement: robustnessRequirement(sufficientCompletenessClasses)
      })
  });
  return publishAuthorizedProfile(base.env, {
    logicalId: `runtime-profile.d05.${label}`,
    version: '1',
    profile
  });
}

function rebuildRuntimeWorld(base, label, profile) {
  const env = { ...base.env, profile };
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.d05.${label}`,
    version: '1',
    deployment: baseDeployment(env)
  });
  const decision = publishDecision(env, {
    logicalId: `decision.d05.${label}`,
    version: '1'
  });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.d05.${label}`,
    version: '1',
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  assert.equal(retrieval.semanticPayload.candidateRefs.length, 2);
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.d05.${label}`,
    decisionProblem: decision,
    datumRefs: base.manifest.semanticPayload.datumRefs,
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const partial = { env, deployment, decision, retrieval, manifest };
  const assessments = retrieval.semanticPayload.candidateRefs.map((knowledgeRef, index) => assess(partial, {
    logicalId: `applicability.d05.${label}.${index + 1}`,
    knowledgeRef,
    manifest
  }));
  const world = { ...partial, assessments };
  const runtimePlan = compileRuntimePlan(planCompilerInput(world));
  const eligibility = publishRuntimeEligibility({
    ledger: env.ledger,
    logicalId: `runtime-eligibility.d05.${label}`,
    version: '1',
    runtimePlan,
    audit: audit(env.runtimePrincipal, 'eligibility')
  });
  return { ...world, runtimePlan, eligibility };
}

function publishPolicyExecutionAuthority(world, label, { policyOverrides = {} } = {}) {
  const { ledger } = world.env;
  const specManager = principal(`d05-spec-${label}`);
  const implementationManager = principal(`d05-impl-${label}`);
  const qualifier = principal(`d05-qualifier-${label}`);

  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d05.spec.${label}`,
    version: '1',
    principal: specManager,
    role: 'SPECIFICATION_MANAGER',
    roleDefinitionVersion: 's01-v2',
    permissions: [PERMISSIONS.SPECIFICATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const implementationAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d05.impl.${label}`,
    version: '1',
    principal: implementationManager,
    role: 'IMPLEMENTATION_MANAGER',
    roleDefinitionVersion: 's02-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_MANAGE],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });
  const qualifierAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d05.qualifier.${label}`,
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });

  const policyId = `policy.d05.${label}`;
  const policyDecision = authorizeSpecificationManage({
    principal: specManager,
    roleAssignments: [specAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'POLICY', resourceId: policyId }
  });
  const policyAuth = recordAuthorizationDecision({ ledger, decision: policyDecision, audit: serviceAudit('policy-auth') });
  const policy = publishPolicy({
    ledger,
    logicalId: policyId,
    version: '1',
    specification: policySpec(policyOverrides),
    principal: specManager,
    authorizationDecisionAuditRef: policyAuth.ref,
    audit: audit(specManager, 'policy-publish')
  });

  const implementationId = `implementation.d05.${label}`;
  const implementationDecision = authorizeImplementationManage({
    principal: implementationManager,
    roleAssignments: [implementationAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: implementationId }
  });
  const implementationAuth = recordAuthorizationDecision({
    ledger,
    decision: implementationDecision,
    audit: serviceAudit('implementation-auth')
  });
  const implementation = publishImplementation({
    ledger,
    logicalId: implementationId,
    version: '1',
    implementation: implementationSpec({ providerType: 'INTERNAL' }),
    principal: implementationManager,
    authorizationDecisionAuditRef: implementationAuth.ref,
    audit: audit(implementationManager, 'implementation-publish')
  });

  const conformanceId = `conformance.d05.${label}`;
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
    version: '1',
    specificationRef: policy.ref,
    implementationRef: implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod('e'),
    compatibilityTests: compatibilityTests(),
    runtimeEnvironments: ['STAGING'],
    requiredCapabilities: ['DETERMINISTIC_DECIMAL_V1'],
    knownLimitations: [],
    validityInterval: { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
    principal: qualifier,
    authorizationDecisionAuditRef: conformanceAuth.ref,
    audit: audit(qualifier, 'conformance-publish')
  });
  return { policy, implementation, conformance };
}

function legalPaths(eligibility) {
  return eligibility.semanticPayload.alternativeEvaluations.filter((item) =>
    item.disposition === 'LEGAL' || item.disposition === 'LEGAL_WITH_LIMITATIONS');
}

function publishPolicyBindings(world, executionAuthority, label) {
  const paths = legalPaths(world.eligibility);
  return paths.map((path, index) => publishRuntimeBinding({
    ledger: world.env.ledger,
    logicalId: `runtime-binding.d05.${label}.${index + 1}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    selectedAlternativePathId: path.pathId,
    specificationExecutionBinding: {
      specificationRef: executionAuthority.policy.ref,
      implementationRef: executionAuthority.implementation.ref,
      implementationConformanceRef: executionAuthority.conformance.ref,
      availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
    },
    audit: audit(world.env.runtimePrincipal, `binding-${index + 1}`)
  }));
}

export function makePolicyActionOutput({
  actionCode = 'IRRIGATE_NOW',
  amount = '10',
  startTime = '2026-08-20T11:00:00Z',
  note
} = {}) {
  const parameters = actionCode.startsWith('IRRIGATE')
    ? [
      { name: 'amount', value: { type: 'DECIMAL', decimal: amount } },
      { name: 'start_time', value: { type: 'TIMESTAMP', timestamp: startTime } },
      ...(note === undefined ? [] : [{ name: 'note', value: { type: 'STRING', string: note } }])
    ]
    : [];
  return {
    contractVersion: 'adr.policy-action-output.v1',
    actionCode,
    parameters
  };
}

export function executionEnvelope(world, binding, rawOutput, { seed = 'a', status = 'SUCCEEDED' } = {}) {
  const relation = binding.semanticPayload.implementationBindings[0];
  const runtimeNodeId = runtimeExecutionNodeId({
    runtimeBindingRef: binding.ref,
    specificationRef: relation.specificationRef,
    implementationRef: relation.implementationRef,
    implementationConformanceRef: relation.implementationConformanceRef
  });
  const inputEnvelopeHash = hash(seed);
  const executionId = runtimeExecutionId({ runtimeBindingRef: binding.ref, runtimeNodeId, inputEnvelopeHash });
  return normalizeRuntimeExecutionEnvelope({
    contractVersion: RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
    authorityClass: RUNTIME_EXECUTION_AUTHORITY_CLASS,
    executionId,
    dispatchClass: 'INTERNAL',
    runtimeBindingRef: binding.ref,
    runtimeNodeId,
    specificationRef: relation.specificationRef,
    implementationRef: relation.implementationRef,
    implementationConformanceRef: relation.implementationConformanceRef,
    inputEnvelopeHash,
    status,
    startedAt: '2026-08-20T10:30:00Z',
    completedAt: '2026-08-20T10:30:01Z',
    rawOutput: status === 'SUCCEEDED' ? rawOutput : null,
    rawOutputHash: status === 'SUCCEEDED' ? runtimeExecutionRawOutputHash(rawOutput) : null,
    error: status === 'SUCCEEDED' ? null : {
      code: 'RUNTIME_EXECUTION_TRANSPORT_ERROR',
      phase: 'DISPATCH',
      retryDisposition: 'CURRENT_USE_REVALIDATION_THEN_SAME_EXECUTION_ID_RETURNS_CACHED_RESULT'
    },
    semanticValidation: 'NOT_PERFORMED_D03_REQUIRED'
  });
}

export function decisionRobustnessWorld(label = 'base', {
  legacyProfile = false,
  includeBindingCount = 2,
  sufficientCompletenessClasses,
  policyOverrides = {}
} = {}) {
  const base = multiCandidatePlanWorld(`d05-source-${label}`);
  const profile = publishD05Profile(base, label, { legacyProfile, sufficientCompletenessClasses });
  const runtime = rebuildRuntimeWorld(base, label, profile);
  const executionAuthority = publishPolicyExecutionAuthority(runtime, label, { policyOverrides });
  const bindings = publishPolicyBindings(runtime, executionAuthority, label);
  const includedBindings = bindings.slice(0, includeBindingCount);
  const alternativeSet = publishRuntimeAlternativeSet({
    ledger: runtime.env.ledger,
    logicalId: `runtime-alternative-set.d05.${label}`,
    version: '1',
    runtimeEligibilityRef: runtime.eligibility.ref,
    includedRuntimeBindingRefs: includedBindings.map((binding) => binding.ref),
    audit: audit(runtime.env.runtimePrincipal, 'alternative-set')
  });
  return {
    ...runtime,
    profile,
    ...executionAuthority,
    bindings,
    includedBindings,
    alternativeSet
  };
}
