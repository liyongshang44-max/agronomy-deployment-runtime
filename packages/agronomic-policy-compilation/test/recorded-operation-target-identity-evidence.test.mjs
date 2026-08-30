import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
  deriveAgronomicRecordedOperationSourceBackedTargetId,
  replayAgronomicRecordedOperationTargetIdentityEvidence
} from '../src/index.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';
import { audit, createEnvironment } from '../../../acceptance/derived-knowledge/fixture.mjs';

function ref(kind, logicalId, char) {
  return {
    kind,
    logicalId,
    version: '1',
    semanticHash: `sha256:${char.repeat(64)}`
  };
}

function setup() {
  const env = createEnvironment();
  const bytes = Buffer.from(
    'prefix\nSERF | Southeast Research and Demonstration Farm | Iowa State University\nsuffix\n',
    'utf8'
  );
  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.test.target-identity',
    version: '1',
    sourceType: 'OTHER',
    title: 'Target identity replay test source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator: 'urn:test:target-identity',
    rights: { artifactLicense: 'TEST_FIXTURE' },
    audit: audit('evt-target-identity-source', 'source-admin')
  });
  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.test.target-identity',
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'text/plain',
    materializationIdentity: 'test:target-identity',
    acquisition: {
      method: 'REPOSITORY_RETAINED_TEST_FIXTURE',
      acquiredAt: '2026-08-30T18:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: false,
      artifactLicense: { spdx: 'NONE', redistributionAllowed: false }
    },
    audit: audit('evt-target-identity-artifact', 'source-admin')
  });
  const start = bytes.indexOf(Buffer.from('SERF', 'utf8'));
  const endExclusive = bytes.indexOf(Buffer.from('\nsuffix', 'utf8'));
  const selected = bytes.subarray(start, endExclusive);
  return { env, bytes, source, artifact, start, endExclusive, selected };
}

function binding(world) {
  const namespaceRef = ref('Source', 'source.parent.operations', 'a');
  const identifier = { name: 'siteid', value: 'SERF' };
  const targetId = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef,
    identifierName: identifier.name,
    identifierValue: identifier.value,
    granularity: 'FARM'
  });
  const evidence = (evidenceRole) => ({
    evidenceRole,
    sourceRef: world.source.ref,
    sourceArtifactRef: world.artifact.ref,
    sourceArtifactContentHash: world.artifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: world.start,
      endExclusive: world.endExclusive,
      evidenceHash: sourceContentHash(world.selected)
    }
  });
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.test.serf',
    parentOccurrenceCompilationRef: ref(
      'AgronomicRecordedOperationOccurrenceCompilation',
      'parent.occurrence',
      'b'
    ),
    sourceNativeSubject: identifier,
    sourceBackedTargetIdentity: {
      namespaceRef,
      granularity: 'FARM',
      targetId
    },
    identityEvidence: [
      evidence('SOURCE_NATIVE_IDENTIFIER_CONTEXT'),
      evidence('TARGET_GRANULARITY_MEANING')
    ],
    applicability: {
      appliesToOccurrenceSourceRef: namespaceRef,
      appliesToSourceNativeIdentifier: identifier
    },
    transformationRationale:
      'Replay exact target identity source bytes only.'
  };
}

test('replays each identity evidence role from exact retained bytes', () => {
  const world = setup();
  const replayed = replayAgronomicRecordedOperationTargetIdentityEvidence({
    sourceRegistry: world.env.sourceRegistry,
    binding: binding(world)
  });
  assert.equal(replayed.length, 2);
  for (const item of replayed) {
    assert.equal(item.text, world.selected.toString('utf8'));
    assert.equal(item.evidenceHash, sourceContentHash(world.selected));
  }
});

test('caller-supplied identity evidence hash cannot override exact replay', () => {
  const world = setup();
  const value = binding(world);
  value.identityEvidence[0].sourceLocator.evidenceHash =
    `sha256:${'f'.repeat(64)}`;
  assert.throws(
    () => replayAgronomicRecordedOperationTargetIdentityEvidence({
      sourceRegistry: world.env.sourceRegistry,
      binding: value
    }),
    /hash does not match exact replayed/
  );
});

test('SourceArtifact content hash drift fails before identity review', () => {
  const world = setup();
  const value = binding(world);
  value.identityEvidence[0].sourceArtifactContentHash =
    `sha256:${'e'.repeat(64)}`;
  assert.throws(
    () => replayAgronomicRecordedOperationTargetIdentityEvidence({
      sourceRegistry: world.env.sourceRegistry,
      binding: value
    }),
    /sourceArtifactContentHash must match/
  );
});

test('Source and SourceArtifact must close to the same exact identity world', () => {
  const world = setup();
  const otherSource = world.env.sourceRegistry.registerSource({
    logicalId: 'source.test.target-identity.other',
    version: '1',
    sourceType: 'OTHER',
    title: 'Other identity source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator: 'urn:test:target-identity:other',
    rights: { artifactLicense: 'TEST_FIXTURE' },
    audit: audit('evt-target-identity-other-source', 'source-admin')
  });
  const value = binding(world);
  value.identityEvidence[0].sourceRef = otherSource.ref;
  assert.throws(
    () => replayAgronomicRecordedOperationTargetIdentityEvidence({
      sourceRegistry: world.env.sourceRegistry,
      binding: value
    }),
    /must belong to the exact identity Source/
  );
});

test('identity BYTE_RANGE bounds are revalidated against retained bytes', () => {
  const world = setup();
  const value = binding(world);
  value.identityEvidence[0].sourceLocator.endExclusive =
    world.bytes.byteLength + 1;
  assert.throws(
    () => replayAgronomicRecordedOperationTargetIdentityEvidence({
      sourceRegistry: world.env.sourceRegistry,
      binding: value
    }),
    /exceeds retained artifact length/
  );
});

test('v1 identity evidence must be valid UTF-8 text', () => {
  const env = createEnvironment();
  const bytes = Buffer.from([0xff, 0xfe, 0xfd]);
  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.test.target-identity.invalid-utf8',
    version: '1',
    sourceType: 'OTHER',
    title: 'Invalid UTF-8 identity source',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator: 'urn:test:target-identity:invalid-utf8',
    rights: { artifactLicense: 'TEST_FIXTURE' },
    audit: audit('evt-target-identity-invalid-utf8-source', 'source-admin')
  });
  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.test.target-identity.invalid-utf8',
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'application/octet-stream',
    materializationIdentity: 'test:target-identity:invalid-utf8',
    acquisition: {
      method: 'REPOSITORY_RETAINED_TEST_FIXTURE',
      acquiredAt: '2026-08-30T18:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: false,
      artifactLicense: { spdx: 'NONE', redistributionAllowed: false }
    },
    audit: audit('evt-target-identity-invalid-utf8-artifact', 'source-admin')
  });
  const world = {
    source,
    artifact,
    start: 0,
    endExclusive: bytes.byteLength,
    selected: bytes
  };
  assert.throws(
    () => replayAgronomicRecordedOperationTargetIdentityEvidence({
      sourceRegistry: env.sourceRegistry,
      binding: binding(world)
    }),
    /must be valid UTF-8/
  );
});
