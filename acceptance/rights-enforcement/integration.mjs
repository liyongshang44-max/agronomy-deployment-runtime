import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  FileSystemScopedArtifactStore,
  PilotSourceIngestionService
} from '../../packages/source-ingestion/src/index.mjs';
import {
  RightsAuthorityError,
  publishRightsGrant,
  publishRightsPolicy
} from '../../packages/rights-authority/src/index.mjs';
import {
  RightsEffectGate,
  RightsGovernedExternalExtraction,
  RightsGovernedPilotSourceIngestion
} from '../../packages/rights-enforcement/src/index.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };
const OWNER = { principalId: 'rights-owner', type: 'USER', ...SCOPE };
const ACTOR = { principalId: 'pilot-operator', type: 'USER', ...SCOPE };
const EVALUATOR = { principalId: 'rights-engine', type: 'SERVICE_ACCOUNT', ...SCOPE };

function audit(eventId, principal, occurredAt, inputRefs = []) {
  return {
    eventId,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    inputRefs,
    details: { channel: 'rights-enforcement-integration' }
  };
}

function createEnvironment(label, { ledger = new AuthorityLedger(), rootDir = null, ingestionSnapshot = null } = {}) {
  const root = rootDir ?? mkdtempSync(join(tmpdir(), `adr-rights-${label}-`));
  const artifactStore = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const base = new PilotSourceIngestionService({
    sourceRegistry,
    artifactStore,
    maxUploadBytes: 8 * 1024 * 1024,
    snapshot: ingestionSnapshot
  });
  const gate = new RightsEffectGate({ ledger });
  return { rootDir: root, ledger, artifactStore, sourceRegistry, base, gate };
}

function publishPolicy(env, label) {
  return publishRightsPolicy({
    ledger: env.ledger,
    logicalId: `rights.policy.integration.${label}`,
    version: '1',
    ownership: SCOPE,
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit(`evt-policy-${label}`, OWNER, '2026-08-18T13:00:00Z')
  });
}

function sourceDraft(label) {
  return {
    logicalId: `source.integration.${label}`,
    version: '1',
    sourceType: 'PUBLICATION',
    title: `Integration ${label}`,
    bibliographic: {},
    rights: { basis: 'metadata-only-not-authority' },
    metadata: {}
  };
}

function artifactDraft(label) {
  return {
    logicalId: `artifact.integration.${label}`,
    version: '1',
    mediaType: 'application/pdf',
    materializationIdentity: `integration:${label}`,
    acquisition: { method: 'UPLOAD', acquiredAt: '2026-08-18T13:00:00Z', locator: `upload://${label}` },
    rightsSnapshot: { basis: 'metadata-only-not-authority' },
    metadata: {}
  };
}

function retentionUse(policyRef, sourceRef, label, at = '2026-08-18T13:30:00Z') {
  return {
    logicalId: `rights.decision.integration.${label}.retain`,
    version: '1',
    rightsPolicyRef: policyRef,
    subjectRef: sourceRef,
    actor: ACTOR,
    evaluatorPrincipal: EVALUATOR,
    operation: 'RETAIN_FULLTEXT',
    purpose: 'SOURCE_RETENTION',
    jurisdiction: 'US',
    evaluatedAt: at,
    enforceableObligations: [],
    audit: audit(`evt-decision-${label}-retain`, EVALUATOR, at)
  };
}

function artifactUse(policyRef, artifactRef, label, operation, at = '2026-08-18T14:00:00Z') {
  return {
    logicalId: `rights.decision.integration.${label}.${operation.toLowerCase()}`,
    version: '1',
    rightsPolicyRef: policyRef,
    subjectRef: artifactRef,
    actor: ACTOR,
    evaluatorPrincipal: EVALUATOR,
    operation,
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'US',
    evaluatedAt: at,
    enforceableObligations: [],
    audit: audit(`evt-decision-${label}-${operation.toLowerCase()}`, EVALUATOR, at)
  };
}

function grant(env, { policyRef, subjectRef, label, rules, issuedAt = '2026-08-18T13:10:00Z' }) {
  return publishRightsGrant({
    ledger: env.ledger,
    logicalId: `rights.grant.integration.${label}`,
    version: '1',
    rightsPolicyRef: policyRef,
    subjectRef,
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type },
    rules,
    validFrom: issuedAt,
    validUntil: '2026-08-19T13:10:00Z',
    grantorPrincipal: OWNER,
    audit: audit(`evt-grant-${label}`, OWNER, issuedAt)
  });
}

