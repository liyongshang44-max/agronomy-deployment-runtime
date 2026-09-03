import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION,
  AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REQUIRED_REVIEW_CHECKS,
  AgronomicContextManifestGovernedWorldError,
  agronomicContextTargetRefFarmInstanceProjectionHash,
  agronomicDecisionProblemFarmTargetBindingHash,
  publishAgronomicContextTargetRefFarmInstanceProjectionReviewDecision,
  publishAgronomicContextTargetRefFarmInstanceProjectionCompilation,
  validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority,
  publishAgronomicDecisionProblemFarmTargetBindingReviewDecision,
  publishAgronomicDecisionProblemFarmTargetBindingCompilation,
  validateAgronomicDecisionProblemFarmTargetBindingCompilationAuthority,
  publishAgronomicDecisionProblemWithFarmTargetBinding,
  validateAgronomicDecisionProblemFarmTargetPublicationAuthority,
  publishAgronomicContextDatumFromAssembly,
  publishAgronomicContextManifestFromGovernedWorld,
  validateAgronomicContextManifestGovernedWorldAuthority,
  publishAgronomicRecordedOperationContextSpatialSupportClassificationCompilation
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  PERMISSIONS,
  authorizeDecisionProblemCreation,
  createPrincipal,
  publishRoleAssignment,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import {
  DECISION_PROBLEM_CONTRACT_VERSION,
  publishDecisionProblem
} from '../../packages/decision-problem/src/index.mjs';
import { publishContextManifest } from '../../packages/context-manifest/src/index.mjs';
import { audit } from '../derived-knowledge/fixture.mjs';
import {
  env,
  historicalTimezoneRuleEvidence,
  normalizationReviewer,
  parentSourceAuthorization,
  semanticSourceAuthorization,
  targetIdentityAuthorization,
  dec0031SpatialPublished,
  dec0031SpatialValidated,
  dec0031SpatialClassification,
  dec0031SpatialReview,
  buildDec0031SpatialCompilation,
  dec0031AssemblyPublished,
  dec0031ContextDatum,
  dec0031ContextDatumValidated,
  genericMatchingDatum
} from '../gold-recorded-operation-context-datum-assembly-publication-sustainable-corn/run.mjs';

function manifestAudit(eventId, principal, occurredAt = '2026-08-30T14:05:00.000Z') {
  return {
    eventId,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: {
      suite: 'dec0033-governed-context-manifest',
      classification: 'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD'
    }
  };
}

function buildTargetRefProjection(parentSpatialRef = dec0031SpatialPublished.ref) {
  const identity =
    dec0031SpatialValidated.targetIdentityBinding.semanticPayload.binding
      .sourceBackedTargetIdentity;
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_CONTRACT_VERSION,
    projectionId: 'projection.gold.dec0033.target-ref-farm',
    parentContextSpatialSupportClassificationCompilationRef: parentSpatialRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    sourceBackedTargetIdentity: {
      namespaceRef: identity.namespaceRef,
      granularity: 'FARM',
      targetId: identity.targetId
    },
    targetRefProjection: { field: 'farmId', value: identity.targetId },
    rationale:
      'Project only exact source-backed FARM identity from the validated DEC-0023 predecessor.'
  };
}

function buildTargetRefCompilation(projection, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash: agronomicContextTargetRefFarmInstanceProjectionHash(projection),
    targetRefProjectionReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SPATIAL_SUPPORT',
        'SOURCE_BACKED_FARM_TARGET_IDENTITY',
        'TARGET_REF_FARM_ID_PROJECTION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'FARM_ID_IS_SOURCE_BACKED_NOT_GLOBAL_CANONICAL',
      'NO_COMPLETE_TARGET_REF',
      'NO_ORGANIZATION_OR_TENANT_AUTHORITY',
      'NO_FIELD_SEASON_OR_ZONE_AUTHORITY',
      'NO_GEOMETRY_OR_GEOMETRY_REF_AUTHORITY'
    ]
  };
}

