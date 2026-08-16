const WRITE_OPERATIONS = Object.freeze({
  createDecisionProblem: Object.freeze({ method: 'POST', path: '/v1/decision-problems', contract: 'adr.decision-problem.v1' }),
  createContextDatum: Object.freeze({ method: 'POST', path: '/v1/context-data', contract: 'adr.context-datum.v1' }),
  createAuthorizedContextReference: Object.freeze({ method: 'POST', path: '/v1/context-references', contract: 'adr.authorized-context-reference.v1' }),
  resolveContextReference: Object.freeze({ method: 'POST', path: '/v1/context-references/{reference_id}/resolutions', contract: 'adr.context-receipt.v1' }),
  createContextManifest: Object.freeze({ method: 'POST', path: '/v1/context-manifests', contract: 'adr.context-manifest.v1' }),
  executeKnowledgeRetrieval: Object.freeze({ method: 'POST', path: '/v1/knowledge-retrieval-results', contract: 'adr.knowledge-retrieval-result.v1' }),
  createApplicabilityAssessment: Object.freeze({ method: 'POST', path: '/v1/applicability-assessments', contract: 'adr.applicability-assessment.v1' })
});

const READ_OPERATIONS = Object.freeze({
  getAgronomistWorkbenchCase: Object.freeze({ method: 'GET', path: '/v1/workbench/cases/{assessment_id}' }),
  listAgronomistEscalations: Object.freeze({ method: 'GET', path: '/v1/workbench/escalations' })
});

export const SDK_PILOT_WRITE_OPERATIONS = WRITE_OPERATIONS;
export const SDK_PILOT_READ_OPERATIONS = READ_OPERATIONS;

export class AdrSdkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdrSdkError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AdrSdkError('INVALID_SDK_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdrSdkError('INVALID_SDK_INPUT', `${name} must be an object`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function principal(value) {
  const input = plainObject(value, 'principal');
  const output = {
    principal_id: text(input.principal_id, 'principal.principal_id'),
    type: text(input.type, 'principal.type'),
    organization_id: text(input.organization_id, 'principal.organization_id')
  };
  if (!['USER', 'SERVICE_ACCOUNT'].includes(output.type)) {
    throw new AdrSdkError('INVALID_SDK_PRINCIPAL', `unsupported principal type ${output.type}`);
  }
  if (input.tenant_id !== undefined) output.tenant_id = text(input.tenant_id, 'principal.tenant_id');
  if (input.program_ids !== undefined) {
    if (!Array.isArray(input.program_ids)) throw new AdrSdkError('INVALID_SDK_PRINCIPAL', 'principal.program_ids must be an array');
    output.program_ids = input.program_ids.map((item, index) => text(item, `principal.program_ids[${index}]`));
    if (new Set(output.program_ids).size !== output.program_ids.length) {
      throw new AdrSdkError('INVALID_SDK_PRINCIPAL', 'principal.program_ids cannot contain duplicates');
    }
  }
  return Object.freeze(output);
}

function exactAuthorityRef(value, name = 'authorityRef') {
  const input = plainObject(value, name);
  const output = {
    kind: text(input.kind, `${name}.kind`),
    logical_id: text(input.logical_id, `${name}.logical_id`),
    version: text(input.version, `${name}.version`),
    semantic_hash: text(input.semantic_hash, `${name}.semantic_hash`)
  };
  if (!output.semantic_hash.startsWith('sha256:')) {
    throw new AdrSdkError('INVALID_AUTHORITY_REF', `${name}.semantic_hash must be a sha256 identity`);
  }
  return Object.freeze(output);
}

function bindPath(template, pathParameters = {}) {
  const expected = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  const supplied = Object.keys(pathParameters);
  if (expected.length !== supplied.length || !expected.every((name) => supplied.includes(name))) {
    throw new AdrSdkError('SDK_PATH_PARAMETER_MISMATCH', `expected exact path parameters: ${expected.join(',')}`);
  }
  let path = template;
  for (const name of expected) path = path.replace(`{${name}}`, encodeURIComponent(text(pathParameters[name], `pathParameters.${name}`)));
  return path;
}

