import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore, PilotSourceIngestionService } from '../../packages/source-ingestion/src/index.mjs';
import { publishRightsPolicy } from '../../packages/rights-authority/src/index.mjs';
import { RightsEnforcementError } from '../../packages/rights-enforcement/src/index.mjs';
import { PilotRightsRuntime } from '../../apps/pilot-api/src/rights/runtime.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };
const OWNER = { principalId: 'pilot-owner', type: 'USER', ...SCOPE };

function audit(eventId, principal, occurredAt) {
  return { eventId, occurredAt, actor: { type: principal.type, id: principal.principalId }, details: { channel: 'pilot-rights-runtime-acceptance' } };
}

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

const root = mkdtempSync(join(tmpdir(), 'adr-pilot-rights-runtime-'));
try {
  const ledger = new AuthorityLedger();
  const store = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: store });
  const ingestion = new PilotSourceIngestionService({ sourceRegistry, artifactStore: store });
  const policy = publishRightsPolicy({
    ledger,
    logicalId: 'rights.policy.pilot-runtime',
    version: '1',
    ownership: SCOPE,
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit('evt-policy', OWNER, '2026-08-18T17:00:00Z')
  });
  const runtime = new PilotRightsRuntime({ ledger, sourceRegistry, ingestion, operatorId: OWNER.principalId });
  const created = runtime.createUpload({
    scope: SCOPE,
    filename: 'pilot-runtime.pdf',
    rightsPolicyRef: policy.ref,
    source: {
      logicalId: 'source.pilot-runtime',
      version: '1',
      sourceType: 'PUBLICATION',
      title: 'Pilot runtime source',
      rights: { basis: 'metadata-only' }
    },
    artifact: {
      logicalId: 'artifact.pilot-runtime',
      version: '1',
      mediaType: 'application/pdf',
      materializationIdentity: 'pilot-runtime',
      acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-18T17:00:00Z', locator: 'upload://pilot-runtime' },
      rightsSnapshot: { basis: 'metadata-only' }
    }
  }, audit('evt-source', OWNER, '2026-08-18T17:01:00Z'));
  assert.equal(created.source.ref.kind, 'Source');

  runtime.publishGrant({
    uploadId: created.upload.uploadId,
    subject: 'SOURCE',
    rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }],
    validFrom: '2026-08-18T17:02:00Z',
    validUntil: '2026-08-19T17:02:00Z',
    grantAudit: audit('evt-source-grant', OWNER, '2026-08-18T17:02:00Z')
  });
  const retained = await runtime.uploadPdf({
    uploadId: created.upload.uploadId,
    readable: Readable.from([Buffer.from('%PDF-1.7\npilot-runtime\n%%EOF')]),
    jurisdiction: 'US',
    at: '2026-08-18T17:03:00Z'
  });
  assert.equal(retained.upload.state, 'STORED');
  const finalized = runtime.finalizeUpload({
    uploadId: created.upload.uploadId,
    artifactAudit: audit('evt-artifact', OWNER, '2026-08-18T17:04:00Z')
  });
  assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');

  runtime.publishGrant({
    uploadId: created.upload.uploadId,
    subject: 'SOURCE_ARTIFACT',
    rules: [
      { operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] },
      { operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }
    ],
    validFrom: '2026-08-18T17:05:00Z',
    validUntil: '2026-08-19T17:05:00Z',
    grantAudit: audit('evt-artifact-grant', OWNER, '2026-08-18T17:05:00Z')
  });
  let providerCalls = 0;
  const extracted = await runtime.extractExternal({
    uploadId: created.upload.uploadId,
    jurisdiction: 'US',
    at: '2026-08-18T17:06:00Z',
    provider: async ({ readable, rightsDecisionRefs }) => {
      providerCalls += 1;
      let bytes = 0;
      for await (const chunk of readable) bytes += chunk.byteLength;
      return { bytes, rightsDecisionRefs };
    }
  });
  assert.equal(providerCalls, 1);
  assert.equal(extracted.rightsDecisionRefs.length, 2);
  assert.equal(extracted.providerResult.bytes, finalized.sourceArtifact.semanticPayload.byteLength);

  const outsiderRuntime = new PilotRightsRuntime({
    ledger,
    sourceRegistry,
    ingestion,
    operatorId: 'same-tenant-not-owner',
    snapshot: runtime.exportSnapshot()
  });
  expectError(() => outsiderRuntime.publishGrant({
    uploadId: created.upload.uploadId,
    subject: 'SOURCE_ARTIFACT',
    rules: [{ operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }],
    validFrom: '2026-08-18T17:07:00Z',
    validUntil: '2026-08-19T17:07:00Z',
    grantAudit: audit('evt-outsider-grant', { principalId: 'same-tenant-not-owner', type: 'USER', ...SCOPE }, '2026-08-18T17:07:00Z')
  }), RightsEnforcementError, 'PILOT_OPERATOR_NOT_RIGHTS_POLICY_OWNER');

  console.log(JSON.stringify({ total: 2, passed: 2, failed: 0 }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
