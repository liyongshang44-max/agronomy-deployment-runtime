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
import { publishDecisionRobustness } from '../../packages/decision-robustness/src/index.mjs';
import { publishDecisionResult } from '../../packages/decision-result/src/index.mjs';
import { RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION } from '../../packages/runtime-profile/src/index.mjs';
import {
  directPlanWorld,
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
  baseDecisionProblem,
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from '../knowledge-retrieval/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';
import { assess } from '../applicability/fixture.mjs';
import { policySpec } from '../specification/fixture.mjs';
import { implementationSpec } from '../implementation-registry/fixture.mjs';
import { compatibilityTests, qualificationMethod } from '../implementation-conformance/fixture.mjs';
import {
  executionEnvelope,
  makePolicyActionOutput
} from '../decision-robustness/fixture.mjs';

let seq = 0;
export function audit(actor, suffix = 'd06') {
  seq += 1;
  return {
    eventId: `${suffix}-${seq}`,
    occurredAt: '2026-08-20T10:45:00.000Z',
    actor: { type: actor.type, id: actor.principalId },
    details: { suite: 'decision-result' }
  };
}
function serviceAudit(suffix) {
  return audit({ principalId: 'iam-engine', type: 'SERVICE_ACCOUNT' }, suffix);
}
function controlScope() { return { organizationId: 'org-a', tenantId: 'tenant-a' }; }
function principal(id) {
  return createPrincipal({ principalId: id, type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
}
function robustnessRequirement() {
  return {
    comparisonMode: 'EXACT_MATERIAL_ACTION_SIGNATURE',
    sufficientCompletenessClasses: ['EXHAUSTIVE_ENUMERATION']
  };
}
function runtimeGovernance(decisionAuthorityMode) {
  return {
    allowedDecisionAuthorityModes: [decisionAuthorityMode],
    knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
    contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
    applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
  };
}

function rebuildSingleRuntime(base, label, decisionAuthorityMode) {
  const releaseRef = base.env.profile.semanticPayload.knowledgeReleaseRef;
  const profile = publishAuthorizedProfile(base.env, {
    logicalId: `runtime-profile.d06.${label}`,
    version: '1',
    profile: baseProfile(base.env, {
      knowledgeReleaseRef: releaseRef,
      contractVersion: RUNTIME_PROFILE_ROBUSTNESS_CONTRACT_VERSION,
      robustnessRequirement: robustnessRequirement(),
      runtimeGovernance: runtimeGovernance(decisionAuthorityMode)
    })
  });
  const env = { ...base.env, profile };
  const deployment = publishAuthorizedDeployment(env, {
    logicalId: `deployment.d06.${label}`,
    version: '1',
    deployment: baseDeployment(env)
  });
  const decision = publishDecision(env, {
    logicalId: `decision.d06.${label}`,
    version: '1',
    problem: baseDecisionProblem({ decisionAuthorityMode })
  });
  const runtimeAuthorization = createRetrievalRuntimeAuthorization(env, { deployment });
  const retrieval = executeAuthorizedRetrieval(env, {
    logicalId: `retrieval.d06.${label}`,
    version: '1',
    decisionProblem: decision,
    deployment,
    runtimeAuthorization
  });
  assert.equal(retrieval.semanticPayload.candidateRefs.length, 1);
  const manifest = publishManifest(env.ledger, {
    logicalId: `manifest.d06.${label}`,
    decisionProblem: decision,
    datumRefs: base.manifest.semanticPayload.datumRefs,
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
  const partial = { env, deployment, decision, retrieval, manifest };
  const assessment = assess(partial, {
    logicalId: `applicability.d06.${label}`,
    knowledgeRef: retrieval.semanticPayload.candidateRefs[0],
    manifest
  });
  const world = { ...partial, assessments: [assessment] };
  const runtimePlan = compileRuntimePlan(planCompilerInput(world));
  const eligibility = publishRuntimeEligibility({
    ledger: env.ledger,
    logicalId: `runtime-eligibility.d06.${label}`,
    version: '1',
    runtimePlan,
    audit: audit(env.runtimePrincipal, 'eligibility')
  });
  return { ...world, runtimePlan, eligibility, profile };
}

function publishPolicyExecutionAuthority(world, label, policyOverrides) {
  const { ledger } = world.env;
  const specManager = principal(`d06-spec-${label}`);
  const implementationManager = principal(`d06-impl-${label}`);
  const qualifier = principal(`d06-qualifier-${label}`);
  const specAssignment = publishRoleAssignment({
    ledger,
    logicalId: `role.d06.spec.${label}`,
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
    logicalId: `role.d06.impl.${label}`,
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
    logicalId: `role.d06.qualifier.${label}`,
    version: '1',
    principal: qualifier,
    role: 'IMPLEMENTATION_CONFORMANCE_QUALIFIER',
    roleDefinitionVersion: 's03-v1',
    permissions: [PERMISSIONS.IMPLEMENTATION_CONFORMANCE_QUALIFY],
    scope: controlScope(),
    audit: audit({ principalId: 'iam-admin', type: 'USER' }, 'iam')
  });

  const policyId = `policy.d06.${label}`;
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

  const implementationId = `implementation.d06.${label}`;
  const implementationDecision = authorizeImplementationManage({
    principal: implementationManager,
    roleAssignments: [implementationAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION', resourceId: implementationId }
  });
  const implementationAuth = recordAuthorizationDecision({ ledger, decision: implementationDecision, audit: serviceAudit('implementation-auth') });
  const implementation = publishImplementation({
    ledger,
    logicalId: implementationId,
    version: '1',
    implementation: implementationSpec({ providerType: 'INTERNAL' }),
    principal: implementationManager,
    authorizationDecisionAuditRef: implementationAuth.ref,
    audit: audit(implementationManager, 'implementation-publish')
  });

  const conformanceId = `conformance.d06.${label}`;
  const conformanceDecision = authorizeImplementationConformanceQualification({
    principal: qualifier,
    roleAssignments: [qualifierAssignment],
    authorizationScope: { ...controlScope(), resourceType: 'IMPLEMENTATION_CONFORMANCE', resourceId: conformanceId }
  });
  const conformanceAuth = recordAuthorizationDecision({ ledger, decision: conformanceDecision, audit: serviceAudit('conformance-auth') });
  const conformance = publishImplementationConformance({
    ledger,
    logicalId: conformanceId,
    version: '1',
    specificationRef: policy.ref,
    implementationRef: implementation.ref,
    controlScope: controlScope(),
    qualificationMethod: qualificationMethod('f'),
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

function legalPath(eligibility) {
  return eligibility.semanticPayload.alternativeEvaluations.find((item) =>
    item.disposition === 'LEGAL' || item.disposition === 'LEGAL_WITH_LIMITATIONS');
}

export function policyDecisionWorld(label = 'base', {
  decisionAuthorityMode = 'ADR_POLICY',
  policyOverrides = {}
} = {}) {
  const base = directPlanWorld(`d06-source-${label}`);
  const runtime = rebuildSingleRuntime(base, label, decisionAuthorityMode);
  const executionAuthority = publishPolicyExecutionAuthority(runtime, label, policyOverrides);
  const path = legalPath(runtime.eligibility);
  assert.ok(path);
  const binding = publishRuntimeBinding({
    ledger: runtime.env.ledger,
    logicalId: `runtime-binding.d06.${label}`,
    version: '1',
    runtimeEligibilityRef: runtime.eligibility.ref,
    selectedAlternativePathId: path.pathId,
    specificationExecutionBinding: {
      specificationRef: executionAuthority.policy.ref,
      implementationRef: executionAuthority.implementation.ref,
      implementationConformanceRef: executionAuthority.conformance.ref,
      availableCapabilities: ['DETERMINISTIC_DECIMAL_V1']
    },
    audit: audit(runtime.env.runtimePrincipal, 'binding')
  });
  const alternativeSet = publishRuntimeAlternativeSet({
    ledger: runtime.env.ledger,
    logicalId: `runtime-alternative-set.d06.${label}`,
    version: '1',
    runtimeEligibilityRef: runtime.eligibility.ref,
    includedRuntimeBindingRefs: [binding.ref],
    audit: audit(runtime.env.runtimePrincipal, 'alternative-set')
  });
  return {
    ...runtime,
    ...executionAuthority,
    binding,
    includedBindings: [binding],
    alternativeSet
  };
}

export function publishRobustness(world, {
  actionOutput = makePolicyActionOutput({ amount: '10' }),
  executionStatus = 'SUCCEEDED',
  includeExecution = true,
  label = 'robustness'
} = {}) {
  const policyExecutions = includeExecution
    ? [{
      runtimeBindingRef: world.binding.ref,
      executionEnvelope: executionEnvelope(world, world.binding, executionStatus === 'SUCCEEDED' ? actionOutput : null, {
        seed: label.length.toString(16).slice(-1).padStart(1, 'a'),
        status: executionStatus
      })
    }]
    : [];
  return publishDecisionRobustness({
    ledger: world.env.ledger,
    logicalId: `decision-robustness.d06.${label}`,
    version: '1',
    runtimeAlternativeSetRef: world.alternativeSet.ref,
    policyExecutions,
    audit: audit(world.env.runtimePrincipal, `publish-${label}`)
  });
}

export function informationDecisionWorld(label = 'ask') {
  const base = directPlanWorld(`d06-info-source-${label}`, { includeCrop: false });
  const world = rebuildSingleRuntime(base, `info-${label}`, 'ADR_POLICY');
  assert.equal(world.eligibility.semanticPayload.runtimeEligibility, 'INFORMATION_REQUIRED');
  assert.ok(world.eligibility.semanticPayload.informationRequirements.length > 0);
  const alternativeSet = publishRuntimeAlternativeSet({
    ledger: world.env.ledger,
    logicalId: `runtime-alternative-set.d06.${label}`,
    version: '1',
    runtimeEligibilityRef: world.eligibility.ref,
    includedRuntimeBindingRefs: [],
    audit: audit(world.env.runtimePrincipal, 'alternative-set')
  });
  const robustness = publishDecisionRobustness({
    ledger: world.env.ledger,
    logicalId: `decision-robustness.d06.${label}`,
    version: '1',
    runtimeAlternativeSetRef: alternativeSet.ref,
    policyExecutions: [],
    audit: audit(world.env.runtimePrincipal, 'robustness')
  });
  return { ...world, alternativeSet, robustness };
}

export function publishResult(world, robustness, label = 'result', decidedAt = '2026-08-20T10:45:00Z') {
  return publishDecisionResult({
    ledger: world.env.ledger,
    logicalId: `decision-result.d06.${label}`,
    version: '1',
    decisionRobustnessRef: robustness.ref,
    decidedAt,
    audit: audit(world.env.runtimePrincipal, `result-${label}`)
  });
}
