import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import {
  ADR_SOURCE_FAITHFUL_REVIEW_PROMPT_VERSION,
  ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER,
  ADR_SOURCE_FAITHFUL_REVIEW_SCHEMA_VERSION,
  automatedSourceFaithfulReviewJsonSchema,
  reviewSourceFaithfulnessWithOpenAI
} from '../../apps/pilot-api/src/review/openai-review.mjs';

const blindPacket = {
  contractVersion: 'adr.automated-source-faithful-review.v1',
  claimCandidateRef: { kind: 'ClaimCandidate', logicalId: 'claim-candidate.fixture', version: '1', semanticHash: `sha256:${'1'.repeat(64)}` },
  sourceContextCandidateRef: { kind: 'SourceContextCandidate', logicalId: 'context-candidate.fixture', version: '1', semanticHash: `sha256:${'2'.repeat(64)}` },
  sourceArtifactRef: { kind: 'SourceArtifact', logicalId: 'artifact.fixture', version: '1', semanticHash: `sha256:${'3'.repeat(64)}` },
  sourceArtifactContentHash: `sha256:${'4'.repeat(64)}`,
  claim: {
    claimType: 'PARAMETER',
    assertion: 'Soil temperature threshold is 18 C.',
    sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 2, evidenceText: '18 C' } }
  },
  sourceContext: {
    BIOLOGICAL: { status: 'REPORTED', dimensions: [{ semanticHint: 'crop.identity', valueCandidate: 'maize', supportClass: 'EXPLICIT_SOURCE', sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 2, evidenceText: 'maize' } } }] },
    ENVIRONMENTAL: { status: 'REPORTED', dimensions: [{ semanticHint: 'soil.temperature', valueCandidate: '18', unitCandidate: 'C', supportClass: 'EXPLICIT_SOURCE', sourceLocator: { kind: 'DOCUMENT_COORDINATE', scheme: 'PDF_PAGE_TEXT_V1', coordinates: { page: 2, evidenceText: '18 C' } } }] },
    MANAGEMENT: { status: 'NOT_REPORTED', dimensions: [] },
    OPERATIONAL: { status: 'NOT_REPORTED', dimensions: [] },
    MEASUREMENT: { status: 'NOT_REPORTED', dimensions: [] },
    JURISDICTION_ECONOMIC: { status: 'NOT_REPORTED', dimensions: [] }
  },
  blindness: {
    extractorProviderHidden: true,
    extractorModelHidden: true,
    extractorConfidenceHidden: true,
    extractorRationaleHidden: true,
    contextDimensionConfidenceHidden: true
  }
};

const output = {
  disposition: 'ACCEPT_SOURCE_FAITHFUL',
  reasonCodes: [],
  rationale: 'The candidate is completely supported by the cited source text.',
  reviewConfidence: 0.98,
  checks: {
    ASSERTION_SUPPORT: 'PASS',
    CONTEXT_COMPLETENESS: 'PASS',
    EVIDENCE_COVERAGE: 'PASS',
    CAUSALITY_FIDELITY: 'PASS',
    TEMPORAL_FIDELITY: 'PASS',
    POPULATION_FIDELITY: 'PASS',
    GEOGRAPHY_FIDELITY: 'PASS',
    MANAGEMENT_FIDELITY: 'PASS',
    MEASUREMENT_FIDELITY: 'PASS',
    CLAIM_ATOMICITY: 'PASS',
    UNSUPPORTED_INFERENCE: 'PASS'
  },
  contextAdjudication: {
    BIOLOGICAL: [{ semanticId: 'crop.identity', valueType: 'CATEGORY', unit: null }],
    ENVIRONMENTAL: [{ semanticId: 'soil.temperature', valueType: 'DECIMAL', unit: 'C' }],
    MANAGEMENT: [],
    OPERATIONAL: [],
    MEASUREMENT: [],
    JURISDICTION_ECONOMIC: []
  }
};

const requests = [];
const fakeFetch = async (url, options) => {
  requests.push({ url, options });
  if (url.endsWith('/files') && options.method === 'POST') {
    return new Response(JSON.stringify({ id: 'file-review-fixture' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.endsWith('/responses') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const inputText = body.input[0].content.find((item) => item.type === 'input_text').text;
    assert.ok(inputText.includes('BLIND REVIEW PACKET'));
    assert.ok(inputText.includes('Soil temperature threshold is 18 C.'));
    assert.equal(inputText.includes('EXTRACT_PROVIDER_A'), false);
    assert.equal(inputText.includes('extract-model-a'), false);
    assert.equal(inputText.includes('extractorConfidence'), false);
    const schema = body.text.format.schema;
    assert.equal(schema.properties.contextAdjudication.properties.BIOLOGICAL.minItems, 1);
    assert.equal(schema.properties.contextAdjudication.properties.MANAGEMENT.maxItems, 0);
    return new Response(JSON.stringify({
      id: 'resp-review-fixture',
      output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }]
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-review-fixture' } });
  }
  if (url.includes('/files/file-review-fixture') && options.method === 'DELETE') {
    return new Response(JSON.stringify({ id: 'file-review-fixture', deleted: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected request ${options.method} ${url}`);
};

const pdf = Buffer.from('%PDF-1.7\nreview fixture\n%%EOF');
const result = await reviewSourceFaithfulnessWithOpenAI({
  readable: Readable.from([pdf]),
  byteLength: pdf.byteLength,
  filename: 'review-fixture.pdf',
  blindPacket,
  model: 'review-model-b',
  apiKey: 'test-key',
  fetchImpl: fakeFetch
});

assert.deepEqual(result.output, {
  ...output,
  contextAdjudication: {
    BIOLOGICAL: [{ semanticId: 'crop.identity', valueType: 'CATEGORY' }],
    ENVIRONMENTAL: [{ semanticId: 'soil.temperature', valueType: 'DECIMAL', unit: 'C' }],
    MANAGEMENT: [], OPERATIONAL: [], MEASUREMENT: [], JURISDICTION_ECONOMIC: []
  }
});
assert.equal(result.reviewerMetadata.provider, ADR_SOURCE_FAITHFUL_REVIEW_PROVIDER);
assert.equal(result.reviewerMetadata.promptVersion, ADR_SOURCE_FAITHFUL_REVIEW_PROMPT_VERSION);
assert.equal(result.reviewerMetadata.schemaVersion, ADR_SOURCE_FAITHFUL_REVIEW_SCHEMA_VERSION);
assert.equal(result.reviewerMetadata.reviewMode, 'BLIND_FALSIFICATION');
assert.equal(result.providerTrace.fileDeletedAfterReview, true);
assert.equal(requests.filter((request) => request.url.endsWith('/responses')).length, 1);

const schema = automatedSourceFaithfulReviewJsonSchema(blindPacket);
assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.checks.required.length, 11);

console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
