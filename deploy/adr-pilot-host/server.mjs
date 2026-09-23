import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  copyFileSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';

import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import {
  createAuthorityRecoveryCheckpoint,
  restoreAuthorityRecoveryCheckpoint
} from '../../packages/recovery-operations/src/index.mjs';
import {
  materializePilotOpenApi,
  PUBLIC_API_OPERATIONS
} from '../../packages/public-api/src/index.mjs';
import {
  publishDecisionProblem
} from '../../packages/decision-problem/src/index.mjs';
import {
  publishContextDatum,
  materializePublicContextDatum
} from '../../packages/context-contract/src/index.mjs';
import {
  publishAuthorizedContextReference,
  publishResolvedContextDatumReceipt,
  materializePublicAuthorizedContextReference,
  materializePublicResolvedContextDatumReceipt,
  providerResponseContentHash
} from '../../packages/reference-resolution/src/index.mjs';
import {
  publishContextManifest,
  materializePublicContextManifest
} from '../../packages/context-manifest/src/index.mjs';
import {
  executeKnowledgeRetrieval,
  validateKnowledgeRetrievalResult
} from '../../packages/knowledge-retrieval/src/index.mjs';
import {
  assessKnowledgeApplicability
} from '../../packages/applicability/src/index.mjs';
import {
  projectAgronomistWorkbenchCase,
  projectAgronomistEscalationQueue
} from '../../packages/workbench/src/index.mjs';
import {
  createNonGeoxPilotWorld
} from '../../acceptance/v0.3-pilot-release/fixture.mjs';

const RELEASE = Object.freeze({
  name: 'ADR v0.3 — Paid Design-Partner Pilot',
  softwareQualification: 'PAID_DESIGN_PARTNER_PILOT_CANDIDATE',
  commercialValidation: 'NOT_ESTABLISHED',
  coreEngineering: 'FROZEN',
  productBoundary: 'APPLICABILITY_ASSESSMENT_PLUS_AGRONOMIST_WORKBENCH'
});

const WRITE_BY_PATH = new Map(
  PUBLIC_API_OPERATIONS
    .filter((operation) => operation.mode === 'AUTHORITY_WRITE' && !operation.path.includes('{'))
    .map((operation) => [`/v1${operation.path}`, operation])
);

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`${name} must be an object`);
    error.code = 'INVALID_HTTP_INPUT';
    throw error;
  }
  return value;
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const error = new Error(`${name} must be a non-empty string`);
    error.code = 'INVALID_HTTP_INPUT';
    throw error;
  }
  return value.trim();
}

function camelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function snakeKey(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function mapKeysDeep(value, keyMapper) {
  if (Array.isArray(value)) return value.map((item) => mapKeysDeep(item, keyMapper));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [keyMapper(key), mapKeysDeep(nested, keyMapper)])
  );
}

function toCore(value) {
  return mapKeysDeep(value, camelKey);
}

function toWire(value) {
  return mapKeysDeep(value, snakeKey);
}

function toCoreRef(value) {
  const ref = toCore(plainObject(value, 'authority_ref'));
  return {
    kind: nonEmpty(ref.kind, 'authority_ref.kind'),
    logicalId: nonEmpty(ref.logicalId, 'authority_ref.logical_id'),
    version: nonEmpty(ref.version, 'authority_ref.version'),
    semanticHash: nonEmpty(ref.semanticHash, 'authority_ref.semantic_hash')
  };
}

function toWireRef(ref) {
  return {
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  };
}

function corePrincipal(value) {
  const input = toCore(plainObject(value, 'principal'));
  return {
    principalId: nonEmpty(input.principalId, 'principal.principal_id'),
    type: nonEmpty(input.type, 'principal.type'),
    organizationId: nonEmpty(input.organizationId, 'principal.organization_id'),
    ...(input.tenantId ? { tenantId: nonEmpty(input.tenantId, 'principal.tenant_id') } : {}),
    ...(Array.isArray(input.programIds) ? { programIds: input.programIds.map((item) => nonEmpty(item, 'principal.program_ids')) } : {})
  };
}

