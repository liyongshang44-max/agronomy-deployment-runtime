import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export const RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION = 'adr.runtime-execution-input.v1';
export const RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION = 'adr.runtime-execution-envelope.v1';
export const RUNTIME_EXECUTION_AUTHORITY_CLASS = 'EXECUTION_EVIDENCE_NON_SEMANTIC_D03_REQUIRED';
export const RUNTIME_EXECUTION_STATUSES = deepFreeze(['SUCCEEDED', 'FAILED']);
export const RUNTIME_EXECUTION_DISPATCH_CLASSES = deepFreeze(['INTERNAL', 'EXTERNAL']);
export const RUNTIME_EXECUTION_ERROR_CODES = deepFreeze([
  'RUNTIME_EXECUTION_BINDING_REQUIRED',
  'RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID',
  'RUNTIME_EXECUTION_INPUT_NOT_IN_MANIFEST',
  'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
  'RUNTIME_EXECUTION_INPUT_EPISTEMIC_MISMATCH',
  'RUNTIME_EXECUTION_INPUT_UNIT_MISMATCH',
  'RUNTIME_EXECUTION_DUPLICATE_INPUT',
  'RUNTIME_EXECUTION_PARAMETER_BINDING_REQUIRED',
  'RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED',
  'RUNTIME_EXECUTOR_NOT_REGISTERED',
  'RUNTIME_EXECUTOR_DISPATCH_CLASS_MISMATCH',
  'RUNTIME_EXECUTION_TIMEOUT',
  'RUNTIME_EXECUTION_TRANSPORT_ERROR',
  'RUNTIME_EXECUTION_OUTPUT_INVALID'
]);

const STATUS_SET = new Set(RUNTIME_EXECUTION_STATUSES);
const DISPATCH_SET = new Set(RUNTIME_EXECUTION_DISPATCH_CLASSES);

export class RuntimeExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeExecutionError';
    this.code = code;
  }
}

export function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactObject(value, name, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${name} must be a plain object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_FIELD', `${name}.${key} is outside the frozen D02 contract`);
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

export function normalizeRuntimeExecutionInputEnvelope(value) {
  exactObject(value, 'RuntimeExecutionInputEnvelope', new Set([
    'contractVersion', 'runtimeBindingRef', 'runtimeNodeId', 'specificationRef',
    'implementationRef', 'implementationConformanceRef', 'inputEntries'
  ]));
  if (value.contractVersion !== RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION) {
    throw new RuntimeExecutionError('UNSUPPORTED_RUNTIME_EXECUTION_INPUT_CONTRACT', 'unsupported RuntimeExecutionInputEnvelope contractVersion');
  }
  if (!Array.isArray(value.inputEntries) || value.inputEntries.length === 0) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID', 'D02 execution requires at least one exact input authority');
  }
  const entries = value.inputEntries.map((entry, index) => {
    exactObject(entry, `inputEntries[${index}]`, new Set(['authorityRef', 'semanticId', 'semanticHash', 'payload']));
    const authorityRef = exactRef(entry.authorityRef, 'ContextDatum', `inputEntries[${index}].authorityRef`);
    const semanticId = text(entry.semanticId, `inputEntries[${index}].semanticId`);
    const semanticHashValue = text(entry.semanticHash, `inputEntries[${index}].semanticHash`);
    if (semanticHashValue !== authorityRef.semanticHash) {
      throw new RuntimeExecutionError('RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID', 'input semanticHash must equal exact authority ref semanticHash');
    }
    return deepFreeze({
      authorityRef,
      semanticId,
      semanticHash: semanticHashValue,
      payload: cloneCanonicalValue(entry.payload)
    });
  });
  const semanticIds = entries.map((entry) => entry.semanticId);
  if (new Set(semanticIds).size !== semanticIds.length) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_DUPLICATE_INPUT', 'one exact input authority per semanticId is allowed in D02 v1');
  }
  return deepFreeze({
    contractVersion: RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(value.runtimeNodeId, 'runtimeNodeId'),
    specificationRef: assertAuthorityRef(value.specificationRef),
    implementationRef: exactRef(value.implementationRef, 'Implementation', 'implementationRef'),
    implementationConformanceRef: exactRef(value.implementationConformanceRef, 'ImplementationConformance', 'implementationConformanceRef'),
    inputEntries: deepFreeze([...entries].sort((a, b) => a.semanticId.localeCompare(b.semanticId)))
  });
}

