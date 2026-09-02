import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationSemanticNormalizationCompilationError,
  agronomicRecordedOperationEvidenceHash,
  agronomicRecordedOperationOccurrenceHash,
  agronomicRecordedOperationSemanticNormalizationHash,
  extractAgronomicRecordedOperationJupyterTableRowEvidence,
  publishAgronomicRecordedOperationOccurrenceCompilation,
  publishAgronomicRecordedOperationOccurrenceReviewDecision,
  publishAgronomicRecordedOperationSemanticNormalizationCompilation,
  publishAgronomicRecordedOperationSemanticNormalizationReviewDecision,
  validateAgronomicRecordedOperationSemanticNormalizationCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationContextSemanticMappingCompilationError,
  agronomicRecordedOperationContextSemanticMappingHash,
  publishAgronomicRecordedOperationContextSemanticMappingReviewDecision,
  publishAgronomicRecordedOperationContextSemanticMappingCompilation,
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationContextEpistemicClassificationCompilationError,
  agronomicRecordedOperationContextEpistemicClassificationHash,
  publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision,
  publishAgronomicRecordedOperationContextEpistemicClassificationCompilation,
  validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationContextProvenanceClassificationCompilationError,
  agronomicRecordedOperationContextProvenanceClassificationHash,
  publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision,
  publishAgronomicRecordedOperationContextProvenanceClassificationCompilation,
  validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID,
  AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError,
  agronomicRecordedOperationContextSourceProviderIdentityBindingHash,
  publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision,
  publishAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation,
  validateAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF,
  AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError,
  agronomicRecordedOperationContextSourceReferenceHashProjectionHash,
  publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision,
  publishAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation,
  validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
  AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError,
  agronomicContextSourceAcquisitionAvailabilityProjectionHash,
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision,
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation,
  validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
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
const SEMANTIC_SOURCE_URL = new URL(
  '../gold-recorded-operation-semantic-normalization-sustainable-corn/upstream/mantable.py',
  import.meta.url
);
const SEMANTIC_LICENSE_URL = new URL(
  '../gold-recorded-operation-semantic-normalization-sustainable-corn/upstream/LICENSE',
  import.meta.url
);

const EXPECTED_NOTEBOOK_GIT_BLOB_SHA =
  '4847e7b3b4aad42193de3f5f0da6f81f6b62dc50';
const EXPECTED_SEMANTIC_SOURCE_GIT_BLOB_SHA =
  '689a5c6c4bdc8bc242cd09673f0063fea177c6bb';
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

const SOURCE_CODE_NAMESPACE_RANGE = {
  start: 8251,
  endExclusive: 8442
};
const NORMALIZED_MEANING_RANGE = {
  start: 12995,
  endExclusive: 13445
};

const EXPECTED_SOURCE_CODE_NAMESPACE_TEXT =
  '        for yr in ["2011", "2012", "2013", "2014", "2015"]:\n'
  + '            for op in ["plant_corn", "plant_soy"]:\n'
  + '                table4 += "<td>%s</td>" % (data[site].get(yr, {}).get(op, ""),)\n';

const EXPECTED_NORMALIZED_MEANING_TEXT =
  '<h3>Cash Crop Planting</h3>\n'
  + '\n'
  + '<table class="table table-striped table-bordered">\n'
  + '<thead>\n'
  + ' <tr>\n'
  + '  <th rowspan="3">Site</th>\n'
  + '  <th colspan="2">2011</th>\n'
  + '  <th colspan="2">2012</th>\n'
  + '  <th colspan="2">2013</th>\n'
  + '  <th colspan="2">2014</th>\n'
  + '  <th colspan="2">2015</th>\n'
  + ' </tr>\n'
  + ' <tr>\n'
  + '  <th>Corn</th><th>Soybean</th>\n'
  + '  <th>Corn</th><th>Soybean</th>\n'
  + '  <th>Corn</th><th>Soybean</th>\n'
  + '  <th>Corn</th><th>Soybean</th>\n'
  + '  <th>Corn</th><th>Soybean</th>\n'
  + ' </tr>\n'
  + '</thead>';

function gitBlobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function expectNormalizationError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof
      AgronomicRecordedOperationSemanticNormalizationCompilationError,
    `expected normalization error, got ${caught?.constructor?.name ?? 'none'}`
  );
  assert.equal(caught.code, code);
}

function publishReviewerRole(env, reviewer, label) {
  return publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.gold.semantic-normalization.${label}`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(`evt-gold-semantic-role-${label}`, 'iam-admin')
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
    logicalId: `policy.gold.semantic-normalization.${label}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit(`evt-gold-semantic-policy-${label}`, 'iam-admin')
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
      `evt-gold-semantic-auth-${label}`,
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
    logicalId: 'source.gold.semantic-normalization.parent-operations-notebook',
    version: '1',
    sourceType: 'OTHER',
    title:
      'ISU Data Team Sustainable Corn persisted operations query output (DEC-0014 parent)',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator:
      'https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb',
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam',
      underlyingDatasetLicense: 'CC0',
      underlyingDatasetDoi: '10.15482/USDA.ADC/1411953'
    },
    audit: audit('evt-gold-semantic-parent-source', 'source-admin')
  });

  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.gold.semantic-normalization.parent-operations-notebook',
    version: '1',
    sourceRef: source.ref,
    bytes: notebookBytes,
    mediaType: 'application/x-ipynb+json',
    materializationIdentity:
      `github-blob:${EXPECTED_NOTEBOOK_GIT_BLOB_SHA}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-08-30T13:00:00.000Z'
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
    audit: audit('evt-gold-semantic-parent-artifact', 'source-admin')
  });

  const occurrence = {
    contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
    occurrenceId: 'sustainable-corn.serf.2011-05-03.plant-corn.dec0014-parent',
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
      'Preserve the exact positive source-recorded occurrence as DEC-0014 parent without normalized action semantics.'
  };

  const reviewer = createPrincipal({
    principalId: 'gold-dec0014-parent-occurrence-reviewer',
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
    logicalId: 'review.gold.dec0014.parent-occurrence',
    version: '1',
    occurrence,
    disposition: 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
    reviewerPrincipal: reviewer,
    authorizationDecisionAuditRef: authorization.auth.ref,
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact retained notebook row records SERF / plant_corn / 2011-05-03 and remains unnormalized.',
    audit: audit(
      'evt-gold-dec0014-parent-review',
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
      'RECORDED_OCCURRENCE_NOT_NORMALIZED_OPERATION',
      'RECORDED_OCCURRENCE_NOT_ADR_EXECUTION',
      'RECORDED_OCCURRENCE_NOT_OUTCOME',
      'SOURCE_NATIVE_SITE_NOT_ADR_TARGET'
    ]
  };

  const published = publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0014.parent-occurrence',
    version: '1',
    compilation,
    audit: audit(
      'evt-gold-dec0014-parent-publication',
      reviewer.principalId
    )
  });

  return { source, artifact, occurrence, published };
}

function buildSemanticSource(env, semanticBytes, semanticLicenseBytes) {
  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.gold.sustainable-corn.operation-code-semantics',
    version: '1',
    sourceType: 'OTHER',
    title:
      'ISU Data Team Sustainable Corn operation-code presentation semantics',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator:
      'https://github.com/isudatateam/datateam/blob/689a5c6c4bdc8bc242cd09673f0063fea177c6bb/src/isudatateam/cscap/mantable.py',
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam'
    },
    audit: audit('evt-gold-semantic-source', 'source-admin')
  });

  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.gold.sustainable-corn.operation-code-semantics',
    version: '1',
    sourceRef: source.ref,
    bytes: semanticBytes,
    mediaType: 'text/x-python',
    materializationIdentity:
      `github-blob:${EXPECTED_SEMANTIC_SOURCE_GIT_BLOB_SHA}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-08-30T13:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: true,
      artifactLicense: {
        spdx: 'MIT',
        licenseBlobSha: gitBlobSha(semanticLicenseBytes),
        redistributionAllowed: true
      }
    },
    audit: audit('evt-gold-semantic-artifact', 'source-admin')
  });

  return { source, artifact };
}

function evidenceItem(role, source, artifact, range, semanticBytes) {
  const selected = semanticBytes.subarray(range.start, range.endExclusive);
  return {
    evidenceRole: role,
    sourceRef: source.ref,
    sourceArtifactRef: artifact.ref,
    sourceArtifactContentHash: artifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: range.start,
      endExclusive: range.endExclusive,
      evidenceHash: sourceContentHash(selected)
    }
  };
}

function buildNormalization({
  parent,
  semanticSource,
  semanticArtifact,
  semanticBytes
}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_CONTRACT_VERSION,
    normalizationId: 'normalization.gold.sustainable-corn.plant-corn',
    parentOccurrenceCompilationRef: parent.published.ref,
    sourceCode: {
      sourceOperationCode: 'plant_corn'
    },
    normalizedOperation: {
      family: 'PLANT',
      subject: {
        kind: 'CROP',
        code: 'CORN'
      }
    },
    semanticEvidence: [
      evidenceItem(
        'SOURCE_CODE_NAMESPACE_CONTEXT',
        semanticSource,
        semanticArtifact,
        SOURCE_CODE_NAMESPACE_RANGE,
        semanticBytes
      ),
      evidenceItem(
        'NORMALIZED_OPERATION_MEANING',
        semanticSource,
        semanticArtifact,
        NORMALIZED_MEANING_RANGE,
        semanticBytes
      )
    ],
    applicability: {
      appliesToOccurrenceSourceRef: parent.source.ref,
      appliesToSourceOperationCode: 'plant_corn'
    },
    transformationRationale:
      'Normalize the exact Sustainable Corn source code only from the complete reviewed source-system evidence set; do not create Policy, runtime, execution, Outcome, ContextDatum or target authority.'
  };
}