function validateAuthorityResponse(response, expectedContract) {
  const value = plainObject(response, 'response');
  const ref = exactAuthorityRef(value.ref, 'response.ref');
  const resource = plainObject(value.resource, 'response.resource');
  if (resource.contract_version !== expectedContract) {
    throw new AdrSdkError('SDK_RESPONSE_CONTRACT_MISMATCH', `expected ${expectedContract}, received ${resource.contract_version}`);
  }
  return Object.freeze({ ref, resource: Object.freeze(clone(resource)) });
}

export function createAdrPilotClient({ principal: principalInput, getAccessToken, transport }) {
  const caller = principal(principalInput);
  if (typeof getAccessToken !== 'function') throw new AdrSdkError('SDK_TOKEN_PROVIDER_REQUIRED', 'getAccessToken must be a function');
  if (typeof transport !== 'function') throw new AdrSdkError('SDK_TRANSPORT_REQUIRED', 'transport must be a function');

  async function bearer() {
    return text(await getAccessToken(), 'accessToken');
  }

  async function write(operationId, {
    logicalId,
    version,
    authorizationDecisionRef,
    resource,
    idempotencyKey,
    pathParameters = {}
  }) {
    const operation = WRITE_OPERATIONS[operationId];
    if (!operation) throw new AdrSdkError('SDK_OPERATION_NOT_WRITABLE', `${operationId} is not a P02 pilot authority write`);
    const payload = plainObject(resource, 'resource');
    if (payload.contract_version !== operation.contract) {
      throw new AdrSdkError('SDK_RESOURCE_CONTRACT_MISMATCH', `${operationId} requires ${operation.contract}`);
    }
    const request = {
      method: operation.method,
      path: bindPath(operation.path, pathParameters),
      headers: {
        Authorization: `Bearer ${await bearer()}`,
        'Idempotency-Key': text(idempotencyKey, 'idempotencyKey'),
        'Content-Type': 'application/json'
      },
      body: {
        logical_id: text(logicalId, 'logicalId'),
        version: text(version, 'version'),
        principal: clone(caller),
        authorization_decision_ref: clone(exactAuthorityRef(authorizationDecisionRef, 'authorizationDecisionRef')),
        resource: clone(payload)
      }
    };
    const response = await transport(Object.freeze(clone(request)));
    return validateAuthorityResponse(response, operation.contract);
  }

  async function read(operationId, { pathParameters = {} } = {}) {
    const operation = READ_OPERATIONS[operationId];
    if (!operation) throw new AdrSdkError('SDK_OPERATION_NOT_READABLE', `${operationId} is not a P02 pilot read`);
    return transport(Object.freeze({
      method: operation.method,
      path: bindPath(operation.path, pathParameters),
      headers: Object.freeze({ Authorization: `Bearer ${await bearer()}` })
    }));
  }

  return Object.freeze({
    principal: caller,
    write,
    read,
    createDecisionProblem: (input) => write('createDecisionProblem', input),
    createContextDatum: (input) => write('createContextDatum', input),
    createAuthorizedContextReference: (input) => write('createAuthorizedContextReference', input),
    resolveContextReference: (input) => write('resolveContextReference', input),
    createContextManifest: (input) => write('createContextManifest', input),
    executeKnowledgeRetrieval: (input) => write('executeKnowledgeRetrieval', input),
    createApplicabilityAssessment: (input) => write('createApplicabilityAssessment', input),
    getAgronomistWorkbenchCase: (assessmentId) => read('getAgronomistWorkbenchCase', { pathParameters: { assessment_id: assessmentId } }),
    listAgronomistEscalations: () => read('listAgronomistEscalations')
  });
}