function publishTargetRefWorld(parentSpatialRef, suffix) {
  const projection = buildTargetRefProjection(parentSpatialRef);
  const review =
    publishAgronomicContextTargetRefFarmInstanceProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0033.target-ref.' + suffix,
      version: '1',
      projection,
      disposition: 'ACCEPT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref,
        targetIdentityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Revalidate exact DEC-0023 FARM world before DEC-0027 projection.',
      audit: audit(
        'evt-gold-dec0033-target-ref-review-' + suffix,
        normalizationReviewer.principalId
      )
    });
  const published =
    publishAgronomicContextTargetRefFarmInstanceProjectionCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0033.target-ref.' + suffix,
      version: '1',
      compilation: buildTargetRefCompilation(projection, review.ref),
      audit: audit(
        'evt-gold-dec0033-target-ref-publish-' + suffix,
        normalizationReviewer.principalId
      )
    });
  const validated =
    validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      compilationRef: published.ref
    });
  return { projection, review, published, validated };
}

const targetRefWorld = publishTargetRefWorld(dec0031SpatialPublished.ref, 'primary');
const exactTargetId =
  targetRefWorld.validated.semanticPayload.projection
    .sourceBackedTargetIdentity.targetId;
assert.equal(
  targetRefWorld.validated.semanticPayload.projection
    .parentContextSpatialSupportClassificationCompilationRef.logicalId,
  dec0031SpatialPublished.ref.logicalId
);

function buildFarmBinding(parentProjectionRef, targetId = exactTargetId) {
  return {
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.gold.dec0033.decision-problem-farm-target',
    parentTargetRefFarmInstanceProjectionCompilationRef: parentProjectionRef,
    sourceBackedTargetComponent: { field: 'farmId', value: targetId },
    deploymentOwnedTargetFields: {
      required: ['organizationId'],
      optional: ['tenantId']
    },
    forbiddenUnestablishedTargetFields: {
      fields: ['fieldId', 'seasonId', 'zoneId']
    },
    decisionIntentAuthority: 'A01_AUTHORIZED_CREATOR',
    targetBindingRule: 'INJECT_EXACT_PARENT_FARM_ID',
    rationale:
      'Bind exact DEC-0027 farmId only; deployment scope and decision intent remain A01-owned.'
  };
}

function buildFarmBindingCompilation(binding, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash: agronomicDecisionProblemFarmTargetBindingHash(binding),
    bindingReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'EXACT_DEC_0027_FARM_TARGET_COMPONENT',
        'DEPLOYMENT_SCOPE_OWNERSHIP_SEPARATION',
        'A01_DECISION_INTENT_OWNERSHIP_SEPARATION',
        'STANDARD_A01_PUBLICATION_BRIDGE'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_REAL_DEPLOYMENT_INTENT_CLAIM',
      'NO_FIELD_SEASON_ZONE_AUTHORITY',
      'NO_GEOMETRY_AUTHORITY',
      'NO_EVIDENCE_CUTOFF_AUTHORITY'
    ]
  };
}

function publishFarmBindingWorld(parentProjectionRef, suffix) {
  const binding = buildFarmBinding(parentProjectionRef);
  const review =
    publishAgronomicDecisionProblemFarmTargetBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0033.farm-binding.' + suffix,
      version: '1',
      binding,
      disposition:
        'ACCEPT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref,
        targetIdentityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale:
        'Accept exact DEC-0027 FARM component while preserving A01 ownership separation.',
      audit: audit(
        'evt-gold-dec0033-farm-binding-review-' + suffix,
        normalizationReviewer.principalId
      )
    });
  const published =
    publishAgronomicDecisionProblemFarmTargetBindingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0033.farm-binding.' + suffix,
      version: '1',
      compilation: buildFarmBindingCompilation(binding, review.ref),
      audit: audit(
        'evt-gold-dec0033-farm-binding-publish-' + suffix,
        normalizationReviewer.principalId
      )
    });
  validateAgronomicDecisionProblemFarmTargetBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: published.ref
  });
  return { binding, review, published };
}

