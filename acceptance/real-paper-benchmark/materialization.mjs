import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService
} from '../../packages/source-ingestion/src/index.mjs';
import { loadPilotCheckpoint } from '../../apps/pilot-api/src/persistence/local-checkpoint.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = join(ROOT, 'scripts/real-paper-benchmark/materialize-rp001.mjs');
const temp = mkdtempSync(join(tmpdir(), 'adr-rp001-materialization-'));

try {
  const pdfPath = join(temp, 'fixture.pdf');
  const outputDir = join(temp, 'out');
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  writeFileSync(pdfPath, pdf);
  const exactHead = 'a'.repeat(40);
  const expectedHash = `sha256:${createHash('sha256').update(pdf).digest('hex')}`;

  const run = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      ADR_CODE_HEAD_SHA: exactHead,
      ADR_RP001_PDF_PATH: pdfPath,
      ADR_RP001_OUTPUT_DIR: outputDir,
      ADR_RP001_ACQUISITION_LOCATOR: 'fixture://rp001-materialization-acceptance',
      ADR_RP001_OPERATOR_ID: 'rp001-materialization-acceptance',
      ADR_RIGHTS_JURISDICTION: 'UNSPECIFIED'
    },
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, `${run.stderr}\n${run.stdout}`);

  const evidence = JSON.parse(readFileSync(join(outputDir, 'rp001-materialization-evidence.json'), 'utf8'));
  assert.equal(evidence.schemaVersion, 'adr.real-paper-materialization-evidence.v1');
  assert.equal(evidence.paperId, 'RP001');
  assert.equal(evidence.codeHeadSha, exactHead);
  assert.equal(evidence.executionBaseline, 'RA02_RIGHTS_ENFORCED_PILOT_PATH');
  assert.equal(evidence.source.contentHash, expectedHash);
  assert.equal(evidence.source.byteLength, pdf.byteLength);
  assert.equal(evidence.source.sourceRef.kind, 'Source');
  assert.equal(evidence.source.sourceArtifactRef.kind, 'SourceArtifact');
  assert.equal(evidence.rights.rightsPolicyRef.kind, 'RightsPolicy');
  assert.equal(evidence.rights.rightsGrantRef.kind, 'RightsGrant');
  assert.equal(evidence.rights.retentionRightsDecisionRef.kind, 'RightsDecision');
  assert.equal(evidence.rights.retentionRightsSideEffectReceiptRef.kind, 'PilotRightsSideEffectReceipt');
  assert.deepEqual(evidence.modelExecution, {
    llmInvoked: false,
    externalModelEgress: false,
    extractionPerformed: false,
    automatedReviewPerformed: false
  });

  const checkpoint = loadPilotCheckpoint({ path: join(outputDir, 'runtime-checkpoint.json') });
  const ledger = AuthorityLedger.fromSnapshot(checkpoint.ledger);
  const store = new FileSystemScopedArtifactStore({ rootDir: join(outputDir, 'artifacts') });
  const registry = new SourceRegistry({ ledger, artifactStore: store });
  const ingestion = new PilotSourceIngestionService({
    sourceRegistry: registry,
    artifactStore: store,
    snapshot: checkpoint.ingestion
  });
  const recovered = ingestion.getUpload(checkpoint.ingestion.sessions[0].uploadId);
  assert.equal(recovered.state, 'SOURCE_MATERIALIZED');
  assert.equal(recovered.sourceRef.semanticHash, evidence.source.sourceRef.semanticHash);
  assert.equal(recovered.sourceArtifactRef.semanticHash, evidence.source.sourceArtifactRef.semanticHash);

  const artifact = registry.resolveArtifact(evidence.source.sourceArtifactRef);
  assert.equal(artifact.semanticPayload.contentHash, expectedHash);
  assert.equal(artifact.semanticPayload.byteLength, pdf.byteLength);

  const chunks = [];
  for await (const chunk of registry.readArtifactStream(artifact.ref)) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), pdf);

  const decision = ledger.resolve(evidence.rights.retentionRightsDecisionRef);
  assert.equal(decision.semanticPayload.operation, 'RETAIN_FULLTEXT');
  assert.equal(decision.semanticPayload.outcome, 'ALLOW');
  const sideEffect = ledger.resolve(evidence.rights.retentionRightsSideEffectReceiptRef);
  assert.equal(sideEffect.semanticPayload.operation, 'RETAIN_FULLTEXT');
  assert.equal(sideEffect.semanticPayload.rightsDecisionRef.semanticHash, decision.ref.semanticHash);

  console.log(JSON.stringify({ total: 1, passed: 1, failed: 0 }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
