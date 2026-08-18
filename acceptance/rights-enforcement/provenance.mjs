import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import { FileSystemScopedArtifactStore } from '../../packages/source-ingestion/src/index.mjs';
import {
  ScientificCompiler,
  createDeterministicCompilerDefinition
} from '../../packages/scientific-compiler/src/index.mjs';
import { publishRightsGrant, publishRightsPolicy } from '../../packages/rights-authority/src/index.mjs';
import {
  RightsEffectGate,
  RightsGovernedExternalExtraction,
  bindExtractionRightsToCompilation,
  RIGHTS_COMPILATION_AUTHORITY_CLAIM,
  RIGHTS_COMPILATION_PROVENANCE_VERSION
} from '../../packages/rights-enforcement/src/index.mjs';

const SCOPE = { organizationId: 'org-a', tenantId: 'tenant-a' };
const OWNER = { principalId: 'rights-owner', type: 'USER', ...SCOPE };
const ACTOR = { principalId: 'compiler-operator', type: 'USER', ...SCOPE };
const EVALUATOR = { principalId: 'rights-engine', type: 'SERVICE_ACCOUNT', ...SCOPE };

function audit(eventId, principal, occurredAt, inputRefs = []) {
  return {
    eventId,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    inputRefs,
    details: { channel: 'rights-provenance-acceptance' }
  };
}

function notReported() { return { status: 'NOT_REPORTED', dimensions: [] }; }

