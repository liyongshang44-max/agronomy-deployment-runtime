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
  const twin = input.sources.twinStateEstimateV2;
  const config = input.sources.continuationRuntimeConfigV1;
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

  const directDepletionFieldPresent =
    twin.objectType === 'twin_state_estimate_v1'
    && twin.directDepletionField === 'depletion_from_field_capacity_mm'
    && twin.depletionFormula === 'max(0, field_capacity_storage_mm - posterior_storage_mm)'
    && twin.lineageFields.includes('reality_binding_ref')
    && twin.lineageFields.includes('evidence_window_ref')
    && twin.lineageFields.includes('runtime_config_hash')
    && twin.lineageFields.includes('determinism_hash');

  const targetHydraulicAuthorityReady =
    config.parameterClass !== 'CONTROLLED_SYNTHETIC'
    && config.fieldCalibrationStatus === 'FIELD_CALIBRATED'
    && config.rootZonePolicyId !== 'GOVERNED_FIXED_ROOT_ZONE_300MM_V1'
    && adr.targetSpecificRootDepthAuthorityRequired === true
    && adr.targetSpecificFieldCapacityAuthorityRequired === true;

  const targetDeficitAdmissible =
    directDepletionFieldPresent
    && targetHydraulicAuthorityReady
    && twin.confidenceStatus !== 'NOT_ESTABLISHED'
    && !twin.limitations.includes('CONTROLLED_SYNTHETIC')
    && !twin.limitations.includes('NOT_FIELD_CALIBRATED');

  const availableWaterFractionIsDeficit =
    vanGenuchten.availableWaterFractionDefinition === 'root_zone_deficit'
    || vanGenuchten.faoTawDepletionSemantic === true;

  const adapterCanPublishTwinDeficit =
    adapter.twinStateEstimateSourceContract !== null
    || adapter.supportedSourceContracts.includes('twin_state_estimate_v1');

  const legacyPathAdmissible =
    legacy.defaultTargetSoilMoisture !== 0.22
    && legacy.defaultRootZoneDepthMm !== 300
    && adr.legacyThresholdAuthority !== 'PROHIBITED';

  const transformationAuthorized =
    adr.qualifiedTransformationAvailable === true
    && adr.mtlS01A09Authorized === true;

  let terminalStatus;
  if (!directDepletionFieldPresent) {
    terminalStatus = 'GEOX_ROOT_ZONE_DEFICIT_FIELD_ABSENT';
  } else if (!targetHydraulicAuthorityReady) {
    terminalStatus = 'ROOT_ZONE_DEFICIT_FIELD_PRESENT_REAL_TARGET_PARAMETER_AUTHORITY_AND_PROVIDER_GAP';
  } else if (!adapterCanPublishTwinDeficit) {
    terminalStatus = 'ROOT_ZONE_DEFICIT_TARGET_AUTHORITY_PRESENT_PROVIDER_GAP';
  } else if (!targetDeficitAdmissible) {
    terminalStatus = 'ROOT_ZONE_DEFICIT_SOURCE_PRESENT_BUT_NOT_ADMISSIBLE';
  } else {
    terminalStatus = 'GEOX_ROOT_ZONE_DEFICIT_SOURCE_CANDIDATE_PRESENT';
  }

  return Object.freeze({
    classification: 'NON_AUTHORITY_SOURCE_ADMISSIBILITY_ADJUDICATION',
    internalRootZoneState: internalRootZoneStatePresent ? 'PRESENT' : 'ABSENT',
    genericAvailableWaterFractionSemantic: availableWaterFractionIsDeficit
      ? 'DEFICIT_EQUIVALENCE_SUPPORTED'
      : 'VAN_GENUCHTEN_EFFECTIVE_SATURATION_NOT_DEFICIT',
    directRootZoneDepletionField: directDepletionFieldPresent
      ? 'PRESENT_DEPLETION_FROM_FIELD_CAPACITY_MM'
      : 'ABSENT',
    directRootZoneDepletionMetricForm: directDepletionFieldPresent
      ? 'FIELD_CAPACITY_STORAGE_MINUS_POSTERIOR_STORAGE'
      : 'ABSENT',
    targetHydraulicAuthority: targetHydraulicAuthorityReady
      ? 'TARGET_SPECIFIC_FIELD_CALIBRATED'
      : 'CONTROLLED_SYNTHETIC_NOT_FIELD_CALIBRATED',
    targetRootZoneDepthAuthority: config.rootZonePolicyId === 'GOVERNED_FIXED_ROOT_ZONE_300MM_V1'
      ? 'FIXED_SYNTHETIC_300MM_NOT_REAL_TARGET_AUTHORITY'
      : 'NON_FIXED_POLICY_PRESENT',
    targetDeficitAdmissibility: targetDeficitAdmissible ? 'ADMISSIBLE_CANDIDATE' : 'NOT_ADMISSIBLE',
    adrCompatibleTwinStateProvider: adapterCanPublishTwinDeficit ? 'PRESENT' : 'ABSENT',
    legacyDeficitPath: legacyPathAdmissible ? 'ADMISSIBLE' : 'INADMISSIBLE',
    qualifiedTransformation: transformationAuthorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
    targetSemantic: adr.requiredKnowledgeTargetSemantic,
    terminalStatus,
    nextFrontier: 'GEOX_ROOT_ZONE_DEFICIT_TARGET_PARAMETER_AUTHORITY_AND_PROVIDER_SEAM'
  });
}

