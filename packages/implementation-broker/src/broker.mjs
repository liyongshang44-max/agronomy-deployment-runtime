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
import {
  RUNTIME_EXECUTION_MIXED_INPUT_CONTRACT_VERSION,
  normalizeRuntimeExecutionMixedInputEnvelope,
  runtimeExecutionMixedInputHash
} from './mixed-input.mjs';
import { PREPARED_RUNTIME_INPUT_EXECUTE } from './prepared-input.mjs';
import { RuntimeExecutionIdempotencyStore } from './idempotency.mjs';
import { ImplementationExecutorRegistry } from './registry.mjs';

const EXECUTE_KEYS = new Set(['ledger', 'runtimeBindingRef', 'inputDatumRefs']);
const PREPARED_EXECUTE_KEYS = new Set(['ledger', 'runtimeBindingRef', 'inputEnvelope']);

function assertExactInput(input, allowed, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_INPUT', `${label} must be a plain object`);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
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

function specificationKind(specification) {
  const kind = specification?.record?.ref?.kind ?? specification?.ref?.kind;
  if (!kind) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_SPECIFICATION_UNSUPPORTED',
      'executable specification relation lacks an exact authority kind'
    );
  }
  return kind;
}

function requiredContextPorts(specification) {
  const kind = specificationKind(specification);
  const payload = specification.semanticPayload;
  if (kind === 'QualifiedTransformation') return [payload.inputContract];
  if (kind === 'Model') {
    if (payload.parameterSlots.some((slot) => slot.required)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_PARAMETER_BINDING_REQUIRED',
        'D02 cannot execute a Model with required parameter slots until exact parameter/calibration binding authority exists'
      );
    }
    return payload.inputs;
  }
  if (kind === 'Policy') return payload.requiredInputs;
  throw new RuntimeExecutionError(
    'RUNTIME_EXECUTION_SPECIFICATION_UNSUPPORTED',
    `unsupported executable specification kind ${kind}`
  );
}

function requiredRuntimePorts(specification) {
  return specificationKind(specification) === 'Policy'
    ? specification.semanticPayload.requiredRuntimeOutputs
    : [];
}

function validatePortPayload(port, payload, prefix = 'input') {
  if (payload.semanticId !== port.semanticId) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
      `${prefix} ${payload.semanticId} does not satisfy required semantic ${port.semanticId}`
    );
  }
  if (payload.unit !== port.unit) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_UNIT_MISMATCH',
      `${prefix} unit ${payload.unit} does not equal required unit ${port.unit}`
    );
  }
  if (payload.value?.type !== port.valueType) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
      `${prefix} value type ${payload.value?.type} does not equal required ${port.valueType}`
    );
  }
  if (!port.epistemicClasses.includes(payload.epistemicClass)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_INPUT_EPISTEMIC_MISMATCH',
      `${prefix} epistemic class ${payload.epistemicClass} is outside exact specification input contract`
    );
  }
}

function contextEntriesForPorts({ ledger, bindingAuthority, ports, inputDatumRefs }) {
  if (!Array.isArray(inputDatumRefs)) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_INPUT_AUTHORITY_INVALID', 'inputDatumRefs must be an array');
  }
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
        'D02 ContextDatum input authority must be a member of the exact frozen ContextManifest'
      );
    }
    if (bySemantic.has(datum.semanticPayload.semanticId)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_DUPLICATE_INPUT',
        `duplicate ContextDatum semanticId ${datum.semanticPayload.semanticId}`
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
  return ports.map((port) => {
    const datum = bySemantic.get(port.semanticId);
    if (!datum) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_INPUT_SEMANTIC_MISMATCH',
        `required ContextDatum semantic input ${port.semanticId} is absent`
      );
    }
    validatePortPayload(port, datum.semanticPayload, 'ContextDatum input');
    return {
      authorityRef: datum.record.ref,
      semanticId: datum.semanticPayload.semanticId,
      semanticHash: datum.record.ref.semanticHash,
      payload: datum.semanticPayload
    };
  });
}

