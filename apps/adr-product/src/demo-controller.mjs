import { renderDemoReport } from './report.mjs';
// Non-authority ADR product BFF: the browser never chooses Principal,
// AuthorizationDecisionAudit, AuthorityRef, or long-lived service credentials.
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

const OUTCOMES = new Set([
  'CONFIRMED_CLASSIFICATION', 'REVIEWER_DISAGREED', 'CONTEXT_REQUESTED',
  'AUTHORITY_ACTION_PERFORMED', 'DEFERRED'
]);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EXACT_CASE_ID = /^[a-zA-Z0-9._-]{1,180}$/;
const toText = (x) => String(x ?? '');
const html = (value) => toText(value).replace(/[&<>"']/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
const secret = () => randomBytes(32).toString('hex');

function safeCase(source) {
  if (source?.projectionKind !== 'NON_AUTHORITY_AGRONOMIST_WORKBENCH_CASE'
    || !/^sha256:/.test(source.projectionHash ?? '')
    || !source.applicability?.applicabilityAssessmentRef) {
    throw new Error('INVALID_UPSTREAM_WORKBENCH_PROJECTION');
  }
  // Exclude the read-model's transport authentication details and identities.
  return {
    projectionKind: source.projectionKind,
    projectionHash: source.projectionHash,
    classification: source.classification,
    reviewRequired: source.reviewRequired,
    reasonCodes: source.reasonCodes,
    why: source.why,
    scientificEvidence: source.scientificEvidence,
    targetContext: source.targetContext,
    applicability: source.applicability
  };
}

async function upstream(config, path, init = {}) {
  const response = await fetch(config.hostBaseUrl + path, {
    ...init,
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: 'Bearer ' + (init.method === 'POST' ? config.writeToken : config.readToken),
      ...(init.headers || {})
    }
  });
  const body = await response.json();
  return { status: response.status, body };
}

function storeAt(file) {
  if (!file) throw new Error('DEMO_PRODUCT_RECORD_STORE_REQUIRED');
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  let state = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : { schema: 'adr-product-demo-records.v1', sessions: {}, attempts: {}, reviews: {} };
  if (state.schema !== 'adr-product-demo-records.v1') throw new Error('INVALID_DEMO_STORE_SCHEMA');
  state.reviewStarts ??= {};
  state.sources ??= {};

  function save() {
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify(state), { mode: 0o600, flag: 'w' });
    renameSync(tmp, file);
  }
  return {
    session(req, create = false) {
      const cookie = toText(req.headers.cookie).split(';').map((x) => x.trim())
        .find((x) => x.startsWith('adr_demo_sid='));
      const sid = cookie?.slice('adr_demo_sid='.length);
      const existing = sid && state.sessions[sid];
      if (existing && existing.expiresAt > Date.now()) return { sid, record: existing };
      if (!create) return null;
      const next = secret();
      const record = { csrf: secret(), expiresAt: Date.now() + SESSION_TTL_MS };
      state.sessions[next] = record;
      save();
      return { sid: next, record, newSession: true };
    },
    getAttempt(sid, id) { return state.attempts[sid + ':' + id] ?? null; },
    putAttempt(sid, id, value) { state.attempts[sid + ':' + id] = value; save(); },
    getReview(sid, id) { return state.reviews[sid + ':' + id] ?? null; },
    putReview(sid, id, value) { state.reviews[sid + ':' + id] = value; save(); },
    getReviewStart(sid, id) { return state.reviewStarts[sid + ':' + id] ?? null; },
    startReview(sid, id, assessmentRef, projectionHash) {
      const key = sid + ':' + id;
      if (state.reviewStarts[key]) return state.reviewStarts[key];
      const entry = { kind: 'NON_AUTHORITY_REVIEW_START', operationId: id,
        startedAt: new Date().toISOString(), assessmentRef, caseProjectionHash: projectionHash };
      state.reviewStarts[key] = entry;
      save();
      return entry;
    },
    listSources(sid) { return state.sources[sid] ?? []; },
    addSource(sid, item) {
      state.sources[sid] ??= [];
      state.sources[sid].push(item);
      save();
      return item;
    }
  };
}

function json(res, status, body, extra = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'x-content-type-options': 'nosniff',
    ...extra
  });
  res.end(payload);
}

async function receive(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('INVALID_JSON'), { status: 400 }); }
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && url.host === req.headers.host && url.pathname === '/';
  } catch { return false; }
}