function principalIdentity(principal) {
  return JSON.stringify({
    principalId: principal.principalId,
    type: principal.type,
    organizationId: principal.organizationId,
    tenantId: principal.tenantId ?? null,
    programIds: [...(principal.programIds ?? [])].sort()
  });
}

function exactPrincipal(left, right) {
  return principalIdentity(left) === principalIdentity(right);
}

function refKey(ref) {
  return JSON.stringify([ref.kind, ref.logicalId, ref.version, ref.semanticHash]);
}

function targetFromPrincipal(principal) {
  return {
    organizationId: principal.organizationId,
    ...(principal.tenantId ? { tenantId: principal.tenantId } : {})
  };
}

function strip(object, keys) {
  const value = { ...object };
  for (const key of keys) delete value[key];
  return value;
}

function audit(principal, operationId, idempotencyKey) {
  const occurredAt = new Date().toISOString();
  return {
    eventId: `adr-pilot-http-${semanticHash('AdrPilotHttpAudit', {
      operationId,
      idempotencyKey,
      principal: principalIdentity(principal),
      occurredAt
    }).slice(7, 31)}`,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: {
      surface: 'ADR_V0_3_PILOT_HTTP_HOST',
      operationId,
      authorityClaim: 'NONE_DEPLOYMENT_HOST_IS_NOT_DOMAIN_AUTHORITY'
    }
  };
}

function statusFor(error) {
  const code = String(error?.code ?? '');
  if (code.includes('AUTH') || code.includes('DENIED') || code.includes('SCOPE_MISMATCH') || code.includes('ACCESS')) return 403;
  if (code.includes('MUTATION') || code.includes('DUPLICATE') || code.includes('AMBIGUOUS') || code.includes('MISMATCH')) return 409;
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('INVALID') || code.includes('REQUIRED') || code.includes('UNSUPPORTED') || code.includes('FORBIDDEN')) return 400;
  return 500;
}

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store'
  });
  res.end(payload);
}

async function readJson(req, maxBytes = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('request body exceeds pilot limit');
      error.code = 'HTTP_BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('request body must be valid JSON');
    error.code = 'INVALID_HTTP_JSON';
    throw error;
  }
}

class FileContextSnapshotStore {
  constructor(root) {
    this.root = root;
    mkdirSync(root, { recursive: true });
  }

  path(contentHash) {
    const normalized = nonEmpty(contentHash, 'contentHash');
    if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) {
      const error = new Error('invalid content hash');
      error.code = 'INVALID_CONTEXT_SNAPSHOT_HASH';
      throw error;
    }
    return join(this.root, normalized.slice(7));
  }

  put(bytes) {
    const buffer = Buffer.from(bytes);
    const contentHash = providerResponseContentHash(buffer);
    const target = this.path(contentHash);
    if (!existsSync(target)) writeFileSync(target, buffer);
    return {
      storeKind: 'ADR_CONTROLLED_CONTENT_ADDRESSABLE_SNAPSHOT',
      retentionRef: contentHash,
      contentHash,
      byteLength: buffer.byteLength
    };
  }

  get(contentHash) {
    const target = this.path(contentHash);
    if (!existsSync(target)) {
      const error = new Error(`provider response ${contentHash} is not retained`);
      error.code = 'CONTEXT_SNAPSHOT_NOT_RETAINED';
      throw error;
    }
    return readFileSync(target);
  }
}

function tokenBindingsFromEnv() {
  const raw = process.env.ADR_PILOT_TOKEN_BINDINGS_JSON;
  if (!raw) return new Map();
  const parsed = plainObject(JSON.parse(raw), 'ADR_PILOT_TOKEN_BINDINGS_JSON');
  const map = new Map();
  for (const [token, principal] of Object.entries(parsed)) {
    map.set(nonEmpty(token, 'bearer token'), corePrincipal(principal));
  }
  return map;
}

