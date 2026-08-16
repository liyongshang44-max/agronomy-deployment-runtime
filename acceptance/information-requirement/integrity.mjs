import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import {
  buildInformationAcquisitionOptions,
  deriveInformationRequirementStatus,
  deriveUnsatisfiableInformationRequirementStatus,
  normalizeInformationAcquisitionCapability,
  normalizeInformationRequirement,
  planInformationRequirements,
  validateRuntimePlanForInformationPlanning
} from '../../packages/information-requirement/src/index.mjs';
import { compileRuntimePlan } from '../../packages/runtime-plan/src/index.mjs';
import {
  directPlanWorld,
  planCompilerInput
} from '../runtime-plan/fixture.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function originRequirement(label = 'integrity') {
  const world = directPlanWorld(`r02-${label}`, { includeCrop: false });
  const plan = compileRuntimePlan(planCompilerInput(world));
  const planning = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  return { world, plan, planning, requirement: planning.informationRequirements[0] };
}

function validCapability(overrides = {}) {
  return {
    capabilityId: 'cap-customer-api',
    providerId: 'customer-api',
    channel: 'CUSTOMER_API',
    semanticIds: ['crop.code'],
    epistemicClasses: ['ASSERTION'],
    provenanceClasses: ['CUSTOMER_SYSTEM'],
    relativeCostRank: 0,
    estimatedLatencySeconds: 15,
    qualityDescriptor: 'CUSTOMER_ASSERTION',
    ...overrides
  };
}

function completeCatalog(capabilities) {
  return {
    completeness: 'COMPLETE_FOR_REQUIREMENT',
    authorityClaim: 'PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY',
    capabilities
  };
}

function rehashRequirement(requirement, changes) {
  const next = structuredClone(requirement);
  Object.assign(next, changes);
  delete next.semanticHash;
  return { ...next, semanticHash: semanticHash('InformationRequirement', next) };
}

test('tampered RuntimePlan cannot be used to mint InformationRequirements even if planHash text is left unchanged', () => {
  const { world, plan } = originRequirement('tampered-plan');
  const tampered = structuredClone(plan);
  tampered.openRequirements = [];
  assert.throws(
    () => validateRuntimePlanForInformationPlanning({ ledger: world.env.ledger, runtimePlan: tampered }),
    (error) => error?.code === 'RUNTIME_PLAN_REPLAY_MISMATCH'
  );
});

test('self-hashed fake InformationRequirement with unknown top-level authority field is rejected', () => {
  const { requirement } = originRequirement('fake-requirement');
  assert.throws(
    () => normalizeInformationRequirement({ ...requirement, runtimeEligibility: 'RUNTIME_ELIGIBLE' }),
    (error) => error?.code === 'INVALID_INFORMATION_REQUIREMENT_FIELD'
  );
});

test('nested requirement provenance vocabulary and resolution shape are closed', () => {
  const { requirement } = originRequirement('nested-contract');
  const badRequiredBy = structuredClone(requirement);
  badRequiredBy.requiredBy[0].sourceType = 'RUNTIME_ELIGIBILITY';
  delete badRequiredBy.semanticHash;
  badRequiredBy.semanticHash = semanticHash('InformationRequirement', badRequiredBy);
  assert.throws(
    () => normalizeInformationRequirement(badRequiredBy),
    (error) => error?.code === 'INVALID_INFORMATION_REQUIRED_BY'
  );
  const badResolution = structuredClone(requirement);
  badResolution.requiredResolution.minimumMatchingDatumCount = 0;
  delete badResolution.semanticHash;
  badResolution.semanticHash = semanticHash('InformationRequirement', badResolution);
  assert.throws(
    () => normalizeInformationRequirement(badResolution),
    (error) => error?.code === 'INVALID_INFORMATION_REQUIRED_RESOLUTION'
  );
});

