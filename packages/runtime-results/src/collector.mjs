import { deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateContextDatumAuthority } from '../../context-contract/src/index.mjs';
import {
  RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
  normalizeRuntimeExecutionEnvelope,
  normalizeRuntimeExecutionInputEnvelope,
  runtimeExecutionInputHash
} from '../../implementation-broker/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import {
  RUNTIME_SEMANTIC_OUTPUT_CONTRACT_VERSION,
  RuntimeResultError,
  createRuntimeDatum,
  createRuntimeResult,
  normalizeRuntimeResult,
  normalizeRuntimeSemanticOutput,
  semanticEqual
} from './contract.mjs';

function manifestContains(manifest, ref) {
  return manifest.semanticPayload.datumRefs.some((candidate) => sameAuthorityRef(candidate, ref));
}

function requiredInputPorts(specificationRecord) {
  const payload = specificationRecord.semanticPayload;
  if (specificationRecord.ref.kind === 'Model') return payload.inputs;
  if (specificationRecord.ref.kind === 'QualifiedTransformation') return [payload.inputContract];
  throw new RuntimeResultError(
    'RUNTIME_RESULT_POLICY_NOT_DATUM',
    'Policy action/disposition output is not RuntimeDatum authority; D03 cannot launder Policy execution into semantic data'
  );
}

function outputPorts(specificationRecord) {
  const payload = specificationRecord.semanticPayload;
  if (specificationRecord.ref.kind === 'Model') return payload.outputs;
  if (specificationRecord.ref.kind === 'QualifiedTransformation') return [payload.outputContract];
  throw new RuntimeResultError(
    'RUNTIME_RESULT_POLICY_NOT_DATUM',
    'Policy action/disposition output is not RuntimeDatum authority; D03 cannot launder Policy execution into semantic data'
  );
}

function validatePortDatum(port, datum) {
  const payload = datum.semanticPayload;
  if (payload.semanticId !== port.semanticId) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_SEMANTIC_MISMATCH', `input ${payload.semanticId} does not satisfy ${port.semanticId}`);
  }
  if (payload.value.type !== port.valueType) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_VALUE_TYPE_MISMATCH', `input ${payload.semanticId} value type differs from exact Specification`);
  }
  if (payload.unit !== port.unit) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_UNIT_MISMATCH', `input ${payload.semanticId} unit differs from exact Specification`);
  }
  if (!port.epistemicClasses.includes(payload.epistemicClass)) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_EPISTEMIC_MISMATCH', `input ${payload.semanticId} epistemic class is outside exact Specification`);
  }
}

function reconstructExactInputs({ ledger, binding, execution, inputDatumRefs }) {
  if (!Array.isArray(inputDatumRefs)) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_REFS_REQUIRED', 'D03 requires exact inputDatumRefs used by D02');
  }
  const specificationRecord = binding.frozenWorldRelations.specificationExecution?.specification;
  if (!specificationRecord) {
    throw new RuntimeResultError('RUNTIME_RESULT_EXECUTION_BINDING_REQUIRED', 'RuntimeBinding lacks exact S03 executable relation');
  }
  const ports = requiredInputPorts(specificationRecord);
  if (inputDatumRefs.length !== ports.length) {
    throw new RuntimeResultError('RUNTIME_RESULT_INPUT_COUNT_MISMATCH', `exact Specification requires ${ports.length} input authorities`);
  }
  const bySemantic = new Map();
  for (const ref of inputDatumRefs) {
    let datum;
    try {
      datum = validateContextDatumAuthority({ ledger, contextDatumRef: ref });
    } catch (error) {
      throw new RuntimeResultError(
        'RUNTIME_RESULT_INPUT_AUTHORITY_INVALID',
        `D03 input ref is not exact ContextDatum authority: ${error?.code ?? error?.message ?? 'invalid'}`
      );
    }
    if (!manifestContains(binding.frozenWorldRelations.manifest, datum.record.ref)) {
      throw new RuntimeResultError('RUNTIME_RESULT_INPUT_NOT_IN_MANIFEST', 'D03 input must belong to exact frozen ContextManifest');
    }
    if (bySemantic.has(datum.semanticPayload.semanticId)) {
      throw new RuntimeResultError('RUNTIME_RESULT_DUPLICATE_INPUT', `duplicate input semanticId ${datum.semanticPayload.semanticId}`);
    }
    bySemantic.set(datum.semanticPayload.semanticId, datum);
  }
  const entries = ports.map((port) => {
    const datum = bySemantic.get(port.semanticId);
    if (!datum) throw new RuntimeResultError('RUNTIME_RESULT_INPUT_SEMANTIC_MISMATCH', `missing required input ${port.semanticId}`);
    validatePortDatum(port, datum);
    return deepFreeze({
      authorityRef: datum.record.ref,
      semanticId: datum.semanticPayload.semanticId,
      semanticHash: datum.record.ref.semanticHash,
      payload: datum.semanticPayload
    });
  });
  const inputEnvelope = normalizeRuntimeExecutionInputEnvelope({
    contractVersion: RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
    runtimeBindingRef: execution.runtimeBindingRef,
    runtimeNodeId: execution.runtimeNodeId,
    specificationRef: execution.specificationRef,
    implementationRef: execution.implementationRef,
    implementationConformanceRef: execution.implementationConformanceRef,
    inputEntries: entries
  });
  const inputEnvelopeHash = runtimeExecutionInputHash(inputEnvelope);
  if (inputEnvelopeHash !== execution.inputEnvelopeHash) {
    throw new RuntimeResultError(
      'RUNTIME_RESULT_INPUT_ENVELOPE_MISMATCH',
      'supplied exact ContextDatum refs do not reproduce D02 inputEnvelopeHash'
    );
  }
  return deepFreeze({
    inputEnvelope,
    entries: deepFreeze(entries),
    bySemantic,
    inputSemanticHashes: deepFreeze(entries.map((entry) => entry.semanticHash).sort())
  });
}