function wireResource(record, operationId, runtime) {
  if (operationId === 'createContextDatum') return materializePublicContextDatum(record);
  if (operationId === 'createAuthorizedContextReference') return materializePublicAuthorizedContextReference(record);
  if (operationId === 'resolveContextReference') return materializePublicResolvedContextDatumReceipt(record);
  if (operationId === 'createContextManifest') {
    return materializePublicContextManifest({
      ledger: runtime.ledger,
      contextManifestRef: record.ref,
      snapshotStore: runtime.snapshotStore
    });
  }
  return {
    ...toWire(record.semanticPayload),
    semantic_hash: record.ref.semanticHash
  };
}

function publicAuthorityResponse(record, operationId, runtime) {
  return {
    ref: toWireRef(record.ref),
    resource: wireResource(record, operationId, runtime)
  };
}

function parseBearer(req, bindings) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    const error = new Error('bearer authentication required');
    error.code = 'HTTP_UNAUTHENTICATED';
    error.httpStatus = 401;
    throw error;
  }
  const token = header.slice('Bearer '.length);
  const principal = bindings.get(token);
  if (!principal) {
    const error = new Error('bearer token is not bound to a pilot principal');
    error.code = 'HTTP_UNAUTHENTICATED';
    error.httpStatus = 401;
    throw error;
  }
  return principal;
}

function workbenchAuthRefs(runtime, principal, assessmentRef) {
  const entry = runtime.metadata.workbenchAccess?.[principal.principalId];
  if (!entry || !Array.isArray(entry.inspectionAuthorizations)) {
    const error = new Error('workbench inspection authorization is not provisioned for this principal');
    error.code = 'WORKBENCH_ACCESS_DENIED';
    throw error;
  }
  const assessment = runtime.ledger.resolve(assessmentRef);
  const knowledge = runtime.ledger.resolve(assessment.semanticPayload.knowledgeRef);
  const required = [knowledge.ref];
  if (knowledge.ref.kind === 'DerivedKnowledge') {
    required.push(...(knowledge.semanticPayload.inputQualifiedKnowledgeRefs ?? []));
  }
  const byKnowledge = new Map(
    entry.inspectionAuthorizations.map((item) => [refKey(item.knowledgeRef), item.authorizationDecisionAuditRef])
  );
  return required.map((knowledgeRef) => {
    const authorizationDecisionAuditRef = byKnowledge.get(refKey(knowledgeRef));
    if (!authorizationDecisionAuditRef) {
      const error = new Error(`inspection authorization missing for ${knowledgeRef.logicalId}`);
      error.code = 'WORKBENCH_ACCESS_DENIED';
      throw error;
    }
    return { knowledgeRef, authorizationDecisionAuditRef };
  });
}

function assessmentRefByLogicalId(runtime, logicalId) {
  const matches = runtime.ledger.exportSnapshot().records
    .filter((record) => record.ref.kind === 'ApplicabilityAssessment' && record.ref.logicalId === logicalId)
    .map((record) => record.ref);
  if (matches.length === 0) {
    const error = new Error('applicability assessment not found');
    error.code = 'AUTHORITY_NOT_FOUND';
    throw error;
  }
  if (matches.length !== 1) {
    const error = new Error('assessment id is ambiguous across versions');
    error.code = 'ASSESSMENT_ID_AMBIGUOUS';
    throw error;
  }
  return matches[0];
}

function publicWorkbenchCase(value) {
  const { caseProjectionHash, ...rest } = value;
  return { ...rest, projectionHash: caseProjectionHash };
}

function runtimeAuthRefForRetrieval(runtime, retrievalRef) {
  const result = validateKnowledgeRetrievalResult({
    ledger: runtime.ledger,
    knowledgeRetrievalResultRef: retrievalRef
  });
  const event = runtime.ledger.auditFor(result.record.ref).find((item) =>
    item.action === 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT'
      && sameAuthorityRef(item.objectRef, result.record.ref)
      && item.details?.runtimeAuthorizationDecisionAuditRef
  );
  if (!event) {
    const error = new Error('retrieval runtime authorization audit is missing');
    error.code = 'RETRIEVAL_AUTHORIZATION_REQUIRED';
    throw error;
  }
  return {
    ref: event.details.runtimeAuthorizationDecisionAuditRef,
    principal: result.retrievalPrincipal
  };
}

