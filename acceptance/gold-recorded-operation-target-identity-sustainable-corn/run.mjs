import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationTargetIdentityBindingCompilationError,
  agronomicRecordedOperationEvidenceHash,
  agronomicRecordedOperationOccurrenceHash,
  agronomicRecordedOperationTargetIdentityBindingHash,
  deriveAgronomicRecordedOperationSourceBackedTargetId,
  extractAgronomicRecordedOperationJupyterTableRowEvidence,
  publishAgronomicRecordedOperationOccurrenceCompilation,
  publishAgronomicRecordedOperationOccurrenceReviewDecision,
  publishAgronomicRecordedOperationTargetIdentityBindingCompilation,
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision,
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import {
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';
import { sourceContentHash } from '../../packages/source-registry/src/index.mjs';
import { audit, createEnvironment } from '../derived-knowledge/fixture.mjs';

const NOTEBOOK_URL = new URL(
  '../gold-recorded-operation-sustainable-corn/bootstrap-isudatateam/chicago.ipynb',
  import.meta.url
);
const NOTEBOOK_LICENSE_URL = new URL(
  '../gold-recorded-operation-sustainable-corn/bootstrap-isudatateam/LICENSE',
  import.meta.url
);
const IDENTITY_SOURCE_URL = new URL('./upstream/sites.html', import.meta.url);
const IDENTITY_LICENSE_URL = new URL('./upstream/LICENSE', import.meta.url);

const EXPECTED_NOTEBOOK_GIT_BLOB_SHA =
  '4847e7b3b4aad42193de3f5f0da6f81f6b62dc50';
const EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA =
  '3145c0fe0099fedd1bb82e6af9e588b785234d80';
const EXPECTED_LICENSE_GIT_BLOB_SHA =
  '5c60615bfae390b40fe6fa096942c65b5b074ca7';

const OCCURRENCE_COORDINATES = {
  cellIndex: 3,
  outputIndex: 0,
  mimeType: 'text/plain',
  headerLineIndex: 0,
  rowIndex: '33',
  columns: [
    { role: 'SOURCE_NATIVE_SUBJECT', name: 'siteid' },
    { role: 'SOURCE_OPERATION_CODE', name: 'operation' },
    { role: 'TEMPORAL_SUPPORT', name: 'date' }
  ]
};

const IDENTITY_RANGE = {
  start: 2692,
  endExclusive: 2900
};

const EXPECTED_IDENTITY_TEXT =
  'tr valign="top">\n'
  + '\t\t<td>\n'
  + '\t\t\t<p>IA</p>\n'
  + '\t\t</td>\n'
  + '\t\t<td>\n'
  + '\t\t\t<p>SERF</p>\n'
  + '\t\t</td>\n'
  + '\t\t<td>Helmers</td>\n'
  + '\t\t<td>\n'
  + '\t\t\tSoutheast\n'
  + '\t\t\tResearch and Demonstration Farm\n'
  + '\t\t</td>\n'
  + '\t\t<td>\n'
  + '\t\t\t<p>Iowa\n'
  + '\t\t\tState University</p>\n'
  + '\t\t</td>\n'
  + '\t';

function gitBlobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function expectIdentityError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof
      AgronomicRecordedOperationTargetIdentityBindingCompilationError,
    `expected target identity error, got ${caught?.constructor?.name ?? 'none'}`
  );
  assert.equal(caught.code, code);
}

