import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  agronomicPolicyCompilationAuthorityRefs,
  normalizeAgronomicPolicyCompilation,
  AgronomicPolicyCompilationError
} from './contract.mjs';

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new AgronomicPolicyCompilationError(
      'INVALID_LEDGER',
      'AgronomicPolicyCompilation publication requires a replayable AuthorityLedger'
    );
  }
}

function validateResolvedRefs(ledger, refs) {
  for (const ref of refs) {
    const record = ledger.resolve(ref);
    if (!sameAuthorityRef(record.ref, ref)) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_REF_MISMATCH',
        'every compilation predecessor must resolve to its exact authority ref'
      );
    }
  }
}

function assertAudit(input, normalized) {
  const audit = input.audit;
  if (!audit || typeof audit !== 'object' || !audit.actor) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_AUDIT_REQUIRED',
      'AgronomicPolicyCompilation publication requires explicit audit metadata'
    );
  }
  if (audit.actor.id !== normalized.approverPrincipal.principalId
    || audit.actor.type !== normalized.approverPrincipal.type) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_AUDIT_ACTOR_MISMATCH',
      'audit actor must be the exact agronomic compilation approver'
    );
  }
  return audit;
}

function assertApprovalAuthority(ledger, normalized) {
  const approval = ledger.resolve(normalized.approvalRef);
  const payload = approval.semanticPayload ?? {};
  if (approval.ref.kind === 'AuthorizationDecisionAudit') {
    if (payload.allowed !== true || !['KNOWLEDGE_QUALIFY', 'KNOWLEDGE_RELEASE'].includes(payload.operation)) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_APPROVAL_INVALID',
        'AuthorizationDecisionAudit approval must be an allowed scientific/governance authorization'
      );
    }
    if (payload.principal?.principalId !== normalized.approverPrincipal.principalId
      || payload.principal?.type !== normalized.approverPrincipal.type) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_APPROVAL_PRINCIPAL_MISMATCH',
        'approval principal must equal agronomic compilation approver'
      );
    }
    return approval;
  }
  if (approval.ref.kind === 'ScientificQualificationDecision') {
    if (payload.approverPrincipal?.principalId !== normalized.approverPrincipal.principalId
      || payload.approverPrincipal?.type !== normalized.approverPrincipal.type) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_APPROVAL_PRINCIPAL_MISMATCH',
        'scientific qualification approver must equal agronomic compilation approver'
      );
    }
    return approval;
  }
  throw new AgronomicPolicyCompilationError(
    'AGRONOMIC_POLICY_COMPILATION_APPROVAL_INVALID',
    'unsupported agronomic compilation approval authority'
  );
}

function validateCompilationWorld(ledger, normalized) {
  const refs = agronomicPolicyCompilationAuthorityRefs(normalized);
  validateResolvedRefs(ledger, refs);

  for (const sourceRef of normalized.sourceProtocolRefs) {
    const source = ledger.resolve(sourceRef);
    if (source.semanticPayload?.sourceType !== 'PROTOCOL') {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_PROTOCOL_SOURCE_REQUIRED',
        'sourceProtocolRefs must resolve to Source authority with sourceType PROTOCOL'
      );
    }
  }

  const policy = ledger.resolve(normalized.policyRef);
  if (policy.semanticPayload?.decisionType !== normalized.rule.decisionType) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_DECISION_TYPE_MISMATCH',
      'declarative rule decisionType must equal the exact Policy decisionType'
    );
  }
  const actionSpace = policy.semanticPayload?.actionSpace ?? [];
  if (!Array.isArray(actionSpace) || !actionSpace.includes(normalized.rule.action.actionCode)) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_ACTION_NOT_IN_POLICY',
      'declarative rule actionCode must be a legal action in the exact Policy actionSpace'
    );
  }

  const thresholdRefs = policy.semanticPayload?.thresholdAuthority?.authorityRefs ?? [];
  const compilationKnowledgeRefs = normalized.knowledgeRefs;
  for (const thresholdRef of thresholdRefs) {
    if (!compilationKnowledgeRefs.some((knowledgeRef) => sameAuthorityRef(knowledgeRef, thresholdRef))) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_THRESHOLD_AUTHORITY_MISSING',
        'every Policy threshold authority must be an exact knowledge predecessor of the compilation'
      );
    }
  }

  assertApprovalAuthority(ledger, normalized);
  return deepFreeze({ refs, policy });
}

export function publishAgronomicPolicyCompilation({
  ledger,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  if (typeof logicalId !== 'string' || logicalId.trim().length === 0
    || typeof version !== 'string' || version.trim().length === 0) {
    throw new AgronomicPolicyCompilationError(
      'INVALID_AGRONOMIC_POLICY_COMPILATION_IDENTITY',
      'logicalId and version must be non-empty strings'
    );
  }
  const normalized = normalizeAgronomicPolicyCompilation(compilation);
  const world = validateCompilationWorld(ledger, normalized);
  const normalizedAudit = assertAudit({ audit }, normalized);

  return ledger.publish({
    kind: 'AgronomicPolicyCompilation',
    logicalId: logicalId.trim(),
    version: version.trim(),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...normalizedAudit,
      action: 'PUBLISH_AGRONOMIC_POLICY_COMPILATION',
      inputRefs: [...world.refs, ...(normalizedAudit.inputRefs ?? [])],
      details: {
        ...(normalizedAudit.details ?? {}),
        authorityClass: 'AGRONOMIC_POLICY_COMPILATION_AUTHORITY',
        ruleHash: normalized.ruleHash,
        losslessCoverageStatus: normalized.losslessCoverage.status
      }
    }
  });
}

export function validateAgronomicPolicyCompilationAuthority({ ledger, compilationRef }) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicPolicyCompilation') {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_REQUIRED',
      `expected AgronomicPolicyCompilation, received ${record.ref.kind}`
    );
  }
  const normalized = normalizeAgronomicPolicyCompilation(record.semanticPayload);
  const world = validateCompilationWorld(ledger, normalized);
  const directAudits = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  const validAudit = directAudits.some((event) =>
    event.action === 'PUBLISH_AGRONOMIC_POLICY_COMPILATION'
      && event.actor?.id === normalized.approverPrincipal.principalId
      && event.actor?.type === normalized.approverPrincipal.type
      && world.refs.every((ref) => exactRefIn(event.inputRefs, ref)));
  if (!validAudit) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_AUDIT_INVALID',
      'AgronomicPolicyCompilation lacks direct approver audit over all exact predecessors'
    );
  }
  return deepFreeze({ record, semanticPayload: normalized, policy: world.policy });
}
