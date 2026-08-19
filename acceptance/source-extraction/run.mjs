import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import {
  ADR_EXTRACTION_PROMPT_VERSION,
  ADR_EXTRACTION_PROVIDER,
  ADR_EXTRACTION_SCHEMA_VERSION,
  ADR_EXTRACTION_UPLOAD_CONTRACT,
  OpenAIExtractionError,
  extractCompilationProposalWithOpenAI
} from '../../apps/pilot-api/src/extraction/openai.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import {
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';

function jsonResponse(status, payload, requestId = 'req-test') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId }
  });
}

function validStructuredOutput() {
  const notReported = { status: 'NOT_REPORTED', dimensions: [] };
  return {
    claims: [{
      key: 'claim-1',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: 'Irrigation may be considered when root-zone depletion exceeds 45%.',
      confidence: 0.91,
      sourceLocator: { page: 7, evidenceText: 'root-zone depletion exceeds 45%' },
      sourceContext: {
        BIOLOGICAL: {
          status: 'REPORTED',
          dimensions: [{
            semanticHint: 'crop',
            valueCandidate: 'maize',
            unitCandidate: null,
            confidence: 0.99,
            sourceLocator: { page: 2, evidenceText: 'maize' }
          }]
        },
        ENVIRONMENTAL: {
          status: 'REPORTED',
          dimensions: [{
            semanticHint: 'soil.texture',
            valueCandidate: 'silt loam',
            unitCandidate: null,
            confidence: 0.95,
            sourceLocator: { page: 3, evidenceText: 'silt loam' }
          }]
        },
        MANAGEMENT: notReported,
        OPERATIONAL: notReported,
        MEASUREMENT: notReported,
        JURISDICTION_ECONOMIC: notReported
      }
    }]
  };
}

function fakeOpenAI() {
  const state = { uploadedBytes: null, purpose: null, filename: null, responseRequest: null, deletedFiles: [] };
  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url);
    if (parsed.pathname === '/v1/files' && options.method === 'POST') {
      assert.ok(options.body instanceof FormData);
      state.purpose = options.body.get('purpose');
      const file = options.body.get('file');
      assert.ok(file instanceof Blob);
      state.filename = file.name;
      state.uploadedBytes = Buffer.from(await file.arrayBuffer());
      return jsonResponse(200, { id: 'file-test', object: 'file', bytes: state.uploadedBytes.byteLength, filename: file.name, purpose: state.purpose });
    }
    if (parsed.pathname === '/v1/responses' && options.method === 'POST') {
      state.responseRequest = JSON.parse(options.body);
      return jsonResponse(200, {
        id: 'resp-test',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(validStructuredOutput()) }] }]
      });
    }
    if (parsed.pathname === '/v1/files/file-test' && options.method === 'DELETE') {
      state.deletedFiles.push('file-test');
      return jsonResponse(200, { id: 'file-test', deleted: true });
    }
    return jsonResponse(404, { error: { code: 'UNEXPECTED_TEST_ROUTE', message: parsed.pathname } });
  }
  return { state, fetchImpl };
}

function chunkedPdf(byteLength, chunkBytes = 256 * 1024) {
  async function* chunks() {
    let emitted = 0;
    const header = Buffer.from('%PDF-1.7\n');
    yield header;
    emitted += header.byteLength;
    while (emitted < byteLength) {
      const size = Math.min(chunkBytes, byteLength - emitted);
      yield Buffer.alloc(size, 0x41);
      emitted += size;
    }
  }
  return Readable.from(chunks());
}

