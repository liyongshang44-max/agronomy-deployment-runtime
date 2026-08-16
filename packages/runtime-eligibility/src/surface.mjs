import { RuntimeEligibilityError } from './contract.mjs';
import { buildRuntimeEligibility as buildInternal } from './engine.mjs';

const BUILD_INPUT_KEYS = new Set(['ledger', 'runtimePlan', 'snapshotStore']);

export function buildRuntimeEligibility(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', 'RuntimeEligibility evaluator input must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeEligibilityError('INVALID_RUNTIME_ELIGIBILITY_INPUT', 'RuntimeEligibility evaluator input must be a plain object');
  }
  for (const key of Object.keys(input)) {
    if (!BUILD_INPUT_KEYS.has(key)) {
      throw new RuntimeEligibilityError(
        'INVALID_RUNTIME_ELIGIBILITY_INPUT_FIELD',
        `${key} is not a legal R03 predecessor; acquisition options, RuntimeBinding and decision outputs cannot influence RuntimeEligibility`
      );
    }
  }
  return buildInternal(input);
}
