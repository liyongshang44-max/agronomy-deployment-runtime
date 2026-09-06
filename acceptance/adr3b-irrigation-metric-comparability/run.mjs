import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceContentHash } from '../../packages/source-registry/src/index.mjs';

const adjudication = JSON.parse(readFileSync(new URL('./adjudication.json', import.meta.url), 'utf8'));
const inventory = JSON.parse(readFileSync(new URL('../adr3a-irrigation-authority-correspondence/inventory.json', import.meta.url), 'utf8'));
const excerpt = readFileSync(new URL('../adr3b-irrigation-scientific-authority/csu-mad-root-zone-excerpt.txt', import.meta.url));
const candidateRunUrl = new URL('../adr3b-irrigation-scientific-authority/run.mjs', import.meta.url);
const candidateRunSource = readFileSync(candidateRunUrl, 'utf8');

assert.equal(adjudication.contractVersion, 'adr.adr3b-irrigation-metric-comparability.v1');
assert.equal(adjudication.classification, 'NON_AUTHORITY_MIGRATION_QUALIFICATION_EVIDENCE');
assert.equal(adjudication.authorityEffect, 'NONE');
assert.equal(adjudication.cutoverAuthorized, false);
assert.equal(adjudication.sourceHeads.adr, '77e505e8f9cbfd33983b270d9170c8bbd8c617ae');
assert.equal(adjudication.sourceHeads.geox, inventory.sourceHeads.geox);
assert.equal(adjudication.migrationSubject, 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1');

const selected = inventory.selectedMigrationSubject;
assert.equal(selected.legacyDecisionId, adjudication.migrationSubject);
assert.equal(selected.currentDefensibleSameDecisionAuthority, 'ABSENT');
assert.equal(selected.architectureGap, false);

const legacy = inventory.legacyInventory.find((row) => row.legacyDecisionId === adjudication.migrationSubject);
assert.ok(legacy, 'selected GEOX legacy decision must remain frozen in ADR-3A inventory');
assert.ok(legacy.reachability.includes('ACTIVE_RUNTIME'));
assert.ok(legacy.reachability.includes('COMMERCIAL_REACHABLE'));
assert.equal(legacy.commercialReachability, true);
assert.equal(legacy.formula, adjudication.legacyObservedSemantics.formula);
assert.match(legacy.inputUnitsNormalization, /dimensionless numeric fraction/i);
assert.match(legacy.temporalSemantics, /instantaneous current input/i);
assert.match(legacy.cropTargetScope, /no crop-specific predicate/i);
assert.ok(legacy.requiredInputs.includes('soil_moisture'));
assert.equal(legacy.requiredInputs.some((value) => /root[-_ ]zone.*depletion/i.test(value)), false);
assert.equal(legacy.cropStageDependence, 'none in trigger');

assert.equal(
  sourceContentHash(excerpt),
  'sha256:a5944795e13a1bf13a060ecde68a0dd94e93d42f9c8f635008ec935eb69438bd'
);
const excerptText = excerpt.toString('utf8');
assert.match(excerptText, /amount of water allowed to be depleted from the root zone before irrigation is scheduled/i);
assert.equal(excerptText.includes('0.22'), false);

// Re-run the merged ADR-3B scientific-authority acceptance so this adjudication
// binds to the exact machine-produced candidate refs rather than a handwritten surrogate.
const candidateProcess = spawnSync(process.execPath, [fileURLToPath(candidateRunUrl)], {
  encoding: 'utf8',
  cwd: process.cwd()
});
assert.equal(candidateProcess.status, 0, candidateProcess.stderr || candidateProcess.stdout);
const candidate = JSON.parse(candidateProcess.stdout.trim());
assert.equal(candidate.ok, true);
assert.equal(candidate.milestone, 'ADR_3B_SCIENTIFIC_AUTHORITY_ACQUISITION');
assert.equal(candidate.migrationSubject, adjudication.migrationSubject);
assert.deepEqual(candidate.sourceRef, adjudication.scientificAuthorityCandidate.sourceRef);
assert.deepEqual(candidate.sourceArtifactRef, adjudication.scientificAuthorityCandidate.sourceArtifactRef);
assert.deepEqual(candidate.claimRef, adjudication.scientificAuthorityCandidate.claimRef);
assert.deepEqual(candidate.sourceContextRef, adjudication.scientificAuthorityCandidate.sourceContextRef);
assert.deepEqual(candidate.scientificQualificationDecisionRef, adjudication.scientificAuthorityCandidate.scientificQualificationDecisionRef);
assert.deepEqual(candidate.qualifiedKnowledgeCandidateRef, adjudication.scientificAuthorityCandidate.qualifiedKnowledgeCandidateRef);
assert.equal(candidate.legacyThresholdLaundered, false);
assert.equal(candidate.productionPolicyPublished, false);
assert.equal(candidate.decisionResultPublished, false);
assert.equal(candidate.runtimePublished, false);
assert.equal(candidate.geoxWritePerformed, false);
assert.equal(candidate.cutoverAuthorized, false);
assert.deepEqual(candidate.contextStatus, {
  BIOLOGICAL: 'NOT_REPORTED',
  ENVIRONMENTAL: 'NOT_REPORTED',
  MANAGEMENT: 'NOT_REPORTED',
  OPERATIONAL: 'REPORTED',
  MEASUREMENT: 'REPORTED',
  JURISDICTION_ECONOMIC: 'NOT_REPORTED'
});

// The merged qualification fixture itself freezes the governed candidate semantics.
assert.match(candidateRunSource, /soil_water\.metric/);
assert.match(candidateRunSource, /management allowable depletion/);
assert.match(candidateRunSource, /soil_water\.spatial_support/);
assert.match(candidateRunSource, /root zone/);
assert.match(candidateRunSource, /NO_ABSOLUTE_POINT_VWC_THRESHOLD_AUTHORITY/);
assert.match(candidateRunSource, /REQUIRES_ROOT_ZONE_DEPLETION_SEMANTICS/);

const candidateSemantics = adjudication.scientificAuthorityCandidate.governedScientificSemantics;
assert.equal(candidateSemantics.metric, 'management allowable depletion');
assert.equal(candidateSemantics.spatialSupport, 'root zone');
assert.equal(candidateSemantics.absolutePointVwcThresholdAuthority, false);

const comparison = adjudication.comparabilityAdjudication;
assert.equal(comparison.broadActionDomainMatch, true);
assert.equal(comparison.scientificPropositionMatch, false);
assert.equal(comparison.metricSemanticMatch, false);
assert.equal(comparison.spatialSupportMatch, false);
assert.equal(comparison.unitMatch, false);
assert.equal(comparison.temporalMatch, false);
assert.equal(comparison.targetContextSufficient, false);
assert.equal(comparison.materialParameterMatch, false);
assert.equal(comparison.comparabilityStatus, 'METRIC_SEMANTICS_NOT_EQUIVALENT');
assert.deepEqual(new Set(comparison.reasonCodes), new Set([
  'POINT_SOIL_MOISTURE_FRACTION_IS_NOT_ROOT_ZONE_DEPLETION',
  'ROOT_ZONE_SPATIAL_SUPPORT_NOT_GOVERNED_IN_SELECTED_GEOX_INPUT',
  'DEPLETION_REFERENCE_STATE_NOT_PRESENT_IN_SELECTED_GEOX_INPUT',
  'INSTANTANEOUS_POINT_INPUT_DOES_NOT_ESTABLISH_ROOT_ZONE_DEPLETION_STATE',
  'LEGACY_0_22_HAS_NO_AUTHORITY_IN_SCIENTIFIC_CANDIDATE'
]));

const terminal = adjudication.terminalState;
assert.equal(terminal.sameDecisionAuthorityEstablished, false);
assert.equal(terminal.decisionResultParityAuthorized, false);
assert.equal(terminal.architectureGap, false);
assert.equal(terminal.measurementContextAuthorityGap, true);
assert.equal(terminal.nextFrontier, 'GOVERNED_ROOT_ZONE_SOIL_WATER_STATE_CONTEXT');

// Fail closed against the two prohibited outcomes for this evidence state.
assert.notEqual(comparison.comparabilityStatus, 'AUTHORITY_CANDIDATE_EXACTLY_COMPARABLE');
assert.notEqual(comparison.comparabilityStatus, 'AUTHORITY_CANDIDATE_COMPARABLE_WITH_EXPLICIT_LIMITATIONS');
assert.equal(JSON.stringify(adjudication).includes('decisionResultPublished'), false);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_3B_IRRIGATION_METRIC_COMPARABILITY',
  classification: adjudication.classification,
  migrationSubject: adjudication.migrationSubject,
  scientificAuthorityCandidateRef: adjudication.scientificAuthorityCandidate.qualifiedKnowledgeCandidateRef,
  legacyFormula: legacy.formula,
  candidateMetric: candidateSemantics.metric,
  candidateSpatialSupport: candidateSemantics.spatialSupport,
  comparabilityStatus: comparison.comparabilityStatus,
  sameDecisionAuthorityEstablished: terminal.sameDecisionAuthorityEstablished,
  architectureGap: terminal.architectureGap,
  measurementContextAuthorityGap: terminal.measurementContextAuthorityGap,
  decisionResultParityAuthorized: terminal.decisionResultParityAuthorized,
  geoxWritePerformed: false,
  cutoverAuthorized: false,
  nextFrontier: terminal.nextFrontier
}, null, 2));