const farmBindingWorld =
  publishFarmBindingWorld(targetRefWorld.published.ref, 'primary');

const decisionProblemCreator = createPrincipal({
  principalId: 'gold-dec0033-decision-problem-creator',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
});
const decisionProblemCreatorRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.dec0033.decision-problem-creator',
  version: '1',
  principal: decisionProblemCreator,
  role: 'DECISION_PROBLEM_CREATOR',
  roleDefinitionVersion: 'adr-dec0033-gold-v1',
  permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'DECISION_PROBLEM'
  },
  audit: audit(
    'evt-gold-dec0033-decision-problem-role',
    decisionProblemCreator.principalId
  )
});

function decisionAuthorization(logicalId) {
  const decision = authorizeDecisionProblemCreation({
    principal: decisionProblemCreator,
    roleAssignments: [decisionProblemCreatorRole],
    authorizationScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'DECISION_PROBLEM',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(
      'evt-gold-dec0033-decision-auth-' + logicalId,
      decisionProblemCreator.principalId
    )
  });
}

const deterministicDecisionIntent = {
  decisionType: 'MACHINE_ACCEPTANCE_FIXTURE_DECISION',
  logicalTime: '2026-08-16T01:00:00Z',
  decisionHorizon: { duration: 'PT24H' },
  objective: { code: 'MACHINE_ACCEPTANCE_FIXTURE_OBJECTIVE' },
  actionSpace: [
    'MACHINE_ACCEPTANCE_FIXTURE_ACTION_A',
    'MACHINE_ACCEPTANCE_FIXTURE_ACTION_B'
  ],
  constraints: [{ code: 'MACHINE_ACCEPTANCE_FIXTURE_BOUND', value: '1' }],
  usePurpose: 'MACHINE_ACCEPTANCE_FIXTURE',
  useClass: 'TEST_ONLY',
  decisionAuthorityMode: 'RUNTIME_ONLY',
  decisionDeadline: '2026-08-16T12:00:00Z'
};

function publishBoundDecision(farmBindingRef, logicalId, suffix) {
  const authorization = decisionAuthorization(logicalId);
  const published =
    publishAgronomicDecisionProblemWithFarmTargetBinding({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      farmTargetBindingCompilationRef: farmBindingRef,
      logicalId,
      version: '1',
      deploymentScope: {
        organizationId: 'org-a',
        tenantId: 'tenant-a'
      },
      decisionIntent: deterministicDecisionIntent,
      principal: decisionProblemCreator,
      authorizationDecisionAuditRef: authorization.ref,
      audit: audit(
        'evt-gold-dec0033-decision-publish-' + suffix,
        decisionProblemCreator.principalId
      )
    });
  const validated =
    validateAgronomicDecisionProblemFarmTargetPublicationAuthority({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      decisionProblemRef: published.ref
    });
  return { authorization, published, validated };
}

const decisionWorld =
  publishBoundDecision(
    farmBindingWorld.published.ref,
    'dp-gold-dec0033-sustainable-corn',
    'primary'
  );
assert.deepEqual(decisionWorld.validated.semanticPayload.targetRef, {
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  farmId: exactTargetId
});

const manifestWriter = createPrincipal({
  principalId: 'gold-dec0033-manifest-writer',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
});
const manifestWriterRole = publishRoleAssignment({
  ledger: env.ledger,
  logicalId: 'role.gold.dec0033.manifest-writer',
  version: '1',
  principal: manifestWriter,
  role: 'CONTEXT_MANIFEST_WRITER',
  roleDefinitionVersion: 'adr-dec0033-gold-v1',
  permissions: [PERMISSIONS.CONTEXT_WRITE],
  scope: {
    organizationId: 'org-a',
    tenantId: 'tenant-a',
    resourceType: 'CONTEXT_MANIFEST'
  },
  audit: audit(
    'evt-gold-dec0033-manifest-role',
    manifestWriter.principalId,
    manifestWriter.type
  )
});

