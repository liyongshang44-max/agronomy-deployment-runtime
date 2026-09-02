import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  PERMISSIONS,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import {
  normalizeContextDatum,
  publishContextDatum,
  validateContextDatumAuthority
} from '../../context-contract/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority
} from './recorded-operation-context-semantic-mapping-authority.mjs';
import {
  validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority
} from './recorded-operation-context-epistemic-classification-authority.mjs';
import {
  validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority
} from './recorded-operation-context-provenance-classification-authority.mjs';
import {
  validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority
} from './recorded-operation-context-source-reference-hash-projection-authority.mjs';
import {
  validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority
} from './recorded-operation-context-temporal-support-classification-authority.mjs';
import {
  validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority
} from './recorded-operation-context-spatial-support-classification-authority.mjs';
import {
  validateAgronomicContextNonQuantitativeUnitRepresentationCompilationAuthority
} from './context-non-quantitative-unit-representation-authority.mjs';
import {
  validateAgronomicContextVerticalSupportNonApplicabilityCompilationAuthority
} from './context-vertical-support-non-applicability-authority.mjs';
import {
  validateAgronomicContextUncertaintyUnknownRepresentationCompilationAuthority
} from './context-uncertainty-unknown-representation-authority.mjs';
import {
  validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority
} from './context-source-acquisition-availability-projection-authority.mjs';
import {
  validateAgronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthority
} from './context-historical-timezone-boundary-resolution-authority.mjs';
import {
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PREDECESSOR_KEYS,
  AgronomicContextDatumAssemblyCompilationError,
  agronomicContextDatumAssemblyCompilationAuthorityRefs,
  agronomicContextDatumAssemblyHash,
  normalizeAgronomicContextDatumAssembly,
  normalizeAgronomicContextDatumAssemblyCompilation
} from './context-datum-assembly-contract.mjs';

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_DISPOSITIONS = deepFreeze([
  'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
  'REJECT_CONTEXT_DATUM_ASSEMBLY'
]);

export const AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS = deepFreeze([
  'CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED',
  'EPISTEMIC_CLASSIFICATION_AUTHORITY_VERIFIED',
  'PROVENANCE_CLASSIFICATION_AUTHORITY_VERIFIED',
  'SOURCE_REFERENCE_HASH_AUTHORITY_VERIFIED',
  'TEMPORAL_SUPPORT_AUTHORITY_VERIFIED',
  'SPATIAL_SUPPORT_AUTHORITY_VERIFIED',
  'UNIT_REPRESENTATION_AUTHORITY_VERIFIED',
  'VERTICAL_SUPPORT_AUTHORITY_VERIFIED',
  'UNCERTAINTY_AUTHORITY_VERIFIED',
  'AVAILABLE_AT_AUTHORITY_VERIFIED',
  'EFFECTIVE_INTERVAL_AUTHORITY_VERIFIED',
  'EXACT_CONTEXT_SEMANTIC_WORLD_CONVERGENCE_VERIFIED',
  'EXACT_SOURCE_WORLD_CONVERGENCE_VERIFIED',
  'EXACT_TEMPORAL_WORLD_CONVERGENCE_VERIFIED',
  'EXACT_AUTHORITY_REF_CONVERGENCE_VERIFIED',
  'A02_CONTEXT_DATUM_TEMPLATE_COMPATIBILITY_VERIFIED',
  'NO_CALLER_FIELD_AUTHORITY',
  'NO_DATE_TO_TIMESTAMP_MUTATION',
  'NO_AVAILABLE_AT_RECOMPUTATION',
  'NO_TIMEZONE_HOST_RUNTIME_RECOMPUTATION',
  'NO_GEOMETRY_INFERENCE',
  'NO_TARGET_REF_INJECTION',
  'NO_FARM_ID_AS_GEOMETRY_OR_TENANT_SCOPE',
  'NO_GENERIC_CONTEXT_DATUM_ASSEMBLY_RULE',
  'NO_CONTEXT_MANIFEST_PUBLICATION',
  'NO_DECISION_PROBLEM_PUBLICATION',
  'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
]);

