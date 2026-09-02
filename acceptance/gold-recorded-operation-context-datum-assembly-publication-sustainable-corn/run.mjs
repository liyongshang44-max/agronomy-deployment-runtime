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
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError,
  agronomicRecordedOperationContextTemporalSupportClassificationHash,
  publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision,
  publishAgronomicRecordedOperationContextTemporalSupportClassificationCompilation,
  validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_BINDING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
  agronomicRecordedOperationTargetIdentityBindingHash,
  deriveAgronomicRecordedOperationSourceBackedTargetId,
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision,
  publishAgronomicRecordedOperationTargetIdentityBindingCompilation,
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError,
  agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash,
  publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision,
  publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation,
  validateAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthority,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
  AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError,
  agronomicContextCalendarDateLocalCivilFrameBindingHash,
  publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision,
  publishAgronomicContextCalendarDateLocalCivilFrameBindingCompilation,
  validateAgronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthority,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY,
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
  AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError,
  agronomicContextHistoricalTimezoneBoundaryResolutionHash,
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision,
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation,
  validateAgronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthority,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
  agronomicRecordedOperationContextSpatialSupportClassificationHash,
  publishAgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision,
  publishAgronomicRecordedOperationContextSpatialSupportClassificationCompilation,
  validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority,
  AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
  agronomicContextNonQuantitativeUnitRepresentationHash,
  publishAgronomicContextNonQuantitativeUnitRepresentationReviewDecision,
  publishAgronomicContextNonQuantitativeUnitRepresentationCompilation,
  validateAgronomicContextNonQuantitativeUnitRepresentationCompilationAuthority,
  AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REQUIRED_REVIEW_CHECKS,
  agronomicContextVerticalSupportNonApplicabilityHash,
  publishAgronomicContextVerticalSupportNonApplicabilityReviewDecision,
  publishAgronomicContextVerticalSupportNonApplicabilityCompilation,
  validateAgronomicContextVerticalSupportNonApplicabilityCompilationAuthority,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
  agronomicContextUncertaintyUnknownRepresentationHash,
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision,
  publishAgronomicContextUncertaintyUnknownRepresentationCompilation,
  validateAgronomicContextUncertaintyUnknownRepresentationCompilationAuthority,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP,
  agronomicContextSourceAcquisitionAvailabilityProjectionHash,
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision,
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation,
  validateAgronomicContextSourceAcquisitionAvailabilityProjectionCompilationAuthority,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS,
  AgronomicContextDatumAssemblyCompilationError,
  agronomicContextDatumAssemblyHash,
  publishAgronomicContextDatumAssemblyReviewDecision,
  publishAgronomicContextDatumAssemblyCompilation,
  validateAgronomicContextDatumAssemblyCompilationAuthority,
  publishAgronomicContextDatumFromAssembly,
  validateAgronomicContextDatumAssemblyPublicationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  CONTEXT_DATUM_CONTRACT_VERSION,
  materializePublicContextDatum,
  publishContextDatum
} from '../../packages/context-contract/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import { sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
import { sourceContentHash } from '../../packages/source-registry/src/index.mjs';
import { audit, createEnvironment } from '../derived-knowledge/fixture.mjs';

const HISTORICAL_TIMEZONE_RELEASE_EVIDENCE_URL = new URL(
  '../gold-recorded-operation-context-historical-timezone-boundary-resolution-sustainable-corn/upstream/iana-tzdb-2026c-release.txt',
  import.meta.url
);
const HISTORICAL_TIMEZONE_NORTHAMERICA_RULE_EVIDENCE_URL = new URL(
  '../gold-recorded-operation-context-historical-timezone-boundary-resolution-sustainable-corn/upstream/northamerica-2026c-required-rules.txt',
  import.meta.url
);
const HISTORICAL_TIMEZONE_TRANSITION_DERIVATION_URL = new URL(
  '../gold-recorded-operation-context-historical-timezone-boundary-resolution-sustainable-corn/upstream/transition-derivation-2011.txt',
  import.meta.url
);
const historicalTimezoneRuleEvidence = Object.freeze({
  releaseEvidenceText: readFileSync(HISTORICAL_TIMEZONE_RELEASE_EVIDENCE_URL, 'utf8'),
  northamericaRuleText: readFileSync(HISTORICAL_TIMEZONE_NORTHAMERICA_RULE_EVIDENCE_URL, 'utf8'),
  transitionDerivationText: readFileSync(HISTORICAL_TIMEZONE_TRANSITION_DERIVATION_URL, 'utf8')
});

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

const IDENTITY_SOURCE_URL = new URL(
  '../gold-recorded-operation-target-identity-sustainable-corn/upstream/sites.html',
  import.meta.url
);
const IDENTITY_LICENSE_URL = new URL(
  '../gold-recorded-operation-target-identity-sustainable-corn/upstream/LICENSE',
  import.meta.url
);
const DECAGON_TIMEZONE_SOURCE_URL = new URL(
  '../gold-recorded-operation-context-source-native-timezone-identity-binding-sustainable-corn/upstream/plot_decagon.py',
  import.meta.url
);
const WATERTABLE_TIMEZONE_SOURCE_URL = new URL(
  '../gold-recorded-operation-context-source-native-timezone-identity-binding-sustainable-corn/upstream/plot_watertable.py',
  import.meta.url
);
const TIMEZONE_LICENSE_URL = new URL('../gold-recorded-operation-context-source-native-timezone-identity-binding-sustainable-corn/upstream/LICENSE', import.meta.url);

const EXPECTED_NOTEBOOK_GIT_BLOB_SHA =
  '4847e7b3b4aad42193de3f5f0da6f81f6b62dc50';
const EXPECTED_SEMANTIC_SOURCE_GIT_BLOB_SHA =
  '689a5c6c4bdc8bc242cd09673f0063fea177c6bb';
const EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA =
  '3145c0fe0099fedd1bb82e6af9e588b785234d80';
const EXPECTED_DECAGON_TIMEZONE_GIT_BLOB_SHA =
  'db36925e79a8858968ac846bb0713162372cd0ec';
const EXPECTED_WATERTABLE_TIMEZONE_GIT_BLOB_SHA =
  '9d9f7e343acfe996f155a007fd0004b60e4bd606';
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

const IDENTITY_RANGE = {
  start: 2692,
  endExclusive: 2900
};
const DECAGON_TIMEZONE_RANGE = {
  start: 1170,
  endExclusive: 1301
};
const WATERTABLE_TIMEZONE_RANGE = {
  start: 2106,
  endExclusive: 2237
};

const EXPECTED_TIMEZONE_TEXT =
  '    tzname = (\n'
  + '        "America/Chicago"\n'
  + '        if uniqueid in ["ISUAG", "SERF", "GILMORE"]\n'
  + '        else "America/New_York"\n'
  + '    )\n';

const EXPECTED_IDENTITY_TEXT =
  '\t<tr valign="top">\n'
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
  + '\t\t</td>';

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


function expectTimezoneIdentityError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof
      AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationError,
    `expected timezone identity error, got ${caught?.constructor?.name ?? 'none'}`
  );
  assert.equal(caught.code, code);
}