function requestFingerprint(operationId, path, body) {
  return semanticHash('AdrPilotHttpRequest', { operationId, path, body });
}

function transportKey(principal, operationId, idempotencyKey) {
  return semanticHash('AdrPilotTransportIdempotency', {
    principal: principalIdentity(principal),
    operationId,
    idempotencyKey
  });
}

function normalizeEnvelope(body, expectedContract) {
  const input = plainObject(body, 'request');
  const allowed = new Set(['logical_id', 'version', 'principal', 'authorization_decision_ref', 'resource']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      const error = new Error(`request.${key} is not part of the frozen pilot envelope`);
      error.code = 'INVALID_HTTP_INPUT';
      throw error;
    }
  }
  for (const key of allowed) {
    if (!(key in input)) {
      const error = new Error(`request.${key} is required`);
      error.code = 'INVALID_HTTP_INPUT';
      throw error;
    }
  }
  const resource = plainObject(input.resource, 'request.resource');
  if (resource.contract_version !== expectedContract) {
    const error = new Error(`expected resource contract ${expectedContract}`);
    error.code = 'HTTP_RESOURCE_CONTRACT_MISMATCH';
    throw error;
  }
  return {
    logicalId: nonEmpty(input.logical_id, 'logical_id'),
    version: nonEmpty(input.version, 'version'),
    principal: corePrincipal(input.principal),
    authorizationDecisionAuditRef: toCoreRef(input.authorization_decision_ref),
    resource
  };
}

