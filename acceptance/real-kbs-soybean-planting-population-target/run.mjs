import assert from 'node:assert/strict';
import {
  PLANTING_PROVIDER_HASH,
  PLANTING_LOGICAL_TIME,
  buildPlantingTargetWorld
} from './target-world.mjs';

const world = buildPlantingTargetWorld();
const targetIndex = Object.fromEntries(
  world.validatedDatums.map((item) => [item.semanticPayload.semanticId, item.semanticPayload])
);

assert.equal(world.providerHash, PLANTING_PROVIDER_HASH);
assert.equal(world.validatedManifest.semanticPayload.replayClass, 'EXACT');
assert.deepEqual(targetIndex['crop.code'].value, { type: 'CATEGORY', category: 'soybean' });
assert.deepEqual(targetIndex['planting.row_spacing_in'].value, { type: 'DECIMAL', decimal: '15' });
assert.equal(targetIndex['planting.row_spacing_in'].unit, 'inch');
assert.deepEqual(targetIndex['jurisdiction.region'].value, { type: 'CATEGORY', category: 'michigan' });
assert.equal('planting.population_seeds_per_acre' in targetIndex, false);
assert.equal(world.adapterResponse.source_evidence[0].historical_operation_planting_population_seeds_per_acre, '180000');
assert.ok(world.adapterResponse.nonclaims.includes('HISTORICAL_OPERATION_180000_IS_NOT_RECOMMENDATION_AUTHORITY'));
assert.ok(new Date(PLANTING_LOGICAL_TIME) > new Date(world.validatedManifest.semanticPayload.evidenceCutoff));

console.log(JSON.stringify({
  ok: true,
  milestone: 'REAL_WORLD_HETEROGENEITY_PLANTING_TARGET_A03_A04',
  classification: 'RETROSPECTIVE_REAL_TARGET_CONTEXT_TEST_ONLY',
  providerHash: world.providerHash,
  decisionProblemRef: world.decision.ref,
  contextManifestRef: world.manifest.ref,
  replayClass: world.validatedManifest.semanticPayload.replayClass,
  context: {
    crop: targetIndex['crop.code'].value.category,
    rowSpacingIn: targetIndex['planting.row_spacing_in'].value.decimal,
    rowSpacingUnit: targetIndex['planting.row_spacing_in'].unit,
    jurisdiction: targetIndex['jurisdiction.region'].value.category
  },
  historicalOperationEvidence: {
    observedPlantingPopulationSeedsPerAcre: world.adapterResponse.source_evidence[0].historical_operation_planting_population_seeds_per_acre,
    promotedToTargetContext: false,
    recommendationAuthority: false
  },
  targetRefPromotedToFarmFieldOrZone: false,
  genericCoreContractsModified: false,
  newCoreAbstractionsAdded: 0,
  runtimeExecutionPerformed: false,
  decisionResultCreated: false,
  outcomeCreated: false
}, null, 2));
