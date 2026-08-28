import assert from 'node:assert/strict';

import {
  AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE,
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
  AgronomicSourceAuthorityRoutingCompilationError,
  agronomicSourceAuthorityRoutingHash,
  publishAgronomicSourceAuthorityRoutingCompilation,
  publishAgronomicSourceAuthorityRoutingReviewDecision,
  validateAgronomicSourceAuthorityRoutingCompilationAuthority
} from '../../packages/agronomic-policy-compilation/src/index.mjs';
import {
  authorizeKnowledgeInspection,
  createPrincipal,
  publishBuiltinRoleAssignment,
  publishKnowledgeGovernancePolicy,
  recordAuthorizationDecision
} from '../../packages/authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../packages/knowledge-registry/src/source-faithful.mjs';
import {
  audit,
  createEnvironment,
  makeQualifiedKnowledge
} from '../derived-knowledge/fixture.mjs';

const PLANNING =
  'This working protocol is used for planning purposes; refer to the field record for actual field operations during 2015.';
const ACTUAL =
  'A narrative log of agronomic activities or observations made on field treatments.';

function expectError(fn, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof AgronomicSourceAuthorityRoutingCompilationError);
  assert.equal(caught.code, code);
}

function reviewerAuthorization(env, sources, label) {
  const reviewer = createPrincipal({
    principalId: `source-routing-reviewer-${label}`,
    type: 'USER',
    organizationId: 'org-a',
    tenantId: 'tenant-a'
  });
  const role = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: `role.source-routing-reviewer.${label}`,
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit(`evt-source-routing-role-${label}`, 'iam-admin')
  });
  const refs = sources.map((source, index) => {
    const policy = publishKnowledgeGovernancePolicy({
      ledger: env.ledger,
      logicalId: `policy.source-routing-review.${label}.${index}`,
      version: '1',
      resourceId: sourceReviewResourceId(source.ref),
      ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
      visibilityPolicy: [{ principalId: reviewer.principalId }],
      qualificationScope: [{ use: '*' }],
      deploymentScope: [{ organizationId: 'org-a' }],
      audit: audit(`evt-source-routing-policy-${label}-${index}`, 'iam-admin')
    });
    return recordAuthorizationDecision({
      ledger: env.ledger,
      decision: authorizeKnowledgeInspection({
        principal: reviewer,
        policy,
        roleAssignments: [role],
        authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a' }
      }),
      audit: audit(
        `evt-source-routing-auth-${label}-${index}`,
        'iam-engine',
        'SERVICE_ACCOUNT'
      )
    }).ref;
  });
  return { reviewer, refs };
}

function routing(planning, actual, overrides = {}) {
  return {
    contractVersion: AGRONOMIC_SOURCE_AUTHORITY_ROUTING_CONTRACT_VERSION,
    routingId: 'fixture.scoped-planning-to-record',
    sourceExpression: PLANNING,
    actualOperationRecordSourceExpression: ACTUAL,
    planningSourceRef: planning.source.ref,
    actualOperationRecordSourceRef: actual.source.ref,
    subjectScope: 'FIELD_OPERATION_OCCURRENCE',
    planningRole: 'PLANNED_MANAGEMENT_GUIDANCE',
    actualOperationRole: 'ACTUAL_FIELD_OPERATION_RECORD',
    routingRelation: 'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE',
    temporalScope: { kind: 'CALENDAR_YEAR', year: 2015 },
    authorityBindings: [
      {
        role: 'PLANNING_ROUTING_ASSERTION',
        authorityRef: planning.knowledge.ref,
        rationale: 'Exact planning knowledge establishes the scoped routing statement.'
      },
      {
        role: 'ACTUAL_OPERATION_RECORD_SOURCE_IDENTITY',
        authorityRef: actual.knowledge.ref,
        rationale: 'Exact record-source knowledge establishes actual-operation record identity.'
      }
    ],
    transformationRationale:
      'Preserve scoped source roles without global precedence, execution synthesis or missing-record inference.',
    ...overrides
  };
}

