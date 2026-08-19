import { strict as assert } from 'node:assert';
import {
  ADR_MANUAL_EXTRACTION_CLAIM_TYPES,
  ADR_MANUAL_EXTRACTION_CONTEXT_FAMILIES,
  ADR_MANUAL_EXTRACTION_CONTRACT,
  ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
  manualExternalExtractionPromptV3
} from '../../apps/pilot-api/src/extraction/manual-contract-v3.mjs';

const promptA = manualExternalExtractionPromptV3();
const promptB = manualExternalExtractionPromptV3();

assert.equal(ADR_MANUAL_EXTRACTION_PROMPT_VERSION, 'adr-paper-extraction-prompt-v3');
assert.equal(ADR_MANUAL_EXTRACTION_CONTRACT, 'ADR_ATOMIC_SINGLE_LOCATOR_V3');
assert.equal(promptA, promptB, 'canonical extraction prompt must be deterministic');

assert.deepEqual(ADR_MANUAL_EXTRACTION_CLAIM_TYPES, [
  'SEMANTIC_DEFINITION',
  'PARAMETER',
  'RELATIONSHIP',
  'BIOLOGICAL_PATTERN',
  'CAUSAL_EFFECT',
  'STATISTICAL_ASSOCIATION',
  'MODEL_ASSUMPTION',
  'OPERATIONAL_RECOMMENDATION',
  'BOUNDARY_CONSTRAINT',
  'EVALUATION_CLAIM'
]);
assert.equal(ADR_MANUAL_EXTRACTION_CLAIM_TYPES.includes('MEASUREMENT'), false, 'MEASUREMENT remains a context family, not a claim type');
assert.deepEqual(ADR_MANUAL_EXTRACTION_CONTEXT_FAMILIES, [
  'BIOLOGICAL',
  'ENVIRONMENTAL',
  'MANAGEMENT',
  'OPERATIONAL',
  'MEASUREMENT',
  'JURISDICTION_ECONOMIC'
]);

for (const required of [
  'ONE CLAIM = ONE ATOMIC ASSERTION',
  'sourceLocator.evidenceText must, by itself, explicitly support EVERY MATERIAL PROPOSITION',
  'SourceContext locators DO NOT substitute for incomplete claim-level evidence',
  'If an assertion would require two or more non-contiguous evidence fragments',
  'DO NOT EMIT THAT CLAIM under this single-locator contract',
  'Do not combine multiple metrics, sample counts, treatment/control branches, parameter values, effect measures, robustness-test outcomes, or boundary clauses',
  'Preserve temporal semantics exactly',
  'either cite one contiguous excerpt that contains both branches or emit separately reviewable branches',
  'Prefer omission over a candidate whose assertion, qualifier, context, or evidence binding is uncertain',
  'Would removing SourceContext still leave the claim-level evidence sufficient to verify the assertion?',
  'The trial included 84 plots and mean root depth was 42 cm',
  'accuracy, RMSE, and calibration slope',
  'treatment=A and control=B',
  'from day 0 through day 3',
  `"promptVersion": "${ADR_MANUAL_EXTRACTION_PROMPT_VERSION}"`
]) {
  assert.ok(promptA.includes(required), `canonical prompt missing contract clause: ${required}`);
}

for (const forbiddenPaper1Signature of [
  '171 fields',
  '1,250',
  '6,960',
  'Placebo',
  'RCC',
  'RSR',
  'UCC',
  'treated={3}',
  'control={0,1,2}',
  'sowing day to 5 days after',
  '372',
  '546',
  '12%',
  '17%',
  'Orchomenes',
  'cotton'
]) {
  assert.equal(
    promptA.includes(forbiddenPaper1Signature),
    false,
    `canonical prompt leaks paper-1 benchmark signature: ${forbiddenPaper1Signature}`
  );
}

console.log(JSON.stringify({
  contract: ADR_MANUAL_EXTRACTION_CONTRACT,
  promptVersion: ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
  claimTypes: ADR_MANUAL_EXTRACTION_CLAIM_TYPES.length,
  contextFamilies: ADR_MANUAL_EXTRACTION_CONTEXT_FAMILIES.length,
  blindBenchmarkLeakageCheck: 'PASS',
  status: 'PASS'
}, null, 2));
