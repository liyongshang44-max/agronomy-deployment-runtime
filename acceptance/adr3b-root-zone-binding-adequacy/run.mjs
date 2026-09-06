import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildRuntimeCandidates,
  compileRuntimePlan
} from '../../packages/runtime-plan/src/index.mjs';
import { planInformationRequirements } from '../../packages/information-requirement/src/index.mjs';
import {
  normalizeRuntimeProfile,
  RuntimeProfileError
} from '../../packages/runtime-profile/src/index.mjs';
import {
  createDeploymentEnvironment,
  publishAuthorizedDeployment
} from '../deployment/fixture.mjs';
import {
  createRetrievalRuntimeAuthorization,
  executeAuthorizedRetrieval,
  publishDecision
} from '../knowledge-retrieval/fixture.mjs';
import {
  datumInput,
  publishDatum,
  publishManifest
} from '../context-manifest/fixtures.mjs';
import {
  assess,
  publishTargetDatum
} from '../applicability/fixture.mjs';

const ROOT_ZONE_SEMANTIC_ID = 'soil.root_zone_deficit';
const SHALLOW_VERTICAL_SUPPORT = Object.freeze({ fromMm: '0', toMm: '100' });
const DEEP_VERTICAL_SUPPORT = Object.freeze({ fromMm: '0', toMm: '1000' });