function validateExecutionWorld(binding, execution) {
  const frozen = binding.frozenWorldRelations.specificationExecution;
  if (!frozen) throw new RuntimeResultError('RUNTIME_RESULT_EXECUTION_BINDING_REQUIRED', 'D03 requires exact frozen executable relation');
  const expected = [
    [binding.record.ref, execution.runtimeBindingRef, 'RuntimeBinding'],
    [frozen.specification.ref, execution.specificationRef, 'Specification'],
    [frozen.implementation.ref, execution.implementationRef, 'Implementation'],
    [frozen.conformance.ref, execution.implementationConformanceRef, 'ImplementationConformance']
  ];
  for (const [left, right, label] of expected) {
    if (!sameAuthorityRef(left, right)) {
      throw new RuntimeResultError('RUNTIME_RESULT_EXECUTION_LINEAGE_MISMATCH', `${label} does not match exact historical RuntimeBinding world`);
    }
  }
}

function rawOutputBySemantic(rawOutput, ports) {
  const normalized = normalizeRuntimeSemanticOutput(rawOutput);
  if (normalized.contractVersion !== RUNTIME_SEMANTIC_OUTPUT_CONTRACT_VERSION) {
    throw new RuntimeResultError('UNSUPPORTED_RUNTIME_SEMANTIC_OUTPUT_CONTRACT', 'unsupported semantic output contract');
  }
  if (normalized.outputs.length !== ports.length) {
    throw new RuntimeResultError('RUNTIME_RESULT_OUTPUT_COUNT_MISMATCH', `exact Specification requires ${ports.length} outputs`);
  }
  const bySemantic = new Map(normalized.outputs.map((item) => [item.semanticId, item]));
  for (const port of ports) {
    if (!bySemantic.has(port.semanticId)) {
      throw new RuntimeResultError('RUNTIME_RESULT_OUTPUT_SEMANTIC_MISMATCH', `missing exact output semantic ${port.semanticId}`);
    }
  }
  return bySemantic;
}

function enforceOutputValueType(port, raw) {
  if (raw.value.type !== port.valueType) {
    throw new RuntimeResultError(
      'RUNTIME_RESULT_OUTPUT_VALUE_TYPE_MISMATCH',
      `executor output ${raw.semanticId} type ${raw.value.type} differs from exact Specification ${port.valueType}`
    );
  }
}

function enforceTransformationPreservation(specification, raw, inputEntry) {
  const input = inputEntry.payload;
  if (!semanticEqual(raw.effectiveInterval, input.effectiveInterval, 'D03TransformationEffectiveInterval')) {
    throw new RuntimeResultError('RUNTIME_RESULT_TRANSFORMATION_SUPPORT_MUTATION', 'S01 v1 QualifiedTransformation cannot silently change effective interval');
  }
  if (!semanticEqual(raw.spatialSupport, input.spatialSupport, 'D03TransformationSpatialSupport')
    || !semanticEqual(raw.verticalSupport, input.verticalSupport, 'D03TransformationVerticalSupport')
    || !semanticEqual(raw.temporalSupport, input.temporalSupport, 'D03TransformationTemporalSupport')) {
    throw new RuntimeResultError('RUNTIME_RESULT_TRANSFORMATION_SUPPORT_MUTATION', 'S01 v1 QualifiedTransformation cannot silently change spatial/vertical/temporal support');
  }
  if (specification.semanticPayload.uncertaintyConsequence.mode === 'PRESERVE'
    && !semanticEqual(raw.uncertainty, input.uncertainty, 'D03TransformationUncertainty')) {
    throw new RuntimeResultError('RUNTIME_RESULT_TRANSFORMATION_UNCERTAINTY_MUTATION', 'PRESERVE transformation must retain exact input uncertainty');
  }
}

