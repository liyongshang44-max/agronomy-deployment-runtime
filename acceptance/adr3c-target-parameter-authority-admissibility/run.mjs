import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));

const EXPECTED_ADR_MAIN = 'b968f927d82bfc40d0d8d1328c6c76fc6ea51037';
const EXPECTED_GEOX_MAIN = 'ca2a96d131bc1d3b2935e7b7460752bdbf79f9bd';
const REQUIRED_TARGET_SEMANTIC = 'soil.root_zone_deficit';

function parameterAuthorityAdmissible(parameter) {
  const realTargetProvenance = parameter.authorityClass !== 'CONTROLLED_SYNTHETIC_GOVERNED_CONFIG'
    && parameter.proofScope !== 'GOVERNANCE_IDENTITY_ONLY';
  const methodGrounded = parameter.measurementOrEstimationMethod !== 'NONE_CONFIGURED_CONSTANT';
  const fieldBound = parameter.fieldBinding !== 'INDIRECT_RUNTIME_SCOPE_ONLY';
  const cropBound = parameter.cropBinding !== 'NOT_IN_HYDRAULIC_BINDING';
  const seasonBound = parameter.seasonBinding !== 'NOT_IN_HYDRAULIC_BINDING';
  const temporalBound = !String(parameter.effectiveInterval).startsWith('NOT_TARGET_SPECIFIC');
  const decisionTimeVisible = parameter.availableAt !== 'NOT_EXPLICIT';
  const authorityIdentified = parameter.authorityRefsAndHashes === 'PRESENT';
  return realTargetProvenance
    && methodGrounded
    && fieldBound
    && cropBound
    && seasonBound
    && temporalBound
    && decisionTimeVisible
    && authorityIdentified;
}

