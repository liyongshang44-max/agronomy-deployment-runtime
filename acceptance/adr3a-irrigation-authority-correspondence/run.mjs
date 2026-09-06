import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceContentHash } from '../../packages/source-registry/src/index.mjs';

const inventory = JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url), 'utf8'));

assert.equal(inventory.contractVersion, 'adr.adr3a-irrigation-authority-correspondence.v1');
assert.equal(inventory.classification, 'NON_AUTHORITY_MIGRATION_QUALIFICATION_EVIDENCE');
assert.equal(inventory.authorityEffect, 'NONE');
assert.equal(inventory.cutoverAuthorized, false);
assert.equal(inventory.sourceHeads.adr, '26a8e72b44ec39ce28b3275bbd367c5e403172fd');
assert.equal(inventory.sourceHeads.geox, 'f41dde8d44de95e71748e756e048e0166c1916b7');

const allowedReachability = new Set([
  'ACTIVE_RUNTIME',
  'COMMERCIAL_REACHABLE',
  'SHADOW_ONLY',
  'ACCEPTANCE_ONLY',
  'DEMO_ONLY',
  'LEGACY_UNREACHABLE'
]);
for (const item of inventory.legacyInventory) {
  assert.ok(item.legacyDecisionId);
  assert.ok(Array.isArray(item.reachability) && item.reachability.length > 0);
  for (const value of item.reachability) assert.ok(allowedReachability.has(value), `unknown reachability ${value}`);
}

const allowedComparability = new Set(inventory.comparabilityStatuses);
assert.deepEqual([...allowedComparability], [
  'AUTHORITY_CANDIDATE_EXACTLY_COMPARABLE',
  'AUTHORITY_CANDIDATE_COMPARABLE_WITH_EXPLICIT_LIMITATIONS',
  'SAME_ACTION_DOMAIN_DIFFERENT_SCIENTIFIC_PROPOSITION',
  'TARGET_CONTEXT_NOT_EQUIVALENT',
  'METRIC_SEMANTICS_NOT_EQUIVALENT',
  'MATERIAL_ACTION_NOT_EQUIVALENT',
  'NOT_COMPARABLE',
  'LEGACY_BEHAVIOR_WITH_NO_DEFENSIBLE_AUTHORITY_BASIS'
]);
for (const row of inventory.migrationMatrix) {
  assert.ok(allowedComparability.has(row.comparabilityStatus), `invalid comparability status ${row.comparabilityStatus}`);
}

const selectedId = 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1';
const selected = inventory.selectedMigrationSubject;
assert.equal(selected.legacyDecisionId, selectedId);
assert.equal(selected.currentDefensibleSameDecisionAuthority, 'ABSENT');
assert.equal(selected.currentCandidateStatus, 'SAME_ACTION_DOMAIN_DIFFERENT_SCIENTIFIC_PROPOSITION');
assert.equal(selected.architectureGap, false);
assert.match(selected.exactScientificAuthorityGap, /same governed soil-water metric and unit semantics/i);
assert.match(selected.exactScientificAuthorityGap, /0\.22 is comparison evidence only/i);

const selectedLegacy = inventory.legacyInventory.find((row) => row.legacyDecisionId === selectedId);
assert.ok(selectedLegacy, 'selected legacy surface must exist in inventory');
assert.ok(selectedLegacy.reachability.includes('ACTIVE_RUNTIME'));
assert.ok(selectedLegacy.reachability.includes('COMMERCIAL_REACHABLE'));
assert.equal(selectedLegacy.commercialReachability, true);
assert.match(selectedLegacy.formula, /soil_moisture < 0\.22/);
assert.match(selectedLegacy.inputUnitsNormalization, /dimensionless numeric fraction/);

