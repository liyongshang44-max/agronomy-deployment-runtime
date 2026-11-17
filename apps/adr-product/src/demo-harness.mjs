// Local DEMO only: starts the actual ADR v0.3 HTTP Host with its qualified synthetic
// acceptance world. This is NOT a customer bootstrap, identity provider, or Host replacement.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializePilotRuntime, createPilotHttpServer } from '../../../deploy/adr-pilot-host/server.mjs';
import { validateKnowledgeRetrievalResult } from '../../../packages/knowledge-retrieval/src/index.mjs';

const wireRef = (ref) => ({
  kind: ref.kind,
  logical_id: ref.logicalId,
  version: ref.version,
  semantic_hash: ref.semanticHash
});
const wirePrincipal = (p) => ({
  principal_id: p.principalId,
  type: p.type,
  organization_id: p.organizationId,
  tenant_id: p.tenantId,
  program_ids: p.programIds
});
const secureToken = () => randomBytes(32).toString('hex');

export async function createDemoHarness() {
  const root = mkdtempSync(join(tmpdir(), 'adr-product-demo-'));
  let host = null;
  try {
    const runtime = await initializePilotRuntime({
      statePath: join(root, 'pilot-host', 'state.json'),
      snapshotDir: join(root, 'pilot-host', 'snapshots'),
      allowSyntheticBootstrap: true
    });
    if (!runtime.ready || runtime.metadata.mode !== 'SYNTHETIC_SMOKE') {
      throw new Error('SYNTHETIC_HOST_QUALIFICATION_REQUIRED');
    }
    const assessment = runtime.ledger.exportSnapshot().records.find((record) =>
      record.ref.kind === 'ApplicabilityAssessment'
      && record.ref.logicalId === runtime.metadata.initialAssessmentId);
    if (!assessment) throw new Error('EXACT_SYNTHETIC_ASSESSMENT_REQUIRED');
    const a = assessment.semanticPayload;
    const validated = validateKnowledgeRetrievalResult({
      ledger: runtime.ledger,
      knowledgeRetrievalResultRef: a.knowledgeRetrievalResultRef
    });
    const event = runtime.ledger.auditFor(a.knowledgeRetrievalResultRef).find((e) =>
      e.action === 'PUBLISH_KNOWLEDGE_RETRIEVAL_RESULT'
      && e.details?.runtimeAuthorizationDecisionAuditRef);
    if (!event) throw new Error('EXACT_SYNTHETIC_RUNTIME_AUTHORIZATION_REQUIRED');

    // Tokens are process-local test credentials and never reach the browser.
    const readToken = secureToken();
    const writeToken = secureToken();
    const readPrincipal = {
      principalId: 'agronomist-v03-host',
      type: 'USER',
      organizationId: 'org-a',
      tenantId: 'tenant-a',
      programIds: ['pilot-a']
    };
    runtime.tokenBindings.set(readToken, readPrincipal);
    runtime.tokenBindings.set(writeToken, validated.retrievalPrincipal);

    host = createPilotHttpServer(runtime);
    await new Promise((resolve, reject) => {
      host.once('error', reject);
      host.listen(0, '127.0.0.1', resolve);
    });
    const port = host.address().port;
    return {
      hostBaseUrl: 'http://127.0.0.1:' + port,
      storePath: join(root, 'product-records', 'records.json'),
      readToken,
      writeToken,
      demoAssessmentId: assessment.ref.logicalId,
      principal: wirePrincipal(validated.retrievalPrincipal),
      authorizationRef: wireRef(event.details.runtimeAuthorizationDecisionAuditRef),
      retrievalRef: wireRef(a.knowledgeRetrievalResultRef),
      knowledgeRef: wireRef(a.knowledgeRef),
      manifestRef: wireRef(a.contextManifestRef),
      async close() {
        if (host.listening) await new Promise((resolve) => host.close(resolve));
        rmSync(root, { recursive: true, force: true });
      }
    };
  } catch (e) {
    if (host?.listening) await new Promise((resolve) => host.close(resolve));
    rmSync(root, { recursive: true, force: true });
    throw e;
  }
}
