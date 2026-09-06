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
  tenantId: 'adr3b-root-zone-soil-water-authority'
});

const CSU_URL = 'https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/';
const FAO_URL = 'https://www.fao.org/4/X0490E/x0490e0e.htm';
const CSU_HASH = 'sha256:dffc94d96dbe52510a5dc58bc3184bc3d08efb5e08451e30aef8469b79cd519c';
const FAO_HASH = 'sha256:b0190a73c22fca43342eb75f93ab2c9653e7e0c1a89cda935e374033516a2266';

let seq = 0;
function audit(actorId, suffix, actorType = 'USER') {
  seq += 1;
  return {
    eventId: `evt-adr3b-root-zone-${seq}-${suffix}`,
    occurredAt: '2026-09-06T12:20:00.000Z',
    actor: { type: actorType, id: actorId },
    details: {
      suite: 'adr3b-root-zone-soil-water-authority',
      classification: 'QUALIFICATION_ONLY_SCIENTIFIC_AUTHORITY_CANDIDATE',
      cutoverAuthorized: false
    }
  };
}

function wholeArtifact() {
  return { kind: 'WHOLE_ARTIFACT' };
}

function contextFamilies({ operational = [], measurement = [] } = {}) {
  const families = Object.fromEntries(
    SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }])
  );
  if (operational.length > 0) {
    families.OPERATIONAL = {
      status: 'REPORTED',
      dimensions: operational.map((dimension) => ({
        semanticHint: dimension.semanticHint,
        valueCandidate: dimension.valueCandidate,
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: wholeArtifact()
      }))
    };
  }
  if (measurement.length > 0) {
    families.MEASUREMENT = {
      status: 'REPORTED',
      dimensions: measurement.map((dimension) => ({
        semanticHint: dimension.semanticHint,
        valueCandidate: dimension.valueCandidate,
        supportClass: 'EXPLICIT_SOURCE',
        sourceLocator: wholeArtifact()
      }))
    };
  }
  return families;
}

function contextAdjudication({ operational = [], measurement = [] } = {}) {
  return {
    BIOLOGICAL: [],
    ENVIRONMENTAL: [],
    MANAGEMENT: [],
    OPERATIONAL: operational.map((dimension) => ({ semanticId: dimension.semanticId, valueType: 'CATEGORY' })),
    MEASUREMENT: measurement.map((dimension) => ({ semanticId: dimension.semanticId, valueType: 'CATEGORY' })),
    JURISDICTION_ECONOMIC: []
  };
}

const ledger = new AuthorityLedger();
const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
const qualificationService = new ScientificQualificationService({ ledger });

