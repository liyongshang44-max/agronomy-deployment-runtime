import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateRightsDecision } from '../../rights-authority/src/index.mjs';
import { RightsEnforcementError } from './errors.mjs';

export const RIGHTS_COMPILATION_PROVENANCE_VERSION = 'adr.rights.compilation-provenance.v1';
export const RIGHTS_COMPILATION_AUTHORITY_CLAIM = 'RIGHTS_PROVENANCE_ONLY_NOT_SCIENTIFIC_AUTHORITY';

export function bindExtractionRightsToCompilation({ ledger, proposal, audit, rightsDecisionRefs }) {
  if (!ledger || typeof ledger.resolve !== 'function') {
    throw new RightsEnforcementError('INVALID_RIGHTS_LEDGER', 'compiler provenance binding requires AuthorityLedger');
  }
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new RightsEnforcementError('INVALID_COMPILATION_PROPOSAL', 'proposal must be an object');
  }
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    throw new RightsEnforcementError('RIGHTS_ENFORCEMENT_AUDIT_REQUIRED', 'compiler audit is required');
  }
  if (!Array.isArray(rightsDecisionRefs) || rightsDecisionRefs.length !== 2) {
    throw new RightsEnforcementError(
      'EXTRACTION_RIGHTS_DECISIONS_REQUIRED',
      'external extraction compilation requires exactly READ_FOR_EXTRACTION and MODEL_EGRESS RightsDecision refs'
    );
  }

  const validated = rightsDecisionRefs.map((ref) => validateRightsDecision({ ledger, rightsDecisionRef: ref }));
  const byOperation = new Map(validated.map((item) => [item.semanticPayload.operation, item]));
  const read = byOperation.get('READ_FOR_EXTRACTION');
  const egress = byOperation.get('MODEL_EGRESS');
  if (!read || !egress || byOperation.size !== 2) {
    throw new RightsEnforcementError(
      'EXTRACTION_RIGHTS_OPERATIONS_INVALID',
      'compiler provenance requires one READ_FOR_EXTRACTION and one MODEL_EGRESS decision'
    );
  }
  if (read.semanticPayload.outcome !== 'ALLOW' || egress.semanticPayload.outcome !== 'ALLOW') {
    throw new RightsEnforcementError('EXTRACTION_RIGHTS_NOT_ALLOWED', 'DENY RightsDecision cannot enter successful compilation provenance');
  }
  if (!sameAuthorityRef(read.semanticPayload.subjectRef, egress.semanticPayload.subjectRef)
    || !sameAuthorityRef(read.semanticPayload.rightsPolicyRef, egress.semanticPayload.rightsPolicyRef)) {
    throw new RightsEnforcementError(
      'EXTRACTION_RIGHTS_WORLD_MISMATCH',
      'READ_FOR_EXTRACTION and MODEL_EGRESS provenance must bind the same SourceArtifact and RightsPolicy'
    );
  }
  const exactRefs = deepFreeze([read.record.ref, egress.record.ref]);
  const runMetadata = cloneCanonicalValue({
    ...(proposal.runMetadata ?? {}),
    rightsDecisionRefs: exactRefs,
    rightsProvenanceVersion: RIGHTS_COMPILATION_PROVENANCE_VERSION,
    rightsAuthorityClaim: RIGHTS_COMPILATION_AUTHORITY_CLAIM
  });
  return deepFreeze({
    proposal: {
      ...cloneCanonicalValue(proposal),
      runMetadata
    },
    audit: {
      ...cloneCanonicalValue(audit),
      inputRefs: [...exactRefs, ...(audit.inputRefs ?? [])]
    },
    rightsDecisionRefs: exactRefs,
    sourceArtifactRef: read.semanticPayload.subjectRef,
    rightsPolicyRef: read.semanticPayload.rightsPolicyRef
  });
}
