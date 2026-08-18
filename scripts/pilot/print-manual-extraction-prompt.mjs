import {
  ADR_MANUAL_EXTRACTION_CONTRACT,
  ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
  manualExternalExtractionPromptV3
} from '../../apps/pilot-api/src/extraction/manual-contract-v3.mjs';

if (process.argv.includes('--metadata')) {
  console.log(JSON.stringify({
    promptVersion: ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
    contract: ADR_MANUAL_EXTRACTION_CONTRACT
  }, null, 2));
} else {
  process.stdout.write(`${manualExternalExtractionPromptV3()}\n`);
}
