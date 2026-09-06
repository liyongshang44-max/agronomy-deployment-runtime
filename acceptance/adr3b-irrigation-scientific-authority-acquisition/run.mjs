import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  createPrincipal,
  publishBuiltinRoleAssignment,
  recordAuthorizationDecision,
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification
} from '../../packages/authorization/src/index.mjs';
import { publishKnowledgeGovernancePolicy } from '../../packages/authorization/src/engine.mjs';
import { AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE } from '../../packages/agronomic-policy-compilation/src/index.mjs';
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

const inventory = JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url), 'utf8'));

assert.equal(inventory.contractVersion, 'adr.adr3b-irrigation-scientific-authority-acquisition.v1');
assert.equal(inventory.classification, 'TEST_ONLY_SCIENTIFIC_AUTHORITY_ACQUISITION_AND_COMPARABILITY_EVIDENCE');
assert.equal(inventory.authorityEffect, 'TEST_ONLY_QUALIFIED_KNOWLEDGE_IN_ACCEPTANCE_LEDGER');
assert.equal(inventory.cutoverAuthorized, false);
assert.equal(inventory.shadowDualRunAuthorized, false);
assert.equal(inventory.sourceHeads.adr, '6001a1240c092fa0c1655d87cf027e46cc4cff56');
assert.equal(inventory.sourceHeads.geox, 'f41dde8d44de95e71748e756e048e0166c1916b7');
assert.equal(inventory.selectedMigrationSubject, 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1');
assert.equal(inventory.sources.length, 2);
assert.equal(inventory.sourceSynthesis.authorityCandidateAcquired, true);
assert.equal(inventory.sourceSynthesis.legacyConstantUsedAsSearchTarget, false);
assert.equal(inventory.sourceSynthesis.legacyConstantPromotedToAuthority, false);
assert.equal(inventory.sourceSynthesis.newGenericAuthorityObjectRequired, false);

for (const source of inventory.sources) {
  assert.equal(source.sourceClass, 'UNIVERSITY_EXTENSION_GUIDANCE');
  assert.equal(source.qualificationTarget, 'AGRONOMIC_POLICY_INPUT');
  assert.ok(!source.retainedEvidenceText.includes('0.22'));
  assert.ok(!source.sourceFaithfulClaim.includes('0.22'));
  const bytes = Buffer.from(`${source.retainedEvidenceText}\n`, 'utf8');
  assert.equal(sourceContentHash(bytes), source.retainedEvidenceContentHash);
}

assert.equal(inventory.sources[0].claimType, 'OPERATIONAL_RECOMMENDATION');
assert.equal(inventory.sources[0].semanticPreconditions[0].value, 'soil water depletion relative to management allowable depletion');
assert.equal(inventory.sources[1].semanticPreconditions.length, 3);
assert.deepEqual(
  inventory.sources[1].semanticPreconditions.map((entry) => entry.semanticId).sort(),
  ['crop.code', 'crop.stage', 'water.metric']
);
assert.equal(inventory.sources[1].semanticPreconditions.find((entry) => entry.semanticId === 'crop.stage')?.value, 'early vegetative growth stage');
assert.equal(inventory.sources[1].semanticPreconditions.find((entry) => entry.semanticId === 'water.metric')?.value, 'soil water deficit percent');

assert.equal(inventory.geoxExactEvidence.telemetryMetricCatalog.canonicalMetric, 'soil_moisture');
assert.equal(inventory.geoxExactEvidence.telemetryMetricCatalog.canonicalUnit, '%VWC');
assert.equal(inventory.geoxExactEvidence.telemetryMetricCatalog.governedVwcSemanticsEstablished, true);
assert.equal(inventory.geoxExactEvidence.stage1InputMapping.canonicalMetric, 'soil_moisture');
assert.equal(inventory.geoxExactEvidence.caller.governedUpstreamSemantic, '%VWC');
assert.ok(inventory.geoxExactEvidence.caller.normalizationDoesNotEstablish.includes(
  'vwc_to_soil_water_depletion_transformation'
));
assert.ok(!inventory.geoxExactEvidence.caller.normalizationDoesNotEstablish.includes(
  'volumetric_water_content_semantics'
));

assert.equal(inventory.comparabilityAdjudication.status, 'METRIC_SEMANTICS_NOT_EQUIVALENT');
assert.equal(inventory.comparabilityAdjudication.metricSemanticMatch, false);
assert.equal(inventory.comparabilityAdjudication.targetMatch, false);
assert.equal(inventory.comparabilityAdjudication.unitMatch, false);
assert.equal(inventory.comparabilityAdjudication.cropStageMatch, false);
assert.ok(inventory.comparabilityAdjudication.positiveCorrespondence.includes(
  'GEOX_CANONICAL_SOIL_MOISTURE_IS_GOVERNED_PERCENT_VWC'
));
assert.ok(inventory.comparabilityAdjudication.reasonCodes.includes(
  'GEOX_GOVERNED_VWC_IS_NOT_GOVERNED_SOIL_WATER_DEPLETION_OR_MAD'
));
assert.ok(inventory.comparabilityAdjudication.reasonCodes.includes(
  'VWC_TO_SOIL_WATER_DEPLETION_TRANSFORMATION_NOT_ESTABLISHED'
));
assert.ok(inventory.comparabilityAdjudication.reasonCodes.includes(
  'MAD_OR_EQUIVALENT_ALLOWABLE_DEPLETION_NOT_BOUND_TO_SELECTED_DECISION_INPUT'
));
assert.ok(inventory.comparabilityAdjudication.reasonCodes.includes(
  'ROOT_ZONE_PROFILE_AGGREGATION_NOT_ESTABLISHED'
));
assert.equal(inventory.terminalState.adr3bScientificAuthorityCandidate, 'ACQUIRED_AND_TEST_QUALIFIABLE');
assert.equal(inventory.terminalState.sameDecisionAuthorityForSelectedGeoxSubject, 'NOT_ESTABLISHED');
assert.equal(inventory.terminalState.blockingClass, 'METRIC_AND_TARGET_CONTEXT_SEMANTICS_INSUFFICIENT');
assert.equal(inventory.terminalState.architectureAdjudicationRequired, false);
assert.equal(inventory.terminalState.nextRequiredWork, 'GOVERNED_MEASUREMENT_AND_TARGET_CONTEXT_CORRESPONDENCE');

const OWNERSHIP = Object.freeze({ organizationId: 'org-a', tenantId: 'tenant-a' });
const ledger = new AuthorityLedger();
const artifactStore = new ExactArtifactStore();
const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
const compiler = new ScientificCompiler({ ledger, sourceRegistry });
const qualificationService = new ScientificQualificationService({ ledger });

let seq = 0;
function audit(principal, suffix, occurredAt, inputRefs = []) {
  seq += 1;
  return {
    eventId: `evt-adr3b-irrigation-authority-${seq}-${suffix}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    inputRefs,
    details: {
      suite: 'adr3b-irrigation-scientific-authority-acquisition-v1',
      classification: 'TEST_ONLY_SCIENTIFIC_AUTHORITY_ACQUISITION'
    }
  };
}
function serviceAudit(id, suffix, occurredAt) {
  return audit({ principalId: id, type: 'SERVICE_ACCOUNT' }, suffix, occurredAt);
}

const compilerPrincipal = { principalId: 'adr3b-scientific-compiler', type: 'SERVICE_ACCOUNT' };
const compilerDefinition = createDeterministicCompilerDefinition({
  ledger,
  logicalId: 'compiler.adr3b-irrigation-extension-guidance-v1',
  version: '1',
  compilerId: 'adr.adr3b-irrigation-extension-guidance.curated',
  implementationVersion: '1',
  configuration: {
    sourcePolicy: 'CURATED_SHORT_WEB_EXCERPT_SOURCE_FAITHFUL',
    networkAccessAtQualification: false,
    legacyConstantSearchTargetProhibited: true
  },
  audit: audit(compilerPrincipal, 'compiler', '2026-09-06T08:36:10.000Z')
});

function blankContext() {
  return Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [
    family,
    { status: 'NOT_REPORTED', dimensions: [] }
  ]));
}

const sourceSpecs = [
  {
    inventory: inventory.sources[0],
    slug: 'umn-irrigation-trigger-mad',
    context() {
      const families = blankContext();
      families.MEASUREMENT = {
        status: 'REPORTED',
        dimensions: [{
          semanticHint: 'water.metric',
          valueCandidate: 'soil water depletion relative to management allowable depletion',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: { kind: 'WHOLE_ARTIFACT' }
        }]
      };
      families.OPERATIONAL = {
        status: 'REPORTED',
        dimensions: [{
          semanticHint: 'decision.domain',
          valueCandidate: 'irrigation trigger',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: { kind: 'WHOLE_ARTIFACT' }
        }]
      };
      return families;
    },
    contextAdjudication: {
      BIOLOGICAL: [], ENVIRONMENTAL: [], MANAGEMENT: [],
      OPERATIONAL: [{ semanticId: 'decision.domain', valueType: 'STRING' }],
      MEASUREMENT: [{ semanticId: 'water.metric', valueType: 'STRING' }],
      JURISDICTION_ECONOMIC: []
    }
  },
  {
    inventory: inventory.sources[1],
    slug: 'umn-corn-early-vegetative-deficit',
    context() {
      const families = blankContext();
      families.BIOLOGICAL = {
        status: 'REPORTED',
        dimensions: [
          {
            semanticHint: 'crop.identity',
            valueCandidate: 'corn',
            supportClass: 'EXPLICIT_SOURCE',
            sourceLocator: { kind: 'WHOLE_ARTIFACT' }
          },
          {
            semanticHint: 'crop.stage',
            valueCandidate: 'early vegetative growth stage',
            supportClass: 'EXPLICIT_SOURCE',
            sourceLocator: { kind: 'WHOLE_ARTIFACT' }
          }
        ]
      };
      families.MEASUREMENT = {
        status: 'REPORTED',
        dimensions: [{
          semanticHint: 'water.metric',
          valueCandidate: 'soil water deficit percent',
          supportClass: 'EXPLICIT_SOURCE',
          sourceLocator: { kind: 'WHOLE_ARTIFACT' }
        }]
      };
      return families;
    },
    contextAdjudication: {
      BIOLOGICAL: [
        { semanticId: 'crop.code', valueType: 'CATEGORY' },
        { semanticId: 'crop.stage', valueType: 'STRING' }
      ],
      ENVIRONMENTAL: [], MANAGEMENT: [], OPERATIONAL: [],
      MEASUREMENT: [{ semanticId: 'water.metric', valueType: 'STRING' }],
      JURISDICTION_ECONOMIC: []
    }
  }
];

const qualified = [];
for (let index = 0; index < sourceSpecs.length; index += 1) {
  const spec = sourceSpecs[index];
  const item = spec.inventory;
  const timeBase = index === 0 ? '2026-09-06T08:37' : '2026-09-06T08:38';
  const curator = { principalId: `adr3b-${spec.slug}-curator`, type: 'USER' };
  const bytes = Buffer.from(`${item.retainedEvidenceText}\n`, 'utf8');

  const source = sourceRegistry.registerSource({
    logicalId: `source.adr3b.${spec.slug}`,
    version: '1',
    sourceType: 'OTHER',
    title: item.title,
    ownership: OWNERSHIP,
    bibliographic: {
      institution: item.institution,
      reviewedLabel: item.reviewedLabel,
      sourceClass: item.sourceClass
    },
    sourceVersionLabel: item.reviewedLabel,
    originLocator: item.originLocator,
    metadata: {
      retrievalTime: item.retrievedAt,
      retentionScope: 'SHORT_SOURCE_EXCERPT_ONLY',
      sourceUse: 'SCIENTIFIC_AUTHORITY_ACQUISITION_TEST_ONLY'
    },
    audit: audit(curator, `${spec.slug}-source`, `${timeBase}:00.000Z`)
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: `artifact.adr3b.${spec.slug}.excerpt`,
    version: '1',
    sourceRef: source.ref,
    bytes,
    mediaType: 'text/plain; charset=utf-8',
    materializationIdentity: `adr3b-${spec.slug}-short-web-excerpt-v1`,
    acquisition: {
      method: 'CURATED_WEB_EXCERPT',
      acquiredAt: item.retrievedAt,
      locator: item.originLocator,
      metadata: {
        exactExcerptRetained: true,
        fullWebPageBytesRetained: false,
        noSemanticEdit: true
      }
    },
    metadata: {
      sourceClass: item.sourceClass,
      copyrightScope: 'SHORT_EVIDENCE_EXCERPT'
    },
    audit: audit(curator, `${spec.slug}-artifact`, `${timeBase}:05.000Z`)
  });
  assert.equal(artifact.semanticPayload.contentHash, item.retainedEvidenceContentHash);

  const compilation = compiler.materializeCompilationProposal({
    compilationLogicalId: `compilation.adr3b.${spec.slug}`,
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: 'source-guidance',
        claimType: item.claimType,
        assertion: item.sourceFaithfulClaim,
        sourceLocator: { kind: 'WHOLE_ARTIFACT' },
        sourceContext: spec.context()
      }],
      runMetadata: {
        benchmark: 'ADR3B_IRRIGATION_SCIENTIFIC_AUTHORITY_ACQUISITION_V1',
        legacyConstantSearchTarget: false
      }
    },
    audit: audit(compilerPrincipal, `${spec.slug}-compile`, `${timeBase}:10.000Z`)
  });

  const reviewer = createPrincipal({
    principalId: `adr3b-${spec.slug}-reviewer`,
    type: 'USER',
    ...OWNERSHIP
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.adr3b.${spec.slug}.reviewer`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: OWNERSHIP,
    audit: audit(reviewer, `${spec.slug}-reviewer-role`, `${timeBase}:15.000Z`)
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.adr3b.${spec.slug}.source-review`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit(reviewer, `${spec.slug}-review-policy`, `${timeBase}:20.000Z`)
  });
  const reviewAuth = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy: reviewPolicy,
      roleAssignments: [reviewerRole],
      authorizationScope: OWNERSHIP
    }),
    audit: serviceAudit('iam-engine', `${spec.slug}-review-auth`, `${timeBase}:25.000Z`)
  });
  const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
    reviewLogicalId: `review.adr3b.${spec.slug}`,
    reviewVersion: '1',
    compilationResultRef: compilation.result.ref,
    claimCandidateRef: compilation.claimCandidates[0].ref,
    sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: spec.contextAdjudication,
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuth.ref,
    claimLogicalId: `claim.adr3b.${spec.slug}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.adr3b.${spec.slug}`,
    sourceContextVersion: '1',
    audit: audit(reviewer, `${spec.slug}-source-faithful-review`, `${timeBase}:30.000Z`)
  });
  assert.equal(reviewed.claim.semanticPayload.assertion, item.sourceFaithfulClaim);

  const approver = createPrincipal({
    principalId: `adr3b-${spec.slug}-scientific-approver`,
    type: 'USER',
    ...OWNERSHIP
  });
  const approverRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.adr3b.${spec.slug}.scientific-approver`,
    version: '1',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: OWNERSHIP,
    audit: audit(approver, `${spec.slug}-approver-role`, `${timeBase}:35.000Z`)
  });
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.adr3b.${spec.slug}.qualification`,
    version: '1',
    resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit(approver, `${spec.slug}-qualification-policy`, `${timeBase}:40.000Z`)
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
    audit: serviceAudit('iam-engine', `${spec.slug}-qualification-auth`, `${timeBase}:45.000Z`)
  });
  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.adr3b.${spec.slug}`,
    decisionVersion: '1',
    claimRef: reviewed.claim.ref,
    sourceContextRef: reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    limitations: item.limitations,
    semanticPreconditions: item.semanticPreconditions,
    rationale: 'Source-faithful university Extension guidance is qualified only within explicit source-supported context and limitations; it does not validate the GEOX legacy absolute threshold.',
    approverPrincipal: approver,
    authorizationDecisionAuditRef: qualificationAuth.ref,
    audit: audit(approver, `${spec.slug}-qualification`, `${timeBase}:50.000Z`)
  });
  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.adr3b.${spec.slug}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(approver, `${spec.slug}-qualified-knowledge`, `${timeBase}:55.000Z`)
  });

  assert.deepEqual(knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);
  assert.equal(knowledge.semanticPayload.qualificationDecisionRefs.length, 1);
  assert.equal(knowledge.semanticPayload.semanticPreconditions.length, item.semanticPreconditions.length);
  assert.ok(knowledge.semanticPayload.limitations.length >= item.limitations.length);
  const frozenPreconditions = knowledge.semanticPayload.semanticPreconditions.map((entry) => entry.value);
  for (const expected of item.semanticPreconditions) {
    assert.ok(frozenPreconditions.some((entry) =>
      entry.semanticId === expected.semanticId
        && entry.operator === expected.operator
        && entry.value === expected.value));
  }
  qualified.push({ source, artifact, reviewed, decision, knowledge });
}

