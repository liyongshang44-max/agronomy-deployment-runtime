import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  createPrincipal,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  normalizeDecisionProblem,
  publishDecisionProblem,
  validateDecisionProblemAuthority
} from '../../decision-problem/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority
} from './context-target-ref-farm-instance-projection-authority.mjs';
import {
  AgronomicDecisionProblemFarmTargetBindingCompilationError,
  agronomicDecisionProblemFarmTargetBindingCompilationAuthorityRefs,
  agronomicDecisionProblemFarmTargetBindingHash,
  normalizeAgronomicDecisionProblemFarmTargetBinding,
  normalizeAgronomicDecisionProblemFarmTargetBindingCompilation
} from './decision-problem-farm-target-binding-contract.mjs';

export const AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING',
    'REJECT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING'
  ]);

export const AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'DEC_0027_TARGET_REF_FARM_PROJECTION_AUTHORITY_VERIFIED',
    'EXACT_DEC_0027_AUTHORITY_REF_VERIFIED',
    'SOURCE_BACKED_TARGET_GRANULARITY_FARM_VERIFIED',
    'EXACT_SOURCE_BACKED_FARM_ID_VERIFIED',
    'TARGET_REF_FIELD_FARM_ID_VERIFIED',
    'FARM_ID_INJECTED_ONLY_FROM_DEC_0027',
    'NO_CALLER_FARM_ID_AUTHORITY',
    'DEPLOYMENT_ORGANIZATION_SCOPE_CALLER_OWNED',
    'DEPLOYMENT_TENANT_SCOPE_CALLER_OWNED_IF_PRESENT',
    'DECISION_INTENT_A01_CREATOR_OWNED',
    'NO_SOURCE_DERIVED_DECISION_TYPE',
    'NO_SOURCE_DERIVED_LOGICAL_TIME',
    'NO_SOURCE_DERIVED_DECISION_HORIZON',
    'NO_SOURCE_DERIVED_OBJECTIVE',
    'NO_SOURCE_DERIVED_ACTION_SPACE',
    'NO_SOURCE_DERIVED_CONSTRAINTS',
    'NO_SOURCE_DERIVED_USE_PURPOSE_OR_USE_CLASS',
    'NO_SOURCE_DERIVED_DECISION_AUTHORITY_MODE',
    'NO_SOURCE_DERIVED_DECISION_DEADLINE',
    'NO_FIELD_SEASON_ZONE_INFERENCE',
    'NO_GEOMETRY_INFERENCE',
    'NO_RAW_SERF_OR_DISPLAY_NAME_SUBSTITUTION',
    'GENERIC_A01_CONTRACT_UNCHANGED',
    'A01_CREATION_AUTHORIZATION_REMAINS_MANDATORY',
    'NO_CONTEXT_MANIFEST_PUBLICATION',
    'NO_EVIDENCE_CUTOFF_AUTHORITY',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REQUIRED_REVIEW_CHECKS);
const INTENT_KEYS = new Set([
  'decisionType',
  'logicalTime',
  'decisionHorizon',
  'objective',
  'actionSpace',
  'constraints',
  'usePurpose',
  'useClass',
  'decisionAuthorityMode',
  'decisionDeadline'
]);
const FORBIDDEN_TARGET_CARRIER_KEYS = new Set([
  'targetref',
  'farmid',
  'fieldid',
  'seasonid',
  'zoneid',
  'geometry',
  'geometryref'
]);

function requireLedger(ledger) {
  if (!ledger
    || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_LEDGER_REQUIRED',
      'DEC-0032 requires replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be a non-empty string'
    );
  }
  return value.trim();
}

function exactObject(value, name, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INPUT',
      name + ' must be an object'
    );
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_FIELD',
        name + '.' + key + ' is not part of the DEC-0032 publication input'
      );
    }
  }
}

function sameSemantic(left, right) {
  return canonicalizeSemanticJson(left) === canonicalizeSemanticJson(right);
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs)
    && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function uniqueRecords(records) {
  const map = new Map();
  for (const record of records) map.set(refKey(record.ref), record);
  return [...map.values()].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)));
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const checks = values.map((value, index) =>
    text(value, 'confirmedChecks[' + index + ']')
  );
  if (new Set(checks).size !== checks.length) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const check of checks) {
    if (!REQUIRED_CHECKS.has(check)) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_CHECKS_INVALID',
        'unsupported DEC-0032 review check ' + check
      );
    }
  }
  if (disposition === 'ACCEPT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING') {
    for (const required of REQUIRED_CHECKS) {
      if (!checks.includes(required)) {
        throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
          'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_INCOMPLETE',
          'accepted DEC-0032 review must confirm ' + required
        );
      }
    }
  }
  return deepFreeze([...checks].sort());
}