function classify(input) {
  const d = input.admissibilityDimensions;
  const root = d.rootZoneDepth;
  const fc = d.fieldCapacity;
  const support = d.verticalSupport;
  const scope = d.targetIdentityAndScope;
  const temporal = d.temporalAndDecisionTime;
  const provenance = d.provenance;
  const twin = d.twinStateParameterBinding;
  const transform = d.qualifiedTransformation;

  const rootZoneDepthAuthority = parameterAuthorityAdmissible(root);
  const fieldCapacityAuthority = parameterAuthorityAdmissible(fc);
  const requiredHydraulicAuthority = rootZoneDepthAuthority && fieldCapacityAuthority;

  const twinStateParameterBindingExact =
    twin.configurationMatrixHash === 'EXACT'
    && twin.hydraulicBindingRefAndHash === 'EXACT'
    && twin.numericParameterEquality === 'EXACT'
    && twin.runtimeConfigRefAndHash === 'EXACT'
    && twin.stateEstimateLineage === 'COMPLETE';

  const targetScopeBindingExact =
    scope.parameterBindingScope === 'FIELD_ZONE_CROP_SEASON_STAGE_EXACT'
    && scope.realityClass !== 'CONTROLLED_SYNTHETIC_REPLAY_PROXY';

  const temporalBindingExact =
    temporal.parameterEffectiveTime === 'EXACT_TARGET_PARAMETER_EFFECTIVE_INTERVAL'
    && temporal.parameterAvailableAt === 'EXPLICIT'
    && temporal.decisionTimeVisibility === 'EXACT';

  const verticalSupportExact =
    support.targetSpecificBiologicalRootingSupportAuthority === 'PRESENT_EXACT'
    && support.admissibility === 'ADMISSIBLE';

  const provenanceComplete =
    provenance.identityRefsAndHashes === 'COMPLETE'
    && provenance.physicalTargetTruthProvenance === 'COMPLETE'
    && provenance.measurementOrEstimationProvenance === 'COMPLETE';

  const providerConditionsPass =
    rootZoneDepthAuthority
    && fieldCapacityAuthority
    && requiredHydraulicAuthority
    && twinStateParameterBindingExact
    && targetScopeBindingExact
    && temporalBindingExact
    && verticalSupportExact
    && provenanceComplete;

  const terminalPath = providerConditionsPass ? 'PATH_A' : 'PATH_B';

  return Object.freeze({
    classification: 'ADR3C_TARGET_PARAMETER_AUTHORITY_ADJUDICATION',
    targetSemantic: input.targetSemantic.contextSemanticId,
    targetRootZoneDepthAuthority: rootZoneDepthAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    targetFieldCapacityAuthority: fieldCapacityAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    requiredHydraulicAuthority: requiredHydraulicAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    wiltingPointRequirement: input.targetSemantic.wiltingPointRequiredForDirectDepletionInterpretation
      ? 'REQUIRED'
      : 'NOT_REQUIRED_FOR_DIRECT_DEPLETION_INTERPRETATION',
    twinStateParameterBinding: twinStateParameterBindingExact
      ? 'EXACT_TO_CURRENT_AUTHORITY'
      : 'NOT_EXACT',
    targetScopeBinding: targetScopeBindingExact ? 'EXACT' : 'NOT_EXACT',
    temporalBinding: temporalBindingExact ? 'EXACT' : 'NOT_EXACT',
    verticalSupport: verticalSupportExact ? 'EXACT' : 'NOT_ADMISSIBLE_AS_REAL_TARGET_SUPPORT',
    provenance: provenanceComplete
      ? 'COMPLETE_REAL_TARGET_PROVENANCE'
      : 'IDENTITY_COMPLETE_PHYSICAL_TARGET_TRUTH_ABSENT',
    providerConditionsPass,
    providerImplementation: providerConditionsPass ? 'CONDITIONALLY_ALLOWED' : 'NOT_IMPLEMENTED',
    directProjectionSourceValue: input.targetSemantic.sourceField,
    directProjectionTransformation: input.targetSemantic.transformationForDirectProjection,
    qualifiedTransformation: transform.authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
    qualifiedTransformationUsed: transform.used ? 'USED' : 'NOT_USED',
    layeredFieldCapacityAggregationByAdr: transform.layeredFieldCapacityAggregationPerformedByAdr
      ? 'PERFORMED'
      : 'NOT_PERFORMED',
    terminalPath,
    terminalStatus: providerConditionsPass
      ? 'ADR-3C_TARGET_PARAMETER_AUTHORITY_ADMISSIBLE_PROVIDER_SEAM_MAY_PROCEED'
      : 'ADR-3C_TARGET_PARAMETER_AUTHORITY_DISCOVERY_COMPLETE_REAL_TARGET_PARAMETER_AUTHORITY_ABSENT',
    nextOwner: providerConditionsPass ? 'ADR_PROVIDER_SEAM' : 'MCFT_FIELD_STATE_AUTHORITY',
    mtlS01A09: 'NOT_AUTHORIZED'
  });
}

assert.equal(evidence.classification, 'NON_AUTHORITY_CROSS_REPO_TARGET_PARAMETER_AUTHORITY_EVIDENCE');
assert.equal(evidence.baselines.adrProtectedMain, EXPECTED_ADR_MAIN);
assert.equal(evidence.baselines.geoxProtectedMain, EXPECTED_GEOX_MAIN);
assert.equal(evidence.targetSemantic.contextSemanticId, REQUIRED_TARGET_SEMANTIC);
assert.equal(evidence.targetSemantic.sourceObjectType, 'twin_state_estimate_v1');
assert.equal(evidence.targetSemantic.sourceField, 'depletion_from_field_capacity_mm');
assert.equal(evidence.targetSemantic.sourceFormula, 'max(0, field_capacity_storage_mm - posterior_storage_mm)');
assert.equal(evidence.targetSemantic.transformationForDirectProjection, 'NONE');
assert.equal(evidence.targetSemantic.wiltingPointRequiredForDirectDepletionInterpretation, false);

const matrix = evidence.geoxEvidence.configurationMatrix;
const hydraulic = matrix.hydraulicDefinition;
const binding = matrix.hydraulicBinding;
const reality = evidence.geoxEvidence.realityBinding;
const c8Context = evidence.geoxEvidence.c8ConfigurationContext;
const formalCrop = evidence.geoxEvidence.formalCropContextV3;
const adapter = evidence.geoxEvidence.continuationAuthorityAdapter;
const state = evidence.geoxEvidence.twinStateEstimateBuilderV2;
const inventory = evidence.geoxEvidence.inventory;

