import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationOccurrenceCompilationError,
  agronomicRecordedOperationEvidenceHash,
  agronomicRecordedOperationOccurrenceHash,
  extractAgronomicRecordedOperationJupyterTableRowEvidence,
  publishAgronomicRecordedOperationOccurrenceCompilation,
  publishAgronomicRecordedOperationOccurrenceReviewDecision,
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
import { audit, createEnvironment } from '../derived-knowledge/fixture.mjs';

const NOTEBOOK_URL = new URL(
  './bootstrap-isudatateam/chicago.ipynb',
  import.meta.url
);
const LICENSE_URL = new URL(
  './bootstrap-isudatateam/LICENSE',
  import.meta.url
);

const EXPECTED_NOTEBOOK_GIT_BLOB_SHA =
  '4847e7b3b4aad42193de3f5f0da6f81f6b62dc50';
const EXPECTED_LICENSE_GIT_BLOB_SHA =
  '5c60615bfae390b40fe6fa096942c65b5b074ca7';

const COORDINATES = {
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

function gitBlobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function expectError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof AgronomicRecordedOperationOccurrenceCompilationError,
    `expected AgronomicRecordedOperationOccurrenceCompilationError, got ${caught?.constructor?.name ?? 'none'}`
  );
  assert.equal(caught.code, code);
}

function reviewerAuthorization(env, source) {
  const reviewer = createPrincipal({
    principalId: 'gold-sustainable-corn-occurrence-reviewer',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.gold.sustainable-corn-occurrence-reviewer',
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-gold-occurrence-role', 'iam-admin')
  });
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: 'policy.gold.sustainable-corn-occurrence-review',
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit('evt-gold-occurrence-policy', 'iam-admin')
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
      'evt-gold-occurrence-auth',
      'iam-engine',
      'SERVICE_ACCOUNT'
    )
  });
  return { reviewer, role, policy, auth };
}

const notebookBytes = readFileSync(NOTEBOOK_URL);
const licenseBytes = readFileSync(LICENSE_URL);

