import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore } from '../../packages/source-ingestion/src/index.mjs';
import { RightsAuthorityError } from '../../packages/rights-authority/src/index.mjs';
import { PilotRightsEnforcementService } from '../../apps/pilot-api/src/rights/enforcement.mjs';

const VALID_FROM = '2026-01-01T00:00:00Z';
const VALID_UNTIL = '2027-01-01T00:00:00Z';
const OWNERSHIP = { organizationId: 'org-ra02', tenantId: 'tenant-ra02' };
const OPERATOR = 'ra02-operator';
const RUNTIME = 'ra02-runtime';

function audit(eventId, inputRefs = []) {
  return {
    eventId,
    occurredAt: new Date().toISOString(),
    actor: { type: 'USER', id: OPERATOR },
    inputRefs,
    details: { channel: 'rights-enforcement-acceptance' }
  };
}

function expectRightsError(promise, code) {
  return promise.then(
    () => assert.fail(`expected RightsAuthorityError ${code}`),
    (error) => {
      assert.ok(error instanceof RightsAuthorityError, `expected RightsAuthorityError, got ${error?.constructor?.name}`);
      assert.equal(error.code, code);
      return error;
    }
  );
}

function rule(operation, { purposes = ['*'], jurisdictions = ['*'], obligations = [] } = {}) {
  return { operation, purposes, jurisdictions, obligations };
}

