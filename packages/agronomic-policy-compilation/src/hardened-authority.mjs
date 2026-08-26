import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import {
  AGRONOMIC_RULE_CONTRACT_VERSION_V2,
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

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

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

function validateV2BindingClosure(normalized) {
  if (normalized.rule?.contractVersion !== AGRONOMIC_RULE_CONTRACT_VERSION_V2) return;
  const declared = new Set(normalized.knowledgeRefs.map(refKey));
  const bindings = [
    ...(normalized.rule.evaluationStart?.authorityBindings ?? []),
    ...(normalized.rule.coordination?.coordinator?.authorityBindings ?? [])
  ];
  for (const binding of bindings) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_V2_AUTHORITY_NOT_DECLARED',
        `v2 rule authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
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
  validateV2BindingClosure(normalized);
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
  validateV2BindingClosure(validated.semanticPayload);
  return validated;
}
