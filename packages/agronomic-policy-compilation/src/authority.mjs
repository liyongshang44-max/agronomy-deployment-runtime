import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateSpecificationAuthority } from '../../specification-registry/src/authority.mjs';
import {
  agronomicPolicyCompilationAuthorityRefs,
  normalizeAgronomicPolicyCompilation,
  AgronomicPolicyCompilationError
} from './extended-contract.mjs';

function exactRefKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

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

function assertAudit(audit, normalized) {
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

function samePrincipal(left, right) {
  return left?.principalId === right?.principalId
    && left?.type === right?.type
    && left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function ruleAuthorityBindings(rule) {
  const bindings = [];
  for (const predicate of rule.trigger.predicates) bindings.push(...predicate.authorityBindings);
  for (const group of rule.exceptions) {
    for (const predicate of group.predicates) bindings.push(...predicate.authorityBindings);
  }
  bindings.push(...rule.action.authorityBindings);
  for (const expression of Object.values(rule.action.parameters)) bindings.push(...expression.authorityBindings);
  bindings.push(...rule.coordination.authorityBindings);
  return bindings;
}

function modelAuthorityBindings(modelDefinitions) {
  return modelDefinitions.flatMap((definition) => definition.authorityBindings);
}

function ruleSemanticDependencies(rule) {
  const semanticIds = new Set(rule.inputs);
  for (const predicate of rule.trigger.predicates) semanticIds.add(predicate.semanticId);
  for (const group of rule.exceptions) {
    for (const predicate of group.predicates) semanticIds.add(predicate.semanticId);
  }
  for (const expression of Object.values(rule.action.parameters)) {
    if (expression.sourceSemanticId) semanticIds.add(expression.sourceSemanticId);
  }
  return [...semanticIds].sort();
}

function assertProtocolArtifactClosure(ledger, normalized) {
  const coveredSourceKeys = new Set();
  for (const artifactRef of normalized.sourceProtocolArtifactRefs) {
    const artifact = ledger.resolve(artifactRef);
    if (artifact.ref.kind !== 'SourceArtifact') {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_PROTOCOL_ARTIFACT_REQUIRED',
        'sourceProtocolArtifactRefs must resolve to SourceArtifact authority'
      );
    }
    const sourceRef = artifact.semanticPayload?.sourceRef;
    const source = normalized.sourceProtocolRefs.find((candidate) => sourceRef && sameAuthorityRef(candidate, sourceRef));
    if (!source) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_SOURCE_ARTIFACT_SOURCE_MISMATCH',
        'every protocol SourceArtifact must bind one exact Source listed in sourceProtocolRefs'
      );
    }
    coveredSourceKeys.add(exactRefKey(source));
  }
  const uncovered = normalized.sourceProtocolRefs.filter((sourceRef) => !coveredSourceKeys.has(exactRefKey(sourceRef)));
  if (uncovered.length > 0) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_PROTOCOL_SOURCE_ARTIFACT_MISSING',
      'every protocol Source must have at least one exact SourceArtifact predecessor'
    );
  }
}

function assertKnowledgeClosure(normalized) {
  const allowed = new Set(normalized.knowledgeRefs.map(exactRefKey));
  for (const binding of [...ruleAuthorityBindings(normalized.rule), ...modelAuthorityBindings(normalized.modelDefinitions)]) {
    if (!allowed.has(exactRefKey(binding.authorityRef))) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_RULE_AUTHORITY_NOT_DECLARED',
        `authority binding ${binding.role} is not included in knowledgeRefs`
      );
    }
  }
}

function assertPolicySemanticClosure(policyPayload, rule) {
  const declared = new Set([
    ...(policyPayload.requiredInputs ?? []).map((port) => port.semanticId),
    ...(policyPayload.requiredRuntimeOutputs ?? []).map((port) => port.semanticId)
  ]);
  const missing = ruleSemanticDependencies(rule).filter((semanticId) => !declared.has(semanticId));
  if (missing.length > 0) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_POLICY_SEMANTIC_GAP',
      `declarative rule depends on semantic ids not declared by Policy: ${missing.join(', ')}`
    );
  }
}

function assertPolicyActionClosure(policyPayload, rule) {
  const actionSpace = policyPayload.actionSpace ?? [];
  if (!Array.isArray(actionSpace) || !actionSpace.includes(rule.action.actionCode)) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_ACTION_NOT_IN_POLICY',
      'declarative rule actionCode must be a legal action in the exact Policy actionSpace'
    );
  }
  const actionContract = policyPayload.actionSemantics?.actions
    ?.find((item) => item.actionCode === rule.action.actionCode);
  if (!actionContract) return;
  const declaredNames = new Set(actionContract.parameters.map((parameter) => parameter.name));
  const actualNames = Object.keys(rule.action.parameters);
  const undeclared = actualNames.filter((name) => !declaredNames.has(name));
  if (undeclared.length > 0) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_ACTION_PARAMETER_UNDECLARED',
      `declarative rule supplies Policy-undeclared action parameters: ${undeclared.join(', ')}`
    );
  }
  const missingRequired = actionContract.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)
    .filter((name) => !Object.prototype.hasOwnProperty.call(rule.action.parameters, name));
  if (missingRequired.length > 0) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_ACTION_PARAMETER_REQUIRED',
      `declarative rule omits required Policy action parameters: ${missingRequired.join(', ')}`
    );
  }
}

