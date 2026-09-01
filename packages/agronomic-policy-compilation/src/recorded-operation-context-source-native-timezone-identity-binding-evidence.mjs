import { TextDecoder } from 'node:util';

import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { sourceContentHash } from '../../source-registry/src/index.mjs';
import {
  AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError,
  normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding
} from './recorded-operation-context-source-native-timezone-identity-binding-contract.mjs';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

const EXPECTED_EVIDENCE = deepFreeze({
  DECAGON_SITE_TIMEZONE_IDENTITY: {
    originLocator:
      'https://github.com/isudatateam/datateam/blob/db36925e79a8858968ac846bb0713162372cd0ec/src/isudatateam/cscap/plot_decagon.py',
    materializationIdentity:
      'github-blob:db36925e79a8858968ac846bb0713162372cd0ec',
    start: 1170,
    endExclusive: 1301,
    text:
      '    tzname = (\n'
      + '        "America/Chicago"\n'
      + '        if uniqueid in ["ISUAG", "SERF", "GILMORE"]\n'
      + '        else "America/New_York"\n'
      + '    )\n'
  },
  WATERTABLE_SITE_TIMEZONE_IDENTITY: {
    originLocator:
      'https://github.com/isudatateam/datateam/blob/9d9f7e343acfe996f155a007fd0004b60e4bd606/src/isudatateam/cscap/plot_watertable.py',
    materializationIdentity:
      'github-blob:9d9f7e343acfe996f155a007fd0004b60e4bd606',
    start: 2106,
    endExclusive: 2237,
    text:
      '    tzname = (\n'
      + '        "America/Chicago"\n'
      + '        if uniqueid in ["ISUAG", "SERF", "GILMORE"]\n'
      + '        else "America/New_York"\n'
      + '    )\n'
  }
});

function requireSourceRegistry(sourceRegistry) {
  if (!sourceRegistry
    || typeof sourceRegistry.resolveArtifact !== 'function'
    || typeof sourceRegistry.resolveSource !== 'function'
    || typeof sourceRegistry.readArtifactBytes !== 'function') {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_REGISTRY_REQUIRED_FOR_SOURCE_NATIVE_TIMEZONE_IDENTITY_REPLAY',
      'source-native timezone identity evidence replay requires exact SourceRegistry artifact access'
    );
  }
}

function replayItem({ sourceRegistry, item }) {
  const expected = EXPECTED_EVIDENCE[item.evidenceRole];
  if (!expected) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_ROLE',
      `unsupported timezone evidence role ${item.evidenceRole}`
    );
  }

  const source = sourceRegistry.resolveSource(item.sourceRef);
  const artifact = sourceRegistry.resolveArtifact(item.sourceArtifactRef);

  if (!sameAuthorityRef(source.ref, item.sourceRef)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_SOURCE_REF_MISMATCH',
      'timezone evidence sourceRef must resolve to exact Source authority'
    );
  }
  if (!sameAuthorityRef(artifact.ref, item.sourceArtifactRef)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_ARTIFACT_REF_MISMATCH',
      'timezone evidence sourceArtifactRef must resolve to exact SourceArtifact authority'
    );
  }
  if (!artifact.semanticPayload?.sourceRef
      || !sameAuthorityRef(artifact.semanticPayload.sourceRef, source.ref)) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_SOURCE_ARTIFACT_WORLD_MISMATCH',
      'timezone evidence SourceArtifact must belong to exact timezone evidence Source'
    );
  }
  if (artifact.semanticPayload?.contentHash !== item.sourceArtifactContentHash) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_ARTIFACT_CONTENT_HASH_MISMATCH',
      'timezone evidence sourceArtifactContentHash must match exact SourceArtifact'
    );
  }
  if (source.semanticPayload?.originLocator !== expected.originLocator) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_ORIGIN_LOCATOR_MISMATCH',
      'timezone evidence Source originLocator must equal exact accepted upstream Git blob locator'
    );
  }
  if (artifact.semanticPayload?.materializationIdentity
      !== expected.materializationIdentity) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_MATERIALIZATION_IDENTITY_MISMATCH',
      'timezone evidence artifact must retain exact accepted Git blob identity'
    );
  }
  if (item.sourceLocator.start !== expected.start
      || item.sourceLocator.endExclusive !== expected.endExclusive) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_BYTE_RANGE_MISMATCH',
      'timezone evidence BYTE_RANGE must equal exact accepted evidence slice'
    );
  }

  const bytes = sourceRegistry.readArtifactBytes(artifact.ref);
  if (item.sourceLocator.start < 0
      || item.sourceLocator.endExclusive <= item.sourceLocator.start
      || item.sourceLocator.endExclusive > bytes.byteLength) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_BYTE_RANGE_OUT_OF_BOUNDS',
      'timezone evidence BYTE_RANGE exceeds retained artifact length'
    );
  }
  const selected = bytes.subarray(
    item.sourceLocator.start,
    item.sourceLocator.endExclusive
  );
  const evidenceHash = sourceContentHash(selected);
  if (evidenceHash !== item.sourceLocator.evidenceHash) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_HASH_MISMATCH',
      'timezone evidence hash must match exact replayed BYTE_RANGE bytes'
    );
  }

  let text;
  try {
    text = UTF8_DECODER.decode(selected);
  } catch (error) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_NOT_UTF8',
      `v1 timezone evidence must be valid UTF-8: ${error?.message ?? 'decode failure'}`
    );
  }
  if (text !== expected.text) {
    throw new AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError(
      'SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_TEXT_MISMATCH',
      'timezone evidence bytes must equal exact reviewed SERF -> America/Chicago source slice'
    );
  }

  return deepFreeze({
    evidenceRole: item.evidenceRole,
    source,
    artifact,
    locator: item.sourceLocator,
    evidenceHash,
    byteLength: selected.byteLength,
    text
  });
}

export function replayAgronomicRecordedOperationContextSourceNativeTimezoneIdentityEvidence({
  sourceRegistry,
  binding
}) {
  requireSourceRegistry(sourceRegistry);
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding(
      binding
    );
  return deepFreeze(
    normalized.timezoneEvidence.map((item) =>
      replayItem({ sourceRegistry, item })
    )
  );
}