function requireSession(req, res, store, mutation = false) {
  const session = store.session(req);
  if (!session) {
    json(res, 401, { code: 'DEMO_SESSION_REQUIRED', message: '先建立演示会话' });
    return null;
  }
  if (mutation && (!originAllowed(req)
    || req.headers['x-csrf-token'] !== session.record.csrf)) {
    json(res, 403, { code: 'CSRF_DENIED', message: '请求来源或 CSRF 令牌不匹配' });
    return null;
  }
  return session;
}

function newEnvelope(id, config) {
  return {
    logical_id: 'applicability.adr-prod-demo.' + id,
    version: '1',
    principal: config.principal,
    authorization_decision_ref: config.authorizationRef,
    resource: {
      contract_version: 'adr.applicability-assessment.v1',
      knowledge_retrieval_result_ref: config.retrievalRef,
      knowledge_ref: config.knowledgeRef,
      context_manifest_ref: config.manifestRef
    }
  };
}

function shapeAttempt(attempt) {
  return {
    operationId: attempt.id,
    scenarioId: attempt.scenarioId ?? 'QUALIFIED_SYNTHETIC_V03',
    inputBinding: {
      knowledgeRef: attempt.envelope.resource.knowledge_ref,
      contextManifestRef: attempt.envelope.resource.context_manifest_ref,
      retrievalRef: attempt.envelope.resource.knowledge_retrieval_result_ref
    },
    state: attempt.state,
    assessmentRef: attempt.assessmentRef ?? null,
    workbenchCase: attempt.workbenchCase ?? null,
    failureCode: attempt.failureCode ?? null
  };
}

