import { TextDecoder } from 'node:util';

import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';
import {
  AgronomicRecordedOperationSemanticNormalizationCompilationError,
  normalizeAgronomicRecordedOperationSemanticNormalization
} from './recorded-operation-semantic-normalization-contract.mjs';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function requireSourceRegistry(sourceRegistry) {
  if (!sourceRegistry
    || typeof sourceRegistry.resolveArtifact !== 'function'
    || typeof sourceRegistry.resolveSource !== 'function'
    || typeof sourceRegistry.readArtifactBytes !== 'function') {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SOURCE_REGISTRY_REQUIRED_FOR_SEMANTIC_NORMALIZATION_REPLAY',
      'semantic-normalization evidence replay requires SourceRegistry exact-artifact access'
    );
  }
}

function replayItem({ sourceRegistry, item }) {
  const source = sourceRegistry.resolveSource(item.sourceRef);
  const artifact = sourceRegistry.resolveArtifact(item.sourceArtifactRef);

  if (!sameAuthorityRef(source.ref, item.sourceRef)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_SOURCE_REF_MISMATCH',
      'semantic evidence sourceRef must resolve to the exact Source authority'
    );
  }
  if (!sameAuthorityRef(artifact.ref, item.sourceArtifactRef)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_ARTIFACT_REF_MISMATCH',
      'semantic evidence sourceArtifactRef must resolve to the exact SourceArtifact authority'
    );
  }

  const artifactSourceRef = artifact.semanticPayload?.sourceRef;
  if (!artifactSourceRef || !sameAuthorityRef(artifactSourceRef, source.ref)) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_SOURCE_ARTIFACT_WORLD_MISMATCH',
      'semantic evidence SourceArtifact must belong to the exact semantic Source'
    );
  }

  if (artifact.semanticPayload?.contentHash !== item.sourceArtifactContentHash) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_ARTIFACT_CONTENT_HASH_MISMATCH',
      'semantic evidence sourceArtifactContentHash must match exact SourceArtifact authority'
    );
  }

  const bytes = sourceRegistry.readArtifactBytes(artifact.ref);
  const { start, endExclusive, evidenceHash } = item.sourceLocator;
  if (start < 0 || endExclusive <= start || endExclusive > bytes.byteLength) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_BYTE_RANGE_OUT_OF_BOUNDS',
      `semantic evidence BYTE_RANGE ${start}:${endExclusive} exceeds retained artifact length ${bytes.byteLength}`
    );
  }

  const selected = bytes.subarray(start, endExclusive);
  const actualEvidenceHash = sourceContentHash(selected);
  if (actualEvidenceHash !== evidenceHash) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_EVIDENCE_HASH_MISMATCH',
      'semantic evidence hash does not match exact replayed BYTE_RANGE bytes'
    );
  }

  let text;
  try {
    text = UTF8_DECODER.decode(selected);
  } catch (error) {
    throw new AgronomicRecordedOperationSemanticNormalizationCompilationError(
      'SEMANTIC_NORMALIZATION_EVIDENCE_NOT_UTF8',
      `v1 semantic BYTE_RANGE evidence must be valid UTF-8 text: ${error?.message ?? 'decode failure'}`
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

export function replayAgronomicRecordedOperationSemanticNormalizationEvidence({
  sourceRegistry,
  normalization
}) {
  requireSourceRegistry(sourceRegistry);
  const normalized =
    normalizeAgronomicRecordedOperationSemanticNormalization(normalization);

  return deepFreeze(
    normalized.semanticEvidence.map((item) =>
      replayItem({ sourceRegistry, item })
    )
  );
}