function assertAuditActor(audit, principal, code) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      code,
      'audit actor must match the exact DEC-0032 principal'
    );
  }
}

function sourceRecordsFromParent(parent) {
  const spatial = parent.contextSpatialSupportClassification;
  return uniqueRecords([
    spatial.contextSemanticMapping.parentOccurrence.source,
    ...spatial.contextSemanticMapping.semanticNormalization.replayedEvidence
      .map((evidence) => evidence.source),
    ...spatial.targetIdentityBinding.replayedEvidence
      .map((evidence) => evidence.source)
  ]);
}

function validateBindingWorld({ ledger, sourceRegistry, binding }) {
  const normalized =
    normalizeAgronomicDecisionProblemFarmTargetBinding(binding);
  const parent =
    validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef:
        normalized.parentTargetRefFarmInstanceProjectionCompilationRef
    });
  const projection = parent.semanticPayload.projection;
  if (
    projection.sourceBackedTargetIdentity?.granularity !== 'FARM'
    || projection.targetRefProjection?.field !== 'farmId'
    || projection.targetRefProjection?.value
      !== projection.sourceBackedTargetIdentity?.targetId
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PARENT_INVALID',
      'DEC-0032 requires exact DEC-0027 FARM/farmId projection authority'
    );
  }
  if (
    normalized.sourceBackedTargetComponent.field !== 'farmId'
    || normalized.sourceBackedTargetComponent.value
      !== projection.targetRefProjection.value
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PARENT_MISMATCH',
      'DEC-0032 farmId must equal the exact reviewed DEC-0027 projection'
    );
  }
  const requiredSources = sourceRecordsFromParent(parent);
  return deepFreeze({
    normalized,
    parent,
    projection,
    requiredSources
  });
}

function resolveAuthorizationCoverage({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSources
}) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length === 0) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORIZATION_REQUIRED',
      'binding review requires source inspection authorization refs'
    );
  }
  const records = authorizationDecisionAuditRefs.map((ref) => ledger.resolve(ref));
  for (const record of records) {
    const decision = record.semanticPayload ?? {};
    if (record.ref.kind !== 'AuthorizationDecisionAudit'
      || decision.allowed !== true
      || decision.operation !== 'KNOWLEDGE_INSPECT'
      || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORIZATION_INVALID',
        'each review authorization must allow KNOWLEDGE_INSPECT for exact reviewer'
      );
    }
  }

  const selected = [];
  for (const source of requiredSources) {
    const resourceId = sourceReviewResourceId(source.ref);
    const matches = [];
    for (const record of records) {
      const decision = record.semanticPayload;
      const policy = ledger.resolve(decision.policyRef);
      if (policy.ref.kind !== 'KnowledgeGovernancePolicy'
        || policy.semanticPayload?.resourceId !== resourceId) continue;
      const assignments =
        (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
      const recomputed = authorizeKnowledgeInspection({
        principal: reviewerPrincipal,
        policy,
        roleAssignments: assignments,
        authorizationScope: decision.request?.authorizationScope
      });
      const hasGrant = assignments.some((assignment) =>
        assignment.ref.kind === 'RoleAssignment'
        && samePrincipalIdentity(
          assignment.semanticPayload?.principal,
          reviewerPrincipal
        )
        && (assignment.semanticPayload?.permissions ?? [])
          .includes(PERMISSIONS.SOURCE_READ)
        && (assignment.semanticPayload?.permissions ?? [])
          .includes(PERMISSIONS.KNOWLEDGE_INSPECT)
      );
      if (
        recomputed.allowed
        && recomputed.decisionHash === decision.decisionHash
        && hasGrant
      ) {
        matches.push(record);
      }
    }
    if (matches.length !== 1) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORIZATION_INVALID',
        'review requires exactly one reproducible source authorization per source'
      );
    }
    selected.push(matches[0]);
  }

  const uniqueSelected = uniqueRecords(selected);
  if (uniqueSelected.length !== records.length) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORIZATION_EXCESS',
      'review authorization refs must contain exactly required source coverage'
    );
  }
  return deepFreeze(uniqueSelected);
}