async function dispatchWrite(runtime, operation, req, path) {
  const authenticated = parseBearer(req, runtime.tokenBindings);
  const idempotencyKey = nonEmpty(req.headers['idempotency-key'], 'Idempotency-Key');
  const body = await readJson(req);
  const envelope = normalizeEnvelope(body, operation.resourceContract);
  if (!exactPrincipal(authenticated, envelope.principal)) {
    const error = new Error('authenticated bearer subject does not equal declared principal');
    error.code = 'HTTP_PRINCIPAL_MISMATCH';
    error.httpStatus = 403;
    throw error;
  }

  const key = transportKey(authenticated, operation.operationId, idempotencyKey);
  const fingerprint = requestFingerprint(operation.operationId, path, body);
  const existing = runtime.metadata.idempotency?.[key];
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      const error = new Error('idempotency key was reused with different request input');
      error.code = 'HTTP_IDEMPOTENCY_CONFLICT';
      error.httpStatus = 409;
      throw error;
    }
    return existing.response;
  }

  const principal = authenticated;
  const resource = toCore(envelope.resource);
  const auditMetadata = audit(principal, operation.operationId, idempotencyKey);
  let record;

  if (operation.operationId === 'createDecisionProblem') {
    record = publishDecisionProblem({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      problem: strip(resource, ['decisionId', 'semanticHash', 'authorityClass']),
      principal,
      authorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      audit: auditMetadata
    });
  } else if (operation.operationId === 'createContextDatum') {
    record = publishContextDatum({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      target: targetFromPrincipal(principal),
      datum: strip(resource, ['datumId', 'semanticHash', 'authorityClass', 'valueMode']),
      principal,
      authorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      audit: auditMetadata
    });
  } else if (operation.operationId === 'createAuthorizedContextReference') {
    const reference = strip(resource, ['referenceId', 'semanticHash', 'authorityClass']);
    if (reference.authorizationContext) {
      reference.authorizationContext = strip(reference.authorizationContext, ['authorizationHash']);
    }
    record = publishAuthorizedContextReference({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      target: targetFromPrincipal(principal),
      reference,
      principal,
      authorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      audit: auditMetadata
    });
  } else if (operation.operationId === 'resolveContextReference') {
    const referenceRef = toCoreRef(envelope.resource.reference_ref);
    const expectedReferenceId = decodeURIComponent(path.split('/')[3]);
    if (referenceRef.logicalId !== expectedReferenceId) {
      const error = new Error('path reference_id must equal resource.reference_ref.logical_id');
      error.code = 'HTTP_PATH_RESOURCE_MISMATCH';
      throw error;
    }
    const bytes = envelope.resource.provider_response_base64
      ? Buffer.from(nonEmpty(envelope.resource.provider_response_base64, 'provider_response_base64'), 'base64')
      : Buffer.from(nonEmpty(envelope.resource.provider_response_utf8, 'provider_response_utf8'), 'utf8');
    record = publishResolvedContextDatumReceipt({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      referenceRef,
      normalizedContextDatumRef: toCoreRef(envelope.resource.normalized_context_datum_ref),
      providerResponseBytes: bytes,
      resolution: toCore(plainObject(envelope.resource.resolution, 'resource.resolution')),
      retainSnapshot: envelope.resource.retain_snapshot === true,
      snapshotStore: runtime.snapshotStore,
      principal,
      authorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      audit: auditMetadata
    });
  } else if (operation.operationId === 'createContextManifest') {
    record = publishContextManifest({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      decisionProblemRef: toCoreRef(envelope.resource.decision_problem_ref),
      evidenceCutoff: nonEmpty(envelope.resource.evidence_cutoff, 'resource.evidence_cutoff'),
      datumRefs: (envelope.resource.datum_refs ?? []).map(toCoreRef),
      resolvedReferenceReceiptRefs: (envelope.resource.resolved_reference_receipt_refs ?? []).map(toCoreRef),
      snapshotStore: runtime.snapshotStore,
      principal,
      authorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      audit: auditMetadata
    });
  } else if (operation.operationId === 'executeKnowledgeRetrieval') {
    record = executeKnowledgeRetrieval({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      decisionProblemRef: toCoreRef(envelope.resource.decision_problem_ref),
      deploymentRef: toCoreRef(envelope.resource.deployment_ref),
      principal,
      runtimeAuthorizationDecisionAuditRef: envelope.authorizationDecisionAuditRef,
      config: toCore(envelope.resource.config ?? {}),
      audit: auditMetadata
    });
  } else if (operation.operationId === 'createApplicabilityAssessment') {
    const retrievalRef = toCoreRef(envelope.resource.knowledge_retrieval_result_ref);
    const runtimeAuthorization = runtimeAuthRefForRetrieval(runtime, retrievalRef);
    if (!sameAuthorityRef(runtimeAuthorization.ref, envelope.authorizationDecisionAuditRef)
      || !exactPrincipal(runtimeAuthorization.principal, principal)) {
      const error = new Error('ApplicabilityAssessment must bind the exact A07 runtime authorization/principal');
      error.code = 'APPLICABILITY_AUTHORIZATION_MISMATCH';
      error.httpStatus = 403;
      throw error;
    }
    record = assessKnowledgeApplicability({
      ledger: runtime.ledger,
      logicalId: envelope.logicalId,
      version: envelope.version,
      knowledgeRetrievalResultRef: retrievalRef,
      knowledgeRef: toCoreRef(envelope.resource.knowledge_ref),
      contextManifestRef: toCoreRef(envelope.resource.context_manifest_ref),
      snapshotStore: runtime.snapshotStore,
      audit: auditMetadata
    });
  } else {
    const error = new Error(`unsupported write operation ${operation.operationId}`);
    error.code = 'HTTP_OPERATION_UNSUPPORTED';
    throw error;
  }

  const response = publicAuthorityResponse(record, operation.operationId, runtime);
  runtime.metadata.idempotency ??= {};
  runtime.metadata.idempotency[key] = { requestFingerprint: fingerprint, response };
  runtime.persist();
  return response;
}

