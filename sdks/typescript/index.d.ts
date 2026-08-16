export type PrincipalType = 'USER' | 'SERVICE_ACCOUNT';

export interface Principal {
  principal_id: string;
  type: PrincipalType;
  organization_id: string;
  tenant_id?: string;
  program_ids?: string[];
}

export interface AuthorityRef {
  kind: string;
  logical_id: string;
  version: string;
  semantic_hash: `sha256:${string}`;
}

export interface TransportRequest {
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export type Transport = (request: TransportRequest) => Promise<unknown> | unknown;
export type AccessTokenProvider = () => Promise<string> | string;

export interface AuthorityWriteInput<Resource extends { contract_version: string }> {
  logicalId: string;
  version: string;
  authorizationDecisionRef: AuthorityRef;
  resource: Resource;
  idempotencyKey: string;
  pathParameters?: Record<string, string>;
}

export interface AuthorityResource<Resource extends { contract_version: string } = { contract_version: string } & Record<string, unknown>> {
  ref: AuthorityRef;
  resource: Resource;
}

export interface WorkbenchCase extends Record<string, unknown> {
  projectionKind: 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE';
  projectionHash: `sha256:${string}`;
  classification:
    | 'NO_REVIEW_CANDIDATE'
    | 'AGRONOMIST_REVIEW_REQUIRED'
    | 'CONTEXT_GAP'
    | 'KNOWLEDGE_CONFLICT'
    | 'CALIBRATION_NEEDED'
    | 'GOVERNED_TRANSFORM_NEEDED';
  reviewRequired: boolean;
}

export interface AdrPilotClient {
  readonly principal: Readonly<Principal>;
  write(operationId: string, input: AuthorityWriteInput<any>): Promise<AuthorityResource>;
  read(operationId: string, input?: { pathParameters?: Record<string, string> }): Promise<unknown>;
  createDecisionProblem<Resource extends { contract_version: 'adr.decision-problem.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  createContextDatum<Resource extends { contract_version: 'adr.context-datum.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  createAuthorizedContextReference<Resource extends { contract_version: 'adr.authorized-context-reference.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  resolveContextReference<Resource extends { contract_version: 'adr.context-receipt.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  createContextManifest<Resource extends { contract_version: 'adr.context-manifest.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  executeKnowledgeRetrieval<Resource extends { contract_version: 'adr.knowledge-retrieval-result.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  createApplicabilityAssessment<Resource extends { contract_version: 'adr.applicability-assessment.v1' }>(input: AuthorityWriteInput<Resource>): Promise<AuthorityResource<Resource>>;
  getAgronomistWorkbenchCase(assessmentId: string): Promise<WorkbenchCase>;
  listAgronomistEscalations(): Promise<WorkbenchCase[]>;
}

export function createAdrPilotClient(options: {
  principal: Principal;
  getAccessToken: AccessTokenProvider;
  transport: Transport;
}): AdrPilotClient;

export const SDK_PILOT_WRITE_OPERATIONS: Readonly<Record<string, Readonly<{ method: 'POST'; path: string; contract: string }>>>;
export const SDK_PILOT_READ_OPERATIONS: Readonly<Record<string, Readonly<{ method: 'GET'; path: string }>>>;

export type IntegrationRole = 'CONTEXT_PROVIDER' | 'RESULT_SINK' | 'MODEL_EXECUTOR' | 'OUTCOME_PROVIDER';
export const INTEGRATION_ROLES: Readonly<Record<IntegrationRole, Readonly<{
  status: 'ACTIVE_PILOT' | 'RESERVED_NOT_EXERCISED_V0_3';
  direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
}>>>;

export interface IntegrationMessage<Payload extends Record<string, unknown> = Record<string, unknown>> {
  contract_version: 'adr.integration-message.v1';
  role: IntegrationRole;
  message_type: string;
  message_id: string;
  authority_refs: ReadonlyArray<AuthorityRef>;
  payload: Readonly<Payload>;
}

export interface IntegrationBatch {
  contract_version: 'adr.integration-batch.v1';
  batch_id: string;
  messages: ReadonlyArray<IntegrationMessage>;
}

export interface ResultSinkEvent<Payload extends Record<string, unknown> = Record<string, unknown>> {
  contract_version: 'adr.result-sink-event.v1';
  event_id: string;
  event_type: string;
  authority_ref?: AuthorityRef;
  projection_hash?: `sha256:${string}`;
  payload: Readonly<Payload>;
}

export type AdapterMappingRule =
  | { source_field: string; target_field: string; mode: 'EXACT_COPY' }
  | { target_field: string; mode: 'EXPLICIT_CONSTANT'; constant: unknown };

export function exactAuthorityRef(value: AuthorityRef, name?: string): Readonly<AuthorityRef>;
export function createIntegrationMessage<Payload extends Record<string, unknown>>(input: {
  role: IntegrationRole;
  messageType: string;
  messageId: string;
  authorityRefs?: AuthorityRef[];
  payload: Payload;
}): IntegrationMessage<Payload>;
export function createIntegrationBatch(input: { batchId: string; messages: IntegrationMessage[] }): IntegrationBatch;
export function createResultSinkEvent<Payload extends Record<string, unknown>>(input: {
  eventId: string;
  eventType: string;
  authorityRef?: AuthorityRef;
  projectionHash?: `sha256:${string}`;
  payload?: Payload;
}): ResultSinkEvent<Payload>;
export function normalizeAdapterMappingRule(rule: AdapterMappingRule): Readonly<AdapterMappingRule>;
export function applyExplicitAdapterMapping(source: Record<string, unknown>, rules: AdapterMappingRule[]): Readonly<Record<string, unknown>>;
export function assertPilotRoleEnabled(role: IntegrationRole): Readonly<{ status: 'ACTIVE_PILOT'; direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL' }>;
