import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS,
  AgronomicRecordedOperationOccurrenceCompilationError,
  agronomicRecordedOperationEvidenceHash,
  agronomicRecordedOperationOccurrenceHash,
  extractAgronomicRecordedOperationXlsxRowEvidence,
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

const XLSX_FIXTURE = Buffer.from(
  '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',
  'base64'
);

const COORDINATES = {
  worksheetName: 'Field Operations',
  rowNumber: 42,
  cells: [
    { role: 'SOURCE_NATIVE_SUBJECT', cellRef: 'A42' },
    { role: 'SOURCE_OPERATION_CODE', cellRef: 'B42' },
    { role: 'TEMPORAL_SUPPORT', cellRef: 'C42' }
  ]
};

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

function makeSourceWorld(env, label, { rightsSnapshot = true } = {}) {
  const source = env.sourceRegistry.registerSource({
    logicalId: `source.recorded-occurrence.${label}`,
    version: '1',
    sourceType: 'OTHER',
    title: `Recorded operation occurrence fixture ${label}`,
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { fixture: true },
    audit: audit(`evt-occurrence-source-${label}`, 'source-admin')
  });

  const artifact = env.sourceRegistry.materializeArtifact({
    logicalId: `artifact.recorded-occurrence.${label}`,
    version: '1',
    sourceRef: source.ref,
    bytes: XLSX_FIXTURE,
    mediaType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    materializationIdentity: `recorded-occurrence-xlsx-${label}`,
    acquisition: {
      method: 'FIXTURE',
      acquiredAt: '2026-08-29T10:30:00.000Z'
    },
    ...(rightsSnapshot
      ? {
          rightsSnapshot: {
            publicAccess: true,
            license: 'CC0-1.0',
            redistributionAllowed: true
          }
        }
      : {}),
    audit: audit(`evt-occurrence-artifact-${label}`, 'source-admin')
  });

  const evidence = extractAgronomicRecordedOperationXlsxRowEvidence({
    bytes: XLSX_FIXTURE,
    coordinates: COORDINATES
  });
  return {
    source,
    artifact,
    evidence,
    evidenceHash: agronomicRecordedOperationEvidenceHash(evidence)
  };
}

function makeOccurrence(world, overrides = {}) {
  const value = {
    contractVersion: AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_CONTRACT_VERSION,
    occurrenceId: 'fixture.serf.2011-05-03.plant-corn',
    sourceRef: world.source.ref,
    sourceArtifactRef: world.artifact.ref,
    sourceArtifactContentHash: world.artifact.semanticPayload.contentHash,
    sourceLocator: {
      kind: 'DOCUMENT_COORDINATE',
      scheme: 'XLSX_WORKSHEET_ROW_V1',
      coordinates: COORDINATES,
      evidenceHash: world.evidenceHash
    },
    recordSemanticRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    occurrenceSemantics: {
      occurrenceClass: 'SOURCE_RECORDED_OPERATION_OCCURRENCE',
      sourceOperationCode: 'plant_corn',
      sourceNativeSubject: {
        identifiers: [{ name: 'siteId', value: 'SERF' }]
      },
      temporalSupport: {
        kind: 'CALENDAR_DATE',
        date: '2011-05-03',
        precision: 'DAY'
      }
    },
    transformationRationale:
      'Preserve a positive source-recorded operation occurrence without runtime, execution, Outcome or negative-occurrence inference.'
  };
  return { ...value, ...overrides };
}

function reviewerAuthorization(env, source, label) {
  const reviewer = createPrincipal({
    principalId: `recorded-occurrence-reviewer-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.recorded-occurrence-reviewer.${label}`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(`evt-occurrence-role-${label}`, 'iam-admin')
  });
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.recorded-occurrence-review.${label}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: 'org-a' }],
    audit: audit(`evt-occurrence-policy-${label}`, 'iam-admin')
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
      `evt-occurrence-auth-${label}`,
      'iam-engine',
      'SERVICE_ACCOUNT'
    )
  });
  return { reviewer, role, policy, auth };
}