const REVIEW_DISPOSITIONS = new Set(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS = new Set(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger) {
  if (!ledger || typeof ledger.publish !== 'function'
    || typeof ledger.resolve !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_LEDGER_REQUIRED',
      'DEC-0031 requires replayable AuthorityLedger'
    );
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INPUT',
      name + ' must be a non-empty string'
    );
  }
  return value;
}

function sameSemantic(a, b) {
  return canonicalizeSemanticJson(a) === canonicalizeSemanticJson(b);
}

function exactRefIn(refs, expected) {
  return Array.isArray(refs) && refs.some((ref) => sameAuthorityRef(ref, expected));
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function uniqueRecords(records) {
  const map = new Map();
  for (const record of records) map.set(refKey(record.ref), record);
  return [...map.values()].sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)));
}

function mustSameRef(actual, expected, code, message) {
  if (!actual || !expected || !sameAuthorityRef(actual, expected)) {
    throw new AgronomicContextDatumAssemblyCompilationError(code, message);
  }
}

function normalizeReviewChecks(values, disposition) {
  if (!Array.isArray(values)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_CHECKS_REQUIRED',
      'confirmedChecks must be an array'
    );
  }
  const checks = values.map((value, index) => text(value, 'confirmedChecks[' + index + ']'));
  if (new Set(checks).size !== checks.length) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_CHECKS_INVALID',
      'confirmedChecks cannot contain duplicates'
    );
  }
  for (const check of checks) {
    if (!REQUIRED_CHECKS.has(check)) {
      throw new AgronomicContextDatumAssemblyCompilationError(
        'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_CHECKS_INVALID',
        'unsupported DEC-0031 review check ' + check
      );
    }
  }
  if (disposition === 'ACCEPT_CONTEXT_DATUM_ASSEMBLY') {
    for (const required of REQUIRED_CHECKS) {
      if (!checks.includes(required)) {
        throw new AgronomicContextDatumAssemblyCompilationError(
          'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_INCOMPLETE',
          'accepted DEC-0031 review must confirm ' + required
        );
      }
    }
  }
  return deepFreeze([...checks].sort());
}

function assertAuditActor(audit, principal) {
  if (!audit?.actor
    || audit.actor.id !== principal.principalId
    || audit.actor.type !== principal.type) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_ACTOR_MISMATCH',
      'audit actor must match exact DEC-0031 reviewer'
    );
  }
}

function sourceRecordFromEvidence(entry) {
  if (entry?.source?.ref) return entry.source;
  throw new AgronomicContextDatumAssemblyCompilationError(
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_SOURCE_LINEAGE_INVALID',
    'predecessor evidence must expose exact source record'
  );
}

function deriveExpectedTemplate(world) {
  const target = world.mapping.semanticPayload.mapping.targetContextSemantic;
  return deepFreeze({
    contractVersion: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE.contractVersion,
    semanticId: target.semanticId,
    value: cloneCanonicalValue(target.value),
    unit:
      world.unit.semanticPayload.representation.unitRepresentation.wireValue,
    epistemicClass:
      world.epistemic.semanticPayload.classification.epistemicClass,
    provenanceClass:
      world.provenance.semanticPayload.classification.provenanceClass,
    effectiveInterval:
      cloneCanonicalValue(world.historical.semanticPayload.resolution.effectiveInterval),
    availableAt:
      world.availability.semanticPayload.projection.availableAtProjection.availableAt,
    spatialSupport:
      cloneCanonicalValue(world.spatial.semanticPayload.classification.spatialSupport),
    verticalSupport:
      world.vertical.semanticPayload.representation.verticalSupportRepresentation.wireValue,
    temporalSupport:
      cloneCanonicalValue(world.temporal.semanticPayload.classification.temporalSupport),
    uncertainty:
      cloneCanonicalValue(world.uncertainty.semanticPayload.representation.uncertaintyRepresentation),
    source: deepFreeze({
      providerId:
        world.source.semanticPayload.projection.providerId,
      sourceRef:
        world.source.semanticPayload.projection.projectedSource.sourceRef,
      contentHash:
        world.source.semanticPayload.projection.projectedSource.contentHash
    })
  });
}