assert.equal(artifactStore.count(), 2);
assert.equal(qualified.length, 2);
assert.equal(qualified.every((entry) => entry.knowledge.ref.kind === 'QualifiedKnowledge'), true);

const sourceAssertions = qualified.map((entry) => entry.reviewed.claim.semanticPayload.assertion).join('\n');
assert.ok(!sourceAssertions.includes('0.22'));
assert.ok(sourceAssertions.includes('management allowable depletion'));
assert.ok(sourceAssertions.includes('60-65 percent'));

// The acquisition intentionally stops before A08/R01/R03/D01 for the selected GEOX subject.
// GEOX establishes canonical %VWC, but current exact evidence does not establish the governed
// VWC -> soil-water-depletion/MAD transformation and target context required by the qualified
// guidance, so manufacturing a compatible target context here would be authority laundering.
const snapshot = ledger.exportSnapshot();
assert.equal(snapshot.records.some((record) => record.ref.kind === 'ApplicabilityAssessment'), false);
assert.equal(snapshot.records.some((record) => record.ref.kind === 'RuntimePlan'), false);
assert.equal(snapshot.records.some((record) => record.ref.kind === 'RuntimeEligibility'), false);
assert.equal(snapshot.records.some((record) => record.ref.kind === 'RuntimeBinding'), false);
assert.equal(snapshot.records.some((record) => record.ref.kind === 'DecisionResult'), false);
assert.equal(snapshot.records.some((record) => record.ref.kind === 'ExecutionReceipt'), false);

console.log(JSON.stringify({
  status: 'PASS',
  contractVersion: inventory.contractVersion,
  selectedMigrationSubject: inventory.selectedMigrationSubject,
  scientificAuthorityCandidate: 'ACQUIRED_AND_TEST_QUALIFIED',
  qualifiedKnowledgeRefs: qualified.map((entry) => entry.knowledge.ref),
  geoxCanonicalSoilMoistureSemantic: inventory.geoxExactEvidence.telemetryMetricCatalog.canonicalUnit,
  comparabilityStatus: inventory.comparabilityAdjudication.status,
  sameDecisionAuthority: inventory.terminalState.sameDecisionAuthorityForSelectedGeoxSubject,
  blockingClass: inventory.terminalState.blockingClass,
  architectureAdjudicationRequired: false,
  cutoverAuthorized: false,
  shadowDualRunAuthorized: false,
  nextRequiredWork: inventory.terminalState.nextRequiredWork
}, null, 2));
