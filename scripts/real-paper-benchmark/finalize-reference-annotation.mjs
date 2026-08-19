import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REFERENCE_WORKSHEET_VERSION, ReferenceWorksheetError } from './prepare-reference-worksheet.mjs';

export const REFERENCE_ANNOTATION_VERSION = 'adr.real-paper-reference-annotation.v1';
const DISPOSITIONS = new Set(['ACCEPT_SOURCE_FAITHFUL', 'REJECT_SOURCE_FAITHFUL']);

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', `${name} must be a non-empty string`);
  }
  return value.trim();
}

export function finalizeReferenceAnnotation(worksheet) {
  if (!worksheet || typeof worksheet !== 'object' || Array.isArray(worksheet)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', 'worksheet must be an object');
  }
  if (worksheet.worksheetVersion !== REFERENCE_WORKSHEET_VERSION) {
    throw new ReferenceWorksheetError(
      'INVALID_REFERENCE_WORKSHEET_VERSION',
      `worksheetVersion must be ${REFERENCE_WORKSHEET_VERSION}`
    );
  }
  if (worksheet.blindToAutomatedDisposition !== true
    || worksheet.frozenBeforeAutomatedReview !== true
    || worksheet.automatedResultAccessed !== false) {
    throw new ReferenceWorksheetError(
      'REFERENCE_WORKSHEET_BLINDNESS_BROKEN',
      'reference worksheet must remain blind and must declare automatedResultAccessed=false'
    );
  }
  const paperId = requiredText(worksheet.paperId, 'paperId');
  const sourcePacketHash = requiredText(worksheet.sourcePacketHash, 'sourcePacketHash');
  if (!/^sha256:[0-9a-f]{64}$/.test(sourcePacketHash)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', 'sourcePacketHash must be sha256:<64 lowercase hex>');
  }
  const adjudicator = worksheet.adjudicator;
  if (!adjudicator || typeof adjudicator !== 'object' || Array.isArray(adjudicator)) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', 'adjudicator must be an object');
  }
  const normalizedAdjudicator = {
    type: requiredText(adjudicator.type, 'adjudicator.type'),
    id: requiredText(adjudicator.id, 'adjudicator.id'),
    provider: adjudicator.provider === null || adjudicator.provider === undefined
      ? null : requiredText(adjudicator.provider, 'adjudicator.provider'),
    model: adjudicator.model === null || adjudicator.model === undefined
      ? null : requiredText(adjudicator.model, 'adjudicator.model')
  };
  if (!Array.isArray(worksheet.adjudications) || worksheet.adjudications.length === 0) {
    throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', 'adjudications must be a non-empty array');
  }
  const seen = new Set();
  const adjudications = worksheet.adjudications.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', `adjudications[${index}] must be an object`);
    }
    const candidateKey = requiredText(item.candidateKey, `adjudications[${index}].candidateKey`);
    if (seen.has(candidateKey)) {
      throw new ReferenceWorksheetError('DUPLICATE_REFERENCE_CANDIDATE', `duplicate candidateKey ${candidateKey}`);
    }
    seen.add(candidateKey);
    const referenceDisposition = requiredText(
      item.referenceDisposition,
      `adjudications[${index}].referenceDisposition`
    );
    if (!DISPOSITIONS.has(referenceDisposition)) {
      throw new ReferenceWorksheetError(
        'INVALID_REFERENCE_DISPOSITION',
        `adjudications[${index}].referenceDisposition must be ACCEPT_SOURCE_FAITHFUL or REJECT_SOURCE_FAITHFUL`
      );
    }
    if (!Array.isArray(item.defectCodes)) {
      throw new ReferenceWorksheetError('INVALID_REFERENCE_WORKSHEET', `adjudications[${index}].defectCodes must be an array`);
    }
    const defectCodes = [...new Set(item.defectCodes.map((code, codeIndex) =>
      requiredText(code, `adjudications[${index}].defectCodes[${codeIndex}]`)))].sort();
    if (referenceDisposition === 'REJECT_SOURCE_FAITHFUL' && defectCodes.length === 0) {
      throw new ReferenceWorksheetError(
        'REFERENCE_REJECT_DEFECT_REQUIRED',
        `adjudications[${index}] rejection requires at least one defect code`
      );
    }
    const rationale = requiredText(item.rationale, `adjudications[${index}].rationale`);
    return { candidateKey, referenceDisposition, defectCodes, rationale };
  });

  return {
    annotationVersion: REFERENCE_ANNOTATION_VERSION,
    paperId,
    blindToAutomatedDisposition: true,
    adjudicator: normalizedAdjudicator,
    adjudications
  };
}

function main() {
  const [worksheetPath, outputPath] = process.argv.slice(2);
  if (!worksheetPath || !outputPath) {
    console.error('usage: node scripts/real-paper-benchmark/finalize-reference-annotation.mjs <completed-worksheet.json> <reference-annotation.json>');
    process.exitCode = 2;
    return;
  }
  const worksheet = JSON.parse(readFileSync(worksheetPath, 'utf8'));
  const annotation = finalizeReferenceAnnotation(worksheet);
  writeFileSync(outputPath, `${JSON.stringify(annotation, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    annotationVersion: annotation.annotationVersion,
    paperId: annotation.paperId,
    adjudicationCount: annotation.adjudications.length,
    blindToAutomatedDisposition: true,
    outputPath
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