function manifestAuthorization(logicalId) {
  const decision = authorizeContextWrite({
    principal: manifestWriter,
    roleAssignments: [manifestWriterRole],
    authorizationScope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'CONTEXT_MANIFEST',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(
      'evt-gold-dec0033-manifest-auth-' + logicalId,
      manifestWriter.principalId,
      manifestWriter.type
    )
  });
}

const evidenceCutoff = '2026-08-30T14:00:00.000Z';
const manifestLogicalId = 'cm-gold-dec0033-governed-world';
const manifestAuth = manifestAuthorization(manifestLogicalId);
const manifest =
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: decisionWorld.published.ref,
    contextDatumRef: dec0031ContextDatum.ref,
    evidenceCutoff,
    logicalId: manifestLogicalId,
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: manifestAuth.ref,
    audit: manifestAudit(
      'evt-gold-dec0033-manifest-publish',
      manifestWriter
    )
  });

const validatedManifest =
  validateAgronomicContextManifestGovernedWorldAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    contextManifestRef: manifest.ref
  });
assert.equal(
  validatedManifest.classification,
  'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD'
);
assert.equal(validatedManifest.evidenceCutoff, evidenceCutoff);
assert.deepEqual(validatedManifest.manifest.semanticPayload.datumRefs, [
  dec0031ContextDatum.ref
]);
assert.deepEqual(
  validatedManifest.manifest.semanticPayload.resolvedReferenceReceiptRefs,
  []
);
assert.equal(validatedManifest.manifest.semanticPayload.replayClass, 'EXACT');
assert.equal(validatedManifest.sourceBackedFarmId, exactTargetId);
assert.ok(
  deterministicDecisionIntent.logicalTime
    < dec0031ContextDatumValidated.semanticPayload.availableAt
);

const directPublication =
  env.ledger.auditFor(manifest.ref)
    .find((entry) => entry.action === 'PUBLISH_CONTEXT_MANIFEST');
assert.ok(directPublication);
assert.equal(directPublication.inputRefs.length, 3);
assert.deepEqual(
  directPublication.inputRefs.map((ref) => ref.kind).sort(),
  ['AuthorizationDecisionAudit', 'ContextDatum', 'DecisionProblem'].sort()
);
assert.equal(
  directPublication.inputRefs.some((ref) => ref.kind.startsWith('Agronomic')),
  false
);

// No bridge-specific publication marker: exact generic A04 publication is sufficient
// when its frozen DecisionProblem and ContextDatum refs replay DEC-0032/DEC-0031.
const genericManifestId = 'cm-gold-dec0033-generic-a04-same-world';
const genericManifestAuth = manifestAuthorization(genericManifestId);
const genericManifest = publishContextManifest({
  ledger: env.ledger,
  logicalId: genericManifestId,
  version: '1',
  decisionProblemRef: decisionWorld.published.ref,
  evidenceCutoff,
  datumRefs: [dec0031ContextDatum.ref],
  resolvedReferenceReceiptRefs: [],
  principal: manifestWriter,
  authorizationDecisionAuditRef: genericManifestAuth.ref,
  audit: manifestAudit(
    'evt-gold-dec0033-generic-a04-same-world',
    manifestWriter
  )
});
assert.equal(
  validateAgronomicContextManifestGovernedWorldAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    contextManifestRef: genericManifest.ref
  }).sourceBackedFarmId,
  exactTargetId
);

function expectGovernedError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof AgronomicContextManifestGovernedWorldError);
    assert.equal(error.code, code);
    return true;
  });
}

const sharedNegativeManifestAuth =
  manifestAuthorization('cm-gold-dec0033-negative-shared');

// Generic visible-equivalent A02 is insufficient.
assert.throws(() =>
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: decisionWorld.published.ref,
    contextDatumRef: genericMatchingDatum.ref,
    evidenceCutoff,
    logicalId: 'cm-gold-dec0033-negative-shared',
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
    audit: manifestAudit(
      'evt-gold-dec0033-generic-a02-denied',
      manifestWriter
    )
  })
);

