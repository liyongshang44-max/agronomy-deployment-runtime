import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  SourceFaithfulReviewService,
  sourceReviewResourceId
} from '../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  ScientificQualificationService,
  qualificationResourceId
} from '../../packages/knowledge-registry/src/qualification.mjs';
import {
  ExactArtifactStore,
  SourceRegistry,
  sourceContentHash
} from '../../packages/source-registry/src/index.mjs';

const OWNERSHIP = Object.freeze({
  organizationId: 'adr-program',
  tenantId: 'adr3b-scientific-qualification'
});
const SOURCE_URL = 'https://extension.colostate.edu/resource/crop-water-use-and-growth-stages/';
const EXPECTED_SOURCE_HASH = 'sha256:a5944795e13a1bf13a060ecde68a0dd94e93d42f9c8f635008ec935eb69438bd';
const CLAIM_ASSERTION = 'Management allowable depletion is a root-zone water-depletion quantity used as an irrigation-scheduling boundary.';
const EXPECTED_PRECONDITIONS = Object.freeze([
  { semanticId: 'decision.domain', operator: 'EQUALS', value: 'irrigation scheduling' },
  { semanticId: 'soil_water.metric', operator: 'EQUALS', value: 'management allowable depletion' },
  { semanticId: 'soil_water.spatial_support', operator: 'EQUALS', value: 'root zone' }
]);
const EXPECTED_LIMITATION_CODES = Object.freeze([
  'NO_ABSOLUTE_POINT_VWC_THRESHOLD_AUTHORITY',
  'NO_CROP_STAGE_OR_SOIL_HYDRAULIC_PARAMETER_IN_RETAINED_EXCERPT'
]);
const EXPECTED_TRANSPORT_CODES = Object.freeze([
  'REQUIRES_ROOT_ZONE_DEPLETION_SEMANTICS'
]);

function audit(eventId, actorId, actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-09-06T10:45:00.000Z',
    actor: { type: actorType, id: actorId },
    details: {
      suite: 'adr3b-irrigation-scientific-authority',
      classification: 'QUALIFICATION_ONLY_SCIENTIFIC_AUTHORITY_CANDIDATE',
      authorityEffect: 'QUALIFIED_KNOWLEDGE_CANDIDATE_ONLY',
      cutoverAuthorized: false
    }
  };
}

function wholeArtifactRange(bytes) {
  return { kind: 'BYTE_RANGE', start: 0, endExclusive: bytes.length };
}

function sourceContextProposal(sourceLocator) {
  const context = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  context.OPERATIONAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'decision.domain',
      valueCandidate: 'irrigation scheduling',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator
    }]
  };
  context.MEASUREMENT = {
    status: 'REPORTED',
    dimensions: [
      {
        semanticHint: 'soil_water.metric',
        valueCandidate: 'management allowable depletion',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator
      },
      {
        semanticHint: 'soil_water.spatial_support',
        valueCandidate: 'root zone',
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator
      }
    ]
  };
  return context;
}

const contextAdjudication = Object.freeze({
  BIOLOGICAL: [],
  ENVIRONMENTAL: [],
  MANAGEMENT: [],
  OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'CATEGORY' }],
  MEASUREMENT: [
    { semanticId: 'soil_water.metric', valueType: 'CATEGORY' },
    { semanticId: 'soil_water.spatial_support', valueType: 'CATEGORY' }
  ],
  JURISDICTION_ECONOMIC: []
});

const sourceBytes = readFileSync(new URL('./csu-mad-root-zone-excerpt.txt', import.meta.url));
assert.equal(sourceContentHash(sourceBytes), EXPECTED_SOURCE_HASH);
assert.equal(sourceBytes.toString('utf8').includes('0.22'), false);

const ledger = new AuthorityLedger();
const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });

