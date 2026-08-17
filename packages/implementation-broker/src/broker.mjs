import {
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateContextDatumAuthority } from '../../context-contract/src/index.mjs';
import { resolveDeploymentForRuntime, normalizeDeploymentTimestamp } from '../../deployment/src/index.mjs';
import { validateImplementationConformance } from '../../implementation-conformance/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import {
  RUNTIME_EXECUTION_AUTHORITY_CLASS,
  RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
  RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
  RUNTIME_EXECUTION_RETRY_DISPOSITION,
  RuntimeExecutionError,
  normalizeRuntimeExecutionEnvelope,
  normalizeRuntimeExecutionInputEnvelope,
  runtimeExecutionId,
  runtimeExecutionInputHash,
  runtimeExecutionNodeId,
  runtimeExecutionRawOutputHash
} from './contract.mjs';
import { RuntimeExecutionIdempotencyStore } from './idempotency.mjs';
import { ImplementationExecutorRegistry } from './registry.mjs';

const EXECUTE_KEYS = new Set(['ledger', 'runtimeBindingRef', 'inputDatumRefs']);

function assertExecuteInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', 'broker execute input must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', 'broker execute input must be a plain object');
  }
  for (const key of Object.keys(input)) {
    if (!EXECUTE_KEYS.has(key)) {
      throw new RuntimeExecutionError(
        'INVALID_RUNTIME_EXECUTION_FIELD',
        `${key} cannot override frozen RuntimeBinding/Implementation/Conformance execution authority`
      );
    }
  }
}

function manifestContains(manifest, ref) {
  return manifest.semanticPayload.datumRefs.some((candidate) => sameAuthorityRef(candidate, ref));
}

function requiredContextPorts(specification) {
  const kind = specification.record.ref.kind;
  const payload = specification.semanticPayload;
  if (kind === 'QualifiedTransformation') return [payload.inputContract];
  if (kind === 'Model') {
    if (payload.parameterSlots.some((slot) => slot.required)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_PARAMETER_BINDING_REQUIRED',
        'D02 v1 cannot execute a Model with required parameter slots until exact parameter/calibration binding authority exists'
      );
    }
    return payload.inputs;
  }
  if (kind === 'Policy') {
    if (payload.requiredRuntimeOutputs.length > 0) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED',
        'D02 v1 cannot execute Policy requiring RuntimeDatum inputs before MTL-D03 exists'
      );
    }
    return payload.requiredInputs;
  }
  throw new RuntimeExecutionError('RUNTIME_EXECUTION_SPECIFICATION_UNSUPPORTED', `unsupported executable specification kind ${kind}`);
}

function validatePortDatum(port, datum) {
  if (datum.semanticPayload.semanticId !== port.semanticId) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
      `input ${datum.semanticPayload.semanticId} does not satisfy required semantic ${port.semanticId}`
    );
  }
  if (datum.semanticPayload.unit !== port.unit) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_UNIT_MISMATCH',
      `input unit ${datum.semanticPayload.unit} does not equal required unit ${port.unit}`
    );
  }
  if (datum.semanticPayload.value.type !== port.valueType) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
      `input value type ${datum.semanticPayload.value.type} does not equal required ${port.valueType}`
    );
  }
  if (!port.epistemicClasses.includes(datum.semanticPayload.epistemicClass)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_EPISTEMIC_MISMATCH',
      `input epistemic class ${datum.semanticPayload.epistemicClass} is outside exact specification input contract`
    );
  }
}

function buildInputEnvelope({ ledger, bindingAuthority, specification, inputDatumRefs }) {
  if (!Array.isArray(inputDatumRefs)) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID', 'inputDatumRefs must be an array');
  }
  const ports = requiredContextPorts(specification);
  const bySemantic = new Map();
  for (const ref of inputDatumRefs) {
    let datum;
    try {
      datum = validateContextDatumAuthority({ ledger, contextDatumRef: ref });
    } catch (error) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID',
        `input ref is not valid ContextDatum authority: ${error?.code ?? error?.message ?? 'invalid'}`
      );
    }
    if (!manifestContains(bindingAuthority.frozenWorldRelations.manifest, datum.record.ref)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_INPUT_NOT_IN_MANIFEST',
        'D02 input authority must be a member of the exact frozen ContextManifest'
      );
    }
    if (bySemantic.has(datum.semanticPayload.semanticId)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_DUPLICATE_INPUT',
        `duplicate input semanticId ${datum.semanticPayload.semanticId}`
      );
    }
    bySemantic.set(datum.semanticPayload.semanticId, datum);
  }
  if (inputDatumRefs.length !== ports.length) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
      `exact specification requires ${ports.length} ContextDatum inputs but ${inputDatumRefs.length} were supplied`
    );
  }
  const entries = ports.map((port) => {
    const datum = bySemantic.get(port.semanticId);
    if (!datum) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
        `required semantic input ${port.semanticId} is absent`
      );
    }
    validatePortDatum(port, datum);
    return {
      authorityRef: datum.record.ref,
      semanticId: datum.semanticPayload.semanticId,
      semanticHash: datum.record.ref.semanticHash,
      payload: datum.semanticPayload
    };
  });
  const executionBinding = bindingAuthority.semanticPayload.implementationBindings[0];
  const nodeId = runtimeExecutionNodeId({
    runtimeBindingRef: bindingAuthority.record.ref,
    specificationRef: executionBinding.specificationRef,
    implementationRef: executionBinding.implementationRef,
    implementationConformanceRef: executionBinding.implementationConformanceRef
  });
  return normalizeRuntimeExecutionInputEnvelope({
    contractVersion: RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
    runtimeBindingRef: bindingAuthority.record.ref,
    runtimeNodeId: nodeId,
    specificationRef: executionBinding.specificationRef,
    implementationRef: executionBinding.implementationRef,
    implementationConformanceRef: executionBinding.implementationConformanceRef,
    inputEntries: entries
  });
}

