import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { RuntimeExecutionError, text } from './contract.mjs';

export class RuntimeExecutionIdempotencyStore {
  #entries = new Map();

  has(executionId) {
    return this.#entries.has(text(executionId, 'executionId'));
  }

  get(executionId) {
    return this.#entries.get(text(executionId, 'executionId')) ?? null;
  }

  runOnce(executionId, factory) {
    const key = text(executionId, 'executionId');
    if (typeof factory !== 'function') {
      throw new RuntimeExecutionError('INVALID_RUNTIME_EXECUTION_FACTORY', 'idempotency factory must be a function');
    }
    const existing = this.#entries.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(factory).then((value) => deepFreeze(value));
    this.#entries.set(key, promise);
    return promise;
  }

  size() {
    return this.#entries.size;
  }
}