// Generic visible-equivalent A01 is insufficient.
const genericDpId = 'dp-gold-dec0033-generic-matching';
const genericDpAuth = decisionAuthorization(genericDpId);
const genericDp = publishDecisionProblem({
  ledger: env.ledger,
  logicalId: genericDpId,
  version: '1',
  problem: {
    contractVersion: DECISION_PROBLEM_CONTRACT_VERSION,
    targetRef: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      farmId: exactTargetId
    },
    ...structuredClone(deterministicDecisionIntent)
  },
  principal: decisionProblemCreator,
  authorizationDecisionAuditRef: genericDpAuth.ref,
  audit: audit(
    'evt-gold-dec0033-generic-dp-publish',
    decisionProblemCreator.principalId
  )
});
assert.throws(() =>
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: genericDp.ref,
    contextDatumRef: dec0031ContextDatum.ref,
    evidenceCutoff,
    logicalId: 'cm-gold-dec0033-negative-shared',
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
    audit: manifestAudit(
      'evt-gold-dec0033-generic-a01-denied',
      manifestWriter
    )
  })
);

// Semantically equal but different DEC-0023 exact ref must not converge.
const alternateSpatial =
  publishAgronomicRecordedOperationContextSpatialSupportClassificationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0033.alternate-spatial',
    version: '1',
    compilation:
      buildDec0031SpatialCompilation(
        dec0031SpatialClassification,
        dec0031SpatialReview.ref
      ),
    audit: audit(
      'evt-gold-dec0033-alternate-spatial',
      normalizationReviewer.principalId
    )
  });
const alternateTargetRefWorld =
  publishTargetRefWorld(alternateSpatial.ref, 'alternate-spatial');
const alternateFarmBinding =
  publishFarmBindingWorld(
    alternateTargetRefWorld.published.ref,
    'alternate-spatial'
  );
const alternateDecision =
  publishBoundDecision(
    alternateFarmBinding.published.ref,
    'dp-gold-dec0033-alternate-spatial',
    'alternate-spatial'
  );
expectGovernedError(
  () =>
    publishAgronomicContextManifestFromGovernedWorld({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      decisionProblemRef: alternateDecision.published.ref,
      contextDatumRef: dec0031ContextDatum.ref,
      evidenceCutoff,
      logicalId: 'cm-gold-dec0033-negative-shared',
      version: '1',
      principal: manifestWriter,
      authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
      audit: manifestAudit(
        'evt-gold-dec0033-exact-spatial-mismatch',
        manifestWriter
      )
    }),
  'AGRONOMIC_CONTEXT_MANIFEST_FARM_LINEAGE_MISMATCH'
);

function publishScopedDatum(organizationId, tenantId, suffix) {
  const principal = createPrincipal({
    principalId: 'gold-dec0033-context-writer-' + suffix,
    type: 'SERVICE_ACCOUNT',
    organizationId,
    tenantId,
    programIds: []
  });
  const role = publishRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.gold.dec0033.context-writer-' + suffix,
    version: '1',
    principal,
    role: 'CONTEXT_DATUM_WRITER',
    roleDefinitionVersion: 'adr-dec0033-gold-v1',
    permissions: [PERMISSIONS.CONTEXT_WRITE],
    scope: {
      organizationId,
      tenantId,
      resourceType: 'CONTEXT_DATUM'
    },
    audit: audit(
      'evt-gold-dec0033-context-role-' + suffix,
      principal.principalId,
      principal.type
    )
  });
  const logicalId = 'ctx-gold-dec0033-' + suffix;
  const decision = authorizeContextWrite({
    principal,
    roleAssignments: [role],
    authorizationScope: {
      organizationId,
      tenantId,
      resourceType: 'CONTEXT_DATUM',
      resourceId: logicalId
    }
  });
  assert.equal(decision.allowed, true);
  const authorization = recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit(
      'evt-gold-dec0033-context-auth-' + suffix,
      principal.principalId,
      principal.type
    )
  });
  return publishAgronomicContextDatumFromAssembly({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    assemblyCompilationRef: dec0031AssemblyPublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    logicalId,
    version: '1',
    target: { organizationId, tenantId },
    principal,
    authorizationDecisionAuditRef: authorization.ref,
    audit: audit(
      'evt-gold-dec0033-context-publish-' + suffix,
      principal.principalId,
      principal.type
    )
  });
}