assert.equal(evidence.classification, 'NON_AUTHORITY_CROSS_REPO_SOURCE_CONTRACT_EVIDENCE');
assert.equal(evidence.geox.repository, 'liyongshang44-max/GEOX');
assert.equal(evidence.geox.protectedMain, EXPECTED_GEOX_MAIN);
assert.equal(evidence.acceptedAdrConstraints.dec0034Main, EXPECTED_ADR_MAIN);
assert.equal(evidence.acceptedAdrConstraints.requiredKnowledgeTargetSemantic, REQUIRED_TARGET_SEMANTIC);

const result = classify(evidence);

assert.equal(result.internalRootZoneState, 'PRESENT');
assert.equal(result.genericAvailableWaterFractionSemantic, 'VAN_GENUCHTEN_EFFECTIVE_SATURATION_NOT_DEFICIT');
assert.equal(result.directRootZoneDepletionField, 'PRESENT_DEPLETION_FROM_FIELD_CAPACITY_MM');
assert.equal(result.directRootZoneDepletionMetricForm, 'FIELD_CAPACITY_STORAGE_MINUS_POSTERIOR_STORAGE');
assert.equal(result.targetHydraulicAuthority, 'CONTROLLED_SYNTHETIC_NOT_FIELD_CALIBRATED');
assert.equal(result.targetRootZoneDepthAuthority, 'FIXED_SYNTHETIC_300MM_NOT_REAL_TARGET_AUTHORITY');
assert.equal(result.targetDeficitAdmissibility, 'NOT_ADMISSIBLE');
assert.equal(result.adrCompatibleTwinStateProvider, 'ABSENT');
assert.equal(result.legacyDeficitPath, 'INADMISSIBLE');
assert.equal(result.qualifiedTransformation, 'NOT_AUTHORIZED');
assert.equal(result.targetSemantic, REQUIRED_TARGET_SEMANTIC);
assert.equal(result.terminalStatus, 'ROOT_ZONE_DEFICIT_FIELD_PRESENT_REAL_TARGET_PARAMETER_AUTHORITY_AND_PROVIDER_GAP');
assert.equal(result.nextFrontier, 'GEOX_ROOT_ZONE_DEFICIT_TARGET_PARAMETER_AUTHORITY_AND_PROVIDER_SEAM');

assert.equal(evidence.sources.twinStateEstimateV2.recommendationInputEligible, false);
assert.equal(evidence.sources.twinStateEstimateV2.actionInputEligible, false);
assert(evidence.sources.twinStateEstimateV2.limitations.includes('CONTROLLED_SYNTHETIC'));
assert(evidence.sources.twinStateEstimateV2.limitations.includes('NOT_FIELD_CALIBRATED'));
assert.equal(evidence.sources.continuationRuntimeConfigV1.rootZoneDepthMm, 300);
assert.equal(evidence.sources.continuationRuntimeConfigV1.fieldCapacityFraction, 0.3);
assert.equal(evidence.sources.continuationRuntimeConfigV1.wiltingPointFraction, 0.12);
assert.equal(evidence.sources.continuationRuntimeConfigV1.parameterClass, 'CONTROLLED_SYNTHETIC');
assert.equal(evidence.sources.continuationRuntimeConfigV1.fieldCalibrationStatus, 'NOT_FIELD_CALIBRATED');
assert.equal(evidence.sources.legacyIrrigationRequirement.defaultTargetSoilMoisture, 0.22);
assert.equal(evidence.sources.vanGenuchtenModel.availableWaterFractionDefinition, 'effective_saturation');
assert.equal(evidence.sources.adrGeoxAdapter.deviceObservationExplicitExclusion, 'soil_moisture -> root-zone state');
assert.equal(evidence.sources.adrGeoxAdapter.supportedSourceContracts.includes('twin_state_estimate_v1'), false);

const serialized = JSON.stringify(result);
for (const forbidden of [
  'DIRECTLY_APPLICABLE',
  'RuntimeBinding',
  'DecisionResult',
  'PRODUCTION_CUTOVER'
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log(JSON.stringify(result, null, 2));
console.log('ADR-3B GEOX root-zone deficit source admissibility: PASS');