function buildCompilation(normalization, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_COMPILATION_AUTHORITY',
    normalization,
    normalizationHash:
      agronomicRecordedOperationSemanticNormalizationHash(normalization),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SOURCE_OPERATION_CODE',
        'SOURCE_CODE_NAMESPACE_CONTEXT',
        'NORMALIZED_OPERATION_FAMILY',
        'NORMALIZED_OPERATION_SUBJECT_KIND',
        'NORMALIZED_OPERATION_SUBJECT_CODE',
        'SOURCE_CODE_NAMESPACE_APPLICABILITY'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_SEMANTIC_ELEMENT']
    },
    limitations: [
      'NORMALIZATION_SOURCE_SCOPED',
      'NORMALIZATION_NOT_POLICY_ACTION',
      'NORMALIZATION_NOT_NORMATIVE_FORCE',
      'NORMALIZATION_NOT_RUNTIME_ACTION',
      'NORMALIZATION_NOT_EXECUTION',
      'NORMALIZATION_NOT_OUTCOME',
      'NORMALIZATION_NOT_CONTEXT_STATE',
      'NORMALIZATION_NOT_ADR_TARGET',
      'SOURCE_VOCABULARY_NOT_ASSERTED_COMPLETE',
      'NO_INVERSE_SOURCE_WRITE_MAPPING'
    ]
  };
}

const notebookBytes = readFileSync(NOTEBOOK_URL);
const notebookLicenseBytes = readFileSync(NOTEBOOK_LICENSE_URL);
const semanticBytes = readFileSync(SEMANTIC_SOURCE_URL);
const semanticLicenseBytes = readFileSync(SEMANTIC_LICENSE_URL);

assert.equal(gitBlobSha(notebookBytes), EXPECTED_NOTEBOOK_GIT_BLOB_SHA);
assert.equal(
  gitBlobSha(semanticBytes),
  EXPECTED_SEMANTIC_SOURCE_GIT_BLOB_SHA
);
assert.equal(gitBlobSha(notebookLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(gitBlobSha(semanticLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);

assert.equal(
  semanticBytes
    .subarray(
      SOURCE_CODE_NAMESPACE_RANGE.start,
      SOURCE_CODE_NAMESPACE_RANGE.endExclusive
    )
    .toString('utf8'),
  EXPECTED_SOURCE_CODE_NAMESPACE_TEXT
);
assert.equal(
  semanticBytes
    .subarray(
      NORMALIZED_MEANING_RANGE.start,
      NORMALIZED_MEANING_RANGE.endExclusive
    )
    .toString('utf8'),
  EXPECTED_NORMALIZED_MEANING_TEXT
);

const env = createEnvironment();
const parent = buildParentOccurrence(
  env,
  notebookBytes,
  notebookLicenseBytes
);
const semantic = buildSemanticSource(
  env,
  semanticBytes,
  semanticLicenseBytes
);
const normalization = buildNormalization({
  parent,
  semanticSource: semantic.source,
  semanticArtifact: semantic.artifact,
  semanticBytes
});

const normalizationReviewer = createPrincipal({
  principalId: 'gold-sustainable-corn-semantic-normalization-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
const normalizationRole =
  publishReviewerRole(env, normalizationReviewer, 'normalization');
const parentSourceAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: parent.source,
    label: 'normalization-parent-source'
  });
const semanticSourceAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: semantic.source,
    label: 'normalization-semantic-source'
  });

const normalizationReview =
  publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.semantic-normalization',
    version: '1',
    normalization,
    disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact parent occurrence plus both non-contiguous mantable.py evidence ranges support only the source-scoped mapping plant_corn -> PLANT / CROP:CORN.',
    audit: audit(
      'evt-gold-semantic-normalization-review',
      normalizationReviewer.principalId
    )
  });

const normalizationCompilation =
  buildCompilation(normalization, normalizationReview.ref);

const normalizationPublished =
  publishAgronomicRecordedOperationSemanticNormalizationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.sustainable-corn.semantic-normalization',
    version: '1',
    compilation: normalizationCompilation,
    audit: audit(
      'evt-gold-semantic-normalization-publication',
      normalizationReviewer.principalId
    )
  });

const validated =
  validateAgronomicRecordedOperationSemanticNormalizationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: normalizationPublished.ref
  });

assert.equal(
  validated.semanticPayload.normalization.sourceCode.sourceOperationCode,
  'plant_corn'
);
assert.deepEqual(
  validated.semanticPayload.normalization.normalizedOperation,
  {
    family: 'PLANT',
    subject: { kind: 'CROP', code: 'CORN' }
  }
);
assert.equal(
  validated.parentOccurrence.semanticPayload.occurrence
    .occurrenceSemantics.normalizedOperation,
  undefined
);
assert.deepEqual(
  validated.parentOccurrence.semanticPayload.occurrence
    .occurrenceSemantics.sourceNativeSubject,
  { identifiers: [{ name: 'siteid', value: 'SERF' }] }
);
assert.deepEqual(
  validated.replayedEvidence.map((item) => item.evidenceRole),
  ['NORMALIZED_OPERATION_MEANING', 'SOURCE_CODE_NAMESPACE_CONTEXT']
);

const familyDrift = structuredClone(normalization);
familyDrift.normalizedOperation.family = 'HARVEST';
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.semantic-normalization.family-drift',
      version: '1',
      compilation: buildCompilation(
        familyDrift,
        normalizationReview.ref
      ),
      audit: audit(
        'evt-gold-semantic-family-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_MISMATCH'
);

const subjectDrift = structuredClone(normalization);
subjectDrift.normalizedOperation.subject.code = 'SOYBEAN';
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.semantic-normalization.subject-drift',
      version: '1',
      compilation: buildCompilation(
        subjectDrift,
        normalizationReview.ref
      ),
      audit: audit(
        'evt-gold-semantic-subject-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_MISMATCH'
);

const parentCodeDrift = structuredClone(normalization);
parentCodeDrift.sourceCode.sourceOperationCode = 'harvest_corn';
parentCodeDrift.applicability.appliesToSourceOperationCode = 'harvest_corn';
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.parent-code-drift',
      version: '1',
      normalization: parentCodeDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Parent source-code drift must fail before review publication.',
      audit: audit(
        'evt-gold-semantic-parent-code-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_PARENT_CODE_MISMATCH'
);

const missingEvidence = structuredClone(normalization);
missingEvidence.semanticEvidence =
  missingEvidence.semanticEvidence.filter(
    (item) => item.evidenceRole !== 'NORMALIZED_OPERATION_MEANING'
  );
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.missing-evidence',
      version: '1',
      normalization: missingEvidence,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Removing a required evidence role must fail closed.',
      audit: audit(
        'evt-gold-semantic-missing-evidence',
        normalizationReviewer.principalId
      )
    }),
  'INCOMPLETE_AGRONOMIC_RECORDED_OPERATION_SEMANTIC_EVIDENCE'
);

const evidenceHashDrift = structuredClone(normalization);
evidenceHashDrift.semanticEvidence[0].sourceLocator.evidenceHash =
  `sha256:${'f'.repeat(64)}`;
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.evidence-hash-drift',
      version: '1',
      normalization: evidenceHashDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Forged evidence hash must not override replay.',
      audit: audit(
        'evt-gold-semantic-evidence-hash-drift',
        normalizationReviewer.principalId
      )
    }),
  'SEMANTIC_NORMALIZATION_EVIDENCE_HASH_MISMATCH'
);

const artifactHashDrift = structuredClone(normalization);
artifactHashDrift.semanticEvidence[0].sourceArtifactContentHash =
  `sha256:${'e'.repeat(64)}`;
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.artifact-hash-drift',
      version: '1',
      normalization: artifactHashDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Artifact content drift must fail closed.',
      audit: audit(
        'evt-gold-semantic-artifact-hash-drift',
        normalizationReviewer.principalId
      )
    }),
  'SEMANTIC_NORMALIZATION_ARTIFACT_CONTENT_HASH_MISMATCH'
);

expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.incomplete-review',
      version: '1',
      normalization,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_POLICY_ACTION_INFERENCE'),
      rationale: 'Incomplete review cannot authorize normalization.',
      audit: audit(
        'evt-gold-semantic-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_INCOMPLETE'
);

const unauthorizedReviewer = createPrincipal({
  principalId: 'gold-semantic-normalization-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.semantic-normalization.unauthorized',
      version: '1',
      normalization,
      disposition: 'ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
      reviewerPrincipal: unauthorizedReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow authorization decisions.',
      audit: audit(
        'evt-gold-semantic-unauthorized-review',
        unauthorizedReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_AUTHORIZATION_INVALID'
);

const unrelatedBytes = Buffer.from(
  'This source documents unrelated irrigation equipment maintenance semantics.\n'
  + 'No Sustainable Corn operation-code namespace is defined here.\n',
  'utf8'
);
const unrelatedSource = env.sourceRegistry.registerSource({
  logicalId: 'source.gold.semantic-normalization.unrelated',
  version: '1',
  sourceType: 'OTHER',
  title: 'Unrelated semantic evidence negative control',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  originLocator: 'urn:adr:gold:semantic-normalization:unrelated-negative-control',
  rights: {
    artifactLicense: 'TEST_FIXTURE'
  },
  audit: audit('evt-gold-semantic-unrelated-source', 'source-admin')
});
const unrelatedArtifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.gold.semantic-normalization.unrelated',
  version: '1',
  sourceRef: unrelatedSource.ref,
  bytes: unrelatedBytes,
  mediaType: 'text/plain',
  materializationIdentity: 'gold-negative-control:unrelated-semantic-source',
  acquisition: {
    method: 'REPOSITORY_RETAINED_TEST_FIXTURE',
    acquiredAt: '2026-08-30T13:00:00.000Z'
  },
  rightsSnapshot: {
    publicAccess: false,
    artifactLicense: {
      spdx: 'NONE',
      redistributionAllowed: false
    }
  },
  audit: audit('evt-gold-semantic-unrelated-artifact', 'source-admin')
});
const unrelatedAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: unrelatedSource,
    label: 'normalization-unrelated-source'
  });