export function publishAgronomicDecisionProblemFarmTargetBindingReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  binding,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'INVALID_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_DISPOSITION',
      'unsupported DEC-0032 review disposition'
    );
  }
  const reviewer = createPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateBindingWorld({
    ledger,
    sourceRegistry,
    binding
  });
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(
    audit,
    reviewer,
    'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_ACTOR_MISMATCH'
  );
  const bindingHash =
    agronomicDecisionProblemFarmTargetBindingHash(world.normalized);
  const predecessorBindings = deepFreeze({
    parentTargetRefFarmInstanceProjectionCompilationRef:
      world.parent.record.ref,
    sourceBackedTargetIdentity:
      cloneCanonicalValue(world.projection.sourceBackedTargetIdentity),
    targetRefProjection:
      cloneCanonicalValue(world.projection.targetRefProjection),
    requiredSourceRefs:
      world.requiredSources.map((source) => source.ref)
  });

  return ledger.publish({
    kind: 'AgronomicDecisionProblemFarmTargetBindingReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass:
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORITY',
      binding: cloneCanonicalValue(world.normalized),
      bindingHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs:
        authorizations.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING',
      inputRefs: [
        world.parent.record.ref,
        ...authorizations.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        bindingHash,
        disposition,
        predecessorBindings
      }
    }
  });
}

function validateReview({
  ledger,
  sourceRegistry,
  reviewRef,
  normalizedCompilation
}) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicDecisionProblemFarmTargetBindingReviewDecision') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_REQUIRED',
      'DEC-0032 compilation requires binding review'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (
    payload.authorityClass
      !== 'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUTHORITY'
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_INVALID',
      'invalid DEC-0032 review authorityClass'
    );
  }
  if (
    payload.disposition
      !== 'ACCEPT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING'
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_REJECTED',
      'only accepted DEC-0032 review may authorize compilation'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);
  const binding = normalizedCompilation.binding;
  const bindingHash = agronomicDecisionProblemFarmTargetBindingHash(binding);
  if (
    payload.bindingHash !== bindingHash
    || !sameSemantic(payload.binding, binding)
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_MISMATCH',
      'binding review must bind exact normalized binding'
    );
  }

  const world = validateBindingWorld({
    ledger,
    sourceRegistry,
    binding
  });
  const expectedBindings = {
    parentTargetRefFarmInstanceProjectionCompilationRef:
      world.parent.record.ref,
    sourceBackedTargetIdentity:
      cloneCanonicalValue(world.projection.sourceBackedTargetIdentity),
    targetRefProjection:
      cloneCanonicalValue(world.projection.targetRefProjection),
    requiredSourceRefs:
      world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemantic(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessor binding must match exact DEC-0027 world'
    );
  }

  const reviewer = createPrincipal(payload.reviewerPrincipal);
  const authorizations = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });

  const direct = ledger.auditFor(review.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, review.ref))
    .some((entry) =>
      entry.action === 'REVIEW_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING'
      && entry.actor?.id === reviewer.principalId
      && entry.actor?.type === reviewer.type
      && exactRefIn(entry.inputRefs, world.parent.record.ref)
      && authorizations.every((record) => exactRefIn(entry.inputRefs, record.ref))
      && entry.details?.bindingHash === bindingHash
      && sameSemantic(entry.details?.predecessorBindings, expectedBindings)
    );
  if (!direct) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REVIEW_AUDIT_INVALID',
      'binding review lacks direct exact-predecessor audit'
    );
  }

  return deepFreeze({
    review,
    reviewer,
    authorizations,
    world
  });
}