function validateAssemblyWorld({
  ledger,
  sourceRegistry,
  assembly,
  timezoneRuleEvidence
}) {
  const normalized = normalizeAgronomicContextDatumAssembly(assembly);
  const refs = normalized.predecessorRefs;

  const mapping =
    validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.contextSemanticMappingCompilationRef
    });
  const epistemic =
    validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.epistemicClassificationCompilationRef
    });
  const provenance =
    validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.provenanceClassificationCompilationRef
    });
  const source =
    validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.sourceReferenceHashProjectionCompilationRef
    });
  const temporal =
    validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.temporalSupportClassificationCompilationRef
    });
  const spatial =
    validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.spatialSupportClassificationCompilationRef
    });
  const unit =
    validateAgronomicContextNonQuantitativeUnitRepresentationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.unitRepresentationCompilationRef
    });
  const vertical =
    validateAgronomicContextVerticalSupportNonApplicabilityCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.verticalSupportNonApplicabilityCompilationRef
    });
  const uncertainty =
    validateAgronomicContextUncertaintyUnknownRepresentationCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.uncertaintyUnknownRepresentationCompilationRef
    });
  const availability =
    validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.sourceAcquisitionAvailabilityProjectionCompilationRef
    });
  const historical =
    validateAgronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: refs.historicalTimezoneBoundaryResolutionCompilationRef,
      timezoneRuleEvidence
    });

  mustSameRef(
    epistemic.semanticPayload.classification.contextSemanticMappingCompilationRef,
    mapping.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_EPISTEMIC_PREDECESSOR_MISMATCH',
    'DEC-0017 must bind the exact DEC-0016 assembly ref'
  );
  mustSameRef(
    provenance.semanticPayload.classification.contextEpistemicClassificationCompilationRef,
    epistemic.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PROVENANCE_PREDECESSOR_MISMATCH',
    'DEC-0018 must bind the exact DEC-0017 assembly ref'
  );
  mustSameRef(
    source.sourceProviderIdentityBinding.semanticPayload.binding
      .contextProvenanceClassificationCompilationRef,
    provenance.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_SOURCE_PREDECESSOR_MISMATCH',
    'DEC-0020 must close through exact DEC-0018 assembly authority'
  );
  mustSameRef(
    temporal.semanticPayload.classification.sourceReferenceHashProjectionCompilationRef,
    source.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TEMPORAL_PREDECESSOR_MISMATCH',
    'DEC-0021 must bind exact DEC-0020 assembly authority'
  );
  mustSameRef(
    availability.semanticPayload.projection.parentSourceReferenceHashProjectionCompilationRef,
    source.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AVAILABILITY_PREDECESSOR_MISMATCH',
    'DEC-0028 must bind exact DEC-0020 assembly authority'
  );
  for (const fieldWorld of [spatial, unit, vertical, uncertainty]) {
    const parentRef =
      fieldWorld.semanticPayload.classification?.contextSemanticMappingCompilationRef
      ?? fieldWorld.semanticPayload.representation?.parentContextSemanticMappingCompilationRef;
    mustSameRef(
      parentRef,
      mapping.record.ref,
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_MAPPING_BRANCH_MISMATCH',
      'all mapping-derived field branches must bind exact DEC-0016 assembly authority'
    );
  }

  const timezone =
    historical.calendarDateLocalCivilFrameBinding.sourceNativeTimezoneIdentityBinding;
  mustSameRef(
    timezone.semanticPayload.binding.temporalSupportClassificationCompilationRef,
    temporal.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_HISTORICAL_TEMPORAL_MISMATCH',
    'DEC-0030 temporal chain must close through exact DEC-0021 assembly authority'
  );
  mustSameRef(
    timezone.semanticPayload.binding.targetIdentityBindingCompilationRef,
    spatial.targetIdentityBinding.record.ref,
    'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TARGET_BRANCH_MISMATCH',
    'DEC-0030 and DEC-0023 must converge on exact DEC-0015 target authority'
  );

  const expectedTarget = mapping.semanticPayload.mapping.targetContextSemantic;
  const targetValues = [
    epistemic.semanticPayload.classification.targetContextSemantic,
    provenance.semanticPayload.classification.targetContextSemantic,
    source.semanticPayload.projection.targetContextSemantic,
    temporal.semanticPayload.classification.targetContextSemantic,
    spatial.semanticPayload.classification.targetContextSemantic,
    unit.semanticPayload.representation.targetContextSemantic,
    vertical.semanticPayload.representation.targetContextSemantic,
    uncertainty.semanticPayload.representation.targetContextSemantic,
    availability.semanticPayload.projection.targetContextSemantic,
    historical.semanticPayload.resolution.targetContextSemantic
  ];
  if (!targetValues.every((value) => sameSemantic(value, expectedTarget))) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TARGET_SEMANTIC_MISMATCH',
      'all field authorities must converge on exact crop.planting_date DATE 2011-05-03'
    );
  }

  const world = {
    mapping,
    epistemic,
    provenance,
    source,
    temporal,
    spatial,
    unit,
    vertical,
    uncertainty,
    availability,
    historical
  };
  const expectedTemplate = deriveExpectedTemplate(world);
  if (!sameSemantic(normalized.datumTemplate, expectedTemplate)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TEMPLATE_MISMATCH',
      'datumTemplate must be derived exactly from the 11 accepted field authorities'
    );
  }

  const requiredSources = uniqueRecords([
    mapping.parentOccurrence.source,
    ...mapping.semanticNormalization.replayedEvidence.map(sourceRecordFromEvidence),
    ...spatial.targetIdentityBinding.replayedEvidence.map(sourceRecordFromEvidence),
    ...timezone.replayedEvidence.map(sourceRecordFromEvidence)
  ]);

  return deepFreeze({
    normalized,
    expectedTemplate,
    requiredSources,
    ...world
  });
}