const unrelatedNormalization = structuredClone(normalization);
unrelatedNormalization.semanticEvidence = [
  {
    evidenceRole: 'SOURCE_CODE_NAMESPACE_CONTEXT',
    sourceRef: unrelatedSource.ref,
    sourceArtifactRef: unrelatedArtifact.ref,
    sourceArtifactContentHash: unrelatedArtifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: 0,
      endExclusive: 64,
      evidenceHash: sourceContentHash(unrelatedBytes.subarray(0, 64))
    }
  },
  {
    evidenceRole: 'NORMALIZED_OPERATION_MEANING',
    sourceRef: unrelatedSource.ref,
    sourceArtifactRef: unrelatedArtifact.ref,
    sourceArtifactContentHash: unrelatedArtifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: 64,
      endExclusive: unrelatedBytes.byteLength,
      evidenceHash: sourceContentHash(
        unrelatedBytes.subarray(64, unrelatedBytes.byteLength)
      )
    }
  }
];

const unrelatedReview =
  publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.semantic-normalization.unrelated-evidence',
    version: '1',
    normalization: unrelatedNormalization,
    disposition: 'REJECT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      unrelatedAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale:
      'The exact retained evidence belongs to an unrelated semantic source and does not establish the Sustainable Corn plant_corn code namespace or PLANT/CROP:CORN meaning.',
    audit: audit(
      'evt-gold-semantic-unrelated-review',
      normalizationReviewer.principalId
    )
  });

expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.semantic-normalization.unrelated-evidence',
      version: '1',
      compilation: buildCompilation(
        unrelatedNormalization,
        unrelatedReview.ref
      ),
      audit: audit(
        'evt-gold-semantic-unrelated-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_REJECTED'
);

const rejectedReview =
  publishAgronomicRecordedOperationSemanticNormalizationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.semantic-normalization.rejected',
    version: '1',
    normalization,
    disposition: 'REJECT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale:
      'Rejected semantic adjudication must not authorize compilation publication.',
    audit: audit(
      'evt-gold-semantic-rejected-review',
      normalizationReviewer.principalId
    )
  });

expectNormalizationError(
  () =>
    publishAgronomicRecordedOperationSemanticNormalizationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.semantic-normalization.rejected',
      version: '1',
      compilation: buildCompilation(
        normalization,
        rejectedReview.ref
      ),
      audit: audit(
        'evt-gold-semantic-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_SEMANTIC_NORMALIZATION_REVIEW_REJECTED'
);


function expectMappingError(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof AgronomicRecordedOperationContextSemanticMappingCompilationError
        && error.code === code
  );
}

function buildContextSemanticMapping(parentRef = parent.published.ref) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_CONTRACT_VERSION,
    mappingId: 'mapping.gold.sustainable-corn.planting-date',
    parentOccurrenceCompilationRef: parentRef,
    semanticNormalizationCompilationRef: normalizationPublished.ref,
    sourceOperationSemantic: {
      family: 'PLANT',
      subject: { kind: 'CROP', code: 'CORN' }
    },
    sourceTemporalSupport: {
      kind: 'CALENDAR_DATE',
      date: '2011-05-03',
      precision: 'DAY'
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    transformationRationale:
      'Map the exact accepted Sustainable Corn recorded PLANT/CROP:CORN occurrence date to the frozen crop.planting_date DATE semantic while preserving the source date exactly and creating no ContextDatum or timestamp authority.'
  };
}

function buildContextSemanticMappingCompilation(mapping, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_COMPILATION_AUTHORITY',
    mapping,
    mappingHash: agronomicRecordedOperationContextSemanticMappingHash(mapping),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_OCCURRENCE',
        'SEMANTIC_NORMALIZATION',
        'SOURCE_OPERATION_SEMANTIC',
        'SOURCE_TEMPORAL_SUPPORT',
        'TARGET_CONTEXT_SEMANTIC_ID',
        'TARGET_CONTEXT_TYPED_DATE_VALUE'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_MAPPING_ELEMENT']
    },
    limitations: [
      'MAPPING_NOT_CONTEXT_DATUM',
      'DATE_VALUE_NOT_TIMESTAMP',
      'NO_EFFECTIVE_INTERVAL_AUTHORITY',
      'NO_AVAILABLE_AT_AUTHORITY',
      'NO_TIMEZONE_AUTHORITY',
      'NO_TARGET_OR_SPATIAL_PROJECTION',
      'NO_EPISTEMIC_OR_PROVENANCE_PROJECTION',
      'NO_UNIT_OR_UNCERTAINTY_PROJECTION',
      'NO_CURRENT_STATE_OR_SEASON_AUTHORITY',
      'NO_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const contextSemanticMapping = buildContextSemanticMapping();

const mappingReview =
  publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.context-semantic-mapping',
    version: '1',
    mapping: contextSemanticMapping,
    disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact DEC-0013 occurrence plus exact DEC-0014 PLANT/CROP:CORN normalization support only crop.planting_date = DATE 2011-05-03; no timestamp, ContextDatum, target/spatial, epistemic/provenance, unit or uncertainty projection is reviewed here.',
    audit: audit(
      'evt-gold-context-semantic-mapping-review',
      normalizationReviewer.principalId
    )
  });

const mappingPublished =
  publishAgronomicRecordedOperationContextSemanticMappingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.sustainable-corn.context-semantic-mapping',
    version: '1',
    compilation:
      buildContextSemanticMappingCompilation(
        contextSemanticMapping,
        mappingReview.ref
      ),
    audit: audit(
      'evt-gold-context-semantic-mapping-publication',
      normalizationReviewer.principalId
    )
  });

const mappingValidated =
  validateAgronomicRecordedOperationContextSemanticMappingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: mappingPublished.ref
  });

assert.deepEqual(
  mappingValidated.semanticPayload.mapping.sourceOperationSemantic,
  { family: 'PLANT', subject: { kind: 'CROP', code: 'CORN' } }
);
assert.deepEqual(
  mappingValidated.semanticPayload.mapping.sourceTemporalSupport,
  { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'DAY' }
);
assert.deepEqual(
  mappingValidated.semanticPayload.mapping.targetContextSemantic,
  {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  }
);
assert.equal(
  mappingValidated.semanticPayload.mapping.targetContextSemantic.value.date,
  mappingValidated.parentOccurrence.semanticPayload.occurrence
    .occurrenceSemantics.temporalSupport.date
);
assert.equal(
  mappingValidated.semanticPayload.mapping.targetContextSemantic.value.type,
  'DATE'
);
assert.equal(
  JSON.stringify(mappingValidated.semanticPayload.mapping).includes('T00:00:00'),
  false
);
assert.equal(
  JSON.stringify(mappingValidated.semanticPayload.mapping).includes('timezone'),
  false
);
assert.equal(
  JSON.stringify(mappingValidated.semanticPayload.mapping).includes('effectiveInterval'),
  false
);
assert.equal(
  JSON.stringify(mappingValidated.semanticPayload.mapping).includes('availableAt'),
  false
);

const sourceDateDrift = structuredClone(contextSemanticMapping);
sourceDateDrift.sourceTemporalSupport.date = '2011-05-04';
expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-semantic-mapping.source-date-drift',
      version: '1',
      mapping: sourceDateDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Source date drift must fail closed.',
      audit: audit(
        'evt-gold-context-semantic-mapping-source-date-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE_MISMATCH'
);

const targetDateDrift = structuredClone(contextSemanticMapping);
targetDateDrift.targetContextSemantic.value.date = '2011-05-04';
expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-semantic-mapping.target-date-drift',
      version: '1',
      mapping: targetDateDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target DATE drift must fail closed.',
      audit: audit(
        'evt-gold-context-semantic-mapping-target-date-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_DATE_MISMATCH'
);

for (const [label, mutate, expectedCode] of [
  [
    'family-drift',
    (value) => { value.sourceOperationSemantic.family = 'HARVEST'; },
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_SEMANTIC'
  ],
  [
    'subject-kind-drift',
    (value) => { value.sourceOperationSemantic.subject.kind = 'MATERIAL'; },
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_SEMANTIC'
  ],
  [
    'subject-code-drift',
    (value) => { value.sourceOperationSemantic.subject.code = 'SOYBEAN'; },
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_SOURCE_SEMANTIC'
  ],
  [
    'semantic-id-drift',
    (value) => { value.targetContextSemantic.semanticId = 'crop.harvest_date'; },
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_TARGET_SEMANTIC'
  ],
  [
    'timestamp-target',
    (value) => { value.targetContextSemantic.value.type = 'TIMESTAMP'; },
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_TARGET_SEMANTIC'
  ]
]) {
  const value = structuredClone(contextSemanticMapping);
  mutate(value);
  expectMappingError(
    () =>
      publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.context-semantic-mapping.${label}`,
        version: '1',
        mapping: value,
        disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-context-semantic-mapping-${label}`,
          normalizationReviewer.principalId
        )
      }),
    expectedCode
  );
}

const alternateParent =
  publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0016.alternate-parent-occurrence',
    version: '1',
    compilation: parent.published.semanticPayload,
    audit: audit(
      'evt-gold-dec0016-alternate-parent-publication',
      'gold-dec0014-parent-occurrence-reviewer'
    )
  });