const root = mkdtempSync(join(tmpdir(), 'adr-rights-provenance-'));
try {
  const ledger = new AuthorityLedger();
  const artifactStore = new FileSystemScopedArtifactStore({ rootDir: root });
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore });
  const source = sourceRegistry.registerSource({
    logicalId: 'source.rights-provenance',
    version: '1',
    sourceType: 'PUBLICATION',
    title: 'Rights provenance fixture',
    ownership: SCOPE,
    rights: { basis: 'metadata-only' },
    audit: audit('evt-source', ACTOR, '2026-08-18T16:00:00Z')
  });
  const exactBytes = Buffer.from('%PDF-1.7\nrights provenance\n%%EOF');
  const retentionReceipt = artifactStore.putForScope(SCOPE, exactBytes);
  const artifact = sourceRegistry.materializeRetainedArtifact({
    logicalId: 'artifact.rights-provenance',
    version: '1',
    sourceRef: source.ref,
    retentionReceipt,
    mediaType: 'application/pdf',
    materializationIdentity: 'rights-provenance',
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T16:00:00Z', locator: 'fixture://rights-provenance' },
    audit: audit('evt-artifact', ACTOR, '2026-08-18T16:01:00Z')
  });
  const policy = publishRightsPolicy({
    ledger,
    logicalId: 'rights.policy.provenance',
    version: '1',
    ownership: SCOPE,
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit('evt-policy', OWNER, '2026-08-18T16:02:00Z')
  });
  publishRightsGrant({
    ledger,
    logicalId: 'rights.grant.provenance',
    version: '1',
    rightsPolicyRef: policy.ref,
    subjectRef: artifact.ref,
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type },
    rules: [
      { operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] },
      { operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }
    ],
    validFrom: '2026-08-18T16:03:00Z',
    validUntil: '2026-08-19T16:03:00Z',
    grantorPrincipal: OWNER,
    audit: audit('evt-grant', OWNER, '2026-08-18T16:03:00Z')
  });

  function use(operation, at) {
    return {
      logicalId: `rights.decision.provenance.${operation.toLowerCase()}`,
      version: '1',
      rightsPolicyRef: policy.ref,
      subjectRef: artifact.ref,
      actor: ACTOR,
      evaluatorPrincipal: EVALUATOR,
      operation,
      purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
      jurisdiction: 'US',
      evaluatedAt: at,
      enforceableObligations: [],
      audit: audit(`evt-${operation.toLowerCase()}`, EVALUATOR, at)
    };
  }

  const extraction = new RightsGovernedExternalExtraction({
    sourceRegistry,
    gate: new RightsEffectGate({ ledger })
  });
  const extracted = await extraction.extract({
    artifactRef: artifact.ref,
    readUse: use('READ_FOR_EXTRACTION', '2026-08-18T16:10:00Z'),
    modelEgressUse: use('MODEL_EGRESS', '2026-08-18T16:10:00Z'),
    provider: async ({ readable }) => {
      let readBytes = 0;
      for await (const chunk of readable) readBytes += chunk.byteLength;
      assert.equal(readBytes, exactBytes.byteLength);
      return {
        proposal: {
          claims: [{
            key: 'rights-provenance-claim',
            claimType: 'BOUNDARY_CONSTRAINT',
            assertion: 'Rights provenance remains explicit.',
            confidence: 0.9,
            sourceLocator: {
              kind: 'DOCUMENT_COORDINATE',
              scheme: 'PDF_PAGE_TEXT_V1',
              coordinates: { page: 1, evidenceText: 'rights provenance' }
            },
            sourceContext: {
              BIOLOGICAL: notReported(),
              ENVIRONMENTAL: notReported(),
              MANAGEMENT: notReported(),
              OPERATIONAL: notReported(),
              MEASUREMENT: notReported(),
              JURISDICTION_ECONOMIC: notReported()
            }
          }],
          runMetadata: { provider: 'FIXTURE_PROVIDER', model: 'fixture-model', outputAuthority: 'PROPOSAL_ONLY' }
        }
      };
    }
  });
  assert.equal(extracted.rightsDecisionRefs.length, 2);

  const compilerDefinition = createDeterministicCompilerDefinition({
    ledger,
    logicalId: 'compiler.rights-provenance',
    version: '1',
    compilerId: 'rights-provenance-fixture',
    implementationVersion: 'v1',
    audit: audit('evt-compiler-definition', EVALUATOR, '2026-08-18T16:11:00Z')
  });
  const compilerAudit = audit('evt-compilation', EVALUATOR, '2026-08-18T16:12:00Z');
  const bound = bindExtractionRightsToCompilation({
    ledger,
    proposal: extracted.providerResult.proposal,
    audit: compilerAudit,
    rightsDecisionRefs: extracted.rightsDecisionRefs
  });
  assert.equal(bound.proposal.runMetadata.rightsProvenanceVersion, RIGHTS_COMPILATION_PROVENANCE_VERSION);
  assert.equal(bound.proposal.runMetadata.rightsAuthorityClaim, RIGHTS_COMPILATION_AUTHORITY_CLAIM);
  assert.deepEqual(bound.proposal.runMetadata.rightsDecisionRefs, extracted.rightsDecisionRefs);
  assert.deepEqual(bound.audit.inputRefs, extracted.rightsDecisionRefs);

  const compiler = new ScientificCompiler({ ledger, sourceRegistry });
  const compiled = compiler.materializeCompilationProposal({
    compilationLogicalId: 'compilation.rights-provenance',
    version: '1',
    sourceArtifactRef: artifact.ref,
    compilerDefinitionRef: compilerDefinition.ref,
    proposal: bound.proposal,
    audit: bound.audit
  });
  assert.deepEqual(compiled.result.semanticPayload.runMetadata.rightsDecisionRefs, extracted.rightsDecisionRefs);
  assert.equal(compiled.result.semanticPayload.runMetadata.rightsAuthorityClaim, RIGHTS_COMPILATION_AUTHORITY_CLAIM);

  for (const record of [compiled.result, ...compiled.claimCandidates, ...compiled.sourceContextCandidates]) {
    const direct = ledger.auditFor(record.ref).find((event) => event.objectRef.semanticHash === record.ref.semanticHash);
    for (const rightsRef of extracted.rightsDecisionRefs) {
      assert.ok(
        direct.inputRefs.some((ref) => ref.semanticHash === rightsRef.semanticHash),
        `${record.ref.kind} audit must bind exact extraction RightsDecision ${rightsRef.semanticHash}`
      );
    }
  }

  console.log(JSON.stringify({
    total: 1,
    passed: 1,
    failed: 0,
    rightsDecisionRefs: extracted.rightsDecisionRefs.length,
    rightsProvenanceVersion: RIGHTS_COMPILATION_PROVENANCE_VERSION
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
