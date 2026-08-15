import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { makeAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeKnowledgeQualification,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { validateQualifiedKnowledgeAuthority } from '../../knowledge-registry/src/qualified-authority.mjs';
import { normalizeScientificUseTarget } from '../../knowledge-registry/src/qualification.mjs';

export const DERIVATION_METHOD_TYPES = deepFreeze([
  'GOVERNED_SYNTHESIS',
  'META_ANALYSIS',
  'PARAMETER_SYNTHESIS',
  'APPROVED_AGGREGATION'
]);

export const DERIVED_CONTEXT_POLICIES = deepFreeze([
  'PRESERVE_ALL_ORIGINS',
  'INTERSECTION_WITH_EXPLICIT_RESTRICTIONS'
]);

const METHOD_TYPES = new Set(DERIVATION_METHOD_TYPES);
const CONTEXT_POLICIES = new Set(DERIVED_CONTEXT_POLICIES);
const FORBIDDEN_METHOD_SHORTCUTS = new Set(['NEWEST_WINS', 'LLM_PREFERENCE', 'SIMPLE_AVERAGE', 'LOCAL_CALIBRATION_AS_KNOWLEDGE']);

export class SynthesisAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SynthesisAuthorityError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SynthesisAuthorityError('INVALID_SYNTHESIS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function requiredObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SynthesisAuthorityError('INVALID_SYNTHESIS_INPUT', `${name} must be an object`);
  }
  return deepFreeze(cloneCanonicalValue(value));
}

function objectList(values, name) {
  if (!Array.isArray(values)) throw new SynthesisAuthorityError('INVALID_SYNTHESIS_INPUT', `${name} must be an array`);
  return deepFreeze(values.map((value, index) => requiredObject(value, `${name}[${index}]`)));
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(ref);
  if (record.ref.kind !== kind) throw new SynthesisAuthorityError(code, `expected ${kind}, received ${record.ref.kind}`);
  return record;
}