const parentClosureDrift = buildContextSemanticMapping(alternateParent.ref);
expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-semantic-mapping.parent-closure-drift',
      version: '1',
      mapping: parentClosureDrift,
      disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Normalization cannot be rebound to another parent compilation identity.',
      audit: audit(
        'evt-gold-context-semantic-mapping-parent-closure-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_PARENT_CLOSURE_MISMATCH'
);

expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-semantic-mapping.incomplete-review',
      version: '1',
      mapping: contextSemanticMapping,
      disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_TIMESTAMP_OR_TIMEZONE_INFERENCE'),
      rationale: 'Incomplete review cannot authorize mapping.',
      audit: audit(
        'evt-gold-context-semantic-mapping-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_INCOMPLETE'
);

const unauthorizedMappingReviewer = createPrincipal({
  principalId: 'gold-context-semantic-mapping-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-semantic-mapping.unauthorized',
      version: '1',
      mapping: contextSemanticMapping,
      disposition: 'ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
      reviewerPrincipal: unauthorizedMappingReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact source authorizations.',
      audit: audit(
        'evt-gold-context-semantic-mapping-unauthorized',
        unauthorizedMappingReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedMappingReview =
  publishAgronomicRecordedOperationContextSemanticMappingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.context-semantic-mapping.rejected',
    version: '1',
    mapping: contextSemanticMapping,
    disposition: 'REJECT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected semantic projection cannot authorize publication.',
    audit: audit(
      'evt-gold-context-semantic-mapping-rejected',
      normalizationReviewer.principalId
    )
  });

expectMappingError(
  () =>
    publishAgronomicRecordedOperationContextSemanticMappingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.context-semantic-mapping.rejected',
      version: '1',
      compilation:
        buildContextSemanticMappingCompilation(
          contextSemanticMapping,
          rejectedMappingReview.ref
        ),
      audit: audit(
        'evt-gold-context-semantic-mapping-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING_REVIEW_REJECTED'
);


function expectEpistemicError(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof
        AgronomicRecordedOperationContextEpistemicClassificationCompilationError
        && error.code === code
  );
}

function buildEpistemicClassification() {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_CONTRACT_VERSION,
    classificationId:
      'classification.gold.sustainable-corn.planting-date.assertion',
    contextSemanticMappingCompilationRef: mappingPublished.ref,
    predecessorOccurrenceSemantics: {
      recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
      occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE'
    },
    targetContextSemantic:
      structuredClone(mappingValidated.semanticPayload.mapping.targetContextSemantic),
    epistemicClass: 'ASSERTION',
    classificationRationale:
      'The exact accepted Sustainable Corn source-recorded operation establishes an external-source statement about the planting event/date, but the accepted predecessor chain contains no direct planter telemetry, direct-measurement semantics, or independent execution verification authority.'
  };
}

function buildEpistemicCompilation(classification, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash:
      agronomicRecordedOperationContextEpistemicClassificationHash(classification),
    epistemicReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'CONTEXT_SEMANTIC_MAPPING',
        'PARENT_OCCURRENCE_SEMANTICS',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_EPISTEMIC_ELEMENT']
    },
    limitations: [
      'ASSERTION_NOT_OBSERVATION',
      'NO_DIRECT_MEASUREMENT_OR_TELEMETRY_AUTHORITY',
      'NO_PROVENANCE_CLASS_AUTHORITY',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_AUTHORITY',
      'NO_TIMEZONE_AUTHORITY',
      'NO_TARGET_OR_SPATIAL_PROJECTION',
      'NO_UNIT_OR_UNCERTAINTY_PROJECTION',
      'NO_CURRENT_STATE_OR_SEASON_AUTHORITY',
      'NO_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const epistemicClassification = buildEpistemicClassification();

const epistemicReview =
  publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-epistemic-classification',
    version: '1',
    classification: epistemicClassification,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'The exact DEC-0016 mapped planting date closes to a source-recorded operation world without accepted direct-measurement or planter-telemetry authority. Frozen Context semantics therefore support ASSERTION only; provenance remains unresolved.',
    audit: audit(
      'evt-gold-context-epistemic-classification-review',
      normalizationReviewer.principalId
    )
  });

const epistemicPublished =
  publishAgronomicRecordedOperationContextEpistemicClassificationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-epistemic-classification',
    version: '1',
    compilation:
      buildEpistemicCompilation(epistemicClassification, epistemicReview.ref),
    audit: audit(
      'evt-gold-context-epistemic-classification-publication',
      normalizationReviewer.principalId
    )
  });

const epistemicValidated =
  validateAgronomicRecordedOperationContextEpistemicClassificationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: epistemicPublished.ref
  });

assert.equal(
  epistemicValidated.semanticPayload.classification.epistemicClass,
  'ASSERTION'
);
assert.deepEqual(
  epistemicValidated.semanticPayload.classification.predecessorOccurrenceSemantics,
  {
    recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE'
  }
);
assert.deepEqual(
  epistemicValidated.semanticPayload.classification.targetContextSemantic,
  mappingValidated.semanticPayload.mapping.targetContextSemantic
);
assert.equal(
  epistemicValidated.parentOccurrence.semanticPayload.occurrence.recordSemanticRole,
  'ACTUAL_FIELD_OPERATION_RECORD'
);
assert.equal(
  epistemicValidated.parentOccurrence.semanticPayload.occurrence
    .occurrenceSemantics.occurrenceClass,
  'SOURCE_RECORDED_OPERATION_OCCURRENCE'
);
assert.equal(
  JSON.stringify(epistemicValidated.semanticPayload).includes('provenanceClass'),
  false
);
assert.equal(
  JSON.stringify(epistemicValidated.semanticPayload).includes('effectiveInterval'),
  false
);
assert.equal(
  JSON.stringify(epistemicValidated.semanticPayload).includes('availableAt'),
  false
);
assert.equal(
  JSON.stringify(epistemicValidated.semanticPayload).includes('timezone'),
  false
);

for (const epistemicClass of [
  'OBSERVATION',
  'DERIVED',
  'STATE_ESTIMATE',
  'FORECAST',
  'CONFIGURATION',
  'MODEL_PRIOR'
]) {
  const value = structuredClone(epistemicClassification);
  value.epistemicClass = epistemicClass;
  expectEpistemicError(
    () =>
      publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          `review.gold.context-epistemic-classification.${epistemicClass.toLowerCase()}`,
        version: '1',
        classification: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale:
          `${epistemicClass} is not authorized by the exact first source-recorded predecessor world.`,
        audit: audit(
          `evt-gold-context-epistemic-${epistemicClass.toLowerCase()}`,
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASS'
  );
}

const targetDrift = structuredClone(epistemicClassification);
targetDrift.targetContextSemantic.value.date = '2011-05-04';
expectEpistemicError(
  () =>
    publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-epistemic-classification.target-drift',
      version: '1',
      classification: targetDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target semantic/value drift must fail exact DEC-0016 closure.',
      audit: audit(
        'evt-gold-context-epistemic-target-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_TARGET_MISMATCH'
);

expectEpistemicError(
  () =>
    publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-epistemic-classification.incomplete-review',
      version: '1',
      classification: epistemicClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_OBSERVATION_UPGRADE'),
      rationale: 'Incomplete epistemic review cannot authorize publication.',
      audit: audit(
        'evt-gold-context-epistemic-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_INCOMPLETE'
);

const unauthorizedEpistemicReviewer = createPrincipal({
  principalId: 'gold-context-epistemic-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectEpistemicError(
  () =>
    publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-epistemic-classification.unauthorized',
      version: '1',
      classification: epistemicClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
      reviewerPrincipal: unauthorizedEpistemicReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact source authorizations.',
      audit: audit(
        'evt-gold-context-epistemic-unauthorized',
        unauthorizedEpistemicReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedEpistemicReview =
  publishAgronomicRecordedOperationContextEpistemicClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.context-epistemic-classification.rejected',
    version: '1',
    classification: epistemicClassification,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected epistemic classification cannot authorize publication.',
    audit: audit(
      'evt-gold-context-epistemic-rejected',
      normalizationReviewer.principalId
    )
  });

expectEpistemicError(
  () =>
    publishAgronomicRecordedOperationContextEpistemicClassificationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'compilation.gold.context-epistemic-classification.rejected',
      version: '1',
      compilation:
        buildEpistemicCompilation(
          epistemicClassification,
          rejectedEpistemicReview.ref
        ),
      audit: audit(
        'evt-gold-context-epistemic-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION_REVIEW_REJECTED'
);


function expectProvenanceError(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof
        AgronomicRecordedOperationContextProvenanceClassificationCompilationError
        && error.code === code
  );
}

function buildProvenanceClassification(valueSource = {
  sourceRef: parent.source.ref,
  sourceArtifactRef: parent.artifact.ref,
  sourceArtifactContentHash: parent.artifact.semanticPayload.contentHash
}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_CONTRACT_VERSION,
    classificationId:
      'classification.gold.sustainable-corn.planting-date.external-provider',
    contextEpistemicClassificationCompilationRef: epistemicPublished.ref,
    valueSource,
    targetContextSemantic:
      structuredClone(
        epistemicValidated.semanticPayload.classification.targetContextSemantic
      ),
    epistemicClass:
      epistemicValidated.semanticPayload.classification.epistemicClass,
    provenanceClass: 'EXTERNAL_PROVIDER',
    classificationRationale:
      'The exact mapped planting-date value is supplied by the accepted DEC-0013 external occurrence Source/SourceArtifact. DEC-0014 mantable.py supplies semantic interpretation only and cannot become value provenance.'
  };
}

function buildProvenanceCompilation(classification, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash:
      agronomicRecordedOperationContextProvenanceClassificationHash(classification),
    provenanceReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'CONTEXT_EPISTEMIC_CLASSIFICATION',
        'VALUE_SOURCE',
        'VALUE_SOURCE_ARTIFACT',
        'VALUE_SOURCE_CONTENT_HASH',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS',
        'PROVENANCE_CLASS'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_PROVENANCE_ELEMENT']
    },
    limitations: [
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_CONTEXT_DATUM_SOURCE_WIRE',
      'NO_AVAILABLE_AT_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL_OR_TIMEZONE_AUTHORITY',
      'NO_TARGET_OR_SPATIAL_PROJECTION',
      'NO_UNIT_OR_UNCERTAINTY_PROJECTION',
      'NO_SOURCE_TYPE_TO_PROVENANCE_GLOBAL_RULE',
      'NO_ORIGIN_LOCATOR_LEXICAL_RULE',
      'NO_ACQUISITION_METHOD_GLOBAL_RULE',
      'NO_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const provenanceClassification = buildProvenanceClassification();

const provenanceReview =
  publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-provenance-classification',
    version: '1',
    classification: provenanceClassification,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'The exact context value routes to the DEC-0013 occurrence Source/SourceArtifact and enters ADR through the reviewed external-provider channel. The DEC-0014 semantic source remains interpretation evidence only.',
    audit: audit(
      'evt-gold-context-provenance-classification-review',
      normalizationReviewer.principalId
    )
  });

const provenancePublished =
  publishAgronomicRecordedOperationContextProvenanceClassificationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-provenance-classification',
    version: '1',
    compilation:
      buildProvenanceCompilation(provenanceClassification, provenanceReview.ref),
    audit: audit(
      'evt-gold-context-provenance-classification-publication',
      normalizationReviewer.principalId
    )
  });