function publishReviewerRole(env, reviewer, label) {
  return publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.gold.target-identity.${label}`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(`evt-gold-target-identity-role-${label}`, 'iam-admin')
  });
}

function publishSourceInspectionAuthorization({
  env,
  reviewer,
  role,
  source,
  label
}) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.gold.target-identity.${label}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit(`evt-gold-target-identity-policy-${label}`, 'iam-admin')
  });
  const auth = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy,
      roleAssignments: [role],
      authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
    }),
    audit: audit(
      `evt-gold-target-identity-auth-${label}`,
      'iam-engine',
      'SERVICE_ACCOUNT'
    )
  });
  return { policy, auth };
}

function buildParentOccurrence(env, notebookBytes, notebookLicenseBytes) {
  const evidence = extractAgronomicRecordedOperationJupyterTableRowEvidence({
    bytes: notebookBytes,
    coordinates: OCCURRENCE_COORDINATES
  });
  const evidenceHash = agronomicRecordedOperationEvidenceHash(evidence);

  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.gold.dec0015.parent-operations-notebook',
    version: '1',
    sourceType: 'OTHER',
    title:
      'ISU Data Team Sustainable Corn persisted operations query output (DEC-0015 parent)',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator:
      'https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb',
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam',
      underlyingDatasetLicense: 'CC0',
      underlyingDatasetDoi: '10.15482/USDA.ADC/1411953'
    },
    audit: audit('evt-gold-target-identity-parent-source', 'source-admin')
  });

  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.gold.dec0015.parent-operations-notebook',
    version: '1',
    sourceRef: source.ref,
    bytes: notebookBytes,
    mediaType: 'application/x-ipynb+json',
    materializationIdentity:
      `github-blob:${EXPECTED_NOTEBOOK_GIT_BLOB_SHA}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-08-30T18:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: true,
      artifactLicense: {
        spdx: 'MIT',
        licenseBlobSha: gitBlobSha(notebookLicenseBytes),
        redistributionAllowed: true
      },
      underlyingDataset: {
        doi: '10.15482/USDA.ADC/1411953',
        license: 'CC0',
        redistributionAllowed: true
      }
    },
    audit: audit('evt-gold-target-identity-parent-artifact', 'source-admin')
  });

  const occurrence = {
    contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
    occurrenceId: 'sustainable-corn.serf.2011-05-03.plant-corn.dec0015-parent',
    sourceRef: source.ref,
    sourceArtifactRef: artifact.ref,
    sourceArtifactContentHash: artifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'DOCUMENT_COORDINATE',
      scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
      coordinates: OCCURRENCE_COORDINATES,
      evidenceHash
    },
    recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    occurrenceSemantics: {
      occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE',
      sourceOperationCode: 'plant_corn',
      sourceNativeSubject: {
        identifiers: [{ name: 'siteid', value: 'SERF' }]
      },
      temporalSupport: {
        kind: 'CALENDAR_DATE',
        date: '2011-05-03',
        precision: 'DAY'
      }
    },
    transformationRationale:
      'Preserve exact source-recorded SERF / plant_corn / 2011-05-03 as the DEC-0015 parent without target identity inference.'
  };

  const reviewer = createPrincipal({
    principalId: 'gold-dec0015-parent-occurrence-reviewer',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishReviewerRole(env, reviewer, 'parent-occurrence');
  const authorization = publishSourceInspectionAuthorization({
    env,
    reviewer,
    role,
    source,
    label: 'parent-occurrence-source'
  });

  const review = publishAgronomicRecordedOperationOccurrenceReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0015.parent-occurrence',
    version: '1',
    occurrence,
    disposition: 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRef: authorization.auth.ref,
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact retained notebook row records SERF / plant_corn / 2011-05-03; siteid remains source-native.',
    audit: audit(
      'evt-gold-dec0015-parent-review',
      reviewer.principalId
    )
  });

  const compilation = {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
    sourceArtifactRefs: [artifact.ref],
    sourceRoleAuthorityRefs: [],
    occurrence,
    occurrenceHash: agronomicRecordedOperationOccurrenceHash(occurrence),
    semanticReviewRef: review.ref,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'SOURCE',
        'SOURCE_ARTIFACT',
        'SOURCE_LOCATOR',
        'SOURCE_OPERATION_CODE',
        'SOURCE_NATIVE_SUBJECT',
        'TEMPORAL_SUPPORT',
        'RIGHTS_SNAPSHOT'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'RECORDED_OCCURRENCE_NOT_ADR_TARGET_IDENTITY',
      'RECORDED_OCCURRENCE_NOT_GEOMETRY',
      'RECORDED_OCCURRENCE_NOT_CONTEXT_DATUM',
      'RECORDED_OCCURRENCE_NOT_DECISION_PROBLEM'
    ]
  };

  const published = publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0015.parent-occurrence',
    version: '1',
    compilation,
    audit: audit(
      'evt-gold-dec0015-parent-publication',
      reviewer.principalId
    )
  });

  return { source, artifact, occurrence, published };
}