async function expectAsyncError(fn, code) {
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof OpenAIExtractionError, `expected OpenAIExtractionError, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
  return caught;
}

function audit(eventId) {
  return {
    eventId,
    occurredAt: '2026-08-18T01:00:00.000Z',
    actor: { type: 'SERVICE', id: 'source-extraction-acceptance' },
    details: { channel: 'source-extraction-acceptance' }
  };
}

function documentCoordinateProposal() {
  const notReported = { status: 'NOT_REPORTED', dimensions: [] };
  return {
    claims: [{
      key: 'claim-1',
      claimType: 'OPERATIONAL_RECOMMENDATION',
      assertion: 'Irrigation may be considered when root-zone depletion exceeds 45%.',
      confidence: 0.91,
      sourceLocator: {
        kind: 'DOCUMENT_COORDINATE',
        scheme: 'PDF_PAGE_TEXT_V1',
        coordinates: { page: 7, evidenceText: 'root-zone depletion exceeds 45%' }
      },
      sourceContext: {
        BIOLOGICAL: {
          status: 'REPORTED',
          dimensions: [{
            semanticHint: 'crop',
            valueCandidate: 'maize',
            supportClass: 'EXPLICIT_SOURCE',
            confidence: 0.99,
            sourceLocator: {
              kind: 'DOCUMENT_COORDINATE',
              scheme: 'PDF_PAGE_TEXT_V1',
              coordinates: { page: 2, evidenceText: 'maize' }
            }
          }]
        },
        ENVIRONMENTAL: notReported,
        MANAGEMENT: notReported,
        OPERATIONAL: notReported,
        MEASUREMENT: notReported,
        JURISDICTION_ECONOMIC: notReported
      }
    }],
    runMetadata: {
      provider: ADR_EXTRACTION_PROVIDER,
      model: 'test-model',
      promptVersion: ADR_EXTRACTION_PROMPT_VERSION,
      schemaVersion: ADR_EXTRACTION_SCHEMA_VERSION,
      uploadContract: ADR_EXTRACTION_UPLOAD_CONTRACT
    }
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('OpenAI extraction uses Files API user_data PDF input and returns strict compiler proposal', async () => {
  const byteLength = 2 * 1024 * 1024 + 123;
  const fake = fakeOpenAI();
  const result = await extractCompilationProposalWithOpenAI({
    readable: chunkedPdf(byteLength),
    byteLength,
    filename: 'paper.pdf',
    model: 'test-model',
    apiKey: 'test-key',
    fetchImpl: fake.fetchImpl
  });

  assert.equal(fake.state.purpose, 'user_data');
  assert.equal(fake.state.filename, 'paper.pdf');
  assert.equal(fake.state.uploadedBytes.byteLength, byteLength);
  assert.equal(fake.state.uploadedBytes.subarray(0, 5).toString('utf8'), '%PDF-');
  assert.equal(fake.state.responseRequest.model, 'test-model');
  assert.equal(fake.state.responseRequest.store, false);
  assert.equal(fake.state.responseRequest.input[0].content[0].type, 'input_file');
  assert.equal(fake.state.responseRequest.input[0].content[0].file_id, 'file-test');
  assert.equal(fake.state.responseRequest.input[0].content[0].detail, 'low');
  assert.equal(fake.state.responseRequest.text.format.type, 'json_schema');
  assert.equal(fake.state.responseRequest.text.format.strict, true);
  assert.equal(result.proposal.runMetadata.uploadContract, ADR_EXTRACTION_UPLOAD_CONTRACT);
  assert.equal(result.proposal.claims.length, 1);
  assert.equal(result.proposal.claims[0].sourceLocator.kind, 'DOCUMENT_COORDINATE');
  assert.equal(result.proposal.claims[0].sourceContext.BIOLOGICAL.dimensions[0].supportClass, 'EXPLICIT_SOURCE');
  assert.deepEqual(fake.state.deletedFiles, ['file-test']);
  assert.equal(result.providerTrace.responseId, 'resp-test');
  assert.equal(result.providerTrace.fileDeletedAfterExtraction, true);
});

test('direct PDF extraction fails closed before network when provider file-input limit is exceeded', async () => {
  let calls = 0;
  const error = await expectAsyncError(
    () => extractCompilationProposalWithOpenAI({
      readable: chunkedPdf(50_000_000),
      byteLength: 50_000_000,
      filename: 'too-large.pdf',
      model: 'test-model',
      apiKey: 'test-key',
      fetchImpl: async () => { calls += 1; throw new Error('should not call network'); }
    }),
    'OPENAI_DIRECT_FILE_INPUT_LIMIT_EXCEEDED'
  );
  assert.equal(calls, 0);
  assert.equal(error.stage, 'PREPARE_FILE_INPUT');
});

test('network failures retain a safe stage-specific diagnostic instead of unclassified failure', async () => {
  const network = new TypeError('fetch failed', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) });
  const error = await expectAsyncError(
    () => extractCompilationProposalWithOpenAI({
      readable: chunkedPdf(1024),
      byteLength: 1024,
      filename: 'paper.pdf',
      model: 'test-model',
      apiKey: 'test-key',
      fetchImpl: async () => { throw network; }
    }),
    'OPENAI_NETWORK_FAILURE'
  );
  assert.equal(error.stage, 'FILES_UPLOAD');
  assert.match(error.message, /FILES_UPLOAD/);
  assert.match(error.message, /ECONNRESET/);
  assert.ok(!error.message.includes('test-key'));
});

test('provider HTTP failures retain exact stage/status/provider code', async () => {
  const error = await expectAsyncError(
    () => extractCompilationProposalWithOpenAI({
      readable: chunkedPdf(1024),
      byteLength: 1024,
      filename: 'paper.pdf',
      model: 'test-model',
      apiKey: 'test-key',
      fetchImpl: async () => jsonResponse(401, { error: { type: 'invalid_request_error', code: 'invalid_api_key', message: 'Incorrect API key provided.' } }, 'req-401')
    }),
    'OPENAI_FILE_UPLOAD_FAILED'
  );
  assert.equal(error.stage, 'FILES_UPLOAD');
  assert.equal(error.status, 401);
  assert.equal(error.providerCode, 'invalid_api_key');
  assert.equal(error.requestId, 'req-401');
});

test('ScientificCompiler materializes DOCUMENT_COORDINATE proposals without loading whole retained PDF bytes', () => {
  const ledger = new AuthorityLedger();
  const source = ledger.publish({
    kind: 'Source',
    logicalId: 'source.large-paper',
    version: '1',
    semanticPayload: { title: 'Large paper' },
    audit: audit('evt-large-source')
  });
  const artifact = ledger.publish({
    kind: 'SourceArtifact',
    logicalId: 'artifact.large-paper',
    version: '1',
    semanticPayload: {
      sourceRef: source.ref,
      contentHash: `sha256:${'a'.repeat(64)}`,
      byteLength: 750 * 1024 * 1024,
      mediaType: 'application/pdf'
    },
    audit: { ...audit('evt-large-artifact'), inputRefs: [source.ref] }
  });
  let wholeReads = 0;
  const sourceRegistry = {
    resolveArtifact(ref) { return ledger.resolve(ref); },
    readArtifactBytes() {
      wholeReads += 1;
      throw new Error('WHOLE_PDF_READ_FORBIDDEN_IN_DOCUMENT_COORDINATE_PATH');
    }
  };
  const definition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.openai-paper-extraction',
    version: '1',
    compilerId: 'openai-paper-extraction',
    implementationVersion: 'v1',
    configuration: { model: 'test-model' },
    audit: audit('evt-compiler-definition')
  });
  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const result = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.large-paper',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: definition.ref,
    proposal: documentCoordinateProposal(),
    audit: audit('evt-compilation')
  });
  assert.equal(wholeReads, 0);
  assert.equal(result.claimCandidates.length, 1);
  assert.equal(result.claimCandidates[0].semanticPayload.sourceLocator.kind, 'DOCUMENT_COORDINATE');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
