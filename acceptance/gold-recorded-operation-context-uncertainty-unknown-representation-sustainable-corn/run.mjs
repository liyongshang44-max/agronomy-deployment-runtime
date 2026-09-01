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
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
  AgronomicContextUncertaintyUnknownRepresentationCompilationError,
  agronomicContextUncertaintyUnknownRepresentationHash,
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision,
  publishAgronomicContextUncertaintyUnknownRepresentationCompilation,
  validateAgronomicContextUncertaintyUnknownRepresentationCompilationAuthority
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

function expectUncertaintyRepresentationError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextUncertaintyUnknownRepresentationCompilationError,
      `expected DEC-0026 typed error, got ${error?.constructor?.name ?? 'none'}`
    );
    assert.equal(error.code, code);
    return true;
  });
}

function buildUncertaintyRepresentation(
  parentRef = mappingPublished.ref,
  overrides = {}
) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
    representationId:
      'representation.gold.sustainable-corn.planting-date.uncertainty-unknown',
    parentContextSemanticMappingCompilationRef: parentRef,
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    uncertaintyRepresentation: {
      type: 'UNKNOWN',
      reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
    },
    rationale:
      'The exact accepted DEC-0016 evidence establishes the planting-date value but does not establish an uncertainty characterization eligible for NONE, INTERVAL, CATEGORICAL_SET or DISTRIBUTION_REFERENCE.',
    ...overrides
  };
}

function buildUncertaintyCompilation(
  representation,
  reviewRef,
  status = 'COMPLETE'
) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_AUTHORITY',
    representation,
    representationHash:
      agronomicContextUncertaintyUnknownRepresentationHash(representation),
    uncertaintyRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'UNCERTAINTY_UNKNOWN_REPRESENTATION'
      ],
      unrepresentedElements:
        status === 'COMPLETE'
          ? []
          : ['UNRESOLVED_UNCERTAINTY_REPRESENTATION_ELEMENT']
    },
    limitations: [
      'VALUE_REMAINS_KNOWN_DATE',
      'UNKNOWN_ONLY_DESCRIBES_UNCERTAINTY_CHARACTERIZATION',
      'NO_UNCERTAINTY_NONE_AUTHORITY',
      'NO_NUMERIC_INTERVAL_AUTHORITY',
      'NO_CATEGORICAL_ALTERNATIVES_AUTHORITY',
      'NO_DISTRIBUTION_REFERENCE_AUTHORITY',
      'NO_SOURCE_GLOBAL_NOT_REPORTED_CLAIM',
      'NO_GENERIC_DATE_OR_ASSERTION_INFERENCE',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_EFFECTIVE_INTERVAL_AUTHORITY',
      'NO_AVAILABLE_AT_AUTHORITY',
      'NO_TEMPORAL_OR_TIMEZONE_MUTATION',
      'NO_SPATIAL_VERTICAL_TARGET_OR_GEOMETRY_MUTATION',
      'NO_UNIT_MUTATION',
      'NO_EPISTEMIC_PROVENANCE_SOURCE_MUTATION',
      'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY'
    ]
  };
}

const uncertaintyRepresentation = buildUncertaintyRepresentation();
const uncertaintyReview =
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-uncertainty-unknown-representation',
    version: '1',
    representation: uncertaintyRepresentation,
    disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'The exact accepted DEC-0016 evidence establishes the DATE value but no supported uncertainty characterization; UNKNOWN with the exact accepted-evidence reason code is the only authorized fail-closed representation.',
    audit: audit(
      'evt-gold-context-uncertainty-unknown-representation-review',
      normalizationReviewer.principalId
    )
  });

const uncertaintyPublished =
  publishAgronomicContextUncertaintyUnknownRepresentationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-uncertainty-unknown-representation',
    version: '1',
    compilation: buildUncertaintyCompilation(
      uncertaintyRepresentation,
      uncertaintyReview.ref
    ),
    audit: audit(
      'evt-gold-context-uncertainty-unknown-representation-publication',
      normalizationReviewer.principalId
    )
  });

const uncertaintyValidated =
  validateAgronomicContextUncertaintyUnknownRepresentationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: uncertaintyPublished.ref
  });

assert.deepEqual(
  uncertaintyValidated.semanticPayload.representation.targetContextSemantic,
  {
    semanticId: 'crop.planting_date',
    value: { type: 'DATE', date: '2011-05-03' }
  }
);
assert.deepEqual(
  uncertaintyValidated.semanticPayload.representation.uncertaintyRepresentation,
  {
    type: 'UNKNOWN',
    reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
  }
);
assert.deepEqual(
  uncertaintyValidated.contextSemanticMapping.semanticPayload.mapping
    .targetContextSemantic,
  uncertaintyValidated.semanticPayload.representation.targetContextSemantic
);

expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0026.wrong-parent-kind',
      version: '1',
      representation: buildUncertaintyRepresentation(normalizationPublished.ref),
      disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Wrong predecessor kind must fail closed.',
      audit: audit(
        'evt-gold-dec0026-wrong-parent-kind',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_AUTHORITY_REF'
);

for (const [label, targetContextSemantic] of [
  [
    'wrong-semantic',
    {
      semanticId: 'crop.harvest_date',
      value: { type: 'DATE', date: '2011-05-03' }
    }
  ],
  [
    'generic-date-type-only-inference',
    {
      semanticId: 'crop.emergence_date',
      value: { type: 'DATE', date: '2011-05-03' }
    }
  ],
  [
    'wrong-value-type',
    {
      semanticId: 'crop.planting_date',
      value: { type: 'TIMESTAMP', date: '2011-05-03' }
    }
  ],
  [
    'wrong-date',
    {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-04' }
    }
  ]
]) {
  expectUncertaintyRepresentationError(
    () =>
      publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0026.${label}`,
        version: '1',
        representation: buildUncertaintyRepresentation(mappingPublished.ref, {
          targetContextSemantic
        }),
        disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0026-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_TARGET'
  );
}

expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0026.none-inference',
      version: '1',
      representation: buildUncertaintyRepresentation(mappingPublished.ref, {
        uncertaintyRepresentation: {
          type: 'NONE',
          reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
        }
      }),
      disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'NONE cannot be inferred from one precise source date.',
      audit: audit(
        'evt-gold-dec0026-none-inference',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION'
);

for (const [label, uncertaintyRepresentation] of [
  [
    'fabricated-interval',
    {
      type: 'INTERVAL',
      lowerDecimal: '-1',
      upperDecimal: '1'
    }
  ],
  [
    'fabricated-categorical-set',
    {
      type: 'CATEGORICAL_SET',
      values: ['2011-05-02', '2011-05-03']
    }
  ],
  [
    'fabricated-distribution-reference',
    {
      type: 'DISTRIBUTION_REFERENCE',
      providerId: 'invented',
      sourceRef: 'invented'
    }
  ]
]) {
  expectUncertaintyRepresentationError(
    () =>
      publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0026.${label}`,
        version: '1',
        representation: buildUncertaintyRepresentation(mappingPublished.ref, {
          uncertaintyRepresentation
        }),
        disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0026-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_FIELD'
  );
}

for (const [label, uncertaintyRepresentation, code] of [
  [
    'wrong-reason-code',
    { type: 'UNKNOWN', reasonCode: 'NOT_REPORTED' },
    'UNSUPPORTED_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION'
  ],
  [
    'empty-reason-code',
    { type: 'UNKNOWN', reasonCode: '' },
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_INPUT'
  ],
  [
    'null-reason-code',
    { type: 'UNKNOWN', reasonCode: null },
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_INPUT'
  ],
  [
    'omitted-reason-code',
    { type: 'UNKNOWN' },
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_INPUT'
  ]
]) {
  expectUncertaintyRepresentationError(
    () =>
      publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0026.${label}`,
        version: '1',
        representation: buildUncertaintyRepresentation(mappingPublished.ref, {
          uncertaintyRepresentation
        }),
        disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0026-${label}`,
          normalizationReviewer.principalId
        )
      }),
    code
  );
}

expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0026.value-level-unknown',
      version: '1',
      representation: buildUncertaintyRepresentation(mappingPublished.ref, {
        targetContextSemantic: {
          semanticId: 'crop.planting_date',
          value: {
            type: 'UNKNOWN',
            reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
          }
        }
      }),
      disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Unknown uncertainty cannot replace the accepted DATE value.',
      audit: audit(
        'evt-gold-dec0026-value-level-unknown',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_FIELD'
);

for (const [label, field, value] of [
  ['source-global-not-reported', 'sourceUncertaintyStatus', 'NOT_REPORTED'],
  ['generic-assertion-inference', 'epistemicInferenceRule', 'ASSERTION_TO_UNKNOWN']
]) {
  expectUncertaintyRepresentationError(
    () =>
      publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: `review.gold.dec0026.${label}`,
        version: '1',
        representation: {
          ...buildUncertaintyRepresentation(),
          [field]: value
        },
        disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          parentSourceAuthorization.auth.ref,
          semanticSourceAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
        rationale: `${label} must fail closed.`,
        audit: audit(
          `evt-gold-dec0026-${label}`,
          normalizationReviewer.principalId
        )
      }),
    'INVALID_AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_FIELD'
  );
}

