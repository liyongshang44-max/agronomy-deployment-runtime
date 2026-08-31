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
  validateAgronomicRecordedOperationContextProvenanceClassificationCompilationAuthority
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
    'AgronomicRecordedOperationContextProvenanceClassificationCompilation',
  goldKind: 'PUBLIC_REAL_SOURCE',
  contextEpistemicClassification: epistemicPublished.ref,
  valueSource:
    provenanceValidated.semanticPayload.classification.valueSource,
  semanticInterpretationSourceRefs:
    provenanceValidated.semanticInterpretationSourceRefs,
  targetContextSemantic:
    provenanceValidated.semanticPayload.classification.targetContextSemantic,
  epistemicClass:
    provenanceValidated.semanticPayload.classification.epistemicClass,
  provenanceClass:
    provenanceValidated.semanticPayload.classification.provenanceClass,
  contextDatumSourceWireAuthorityCreated: false,
  negativeCases: [
    'NON_EXTERNAL_PROVIDER_CLASSES_DENIED',
    'SEMANTIC_SOURCE_AS_VALUE_SOURCE_DENIED',
    'SOURCE_REF_DRIFT_DENIED',
    'SOURCE_ARTIFACT_REF_DRIFT_DENIED',
    'SOURCE_ARTIFACT_CONTENT_HASH_DRIFT_DENIED',
    'TARGET_MAPPING_DRIFT_DENIED',
    'INCOMPLETE_REVIEW_DENIED',
    'UNAUTHORIZED_REVIEWER_DENIED',
    'REJECTED_REVIEW_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
