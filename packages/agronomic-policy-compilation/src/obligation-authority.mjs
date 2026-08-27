import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { validateSpecificationAuthority } from '../../specification-registry/src/authority.mjs';
import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from './hardened-authority.mjs';
import {
  AgronomicPolicyObligationCompilationError,
  agronomicPolicyObligationCompilationAuthorityRefs,
  normalizeAgronomicPolicyObligationCompilation
} from './obligation-contract.mjs';

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_LEDGER',
      'AgronomicPolicyObligationCompilation requires a replayable AuthorityLedger'
    );
  }
}

function samePrincipal(left, right) {
  return left?.principalId === right?.principalId
    && left?.type === right?.type
    && left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function validateResolvedRefs(ledger, refs) {
  for (const ref of refs) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicPolicyObligationCompilationError(
        'AGRONOMIC_POLICY_OBLIGATION_REF_MISMATCH',
        'every obligation predecessor must resolve to its exact authority ref'
      );
    }
  }
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
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for ${AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use}: ${cause}`
    );
  }
}

function obligationBindings(obligation) {
  return [
    ...obligation.authorityBindings,
    ...obligation.occurrence.authorityBindings,
    ...obligation.occurrence.period.authorityBindings
  ];
}

function assertProtocolArtifactClosure(ledger, normalized) {
  const covered = new Set();
  for (const artifactRef of normalized.sourceProtocolArtifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicPolicyObligationCompilationError(
        'AGRONOMIC_POLICY_OBLIGATION_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    const sourceRef = artifact.semanticPayload?.sourceRef;
    const source = normalized.sourceProtocolRefs.find(
      (candidate) => sourceRef && sameAuthorityRef(candidate, sourceRef)
    );
    if (!source) {
      throw new AgronomicPolicyObligationCompilationError(
        'AGRONOMIC_POLICY_OBLIGATION_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every protocol SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
    covered.add(refKey(source));
  }
  const missing = normalized.sourceProtocolRefs.filter(
    (sourceRef) => !covered.has(refKey(sourceRef))
  );
  if (missing.length > 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_PROTOCOL_SOURCE_ARTIFACT_MISSING',
      'every protocol Source must have at least one exact SourceArtifact predecessor'
    );
  }
}

function assertKnowledgeClosure(normalized) {
  const declared = new Set(normalized.knowledgeRefs.map(refKey));
  for (const binding of obligationBindings(normalized.obligation)) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicPolicyObligationCompilationError(
        'AGRONOMIC_POLICY_OBLIGATION_AUTHORITY_NOT_DECLARED',
        `obligation authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertPolicyClosure(policyAuthority, normalized) {
  const payload = policyAuthority.semanticPayload;
  const obligation = normalized.obligation;
  if (payload.decisionType !== obligation.decisionType) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_DECISION_TYPE_MISMATCH',
      'obligation decisionType must equal the exact Policy decisionType'
    );
  }
  if (!Array.isArray(payload.actionSpace) || !payload.actionSpace.includes(obligation.actionCode)) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_ACTION_NOT_IN_POLICY',
      'obligation actionCode must remain a legal member of the exact Policy actionSpace'
    );
  }
}

function assertPolicyManagementApproval({ ledger, normalized, policyAuthority }) {
  if (!sameAuthorityRef(policyAuthority.managementAuthorization.ref, normalized.approvalRef)) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_APPROVAL_POLICY_MISMATCH',
      'obligation compilation approvalRef must equal the exact management authorization that published the bound Policy'
    );
  }
  const approval = ledger.resolve(normalized.approvalRef);
  const payload = approval.semanticPayload ?? {};
  if (payload.operation !== 'SPECIFICATION_MANAGE' || payload.allowed !== true) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_APPROVAL_INVALID',
      'bound Policy management authorization is not an allowed SPECIFICATION_MANAGE decision'
    );
  }
  if (!samePrincipal(payload.principal, normalized.approverPrincipal)) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_APPROVAL_PRINCIPAL_MISMATCH',
      'obligation compilation approver must equal the exact principal authorized to manage the bound Policy'
    );
  }
  return approval;
}