function review(env, planning, actual, value, label) {
  const authz = reviewerAuthorization(
    env,
    [planning.source, actual.source],
    label
  );
  const reviewRecord = publishAgronomicSourceAuthorityRoutingReviewDecision({
    ledger: env.ledger,
    logicalId: `review.source-routing.${label}`,
    version: '1',
    planningKnowledgeRefs: [planning.knowledge.ref],
    actualOperationRecordKnowledgeRefs: [actual.knowledge.ref],
    planningSourceArtifactRefs: [planning.artifact.ref],
    actualOperationRecordSourceArtifactRefs: [actual.artifact.ref],
    routing: value,
    disposition: 'ACCEPT_SOURCE_AUTHORITY_ROUTING',
    reviewerPrincipal: authz.reviewer,
    authorizationDecisionAuditRefs: authz.refs,
    rationale:
      'Authorized semantic review confirms scoped planning and actual-operation record roles without whole-source precedence.',
    audit: audit(
      `evt-source-routing-review-${label}`,
      authz.reviewer.principalId
    )
  });
  return { reviewRecord, reviewer: authz.reviewer };
}

function compilation(planning, actual, value, reviewRef, status = 'COMPLETE') {
  return {
    contractVersion:
      AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_COMPILATION_AUTHORITY',
    planningSourceArtifactRefs: [planning.artifact.ref],
    actualOperationRecordSourceArtifactRefs: [actual.artifact.ref],
    planningKnowledgeRefs: [planning.knowledge.ref],
    actualOperationRecordKnowledgeRefs: [actual.knowledge.ref],
    routing: value,
    routingHash: agronomicSourceAuthorityRoutingHash(value),
    semanticReviewRef: reviewRef,
    losslessCoverage: {
      status,
      coveredElements: [
        'PLANNING_SOURCE',
        'ACTUAL_OPERATION_RECORD_SOURCE',
        'FIELD_OPERATION_OCCURRENCE_SCOPE',
        'SCOPED_ROUTING',
        'CALENDAR_YEAR'
      ],
      unrepresentedElements:
        status === 'COMPLETE' ? [] : ['UNRESOLVED_ROUTING_ELEMENT']
    },
    limitations: [
      'ROUTING_NOT_GLOBAL_SOURCE_PRECEDENCE',
      'ROUTING_NOT_EXECUTION_EVENT',
      'MISSING_RECORD_NOT_NON_EXECUTION',
      'ROUTING_NOT_OUTCOME'
    ]
  };
}

const env = createEnvironment();
const planning = makeQualifiedKnowledge(env, {
  label: 'source-routing-planning',
  assertion: PLANNING,
  useTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
});
const actual = makeQualifiedKnowledge(env, {
  label: 'source-routing-actual-record',
  assertion: ACTUAL,
  useTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
});

const value = routing(planning, actual);
const accepted = review(env, planning, actual, value, 'base');
const published = publishAgronomicSourceAuthorityRoutingCompilation({
  ledger: env.ledger,
  logicalId: 'source-routing-compilation.fixture',
  version: '1',
  compilation: compilation(
    planning,
    actual,
    value,
    accepted.reviewRecord.ref
  ),
  audit: audit(
    'evt-source-routing-publication',
    accepted.reviewer.principalId
  )
});
const validated =
  validateAgronomicSourceAuthorityRoutingCompilationAuthority({
    ledger: env.ledger,
    compilationRef: published.ref
  });

assert.equal(
  validated.semanticPayload.routing.subjectScope,
  'FIELD_OPERATION_OCCURRENCE'
);
assert.equal(
  validated.semanticPayload.routing.routingRelation,
  'ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE'
);
assert.equal(validated.semanticPayload.routing.temporalScope.year, 2015);
assert.notDeepEqual(
  validated.planningSource.ref,
  validated.actualOperationRecordSource.ref
);

