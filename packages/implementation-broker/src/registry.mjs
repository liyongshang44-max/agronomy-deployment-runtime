import { canonicalizeSemanticJson, deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';
import { RuntimeExecutionError, text } from './contract.mjs';

const EXPECTED_DISPATCH_CLASS = deepFreeze({
  INTERNAL: 'INTERNAL',
  WASM: 'INTERNAL',
  HTTP: 'EXTERNAL',
  CUSTOMER: 'EXTERNAL',
  FIRST_PARTY: 'EXTERNAL',
  BATCH: 'EXTERNAL'
});

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

export class ImplementationExecutorRegistry {
  #executors = new Map();

  register({ implementationRef, dispatchClass, execute }) {
    const ref = assertAuthorityRef(implementationRef);
    if (ref.kind !== 'Implementation') {
      throw new RuntimeExecutionError('RUNTIME_EXECUTOR_IMPLEMENTATION_REQUIRED', 'executor registration requires exact Implementation ref');
    }
    const normalizedClass = text(dispatchClass, 'dispatchClass');
    if (!['INTERNAL', 'EXTERNAL'].includes(normalizedClass)) {
      throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_DISPATCH_CLASS', `unsupported dispatchClass ${normalizedClass}`);
    }
    if (typeof execute !== 'function') {
      throw new RuntimeExecutionError('RUNTIME_EXECUTOR_CALLBACK_REQUIRED', 'executor registration requires execute callback');
    }
    const key = refKey(ref);
    if (this.#executors.has(key)) {
      throw new RuntimeExecutionError('RUNTIME_EXECUTOR_DUPLICATE_REGISTRATION', 'exact Implementation already has an executor registration');
    }
    const registration = deepFreeze({ implementationRef: ref, dispatchClass: normalizedClass, execute });
    this.#executors.set(key, registration);
    return registration;
  }

  resolve({ implementationRef, providerType }) {
    const ref = assertAuthorityRef(implementationRef);
    const registration = this.#executors.get(refKey(ref));
    if (!registration) {
      throw new RuntimeExecutionError('RUNTIME_EXECUTOR_NOT_REGISTERED', 'no executor registered for exact Implementation ref');
    }
    const expected = EXPECTED_DISPATCH_CLASS[text(providerType, 'providerType')];
    if (!expected || registration.dispatchClass !== expected) {
      throw new RuntimeExecutionError(
        'RUNTIME_EXECUTOR_DISPATCH_CLASS_MISMATCH',
        `providerType ${providerType} requires ${expected ?? 'unsupported'} dispatch class`
      );
    }
    return registration;
  }
}

export function expectedDispatchClass(providerType) {
  return EXPECTED_DISPATCH_CLASS[text(providerType, 'providerType')] ?? null;
}