const root = mkdtempSync(join(tmpdir(), 'adr-ra02-'));
try {
  const ledger = new AuthorityLedger();
  const artifactStore = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const rights = new PilotRightsEnforcementService({ ledger, operatorId: OPERATOR, evaluatorId: 'ra02-rights-engine' });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.ra02.fixture',
    version: '1',
    sourceType: 'PUBLICATION',
    title: 'RA02 enforcement fixture',
    ownership: OWNERSHIP,
    rights: { basis: 'metadata-only-not-authority' },
    audit: audit('evt-ra02-source')
  });
  const bytes = Buffer.from('%PDF-1.7\nRA02 exact source bytes\n%%EOF\n');

  // RETAIN_FULLTEXT is evaluated against the Source before any retained PDF object exists.
  const retainDenyWorld = rights.provision({
    subjectRef: source.ref,
    basisClass: 'LICENSE',
    rules: [rule('ACQUIRE')],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'retain-deny'
  });
  let retentionSideEffects = 0;
  await expectRightsError(rights.execute({
    rightsPolicyRef: retainDenyWorld.rightsPolicyRef,
    subjectRef: source.ref,
    actorId: OPERATOR,
    actorType: 'USER',
    operation: 'RETAIN_FULLTEXT',
    purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION',
    jurisdiction: 'GB',
    sideEffect: async () => {
      retentionSideEffects += 1;
      return artifactStore.putForScope(OWNERSHIP, bytes);
    }
  }), 'RIGHTS_DENIED');
  assert.equal(retentionSideEffects, 0, 'DENY must occur before retained bytes side effect');

  const retainAllowWorld = rights.provision({
    subjectRef: source.ref,
    basisClass: 'LICENSE',
    rules: [rule('RETAIN_FULLTEXT')],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'retain-allow'
  });
  const retained = await rights.execute({
    rightsPolicyRef: retainAllowWorld.rightsPolicyRef,
    subjectRef: source.ref,
    actorId: OPERATOR,
    actorType: 'USER',
    operation: 'RETAIN_FULLTEXT',
    purpose: 'SCIENTIFIC_KNOWLEDGE_INGESTION',
    jurisdiction: 'GB',
    sideEffect: async ({ rightsDecisionRef }) => {
      retentionSideEffects += 1;
      const receipt = artifactStore.putForScope(OWNERSHIP, bytes);
      const artifact = sourceRegistry.materializeRetainedArtifact({
        logicalId: 'artifact.ra02.fixture',
        version: '1',
        sourceRef: source.ref,
        retentionReceipt: receipt,
        mediaType: 'application/pdf',
        materializationIdentity: 'ra02-fixture',
        acquisition: { method: 'FIXTURE', acquiredAt: new Date().toISOString(), locator: 'fixture://ra02' },
        rightsSnapshot: { basis: 'metadata-only-not-authority' },
        audit: audit('evt-ra02-artifact', [rightsDecisionRef])
      });
      return { receipt, artifact };
    }
  });
  assert.equal(retentionSideEffects, 1);
  const artifact = retained.result.artifact;
  assert.equal(artifact.semanticPayload.contentHash, retained.result.receipt.contentHash);
  const artifactAudit = ledger.auditFor(artifact.ref).find((event) => event.action === 'PUBLISH_AUTHORITY');
  assert.ok(artifactAudit.inputRefs.some((ref) => ref.semanticHash === retained.rightsDecisionRef.semanticHash));

  // Source grants never inherit; exact SourceArtifact rights are required for reads and egress.
  const readDenyWorld = rights.provision({
    subjectRef: artifact.ref,
    basisClass: 'LICENSE',
    rules: [rule('MODEL_EGRESS')],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'read-deny'
  });
  let readSideEffects = 0;
  await expectRightsError(rights.execute({
    rightsPolicyRef: readDenyWorld.rightsPolicyRef,
    subjectRef: artifact.ref,
    actorId: RUNTIME,
    operation: 'READ_FOR_EXTRACTION',
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'GB',
    sideEffect: async () => {
      readSideEffects += 1;
      return sourceRegistry.readArtifactBytes(artifact.ref);
    }
  }), 'RIGHTS_DENIED');
  assert.equal(readSideEffects, 0, 'DENY must occur before artifact read side effect');

  const egressDenyWorld = rights.provision({
    subjectRef: artifact.ref,
    basisClass: 'LICENSE',
    rules: [rule('READ_FOR_EXTRACTION')],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'egress-deny'
  });
  let providerCalls = 0;
  await expectRightsError(rights.execute({
    rightsPolicyRef: egressDenyWorld.rightsPolicyRef,
    subjectRef: artifact.ref,
    actorId: RUNTIME,
    operation: 'MODEL_EGRESS',
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'GB',
    sideEffect: async () => {
      providerCalls += 1;
      return { provider: 'must-not-run' };
    }
  }), 'RIGHTS_DENIED');
  assert.equal(providerCalls, 0, 'MODEL_EGRESS DENY must prevent provider transport');

  const obligationWorld = rights.provision({
    subjectRef: artifact.ref,
    basisClass: 'LICENSE',
    rules: [rule('MODEL_EGRESS', { obligations: ['DELETE_PROVIDER_COPY'] })],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'obligation-block'
  });
  await expectRightsError(rights.execute({
    rightsPolicyRef: obligationWorld.rightsPolicyRef,
    subjectRef: artifact.ref,
    actorId: RUNTIME,
    operation: 'MODEL_EGRESS',
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'GB',
    enforceableObligations: [],
    sideEffect: async () => {
      providerCalls += 1;
      return { provider: 'must-not-run' };
    }
  }), 'RIGHTS_OBLIGATION_UNSUPPORTED');
  assert.equal(providerCalls, 0, 'unsupported mandatory obligation must block provider transport');

  const egressAllowWorld = rights.provision({
    subjectRef: artifact.ref,
    basisClass: 'LICENSE',
    rules: [rule('MODEL_EGRESS', { obligations: ['NO_MODEL_TRAINING', 'DELETE_PROVIDER_COPY'] })],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    version: 'egress-allow'
  });
  const egress = await rights.execute({
    rightsPolicyRef: egressAllowWorld.rightsPolicyRef,
    subjectRef: artifact.ref,
    actorId: RUNTIME,
    operation: 'MODEL_EGRESS',
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'GB',
    enforceableObligations: ['NO_MODEL_TRAINING', 'DELETE_PROVIDER_COPY'],
    sideEffect: async ({ rightsDecisionRef }) => {
      providerCalls += 1;
      const trace = ledger.publish({
        kind: 'RA02ProviderTransportTrace',
        logicalId: 'trace.ra02.provider',
        version: '1',
        semanticPayload: { provider: 'fixture-provider', transportAuthority: 'TEST_ONLY' },
        audit: audit('evt-ra02-provider-trace', [rightsDecisionRef])
      });
      return trace;
    }
  });
  assert.equal(providerCalls, 1);
  assert.equal(egress.outcome, 'ALLOW');
  assert.deepEqual(egress.obligations, ['DELETE_PROVIDER_COPY', 'NO_MODEL_TRAINING']);
  const traceAudit = ledger.auditFor(egress.result.ref).find((event) => event.action === 'PUBLISH_AUTHORITY');
  assert.ok(traceAudit.inputRefs.some((ref) => ref.semanticHash === egress.rightsDecisionRef.semanticHash));

  console.log(JSON.stringify({
    total: 6,
    passed: 6,
    failed: 0,
    retentionDeniedBeforeBytes: true,
    readDeniedBeforeBytes: true,
    modelEgressDeniedBeforeProvider: true,
    obligationBlockedBeforeProvider: true,
    exactDecisionRefsInProvenance: true
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
