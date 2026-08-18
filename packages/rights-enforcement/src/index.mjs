import { deepFreeze } from '../../canonicalization/src/index.mjs';
import {
  RightsAuthorityError,
  assertRightsAllowed,
  publishRightsDecision
} from '../../rights-authority/src/index.mjs';
import { RightsEnforcementError } from './errors.mjs';

export { RightsEnforcementError } from './errors.mjs';
export { RightsGovernedPilotSourceIngestion, RIGHTS_GOVERNED_SOURCE_INGESTION_VERSION } from './pilot-source.mjs';
export { RightsGovernedExternalExtraction, RIGHTS_GOVERNED_EXTERNAL_EXTRACTION_VERSION } from './external-extraction.mjs';

export const RIGHTS_EFFECT_GATE_VERSION = 'adr.rights.effect-gate.v1';
export const RIGHTS_EFFECT_GATE_AUTHORITY_CLAIM = 'ENFORCEMENT_ONLY_NOT_DOMAIN_OR_DECISION_AUTHORITY';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function requiredUse(use, index) {
  if (!use || typeof use !== 'object' || Array.isArray(use)) {
    throw new RightsEnforcementError('INVALID_RIGHTS_USE', `uses[${index}] must be an object`);
  }
  if (!Array.isArray(use.enforceableObligations)) {
    throw new RightsEnforcementError(
      'RIGHTS_ENFORCEMENT_CAPABILITIES_REQUIRED',
      `uses[${index}].enforceableObligations must be an explicit array`
    );
  }
  if (!use.audit || typeof use.audit !== 'object' || Array.isArray(use.audit)) {
    throw new RightsEnforcementError('RIGHTS_ENFORCEMENT_AUDIT_REQUIRED', `uses[${index}].audit is required`);
  }
  return {
    logicalId: requiredText(use.logicalId, `uses[${index}].logicalId`),
    version: requiredText(use.version, `uses[${index}].version`),
    rightsPolicyRef: use.rightsPolicyRef,
    subjectRef: use.subjectRef,
    actor: use.actor,
    evaluatorPrincipal: use.evaluatorPrincipal,
    operation: requiredText(use.operation, `uses[${index}].operation`),
    purpose: requiredText(use.purpose, `uses[${index}].purpose`),
    jurisdiction: requiredText(use.jurisdiction, `uses[${index}].jurisdiction`),
    evaluatedAt: requiredText(use.evaluatedAt, `uses[${index}].evaluatedAt`),
    enforceableObligations: [...new Set(use.enforceableObligations.map((value) => requiredText(value, `uses[${index}].enforceableObligations[]`)))].sort(),
    audit: use.audit
  };
}

export class RightsEffectGate {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
      throw new RightsEnforcementError('INVALID_RIGHTS_LEDGER', 'RightsEffectGate requires shared AuthorityLedger');
    }
    this.#ledger = ledger;
  }

  authorize(useInput) {
    const use = requiredUse(useInput, 0);
    const decision = publishRightsDecision({
      ledger: this.#ledger,
      logicalId: use.logicalId,
      version: use.version,
      rightsPolicyRef: use.rightsPolicyRef,
      subjectRef: use.subjectRef,
      actor: use.actor,
      evaluatorPrincipal: use.evaluatorPrincipal,
      operation: use.operation,
      purpose: use.purpose,
      jurisdiction: use.jurisdiction,
      evaluatedAt: use.evaluatedAt,
      audit: use.audit
    });
    assertRightsAllowed({
      ledger: this.#ledger,
      rightsDecisionRef: decision.ref,
      subjectRef: use.subjectRef,
      actor: use.actor,
      operation: use.operation,
      purpose: use.purpose,
      jurisdiction: use.jurisdiction,
      requiredAt: use.evaluatedAt,
      enforceableObligations: use.enforceableObligations
    });
    return decision;
  }

  async execute({ uses, effect }) {
    if (!Array.isArray(uses) || uses.length === 0) {
      throw new RightsEnforcementError('RIGHTS_USE_REQUIRED', 'execute requires at least one rights use');
    }
    if (typeof effect !== 'function') {
      throw new RightsEnforcementError('RIGHTS_EFFECT_REQUIRED', 'execute requires an effect function');
    }

    const decisions = [];
    for (let index = 0; index < uses.length; index += 1) {
      const normalized = requiredUse(uses[index], index);
      try {
        decisions.push(this.authorize(normalized));
      } catch (error) {
        if (error instanceof RightsAuthorityError || error instanceof RightsEnforcementError) throw error;
        throw new RightsEnforcementError('RIGHTS_AUTHORIZATION_FAILED', 'rights authorization failed before side effect');
      }
    }

    const rightsDecisionRefs = decisions.map((decision) => decision.ref);
    const value = await effect({ rightsDecisionRefs: deepFreeze(rightsDecisionRefs) });
    return deepFreeze({
      rightsDecisionRefs,
      value,
      gateVersion: RIGHTS_EFFECT_GATE_VERSION,
      authorityClaim: RIGHTS_EFFECT_GATE_AUTHORITY_CLAIM
    });
  }
}