const provenanceValidated =
  validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: provenancePublished.ref
  });

assert.equal(
  provenanceValidated.semanticPayload.classification.provenanceClass,
  'EXTERNAL_PROVIDER'
);
assert.equal(
  provenanceValidated.semanticPayload.classification.epistemicClass,
  'ASSERTION'
);
assert.deepEqual(
  provenanceValidated.semanticPayload.classification.targetContextSemantic,
  epistemicValidated.semanticPayload.classification.targetContextSemantic
);
assert.deepEqual(
  provenanceValidated.semanticPayload.classification.valueSource,
  {
    sourceRef: parent.source.ref,
    sourceArtifactRef: parent.artifact.ref,
    sourceArtifactContentHash: parent.artifact.semanticPayload.contentHash
  }
);
assert.equal(
  provenanceValidated.semanticInterpretationSourceRefs
    .some((ref) => ref.semanticHash === parent.source.ref.semanticHash),
  false
);
assert.equal(
  JSON.stringify(provenanceValidated.semanticPayload).includes('providerId'),
  false
);
assert.equal(
  JSON.stringify(provenanceValidated.semanticPayload).includes('availableAt'),
  false
);
assert.equal(
  JSON.stringify(provenanceValidated.semanticPayload).includes('effectiveInterval'),
  false
);