function expectRuntimeProfileError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof RuntimeProfileError, `expected RuntimeProfileError, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const scienceRunUrl = new URL('../adr3b-root-zone-soil-water-authority/run.mjs', import.meta.url);
const scienceProcess = spawnSync(process.execPath, [fileURLToPath(scienceRunUrl)], {
  encoding: 'utf8',
  cwd: process.cwd()
});
assert.equal(scienceProcess.status, 0, scienceProcess.stderr || scienceProcess.stdout);
const science = JSON.parse(scienceProcess.stdout.trim());
assert.equal(science.ok, true);
assert.equal(science.milestone, 'ADR_3B_ROOT_ZONE_SOIL_WATER_SCIENTIFIC_AUTHORITY');
assert.equal(science.migrationSubject, 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1');
assert.equal(science.legacyThresholdLaundered, false);
assert.equal(science.targetSpecificRootDepthPublished, false);
assert.equal(science.rootZoneStateValuePublished, false);
assert.equal(science.nextFrontier, 'ROOT_ZONE_MEASUREMENT_REQUIREMENT_AND_BINDING_ADEQUACY');

const env = createDeploymentEnvironment('adr3b-root-zone-binding-audit', {
  contextRequirements: {
    requiredSemanticIds: [ROOT_ZONE_SEMANTIC_ID],
    epistemicConstraints: {
      [ROOT_ZONE_SEMANTIC_ID]: ['STATE_ESTIMATE']
    }
  }
});
const deployment = publishAuthorizedDeployment(env, {
  logicalId: 'deployment.adr3b.root-zone-binding-audit',
  version: '1'
});
const decisionCreator = {
  principalId: 'decision-creator-adr3b-root-zone-binding-audit',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: ['pilot-a']
};
const worldEnv = { ...env, deployment, decisionCreator };
const decision = publishDecision(worldEnv, {
  logicalId: 'decision.adr3b.root-zone-binding-audit',
  version: '1'
});
const runtimeAuthorization = createRetrievalRuntimeAuthorization(worldEnv, { deployment });
const retrieval = executeAuthorizedRetrieval(worldEnv, {
  logicalId: 'retrieval.adr3b.root-zone-binding-audit',
  version: '1',
  decisionProblem: decision,
  deployment,
  runtimeAuthorization
});

const crop = publishTargetDatum(env, {
  suffix: 'adr3b-root-zone-binding-crop',
  semanticId: 'crop.code',
  value: { type: 'CATEGORY', category: 'maize' },
  unit: '1',
  epistemicClass: 'OBSERVATION'
});

function rootZoneDatum(logicalId, verticalSupport) {
  return publishDatum(env.ledger, logicalId, datumInput({
    semanticId: ROOT_ZONE_SEMANTIC_ID,
    value: { type: 'DECIMAL', decimal: '25' },
    unit: 'mm',
    epistemicClass: 'STATE_ESTIMATE',
    provenanceClass: 'MODEL',
    effectiveInterval: { start: '2026-08-20T09:00:00Z', end: '2026-08-20T10:00:00Z' },
    availableAt: '2026-08-20T09:55:00Z',
    spatialSupport: { type: 'FIELD', geometryRef: 'field-1' },
    verticalSupport,
    temporalSupport: { type: 'INTERVAL' },
    uncertainty: { type: 'NONE' },
    source: {
      providerId: 'adr3b-binding-audit-state-provider',
      sourceRef: 'same-root-zone-deficit-state-input',
      contentHash: `sha256:${'d'.repeat(64)}`
    }
  }));
}

const shallow = rootZoneDatum('datum.adr3b.root-zone-deficit.shallow', SHALLOW_VERTICAL_SUPPORT);
const deep = rootZoneDatum('datum.adr3b.root-zone-deficit.deep', DEEP_VERTICAL_SUPPORT);

for (const [left, right, name] of [
  [shallow.semanticPayload.semanticId, deep.semanticPayload.semanticId, 'semanticId'],
  [JSON.stringify(shallow.semanticPayload.value), JSON.stringify(deep.semanticPayload.value), 'value'],
  [shallow.semanticPayload.unit, deep.semanticPayload.unit, 'unit'],
  [shallow.semanticPayload.epistemicClass, deep.semanticPayload.epistemicClass, 'epistemicClass'],
  [shallow.semanticPayload.provenanceClass, deep.semanticPayload.provenanceClass, 'provenanceClass'],
  [JSON.stringify(shallow.semanticPayload.spatialSupport), JSON.stringify(deep.semanticPayload.spatialSupport), 'spatialSupport'],
  [JSON.stringify(shallow.semanticPayload.temporalSupport), JSON.stringify(deep.semanticPayload.temporalSupport), 'temporalSupport'],
  [JSON.stringify(shallow.semanticPayload.effectiveInterval), JSON.stringify(deep.semanticPayload.effectiveInterval), 'effectiveInterval'],
  [shallow.semanticPayload.availableAt, deep.semanticPayload.availableAt, 'availableAt'],
  [JSON.stringify(shallow.semanticPayload.source), JSON.stringify(deep.semanticPayload.source), 'source']
]) {
  assert.equal(left, right, `${name} must be identical across the audit pair`);
}
assert.notDeepEqual(shallow.semanticPayload.verticalSupport, deep.semanticPayload.verticalSupport);

function manifestFor(label, datum) {
  return publishManifest(env.ledger, {
    logicalId: `manifest.adr3b.root-zone-binding.${label}`,
    version: '1',
    decisionProblem: decision,
    datumRefs: [crop.ref, datum.ref],
    evidenceCutoff: '2026-08-20T10:00:00Z',
    auditOccurredAt: '2026-08-20T10:01:00Z'
  });
}
const shallowManifest = manifestFor('shallow', shallow);
const deepManifest = manifestFor('deep', deep);

function compileFor(label, manifest) {
  const world = { env: worldEnv, decision, deployment, retrieval, manifest };
  const applicability = assess(world, {
    logicalId: `applicability.adr3b.root-zone-binding.${label}`,
    version: '1',
    manifest
  });
  assert.equal(applicability.semanticPayload.runtimeUse, 'ALLOWED');
  assert.equal(applicability.semanticPayload.transportStatus, 'DIRECTLY_APPLICABLE');
  const input = {
    ledger: env.ledger,
    decisionProblemRef: decision.ref,
    deploymentRef: deployment.ref,
    runtimeProfileRef: env.profile.ref,
    contextManifestRef: manifest.ref,
    knowledgeRetrievalResultRef: retrieval.ref,
    applicabilityAssessmentRefs: [applicability.ref]
  };
  const candidates = buildRuntimeCandidates(input);
  const plan = compileRuntimePlan(input);
  const information = planInformationRequirements({ ledger: env.ledger, runtimePlan: plan });
  return { applicability, candidates, plan, information };
}

const shallowResult = compileFor('shallow', shallowManifest);
const deepResult = compileFor('deep', deepManifest);

for (const result of [shallowResult, deepResult]) {
  assert.equal(result.candidates.candidates.length, 1);
  assert.equal(result.candidates.candidates[0].compilerState, 'STRUCTURALLY_COMPLETE');
  assert.deepEqual(result.candidates.candidates[0].openRequirements, []);
  assert.deepEqual(result.plan.openRequirements, []);
  assert.deepEqual(result.information.informationRequirements, []);
  assert.deepEqual(result.information.nonInformationBlockers, []);
  const contextNode = result.plan.nodes.find((node) => node.nodeType === 'CONTEXT');
  assert.ok(contextNode);
  assert.ok(contextNode.semanticOutputs.includes(ROOT_ZONE_SEMANTIC_ID));
}

const shallowContextNode = shallowResult.plan.nodes.find((node) => node.nodeType === 'CONTEXT');
const deepContextNode = deepResult.plan.nodes.find((node) => node.nodeType === 'CONTEXT');
assert.deepEqual(shallowContextNode.semanticOutputs, deepContextNode.semanticOutputs);
assert.equal(shallowResult.applicability.semanticPayload.runtimeUse, deepResult.applicability.semanticPayload.runtimeUse);
assert.equal(shallowResult.candidates.candidates[0].compilerState, deepResult.candidates.candidates[0].compilerState);

const attemptedProfile = structuredClone(env.profile.semanticPayload);
attemptedProfile.contextRequirements = {
  ...attemptedProfile.contextRequirements,
  verticalSupportConstraints: {
    [ROOT_ZONE_SEMANTIC_ID]: { mode: 'EXACT_ROOT_ZONE' }
  }
};
expectRuntimeProfileError(
  () => normalizeRuntimeProfile(attemptedProfile),
  'INVALID_RUNTIME_PROFILE_FIELD'
);

assert.equal(JSON.stringify(shallowResult.plan).includes('verticalSupport'), false);
assert.equal(JSON.stringify(deepResult.plan).includes('verticalSupport'), false);
assert.equal(JSON.stringify(shallowResult.information).includes('verticalSupport'), false);
assert.equal(JSON.stringify(deepResult.information).includes('verticalSupport'), false);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_3B_ROOT_ZONE_MEASUREMENT_BINDING_ADEQUACY',
  classification: 'NON_AUTHORITY_BINDING_ADEQUACY_EVIDENCE',
  migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1',
  scientificAuthorityPrerequisite: {
    currentDayRootZoneDeficitQualifiedKnowledgeRef: science.currentDayRootZoneDeficit.qualifiedKnowledgeRef,
    rootZoneTotalAvailableWaterQualifiedKnowledgeRef: science.rootZoneTotalAvailableWater.qualifiedKnowledgeRef
  },
  auditPair: {
    semanticId: ROOT_ZONE_SEMANTIC_ID,
    value: { type: 'DECIMAL', decimal: '25' },
    unit: 'mm',
    epistemicClass: 'STATE_ESTIMATE',
    shallowVerticalSupport: SHALLOW_VERTICAL_SUPPORT,
    deepVerticalSupport: DEEP_VERTICAL_SUPPORT
  },
  contextDatumCanRepresentVerticalSupport: true,
  runtimeProfileCanRequireVerticalSupport: false,
  applicabilityDispositionDiffersByVerticalSupport: false,
  runtimePlanStructuralQualificationDiffersByVerticalSupport: false,
  informationRequirementGeneratedForVerticalSupportDifference: false,
  terminalAdjudication: 'ROOT_ZONE_MEASUREMENT_BINDING_CONSTRAINT_GAP',
  rootZoneMeasurementBindingAdequate: false,
  broadArchitectureGapAdjudicated: false,
  architectureChangeAuthorized: false,
  newDecisionResultTransportAuthorized: false,
  genericAuthorityObjectAuthorized: false,
  geoxWritePerformed: false,
  cutoverAuthorized: false,
  nextFrontier: 'BOUNDED_ROOT_ZONE_MEASUREMENT_BINDING_CONTRACT_ADJUDICATION'
}, null, 2));