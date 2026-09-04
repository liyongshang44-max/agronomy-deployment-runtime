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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function sourceCommit() {
  const explicit = process.env.ADR_USABILITY_SOURCE_COMMIT?.trim();
  const value = explicit || run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(value, /^[0-9a-f]{40}$/);
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

function capturePlantingDecisionResult() {
  const captured = [];
  const originalLog = console.log;
  console.log = (...args) => {
    if (args.length === 1 && typeof args[0] === 'string') captured.push(args[0]);
  };
  return import('../real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs')
    .then(() => captured.flatMap((entry) => {
      try { return [JSON.parse(entry)]; }
      catch { return []; }
    }).find((entry) => entry?.milestone === 'REAL_WORLD_HETEROGENEITY_PLANTING_D02_D04_D05_D06_STRICT_POSITIVE'))
    .finally(() => { console.log = originalLog; });
}

const commit = sourceCommit();
const planting = await capturePlantingDecisionResult();
assert.ok(planting, 'real planting D06 world must produce a governed DecisionResult');
assert.equal(planting.ok, true);
assert.equal(planting.decisionResult.disposition, 'ACT');
assert.equal(planting.decisionResult.structuredAction.actionCode, 'SET_SOYBEAN_SEEDING_RATE');
assert.equal(planting.decisionResult.structuredAction.materialParameters[0].value.decimal, '150000');
assert.equal(planting.nonclaims.executionReceiptCreated, false);
assert.equal(planting.nonclaims.outcomeCreated, false);

const consumerScope = Object.freeze({
  tenantId: 'tenant-independent-consumer',
  projectId: 'project-independent-consumer',
  groupId: 'group-independent-consumer'
});
const decisionResultRef = toWireRef(planting.decisionResult.decisionResultRef);
const event = createResultSinkEvent({
  eventId: 'independent-consumer-real-planting-decision-result-1',
  eventType: 'DECISION_RESULT_PUBLISHED',
  authorityRef: decisionResultRef,
  payload: {
    decision_disposition: planting.decisionResult.disposition,
    structured_action: planting.decisionResult.structuredAction,
    human_approval_authority: planting.decisionResult.humanApprovalAuthority,
    machine_execution_authority: planting.decisionResult.machineExecutionAuthority,
    target_binding: {
      mode: 'ADR_TARGET_UNBOUND_TO_GEOX_FIELD',
      reason_code: 'INDEPENDENT_CONSUMER_HAS_NO_GOVERNED_GEOX_FIELD_BINDING'
    }
  }
});

const root = mkdtempSync(join(tmpdir(), 'adr-independent-geox-consumer-'));
try {
  const producerDir = join(root, 'producer');
  const release = buildGeoxConsumerReleaseBundle({ outputDir: producerDir, sourceCommit: commit });
  const verified = verifyGeoxConsumerReleaseBundle({ bundleDir: release.bundleDir, expectedSourceCommit: commit });

  const consumerDir = join(root, 'consumer');
  const consumerBundleDir = join(consumerDir, 'bundle');
  mkdirSync(consumerBundleDir, { recursive: true });
  for (const filename of readdirSync(release.bundleDir)) {
    copyFileSync(join(release.bundleDir, filename), join(consumerBundleDir, filename));
  }

  const portableConsumerSource = readFileSync('acceptance/geox-independent-consumer-usability/consumer.mjs', 'utf8');
  const forbiddenConsumerDependencies = [
    '../../', '../adapters', 'adapters/geox', 'packages/', 'sdks/', 'docs/', 'acceptance/', 'DEC-',
    'node:http', 'node:https', 'fetch(', 'github.com', 'api.github.com'
  ];
  for (const forbidden of forbiddenConsumerDependencies) {
    assert.equal(portableConsumerSource.includes(forbidden), false, `independent consumer must not depend on ${forbidden}`);
  }
  const importSpecifiers = [...portableConsumerSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(importSpecifiers.length > 0);
  for (const specifier of importSpecifiers) {
    assert.ok(
      specifier.startsWith('node:') || specifier.startsWith('@adr/geox-adapter'),
      `independent consumer import ${specifier} is outside the public consumer boundary`
    );
  }

  writeFileSync(join(consumerDir, 'consumer.mjs'), portableConsumerSource, 'utf8');
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({ name: 'independent-geox-consumer', private: true, type: 'module' }, null, 2)}\n`);
  writeFileSync(join(consumerDir, 'governed-decision-result-event.json'), `${JSON.stringify(event, null, 2)}\n`);
  writeFileSync(join(consumerDir, 'qualification-receipt.json'), `${JSON.stringify({
    contractVersion: 'adr.geox-independent-consumer-qualification-receipt.v1',
    sourceCommit: commit,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    releaseStatus: release.releaseStatus,
    expectedDecisionResultRef: decisionResultRef,
    expectedStructuredAction: planting.decisionResult.structuredAction,
    consumerScope
  }, null, 2)}\n`);

  assert.deepEqual(readdirSync(consumerDir).sort(), [
    'bundle',
    'consumer.mjs',
    'governed-decision-result-event.json',
    'package.json',
    'qualification-receipt.json'
  ]);

  const tarballName = readdirSync(consumerBundleDir).find((name) => name.endsWith('.tgz'));
  assert.ok(tarballName);
  const absoluteTarballPath = join(consumerBundleDir, tarballName);
  const install = run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', absoluteTarballPath
  ], {
    cwd: consumerDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
      NODE_PATH: '',
      GITHUB_TOKEN: ''
    }
  });
  assert.match(install.stdout, /added 1 package/);

  const consumed = run(process.execPath, ['consumer.mjs'], {
    cwd: consumerDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE_PATH: '',
      npm_config_offline: 'true',
      GITHUB_TOKEN: ''
    }
  });
  const consumerEvidence = JSON.parse(consumed.stdout.trim());
  assert.equal(consumerEvidence.ok, true);
  assert.equal(consumerEvidence.sourceCommit, commit);
  assert.equal(consumerEvidence.bundleEvidenceHash, verified.evidenceHash);
  assert.equal(consumerEvidence.consumerProjection.field_actionable, false);
  assert.equal(consumerEvidence.consumerProjection.dispatch_authorized, false);
  assert.equal(consumerEvidence.consumerProjection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');
  assert.deepEqual(consumerEvidence.independentConsumerBoundary, {
    adrMonorepoImports: 0,
    adrInternalPackageImports: 0,
    architectureDecisionReads: 0,
    networkReads: 0,
    packagePublicSubpathOnly: true,
    bundleIntegrityVerified: true,
    provenanceBoundToExpectedSourceCommit: true,
    governedMessageConsumed: true,
    expectedGeoxProjectionReproduced: true,
    authorityPromotionRejected: true,
    fieldBindingPromotionRejected: true,
    hiddenFieldInjectionRejected: true
  });

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_INDEPENDENT_CONSUMER_USABILITY_V1',
    sourceCommit: commit,
    sourceWorld: planting.milestone,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    consumerRuntime: 'CLEAN_TEMP_PROJECT_NPM_OFFLINE',
    consumerInputsBeforeInstall: 5,
    adrMonorepoImportsAtConsumerRuntime: 0,
    adrInternalPackageImportsAtConsumerRuntime: 0,
    architectureDecisionReadsAtConsumerRuntime: 0,
    consumerNetworkReads: 0,
    publicPackageImportsOnly: true,
    governedDecisionResultConsumed: true,
    expectedGeoxProjectionReproduced: true,
    authorityPromotionRejected: true,
    fieldBindingPromotionRejected: true,
    hiddenFieldInjectionRejected: true,
    fieldActionable: false,
    dispatchAuthorized: false,
    humanApprovalAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    executionReceiptCreated: false,
    outcomeCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