export function runtimeExecutionInputHash(value) {
  return semanticHash('RuntimeExecutionInputEnvelope', normalizeRuntimeExecutionInputEnvelope(value));
}

export function runtimeExecutionNodeId({ runtimeBindingRef, specificationRef, implementationRef, implementationConformanceRef }) {
  return `runtime-node:${semanticHash('RuntimeExecutionNodeIdentity', {
    runtimeBindingRef: exactRef(runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    specificationRef: assertAuthorityRef(specificationRef),
    implementationRef: exactRef(implementationRef, 'Implementation', 'implementationRef'),
    implementationConformanceRef: exactRef(implementationConformanceRef, 'ImplementationConformance', 'implementationConformanceRef')
  })}`;
}

export function runtimeExecutionId({ runtimeBindingRef, runtimeNodeId, inputEnvelopeHash }) {
  return semanticHash('RuntimeExecutionIdentity', {
    runtimeBindingRef: exactRef(runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(runtimeNodeId, 'runtimeNodeId'),
    inputEnvelopeHash: text(inputEnvelopeHash, 'inputEnvelopeHash')
  });
}

export function normalizeRuntimeExecutionEnvelope(value) {
  exactObject(value, 'RuntimeExecutionEnvelope', new Set([
    'contractVersion', 'authorityClass', 'executionId', 'dispatchClass', 'runtimeBindingRef',
    'runtimeNodeId', 'specificationRef', 'implementationRef', 'implementationConformanceRef',
    'inputEnvelopeHash', 'status', 'startedAt', 'completedAt', 'rawOutput', 'rawOutputHash',
    'error', 'semanticValidation'
  ]));
  if (value.contractVersion !== RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION
    || value.authorityClass !== RUNTIME_EXECUTION_AUTHORITY_CLASS) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_ENVELOPE', 'execution envelope contract/authority class mismatch');
  }
  const dispatchClass = text(value.dispatchClass, 'dispatchClass');
  if (!DISPATCH_SET.has(dispatchClass)) throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_DISPATCH_CLASS', `unsupported dispatchClass ${dispatchClass}`);
  const status = text(value.status, 'status');
  if (!STATUS_SET.has(status)) throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_STATUS', `unsupported status ${status}`);
  if (value.semanticValidation !== 'NOT_PERFORMED_D03_REQUIRED') {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_SEMANTIC_LAUNDERING', 'D02 cannot claim semantic output validity');
  }
  if (status === 'SUCCEEDED' && (value.error !== null || value.rawOutput === null || typeof value.rawOutputHash !== 'string')) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_ENVELOPE', 'SUCCEEDED requires raw output/hash and no error');
  }
  if (status === 'FAILED' && (value.error === null || value.rawOutput !== null || value.rawOutputHash !== null)) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_ENVELOPE', 'FAILED requires error and no raw output');
  }
  const error = value.error === null ? null : (() => {
    exactObject(value.error, 'error', new Set(['code', 'phase', 'retryDisposition']));
    return deepFreeze({
      code: text(value.error.code, 'error.code'),
      phase: text(value.error.phase, 'error.phase'),
      retryDisposition: text(value.error.retryDisposition, 'error.retryDisposition')
    });
  })();
  return deepFreeze({
    contractVersion: RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
    authorityClass: RUNTIME_EXECUTION_AUTHORITY_CLASS,
    executionId: text(value.executionId, 'executionId'),
    dispatchClass,
    runtimeBindingRef: exactRef(value.runtimeBindingRef, 'RuntimeBinding', 'runtimeBindingRef'),
    runtimeNodeId: text(value.runtimeNodeId, 'runtimeNodeId'),
    specificationRef: assertAuthorityRef(value.specificationRef),
    implementationRef: exactRef(value.implementationRef, 'Implementation', 'implementationRef'),
    implementationConformanceRef: exactRef(value.implementationConformanceRef, 'ImplementationConformance', 'implementationConformanceRef'),
    inputEnvelopeHash: text(value.inputEnvelopeHash, 'inputEnvelopeHash'),
    status,
    startedAt: text(value.startedAt, 'startedAt'),
    completedAt: text(value.completedAt, 'completedAt'),
    rawOutput: value.rawOutput === null ? null : cloneCanonicalValue(value.rawOutput),
    rawOutputHash: value.rawOutputHash === null ? null : text(value.rawOutputHash, 'rawOutputHash'),
    error,
    semanticValidation: 'NOT_PERFORMED_D03_REQUIRED'
  });
}