assert.equal(gitBlobSha(notebookBytes), EXPECTED_NOTEBOOK_GIT_BLOB_SHA);
assert.equal(gitBlobSha(licenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);

const notebook = JSON.parse(notebookBytes.toString('utf8'));
const querySource = notebook.cells[0].source.join('');
assert.match(
  querySource,
  /SELECT uniqueid, operation, to_char\(valid, 'Mon dd,YYYY'\), cropyear, valid from operations ORDER by valid ASC/
);
assert.equal(
  notebook.cells[0].outputs[0].text.join(''),
  'Loaded 634 rows from the database!\n'
);
assert.equal(
  notebook.cells[3].source.join(''),
  "df2 = df[df.operation == 'plant_corn']\ndf2[['date', 'operation', 'siteid', 'year']]"
);

const evidence = extractAgronomicRecordedOperationJupyterTableRowEvidence({
  bytes: notebookBytes,
  coordinates: COORDINATES
});
const evidenceHash = agronomicRecordedOperationEvidenceHash(evidence);

assert.deepEqual(
  evidence.cells.map((cell) => [cell.role, cell.sourceColumn, cell.resolvedText]),
  [
    ['SOURCE_NATIVE_SUBJECT', 'siteid', 'SERF'],
    ['SOURCE_OPERATION_CODE', 'operation', 'plant_corn'],
    ['TEMPORAL_SUPPORT', 'date', '2011-05-03']
  ]
);

const env = createEnvironment();
const source = env.sourceRegistry.registerSource({
  logicalId: 'source.gold.sustainable-corn.operations-notebook',
  version: '1',
  sourceType: 'OTHER',
  title:
    'ISU Data Team Sustainable Corn persisted operations query output (bootstrap Gold)',
  ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
  originLocator:
    'https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb',
  rights: {
    artifactLicense: 'MIT',
    upstreamRepository: 'isudatateam/datateam',
    underlyingDatasetLicense: 'CC0',
    underlyingDatasetDoi: '10.15482/USDA.ADC/1411953'
  },
  metadata: {
    upstreamGitBlobSha: EXPECTED_NOTEBOOK_GIT_BLOB_SHA,
    role: 'BOOTSTRAP_REAL_SOURCE_EVENT_GOLD',
    preferredFutureArtifact:
      'Sustainable_Corn_Research_Data_2011-2015.xlsx'
  },
  audit: audit('evt-gold-occurrence-source', 'source-admin')
});

const artifact = env.sourceRegistry.materializeArtifact({
  logicalId: 'artifact.gold.sustainable-corn.operations-notebook',
  version: '1',
  sourceRef: source.ref,
  bytes: notebookBytes,
  mediaType: 'application/x-ipynb+json',
  materializationIdentity:
    `github-blob:${EXPECTED_NOTEBOOK_GIT_BLOB_SHA}`,
  acquisition: {
    method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
    acquiredAt: '2026-08-30T03:55:00.000Z',
    locator:
      'https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb'
  },
  rightsSnapshot: {
    publicAccess: true,
    artifactLicense: {
      spdx: 'MIT',
      licenseBlobSha: EXPECTED_LICENSE_GIT_BLOB_SHA,
      redistributionAllowed: true
    },
    underlyingDataset: {
      doi: '10.15482/USDA.ADC/1411953',
      figshareArticleId: '24851877',
      publicAccess: true,
      license: 'CC0',
      redistributionAllowed: true
    }
  },
  metadata: {
    upstreamGitBlobSha: EXPECTED_NOTEBOOK_GIT_BLOB_SHA,
    exactRetainedBytes: true
  },
  audit: audit('evt-gold-occurrence-artifact', 'source-admin')
});

const occurrence = {
  contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  occurrenceId: 'sustainable-corn.serf.2011-05-03.plant-corn.bootstrap',
  sourceRef: source.ref,
  sourceArtifactRef: artifact.ref,
  sourceArtifactContentHash: artifact.semanticPayload.contentHash,
  sourceLocator: {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'JUPYTER_OUTPUT_TABLE_ROW_V1',
    coordinates: COORDINATES,
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
    'Compile only the positive operation occurrence explicitly persisted in the exact public notebook output; preserve source-native operation, site identity and day precision without normalized ADR action, execution, Outcome or absence inference.'
};

const authorization = reviewerAuthorization(env, source);
const review = publishAgronomicRecordedOperationOccurrenceReviewDecision({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  logicalId: 'review.gold.sustainable-corn.recorded-occurrence',
  version: '1',
  occurrence,
  disposition: 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
  reviewerPrincipal: authorization.reviewer,
  authorizationDecisionAuditRef: authorization.auth.ref,
  confirmedChecks:
    AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
  rationale:
    'Exact upstream notebook bytes, rights snapshot and persisted operations-table row support only the positive recorded occurrence SERF / plant_corn / 2011-05-03.',
  audit: audit(
    'evt-gold-occurrence-review',
    authorization.reviewer.principalId
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
    'BOOTSTRAP_NOTEBOOK_OUTPUT_NOT_PUBLISHED_FIGSHARE_WORKBOOK',
    'RECORDED_OCCURRENCE_NOT_ADR_EXECUTION',
    'RECORDED_OCCURRENCE_NOT_OUTCOME',
    'SOURCE_NOT_ASSERTED_COMPLETE',
    'MISSING_RECORD_NOT_NONOCCURRENCE',
    'SOURCE_NATIVE_SITE_NOT_ADR_TARGET'
  ]
};

const published = publishAgronomicRecordedOperationOccurrenceCompilation({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  logicalId: 'compilation.gold.sustainable-corn.recorded-occurrence',
  version: '1',
  compilation,
  audit: audit(
    'evt-gold-occurrence-publication',
    authorization.reviewer.principalId
  )
});

const validated =
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: published.ref
  });

assert.equal(
  validated.semanticPayload.occurrence.occurrenceSemantics.sourceOperationCode,
  'plant_corn'
);
assert.deepEqual(
  validated.semanticPayload.occurrence.occurrenceSemantics.sourceNativeSubject,
  { identifiers: [{ name: 'siteid', value: 'SERF' }] }
);
assert.deepEqual(
  validated.semanticPayload.occurrence.occurrenceSemantics.temporalSupport,
  { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'DAY' }
);
assert.equal(
  validated.semanticPayload.occurrence.occurrenceSemantics.normalizedOperation,
  undefined
);
assert.equal(
  validated.semanticPayload.occurrence.sourceLocator.scheme,
  'JUPYTER_OUTPUT_TABLE_ROW_V1'
);
assert.equal(validated.replayedEvidence.rowIndex, '33');

const wrongRowOccurrence = structuredClone(occurrence);
wrongRowOccurrence.sourceLocator.coordinates.rowIndex = '32';
wrongRowOccurrence.sourceLocator.evidenceHash =
  agronomicRecordedOperationEvidenceHash(
    extractAgronomicRecordedOperationJupyterTableRowEvidence({
      bytes: notebookBytes,
      coordinates: wrongRowOccurrence.sourceLocator.coordinates
    })
  );
expectError(
  () => publishAgronomicRecordedOperationOccurrenceReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.wrong-row',
    version: '1',
    occurrence: wrongRowOccurrence,
    disposition: 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
    reviewerPrincipal: authorization.reviewer,
    authorizationDecisionAuditRef: authorization.auth.ref,
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
    rationale: 'Wrong row must not preserve SERF occurrence semantics.',
    audit: audit(
      'evt-gold-occurrence-wrong-row-review',
      authorization.reviewer.principalId
    )
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SUBJECT_EVIDENCE_MISMATCH'
);

const forgedHashOccurrence = structuredClone(occurrence);
forgedHashOccurrence.sourceLocator.evidenceHash =
  `sha256:${'f'.repeat(64)}`;
expectError(
  () => publishAgronomicRecordedOperationOccurrenceReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.forged-hash',
    version: '1',
    occurrence: forgedHashOccurrence,
    disposition: 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
    reviewerPrincipal: authorization.reviewer,
    authorizationDecisionAuditRef: authorization.auth.ref,
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
    rationale: 'Caller-supplied evidence hash cannot override exact replay.',
    audit: audit(
      'evt-gold-occurrence-forged-hash-review',
      authorization.reviewer.principalId
    )
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_EVIDENCE_INVALID'
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
  'ContextDatum'
]);
const forbiddenRecords = env.ledger.exportSnapshot().records
  .filter((record) => forbiddenKinds.has(record.ref.kind));