export function createDemoController(config) {
  if (!config?.hostBaseUrl?.startsWith('http://127.0.0.1:')
    || !config.readToken || !config.writeToken || !config.principal
    || !config.authorizationRef || !config.retrievalRef || !config.knowledgeRef
    || !config.manifestRef || !config.storePath) {
    throw new Error('COMPLETE_LOOPBACK_DEMO_BINDING_REQUIRED');
  }
  const store = storeAt(config.storePath);
  const inflight = new Map();

  async function readCase(id) {
    const result = await upstream(config, '/v1/workbench/cases/' + encodeURIComponent(id));
    if (result.status !== 200) throw Object.assign(
      new Error(result.body.code || 'UPSTREAM_CASE_FAILED'), { status: result.status });
    return safeCase(result.body);
  }

  async function runAssessment(session, id) {
    let attempt = store.getAttempt(session.sid, id);
    if (!attempt) {
      attempt = {
        id, state: 'PREPARED', scenarioId: 'QUALIFIED_SYNTHETIC_V03',
        createdAt: new Date().toISOString(),
        idempotencyKey: 'adr-prod-demo-' + id,
        envelope: newEnvelope(id, config)
      };
      // Persist the operation and exact request BEFORE the first remote write.
      store.putAttempt(session.sid, id, attempt);
    }
    if (attempt.state === 'CONFIRMED') return shapeAttempt(attempt);
    if (attempt.state === 'REJECTED') return shapeAttempt(attempt);
    if (!attempt.assessmentRef) {
      attempt.state = 'SUBMITTED';
      store.putAttempt(session.sid, id, attempt);
      try {
        const result = await upstream(config, '/v1/applicability-assessments', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': attempt.idempotencyKey },
          body: JSON.stringify(attempt.envelope)
        });
        if (result.status !== 201) {
          if ([400, 401, 403, 409].includes(result.status)) {
            attempt.state = 'REJECTED';
            attempt.failureCode = result.body?.code ?? 'WRITE_REJECTED';
          } else {
            attempt.state = 'UNKNOWN_OUTCOME';
            attempt.failureCode = result.body?.code ?? 'UPSTREAM_UNCONFIRMED';
          }
          store.putAttempt(session.sid, id, attempt);
          return shapeAttempt(attempt);
        }
        if (result.body?.ref?.kind !== 'ApplicabilityAssessment'
          || result.body.ref.logical_id !== attempt.envelope.logical_id
          || result.body.ref.version !== '1'
          || !/^sha256:/.test(result.body.ref.semantic_hash ?? '')) {
          attempt.state = 'UNKNOWN_OUTCOME';
          attempt.failureCode = 'UPSTREAM_IDENTITY_MISMATCH';
          store.putAttempt(session.sid, id, attempt);
          return shapeAttempt(attempt);
        }
        attempt.assessmentRef = result.body.ref;
        attempt.state = 'WRITE_CONFIRMED_READ_PENDING';
        store.putAttempt(session.sid, id, attempt);
      } catch {
        attempt.state = 'UNKNOWN_OUTCOME';
        attempt.failureCode = 'UPSTREAM_TRANSPORT_UNCONFIRMED';
        store.putAttempt(session.sid, id, attempt);
        return shapeAttempt(attempt);
      }
    }
    try {
      attempt.workbenchCase = await readCase(attempt.assessmentRef.logical_id);
      const actual = attempt.workbenchCase.applicability.applicabilityAssessmentRef;
      if ((actual.logicalId ?? actual.logical_id) !== attempt.assessmentRef.logical_id
        || (actual.semanticHash ?? actual.semantic_hash) !== attempt.assessmentRef.semantic_hash) {
        throw new Error('UPSTREAM_CASE_REF_MISMATCH');
      }
      attempt.state = 'CONFIRMED';
      attempt.failureCode = null;
      store.putAttempt(session.sid, id, attempt);
    } catch {
      attempt.state = 'WRITE_CONFIRMED_READ_PENDING';
      attempt.failureCode = 'CASE_READ_NOT_YET_CONFIRMED';
      store.putAttempt(session.sid, id, attempt);
    }
    return shapeAttempt(attempt);
  }

  async function handle(req, res, pathname) {
    if (pathname === '/api/demo/session' && req.method === 'GET') {
      const session = store.session(req, true);
      const setCookie = session.newSession
        ? { 'set-cookie': 'adr_demo_sid=' + session.sid
          + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800' }
        : {};
      return json(res, 200, { csrf: session.record.csrf, mode: 'DEMO', qualifiedHost: true }, setCookie);
    }
    const session = requireSession(req, res, store, req.method !== 'GET');
    if (!session) return;
    if (pathname === '/api/demo/scenario' && req.method === 'GET') {
      try {
        const preview = await readCase(config.demoAssessmentId);
        return json(res, 200, {
          scenarioId: 'QUALIFIED_SYNTHETIC_V03',
          status: 'HOST_HTTP_VALIDATED_SYNTHETIC_WORLD',
          sampleCase: preview,
          runnable: true
        });
      } catch (e) { return json(res, e.status ?? 503, { code: toText(e.message) }); }
    }
    if (pathname === '/api/workbench/escalations' && req.method === 'GET') {
      try {
        const result = await upstream(config, '/v1/workbench/escalations');
        if (result.status !== 200) return json(res, result.status, { code: result.body.code ?? 'UPSTREAM_REJECTED' });
        if (!Array.isArray(result.body)) throw new Error('INVALID_ESCALATION_PROJECTION');
        return json(res, 200, result.body.map(safeCase));
      } catch { return json(res, 503, { code: 'WORKBENCH_READ_UNAVAILABLE' }); }
    }
    const caseMatch = /^\/api\/workbench\/cases\/([a-zA-Z0-9._-]{1,180})$/.exec(pathname);
    if (caseMatch && req.method === 'GET') {
      try { return json(res, 200, await readCase(caseMatch[1])); }
      catch (e) { return json(res, e.status ?? 503, { code: toText(e.message) }); }
    }
    if (pathname === '/api/demo/assessments' && req.method === 'POST') {
      let payload;
      try { payload = await receive(req); }
      catch (e) { return json(res, e.status ?? 400, { code: e.message }); }
      const id = payload?.operationId;
      if (typeof id !== 'string' || !UUID.test(id)
        || (payload.scenarioId !== undefined && payload.scenarioId !== 'QUALIFIED_SYNTHETIC_V03')
        || Object.keys(payload).some((key) => !['operationId', 'scenarioId'].includes(key))) {
        return json(res, 400, { code: 'INVALID_DEMO_OPERATION', message: 'only a UUID operationId is accepted' });
      }
      const key = session.sid + ':' + id;
      if (inflight.has(key)) {
        return json(res, 202, { operationId: id, state: 'IN_PROGRESS' });
      }
      const pending = runAssessment(session, id);
      inflight.set(key, pending);
      try {
        const result = await pending;
        return json(res, result.state === 'CONFIRMED' ? 201 : 202, result);
      } catch {
        return json(res, 503, { code: 'PRODUCT_STORE_UNAVAILABLE' });
      } finally {
        inflight.delete(key);
      }
    }
    const attemptMatch = /^\/api\/demo\/assessments\/([a-f0-9-]{36})$/.exec(pathname);
    if (attemptMatch && req.method === 'GET') {
      const a = store.getAttempt(session.sid, attemptMatch[1]);
      return a ? json(res, 200, shapeAttempt(a)) : json(res, 404, { code: 'OPERATION_NOT_FOUND' });
    }
    const reviewStartMatch = /^\/api\/demo\/reviews\/([a-f0-9-]{36})\/start$/.exec(pathname);
    if (reviewStartMatch) {
      const id = reviewStartMatch[1];
      const attempt = store.getAttempt(session.sid, id);
      if (!attempt || attempt.state !== 'CONFIRMED') {
        return json(res, 409, { code: 'CONFIRMED_CASE_REQUIRED' });
      }
      const previous = store.getReviewStart(session.sid, id);
      if (req.method === 'GET') {
        return json(res, 200, previous ?? { kind: 'NON_AUTHORITY_REVIEW_START',
          operationId: id, startedAt: null, timingStatus: 'UNKNOWN' });
      }
      if (req.method === 'POST') {
        if (store.getReview(session.sid, id)) return json(res, 409, { code: 'REVIEW_ALREADY_RECORDED' });
        try {
          const started = store.startReview(session.sid, id, attempt.assessmentRef,
            attempt.workbenchCase.projectionHash);
          return json(res, previous ? 200 : 201, started);
        } catch { return json(res, 503, { code: 'REVIEW_START_UNCONFIRMED' }); }
      }
    }
    const reviewMatch = /^\/api\/demo\/reviews\/([a-f0-9-]{36})$/.exec(pathname);
    if (reviewMatch) {
      const id = reviewMatch[1];
      const attempt = store.getAttempt(session.sid, id);
      if (!attempt || attempt.state !== 'CONFIRMED') {
        return json(res, 409, { code: 'CONFIRMED_CASE_REQUIRED' });
      }
      if (req.method === 'GET') {
        const existing = store.getReview(session.sid, id);
        return existing ? json(res, 200, existing) : json(res, 404, { code: 'REVIEW_NOT_FOUND' });
      }
      if (req.method === 'POST') {
        let body;
        try { body = await receive(req); }
        catch (e) { return json(res, e.status ?? 400, { code: e.message }); }
        if (store.getReview(session.sid, id)) return json(res, 409, { code: 'REVIEW_ALREADY_RECORDED' });
        if (!OUTCOMES.has(body?.outcome) || typeof body?.notes !== 'string'
          || body.notes.length > 2000
          || Object.keys(body).some((key) => !['outcome', 'notes'].includes(key))) {
          return json(res, 400, { code: 'INVALID_REVIEW_FEEDBACK' });
        }
        const completedAt = new Date().toISOString();
        const start = store.getReviewStart(session.sid, id);
        // Review time is measured only from the persisted explicit review-start event.
        // Assessment execution, waiting and page viewing are never review duration.
        const reviewStartedAt = start?.startedAt ?? null;
        const durationMs = reviewStartedAt === null ? null :
          Math.max(0, Date.parse(completedAt) - Date.parse(reviewStartedAt));
        const record = {
          kind: 'NON_AUTHORITY_PRODUCT_REVIEW_FEEDBACK',
          operationId: id,
          reviewerId: 'synthetic-demo-session:' + session.sid.slice(0, 8),
          assessmentRef: attempt.assessmentRef,
          caseProjectionHash: attempt.workbenchCase.projectionHash,
          classificationAtReview: attempt.workbenchCase.classification,
          assessmentCreatedAt: attempt.createdAt,
          startedAt: reviewStartedAt,
          completedAt,
          durationMs,
          reviewDurationStatus: reviewStartedAt === null ? 'UNKNOWN' : 'MEASURED',
          outcome: body.outcome,
          notes: body.notes
        };
        try { store.putReview(session.sid, id, record); }
        catch { return json(res, 503, { code: 'REVIEW_PERSISTENCE_UNCONFIRMED' }); }
        return json(res, 201, record);
      }
    }
    const reportMatch = /^\/api\/demo\/reports\/([a-f0-9-]{36})$/.exec(pathname);
    if (reportMatch && req.method === 'GET') {
      const attempt = store.getAttempt(session.sid, reportMatch[1]);
      if (!attempt || attempt.state !== 'CONFIRMED') return json(res, 409, { code: 'CONFIRMED_CASE_REQUIRED' });
      const c = attempt.workbenchCase;
      const review = store.getReview(session.sid, reportMatch[1]);
      const body = renderDemoReport({ attempt, review });
      const data = Buffer.from(body);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': 'attachment; filename="adr-demo-report.html"',
        'content-length': data.length,
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'x-content-type-options': 'nosniff'
      });
      return res.end(data);
    }
    return json(res, 404, { code: 'PRODUCT_ROUTE_NOT_FOUND' });
  }
  return { handle };
}