for (const provenanceClass of [
  'USER',
  'AGRONOMIST',
  'SENSOR',
  'MACHINERY',
  'REMOTE_SENSING',
  'CUSTOMER_SYSTEM',
  'LABORATORY',
  'MODEL',
  'PLATFORM'
]) {
  const value = structuredClone(provenanceClassification);
  value.provenanceClass = provenanceClass;
  expectProvenanceError(
    () =>
      publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          `review.gold.context-provenance-classification.${provenanceClass.toLowerCase()}`,
        version: '1',
        classification: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale:
          `${provenanceClass} is not authorized by the exact first value-source world.`,
        audit: audit(
          `evt-gold-context-provenance-${provenanceClass.toLowerCase()}`,
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASS'
  );
}

const semanticSourceSubstitution = buildProvenanceClassification({
  sourceRef: semantic.source.ref,
  sourceArtifactRef: semantic.artifact.ref,
  sourceArtifactContentHash: semantic.artifact.semanticPayload.contentHash
});
expectProvenanceError(
  () =>
    publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-provenance-classification.semantic-source-substitution',
      version: '1',
      classification: semanticSourceSubstitution,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale:
        'Semantic interpretation evidence cannot replace the exact occurrence value source.',
      audit: audit(
        'evt-gold-context-provenance-semantic-source-substitution',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_VALUE_SOURCE_MISMATCH'
);

for (const [label, mutate] of [
  [
    'source-ref-drift',
    (value) => {
      value.valueSource.sourceRef.semanticHash = `sha256:${'1'.repeat(64)}`;
    }
  ],
  [
    'source-artifact-ref-drift',
    (value) => {
      value.valueSource.sourceArtifactRef.semanticHash =
        `sha256:${'2'.repeat(64)}`;
    }
  ],
  [
    'source-artifact-content-hash-drift',
    (value) => {
      value.valueSource.sourceArtifactContentHash =
        `sha256:${'3'.repeat(64)}`;
    }
  ]
]) {
  const value = structuredClone(provenanceClassification);
  mutate(value);
  expectProvenanceError(
    () =>
      publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.context-provenance-classification.${label}`,
        version: '1',
        classification: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail exact value-source closure.`,
        audit: audit(
          `evt-gold-context-provenance-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_VALUE_SOURCE_MISMATCH'
  );
}

const provenanceTargetDrift = structuredClone(provenanceClassification);
provenanceTargetDrift.targetContextSemantic.value.date = '2011-05-04';
expectProvenanceError(
  () =>
    publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-provenance-classification.target-drift',
      version: '1',
      classification: provenanceTargetDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target semantic/value drift must fail DEC-0017 closure.',
      audit: audit(
        'evt-gold-context-provenance-target-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_TARGET_MISMATCH'
);

expectProvenanceError(
  () =>
    publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-provenance-classification.incomplete-review',
      version: '1',
      classification: provenanceClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'VALUE_SOURCE_NOT_SEMANTIC_INTERPRETATION_SOURCE'),
      rationale: 'Incomplete provenance review cannot authorize publication.',
      audit: audit(
        'evt-gold-context-provenance-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_INCOMPLETE'
);

const unauthorizedProvenanceReviewer = createPrincipal({
  principalId: 'gold-context-provenance-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectProvenanceError(
  () =>
    publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-provenance-classification.unauthorized',
      version: '1',
      classification: provenanceClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
      reviewerPrincipal: unauthorizedProvenanceReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact source authorizations.',
      audit: audit(
        'evt-gold-context-provenance-unauthorized',
        unauthorizedProvenanceReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedProvenanceReview =
  publishAgronomicRecordedOperationContextProvenanceClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.context-provenance-classification.rejected',
    version: '1',
    classification: provenanceClassification,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected provenance classification cannot authorize publication.',
    audit: audit(
      'evt-gold-context-provenance-rejected',
      normalizationReviewer.principalId
    )
  });

expectProvenanceError(
  () =>
    publishAgronomicRecordedOperationContextProvenanceClassificationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'compilation.gold.context-provenance-classification.rejected',
      version: '1',
      compilation:
        buildProvenanceCompilation(
          provenanceClassification,
          rejectedProvenanceReview.ref
        ),
      audit: audit(
        'evt-gold-context-provenance-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION_REVIEW_REJECTED'
);


function expectProviderIdentityError(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof
        AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationError
        && error.code === code
  );
}

function buildProviderIdentityBinding() {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId:
      'binding.gold.sustainable-corn.context-source-provider-identity',
    contextProvenanceClassificationCompilationRef: provenancePublished.ref,
    valueSource:
      structuredClone(
        provenanceValidated.semanticPayload.classification.valueSource
      ),
    sourceNamespaceEvidence: {
      exactOriginLocator: parent.source.semanticPayload.originLocator
    },
    targetContextSemantic:
      structuredClone(
        provenanceValidated.semanticPayload.classification.targetContextSemantic
      ),
    epistemicClass:
      provenanceValidated.semanticPayload.classification.epistemicClass,
    provenanceClass:
      provenanceValidated.semanticPayload.classification.provenanceClass,
    providerId:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID,
    bindingRationale:
      'The exact DEC-0018 value source is supplied through the reviewed GitHub repository namespace github.com/isudatateam/datateam. This does not resolve an institution and does not publish sourceRef/contentHash wire fields.'
  };
}

function buildProviderIdentityCompilation(binding, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash:
      agronomicRecordedOperationContextSourceProviderIdentityBindingHash(binding),
    providerIdentityReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'CONTEXT_PROVENANCE_CLASSIFICATION',
        'VALUE_SOURCE',
        'VALUE_SOURCE_ARTIFACT',
        'VALUE_SOURCE_CONTENT_HASH',
        'SOURCE_ORIGIN_LOCATOR',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS',
        'PROVENANCE_CLASS',
        'PROVIDER_ID'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_PROVIDER_IDENTITY_ELEMENT']
    },
    limitations: [
      'NO_INSTITUTIONAL_ENTITY_RESOLUTION',
      'NO_GENERIC_URL_TO_PROVIDER_RULE',
      'NO_SOURCE_REF_WIRE_PROJECTION',
      'NO_CONTENT_HASH_WIRE_PROJECTION',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_AUTHORITY',
      'NO_TARGET_OR_SPATIAL_PROJECTION',
      'NO_UNIT_OR_UNCERTAINTY_PROJECTION',
      'NO_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const providerIdentityBinding = buildProviderIdentityBinding();

assert.equal(
  providerIdentityBinding.sourceNamespaceEvidence.exactOriginLocator,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR
);

const providerIdentityReview =
  publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-source-provider-identity-binding',
    version: '1',
    binding: providerIdentityBinding,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale:
      'The exact DEC-0018 value Source carries the reviewed Sustainable Corn notebook GitHub origin. Repository-level provider namespace github.com/isudatateam/datateam is accepted without institutional resolution or sourceRef/contentHash wire projection.',
    audit: audit(
      'evt-gold-context-source-provider-identity-review',
      normalizationReviewer.principalId
    )
  });

const providerIdentityPublished =
  publishAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-source-provider-identity-binding',
    version: '1',
    compilation:
      buildProviderIdentityCompilation(
        providerIdentityBinding,
        providerIdentityReview.ref
      ),
    audit: audit(
      'evt-gold-context-source-provider-identity-publication',
      normalizationReviewer.principalId
    )
  });

const providerIdentityValidated =
  validateAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: providerIdentityPublished.ref
  });

assert.equal(
  providerIdentityValidated.semanticPayload.binding.providerId,
  'github.com/isudatateam/datateam'
);
assert.equal(
  providerIdentityValidated.semanticPayload.binding.sourceNamespaceEvidence
    .exactOriginLocator,
  parent.source.semanticPayload.originLocator
);
assert.deepEqual(
  providerIdentityValidated.semanticPayload.binding.valueSource,
  provenanceValidated.semanticPayload.classification.valueSource
);
assert.deepEqual(
  providerIdentityValidated.semanticPayload.binding.targetContextSemantic,
  provenanceValidated.semanticPayload.classification.targetContextSemantic
);
assert.equal(
  providerIdentityValidated.semanticPayload.binding.epistemicClass,
  'ASSERTION'
);
assert.equal(
  providerIdentityValidated.semanticPayload.binding.provenanceClass,
  'EXTERNAL_PROVIDER'
);
assert.equal(
  Object.hasOwn(providerIdentityValidated.semanticPayload.binding, 'sourceRef'),
  false
);
assert.equal(
  Object.hasOwn(providerIdentityValidated.semanticPayload.binding, 'contentHash'),
  false
);
assert.equal(
  Object.hasOwn(providerIdentityValidated.semanticPayload.binding, 'source'),
  false
);

for (const providerId of [
  'github.com',
  'isudatateam',
  'datateam',
  'github.com/isudatateam',
  'github.com/other/datateam',
  'ISU',
  'IOWA_STATE_UNIVERSITY',
  'GITHUB',
  'org-a',
  parent.source.ref.logicalId
]) {
  const value = structuredClone(providerIdentityBinding);
  value.providerId = providerId;
  expectProviderIdentityError(
    () =>
      publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          `review.gold.context-source-provider-identity.${providerId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        version: '1',
        binding: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
        rationale:
          `providerId ${providerId} is outside the exact first accepted repository-level provider namespace.`,
        audit: audit(
          `evt-gold-provider-id-${providerId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_PROVIDER_ID'
  );
}

const providerOriginDrift = structuredClone(providerIdentityBinding);
providerOriginDrift.sourceNamespaceEvidence.exactOriginLocator =
  'https://github.com/isudatateam/datateam/blob/0000000000000000000000000000000000000000/scripts/cscap/chicago.ipynb';
expectProviderIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-source-provider-identity.origin-drift',
      version: '1',
      binding: providerOriginDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Origin-locator drift must fail exact first provider namespace closure.',
      audit: audit(
        'evt-gold-context-source-provider-origin-drift',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_ORIGIN_LOCATOR'
);

for (const [label, mutate] of [
  [
    'source-ref-drift',
    (value) => {
      value.valueSource.sourceRef.semanticHash = `sha256:${'1'.repeat(64)}`;
    }
  ],
  [
    'source-artifact-ref-drift',
    (value) => {
      value.valueSource.sourceArtifactRef.semanticHash =
        `sha256:${'2'.repeat(64)}`;
    }
  ],
  [
    'source-artifact-content-hash-drift',
    (value) => {
      value.valueSource.sourceArtifactContentHash =
        `sha256:${'3'.repeat(64)}`;
    }
  ]
]) {
  const value = structuredClone(providerIdentityBinding);
  mutate(value);
  expectProviderIdentityError(
    () =>
      publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.context-source-provider-identity.${label}`,
        version: '1',
        binding: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail exact DEC-0018 value-source closure.`,
        audit: audit(
          `evt-gold-context-source-provider-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_VALUE_SOURCE_MISMATCH'
  );
}

const providerTargetDrift = structuredClone(providerIdentityBinding);
providerTargetDrift.targetContextSemantic.value.date = '2011-05-04';
expectProviderIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-source-provider-identity.target-drift',
      version: '1',
      binding: providerTargetDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target semantic/value drift must fail exact DEC-0018 closure.',
      audit: audit(
        'evt-gold-context-source-provider-target-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_TARGET_MISMATCH'
);

expectProviderIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-provider-identity.incomplete-review',
      version: '1',
      binding: providerIdentityBinding,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_GENERIC_URL_TO_PROVIDER_RULE'),
      rationale: 'Incomplete provider-identity review cannot authorize publication.',
      audit: audit(
        'evt-gold-context-source-provider-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_INCOMPLETE'
);

const unauthorizedProviderIdentityReviewer = createPrincipal({
  principalId: 'gold-context-provider-identity-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectProviderIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-provider-identity.unauthorized',
      version: '1',
      binding: providerIdentityBinding,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
      reviewerPrincipal: unauthorizedProviderIdentityReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow the exact value-source authorization.',
      audit: audit(
        'evt-gold-context-source-provider-unauthorized',
        unauthorizedProviderIdentityReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedProviderIdentityReview =
  publishAgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.context-source-provider-identity.rejected',
    version: '1',
    binding: providerIdentityBinding,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected provider-identity binding cannot authorize publication.',
    audit: audit(
      'evt-gold-context-source-provider-rejected',
      normalizationReviewer.principalId
    )
  });

expectProviderIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'compilation.gold.context-source-provider-identity.rejected',
      version: '1',
      compilation:
        buildProviderIdentityCompilation(
          providerIdentityBinding,
          rejectedProviderIdentityReview.ref
        ),
      audit: audit(
        'evt-gold-context-source-provider-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_REVIEW_REJECTED'
);


function expectSourceProjectionError(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof
        AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationError
        && error.code === code
  );
}

function buildSourceProjection() {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTRACT_VERSION,
    projectionId:
      'projection.gold.sustainable-corn.context-source-reference-hash',
    sourceProviderIdentityBindingCompilationRef: providerIdentityPublished.ref,
    providerId:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_PROVIDER_ID,
    valueSource:
      structuredClone(providerIdentityValidated.semanticPayload.binding.valueSource),
    sourceLocator: structuredClone(parent.occurrence.sourceLocator),
    projectedSource: {
      sourceRef:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF,
      contentHash: parent.occurrence.sourceLocator.evidenceHash
    },
    targetContextSemantic:
      structuredClone(providerIdentityValidated.semanticPayload.binding.targetContextSemantic),
    epistemicClass:
      providerIdentityValidated.semanticPayload.binding.epistemicClass,
    provenanceClass:
      providerIdentityValidated.semanticPayload.binding.provenanceClass,
    projectionRationale:
      'The public sourceRef identifies the exact persisted notebook row at the accepted Git blob/path and Jupyter coordinates. Public contentHash equals the exact row-level DEC-0013 evidenceHash, while whole-artifact hash remains predecessor closure only.'
  };
}

function buildSourceProjectionCompilation(projection, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash:
      agronomicRecordedOperationContextSourceReferenceHashProjectionHash(projection),
    sourceReferenceReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'SOURCE_PROVIDER_IDENTITY_BINDING',
        'PROVIDER_ID',
        'VALUE_SOURCE',
        'SOURCE_LOCATOR',
        'EVIDENCE_HASH',
        'PUBLIC_SOURCE_REF',
        'PUBLIC_CONTENT_HASH',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS',
        'PROVENANCE_CLASS'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_TARGETED_SOURCE_WIRE_ELEMENT']
    },
    limitations: [
      'NO_GENERIC_LOCATOR_FORMATTER',
      'NO_GENERIC_EVIDENCE_HASH_PROJECTION_RULE',
      'NO_ADR_AUTHORITY_REF_AS_PUBLIC_SOURCE_REF',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_AUTHORITY',
      'NO_TARGET_OR_SPATIAL_PROJECTION',
      'NO_UNIT_UNCERTAINTY_OR_TEMPORAL_SUPPORT_PROJECTION',
      'NO_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY',
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

const sourceProjection = buildSourceProjection();

const sourceProjectionReview =
  publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-source-reference-hash-projection',
    version: '1',
    projection: sourceProjection,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'The exact first public source wire preserves the reviewed repository provider namespace, exact Git blob/path and exact Jupyter row locator; public contentHash equals exact row-level evidenceHash rather than artifact or occurrence authority hashes.',
    audit: audit(
      'evt-gold-context-source-reference-hash-review',
      normalizationReviewer.principalId
    )
  });

const sourceProjectionPublished =
  publishAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-source-reference-hash-projection',
    version: '1',
    compilation:
      buildSourceProjectionCompilation(
        sourceProjection,
        sourceProjectionReview.ref
      ),
    audit: audit(
      'evt-gold-context-source-reference-hash-publication',
      normalizationReviewer.principalId
    )
  });

const sourceProjectionValidated =
  validateAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: sourceProjectionPublished.ref
  });