function assertPolicyDefinitionClosure(policyPayload, normalized) {
  if (policyPayload.decisionLogic?.methodId !== normalized.rule.ruleId) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_POLICY_METHOD_MISMATCH',
      'Policy decisionLogic.methodId must equal declarative rule ruleId'
    );
  }
  if (policyPayload.decisionLogic?.definitionHash !== normalized.ruleHash) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_POLICY_DEFINITION_HASH_MISMATCH',
      'Policy decisionLogic.definitionHash must equal the content hash of the declarative agronomic rule'
    );
  }
  const expectedHumanGate = normalized.rule.humanGate.required ? 'REQUIRED' : 'NONE';
  if (policyPayload.humanGate?.mode !== expectedHumanGate) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_HUMAN_GATE_MISMATCH',
      'declarative rule human gate must equal the bound Policy humanGate mode'
    );
  }
  if (policyPayload.fallback?.disposition !== normalized.rule.fallback.disposition) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_FALLBACK_MISMATCH',
      'declarative rule fallback disposition must equal the bound Policy fallback'
    );
  }
}

function modelPortIds(payload, field) {
  return new Set((payload[field] ?? []).map((port) => port.semanticId));
}

function assertModelDefinitions({ ledger, normalized }) {
  for (const definition of normalized.modelDefinitions) {
    const authority = validateSpecificationAuthority({ ledger, specificationRef: definition.modelRef });
    const payload = authority.semanticPayload;
    if (authority.record.ref.kind !== 'Model') {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_MODEL_REQUIRED',
        'modelDefinitions must bind exact governed Model specifications'
      );
    }
    if (payload.computation?.methodId !== definition.methodId) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_MODEL_METHOD_MISMATCH',
        'declarative model definition methodId must equal the bound Model computation.methodId'
      );
    }
    if (payload.computation?.definitionHash !== definition.definitionHash) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_MODEL_DEFINITION_HASH_SPEC_MISMATCH',
        'declarative model definition hash must equal the bound Model computation.definitionHash'
      );
    }
    const modelInputs = modelPortIds(payload, 'inputs');
    const modelOutputs = modelPortIds(payload, 'outputs');
    const missingInputs = definition.inputSemanticIds.filter((semanticId) => !modelInputs.has(semanticId));
    const missingOutputs = definition.outputSemanticIds.filter((semanticId) => !modelOutputs.has(semanticId));
    if (missingInputs.length > 0 || missingOutputs.length > 0) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_MODEL_SEMANTIC_PORT_MISMATCH',
        `model definition semantic ports are absent from Model specification: inputs=[${missingInputs.join(', ')}], outputs=[${missingOutputs.join(', ')}]`
      );
    }
  }
}

function assertPolicyManagementApproval({ ledger, normalized, policyAuthority }) {
  if (normalized.approvalRef.kind !== 'AuthorizationDecisionAudit') {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_APPROVAL_INVALID',
      'v1 compilation approval must reuse the exact Policy SPECIFICATION_MANAGE authorization audit'
    );
  }
  if (!sameAuthorityRef(policyAuthority.managementAuthorization.ref, normalized.approvalRef)) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_APPROVAL_POLICY_MISMATCH',
      'compilation approvalRef must equal the exact management authorization that published the bound Policy'
    );
  }
  const approval = ledger.resolve(normalized.approvalRef);
  const payload = approval.semanticPayload ?? {};
  if (payload.operation !== 'SPECIFICATION_MANAGE' || payload.allowed !== true) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_APPROVAL_INVALID',
      'bound Policy management authorization is not an allowed SPECIFICATION_MANAGE decision'
    );
  }
  if (!samePrincipal(payload.principal, normalized.approverPrincipal)) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_APPROVAL_PRINCIPAL_MISMATCH',
      'compilation approver must equal the exact principal authorized to manage the bound Policy'
    );
  }
  return approval;
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
  assertProtocolArtifactClosure(ledger, normalized);

  const policyAuthority = validateSpecificationAuthority({ ledger, specificationRef: normalized.policyRef });
  const policyPayload = policyAuthority.semanticPayload;
  if (policyPayload.decisionType !== normalized.rule.decisionType) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_DECISION_TYPE_MISMATCH',
      'declarative rule decisionType must equal the exact Policy decisionType'
    );
  }

  const thresholdRefs = policyPayload.thresholdAuthority?.authorityRefs ?? [];
  for (const thresholdRef of thresholdRefs) {
    if (!normalized.knowledgeRefs.some((knowledgeRef) => sameAuthorityRef(knowledgeRef, thresholdRef))) {
      throw new AgronomicPolicyCompilationError(
        'AGRONOMIC_POLICY_COMPILATION_THRESHOLD_AUTHORITY_MISSING',
        'every Policy threshold authority must be an exact knowledge predecessor of the compilation'
      );
    }
  }

  assertKnowledgeClosure(normalized);
  assertModelDefinitions({ ledger, normalized });
  assertPolicySemanticClosure(policyPayload, normalized.rule);
  assertPolicyActionClosure(policyPayload, normalized.rule);
  assertPolicyDefinitionClosure(policyPayload, normalized);
  const approval = assertPolicyManagementApproval({ ledger, normalized, policyAuthority });
  return deepFreeze({ refs, policyAuthority, approval });
}

export function publishAgronomicPolicyCompilation({ ledger, logicalId, version, compilation, audit }) {
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
  const normalizedAudit = assertAudit(audit, normalized);

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
        losslessCoverageStatus: normalized.losslessCoverage.status,
        policyManagementAuthorizationRef: world.approval.ref
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
      && world.refs.every((ref) => exactRefIn(event.inputRefs, ref))
      && event.details?.policyManagementAuthorizationRef
      && sameAuthorityRef(event.details.policyManagementAuthorizationRef, world.approval.ref));
  if (!validAudit) {
    throw new AgronomicPolicyCompilationError(
      'AGRONOMIC_POLICY_COMPILATION_AUDIT_INVALID',
      'AgronomicPolicyCompilation lacks direct approver audit over all exact predecessors'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    policy: world.policyAuthority.record,
    policyManagementAuthorization: world.approval
  });
}
