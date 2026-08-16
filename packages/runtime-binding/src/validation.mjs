import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { validateRuntimeBinding as validateBaseRuntimeBinding } from './authority.mjs';
import { validateFrozenBindingWorldRelations } from './historical.mjs';

export function validateRuntimeBinding({ ledger, runtimeBindingRef }) {
  const validated = validateBaseRuntimeBinding({ ledger, runtimeBindingRef });
  const frozenWorld = validateFrozenBindingWorldRelations({
    ledger,
    payload: validated.semanticPayload,
    eligibilityPayload: validated.historicalRuntimeEligibility.semanticPayload
  });
  return deepFreeze({
    ...validated,
    frozenWorldRelations: frozenWorld,
    replayMode: 'EXACT_FROZEN_HISTORICAL_AUTHORITIES_NO_LATEST_LOOKUP',
    relationReplayMode: 'EXACT_FROZEN_HISTORICAL_RELATIONS_NO_LATEST_LOOKUP'
  });
}
