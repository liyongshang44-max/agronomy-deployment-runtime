import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));

const EXPECTED_GEOX_MAIN = 'ca2a96d131bc1d3b2935e7b7460752bdbf79f9bd';
const EXPECTED_ADR_MAIN = 'b8d1bf5908b9946e2236e2e53182885065eace25';
const REQUIRED_TARGET_SEMANTIC = 'soil.root_zone_deficit';

function classify(input) {
  const root = input.sources.rootZoneStateBuilder;
  const projection = input.sources.rootZoneStateProjection;
  const vanGenuchten = input.sources.vanGenuchtenModel;
  const legacy = input.sources.legacyIrrigationRequirement;
  const adapter = input.sources.adrGeoxAdapter;
  const adr = input.acceptedAdrConstraints;

  const internalRootZoneStatePresent =
    root.modelVersion === 'root_zone_soil_water_state_v1'
    && root.rootZoneDepthField === 'root_zone_depth_cm'
    && root.outputs.includes('weighted_matric_potential_kpa')
    && root.outputs.includes('root_zone_available_water_fraction')
    && root.lineageFields.includes('determinism_hash')
    && root.lineageFields.includes('layer_estimate_refs')
    && projection.objectType === 'root_zone_soil_water_state_v1'
    && projection.sourceFactField === 'source_fact_id';

  const rootZoneSupportFactPresent = internalRootZoneStatePresent
    && root.rootZoneDepthField === 'root_zone_depth_cm';

  const directDeficitSemanticPresent =
    root.directRootZoneDeficitField !== null
    || vanGenuchten.directRootZoneDeficitSemantic === true;

  const availableWaterFractionIsDeficit =
    vanGenuchten.availableWaterFractionDefinition === 'root_zone_deficit'
    || vanGenuchten.faoTawDepletionSemantic === true;

  const adapterCanPublishRootZoneState =
    adapter.rootZoneStateSourceContract !== null
    || adapter.supportedSourceContracts.includes('root_zone_soil_water_state_v1');

  const legacyPathAdmissible =
    legacy.defaultTargetSoilMoisture !== 0.22
    && legacy.defaultRootZoneDepthMm !== 300
    && adr.legacyThresholdAuthority !== 'PROHIBITED';

  const transformationAuthorized =
    adr.qualifiedTransformationAvailable === true
    && adr.mtlS01A09Authorized === true;

  let terminalStatus;
  if (!internalRootZoneStatePresent) {
    terminalStatus = 'GEOX_ROOT_ZONE_STATE_SOURCE_ABSENT';
  } else if (directDeficitSemanticPresent && adapterCanPublishRootZoneState) {
    terminalStatus = 'GEOX_DIRECT_ROOT_ZONE_DEFICIT_SOURCE_CANDIDATE_PRESENT';
  } else {
    terminalStatus = 'ROOT_ZONE_STATE_PRESENT_DEFICIT_SEMANTIC_AND_PROVIDER_GAP';
  }

  return Object.freeze({
    classification: 'NON_AUTHORITY_SOURCE_ADMISSIBILITY_ADJUDICATION',
    internalRootZoneState: internalRootZoneStatePresent ? 'PRESENT' : 'ABSENT',
    rootZoneSupportFact: rootZoneSupportFactPresent ? 'PRESENT_CM_SOURCE_FACT' : 'ABSENT',
    directRootZoneDeficitSemantic: directDeficitSemanticPresent ? 'PRESENT' : 'ABSENT',
    availableWaterFractionSemantic: availableWaterFractionIsDeficit
      ? 'DEFICIT_EQUIVALENCE_SUPPORTED'
      : 'VAN_GENUCHTEN_EFFECTIVE_SATURATION_NOT_DEFICIT',
    adrCompatibleRootZoneStateProvider: adapterCanPublishRootZoneState ? 'PRESENT' : 'ABSENT',
    legacyDeficitPath: legacyPathAdmissible ? 'ADMISSIBLE' : 'INADMISSIBLE',
    qualifiedTransformation: transformationAuthorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
    targetSemantic: adr.requiredKnowledgeTargetSemantic,
    terminalStatus,
    nextFrontier: 'GEOX_ROOT_ZONE_STATE_PROVIDER_SEAM_AND_METRIC_COMPARABILITY'
  });
}

assert.equal(evidence.classification, 'NON_AUTHORITY_CROSS_REPO_SOURCE_CONTRACT_EVIDENCE');
assert.equal(evidence.geox.repository, 'liyongshang44-max/GEOX');
assert.equal(evidence.geox.protectedMain, EXPECTED_GEOX_MAIN);
assert.equal(evidence.acceptedAdrConstraints.dec0034Main, EXPECTED_ADR_MAIN);
assert.equal(evidence.acceptedAdrConstraints.requiredKnowledgeTargetSemantic, REQUIRED_TARGET_SEMANTIC);

const result = classify(evidence);

assert.equal(result.internalRootZoneState, 'PRESENT');
assert.equal(result.rootZoneSupportFact, 'PRESENT_CM_SOURCE_FACT');
assert.equal(result.directRootZoneDeficitSemantic, 'ABSENT');
assert.equal(result.availableWaterFractionSemantic, 'VAN_GENUCHTEN_EFFECTIVE_SATURATION_NOT_DEFICIT');
assert.equal(result.adrCompatibleRootZoneStateProvider, 'ABSENT');
assert.equal(result.legacyDeficitPath, 'INADMISSIBLE');
assert.equal(result.qualifiedTransformation, 'NOT_AUTHORIZED');
assert.equal(result.targetSemantic, REQUIRED_TARGET_SEMANTIC);
assert.equal(result.terminalStatus, 'ROOT_ZONE_STATE_PRESENT_DEFICIT_SEMANTIC_AND_PROVIDER_GAP');
assert.equal(result.nextFrontier, 'GEOX_ROOT_ZONE_STATE_PROVIDER_SEAM_AND_METRIC_COMPARABILITY');

assert.equal(evidence.sources.legacyIrrigationRequirement.defaultTargetSoilMoisture, 0.22);
assert.equal(evidence.sources.legacyIrrigationRequirement.defaultRootZoneDepthMm, 300);
assert.equal(evidence.sources.vanGenuchtenModel.availableWaterFractionDefinition, 'effective_saturation');
assert.equal(evidence.sources.rootZoneStateProjection.boundary.includes('no domain calculation'), true);
assert.equal(evidence.sources.rootZoneStateProjection.boundary.includes('customer exposure'), true);
assert.equal(evidence.sources.adrGeoxAdapter.deviceObservationExplicitExclusion, 'soil_moisture -> root-zone state');
assert.equal(evidence.sources.adrGeoxAdapter.supportedSourceContracts.includes('root_zone_soil_water_state_v1'), false);

const serialized = JSON.stringify(result);
for (const forbidden of [
  'DIRECTLY_APPLICABLE',
  'QualifiedTransformation',
  'RuntimeBinding',
  'DecisionResult',
  'PRODUCTION_CUTOVER'
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log(JSON.stringify(result, null, 2));
console.log('ADR-3B GEOX root-zone state source admissibility: PASS');