function sameOwnership(left, right) {
  return left?.organizationId === right?.organizationId && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function auditEvent(base, suffix, inputRefs) {
  if (!base || typeof base !== 'object') throw new SynthesisAuthorityError('AUDIT_REQUIRED', 'explicit audit metadata is required');
  return {
    ...base,
    eventId: `${requiredText(base.eventId, 'audit.eventId')}:${suffix}`,
    inputRefs: [...inputRefs, ...(base.inputRefs ?? [])]
  };
}

function predictedRef(kind, logicalId, version, semanticPayload) {
  return makeAuthorityRef({
    kind,
    logicalId: requiredText(logicalId, `${kind}.logicalId`),
    version: requiredText(version, `${kind}.version`),
    semanticHash: semanticHash(kind, semanticPayload)
  });
}

function containsForbiddenShortcut(value, path = 'methodSpec') {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (FORBIDDEN_METHOD_SHORTCUTS.has(normalized)) return { path, shortcut: normalized };
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = containsForbiddenShortcut(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const keyFound = containsForbiddenShortcut(key, `${path}.<key>`);
      if (keyFound) return keyFound;
      const found = containsForbiddenShortcut(child, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

export function derivationMethodResourceId(logicalId) {
  return `derivation-method:${requiredText(logicalId, 'logicalId')}`;
}

export function synthesisResourceId(derivationMethodRef) {
  const ref = derivationMethodRef;
  return `derived-knowledge-synthesis:${ref.kind}/${ref.logicalId}@${ref.version}#${ref.semanticHash}`;
}

function assertScientificApproval({ ledger, authorizationDecisionAuditRef, approverPrincipal, policyResourceId, useTarget, ownership, audit }) {
  if (!approverPrincipal || typeof approverPrincipal !== 'object' || Array.isArray(approverPrincipal)) {
    throw new SynthesisAuthorityError('SCIENTIFIC_APPROVER_REQUIRED', 'exact scientific approver principal is required');
  }
  if (!audit?.actor || audit.actor.id !== approverPrincipal.principalId || audit.actor.type !== approverPrincipal.type) {
    throw new SynthesisAuthorityError('SCIENTIFIC_APPROVER_ACTOR_MISMATCH', 'audit actor must match exact scientific approver');
  }
  const authAudit = resolveKind(ledger, authorizationDecisionAuditRef, 'AuthorizationDecisionAudit', 'SYNTHESIS_AUTHORIZATION_REQUIRED');
  const stored = authAudit.semanticPayload;
  if (stored.operation !== 'KNOWLEDGE_QUALIFY' || stored.allowed !== true || !samePrincipalIdentity(stored.principal, approverPrincipal)) {
    throw new SynthesisAuthorityError('SYNTHESIS_AUTHORIZATION_DENIED', 'governed synthesis requires allowed KNOWLEDGE_QUALIFY authorization');
  }
  const policy = resolveKind(ledger, stored.policyRef, 'KnowledgeGovernancePolicy', 'SYNTHESIS_POLICY_REQUIRED');
  if (policy.semanticPayload.resourceId !== policyResourceId) {
    throw new SynthesisAuthorityError('SYNTHESIS_POLICY_RESOURCE_MISMATCH', 'synthesis policy is not bound to exact governed resource');
  }
  if (!sameOwnership(policy.semanticPayload.ownership, ownership)) {
    throw new SynthesisAuthorityError('SYNTHESIS_POLICY_OWNERSHIP_MISMATCH', 'synthesis policy ownership differs from governed knowledge ownership');
  }
  const assignments = (stored.assignmentRefs ?? []).map((ref) => resolveKind(ledger, ref, 'RoleAssignment', 'SYNTHESIS_ROLE_REQUIRED'));
  const recomputed = authorizeKnowledgeQualification({
    principal: approverPrincipal,
    policy,
    roleAssignments: assignments,
    qualificationTarget: useTarget,
    authorizationScope: stored.request?.authorizationScope
  });
  if (!recomputed.allowed || recomputed.decisionHash !== stored.decisionHash) {
    throw new SynthesisAuthorityError('SYNTHESIS_AUTHORIZATION_MISMATCH', 'stored synthesis authorization cannot be reproduced');
  }
  return deepFreeze({ authAudit, policy });
}

function assertDerivationMethodAuthority({ ledger, methodRef }) {
  const method = resolveKind(ledger, methodRef, 'DerivationMethod', 'DERIVATION_METHOD_REQUIRED');
  const payload = method.semanticPayload;
  if (payload.authorityClass !== 'DERIVATION_METHOD_AUTHORITY') {
    throw new SynthesisAuthorityError('DERIVATION_METHOD_INVALID', 'DerivationMethod authorityClass is invalid');
  }
  if (!METHOD_TYPES.has(payload.methodType) || !CONTEXT_POLICIES.has(payload.contextPolicy)) {
    throw new SynthesisAuthorityError('DERIVATION_METHOD_INVALID', 'DerivationMethod type/context policy is invalid');
  }
  const forbiddenInSpec = containsForbiddenShortcut(payload.methodSpec);
  if (forbiddenInSpec) {
    throw new SynthesisAuthorityError('FORBIDDEN_DERIVATION_SHORTCUT', `${forbiddenInSpec.shortcut} is embedded in ${forbiddenInSpec.path}`);
  }
  for (const required of FORBIDDEN_METHOD_SHORTCUTS) {
    if (!(payload.prohibitedShortcuts ?? []).includes(required)) {
      throw new SynthesisAuthorityError('DERIVATION_METHOD_INVALID', `DerivationMethod no longer prohibits ${required}`);
    }
  }
  const approval = assertScientificApproval({
    ledger,
    authorizationDecisionAuditRef: payload.authorizationDecisionAuditRef,
    approverPrincipal: payload.approverPrincipal,
    policyResourceId: derivationMethodResourceId(method.ref.logicalId),
    useTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    ownership: payload.ownership,
    audit: {
      eventId: 'k05-method-validation',
      actor: { type: payload.approverPrincipal.type, id: payload.approverPrincipal.principalId }
    }
  });
  if (!sameAuthorityRef(payload.approvalPolicyRef, approval.policy.ref)) {
    throw new SynthesisAuthorityError('DERIVATION_METHOD_INVALID', 'method approval policy ref differs from exact authorization authority');
  }
  return method;
}

export class DerivedKnowledgeService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.publishBatchWithLineage !== 'function'
      || typeof ledger.resolve !== 'function' || typeof ledger.addLineage !== 'function') {
      throw new SynthesisAuthorityError('INVALID_LEDGER', 'DerivedKnowledgeService requires shared AuthorityLedger with atomic authority+lineage publication');
    }
    this.#ledger = ledger;
  }

  publishDerivationMethod({
    logicalId,
    version,
    methodType,
    semanticRole,
    minimumInputs = 2,
    contextPolicy = 'PRESERVE_ALL_ORIGINS',
    methodSpec,
    prohibitedShortcuts = [...FORBIDDEN_METHOD_SHORTCUTS],
    ownership,
    approverPrincipal,
    authorizationDecisionAuditRef,
    audit
  }) {
    const normalizedMethodType = requiredText(methodType, 'methodType');
    if (!METHOD_TYPES.has(normalizedMethodType)) {
      throw new SynthesisAuthorityError('INVALID_DERIVATION_METHOD', `unsupported methodType ${normalizedMethodType}`);
    }
    const normalizedContextPolicy = requiredText(contextPolicy, 'contextPolicy');
    if (!CONTEXT_POLICIES.has(normalizedContextPolicy)) {
      throw new SynthesisAuthorityError('INVALID_DERIVATION_METHOD', `unsupported contextPolicy ${normalizedContextPolicy}`);
    }
    if (!Number.isInteger(minimumInputs) || minimumInputs < 1) {
      throw new SynthesisAuthorityError('INVALID_DERIVATION_METHOD', 'minimumInputs must be a positive integer');
    }
    const normalizedSpec = requiredObject(methodSpec, 'methodSpec');
    const forbiddenInSpec = containsForbiddenShortcut(normalizedSpec);
    if (forbiddenInSpec) {
      throw new SynthesisAuthorityError('FORBIDDEN_DERIVATION_SHORTCUT', `${forbiddenInSpec.shortcut} is embedded in ${forbiddenInSpec.path}`);
    }
    const normalizedShortcuts = [...new Set(prohibitedShortcuts.map((value) => requiredText(value, 'prohibitedShortcut')))].sort();
    for (const required of FORBIDDEN_METHOD_SHORTCUTS) {
      if (!normalizedShortcuts.includes(required)) {
        throw new SynthesisAuthorityError('DERIVATION_SHORTCUT_NOT_PROHIBITED', `${required} must remain explicitly prohibited`);
      }
    }
    const normalizedOwnership = requiredObject(ownership, 'ownership');
    const approval = assertScientificApproval({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      approverPrincipal,
      policyResourceId: derivationMethodResourceId(logicalId),
      useTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
      ownership: normalizedOwnership,
      audit
    });

    return this.#ledger.publish({
      kind: 'DerivationMethod',
      logicalId: requiredText(logicalId, 'logicalId'),
      version: requiredText(version, 'version'),
      semanticPayload: {
        methodType: normalizedMethodType,
        semanticRole: requiredText(semanticRole, 'semanticRole'),
        minimumInputs,
        contextPolicy: normalizedContextPolicy,
        methodSpec: normalizedSpec,
        prohibitedShortcuts: deepFreeze(normalizedShortcuts),
        ownership: normalizedOwnership,
        approverPrincipal: cloneCanonicalValue(approverPrincipal),
        authorizationDecisionAuditRef: approval.authAudit.ref,
        approvalPolicyRef: approval.policy.ref,
        authorityClass: 'DERIVATION_METHOD_AUTHORITY'
      },
      audit: auditEvent(audit, 'derivation-method', [approval.authAudit.ref, approval.policy.ref])
    });
  }

  derive({
    derivedKnowledgeLogicalId,
    derivedKnowledgeVersion,
    derivedContextLogicalId,
    derivedContextVersion,
    derivationMethodRef,
    inputBindings,
    semanticRole,
    assertion,
    derivedValue,
    introducedRestrictions = [],
    unresolvedContextHeterogeneity = [],
    limitations = [],
    approverPrincipal,
    authorizationDecisionAuditRef,
    audit
  }) {
    const method = assertDerivationMethodAuthority({ ledger: this.#ledger, methodRef: derivationMethodRef });
    if (!Array.isArray(inputBindings) || inputBindings.length < method.semanticPayload.minimumInputs) {
      throw new SynthesisAuthorityError('INSUFFICIENT_DERIVATION_INPUTS', `method requires at least ${method.semanticPayload.minimumInputs} exact QualifiedKnowledge inputs`);
    }
    const normalizedRole = requiredText(semanticRole, 'semanticRole');
    if (normalizedRole !== method.semanticPayload.semanticRole) {
      throw new SynthesisAuthorityError('DERIVATION_ROLE_MISMATCH', 'derived semantic role differs from exact DerivationMethod authority');
    }

    const validatedInputs = inputBindings.map((binding, index) => {
      const useTarget = normalizeScientificUseTarget(binding?.useTarget);
      const validated = validateQualifiedKnowledgeAuthority({
        ledger: this.#ledger,
        qualifiedKnowledgeRef: binding?.qualifiedKnowledgeRef,
        requiredUseTarget: useTarget
      });
      return deepFreeze({ index, useTarget, ...validated });
    });
    const firstUse = validatedInputs[0].useTarget;
    if (!validatedInputs.every((input) => input.useTarget.use === firstUse.use)) {
      throw new SynthesisAuthorityError('DERIVATION_USE_MISMATCH', 'all synthesis inputs must share the exact active scientific-use target');
    }
    const ownership = validatedInputs[0].knowledge.semanticPayload.ownership;
    if (!validatedInputs.every((input) => sameOwnership(input.knowledge.semanticPayload.ownership, ownership))) {
      throw new SynthesisAuthorityError('CROSS_OWNER_SYNTHESIS_NOT_AUTHORIZED', 'K05 v1 does not synthesize knowledge across ownership boundaries');
    }

    const synthesisApproval = assertScientificApproval({
      ledger: this.#ledger,
      authorizationDecisionAuditRef,
      approverPrincipal,
      policyResourceId: synthesisResourceId(method.ref),
      useTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
      ownership,
      audit
    });

    const inputRefs = deepFreeze(validatedInputs.map((input) => input.knowledge.ref)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const originContexts = deepFreeze(validatedInputs.map((input) => ({
      qualifiedKnowledgeRef: input.knowledge.ref,
      sourceContextRef: input.sourceContext.ref
    })).sort((a, b) => JSON.stringify(a.qualifiedKnowledgeRef).localeCompare(JSON.stringify(b.qualifiedKnowledgeRef))));

    const contextPayload = {
      inputQualifiedKnowledgeRefs: inputRefs,
      originContexts,
      derivationMethodRef: method.ref,
      contextPolicy: method.semanticPayload.contextPolicy,
      introducedRestrictions: objectList(introducedRestrictions, 'introducedRestrictions'),
      unresolvedContextHeterogeneity: objectList(unresolvedContextHeterogeneity, 'unresolvedContextHeterogeneity'),
      authorityClass: 'DERIVED_KNOWLEDGE_CONTEXT'
    };
    const contextRef = predictedRef('DerivedKnowledgeContext', derivedContextLogicalId, derivedContextVersion, contextPayload);

    const knowledgePayload = {
      assertion: requiredText(assertion, 'assertion'),
      semanticRole: normalizedRole,
      scientificUseTarget: firstUse,
      ...(derivedValue !== undefined ? { derivedValue: cloneCanonicalValue(derivedValue) } : {}),
      inputQualifiedKnowledgeRefs: inputRefs,
      derivationMethodRef: method.ref,
      derivedKnowledgeContextRef: contextRef,
      limitations: objectList(limitations, 'limitations'),
      ownership: cloneCanonicalValue(ownership),
      approverPrincipal: cloneCanonicalValue(approverPrincipal),
      authorizationDecisionAuditRef: synthesisApproval.authAudit.ref,
      synthesisPolicyRef: synthesisApproval.policy.ref,
      derivationEvidenceClass: 'SCIENTIFIC_ADJUDICATION_RECORD',
      authorityClass: 'DERIVATION_AUTHORITY'
    };
    const knowledgeRef = predictedRef('DerivedKnowledge', derivedKnowledgeLogicalId, derivedKnowledgeVersion, knowledgePayload);

    const lineages = [];
    for (const input of validatedInputs) {
      lineages.push({
        relation: 'derived_from',
        from: knowledgeRef,
        to: input.knowledge.ref,
        details: { lineageRole: 'QUALIFIED_KNOWLEDGE_INPUT', scientificUseTarget: firstUse, derivationMethodRef: method.ref },
        audit: auditEvent(audit, `knowledge-lineage-${input.index}`, [method.ref, synthesisApproval.authAudit.ref])
      });
      lineages.push({
        relation: 'derived_from',
        from: contextRef,
        to: input.sourceContext.ref,
        details: { lineageRole: 'ORIGIN_SOURCE_CONTEXT', qualifiedKnowledgeRef: input.knowledge.ref },
        audit: auditEvent(audit, `context-lineage-${input.index}`, [method.ref, synthesisApproval.authAudit.ref])
      });
    }
    lineages.push({
      relation: 'derived_from',
      from: knowledgeRef,
      to: method.ref,
      details: { lineageRole: 'DERIVATION_METHOD', contextRef },
      audit: auditEvent(audit, 'method-lineage', [synthesisApproval.authAudit.ref])
    });

    const publication = this.#ledger.publishBatchWithLineage({
      entries: [
        {
          kind: 'DerivedKnowledgeContext',
          logicalId: requiredText(derivedContextLogicalId, 'derivedContextLogicalId'),
          version: requiredText(derivedContextVersion, 'derivedContextVersion'),
          semanticPayload: contextPayload,
          audit: auditEvent(audit, 'derived-context', [method.ref, synthesisApproval.authAudit.ref, ...inputRefs, ...originContexts.map((item) => item.sourceContextRef)])
        },
        {
          kind: 'DerivedKnowledge',
          logicalId: requiredText(derivedKnowledgeLogicalId, 'derivedKnowledgeLogicalId'),
          version: requiredText(derivedKnowledgeVersion, 'derivedKnowledgeVersion'),
          semanticPayload: knowledgePayload,
          audit: auditEvent(audit, 'derived-knowledge', [contextRef, method.ref, synthesisApproval.authAudit.ref, synthesisApproval.policy.ref, ...inputRefs])
        }
      ],
      lineages
    });
    const [derivedContext, derivedKnowledge] = publication.records;

    return deepFreeze({ derivedKnowledge, derivedContext, method });
  }
}