import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync(new URL('./contract.json', import.meta.url), 'utf8'));
const adr3c = JSON.parse(readFileSync(new URL('../adr3c-target-parameter-authority-admissibility/evidence.json', import.meta.url), 'utf8'));

const EXPECTED_ADR_MAIN = 'fbbe41756fe88af9ac9d149a8f35a2933e3889cf';
const EXPECTED_GEOX_MAIN = 'ca56d60e3d927ccda5d1f28255e195575bf7a487';
const EXPECTED_TARGET = 'soil.root_zone_deficit';
const EXPECTED_SOURCE_OBJECT = 'twin_state_estimate_v1';
const EXPECTED_SOURCE_FIELD = 'depletion_from_field_capacity_mm';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function same(left, right) {
  return canonical(left) === canonical(right);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validHash(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function timestamp(value) {
  if (!nonEmpty(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intervalValid(interval) {
  const start = timestamp(interval?.start);
  const end = timestamp(interval?.end);
  return start !== null && end !== null && start <= end;
}

function covers(outer, inner) {
  if (!intervalValid(outer) || !intervalValid(inner)) return false;
  return timestamp(outer.start) <= timestamp(inner.start) && timestamp(outer.end) >= timestamp(inner.end);
}

function exactScope(item, target) {
  return same(item?.subjectIdentity, target.subjectIdentity)
    && item?.fieldId === target.fieldId
    && item?.zoneId === target.zoneId
    && item?.crop === target.crop
    && item?.seasonId === target.seasonId;
}

function explicitVerticalSupport(value) {
  if (!value || typeof value !== 'object') return false;
  const from = Number(value.fromMm);
  const to = Number(value.toMm);
  return Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from;
}

function authorityIdentityComplete(authority) {
  return nonEmpty(authority?.authorityId) && validHash(authority?.authorityHash);
}

function methodComplete(authority) {
  return authority?.method?.status === 'COMPLETE'
    && nonEmpty(authority?.method?.methodClass)
    && nonEmpty(authority?.method?.methodRef);
}

function provenanceComplete(authority) {
  return authority?.provenance?.status === 'COMPLETE'
    && nonEmpty(authority?.provenance?.provenanceClass)
    && nonEmpty(authority?.provenance?.sourceRef)
    && validHash(authority?.provenance?.sourceHash);
}

function uncertaintyPresent(authority) {
  return authority?.uncertainty && typeof authority.uncertainty === 'object'
    && nonEmpty(authority.uncertainty.type)
    && authority.uncertainty.status !== 'DROPPED';
}

function confidencePresent(authority) {
  return authority?.confidence && typeof authority.confidence === 'object'
    && nonEmpty(authority.confidence.status)
    && authority.confidence.status !== 'DROPPED';
}

function exactAuthorityBinding(actual, authority) {
  return actual?.authorityId === authority.authorityId
    && actual?.authorityHash === authority.authorityHash;
}

function evaluate(view) {
  const reasons = [];
  const target = view?.targetRequest;
  const rz = view?.rootZoneDepthAuthority;
  const fc = view?.fieldCapacityAuthority;
  const hyd = view?.requiredHydraulicAuthority;
  const state = view?.twinState;
  const projection = view?.projection;
  const authorities = [rz, fc, hyd];

  const producerOwnerExact = view?.producerAuthorityOwner === 'MCFT_FIELD_STATE';
  if (!producerOwnerExact) reasons.push('PRODUCER_AUTHORITY_OWNER_MISMATCH');
  const consumerExact = view?.consumer === 'ADR';
  if (!consumerExact) reasons.push('CONSUMER_MISMATCH');

  const targetRootZoneDepthAuthority = rz?.admissibility === 'ADMISSIBLE';
  if (!targetRootZoneDepthAuthority) reasons.push('TARGET_ROOT_ZONE_DEPTH_AUTHORITY_NOT_ADMISSIBLE');
  const targetFieldCapacityAuthority = fc?.admissibility === 'ADMISSIBLE';
  if (!targetFieldCapacityAuthority) reasons.push('TARGET_FIELD_CAPACITY_AUTHORITY_NOT_ADMISSIBLE');
  const requiredHydraulicAuthority = hyd?.admissibility === 'ADMISSIBLE';
  if (!requiredHydraulicAuthority) reasons.push('REQUIRED_HYDRAULIC_AUTHORITY_NOT_ADMISSIBLE');

  const targetScopeBinding = Boolean(target)
    && authorities.every((item) => exactScope(item, target))
    && exactScope(state, target);
  if (!targetScopeBinding) reasons.push('TARGET_SCOPE_BINDING_NOT_EXACT');

  const identitiesComplete = authorities.every(authorityIdentityComplete) && authorityIdentityComplete(state);
  if (!identitiesComplete) reasons.push('AUTHORITY_ID_HASH_PAIR_INCOMPLETE');

  const stateIntervalValid = intervalValid(state?.effectiveInterval);
  const authorityIntervalsCover = stateIntervalValid && authorities.every((item) => covers(item?.effectiveInterval, state.effectiveInterval));
  const authorityVisibleByState = timestamp(state?.availableAt) !== null
    && authorities.every((item) => timestamp(item?.availableAt) !== null && timestamp(item.availableAt) <= timestamp(state.availableAt));
  const targetStateIntervalExact = same(target?.effectiveInterval, state?.effectiveInterval);
  const projectionStateIntervalExact = same(projection?.effectiveInterval, state?.effectiveInterval);
  const projectionAvailableAtExact = projection?.availableAt === state?.availableAt;
  const temporalBinding = authorityIntervalsCover
    && authorityVisibleByState
    && targetStateIntervalExact
    && projectionStateIntervalExact
    && projectionAvailableAtExact;
  if (!temporalBinding) reasons.push('TEMPORAL_BINDING_NOT_EXACT');

  const supportExplicit = explicitVerticalSupport(target?.verticalSupport)
    && authorities.every((item) => explicitVerticalSupport(item?.verticalSupport))
    && explicitVerticalSupport(state?.verticalSupport)
    && explicitVerticalSupport(projection?.verticalSupport);
  const supportExact = supportExplicit
    && authorities.every((item) => same(item.verticalSupport, target.verticalSupport))
    && same(state.verticalSupport, target.verticalSupport)
    && same(projection.verticalSupport, state.verticalSupport);
  if (!supportExact) reasons.push('VERTICAL_SUPPORT_NOT_ADMISSIBLE_OR_NOT_EXACT');

  const methodsComplete = authorities.every(methodComplete) && methodComplete(state);
  if (!methodsComplete) reasons.push('METHOD_INCOMPLETE');
  const provenanceCompleteAll = authorities.every(provenanceComplete) && provenanceComplete(state);
  if (!provenanceCompleteAll) reasons.push('PROVENANCE_INCOMPLETE');
  const authorityUncertaintyPresent = authorities.every(uncertaintyPresent);
  if (!authorityUncertaintyPresent) reasons.push('PARAMETER_AUTHORITY_UNCERTAINTY_MISSING');
  const authorityConfidencePresent = authorities.every(confidencePresent);
  if (!authorityConfidencePresent) reasons.push('PARAMETER_AUTHORITY_CONFIDENCE_MISSING');

  const twinStateShapeExact = state?.objectType === EXPECTED_SOURCE_OBJECT
    && state?.sourceField === EXPECTED_SOURCE_FIELD;
  if (!twinStateShapeExact) reasons.push('TWIN_STATE_SOURCE_FIELD_MISMATCH');
  const parameterBindingsExact = exactAuthorityBinding(state?.parameterAuthorityBindings?.rootZoneDepth, rz)
    && exactAuthorityBinding(state?.parameterAuthorityBindings?.fieldCapacity, fc)
    && exactAuthorityBinding(state?.parameterAuthorityBindings?.requiredHydraulic, hyd);
  if (!parameterBindingsExact) reasons.push('TWIN_STATE_PARAMETER_BINDING_NOT_EXACT');
  const twinStateParameterBinding = twinStateShapeExact && parameterBindingsExact;

  const projectionSourceExact = projection?.semanticId === EXPECTED_TARGET
    && projection?.unit === 'mm'
    && projection?.sourceObjectType === EXPECTED_SOURCE_OBJECT
    && projection?.sourceField === EXPECTED_SOURCE_FIELD
    && projection?.sourceAuthorityId === state?.authorityId
    && projection?.sourceAuthorityHash === state?.authorityHash;
  if (!projectionSourceExact) reasons.push('PROJECTED_SOURCE_AUTHORITY_NOT_EXACT');

  const uncertaintyPreserved = uncertaintyPresent(state)
    && same(projection?.uncertainty, state?.uncertainty);
  if (!uncertaintyPreserved) reasons.push('UNCERTAINTY_DROPPED_OR_CHANGED');
  const confidencePreserved = confidencePresent(state)
    && same(projection?.confidence, state?.confidence);
  if (!confidencePreserved) reasons.push('CONFIDENCE_DROPPED_OR_CHANGED');

  const noTruthInvention = projection?.transformation === 'NONE'
    && projection?.consumerSideTruthInvention === false
    && projection?.recalculatesRootZoneDeficit === false
    && projection?.legacy022Used === false
    && projection?.qualifiedTransformationUsed === false
    && projection?.mtlS01Used === false
    && projection?.a09Used === false;
  if (!noTruthInvention) reasons.push('CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');

  const providerConditionsPass = producerOwnerExact
    && consumerExact
    && targetRootZoneDepthAuthority
    && targetFieldCapacityAuthority
    && requiredHydraulicAuthority
    && targetScopeBinding
    && identitiesComplete
    && temporalBinding
    && supportExact
    && methodsComplete
    && provenanceCompleteAll
    && authorityUncertaintyPresent
    && authorityConfidencePresent
    && twinStateParameterBinding
    && projectionSourceExact
    && uncertaintyPreserved
    && confidencePreserved
    && noTruthInvention;

  return Object.freeze({
    TARGET_ROOT_ZONE_DEPTH_AUTHORITY: targetRootZoneDepthAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    TARGET_FIELD_CAPACITY_AUTHORITY: targetFieldCapacityAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    REQUIRED_HYDRAULIC_AUTHORITY: requiredHydraulicAuthority ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    TWIN_STATE_PARAMETER_BINDING: twinStateParameterBinding ? 'EXACT' : 'NOT_EXACT',
    TARGET_SCOPE_BINDING: targetScopeBinding ? 'EXACT' : 'NOT_EXACT',
    TEMPORAL_BINDING: temporalBinding ? 'EXACT' : 'NOT_EXACT',
    VERTICAL_SUPPORT: supportExact ? 'ADMISSIBLE' : 'NOT_ADMISSIBLE',
    PROVENANCE: provenanceCompleteAll ? 'COMPLETE' : 'INCOMPLETE',
    PROVIDER_CONDITIONS_PASS: providerConditionsPass,
    TRANSFORMATION: projection?.transformation ?? null,
    LEGACY_0_22: projection?.legacy022Used === false ? 'NOT_USED' : 'USED_OR_UNKNOWN',
    MTL_S01: projection?.mtlS01Used === false ? 'NOT_USED' : 'USED_OR_UNKNOWN',
    A09: projection?.a09Used === false ? 'NOT_USED' : 'USED_OR_UNKNOWN',
    CONSUMER_SIDE_TRUTH_INVENTION: projection?.consumerSideTruthInvention === false ? false : true,
    reasons: Object.freeze(reasons.sort())
  });
}

function hash(char) {
  return `sha256:${char.repeat(64)}`;
}

function authority(kind, id, hashChar) {
  return {
    admissibility: 'ADMISSIBLE',
    authorityId: id,
    authorityHash: hash(hashChar),
    subjectIdentity: { subjectId: 'field-state-subject-fixture-v1' },
    fieldId: 'field_fixture',
    zoneId: 'zone_fixture',
    crop: 'corn',
    seasonId: 'season_fixture',
    effectiveInterval: { start: '2026-04-01T00:00:00Z', end: '2026-10-01T00:00:00Z' },
    availableAt: '2026-03-31T20:00:00Z',
    verticalSupport: { fromMm: '0', toMm: '600' },
    method: {
      status: 'COMPLETE',
      methodClass: `${kind}_QUALIFIED_METHOD_FIXTURE`,
      methodRef: `method:${kind.toLowerCase()}:fixture:v1`
    },
    provenance: {
      status: 'COMPLETE',
      provenanceClass: 'MCFT_FIELD_STATE_AUTHORITY_FIXTURE',
      sourceRef: `source:${kind.toLowerCase()}:fixture:v1`,
      sourceHash: hash(String.fromCharCode(hashChar.charCodeAt(0) + 3))
    },
    uncertainty: {
      status: 'PRESERVED',
      type: 'INTERVAL',
      sourceRef: `uncertainty:${kind.toLowerCase()}:fixture:v1`
    },
    confidence: {
      status: 'QUALIFIED',
      basisRef: `confidence:${kind.toLowerCase()}:fixture:v1`
    }
  };
}

function qualifiedFixture() {
  const rz = authority('ROOT_ZONE_DEPTH', 'authority:root-zone-depth:fixture:v1', '1');
  const fc = authority('FIELD_CAPACITY', 'authority:field-capacity:fixture:v1', '2');
  const hyd = authority('HYDRAULIC', 'authority:hydraulic:fixture:v1', '3');
  const stateUncertainty = {
    status: 'PRESERVED',
    type: 'INTERVAL',
    lowerMm: '35',
    upperMm: '45',
    sourceRef: 'state-uncertainty:fixture:v1'
  };
  const stateConfidence = {
    status: 'QUALIFIED',
    confidenceLevel: '0.95',
    basisRef: 'state-confidence:fixture:v1'
  };
  const target = {
    subjectIdentity: { subjectId: 'field-state-subject-fixture-v1' },
    fieldId: 'field_fixture',
    zoneId: 'zone_fixture',
    crop: 'corn',
    seasonId: 'season_fixture',
    effectiveInterval: { start: '2026-06-01T09:00:00Z', end: '2026-06-01T10:00:00Z' },
    verticalSupport: { fromMm: '0', toMm: '600' }
  };
  const state = {
    objectType: EXPECTED_SOURCE_OBJECT,
    authorityId: 'state:twin-state-estimate:fixture:v1',
    authorityHash: hash('4'),
    subjectIdentity: structuredClone(target.subjectIdentity),
    fieldId: target.fieldId,
    zoneId: target.zoneId,
    crop: target.crop,
    seasonId: target.seasonId,
    effectiveInterval: structuredClone(target.effectiveInterval),
    availableAt: '2026-06-01T09:55:00Z',
    verticalSupport: structuredClone(target.verticalSupport),
    method: {
      status: 'COMPLETE',
      methodClass: 'MCFT_TWIN_STATE_ESTIMATE_METHOD_FIXTURE',
      methodRef: 'method:twin-state-estimate:fixture:v1'
    },
    provenance: {
      status: 'COMPLETE',
      provenanceClass: 'MCFT_FIELD_STATE_AUTHORITY_FIXTURE',
      sourceRef: 'source:twin-state-estimate:fixture:v1',
      sourceHash: hash('8')
    },
    uncertainty: stateUncertainty,
    confidence: stateConfidence,
    sourceField: EXPECTED_SOURCE_FIELD,
    parameterAuthorityBindings: {
      rootZoneDepth: { authorityId: rz.authorityId, authorityHash: rz.authorityHash },
      fieldCapacity: { authorityId: fc.authorityId, authorityHash: fc.authorityHash },
      requiredHydraulic: { authorityId: hyd.authorityId, authorityHash: hyd.authorityHash }
    }
  };
  return {
    classification: 'NON_AUTHORITY_TEST_FIXTURE',
    producerAuthorityOwner: 'MCFT_FIELD_STATE',
    consumer: 'ADR',
    targetRequest: target,
    rootZoneDepthAuthority: rz,
    fieldCapacityAuthority: fc,
    requiredHydraulicAuthority: hyd,
    twinState: state,
    projection: {
      semanticId: EXPECTED_TARGET,
      unit: 'mm',
      sourceObjectType: EXPECTED_SOURCE_OBJECT,
      sourceField: EXPECTED_SOURCE_FIELD,
      sourceAuthorityId: state.authorityId,
      sourceAuthorityHash: state.authorityHash,
      effectiveInterval: structuredClone(state.effectiveInterval),
      availableAt: state.availableAt,
      verticalSupport: structuredClone(state.verticalSupport),
      uncertainty: structuredClone(stateUncertainty),
      confidence: structuredClone(stateConfidence),
      transformation: 'NONE',
      consumerSideTruthInvention: false,
      recalculatesRootZoneDeficit: false,
      legacy022Used: false,
      qualifiedTransformationUsed: false,
      mtlS01Used: false,
      a09Used: false
    }
  };
}

function expectBlocked(name, mutate, expectedReason) {
  const fixture = qualifiedFixture();
  mutate(fixture);
  const result = evaluate(fixture);
  assert.equal(result.PROVIDER_CONDITIONS_PASS, false, name);
  assert(result.reasons.includes(expectedReason), `${name}: expected ${expectedReason}, got ${result.reasons.join(',')}`);
}

assert.equal(contract.classification, 'NON_AUTHORITY_ADR_CONSUMER_PRECONDITION_CONTRACT');
assert.equal(contract.contractId, 'ADR-3D-PRE-FIELD-STATE-AUTHORITY-CONSUMPTION-CONTRACT-V1');
assert.equal(contract.baselines.adrProtectedMain, EXPECTED_ADR_MAIN);
assert.equal(contract.baselines.geoxObservedProtectedMain, EXPECTED_GEOX_MAIN);
assert.equal(contract.ownership.producerAuthorityOwner, 'MCFT_FIELD_STATE');
assert.equal(contract.ownership.consumer, 'ADR');
assert.equal(contract.ownership.consumerMayDefineProducerPersistenceSchema, false);
assert.equal(contract.ownership.consumerMayCreatePhysicalTargetTruth, false);
assert.equal(contract.target.semanticId, EXPECTED_TARGET);
assert.equal(contract.target.sourceObjectType, EXPECTED_SOURCE_OBJECT);
assert.equal(contract.target.sourceField, EXPECTED_SOURCE_FIELD);
assert.equal(contract.target.transformation, 'NONE');
assert.equal(contract.projectionSemantics.contextDatumSchemaChangeRequiredByThisContract, false);
assert.equal(contract.verticalSupportSemantics.adrMayAssumePermanentFieldConstant, false);
assert.equal(contract.verticalSupportSemantics.pointOrLayeredToRootZoneAggregationOwnedByAdr, false);
assert.equal(contract.activationGate.currentProviderState, 'NOT_IMPLEMENTED');
assert.equal(contract.activationGate.currentBlockerOwner, 'MCFT_FIELD_STATE');

// The current real ADR-3C predecessor must remain blocked. ADR-3D-PRE prepares a
// future consumer gate; it does not reinterpret the current synthetic authority.
assert.equal(adr3c.admissibilityDimensions.rootZoneDepth.admissibility, 'NOT_ADMISSIBLE');
assert.equal(adr3c.admissibilityDimensions.fieldCapacity.admissibility, 'NOT_ADMISSIBLE');
assert.equal(adr3c.admissibilityDimensions.verticalSupport.admissibility, 'NOT_ADMISSIBLE_AS_REAL_TARGET_VERTICAL_SUPPORT');
assert.equal(adr3c.acceptedConstraints.providerImplementationAllowedOnlyIfAllTargetAuthorityConditionsPass, true);

const qualified = evaluate(qualifiedFixture());
assert.deepEqual(qualified, {
  TARGET_ROOT_ZONE_DEPTH_AUTHORITY: 'ADMISSIBLE',
  TARGET_FIELD_CAPACITY_AUTHORITY: 'ADMISSIBLE',
  REQUIRED_HYDRAULIC_AUTHORITY: 'ADMISSIBLE',
  TWIN_STATE_PARAMETER_BINDING: 'EXACT',
  TARGET_SCOPE_BINDING: 'EXACT',
  TEMPORAL_BINDING: 'EXACT',
  VERTICAL_SUPPORT: 'ADMISSIBLE',
  PROVENANCE: 'COMPLETE',
  PROVIDER_CONDITIONS_PASS: true,
  TRANSFORMATION: 'NONE',
  LEGACY_0_22: 'NOT_USED',
  MTL_S01: 'NOT_USED',
  A09: 'NOT_USED',
  CONSUMER_SIDE_TRUTH_INVENTION: false,
  reasons: []
});

expectBlocked('producer owner', (f) => { f.producerAuthorityOwner = 'ADR'; }, 'PRODUCER_AUTHORITY_OWNER_MISMATCH');
expectBlocked('root-zone authority', (f) => { f.rootZoneDepthAuthority.admissibility = 'NOT_ADMISSIBLE'; }, 'TARGET_ROOT_ZONE_DEPTH_AUTHORITY_NOT_ADMISSIBLE');
expectBlocked('field-capacity authority', (f) => { f.fieldCapacityAuthority.admissibility = 'NOT_ADMISSIBLE'; }, 'TARGET_FIELD_CAPACITY_AUTHORITY_NOT_ADMISSIBLE');
expectBlocked('hydraulic authority', (f) => { f.requiredHydraulicAuthority.admissibility = 'NOT_ADMISSIBLE'; }, 'REQUIRED_HYDRAULIC_AUTHORITY_NOT_ADMISSIBLE');
expectBlocked('authority hash', (f) => { f.rootZoneDepthAuthority.authorityHash = ''; }, 'AUTHORITY_ID_HASH_PAIR_INCOMPLETE');
expectBlocked('subject identity', (f) => { f.fieldCapacityAuthority.subjectIdentity.subjectId = 'other-subject'; }, 'TARGET_SCOPE_BINDING_NOT_EXACT');
expectBlocked('field scope', (f) => { f.requiredHydraulicAuthority.fieldId = 'other-field'; }, 'TARGET_SCOPE_BINDING_NOT_EXACT');
expectBlocked('zone scope', (f) => { f.twinState.zoneId = 'other-zone'; }, 'TARGET_SCOPE_BINDING_NOT_EXACT');
expectBlocked('crop scope', (f) => { f.rootZoneDepthAuthority.crop = 'soybean'; }, 'TARGET_SCOPE_BINDING_NOT_EXACT');
expectBlocked('season scope', (f) => { f.fieldCapacityAuthority.seasonId = 'other-season'; }, 'TARGET_SCOPE_BINDING_NOT_EXACT');
expectBlocked('authority effective interval', (f) => { f.rootZoneDepthAuthority.effectiveInterval.end = '2026-05-01T00:00:00Z'; }, 'TEMPORAL_BINDING_NOT_EXACT');
expectBlocked('authority decision-time visibility', (f) => { f.fieldCapacityAuthority.availableAt = '2026-06-01T10:05:00Z'; }, 'TEMPORAL_BINDING_NOT_EXACT');
expectBlocked('projected effective interval', (f) => { f.projection.effectiveInterval.end = '2026-06-01T11:00:00Z'; }, 'TEMPORAL_BINDING_NOT_EXACT');
expectBlocked('projected available-at', (f) => { f.projection.availableAt = '2026-06-01T09:56:00Z'; }, 'TEMPORAL_BINDING_NOT_EXACT');
expectBlocked('vertical support missing', (f) => { f.rootZoneDepthAuthority.verticalSupport = null; }, 'VERTICAL_SUPPORT_NOT_ADMISSIBLE_OR_NOT_EXACT');
expectBlocked('vertical support mismatch', (f) => { f.twinState.verticalSupport.toMm = '300'; }, 'VERTICAL_SUPPORT_NOT_ADMISSIBLE_OR_NOT_EXACT');
expectBlocked('method missing', (f) => { f.requiredHydraulicAuthority.method.status = 'UNKNOWN'; }, 'METHOD_INCOMPLETE');
expectBlocked('provenance incomplete', (f) => { f.fieldCapacityAuthority.provenance.status = 'INCOMPLETE'; }, 'PROVENANCE_INCOMPLETE');
expectBlocked('parameter uncertainty missing', (f) => { f.rootZoneDepthAuthority.uncertainty.status = 'DROPPED'; }, 'PARAMETER_AUTHORITY_UNCERTAINTY_MISSING');
expectBlocked('parameter confidence missing', (f) => { f.requiredHydraulicAuthority.confidence.status = 'DROPPED'; }, 'PARAMETER_AUTHORITY_CONFIDENCE_MISSING');
expectBlocked('state parameter authority binding', (f) => { f.twinState.parameterAuthorityBindings.fieldCapacity.authorityHash = hash('9'); }, 'TWIN_STATE_PARAMETER_BINDING_NOT_EXACT');
expectBlocked('state source field', (f) => { f.twinState.sourceField = 'recomputed_deficit_mm'; }, 'TWIN_STATE_SOURCE_FIELD_MISMATCH');
expectBlocked('projection source ref', (f) => { f.projection.sourceAuthorityId = 'other-state'; }, 'PROJECTED_SOURCE_AUTHORITY_NOT_EXACT');
expectBlocked('uncertainty dropped', (f) => { f.projection.uncertainty = { status: 'DROPPED', type: 'UNKNOWN' }; }, 'UNCERTAINTY_DROPPED_OR_CHANGED');
expectBlocked('confidence dropped', (f) => { f.projection.confidence = { status: 'DROPPED' }; }, 'CONFIDENCE_DROPPED_OR_CHANGED');
expectBlocked('transformation', (f) => { f.projection.transformation = 'LAYERED_TO_ROOT_ZONE_AGGREGATION'; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('truth invention', (f) => { f.projection.consumerSideTruthInvention = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('deficit recalculation', (f) => { f.projection.recalculatesRootZoneDeficit = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('legacy 0.22', (f) => { f.projection.legacy022Used = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('qualified transformation', (f) => { f.projection.qualifiedTransformationUsed = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('MTL-S01', (f) => { f.projection.mtlS01Used = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');
expectBlocked('A09', (f) => { f.projection.a09Used = true; }, 'CONSUMER_SIDE_TRUTH_INVENTION_OR_FORBIDDEN_PATH');

console.log(JSON.stringify(qualified, null, 2));
console.log('ADR-3D-PRE field-state authority consumption contract: PASS');
