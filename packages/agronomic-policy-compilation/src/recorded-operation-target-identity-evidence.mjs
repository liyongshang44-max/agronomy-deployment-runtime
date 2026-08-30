import { TextDecoder } from 'node:util';

import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';
import {
  AgronomicRecordedOperationTargetIdentityBindingCompilationError,
  normalizeAgronomicRecordedOperationTargetIdentityBinding
} from './recorded-operation-target-identity-contract.mjs';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function requireSourceRegistry(sourceRegistry) {
  if (!sourceRegistry
    || typeof sourceRegistry.resolveArtifact !== 'function'
    || typeof sourceRegistry.resolveSource !== 'function'
    || typeof sourceRegistry.readArtifactBytes !== 'function') {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'SOURCE_REGISTRY_REQUIRED_FOR_TARGET_IDENTITY_REPLAY',
      'target-identity evidence replay requires SourceRegistry exact-artifact access'
    );
  }
}

function replayItem({ sourceRegistry, item }) {
  const source = sourceRegistry.resolveSource(item.sourceRef);
  const artifact = sourceRegistry.resolveArtifact(item.sourceArtifactRef);

  if (!sameAuthorityRef(source.ref, item.sourceRef)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_SOURCE_REF_MISMATCH',
      'identity evidence sourceRef must resolve to the exact Source authority'
    );
  }
  if (!sameAuthorityRef(artifact.ref, item.sourceArtifactRef)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_ARTIFACT_REF_MISMATCH',
      'identity evidence sourceArtifactRef must resolve to the exact SourceArtifact authority'
    );
  }

  const artifactSourceRef = artifact.semanticPayload?.sourceRef;
  if (!artifactSourceRef || !sameAuthorityRef(artifactSourceRef, source.ref)) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_SOURCE_ARTIFACT_WORLD_MISMATCH',
      'identity evidence SourceArtifact must belong to the exact identity Source'
    );
  }

  if (artifact.semanticPayload?.contentHash !== item.sourceArtifactContentHash) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_ARTIFACT_CONTENT_HASH_MISMATCH',
      'identity evidence sourceArtifactContentHash must match exact SourceArtifact authority'
    );
  }

  const bytes = sourceRegistry.readArtifactBytes(artifact.ref);
  const { start, endExclusive, evidenceHash } = item.sourceLocator;
  if (start < 0 || endExclusive <= start || endExclusive > bytes.byteLength) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_BYTE_RANGE_OUT_OF_BOUNDS',
      `identity evidence BYTE_RANGE ${start}:${endExclusive} exceeds retained artifact length ${bytes.byteLength}`
    );
  }

  const selected = bytes.subarray(start, endExclusive);
  const actualEvidenceHash = sourceContentHash(selected);
  if (actualEvidenceHash !== evidenceHash) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_EVIDENCE_HASH_MISMATCH',
      'identity evidence hash does not match exact replayed BYTE_RANGE bytes'
    );
  }

  let text;
  try {
    text = UTF8_DECODER.decode(selected);
  } catch (error) {
    throw new AgronomicRecordedOperationTargetIdentityBindingCompilationError(
      'TARGET_IDENTITY_EVIDENCE_NOT_UTF8',
      `v1 identity BYTE_RANGE evidence must be valid UTF-8 text: ${error?.message ?? 'decode failure'}`
    );
  }

  return deepFreeze({
    evidenceRole: item.evidenceRole,
    source,
    artifact,
    locator: item.sourceLocator,
    evidenceHash: actualEvidenceHash,
    byteLength: selected.byteLength,
    text
  });
}

export function replayAgronomicRecordedOperationTargetIdentityEvidence({
  sourceRegistry,
  binding
}) {
  requireSourceRegistry(sourceRegistry);
  const normalized =
    normalizeAgronomicRecordedOperationTargetIdentityBinding(binding);

  return deepFreeze(
    normalized.identityEvidence.map((item) =>
      replayItem({ sourceRegistry, item })
    )
  );
}