assert.equal(
  sourceProjectionValidated.semanticPayload.projection.providerId,
  'github.com/isudatateam/datateam'
);
assert.equal(
  sourceProjectionValidated.semanticPayload.projection.projectedSource.sourceRef,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
);
assert.equal(
  sourceProjectionValidated.semanticPayload.projection.projectedSource.contentHash,
  parent.occurrence.sourceLocator.evidenceHash
);
assert.notEqual(
  sourceProjectionValidated.semanticPayload.projection.projectedSource.contentHash,
  parent.artifact.semanticPayload.contentHash
);
assert.notEqual(
  sourceProjectionValidated.semanticPayload.projection.projectedSource.contentHash,
  agronomicRecordedOperationOccurrenceHash(parent.occurrence)
);
assert.deepEqual(
  sourceProjectionValidated.semanticPayload.projection.sourceLocator,
  parent.occurrence.sourceLocator
);

for (const badSourceRef of [
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
    .replace('rowIndex=33', 'rowIndex=32'),
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
    .replace('4847e7b3b4aad42193de3f5f0da6f81f6b62dc50', '0000000000000000000000000000000000000000'),
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_FIRST_SOURCE_REF
    .replace('scripts/cscap/chicago.ipynb', 'scripts/cscap/other.ipynb'),
  'scripts/cscap/chicago.ipynb'
]) {
  const value = structuredClone(sourceProjection);
  value.projectedSource.sourceRef = badSourceRef;
  expectSourceProjectionError(
    () =>
      publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          'review.gold.context-source-reference-hash.bad-source-ref',
        version: '1',
        projection: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale: 'A public sourceRef that loses exact fact-level identity must fail closed.',
        audit: audit(
          'evt-gold-context-source-reference-hash-bad-source-ref',
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_SOURCE_REF'
  );
}

for (const badHash of [
  parent.artifact.semanticPayload.contentHash,
  agronomicRecordedOperationOccurrenceHash(parent.occurrence),
  `sha256:${'f'.repeat(64)}`
]) {
  const value = structuredClone(sourceProjection);
  value.projectedSource.contentHash = badHash;
  expectSourceProjectionError(
    () =>
      publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId:
          'review.gold.context-source-reference-hash.bad-content-hash',
        version: '1',
        projection: value,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale:
          'Public source contentHash must equal exact row-level evidenceHash.',
        audit: audit(
          'evt-gold-context-source-reference-hash-bad-content-hash',
          normalizationReviewer.principalId
        )
      }),
    'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_CONTENT_HASH_MISMATCH'
  );
}

const locatorDrift = structuredClone(sourceProjection);
locatorDrift.sourceLocator.coordinates.rowIndex = '32';
expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-reference-hash.locator-drift',
      version: '1',
      projection: locatorDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Source locator row drift must fail exact predecessor closure.',
      audit: audit(
        'evt-gold-context-source-reference-hash-locator-drift',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_COORDINATES'
);

const providerDrift = structuredClone(sourceProjection);
providerDrift.providerId = 'github.com';
expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-reference-hash.provider-drift',
      version: '1',
      projection: providerDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Provider identity drift must fail exact DEC-0019 closure.',
      audit: audit(
        'evt-gold-context-source-reference-hash-provider-drift',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_PROVIDER_ID'
);

const projectionTargetDrift = structuredClone(sourceProjection);
projectionTargetDrift.targetContextSemantic.value.date = '2011-05-04';
expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-reference-hash.target-drift',
      version: '1',
      projection: projectionTargetDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target semantic/value drift must fail predecessor closure.',
      audit: audit(
        'evt-gold-context-source-reference-hash-target-drift',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_TARGET'
);

expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-reference-hash.incomplete-review',
      version: '1',
      projection: sourceProjection,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'PUBLIC_CONTENT_HASH_EQUALS_EVIDENCE_HASH'),
      rationale: 'Incomplete source-reference review cannot authorize publication.',
      audit: audit(
        'evt-gold-context-source-reference-hash-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_INCOMPLETE'
);

const unauthorizedSourceProjectionReviewer = createPrincipal({
  principalId: 'gold-context-source-reference-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'review.gold.context-source-reference-hash.unauthorized',
      version: '1',
      projection: sourceProjection,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
      reviewerPrincipal: unauthorizedSourceProjectionReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact source authorization.',
      audit: audit(
        'evt-gold-context-source-reference-hash-unauthorized',
        unauthorizedSourceProjectionReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedSourceProjectionReview =
  publishAgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.context-source-reference-hash.rejected',
    version: '1',
    projection: sourceProjection,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected source-reference projection cannot authorize publication.',
    audit: audit(
      'evt-gold-context-source-reference-hash-rejected',
      normalizationReviewer.principalId
    )
  });

expectSourceProjectionError(
  () =>
    publishAgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId:
        'compilation.gold.context-source-reference-hash.rejected',
      version: '1',
      compilation:
        buildSourceProjectionCompilation(
          sourceProjection,
          rejectedSourceProjectionReview.ref
        ),
      audit: audit(
        'evt-gold-context-source-reference-hash-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION_REVIEW_REJECTED'
);

function expectAvailabilityProjectionError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof
        AgronomicContextSourceAcquisitionAvailabilityProjectionCompilationError,
      `expected DEC-0028 typed error, got ${error?.constructor?.name ?? 'none'}`
    );
    assert.equal(error.code, code);
    return true;
  });
}

function buildAvailabilityProjection(overrides = {}) {
  const parentProjection = sourceProjectionValidated.semanticPayload.projection;
  const artifact = sourceProjectionValidated.parentOccurrence.sourceArtifact;
  assert.ok(artifact);
  assert.equal(
    artifact.semanticPayload.acquisition.method,
    AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD
  );
  assert.equal(
    artifact.semanticPayload.acquisition.acquiredAt,
    AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
  );

  return {
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
    projectionId:
      'projection.gold.sustainable-corn.source-acquisition-availability',
    parentSourceReferenceHashProjectionCompilationRef: sourceProjectionPublished.ref,
    targetContextSemantic:
      structuredClone(parentProjection.targetContextSemantic),
    valueSource: structuredClone(parentProjection.valueSource),
    sourceArtifactAcquisition: {
      method: artifact.semanticPayload.acquisition.method,
      acquiredAt: artifact.semanticPayload.acquisition.acquiredAt
    },
    availableAtProjection: {
      basis: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
      availableAt: artifact.semanticPayload.acquisition.acquiredAt
    },
    rationale:
      'Use only the exact DEC-0020 value-source SourceArtifact acquisition timestamp as the conservative ADR evidence availability boundary.',
    ...overrides
  };
}

function buildAvailabilityCompilation(projection, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_AUTHORITY',
    projection,
    projectionHash:
      agronomicContextSourceAcquisitionAvailabilityProjectionHash(projection),
    availabilityProjectionReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_SOURCE_REFERENCE_HASH',
        'VALUE_SOURCE_ARTIFACT_ACQUISITION',
        'AVAILABLE_AT_PROJECTION'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_AVAILABILITY_ELEMENT']
    },
    limitations: [
      'ADR_EVIDENCE_AVAILABILITY_NOT_UPSTREAM_FIRST_PUBLICATION',
      'NO_OCCURRENCE_OR_EFFECTIVE_TIME_SUBSTITUTION',
      'NO_GENERIC_SOURCE_ARTIFACT_RULE',
      'NO_EFFECTIVE_INTERVAL',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ]
  };
}

const availabilityProjection = buildAvailabilityProjection();
const availabilityReview =
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.source-acquisition-availability',
    version: '1',
    projection: availabilityProjection,
    disposition:
      'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact DEC-0020 value-source artifact is retained at 2026-08-30T13:00:00.000Z; use that acquisition time only as ADR evidence availability, not upstream publication or event time.',
    audit: audit(
      'evt-gold-dec0028-availability-review',
      normalizationReviewer.principalId
    )
  });

const availabilityPublished =
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.source-acquisition-availability',
    version: '1',
    compilation:
      buildAvailabilityCompilation(
        availabilityProjection,
        availabilityReview.ref
      ),
    audit: audit(
      'evt-gold-dec0028-availability-publication',
      normalizationReviewer.principalId
    )
  });

const availabilityValidated =
  validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: availabilityPublished.ref
  });

assert.deepEqual(
  availabilityValidated.semanticPayload.projection.targetContextSemantic,
  {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  }
);
assert.deepEqual(
  availabilityValidated.semanticPayload.projection.sourceArtifactAcquisition,
  {
    method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
    acquiredAt: '2026-08-30T13:00:00.000Z'
  }
);
assert.deepEqual(
  availabilityValidated.semanticPayload.projection.availableAtProjection,
  {
    basis: 'VALUE_SOURCE_ARTIFACT_ACQUISITION',
    availableAt: '2026-08-30T13:00:00.000Z'
  }
);
assert.equal(
  availabilityValidated.semanticPayload.projection.valueSource.sourceArtifactContentHash,
  sourceProjectionValidated.parentOccurrence.sourceArtifact.semanticPayload.contentHash
);

expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028.wrong-parent-kind',
      version: '1',
      projection: buildAvailabilityProjection({
        parentSourceReferenceHashProjectionCompilationRef:
          providerIdentityPublished.ref
      }),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Wrong predecessor authority kind must fail closed.',
      audit: audit(
        'evt-gold-dec0028-wrong-parent-kind',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUTHORITY_REF'
);

const predecessorRefDrift = structuredClone(sourceProjectionPublished.ref);
predecessorRefDrift.semanticHash = `sha256:${'0'.repeat(64)}`;
assert.throws(() =>
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0028.predecessor-ref-drift',
    version: '1',
    projection: buildAvailabilityProjection({
      parentSourceReferenceHashProjectionCompilationRef: predecessorRefDrift
    }),
    disposition:
      'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Exact predecessor ref drift must fail closed.',
    audit: audit(
      'evt-gold-dec0028-predecessor-ref-drift',
      normalizationReviewer.principalId
    )
  })
);