async function expectAsyncError(fn, ErrorType, code) {
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function governedCreate(env, policyRef, label, ingestion = env.base) {
  const governed = new RightsGovernedPilotSourceIngestion({
    ledger: env.ledger,
    sourceRegistry: env.sourceRegistry,
    ingestion,
    gate: env.gate
  });
  const created = governed.createUpload({
    scope: SCOPE,
    filename: `${label}.pdf`,
    source: sourceDraft(label),
    artifact: artifactDraft(label),
    rightsPolicyRef: policyRef,
    sourceAudit: audit(`evt-source-${label}`, ACTOR, '2026-08-18T13:05:00Z')
  });
  return { governed, created };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('governed upload publishes exact Source before any retention effect', async () => {
  const env = createEnvironment('pre-source');
  try {
    const policy = publishPolicy(env, 'pre-source');
    let uploadCalls = 0;
    const tracked = {
      createUpload: (...args) => env.base.createUpload(...args),
      getUpload: (...args) => env.base.getUpload(...args),
      finalizeUpload: (...args) => env.base.finalizeUpload(...args),
      uploadPdf: async (...args) => { uploadCalls += 1; return env.base.uploadPdf(...args); }
    };
    const { governed, created } = governedCreate(env, policy.ref, 'pre-source', tracked);
    assert.equal(created.source.ref.kind, 'Source');
    assert.equal(env.ledger.resolve(created.governance.sourceRef).ref.kind, 'Source');
    assert.equal(uploadCalls, 0);
    assert.equal(env.base.getUpload(created.upload.uploadId).state, 'CREATED');

    await expectAsyncError(() => governed.uploadPdf({
      uploadId: created.upload.uploadId,
      readable: Readable.from([Buffer.from('%PDF-1.7\nblocked')]),
      rightsUse: retentionUse(policy.ref, created.source.ref, 'pre-source')
    }), RightsAuthorityError, 'RIGHTS_DENIED');
    assert.equal(uploadCalls, 0, 'DENY must occur before base ingestion reaches artifact store');
    assert.equal(env.base.getUpload(created.upload.uploadId).state, 'CREATED');
  } finally {
    rmSync(env.rootDir, { recursive: true, force: true });
  }
});

test('retention ALLOW writes bytes then SourceArtifact audit binds exact retention RightsDecision', async () => {
  const env = createEnvironment('retain-bind');
  try {
    const policy = publishPolicy(env, 'retain-bind');
    const { governed, created } = governedCreate(env, policy.ref, 'retain-bind');
    grant(env, {
      policyRef: policy.ref,
      subjectRef: created.source.ref,
      label: 'retain-bind',
      rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }]
    });
    const stored = await governed.uploadPdf({
      uploadId: created.upload.uploadId,
      readable: Readable.from([Buffer.from('%PDF-1.7\nretained\n%%EOF')]),
      rightsUse: retentionUse(policy.ref, created.source.ref, 'retain-bind')
    });
    assert.equal(stored.upload.state, 'STORED');
    assert.ok(stored.governance.retentionRightsDecisionRef);

    const finalized = governed.finalizeUpload({
      uploadId: created.upload.uploadId,
      artifactAudit: audit('evt-artifact-retain-bind', ACTOR, '2026-08-18T13:40:00Z')
    });
    assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');
    assert.ok(finalized.sourceArtifact.ref.semanticHash);
    const artifactAudit = env.ledger.auditFor(finalized.sourceArtifact.ref)
      .find((event) => event.objectRef.semanticHash === finalized.sourceArtifact.ref.semanticHash);
    assert.ok(artifactAudit.inputRefs.some((ref) => ref.semanticHash === stored.governance.retentionRightsDecisionRef.semanticHash));
  } finally {
    rmSync(env.rootDir, { recursive: true, force: true });
  }
});

test('governed retention provenance survives ledger + ingestion + governance snapshot restart', async () => {
  const env = createEnvironment('restart');
  try {
    const policy = publishPolicy(env, 'restart');
    const { governed, created } = governedCreate(env, policy.ref, 'restart');
    grant(env, {
      policyRef: policy.ref,
      subjectRef: created.source.ref,
      label: 'restart',
      rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }]
    });
    const stored = await governed.uploadPdf({
      uploadId: created.upload.uploadId,
      readable: Readable.from([Buffer.from('%PDF-1.7\nrestart\n%%EOF')]),
      rightsUse: retentionUse(policy.ref, created.source.ref, 'restart')
    });

    const ledger2 = AuthorityLedger.fromSnapshot(env.ledger.exportSnapshot());
    const env2 = createEnvironment('restart-restored', {
      ledger: ledger2,
      rootDir: env.rootDir,
      ingestionSnapshot: env.base.exportSnapshot()
    });
    const governed2 = new RightsGovernedPilotSourceIngestion({
      ledger: ledger2,
      sourceRegistry: env2.sourceRegistry,
      ingestion: env2.base,
      gate: env2.gate,
      snapshot: governed.exportSnapshot()
    });
    const recovered = governed2.getUpload(created.upload.uploadId);
    assert.equal(recovered.governance.retentionRightsDecisionRef.semanticHash, stored.governance.retentionRightsDecisionRef.semanticHash);
    const finalized = governed2.finalizeUpload({
      uploadId: created.upload.uploadId,
      artifactAudit: audit('evt-artifact-restart', ACTOR, '2026-08-18T13:45:00Z')
    });
    assert.equal(finalized.upload.state, 'SOURCE_MATERIALIZED');
  } finally {
    rmSync(env.rootDir, { recursive: true, force: true });
  }
});

