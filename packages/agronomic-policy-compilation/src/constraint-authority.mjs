import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { validateDerivedKnowledgeAuthority } from '../../synthesis-engine/src/authority.mjs';
import { validateSpecificationAuthority } from '../../specification-registry/src/authority.mjs';
import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from './hardened-authority.mjs';
import {
  AgronomicPolicyConstraintCompilationError,
  agronomicPolicyConstraintCompilationAuthorityRefs,
  normalizeAgronomicPolicyConstraintCompilation
} from './constraint-contract.mjs';

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_LEDGER',
      'AgronomicPolicyConstraintCompilation requires a replayable AuthorityLedger'
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
      throw new AgronomicPolicyConstraintCompilationError(
        'AGRONOMIC_POLICY_CONSTRAINT_REF_MISMATCH',
        'every constraint predecessor must resolve to its exact authority ref'
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
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_KNOWLEDGE_AUTHORITY_INVALID',
      `knowledge predecessor ${knowledgeRef.kind}/${knowledgeRef.logicalId}@${knowledgeRef.version} is not active authority for ${AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE.use}: ${cause}`
    );
  }
}

function constraintBindings(constraint) {
  const bindings = [...constraint.authorityBindings];
  if (constraint.when) {
    for (const predicate of constraint.when.predicates) bindings.push(...predicate.authorityBindings);
  }
  for (const group of constraint.exceptions) {
    for (const predicate of group.predicates) bindings.push(...predicate.authorityBindings);
  }
  return bindings;
}

function constraintSemanticDependencies(constraint) {
  const ids = new Set();
  if (constraint.when) {
    for (const predicate of constraint.when.predicates) ids.add(predicate.semanticId);
  }
  for (const group of constraint.exceptions) {
    for (const predicate of group.predicates) ids.add(predicate.semanticId);
  }
  return [...ids].sort();
}