const predecessorRefDrift = structuredClone(mappingPublished.ref);
predecessorRefDrift.semanticHash = `sha256:${'0'.repeat(64)}`;
assert.throws(() =>
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0026.predecessor-ref-drift',
    version: '1',
    representation: buildUncertaintyRepresentation(predecessorRefDrift),
    disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact predecessor ref drift must fail closed during DEC-0016 revalidation.',
    audit: audit(
      'evt-gold-dec0026-predecessor-ref-drift',
      normalizationReviewer.principalId
    )
  })
);

const incompleteChecks =
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS
    .filter((check) => check !== 'NO_UNCERTAINTY_NONE_INFERENCE');
expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0026.incomplete-review',
      version: '1',
      representation: buildUncertaintyRepresentation(),
      disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks: incompleteChecks,
      rationale: 'Incomplete review cannot authorize unknown uncertainty representation.',
      audit: audit(
        'evt-gold-dec0026-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REVIEW_INCOMPLETE'
);

const unauthorizedUncertaintyReviewer = createPrincipal({
  principalId: 'gold-dec0026-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0026.unauthorized-reviewer',
      version: '1',
      representation: buildUncertaintyRepresentation(),
      disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
      reviewerPrincipal: unauthorizedUncertaintyReviewer,
      authorizationDecisionAuditRefs: [
        parentSourceAuthorization.auth.ref,
        semanticSourceAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
      rationale:
        'Reviewer cannot borrow another reviewer source authorizations.',
      audit: audit(
        'evt-gold-dec0026-unauthorized-reviewer',
        unauthorizedUncertaintyReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedUncertaintyReview =
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0026.rejected',
    version: '1',
    representation: buildUncertaintyRepresentation(),
    disposition: 'REJECT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected review cannot authorize publication.',
    audit: audit(
      'evt-gold-dec0026-rejected-review',
      normalizationReviewer.principalId
    )
  });
expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0026.rejected',
      version: '1',
      compilation: buildUncertaintyCompilation(
        buildUncertaintyRepresentation(),
        rejectedUncertaintyReview.ref
      ),
      audit: audit(
        'evt-gold-dec0026-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REVIEW_REJECTED'
);

const reviewMismatchRepresentation = buildUncertaintyRepresentation(
  mappingPublished.ref,
  { rationale: 'Materially different rationale after review.' }
);
expectUncertaintyRepresentationError(
  () =>
    publishAgronomicContextUncertaintyUnknownRepresentationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0026.review-mismatch',
      version: '1',
      compilation: buildUncertaintyCompilation(
        reviewMismatchRepresentation,
        uncertaintyReview.ref
      ),
      audit: audit(
        'evt-gold-dec0026-review-mismatch-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REVIEW_MISMATCH'
);

const forbiddenAfterUncertainty = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenAfterUncertainty.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicContextUncertaintyUnknownRepresentationCompilation',
  goldKind: 'PUBLIC_REAL_SOURCE_CUMULATIVE',
  parentContextSemanticMappingCompilation: mappingPublished.ref,
  targetContextSemantic:
    uncertaintyValidated.semanticPayload.representation.targetContextSemantic,
  uncertaintyRepresentation:
    uncertaintyValidated.semanticPayload.representation.uncertaintyRepresentation,
  negativeCases: [
    'WRONG_PARENT_KIND_DENIED',
    'PREDECESSOR_REF_DRIFT_DENIED',
    'WRONG_SEMANTIC_DENIED',
    'WRONG_VALUE_TYPE_DENIED',
    'WRONG_DATE_DENIED',
    'UNCERTAINTY_NONE_DENIED',
    'FABRICATED_INTERVAL_DENIED',
    'FABRICATED_CATEGORICAL_SET_DENIED',
    'FABRICATED_DISTRIBUTION_REFERENCE_DENIED',
    'WRONG_EMPTY_NULL_OMITTED_REASON_CODE_DENIED',
    'VALUE_LEVEL_UNKNOWN_DENIED',
    'GENERIC_DATE_TYPE_ONLY_INFERENCE_DENIED',
    'GENERIC_ASSERTION_INFERENCE_DENIED',
    'SOURCE_GLOBAL_NOT_REPORTED_DENIED',
    'INCOMPLETE_REVIEW_DENIED',
    'UNAUTHORIZED_REVIEWER_DENIED',
    'REJECTED_REVIEW_DENIED',
    'REVIEW_MISMATCH_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated:
    forbiddenAfterUncertainty.length
}, null, 2));