function resolveAuthorizationCoverage({
  ledger,
  authorizationDecisionAuditRefs,
  reviewerPrincipal,
  requiredSources
}) {
  if (!Array.isArray(authorizationDecisionAuditRefs)
    || authorizationDecisionAuditRefs.length !== requiredSources.length) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORIZATION_REQUIRED',
      'assembly review requires one exact source inspection authorization per source'
    );
  }
  const records = authorizationDecisionAuditRefs.map((ref) => ledger.resolve(ref));
  for (const source of requiredSources) {
    const resourceId = sourceReviewResourceId(source.ref);
    const matches = records.filter((record) => {
      const decision = record.semanticPayload ?? {};
      if (record.ref.kind !== 'AuthorizationDecisionAudit'
        || decision.allowed !== true
        || decision.operation !== 'KNOWLEDGE_INSPECT'
        || !samePrincipalIdentity(decision.principal, reviewerPrincipal)) {
        return false;
      }
      const policy = ledger.resolve(decision.policyRef);
      return policy.ref.kind === 'KnowledgeGovernancePolicy'
        && policy.semanticPayload?.resourceId === resourceId;
    });
    if (matches.length !== 1) {
      throw new AgronomicContextDatumAssemblyCompilationError(
        'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORIZATION_INVALID',
        'review authorization must cover each exact source exactly once'
      );
    }
    const decision = matches[0].semanticPayload;
    const policy = ledger.resolve(decision.policyRef);
    const assignments = (decision.assignmentRefs ?? []).map((ref) => ledger.resolve(ref));
    const recomputed = authorizeKnowledgeInspection({
      principal: reviewerPrincipal,
      policy,
      roleAssignments: assignments,
      authorizationScope: decision.request?.authorizationScope
    });
    const hasGrant = assignments.some((assignment) =>
      assignment.ref.kind === 'RoleAssignment'
      && samePrincipalIdentity(assignment.semanticPayload?.principal, reviewerPrincipal)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.SOURCE_READ)
      && (assignment.semanticPayload?.permissions ?? []).includes(PERMISSIONS.KNOWLEDGE_INSPECT)
    );
    if (!recomputed.allowed || recomputed.decisionHash !== decision.decisionHash || !hasGrant) {
      throw new AgronomicContextDatumAssemblyCompilationError(
        'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORIZATION_INVALID',
        'assembly source inspection authorization cannot be reproduced'
      );
    }
  }
  return deepFreeze(records);
}