function review(env, world, occurrence, label, {
  disposition = 'ACCEPT_RECORDED_OPERATION_OCCURRENCE',
  confirmedChecks = AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS
} = {}) {
  const authorization = reviewerAuthorization(env, world.source, label);
  const record = publishAgronomicRecordedOperationOccurrenceReviewDecision({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: `review.recorded-occurrence.${label}`,
    version: '1',
    occurrence,
    disposition,
    reviewerPrincipal: authorization.reviewer,
    authorizationDecisionAuditRef: authorization.auth.ref,
    confirmedChecks,
    rationale:
      'Authorized review confirms exact row replay, source-native semantics, rights snapshot and prohibited downstream inferences.',
    audit: audit(
      `evt-occurrence-review-${label}`,
      authorization.reviewer.principalId
    )
  });
  return { record, ...authorization };
}

function compilation(world, occurrence, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY',
    sourceArtifactRefs: [world.artifact.ref],
    sourceRoleAuthorityRefs: [],
    occurrence,
    occurrenceHash: agronomicRecordedOperationOccurrenceHash(occurrence),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'SOURCE',
        'SOURCE_ARTIFACT',
        'SOURCE_LOCATOR',
        'SOURCE_OPERATION_CODE',
        'SOURCE_NATIVE_SUBJECT',
        'TEMPORAL_SUPPORT',
        'RIGHTS_SNAPSHOT'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_LOCAL_OCCURRENCE_ELEMENT']
    },
    limitations: [
      'RECORDED_OCCURRENCE_NOT_ADR_EXECUTION',
      'RECORDED_OCCURRENCE_NOT_OUTCOME',
      'SOURCE_NOT_ASSERTED_COMPLETE',
      'MISSING_RECORD_NOT_NONOCCURRENCE'
    ]
  };
}

const env = createEnvironment();
const world = makeSourceWorld(env, 'valid');
const occurrence = makeOccurrence(world);
const accepted = review(env, world, occurrence, 'valid');

const published = publishAgronomicRecordedOperationOccurrenceCompilation({
  ledger: env.ledger,
  sourceRegistry: env.sourceRegistry,
  logicalId: 'compilation.recorded-occurrence.valid',
  version: '1',
  compilation: compilation(world, occurrence, accepted.record.ref),
  audit: audit(
    'evt-occurrence-publication-valid',
    accepted.reviewer.principalId
  )
});

const validated =
  validateAgronomicRecordedOperationOccurrenceCompilationAuthority({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    compilationRef: published.ref
  });

assert.equal(
  validated.semanticPayload.occurrence.recordSemanticRole,
  'ACTUAL_FIELD_OPERATION_RECORD'
);
assert.equal(
  validated.semanticPayload.occurrence.occurrenceSemantics.sourceOperationCode,
  'plant_corn'
);
assert.equal(
  validated.semanticPayload.occurrence.occurrenceSemantics
    .sourceNativeSubject.identifiers[0].value,
  'SERF'
);
assert.equal(
  validated.semanticPayload.occurrence.occurrenceSemantics.temporalSupport.date,
  '2011-05-03'
);
assert.equal(validated.replayedEvidence.rowNumber, 42);
assert.equal(validated.replayedEvidence.worksheetName, 'Field Operations');

const incomplete = compilation(world, occurrence, accepted.record.ref, 'INCOMPLETE');
expectError(
  () => publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.recorded-occurrence.incomplete',
    version: '1',
    compilation: incomplete,
    audit: audit(
      'evt-occurrence-publication-incomplete',
      accepted.reviewer.principalId
    )
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_INCOMPLETE_NOT_PUBLISHABLE'
);

const driftedOccurrence = makeOccurrence(world, {
  transformationRationale:
    'A post-review rationale drift must not reuse the original semantic review.'
});
const driftedCompilation =
  compilation(world, driftedOccurrence, accepted.record.ref);
expectError(
  () => publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.recorded-occurrence.review-drift',
    version: '1',
    compilation: driftedCompilation,
    audit: audit(
      'evt-occurrence-publication-review-drift',
      accepted.reviewer.principalId
    )
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_MISMATCH'
);