expectError(() => publishAgronomicSourceAuthorityRoutingCompilation({
  ledger: env.ledger,
  logicalId: 'source-routing-compilation.fixture.incomplete',
  version: '1',
  compilation: compilation(
    planning,
    actual,
    value,
    accepted.reviewRecord.ref,
    'INCOMPLETE'
  ),
  audit: audit(
    'evt-source-routing-incomplete',
    accepted.reviewer.principalId
  )
}), 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_INCOMPLETE_NOT_PUBLISHABLE');

const unrelated = makeQualifiedKnowledge(env, {
  label: 'source-routing-unrelated-record',
  assertion: ACTUAL,
  useTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
});
const unrelatedValue = routing(planning, actual, {
  actualOperationRecordSourceRef: unrelated.source.ref
});
expectError(
  () => review(env, planning, actual, unrelatedValue, 'unrelated-actual-source'),
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SOURCE_WORLD_MISMATCH'
);

const sourceMismatch = routing(planning, actual, {
  actualOperationRecordSourceExpression:
    'An absent record-source identity expression.'
});
expectError(
  () => review(env, planning, actual, sourceMismatch, 'actual-expression-mismatch'),
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_SOURCE_EXPRESSION_MISMATCH'
);

const yearMismatch = routing(planning, actual, {
  temporalScope: { kind: 'CALENDAR_YEAR', year: 2016 }
});
expectError(
  () => review(env, planning, actual, yearMismatch, 'year-mismatch'),
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_TEMPORAL_SOURCE_MISMATCH'
);

const wrongUse = makeQualifiedKnowledge(env, {
  label: 'source-routing-wrong-use',
  assertion: ACTUAL,
  useTarget: { use: 'OTHER_SCIENTIFIC_USE' }
});
const wrongUseValue = routing(planning, wrongUse);
expectError(
  () => review(env, planning, wrongUse, wrongUseValue, 'wrong-use'),
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_KNOWLEDGE_AUTHORITY_INVALID'
);

// A separate environment proves whole-source supersession is rejected without
// contaminating the valid routing world's lineage.
const supersessionEnv = createEnvironment();
const supPlanning = makeQualifiedKnowledge(supersessionEnv, {
  label: 'source-routing-sup-planning',
  assertion: PLANNING,
  useTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
});
const supActual = makeQualifiedKnowledge(supersessionEnv, {
  label: 'source-routing-sup-actual',
  assertion: ACTUAL,
  useTarget: AGRONOMIC_POLICY_REQUIRED_KNOWLEDGE_USE
});
supersessionEnv.sourceRegistry.linkSourceSupersedes({
  newerSourceRef: supActual.source.ref,
  olderSourceRef: supPlanning.source.ref,
  audit: audit('evt-source-routing-forbidden-supersedes', 'source-admin')
});
expectError(
  () => review(
    supersessionEnv,
    supPlanning,
    supActual,
    routing(supPlanning, supActual),
    'forbidden-supersedes'
  ),
  'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_WHOLE_SOURCE_SUPERSESSION_FORBIDDEN'
);

const drifted = structuredClone(
  compilation(planning, actual, value, accepted.reviewRecord.ref)
);
drifted.routing.transformationRationale =
  'Different reviewed routing semantics are not authorized by the original review.';
drifted.routingHash = agronomicSourceAuthorityRoutingHash(drifted.routing);
expectError(() => publishAgronomicSourceAuthorityRoutingCompilation({
  ledger: env.ledger,
  logicalId: 'source-routing-compilation.fixture.review-drift',
  version: '1',
  compilation: drifted,
  audit: audit(
    'evt-source-routing-review-drift',
    accepted.reviewer.principalId
  )
}), 'AGRONOMIC_SOURCE_AUTHORITY_ROUTING_REVIEW_MISMATCH');

assert.equal(
  env.ledger.exportSnapshot().lineage.some((lineage) =>
    lineage.relation === 'supersedes'
      && (
        (lineage.from.logicalId === planning.source.ref.logicalId
          && lineage.to.logicalId === actual.source.ref.logicalId)
        || (lineage.from.logicalId === actual.source.ref.logicalId
          && lineage.to.logicalId === planning.source.ref.logicalId)
      )),
  false
);

const forbiddenKinds = new Set([
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
  authority: 'AgronomicSourceAuthorityRoutingCompilation',
  validCompilation: validated.record.ref,
  planningSource: validated.planningSource.ref,
  actualOperationRecordSource: validated.actualOperationRecordSource.ref,
  subjectScope: validated.semanticPayload.routing.subjectScope,
  routingRelation: validated.semanticPayload.routing.routingRelation,
  temporalScope: validated.semanticPayload.routing.temporalScope,
  negativeCases: [
    'INCOMPLETE_NOT_PUBLISHABLE',
    'UNRELATED_ACTUAL_SOURCE_DENIED',
    'ACTUAL_SOURCE_EXPRESSION_MISMATCH',
    'TEMPORAL_SOURCE_MISMATCH',
    'KNOWLEDGE_WRONG_USE',
    'WHOLE_SOURCE_SUPERSESSION_DENIED',
    'REVIEW_DRIFT_DENIED'
  ],
  validWorldSupersedesLineageCreated: false,
  forbiddenDownstreamAuthorityRecordsCreated: forbiddenRecords.length
}, null, 2));