assert.equal(forbiddenRecords.length, 0);

console.log(JSON.stringify({
  ok: true,
  authority: 'AgronomicRecordedOperationOccurrenceCompilation',
  goldKind: 'PUBLIC_REAL_SOURCE_BOOTSTRAP',
  upstreamRepository: 'isudatateam/datateam',
  upstreamNotebookBlobSha: EXPECTED_NOTEBOOK_GIT_BLOB_SHA,
  upstreamLicenseBlobSha: EXPECTED_LICENSE_GIT_BLOB_SHA,
  datasetDoi: '10.15482/USDA.ADC/1411953',
  datasetLicense: 'CC0',
  sourceArtifactContentHash: artifact.semanticPayload.contentHash,
  evidenceHash,
  occurrence: {
    sourceOperationCode: 'plant_corn',
    sourceNativeSubject: { siteId: 'SERF' },
    temporalSupport: {
      kind: 'CALENDAR_DATE',
      date: '2011-05-03',
      precision: 'DAY'
    }
  },
  bootstrapLimitation:
    'NOTEBOOK_QUERY_OUTPUT_NOT_PUBLISHED_FIGSHARE_WORKBOOK',
  exactBlobIdentityVerified: true,
  wrongRowDenied: true,
  forgedEvidenceHashDenied: true,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
