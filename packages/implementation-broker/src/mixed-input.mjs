import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  RuntimeExecutionError,
  runtimeExecutionNodeId,
  text
} from './contract.mjs';

export const RUNTIME_EXECUTION_MIXED_INPUT_CONTRACT_VERSION = 'adr.runtime-execution-input.v2';

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_FIELD', `${name}.${key} is outside the D02 mixed-input contract`);
    }
  }
}

function exactRef(value, kind, name) {
  const ref = assertAuthorityRef(value);
  if (ref.kind !== kind) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_REF', `${name} must be exact ${kind}`);
  }
  return ref;
}

function contextEntry(entry, index) {
  const name = `contextEntries[${index}]`;
  exactObject(entry, name, new Set(['authorityRef', 'semanticId', 'semanticHash', 'payload']));
  const authorityRef = exactRef(entry.authorityRef, 'ContextDatum', `${name}.authorityRef`);
  const semanticId = text(entry.semanticId, `${name}.semanticId`);
  const semanticHashValue = text(entry.semanticHash, `${name}.semanticHash`);
  if (semanticHashValue !== authorityRef.semanticHash) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID',
      `${name}.semanticHash must equal exact ContextDatum authority semanticHash`
    );
  }
  return deepFreeze({
    authorityRef,
    semanticId,
    semanticHash: semanticHashValue,
    payload: cloneCanonicalValue(entry.payload)
  });
}

function runtimeEntry(entry, index) {
  const name = `runtimeEntries[${index}]`;
  exactObject(entry, name, new Set([
    'runtimeResultId', 'runtimeResultSemanticHash', 'executionEvidenceHash',
    'runtimeDatumId', 'semanticId', 'semanticHash', 'payload'
  ]));
  const runtimeResultId = text(entry.runtimeResultId, `${name}.runtimeResultId`);
  const runtimeResultSemanticHash = text(entry.runtimeResultSemanticHash, `${name}.runtimeResultSemanticHash`);
  const executionEvidenceHash = text(entry.executionEvidenceHash, `${name}.executionEvidenceHash`);
  const runtimeDatumId = text(entry.runtimeDatumId, `${name}.runtimeDatumId`);
  const semanticId = text(entry.semanticId, `${name}.semanticId`);
  const semanticHashValue = text(entry.semanticHash, `${name}.semanticHash`);
  const payload = cloneCanonicalValue(entry.payload);
  if (!payload || typeof payload !== 'object'
    || payload.runtimeDatumId !== runtimeDatumId
    || payload.semanticId !== semanticId
    || payload.outputSemanticHash !== semanticHashValue) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID',
      `${name} identity/hash fields must equal the exact supplied RuntimeDatum semantic envelope`
    );
  }
  return deepFreeze({
    runtimeResultId,
    runtimeResultSemanticHash,
    executionEvidenceHash,
    runtimeDatumId,
    semanticId,
    semanticHash: semanticHashValue,
    payload
  });
}

export function normalizeRuntimeExecutionMixedInputEnvelope(value) {
  exactObject(value, 'RuntimeExecutionMixedInputEnvelope', new Set([
    'contractVersion', 'runtimeBindingRef', 'runtimeNodeId', 'specificationRef',
    'implementationRef', 'implementationConformanceRef', 'contextEntries', 'runtimeEntries'
  ]));
  if (value.contractVersion !== RUNTIME_EXECUTION_MIXED_INPUT_CONTRACT_VERSION) {
    throw new RuntimeExecutionError(
      'UNSUPPORTED_RUNTIME_EXECUTION_INPUT_CONTRACT',
      'unsupported mixed RuntimeExecutionInputEnvelope contractVersion'
    );
  }
  if (!Array.isArray(value.contextEntries) || !Array.isArray(value.runtimeEntries)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID',
      'mixed execution requires contextEntries and runtimeEntries arrays'
    );
  }
  if (value.contextEntries.length + value.runtimeEntries.length === 0) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID',
      'mixed execution requires at least one exact semantic input'
    );
  }
  const contextEntries = value.contextEntries.map(contextEntry);
  const runtimeEntries = value.runtimeEntries.map(runtimeEntry);
  const allSemanticIds = [
    ...contextEntries.map((entry) => entry.semanticId),
    ...runtimeEntries.map((entry) => entry.semanticId)
  ];
  if (new Set(allSemanticIds).size !== allSemanticIds.length) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_DUPLICATE_INPUT',
      'one exact input source per semanticId is allowed across ContextDatum and RuntimeDatum inputs'
    );
  }
  const runtimeBindingRef = exactRef(value.runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef');
  const specificationRef = assertAuthorityRef(value.specificationRef);
  const implementationRef = exactRef(value.implementationRef, 'Implementation', 'implementationRef');
  const implementationConformanceRef = exactRef(
    value.implementationConformanceRef,
    'ImplementationConformance',
    'implementationConformanceRef'
  );
  const runtimeNodeId = text(value.runtimeNodeId, 'runtimeNodeId');
  const expectedNodeId = runtimeExecutionNodeId({
    runtimeBindingRef,
    specificationRef,
    implementationRef,
    implementationConformanceRef
  });
  if (runtimeNodeId !== expectedNodeId) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_IDENTITY_MISMATCH',
      'mixed input runtimeNodeId must derive from exact bound execution authority tuple'
    );
  }
  return deepFreeze({
    contractVersion: RUNTIME_EXECUTION_MIXED_INPUT_CONTRACT_VERSION,
    runtimeBindingRef,
    runtimeNodeId,
    specificationRef,
    implementationRef,
    implementationConformanceRef,
    contextEntries: deepFreeze([...contextEntries].sort((a, b) => a.semanticId.localeCompare(b.semanticId))),
    runtimeEntries: deepFreeze([...runtimeEntries].sort((a, b) => a.semanticId.localeCompare(b.semanticId)))
  });
}

export function runtimeExecutionMixedInputHash(value) {
  return semanticHash('RuntimeExecutionInputEnvelope', normalizeRuntimeExecutionMixedInputEnvelope(value));
}