function currentExecutionWorld({ ledger, runtimeBindingRef, inputDatumRefs, atTime }) {
  const binding = validateRuntimeBinding({ ledger, runtimeBindingRef });
  if (binding.semanticPayload.implementationBindings.length !== 1
    || !binding.frozenWorldRelations.specificationExecution) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_BINDING_REQUIRED',
      'D02 requires one exact S03 Specification + Implementation + ImplementationConformance binding'
    );
  }
  const deployment = resolveDeploymentForRuntime({
    ledger,
    deploymentRef: binding.semanticPayload.deploymentRef,
    principal: binding.runtimeBindingPrincipal,
    authorizationDecisionAuditRef: binding.runtimeAuthorizationDecisionAuditRef,
    atTime
  });
  const executionBinding = binding.semanticPayload.implementationBindings[0];
  const conformance = validateImplementationConformance({
    ledger,
    conformanceRef: executionBinding.implementationConformanceRef,
    atTime,
    executionContext: executionBinding.executionContext
  });
  if (!sameAuthorityRef(conformance.semanticPayload.specificationRef, executionBinding.specificationRef)
    || !sameAuthorityRef(conformance.semanticPayload.implementationRef, executionBinding.implementationRef)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_CONFORMANCE_MISMATCH',
      'bound conformance no longer closes the exact bound specification/implementation relation'
    );
  }
  if (deployment.semanticPayload.runtimeEnvironment !== executionBinding.executionContext.runtimeEnvironment) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_DEPLOYMENT_ENVIRONMENT_MISMATCH',
      'current Deployment runtime environment differs from frozen bound execution context'
    );
  }
  const inputEnvelope = buildInputEnvelope({
    ledger,
    bindingAuthority: binding,
    specification: conformance.specification,
    inputDatumRefs
  });
  return deepFreeze({ binding, deployment, conformance, inputEnvelope });
}

function executionCompletedAt(clock, startedAt) {
  const completedAt = normalizeDeploymentTimestamp(clock(), 'executionCompletedAt');
  if (new Date(completedAt).getTime() < new Date(startedAt).getTime()) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_CLOCK_REGRESSION',
      'execution completion clock cannot precede the dispatch/current-use authorization timestamp'
    );
  }
  return completedAt;
}

function errorEnvelope({ world, executionIdValue, inputHash, dispatchClass, startedAt, completedAt, code, phase }) {
  return normalizeRuntimeExecutionEnvelope({
    contractVersion: RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
    authorityClass: RUNTIME_EXECUTION_AUTHORITY_CLASS,
    executionId: executionIdValue,
    dispatchClass,
    runtimeBindingRef: world.binding.record.ref,
    runtimeNodeId: world.inputEnvelope.runtimeNodeId,
    specificationRef: world.inputEnvelope.specificationRef,
    implementationRef: world.inputEnvelope.implementationRef,
    implementationConformanceRef: world.inputEnvelope.implementationConformanceRef,
    inputEnvelopeHash: inputHash,
    status: 'FAILED',
    startedAt,
    completedAt,
    rawOutput: null,
    rawOutputHash: null,
    error: {
      code,
      phase,
      retryDisposition: RUNTIME_EXECUTION_RETRY_DISPOSITION
    },
    semanticValidation: 'NOT_PERFORMED_D03_REQUIRED'
  });
}

function successEnvelope({ world, executionIdValue, inputHash, dispatchClass, startedAt, completedAt, output }) {
  if (output === null || output === undefined) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_OUTPUT_INVALID', 'executor output cannot be null/undefined in D02 v1');
  }
  let canonicalOutput;
  try {
    canonicalOutput = cloneCanonicalValue(output);
  } catch {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_OUTPUT_INVALID', 'executor output must be canonical JSON-compatible data');
  }
  return normalizeRuntimeExecutionEnvelope({
    contractVersion: RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
    authorityClass: RUNTIME_EXECUTION_AUTHORITY_CLASS,
    executionId: executionIdValue,
    dispatchClass,
    runtimeBindingRef: world.binding.record.ref,
    runtimeNodeId: world.inputEnvelope.runtimeNodeId,
    specificationRef: world.inputEnvelope.specificationRef,
    implementationRef: world.inputEnvelope.implementationRef,
    implementationConformanceRef: world.inputEnvelope.implementationConformanceRef,
    inputEnvelopeHash: inputHash,
    status: 'SUCCEEDED',
    startedAt,
    completedAt,
    rawOutput: canonicalOutput,
    rawOutputHash: runtimeExecutionRawOutputHash(canonicalOutput),
    error: null,
    semanticValidation: 'NOT_PERFORMED_D03_REQUIRED'
  });
}