test('actual SourceRegistry stream and provider are never touched when MODEL_EGRESS is denied', async () => {
  const env = createEnvironment('egress-deny-real');
  try {
    const policy = publishPolicy(env, 'egress-deny-real');
    const source = env.sourceRegistry.registerSource({
      ...sourceDraft('egress-deny-real'), ownership: SCOPE,
      audit: audit('evt-source-egress-deny-real', ACTOR, '2026-08-18T13:05:00Z')
    });
    const artifact = env.sourceRegistry.materializeArtifact({
      ...artifactDraft('egress-deny-real'), sourceRef: source.ref,
      bytes: Buffer.from('%PDF-1.7\nprovider-denied\n%%EOF'),
      audit: audit('evt-artifact-egress-deny-real', ACTOR, '2026-08-18T13:06:00Z')
    });
    grant(env, {
      policyRef: policy.ref,
      subjectRef: artifact.ref,
      label: 'egress-deny-read-only',
      rules: [{ operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }]
    });
    let streamCalls = 0;
    let providerCalls = 0;
    const trackedRegistry = {
      resolveArtifact: (ref) => env.sourceRegistry.resolveArtifact(ref),
      readArtifactStream: (ref) => { streamCalls += 1; return env.sourceRegistry.readArtifactStream(ref); }
    };
    const extraction = new RightsGovernedExternalExtraction({ sourceRegistry: trackedRegistry, gate: env.gate });
    await expectAsyncError(() => extraction.extract({
      artifactRef: artifact.ref,
      readUse: artifactUse(policy.ref, artifact.ref, 'egress-deny-read', 'READ_FOR_EXTRACTION'),
      modelEgressUse: artifactUse(policy.ref, artifact.ref, 'egress-deny-model', 'MODEL_EGRESS'),
      provider: async () => { providerCalls += 1; return {}; }
    }), RightsAuthorityError, 'RIGHTS_DENIED');
    assert.equal(streamCalls, 0);
    assert.equal(providerCalls, 0);
  } finally {
    rmSync(env.rootDir, { recursive: true, force: true });
  }
});

test('dual SourceArtifact ALLOW creates one verified stream, calls provider once, and returns both RightsDecision refs', async () => {
  const env = createEnvironment('egress-allow-real');
  try {
    const policy = publishPolicy(env, 'egress-allow-real');
    const source = env.sourceRegistry.registerSource({
      ...sourceDraft('egress-allow-real'), ownership: SCOPE,
      audit: audit('evt-source-egress-allow-real', ACTOR, '2026-08-18T13:05:00Z')
    });
    const artifact = env.sourceRegistry.materializeArtifact({
      ...artifactDraft('egress-allow-real'), sourceRef: source.ref,
      bytes: Buffer.from('%PDF-1.7\nprovider-allowed\n%%EOF'),
      audit: audit('evt-artifact-egress-allow-real', ACTOR, '2026-08-18T13:06:00Z')
    });
    grant(env, {
      policyRef: policy.ref,
      subjectRef: artifact.ref,
      label: 'egress-allow-both',
      rules: [
        { operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] },
        { operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }
      ]
    });
    let streamCalls = 0;
    let providerCalls = 0;
    let providerBytes = 0;
    const trackedRegistry = {
      resolveArtifact: (ref) => env.sourceRegistry.resolveArtifact(ref),
      readArtifactStream: (ref) => { streamCalls += 1; return env.sourceRegistry.readArtifactStream(ref); }
    };
    const extraction = new RightsGovernedExternalExtraction({ sourceRegistry: trackedRegistry, gate: env.gate });
    const result = await extraction.extract({
      artifactRef: artifact.ref,
      readUse: artifactUse(policy.ref, artifact.ref, 'egress-allow-read', 'READ_FOR_EXTRACTION'),
      modelEgressUse: artifactUse(policy.ref, artifact.ref, 'egress-allow-model', 'MODEL_EGRESS'),
      provider: async ({ readable, rightsDecisionRefs }) => {
        providerCalls += 1;
        for await (const chunk of readable) providerBytes += chunk.byteLength;
        return { observedRightsDecisionRefs: rightsDecisionRefs };
      }
    });
    assert.equal(streamCalls, 1);
    assert.equal(providerCalls, 1);
    assert.equal(providerBytes, artifact.semanticPayload.byteLength);
    assert.equal(result.rightsDecisionRefs.length, 2);
    assert.equal(result.providerResult.observedRightsDecisionRefs.length, 2);
  } finally {
    rmSync(env.rootDir, { recursive: true, force: true });
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;
