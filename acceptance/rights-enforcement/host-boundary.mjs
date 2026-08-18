import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../../apps/pilot-api/src/server.mjs', import.meta.url));
const server = readFileSync(serverPath, 'utf8');

for (const forbidden of [
  'ingestion.createUpload(',
  'ingestion.uploadPdf(',
  'ingestion.finalizeUpload(',
  'sourceRegistry.readArtifactStream('
]) {
  assert.equal(
    server.includes(forbidden),
    false,
    `pilot host bypasses governed Rights I/O through forbidden direct call: ${forbidden}`
  );
}

for (const required of [
  'pilotRights.createUpload(',
  'pilotRights.uploadPdf(',
  'pilotRights.finalizeUpload(',
  'pilotRights.extractExternal(',
  'bindExtractionRightsToCompilation({',
  'rightsGovernance: pilotRights',
  "newUploadsRequireExactRightsPolicy: true",
  "legacySessionsAutoAuthorized: false"
]) {
  assert.equal(server.includes(required), true, `pilot host is missing governed Rights boundary: ${required}`);
}

assert.match(
  server,
  /provider:\s*\(\{ readable \}\)\s*=>\s*extractCompilationProposalWithOpenAI\(\{\s*readable,/s,
  'configured provider must receive readable only from governed external extraction callback'
);
assert.equal(
  server.includes('externalProcessingAuthorized=true is required in addition to RightsDecision authority'),
  true,
  'external-processing consent must remain additional to Rights authority rather than substitute for it'
);

console.log(JSON.stringify({
  boundary: 'PILOT_HOST_GOVERNED_RIGHTS_IO_V1',
  directBypasses: 0,
  status: 'PASS'
}, null, 2));