const source = sourceRegistry.registerSource({
  logicalId: 'source.adr3b-csu-crop-water-use-growth-stages',
  version: '1',
  sourceType: 'PUBLICATION',
  title: 'Crop Water Use and Growth Stages',
  ownership: OWNERSHIP,
  bibliographic: {
    institution: 'Colorado State University Extension',
    authors: ['M.M. Al-Kaisi', 'I. Broner'],
    published: '2014-12',
    reviewed: '2025-08',
    peerReviewed: true
  },
  sourceVersionLabel: 'reviewed-2025-08',
  originLocator: SOURCE_URL,
  metadata: {
    retainedArtifactScope: 'ONE_SOURCE_FAITHFUL_EXCERPT',
    fullWebPageVendored: false,
    sourceSelectionPurpose: 'ADR_3B_IRRIGATION_MEASUREMENT_SEMANTICS_QUALIFICATION'
  },
  audit: audit('evt-adr3b-source', 'adr3b-source-curator')
});

const artifact = sourceRegistry.materializeArtifact({
  logicalId: 'artifact.adr3b-csu-mad-root-zone-excerpt',
  version: '1',
  sourceRef: source.ref,
  bytes: sourceBytes,
  mediaType: 'text/plain; charset=utf-8',
  materializationIdentity: 'csu-crop-water-use-growth-stages-mad-root-zone-excerpt-v1',
  acquisition: {
    method: 'CURATED_WEB_EXCERPT',
    acquiredAt: '2026-09-06T10:40:00.000Z',
    locator: `${SOURCE_URL}#managing-irrigation-according-to-growth-stages`,
    metadata: {
      sourceReviewed: '2025-08',
      transcriptionPolicy: 'EXACT_CONTIGUOUS_EXCERPT_NO_SEMANTIC_EDIT',
      fullSourceRetainedByThisFixture: false
    }
  },
  metadata: {
    exactExcerptBytesRetained: true,
    fullSourceRetained: false
  },
  audit: audit('evt-adr3b-artifact', 'adr3b-source-curator')
});
assert.equal(artifact.semanticPayload.contentHash, EXPECTED_SOURCE_HASH);

const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.adr3b-csu-mad-root-zone',
  version: '1',
  compilerId: 'adr.adr3b.csu-mad-root-zone.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SOURCE_FAITHFUL_EXCERPT',
    locatorScheme: 'BYTE_RANGE'
  },
  audit: audit('evt-adr3b-compiler', 'adr3b-scientific-compiler', 'SERVICE_ACCOUNT')
});

const sourceLocator = wholeArtifactRange(sourceBytes);
const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
  compilationLogicalId: 'compilation.adr3b-csu-mad-root-zone',
  version: '1',
  sourceArtifactRef: artifact.ref,
  compilerDefinitionRef: compilerDefinition.ref,
  proposal: {
    claims: [{
      key: 'mad-root-zone-definition',
      claimType: 'SEMANTIC_DEFINITION',
      assertion: CLAIM_ASSERTION,
      sourceLocator,
      sourceContext: sourceContextProposal(sourceLocator)
    }],
    runMetadata: {
      milestone: 'ADR_3B_SCIENTIFIC_AUTHORITY_ACQUISITION',
      migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1',
      productionPolicyCandidate: false
    }
  },
  audit: audit('evt-adr3b-compilation', 'adr3b-scientific-compiler', 'SERVICE_ACCOUNT')
});

const reviewer = createPrincipal({
  principalId: 'adr3b-agronomy-reviewer',
  type: 'USER',
  ...OWNERSHIP
});
const reviewerRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.adr3b.agronomy-reviewer',
  version: '1',
  principal: reviewer,
  role: 'AGRONOMY_REVIEWER',
  scope: OWNERSHIP,
  audit: audit('evt-adr3b-reviewer-role', 'adr3b-iam-admin')
});
const reviewPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.adr3b.source-review',
  version: '1',
  resourceId: sourceReviewResourceId(source.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: reviewer.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit('evt-adr3b-review-policy', 'adr3b-iam-admin')
});
const reviewAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeInspection({
    principal: reviewer,
    policy: reviewPolicy,
    roleAssignments: [reviewerRole],
    authorizationScope: OWNERSHIP
  }),
  audit: audit('evt-adr3b-review-auth', 'adr3b-iam-engine', 'SERVICE_ACCOUNT')
});