async function executeWithTimeout(execute, request, timeoutMs) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => execute(request)).then((output) => ({ output })),
      timeout
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export class RuntimeExecutionBroker {
  constructor({ executorRegistry, idempotencyStore, clock, timeoutMs = 5000 } = {}) {
    if (!(executorRegistry instanceof ImplementationExecutorRegistry)) {
      throw new RuntimeExecutionError('RUNTIME_EXECUTOR_REGISTRY_REQUIRED', 'RuntimeExecutionBroker requires ImplementationExecutorRegistry');
    }
    if (!(idempotencyStore instanceof RuntimeExecutionIdempotencyStore)) {
      throw new RuntimeExecutionError('RUNTIME_EXECUTION_IDEMPOTENCY_STORE_REQUIRED', 'RuntimeExecutionBroker requires RuntimeExecutionIdempotencyStore');
    }
    if (typeof clock !== 'function') {
      throw new RuntimeExecutionError('RUNTIME_EXECUTION_CLOCK_REQUIRED', 'RuntimeExecutionBroker requires explicit clock');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) {
      throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_TIMEOUT', 'timeoutMs must be integer 1..600000');
    }
    this.executorRegistry = executorRegistry;
    this.idempotencyStore = idempotencyStore;
    this.clock = clock;
    this.timeoutMs = timeoutMs;
  }

  async execute(input) {
    assertExecuteInput(input);
    const { ledger, runtimeBindingRef, inputDatumRefs } = input;
    const startedAt = normalizeDeploymentTimestamp(this.clock(), 'executionStartedAt');
    const world = currentExecutionWorld({ ledger, runtimeBindingRef, inputDatumRefs, atTime: startedAt });
    const inputHash = runtimeExecutionInputHash(world.inputEnvelope);
    const executionIdValue = runtimeExecutionId({
      runtimeBindingRef: world.binding.record.ref,
      runtimeNodeId: world.inputEnvelope.runtimeNodeId,
      inputEnvelopeHash: inputHash
    });
    const implementation = world.conformance.implementation;
    const registration = this.executorRegistry.resolve({
      implementationRef: implementation.record.ref,
      providerType: implementation.semanticPayload.providerType
    });

    return this.idempotencyStore.runOnce(executionIdValue, async () => {
      const request = deepFreeze({
        contractVersion: 'adr.executor-request.v1',
        executionId: executionIdValue,
        idempotencyKey: executionIdValue,
        dispatchClass: registration.dispatchClass,
        runtimeBindingRef: world.binding.record.ref,
        runtimeNodeId: world.inputEnvelope.runtimeNodeId,
        specificationRef: world.inputEnvelope.specificationRef,
        implementationRef: world.inputEnvelope.implementationRef,
        implementationConformanceRef: world.inputEnvelope.implementationConformanceRef,
        executionLocator: implementation.semanticPayload.executionLocator,
        inputEnvelopeHash: inputHash,
        inputEntries: world.inputEnvelope.inputEntries
      });

      let result;
      try {
        result = await executeWithTimeout(registration.execute, request, this.timeoutMs);
      } catch {
        const completedAt = executionCompletedAt(this.clock, startedAt);
        return errorEnvelope({
          world,
          executionIdValue,
          inputHash,
          dispatchClass: registration.dispatchClass,
          startedAt,
          completedAt,
          code: 'RUNTIME_EXECUTION_TRANSPORT_ERROR',
          phase: 'DISPATCH'
        });
      }

      const completedAt = executionCompletedAt(this.clock, startedAt);
      if (result?.timedOut === true) {
        return errorEnvelope({
          world,
          executionIdValue,
          inputHash,
          dispatchClass: registration.dispatchClass,
          startedAt,
          completedAt,
          code: 'RUNTIME_EXECUTION_TIMEOUT',
          phase: 'DISPATCH'
        });
      }
      try {
        return successEnvelope({
          world,
          executionIdValue,
          inputHash,
          dispatchClass: registration.dispatchClass,
          startedAt,
          completedAt,
          output: result.output
        });
      } catch (error) {
        if (error?.code !== 'RUNTIME_EXECUTION_OUTPUT_INVALID') throw error;
        return errorEnvelope({
          world,
          executionIdValue,
          inputHash,
          dispatchClass: registration.dispatchClass,
          startedAt,
          completedAt,
          code: 'RUNTIME_EXECUTION_OUTPUT_INVALID',
          phase: 'OUTPUT_CAPTURE'
        });
      }
    });
  }
}