export function publishAgronomicContextDatumAssemblyReviewDecision({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  assembly,
  timezoneRuleEvidence,
  disposition,
  reviewerPrincipal,
  authorizationDecisionAuditRefs,
  confirmedChecks,
  rationale,
  audit
}) {
  requireLedger(ledger);
  if (!REVIEW_DISPOSITIONS.has(disposition)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'INVALID_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_DISPOSITION',
      'unsupported DEC-0031 review disposition'
    );
  }
  const reviewer = createPrincipal(reviewerPrincipal);
  const checks = normalizeReviewChecks(confirmedChecks, disposition);
  const world = validateAssemblyWorld({
    ledger,
    sourceRegistry,
    assembly,
    timezoneRuleEvidence
  });
  const auths = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  assertAuditActor(audit, reviewer);
  const assemblyHash = agronomicContextDatumAssemblyHash(world.normalized);
  const predecessorBindings = deepFreeze({
    predecessorRefs: cloneCanonicalValue(world.normalized.predecessorRefs),
    datumTemplate: cloneCanonicalValue(world.expectedTemplate),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  });
  return ledger.publish({
    kind: 'AgronomicContextDatumAssemblyReviewDecision',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: {
      authorityClass: 'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORITY',
      assembly: cloneCanonicalValue(world.normalized),
      assemblyHash,
      predecessorBindings,
      disposition,
      confirmedChecks: checks,
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: auths.map((record) => record.ref),
      rationale: text(rationale, 'rationale')
    },
    audit: {
      ...audit,
      action: 'REVIEW_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY',
      inputRefs: [
        ...Object.values(world.normalized.predecessorRefs),
        ...auths.map((record) => record.ref),
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        assemblyHash,
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
  normalizedCompilation,
  timezoneRuleEvidence
}) {
  const review = ledger.resolve(reviewRef);
  if (review.ref.kind !== 'AgronomicContextDatumAssemblyReviewDecision') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_REQUIRED',
      'assembly publication requires DEC-0031 review'
    );
  }
  const payload = review.semanticPayload ?? {};
  if (payload.authorityClass !== 'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORITY') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_INVALID',
      'invalid assembly review authorityClass'
    );
  }
  if (payload.disposition !== 'ACCEPT_CONTEXT_DATUM_ASSEMBLY') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_REJECTED',
      'only accepted assembly review can authorize compilation'
    );
  }
  normalizeReviewChecks(payload.confirmedChecks, payload.disposition);
  const assembly = normalizedCompilation.assembly;
  const assemblyHash = agronomicContextDatumAssemblyHash(assembly);
  if (payload.assemblyHash !== assemblyHash || !sameSemantic(payload.assembly, assembly)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_MISMATCH',
      'assembly review must bind exact normalized assembly'
    );
  }
  const world = validateAssemblyWorld({
    ledger,
    sourceRegistry,
    assembly,
    timezoneRuleEvidence
  });
  const expectedBindings = {
    predecessorRefs: cloneCanonicalValue(assembly.predecessorRefs),
    datumTemplate: cloneCanonicalValue(world.expectedTemplate),
    requiredSourceRefs: world.requiredSources.map((source) => source.ref)
  };
  if (!sameSemantic(payload.predecessorBindings, expectedBindings)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_PREDECESSOR_MISMATCH',
      'review predecessor bindings must match exact assembly world'
    );
  }
  const reviewer = createPrincipal(payload.reviewerPrincipal);
  const auths = resolveAuthorizationCoverage({
    ledger,
    authorizationDecisionAuditRefs: payload.authorizationDecisionAuditRefs,
    reviewerPrincipal: reviewer,
    requiredSources: world.requiredSources
  });
  const direct = ledger.auditFor(review.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, review.ref))
    .some((entry) =>
      entry.action === 'REVIEW_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY'
      && entry.actor?.id === reviewer.principalId
      && entry.actor?.type === reviewer.type
      && Object.values(assembly.predecessorRefs)
        .every((ref) => exactRefIn(entry.inputRefs, ref))
      && auths.every((auth) => exactRefIn(entry.inputRefs, auth.ref))
      && entry.details?.assemblyHash === assemblyHash
      && sameSemantic(entry.details?.predecessorBindings, expectedBindings)
    );
  if (!direct) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUDIT_INVALID',
      'assembly review lacks direct exact-predecessor audit'
    );
  }
  return deepFreeze({ review, reviewer, auths, world });
}

