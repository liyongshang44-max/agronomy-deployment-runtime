import { canonicalizeSemanticJson, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { createPrincipal } from '../../authorization/src/index.mjs';
import {
  authorizeImplementationConformanceQualification,
  IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE
} from '../../authorization/src/implementation-conformance-control.mjs';
import { validateSpecificationAuthority } from '../../specification-registry/src/index.mjs';
import { validateImplementationAuthority } from '../../implementation-registry/src/index.mjs';
import {
  IMPLEMENTATION_CONFORMANCE_AUTHORITY_CLASS,
  IMPLEMENTATION_CONFORMANCE_CONTRACT_VERSION,
  ImplementationConformanceError,
  normalizeImplementationConformance,
  text
} from './contract.mjs';

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const map = new Map();
  for (const value of values) {
    const ref = assertAuthorityRef(value);
    map.set(refKey(ref), ref);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function samePrincipal(left, right) {
  const a = createPrincipal(left);
  const b = createPrincipal(right);
  return a.principalId === b.principalId
    && a.type === b.type
    && a.organizationId === b.organizationId
    && (a.tenantId ?? null) === (b.tenantId ?? null);
}

function sameControlScope(left, right) {
  return left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function resolveKind(ledger, ref, kind, code) {
  const record = ledger.resolve(assertAuthorityRef(ref));
  if (record.ref.kind !== kind) throw new ImplementationConformanceError(code, `expected ${kind}, received ${record.ref.kind}`);
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new ImplementationConformanceError(`${code}_HASH_MISMATCH`, `${kind} stored payload does not reproduce exact semantic hash`);
  }
  return record;
}

function managementScope(controlScope, logicalId) {
  return deepFreeze({
    organizationId: controlScope.organizationId,
    ...(controlScope.tenantId ? { tenantId: controlScope.tenantId } : {}),
    resourceType: IMPLEMENTATION_CONFORMANCE_RESOURCE_TYPE,
    resourceId: text(logicalId, 'logicalId')
  });
}

export function validateConformanceAuthorization({
  ledger,
  authorizationDecisionAuditRef,
  principal,
  controlScope,
  logicalId,
  operation = 'IMPLEMENTATION_CONFORMANCE_QUALIFY'
}) {
  const record = resolveKind(
    ledger,
    authorizationDecisionAuditRef,
    'AuthorizationDecisionAudit',
    'CONFORMANCE_AUTHORIZATION_REQUIRED'
  );
  const stored = record.semanticPayload;
  if (!stored || typeof stored.decisionHash !== 'string') {
    throw new ImplementationConformanceError('CONFORMANCE_AUTHORIZATION_INVALID', 'content-addressed AuthorizationDecision is required');
  }
  const { decisionHash, ...basis } = stored;
  if (semanticHash('AuthorizationDecision', basis) !== decisionHash) {
    throw new ImplementationConformanceError('CONFORMANCE_AUTHORIZATION_HASH_MISMATCH', 'stored authorization hash is not reproducible');
  }
  const actor = createPrincipal(principal);
  const expectedScope = managementScope(controlScope, logicalId);
  if (stored.operation !== operation
    || stored.allowed !== true
    || stored.policyRef !== undefined
    || !samePrincipal(stored.principal, actor)
    || canonicalizeSemanticJson(stored.request?.authorizationScope) !== canonicalizeSemanticJson(expectedScope)) {
    throw new ImplementationConformanceError('CONFORMANCE_AUTHORIZATION_MISMATCH', 'authorization does not bind exact conformance qualifier/scope/logical id/operation');
  }
  if (!Array.isArray(stored.assignmentRefs) || stored.assignmentRefs.length === 0) {
    throw new ImplementationConformanceError('CONFORMANCE_ROLE_ASSIGNMENT_REQUIRED', 'conformance qualification requires exact RoleAssignment refs');
  }
  const assignments = stored.assignmentRefs.map((ref) =>
    resolveKind(ledger, ref, 'RoleAssignment', 'CONFORMANCE_ROLE_ASSIGNMENT_REQUIRED'));
  const replayed = authorizeImplementationConformanceQualification({
    principal: actor,
    roleAssignments: assignments,
    authorizationScope: expectedScope
  });
  if (operation !== 'IMPLEMENTATION_CONFORMANCE_QUALIFY') {
    // Control operations are validated in lifecycle with the control-specific authorizer.
  } else if (!replayed.allowed || replayed.decisionHash !== stored.decisionHash) {
    throw new ImplementationConformanceError('CONFORMANCE_AUTHORIZATION_REPLAY_MISMATCH', 'conformance authorization cannot be replayed from exact RoleAssignments');
  }
  const expectedAction = `AUTHORIZATION_${operation}_ALLOW`;
  const direct = ledger.auditFor(record.ref).filter((event) => sameAuthorityRef(event.objectRef, record.ref));
  if (!direct.some((event) => event.action === expectedAction && sameRefSet(event.inputRefs, stored.assignmentRefs))) {
    throw new ImplementationConformanceError('CONFORMANCE_AUTHORIZATION_AUDIT_INVALID', 'authorization audit must bind exactly RoleAssignment inputs');
  }
  return record;
}

function specificationSemantics(specification) {
  const payload = specification.semanticPayload;
  if (specification.record.ref.kind === 'QualifiedTransformation') {
    return {
      inputs: [payload.inputContract],
      outputs: [payload.outputContract]
    };
  }
  if (specification.record.ref.kind === 'Model') {
    return { inputs: payload.inputs, outputs: payload.outputs };
  }
  if (specification.record.ref.kind === 'Policy') {
    return { inputs: payload.requiredInputs, outputs: payload.requiredRuntimeOutputs };
  }
  throw new ImplementationConformanceError('SPECIFICATION_REQUIRED', 'unsupported specification kind');
}

function buildPayload({
  controlScope,
  specification,
  implementation,
  qualificationMethod,
  compatibilityTests,
  runtimeEnvironments,
  requiredCapabilities,
  knownLimitations,
  validityInterval
}) {
  const semantics = specificationSemantics(specification);
  const runtime = implementation.semanticPayload.runtimeMetadata;
  return normalizeImplementationConformance({
    contractVersion: IMPLEMENTATION_CONFORMANCE_CONTRACT_VERSION,
    authorityClass: IMPLEMENTATION_CONFORMANCE_AUTHORITY_CLASS,
    controlScope,
    specificationRef: specification.record.ref,
    implementationRef: implementation.record.ref,
    qualificationStatus: 'QUALIFIED',
    qualificationMethod,
    compatibilityTests,
    qualifiedInputSemanticsHash: semanticHash('ImplementationConformanceInputSemantics', semantics.inputs),
    qualifiedOutputSemanticsHash: semanticHash('ImplementationConformanceOutputSemantics', semantics.outputs),
    implementationDigest: implementation.semanticPayload.implementationDigest,
    artifactContentHash: implementation.semanticPayload.artifact.contentHash,
    qualifiedExecutionEnvironment: {
      runtime: runtime.runtime,
      runtimeVersion: runtime.runtimeVersion,
      platform: runtime.platform,
      architecture: runtime.architecture,
      runtimeEnvironments,
      requiredCapabilities
    },
    knownLimitations,
    validityInterval
  });
}

function expectedPublicationInputs(payload, authorizationRef) {
  return canonicalRefs([payload.specificationRef, payload.implementationRef, authorizationRef]);
}

export function publishImplementationConformance({
  ledger,
  logicalId,
  version,
  specificationRef,
  implementationRef,
  controlScope,
  qualificationMethod,
  compatibilityTests,
  runtimeEnvironments,
  requiredCapabilities = [],
  knownLimitations = [],
  validityInterval,
  principal,
  authorizationDecisionAuditRef,
  audit
}) {
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ImplementationConformanceError('INVALID_LEDGER', 'conformance publication requires replayable AuthorityLedger');
  }
  const id = text(logicalId, 'logicalId');
  const specification = validateSpecificationAuthority({ ledger, specificationRef });
  const implementation = validateImplementationAuthority({ ledger, implementationRef });
  const actor = createPrincipal(principal);
  const scope = deepFreeze({
    organizationId: text(controlScope?.organizationId, 'controlScope.organizationId'),
    ...(controlScope?.tenantId ? { tenantId: text(controlScope.tenantId, 'controlScope.tenantId') } : {})
  });
  if (!sameControlScope(scope, specification.semanticPayload.controlScope)
    || !sameControlScope(scope, implementation.semanticPayload.controlScope)
    || actor.organizationId !== scope.organizationId
    || (actor.tenantId ?? null) !== (scope.tenantId ?? null)) {
    throw new ImplementationConformanceError(
      'CONFORMANCE_CONTROL_SCOPE_MISMATCH',
      'S03 v1 requires qualifier, exact specification, and exact implementation to share one organization/tenant control scope'
    );
  }
  const authorization = validateConformanceAuthorization({
    ledger,
    authorizationDecisionAuditRef,
    principal: actor,
    controlScope: scope,
    logicalId: id
  });
  const payload = buildPayload({
    controlScope: scope,
    specification,
    implementation,
    qualificationMethod,
    compatibilityTests,
    runtimeEnvironments,
    requiredCapabilities,
    knownLimitations,
    validityInterval
  });
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new ImplementationConformanceError('CONFORMANCE_AUDIT_ACTOR_MISMATCH', 'publication audit actor must equal exact qualifier');
  }
  return ledger.publish({
    kind: 'ImplementationConformance',
    logicalId: id,
    version: text(version, 'version'),
    semanticPayload: payload,
    audit: {
      ...audit,
      action: 'PUBLISH_IMPLEMENTATION_CONFORMANCE',
      inputRefs: expectedPublicationInputs(payload, authorization.ref),
      details: {
        ...(audit.details ?? {}),
        qualifierPrincipal: actor,
        authorizationDecisionAuditRef: authorization.ref,
        qualificationStatus: payload.qualificationStatus
      }
    }
  });
}