function assertProtocolArtifactClosure(ledger, normalized) {
  const covered = new Set();
  for (const artifactRef of normalized.sourceProtocolArtifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicPolicyConstraintCompilationError(
        'AGRONOMIC_POLICY_CONSTRAINT_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    const sourceRef = artifact.semanticPayload?.sourceRef;
    const source = normalized.sourceProtocolRefs.find((candidate) => sourceRef && sameAuthorityRef(candidate, sourceRef));
    if (!source) {
      throw new AgronomicPolicyConstraintCompilationError(
        'AGRONOMIC_POLICY_CONSTRAINT_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every protocol SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
    covered.add(refKey(source));
  }
  const missing = normalized.sourceProtocolRefs.filter((sourceRef) => !covered.has(refKey(sourceRef)));
  if (missing.length > 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_PROTOCOL_SOURCE_ARTIFACT_MISSING',
      'every protocol Source must have at least one exact SourceArtifact predecessor'
    );
  }
}

function assertKnowledgeClosure(normalized) {
  const declared = new Set(normalized.knowledgeRefs.map(refKey));
  for (const binding of constraintBindings(normalized.constraint)) {
    if (!declared.has(refKey(binding.authorityRef))) {
      throw new AgronomicPolicyConstraintCompilationError(
        'AGRONOMIC_POLICY_CONSTRAINT_AUTHORITY_NOT_DECLARED',
        `constraint authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertPolicyClosure(policyAuthority, normalized) {
  const payload = policyAuthority.semanticPayload;
  const constraint = normalized.constraint;

  if (payload.decisionType !== constraint.decisionType) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_DECISION_TYPE_MISMATCH',
      'constraint decisionType must equal the exact Policy decisionType'
    );
  }

  if (!Array.isArray(payload.actionSpace) || !payload.actionSpace.includes(constraint.actionCode)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_ACTION_NOT_IN_POLICY',
      'constraint actionCode must remain a legal member of the exact Policy actionSpace'
    );
  }

  const declaredSemanticIds = new Set([
    ...(payload.requiredInputs ?? []).map((port) => port.semanticId),
    ...(payload.requiredRuntimeOutputs ?? []).map((port) => port.semanticId)
  ]);
  const missing = constraintSemanticDependencies(constraint)
    .filter((semanticId) => !declaredSemanticIds.has(semanticId));
  if (missing.length > 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_POLICY_SEMANTIC_GAP',
      `constraint depends on semantic ids not declared by Policy: ${missing.join(', ')}`
    );
  }
}

function assertPolicyManagementApproval({ ledger, normalized, policyAuthority }) {
  if (normalized.approvalRef.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_APPROVAL_INVALID',
      'constraint compilation approval must reuse the exact Policy SPECIFICATION_MANAGE authorization audit'
    );
  }
  if (!sameAuthorityRef(policyAuthority.managementAuthorization.ref, normalized.approvalRef)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_APPROVAL_POLICY_MISMATCH',
      'constraint compilation approvalRef must equal the exact management authorization that published the bound Policy'
    );
  }
  const approval = ledger.resolve(normalized.approvalRef);
  const payload = approval.semanticPayload ?? {};
  if (payload.operation !== 'SPECIFICATION_MANAGE' || payload.allowed !== true) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_APPROVAL_INVALID',
      'bound Policy management authorization is not an allowed SPECIFICATION_MANAGE decision'
    );
  }
  if (!samePrincipal(payload.principal, normalized.approverPrincipal)) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_APPROVAL_PRINCIPAL_MISMATCH',
      'constraint compilation approver must equal the exact principal authorized to manage the bound Policy'
    );
  }
  return approval;
}

function validateWorld(ledger, normalized) {
  const refs = agronomicPolicyConstraintCompilationAuthorityRefs(normalized);
  validateResolvedRefs(ledger, refs);

  for (const sourceRef of normalized.sourceProtocolRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicPolicyConstraintCompilationError(
        'AGRONOMIC_POLICY_CONSTRAINT_PROTOCOL_SOURCE_REQUIRED',
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
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_POLICY_REQUIRED',
      'policyRef must bind exact governed Policy authority'
    );
  }
  assertPolicyClosure(policyAuthority, normalized);
  const approval = assertPolicyManagementApproval({ ledger, normalized, policyAuthority });

  return deepFreeze({ refs, policyAuthority, approval });
}

function assertAudit(audit, normalized) {
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_AUDIT_REQUIRED',
      'constraint publication requires explicit audit metadata'
    );
  }
  if (audit.actor.id !== normalized.approverPrincipal.principalId
    || audit.actor.type !== normalized.approverPrincipal.type) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_AUDIT_ACTOR_MISMATCH',
      'audit actor must be the exact constraint compilation approver'
    );
  }
  return audit;
}

export function publishAgronomicPolicyConstraintCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  if (typeof logicalId !== 'string' || logicalId.trim().length === 0
    || typeof version !== 'string' || version.trim().length === 0) {
    throw new AgronomicPolicyConstraintCompilationError(
      'INVALID_AGRONOMIC_POLICY_CONSTRAINT_IDENTITY',
      'logicalId and version must be non-empty strings'
    );
  }
  const normalized = normalizeAgronomicPolicyConstraintCompilation(compilation);
  const world = validateWorld(ledger, normalized);
  const normalizedAudit = assertAudit(audit, normalized);

  return ledger.publish({
    kind: 'AgronomicPolicyConstraintCompilation',
    logicalId: logicalId.trim(),
    version: version.trim(),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...normalizedAudit,
      action: 'PUBLISH_AGRONOMIC_POLICY_CONSTRAINT_COMPILATION',
      inputRefs: [...world.refs, ...(normalizedAudit.inputRefs ?? [])],
      details: {
        ...(normalizedAudit.details ?? {}),
        authorityClass: 'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_AUTHORITY',
        constraintHash: normalized.constraintHash,
        losslessCoverageStatus: normalized.losslessCoverage.status,
        policyManagementAuthorizationRef: world.approval.ref
      }
    }
  });
}

export function validateAgronomicPolicyConstraintCompilationAuthority({
  ledger,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicPolicyConstraintCompilation') {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_COMPILATION_REQUIRED',
      `expected AgronomicPolicyConstraintCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicPolicyConstraintCompilation(record.semanticPayload);
  const world = validateWorld(ledger, normalized);
  const directAudits = ledger.auditFor(record.ref)
    .filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const validAudit = directAudits.some((event) =>
    event.action === 'PUBLISH_AGRONOMIC_POLICY_CONSTRAINT_COMPILATION'
      && event.actor?.id === normalized.approverPrincipal.principalId
      && event.actor?.type === normalized.approverPrincipal.type
      && world.refs.every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.policyManagementAuthorizationRef
      && sameAuthorityRef(event.details.policyManagementAuthorizationRef, world.approval.ref));

  if (!validAudit) {
    throw new AgronomicPolicyConstraintCompilationError(
      'AGRONOMIC_POLICY_CONSTRAINT_AUDIT_INVALID',
      'constraint compilation lacks direct approver audit over all exact predecessors'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    policy: world.policyAuthority.record,
    policyManagementAuthorization: world.approval
  });
}