const operationMismatch = makeOccurrence(world);
operationMismatch.occurrenceSemantics.sourceOperationCode = 'harvest_corn';
expectError(
  () => review(env, world, operationMismatch, 'operation-mismatch'),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_OPERATION_EVIDENCE_MISMATCH'
);

const subjectMismatch = makeOccurrence(world);
subjectMismatch.occurrenceSemantics.sourceNativeSubject.identifiers[0].value =
  'KELLOGG';
expectError(
  () => review(env, world, subjectMismatch, 'subject-mismatch'),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_SUBJECT_EVIDENCE_MISMATCH'
);

const temporalMismatch = makeOccurrence(world);
temporalMismatch.occurrenceSemantics.temporalSupport.date = '2011-05-04';
expectError(
  () => review(env, world, temporalMismatch, 'temporal-mismatch'),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_TEMPORAL_EVIDENCE_MISMATCH'
);

const normalizedOperation = makeOccurrence(world);
normalizedOperation.occurrenceSemantics.normalizedOperation = {
  actionCode: 'PLANT',
  subject: { kind: 'CROP', code: 'CORN' }
};
expectError(
  () => review(env, world, normalizedOperation, 'normalization-unbound'),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_NORMALIZATION_AUTHORITY_REQUIRED'
);

expectError(
  () => review(env, world, occurrence, 'missing-review-check', {
    confirmedChecks:
      AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REQUIRED_REVIEW_CHECKS
        .filter((item) => item !== 'NO_ADR_EXECUTION_IDENTITY_INFERENCE')
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_INCOMPLETE'
);

const rejected = review(env, world, occurrence, 'rejected', {
  disposition: 'REJECT_RECORDED_OPERATION_OCCURRENCE',
  confirmedChecks: []
});
expectError(
  () => publishAgronomicRecordedOperationOccurrenceCompilation({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    logicalId: 'compilation.recorded-occurrence.rejected',
    version: '1',
    compilation: compilation(world, occurrence, rejected.record.ref),
    audit: audit(
      'evt-occurrence-publication-rejected',
      rejected.reviewer.principalId
    )
  }),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_REVIEW_REJECTED'
);

const noRightsEnv = createEnvironment();
const noRightsWorld = makeSourceWorld(noRightsEnv, 'no-rights', {
  rightsSnapshot: false
});
const noRightsOccurrence = makeOccurrence(noRightsWorld);
expectError(
  () => review(
    noRightsEnv,
    noRightsWorld,
    noRightsOccurrence,
    'no-rights'
  ),
  'AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_RIGHTS_SNAPSHOT_REQUIRED'
);

const evidenceHashMismatch = makeOccurrence(world);
evidenceHashMismatch.sourceLocator.evidenceHash =
  `sha256:${'f'.repeat(64)}`;
expectError(
  () => review(env, world, evidenceHashMismatch, 'evidence-hash-mismatch'),
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
  validCompilation: validated.record.ref,
  source: validated.source.ref,
  sourceArtifact: validated.sourceArtifact.ref,
  evidenceHash: validated.semanticPayload.occurrence.sourceLocator.evidenceHash,
  sourceOperationCode:
    validated.semanticPayload.occurrence.occurrenceSemantics.sourceOperationCode,
  sourceNativeSubject:
    validated.semanticPayload.occurrence.occurrenceSemantics.sourceNativeSubject,
  temporalSupport:
    validated.semanticPayload.occurrence.occurrenceSemantics.temporalSupport,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'REVIEW_DRIFT_DENIED',
    'OPERATION_EVIDENCE_MISMATCH',
    'SUBJECT_EVIDENCE_MISMATCH',
    'TEMPORAL_EVIDENCE_MISMATCH',
    'UNBOUND_NORMALIZATION_DENIED',
    'INCOMPLETE_REVIEW_DENIED',
    'REJECTED_REVIEW_DENIED',
    'RIGHTS_SNAPSHOT_REQUIRED',
    'EVIDENCE_HASH_MISMATCH'
  ],
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
