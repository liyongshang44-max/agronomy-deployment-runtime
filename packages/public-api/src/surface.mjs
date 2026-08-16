import { deepFreeze } from '../../canonicalization/src/index.mjs';

export const ADR_PUBLIC_API_VERSION = '2026-08-16.pilot-v0.3';
export const ADR_PUBLIC_API_BASE_PATH = '/v1';

export const PUBLIC_API_OPERATIONS = deepFreeze([
  {
    operationId: 'createDecisionProblem',
    method: 'POST',
    path: '/decision-problems',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'DecisionProblem',
    resourceContract: 'adr.decision-problem.v1',
    backendAuthority: 'publishDecisionProblem',
    requiredPermission: 'decision.problem.create',
    idempotencyRequired: true
  },
  {
    operationId: 'createContextDatum',
    method: 'POST',
    path: '/context-data',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'ContextDatum',
    resourceContract: 'adr.context-datum.v1',
    backendAuthority: 'publishContextDatum',
    requiredPermission: 'context.write',
    idempotencyRequired: true
  },
  {
    operationId: 'createAuthorizedContextReference',
    method: 'POST',
    path: '/context-references',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'AuthorizedContextReference',
    resourceContract: 'adr.authorized-context-reference.v1',
    backendAuthority: 'publishAuthorizedContextReference',
    requiredPermission: 'context.write',
    idempotencyRequired: true
  },
  {
    operationId: 'resolveContextReference',
    method: 'POST',
    path: '/context-references/{reference_id}/resolutions',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'ResolvedContextDatumReceipt',
    resourceContract: 'adr.context-receipt.v1',
    backendAuthority: 'publishResolvedContextDatumReceipt',
    requiredPermission: 'context.write',
    idempotencyRequired: true
  },
  {
    operationId: 'createContextManifest',
    method: 'POST',
    path: '/context-manifests',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'ContextManifest',
    resourceContract: 'adr.context-manifest.v1',
    backendAuthority: 'publishContextManifest',
    requiredPermission: 'context.write',
    idempotencyRequired: true
  },
  {
    operationId: 'executeKnowledgeRetrieval',
    method: 'POST',
    path: '/knowledge-retrieval-results',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'KnowledgeRetrievalResult',
    resourceContract: 'adr.knowledge-retrieval-result.v1',
    backendAuthority: 'executeKnowledgeRetrieval',
    requiredPermission: 'knowledge.runtime.use',
    idempotencyRequired: true
  },
  {
    operationId: 'createApplicabilityAssessment',
    method: 'POST',
    path: '/applicability-assessments',
    mode: 'AUTHORITY_WRITE',
    authorityKind: 'ApplicabilityAssessment',
    resourceContract: 'adr.applicability-assessment.v1',
    backendAuthority: 'assessApplicability',
    requiredPermission: 'knowledge.runtime.use',
    idempotencyRequired: true
  },
  {
    operationId: 'getAuthorityResource',
    method: 'GET',
    path: '/authority/{kind}/{logical_id}/versions/{version}',
    mode: 'EXACT_AUTHORITY_READ',
    authorityKind: '*',
    resourceContract: null,
    backendAuthority: 'resolveExactAuthorityRef',
    requiredPermission: null,
    idempotencyRequired: false
  },
  {
    operationId: 'getAgronomistWorkbenchCase',
    method: 'GET',
    path: '/workbench/cases/{assessment_id}',
    mode: 'NON_AUTHORITY_READ_MODEL',
    authorityKind: null,
    resourceContract: 'adr.workbench-case.pilot-v0.3',
    backendAuthority: 'projectAgronomistWorkbenchCase',
    requiredPermission: 'knowledge.inspect+source.read',
    idempotencyRequired: false
  },
  {
    operationId: 'listAgronomistEscalations',
    method: 'GET',
    path: '/workbench/escalations',
    mode: 'NON_AUTHORITY_READ_MODEL',
    authorityKind: null,
    resourceContract: 'adr.workbench-case.pilot-v0.3',
    backendAuthority: 'projectAgronomistEscalationQueue',
    requiredPermission: 'knowledge.inspect+source.read',
    idempotencyRequired: false
  }
]);

const OPERATION_IDS = new Set(PUBLIC_API_OPERATIONS.map((item) => item.operationId));
if (OPERATION_IDS.size !== PUBLIC_API_OPERATIONS.length) {
  throw new Error('ADR public API operationId values must be unique');
}

export function publicApiOperation(operationId) {
  const operation = PUBLIC_API_OPERATIONS.find((item) => item.operationId === operationId);
  if (!operation) throw new Error(`Unknown ADR public API operation ${operationId}`);
  return operation;
}
