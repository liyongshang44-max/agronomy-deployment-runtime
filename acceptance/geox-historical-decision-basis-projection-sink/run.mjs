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

import {
  createAdrHistoricalDecisionBasisProjectionEventForGeox,
  consumeAdrHistoricalDecisionBasisProjectionForGeox
} from '../../adapters/geox/src/historical-decision-basis-projection-sink.mjs';
import { consumeAdrDecisionResultForGeox } from '../../adapters/geox/src/decision-result-sink.mjs';
import { buildGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/build-consumer-release-bundle.mjs';
import { verifyGeoxConsumerReleaseBundle } from '../../adapters/geox/scripts/verify-consumer-release-bundle.mjs';
import { reconstructHistoricalDecisionBasisExitGate } from '../../packages/historical-decision-basis/src/exit-gate.mjs';

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
  const explicit = process.env.ADR_HISTORICAL_BASIS_SINK_SOURCE_COMMIT?.trim();
  const value = explicit || run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(value, /^[0-9a-f]{40}$/);
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const commit = sourceCommit();
const { plantingRuntimeWorld } = await import('../real-kbs-soybean-planting-population-target/run-runtime-composition-v1.mjs');
await import('../real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs');

const { ledger, snapshotStore } = plantingRuntimeWorld;
const decisionResults = ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResults.length, 1, 'qualified World P must expose exactly one historical DecisionResult');

const beforeReadCount = ledger.exportSnapshot().records.length;
const historicalBasis = reconstructHistoricalDecisionBasisExitGate({
  ledger,
  snapshotStore,
  decisionResultRef: decisionResults[0].ref
});
assert.equal(ledger.exportSnapshot().records.length, beforeReadCount, 'projection source reconstruction must remain read-only');
assert.equal(
  historicalBasis.publicationAuditClosure.projectionClass,
  'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_PUBLICATION_AUDIT_PROJECTION'
);
assert.deepEqual(historicalBasis.publicationAuditClosure.decisionResultRef, historicalBasis.decisionResultRef);
assert.equal(historicalBasis.publicationAuditClosure.auditEvent.action, 'PUBLISH_DECISION_RESULT');
assert.equal(
  historicalBasis.exitGateClosure.projectionClass,
  'NONE_NON_AUTHORITY_ADR2_EXIT_GATE_INSPECTION_PROJECTION'
);
assert.deepEqual(
  historicalBasis.exitGateClosure.decisionProblemWorld.decisionProblemRef,
  historicalBasis.decisionProblemRef
);
assert.ok(historicalBasis.exitGateClosure.knowledgeWorlds.length > 0);
assert.ok(historicalBasis.exitGateClosure.applicabilityAssessmentWorlds.length > 0);
assert.ok(historicalBasis.exitGateClosure.runtimeBindingWorlds.length > 0);
assert.ok(historicalBasis.exitGateClosure.executionArtifactWorlds.length > 0);

const event = createAdrHistoricalDecisionBasisProjectionEventForGeox({
  eventId: 'geox-historical-decision-basis-world-p-1',
  historicalBasis
});
assert.equal('authority_ref' in event, false);
assert.match(event.projection_hash, /^sha256:[a-f0-9]{64}$/);
assert.notEqual(event.projection_hash, historicalBasis.basisDigest, 'transport projection hash must not be confused with frozen basisDigest');

const consumerScope = Object.freeze({
  tenantId: 'tenant-geox-historical-audit',
  projectId: 'project-geox-historical-audit',
  groupId: 'group-geox-historical-audit'
});
const sourceProjection = consumeAdrHistoricalDecisionBasisProjectionForGeox({ event, consumerScope });
assert.equal(sourceProjection.projection_hash, event.projection_hash);
assert.equal(sourceProjection.basis_digest, historicalBasis.basisDigest);
assert.deepEqual(sourceProjection.historical_basis, historicalBasis);
assert.equal(sourceProjection.field_actionable, false);
assert.equal(sourceProjection.dispatch_authorized, false);
assert.equal(sourceProjection.decision_result_semantic_hash_verified, true);
assert.equal(sourceProjection.runtime_alternative_provenance_verified, true);
assert.equal(
  sourceProjection.transport_verification,
  'PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED'
);

