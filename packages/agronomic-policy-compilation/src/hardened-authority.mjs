import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import {
  AgronomicPolicyCompilationError,
  normalizeAgronomicPolicyCompilation
} from './extended-contract.mjs';
import {
  publishAgronomicPolicyCompilation as publishBaseCompilation,
  validateAgronomicPolicyCompilationAuthority as validateBaseCompilationAuthority
} from './authority.mjs';

export const AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE = deepFreeze({
  use: 'AGRONOMIC_POLICY_INPUT'
});

function validateKnowledgePredecessor({ ledger, knowledgeRef }) {
  try {
    if (knowledgeRef.kind === 'QualifiedKnowledge') {
      return validateQualifiedKnowledgeAuthority({
        ledger,
        qualifiedKnowledgeRef: knowledgeRef,
        requiredUseTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
        allowHistorical: false
      });
    }
    if (knowledgeRef.kind === 'DerivedKnowledge') {
      return validateDerivedKnowledgeAuthority({
        ledger,
        derivedKnowledgeRef: knowledgeRef,
        requiredUseTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
        allowHistorical: false
      });
    }
    throw new Error(`unsupported knowledge authority kind ${knowledgeRef.kind}`);
  } catch (error) {
    const cause = error?.code ?? error?.message ?? 'UNKNOWN_KNOWLEDGE_AUTHORITY_FAILURE';
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for ${AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use}: ${cause}`
    );
  }
}

function validateKnowledgePredecessors({ ledger, normalized }) {
  return deepFreeze(normalized.knowledgeRefs.map((knowledgeRef) =>
    validateKnowledgePredecessor({ ledger, knowledgeRef })));
}

export function publishAgronomicPolicyCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  const normalized = normalizeAgronomicPolicyCompilation(compilation);
  validateKnowledgePredecessors({ ledger, normalized });
  return publishBaseCompilation({
    ledger,
    logicalId,
    version,
    compilation: normalized,
    audit
  });
}

export function validateAgronomicPolicyCompilationAuthority({ ledger, compilationRef }) {
  const validated = validateBaseCompilationAuthority({ ledger, compilationRef });
  validateKnowledgePredecessors({ ledger, normalized: validated.semanticPayload });
  return validated;
}
