import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cloneCanonicalValue, semanticHash } from '../../packages/canonicalization/src/index.mjs';

export const REFERENCE_PACKET_VERSION = 'adr.real-paper-reference-packet.v1';
export const REFERENCE_WORKSHEET_VERSION = 'adr.real-paper-reference-worksheet.v1';

const CANDIDATE_KEYS = new Set([
  'candidateKey',
  'claimCandidateRef',
  'sourceContextCandidateRef',
  'claimType',
  'assertion',
  'sourceLocator',
  'contextFamilies'
]);
const FORBIDDEN_REVIEW_KEYS = new Set([
  'automatedReview',
  'automatedStatus',
  'review',
  'reviewDisposition',
  'referenceDisposition',
  'extractionConfidence'
]);

export class ReferenceWorksheetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReferenceWorksheetError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function assertNoReviewLeak(value, path = 'candidate') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoReviewLeak(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_REVIEW_KEYS.has(key)) {
      throw new ReferenceWorksheetError(
        'REFERENCE_PACKET_REVIEW_LEAK',
        `${path}.${key} is forbidden in blind reference input`
      );
    }
    assertNoReviewLeak(nested, `${path}.${key}`);
  }
}

function normalizePacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', 'reference packet must be an object');
  }
  if (packet.schemaVersion !== REFERENCE_PACKET_VERSION) {
    throw new ReferenceWorksheetError(
      'INVALID_REFERENCE_PACKET_VERSION',
      `schemaVersion must be ${REFERENCE_PACKET_VERSION}`
    );
  }
  const paperId = requiredText(packet.paperId, 'paperId');
  const codeHeadSha = requiredText(packet.codeHeadSha, 'codeHeadSha');
  if (!/^[0-9a-f]{40}$/.test(codeHeadSha)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', 'codeHeadSha must be exact lowercase 40-character git SHA');
  }
  for (const [field, expected] of [
    ['blindToAutomatedDisposition', true],
    ['frozenBeforeAutomatedReview', true],
    ['containsAutomatedDisposition', false],
    ['containsExtractionConfidence', false],
    ['containsLlm1ProviderModelIdentity', false]
  ]) {
    if (packet[field] !== expected) {
      throw new ReferenceWorksheetError('REFERENCE_PACKET_NOT_BLIND', `${field} must be ${expected}`);
    }
  }
  if (!Array.isArray(packet.candidates)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', 'candidates must be an array');
  }
  if (packet.candidateCount !== packet.candidates.length) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', 'candidateCount must equal candidates.length');
  }
  const seen = new Set();
  const candidates = packet.candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new ReferenceWorksheetError('INVALID_REFERENCE_PACKET', `candidates[${index}] must be an object`);
    }
    for (const key of Object.keys(candidate)) {
      if (!CANDIDATE_KEYS.has(key)) {
        throw new ReferenceWorksheetError(
          'REFERENCE_PACKET_CANDIDATE_FIELD_FORBIDDEN',
          `candidates[${index}].${key} is outside the frozen blind packet candidate shape`
        );
      }
    }
    assertNoReviewLeak(candidate, `candidates[${index}]`);
    const candidateKey = requiredText(candidate.candidateKey, `candidates[${index}].candidateKey`);
    if (seen.has(candidateKey)) {
      throw new ReferenceWorksheetError('DUPLICATE_REFERENCE_CANDIDATE', `duplicate candidateKey ${candidateKey}`);
    }
    seen.add(candidateKey);
    return cloneCanonicalValue(candidate);
  });
  return {
    packet: cloneCanonicalValue(packet),
    paperId,
    codeHeadSha,
    candidates
  };
}

export function prepareReferenceWorksheet(packet, {
  adjudicatorId,
  adjudicatorType = 'HUMAN_OR_INDEPENDENT_REFERENCE',
  provider = null,
  model = null
} = {}) {
  const normalized = normalizePacket(packet);
  const id = requiredText(adjudicatorId, 'adjudicatorId');
  const type = requiredText(adjudicatorType, 'adjudicatorType');
  const packetHash = semanticHash('AdrRealPaperReferencePacket', normalized.packet);
  return {
    worksheetVersion: REFERENCE_WORKSHEET_VERSION,
    paperId: normalized.paperId,
    codeHeadSha: normalized.codeHeadSha,
    sourcePacketHash: packetHash,
    blindToAutomatedDisposition: true,
    frozenBeforeAutomatedReview: true,
    automatedResultAccessed: false,
    adjudicator: {
      type,
      id,
      provider: provider === null ? null : requiredText(provider, 'provider'),
      model: model === null ? null : requiredText(model, 'model')
    },
    sourceEvidence: cloneCanonicalValue(normalized.packet.sourceEvidence),
    adjudications: normalized.candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      claimType: candidate.claimType,
      assertion: candidate.assertion,
      sourceLocator: cloneCanonicalValue(candidate.sourceLocator),
      contextFamilies: cloneCanonicalValue(candidate.contextFamilies),
      referenceDisposition: null,
      defectCodes: [],
      rationale: ''
    })),
    authorityClaim: 'REFERENCE_WORKSHEET_ONLY_NOT_REFERENCE_TRUTH_OR_SCIENTIFIC_AUTHORITY'
  };
}

function main() {
  const [packetPath, outputPath, adjudicatorId, providerArg, modelArg] = process.argv.slice(2);
  if (!packetPath || !outputPath || !adjudicatorId) {
    console.error('usage: node scripts/real-paper-benchmark/prepare-reference-worksheet.mjs <reference-packet.json> <worksheet.json> <adjudicator-id> [provider|-] [model|-]');
    process.exitCode = 2;
    return;
  }
  const packet = JSON.parse(readFileSync(packetPath, 'utf8'));
  const provider = providerArg && providerArg !== '-' ? providerArg : null;
  const model = modelArg && modelArg !== '-' ? modelArg : null;
  const worksheet = prepareReferenceWorksheet(packet, { adjudicatorId, provider, model });
  writeFileSync(outputPath, `${JSON.stringify(worksheet, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    worksheetVersion: worksheet.worksheetVersion,
    paperId: worksheet.paperId,
    sourcePacketHash: worksheet.sourcePacketHash,
    candidateCount: worksheet.adjudications.length,
    blindToAutomatedDisposition: true,
    outputPath
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
