import assert from 'node:assert/strict';
import {
  INFORMATION_REQUIREMENT_STATUSES,
  planInformationRequirements,
  deriveInformationRequirementStatus,
  deriveUnsatisfiableInformationRequirementStatus
} from '../../packages/information-requirement/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import {
  directPlanWorld,
  planCompilerInput
} from '../runtime-plan/fixture.mjs';
import {
  assess,
  publishTargetDatum
} from '../applicability/fixture.mjs';
import { publishManifest } from '../context-manifest/fixtures.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function compile(world) {
  return compileRuntimePlan(planCompilerInput(world));
}

function acquisitionCapabilities() {
  return [
    {
      capabilityId: 'cap-user-crop',
      providerId: 'customer-workflow',
      channel: 'USER_QUESTION',
      semanticIds: ['crop.code'],
      epistemicClasses: ['ASSERTION'],
      provenanceClasses: ['USER'],
      relativeCostRank: 0,
      estimatedLatencySeconds: 300,
      qualityDescriptor: 'GROWER_ASSERTION'
    },
    {
      capabilityId: 'cap-sensor-crop',
      providerId: 'customer-sensor-network',
      channel: 'SENSOR',
      semanticIds: ['crop.code'],
      epistemicClasses: ['OBSERVATION'],
      provenanceClasses: ['SENSOR'],
      relativeCostRank: 1,
      estimatedLatencySeconds: 30,
      qualityDescriptor: 'DIRECT_OBSERVATION'
    },
    {
      capabilityId: 'cap-remote-derived-crop',
      providerId: 'imagery-provider',
      channel: 'REMOTE_SENSING',
      semanticIds: ['crop.code'],
      epistemicClasses: ['DERIVED'],
      provenanceClasses: ['REMOTE_SENSING'],
      relativeCostRank: 0,
      estimatedLatencySeconds: 60,
      qualityDescriptor: 'DERIVED_CLASSIFICATION'
    }
  ];
}

function completeCatalog(capabilities) {
  return {
    completeness: 'COMPLETE_FOR_REQUIREMENT',
    authorityClaim: 'PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY',
    capabilities
  };
}