const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
  reviewLogicalId: 'review.adr3b-csu-mad-root-zone',
  reviewVersion: '1',
  compilationResultRef: compilation.result.ref,
  claimCandidateRef: compilation.claimCandidates[0].ref,
  sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  rationale: 'Retain only the source-supported root-zone MAD irrigation-scheduling semantics.',
  contextAdjudication,
  reviewPrincipal: reviewer,
  authorizationDecisionAuditRef: reviewAuth.ref,
  claimLogicalId: 'claim.adr3b-csu-mad-root-zone-definition',
  claimVersion: '1',
  sourceContextLogicalId: 'source-context.adr3b-csu-mad-root-zone-definition',
  sourceContextVersion: '1',
  audit: audit('evt-adr3b-source-faithful-review', reviewer.principalId)
});

assert.equal(reviewed.claim.ref.kind, 'Claim');
assert.equal(reviewed.claim.semanticPayload.claimType, 'SEMANTIC_DEFINITION');
assert.equal(reviewed.claim.semanticPayload.assertion, CLAIM_ASSERTION);

const families = reviewed.sourceContext.semanticPayload.contextFamilies;
assert.deepEqual(
  Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, families[family].status])),
  {
    BIOLOGICAL: 'NOT_REPORTED',
    ENVIRONMENTAL: 'NOT_REPORTED',
    MANAGEMENT: 'NOT_REPORTED',
    OPERATIONAL: 'REPORTED',
    MEASUREMENT: 'REPORTED',
    JURISDICTION_ECONOMIC: 'NOT_REPORTED'
  }
);
assert.deepEqual(
  families.OPERATIONAL.dimensions.map(({ semanticId, value }) => ({ semanticId, value: value.category })),
  [{ semanticId: 'decision.domain', value: 'irrigation scheduling' }]
);
assert.deepEqual(
  families.MEASUREMENT.dimensions.map(({ semanticId, value }) => ({ semanticId, value: value.category })),
  [
    { semanticId: 'soil_water.metric', value: 'management allowable depletion' },
    { semanticId: 'soil_water.spatial_support', value: 'root zone' }
  ]
);

const approver = createPrincipal({
  principalId: 'adr3b-scientific-approver',
  type: 'USER',
  ...OWNERSHIP
});
const approverRole = publishBuiltinRoleAssignment({
  ledger,
  logicalId: 'role.adr3b.scientific-approver',
  version: '1',
  principal: approver,
  role: 'SCIENTIFIC_APPROVER',
  scope: OWNERSHIP,
  audit: audit('evt-adr3b-approver-role', 'adr3b-iam-admin')
});
const qualificationPolicy = publishKnowledgeGovernancePolicy({
  ledger,
  logicalId: 'policy.adr3b.qualification',
  version: '1',
  resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
  ownership: OWNERSHIP,
  visibilityPolicy: [{ principalId: approver.principalId }],
  qualificationScope: [{ use: '*' }],
  deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
  audit: audit('evt-adr3b-qualification-policy', 'adr3b-iam-admin')
});
const qualificationAuth = recordAuthorizationDecision({
  ledger,
  decision: authorizeKnowledgeQualification({
    principal: approver,
    policy: qualificationPolicy,
    roleAssignments: [approverRole],
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    authorizationScope: OWNERSHIP
  }),
  audit: audit('evt-adr3b-qualification-auth', 'adr3b-iam-engine', 'SERVICE_ACCOUNT')
});