function buildTargetIdentitySource(env, identityBytes, identityLicenseBytes) {
  const source = env.sourceRegistry.registerSource({
    logicalId: 'source.gold.dec0022.site-identity',
    version: '1',
    sourceType: 'OTHER',
    title: 'ISU Data Team Sustainable Corn site identity table (DEC-0022 co-predecessor)',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator:
      'https://github.com/isudatateam/datateam/blob/3145c0fe0099fedd1bb82e6af9e588b785234d80/htdocs/cscap/dl/sites.html',
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam'
    },
    audit: audit('evt-gold-dec0022-target-identity-source', 'source-admin')
  });
  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: 'artifact.gold.dec0022.site-identity',
    version: '1',
    sourceRef: source.ref,
    bytes: identityBytes,
    mediaType: 'text/html',
    materializationIdentity:
      `github-blob:${EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-09-01T04:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: true,
      artifactLicense: {
        spdx: 'MIT',
        licenseBlobSha: gitBlobSha(identityLicenseBytes),
        redistributionAllowed: true
      }
    },
    audit: audit('evt-gold-dec0022-target-identity-artifact', 'source-admin')
  });
  return { source, artifact };
}

function buildTargetIdentityBinding({
  parent,
  identitySource,
  identityArtifact,
  identityBytes,
  parentOccurrenceCompilationRef = parent.published.ref
}) {
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
    bindingId: 'sustainable-corn.serf.source-backed-farm.dec0022',
    parentOccurrenceCompilationRef,
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
      'Retain exact DEC-0015 SERF/FARM identity as an explicit DEC-0022 co-predecessor; no timezone is inferred by this identity binding.'
  };
}

function buildTargetIdentityCompilation(binding, reviewRef) {
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
      'NO_INVERSE_OR_COMPLETENESS_AUTHORITY'
    ]
  };
}

function buildTimezoneEvidenceSource({
  env,
  label,
  title,
  originLocator,
  bytes,
  blobSha,
  licenseBytes
}) {
  const source = env.sourceRegistry.registerSource({
    logicalId: `source.gold.dec0022.timezone.${label}`,
    version: '1',
    sourceType: 'OTHER',
    title,
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    originLocator,
    rights: {
      artifactLicense: 'MIT',
      upstreamRepository: 'isudatateam/datateam'
    },
    audit: audit(`evt-gold-dec0022-timezone-source-${label}`, 'source-admin')
  });
  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: `artifact.gold.dec0022.timezone.${label}`,
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'text/x-python',
    materializationIdentity: `github-blob:${blobSha}`,
    acquisition: {
      method: 'REPOSITORY_RETAINED_PUBLIC_GOLD',
      acquiredAt: '2026-09-01T04:00:00.000Z'
    },
    rightsSnapshot: {
      publicAccess: true,
      artifactLicense: {
        spdx: 'MIT',
        licenseBlobSha: gitBlobSha(licenseBytes),
        redistributionAllowed: true
      }
    },
    audit: audit(`evt-gold-dec0022-timezone-artifact-${label}`, 'source-admin')
  });
  return { source, artifact };
}

function buildTimezoneBinding({
  temporalSupportCompilationRef,
  targetIdentityCompilationRef,
  decagon,
  watertable,
  decagonBytes,
  watertableBytes
}) {
  const evidenceItem = (role, sourceWorld, bytes, range) => ({
    evidenceRole: role,
    sourceRef: sourceWorld.source.ref,
    sourceArtifactRef: sourceWorld.artifact.ref,
    sourceArtifactContentHash: sourceWorld.artifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'BYTE_RANGE',
      start: range.start,
      endExclusive: range.endExclusive,
      evidenceHash:
        sourceContentHash(bytes.subarray(range.start, range.endExclusive))
    }
  });
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'sustainable-corn.serf.source-native-timezone',
    temporalSupportClassificationCompilationRef: temporalSupportCompilationRef,
    targetIdentityBindingCompilationRef: targetIdentityCompilationRef,
    sourceNativeSubject: { name: 'siteid', value: 'SERF' },
    timezoneEvidence: [
      evidenceItem(
        'DECAGON_SITE_TIMEZONE_IDENTITY',
        decagon,
        decagonBytes,
        DECAGON_TIMEZONE_RANGE
      ),
      evidenceItem(
        'WATERTABLE_SITE_TIMEZONE_IDENTITY',
        watertable,
        watertableBytes,
        WATERTABLE_TIMEZONE_RANGE
      )
    ],
    sourceTimezone: { scheme: 'IANA', zoneId: 'America/Chicago' },
    bindingRationale:
      'Two exact Sustainable Corn site-time code paths independently bind source-native siteid SERF to IANA America/Chicago; bind identity only, not offset, DST, local-civil date framing, TZDB rules or effective interval.'
  };
}

function buildTimezoneCompilation(binding, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash:
      agronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingHash(
        binding
      ),
    timezoneReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'TEMPORAL_SUPPORT_PREDECESSOR',
        'TARGET_IDENTITY_CO_PREDECESSOR',
        'CO_PREDECESSOR_CONVERGENCE',
        'SOURCE_NATIVE_SUBJECT',
        'DECAGON_TIMEZONE_EVIDENCE',
        'WATERTABLE_TIMEZONE_EVIDENCE',
        'IANA_TIMEZONE_IDENTITY'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_CALENDAR_DATE_LOCAL_FRAME_BINDING',
      'NO_UTC_OFFSET_AUTHORITY',
      'NO_DST_RESOLUTION',
      'NO_TZDB_VERSION_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL',
      'NO_AVAILABLE_AT',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_GENERIC_SITE_TIMEZONE_RULE'
    ]
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
const identityBytes = readFileSync(IDENTITY_SOURCE_URL);
const identityLicenseBytes = readFileSync(IDENTITY_LICENSE_URL);
const decagonTimezoneBytes = readFileSync(DECAGON_TIMEZONE_SOURCE_URL);
const watertableTimezoneBytes = readFileSync(WATERTABLE_TIMEZONE_SOURCE_URL);
const timezoneLicenseBytes = readFileSync(TIMEZONE_LICENSE_URL);

assert.equal(gitBlobSha(notebookBytes), EXPECTED_NOTEBOOK_GIT_BLOB_SHA);
assert.equal(
  gitBlobSha(semanticBytes),
  EXPECTED_SEMANTIC_SOURCE_GIT_BLOB_SHA
);
assert.equal(gitBlobSha(notebookLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(gitBlobSha(semanticLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(
  gitBlobSha(identityBytes),
  EXPECTED_IDENTITY_SOURCE_GIT_BLOB_SHA
);
assert.equal(gitBlobSha(identityLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(
  gitBlobSha(decagonTimezoneBytes),
  EXPECTED_DECAGON_TIMEZONE_GIT_BLOB_SHA
);
assert.equal(
  gitBlobSha(watertableTimezoneBytes),
  EXPECTED_WATERTABLE_TIMEZONE_GIT_BLOB_SHA
);
assert.equal(gitBlobSha(timezoneLicenseBytes), EXPECTED_LICENSE_GIT_BLOB_SHA);
assert.equal(
  identityBytes
    .subarray(IDENTITY_RANGE.start, IDENTITY_RANGE.endExclusive)
    .toString('utf8'),
  EXPECTED_IDENTITY_TEXT
);
assert.equal(
  decagonTimezoneBytes
    .subarray(
      DECAGON_TIMEZONE_RANGE.start,
      DECAGON_TIMEZONE_RANGE.endExclusive
    )
    .toString('utf8'),
  EXPECTED_TIMEZONE_TEXT
);
assert.equal(
  watertableTimezoneBytes
    .subarray(
      WATERTABLE_TIMEZONE_RANGE.start,
      WATERTABLE_TIMEZONE_RANGE.endExclusive
    )
    .toString('utf8'),
  EXPECTED_TIMEZONE_TEXT
);

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


function expectTemporalSupportClassificationError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(
    caught instanceof
      AgronomicRecordedOperationContextTemporalSupportClassificationCompilationError,
    `expected temporal-support classification error, got ${caught?.constructor?.name ?? 'none'}`
  );
  assert.equal(caught.code, code);
}

function buildTemporalSupportClassification(predecessorRef) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId:
      'classification.gold.sustainable-corn.context-temporal-support',
    sourceReferenceHashProjectionCompilationRef: predecessorRef,
    sourceTemporalSupport: {
      kind: 'CALENDAR_DATE',
      date: '2011-05-03',
      precision: 'DAY'
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    temporalSupport: { type: 'INTERVAL' },
    classificationRationale:
      'Exact source evidence is calendar-date DAY precision; classify support as INTERVAL without constructing timestamp bounds.'
  };
}

function buildTemporalSupportClassificationCompilation(value, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification: value,
    classificationHash:
      agronomicRecordedOperationContextTemporalSupportClassificationHash(value),
    temporalSupportReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'SOURCE_TEMPORAL_SUPPORT',
        'TARGET_TEMPORAL_SUPPORT_CLASSIFICATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_TIMEZONE_OR_OFFSET_AUTHORITY',
      'NO_EFFECTIVE_INTERVAL_CONSTRUCTION',
      'NO_AVAILABLE_AT_AUTHORITY',
      'NO_CONTEXT_DATUM_PUBLICATION',
      'NO_GENERIC_DAY_TO_INTERVAL_RULE'
    ]
  };
}

const temporalSupportClassification =
  buildTemporalSupportClassification(sourceProjectionPublished.ref);

const temporalSupportReview =
  publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.context-temporal-support-classification',
    version: '1',
    classification: temporalSupportClassification,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact DEC-0013 parent preserves CALENDAR_DATE / 2011-05-03 / DAY; INTERVAL is accepted only as support class, not as timestamp bounds.',
    audit: audit(
      'evt-gold-context-temporal-support-review',
      normalizationReviewer.principalId
    )
  });

const temporalSupportPublished =
  publishAgronomicRecordedOperationContextTemporalSupportClassificationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.context-temporal-support-classification',
    version: '1',
    compilation:
      buildTemporalSupportClassificationCompilation(
        temporalSupportClassification,
        temporalSupportReview.ref
      ),
    audit: audit(
      'evt-gold-context-temporal-support-publication',
      normalizationReviewer.principalId
    )
  });

const temporalSupportValidated =
  validateAgronomicRecordedOperationContextTemporalSupportClassificationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: temporalSupportPublished.ref
  });

assert.deepEqual(
  temporalSupportValidated.semanticPayload.classification.sourceTemporalSupport,
  { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'DAY' }
);
assert.deepEqual(
  temporalSupportValidated.semanticPayload.classification.temporalSupport,
  { type: 'INTERVAL' }
);
assert.deepEqual(
  temporalSupportValidated.semanticPayload.classification.targetContextSemantic,
  { semanticId: 'crop.planting_date', value: { type: 'DATE', date: '2011-05-03' } }
);
assert.ok(
  temporalSupportValidated.semanticPayload.classification
    .sourceReferenceHashProjectionCompilationRef.semanticHash
    === sourceProjectionPublished.ref.semanticHash
);

for (const sourceTemporalSupport of [
  { kind: 'TIMESTAMP', date: '2011-05-03', precision: 'DAY' },
  { kind: 'CALENDAR_DATE', date: '2011-05-04', precision: 'DAY' },
  { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'SECOND' }
]) {
  const drift = structuredClone(temporalSupportClassification);
  drift.sourceTemporalSupport = sourceTemporalSupport;
  expectTemporalSupportClassificationError(
    () =>
      publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: 'review.gold.context-temporal-support.source-drift',
        version: '1',
        classification: drift,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale: 'Source temporal drift must fail closed.',
        audit: audit(
          'evt-gold-context-temporal-support-source-drift',
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_SOURCE'
  );
}

for (const type of ['INSTANT', 'POINT', 'TIMESTAMP', 'DAY', 'CALENDAR_DAY', 'UNKNOWN']) {
  const drift = structuredClone(temporalSupportClassification);
  drift.temporalSupport.type = type;
  expectTemporalSupportClassificationError(
    () =>
      publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: 'review.gold.context-temporal-support.type-drift',
        version: '1',
        classification: drift,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale: 'Unsupported support class must fail closed.',
        audit: audit(
          'evt-gold-context-temporal-support-type-drift',
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_TYPE'
  );
}

for (const [key, value] of [
  ['timezone', 'America/Chicago'],
  ['effectiveInterval', {
    start: '2011-05-03T05:00:00Z',
    end: '2011-05-04T05:00:00Z'
  }],
  ['availableAt', '2011-05-03T05:00:00Z']
]) {
  expectTemporalSupportClassificationError(
    () =>
      publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: 'review.gold.context-temporal-support.widening',
        version: '1',
        classification: {
          ...structuredClone(temporalSupportClassification),
          [key]: value
        },
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
        rationale: 'Timestamp/timezone widening must fail closed.',
        audit: audit(
          'evt-gold-context-temporal-support-widening',
          normalizationReviewer.principalId
        )
      }),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_FIELD'
  );
}

expectTemporalSupportClassificationError(
  () =>
    publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-temporal-support.incomplete',
      version: '1',
      classification: temporalSupportClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_EFFECTIVE_INTERVAL_CONSTRUCTION'),
      rationale: 'Incomplete review cannot authorize publication.',
      audit: audit(
        'evt-gold-context-temporal-support-incomplete',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_INCOMPLETE'
);

const unauthorizedTemporalSupportReviewer = createPrincipal({
  principalId: 'gold-context-temporal-support-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectTemporalSupportClassificationError(
  () =>
    publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.context-temporal-support.unauthorized',
      version: '1',
      classification: temporalSupportClassification,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
      reviewerPrincipal: unauthorizedTemporalSupportReviewer,
      authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow source inspection authority.',
      audit: audit(
        'evt-gold-context-temporal-support-unauthorized',
        unauthorizedTemporalSupportReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedTemporalSupportReview =
  publishAgronomicRecordedOperationContextTemporalSupportClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.context-temporal-support.rejected',
    version: '1',
    classification: temporalSupportClassification,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks: [],
    rationale: 'Rejected temporal-support classification cannot authorize publication.',
    audit: audit(
      'evt-gold-context-temporal-support-rejected',
      normalizationReviewer.principalId
    )
  });

expectTemporalSupportClassificationError(
  () =>
    publishAgronomicRecordedOperationContextTemporalSupportClassificationCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.context-temporal-support.rejected',
      version: '1',
      compilation:
        buildTemporalSupportClassificationCompilation(
          temporalSupportClassification,
          rejectedTemporalSupportReview.ref
        ),
      audit: audit(
        'evt-gold-context-temporal-support-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_TEMPORAL_SUPPORT_CLASSIFICATION_REVIEW_REJECTED'
);


const targetIdentitySource = buildTargetIdentitySource(
  env,
  identityBytes,
  identityLicenseBytes
);
const targetIdentityBinding = buildTargetIdentityBinding({
  parent,
  identitySource: targetIdentitySource.source,
  identityArtifact: targetIdentitySource.artifact,
  identityBytes
});
const targetIdentityAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: targetIdentitySource.source,
    label: 'dec0022-target-identity-source'
  });
const targetIdentityReview =
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0022.target-identity-co-predecessor',
    version: '1',
    binding: targetIdentityBinding,
    disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      targetIdentityAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact DEC-0015 branch binds the same DEC-0013 parent occurrence siteid=SERF to source-backed FARM identity, independently of DEC-0021.',
    audit: audit(
      'evt-gold-dec0022-target-identity-review',
      normalizationReviewer.principalId
    )
  });
const targetIdentityPublished =
  publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0022.target-identity-co-predecessor',
    version: '1',
    compilation:
      buildTargetIdentityCompilation(
        targetIdentityBinding,
        targetIdentityReview.ref
      ),
    audit: audit(
      'evt-gold-dec0022-target-identity-publication',
      normalizationReviewer.principalId
    )
  });
const targetIdentityValidated =
  validateAgronomicRecordedOperationTargetIdentityBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: targetIdentityPublished.ref
  });

assert.equal(
  targetIdentityValidated.semanticPayload.binding
    .sourceBackedTargetIdentity.granularity,
  'FARM'
);
assert.deepEqual(
  targetIdentityValidated.semanticPayload.binding.sourceNativeSubject,
  { name: 'siteid', value: 'SERF' }
);
assert.deepEqual(
  targetIdentityValidated.parentOccurrence.record.ref,
  temporalSupportValidated.parentOccurrence.record.ref
);

const decagonTimezoneSource = buildTimezoneEvidenceSource({
  env,
  label: 'decagon',
  title: 'ISU Data Team Sustainable Corn Decagon site-time handling',
  originLocator:
    'https://github.com/isudatateam/datateam/blob/db36925e79a8858968ac846bb0713162372cd0ec/src/isudatateam/cscap/plot_decagon.py',
  bytes: decagonTimezoneBytes,
  blobSha: EXPECTED_DECAGON_TIMEZONE_GIT_BLOB_SHA,
  licenseBytes: timezoneLicenseBytes
});
const watertableTimezoneSource = buildTimezoneEvidenceSource({
  env,
  label: 'watertable',
  title: 'ISU Data Team Sustainable Corn water-table site-time handling',
  originLocator:
    'https://github.com/isudatateam/datateam/blob/9d9f7e343acfe996f155a007fd0004b60e4bd606/src/isudatateam/cscap/plot_watertable.py',
  bytes: watertableTimezoneBytes,
  blobSha: EXPECTED_WATERTABLE_TIMEZONE_GIT_BLOB_SHA,
  licenseBytes: timezoneLicenseBytes
});
const decagonTimezoneAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: decagonTimezoneSource.source,
    label: 'dec0022-timezone-decagon'
  });
const watertableTimezoneAuthorization =
  publishSourceInspectionAuthorization({
    env,
    reviewer: normalizationReviewer,
    role: normalizationRole,
    source: watertableTimezoneSource.source,
    label: 'dec0022-timezone-watertable'
  });

const timezoneBinding = buildTimezoneBinding({
  temporalSupportCompilationRef: temporalSupportPublished.ref,
  targetIdentityCompilationRef: targetIdentityPublished.ref,
  decagon: decagonTimezoneSource,
  watertable: watertableTimezoneSource,
  decagonBytes: decagonTimezoneBytes,
  watertableBytes: watertableTimezoneBytes
});

const timezoneReview =
  publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.sustainable-corn.source-native-timezone',
    version: '1',
    binding: timezoneBinding,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      decagonTimezoneAuthorization.auth.ref,
      watertableTimezoneAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Exact DEC-0021 and DEC-0015 co-predecessors converge on one DEC-0013 SERF occurrence; two exact retained source-code paths identify SERF with IANA America/Chicago.',
    audit: audit(
      'evt-gold-dec0022-timezone-review',
      normalizationReviewer.principalId
    )
  });

const timezonePublished =
  publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.sustainable-corn.source-native-timezone',
    version: '1',
    compilation: buildTimezoneCompilation(timezoneBinding, timezoneReview.ref),
    audit: audit(
      'evt-gold-dec0022-timezone-publication',
      normalizationReviewer.principalId
    )
  });

const timezoneValidated =
  validateAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: timezonePublished.ref
  });

assert.deepEqual(
  timezoneValidated.semanticPayload.binding.sourceNativeSubject,
  { name: 'siteid', value: 'SERF' }
);
assert.deepEqual(
  timezoneValidated.semanticPayload.binding.sourceTimezone,
  { scheme: 'IANA', zoneId: 'America/Chicago' }
);
assert.deepEqual(
  timezoneValidated.replayedEvidence.map((item) => item.evidenceRole),
  ['DECAGON_SITE_TIMEZONE_IDENTITY', 'WATERTABLE_SITE_TIMEZONE_IDENTITY']
);
for (const evidence of timezoneValidated.replayedEvidence) {
  assert.equal(evidence.text, EXPECTED_TIMEZONE_TEXT);
}
assert.deepEqual(
  timezoneValidated.parentOccurrence.record.ref,
  temporalSupportValidated.parentOccurrence.record.ref
);
assert.deepEqual(
  timezoneValidated.parentOccurrence.record.ref,
  targetIdentityValidated.parentOccurrence.record.ref
);

for (const sourceTimezone of [
  { scheme: 'IANA', zoneId: 'America/New_York' },
  { scheme: 'IANA', zoneId: 'US/Central' },
  { scheme: 'DISPLAY', zoneId: 'Central Time' },
  { scheme: 'ABBREVIATION', zoneId: 'CST' },
  { scheme: 'ABBREVIATION', zoneId: 'CDT' },
  { scheme: 'UTC_OFFSET', zoneId: '-05:00' },
  { scheme: 'UTC_OFFSET', zoneId: '-06:00' }
]) {
  const drift = structuredClone(timezoneBinding);
  drift.sourceTimezone = sourceTimezone;
  expectTimezoneIdentityError(
    () =>
      publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: 'review.gold.dec0022.timezone-identity-drift',
        version: '1',
        binding: drift,
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          decagonTimezoneAuthorization.auth.ref,
          watertableTimezoneAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
        rationale: 'Alias, offset or alternate zone identity must fail closed.',
        audit: audit(
          'evt-gold-dec0022-timezone-identity-drift',
          normalizationReviewer.principalId
        )
      }),
    'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY'
  );
}

const timezoneSubjectDrift = structuredClone(timezoneBinding);
timezoneSubjectDrift.sourceNativeSubject.value = 'ISUAG';
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.timezone-subject-drift',
      version: '1',
      binding: timezoneSubjectDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Subject drift must fail closed.',
      audit: audit(
        'evt-gold-dec0022-timezone-subject-drift',
        normalizationReviewer.principalId
      )
    }),
  'UNSUPPORTED_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_SUBJECT'
);

const timezoneEvidenceRangeDrift = structuredClone(timezoneBinding);
timezoneEvidenceRangeDrift.timezoneEvidence[0].sourceLocator.start += 1;
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.timezone-range-drift',
      version: '1',
      binding: timezoneEvidenceRangeDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Evidence range drift must fail exact source replay.',
      audit: audit(
        'evt-gold-dec0022-timezone-range-drift',
        normalizationReviewer.principalId
      )
    }),
  'SOURCE_NATIVE_TIMEZONE_IDENTITY_BYTE_RANGE_MISMATCH'
);

const timezoneEvidenceHashDrift = structuredClone(timezoneBinding);
timezoneEvidenceHashDrift.timezoneEvidence[0].sourceLocator.evidenceHash =
  `sha256:${'f'.repeat(64)}`;
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.timezone-evidence-hash-drift',
      version: '1',
      binding: timezoneEvidenceHashDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Evidence hash drift must fail exact source replay.',
      audit: audit(
        'evt-gold-dec0022-timezone-evidence-hash-drift',
        normalizationReviewer.principalId
      )
    }),
  'SOURCE_NATIVE_TIMEZONE_IDENTITY_EVIDENCE_HASH_MISMATCH'
);

const originalParentReview = env.ledger.resolve(
  parent.published.semanticPayload.semanticReviewRef
);
const originalParentReviewer =
  originalParentReview.semanticPayload.reviewerPrincipal;
const alternateParentPublished =
  publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0022.alternate-parent-occurrence',
    version: '1',
    compilation: parent.published.semanticPayload,
    audit: audit(
      'evt-gold-dec0022-alternate-parent-publication',
      originalParentReviewer.principalId,
      originalParentReviewer.type
    )
  });
const alternateTargetIdentityBinding = buildTargetIdentityBinding({
  parent,
  identitySource: targetIdentitySource.source,
  identityArtifact: targetIdentitySource.artifact,
  identityBytes,
  parentOccurrenceCompilationRef: alternateParentPublished.ref
});
const alternateTargetIdentityReview =
  publishAgronomicRecordedOperationTargetIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0022.alternate-target-identity',
    version: '1',
    binding: alternateTargetIdentityBinding,
    disposition: 'ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      targetIdentityAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_TARGET_IDENTITY_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Construct a valid independently published target-identity branch over a different occurrence authority ref for negative co-predecessor convergence testing.',
    audit: audit(
      'evt-gold-dec0022-alternate-target-identity-review',
      normalizationReviewer.principalId
    )
  });
const alternateTargetIdentityPublished =
  publishAgronomicRecordedOperationTargetIdentityBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0022.alternate-target-identity',
    version: '1',
    compilation:
      buildTargetIdentityCompilation(
        alternateTargetIdentityBinding,
        alternateTargetIdentityReview.ref
      ),
    audit: audit(
      'evt-gold-dec0022-alternate-target-identity-publication',
      normalizationReviewer.principalId
    )
  });
const coPredecessorDrift = structuredClone(timezoneBinding);
coPredecessorDrift.targetIdentityBindingCompilationRef =
  alternateTargetIdentityPublished.ref;
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.co-predecessor-drift',
      version: '1',
      binding: coPredecessorDrift,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Different exact DEC-0013 parent authority refs must fail co-predecessor convergence.',
      audit: audit(
        'evt-gold-dec0022-co-predecessor-drift',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_CO_PREDECESSOR_PARENT_MISMATCH'
);

for (const [key, value] of [
  ['utcOffset', '-05:00'],
  ['dstState', 'DAYLIGHT'],
  ['tzdbVersion', '2026a'],
  ['calendarDateFrame', 'LOCAL_CIVIL_DAY'],
  ['effectiveInterval', {
    start: '2011-05-03T05:00:00Z',
    end: '2011-05-04T05:00:00Z'
  }],
  ['availableAt', '2011-05-03T05:00:00Z']
]) {
  expectTimezoneIdentityError(
    () =>
      publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
        ledger: env.ledger,
        sourceRegistry: env.sourceRegistry,
        logicalId: 'review.gold.dec0022.forbidden-widening',
        version: '1',
        binding: {
          ...structuredClone(timezoneBinding),
          [key]: value
        },
        disposition:
          'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
        reviewerPrincipal: normalizationReviewer,
        authorizationDecisionAuditRefs: [
          decagonTimezoneAuthorization.auth.ref,
          watertableTimezoneAuthorization.auth.ref
        ],
        confirmedChecks:
          AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
        rationale: 'Offset/DST/TZDB/local-frame/effective-time widening must fail closed.',
        audit: audit(
          'evt-gold-dec0022-forbidden-widening',
          normalizationReviewer.principalId
        )
      }),
    'INVALID_AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_FIELD'
  );
}

expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.incomplete-review',
      version: '1',
      binding: timezoneBinding,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS
          .filter((item) => item !== 'NO_TZDB_VERSION_AUTHORITY'),
      rationale: 'Incomplete timezone review cannot authorize publication.',
      audit: audit(
        'evt-gold-dec0022-incomplete-review',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_INCOMPLETE'
);

const unauthorizedTimezoneReviewer = createPrincipal({
  principalId: 'gold-dec0022-timezone-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0022.unauthorized',
      version: '1',
      binding: timezoneBinding,
      disposition:
        'ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
      reviewerPrincipal: unauthorizedTimezoneReviewer,
      authorizationDecisionAuditRefs: [
        decagonTimezoneAuthorization.auth.ref,
        watertableTimezoneAuthorization.auth.ref
      ],
      confirmedChecks:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Another reviewer cannot borrow exact timezone source authorizations.',
      audit: audit(
        'evt-gold-dec0022-unauthorized',
        unauthorizedTimezoneReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_AUTHORIZATION_INVALID'
);

const rejectedTimezoneReview =
  publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0022.rejected',
    version: '1',
    binding: timezoneBinding,
    disposition:
      'REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      decagonTimezoneAuthorization.auth.ref,
      watertableTimezoneAuthorization.auth.ref
    ],
    confirmedChecks: [],
    rationale: 'Rejected timezone identity review cannot authorize publication.',
    audit: audit(
      'evt-gold-dec0022-rejected-review',
      normalizationReviewer.principalId
    )
  });
expectTimezoneIdentityError(
  () =>
    publishAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'compilation.gold.dec0022.rejected',
      version: '1',
      compilation:
        buildTimezoneCompilation(timezoneBinding, rejectedTimezoneReview.ref),
      audit: audit(
        'evt-gold-dec0022-rejected-publication',
        normalizationReviewer.principalId
      )
    }),
  'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING_REVIEW_REJECTED'
);

function expectLocalCivilFrameError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError,
      `expected DEC-0029 typed error, got ${error?.constructor?.name ?? 'none'}`
    );
    assert.equal(error.code, code);
    return true;
  });
}

function buildLocalCivilFrameBinding(overrides = {}) {
  const temporal =
    timezoneValidated.temporalSupportClassification.semanticPayload.classification;
  const occurrence =
    timezoneValidated.parentOccurrence.semanticPayload.occurrence;
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_CONTRACT_VERSION,
    bindingId:
      'binding.gold.sustainable-corn.calendar-date-local-civil-frame',
    parentSourceNativeTimezoneIdentityBindingCompilationRef: timezonePublished.ref,
    targetContextSemantic:
      structuredClone(temporal.targetContextSemantic),
    sourceTemporalDescriptor:
      structuredClone(occurrence.occurrenceSemantics.temporalSupport),
    sourceNativeSubject:
      structuredClone(timezoneValidated.semanticPayload.binding.sourceNativeSubject),
    sourceTimezone:
      structuredClone(timezoneValidated.semanticPayload.binding.sourceTimezone),
    temporalFrame: {
      kind: 'LOCAL_CIVIL_DAY',
      civilDate: '2011-05-03',
      zoneScheme: 'IANA',
      zoneId: 'America/Chicago'
    },
    interpretationClass:
      AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS,
    rationale:
      'Explicit ADR-governed join of the exact CALENDAR_DATE/DAY source fact and exact DEC-0022 source-native timezone identity; upstream operations.valid does not itself declare this frame.',
    ...overrides
  };
}

function buildLocalCivilFrameCompilation(binding, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_AUTHORITY',
    binding,
    bindingHash: agronomicContextCalendarDateLocalCivilFrameBindingHash(binding),
    frameReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'SOURCE_CALENDAR_DATE',
        'SOURCE_DAY_PRECISION',
        'SOURCE_NATIVE_SUBJECT',
        'SOURCE_NATIVE_TIMEZONE_IDENTITY',
        'LOCAL_CIVIL_DAY_FRAME',
        'ADR_GOVERNED_INTERPRETATION_CLASS'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_LOCAL_CIVIL_FRAME_ELEMENT']
    },
    limitations: [
      'ADR_INTERPRETATION_NOT_UPSTREAM_SOURCE_DECLARATION',
      'NO_UTC_OFFSET',
      'NO_DST_RESOLUTION',
      'NO_TZDB_VERSION',
      'NO_EFFECTIVE_INTERVAL_BOUNDARIES',
      'NO_AVAILABLE_AT_MUTATION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ]
  };
}

const localCivilFrameBinding = buildLocalCivilFrameBinding();
const localCivilFrameAuthorizations = [
  parentSourceAuthorization.auth.ref,
  targetIdentityAuthorization.auth.ref,
  decagonTimezoneAuthorization.auth.ref,
  watertableTimezoneAuthorization.auth.ref
];
const localCivilFrameReview =
  publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.calendar-date-local-civil-frame',
    version: '1',
    binding: localCivilFrameBinding,
    disposition:
      'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Accept the exact first local-civil-day frame only as an ADR-governed interpretation over exact DEC-0022 predecessor authority.',
    audit: audit(
      'evt-gold-dec0029-local-civil-frame-review',
      normalizationReviewer.principalId
    )
  });

const localCivilFramePublished =
  publishAgronomicContextCalendarDateLocalCivilFrameBindingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.calendar-date-local-civil-frame',
    version: '1',
    compilation:
      buildLocalCivilFrameCompilation(
        localCivilFrameBinding,
        localCivilFrameReview.ref
      ),
    audit: audit(
      'evt-gold-dec0029-local-civil-frame-publication',
      normalizationReviewer.principalId
    )
  });

const localCivilFrameValidated =
  validateAgronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: localCivilFramePublished.ref
  });

assert.deepEqual(
  localCivilFrameValidated.semanticPayload.binding.targetContextSemantic,
  { semanticId: 'crop.planting_date', value: { type: 'DATE', date: '2011-05-03' } }
);
assert.deepEqual(
  localCivilFrameValidated.semanticPayload.binding.sourceTemporalDescriptor,
  { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'DAY' }
);
assert.deepEqual(
  localCivilFrameValidated.semanticPayload.binding.sourceNativeSubject,
  { name: 'siteid', value: 'SERF' }
);
assert.deepEqual(
  localCivilFrameValidated.semanticPayload.binding.sourceTimezone,
  { scheme: 'IANA', zoneId: 'America/Chicago' }
);
assert.deepEqual(
  localCivilFrameValidated.semanticPayload.binding.temporalFrame,
  {
    kind: 'LOCAL_CIVIL_DAY',
    civilDate: '2011-05-03',
    zoneScheme: 'IANA',
    zoneId: 'America/Chicago'
  }
);
assert.equal(
  localCivilFrameValidated.semanticPayload.binding.interpretationClass,
  'ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING'
);

expectLocalCivilFrameError(
  () =>
    publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0029.wrong-parent-kind',
      version: '1',
      binding: buildLocalCivilFrameBinding({
        parentSourceNativeTimezoneIdentityBindingCompilationRef:
          temporalSupportPublished.ref
      }),
      disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks:
        AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Wrong predecessor kind must fail closed.',
      audit: audit(
        'evt-gold-dec0029-wrong-parent-kind',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_AUTHORITY_REF'
);

const localCivilPredecessorDrift = structuredClone(timezonePublished.ref);
localCivilPredecessorDrift.semanticHash = `sha256:${'0'.repeat(64)}`;
assert.throws(() =>
  publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.predecessor-ref-drift',
    version: '1',
    binding: buildLocalCivilFrameBinding({
      parentSourceNativeTimezoneIdentityBindingCompilationRef:
        localCivilPredecessorDrift
    }),
    disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale: 'Predecessor ref drift must fail closed.',
    audit: audit(
      'evt-gold-dec0029-predecessor-ref-drift',
      normalizationReviewer.principalId
    )
  })
);

for (const [label, targetContextSemantic] of [
  ['semantic', { semanticId: 'crop.emergence_date', value: { type: 'DATE', date: '2011-05-03' } }],
  ['date', { semanticId: 'crop.planting_date', value: { type: 'DATE', date: '2011-05-04' } }]
]) {
  expectLocalCivilFrameError(
    () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
      ledger: env.ledger, sourceRegistry: env.sourceRegistry,
      logicalId: `review.gold.dec0029.target-drift-${label}`, version: '1',
      binding: buildLocalCivilFrameBinding({ targetContextSemantic }),
      disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Target semantic/value drift must fail closed.',
      audit: audit(`evt-gold-dec0029-target-drift-${label}`, normalizationReviewer.principalId)
    }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_TARGET'
  );
}

for (const [label, sourceTemporalDescriptor] of [
  ['source-date', { kind: 'CALENDAR_DATE', date: '2011-05-04', precision: 'DAY' }],
  ['precision', { kind: 'CALENDAR_DATE', date: '2011-05-03', precision: 'SECOND' }]
]) {
  expectLocalCivilFrameError(
    () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
      ledger: env.ledger, sourceRegistry: env.sourceRegistry,
      logicalId: `review.gold.dec0029.source-temporal-drift-${label}`, version: '1',
      binding: buildLocalCivilFrameBinding({ sourceTemporalDescriptor }),
      disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Source date/precision drift must fail closed.',
      audit: audit(`evt-gold-dec0029-source-temporal-drift-${label}`, normalizationReviewer.principalId)
    }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_SOURCE_TEMPORAL_DESCRIPTOR'
  );
}

expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.subject-drift', version: '1',
    binding: buildLocalCivilFrameBinding({ sourceNativeSubject: { name: 'siteid', value: 'NWREC' } }),
    disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale: 'Subject drift must fail closed.',
    audit: audit('evt-gold-dec0029-subject-drift', normalizationReviewer.principalId)
  }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_SUBJECT'
);

for (const [label, sourceTimezone] of [
  ['zone', { scheme: 'IANA', zoneId: 'America/New_York' }],
  ['offset-as-zone', { scheme: 'OFFSET', zoneId: '-05:00' }]
]) {
  expectLocalCivilFrameError(
    () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
      ledger: env.ledger, sourceRegistry: env.sourceRegistry,
      logicalId: `review.gold.dec0029.timezone-drift-${label}`, version: '1',
      binding: buildLocalCivilFrameBinding({ sourceTimezone }),
      disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Timezone drift must fail closed.',
      audit: audit(`evt-gold-dec0029-timezone-drift-${label}`, normalizationReviewer.principalId)
    }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_TIMEZONE'
  );
}

expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.upstream-claim', version: '1',
    binding: buildLocalCivilFrameBinding({ interpretationClass: 'UPSTREAM_SOURCE_DECLARED_FRAME' }),
    disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale: 'Upstream declaration substitution must fail closed.',
    audit: audit('evt-gold-dec0029-upstream-claim', normalizationReviewer.principalId)
  }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS'
);

for (const [key, value] of [
  ['utcOffset', '-05:00'],
  ['dstState', 'DAYLIGHT'],
  ['tzdbVersion', '2026a'],
  ['effectiveInterval', { start: '2011-05-03T05:00:00Z', end: '2011-05-04T05:00:00Z' }],
  ['availableAt', '2026-08-30T13:00:00.000Z'],
  ['genericDateRule', 'DATE_USES_SOURCE_TIMEZONE'],
  ['providerGlobalRule', true],
  ['geographicTimezoneInference', 'Iowa'],
  ['contextDatumRef', 'CD-1'],
  ['contextManifestRef', 'CM-1'],
  ['decisionProblemRef', 'DP-1']
]) {
  expectLocalCivilFrameError(
    () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
      ledger: env.ledger, sourceRegistry: env.sourceRegistry,
      logicalId: `review.gold.dec0029.forbidden-${key}`, version: '1',
      binding: { ...buildLocalCivilFrameBinding(), [key]: value },
      disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
      rationale: 'Forbidden temporal/downstream widening must fail closed.',
      audit: audit(`evt-gold-dec0029-forbidden-${key}`, normalizationReviewer.principalId)
    }),
    'INVALID_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_FIELD'
  );
}

const localCivilIncompleteChecks =
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS
    .filter((x) => x !== 'ADR_INTERPRETATION_NOT_UPSTREAM_SOURCE_CLAIM');
expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.incomplete', version: '1',
    binding: buildLocalCivilFrameBinding(),
    disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: localCivilIncompleteChecks,
    rationale: 'Incomplete review must fail closed.',
    audit: audit('evt-gold-dec0029-incomplete', normalizationReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_INCOMPLETE'
);

const localCivilUnauthorizedReviewer = createPrincipal({
  principalId: 'gold-dec0029-unauthorized-reviewer',
  type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a'
});
expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.unauthorized', version: '1',
    binding: buildLocalCivilFrameBinding(),
    disposition: 'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: localCivilUnauthorizedReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS,
    rationale: 'Another reviewer cannot borrow predecessor source authorizations.',
    audit: audit('evt-gold-dec0029-unauthorized', localCivilUnauthorizedReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORIZATION_INVALID'
);

const localCivilRejectedReview =
  publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0029.rejected', version: '1',
    binding: buildLocalCivilFrameBinding(),
    disposition: 'REJECT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: [],
    rationale: 'Rejected review cannot authorize publication.',
    audit: audit('evt-gold-dec0029-rejected-review', normalizationReviewer.principalId)
  });
expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingCompilation({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0029.rejected', version: '1',
    compilation: buildLocalCivilFrameCompilation(buildLocalCivilFrameBinding(), localCivilRejectedReview.ref),
    audit: audit('evt-gold-dec0029-rejected-publication', normalizationReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_REJECTED'
);

const localCivilMismatchBinding = buildLocalCivilFrameBinding({
  rationale: 'Materially different rationale after review.'
});
expectLocalCivilFrameError(
  () => publishAgronomicContextCalendarDateLocalCivilFrameBindingCompilation({
    ledger: env.ledger, sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0029.review-mismatch', version: '1',
    compilation: buildLocalCivilFrameCompilation(localCivilMismatchBinding, localCivilFrameReview.ref),
    audit: audit('evt-gold-dec0029-review-mismatch', normalizationReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_MISMATCH'
);


function expectHistoricalTimezoneBoundaryError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof AgronomicContextHistoricalTimezoneBoundaryResolutionCompilationError,
      `expected DEC-0030 typed error, got ${error?.constructor?.name ?? 'none'}`
    );
    assert.equal(error.code, code);
    return true;
  });
}

function buildHistoricalTimezoneResolution(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_CONTRACT_VERSION,
    resolutionId:
      'resolution.gold.sustainable-corn.historical-timezone-boundary',
    parentCalendarDateLocalCivilFrameBindingCompilationRef:
      localCivilFramePublished.ref,
    targetContextSemantic:
      structuredClone(localCivilFrameValidated.semanticPayload.binding.targetContextSemantic),
    localCivilFrame:
      structuredClone(localCivilFrameValidated.semanticPayload.binding.temporalFrame),
    timezoneRuleAuthority:
      structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
    historicalResolution: {
      springTransitionDate: '2011-03-13',
      fallTransitionDate: '2011-11-06',
      baseOffset: '-06:00',
      daylightSave: '+01:00',
      effectiveOffset: '-05:00',
      dstState: 'DAYLIGHT'
    },
    localBoundaryProjection: {
      start: '2011-05-03T00:00:00-05:00',
      end: '2011-05-04T00:00:00-05:00'
    },
    effectiveInterval: {
      start: '2011-05-03T05:00:00.000Z',
      end: '2011-05-04T05:00:00.000Z'
    },
    rationale:
      'Exact retained IANA tzdb 2026c rule replay for the finite DEC-0029 LOCAL_CIVIL_DAY world; no host timezone authority.',
    ...overrides
  };
}

function buildHistoricalTimezoneCompilation(resolution, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_COMPILATION_AUTHORITY',
    resolution,
    resolutionHash:
      agronomicContextHistoricalTimezoneBoundaryResolutionHash(resolution),
    boundaryReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'DEC_0029_LOCAL_CIVIL_DAY',
        'IANA_TZDB_2026C_RULE_AUTHORITY',
        '2011_DST_TRANSITIONS',
        'EFFECTIVE_OFFSET',
        'LOCAL_BOUNDARIES',
        'CANONICAL_UTC_EFFECTIVE_INTERVAL'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_HISTORICAL_TIMEZONE_BOUNDARY_ELEMENT']
    },
    limitations: [
      'NO_GENERIC_TIMEZONE_ENGINE',
      'NO_HOST_TIMEZONE_AUTHORITY',
      'NO_MUTABLE_LATEST_ALIAS',
      'NO_INTERVAL_CLOSURE_POLICY',
      'NO_AVAILABLE_AT_MUTATION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ]
  };
}

const historicalTimezoneResolution = buildHistoricalTimezoneResolution();
const historicalTimezoneReview =
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'review.gold.sustainable-corn.historical-timezone-boundary',
    version: '1',
    resolution: historicalTimezoneResolution,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition:
      'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Accept only the exact DEC-0029 local civil day resolved through exact retained IANA tzdb 2026c evidence.',
    audit: audit(
      'evt-gold-dec0030-historical-timezone-review',
      normalizationReviewer.principalId
    )
  });

const historicalTimezonePublished =
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId:
      'compilation.gold.sustainable-corn.historical-timezone-boundary',
    version: '1',
    compilation:
      buildHistoricalTimezoneCompilation(
        historicalTimezoneResolution,
        historicalTimezoneReview.ref
      ),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    audit: audit(
      'evt-gold-dec0030-historical-timezone-publication',
      normalizationReviewer.principalId
    )
  });

const historicalTimezoneValidated =
  validateAgronomicContextHistoricalTimezoneBoundaryResolutionCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: historicalTimezonePublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence
  });

assert.equal(
  historicalTimezoneValidated.semanticPayload.resolution.timezoneRuleAuthority.release,
  '2026c'
);
assert.equal(
  historicalTimezoneValidated.semanticPayload.resolution.historicalResolution.effectiveOffset,
  '-05:00'
);
assert.equal(
  historicalTimezoneValidated.semanticPayload.resolution.historicalResolution.dstState,
  'DAYLIGHT'
);
assert.deepEqual(
  historicalTimezoneValidated.semanticPayload.resolution.effectiveInterval,
  {
    start: '2011-05-03T05:00:00.000Z',
    end: '2011-05-04T05:00:00.000Z'
  }
);

expectHistoricalTimezoneBoundaryError(
  () =>
    publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0030.wrong-parent-kind',
      version: '1',
      resolution: buildHistoricalTimezoneResolution({
        parentCalendarDateLocalCivilFrameBindingCompilationRef: timezonePublished.ref
      }),
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks:
        AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Wrong predecessor kind must fail closed.',
      audit: audit(
        'evt-gold-dec0030-wrong-parent-kind',
        normalizationReviewer.principalId
      )
    }),
  'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_AUTHORITY_REF'
);

const historicalTimezonePredecessorDrift = structuredClone(localCivilFramePublished.ref);
historicalTimezonePredecessorDrift.semanticHash = `sha256:${'0'.repeat(64)}`;
assert.throws(() =>
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.predecessor-ref-drift',
    version: '1',
    resolution: buildHistoricalTimezoneResolution({
      parentCalendarDateLocalCivilFrameBindingCompilationRef:
        historicalTimezonePredecessorDrift
    }),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Predecessor ref drift must fail closed.',
    audit: audit(
      'evt-gold-dec0030-predecessor-ref-drift',
      normalizationReviewer.principalId
    )
  })
);

for (const timezoneRuleAuthority of [
  {
    ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
    dataArtifact: 'tzdata-latest.tar.gz'
  },
  {
    ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
    release: '2026b'
  },
  {
    ...structuredClone(AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIRST_RULE_AUTHORITY),
    sha512: '0'.repeat(128)
  }
]) {
  expectHistoricalTimezoneBoundaryError(
    () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0030.rule-authority-drift',
      version: '1',
      resolution: buildHistoricalTimezoneResolution({timezoneRuleAuthority}),
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks:
        AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Mutable/wrong IANA authority must fail closed.',
      audit: audit(
        'evt-gold-dec0030-rule-authority-drift',
        normalizationReviewer.principalId
      )
    }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_AUTHORITY'
  );
}

const historicalTimezoneAlteredRuleEvidence = {
  ...historicalTimezoneRuleEvidence,
  northamericaRuleText:
    historicalTimezoneRuleEvidence.northamericaRuleText.replace(
      '-6:00\tUS\tC%sT',
      '-7:00\tUS\tC%sT'
    )
};
expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.altered-rule-bytes',
    version: '1',
    resolution: buildHistoricalTimezoneResolution(),
    timezoneRuleEvidence: historicalTimezoneAlteredRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Altered retained rule bytes must fail closed without host fallback.',
    audit: audit(
      'evt-gold-dec0030-altered-rule-bytes',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_HASH_MISMATCH'
);

expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.missing-rule-bytes',
    version: '1',
    resolution: buildHistoricalTimezoneResolution(),
    timezoneRuleEvidence: {
      ...historicalTimezoneRuleEvidence,
      releaseEvidenceText: ''
    },
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Missing retained release evidence must fail closed.',
    audit: audit(
      'evt-gold-dec0030-missing-rule-bytes',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_RULE_EVIDENCE_REQUIRED'
);

for (const historicalResolutionDrift of [
  {
    springTransitionDate: '2011-03-12',
    fallTransitionDate: '2011-11-06',
    baseOffset: '-06:00',
    daylightSave: '+01:00',
    effectiveOffset: '-05:00',
    dstState: 'DAYLIGHT'
  },
  {
    springTransitionDate: '2011-03-13',
    fallTransitionDate: '2011-11-06',
    baseOffset: '-06:00',
    daylightSave: '+00:00',
    effectiveOffset: '-06:00',
    dstState: 'STANDARD'
  }
]) {
  expectHistoricalTimezoneBoundaryError(
    () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: 'review.gold.dec0030.historical-state-drift',
      version: '1',
      resolution: buildHistoricalTimezoneResolution({
        historicalResolution: historicalResolutionDrift
      }),
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks:
        AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Transition/offset/DST substitution must fail closed.',
      audit: audit(
        'evt-gold-dec0030-historical-state-drift',
        normalizationReviewer.principalId
      )
    }),
    'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_HISTORICAL_STATE'
  );
}

expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.utc-boundary-drift',
    version: '1',
    resolution: buildHistoricalTimezoneResolution({
      effectiveInterval: {
        start: '2011-05-03T06:00:00.000Z',
        end: '2011-05-04T06:00:00.000Z'
      }
    }),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Arbitrary caller UTC boundaries must fail closed.',
    audit: audit(
      'evt-gold-dec0030-utc-boundary-drift',
      normalizationReviewer.principalId
    )
  }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_EFFECTIVE_INTERVAL'
);

for (const [key, value] of [
  ['hostTimezoneFallback', true],
  ['availableAt', '2011-05-03T05:00:00.000Z'],
  ['intervalClosure', 'HALF_OPEN'],
  ['contextDatumRef', 'CD-1']
]) {
  expectHistoricalTimezoneBoundaryError(
    () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
      ledger: env.ledger,
      sourceRegistry: env.sourceRegistry,
      logicalId: `review.gold.dec0030.forbidden-${key}`,
      version: '1',
      resolution: {...buildHistoricalTimezoneResolution(), [key]: value},
      timezoneRuleEvidence: historicalTimezoneRuleEvidence,
      disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
      reviewerPrincipal: normalizationReviewer,
      authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
      confirmedChecks:
        AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
      rationale: 'Forbidden widening must fail closed.',
      audit: audit(
        `evt-gold-dec0030-forbidden-${key}`,
        normalizationReviewer.principalId
      )
    }),
    'INVALID_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_FIELD'
  );
}

expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.date-to-timestamp',
    version: '1',
    resolution: buildHistoricalTimezoneResolution({
      targetContextSemantic: {
        semanticId: 'crop.planting_date',
        value: {type: 'TIMESTAMP', date: '2011-05-03'}
      }
    }),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'DATE to TIMESTAMP mutation must fail closed.',
    audit: audit(
      'evt-gold-dec0030-date-to-timestamp',
      normalizationReviewer.principalId
    )
  }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_TARGET'
);

const historicalTimezoneIncompleteChecks =
  AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS
    .filter((check) => check !== 'NO_HOST_TIMEZONE_DATABASE_AUTHORITY');
expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.incomplete',
    version: '1',
    resolution: buildHistoricalTimezoneResolution(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: historicalTimezoneIncompleteChecks,
    rationale: 'Incomplete review must fail closed.',
    audit: audit(
      'evt-gold-dec0030-incomplete',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_INCOMPLETE'
);

const historicalTimezoneUnauthorizedReviewer = createPrincipal({
  principalId: 'gold-dec0030-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.unauthorized',
    version: '1',
    resolution: buildHistoricalTimezoneResolution(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: historicalTimezoneUnauthorizedReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks:
      AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Another reviewer cannot borrow predecessor source authorizations.',
    audit: audit(
      'evt-gold-dec0030-unauthorized',
      historicalTimezoneUnauthorizedReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_AUTHORIZATION_INVALID'
);

const historicalTimezoneRejectedReview =
  publishAgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0030.rejected',
    version: '1',
    resolution: buildHistoricalTimezoneResolution(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'REJECT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: localCivilFrameAuthorizations,
    confirmedChecks: [],
    rationale: 'Rejected review cannot authorize publication.',
    audit: audit(
      'evt-gold-dec0030-rejected-review',
      normalizationReviewer.principalId
    )
  });
expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0030.rejected',
    version: '1',
    compilation: buildHistoricalTimezoneCompilation(
      buildHistoricalTimezoneResolution(),
      historicalTimezoneRejectedReview.ref
    ),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    audit: audit(
      'evt-gold-dec0030-rejected-publication',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_REJECTED'
);

const historicalTimezoneMismatchResolution =
  buildHistoricalTimezoneResolution({
    rationale: 'Materially different rationale after review.'
  });
expectHistoricalTimezoneBoundaryError(
  () => publishAgronomicContextHistoricalTimezoneBoundaryResolutionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0030.review-mismatch',
    version: '1',
    compilation: buildHistoricalTimezoneCompilation(
      historicalTimezoneMismatchResolution,
      historicalTimezoneReview.ref
    ),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    audit: audit(
      'evt-gold-dec0030-review-mismatch',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION_REVIEW_MISMATCH'
);


function buildDec0031SpatialClassification() {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_CONTRACT_VERSION,
    classificationId:
      'sustainable-corn.serf.crop-planting-date.spatial-support.dec0031',
    contextSemanticMappingCompilationRef: mappingPublished.ref,
    targetIdentityBindingCompilationRef: targetIdentityPublished.ref,
    targetContextSemantic:
      structuredClone(mappingValidated.semanticPayload.mapping.targetContextSemantic),
    sourceNativeSubject: { name: 'siteid', value: 'SERF' },
    sourceBackedTargetIdentity: {
      granularity: 'FARM',
      targetId:
        targetIdentityValidated.semanticPayload.binding.sourceBackedTargetIdentity.targetId
    },
    spatialSupport: { type: 'FARM' },
    classificationRationale:
      'DEC-0031 replays exact DEC-0023 FARM support authority only; target identity remains internal lineage and no geometryRef is created.'
  };
}
function buildDec0031SpatialCompilation(classification, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_COMPILATION_AUTHORITY',
    classification,
    classificationHash:
      agronomicRecordedOperationContextSpatialSupportClassificationHash(classification),
    spatialSupportReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'CONTEXT_SEMANTIC_PREDECESSOR',
        'TARGET_IDENTITY_PREDECESSOR',
        'CO_PREDECESSOR_CONVERGENCE',
        'SOURCE_NATIVE_SUBJECT',
        'SOURCE_BACKED_TARGET_IDENTITY_LINEAGE',
        'SPATIAL_SUPPORT_CLASSIFICATION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_GEOMETRY_REF',
      'SUPPORT_TYPE_NOT_TARGET_INSTANCE_IDENTITY',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ]
  };
}
const dec0031SpatialClassification = buildDec0031SpatialClassification();
const dec0031SpatialReview =
  publishAgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.spatial-support',
    version: '1',
    classification: dec0031SpatialClassification,
    disposition:
      'ACCEPT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref,
      targetIdentityAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Revalidate exact DEC-0016 + DEC-0015 convergence for DEC-0031 assembly.',
    audit: audit('evt-gold-dec0031-spatial-review', normalizationReviewer.principalId)
  });
const dec0031SpatialPublished =
  publishAgronomicRecordedOperationContextSpatialSupportClassificationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.spatial-support',
    version: '1',
    compilation:
      buildDec0031SpatialCompilation(
        dec0031SpatialClassification,
        dec0031SpatialReview.ref
      ),
    audit: audit('evt-gold-dec0031-spatial-publication', normalizationReviewer.principalId)
  });
const dec0031SpatialValidated =
  validateAgronomicRecordedOperationContextSpatialSupportClassificationCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: dec0031SpatialPublished.ref
  });

function buildDec0031UnitRepresentation() {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_CONTRACT_VERSION,
    representationId: 'representation.gold.dec0031.unit',
    parentContextSemanticMappingCompilationRef: mappingPublished.ref,
    targetContextSemantic:
      structuredClone(mappingValidated.semanticPayload.mapping.targetContextSemantic),
    unitRepresentation: {
      kind: 'NOT_APPLICABLE',
      wireValue: 'NOT_APPLICABLE'
    },
    rationale:
      'Revalidate exact DEC-0024 non-quantitative unit authority for assembly.'
  };
}
function buildDec0031UnitCompilation(representation, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_COMPILATION_AUTHORITY',
    representation,
    representationHash:
      agronomicContextNonQuantitativeUnitRepresentationHash(representation),
    unitRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'NON_QUANTITATIVE_UNIT_REPRESENTATION'
      ],
      unrepresentedElements: []
    },
    limitations: ['NO_GENERIC_DATE_TYPE_RULE', 'NO_CONTEXT_DATUM_PUBLICATION']
  };
}
const dec0031UnitRepresentation = buildDec0031UnitRepresentation();
const dec0031UnitReview =
  publishAgronomicContextNonQuantitativeUnitRepresentationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.unit',
    version: '1',
    representation: dec0031UnitRepresentation,
    disposition: 'ACCEPT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Only exact NOT_APPLICABLE DEC-0024 wire value is accepted.',
    audit: audit('evt-gold-dec0031-unit-review', normalizationReviewer.principalId)
  });
const dec0031UnitPublished =
  publishAgronomicContextNonQuantitativeUnitRepresentationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.unit',
    version: '1',
    compilation:
      buildDec0031UnitCompilation(dec0031UnitRepresentation, dec0031UnitReview.ref),
    audit: audit('evt-gold-dec0031-unit-publication', normalizationReviewer.principalId)
  });

function buildDec0031VerticalRepresentation() {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_CONTRACT_VERSION,
    representationId: 'representation.gold.dec0031.vertical',
    parentContextSemanticMappingCompilationRef: mappingPublished.ref,
    targetContextSemantic:
      structuredClone(mappingValidated.semanticPayload.mapping.targetContextSemantic),
    verticalSupportRepresentation: {
      kind: 'NOT_APPLICABLE',
      wireValue: null
    },
    rationale:
      'Revalidate exact DEC-0025 vertical-support non-applicability for assembly.'
  };
}
function buildDec0031VerticalCompilation(representation, reviewRef) {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_COMPILATION_AUTHORITY',
    representation,
    representationHash:
      agronomicContextVerticalSupportNonApplicabilityHash(representation),
    verticalSupportRepresentationReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'VERTICAL_SUPPORT_NON_APPLICABILITY'
      ],
      unrepresentedElements: []
    },
    limitations: ['NULL_NOT_MISSING_DATA', 'NO_CONTEXT_DATUM_PUBLICATION']
  };
}
const dec0031VerticalRepresentation = buildDec0031VerticalRepresentation();
const dec0031VerticalReview =
  publishAgronomicContextVerticalSupportNonApplicabilityReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.vertical',
    version: '1',
    representation: dec0031VerticalRepresentation,
    disposition: 'ACCEPT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY_REQUIRED_REVIEW_CHECKS,
    rationale: 'Only exact verticalSupport null non-applicability is accepted.',
    audit: audit('evt-gold-dec0031-vertical-review', normalizationReviewer.principalId)
  });
const dec0031VerticalPublished =
  publishAgronomicContextVerticalSupportNonApplicabilityCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.vertical',
    version: '1',
    compilation:
      buildDec0031VerticalCompilation(
        dec0031VerticalRepresentation,
        dec0031VerticalReview.ref
      ),
    audit: audit('evt-gold-dec0031-vertical-publication', normalizationReviewer.principalId)
  });

function buildDec0031UncertaintyRepresentation() {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_CONTRACT_VERSION,
    representationId: 'representation.gold.dec0031.uncertainty',
    parentContextSemanticMappingCompilationRef: mappingPublished.ref,
    targetContextSemantic:
      structuredClone(mappingValidated.semanticPayload.mapping.targetContextSemantic),
    uncertaintyRepresentation: {
      type: 'UNKNOWN',
      reasonCode: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
    },
    rationale:
      'Revalidate exact DEC-0026 UNKNOWN uncertainty authority for assembly.'
  };
}
function buildDec0031UncertaintyCompilation(representation, reviewRef) {
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
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_CONTEXT_SEMANTIC_MAPPING',
        'TARGET_CONTEXT_SEMANTIC',
        'UNCERTAINTY_UNKNOWN_REPRESENTATION'
      ],
      unrepresentedElements: []
    },
    limitations: ['VALUE_REMAINS_KNOWN_DATE', 'NO_CONTEXT_DATUM_PUBLICATION']
  };
}
const dec0031UncertaintyRepresentation = buildDec0031UncertaintyRepresentation();
const dec0031UncertaintyReview =
  publishAgronomicContextUncertaintyUnknownRepresentationReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.uncertainty',
    version: '1',
    representation: dec0031UncertaintyRepresentation,
    disposition: 'ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [
      parentSourceAuthorization.auth.ref,
      semanticSourceAuthorization.auth.ref
    ],
    confirmedChecks:
      AGRONOMIC_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Only exact DEC-0026 UNKNOWN representation is accepted.',
    audit: audit('evt-gold-dec0031-uncertainty-review', normalizationReviewer.principalId)
  });
const dec0031UncertaintyPublished =
  publishAgronomicContextUncertaintyUnknownRepresentationCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.uncertainty',
    version: '1',
    compilation:
      buildDec0031UncertaintyCompilation(
        dec0031UncertaintyRepresentation,
        dec0031UncertaintyReview.ref
      ),
    audit: audit('evt-gold-dec0031-uncertainty-publication', normalizationReviewer.principalId)
  });

function buildDec0031AvailabilityProjection() {
  const artifact = sourceProjectionValidated.parentOccurrence.sourceArtifact;
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
    projectionId: 'projection.gold.dec0031.availability',
    parentSourceReferenceHashProjectionCompilationRef: sourceProjectionPublished.ref,
    targetContextSemantic:
      structuredClone(sourceProjectionValidated.semanticPayload.projection.targetContextSemantic),
    valueSource:
      structuredClone(sourceProjectionValidated.semanticPayload.projection.valueSource),
    sourceArtifactAcquisition: {
      method: artifact.semanticPayload.acquisition.method,
      acquiredAt: artifact.semanticPayload.acquisition.acquiredAt
    },
    availableAtProjection: {
      basis: AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_BASIS,
      availableAt: artifact.semanticPayload.acquisition.acquiredAt
    },
    rationale:
      'Revalidate exact DEC-0028 value-source artifact acquisition availability.'
  };
}
function buildDec0031AvailabilityCompilation(projection, reviewRef) {
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
      status: 'COMPLETE',
      coveredElements: [
        'PARENT_SOURCE_REFERENCE_HASH',
        'VALUE_SOURCE_ARTIFACT_ACQUISITION',
        'AVAILABLE_AT_PROJECTION'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'ADR_EVIDENCE_AVAILABILITY_NOT_UPSTREAM_FIRST_PUBLICATION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ]
  };
}
const dec0031AvailabilityProjection = buildDec0031AvailabilityProjection();
assert.equal(
  dec0031AvailabilityProjection.sourceArtifactAcquisition.method,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_METHOD
);
assert.equal(
  dec0031AvailabilityProjection.sourceArtifactAcquisition.acquiredAt,
  AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_FIRST_TIMESTAMP
);
const dec0031AvailabilityReview =
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.availability',
    version: '1',
    projection: dec0031AvailabilityProjection,
    disposition:
      'ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: [parentSourceAuthorization.auth.ref],
    confirmedChecks:
      AGRONOMIC_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION_REQUIRED_REVIEW_CHECKS,
    rationale: 'Only exact value-source artifact acquisition time is accepted.',
    audit: audit('evt-gold-dec0031-availability-review', normalizationReviewer.principalId)
  });
const dec0031AvailabilityPublished =
  publishAgronomicContextSourceAcquisitionAvailabilityProjectionCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.availability',
    version: '1',
    compilation:
      buildDec0031AvailabilityCompilation(
        dec0031AvailabilityProjection,
        dec0031AvailabilityReview.ref
      ),
    audit: audit('evt-gold-dec0031-availability-publication', normalizationReviewer.principalId)
  });

function buildDec0031Assembly(predecessorOverrides = {}, templateOverrides = {}) {
  return {
    contractVersion: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CONTRACT_VERSION,
    assemblyId: 'assembly.gold.sustainable-corn.planting-date',
    predecessorRefs: {
      contextSemanticMappingCompilationRef: mappingPublished.ref,
      epistemicClassificationCompilationRef: epistemicPublished.ref,
      provenanceClassificationCompilationRef: provenancePublished.ref,
      sourceReferenceHashProjectionCompilationRef: sourceProjectionPublished.ref,
      temporalSupportClassificationCompilationRef: temporalSupportPublished.ref,
      spatialSupportClassificationCompilationRef: dec0031SpatialPublished.ref,
      unitRepresentationCompilationRef: dec0031UnitPublished.ref,
      verticalSupportNonApplicabilityCompilationRef: dec0031VerticalPublished.ref,
      uncertaintyUnknownRepresentationCompilationRef: dec0031UncertaintyPublished.ref,
      sourceAcquisitionAvailabilityProjectionCompilationRef:
        dec0031AvailabilityPublished.ref,
      historicalTimezoneBoundaryResolutionCompilationRef:
        historicalTimezonePublished.ref,
      ...predecessorOverrides
    },
    datumTemplate: {
      ...structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
      ...templateOverrides
    },
    rationale:
      'Exact DEC-0016..0030 field authorities converge into one A02-compatible first Sustainable Corn planting-date template.'
  };
}
function buildDec0031AssemblyCompilation(assembly, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_COMPILATION_AUTHORITY',
    assembly,
    assemblyHash: agronomicContextDatumAssemblyHash(assembly),
    assemblyReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'ALL_FIRST_CONTEXT_DATUM_FIELD_AUTHORITIES',
        'EXACT_AUTHORITY_REF_CONVERGENCE',
        'A02_DATUM_TEMPLATE',
        'PUBLICATION_BRIDGE'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_ASSEMBLY_ELEMENT']
    },
    limitations: [
      'NO_GENERIC_ASSEMBLY_ENGINE',
      'NO_TARGET_REF_IN_CONTEXT_DATUM',
      'NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM'
    ]
  };
}

const dec0031Assembly = buildDec0031Assembly();
const dec0031AssemblyAuthorizations = [
  parentSourceAuthorization.auth.ref,
  semanticSourceAuthorization.auth.ref,
  targetIdentityAuthorization.auth.ref,
  decagonTimezoneAuthorization.auth.ref,
  watertableTimezoneAuthorization.auth.ref
];
const dec0031AssemblyReview =
  publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.context-datum-assembly',
    version: '1',
    assembly: dec0031Assembly,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS,
    rationale:
      'Accept only exact same-ledger convergence of the first Sustainable Corn field-authority world.',
    audit: audit(
      'evt-gold-dec0031-assembly-review',
      normalizationReviewer.principalId
    )
  });
const dec0031AssemblyPublished =
  publishAgronomicContextDatumAssemblyCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.context-datum-assembly',
    version: '1',
    compilation:
      buildDec0031AssemblyCompilation(
        dec0031Assembly,
        dec0031AssemblyReview.ref
      ),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    audit: audit(
      'evt-gold-dec0031-assembly-publication',
      normalizationReviewer.principalId
    )
  });
const dec0031AssemblyValidated =
  validateAgronomicContextDatumAssemblyCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: dec0031AssemblyPublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence
  });

assert.deepEqual(
  dec0031AssemblyValidated.semanticPayload.assembly.datumTemplate,
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE
);
assert.equal(
  Object.hasOwn(
    dec0031AssemblyValidated.semanticPayload.assembly.datumTemplate.spatialSupport,
    'geometryRef'
  ),
  false
);

const dec0031Writer = createPrincipal({
  principalId: 'gold-dec0031-context-writer',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a',
  programIds: []
});
const dec0031WriterRole =
  publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.gold.dec0031.context-writer',
    version: '1',
    principal: dec0031Writer,
    role: 'INTEGRATION_SERVICE',
    scope: {
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      resourceType: 'CONTEXT_DATUM'
    },
    audit: audit('evt-gold-dec0031-writer-role', dec0031Writer.principalId, dec0031Writer.type)
  });

function createDec0031WriteAuthorization(logicalId, actor = dec0031Writer) {
  const decision = authorizeContextWrite({
    principal: actor,
    roleAssignments: [dec0031WriterRole],
    authorizationScope: {
      organizationId: actor.organizationId,
      tenantId: actor.tenantId,
      resourceType: 'CONTEXT_DATUM',
      resourceId: logicalId
    }
  });
  return recordAuthorizationDecision({
    ledger: env.ledger,
    decision,
    audit: audit('evt-gold-dec0031-write-auth-' + logicalId, actor.principalId, actor.type)
  });
}

const dec0031DatumLogicalId =
  'ctx-gold-sustainable-corn-serf-planting-date';
const dec0031WriteAuthorization =
  createDec0031WriteAuthorization(dec0031DatumLogicalId);
const dec0031ContextDatum =
  publishAgronomicContextDatumFromAssembly({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    assemblyCompilationRef: dec0031AssemblyPublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    logicalId: dec0031DatumLogicalId,
    version: '1',
    target: { organizationId: 'org-a', tenantId: 'tenant-a' },
    principal: dec0031Writer,
    authorizationDecisionAuditRef: dec0031WriteAuthorization.ref,
    audit: audit('evt-gold-dec0031-context-datum-publication', dec0031Writer.principalId, dec0031Writer.type)
  });
const dec0031ContextDatumValidated =
  validateAgronomicContextDatumAssemblyPublicationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    contextDatumRef: dec0031ContextDatum.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence
  });
const dec0031PublicWire = materializePublicContextDatum(dec0031ContextDatum);

assert.equal(dec0031PublicWire.contract_version, CONTEXT_DATUM_CONTRACT_VERSION);
assert.equal(dec0031PublicWire.datum_id, dec0031DatumLogicalId);
assert.equal(dec0031PublicWire.semantic_id, 'crop.planting_date');
assert.deepEqual(dec0031PublicWire.value, { type: 'DATE', date: '2011-05-03' });
assert.equal(dec0031PublicWire.unit, 'NOT_APPLICABLE');
assert.equal(dec0031PublicWire.epistemic_class, 'ASSERTION');
assert.equal(dec0031PublicWire.provenance_class, 'EXTERNAL_PROVIDER');
assert.deepEqual(dec0031PublicWire.effective_interval, {
  start: '2011-05-03T05:00:00.000Z',
  end: '2011-05-04T05:00:00.000Z'
});
assert.equal(dec0031PublicWire.available_at, '2026-08-30T13:00:00.000Z');
assert.deepEqual(dec0031PublicWire.spatial_support, { type: 'FARM' });
assert.equal(dec0031PublicWire.vertical_support, null);
assert.deepEqual(dec0031PublicWire.temporal_support, { type: 'INTERVAL' });
assert.deepEqual(dec0031PublicWire.uncertainty, {
  type: 'UNKNOWN',
  reason_code: 'ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED'
});
assert.equal(
  dec0031PublicWire.source.provider_id,
  'github.com/isudatateam/datateam'
);
assert.equal(
  dec0031PublicWire.source.content_hash,
  'sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f'
);

function expectAssemblyError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof AgronomicContextDatumAssemblyCompilationError);
    assert.equal(error.code, code);
    return true;
  });
}

const alternateMappingPublished =
  publishAgronomicRecordedOperationContextSemanticMappingCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.semantic-equal-alternate-mapping',
    version: '1',
    compilation:
      buildContextSemanticMappingCompilation(
        contextSemanticMapping,
        mappingReview.ref
      ),
    audit: audit(
      'evt-gold-dec0031-semantic-equal-alternate-mapping',
      normalizationReviewer.principalId
    )
  });
expectAssemblyError(
  () => publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.exact-ref-drift',
    version: '1',
    assembly: buildDec0031Assembly({
      contextSemanticMappingCompilationRef: alternateMappingPublished.ref
    }),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS,
    rationale: 'Semantically equal but different mapping ref cannot replace exact branch convergence.',
    audit: audit('evt-gold-dec0031-exact-ref-drift', normalizationReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_EPISTEMIC_PREDECESSOR_MISMATCH'
);

expectAssemblyError(
  () => publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.template-drift',
    version: '1',
    assembly: buildDec0031Assembly({}, { unit: 'day' }),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS,
    rationale: 'Caller-like field drift must fail closed.',
    audit: audit('evt-gold-dec0031-template-drift', normalizationReviewer.principalId)
  }),
  'UNSUPPORTED_AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_TEMPLATE'
);

expectAssemblyError(
  () => publishAgronomicContextDatumFromAssembly({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    assemblyCompilationRef: dec0031AssemblyPublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    logicalId: 'ctx-gold-dec0031-override',
    version: '1',
    target: { organizationId: 'org-a', tenantId: 'tenant-a' },
    principal: dec0031Writer,
    authorizationDecisionAuditRef: dec0031WriteAuthorization.ref,
    datum: { unit: 'day' },
    audit: audit('evt-gold-dec0031-caller-override', dec0031Writer.principalId, dec0031Writer.type)
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_CALLER_FIELD_OVERRIDE_FORBIDDEN'
);

const dec0031WrongIdAuthorization =
  createDec0031WriteAuthorization('ctx-gold-dec0031-other-id');
assert.throws(() =>
  publishAgronomicContextDatumFromAssembly({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    assemblyCompilationRef: dec0031AssemblyPublished.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    logicalId: 'ctx-gold-dec0031-wrong-auth-id',
    version: '1',
    target: { organizationId: 'org-a', tenantId: 'tenant-a' },
    principal: dec0031Writer,
    authorizationDecisionAuditRef: dec0031WrongIdAuthorization.ref,
    audit: audit('evt-gold-dec0031-wrong-auth-id', dec0031Writer.principalId, dec0031Writer.type)
  })
);

const dec0031UnauthorizedReviewer = createPrincipal({
  principalId: 'gold-dec0031-unauthorized-reviewer',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
});
expectAssemblyError(
  () => publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.unauthorized',
    version: '1',
    assembly: buildDec0031Assembly(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: dec0031UnauthorizedReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS,
    rationale: 'Another reviewer cannot borrow exact source inspection authority.',
    audit: audit(
      'evt-gold-dec0031-unauthorized-reviewer',
      dec0031UnauthorizedReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_AUTHORIZATION_INVALID'
);

const dec0031IncompleteChecks =
  AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REQUIRED_REVIEW_CHECKS
    .filter((check) => check !== 'NO_CALLER_FIELD_AUTHORITY');
expectAssemblyError(
  () => publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.incomplete',
    version: '1',
    assembly: buildDec0031Assembly(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'ACCEPT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: dec0031IncompleteChecks,
    rationale: 'Incomplete assembly review must fail closed.',
    audit: audit('evt-gold-dec0031-incomplete', normalizationReviewer.principalId)
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_INCOMPLETE'
);

const dec0031RejectedReview =
  publishAgronomicContextDatumAssemblyReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'review.gold.dec0031.rejected',
    version: '1',
    assembly: buildDec0031Assembly(),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    disposition: 'REJECT_CONTEXT_DATUM_ASSEMBLY',
    reviewerPrincipal: normalizationReviewer,
    authorizationDecisionAuditRefs: dec0031AssemblyAuthorizations,
    confirmedChecks: [],
    rationale: 'Rejected assembly cannot publish.',
    audit: audit('evt-gold-dec0031-rejected', normalizationReviewer.principalId)
  });
expectAssemblyError(
  () => publishAgronomicContextDatumAssemblyCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.gold.dec0031.rejected',
    version: '1',
    compilation:
      buildDec0031AssemblyCompilation(
        buildDec0031Assembly(),
        dec0031RejectedReview.ref
      ),
    timezoneRuleEvidence: historicalTimezoneRuleEvidence,
    audit: audit(
      'evt-gold-dec0031-rejected-publication',
      normalizationReviewer.principalId
    )
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_REVIEW_REJECTED'
);

const genericLogicalId = 'ctx-gold-dec0031-generic-matching';
const genericAuth = createDec0031WriteAuthorization(genericLogicalId);
const genericMatchingDatum = publishContextDatum({
  ledger: env.ledger,
  logicalId: genericLogicalId,
  version: '1',
  target: { organizationId: 'org-a', tenantId: 'tenant-a' },
  datum: structuredClone(AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_FIRST_DATUM_TEMPLATE),
  principal: dec0031Writer,
  authorizationDecisionAuditRef: genericAuth.ref,
  audit: audit('evt-gold-dec0031-generic-matching', dec0031Writer.principalId, dec0031Writer.type)
});
expectAssemblyError(
  () => validateAgronomicContextDatumAssemblyPublicationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    contextDatumRef: genericMatchingDatum.ref,
    timezoneRuleEvidence: historicalTimezoneRuleEvidence
  }),
  'AGRONOMIC_CONTEXT_DATUM_ASSEMBLY_PUBLICATION_PROOF_REQUIRED'
);

const contextDatumRecords = env.ledger.exportSnapshot().records
  .filter((record) => record.ref.kind === 'ContextDatum');
assert.equal(contextDatumRecords.length, 2);
assert.ok(
  contextDatumRecords.some((record) =>
    record.ref.semanticHash === dec0031ContextDatum.ref.semanticHash
  )
);
assert.ok(
  contextDatumRecords.some((record) =>
    record.ref.semanticHash === genericMatchingDatum.ref.semanticHash
  )
);

const forbiddenKinds = new Set([
  'ContextManifest',
  'AuthorizedContextReference',
  'ResolvedContextDatumReceipt',
  'DecisionProblem',
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
  authority: 'AgronomicContextDatumAssemblyPublication',
  goldKind: 'PUBLIC_REAL_SOURCE_CUMULATIVE',
  assemblyCompilationRef: dec0031AssemblyPublished.ref,
  contextDatumRef: dec0031ContextDatum.ref,
  datumTemplate:
    dec0031AssemblyValidated.semanticPayload.assembly.datumTemplate,
  publicWire: dec0031PublicWire,
  writeAuthorizationRef: dec0031WriteAuthorization.ref,
  exactAuthorityRefConvergenceVerified: true,
  callerFieldAuthorityUsed: false,
  genericAssemblyEngineCreated: false,
  targetRefInjected: false,
  geometryInferred: false,
  contextManifestCreated: false,
  decisionProblemCreated: false,
  specializedValidation:
    dec0031ContextDatumValidated.contextDatum.ref,
  negativeCases: [
    'SEMANTICALLY_EQUAL_DIFFERENT_MAPPING_REF_DENIED',
    'FIELD_TEMPLATE_DRIFT_DENIED',
    'CALLER_DATUM_OVERRIDE_DENIED',
    'WRONG_LOGICAL_ID_WRITE_AUTH_DENIED',
    'UNAUTHORIZED_ASSEMBLY_REVIEWER_DENIED',
    'INCOMPLETE_ASSEMBLY_REVIEW_DENIED',
    'REJECTED_ASSEMBLY_REVIEW_DENIED',
    'GENERIC_MATCHING_CONTEXT_DATUM_WITHOUT_ASSEMBLY_PROOF_DENIED'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