for (const [label, datum] of [
  ['organization', publishScopedDatum('org-b', 'tenant-a', 'org-b')],
  ['tenant', publishScopedDatum('org-a', 'tenant-b', 'tenant-b')]
]) {
  expectGovernedError(
    () =>
      publishAgronomicContextManifestFromGovernedWorld({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        timezoneRuleEvidence: historicalTimezoneRuleEvidence,
        decisionProblemRef: decisionWorld.published.ref,
        contextDatumRef: datum.ref,
        evidenceCutoff,
        logicalId: 'cm-gold-dec0033-negative-shared',
        version: '1',
        principal: manifestWriter,
        authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
        audit: manifestAudit(
          'evt-gold-dec0033-scope-mismatch-' + label,
          manifestWriter
        )
      }),
    'AGRONOMIC_CONTEXT_MANIFEST_DEPLOYMENT_SCOPE_MISMATCH'
  );
}

expectGovernedError(
  () =>
    publishAgronomicContextManifestFromGovernedWorld({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      decisionProblemRef: decisionWorld.published.ref,
      contextDatumRef: dec0031ContextDatum.ref,
      logicalId: 'cm-gold-dec0033-negative-shared',
      version: '1',
      principal: manifestWriter,
      authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
      audit: manifestAudit(
        'evt-gold-dec0033-missing-cutoff',
        manifestWriter
      )
    }),
  'AGRONOMIC_CONTEXT_MANIFEST_EVIDENCE_CUTOFF_REQUIRED'
);

for (const extra of [
  { datumRefs: [dec0031ContextDatum.ref, genericMatchingDatum.ref] },
  { resolvedReferenceReceiptRefs: [{ kind: 'ResolvedContextDatumReceipt' }] },
  {
    targetRef: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      farmId: exactTargetId
    }
  }
]) {
  expectGovernedError(
    () =>
      publishAgronomicContextManifestFromGovernedWorld({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        timezoneRuleEvidence: historicalTimezoneRuleEvidence,
        decisionProblemRef: decisionWorld.published.ref,
        contextDatumRef: dec0031ContextDatum.ref,
        evidenceCutoff,
        logicalId: 'cm-gold-dec0033-negative-shared',
        version: '1',
        principal: manifestWriter,
        authorizationDecisionAuditRef: sharedNegativeManifestAuth.ref,
        audit: manifestAudit(
          'evt-gold-dec0033-caller-membership-override',
          manifestWriter
        ),
        ...extra
      }),
    'INVALID_AGRONOMIC_CONTEXT_MANIFEST_GOVERNED_WORLD_FIELD'
  );
}

const earlyCutoffId = 'cm-gold-dec0033-early-cutoff';
assert.throws(() =>
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: decisionWorld.published.ref,
    contextDatumRef: dec0031ContextDatum.ref,
    evidenceCutoff: '2026-08-30T12:59:59.000Z',
    logicalId: earlyCutoffId,
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: manifestAuthorization(earlyCutoffId).ref,
    audit: manifestAudit('evt-gold-dec0033-early-cutoff', manifestWriter)
  })
);

const earlyPublicationId = 'cm-gold-dec0033-early-publication';
assert.throws(() =>
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: decisionWorld.published.ref,
    contextDatumRef: dec0031ContextDatum.ref,
    evidenceCutoff,
    logicalId: earlyPublicationId,
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: manifestAuthorization(earlyPublicationId).ref,
    audit: manifestAudit(
      'evt-gold-dec0033-early-publication',
      manifestWriter,
      '2026-08-30T13:59:59.000Z'
    )
  })
);