test('self-hashed widening of acceptable evidence cannot be used downstream because requirement must reproduce from origin RuntimePlan', () => {
  const { world, plan, requirement } = originRequirement('self-hashed-widening');
  const widened = rehashRequirement(requirement, {
    acceptableEpistemicClasses: ['ASSERTION', 'DERIVED', 'OBSERVATION']
  });
  assert.deepEqual(normalizeInformationRequirement(widened).acceptableEpistemicClasses, ['ASSERTION', 'DERIVED', 'OBSERVATION']);
  assert.throws(
    () => buildInformationAcquisitionOptions({
      ledger: world.env.ledger,
      originRuntimePlan: plan,
      requirement: widened,
      capabilities: [validCapability({ capabilityId: 'derived', epistemicClasses: ['DERIVED'] })]
    }),
    (error) => error?.code === 'INFORMATION_REQUIREMENT_ORIGIN_MISMATCH'
  );
});

test('acquisition capability contract rejects embedded evidence/value/reference laundering', () => {
  for (const forbidden of [
    ['value', { type: 'CATEGORY', category: 'maize' }],
    ['contextDatumRef', { kind: 'ContextDatum' }],
    ['receiptRef', { kind: 'ResolvedContextDatumReceipt' }],
    ['evidence', { observed: true }]
  ]) {
    const [key, value] = forbidden;
    assert.throws(
      () => normalizeInformationAcquisitionCapability({ ...validCapability(), [key]: value }),
      (error) => error?.code === 'INVALID_INFORMATION_REQUIREMENT_FIELD',
      key
    );
  }
});

test('acquisition options filter semantic and epistemic incompatibility without inventing a provenance restriction', () => {
  const { world, plan, requirement } = originRequirement('capability-filter');
  assert.equal(requirement.acceptanceConstraintBasis.provenance, 'NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT');
  const options = buildInformationAcquisitionOptions({
    ledger: world.env.ledger,
    originRuntimePlan: plan,
    requirement,
    capabilities: [
      validCapability(),
      validCapability({ capabilityId: 'wrong-semantic', semanticIds: ['crop.stage'] }),
      validCapability({ capabilityId: 'wrong-epistemic', epistemicClasses: ['DERIVED'] }),
      validCapability({ capabilityId: 'model-provenance', provenanceClasses: ['MODEL'], epistemicClasses: ['ASSERTION'] })
    ]
  });
  assert.deepEqual(options.map((item) => item.capabilityId), ['cap-customer-api', 'model-provenance']);
  const customer = options.find((item) => item.capabilityId === 'cap-customer-api');
  const model = options.find((item) => item.capabilityId === 'model-provenance');
  assert.deepEqual(customer.acceptableEpistemicClasses, ['ASSERTION']);
  assert.deepEqual(customer.acceptableProvenanceClasses, ['CUSTOMER_SYSTEM']);
  assert.deepEqual(model.acceptableEpistemicClasses, ['ASSERTION']);
  assert.deepEqual(model.acceptableProvenanceClasses, ['MODEL']);
});

test('unsupported provenance vocabulary is rejected rather than filtered or guessed', () => {
  assert.throws(
    () => normalizeInformationAcquisitionCapability(validCapability({ provenanceClasses: ['MAGIC_PROVIDER'] })),
    (error) => error?.code === 'INVALID_INFORMATION_REQUIREMENT_VALUE'
  );
});

test('adding acquisition options cannot change InformationRequirement semantic identity or OPEN status', () => {
  const { world, plan, requirement } = originRequirement('options-no-evidence');
  const withOptions = planInformationRequirements({
    ledger: world.env.ledger,
    runtimePlan: plan,
    acquisitionCapabilities: [validCapability()]
  });
  const plannedRequirement = withOptions.informationRequirements[0];
  assert.equal(plannedRequirement.requirementId, requirement.requirementId);
  assert.equal(plannedRequirement.semanticHash, requirement.semanticHash);
  assert.equal(plannedRequirement.status, 'OPEN');
  assert.equal(withOptions.acquisitionOptions[0].evidenceStatus, 'NOT_EVIDENCE');
});