assert.equal(hydraulic.configurationSourceId, 'mcft_soil_hydraulic_config_c8_v1');
assert.equal(hydraulic.provenanceClass, 'CONTROLLED_SYNTHETIC_GOVERNED_CONFIG');
assert.equal(hydraulic.proofScope, 'GOVERNANCE_IDENTITY_ONLY');
assert.equal(hydraulic.parameters.root_zone_depth_mm.value, 300);
assert.equal(hydraulic.parameters.field_capacity_fraction.value, 0.3);
assert.equal(hydraulic.parameters.field_capacity_storage_mm.value, 90);
assert.equal(hydraulic.parameters.field_capacity_storage_mm.status, 'DERIVED_CONFIGURED');
assert.equal(binding.bindingId, 'soil_hydraulic_config_c8_v1');
assert.equal(binding.spatialSupport, 'ZONE');
assert.equal(binding.applicability.zone_id, 'zone_mcft_c8_water_001');
assert.equal(binding.applicability.root_zone_definition_id, 'rz_c8_0_300mm_v1');
assert.equal(binding.fieldId, null);
assert.equal(binding.seasonId, null);
assert.equal(binding.cropCode, null);
assert.equal(binding.biologicalStageBinding, null);
assert.equal(binding.availableAt, null);
assert.equal(binding.parameterProvenance, 'CONTROLLED_SYNTHETIC_GOVERNED_CONFIG');
assert(binding.forbiddenDownstreamUses.includes('DIRECT_STATE_EVIDENCE'));

assert.equal(reality.scope.field_id, 'field_c8_demo');
assert.equal(reality.scope.season_id, 'season_2026_c8_corn');
assert.equal(reality.scope.zone_id, 'zone_mcft_c8_water_001');
assert.equal(reality.cropBinding.crop_code, 'corn');
assert.equal(reality.rootZoneBinding.root_zone_definition_id, 'rz_c8_0_300mm_v1');
assert.equal(reality.realityScopeClass, 'CONTROLLED_SYNTHETIC_REPLAY_PROXY');
assert.equal(reality.realFieldPilotStatus, 'NOT_CLAIMED');
assert.equal(reality.productionStatus, 'NOT_CLAIMED');

assert.equal(c8Context.contextClass, 'CONFIGURATION_DERIVED_CONTEXT');
assert.equal(c8Context.evidenceRecord, false);
assert.equal(c8Context.cropStageScheduleHasEffectiveIntervals, true);
assert(c8Context.limitations.includes('controlled synthetic configuration schedule'));
assert(c8Context.limitations.includes('not field-verified phenology'));

assert.equal(formalCrop.scopeMatchesC8Twin, false);
assert.equal(formalCrop.mayCrossAuthorizeC8HydraulicParameters, false);
assert.notEqual(formalCrop.scope.field_id, reality.scope.field_id);
assert.notEqual(formalCrop.scope.zone_id, reality.scope.zone_id);

assert(adapter.behavior.includes('requires exact hydraulic binding ref and determinism hash'));
assert(adapter.behavior.includes('requires exact numeric equality for root-zone depth, wilting point, field capacity and saturation parameters'));
assert.equal(adapter.physicalTruthQualificationAdded, false);
assert.equal(adapter.parameterScopePromotionAdded, false);
assert.equal(adapter.parameterAvailabilityTimestampAdded, false);

assert.equal(state.objectType, 'twin_state_estimate_v1');
assert.equal(state.depletionField, 'depletion_from_field_capacity_mm');
assert.equal(state.depletionFormula, 'max(0, field_capacity_storage_mm - posterior_storage_mm)');
assert.equal(state.realityBindingRefAndHashPreserved, true);
assert.equal(state.runtimeConfigRefAndHashPreserved, true);
assert.equal(state.determinismHashPreserved, true);
assert.equal(state.lineageIdAndRevisionIdPreserved, true);
assert.equal(state.useEligibility.recommendation_input_eligible, false);
assert.equal(state.useEligibility.action_input_eligible, false);