const wrongIdAuth = manifestAuthorization('cm-gold-dec0033-other-id');
assert.throws(() =>
  publishAgronomicContextManifestFromGovernedWorld({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    decisionProblemRef: decisionWorld.published.ref,
    contextDatumRef: dec0031ContextDatum.ref,
    evidenceCutoff,
    logicalId: 'cm-gold-dec0033-wrong-auth-id',
    version: '1',
    principal: manifestWriter,
    authorizationDecisionAuditRef: wrongIdAuth.ref,
    audit: manifestAudit(
      'evt-gold-dec0033-wrong-auth-id',
      manifestWriter
    )
  })
);

const manifestRecords =
  env.ledger.exportSnapshot().records
    .filter((record) => record.ref.kind === 'ContextManifest');
assert.equal(manifestRecords.length, 2);

const forbiddenKinds = new Set([
  'AuthorizedContextReference',
  'ResolvedContextDatumReceipt',
  'Policy',
  'RuntimePlan',
  'RuntimeEligibility',
  'RuntimeBinding',
  'RuntimeAlternativeSet',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const forbiddenRecords =
  env.ledger.exportSnapshot().records
    .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicContextManifestGovernedWorld',
  milestone: 'FIRST_REAL_SOURCE_TARGET_CONTEXT_WORLD_COMPLETE',
  goldKind: 'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD',
  contextDatumRef: dec0031ContextDatum.ref,
  decisionProblemRef: decisionWorld.published.ref,
  contextManifestRef: manifest.ref,
  genericA04SameWorldRef: genericManifest.ref,
  sharedSpatialSupportClassificationCompilationRef:
    validatedManifest.sharedSpatialSupportClassificationCompilationRef,
  sourceBackedFarmId: exactTargetId,
  evidenceCutoff,
  logicalTime: deterministicDecisionIntent.logicalTime,
  datumAvailableAt: dec0031ContextDatumValidated.semanticPayload.availableAt,
  replayClass: validatedManifest.manifest.semanticPayload.replayClass,
  decisionIntentClassification:
    'DETERMINISTIC_MACHINE_ACCEPTANCE_FIXTURE_NOT_SOURCE_DERIVED',
  temporalClassification:
    'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD_NOT_CONTEMPORANEOUS',
  bridgeSpecificMarkerRequired: false,
  newConvergenceCompilationCreated: false,
  genericA04ContractModified: false,
  hiddenAgronomicPublicationInputRefs: 0,
  resolvedReferenceReceiptsCreated: 0,
  noLookaheadClaim: false,
  realOperatorDecisionClaim: false,
  negativeCases: [
    'GENERIC_MATCHING_A02_WITHOUT_DEC0031_PROOF_DENIED',
    'GENERIC_MATCHING_A01_WITHOUT_DEC0032_PROOF_DENIED',
    'SEMANTICALLY_EQUAL_DIFFERENT_DEC0023_REF_DENIED',
    'ORGANIZATION_SCOPE_MISMATCH_DENIED',
    'TENANT_SCOPE_MISMATCH_DENIED',
    'MISSING_EXPLICIT_EVIDENCE_CUTOFF_DENIED',
    'CALLER_SECOND_DATUM_DENIED',
    'CALLER_RECEIPT_DENIED',
    'CALLER_TARGET_REF_DENIED',
    'DATUM_AVAILABLE_AFTER_CUTOFF_DENIED',
    'MANIFEST_PUBLICATION_BEFORE_CUTOFF_DENIED',
    'WRONG_MANIFEST_LOGICAL_ID_AUTHORIZATION_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));

export {
  env,
  historicalTimezoneRuleEvidence,
  decisionWorld,
  manifest,
  validatedManifest,
  deterministicDecisionIntent,
  evidenceCutoff,
  exactTargetId
};