test('non-information RuntimePlan blockers are preserved but never laundered into InformationRequirements', () => {
  const world = directPlanWorld('r02-non-info', { includeCrop: false });
  const plan = compileRuntimePlan(planCompilerInput(world));
  assert.ok(plan.openRequirements.some((item) => item.requirementType === 'APPLICABILITY_RUNTIME_DISPOSITION'));
  const planning = planInformationRequirements({ ledger: world.env.ledger, runtimePlan: plan });
  assert.ok(planning.nonInformationBlockers.some((item) => item.requirementType === 'APPLICABILITY_RUNTIME_DISPOSITION'));
  assert.equal(planning.informationRequirements.some((item) =>
    item.reasonCodes.some((code) => code.startsWith('APPLICABILITY_RUNTIME_DISPOSITION:'))), false);
});

test('same RuntimePlan cannot be used as its own satisfaction proof', () => {
  const { world, plan, requirement } = originRequirement('same-plan-status');
  assert.throws(
    () => deriveInformationRequirementStatus({
      ledger: world.env.ledger,
      originRuntimePlan: plan,
      requirement,
      successorRuntimePlan: plan
    }),
    (error) => error?.code === 'INFORMATION_REQUIREMENT_SUCCESSOR_PLAN_REQUIRED'
  );
});

test('successor world from another exact DecisionProblem/Deployment/Profile cannot satisfy a requirement', () => {
  const origin = originRequirement('foreign-successor-origin');
  const foreign = originRequirement('foreign-successor-world');
  assert.throws(
    () => deriveInformationRequirementStatus({
      ledger: origin.world.env.ledger,
      originRuntimePlan: origin.plan,
      requirement: origin.requirement,
      successorRuntimePlan: foreign.plan
    })
  );
});

test('UNSATISFIABLE cannot be claimed from an incomplete or authority-overclaiming capability catalog', () => {
  const { world, plan, requirement } = originRequirement('unsat-incomplete');
  assert.throws(
    () => deriveUnsatisfiableInformationRequirementStatus({
      ledger: world.env.ledger,
      originRuntimePlan: plan,
      requirement,
      capabilityCatalog: {
        completeness: 'PARTIAL',
        authorityClaim: 'PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY',
        capabilities: []
      }
    }),
    (error) => error?.code === 'ACQUISITION_CATALOG_COMPLETENESS_REQUIRED'
  );
  assert.throws(
    () => deriveUnsatisfiableInformationRequirementStatus({
      ledger: world.env.ledger,
      originRuntimePlan: plan,
      requirement,
      capabilityCatalog: {
        completeness: 'COMPLETE_FOR_REQUIREMENT',
        authorityClaim: 'RUNTIME_AUTHORITY',
        capabilities: []
      }
    }),
    (error) => error?.code === 'ACQUISITION_CATALOG_COMPLETENESS_REQUIRED'
  );
});

test('UNSATISFIABLE cannot be claimed when declared-complete catalog still has a matching acquisition option', () => {
  const { world, plan, requirement } = originRequirement('unsat-matching');
  assert.throws(
    () => deriveUnsatisfiableInformationRequirementStatus({
      ledger: world.env.ledger,
      originRuntimePlan: plan,
      requirement,
      capabilityCatalog: completeCatalog([validCapability()])
    }),
    (error) => error?.code === 'INFORMATION_REQUIREMENT_STILL_SATISFIABLE_BY_CATALOG'
  );
});

test('R02 planning and status inspection are read-only over AuthorityLedger and do not mutate ContextManifest', () => {
  const { world, plan } = originRequirement('read-only');
  const before = world.env.ledger.exportSnapshot();
  const planning = planInformationRequirements({
    ledger: world.env.ledger,
    runtimePlan: plan,
    acquisitionCapabilities: [validCapability()]
  });
  assert.equal(planning.informationRequirements[0].status, 'OPEN');
  const after = world.env.ledger.exportSnapshot();
  assert.deepEqual(after, before);
  assert.deepEqual(world.env.ledger.resolve(world.manifest.ref).semanticPayload, world.manifest.semanticPayload);
  assert.equal(JSON.stringify(planning).includes('confidence'), false);
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
console.log(`R02 InformationRequirement integrity acceptance: ${passed} passed`);
if (passed !== tests.length) process.exitCode = 1;
