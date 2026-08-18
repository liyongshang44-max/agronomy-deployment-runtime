import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import {
  ADR_EXTRACTION_PROMPT_VERSION,
  ADR_EXTRACTION_PROVIDER,
  ADR_EXTRACTION_SCHEMA_VERSION,
  OpenAIExtractionError,
  extractCompilationProposalWithOpenAI
} from '../../apps/pilot-api/src/extraction/openai.mjs';

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
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
  const state = {
    createdBytes: null,
    parts: [],
    responseRequest: null,
    deletedFiles: [],
    cancelledUploads: []
  };
  let partCounter = 0;

  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url);
    if (parsed.pathname === '/v1/uploads' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      state.createdBytes = body.bytes;
      assert.equal(body.purpose, 'user_data');
      assert.equal(body.mime_type, 'application/pdf');
      assert.deepEqual(body.expires_after, { anchor: 'created_at', seconds: 3600 });
      return jsonResponse(200, { id: 'upload-test', status: 'pending' });
    }
    if (parsed.pathname === '/v1/uploads/upload-test/parts' && options.method === 'POST') {
      const blob = options.body.get('data');
      const bytes = Buffer.from(await blob.arrayBuffer());
      state.parts.push(bytes);
      partCounter += 1;
      return jsonResponse(200, { id: `part-${partCounter}`, upload_id: 'upload-test' });
    }
    if (parsed.pathname === '/v1/uploads/upload-test/complete' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.part_ids.length, state.parts.length);
      return jsonResponse(200, {
        id: 'upload-test',
        status: 'completed',
        file: { id: 'file-test', bytes: state.parts.reduce((sum, part) => sum + part.byteLength, 0) }
      });
    }
    if (parsed.pathname === '/v1/responses' && options.method === 'POST') {
      state.responseRequest = JSON.parse(options.body);
      return jsonResponse(200, {
        id: 'resp-test',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(validStructuredOutput()) }]
        }]
      });
    }
    if (parsed.pathname === '/v1/files/file-test' && options.method === 'DELETE') {
      state.deletedFiles.push('file-test');
      return jsonResponse(200, { id: 'file-test', deleted: true });
    }
    if (parsed.pathname === '/v1/uploads/upload-test/cancel' && options.method === 'POST') {
      state.cancelledUploads.push('upload-test');
      return jsonResponse(200, { id: 'upload-test', status: 'cancelled' });
    }
    return jsonResponse(404, { error: { code: 'UNEXPECTED_TEST_ROUTE' } });
  }

  return { state, fetchImpl };
}

function chunkedPdf(byteLength, chunkBytes = 512 * 1024) {
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

async function expectAsyncError(fn, ErrorType, code) {
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('OpenAI extraction streams PDF in bounded parts and returns compiler-compatible page-coordinate proposal', async () => {
  const byteLength = 18 * 1024 * 1024 + 123;
  const partBytes = 4 * 1024 * 1024;
  const fake = fakeOpenAI();
  const result = await extractCompilationProposalWithOpenAI({
    readable: chunkedPdf(byteLength),
    byteLength,
    filename: 'paper.pdf',
    model: 'test-model',
    apiKey: 'test-key',
    fetchImpl: fake.fetchImpl,
    partBytes
  });

  assert.equal(fake.state.createdBytes, byteLength);
  assert.equal(fake.state.parts.reduce((sum, part) => sum + part.byteLength, 0), byteLength);
  assert.ok(fake.state.parts.every((part) => part.byteLength <= partBytes));
  assert.ok(fake.state.parts.length > 1);

  const request = fake.state.responseRequest;
  assert.equal(request.model, 'test-model');
  assert.equal(request.store, false);
  assert.equal(request.input[0].content[0].type, 'input_file');
  assert.equal(request.input[0].content[0].file_id, 'file-test');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);

  assert.equal(result.proposal.runMetadata.provider, ADR_EXTRACTION_PROVIDER);
  assert.equal(result.proposal.runMetadata.model, 'test-model');
  assert.equal(result.proposal.runMetadata.promptVersion, ADR_EXTRACTION_PROMPT_VERSION);
  assert.equal(result.proposal.runMetadata.schemaVersion, ADR_EXTRACTION_SCHEMA_VERSION);
  assert.equal(result.proposal.claims.length, 1);
  assert.deepEqual(result.proposal.claims[0].sourceLocator, {
    kind: 'DOCUMENT_COORDINATE',
    scheme: 'PDF_PAGE_TEXT_V1',
    coordinates: { page: 7, evidenceText: 'root-zone depletion exceeds 45%' }
  });
  assert.equal(result.proposal.claims[0].sourceContext.BIOLOGICAL.dimensions[0].supportClass, 'EXPLICIT_SOURCE');
  assert.equal(result.proposal.claims[0].sourceContext.MANAGEMENT.status, 'NOT_REPORTED');
  assert.deepEqual(fake.state.deletedFiles, ['file-test']);
  assert.equal(result.providerTrace.responseId, 'resp-test');
  assert.equal(result.providerTrace.fileDeletedAfterExtraction, true);
  assert.ok(!JSON.stringify(result.proposal).includes('resp-test'));
  assert.ok(!JSON.stringify(result.proposal).includes('file-test'));
});

test('provider fails closed when retained SourceArtifact byteLength disagrees with streamed bytes', async () => {
  const fake = fakeOpenAI();
  await expectAsyncError(
    () => extractCompilationProposalWithOpenAI({
      readable: chunkedPdf(1024 * 1024),
      byteLength: 1024 * 1024 + 1,
      filename: 'mismatch.pdf',
      model: 'test-model',
      apiKey: 'test-key',
      fetchImpl: fake.fetchImpl,
      partBytes: 256 * 1024
    }),
    OpenAIExtractionError,
    'SOURCE_STREAM_LENGTH_MISMATCH'
  );
  assert.deepEqual(fake.state.cancelledUploads, ['upload-test']);
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