export function publishAgronomicContextDatumAssemblyCompilation({
  ledger,
  sourceRegistry,
  logicalId,
  version,
  compilation,
  timezoneRuleEvidence,
  audit
}) {
  requireLedger(ledger);
  const normalized = normalizeAgronomicContextDatumAssemblyCompilation(compilation);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INCOMPLETE_NOT_PUBLISHABLE',
      'v1 requires COMPLETE assembly coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.assemblyReviewRef,
    normalizedCompilation: normalized,
    timezoneRuleEvidence
  });
  assertAuditActor(audit, review.reviewer);
  const refs = agronomicContextDatumAssemblyCompilationAuthorityRefs(normalized);
  return ledger.publish({
    kind: 'AgronomicContextDatumAssemblyCompilation',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: cloneCanonicalValue(normalized),
    audit: {
      ...audit,
      action: 'PUBLISH_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION',
      inputRefs: [...refs, ...(audit?.inputRefs ?? [])],
      details: {
        ...(audit?.details ?? {}),
        authorityClass: 'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_AUTHORITY',
        assemblyHash: normalized.assemblyHash,
        assemblyReviewRef: review.review.ref,
        predecessorRefs: cloneCanonicalValue(normalized.assembly.predecessorRefs),
        datumTemplate: cloneCanonicalValue(normalized.assembly.datumTemplate)
      }
    }
  });
}

export function validateAgronomicContextDatumAssemblyCompilationAuthority({
  ledger,
  sourceRegistry,
  compilationRef,
  timezoneRuleEvidence
}) {
  requireLedger(ledger);
  const record = ledger.resolve(compilationRef);
  if (record.ref.kind !== 'AgronomicContextDatumAssemblyCompilation') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_REQUIRED',
      'expected AgronomicContextDatumAssemblyCompilation'
    );
  }
  const normalized =
    normalizeAgronomicContextDatumAssemblyCompilation(record.semanticPayload);
  if (normalized.losslessCoverage.status !== 'COMPLETE') {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_INCOMPLETE_AUTHORITY_INVALID',
      'stored v1 assembly must have COMPLETE coverage'
    );
  }
  const review = validateReview({
    ledger,
    sourceRegistry,
    reviewRef: normalized.assemblyReviewRef,
    normalizedCompilation: normalized,
    timezoneRuleEvidence
  });
  const refs = agronomicContextDatumAssemblyCompilationAuthorityRefs(normalized);
  const direct = ledger.auditFor(record.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, record.ref))
    .some((entry) =>
      entry.action === 'PUBLISH_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION'
      && entry.actor?.id === review.reviewer.principalId
      && entry.actor?.type === review.reviewer.type
      && refs.every((ref) => exactRefIn(entry.inputRefs, ref))
      && entry.details?.assemblyHash === normalized.assemblyHash
      && sameAuthorityRef(entry.details?.assemblyReviewRef, review.review.ref)
      && sameSemantic(entry.details?.predecessorRefs, normalized.assembly.predecessorRefs)
      && sameSemantic(entry.details?.datumTemplate, normalized.assembly.datumTemplate)
    );
  if (!direct) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_AUDIT_INVALID',
      'assembly compilation lacks direct reviewer audit'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: normalized,
    assemblyReview: review.review,
    fieldAuthorityWorld: review.world
  });
}