export function publishAgronomicDecisionProblemFarmTargetBindingCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  audit
}) {
  requireLedger(ledger);
  const normalized =
    normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INCOMPLETE_NOT_PUBLISHABLE',
      'DEC-0032 v1 requires COMPLETE coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.bindingReviewRef,
    normalizedCompilation: normalized
  });
  assertAuditActor(
    audit,
    review.reviewer,
    'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PUBLICATION_ACTOR_MISMATCH'
  );
  const refs =
    agronomicDecisionProblemFarmTargetBindingCompilationAuthorityRefs(normalized);

  return ledger.publish({
    kind: 'AgronomicDecisionProblemFarmTargetBindingCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass:
          'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY',
        bindingHash: normalized.bindingHash,
        bindingReviewRef: review.review.ref,
        parentTargetRefFarmInstanceProjectionCompilationRef:
          normalized.binding.parentTargetRefFarmInstanceProjectionCompilationRef,
        sourceBackedTargetComponent:
          cloneCanonicalValue(normalized.binding.sourceBackedTargetComponent)
      }
    }
  });
}

export function validateAgronomicDecisionProblemFarmTargetBindingCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicDecisionProblemFarmTargetBindingCompilation') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_REQUIRED',
      'expected AgronomicDecisionProblemFarmTargetBindingCompilation'
    );
  }
  const normalized =
    normalizeAgronomicDecisionProblemFarmTargetBindingCompilation(
      record.semanticPayload
    );
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_INCOMPLETE_AUTHORITY_INVALID',
      'stored DEC-0032 compilation must have COMPLETE coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.bindingReviewRef,
    normalizedCompilation: normalized
  });
  const refs =
    agronomicDecisionProblemFarmTargetBindingCompilationAuthorityRefs(normalized);
  const direct = ledger.auditFor(record.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, record.ref))
    .some((entry) =>
      entry.action
        === 'PUBLISH_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION'
      && entry.actor?.id === review.reviewer.principalId
      && entry.actor?.type === review.reviewer.type
      && refs.every((ref) => exactRefIn(entry.inputRefs, ref))
      && entry.details?.bindingHash === normalized.bindingHash
      && sameAuthorityRef(
        entry.details?.bindingReviewRef,
        review.review.ref
      )
      && sameAuthorityRef(
        entry.details?.parentTargetRefFarmInstanceProjectionCompilationRef,
        normalized.binding.parentTargetRefFarmInstanceProjectionCompilationRef
      )
      && sameSemantic(
        entry.details?.sourceBackedTargetComponent,
        normalized.binding.sourceBackedTargetComponent
      )
    );
  if (!direct) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_AUDIT_INVALID',
      'DEC-0032 compilation lacks direct reviewer audit'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: normalized,
    bindingReview: review.review,
    parentTargetRefFarmInstanceProjection: review.world.parent
  });
}

function normalizeDeploymentScope(value) {
  exactObject(
    value,
    'deploymentScope',
    new Set(['organizationId', 'tenantId'])
  );
  return deepFreeze({
    organizationId: text(value.organizationId, 'deploymentScope.organizationId'),
    ...(value.tenantId
      ? { tenantId: text(value.tenantId, 'deploymentScope.tenantId') }
      : {})
  });
}

function semanticKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function assertNoTargetCarrier(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoTargetCarrier(item, path + '[' + index + ']')
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_TARGET_CARRIER_KEYS.has(semanticKey(key))) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_TARGET_LAUNDERING_FORBIDDEN',
        path + '.' + key + ' would carry unsupported target identity'
      );
    }
    assertNoTargetCarrier(nested, path + '.' + key);
  }
}

function normalizeDecisionIntent(value, targetRef) {
  exactObject(value, 'decisionIntent', INTENT_KEYS);
  for (const key of INTENT_KEYS) {
    if (value[key] === undefined) {
      throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
        'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_DECISION_INTENT_REQUIRED',
        'decisionIntent.' + key + ' is required; DEC-0032 does not infer it'
      );
    }
  }
  assertNoTargetCarrier(value, 'decisionIntent');
  const normalized = normalizeDecisionProblem({
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    targetRef,
    ...cloneCanonicalValue(value)
  });
  return deepFreeze({
    decisionType: normalized.decisionType,
    logicalTime: normalized.logicalTime,
    decisionHorizon: normalized.decisionHorizon,
    objective: normalized.objective,
    actionSpace: normalized.actionSpace,
    constraints: normalized.constraints,
    usePurpose: normalized.usePurpose,
    useClass: normalized.useClass,
    decisionAuthorityMode: normalized.decisionAuthorityMode,
    decisionDeadline: normalized.decisionDeadline
  });
}

function callerTargetOverridePresent(values) {
  return values.some((value) => value !== undefined);
}