function executionTuple(bindingAuthority) {
  const executionBinding = bindingAuthority.semanticPayload.implementationBindings[0];
  const runtimeNodeId = runtimeExecutionNodeId({
    runtimeBindingRef: bindingAuthority.record.ref,
    specificationRef: executionBinding.specificationRef,
    implementationRef: executionBinding.implementationRef,
    implementationConformanceRef: executionBinding.implementationConformanceRef
  });
  return { executionBinding, runtimeNodeId };
}

function buildLegacyInputEnvelope({ ledger, bindingAuthority, specification, inputDatumRefs }) {
  if (requiredRuntimePorts(specification).length > 0) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED',
      'Policy requiring RuntimeDatum inputs must use the evidence-backed post-D03 mixed-input execution path'
    );
  }
  const contextEntries = contextEntriesForPorts({
    ledger,
    bindingAuthority,
    ports: requiredContextPorts(specification),
    inputDatumRefs
  });
  const { executionBinding, runtimeNodeId } = executionTuple(bindingAuthority);
  return normalizeRuntimeExecutionInputEnvelope({
    contractVersion: RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION,
    runtimeBindingRef: bindingAuthority.record.ref,
    runtimeNodeId,
    specificationRef: executionBinding.specificationRef,
    implementationRef: executionBinding.implementationRef,
    implementationConformanceRef: executionBinding.implementationConformanceRef,
    inputEntries: contextEntries
  });
}

function historicalExecutionBinding({ ledger, runtimeBindingRef }) {
  const binding = validateRuntimeBinding({ ledger, runtimeBindingRef });
  if (binding.semanticPayload.implementationBindings.length !== 1
    || !binding.frozenWorldRelations.specificationExecution) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_BINDING_REQUIRED',
      'D02 requires one exact S03 Specification + Implementation + ImplementationConformance binding'
    );
  }
  return binding;
}

export function prepareMixedRuntimeExecutionInput({
  ledger,
  runtimeBindingRef,
  contextDatumRefs = [],
  runtimeEntries = []
}) {
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new RuntimeExecutionError('INVALID_LEDGER', 'prepared mixed input requires a replayable AuthorityLedger');
  }
  if (!Array.isArray(runtimeEntries)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID',
      'runtimeEntries must be an array of evidence-validated RuntimeDatum entries'
    );
  }
  const binding = historicalExecutionBinding({ ledger, runtimeBindingRef });
  const specification = binding.frozenWorldRelations.specificationExecution.specification;
  if (specificationKind(specification) !== 'Policy') {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_SPECIFICATION_UNSUPPORTED',
      'D02 mixed ContextDatum + RuntimeDatum inputs are only defined for Policy execution'
    );
  }
  const contextEntries = contextEntriesForPorts({
    ledger,
    bindingAuthority: binding,
    ports: requiredContextPorts(specification),
    inputDatumRefs: contextDatumRefs
  });
  const runtimePorts = requiredRuntimePorts(specification);
  if (runtimeEntries.length !== runtimePorts.length) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_RUNTIME_INPUT_REQUIRED',
      `exact Policy requires ${runtimePorts.length} RuntimeDatum inputs but ${runtimeEntries.length} were supplied`
    );
  }
  const bySemantic = new Map();
  for (const entry of runtimeEntries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.payload) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID',
        'runtime input entry must contain evidence-bound RuntimeDatum payload'
      );
    }
    if (bySemantic.has(entry.semanticId)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_DUPLICATE_INPUT',
        `duplicate RuntimeDatum semanticId ${entry.semanticId}`
      );
    }
    if (entry.payload.runtimeBindingRef
      && sameAuthorityRef(entry.payload.runtimeBindingRef, binding.record.ref)) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_RUNTIME_INPUT_SELF_AUTHORIZATION',
        'a RuntimeDatum produced by the current RuntimeBinding cannot justify execution of that same binding'
      );
    }
    bySemantic.set(entry.semanticId, entry);
  }
  const orderedRuntimeEntries = runtimePorts.map((port) => {
    const entry = bySemantic.get(port.semanticId);
    if (!entry) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTION_RUNTIME_INPUT_REQUIRED',
        `required RuntimeDatum semantic input ${port.semanticId} is absent`
      );
    }
    validatePortPayload(port, entry.payload, 'RuntimeDatum input');
    return entry;
  });
  const { executionBinding, runtimeNodeId } = executionTuple(binding);
  return normalizeRuntimeExecutionMixedInputEnvelope({
    contractVersion: RUNTIME_EXECUTION_MIXED_INPUT_CONTRACT_VERSION,
    runtimeBindingRef: binding.record.ref,
    runtimeNodeId,
    specificationRef: executionBinding.specificationRef,
    implementationRef: executionBinding.implementationRef,
    implementationConformanceRef: executionBinding.implementationConformanceRef,
    contextEntries,
    runtimeEntries: orderedRuntimeEntries
  });
}