const tamperedEvent = clone(event);
tamperedEvent.payload.historical_basis.basisDigest = `sha256:${'0'.repeat(64)}`;
assert.notEqual(tamperedEvent.payload.historical_basis.basisDigest, historicalBasis.basisDigest);
assert.throws(
  () => consumeAdrHistoricalDecisionBasisProjectionForGeox({ event: tamperedEvent, consumerScope }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_PROJECTION_HASH_MISMATCH'
);

const promotedBasis = clone(historicalBasis);
promotedBasis.nonclaims.dispatchAuthority = true;
assert.throws(
  () => createAdrHistoricalDecisionBasisProjectionEventForGeox({
    eventId: 'geox-historical-decision-basis-authority-promotion-forbidden',
    historicalBasis: promotedBasis
  }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN'
);

const authoritySmuggledEvent = {
  ...clone(event),
  authority_ref: {
    kind: historicalBasis.decisionResultRef.kind,
    logical_id: historicalBasis.decisionResultRef.logicalId,
    version: historicalBasis.decisionResultRef.version,
    semantic_hash: historicalBasis.decisionResultRef.semanticHash
  }
};
assert.throws(
  () => consumeAdrHistoricalDecisionBasisProjectionForGeox({ event: authoritySmuggledEvent, consumerScope }),
  (error) => error?.code === 'GEOX_HISTORICAL_BASIS_FIELD_FORBIDDEN'
);

const decisionResultTypeProjectionEvent = {
  ...clone(event),
  event_type: 'DECISION_RESULT_PUBLISHED'
};
assert.throws(
  () => consumeAdrDecisionResultForGeox({ event: decisionResultTypeProjectionEvent, consumerScope }),
  (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_REF_REQUIRED',
  'DecisionResult sink must continue rejecting projection_hash identity even under its own event type'
);

const root = mkdtempSync(join(tmpdir(), 'adr-geox-historical-basis-sink-'));
try {
  const producerDir = join(root, 'producer');
  const release = buildGeoxConsumerReleaseBundle({ outputDir: producerDir, sourceCommit: commit });
  const verified = verifyGeoxConsumerReleaseBundle({
    bundleDir: release.bundleDir,
    expectedSourceCommit: commit
  });

  const consumerDir = join(root, 'consumer');
  const consumerBundleDir = join(consumerDir, 'bundle');
  mkdirSync(consumerBundleDir, { recursive: true });
  for (const filename of readdirSync(release.bundleDir)) {
    copyFileSync(join(release.bundleDir, filename), join(consumerBundleDir, filename));
  }

  const portableConsumerSource = readFileSync(
    'acceptance/geox-historical-decision-basis-projection-sink/consumer.mjs',
    'utf8'
  );
  writeFileSync(join(consumerDir, 'consumer.mjs'), portableConsumerSource, 'utf8');
  writeFileSync(
    join(consumerDir, 'package.json'),
    `${JSON.stringify({ name: 'geox-historical-basis-independent-consumer', private: true, type: 'module' }, null, 2)}\n`
  );
  writeFileSync(
    join(consumerDir, 'governed-historical-decision-basis-event.json'),
    `${JSON.stringify(event, null, 2)}\n`
  );
  writeFileSync(join(consumerDir, 'qualification-receipt.json'), `${JSON.stringify({
    contractVersion: 'adr.geox-historical-decision-basis-projection-sink-qualification-receipt.v1',
    sourceCommit: commit,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    releaseStatus: release.releaseStatus,
    expectedProjectionHash: event.projection_hash,
    expectedBasisDigest: historicalBasis.basisDigest,
    expectedDecisionResultRef: historicalBasis.decisionResultRef,
    expectedPublicationAuditEventHash: historicalBasis.publicationAuditClosure.auditEvent.eventHash,
    consumerScope
  }, null, 2)}\n`);

  assert.deepEqual(readdirSync(consumerDir).sort(), [
    'bundle',
    'consumer.mjs',
    'governed-historical-decision-basis-event.json',
    'package.json',
    'qualification-receipt.json'
  ]);

  const tarballName = readdirSync(consumerBundleDir).find((name) => name.endsWith('.tgz'));
  assert.ok(tarballName, 'qualified GEOX consumer bundle must contain npm tarball');
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
  assert.equal(consumerEvidence.projectionHash, event.projection_hash);
  assert.equal(consumerEvidence.basisDigest, historicalBasis.basisDigest);
  assert.deepEqual(consumerEvidence.entryDecisionResultRef, historicalBasis.decisionResultRef);
  assert.equal(consumerEvidence.authorityGraphRefCount, historicalBasis.authorityGraph.allAuthorityRefs.length);
  assert.equal(consumerEvidence.publicationAuditEventHash, historicalBasis.publicationAuditClosure.auditEvent.eventHash);
  assert.equal(consumerEvidence.publicationAuditHashVerified, true);
  assert.equal(consumerEvidence.publicationAuditD06RefClosureVerified, true);
  assert.equal(consumerEvidence.decisionProblemSemanticHashVerified, true);
  assert.equal(consumerEvidence.contextSemanticHashesVerified, true);
  assert.equal(consumerEvidence.retrievalApplicabilitySemanticHashesVerified, true);
  assert.equal(consumerEvidence.runtimeBindingSemanticHashesVerified, true);
  assert.equal(consumerEvidence.decisionRobustnessSemanticHashVerified, true);
  assert.equal(consumerEvidence.executionArtifactSemanticHashesVerified, true);
  assert.equal(consumerEvidence.authorityGraphExitGateClosureVerified, true);
  assert.equal(consumerEvidence.fieldActionable, false);
  assert.equal(consumerEvidence.dispatchAuthorized, false);

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_SINK_V1',
    sourceCommit: commit,
    sourceDecisionResultRef: historicalBasis.decisionResultRef,
    basisDigest: historicalBasis.basisDigest,
    projectionHash: event.projection_hash,
    authorityGraphRefCount: historicalBasis.authorityGraph.allAuthorityRefs.length,
    publicationAuditEventHash: historicalBasis.publicationAuditClosure.auditEvent.eventHash,
    exitGateAuthorityRefCount: consumerEvidence.exitGateAuthorityRefCount,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    packageTarballHash: release.packageTarballHash,
    provenanceHash: release.provenanceHash,
    bundleEvidenceHash: verified.evidenceHash,
    independentConsumerImport: '@adr/geox-adapter/historical-decision-basis-projection-sink',
    independentConsumerRuntime: 'CLEAN_TEMP_PROJECT_NPM_OFFLINE',
    authorityRefUsedAsTransportIdentity: false,
    projectionHashIntegrityVerified: true,
    decisionResultSemanticHashVerified: true,
    runtimeAlternativeProvenanceVerified: true,
    decisionResultPublicationAuditHashVerifiedByIndependentConsumer: true,
    decisionResultPublicationAuditD06RefClosureVerifiedByIndependentConsumer: true,
    adr2ExitGateSemanticsVerifiedByIndependentConsumer: true,
    authorityGraphExitGateClosureVerifiedByIndependentConsumer: true,
    tamperedProjectionRejected: true,
    authorityPromotionRejected: true,
    authorityIdentitySmugglingRejected: true,
    decisionResultSinkBoundaryPreserved: true,
    historicalReconstructionAuthorityWrites: 0,
    fieldActionable: false,
    dispatchAuthorized: false,
    humanApprovalAuthorityCreated: false,
    machineExecutionAuthorityCreated: false,
    executionReceiptCreated: false,
    outcomeCreated: false,
    causalAttributionAuthorityCreated: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}