export function validateImplementationConformanceHistorical({ ledger, conformanceRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new ImplementationConformanceError('INVALID_LEDGER', 'conformance validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(conformanceRef);
  const record = resolveKind(ledger, ref, 'ImplementationConformance', 'IMPLEMENTATION_CONFORMANCE_REQUIRED');
  const payload = normalizeImplementationConformance(record.semanticPayload);
  if (semanticHash('ImplementationConformance', payload) !== record.ref.semanticHash) {
    throw new ImplementationConformanceError('CONFORMANCE_SEMANTIC_HASH_MISMATCH', 'stored conformance payload does not reproduce exact authority ref');
  }
  const specification = validateSpecificationAuthority({ ledger, specificationRef: payload.specificationRef });
  const implementation = validateImplementationAuthority({ ledger, implementationRef: payload.implementationRef });
  if (!sameControlScope(payload.controlScope, specification.semanticPayload.controlScope)
    || !sameControlScope(payload.controlScope, implementation.semanticPayload.controlScope)) {
    throw new ImplementationConformanceError('CONFORMANCE_CONTROL_SCOPE_MISMATCH', 'frozen spec/implementation control scopes no longer reproduce conformance relation');
  }
  const expected = buildPayload({
    controlScope: payload.controlScope,
    specification,
    implementation,
    qualificationMethod: payload.qualificationMethod,
    compatibilityTests: payload.compatibilityTests,
    runtimeEnvironments: payload.qualifiedExecutionEnvironment.runtimeEnvironments,
    requiredCapabilities: payload.qualifiedExecutionEnvironment.requiredCapabilities,
    knownLimitations: payload.knownLimitations,
    validityInterval: payload.validityInterval
  });
  if (canonicalizeSemanticJson(expected) !== canonicalizeSemanticJson(payload)) {
    throw new ImplementationConformanceError('CONFORMANCE_DERIVED_WORLD_MISMATCH', 'frozen conformance does not exactly reproduce spec IO or implementation identity/environment');
  }

  const candidates = ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_IMPLEMENTATION_CONFORMANCE'
      && event.details?.qualifierPrincipal
      && event.details?.authorizationDecisionAuditRef);
  let valid = null;
  for (const event of candidates) {
    try {
      const qualifier = createPrincipal(event.details.qualifierPrincipal);
      if (event.actor?.id !== qualifier.principalId || event.actor?.type !== qualifier.type) continue;
      const authorization = validateConformanceAuthorization({
        ledger,
        authorizationDecisionAuditRef: event.details.authorizationDecisionAuditRef,
        principal: qualifier,
        controlScope: payload.controlScope,
        logicalId: record.ref.logicalId
      });
      if (!sameRefSet(event.inputRefs, expectedPublicationInputs(payload, authorization.ref))) continue;
      valid = { qualifier, authorization };
      break;
    } catch {
      valid = null;
    }
  }
  if (!valid) throw new ImplementationConformanceError('CONFORMANCE_PUBLICATION_AUTHORITY_INVALID', 'conformance lacks exact replayable qualification publication authority');
  return deepFreeze({
    record,
    semanticPayload: payload,
    specification,
    implementation,
    qualifierPrincipal: valid.qualifier,
    qualificationAuthorization: valid.authorization,
    replayMode: 'EXACT_HISTORICAL_CONFORMANCE'
  });
}