function currentExecutionWorld({ ledger, runtimeBindingRef, atTime }) {
  const binding = historicalExecutionBinding({ ledger, runtimeBindingRef });
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
  return deepFreeze({ binding, deployment, conformance });
}

function inputEnvelopeMatchesWorld(world, inputEnvelope) {
  const executionBinding = world.binding.semanticPayload.implementationBindings[0];
  if (!sameAuthorityRef(inputEnvelope.runtimeBindingRef, world.binding.record.ref)
    || !sameAuthorityRef(inputEnvelope.specificationRef, executionBinding.specificationRef)
    || !sameAuthorityRef(inputEnvelope.implementationRef, executionBinding.implementationRef)
    || !sameAuthorityRef(inputEnvelope.implementationConformanceRef, executionBinding.implementationConformanceRef)) {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_PREPARED_INPUT_WORLD_MISMATCH',
      'prepared input envelope must bind the exact current RuntimeBinding execution authority tuple'
    );
  }
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

function errorEnvelope({ world, inputEnvelope, executionIdValue, inputHash, dispatchClass, startedAt, completedAt, code, phase }) {
  return normalizeRuntimeExecutionEnvelope({
    contractVersion: RUNTIME_EXECUTION_ENVELOPE_CONTRACT_VERSION,
    authorityClass: RUNTIME_EXECUTION_AUTHORITY_CLASS,
    executionId: executionIdValue,
    dispatchClass,
    runtimeBindingRef: world.binding.record.ref,
    runtimeNodeId: inputEnvelope.runtimeNodeId,
    specificationRef: inputEnvelope.specificationRef,
    implementationRef: inputEnvelope.implementationRef,
    implementationConformanceRef: inputEnvelope.implementationConformanceRef,
    inputEnvelopeHash: inputHash,
    status: 'FAILED',
    startedAt,
    completedAt,
    rawOutput: null,
    rawOutputHash: null,
    error: { code, phase, retryDisposition: RUNTIME_EXECUTION_RETRY_DISPOSITION },
    semanticValidation: 'NOT_PERFORMED_D03_REQUIRED'
  });
}