export function publishAgronomicDecisionProblemWithFarmTargetBinding({
  ledger,
  sourceRegistry,
  farmTargetBindingCompilationRef,
  logicalId,
  version,
  deploymentScope,
  decisionIntent,
  principal,
  authorizationDecisionAuditRef,
  audit,
  targetRef,
  farmId,
  fieldId,
  seasonId,
  zoneId,
  geometry,
  geometryRef
}) {
  if (callerTargetOverridePresent([
    targetRef,
    farmId,
    fieldId,
    seasonId,
    zoneId,
    geometry,
    geometryRef
  ])) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CALLER_TARGET_OVERRIDE_FORBIDDEN',
      'specialized DEC-0032 bridge does not accept caller target identity overrides'
    );
  }

  const binding =
    validateAgronomicDecisionProblemFarmTargetBindingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: farmTargetBindingCompilationRef
    });
  const scope = normalizeDeploymentScope(deploymentScope);
  const farmValue =
    binding.semanticPayload.binding.sourceBackedTargetComponent.value;
  const constructedTargetRef = deepFreeze({
    organizationId: scope.organizationId,
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    farmId: farmValue
  });
  const intent = normalizeDecisionIntent(decisionIntent, constructedTargetRef);

  return publishDecisionProblem({
    ledger,
    logicalId,
    version,
    problem: {
      contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
      targetRef: constructedTargetRef,
      ...cloneCanonicalValue(intent)
    },
    principal,
    authorizationDecisionAuditRef,
    audit: {
      ...audit,
      inputRefs: [
        binding.record.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        agronomicDecisionProblemFarmTargetBindingCompilationRef:
          binding.record.ref,
        deploymentScope: cloneCanonicalValue(scope),
        sourceBackedFarmId: farmValue
      }
    }
  });
}

export function validateAgronomicDecisionProblemFarmTargetPublicationAuthority({
  ledger,
  sourceRegistry,
  decisionProblemRef
}) {
  const decisionProblem =
    validateDecisionProblemAuthority({ ledger, decisionProblemRef });
  const direct = ledger.auditFor(decisionProblem.record.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, decisionProblem.record.ref))
    .find((entry) =>
      entry.action === 'PUBLISH_DECISION_PROBLEM'
      && entry.details?.agronomicDecisionProblemFarmTargetBindingCompilationRef
      && exactRefIn(
        entry.inputRefs,
        entry.details.agronomicDecisionProblemFarmTargetBindingCompilationRef
      )
    );
  if (!direct) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PUBLICATION_PROOF_REQUIRED',
      'DecisionProblem lacks direct DEC-0032 target-binding proof'
    );
  }

  const binding =
    validateAgronomicDecisionProblemFarmTargetBindingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef:
        direct.details.agronomicDecisionProblemFarmTargetBindingCompilationRef
    });
  const farmValue =
    binding.semanticPayload.binding.sourceBackedTargetComponent.value;
  const target = decisionProblem.semanticPayload.targetRef;
  const targetKeys = Object.keys(target).sort();
  const expectedKeys = target.tenantId
    ? ['farmId', 'organizationId', 'tenantId']
    : ['farmId', 'organizationId'];
  expectedKeys.sort();

  if (
    targetKeys.length !== expectedKeys.length
    || !targetKeys.every((key, index) => key === expectedKeys[index])
    || target.farmId !== farmValue
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PUBLICATION_TARGET_MISMATCH',
      'DecisionProblem targetRef must contain only deployment org/tenant plus exact DEC-0027 farmId'
    );
  }

  const expectedScope = {
    organizationId: target.organizationId,
    ...(target.tenantId ? { tenantId: target.tenantId } : {})
  };
  if (
    !sameSemantic(direct.details?.deploymentScope, expectedScope)
    || direct.details?.sourceBackedFarmId !== farmValue
  ) {
    throw new AgronomicDecisionProblemFarmTargetBindingCompilationError(
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_PUBLICATION_AUDIT_INVALID',
      'DecisionProblem publication audit must bind exact deployment scope and source-backed farmId'
    );
  }

  return deepFreeze({
    decisionProblem: decisionProblem.record,
    semanticPayload: decisionProblem.semanticPayload,
    creationAuthorization: decisionProblem.creationAuthorization,
    bindingCompilation: binding.record,
    sourceBackedFarmId: farmValue,
    deploymentScope: deepFreeze(expectedScope)
  });
}