assert.equal(inventory.soilHydraulicConfigurationBindingCountInFrozenMatrix, 1);
assert.equal(inventory.discoveredAlternateC8TargetSpecificHydraulicAuthority, false);
assert.equal(inventory.discoveredFieldOrZoneMeasuredFieldCapacityAuthorityForC8, false);
assert.equal(inventory.discoveredCropSeasonStageSpecificRealRootDepthAuthorityForC8, false);
assert.equal(inventory.discoveredExplicitParameterAvailableAtForC8HydraulicAuthority, false);
assert.equal(inventory.discoveredParameterUncertaintyOrConfidenceForC8HydraulicAuthority, false);

const result = classify(evidence);

assert.equal(result.targetRootZoneDepthAuthority, 'NOT_ADMISSIBLE');
assert.equal(result.targetFieldCapacityAuthority, 'NOT_ADMISSIBLE');
assert.equal(result.requiredHydraulicAuthority, 'NOT_ADMISSIBLE');
assert.equal(result.wiltingPointRequirement, 'NOT_REQUIRED_FOR_DIRECT_DEPLETION_INTERPRETATION');
assert.equal(result.twinStateParameterBinding, 'EXACT_TO_CURRENT_AUTHORITY');
assert.equal(result.targetScopeBinding, 'NOT_EXACT');
assert.equal(result.temporalBinding, 'NOT_EXACT');
assert.equal(result.verticalSupport, 'NOT_ADMISSIBLE_AS_REAL_TARGET_SUPPORT');
assert.equal(result.provenance, 'IDENTITY_COMPLETE_PHYSICAL_TARGET_TRUTH_ABSENT');
assert.equal(result.providerConditionsPass, false);
assert.equal(result.providerImplementation, 'NOT_IMPLEMENTED');
assert.equal(result.directProjectionTransformation, 'NONE');
assert.equal(result.qualifiedTransformation, 'NOT_AUTHORIZED');
assert.equal(result.qualifiedTransformationUsed, 'NOT_USED');
assert.equal(result.layeredFieldCapacityAggregationByAdr, 'NOT_PERFORMED');
assert.equal(result.terminalPath, 'PATH_B');
assert.equal(result.terminalStatus, 'ADR-3C_TARGET_PARAMETER_AUTHORITY_DISCOVERY_COMPLETE_REAL_TARGET_PARAMETER_AUTHORITY_ABSENT');
assert.equal(result.nextOwner, 'MCFT_FIELD_STATE_AUTHORITY');
assert.equal(result.mtlS01A09, 'NOT_AUTHORIZED');

// A calibration label alone must never upgrade authority. Admissibility is derived
// from provenance, proof scope, method, target scope, effective time and visibility.
const labelOnlyMutation = structuredClone(evidence);
labelOnlyMutation.admissibilityDimensions.calibrationValidationUncertainty.fieldCalibrationStatusObserved = 'FIELD_CALIBRATED';
assert.equal(classify(labelOnlyMutation).targetRootZoneDepthAuthority, 'NOT_ADMISSIBLE');
assert.equal(classify(labelOnlyMutation).targetFieldCapacityAuthority, 'NOT_ADMISSIBLE');
assert.equal(labelOnlyMutation.admissibilityDimensions.calibrationValidationUncertainty.fieldCalibrationStatusIsSoleAdmissibilityRule, false);

for (const forbidden of [
  'ADAPTER_IMPLEMENTED',
  'CONTEXT_PROVIDER_IMPLEMENTED',
  'DECISION_RESULT_WRITTEN',
  'PRODUCTION_CUTOVER',
  'MTL-S01_AUTHORIZED',
  'A09_AUTHORIZED'
]) {
  assert.equal(JSON.stringify(result).includes(forbidden), false, forbidden);
}

console.log(JSON.stringify(result, null, 2));
console.log('ADR-3C target-parameter authority discovery: PASS / PATH_B');
