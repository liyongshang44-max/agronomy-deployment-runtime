import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { ADR_PUBLIC_API_BASE_PATH, ADR_PUBLIC_API_VERSION, PUBLIC_API_OPERATIONS } from './surface.mjs';

const writeRequest = {
  type: 'object',
  additionalProperties: false,
  required: ['logical_id', 'version', 'principal', 'authorization_decision_ref', 'resource'],
  properties: {
    logical_id: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    principal: { $ref: '#/components/schemas/Principal' },
    authorization_decision_ref: { $ref: '#/components/schemas/AuthorityRef' },
    resource: {
      type: 'object',
      required: ['contract_version'],
      properties: { contract_version: { type: 'string', minLength: 1 } },
      description: 'Exact frozen ADR public resource payload. The endpoint-specific x-adr-resource-contract value is mandatory; transport may map representation but may not reinterpret or flatten authority-critical semantic/provenance/time/support/uncertainty fields.',
      minProperties: 1
    }
  }
};

function pathParameters(path) {
  const matches = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  return matches.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', minLength: 1 }
  }));
}

function operationPath(operation) {
  const path = `${ADR_PUBLIC_API_BASE_PATH}${operation.path}`;
  const lowerMethod = operation.method.toLowerCase();
  const common = {
    operationId: operation.operationId,
    tags: [operation.mode === 'NON_AUTHORITY_READ_MODEL' ? 'Workbench' : 'Authority'],
    security: [{ bearerAuth: [] }],
    'x-adr-mode': operation.mode,
    'x-adr-backend-authority': operation.backendAuthority,
    'x-adr-resource-contract': operation.resourceContract,
    'x-adr-required-permission': operation.requiredPermission,
    'x-adr-idempotency-required': operation.idempotencyRequired
  };

  if (operation.mode === 'NON_AUTHORITY_READ_MODEL') {
    return [path, lowerMethod, {
      ...common,
      summary: operation.operationId === 'getAgronomistWorkbenchCase'
        ? 'Project one authority-validated agronomist workbench case'
        : 'List authority-validated agronomist escalation projections',
      parameters: pathParameters(operation.path),
      responses: {
        200: {
          description: 'Non-authority projection',
          content: { 'application/json': { schema: operation.operationId === 'getAgronomistWorkbenchCase'
            ? { $ref: '#/components/schemas/WorkbenchCase' }
            : { type: 'array', items: { $ref: '#/components/schemas/WorkbenchCase' } } } }
        },
        403: { $ref: '#/components/responses/Problem' }
      }
    }];
  }

  return [path, lowerMethod, {
    ...common,
    summary: `Create ${operation.authorityKind} through its existing governed authority service`,
    parameters: [
      ...pathParameters(operation.path),
      {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 1 },
        description: 'Transport retry identity. It never substitutes for the ADR logical/version/semantic identity.'
      }
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthorityWriteRequest' } } }
    },
    responses: {
      201: {
        description: 'Immutable authority resource created or exact idempotent retry resolved',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthorityResource' } } }
      },
      400: { $ref: '#/components/responses/Problem' },
      403: { $ref: '#/components/responses/Problem' },
      409: { $ref: '#/components/responses/Problem' }
    }
  }];
}

const paths = {};
for (const operation of PUBLIC_API_OPERATIONS) {
  const [path, method, spec] = operationPath(operation);
  paths[path] ??= {};
  paths[path][method] = spec;
}

export const ADR_PILOT_OPENAPI = deepFreeze({
  openapi: '3.1.0',
  info: {
    title: 'Agronomy Deployment Runtime Pilot API',
    version: ADR_PUBLIC_API_VERSION,
    description: 'Resource-oriented Gate-A pilot API. Applicability is not RuntimeEligibility and this API exposes no /recommend shortcut.'
  },
  servers: [{ url: '/' }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'opaque-or-jwt' }
    },
    schemas: {
      AuthorityRef: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'logical_id', 'version', 'semantic_hash'],
        properties: {
          kind: { type: 'string', minLength: 1 },
          logical_id: { type: 'string', minLength: 1 },
          version: { type: 'string', minLength: 1 },
          semantic_hash: { type: 'string', pattern: '^sha256:' }
        }
      },
      Principal: {
        type: 'object',
        additionalProperties: false,
        required: ['principal_id', 'type', 'organization_id'],
        properties: {
          principal_id: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['USER', 'SERVICE_ACCOUNT'] },
          organization_id: { type: 'string', minLength: 1 },
          tenant_id: { type: 'string', minLength: 1 },
          program_ids: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }
        }
      },
      AuthorityWriteRequest: writeRequest,
      AuthorityResource: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'resource'],
        properties: {
          ref: { $ref: '#/components/schemas/AuthorityRef' },
          resource: {
            type: 'object',
            required: ['contract_version'],
            properties: { contract_version: { type: 'string', minLength: 1 } },
            minProperties: 1,
            description: 'Exact normalized public resource payload. Contract-specific semantic/provenance/time/support/uncertainty fields are preserved rather than flattened.'
          }
        }
      },
      WorkbenchCase: {
        type: 'object',
        additionalProperties: true,
        required: ['projectionKind', 'projectionHash', 'classification', 'reviewRequired', 'applicability', 'scientificEvidence', 'targetContext', 'why'],
        properties: {
          projectionKind: { const: 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE' },
          projectionHash: { type: 'string', pattern: '^sha256:' },
          classification: {
            type: 'string',
            enum: ['NO_REVIEW_CANDIDATE', 'AGRONOMIST_REVIEW_REQUIRED', 'CONTEXT_GAP', 'KNOWLEDGE_CONFLICT', 'CALIBRATION_NEEDED', 'GOVERNED_TRANSFORM_NEEDED']
          },
          reviewRequired: { type: 'boolean' },
          applicability: { type: 'object' },
          scientificEvidence: { type: 'object' },
          targetContext: { type: 'object' },
          why: { type: 'object' }
        }
      },
      Problem: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: { code: { type: 'string' }, message: { type: 'string' } }
      }
    },
    responses: {
      Problem: {
        description: 'Fail-closed API error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Problem' } } }
      }
    }
  }
});

export function materializePilotOpenApi() {
  return JSON.parse(JSON.stringify(ADR_PILOT_OPENAPI));
}
