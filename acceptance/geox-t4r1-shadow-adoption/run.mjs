import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createResultSinkEvent } from '../../sdks/typescript/src/index.mjs';
import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';
import {
  GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '../../adapters/geox/src/target-correspondence-profile-registry.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function exactCommit(envName) {
  const value = process.env[envName]?.trim();
  assert.match(value ?? '', /^[0-9a-f]{40}$/, `${envName} must be an exact Git SHA`);
  return value;
}

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

async function captureSameTargetDecisionResult() {
  const captured = [];
  const originalLog = console.log;
  console.log = (...args) => {
    if (args.length === 1 && typeof args[0] === 'string') captured.push(args[0]);
  };
  try {
    await import('../real-kbs-t4r1-corn-hybrid-population-decision/run-decision-result-v1.mjs');
  } finally {
    console.log = originalLog;
  }
  return captured.flatMap((entry) => {
    try { return [JSON.parse(entry)]; }
    catch { return []; }
  }).find((entry) => entry?.milestone === 'GEOX_T4R1_SAME_TARGET_CORN_DECISION_D02_D04_D05_D06');
}

const adrSourceCommit = exactCommit('ADR_SHADOW_SOURCE_COMMIT');
const geoxSourceCommit = exactCommit('GEOX_SHADOW_SOURCE_COMMIT');
const sameTarget = await captureSameTargetDecisionResult();
assert.ok(sameTarget, 'same-target D06 world must produce the qualified DecisionResult');
assert.equal(sameTarget.ok, true);
assert.equal(sameTarget.decisionResult.disposition, 'ACT');
assert.equal(sameTarget.decisionResult.structuredAction.actionCode, 'SET_CORN_SEEDING_RATE_RANGE');
assert.equal(sameTarget.nonclaims.geoxFieldActionabilityGranted, false);
assert.equal(sameTarget.nonclaims.decisionResultIsHumanApprovalAuthority, false);
assert.equal(sameTarget.nonclaims.decisionResultIsMachineExecutionAuthority, false);
assert.equal(sameTarget.nonclaims.executionReceiptCreated, false);
assert.equal(sameTarget.nonclaims.outcomeCreated, false);

const profile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(profile);
assert.equal(profile.replayableResolverSupported, true);
assert.equal(profile.provider.treatment_code, sameTarget.sameTargetConvergence.providerTarget.treatment);
assert.equal(profile.provider.replicate_code, sameTarget.sameTargetConvergence.providerTarget.replicate);
assert.equal(profile.provider.crop_code, sameTarget.sameTargetConvergence.providerTarget.crop);
assert.equal(profile.provider.hybrid_code, sameTarget.sameTargetConvergence.providerTarget.hybrid);
assert.equal(profile.provider.planting_observation_id, sameTarget.sameTargetConvergence.providerTarget.plantingObservationId);
assert.equal(profile.geox.field_id, sameTarget.sameTargetConvergence.geoxTarget.field_id);
assert.equal(profile.geox.season_id, sameTarget.sameTargetConvergence.geoxTarget.season_id);
assert.equal(profile.geox.zone_id, sameTarget.sameTargetConvergence.geoxTarget.zone_id);

const consumerScope = Object.freeze({
  tenantId: 'tenant-geox-shadow-adoption',
  projectId: 'project-geox-shadow-adoption',
  groupId: 'group-geox-shadow-adoption'
});
const decisionResultRef = toWireRef(sameTarget.decisionResult.decisionResultRef);
const decisionResultEvent = createResultSinkEvent({
  eventId: 'geox-t4r1-same-target-shadow-decision-result-1',
  eventType: 'DECISION_RESULT_PUBLISHED',
  authorityRef: decisionResultRef,
  payload: {
    decision_disposition: sameTarget.decisionResult.disposition,
    structured_action: sameTarget.decisionResult.structuredAction,
    human_approval_authority: sameTarget.decisionResult.humanApprovalAuthority,
    machine_execution_authority: sameTarget.decisionResult.machineExecutionAuthority,
    target_binding: {
      mode: 'ADR_TARGET_UNBOUND_TO_GEOX_FIELD',
      reason_code: 'SAME_TARGET_CORRESPONDENCE_IS_NOT_IDENTITY_OR_FIELD_ACTIONABILITY_AUTHORITY'
    }
  }
});

