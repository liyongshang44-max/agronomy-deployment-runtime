import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { RightsEnforcementError } from './errors.mjs';

export const RIGHTS_GOVERNED_EXTERNAL_EXTRACTION_VERSION = 'adr.rights.governed-external-extraction.v1';

function requiredUse(use, operation, name) {
  if (!use || typeof use !== 'object' || Array.isArray(use)) {
    throw new RightsEnforcementError('RIGHTS_USE_REQUIRED', `${name} is required`);
  }
  if (use.operation !== operation) {
    throw new RightsEnforcementError('RIGHTS_OPERATION_MISMATCH', `${name}.operation must be ${operation}`);
  }
  return use;
}

export class RightsGovernedExternalExtraction {
  #sourceRegistry;
  #gate;

  constructor({ sourceRegistry, gate }) {
    if (!sourceRegistry || typeof sourceRegistry.resolveArtifact !== 'function' || typeof sourceRegistry.readArtifactStream !== 'function') {
      throw new RightsEnforcementError('INVALID_SOURCE_REGISTRY', 'governed external extraction requires SourceRegistry');
    }
    if (!gate || typeof gate.execute !== 'function') {
      throw new RightsEnforcementError('INVALID_RIGHTS_EFFECT_GATE', 'governed external extraction requires RightsEffectGate');
    }
    this.#sourceRegistry = sourceRegistry;
    this.#gate = gate;
  }

  async extract({ artifactRef, readUse, modelEgressUse, provider }) {
    if (typeof provider !== 'function') {
      throw new RightsEnforcementError('EXTERNAL_PROVIDER_REQUIRED', 'governed external extraction requires provider callback');
    }
    const artifact = this.#sourceRegistry.resolveArtifact(artifactRef);
    const read = requiredUse(readUse, 'READ_FOR_EXTRACTION', 'readUse');
    const egress = requiredUse(modelEgressUse, 'MODEL_EGRESS', 'modelEgressUse');
    if (!sameAuthorityRef(read.subjectRef, artifact.ref) || !sameAuthorityRef(egress.subjectRef, artifact.ref)) {
      throw new RightsEnforcementError(
        'RIGHTS_EXTRACTION_SUBJECT_MISMATCH',
        'READ_FOR_EXTRACTION and MODEL_EGRESS must bind the exact SourceArtifact'
      );
    }
    if (!sameAuthorityRef(read.rightsPolicyRef, egress.rightsPolicyRef)) {
      throw new RightsEnforcementError(
        'RIGHTS_EXTRACTION_POLICY_MISMATCH',
        'READ_FOR_EXTRACTION and MODEL_EGRESS must evaluate the same RightsPolicy world'
      );
    }

    const executed = await this.#gate.execute({
      uses: [read, egress],
      effect: async ({ rightsDecisionRefs }) => {
        const readable = this.#sourceRegistry.readArtifactStream(artifact.ref);
        return provider({
          artifact,
          readable,
          rightsDecisionRefs
        });
      }
    });

    return deepFreeze({
      providerResult: executed.value,
      rightsDecisionRefs: executed.rightsDecisionRefs,
      version: RIGHTS_GOVERNED_EXTERNAL_EXTRACTION_VERSION
    });
  }
}