export function publishAgronomicContextDatumFromAssembly({
  ledger,
  sourceRegistry,
  assemblyCompilationRef,
  timezoneRuleEvidence,
  logicalId,
  version,
  target,
  principal,
  authorizationDecisionAuditRef,
  audit,
  datum,
  datumOverrides
}) {
  if (datum !== undefined || datumOverrides !== undefined) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CALLER_FIELD_OVERRIDE_FORBIDDEN',
      'caller cannot supply or override datum fields'
    );
  }
  const assembly = validateAgronomicContextDatumAssemblyCompilationAuthority({
    ledger,
    sourceRegistry,
    compilationRef: assemblyCompilationRef,
    timezoneRuleEvidence
  });
  return publishContextDatum({
    ledger,
    logicalId,
    version,
    target,
    datum: cloneCanonicalValue(assembly.semanticPayload.assembly.datumTemplate),
    principal,
    authorizationDecisionAuditRef,
    audit: {
      ...audit,
      inputRefs: [
        assembly.record.ref,
        ...(audit?.inputRefs ?? [])
      ],
      details: {
        ...(audit?.details ?? {}),
        agronomicContextDatumAssemblyCompilationRef: assembly.record.ref
      }
    }
  });
}

export function validateAgronomicContextDatumAssemblyPublicationAuthority({
  ledger,
  sourceRegistry,
  contextDatumRef,
  timezoneRuleEvidence
}) {
  const contextDatum = validateContextDatumAuthority({
    ledger,
    contextDatumRef
  });
  const direct = ledger.auditFor(contextDatum.record.ref)
    .filter((entry) => sameAuthorityRef(entry.objectRef, contextDatum.record.ref))
    .find((entry) =>
      entry.action === 'PUBLISH_CONTEXT_DATUM'
      && entry.details?.agronomicContextDatumAssemblyCompilationRef
      && exactRefIn(
        entry.inputRefs,
        entry.details.agronomicContextDatumAssemblyCompilationRef
      )
    );
  if (!direct) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PUBLICATION_PROOF_REQUIRED',
      'ContextDatum lacks direct DEC-0031 assembly publication proof'
    );
  }
  const assembly =
    validateAgronomicContextDatumAssemblyCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef:
        direct.details.agronomicContextDatumAssemblyCompilationRef,
      timezoneRuleEvidence
    });
  const expected = normalizeContextDatum(
    assembly.semanticPayload.assembly.datumTemplate,
    { datumId: contextDatum.record.ref.logicalId }
  );
  if (!sameSemantic(expected, contextDatum.semanticPayload)) {
    throw new AgronomicContextDatumAssemblyCompilationError(
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PUBLICATION_SEMANTICS_MISMATCH',
      'stored ContextDatum must exactly equal the accepted assembly template'
    );
  }
  return deepFreeze({
    contextDatum: contextDatum.record,
    semanticPayload: contextDatum.semanticPayload,
    writeAuthorization: contextDatum.writeAuthorization,
    assemblyCompilation: assembly.record,
    assembly: assembly.semanticPayload.assembly
  });
}