function bootstrapMetadataFromWorld(world, smokeRequest) {
  const inspectionAuthorizations = world.inspectionAuthorizations.map((item) => ({
    knowledgeRef: item.knowledgeRef,
    authorizationDecisionAuditRef: item.authorizationDecisionAuditRef
  }));
  return {
    mode: 'SYNTHETIC_SMOKE',
    idempotency: {},
    workbenchAccess: {
      [world.workbenchPrincipal.principalId]: {
        inspectionAuthorizations
      }
    },
    smokeRequest,
    initialAssessmentId: world.assessment.ref.logicalId
  };
}

export async function initializePilotRuntime({
  statePath = process.env.ADR_PILOT_STATE_PATH ?? '/data/adr-pilot-state.json',
  snapshotDir = process.env.ADR_PILOT_SNAPSHOT_DIR ?? '/data/context-snapshots',
  allowSyntheticBootstrap = process.env.ADR_PILOT_SYNTHETIC_BOOTSTRAP === 'true'
} = {}) {
  mkdirSync(dirname(statePath), { recursive: true });
  const snapshotStore = new FileContextSnapshotStore(snapshotDir);
  let ledger;
  let metadata;

  if (existsSync(statePath)) {
    const stored = JSON.parse(readFileSync(statePath, 'utf8'));
    const restored = restoreAuthorityRecoveryCheckpoint(stored.checkpoint);
    ledger = restored.ledger;
    metadata = plainObject(stored.metadata ?? {}, 'stored.metadata');
  } else if (process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64) {
    const stored = JSON.parse(Buffer.from(process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64, 'base64').toString('utf8'));
    const restored = restoreAuthorityRecoveryCheckpoint(stored.checkpoint);
    ledger = restored.ledger;
    metadata = plainObject(stored.metadata ?? {}, 'bootstrap.metadata');
  } else if (allowSyntheticBootstrap) {
    const seeded = await createNonGeoxPilotWorld('host');
    ledger = seeded.world.env.ledger;
    metadata = bootstrapMetadataFromWorld(seeded.world, seeded.request);
  } else {
    return {
      ready: false,
      reason: 'VALIDATED_BOOTSTRAP_CHECKPOINT_REQUIRED',
      statePath,
      snapshotDir,
      tokenBindings: tokenBindingsFromEnv()
    };
  }

  const runtime = {
    ready: true,
    ledger,
    metadata,
    snapshotStore,
    statePath,
    snapshotDir,
    tokenBindings: tokenBindingsFromEnv(),
    persist() {
      const checkpoint = createAuthorityRecoveryCheckpoint({
        ledger: runtime.ledger,
        capturedAt: new Date().toISOString()
      });
      const payload = JSON.stringify({
        schema_version: 'adr.pilot-host-state.v1',
        release: RELEASE,
        checkpoint,
        metadata: runtime.metadata
      });
      const temporary = `${statePath}.tmp`;
      const previous = `${statePath}.prev`;
      if (existsSync(statePath)) copyFileSync(statePath, previous);
      writeFileSync(temporary, payload);
      renameSync(temporary, statePath);
    }
  };
  runtime.persist();
  return runtime;
}

