import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { publishRightsPolicy, publishRightsGrant } from '../../packages/rights-authority/src/index.mjs';
import {
  SOURCE_CONTEXT_FAMILIES,
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  authorizeKnowledgeQualification,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { SourceFaithfulReviewService, sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
import { ScientificQualificationService, qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';

export const USE_APPLICABILITY = { use: 'CORN_IRRIGATION_APPLICABILITY' };
export const USE_OTHER = { use: 'OTHER_SCIENTIFIC_USE' };

export function audit(eventId, actorId, actorType = 'USER') {
  return {
    eventId,
    occurredAt: '2026-08-15T15:50:00.000Z',
    actor: { type: actorType, id: actorId },
    details: { channel: 'k05-acceptance' }
  };
}

export function createEnvironment() {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const approver = createPrincipal({
    principalId: 'scientific-approver-k05',
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const approverRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: 'role.k05.scientific-approver',
    version: '1',
    principal: approver,
    role: 'SCIENTIFIC_APPROVER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-role-scientific-approver', 'iam-admin')
  });
  return { ledger, sourceRegistry, approver, approverRole };
}

function contextProposal(text) {
  const families = Object.fromEntries(SOURCE_CONTEXT_FAMILIES.map((family) => [family, { status: 'NOT_REPORTED', dimensions: [] }]));
  families.BIOLOGICAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'crop.identity',
      valueCandidate: 'maize',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  families.ENVIRONMENTAL = {
    status: 'REPORTED',
    dimensions: [{
      semanticHint: 'soil.context',
      valueCandidate: text.includes('silt') ? 'silt loam' : 'sandy loam',
      supportClass: 'EXPLICIT_SOURCE',
      sourceLocator: { kind: 'WHOLE_ARTIFACT' }
    }]
  };
  return families;
}

function contextAdjudication() {
  return {
    BIOLOGICAL: [{ semanticId: 'crop.code', valueType: 'CATEGORY' }],
    ENVIRONMENTAL: [{ semanticId: 'soil.texture', valueType: 'CATEGORY' }],
    MANAGEMENT: [],
    OPERATIONAL: [],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  };
}

// Acceptance-only licensed source fixture: original retention authority and a later
// display grant are distinct, even though they use the same native policy.
export function licensedPublicationFixture(label,owner){
  const title='TEST_ONLY licensed publication '+label;
  const licenseUrl='https://creativecommons.org/licenses/by/4.0/';
  const rights={license:'CC-BY-4.0',licenseUrl,attribution:'TEST_ONLY authors, '+title+'. CC BY 4.0 '+licenseUrl};
  const obligation='RETAIN_SOURCE_ATTRIBUTION_LICENSE_ADAPTATION_NOTICE';
  return {sourceType:'PUBLICATION',title,rights,bibliographic:{citation:'TEST_ONLY publication, '+label},createRightsSnapshot({ledger,source,ownership}){
    const policy=publishRightsPolicy({ledger,logicalId:'policy.licensed.'+label,version:'1',ownership,ownerPrincipal:owner,basis:{class:'LICENSE',evidenceRefs:[source.ref]},audit:audit('policy.licensed.'+label,owner.principalId,owner.type)});
    const grant=publishRightsGrant({ledger,logicalId:'grant.retention.'+label,version:'1',rightsPolicyRef:policy.ref,subjectRef:source.ref,grantee:{organizationId:owner.organizationId,tenantId:owner.tenantId,principalId:owner.principalId,principalType:owner.type},rules:[{operation:'RETAIN_FULLTEXT',purposes:['TEST_ONLY_RETENTION'],jurisdictions:['US'],obligations:['INTERNAL_ONLY_NO_EGRESS',obligation]}],validFrom:'2026-08-15T15:50:00.000Z',validUntil:'2026-08-16T00:00:00.000Z',grantorPrincipal:owner,audit:audit('grant.retention.'+label,owner.principalId,owner.type)});
    return {...rights,policyRef:policy.ref,sourceGrantRef:grant.ref,obligations:['INTERNAL_ONLY_NO_EGRESS',obligation]};
  }};
}

export function makeQualifiedKnowledge(env, {
  label,
  assertion,
  ownership = { organizationId: 'org-a', tenantId: 'tenant-a' },
  useTarget = USE_APPLICABILITY,
  sourceFixture = null
}) {
  const { ledger, sourceRegistry } = env;
  const source = sourceRegistry.registerSource({
    logicalId: `source.${label}`,
    version: '1',
    sourceType: sourceFixture?.sourceType??'PROTOCOL',
    title: sourceFixture?.title??`K05 source ${label}`,
    ...(sourceFixture?{rights:sourceFixture.rights,bibliographic:sourceFixture.bibliographic}:{}),
    ownership,
    audit: audit(`evt-source-${label}`, 'source-admin')
  });
  const text = `${assertion} Context: ${label.includes('a') ? 'silt loam' : 'sandy loam'}.`;
  const rightsSnapshot=sourceFixture?.createRightsSnapshot({ledger,source,ownership});
  const artifact = sourceRegistry.materializeArtifact({
    ...(rightsSnapshot?{rightsSnapshot}:{}),
    logicalId: `artifact.${label}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(text, 'utf8'),
    mediaType: 'text/plain',
    materializationIdentity: `fixture-${label}`,
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-15T15:45:00Z' },
    audit: audit(`evt-artifact-${label}`, 'source-admin')
  });
  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: `compiler.${label}`,
    version: '1',
    compilerId: `adr.k05.${label}`,
    implementationVersion: '1',
    configuration: { fixture: label },
    audit: audit(`evt-compiler-${label}`, 'compiler-admin')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const bundle = compiler.materializeCompilationProposal({
    compilationLogicalId: `compilation.${label}`,
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: {
      claims: [{
        key: label,
        claimType: 'OPERATIONAL_RECOMMENDATION',
        assertion,
        sourceLocator: { kind: 'WHOLE_ARTIFACT' },
        sourceContext: contextProposal(text)
      }]
    },
    audit: audit(`evt-compilation-${label}`, 'compiler-service', 'SERVICE_ACCOUNT')
  });

  const reviewer = createPrincipal({
    principalId: `reviewer-${label}`,
    type: 'USER',
    organizationId: ownership.organizationId,
    ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
  });
  const reviewerRole = publishBuiltinRoleAssignment({
    ledger,
    logicalId: `role.reviewer.${label}`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: ownership,
    audit: audit(`evt-review-role-${label}`, 'iam-admin')
  });
  const reviewPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.review.${label}`,
    version: '1',
    resourceId: sourceReviewResourceId(source.ref),
    ownership,
    visibilityPolicy: [{ principalId: reviewer.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: ownership.organizationId }],
    audit: audit(`evt-review-policy-${label}`, 'iam-admin')
  });
  const reviewAuth = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeInspection({
      principal: reviewer,
      policy: reviewPolicy,
      roleAssignments: [reviewerRole],
      authorizationScope: ownership
    }),
    audit: audit(`evt-review-auth-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  const reviewed = new SourceFaithfulReviewService({ ledger }).reviewCandidate({
    reviewLogicalId: `review.${label}`,
    reviewVersion: '1',
    compilationResultRef: bundle.result.ref,
    claimCandidateRef: bundle.claimCandidates[0].ref,
    sourceContextCandidateRef: bundle.sourceContextCandidates[0].ref,
    disposition: 'ACCEPT_SOURCE_FAITHFUL',
    contextAdjudication: contextAdjudication(),
    reviewPrincipal: reviewer,
    authorizationDecisionAuditRef: reviewAuth.ref,
    claimLogicalId: `claim.${label}`,
    claimVersion: '1',
    sourceContextLogicalId: `source-context.${label}`,
    sourceContextVersion: '1',
    audit: audit(`evt-source-faithful-${label}`, reviewer.principalId)
  });

  const approver = ownership.organizationId === env.approver.organizationId && (ownership.tenantId ?? null) === (env.approver.tenantId ?? null)
    ? env.approver
    : createPrincipal({ principalId: `approver-${label}`, type: 'USER', organizationId: ownership.organizationId, ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {}) });
  const approverRole = approver === env.approver
    ? env.approverRole
    : publishBuiltinRoleAssignment({ ledger, logicalId: `role.approver.${label}`, version: '1', principal: approver, role: 'SCIENTIFIC_APPROVER', scope: ownership, audit: audit(`evt-approver-role-${label}`, 'iam-admin') });
  const qualificationPolicy = publishKnowledgeGovernancePolicy({
    ledger,
    logicalId: `policy.qualification.${label}`,
    version: '1',
    resourceId: qualificationResourceId(reviewed.claim.ref, reviewed.sourceContext.ref),
    ownership,
    visibilityPolicy: [{ principalId: approver.principalId }],
    qualificationScope: [{ use: '*' }],
    deploymentScope: [{ organizationId: ownership.organizationId }],
    audit: audit(`evt-qualification-policy-${label}`, 'iam-admin')
  });
  const qualificationAuth = recordAuthorizationDecision({
    ledger,
    decision: authorizeKnowledgeQualification({
      principal: approver,
      policy: qualificationPolicy,
      roleAssignments: [approverRole],
      qualificationTarget: useTarget,
      authorizationScope: ownership
    }),
    audit: audit(`evt-qualification-auth-${label}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  const qualification = new ScientificQualificationService({ ledger });
  const decision = qualification.recordQualificationDecision({
    decisionLogicalId: `qualification.${label}`,
    decisionVersion: '1',
    claimRef: reviewed.claim.ref,
    sourceContextRef: reviewed.sourceContext.ref,
    disposition: 'QUALIFY_USE',
    qualificationTarget: useTarget,
    semanticPreconditions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    approverPrincipal: approver,
    authorizationDecisionAuditRef: qualificationAuth.ref,
    audit: audit(`evt-qualification-${label}`, approver.principalId)
  });
  const knowledge = qualification.publishQualifiedKnowledge({
    qualifiedKnowledgeLogicalId: `knowledge.${label}`,
    qualifiedKnowledgeVersion: '1',
    qualificationDecisionRefs: [decision.ref],
    audit: audit(`evt-qualified-${label}`, approver.principalId)
  });
  return { source, artifact, bundle, reviewed, qualification, decision, knowledge, approver, approverRole, ownership };
}

export function authorizeForResource(env, {
  resourceId,
  qualificationTarget,
  logicalId,
  ownership = { organizationId: 'org-a', tenantId: 'tenant-a' },
  principal = env.approver,
  roleAssignment = env.approverRole
}) {
  const policy = publishKnowledgeGovernancePolicy({
    ledger: env.ledger,
    logicalId: `policy.${logicalId}`,
    version: '1',
    resourceId,
    ownership,
    visibilityPolicy: [{ principalId: principal.principalId }],
    qualificationScope: [qualificationTarget],
    deploymentScope: [{ organizationId: ownership.organizationId }],
    audit: audit(`evt-policy-${logicalId}`, 'iam-admin')
  });
  const authAudit = recordAuthorizationDecision({
    ledger: env.ledger,
    decision: authorizeKnowledgeQualification({
      principal,
      policy,
      roleAssignments: [roleAssignment],
      qualificationTarget,
      authorizationScope: ownership
    }),
    audit: audit(`evt-auth-${logicalId}`, 'iam-engine', 'SERVICE_ACCOUNT')
  });
  return { policy, authAudit };
}