function validateWorld(ledger, normalized) {
  const refs = agronomicPolicyObligationCompilationAuthorityRefs(normalized);
  validateResolvedRefs(ledger, refs);

  for (const sourceRef of normalized.sourceProtocolRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicPolicyObligationCompilationError(
        'AGRONOMIC_POLICY_OBLIGATION_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }
  assertProtocolArtifactClosure(ledger, normalized);

  for (const knowledgeRef of normalized.knowledgeRefs) {
    validateKnowledgePredecessor({ ledger, knowledgeRef });
  }
  assertKnowledgeClosure(normalized);

  const policyAuthority = validateSpecificationAuthority({
    ledger,
    specificationRef: normalized.policyRef
  });
  if (policyAuthority.record.ref.kind !== 'Policy') {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_POLICY_REQUIRED',
      'policyRef must bind exact governed Policy authority'
    );
  }
  assertPolicyClosure(policyAuthority, normalized);
  const approval = assertPolicyManagementApproval({ ledger, normalized, policyAuthority });
  return deepFreeze({ refs, policyAuthority, approval });
}

function assertAudit(audit, normalized) {
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_AUDIT_REQUIRED',
      'obligation publication requires explicit audit metadata'
    );
  }
  if (audit.actor.id !== normalized.approverPrincipal.principalId
    || audit.actor.type !== normalized.approverPrincipal.type) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_AUDIT_ACTOR_MISMATCH',
      'audit actor must be the exact obligation compilation approver'
    );
  }
}

export function publishAgronomicPolicyObligationCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  if (typeof logicalId !== 'string' || logicalId.trim().length === 0
    || typeof version !== 'string' || version.trim().length === 0) {
    throw new AgronomicPolicyObligationCompilationError(
      'INVALID_AGRONOMIC_POLICY_OBLIGATION_IDENTITY',
      'logicalId and version must be non-empty strings'
    );
  }
  const normalized = normalizeAgronomicPolicyObligationCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 hard REQUIRE obligation authority may be published only with COMPLETE lossless coverage'
    );
  }
  const world = validateWorld(ledger, normalized);
  assertAudit(audit, normalized);

  return ledger.publish({
    kind: 'AgronomicPolicyObligationCompilation',
    logicalId: logicalId.trim(),
    version: version.trim(),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_POLICY_OBLIGATION_COMPILATION',
      inputRefs: [...world.refs, ...(audit.inputRefs ?? [])],
      details: {
        ...(audit.details ?? {}),
        authorityClass: 'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_AUTHORITY',
        obligationHash: normalized.obligationHash,
        losslessCoverageStatus: normalized.losslessCoverage.status,
        policyManagementAuthorizationRef: world.approval.ref
      }
    }
  });
}

export function validateAgronomicPolicyObligationCompilationAuthority({
  ledger,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicPolicyObligationCompilation') {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_COMPILATION_REQUIRED',
      `expected AgronomicPolicyObligationCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicPolicyObligationCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 obligation authority must have COMPLETE lossless coverage'
    );
  }
  const world = validateWorld(ledger, normalized);
  const directAudits = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const validAudit = directAudits.some((event) =>
    event.action === 'PUBLISH_AGRONOMIC_POLICY_OBLIGATION_COMPILATION'
      && event.actor?.id === normalized.approverPrincipal.principalId
      && event.actor?.type === normalized.approverPrincipal.type
      && world.refs.every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.policyManagementAuthorizationRef
      && sameAuthorityRef(event.details.policyManagementAuthorizationRef, world.approval.ref)
  );
  if (!validAudit) {
    throw new AgronomicPolicyObligationCompilationError(
      'AGRONOMIC_POLICY_OBLIGATION_AUDIT_INVALID',
      'obligation compilation lacks direct approver audit over all exact predecessors'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    policy: world.policyAuthority.record,
    policyManagementAuthorization: world.approval
  });
}