const selectedMatrix = inventory.migrationMatrix.find((row) => row.legacyDecisionId === selectedId);
assert.ok(selectedMatrix, 'selected migration row must exist');
assert.equal(selectedMatrix.scientificPropositionMatch, false);
assert.equal(selectedMatrix.targetMatch, false);
assert.equal(selectedMatrix.metricSemanticMatch, false);
assert.equal(selectedMatrix.unitMatch, false);
assert.equal(selectedMatrix.temporalMatch, false);
assert.equal(selectedMatrix.materialParameterMatch, false);
assert.equal(selectedMatrix.comparabilityStatus, 'SAME_ACTION_DOMAIN_DIFFERENT_SCIENTIFIC_PROPOSITION');

const authority = inventory.adrIrrigationAuthority;
assert.equal(authority.reusableAuthorityInfrastructure, true);
assert.equal(authority.reusableScientificPropositionForSelectedGeoxLegacyRule, false);
assert.equal(authority.source.ref.logicalId, 'source.real-kbs-rge-runtime-v1.protocol');
assert.equal(authority.sourceArtifact.ref.logicalId, 'artifact.real-kbs-rge-runtime-v1.page23');
assert.equal(authority.claim.ref.logicalId, 'claim.real-kbs-rge-runtime-v1.two-day-trigger');
assert.equal(authority.qualifiedKnowledge.ref.logicalId, 'knowledge.real-kbs-rge-runtime-v1.two-day-trigger');
assert.deepEqual(authority.qualifiedKnowledge.semanticPreconditions, [
  { semanticId: 'crop.code', operator: 'EQUALS', value: 'soybean' },
  { semanticId: 'experiment.name', operator: 'EQUALS', value: 'Resource Gradient Experiment (N-rate Study)' }
]);
assert.equal(authority.runtimeComposition.useClass, 'TEST_ONLY');
assert.equal(authority.runtimeComposition.runtimeEnvironment, 'STAGING');
assert.equal(authority.runtimeComposition.rolloutStage, 'SHADOW');
assert.equal(authority.targetContext.promotedFarmFieldZoneIdentity, false);
assert.equal(authority.targetContext.livePlantAvailableWaterState, false);
assert.equal(authority.targetContext.liveTwoDayTriggerState, false);
assert.equal(authority.targetContext.executionAuthority, false);
assert.equal(authority.rightsAndProvenance.planningProtocolNotExecutionEvidence, true);
assert.equal(authority.rightsAndProvenance.scientificCorrectnessProvenByBinding, false);

const kbsBytes = readFileSync(new URL('../gold-protocol-kbs-2015/kbs-2015-irrigation-page23.txt', import.meta.url));
assert.equal(
  sourceContentHash(kbsBytes),
  'sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9'
);

assert.equal(inventory.terminalAdjudication, 'B');
assert.deepEqual(inventory.terminalState, {
  firstAdr3MigrationSubject: 'SELECTED',
  currentDefensibleAuthority: 'ABSENT',
  exactScientificAuthorityGap: 'IDENTIFIED',
  architectureAdjudicationRequired: false,
  readyForShadowDualRunImplementationAuthorization: false
});

const prohibitedExactComparable = inventory.migrationMatrix.filter(
  (row) => row.legacyDecisionId === selectedId && row.comparabilityStatus === 'AUTHORITY_CANDIDATE_EXACTLY_COMPARABLE'
);
assert.equal(prohibitedExactComparable.length, 0);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_3A_IRRIGATION_AUTHORITY_CORRESPONDENCE',
  classification: inventory.classification,
  sourceHeads: inventory.sourceHeads,
  legacySurfaceCount: inventory.legacyInventory.length,
  migrationMatrixRows: inventory.migrationMatrix.length,
  selectedMigrationSubject: selected.legacyDecisionId,
  selectedComparability: selected.currentCandidateStatus,
  currentDefensibleSameDecisionAuthority: selected.currentDefensibleSameDecisionAuthority,
  terminalAdjudication: inventory.terminalAdjudication,
  architectureAdjudicationRequired: inventory.terminalState.architectureAdjudicationRequired,
  readyForShadowDualRunImplementationAuthorization: inventory.terminalState.readyForShadowDualRunImplementationAuthorization,
  authorityEffect: inventory.authorityEffect,
  cutoverAuthorized: inventory.cutoverAuthorized
}, null, 2));
