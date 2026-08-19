import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MATERIALIZER = join(ROOT, 'scripts/real-paper-benchmark/materialize-rp001.mjs');
const RUNNER = join(ROOT, 'scripts/real-paper-benchmark/run-rp001-live.mjs');
const temp = mkdtempSync(join(tmpdir(), 'adr-rp001-live-runner-'));
const dataDir = join(temp, 'data');
const liveDir = join(temp, 'live');
const pdfPath = join(temp, 'fixture.pdf');
const codeHead = 'b'.repeat(40);
const token = 'fixture-operator-token';
const requests = [];

function ref(kind, id, version = '1') {
  return {
    kind,
    logicalId: id,
    version,
    semanticHash: `sha256:${createHash('sha256').update(`${kind}:${id}:${version}`).digest('hex')}`
  };
}

async function runChild(file, env) {
  const child = spawn(process.execPath, [file], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  const code = await new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('exit', (exitCode) => resolvePromise(exitCode));
  });
  return { code, stdout, stderr };
}

try {
  writeFileSync(pdfPath, Buffer.from('%PDF-1.7\nRP001 live runner fixture\n%%EOF\n'));
  const materialized = spawnSync(process.execPath, [MATERIALIZER], {
    cwd: ROOT,
    env: {
      ...process.env,
      ADR_CODE_HEAD_SHA: codeHead,
      ADR_RP001_PDF_PATH: pdfPath,
      ADR_RP001_OUTPUT_DIR: dataDir,
      ADR_RP001_ACQUISITION_LOCATOR: 'fixture://rp001-live-runner',
      ADR_RP001_OPERATOR_ID: 'fixture-materializer',
      ADR_RIGHTS_JURISDICTION: 'UNSPECIFIED'
    },
    encoding: 'utf8'
  });
  assert.equal(materialized.status, 0, `${materialized.stderr}\n${materialized.stdout}`);

  const checkpoint = JSON.parse(readFileSync(join(dataDir, 'runtime-checkpoint.json'), 'utf8'));
  const upload = checkpoint.payload.ingestion.sessions[0];
  const compilationRef = ref('ScientificCompilationResult', 'compilation.fixture.RP001');
  const claimRef = ref('ClaimCandidate', 'candidate.fixture.RP001');
  const contextRef = ref('SourceContextCandidate', 'context.fixture.RP001');
  const grantRef = ref('RightsGrant', 'rights.grant.fixture.RP001');

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = null;
    if (req.method !== 'GET') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
    }
    requests.push({ method: req.method, path: url.pathname, body, authorization: req.headers.authorization ?? null });
    let payload;
    let status = 200;
    if (req.method === 'GET' && url.pathname === '/readyz') {
      payload = {
        ready: true,
        extraction: { configured: true },
        automatedSourceFaithfulReview: { configured: true }
      };
    } else if (req.method === 'POST' && url.pathname.endsWith('/rights')) {
      payload = { rightsGrantRef: grantRef, rightsPolicyRef: ref('RightsPolicy', 'rights.policy.fixture.RP001') };
    } else if (req.method === 'POST' && url.pathname.endsWith('/extract')) {
      payload = { compilationResultRef: compilationRef, candidateCount: 1, candidates: [], rightsDecisionRefs: [] };
      status = 201;
    } else if (req.method === 'POST' && url.pathname.endsWith('/automated-review')) {
      payload = {
        total: 1,
        processed: 1,
        autoAccepted: 0,
        autoRejected: 0,
        escalated: 1,
        skipped: 0
      };
    } else if (req.method === 'GET' && url.pathname.endsWith('/compilations')) {
      payload = {
        compilations: [{
          compilationResultRef: compilationRef,
          runMetadata: { originalCandidateCount: 1, invalidCandidateCount: 0 },
          candidates: [{
            claimCandidateRef: claimRef,
            sourceContextCandidateRef: contextRef,
            claimType: 'BOUNDARY_CONSTRAINT',
            automatedReview: {
              status: 'ESCALATED_PENDING_HUMAN',
              effectiveDisposition: 'ESCALATE_TO_HUMAN'
            },
            review: null
          }]
        }]
      };
    } else {
      status = 404;
      payload = { error: 'NOT_FOUND' };
    }
    const encoded = Buffer.from(JSON.stringify(payload));
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': encoded.byteLength });
    res.end(encoded);
  });

  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  try {
    const run = await runChild(RUNNER, {
      ...process.env,
      ADR_PILOT_BASE_URL: `http://127.0.0.1:${address.port}`,
      ADR_OPERATOR_TOKEN: token,
      ADR_DATA_DIR: dataDir,
      ADR_RP001_LIVE_OUTPUT_DIR: liveDir,
      ADR_CODE_HEAD_SHA: codeHead,
      ADR_RIGHTS_JURISDICTION: 'UNSPECIFIED',
      ADR_EXTERNAL_PROCESSING_AUTHORIZED: 'true'
    });
    assert.equal(run.code, 0, `${run.stderr}\n${run.stdout}`);
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }

  assert.deepEqual(
    requests.map((item) => `${item.method} ${item.path}`),
    [
      'GET /readyz',
      `POST /operator/source-uploads/${upload.uploadId}/rights`,
      `POST /operator/source-uploads/${upload.uploadId}/extract`,
      `POST /operator/source-uploads/${upload.uploadId}/automated-review`,
      `GET /operator/source-uploads/${upload.uploadId}/compilations`
    ]
  );
  for (const item of requests.slice(1)) assert.equal(item.authorization, `Bearer ${token}`);

  const rightsRequest = requests[1].body;
  assert.equal(rightsRequest.subject, 'SOURCE_ARTIFACT');
  assert.equal(rightsRequest.basisClass, 'LICENSE');
  assert.deepEqual(rightsRequest.rules.map((rule) => rule.operation), [
    'READ_FOR_EXTRACTION',
    'MODEL_EGRESS',
    'RETAIN_DERIVED'
  ]);
  for (const rule of rightsRequest.rules) {
    assert.deepEqual(rule.purposes, ['SCIENTIFIC_CLAIM_EXTRACTION', 'SOURCE_FAITHFUL_REVIEW']);
  }
  assert.equal(requests[2].body.externalProcessingAuthorized, true);
  assert.equal(requests[3].body.externalProcessingAuthorized, true);
  assert.deepEqual(requests[3].body.compilationResultRef, compilationRef);

  const result = JSON.parse(readFileSync(join(liveDir, 'rp001-live-run.json'), 'utf8'));
  assert.equal(result.paperId, 'RP001');
  assert.equal(result.codeHeadSha, codeHead);
  assert.equal(result.llm1CandidateCount, 1);
  assert.equal(result.referenceStatus, 'PENDING_BLIND_INDEPENDENT_REFERENCE_ADJUDICATION');
  assert.equal(result.scientificQualificationDecisionCount, 0);

  const summary = JSON.parse(readFileSync(join(liveDir, 'benchmark-summary-pre-reference.json'), 'utf8'));
  assert.equal(summary.runMode, 'REAL');
  assert.equal(summary.exactEvidenceGate, 'PASS');
  assert.equal(summary.totals.escalatedCount, 1);
  assert.equal(summary.totals.autoAcceptedCount, 0);
  assert.equal(summary.totals.falseAcceptCount, 0);

  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
