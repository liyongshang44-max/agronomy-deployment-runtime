import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGeoxConsumerArtifact } from '../../adapters/geox/scripts/build-consumer-artifact.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

const root = mkdtempSync(join(tmpdir(), 'adr-geox-consumer-artifact-'));
try {
  const buildA = buildGeoxConsumerArtifact({ outputDir: join(root, 'build-a') });
  const buildB = buildGeoxConsumerArtifact({ outputDir: join(root, 'build-b') });

  assert.equal(buildA.packageName, '@adr/geox-adapter');
  assert.equal(buildA.packageVersion, '0.1.0-development');
  assert.equal(buildA.manifestContractVersion, 'adr.geox-consumer-artifact-build.v1');
  assert.equal(buildA.tarballHash, buildB.tarballHash, 'identical source must build byte-identical tarballs');
  assert.equal(buildA.bundledDependency.contentHash, buildB.bundledDependency.contentHash);
  assert.ok(buildA.rewriteCount >= 4, 'all repository-internal SDK imports must be rewritten in artifact staging');
  assert.equal(buildA.authorityClaim, 'NONE_PACKAGING_ONLY_NO_NEW_ADR_OR_GEOX_AUTHORITY');

  const consumerDir = join(root, 'consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({
    name: 'adr-geox-artifact-acceptance-consumer',
    private: true,
    type: 'module'
  }, null, 2));

  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--offline',
    buildA.tarballPath
  ], {
    cwd: consumerDir,
    env: {
      ...process.env,
      npm_config_update_notifier: 'false'
    }
  });

  const consumerScript = `
import assert from 'node:assert/strict';
import {
  GEOX_FIRST_PARTY_ADAPTER_VERSION,
  createGeoxTargetContextProvider
} from '@adr/geox-adapter';
import { GEOX_DECISION_RESULT_SINK_VERSION } from '@adr/geox-adapter/decision-result-sink';
import { GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION } from '@adr/geox-adapter/durable-target-authority-store';
import {
  GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION,
  GeoxTargetAuthoritySnapshotStore
} from '@adr/geox-adapter/target-authority-resolver';
import { GEOX_TARGET_CORRESPONDENCE_VERSION } from '@adr/geox-adapter/target-correspondence';
import { GEOX_TARGET_IDENTITY_TOKEN_VERSION } from '@adr/geox-adapter/target-identity-token';

assert.equal(GEOX_FIRST_PARTY_ADAPTER_VERSION, 'adr.geox-adapter.v1');
assert.equal(GEOX_DECISION_RESULT_SINK_VERSION, 'adr.geox-decision-result-sink.v1');
assert.equal(GEOX_DURABLE_TARGET_AUTHORITY_STORE_VERSION, 'adr.geox-durable-target-authority-store.v1');
assert.equal(GEOX_TARGET_AUTHORITY_RESOLUTION_RECEIPT_VERSION, 'adr.geox-target-authority-resolution-receipt.v1');
assert.equal(GEOX_TARGET_CORRESPONDENCE_VERSION, 'adr.geox-target-correspondence.v1');
assert.equal(GEOX_TARGET_IDENTITY_TOKEN_VERSION, 'adr.geox-target-identity-token.v1');

const snapshotStore = new GeoxTargetAuthoritySnapshotStore();
const snapshotHash = snapshotStore.retain(Buffer.from('artifact-snapshot-proof', 'utf8'));
assert.equal(snapshotStore.get(snapshotHash).toString('utf8'), 'artifact-snapshot-proof');

const targetScope = Object.freeze({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  groupId: 'group-a',
  geoxFieldId: 'geox-field-17',
  adrGeometryRef: 'field-1',
  seasonId: 'season-2026'
});
const provider = createGeoxTargetContextProvider({ targetScope });
const translated = provider.cropContextToMessage({
  fact_id: 'cropctx-geox-artifact-17',
  occurred_at: '2026-08-20T09:30:00Z',
  retrieved_at: '2026-08-20T09:55:00Z',
  source: 'crop_context_service',
  record_json: {
    type: 'crop_context_v1',
    schema_version: '1',
    payload: {
      tenant_id: targetScope.tenantId,
      project_id: targetScope.projectId,
      group_id: targetScope.groupId,
      field_id: targetScope.geoxFieldId,
      season_id: targetScope.seasonId,
      status: 'PLANTED_CONFIRMED',
      crop_code: 'maize',
      source: 'USER_DECLARED'
    }
  }
});
assert.equal(translated.message.contract_version, 'adr.integration-message.v1');
assert.equal(translated.message.role, 'CONTEXT_PROVIDER');
assert.equal(translated.message.message_type, 'CONTEXT_DATUM_AVAILABLE');
assert.equal(translated.message.payload.contract_version, 'adr.context-datum.v1');
assert.equal(translated.message.payload.semantic_id, 'crop.code');
assert.deepEqual(translated.message.payload.value, { type: 'CATEGORY', category: 'maize' });
assert.equal(translated.message.payload.source.provider_id, 'GEOX');
assert.equal(translated.translationAudit.authority_claim, 'NONE_TRANSLATION_AUDIT_ONLY');

console.log(JSON.stringify({
  ok: true,
  packageName: '@adr/geox-adapter',
  packageVersion: '0.1.0-development',
  rootImport: true,
  subpathImports: 5,
  realCropTranslation: true,
  authorityClaim: translated.translationAudit.authority_claim
}));
`;
  const consumerScriptPath = join(consumerDir, 'consume.mjs');
  writeFileSync(consumerScriptPath, consumerScript, 'utf8');
  const consumed = run(process.execPath, [consumerScriptPath], {
    cwd: consumerDir,
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
      npm_config_offline: 'true'
    }
  });
  const isolated = JSON.parse(consumed.stdout.trim());
  assert.equal(isolated.ok, true);
  assert.equal(isolated.packageName, '@adr/geox-adapter');
  assert.equal(isolated.rootImport, true);
  assert.equal(isolated.subpathImports, 5);
  assert.equal(isolated.realCropTranslation, true);
  assert.equal(isolated.authorityClaim, 'NONE_TRANSLATION_AUDIT_ONLY');

  console.log(JSON.stringify({
    ok: true,
    milestone: 'PRODUCTIZATION_GEOX_CONSUMER_ARTIFACT_PACKAGE_V1',
    packageName: buildA.packageName,
    packageVersion: buildA.packageVersion,
    deterministicTarballHash: buildA.tarballHash,
    deterministicBuild: true,
    installMode: 'EMPTY_PROJECT_LOCAL_TARBALL_NPM_OFFLINE',
    packageRootImport: true,
    packageSubpathImports: 5,
    realConsumerExecution: true,
    bundledIntegrationContractsHash: buildA.bundledDependency.contentHash,
    sourceFiles: Object.keys(buildA.sourceHashes).length,
    adrCoreModified: false,
    genericSdkModified: false,
    publicRegistryPublicationAuthorized: false,
    newArchitectureDecisionRequired: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