function successorWithDatum(world, datum, suffix) {
  const manifest = publishManifest(world.env.ledger, {
    logicalId: `manifest.r02.${suffix}`,
    decisionProblem: world.decision,
    datumRefs: [...world.manifest.semanticPayload.datumRefs, datum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:02:00Z'
  });
  const assessmentWorld = { ...world, manifest };
  const assessment = assess(assessmentWorld, {
    logicalId: `applicability.r02.${suffix}`,
    manifest
  });
  return { ...world, manifest, assessments: [assessment] };
}

test('missing decision-material crop context becomes one deduplicated OPEN InformationRequirement', () => {
  const world = directPlanWorld('r02-missing-crop', { includeCrop: false });
  const plan = compile(world);
  const result = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  assert.equal(result.informationRequirements.length, 1);
  const requirement = result.informationRequirements[0];
  assert.equal(requirement.contractVersion, 'adr.information-requirement.v1');
  assert.equal(requirement.semanticId, 'crop.code');
  assert.equal(requirement.status, 'OPEN');
  assert.equal(requirement.decisionMateriality, 'MATERIAL');
  assert.equal(requirement.deadline, world.decision.semanticPayload.decisionDeadline);
  assert.deepEqual(requirement.acceptableEpistemicClasses, ['ASSERTION', 'OBSERVATION']);
  assert.equal(requirement.requiredResolution.mode, 'CONTEXT_DATUM_SEMANTIC_ID_PRESENT');
  assert.ok(requirement.reasonCodes.includes('MISSING_CONTEXT:MISSING_CONTEXT_SEMANTIC_ID'));
  assert.ok(requirement.reasonCodes.includes('RUNTIME_PROFILE_CONTEXT:REQUIRED_SEMANTIC_MISSING'));
  assert.ok(requirement.requiredBy.some((item) => item.sourceType === 'APPLICABILITY_ASSESSMENT'));
  assert.ok(requirement.requiredBy.some((item) => item.sourceType === 'RUNTIME_PROFILE'));
});

test('RuntimeProfile-only context gap becomes InformationRequirement even when knowledge applicability is direct', () => {
  const world = directPlanWorld('r02-profile-only', { omitProfileSoil: true });
  assert.equal(world.assessments[0].semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  assert.equal(world.assessments[0].semanticPayload.runtimeUse, 'ALLOWED');
  const plan = compile(world);
  const result = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  const requirement = result.informationRequirements.find((item) => item.semanticId === 'soil.volumetric_water_content');
  assert.ok(requirement);
  assert.deepEqual(requirement.acceptableEpistemicClasses, ['OBSERVATION', 'STATE_ESTIMATE']);
  assert.deepEqual(requirement.reasonCodes, ['RUNTIME_PROFILE_CONTEXT:REQUIRED_SEMANTIC_MISSING']);
});

test('structurally complete RuntimePlan produces no fake InformationRequirement', () => {
  const world = directPlanWorld('r02-complete');
  const plan = compile(world);
  assert.equal(plan.openRequirements.length, 0);
  const result = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  assert.deepEqual(result.informationRequirements, []);
  assert.deepEqual(result.acquisitionOptions, []);
  assert.deepEqual(result.nonInformationBlockers, []);
});

test('explicit acquisition capabilities produce deterministic low-cost options but do not satisfy the requirement', () => {
  const world = directPlanWorld('r02-options', { includeCrop: false });
  const plan = compile(world);
  const result = planInformationRequirements({
    ledger: world.env.ledger,
    runtimePlan: plan,
    acquisitionCapabilities: acquisitionCapabilities()
  });
  const requirement = result.informationRequirements[0];
  assert.equal(requirement.status, 'OPEN');
  assert.deepEqual(result.acquisitionOptions.map((item) => item.capabilityId), [
    'cap-user-crop',
    'cap-sensor-crop'
  ]);
  for (const option of result.acquisitionOptions) {
    assert.equal(option.evidenceStatus, 'NOT_EVIDENCE');
    assert.equal(option.requirementStatusEffect, 'NONE_UNTIL_AUTHORIZED_CONTEXT_EXISTS');
    assert.equal(option.requirementId, requirement.requirementId);
  }
});

test('requirement is SATISFIED only after a new ContextManifest and recompiled RuntimePlan contain acceptable evidence', () => {
  const world = directPlanWorld('r02-satisfied-origin', { includeCrop: false });
  const originPlan = compile(world);
  const origin = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: originPlan });
  const requirement = origin.informationRequirements[0];
  const crop = publishTargetDatum(world.env, { suffix: 'r02-satisfied-crop' });
  const successorWorld = successorWithDatum(world, crop, 'satisfied');
  const successorPlan = compile(successorWorld);
  assert.notEqual(successorPlan.planHash, originPlan.planHash);
  const status = deriveInformationRequirementStatus({
    ledger: world.env.ledger,
    originRuntimePlan: originPlan,
    requirement,
    successorRuntimePlan: successorPlan
  });
  assert.equal(status.status, 'SATISFIED');
  assert.equal(status.satisfyingDatumRefs.length, 1);
  assert.equal(status.basis.type, 'SUCCESSOR_CONTEXT_AND_RECOMPILE');
  assert.equal(status.runtimeLegalityAuthority, 'NONE_R02_STATUS_IS_NOT_RUNTIME_ELIGIBILITY');
});

test('requirement remains OPEN across a new compile world when the required semantic is still unresolved', () => {
  const world = directPlanWorld('r02-open-origin', { includeCrop: false });
  const originPlan = compile(world);
  const origin = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: originPlan });
  const requirement = origin.informationRequirements[0];
  const extraSoil = publishTargetDatum(world.env, {
    suffix: 'r02-open-extra-soil',
    semanticId: 'soil.volumetric_water_content',
    value: { type: 'DECIMAL', decimal: '0.29' },
    unit: 'm3_per_m3',
    epistemicClass: 'OBSERVATION'
  });
  const successorWorld = successorWithDatum(world, extraSoil, 'still-open');
  const successorPlan = compile(successorWorld);
  const status = deriveInformationRequirementStatus({
    ledger: world.env.ledger,
    originRuntimePlan: originPlan,
    requirement,
    successorRuntimePlan: successorPlan
  });
  assert.equal(status.status, 'OPEN');
  assert.equal(status.satisfyingDatumRefs.length, 0);
});

test('UNSATISFIABLE is a supported planning status only with a complete planning-only catalog and no matching option', () => {
  const world = directPlanWorld('r02-unsat', { includeCrop: false });
  const plan = compile(world);
  const requirement = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan }).informationRequirements[0];
  assert.deepEqual(INFORMATION_REQUIREMENT_STATUSES, [
    'OPEN', 'SATISFIED', 'UNSATISFIABLE', 'NO_LONGER_DECISION_MATERIAL'
  ]);
  const status = deriveUnsatisfiableInformationRequirementStatus({
    ledger: world.env.ledger,
    originRuntimePlan: plan,
    requirement,
    capabilityCatalog: completeCatalog([])
  });
  assert.equal(status.status, 'UNSATISFIABLE');
  assert.equal(status.basis.evidenceStatus, 'PLANNING_CAPABILITY_CATALOG_NOT_FIELD_EVIDENCE');
  assert.equal(status.basis.runtimeLegalityStatus, 'NOT_EVALUATED_BY_R02');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}
console.log(`R02 InformationRequirement positive acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