function runtimeDatumForPort({ specification, port, raw, inputWorld, execution }) {
  enforceOutputValueType(port, raw);
  let epistemicClass;
  let provenanceClass;
  if (specification.ref.kind === 'Model') {
    if (port.epistemicClasses.length !== 1) {
      throw new RuntimeResultError('RUNTIME_RESULT_MODEL_OUTPUT_EPISTEMIC_AMBIGUOUS', 'Model output must have one exact epistemic class');
    }
    [epistemicClass] = port.epistemicClasses;
    provenanceClass = 'MODEL';
  } else if (specification.ref.kind === 'QualifiedTransformation') {
    const inputEntry = inputWorld.entries[0];
    epistemicClass = inputEntry.payload.epistemicClass;
    provenanceClass = 'PLATFORM';
    if (!port.epistemicClasses.includes(epistemicClass)) {
      throw new RuntimeResultError('RUNTIME_RESULT_TRANSFORMATION_EPISTEMIC_MISMATCH', 'PRESERVE transform output no longer admits exact input epistemic class');
    }
    enforceTransformationPreservation(specification, raw, inputEntry);
  } else {
    throw new RuntimeResultError('RUNTIME_RESULT_POLICY_NOT_DATUM', 'Policy outputs are not RuntimeDatum in D03');
  }
  return createRuntimeDatum({
    executionId: execution.executionId,
    runtimeBindingRef: execution.runtimeBindingRef,
    runtimeNodeId: execution.runtimeNodeId,
    specificationRef: execution.specificationRef,
    implementationRef: execution.implementationRef,
    implementationConformanceRef: execution.implementationConformanceRef,
    semanticId: port.semanticId,
    value: raw.value,
    unit: port.unit,
    ...(port.measurementConvention ? { measurementConvention: port.measurementConvention } : {}),
    epistemicClass,
    provenanceClass,
    effectiveInterval: raw.effectiveInterval,
    forecast: raw.forecast,
    spatialSupport: raw.spatialSupport,
    verticalSupport: raw.verticalSupport,
    temporalSupport: raw.temporalSupport,
    uncertainty: raw.uncertainty
  });
}

export function collectRuntimeResult({ ledger, executionEnvelope, inputDatumRefs }) {
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new RuntimeResultError('INVALID_RUNTIME_RESULT_LEDGER', 'D03 requires replayable AuthorityLedger');
  }
  const execution = normalizeRuntimeExecutionEnvelope(executionEnvelope);
  if (execution.status !== 'SUCCEEDED') {
    throw new RuntimeResultError('RUNTIME_RESULT_SUCCESSFUL_EXECUTION_REQUIRED', 'failed D02 execution cannot be normalized into RuntimeResult');
  }
  const binding = validateRuntimeBinding({ ledger, runtimeBindingRef: execution.runtimeBindingRef });
  validateExecutionWorld(binding, execution);
  const specification = binding.frozenWorldRelations.specificationExecution.specification;
  const ports = outputPorts(specification);
  const inputWorld = reconstructExactInputs({ ledger, binding, execution, inputDatumRefs });
  const rawBySemantic = rawOutputBySemantic(execution.rawOutput, ports);
  const runtimeDatums = ports.map((port) => runtimeDatumForPort({
    specification,
    port,
    raw: rawBySemantic.get(port.semanticId),
    inputWorld,
    execution
  }));
  return createRuntimeResult({
    executionId: execution.executionId,
    executionEvidenceHash: semanticHash('RuntimeExecutionEnvelope', execution),
    runtimeBindingRef: execution.runtimeBindingRef,
    runtimeNodeId: execution.runtimeNodeId,
    specificationRef: execution.specificationRef,
    implementationRef: execution.implementationRef,
    implementationConformanceRef: execution.implementationConformanceRef,
    inputEnvelopeHash: execution.inputEnvelopeHash,
    inputSemanticHashes: inputWorld.inputSemanticHashes,
    startedAt: execution.startedAt,
    executedAt: execution.completedAt,
    runtimeDatums
  });
}

export function validateRuntimeResult({ ledger, runtimeResult, executionEnvelope, inputDatumRefs }) {
  const normalized = normalizeRuntimeResult(runtimeResult);
  const expected = collectRuntimeResult({ ledger, executionEnvelope, inputDatumRefs });
  if (!semanticEqual(normalized, expected, 'D03RuntimeResultEvidenceReplay')) {
    throw new RuntimeResultError(
      'RUNTIME_RESULT_EVIDENCE_REPLAY_MISMATCH',
      'RuntimeResult is self-consistent but does not reproduce the exact D02 execution evidence and input authority lineage'
    );
  }
  return normalized;
}