function buildIdentitySource(env, identityBytes, identityLicenseBytes) {
  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.gold.sustainable-corn.site-identity',
    version: '1',
    sourceType: 'OTHER',
    title: 'ISU Data Team Sustainable Corn site identity table',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator:
      'https://github.com/isudatateam/datateam/blob/3145c0fe0099fedd1bb82e6af9e588b785234d80/htdocs/cscap/dl/sites.html',
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam'
    },
    audit: audit('evt-gold-target-identity-source', 'source-admin')
  });

  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.gold.sustainable-corn.site-identity',
    version: '1',
    sourceRef: source.ref,
    bytes: identityBytes,
    mediaType: 'text/html',
    materializationIdentity:
      `github-blob:${EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-08-30T18:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: true,
      artifactLicense: {
        spdx: 'MIT',
        licenseBlobSha: gitBlobSha(identityLicenseBytes),
        redistributionAllowed: true
      }
    },
    audit: audit('evt-gold-target-identity-artifact', 'source-admin')
  });

  return { source, artifact };
}

function buildBinding({ parent, identitySource, identityArtifact, identityBytes }) {
  const identifier = { name: 'siteid', value: 'SERF' };
  const targetId = deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef: parent.source.ref,
    identifierName: identifier.name,
    identifierValue: identifier.value,
    granularity: 'FARM'
  });
  const selected = identityBytes.subarray(
    IDENTITY_RANGE.start,
    IDENTITY_RANGE.endExclusive
  );
  const evidenceHash = sourceContentHash(selected);
  const evidenceItem = (evidenceRole) => ({
    evidenceRole,
    sourceRef: identitySource.ref,
    sourceArtifactRef: identityArtifact.ref,
    sourceArtifactContentHash: identityArtifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: IDENTITY_RANGE.start,
      endExclusive: IDENTITY_RANGE.endExclusive,
      evidenceHash
    }
  });

  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'sustainable-corn.serf.source-backed-farm',
    parentOccurrenceCompilationRef: parent.published.ref,
    sourceNativeSubject: identifier,
    sourceBackedTargetIdentity: {
      namespaceRef: parent.source.ref,
      granularity: 'FARM',
      targetId
    },
    identityEvidence: [
      evidenceItem('SOURCE_NATIVE_IDENTIFIER_CONTEXT'),
      evidenceItem('TARGET_GRANULARITY_MEANING')
    ],
    applicability: {
      appliesToOccurrenceSourceRef: parent.source.ref,
      appliesToSourceNativeIdentifier: identifier
    },
    transformationRationale:
      'The exact Sustainable Corn site table identifies source-native siteid SERF as Southeast Research and Demonstration Farm / Iowa State University; bind only source-backed FARM identity with no finer spatial or temporal inference.'
  };
}

function buildCompilation(binding, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash: agronomicRecordedOperationTargetIdentityBindingHash(binding),
    identityReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SOURCE_NATIVE_IDENTIFIER',
        'SOURCE_BACKED_NAMESPACE',
        'TARGET_GRANULARITY_FARM',
        'EXACT_IDENTITY_EVIDENCE',
        'SOURCE_IDENTITY_NAMESPACE_APPLICABILITY'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'SOURCE_BACKED_IDENTITY_NOT_GLOBAL_CANONICAL_IDENTITY',
      'FARM_IDENTITY_NOT_FIELD_PLOT_ZONE_OR_SEASON_IDENTITY',
      'IDENTITY_NOT_GEOMETRY',
      'IDENTITY_NOT_TIMEZONE_OR_TEMPORAL_PROJECTION',
      'IDENTITY_NOT_CONTEXT_DATUM',
      'IDENTITY_NOT_DECISION_PROBLEM',
      'IDENTITY_NOT_RUNTIME_EXECUTION_OR_OUTCOME',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const notebookBytes = readFileSync(NOTEBOOK_URL);
const notebookLicenseBytes = readFileSync(NOTEBOOK_LICENSE_URL);
const identityBytes = readFileSync(IDENTITY_SOURCE_URL);
const identityLicenseBytes = readFileSync(IDENTITY_LICENSE_URL);

assert.equal(gitBlobSha(notebookBytes), EXPECTED_NOTEBOOK_GIT_BLOB_SHA);
assert.equal(
  gitBlobSha(identityBytes),
  EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA
);
assert.equal(gitBlobSha(notebookLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(gitBlobSha(identityLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(
  identityBytes
    .subarray(IDENTITY_RANGE.start, IDENTITY_RANGE.endExclusive)
    .toString('utf8'),
  EXPECTED_IDENTITY_TEXT
);

const env = createEnvironment();
const parent = buildParentOccurrence(
  env,
  notebookBytes,
  notebookLicenseBytes
);
const identity = buildIdentitySource(
  env,
  identityBytes,
  identityLicenseBytes
);
const binding = buildBinding({
  parent,
  identitySource: identity.source,
  identityArtifact: identity.artifact,
  identityBytes
});

const reviewer = createPrincipal({
  principalId: 'gold-sustainable-corn-target-identity-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const role = publishReviewerRole(env, reviewer, 'binding');
const parentAuthorization = publishSourceInspectionAuthorization({
  env,
  reviewer,
  role,
  source: parent.source,
  label: 'binding-parent-source'
});
const identityAuthorization = publishSourceInspectionAuthorization({
  env,
  reviewer,
  role,
  source: identity.source,
  label: 'binding-identity-source'
});

const review =
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.target-identity',
    version: '1',
    binding,
    disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [
      parentAuthorization.auth.ref,
      identityAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact parent occurrence contains siteid=SERF and exact retained sites.html bytes identify SERF as Southeast Research and Demonstration Farm / Iowa State University. FARM is the highest supported granularity; no field, plot, zone, geometry, timezone or cross-provider equivalence is asserted.',
    audit: audit(
      'evt-gold-target-identity-review',
      reviewer.principalId
    )
  });

const published =
  publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.sustainable-corn.target-identity',
    version: '1',
    compilation: buildCompilation(binding, review.ref),
    audit: audit(
      'evt-gold-target-identity-publication',
      reviewer.principalId
    )
  });

const validated =
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: published.ref
  });

assert.deepEqual(
  validated.parentOccurrence.semanticPayload.occurrence
    .occurrenceSemantics.sourceNativeSubject,
  { identifiers: [{ name: 'siteid', value: 'SERF' }] }
);
assert.deepEqual(validated.semanticPayload.binding.sourceNativeSubject, {
  name: 'siteid',
  value: 'SERF'
});
assert.equal(
  validated.semanticPayload.binding.sourceBackedTargetIdentity.granularity,
  'FARM'
);
assert.match(
  validated.semanticPayload.binding.sourceBackedTargetIdentity.targetId,
  /^target_src_[0-9a-f]{64}$/
);
assert.deepEqual(
  validated.replayedEvidence.map((item) => item.evidenceRole),
  ['SOURCE_NATIVE_IDENTIFIER_CONTEXT', 'TARGET_GRANULARITY_MEANING']
);
for (const evidence of validated.replayedEvidence) {
  assert.equal(evidence.text, EXPECTED_IDENTITY_TEXT);
}

const parentIdentifierDrift = structuredClone(binding);
parentIdentifierDrift.sourceNativeSubject.value = 'NWREC';
parentIdentifierDrift.applicability.appliesToSourceNativeIdentifier.value =
  'NWREC';
parentIdentifierDrift.sourceBackedTargetIdentity.targetId =
  deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef: parent.source.ref,
    identifierName: 'siteid',
    identifierValue: 'NWREC',
    granularity: 'FARM'
  });
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.parent-identifier-drift',
      version: '1',
      binding: parentIdentifierDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Parent identifier drift must fail closed.',
      audit: audit(
        'evt-gold-target-identity-parent-identifier-drift',
        reviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_PARENT_IDENTIFIER_MISMATCH'
);

for (const granularity of ['FIELD', 'ZONE']) {
  const drift = structuredClone(binding);
  drift.sourceBackedTargetIdentity.granularity = granularity;
  expectIdentityError(
    () =>
      publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          `review.gold.target-identity.granularity-${granularity.toLowerCase()}`,
        version: '1',
        binding: drift,
        disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
        reviewerPrincipal: reviewer,
        authorizationDecisionAuditRefs: [
          parentAuthorization.auth.ref,
          identityAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
        rationale: 'Unsupported finer granularity must fail closed.',
        audit: audit(
          `evt-gold-target-identity-granularity-${granularity.toLowerCase()}`,
          reviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_GRANULARITY'
  );
}

const missingEvidence = structuredClone(binding);
missingEvidence.identityEvidence =
  missingEvidence.identityEvidence.filter(
    (item) => item.evidenceRole !== 'TARGET_GRANULARITY_MEANING'
  );
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.missing-evidence',
      version: '1',
      binding: missingEvidence,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Missing exact identity evidence must fail closed.',
      audit: audit(
        'evt-gold-target-identity-missing-evidence',
        reviewer.principalId
      )
    }),
  'INCOMPLETE_AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_EVIDENCE'
);

const evidenceHashDrift = structuredClone(binding);
evidenceHashDrift.identityEvidence[0].sourceLocator.evidenceHash =
  `sha256:${'f'.repeat(64)}`;
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.evidence-hash-drift',
      version: '1',
      binding: evidenceHashDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Forged evidence hash must not override exact replay.',
      audit: audit(
        'evt-gold-target-identity-evidence-hash-drift',
        reviewer.principalId
      )
    }),
  'TARGET_IDENTITY_EVIDENCE_HASH_MISMATCH'
);

const artifactHashDrift = structuredClone(binding);
artifactHashDrift.identityEvidence[0].sourceArtifactContentHash =
  `sha256:${'e'.repeat(64)}`;
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.artifact-hash-drift',
      version: '1',
      binding: artifactHashDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Artifact content drift must fail closed.',
      audit: audit(
        'evt-gold-target-identity-artifact-hash-drift',
        reviewer.principalId
      )
    }),
  'TARGET_IDENTITY_ARTIFACT_CONTENT_HASH_MISMATCH'
);

expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.incomplete-review',
      version: '1',
      binding,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_GEOMETRY_INFERENCE'),
      rationale: 'Incomplete review cannot authorize target identity.',
      audit: audit(
        'evt-gold-target-identity-incomplete-review',
        reviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_INCOMPLETE'
);

const unauthorizedReviewer = createPrincipal({
  principalId: 'gold-target-identity-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.unauthorized',
      version: '1',
      binding,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: unauthorizedReviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow authorization decisions.',
      audit: audit(
        'evt-gold-target-identity-unauthorized-review',
        unauthorizedReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_AUTHORIZATION_INVALID'
);

const namespaceDrift = structuredClone(binding);
namespaceDrift.sourceBackedTargetIdentity.namespaceRef = identity.source.ref;
namespaceDrift.sourceBackedTargetIdentity.targetId =
  deriveAgronomicRecordedOperationSourceBackedTargetId({
    namespaceRef: identity.source.ref,
    identifierName: 'siteid',
    identifierValue: 'SERF',
    granularity: 'FARM'
  });
assert.notEqual(
  namespaceDrift.sourceBackedTargetIdentity.targetId,
  binding.sourceBackedTargetIdentity.targetId
);
expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.target-identity.namespace-drift',
      version: '1',
      binding: namespaceDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
      reviewerPrincipal: reviewer,
      authorizationDecisionAuditRefs: [
        parentAuthorization.auth.ref,
        identityAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
      rationale: 'Namespace drift changes identity and cannot replace parent source namespace.',
      audit: audit(
        'evt-gold-target-identity-namespace-drift',
        reviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_NAMESPACE_MISMATCH'
);

const unrelatedBytes = Buffer.from(
  'Unrelated equipment service site. No Sustainable Corn SERF farm identity semantics are established here.\n',
  'utf8'
);
const unrelatedSource = env.sourceRegistry.registerSource({
  logicalId: 'source.gold.target-identity.unrelated',
  version: '1',
  sourceType: 'OTHER',
  title: 'Unrelated identity evidence negative control',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  originLocator: 'urn:adr:gold:target-identity:unrelated-negative-control',
  rights: { artifactLicense: 'TEST_FIXTURE' },
  audit: audit('evt-gold-target-identity-unrelated-source', 'source-admin')
});
const unrelatedArtifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.gold.target-identity.unrelated',
  version: '1',
  sourceRef: unrelatedSource.ref,
  bytes: unrelatedBytes,
  mediaType: 'text/plain',
  materializationIdentity: 'gold-negative-control:unrelated-target-identity',
  acquisition: {
    method: 'REPOSITORY_RETAINED_TEST_FIXTURE',
    acquiredAt: '2026-08-30T18:00:00.000Z'
  },
  rightsSnapshot: {
    publicAccess: false,
    artifactLicense: {
      spdx: 'NONE',
      redistributionAllowed: false
    }
  },
  audit: audit('evt-gold-target-identity-unrelated-artifact', 'source-admin')
});
const unrelatedAuthorization = publishSourceInspectionAuthorization({
  env,
  reviewer,
  role,
  source: unrelatedSource,
  label: 'binding-unrelated-source'
});
const unrelatedBinding = structuredClone(binding);
unrelatedBinding.identityEvidence = [
  'SOURCE_NATIVE_IDENTIFIER_CONTEXT',
  'TARGET_GRANULARITY_MEANING'
].map((evidenceRole) => ({
  evidenceRole,
  sourceRef: unrelatedSource.ref,
  sourceArtifactRef: unrelatedArtifact.ref,
  sourceArtifactContentHash: unrelatedArtifact.semanticPayload.contentHash,
  sourceLocator: {
    kind: 'BYTE_RANGE',
    start: 0,
    endExclusive: unrelatedBytes.byteLength,
    evidenceHash: sourceContentHash(unrelatedBytes)
  }
}));

const unrelatedReview =
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.target-identity.unrelated-evidence',
    version: '1',
    binding: unrelatedBinding,
    disposition: 'REJECT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [
      parentAuthorization.auth.ref,
      unrelatedAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale:
      'Exact retained evidence is unrelated and does not establish Sustainable Corn siteid=SERF as a FARM.',
    audit: audit(
      'evt-gold-target-identity-unrelated-review',
      reviewer.principalId
    )
  });

expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.target-identity.unrelated-evidence',
      version: '1',
      compilation: buildCompilation(
        unrelatedBinding,
        unrelatedReview.ref
      ),
      audit: audit(
        'evt-gold-target-identity-unrelated-publication',
        reviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_REJECTED'
);

const rejectedReview =
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.target-identity.rejected',
    version: '1',
    binding,
    disposition: 'REJECT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRefs: [
      parentAuthorization.auth.ref,
      identityAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale:
      'Rejected target-identity adjudication must not authorize publication.',
    audit: audit(
      'evt-gold-target-identity-rejected-review',
      reviewer.principalId
    )
  });

expectIdentityError(
  () =>
    publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.target-identity.rejected',
      version: '1',
      compilation: buildCompilation(binding, rejectedReview.ref),
      audit: audit(
        'evt-gold-target-identity-rejected-publication',
        reviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REVIEW_REJECTED'
);

const forbiddenKinds = new Set([
  'Policy',
  'RuntimePlan',
  'RuntimeEligibility',
  'RuntimeBinding',
  'RuntimeAlternativeSet',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome',
  'ContextDatum',
  'ContextManifest',
  'DecisionProblem'
]);
const forbiddenRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority:
    'AgronomicRecordedOperationTargetIdentityBindingCompilation',
  goldKind: 'PUBLIC_REAL_SOURCE',
  parentOccurrenceCompilation: parent.published.ref,
  parentSourceNativeSubject:
    validated.parentOccurrence.semanticPayload.occurrence
      .occurrenceSemantics.sourceNativeSubject,
  identitySourceBlobSha: EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA,
  identityArtifactContentHash:
    identity.artifact.semanticPayload.contentHash,
  evidence: validated.replayedEvidence.map((item) => ({
    evidenceRole: item.evidenceRole,
    start: item.locator.start,
    endExclusive: item.locator.endExclusive,
    evidenceHash: item.evidenceHash
  })),
  sourceBackedTargetIdentity:
    validated.semanticPayload.binding.sourceBackedTargetIdentity,
  negativeCases: [
    'PARENT_IDENTIFIER_DRIFT_DENIED',
    'FIELD_GRANULARITY_DENIED',
    'ZONE_GRANULARITY_DENIED',
    'MISSING_IDENTITY_EVIDENCE_DENIED',
    'EVIDENCE_HASH_DRIFT_DENIED',
    'ARTIFACT_HASH_DRIFT_DENIED',
    'INCOMPLETE_REVIEW_DENIED',
    'UNAUTHORIZED_REVIEWER_DENIED',
    'SOURCE_NAMESPACE_DRIFT_CHANGES_IDENTITY_AND_IS_DENIED',
    'UNRELATED_IDENTITY_EVIDENCE_REJECTED',
    'REJECTED_REVIEW_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated:
    forbiddenRecords.length
}, null, 2));