function successEnvelope({ world, inputEnvelope, executionIdValue, inputHash, dispatchClass, startedAt, completedAt, output }) {
  if (output === null || output === undefined) {
    throw new RuntimeExecutionError('RUNTIME_EXECUTION_OUTPUT_INVALID', 'executor output cannot be null/undefined in D02');
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
    runtimeNodeId: inputEnvelope.runtimeNodeId,
    specificationRef: inputEnvelope.specificationRef,
    implementationRef: inputEnvelope.implementationRef,
    implementationConformanceRef: inputEnvelope.implementationConformanceRef,
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

function requestForInputEnvelope({ inputEnvelope, executionIdValue, registration, implementation, inputHash }) {
  const common = {
    executionId: executionIdValue,
    idempotencyKey: executionIdValue,
    dispatchClass: registration.dispatchClass,
    runtimeBindingRef: inputEnvelope.runtimeBindingRef,
    runtimeNodeId: inputEnvelope.runtimeNodeId,
    specificationRef: inputEnvelope.specificationRef,
    implementationRef: inputEnvelope.implementationRef,
    implementationConformanceRef: inputEnvelope.implementationConformanceRef,
    executionLocator: implementation.semanticPayload.executionLocator,
    inputEnvelopeHash: inputHash
  };
  if (inputEnvelope.contractVersion === RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION) {
    return deepFreeze({
      contractVersion: 'adr.executor-request.v1',
      ...common,
      inputEntries: inputEnvelope.inputEntries
    });
  }
  return deepFreeze({
    contractVersion: 'adr.executor-request.v2',
    ...common,
    contextEntries: inputEnvelope.contextEntries,
    runtimeEntries: inputEnvelope.runtimeEntries
  });
}

function inputEnvelopeHash(inputEnvelope) {
  return inputEnvelope.contractVersion === RUNTIME_EXECUTION_INPUT_CONTRACT_VERSION
    ? runtimeExecutionInputHash(inputEnvelope)
    : runtimeExecutionMixedInputHash(inputEnvelope);
}

async function dispatchWorld(broker, { world, inputEnvelope, startedAt }) {
  inputEnvelopeMatchesWorld(world, inputEnvelope);
  const inputHash = inputEnvelopeHash(inputEnvelope);
  const executionIdValue = runtimeExecutionId({
    runtimeBindingRef: world.binding.record.ref,
    runtimeNodeId: inputEnvelope.runtimeNodeId,
    inputEnvelopeHash: inputHash
  });
  const implementation = world.conformance.implementation;
  const registration = broker.executorRegistry.resolve({
    implementationRef: implementation.record.ref,
    providerType: implementation.semanticPayload.providerType
  });

  return broker.idempotencyStore.runOnce(executionIdValue, async () => {
    const request = requestForInputEnvelope({
      inputEnvelope,
      executionIdValue,
      registration,
      implementation,
      inputHash
    });
    let result;
    try {
      result = await executeWithTimeout(registration.execute, request, broker.timeoutMs);
    } catch {
      const completedAt = executionCompletedAt(broker.clock, startedAt);
      return errorEnvelope({
        world,
        inputEnvelope,
        executionIdValue,
        inputHash,
        dispatchClass: registration.dispatchClass,
        startedAt,
        completedAt,
        code: 'RUNTIME_EXECUTION_TRANSPORT_ERROR',
        phase: 'DISPATCH'
      });
    }
    const completedAt = executionCompletedAt(broker.clock, startedAt);
    if (result?.timedOut === true) {
      return errorEnvelope({
        world,
        inputEnvelope,
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
        inputEnvelope,
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
        inputEnvelope,
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
    assertExactInput(input, EXECUTE_KEYS, 'broker execute input');
    const { ledger, runtimeBindingRef, inputDatumRefs } = input;
    const startedAt = normalizeDeploymentTimestamp(this.clock(), 'executionStartedAt');
    const world = currentExecutionWorld({ ledger, runtimeBindingRef, atTime: startedAt });
    const inputEnvelope = buildLegacyInputEnvelope({
      ledger,
      bindingAuthority: world.binding,
      specification: world.conformance.specification,
      inputDatumRefs
    });
    return dispatchWorld(this, { world, inputEnvelope, startedAt });
  }

  async [PREPARED_RUNTIME_INPUT_EXECUTE](input) {
    assertExactInput(input, PREPARED_EXECUTE_KEYS, 'prepared broker execute input');
    const { ledger, runtimeBindingRef } = input;
    const startedAt = normalizeDeploymentTimestamp(this.clock(), 'executionStartedAt');
    const world = currentExecutionWorld({ ledger, runtimeBindingRef, atTime: startedAt });
    const inputEnvelope = normalizeRuntimeExecutionMixedInputEnvelope(input.inputEnvelope);
    return dispatchWorld(this, { world, inputEnvelope, startedAt });
  }
}