const qualificationService = new ScientificQualificationService({ ledger });
const qualificationDecision = qualificationService.recordQualificationDecision({
  decisionLogicalId: 'qualification.adr3b-csu-mad-root-zone-definition',
  decisionVersion: '1',
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  disposition: 'QUALIFY_USE',
  qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  semanticPreconditions: EXPECTED_PRECONDITIONS,
  limitations: [
    { code: 'NO_ABSOLUTE_POINT_VWC_THRESHOLD_AUTHORITY' },
    { code: 'NO_CROP_STAGE_OR_SOIL_HYDRAULIC_PARAMETER_IN_RETAINED_EXCERPT' }
  ],
  transportConstraints: [
    { code: 'REQUIRES_ROOT_ZONE_DEPLETION_SEMANTICS' }
  ],
  approverPrincipal: approver,
  authorizationDecisionAuditRef: qualificationAuth.ref,
  audit: audit('evt-adr3b-qualification', approver.principalId)
});

const knowledge = qualificationService.publishQualifiedKnowledge({
  qualifiedKnowledgeLogicalId: 'knowledge.adr3b-csu-mad-root-zone-definition',
  qualifiedKnowledgeVersion: '1',
  qualificationDecisionRefs: [qualificationDecision.ref],
  audit: audit('evt-adr3b-qualified-knowledge', approver.principalId)
});

assert.equal(qualificationDecision.ref.kind, 'ScientificQualificationDecision');
assert.equal(qualificationDecision.semanticPayload.disposition, 'QUALIFY_USE');
assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);
assert.deepEqual(knowledge.semanticPayload.forbiddenUses, []);

const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions
  .map((entry) => entry.value)
  .sort((left, right) => left.semanticId.localeCompare(right.semanticId));
assert.deepEqual(
  frozenPreconditions,
  [...EXPECTED_PRECONDITIONS].sort((left, right) => left.semanticId.localeCompare(right.semanticId))
);

const limitationCodes = knowledge.semanticPayload.limitations
  .map((entry) => entry.value.code)
  .sort();
assert.deepEqual(limitationCodes, [...EXPECTED_LIMITATION_CODES].sort());

const transportCodes = knowledge.semanticPayload.transportConstraints
  .map((entry) => entry.value.code)
  .sort();
assert.deepEqual(transportCodes, [...EXPECTED_TRANSPORT_CODES].sort());

for (const value of [
  source,
  artifact,
  reviewed.claim,
  reviewed.sourceContext,
  qualificationDecision,
  knowledge
]) {
  assert.equal(JSON.stringify(value).includes('0.22'), false);
}

assert.equal(source.ref.logicalId, 'source.adr3b-csu-crop-water-use-growth-stages');
assert.equal(artifact.ref.logicalId, 'artifact.adr3b-csu-mad-root-zone-excerpt');
assert.equal(reviewed.claim.ref.logicalId, 'claim.adr3b-csu-mad-root-zone-definition');
assert.equal(reviewed.sourceContext.ref.logicalId, 'source-context.adr3b-csu-mad-root-zone-definition');
assert.equal(qualificationDecision.ref.logicalId, 'qualification.adr3b-csu-mad-root-zone-definition');
assert.equal(knowledge.ref.logicalId, 'knowledge.adr3b-csu-mad-root-zone-definition');

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_3B_SCIENTIFIC_AUTHORITY_ACQUISITION',
  classification: 'QUALIFICATION_ONLY_SCIENTIFIC_AUTHORITY_CANDIDATE',
  migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1',
  sourceRef: source.ref,
  sourceArtifactRef: artifact.ref,
  claimRef: reviewed.claim.ref,
  sourceContextRef: reviewed.sourceContext.ref,
  scientificQualificationDecisionRef: qualificationDecision.ref,
  qualifiedKnowledgeCandidateRef: knowledge.ref,
  contextStatus: Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, families[family].status])
  ),
  legacyThresholdLaundered: false,
  productionPolicyPublished: false,
  decisionResultPublished: false,
  runtimePublished: false,
  geoxWritePerformed: false,
  cutoverAuthorized: false,
  nextFrontier: 'FAIL_CLOSED_EXACT_CONTEXT_AND_METRIC_COMPARABILITY_ADJUDICATION'
}, null, 2));