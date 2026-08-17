import { RuntimeExecutionError } from './contract.mjs';

export const PREPARED_RUNTIME_INPUT_EXECUTE = Symbol('ADR_D02_PREPARED_RUNTIME_INPUT_EXECUTE');

export async function executePreparedRuntimeInput(broker, input) {
  if (!broker || typeof broker[PREPARED_RUNTIME_INPUT_EXECUTE] !== 'function') {
    throw new RuntimeExecutionError(
      'RUNTIME_EXECUTION_PREPARED_BROKER_REQUIRED',
      'prepared runtime input requires an ADR RuntimeExecutionBroker instance with the private D02 capability'
    );
  }
  return broker[PREPARED_RUNTIME_INPUT_EXECUTE](input);
}