for (const [label, targetContextSemantic] of [
  ['wrong-semantic', {
    semanticId: 'crop.emergence_date',
    value: { type: 'DATE', date: '2011-05-03' }
  }],
  ['wrong-type', {
    semanticId: 'crop.planting_date',
    value: { type: 'TIMESTAMP', date: '2011-05-03' }
  }],
  ['wrong-date', {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-04' }
  }]
]) {
  expectAvailabilityProjectionError(
    () =>
      publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0028.${label}`,
        version: '1',
        projection: buildAvailabilityProjection({ targetContextSemantic }),
        disposition:
          'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0028-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_TARGET'
  );
}

const sourceRefDrift = structuredClone(availabilityProjection.valueSource);
sourceRefDrift.sourceRef = sourceProjectionValidated.semanticPayload.projection
  .valueSource.sourceArtifactRef;
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028.source-ref-drift',
      version: '1',
      projection: buildAvailabilityProjection({ valueSource: sourceRefDrift }),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Value-source Source ref drift must fail closed.',
      audit: audit(
        'evt-gold-dec0028-source-ref-drift',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_AUTHORITY_REF'
);

const artifactRefDrift = structuredClone(availabilityProjection.valueSource);
artifactRefDrift.sourceArtifactRef = unrelatedArtifact.ref;
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028-artifact-ref-drift',
      version: '1',
      projection: buildAvailabilityProjection({ valueSource: artifactRefDrift }),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Value-source artifact ref drift must fail DEC-0020 closure.',
      audit: audit(
        'evt-gold-dec0028-artifact-ref-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_VALUE_SOURCE_MISMATCH'
);

const artifactHashDrift = structuredClone(availabilityProjection.valueSource);
artifactHashDrift.sourceArtifactContentHash = `sha256:${'f'.repeat(64)}`;
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028-artifact-hash-drift',
      version: '1',
      projection: buildAvailabilityProjection({ valueSource: artifactHashDrift }),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Artifact hash drift must fail exact value-source closure.',
      audit: audit(
        'evt-gold-dec0028-artifact-hash-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_VALUE_SOURCE_MISMATCH'
);

for (const [label, sourceArtifactAcquisition] of [
  ['planting-date-as-availability', {
    method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
    acquiredAt: '2011-05-03T00:00:00.000Z'
  }],
  ['git-time-substitution', {
    method: 'GIT_COMMIT_TIME',
    acquiredAt: '2026-08-30T13:00:00.000Z'
  }],
  ['review-time-substitution', {
    method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
    acquiredAt: '2026-09-02T02:00:00.000Z'
  }]
]) {
  const expectedCode =
    sourceArtifactAcquisition.method !== 'REPOSITORY_RETAINED_PUBLIC_GOLD'
      ? 'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_METHOD'
      : 'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_TIMESTAMP';
  expectAvailabilityProjectionError(
    () =>
      publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0028.${label}`,
        version: '1',
        projection: buildAvailabilityProjection({ sourceArtifactAcquisition }),
        disposition:
          'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0028-${label}`,
          normalizationReviewer.principalId
        )
      }),
    expectedCode
  );
}

for (const [label, availableAtProjection] of [
  ['arbitrary-available-at', {
    basis: 'VALUE_SOURCE_ARTIFACT_ACQUISITION',
    availableAt: '2011-05-03T00:00:00.000Z'
  }],
  ['upstream-publication-basis', {
    basis: 'UPSTREAM_FIRST_PUBLICATION',
    availableAt: '2026-08-30T13:00:00.000Z'
  }]
]) {
  const expectedCode =
    availableAtProjection.basis !== 'VALUE_SOURCE_ARTIFACT_ACQUISITION'
      ? 'UNSUPPORTED_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS'
      : 'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_VALUE_MISMATCH';
  expectAvailabilityProjectionError(
    () =>
      publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0028.${label}`,
        version: '1',
        projection: buildAvailabilityProjection({ availableAtProjection }),
        disposition:
          'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0028-${label}`,
          normalizationReviewer.principalId
        )
      }),
    expectedCode
  );
}

for (const [key, value] of [
  ['effectiveInterval', {
    start: '2011-05-03T05:00:00.000Z',
    end: '2011-05-04T05:00:00.000Z'
  }],
  ['timezoneId', 'America/Chicago'],
  ['utcOffset', '-05:00'],
  ['dstState', 'DAYLIGHT'],
  ['tzdbVersion', '2026a'],
  ['contextDatumRef', 'CD-1'],
  ['contextManifestRef', 'CM-1'],
  ['decisionProblemRef', 'DP-1'],
  ['upstreamFirstPublishedAt', '2011-05-03T00:00:00.000Z']
]) {
  expectAvailabilityProjectionError(
    () =>
      publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0028.forbidden-${key}`,
        version: '1',
        projection: {
          ...buildAvailabilityProjection(),
          [key]: value
        },
        disposition:
          'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
        rationale: 'Forbidden temporal/downstream widening must fail closed.',
        audit: audit(
          `evt-gold-dec0028-forbidden-${key}`,
          normalizationReviewer.principalId
        )
      }),
    'INVALID_AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_FIELD'
  );
}

const incompleteAvailabilityChecks =
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS
    .filter((check) => check !== 'NO_EFFECTIVE_TIME_AS_AVAILABILITY');
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028.incomplete-review',
      version: '1',
      projection: buildAvailabilityProjection(),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks: incompleteAvailabilityChecks,
      rationale: 'Incomplete review cannot authorize availability projection.',
      audit: audit(
        'evt-gold-dec0028-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_INCOMPLETE'
);

const unauthorizedAvailabilityReviewer = createPrincipal({
  principalId: 'gold-dec0028-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0028.unauthorized-reviewer',
      version: '1',
      projection: buildAvailabilityProjection(),
      disposition:
        'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
      reviewerPrincipal: unauthorizedAvailabilityReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact source authorization.',
      audit: audit(
        'evt-gold-dec0028-unauthorized-reviewer',
        unauthorizedAvailabilityReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedAvailabilityReview =
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0028.rejected',
    version: '1',
    projection: buildAvailabilityProjection(),
    disposition:
      'REJECT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks: [],
    rationale: 'Rejected review cannot authorize publication.',
    audit: audit(
      'evt-gold-dec0028-rejected-review',
      normalizationReviewer.principalId
    )
  });
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0028.rejected',
      version: '1',
      compilation:
        buildAvailabilityCompilation(
          buildAvailabilityProjection(),
          rejectedAvailabilityReview.ref
        ),
      audit: audit(
        'evt-gold-dec0028-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_REJECTED'
);

const availabilityMismatchProjection = buildAvailabilityProjection({
  rationale: 'Materially changed rationale after review.'
});
expectAvailabilityProjectionError(
  () =>
    publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0028.review-mismatch',
      version: '1',
      compilation:
        buildAvailabilityCompilation(
          availabilityMismatchProjection,
          availabilityReview.ref
        ),
      audit: audit(
        'evt-gold-dec0028-review-mismatch-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REVIEW_MISMATCH'
);

const forbiddenKinds = new Set([
  'ContextDatum',
  'ContextManifest',
  'AuthorizedContextReference',
  'ResolvedContextDatumReceipt',
  'DecisionProblem',
  'AgronomicRecordedOperationTargetIdentityBindingCompilation',
  'Policy',
  'RuntimePlan',
  'RuntimeEligibility',
  'RuntimeBinding',
  'RuntimeAlternativeSet',
  'DecisionResult',
  'ExecutionReceipt',
  'Outcome'
]);
const forbiddenRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority:
    'AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation',
  goldKind: 'PUBLIC_REAL_SOURCE_CUMULATIVE',
  parentSourceReferenceHashProjection: sourceProjectionPublished.ref,
  targetContextSemantic:
    availabilityValidated.semanticPayload.projection.targetContextSemantic,
  valueSource:
    availabilityValidated.semanticPayload.projection.valueSource,
  sourceArtifactAcquisition:
    availabilityValidated.semanticPayload.projection.sourceArtifactAcquisition,
  availableAtProjection:
    availabilityValidated.semanticPayload.projection.availableAtProjection,
  availabilityMeaning: 'ADR_EVIDENCE_ACQUISITION_AVAILABILITY',
  occurrenceDateUsedAsAvailability: false,
  effectiveTimeUsedAsAvailability: false,
  upstreamFirstPublicationClaimCreated: false,
  gitTimeAuthorityCreated: false,
  reviewPublicationTimeAuthorityCreated: false,
  genericSourceArtifactAvailabilityRuleCreated: false,
  effectiveIntervalAuthorityCreated: false,
  timezoneRuleAuthorityCreated: false,
  contextDatumAuthorityCreated: false,
  negativeCases: [
    'WRONG_PARENT_KIND_DENIED',
    'PREDECESSOR_REF_DRIFT_DENIED',
    'TARGET_SEMANTIC_VALUE_DRIFT_DENIED',
    'VALUE_SOURCE_REF_DRIFT_DENIED',
    'VALUE_SOURCE_ARTIFACT_REF_DRIFT_DENIED',
    'VALUE_SOURCE_ARTIFACT_HASH_DRIFT_DENIED',
    'PLANTING_DATE_AS_AVAILABILITY_DENIED',
    'GIT_TIME_SUBSTITUTION_DENIED',
    'REVIEW_TIME_SUBSTITUTION_DENIED',
    'ARBITRARY_AVAILABLE_AT_DENIED',
    'UPSTREAM_PUBLICATION_BASIS_DENIED',
    'EFFECTIVE_TIME_TIMEZONE_WIDENING_DENIED',
    'INCOMPLETE_REVIEW_DENIED',
    'UNAUTHORIZED_REVIEWER_DENIED',
    'REJECTED_REVIEW_DENIED',
    'REVIEW_MISMATCH_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