export function createPilotHttpServer(runtime) {
  let writeQueue = Promise.resolve();

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://adr-pilot.local');
      const path = url.pathname;

      if (req.method === 'GET' && path === '/healthz') {
        return json(res, 200, { status: 'ok', release: RELEASE.name });
      }
      if (req.method === 'GET' && path === '/ready') {
        if (!runtime.ready) return json(res, 503, { status: 'not_ready', reason: runtime.reason });
        if (runtime.tokenBindings.size === 0) return json(res, 503, { status: 'not_ready', reason: 'TOKEN_BINDINGS_REQUIRED' });
        return json(res, 200, {
          status: 'ready',
          release: RELEASE,
          bootstrapMode: runtime.metadata.mode ?? 'CHECKPOINT',
          statePersistence: 'RECOVERY_CHECKPOINT_ATOMIC_FILE',
          snapshotPersistence: 'CONTENT_ADDRESSED_FILES'
        });
      }
      if (req.method === 'GET' && path === '/openapi.json') {
        return json(res, 200, materializePilotOpenApi());
      }

      const caseMatch = /^\/v1\/workbench\/cases\/([^/]+)$/.exec(path);
      if (req.method === 'GET' && caseMatch) {
        const principal = parseBearer(req, runtime.tokenBindings);
        const ref = assessmentRefByLogicalId(runtime, decodeURIComponent(caseMatch[1]));
        const inspectionAuthorizations = workbenchAuthRefs(runtime, principal, ref);
        const workbenchCase = projectAgronomistWorkbenchCase({
          ledger: runtime.ledger,
          applicabilityAssessmentRef: ref,
          workbenchPrincipal: principal,
          inspectionAuthorizations,
          snapshotStore: runtime.snapshotStore
        });
        return json(res, 200, publicWorkbenchCase(workbenchCase));
      }

      if (req.method === 'GET' && path === '/v1/workbench/escalations') {
        const principal = parseBearer(req, runtime.tokenBindings);
        const assessments = runtime.ledger.exportSnapshot().records
          .filter((record) => record.ref.kind === 'ApplicabilityAssessment')
          .map((record) => record.ref);
        const cases = [];
        for (const ref of assessments) {
          try {
            const inspectionAuthorizations = workbenchAuthRefs(runtime, principal, ref);
            const workbenchCase = projectAgronomistWorkbenchCase({
              ledger: runtime.ledger,
              applicabilityAssessmentRef: ref,
              workbenchPrincipal: principal,
              inspectionAuthorizations,
              snapshotStore: runtime.snapshotStore
            });
            cases.push(workbenchCase);
          } catch (error) {
            if (String(error?.code ?? '').includes('ACCESS') || String(error?.code ?? '').includes('AUTH')) continue;
            throw error;
          }
        }
        const queue = projectAgronomistEscalationQueue({
          caseInputs: cases.map((workbenchCase) => ({
            ledger: runtime.ledger,
            workbenchCase,
            snapshotStore: runtime.snapshotStore
          }))
        });
        const byHash = new Map(cases.map((item) => [item.caseProjectionHash, item]));
        return json(res, 200, queue.items.map((item) => publicWorkbenchCase(byHash.get(item.caseProjectionHash))));
      }

      let operation = WRITE_BY_PATH.get(path) ?? null;
      if (!operation) {
        const match = /^\/v1\/context-references\/([^/]+)\/resolutions$/.exec(path);
        if (match) operation = PUBLIC_API_OPERATIONS.find((item) => item.operationId === 'resolveContextReference');
      }
      if (req.method === 'POST' && operation) {
        const task = () => dispatchWrite(runtime, operation, req, path);
        const resultPromise = writeQueue.then(task, task);
        writeQueue = resultPromise.then(() => undefined, () => undefined);
        const response = await resultPromise;
        return json(res, 201, response);
      }

      return json(res, 404, { code: 'HTTP_ROUTE_NOT_FOUND', message: 'route is outside the ADR v0.3 pilot surface' });
    } catch (error) {
      return json(res, error.httpStatus ?? statusFor(error), {
        code: String(error?.code ?? 'ADR_PILOT_HOST_ERROR'),
        message: String(error?.message ?? 'pilot host request failed')
      });
    }
  });
}

export async function startPilotServer() {
  const runtime = await initializePilotRuntime();
  const server = createPilotHttpServer(runtime);
  const port = Number(process.env.PORT ?? 3000);
  await new Promise((resolve) => server.listen(port, '0.0.0.0', resolve));
  console.log(JSON.stringify({
    event: 'ADR_PILOT_HOST_LISTENING',
    port,
    ready: runtime.ready,
    bootstrapMode: runtime.metadata?.mode ?? null,
    release: RELEASE.name
  }));
  return { runtime, server };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startPilotServer();
}
