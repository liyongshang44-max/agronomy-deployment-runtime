import { canonicalizeSemanticJson, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import { RuntimeExecutionError } from '../../implementation-broker/src/contract.mjs';
import { prepareMixedRuntimeExecutionInput } from '../../implementation-broker/src/broker.mjs';
import { executePreparedRuntimeInput } from '../../implementation-broker/src/prepared-input.mjs';
import { validateRuntimeResult } from './collector.mjs';

const INPUT_KEYS = new Set([
  'broker', 'ledger', 'runtimeBindingRef', 'contextDatumRefs', 'runtimeResultInputs'
]);
const RESULT_INPUT_KEYS = new Set(['runtimeResult', 'executionEnvelope', 'inputDatumRefs']);

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
      throw new RuntimeExecutionError(
        'INVALID_RUNTIME_EXECUTION_FIELD',
        `${name}.${key} is outside the evidence-backed Policy execution contract`
      );
    }
  }
}

function validateEvidenceInput({ ledger, value, index }) {
  exactObject(value, `runtimeResultInputs[${index}]`, RESULT_INPUT_KEYS);
  if (!Array.isArray(value.inputDatumRefs)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID',
      `runtimeResultInputs[${index}].inputDatumRefs must reproduce the original D02 ContextDatum lineage`
    );
  }
  try {
    return validateRuntimeResult({
      ledger,
      runtimeResult: value.runtimeResult,
      executionEnvelope: value.executionEnvelope,
      inputDatumRefs: value.inputDatumRefs
    });
  } catch (error) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID',
      `RuntimeResult input failed exact D03 evidence replay: ${error?.code ?? error?.message ?? 'invalid'}`
    );
  }
}

function runtimeEntry(result, datum) {
  return deepFreeze({
    runtimeResultId: result.runtimeResultId,
    runtimeResultSemanticHash: result.resultSemanticHash,
    executionEvidenceHash: result.executionEvidenceHash,
    runtimeDatumId: datum.runtimeDatumId,
    semanticId: datum.semanticId,
    semanticHash: datum.outputSemanticHash,
    payload: datum
  });
}

function samePlanRef(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

export function assertRuntimeInputWorldAlignment(targetBinding, sourceBinding) {
  const target = targetBinding?.semanticPayload;
  const source = sourceBinding?.semanticPayload;
  if (!target || !source) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_WORLD_MISMATCH',
      'RuntimeDatum source and target Policy must both be exact validated RuntimeBindings'
    );
  }
  const exactRefPairs = [
    ['runtimeEligibilityRef', target.runtimeEligibilityRef, source.runtimeEligibilityRef],
    ['decisionProblemRef', target.decisionProblemRef, source.decisionProblemRef],
    ['deploymentRef', target.deploymentRef, source.deploymentRef],
    ['runtimeProfileRef', target.runtimeProfileRef, source.runtimeProfileRef],
    ['knowledgeReleaseRef', target.knowledgeReleaseRef, source.knowledgeReleaseRef],
    ['contextManifestRef', target.contextManifestRef, source.contextManifestRef]
  ];
  const mismatchedRef = exactRefPairs.find(([, left, right]) => !sameAuthorityRef(left, right));
  if (mismatchedRef
    || !samePlanRef(target.runtimePlanRef, source.runtimePlanRef)
    || target.selectedAlternativePathId !== source.selectedAlternativePathId
    || target.logicalTime !== source.logicalTime
    || target.evidenceCutoff !== source.evidenceCutoff) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_WORLD_MISMATCH',
      'validated RuntimeDatum must come from the same exact RuntimeEligibility/plan/decision/deployment/profile/context/path world as the target Policy binding'
    );
  }
  return true;
}

export async function executePolicyWithRuntimeResults(input) {
  exactObject(input, 'PolicyRuntimeExecutionInput', INPUT_KEYS);
  const {
    broker,
    ledger,
    runtimeBindingRef,
    contextDatumRefs = [],
    runtimeResultInputs = []
  } = input;
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new RuntimeExecutionError('INVALID_LEDGER', 'Policy runtime execution requires replayable AuthorityLedger');
  }
  if (!Array.isArray(contextDatumRefs) || !Array.isArray(runtimeResultInputs)) {
    throw new RuntimeExecutionError(
      'INVALID_RUNTIME_EXECUTION_INPUT',
      'contextDatumRefs and runtimeResultInputs must be arrays'
    );
  }
  const binding = validateRuntimeBinding({ ledger, runtimeBindingRef });
  const specification = binding.frozenWorldRelations.specificationExecution?.specification;
  if (!specification || specification.ref.kind !== 'Policy') {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_SPECIFICATION_UNSUPPORTED',
      'executePolicyWithRuntimeResults requires an exact Policy RuntimeBinding'
    );
  }
  const requiredSemanticIds = new Set(
    specification.semanticPayload.requiredRuntimeOutputs.map((port) => port.semanticId)
  );
  const validatedResults = runtimeResultInputs.map((value, index) => {
    const result = validateEvidenceInput({ ledger, value, index });
    const sourceBinding = validateRuntimeBinding({ ledger, runtimeBindingRef: result.runtimeBindingRef });
    assertRuntimeInputWorldAlignment(binding, sourceBinding);
    return { index, result };
  });
  const bySemantic = new Map();
  for (const { index, result } of validatedResults) {
    let contributesRequiredInput = false;
    for (const datum of result.runtimeDatums) {
      if (!requiredSemanticIds.has(datum.semanticId)) continue;
      contributesRequiredInput = true;
      if (bySemantic.has(datum.semanticId)) {
        throw new RuntimeExecutionError(
          'RUNTIME_EXECUTION_DUPLICATE_INPUT',
          `multiple validated RuntimeResults provide required semantic ${datum.semanticId}`
        );
      }
      bySemantic.set(datum.semanticId, { result, datum });
    }
    if (!contributesRequiredInput) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_UNUSED_RUNTIME_RESULT',
        `runtimeResultInputs[${index}] contributes no exact Policy requiredRuntimeOutputs and cannot be hidden outside execution identity`
      );
    }
  }
  const runtimeEntries = specification.semanticPayload.requiredRuntimeOutputs.map((port) => {
    const match = bySemantic.get(port.semanticId);
    if (!match) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_RUNTIME_INPUT_REQUIRED',
        `required RuntimeDatum semantic input ${port.semanticId} is absent from validated RuntimeResults`
      );
    }
    return runtimeEntry(match.result, match.datum);
  });
  const inputEnvelope = prepareMixedRuntimeExecutionInput({
    ledger,
    runtimeBindingRef,
    contextDatumRefs,
    runtimeEntries
  });
  return executePreparedRuntimeInput(broker, { ledger, runtimeBindingRef, inputEnvelope });
}
