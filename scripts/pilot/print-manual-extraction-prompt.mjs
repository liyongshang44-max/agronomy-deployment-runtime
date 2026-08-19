import { createHash } from 'node:crypto';
import {
  ADR_MANUAL_EXTRACTION_CONTRACT,
  ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
  manualExternalExtractionPromptV3
} from '../../apps/pilot-api/src/extraction/manual-contract-v3.mjs';

const prompt = manualExternalExtractionPromptV3();
const promptHash = `sha256:${createHash('sha256').update(prompt, 'utf8').digest('hex')}`;

if (process.argv.includes('--metadata')) {
  console.log(JSON.stringify({
    promptVersion: ADR_MANUAL_EXTRACTION_PROMPT_VERSION,
    contract: ADR_MANUAL_EXTRACTION_CONTRACT,
    promptHash
  }, null, 2));
} else {
  process.stdout.write(`${prompt}\n`);
}