const root = mkdtempSync(join(tmpdir(), 'adr-geox-t4r1-shadow-adoption-'));
try {
  const producerDir = join(root, 'producer');
  const release = buildGeoxConsumerReleaseBundle({ outputDir: producerDir, sourceCommit: adrSourceCommit });
  const verified = verifyGeoxConsumerReleaseBundle({
    bundleDir: release.bundleDir,
    expectedSourceCommit: adrSourceCommit
  });
  assert.equal(release.packageName, '@adr/geox-adapter');
  assert.equal(release.packageVersion, '0.1.0-development');
  assert.equal(release.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');

  const consumerDir = join(root, 'consumer');
  const bundleDir = join(consumerDir, 'bundle');
  const durableRoot = join(consumerDir, 'durable-authority-store');
  mkdirSync(bundleDir, { recursive: true });
  for (const filename of readdirSync(release.bundleDir)) {
    copyFileSync(join(release.bundleDir, filename), join(bundleDir, filename));
  }

  const consumerSource = readFileSync('acceptance/geox-t4r1-shadow-adoption/consumer.mjs', 'utf8');
  const forbiddenConsumerTokens = [
    '../../', '../adapters', 'adapters/geox', 'packages/', 'sdks/', 'docs/', 'acceptance/', 'DEC-',
    'agronomy_agent', 'decision_recommendation_v1', 'recommendation_v1', 'approval_request_v1',
    'operation_plan_v1', 'postgres', 'pg.Pool', 'INSERT INTO', 'UPDATE ', 'DELETE FROM'
  ];
  for (const forbidden of forbiddenConsumerTokens) {
    assert.equal(consumerSource.includes(forbidden), false, `shadow consumer must not contain forbidden dependency/write token ${forbidden}`);
  }
  const importSpecifiers = [...consumerSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(importSpecifiers.length > 0);
  for (const specifier of importSpecifiers) {
    assert.ok(
      specifier.startsWith('node:') || specifier.startsWith('@adr/geox-adapter'),
      `shadow consumer import ${specifier} is outside the qualified package/read-only boundary`
    );
  }

  const input = Object.freeze({
    contractVersion: 'adr.geox-t4r1-shadow-adoption-input.v1',
    adrSourceCommit,
    geoxSourceCommit,
    resolvedAt: '2026-09-05T11:45:00.000Z',
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    profileRegistryVersion: GEOX_TARGET_CORRESPONDENCE_PROFILE_REGISTRY_VERSION,
    profileRelation: GEOX_TARGET_CORRESPONDENCE_RELATION,
    consumerScope,
    decisionResultRef,
    decisionResultDisposition: sameTarget.decisionResult.disposition,
    structuredAction: sameTarget.decisionResult.structuredAction,
    decisionResultEvent
  });

  writeFileSync(join(consumerDir, 'consumer.mjs'), consumerSource, 'utf8');
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'geox-t4r1-shadow-adoption-consumer',
    private: true,
    type: 'module'
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(consumerDir, 'shadow-input.json'), `${JSON.stringify(input, null, 2)}\n`, 'utf8');

  const tarballName = readdirSync(bundleDir).find((name) => name.endsWith('.tgz'));
  assert.ok(tarballName, 'release bundle must contain the installable package tarball');
  const install = run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', join(bundleDir, tarballName)
  ], {
    cwd: consumerDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
      NODE_PATH: ''
    }
  });
  assert.match(install.stdout, /added 1 package/);

  const consumed = run(process.execPath, ['consumer.mjs', 'shadow-input.json', durableRoot], {
    cwd: consumerDir,
    env: {
      ...process.env,
      NODE_PATH: '',
      npm_config_update_notifier: 'false'
    }
  });
  const evidence = JSON.parse(consumed.stdout.trim());
  assert.equal(evidence.ok, true);
  assert.equal(evidence.milestone, 'ADR_GEOX_T4R1_SAME_TARGET_SHADOW_ADOPTION_V1');
  assert.equal(evidence.shadowEvidence.adrArtifact.sourceCommit, adrSourceCommit);
  assert.equal(evidence.shadowEvidence.geoxAuthority.resolvedCommitSha, geoxSourceCommit);
  assert.equal(evidence.shadowEvidence.geoxAuthority.replayClass, 'EXACT');
  assert.equal(evidence.shadowEvidence.geoxAuthority.correspondenceRelation, GEOX_TARGET_CORRESPONDENCE_RELATION);
  assert.equal(evidence.shadowEvidence.decisionResult.authorityRef.semantic_hash, decisionResultRef.semantic_hash);
  assert.equal(evidence.shadowEvidence.decisionProjection.field_actionable, false);
  assert.equal(evidence.shadowEvidence.decisionProjection.dispatch_authorized, false);
  assert.equal(evidence.shadowEvidence.nativeComparator.comparison.status, 'NOT_APPLICABLE');
  assert.equal(evidence.shadowEvidence.nativeComparator.comparison.reasonCode, 'DOMAIN_NOT_COMPARABLE');
  assert.equal(evidence.shadowEvidence.nativeComparator.comparison.nativeEngineInvoked, false);
  assert.equal(evidence.shadowEvidence.nativeComparator.comparison.syntheticActionTranslationCreated, false);
  assert.deepEqual(
    evidence.shadowEvidence.nativeComparator.comparison.nativeRegisteredActionTypes,
    ['INSPECT', 'IRRIGATE']
  );
  assert.deepEqual(evidence.shadowEvidence.authorityCeiling, {
    canonicalRecommendationCreated: false,
    recommendationCreated: false,
    approvalRequestCreated: false,
    operationPlanCreated: false,
    taskCreated: false,
    dispatchCreated: false,
    executionReceiptCreated: false,
    machineExecutionAuthorityCreated: false,
    fieldActionabilityGranted: false,
    identityEqualityClaimed: false,
    geometryEqualityClaimed: false
  });

  console.log(JSON.stringify({
    ok: true,
    milestone: 'ADR_GEOX_T4R1_SAME_TARGET_SHADOW_ADOPTION_QUALIFIED_V1',
    adrSourceCommit,
    geoxSourceCommit,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    installMode: 'CLEAN_TEMP_PROJECT_LOCAL_RELEASE_BUNDLE_TARBALL_NPM_OFFLINE',
    sameTargetDecisionResultRef: decisionResultRef,
    correspondenceRelation: GEOX_TARGET_CORRESPONDENCE_RELATION,
    resolvedGeoxTarget: evidence.shadowEvidence.geoxAuthority.geoxTarget,
    exactAuthorityReplay: true,
    comparisonStatus: evidence.shadowEvidence.nativeComparator.comparison.status,
    comparisonReasonCode: evidence.shadowEvidence.nativeComparator.comparison.reasonCode,
    nativeEngineInvoked: false,
    syntheticActionTranslationCreated: false,
    independentShadowEvidenceContract: evidence.shadowEvidence.contractVersion,
    consumerRepositoryInternalImports: 0,
    geoxWriterImports: 0,
    canonicalGeoxWrites: 0,
    fieldActionabilityGranted: false,
    humanApprovalAuthorityGranted: false,
    dispatchAuthorityGranted: false,
    machineExecutionAuthorityGranted: false,
    executionReceiptCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