function qualifySource({
  key,
  bytes,
  expectedHash,
  source,
  artifact,
  claim,
  operational = [],
  measurement = [],
  semanticPreconditions = [],
  limitations = [],
  transportConstraints = []
}) {
  assert.equal(sourceContentHash(bytes), expectedHash);
  assert.equal(bytes.toString('utf8').includes('0.22'), false);

  const sourceRecord = sourceRegistry.registerSource({
    logicalId: source.logicalId,
    version: '1',
    sourceType: 'PUBLICATION',
    title: source.title,
    ownership: OWNERSHIP,
    bibliographic: source.bibliographic,
    sourceVersionLabel: source.sourceVersionLabel,
    originLocator: source.originLocator,
    metadata: {
      retainedArtifactScope: 'MINIMAL_SOURCE_FAITHFUL_EXCERPT',
      fullSourceVendored: false,
      migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1'
    },
    audit: audit(`${key}-source-curator`, `${key}-source`)
  });

  const artifactRecord = sourceRegistry.materializeArtifact({
    logicalId: artifact.logicalId,
    version: '1',
    sourceRef: sourceRecord.ref,
    bytes,
    mediaType: 'text/plain; charset=utf-8',
    materializationIdentity: artifact.materializationIdentity,
    acquisition: {
      method: 'CURATED_WEB_EXCERPT',
      acquiredAt: '2026-09-06T12:15:00.000Z',
      locator: source.originLocator,
      metadata: {
        transcriptionPolicy: 'EXACT_MINIMAL_EXCERPT_NO_SEMANTIC_EDIT',
        fullSourceRetainedByThisFixture: false
      }
    },
    metadata: { exactExcerptBytesRetained: true, fullSourceRetained: false },
    audit: audit(`${key}-source-curator`, `${key}-artifact`)
  });
  assert.equal(artifactRecord.semanticPayload.contentHash, expectedHash);

  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: `compiler.${key}`,
    version: '1',
    compilerId: `adr.${key}.curated`,
    implementationVersion: '1',
    configuration: {
      sourcePolicy: 'CURATED_SOURCE_FAITHFUL_EXCERPT',
      locatorScheme: 'WHOLE_ARTIFACT'
    },
    audit: audit(`${key}-compiler`, `${key}-compiler`, 'SERVICE_ACCOUNT')
  });

  const compilation = new ScientificCompiler({ ledger, sourceRegistry }).materializeCompilationProposal({
    compilationLogicalId: `compilation.${key}`,
    version: '1',
    sourceArtifactRef: artifactRecord.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: claim.key,
        claimType: claim.claimType,
        assertion: claim.assertion,
        sourceLocator: wholeArtifact(),
        sourceContext: contextFamilies({ operational, measurement })
      }],
      runMetadata: {
        milestone: 'ADR_3B_ROOT_ZONE_SOIL_WATER_SCIENTIFIC_AUTHORITY',
        migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1',
        productionPolicyCandidate: false
      }
    },
    audit: audit(`${key}-compiler`, `${key}-compilation`, 'SERVICE_ACCOUNT')
  });

  const reviewer = createPrincipal({
    principalId: `${key}-reviewer`,
    type: 'USER',
    ...OWNERSHIP
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.${key}.reviewer`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: OWNERSHIP,
    audit: audit('adr3b-iam-admin', `${key}-reviewer-role`)
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.${key}.source-review`,
    version: '1',
    resourceId: sourceReviewResourceId(sourceRecord.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit('adr3b-iam-admin', `${key}-review-policy`)
  });
  const reviewAuth = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy: reviewPolicy,
      roleAssignments: [reviewerRole],
      authorizationScope: OWNERSHIP
    }),
    audit: audit('adr3b-iam-engine', `${key}-review-auth`, 'SERVICE_ACCOUNT')
  });

  const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
    reviewLogicalId: `review.${key}`,
    reviewVersion: '1',
    compilationResultRef: compilation.result.ref,
    claimCandidateRef: compilation.claimCandidates[0].ref,
    sourceContextCandidateRef: compilation.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    rationale: 'Retain only source-supported root-zone soil-water semantics; do not transport legacy GEOX constants.',
    contextAdjudication: contextAdjudication({ operational, measurement }),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuth.ref,
    claimLogicalId: claim.logicalId,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.${key}`,
    sourceContextVersion: '1',
    audit: audit(reviewer.principalId, `${key}-source-faithful-review`)
  });

  const approver = createPrincipal({
    principalId: `${key}-scientific-approver`,
    type: 'USER',
    ...OWNERSHIP
  });
  const approverRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.${key}.scientific-approver`,
    version: '1',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: OWNERSHIP,
    audit: audit('adr3b-iam-admin', `${key}-approver-role`)
  });
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.${key}.qualification`,
    version: '1',
    resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
    ownership: OWNERSHIP,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: OWNERSHIP.organizationId }],
    audit: audit('adr3b-iam-admin', `${key}-qualification-policy`)
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
    audit: audit('adr3b-iam-engine', `${key}-qualification-auth`, 'SERVICE_ACCOUNT')
  });

  const decision = qualificationService.recordQualificationDecision({
    decisionLogicalId: `qualification.${key}`,
    decisionVersion: '1',
    claimRef: reviewed.claim.ref,
    sourceContextRef: reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
    semanticPreconditions,
    limitations,
    transportConstraints,
    approverPrincipal: approver,
    authorizationDecisionAuditRef: qualificationAuth.ref,
    audit: audit(approver.principalId, `${key}-qualification`)
  });

  const knowledge = qualificationService.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.${key}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(approver.principalId, `${key}-qualified-knowledge`)
  });

  return Object.freeze({
    source: sourceRecord,
    artifact: artifactRecord,
    claim: reviewed.claim,
    sourceContext: reviewed.sourceContext,
    qualificationDecision: decision,
    knowledge
  });
}

const csuBytes = readFileSync(new URL('./csu-current-day-root-zone-deficit.txt', import.meta.url));
const csu = qualifySource({
  key: 'adr3b-csu-root-zone-deficit',
  bytes: csuBytes,
  expectedHash: CSU_HASH,
  source: {
    logicalId: 'source.adr3b-csu-irrigation-water-balance',
    title: 'Irrigation Scheduling: The Water Balance Approach',
    bibliographic: {
      institution: 'Colorado State University Extension',
      authors: ['T. A. Bauder', 'Jose Chavez', 'Allan Andales'],
      published: '2015-01',
      reviewed: '2025-08',
      peerReviewed: true
    },
    sourceVersionLabel: 'reviewed-2025-08',
    originLocator: CSU_URL
  },
  artifact: {
    logicalId: 'artifact.adr3b-csu-current-day-root-zone-deficit',
    materializationIdentity: 'csu-irrigation-water-balance-root-zone-deficit-excerpt-v1'
  },
  claim: {
    key: 'current-day-root-zone-deficit',
    claimType: 'SEMANTIC_DEFINITION',
    logicalId: 'claim.adr3b-csu-current-day-root-zone-deficit',
    assertion: 'For irrigation scheduling, D_c denotes the current-day soil-water deficit (net irrigation requirement) in the root zone.'
  },
  operational: [
    { semanticHint: 'decision.domain', semanticId: 'decision.domain', valueCandidate: 'irrigation scheduling' }
  ],
  measurement: [
    { semanticHint: 'soil_water.metric', semanticId: 'soil_water.metric', valueCandidate: 'soil water deficit' },
    { semanticHint: 'soil_water.spatial_support', semanticId: 'soil_water.spatial_support', valueCandidate: 'root zone' },
    { semanticHint: 'soil_water.temporal_support', semanticId: 'soil_water.temporal_support', valueCandidate: 'current day' }
  ],
  semanticPreconditions: [
    { semanticId: 'decision.domain', operator: 'EQUALS', value: 'irrigation scheduling' },
    { semanticId: 'soil_water.metric', operator: 'EQUALS', value: 'soil water deficit' },
    { semanticId: 'soil_water.spatial_support', operator: 'EQUALS', value: 'root zone' }
  ],
  limitations: [
    { code: 'NO_POINT_VWC_TO_ROOT_ZONE_DEFICIT_TRANSFORM_AUTHORITY' },
    { code: 'NO_TARGET_SPECIFIC_ROOT_DEPTH_OR_FIELD_CAPACITY_AUTHORITY' }
  ],
  transportConstraints: [
    { code: 'REQUIRES_GOVERNED_ROOT_ZONE_STATE' }
  ]
});

const faoBytes = readFileSync(new URL('./fao56-taw-root-zone-equation.txt', import.meta.url));
const fao = qualifySource({
  key: 'adr3b-fao56-root-zone-taw',
  bytes: faoBytes,
  expectedHash: FAO_HASH,
  source: {
    logicalId: 'source.adr3b-fao56-water-stress-chapter8',
    title: 'FAO Irrigation and Drainage Paper 56 — Chapter 8: ETc under soil water stress conditions',
    bibliographic: {
      institution: 'Food and Agriculture Organization of the United Nations',
      publication: 'Crop evapotranspiration — Guidelines for computing crop water requirements',
      publicationNumber: 'FAO Irrigation and Drainage Paper 56',
      year: '1998'
    },
    sourceVersionLabel: 'FAO-56',
    originLocator: FAO_URL
  },
  artifact: {
    logicalId: 'artifact.adr3b-fao56-root-zone-taw-equation',
    materializationIdentity: 'fao56-chapter8-root-zone-taw-equation-excerpt-v1'
  },
  claim: {
    key: 'root-zone-total-available-water',
    claimType: 'RELATIONSHIP',
    logicalId: 'claim.adr3b-fao56-root-zone-total-available-water',
    assertion: 'Total available soil water in the root zone, in millimetres, equals 1000 times the difference between field-capacity and wilting-point volumetric water content times rooting depth in metres.'
  },
  measurement: [
    { semanticHint: 'soil_water.metric', semanticId: 'soil_water.metric', valueCandidate: 'total available soil water' },
    { semanticHint: 'soil_water.spatial_support', semanticId: 'soil_water.spatial_support', valueCandidate: 'root zone' }
  ],
  semanticPreconditions: [
    { semanticId: 'soil_water.metric', operator: 'EQUALS', value: 'total available soil water' },
    { semanticId: 'soil_water.spatial_support', operator: 'EQUALS', value: 'root zone' }
  ],
  limitations: [
    { code: 'NO_TARGET_SPECIFIC_FIELD_CAPACITY_WILTING_POINT_OR_ROOT_DEPTH_VALUES' }
  ],
  transportConstraints: [
    { code: 'REQUIRES_GOVERNED_FIELD_CAPACITY_WILTING_POINT_ROOT_DEPTH' }
  ]
});

assert.equal(csu.knowledge.ref.kind, 'QualifiedKnowledge');
assert.equal(fao.knowledge.ref.kind, 'QualifiedKnowledge');
assert.deepEqual(csu.knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);
assert.deepEqual(fao.knowledge.semanticPayload.allowedUses, [AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE]);

const csuFamilies = csu.sourceContext.semanticPayload.contextFamilies;
assert.equal(csuFamilies.OPERATIONAL.status, 'REPORTED');
assert.equal(csuFamilies.MEASUREMENT.status, 'REPORTED');
assert.equal(csuFamilies.BIOLOGICAL.status, 'NOT_REPORTED');
assert.equal(csuFamilies.ENVIRONMENTAL.status, 'NOT_REPORTED');
assert.equal(csuFamilies.MANAGEMENT.status, 'NOT_REPORTED');
assert.equal(csuFamilies.JURISDICTION_ECONOMIC.status, 'NOT_REPORTED');

const faoFamilies = fao.sourceContext.semanticPayload.contextFamilies;
assert.equal(faoFamilies.MEASUREMENT.status, 'REPORTED');
for (const family of ['BIOLOGICAL', 'ENVIRONMENTAL', 'MANAGEMENT', 'OPERATIONAL', 'JURISDICTION_ECONOMIC']) {
  assert.equal(faoFamilies[family].status, 'NOT_REPORTED');
}

for (const record of [
  csu.source,
  csu.artifact,
  csu.claim,
  csu.sourceContext,
  csu.qualificationDecision,
  csu.knowledge,
  fao.source,
  fao.artifact,
  fao.claim,
  fao.sourceContext,
  fao.qualificationDecision,
  fao.knowledge
]) {
  assert.equal(JSON.stringify(record).includes('0.22'), false);
}

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_3B_ROOT_ZONE_SOIL_WATER_SCIENTIFIC_AUTHORITY',
  classification: 'QUALIFICATION_ONLY_SCIENTIFIC_AUTHORITY_CANDIDATES',
  migrationSubject: 'GEOX-COMMERCIAL-IRRIGATION-DEFICIT-V1',
  currentDayRootZoneDeficit: {
    sourceRef: csu.source.ref,
    sourceArtifactRef: csu.artifact.ref,
    claimRef: csu.claim.ref,
    sourceContextRef: csu.sourceContext.ref,
    scientificQualificationDecisionRef: csu.qualificationDecision.ref,
    qualifiedKnowledgeRef: csu.knowledge.ref
  },
  rootZoneTotalAvailableWater: {
    sourceRef: fao.source.ref,
    sourceArtifactRef: fao.artifact.ref,
    claimRef: fao.claim.ref,
    sourceContextRef: fao.sourceContext.ref,
    scientificQualificationDecisionRef: fao.qualificationDecision.ref,
    qualifiedKnowledgeRef: fao.knowledge.ref
  },
  legacyThresholdLaundered: false,
  targetSpecificFieldCapacityPublished: false,
  targetSpecificWiltingPointPublished: false,
  targetSpecificRootDepthPublished: false,
  rootZoneStateValuePublished: false,
  productionPolicyPublished: false,
  decisionResultPublished: false,
  runtimePublished: false,
  geoxWritePerformed: false,
  cutoverAuthorized: false,
  nextFrontier: 'ROOT_ZONE_MEASUREMENT_REQUIREMENT_AND_BINDING_ADEQUACY'
}, null, 2));